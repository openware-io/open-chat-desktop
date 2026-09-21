/** 扫码登录 API */
import { http } from '../http/httpClient'

export interface QrLoginSession {
  qrToken: string
  expiresAt: string
}

export interface QrLoginPoll {
  status: 'pending' | 'expired' | 'confirmed'
  access_token?: string
  user?: Record<string, unknown>
}

/** 二维码内容前缀，App 端扫描据此识别为登录二维码 */
export const QR_LOGIN_SCHEME = 'GV_LOGIN:'

export function createQrSession(): Promise<QrLoginSession> {
  return http.post('/auth/qr-login/session')
}

export function pollQrSession(qrToken: string): Promise<QrLoginPoll> {
  return http.get('/auth/qr-login/session/' + qrToken)
}
