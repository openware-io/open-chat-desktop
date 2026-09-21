/**
 * WebSocket 长连接客户端。
 * 连接 ws(s)://host/ws/im/v1?ticket=...（票据由 POST /auth/ws-ticket 一次性获取）。
 * 帧信封双向 { event, data }；自动心跳 + 断线指数退避重连。
 */

import type {
  WsConnectionStatus,
  WsEnvelope,
  WsEventHandler,
  WsStatusHandler
} from './types'

export interface WsClientOptions {
  heartbeatIntervalMs?: number
  reconnectBaseDelayMs?: number
  maxReconnectDelayMs?: number
}

export type WsUrlProvider = () => string | Promise<string>

const DEFAULT_HEARTBEAT_MS = 30_000
const DEFAULT_BASE_DELAY_MS = 1_000
const DEFAULT_MAX_DELAY_MS = 30_000

export class WsClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<WsEventHandler>>()
  private statusHandlers = new Set<WsStatusHandler>()
  private shouldReconnect = true
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connectingPromise: Promise<void> | null = null
  private reconnectAttempts = 0
  private status: WsConnectionStatus = 'idle'
  private attemptGeneration = 0
  private heartbeatMs: number
  private baseDelayMs: number
  private maxDelayMs: number

  constructor(
    private readonly urlProvider: WsUrlProvider,
    opts: WsClientOptions = {}
  ) {
    this.heartbeatMs = opts.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS
    this.baseDelayMs = opts.reconnectBaseDelayMs ?? DEFAULT_BASE_DELAY_MS
    this.maxDelayMs = opts.maxReconnectDelayMs ?? DEFAULT_MAX_DELAY_MS
  }

  on(event: string, handler: WsEventHandler): void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler)
  }

  off(event: string, handler: WsEventHandler): void {
    this.handlers.get(event)?.delete(handler)
  }

  onStatus(handler: WsStatusHandler): () => void {
    this.statusHandlers.add(handler)
    handler(this.status)
    return () => this.statusHandlers.delete(handler)
  }

  send(event: string, data?: unknown): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const frame: WsEnvelope = { event, data }
        this.ws.send(JSON.stringify(frame))
        return true
      } catch {
        return false
      }
    }
    return false
  }

  connect(): Promise<void> {
    this.shouldReconnect = true
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve()
    if (this.connectingPromise) return this.connectingPromise
    return this.open(false)
  }

  reconnectNow(): Promise<void> {
    this.shouldReconnect = true
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.connectingPromise) return this.connectingPromise
    return this.open(true)
  }

  close(): void {
    this.shouldReconnect = false
    this.attemptGeneration += 1
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.setStatus('idle')
  }

  private open(isReconnect: boolean): Promise<void> {
    this.setStatus(isReconnect ? 'reconnecting' : 'connecting')
    const generation = ++this.attemptGeneration
    let attempt: Promise<void>
    attempt = Promise.resolve(this.urlProvider())
      .then((url) => {
        if (!this.shouldReconnect || generation !== this.attemptGeneration) {
          throw new Error('ws connection cancelled')
        }
        return this.openSocket(url)
      })
      .catch((error: unknown) => {
        if (this.shouldReconnect) this.scheduleReconnect()
        throw error
      })
      .finally(() => {
        if (this.connectingPromise === attempt) this.connectingPromise = null
      })
    this.connectingPromise = attempt
    return attempt
  }

  private openSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      let opened = false
      let settled = false
      this.ws = ws

      ws.onopen = () => {
        if (this.ws !== ws || !this.shouldReconnect) {
          ws.close()
          return
        }
        opened = true
        settled = true
        this.reconnectAttempts = 0
        this.scheduleHeartbeat()
        this.setStatus('connected')
        resolve()
      }

      ws.onmessage = (ev) => this.handleMessage(ev.data as string)

      ws.onerror = () => {
        if (!opened && !settled) {
          settled = true
          reject(new Error('ws connect failed'))
        }
      }

      ws.onclose = () => {
        const isCurrentSocket = this.ws === ws
        if (isCurrentSocket) this.ws = null
        if (!opened && !settled) {
          settled = true
          reject(new Error('ws closed before connecting'))
        }
        if (!isCurrentSocket) return
        this.stopHeartbeat()
        if (this.shouldReconnect) this.scheduleReconnect()
        else this.setStatus('idle')
      }
    })
  }

  private handleMessage(raw: string): void {
    let frame: WsEnvelope
    try {
      frame = JSON.parse(raw)
    } catch {
      return
    }
    const set = this.handlers.get(frame.event)
    if (set) {
      for (const h of set) h(frame.data)
    }
  }

  private scheduleHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send('heartbeat')
    }, this.heartbeatMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return
    this.setStatus('reconnecting')
    const delay = Math.min(this.baseDelayMs * 2 ** this.reconnectAttempts, this.maxDelayMs)
    this.reconnectAttempts += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open(true).catch(() => undefined)
    }, delay)
  }

  private setStatus(status: WsConnectionStatus): void {
    if (this.status === status) return
    this.status = status
    for (const handler of this.statusHandlers) handler(status)
  }
}
