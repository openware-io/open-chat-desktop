/** 消息模型（契约 docs/contracts.md 四） */

export type MsgType =
  | 'text'
  | 'image'
  | 'file'
  | 'voice'
  | 'video'
  | 'location'
  | 'namecard'
  | 'call'
  | 'system'
  | 'recall'
  | 'emoji'

export type ChatType = 'private' | 'group' | 'channel' | 'secret' | 'secret_group'

export type MsgStatus = 'sent' | 'delivered' | 'read' | 'recalled'
/** 本地乐观发送中（非服务端 MsgStatus） */
export type LocalMsgStatus = MsgStatus | 'sending'

export interface MessageMedia {
  objectId: string
  url: string
}

/** REST MessageResponse（服务端权威字段） */
export interface MessageResponse {
  id: string
  msgId: string
  conversationId?: string
  seq: number
  fromUserId: string
  senderUsername?: string
  toId: string
  chatType: ChatType
  msgType: MsgType
  content: string
  clientMsgId?: string
  replyMsgId?: string
  atUsers?: string[]
  status: MsgStatus
  media?: MessageMedia[]
  createdAt?: string | null
  updatedAt?: string | null
}

/** WS chat:receive 载荷（用 from/media，非 fromUserId/mediaObjectIds） */
export interface WsReceiveMessage {
  msgId: string
  from: string
  fromUsername?: string
  toId: string
  chatType: ChatType
  msgType: MsgType
  content: string
  media?: MessageMedia[]
  seq: number
  syncSeq?: number
  conversationId?: string
  timestamp?: number
  clientMsgId?: string
  replyMsgId?: string
  atUsers?: string[]
}

/** 同步水位（增量同步） */
export interface SyncCursor {
  syncSeq: number
  message: string | null
  readAt: string | null
}
