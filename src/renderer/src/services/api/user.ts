/** 用户资料与设置 API（契约 1.2） */
import { http } from '../http/httpClient'

export interface UserProfile {
  id: string
  username: string
  nickname?: string | null
  avatar?: string | null
  email?: string | null
  phone?: string | null
  signature?: string | null
}

export interface NotificationSettings {
  notifyPrivate: boolean
  notifyGroup: boolean
  notifyChannel: boolean
}

export interface PrivacySettings {
  allowGroupFriendRequest: boolean
  hideGroupMemberInfo?: boolean
}

export type SelfDestructPolicy = 'off' | '1mo' | '3mo' | '6mo' | '1yr'

export function getMe(): Promise<UserProfile> {
  return http.get<UserProfile>('/users/me')
}

export function updateMe(req: Partial<Pick<UserProfile, 'nickname' | 'avatar' | 'email' | 'phone' | 'signature'>>): Promise<UserProfile> {
  return http.put('/users/me', req)
}

export function changePassword(currentPassword: string, newPassword: string): Promise<unknown> {
  return http.put('/users/me/password', { currentPassword, newPassword })
}

export function getNotificationSettings(): Promise<NotificationSettings> {
  return http.get<NotificationSettings>('/users/me/notification-settings')
}

export function updateNotificationSettings(req: NotificationSettings): Promise<NotificationSettings> {
  return http.put('/users/me/notification-settings', req)
}

export function getPrivacySettings(): Promise<PrivacySettings> {
  return http.get<PrivacySettings>('/users/me/privacy-settings')
}

export function updatePrivacySettings(req: PrivacySettings): Promise<PrivacySettings> {
  return http.put('/users/me/privacy-settings', req)
}

export function getSelfDestruct(): Promise<{ policy: SelfDestructPolicy; selfDestructAt?: string; lastLoginAt?: string }> {
  return http.get('/users/me/self-destruct')
}

export function setSelfDestruct(policy: SelfDestructPolicy): Promise<unknown> {
  return http.put('/users/me/self-destruct', { policy })
}
