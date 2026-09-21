/** 消息 API（契约 1.7）；HTTP query 中 chatType/msgType 一律大写 */
import { http } from '../http/httpClient'
import type { MessageResponse, ChatType } from '../../models/message'

export interface SyncItem {
  syncSeq: number
  message: MessageResponse
  readAt: string | null
}
export interface SyncResponse {
  items: SyncItem[]
  nextSyncSeq: number
  hasMore: boolean
}

function up(v: string): string {
  return v.toUpperCase()
}

export function getHistory(params: {
  peerId: string
  chatType: ChatType
  beforeMsgId?: string
  afterMsgId?: string
  pageSize?: number
}): Promise<MessageResponse[]> {
  return http.get<MessageResponse[]>('/messages/history', {
    peerId: params.peerId,
    chatType: up(params.chatType),
    beforeMsgId: params.beforeMsgId,
    afterMsgId: params.afterMsgId,
    pageSize: params.pageSize
  })
}

export function syncMessages(afterSyncSeq: number, limit = 200): Promise<SyncResponse> {
  return http.get<SyncResponse>('/messages/sync', { afterSyncSeq, limit })
}

export function markRead(msgIds: string[]): Promise<{ ok: boolean; count: number }> {
  return http.post<{ ok: boolean; count: number }>('/messages/read', { msgIds })
}

export function recallMessage(msgId: string): Promise<unknown> {
  return http.post('/messages/recall', { msgId })
}

export function deleteForEveryone(msgId: string): Promise<unknown> {
  return http.post('/messages/delete-for-everyone', { msgId })
}

export function editMessage(msgId: string, newContent: string): Promise<unknown> {
  return http.post('/messages/edit', { msgId, newContent })
}

export function addFavorite(msgId: string, peerId: string, chatType: ChatType): Promise<unknown> {
  return http.post('/favorites', { msgId, peerId, chatType })
}

export function addUserSticker(url: string, thumbnail?: string): Promise<unknown> {
  return http.post('/user-stickers', { url, ...(thumbnail ? { thumbnail } : {}) })
}

export function getUnreadCount(): Promise<{ count: number }> {
  return http.get<{ count: number }>('/messages/unread-count')
}
