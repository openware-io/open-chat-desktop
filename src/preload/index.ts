import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { DB_CHANNELS } from '../shared/db'
import { E2EE_CHANNELS } from '../shared/e2ee'

const api = {
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize') as Promise<boolean>,
    isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
    close: () => ipcRenderer.invoke('window:close'),
    onMaximizedChange: (callback: (maximized: boolean) => void) => {
      const listener = (_event: IpcRendererEvent, maximized: boolean): void => callback(maximized)
      ipcRenderer.on('window:maximized-changed', listener)
      return () => ipcRenderer.removeListener('window:maximized-changed', listener)
    }
  },
  hybrid: {
    open: (url: string) => ipcRenderer.invoke('hybrid:open', url)
  },
  notify: {
    show: (title: string, body: string) => ipcRenderer.invoke('notify:show', title, body)
  },
  media: {
    save: (url: string, fileName: string) => ipcRenderer.invoke('media:save', { url, fileName })
  },
  http: {
    request: (method: string, url: string, headers: Record<string, string>, body?: string) =>
      ipcRenderer.invoke('api:request', { method, url, headers, body })
  },
  e2ee: {
    loadAll: () => ipcRenderer.invoke(E2EE_CHANNELS.loadAll),
    get: (key: string) => ipcRenderer.invoke(E2EE_CHANNELS.get, key),
    set: (key: string, value: string) => ipcRenderer.invoke(E2EE_CHANNELS.set, key, value),
    remove: (key: string) => ipcRenderer.invoke(E2EE_CHANNELS.remove, key),
    clear: () => ipcRenderer.invoke(E2EE_CHANNELS.clear)
  },
  db: {
    getConversations: (scopeId: string) => ipcRenderer.invoke(DB_CHANNELS.getConversations, scopeId),
    upsertConversation: (row: unknown) => ipcRenderer.invoke(DB_CHANNELS.upsertConversation, row),
    deleteConversation: (scopeId: string, peerId: string, chatType: string) =>
      ipcRenderer.invoke(DB_CHANNELS.deleteConversation, scopeId, peerId, chatType),
    getMessages: (scopeId: string, peerId: string, chatType: string, limit: number, beforeSeq?: number) =>
      ipcRenderer.invoke(DB_CHANNELS.getMessages, scopeId, peerId, chatType, limit, beforeSeq),
    upsertMessage: (row: unknown) => ipcRenderer.invoke(DB_CHANNELS.upsertMessage, row),
    deleteMessage: (scopeId: string, msgId: string) =>
      ipcRenderer.invoke(DB_CHANNELS.deleteMessage, scopeId, msgId),
    clearConversationMessages: (scopeId: string, peerId: string, chatType: string) =>
      ipcRenderer.invoke(DB_CHANNELS.clearConversationMessages, scopeId, peerId, chatType),
    clearAllMessages: (scopeId: string) =>
      ipcRenderer.invoke(DB_CHANNELS.clearAllMessages, scopeId),
    getOutbox: (scopeId: string) => ipcRenderer.invoke(DB_CHANNELS.getOutbox, scopeId),
    upsertOutbox: (row: unknown) => ipcRenderer.invoke(DB_CHANNELS.upsertOutbox, row),
    deleteOutbox: (scopeId: string, clientMsgId: string) =>
      ipcRenderer.invoke(DB_CHANNELS.deleteOutbox, scopeId, clientMsgId),
    getSyncState: (scopeId: string) => ipcRenderer.invoke(DB_CHANNELS.getSyncState, scopeId),
    setSyncState: (scopeId: string, seq: number) => ipcRenderer.invoke(DB_CHANNELS.setSyncState, scopeId, seq),
    clearScope: (scopeId: string) => ipcRenderer.invoke(DB_CHANNELS.clearScope, scopeId)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
