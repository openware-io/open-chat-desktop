/** 好友 API（契约 1.3） */
import { http } from '../http/httpClient'
import {
  normalizeFriendItem,
  normalizeFriendRequestItem,
  type FriendItem,
  type FriendRequestItem
} from '../../models/friend'

export async function getFriends(): Promise<FriendItem[]> {
  const rows = await http.get<unknown[]>('/friends')
  return rows.map(normalizeFriendItem).filter((item) => item.friendId > 0)
}

export function sendFriendRequest(toUserId: string, message?: string): Promise<unknown> {
  return http.post('/friends/request', { toUserId, message })
}

export async function getPendingRequests(): Promise<FriendRequestItem[]> {
  const rows = await http.get<unknown[]>('/friends/requests/pending')
  return rows.map(normalizeFriendRequestItem).filter((item) => item.id > 0)
}

export function handleFriendRequest(id: number, action: 'accepted' | 'rejected'): Promise<unknown> {
  return http.put('/friends/request/' + id, { action })
}

export function deleteFriend(friendId: number): Promise<unknown> {
  return http.del('/friends/' + friendId)
}

export function updateFriend(
  friendId: number,
  req: Partial<{ remark: string; groupName: string }>
): Promise<unknown> {
  return http.put('/friends/' + friendId, req)
}

export function blockFriend(friendId: number): Promise<unknown> {
  return http.post('/friends/' + friendId + '/block')
}

export function unblockFriend(friendId: number): Promise<unknown> {
  return http.post('/friends/' + friendId + '/unblock')
}

export async function getBlockedList(): Promise<FriendItem[]> {
  const rows = await http.get<unknown[]>('/friends/blocked')
  return rows.map(normalizeFriendItem).filter((item) => item.friendId > 0)
}
