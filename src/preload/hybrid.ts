import { contextBridge, ipcRenderer } from 'electron'

const callbacks = new Map<string, (response: unknown) => void>()
let sequence = 0

const gvBridge = {
  login(params: Record<string, unknown> = {}): Promise<unknown> {
    const id = String(++sequence)
    const nonce = String(Date.now()) + '-' + id + '-' + Math.random().toString(36).slice(2)
    return new Promise((resolve, reject) => {
      callbacks.set(id, (response) => {
        const value = response as { ok?: boolean; result?: unknown; error?: unknown }
        if (value.ok) resolve(value.result)
        else reject(value.error ?? { code: 'bridge_error' })
      })
      void ipcRenderer.invoke('hybrid:request', { id, method: 'login', params: { ...params, nonce }, nonce }).then((response) => {
        callbacks.get(id)?.(response)
        callbacks.delete(id)
      })
    })
  },
  exitApp(): Promise<unknown> {
    const id = String(++sequence)
    const nonce = String(Date.now()) + '-' + id + '-' + Math.random().toString(36).slice(2)
    return ipcRenderer.invoke('hybrid:request', { id, method: 'exitApp', params: {}, nonce }).then((response) => {
      const value = response as { ok?: boolean; result?: unknown; error?: unknown }
      if (value.ok) return value.result
      throw value.error ?? { code: 'bridge_error' }
    })
  }
}

contextBridge.exposeInMainWorld('GVBridge', gvBridge)
