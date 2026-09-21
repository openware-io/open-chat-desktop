/** 群组/频道/会话 API（契约 1.4） */
import { http } from '../http/httpClient'
import {
  normalizeGroupItem,
  normalizeGroupInfo,
  normalizeGroupMember,
  type GroupItem,
  type GroupInfo,
  type GroupMember,
  type ChannelResult
} from '../../models/group'

/** 对齐 App 的 _asList：兼容列表接口的分页/信封历史返回结构。 */
function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  const raw = value as Record<string, unknown>
  if (Array.isArray(raw.items)) return raw.items
  if (Array.isArray(raw.data)) return raw.data
  if (raw.data && typeof raw.data === 'object') {
    const nested = raw.data as Record<string, unknown>
    if (Array.isArray(nested.items)) return nested.items
  }
  return []
}

// ---- 群组 ----
export async function createGroup(req: { name: string; avatar?: string; memberIds: string[] }): Promise<GroupItem> {
  return normalizeGroupItem(await http.post<unknown>('/groups', req))
}
export async function getMyGroups(): Promise<GroupItem[]> {
  const groups = await http.get<unknown>('/groups/mine')
  return asList(groups).map(normalizeGroupItem)
}
export async function getGroup(id: number | string): Promise<GroupItem> {
  return normalizeGroupItem(await http.get<unknown>('/groups/' + id))
}
export async function getGroupInfo(id: number | string): Promise<GroupInfo> {
  return normalizeGroupInfo(await http.get<unknown>('/groups/' + id))
}
export async function getGroupMembers(id: number | string): Promise<GroupMember[]> {
  return asList(await http.get<unknown>('/groups/' + id + '/members')).map(normalizeGroupMember)
}
export function updateGroup(id: number | string, req: Partial<{ name: string; avatar: string; announcement: string; allowMemberInvite: boolean; allowMemberFriendRequest: boolean; allowMemberViewAccount: boolean }>): Promise<unknown> {
  return http.put('/groups/' + id, req)
}
export function addGroupMembers(id: number | string, userIds: string[]): Promise<unknown> {
  return http.post('/groups/' + id + '/members', { userIds })
}
export function removeGroupMember(id: number | string, userId: string): Promise<unknown> {
  return http.del('/groups/' + id + '/members/' + userId)
}
export function updateMyGroupNickname(id: number | string, nickname: string): Promise<unknown> {
  return http.put('/groups/' + id + '/members/me/nickname', { nickname })
}
export function leaveGroup(id: number | string): Promise<unknown> {
  return http.post('/groups/' + id + '/leave')
}
export function dissolveGroup(id: number | string): Promise<unknown> {
  return http.del('/groups/' + id)
}
export function muteGroupMember(id: number | string, userId: string, duration: number): Promise<unknown> {
  return http.post('/groups/' + id + '/mute', { userId, duration })
}
export function setGroupMemberRole(id: number | string, userId: string, role: 'admin' | 'member'): Promise<unknown> {
  return http.post('/groups/' + id + '/role', { userId, role })
}

// ---- 频道 ----
export function createChannel(req: { name: string; avatar?: string; announcement?: string }): Promise<ChannelResult> {
  return http.post('/channels', req)
}
export function getMyChannels(): Promise<ChannelResult[]> {
  return http.get('/channels/mine')
}
export function subscribeChannel(id: string): Promise<ChannelResult> {
  return http.post('/channels/' + id + '/subscribe')
}
export function unsubscribeChannel(id: string): Promise<unknown> {
  return http.del('/channels/' + id + '/subscribe')
}

// ---- 会话免打扰（缺口 P0） ----
export function setConversationMuted(conversationId: string, muted: boolean): Promise<unknown> {
  return http.put('/conversations/' + conversationId + '/mute', { muted })
}
export function getMutedConversations(): Promise<Array<{ conversationId: string }>> {
  return http.get('/conversations/muted')
}
