import { ElectronAPI } from '@electron-toolkit/preload'
import type { ConversationRow, MessageRow, OutboxRow, SyncStateRow, ChatType } from '../shared/db'

export interface DbApi {
  getConversations(scopeId: string): Promise<ConversationRow[]>
  upsertConversation(row: ConversationRow): Promise<void>
  deleteConversation(scopeId: string, peerId: string, chatType: ChatType): Promise<void>
  getMessages(
    scopeId: string,
    peerId: string,
    chatType: ChatType,
    limit: number,
    beforeSeq?: number
  ): Promise<MessageRow[]>
  upsertMessage(row: MessageRow): Promise<void>
  deleteMessage(scopeId: string, msgId: string): Promise<void>
  clearConversationMessages(scopeId: string, peerId: string, chatType: ChatType): Promise<void>
  clearAllMessages(scopeId: string): Promise<void>
  getOutbox(scopeId: string): Promise<OutboxRow[]>
  upsertOutbox(row: OutboxRow): Promise<void>
  deleteOutbox(scopeId: string, clientMsgId: string): Promise<void>
  getSyncState(scopeId: string): Promise<SyncStateRow>
  setSyncState(scopeId: string, lastSyncedSyncSeq: number): Promise<void>
  clearScope(scopeId: string): Promise<void>
}

export interface NotifyApi {
  show(title: string, body: string): Promise<void>
}

export interface MediaSaveResult {
  canceled: boolean
  path?: string
}

export interface MediaApi {
  save(url: string, fileName: string): Promise<MediaSaveResult>
}

export interface ProxyResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

export interface HttpApi {
  request(method: string, url: string, headers: Record<string, string>, body?: string): Promise<ProxyResponse>
}

export interface E2eeApi {
  loadAll(): Promise<Record<string, string>>
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
}

export interface HybridApi {
  open(url: string): Promise<boolean>
}

export interface WindowControlsApi {
  minimize(): Promise<void>
  toggleMaximize(): Promise<boolean>
  isMaximized(): Promise<boolean>
  close(): Promise<void>
  onMaximizedChange(callback: (maximized: boolean) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      db: DbApi
      notify: NotifyApi
      media: MediaApi
      http: HttpApi
      e2ee: E2eeApi
      hybrid: HybridApi
      windowControls: WindowControlsApi
    }
  }
}
