/**
 * HTTP 客户端（对齐契约 docs/contracts.md 1.0 通用约定）：
 * - Base = {apiBase}/api/v1
 * - Authorization: Bearer <token>（非空才注入）
 * - 公共头：x-lang / X-Client-Contract: im-v1 / X-Client-Platform
 * - 写方法自动加 Idempotency-Key: <UUID v4>
 * - 响应信封 { code?, message?, data, requestId? } → 解包 data
 */

import { apiBaseUrl, config } from '../../core/config'
import { getLocale } from '../../i18n'

export interface ApiEnvelope<T> {
  code?: number
  message?: string
  data?: T
  requestId?: string
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: number | undefined,
    message: string,
    public readonly requestId?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type QueryValue = string | number | boolean | undefined | null

export class HttpClient {
  private token: string | null = null
  private readonly baseUrl: string

  constructor(baseUrl: string = apiBaseUrl()) {
    this.baseUrl = baseUrl
  }

  setToken(token: string | null): void {
    this.token = token
  }

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>('GET', path, { query })
  }

  post<T>(path: string, body?: unknown, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>('POST', path, { body, query, isWrite: true })
  }

  put<T>(path: string, body?: unknown, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>('PUT', path, { body, query, isWrite: true })
  }

  patch<T>(path: string, body?: unknown, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>('PATCH', path, { body, query, isWrite: true })
  }

  del<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>('DELETE', path, { query, isWrite: true })
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const base = this.baseUrl.replace(/\/+$/, '') + path
    if (!query) return base
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v))
    }
    const qs = params.toString()
    return qs ? base + '?' + qs : base
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { body?: unknown; query?: Record<string, QueryValue>; isWrite?: boolean } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Client-Contract': 'im-v1',
      'X-Client-Platform': config.platform,
      'x-lang': getLocale()
    }
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token
    if (opts.isWrite) headers['Idempotency-Key'] = crypto.randomUUID()

    const url = this.buildUrl(path, opts.query)
    const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined

    let res: { ok: boolean; status: number; statusText: string; json: unknown }
    if (window.api?.http) {
      // 桌面端：走主进程 net.fetch，绕开浏览器 CORS 预检
      const proxied = await window.api.http.request(method, url, headers, body)
      let json: unknown = null
      try {
        json = proxied.body ? JSON.parse(proxied.body) : null
      } catch {
        json = null
      }
      res = {
        ok: proxied.status >= 200 && proxied.status < 300,
        status: proxied.status,
        statusText: proxied.statusText || proxied.body,
        json
      }
    } else {
      // 浏览器环境（如 web 调试）：直接 fetch
      const raw = await fetch(url, {
        method,
        headers,
        body
      })
      let json: unknown = null
      try {
        json = await raw.json()
      } catch {
        json = null
      }
      res = { ok: raw.ok, status: raw.status, statusText: raw.statusText, json }
    }

    if (!res.ok) {
      const env = (res.json ?? {}) as Partial<ApiEnvelope<unknown>>
      throw new ApiError(res.status, env.code, env.message ?? res.statusText, env.requestId)
    }

    // data 信封解包
    if (res.json && typeof res.json === 'object' && 'data' in (res.json as object)) {
      return (res.json as ApiEnvelope<T>).data as T
    }
    return res.json as T
  }
}

/** 全局共享实例 */
export const http = new HttpClient()
