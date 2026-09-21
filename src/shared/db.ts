/** 主进程/渲染进程共享的本地库类型与 IPC 通道名 */

export type ChatType = 'private' | 'group' | 'channel' | 'secret' | 'secret_group'
export type MsgType =
  | 'text' | 'image' | 'file' | 'voice' | 'video' | 'location'
  | 'namecard' | 'call' | 'system' | 'recall' | 'emoji'
export type MsgStatus = 'sending' | 'failed' | 'sent' | 'delivered' | 'read' | 'recalled'

export interface ConversationRow {
  scopeId: string
  peerId: string
  chatType: ChatType
  name: string | null
  avatar: string | null
  lastMessage: string | null
  lastTime: number | null
  unread: number
  pinned: number
  muted: number
  draftText: string | null
}

export interface MessageRow {
  scopeId: string
  msgId: string
  peerId: string
  fromUserId: string
  fromUsername: string | null
  fromAvatar: string | null
  toId: string
  chatType: ChatType
  msgType: MsgType
  content: string
  timestamp: number
  seq: number
  clientMsgId: string | null
  replyMsgId: string | null
  atUsersJson: string | null
  mediaObjectIdsJson: string | null
  status: MsgStatus
}

export interface OutboxRow {
  scopeId: string
  clientMsgId: string
  peerId: string
  toId: string
  chatType: ChatType
  msgType: MsgType
  content: string
  replyMsgId: string | null
  atUsersJson: string | null
  mediaObjectIdsJson: string | null
  createdAt: number
}

export interface SyncStateRow {
  scopeId: string
  lastSyncedSyncSeq: number
}

export const DB_CHANNELS = {
  getConversations: 'db:getConversations',
  upsertConversation: 'db:upsertConversation',
  deleteConversation: 'db:deleteConversation',
  getMessages: 'db:getMessages',
  upsertMessage: 'db:upsertMessage',
  deleteMessage: 'db:deleteMessage',
  clearConversationMessages: 'db:clearConversationMessages',
  clearAllMessages: 'db:clearAllMessages',
  getOutbox: 'db:getOutbox',
  upsertOutbox: 'db:upsertOutbox',
  deleteOutbox: 'db:deleteOutbox',
  getSyncState: 'db:getSyncState',
  setSyncState: 'db:setSyncState',
  clearScope: 'db:clearScope'
} as const
