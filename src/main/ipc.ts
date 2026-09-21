import { ipcMain, Notification, BrowserWindow, dialog, net } from 'electron'
import { writeFile } from 'fs/promises'
import type { ChatDatabase } from './db/database'
import { DB_CHANNELS } from '../shared/db'

/** 渲染进程 HTTP 代理请求（主进程 net.fetch 不受 CORS 限制） */
export interface ProxyRequest {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

export interface ProxyResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

export interface SaveMediaRequest {
  url: string
  fileName: string
}

export interface SaveMediaResponse {
  canceled: boolean
  path?: string
}

export function registerApiIpc(): void {
  ipcMain.handle('api:request', async (_e, req: ProxyRequest): Promise<ProxyResponse> => {
    const res = await net.fetch(req.url, {
      method: req.method,
      headers: req.headers ?? {},
      body: req.body ?? undefined
    })
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      headers[key] = value
    })
    return { status: res.status, statusText: res.statusText, headers, body: await res.text() }
  })
}

export function registerMediaIpc(): void {
  ipcMain.handle(
    'media:save',
    async (event, req: SaveMediaRequest): Promise<SaveMediaResponse> => {
      const mediaUrl = new URL(req.url)
      if (mediaUrl.protocol !== 'http:' && mediaUrl.protocol !== 'https:') {
        throw new Error('unsupported media URL')
      }
      const fileName = (req.fileName || 'wv-chat-media')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/^\.+/, '')
        .trim() || 'wv-chat-media'
      const ownerWindow = BrowserWindow.fromWebContents(event.sender)
      const result = ownerWindow
        ? await dialog.showSaveDialog(ownerWindow, { defaultPath: fileName })
        : await dialog.showSaveDialog({ defaultPath: fileName })
      if (result.canceled || !result.filePath) return { canceled: true }

      const response = await net.fetch(mediaUrl.toString())
      if (!response.ok) {
        throw new Error(`media download failed: HTTP ${response.status}`)
      }
      await writeFile(result.filePath, Buffer.from(await response.arrayBuffer()))
      return { canceled: false, path: result.filePath }
    }
  )
}

export function registerDbIpc(db: ChatDatabase): void {
  ipcMain.handle(DB_CHANNELS.getConversations, (_e, scopeId: string) => db.getConversations(scopeId))
  ipcMain.handle(DB_CHANNELS.upsertConversation, (_e, row) => db.upsertConversation(row))
  ipcMain.handle(DB_CHANNELS.deleteConversation, (_e, scopeId: string, peerId: string, chatType: string) =>
    db.deleteConversation(scopeId, peerId, chatType as never)
  )
  ipcMain.handle(
    DB_CHANNELS.getMessages,
    (_e, scopeId: string, peerId: string, chatType: string, limit: number, beforeSeq?: number) =>
      db.getMessages(scopeId, peerId, chatType as never, limit, beforeSeq)
  )
  ipcMain.handle(DB_CHANNELS.upsertMessage, (_e, row) => db.upsertMessage(row))
  ipcMain.handle(DB_CHANNELS.deleteMessage, (_e, scopeId: string, msgId: string) => db.deleteMessage(scopeId, msgId))
  ipcMain.handle(
    DB_CHANNELS.clearConversationMessages,
    (_e, scopeId: string, peerId: string, chatType: string) =>
      db.clearConversationMessages(scopeId, peerId, chatType as never)
  )
  ipcMain.handle(DB_CHANNELS.clearAllMessages, (_e, scopeId: string) => db.clearAllMessages(scopeId))
  ipcMain.handle(DB_CHANNELS.getOutbox, (_e, scopeId: string) => db.getOutbox(scopeId))
  ipcMain.handle(DB_CHANNELS.upsertOutbox, (_e, row) => db.upsertOutbox(row))
  ipcMain.handle(DB_CHANNELS.deleteOutbox, (_e, scopeId: string, clientMsgId: string) => db.deleteOutbox(scopeId, clientMsgId))
  ipcMain.handle(DB_CHANNELS.getSyncState, (_e, scopeId: string) => db.getSyncState(scopeId))
  ipcMain.handle(DB_CHANNELS.setSyncState, (_e, scopeId: string, seq: number) => db.setSyncState(scopeId, seq))
  ipcMain.handle(DB_CHANNELS.clearScope, (_e, scopeId: string) => db.clearScope(scopeId))
}

export function registerNotifyIpc(): void {
  ipcMain.handle('notify:show', (_e, title: string, body: string) => {
    if (BrowserWindow.getFocusedWindow()) return
    if (Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
  })
}

export function registerWindowIpc(): void {
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('window:toggle-maximize', (event): boolean => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })
  ipcMain.handle('window:is-maximized', (event): boolean => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}
