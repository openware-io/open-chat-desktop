import { getLocale } from '../i18n'

export type ClientPlatform = 'windows' | 'macos' | 'linux'

export function getClientPlatform(): ClientPlatform {
  const runtimePlatform = window.electron?.process.platform ?? navigator.userAgent
  const normalized = runtimePlatform.toLowerCase()
  if (normalized.includes('darwin') || normalized.includes('mac')) return 'macos'
  if (normalized.includes('linux')) return 'linux'
  return 'windows'
}

/** 运行时配置（可经 VITE_* 环境变量覆盖，不硬编码域名） */
export const config = {
  /** API 网关基址，默认开发环境；验证用 ACK/kind 环境时以 VITE_API_BASE 覆盖 */
  apiBase: (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://api.dev.example.com',
  platform: getClientPlatform(),
  /** 当前界面语言，跟随 i18n 活动语言（默认 zh-CN） */
  get lang(): string {
    return getLocale()
  }
}

/** REST 前缀 = {apiBase}/api/v1 */
export function apiBaseUrl(): string {
  return config.apiBase.replace(/\/+$/, '') + '/api/v1'
}

/** WS 地址推导：http→ws，https→wss，拼 /ws/im/v1 */
export function wsBaseUrl(): string {
  const base = config.apiBase.replace(/\/+$/, '')
  const ws = base.replace(/^http/, 'ws')
  return ws + '/ws/im/v1'
}
