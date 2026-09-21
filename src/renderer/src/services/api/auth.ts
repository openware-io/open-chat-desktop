/** 认证 API（契约 1.1） */
import { http } from '../http/httpClient'

export interface TokenResponse {
  access_token: string
  user: Record<string, unknown>
}

export interface RegisterRequest {
  username: string
  password: string
  email: string
  nickname?: string
  phone?: string
}

export interface WsTicketResponse {
  ticket: string
  expiresAt: string
}

export function login(username: string, password: string): Promise<TokenResponse> {
  return http.post<TokenResponse>('/auth/login', { username, password })
}

export function register(req: RegisterRequest): Promise<TokenResponse> {
  return http.post<TokenResponse>('/auth/register', req)
}

export function getWsTicket(): Promise<WsTicketResponse> {
  return http.post<WsTicketResponse>('/auth/ws-ticket')
}

export function forgotPassword(email: string): Promise<{ ok: boolean }> {
  return http.post<{ ok: boolean }>('/auth/password/forgot', { email })
}

export function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
  return http.post<{ ok: boolean }>('/auth/password/reset', { token, newPassword })
}
