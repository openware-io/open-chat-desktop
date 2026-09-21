/** 客户端远程配置 API（对齐 App 的 GET /config/client）。 */
import { http } from '../http/httpClient'

interface ClientFeatureConfig {
  secretChatEnabled?: unknown
  recallEnabled?: unknown
  chatDeleteEnabled?: unknown
}

interface ClientConfigPayload {
  feature?: ClientFeatureConfig | null
}

export interface ClientConfig {
  secretChatEnabled: boolean
  recallEnabled: boolean
  chatDeleteEnabled: boolean
}

function boolOrFalse(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  if (typeof value === 'number') return value !== 0
  return false
}

function boolOrTrue(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  if (typeof value === 'number') return value !== 0
  return true
}

export async function getClientConfig(): Promise<ClientConfig> {
  const payload = await http.get<ClientConfigPayload>('/config/client')
  return {
    secretChatEnabled: boolOrFalse(payload?.feature?.secretChatEnabled),
    recallEnabled: boolOrTrue(payload?.feature?.recallEnabled),
    chatDeleteEnabled: boolOrTrue(payload?.feature?.chatDeleteEnabled)
  }
}
