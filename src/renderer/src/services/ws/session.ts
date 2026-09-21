/** WS 会话单例：登录后连接、登出关闭 */
import { readonly, ref } from 'vue'
import { wsBaseUrl } from '../../core/config'
import { WsClient } from './wsClient'
import { getWsTicket } from '../api/auth'
import type { WsConnectionStatus } from './types'

let client: WsClient | null = null
const status = ref<WsConnectionStatus>('idle')

export const wsConnectionStatus = readonly(status)

export async function connectWs(): Promise<WsClient> {
  closeWs()
  const nextClient = new WsClient(async () => {
    const { ticket } = await getWsTicket()
    return wsBaseUrl() + '?ticket=' + encodeURIComponent(ticket)
  })
  client = nextClient
  nextClient.onStatus((nextStatus) => {
    if (client === nextClient) status.value = nextStatus
  })
  await nextClient.connect()
  return nextClient
}

export function getWsClient(): WsClient | null {
  return client
}

export function closeWs(): void {
  client?.close()
  client = null
  status.value = 'idle'
}

export async function retryWs(): Promise<void> {
  if (client) {
    await client.reconnectNow()
    return
  }
  await connectWs()
}
