/** WS 协议类型（契约 docs/contracts.md 二） */

export interface WsEnvelope {
  event: string
  data?: unknown
}

export type WsEventHandler = (data: unknown) => void

export type WsConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'
export type WsStatusHandler = (status: WsConnectionStatus) => void

/** 已知事件名（子集，完整 24+ 见契约二） */
export const WsEvents = {
  chatSend: 'chat:send',
  chatReceive: 'chat:receive',
  chatAck: 'chat:ack',
  chatRead: 'chat:read',
  chatReadNotify: 'chat:read_notify',
  chatRecall: 'chat:recall',
  chatRecallNotify: 'chat:recall_notify',
  userStatusChange: 'user:status_change',
  rtcSignal: 'rtc:signal',
  heartbeat: 'heartbeat',
  error: 'error'
} as const
