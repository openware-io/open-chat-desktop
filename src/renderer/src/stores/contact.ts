/** 联系人 store */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FriendItem, FriendRequestItem } from '../models/friend'
import * as friendApi from '../services/api/friend'
import { getWsClient } from '../services/ws/session'

export type FriendNotification = {
  kind: 'request' | 'accepted'
  fromUserId?: string
  friendId?: string
  eventId?: string
  sequence: number
}

export const useContactStore = defineStore('contact', () => {
  const friends = ref<FriendItem[]>([])
  const requests = ref<FriendRequestItem[]>([])
  const blocked = ref<FriendItem[]>([])
  const onlineMap = ref<Record<string, boolean>>({})
  const friendNotification = ref<FriendNotification | null>(null)
  let boundWs: ReturnType<typeof getWsClient> = null
  let notificationSequence = 0

  async function loadFriends(): Promise<void> {
    friends.value = await friendApi.getFriends()
  }

  async function loadRequests(): Promise<void> {
    requests.value = await friendApi.getPendingRequests()
  }

  async function loadBlocked(): Promise<void> {
    blocked.value = await friendApi.getBlockedList()
  }

  async function block(friendId: number): Promise<void> {
    await friendApi.blockFriend(friendId)
    await Promise.all([loadFriends(), loadBlocked()])
  }

  async function unblock(friendId: number): Promise<void> {
    await friendApi.unblockFriend(friendId)
    await Promise.all([loadFriends(), loadBlocked()])
  }

  async function addFriend(userId: string, message?: string): Promise<void> {
    await friendApi.sendFriendRequest(userId, message)
  }

  async function updateRemark(friendId: number, remark: string): Promise<void> {
    await friendApi.updateFriend(friendId, { remark })
    await loadFriends()
  }

  async function updateGroup(friendId: number, groupName: string): Promise<void> {
    await friendApi.updateFriend(friendId, { groupName })
    await loadFriends()
  }

  async function remove(friendId: number): Promise<void> {
    await friendApi.deleteFriend(friendId)
    await loadFriends()
  }

  async function accept(id: number): Promise<void> {
    await friendApi.handleFriendRequest(id, 'accepted')
    await Promise.all([loadFriends(), loadRequests()])
  }

  async function reject(id: number): Promise<void> {
    await friendApi.handleFriendRequest(id, 'rejected')
    await loadRequests()
  }

  function setOnline(userId: string, online: boolean): void {
    onlineMap.value[userId] = online
  }

  function bindWs(): void {
    const ws = getWsClient()
    if (!ws || boundWs === ws) return
    boundWs = ws
    const apply = (data: unknown, forced?: boolean) => {
      const value = data as {
        userId?: string | number
        online?: boolean
        status?: string
      }
      const userId = String(value?.userId ?? '')
      if (!userId) return
      setOnline(
        userId,
        forced ?? value.online ?? value.status?.toLowerCase() === 'online'
      )
    }
    ws.on('user:status_change', (data) => apply(data))
    ws.on('user:online', (data) => apply(data, true))
    ws.on('user:offline', (data) => apply(data, false))
    ws.on('friend:request_notify', (data) => {
      const value = data as Record<string, unknown>
      friendNotification.value = {
        kind: 'request',
        fromUserId: String(value?.from_user_id ?? value?.fromUserId ?? ''),
        eventId: String(value?.event_id ?? value?.eventId ?? ''),
        sequence: ++notificationSequence
      }
      void loadRequests().catch(() => undefined)
    })
    ws.on('friend:accept_notify', (data) => {
      const value = data as Record<string, unknown>
      friendNotification.value = {
        kind: 'accepted',
        friendId: String(value?.friend_id ?? value?.friendId ?? ''),
        eventId: String(value?.event_id ?? value?.eventId ?? ''),
        sequence: ++notificationSequence
      }
      void loadFriends().catch(() => undefined)
    })
  }

  return {
    friends,
    requests,
    blocked,
    onlineMap,
    friendNotification,
    loadFriends,
    loadRequests,
    loadBlocked,
    addFriend,
    updateRemark,
    updateGroup,
    remove,
    accept,
    reject,
    block,
    unblock,
    setOnline,
    bindWs
  }
})
