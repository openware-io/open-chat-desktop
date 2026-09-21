/** 群组 store */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { groupDisplayName, type GroupInfo, type GroupItem, type GroupMember } from '../models/group'
import * as conversationApi from '../services/api/conversation'
import { getWsClient } from '../services/ws/session'
import { useChatStore } from './chat'

export const useGroupStore = defineStore('group', () => {
  const groups = ref<GroupItem[]>([])
  const members = ref<GroupMember[]>([])
  const infoById = ref<Record<string, GroupInfo>>({})
  const currentMembersGroupId = ref<string | null>(null)
  let boundWs: ReturnType<typeof getWsClient> = null

  async function loadGroups(): Promise<void> {
    groups.value = await conversationApi.getMyGroups()
  }

  async function loadMembers(groupId: number | string): Promise<void> {
    const loadedMembers = await conversationApi.getGroupMembers(groupId)
    const currentGroup = getGroup(groupId)
    const ownerId = currentGroup?.ownerId
    members.value = loadedMembers.map((member) =>
      !member.role && ownerId && String(member.userId) === String(ownerId)
        ? { ...member, role: 'owner' }
        : member
    )
    currentMembersGroupId.value = String(groupId)
    const index = groups.value.findIndex((item) => String(item.id) === String(groupId))
    if (index >= 0) groups.value[index] = { ...groups.value[index], memberCount: members.value.length }
  }

  async function loadGroupInfo(groupId: number | string): Promise<GroupInfo> {
    const info = await conversationApi.getGroupInfo(groupId)
    infoById.value[String(groupId)] = info
    const index = groups.value.findIndex((item) => String(item.id) === String(groupId))
    if (index >= 0) {
      groups.value[index] = {
        ...groups.value[index],
        name: info.name || groups.value[index].name,
        avatar: info.avatar ?? groups.value[index].avatar,
        ownerId: info.ownerId ?? groups.value[index].ownerId,
        memberCount: info.memberCount ?? groups.value[index].memberCount
      }
    } else {
      groups.value.push(info)
    }
    return info
  }

  function getGroup(groupId: number | string): GroupItem | null {
    return groups.value.find((item) => String(item.id) === String(groupId)) ?? null
  }

  function getGroupDisplayName(groupId: number | string): string {
    const item = getGroup(groupId)
    if (!item) return `群聊 ${groupId}`
    const count = currentMembersGroupId.value === String(groupId) ? members.value.length : item.memberCount
    return groupDisplayName(item, count)
  }

  function getGroupAvatar(groupId: number | string): string | null {
    return getGroup(groupId)?.avatar?.trim() || null
  }

  function reset(): void {
    groups.value = []
    members.value = []
    currentMembersGroupId.value = null
    infoById.value = {}
  }

  async function createGroup(name: string, memberIds: string[]): Promise<GroupItem> {
    const g = await conversationApi.createGroup({ name, memberIds })
    await loadGroups()
    return g
  }

  async function removeMember(groupId: number | string, userId: string): Promise<void> {
    await conversationApi.removeGroupMember(groupId, userId)
    await loadMembers(groupId)
  }

  async function addMembers(groupId: number | string, userIds: string[]): Promise<void> {
    await conversationApi.addGroupMembers(groupId, userIds)
    await loadMembers(groupId)
  }

  async function updateGroup(
    groupId: number | string,
    data: Parameters<typeof conversationApi.updateGroup>[1]
  ): Promise<void> {
    await conversationApi.updateGroup(groupId, data)
    const key = String(groupId)
    if (infoById.value[key]) infoById.value[key] = { ...infoById.value[key], ...data }
    const index = groups.value.findIndex((item) => String(item.id) === key)
    if (index >= 0) {
      groups.value[index] = {
        ...groups.value[index],
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.avatar !== undefined ? { avatar: data.avatar } : {})
      }
    }
  }

  async function updateMyNickname(groupId: number | string, nickname: string): Promise<void> {
    await conversationApi.updateMyGroupNickname(groupId, nickname)
    await loadMembers(groupId)
  }

  async function leaveGroup(groupId: number | string): Promise<void> {
    await conversationApi.leaveGroup(groupId)
    removeLocalGroup(groupId)
  }

  async function dissolveGroup(groupId: number | string): Promise<void> {
    await conversationApi.dissolveGroup(groupId)
    removeLocalGroup(groupId)
  }

  function removeLocalGroup(groupId: number | string): void {
    const key = String(groupId)
    groups.value = groups.value.filter((item) => String(item.id) !== key)
    delete infoById.value[key]
    if (currentMembersGroupId.value === key) {
      members.value = []
      currentMembersGroupId.value = null
    }
  }

  function notifyGroupId(value: unknown): string {
    if (!value || typeof value !== 'object') return ''
    const raw = value as Record<string, unknown>
    return String(raw.groupId ?? raw.group_id ?? raw.id ?? '').trim().replace(/\.0$/, '')
  }

  function bindWs(): void {
    const ws = getWsClient()
    if (!ws || boundWs === ws) return
    boundWs = ws
    ws.on('group:dissolve_notify', (data) => {
      const groupId = notifyGroupId(data)
      if (!groupId) return
      removeLocalGroup(groupId)
      void useChatStore().removeConversation(groupId, 'group')
    })
    ws.on('group:notify', (data) => {
      const groupId = notifyGroupId(data)
      void loadGroups()
        .then(async () => {
          if (groupId && currentMembersGroupId.value === groupId) await loadMembers(groupId)
          await useChatStore().syncGroupMetadata(groups.value)
        })
        .catch(() => undefined)
    })
  }

  async function muteMember(groupId: number | string, userId: string, duration: number): Promise<void> {
    await conversationApi.muteGroupMember(groupId, userId, duration)
  }

  async function setRole(groupId: number | string, userId: string, role: 'admin' | 'member'): Promise<void> {
    await conversationApi.setGroupMemberRole(groupId, userId, role)
    await loadMembers(groupId)
  }

  return {
    groups,
    members,
    infoById,
    loadGroups,
    loadGroupInfo,
    loadMembers,
    createGroup,
    addMembers,
    removeMember,
    muteMember,
    setRole,
    updateGroup,
    updateMyNickname,
    leaveGroup,
    dissolveGroup,
    bindWs,
    getGroup,
    getGroupDisplayName,
    getGroupAvatar,
    reset
  }
})
