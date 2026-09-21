/** 消息 content 按 msgType 的结构（契约 4.4） */
import type { MessageRow } from '../../../shared/db'
import { t } from '../i18n'

export interface ImageContent {
  v: number
  url: string
  w?: number
  h?: number
  caption?: string
}

export interface FileContent {
  name: string
  url: string
}

export interface NamecardContent {
  userId: string
  displayName: string
  username: string
  avatar?: string
}

export interface CallTraceDisplay {
  isVideo: boolean
  line: string
}

function callDuration(seconds: number): string {
  const normalized = Math.max(0, Math.trunc(seconds))
  const minutes = Math.floor(normalized / 60).toString().padStart(2, '0')
  const remainder = (normalized % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

/** 解析 App 发出的 call 消息 JSON，并生成聊天室及会话列表共用文案。 */
export function parseCallTraceDisplay(content: string | null | undefined): CallTraceDisplay {
  let isVideo = false
  try {
    const raw = JSON.parse(content ?? '') as Record<string, unknown>
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid call trace')
    const media = String(raw.media ?? raw.mediaType ?? raw.media_type ?? 'audio').toLowerCase()
    const kind = String(raw.kind ?? raw.endReason ?? raw.end_reason ?? 'completed').toLowerCase()
    const durationValue = Number(raw.durationSec ?? raw.duration_sec ?? 0)
    const duration = callDuration(Number.isFinite(durationValue) ? durationValue : 0)
    isVideo = media === 'video'
    const type = isVideo ? t('chat.videoCall') : t('chat.voiceCall')
    switch (kind) {
      case 'completed':
        return { isVideo, line: t('chat.callCompleted', { type, duration }) }
      case 'cancelled':
      case 'canceled':
        return { isVideo, line: t('chat.callCancelled', { type }) }
      case 'rejected':
        return { isVideo, line: t('chat.callRejected', { type }) }
      case 'busy':
        return { isVideo, line: t('chat.callBusy', { type }) }
      case 'failed':
        return { isVideo, line: t('chat.callFailed', { type }) }
      case 'resolved':
        return { isVideo, line: t('chat.callResolved') }
      default:
        return { isVideo, line: type }
    }
  } catch {
    const legacy = content?.toLowerCase() ?? ''
    isVideo = legacy.includes('video') || legacy.includes('视频')
    return { isVideo, line: isVideo ? t('chat.videoCall') : t('chat.voiceCall') }
  }
}

export function encodeImageContent(url: string, opts: { w?: number; h?: number; caption?: string } = {}): string {
  const o: ImageContent = { v: 1, url }
  if (opts.w != null) o.w = opts.w
  if (opts.h != null) o.h = opts.h
  if (opts.caption) o.caption = opts.caption
  return JSON.stringify(o)
}

export function encodeFileContent(name: string, url: string): string {
  return JSON.stringify({ name, url } as FileContent)
}

/** 图片 content：新版 JSON 或旧版纯 URL */
export function parseImageContent(content: string): ImageContent {
  try {
    const o = JSON.parse(content) as ImageContent
    if (o && typeof o.url === 'string') return o
  } catch {
    /* ignore */
  }
  return { v: 1, url: content }
}

export function parseFileContent(content: string): FileContent | null {
  try {
    const o = JSON.parse(content) as FileContent
    if (o && typeof o.url === 'string' && typeof o.name === 'string') return o
  } catch {
    /* ignore */
  }
  return null
}

/** 会话列表预览文案（对齐 message_preview） */
export function messagePreview(msgType: string, content: string): string {
  switch (msgType) {
    case 'image':
      return t('message.image')
    case 'video':
      return t('message.video')
    case 'voice':
      return t('message.voice')
    case 'file': {
      const f = parseFileContent(content)
      return f ? t('message.file') + ' ' + f.name : t('message.file')
    }
    case 'namecard':
      return t('message.namecard')
    case 'call':
      return parseCallTraceDisplay(content).line
    case 'recall':
      return t('message.recalled')
    default:
      return content
  }
}

export type { MessageRow }
