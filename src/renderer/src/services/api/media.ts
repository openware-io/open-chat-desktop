/** 媒体 API（契约 1.10） */
import { http } from '../http/httpClient'

export interface UploadSession {
  uploadSessionId: string
  objectId: string
  uploadUrl: string
  requiredHeaders?: Record<string, string>
  partSize?: number
  partCount?: number
}

export type MediaKind = 'image' | 'audio' | 'video' | 'attachment'

export function createUploadSession(req: {
  scope: 'chat' | 'avatar'
  mediaKind: MediaKind
  fileName: string
  contentType: string
  size: number
  sha256: string
  durationMs?: number
}): Promise<UploadSession> {
  return http.post('/media/upload-sessions', req)
}

export function completeUploadSession(sessionId: string, size: number, sha256: string): Promise<unknown> {
  return http.post('/media/upload-sessions/' + sessionId + '/complete', { size, sha256 })
}

export function getMediaAccess(objectId: string): Promise<{ url: string; contentType: string; size: number }> {
  return http.get('/media/' + objectId + '/access')
}

export function getMediaAccessUrls(objectIds: string[]): Promise<Array<{ objectId: string; url: string }>> {
  return http.post('/media/access-urls', { objectIds })
}
