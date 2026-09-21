/** 媒体上传（单段直传 ≤20MB；分片上传 >20MB 待后续补充） */
import { createUploadSession, completeUploadSession, getMediaAccess, type MediaKind } from '../api/media'
import { t } from '../../i18n'

export function mediaKindForType(contentType: string): MediaKind {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('audio/')) return 'audio'
  if (contentType.startsWith('video/')) return 'video'
  return 'attachment'
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface UploadedMedia {
  objectId: string
  url: string
}

export async function uploadMedia(
  file: File,
  opts: { scope?: 'chat' | 'avatar'; durationMs?: number } = {}
): Promise<UploadedMedia> {
  const data = await file.arrayBuffer()
  const sha = await sha256Hex(data)
  const contentType = file.type || 'application/octet-stream'
  const session = await createUploadSession({
    scope: opts.scope ?? 'chat',
    mediaKind: mediaKindForType(contentType),
    fileName: file.name,
    contentType,
    size: file.size,
    sha256: sha,
    durationMs: opts.durationMs
  })

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Length': String(file.size)
  }
  if (session.requiredHeaders) Object.assign(headers, session.requiredHeaders)

  const putRes = await fetch(session.uploadUrl, { method: 'PUT', headers, body: file })
  if (!putRes.ok) throw new Error(t('errors.mediaUploadFailed') + ' HTTP ' + putRes.status)

  await completeUploadSession(session.uploadSessionId, file.size, sha)
  const access = await getMediaAccess(session.objectId)
  return { objectId: session.objectId, url: access.url }
}
