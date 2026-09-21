import { config } from './config'

/** Resolve avatar/media paths returned by the API into renderer-loadable URLs. */
export function resolveMediaUrl(value?: string | null): string {
  const path = value?.trim() ?? ''
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  const base = config.apiBase.replace(/\/+$/, '')
  return path.startsWith('/') ? base + path : base + '/' + path
}
