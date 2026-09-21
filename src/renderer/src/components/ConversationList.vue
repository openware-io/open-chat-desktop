<template>
  <aside class="list">
    <div class="list-header">
      <span>{{ t('conversation.title') }}</span>
      <el-button size="small" link type="primary" @click="showCreate = true">{{ t('conversation.createGroup') }}</el-button>
    </div>
    <div class="list-body">
      <div
        v-for="c in chat.conversations"
        :key="c.peerId + '|' + c.chatType"
        class="item"
        :class="{ active: isActive(c) }"
        @click="chat.openConversation(c.peerId, c.chatType)"
      >
        <UserAvatar
          :name="conversationName(c)"
          :src="conversationAvatar(c)"
          :uid="c.peerId"
          :size="46"
        />
        <div class="item-copy">
          <div class="item-top">
            <div class="name">{{ conversationName(c) }}</div>
            <time v-if="c.lastTime">{{ formatTime(c.lastTime) }}</time>
          </div>
          <div class="item-bottom">
            <div class="last">{{ c.lastMessage || '' }}</div>
            <span v-if="c.unread" class="unread">{{ c.unread > 99 ? '99+' : c.unread }}</span>
          </div>
        </div>
      </div>
      <div v-if="!chat.conversations.length" class="empty">{{ t('conversation.empty') }}</div>
    </div>
    <CreateGroupDialog v-model="showCreate" />
  </aside>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ConversationRow } from '../../../shared/db'
import { friendAvatar, friendDisplayName } from '../models/friend'
import { useChatStore } from '../stores/chat'
import { useContactStore } from '../stores/contact'
import { useGroupStore } from '../stores/group'
import CreateGroupDialog from './CreateGroupDialog.vue'
import UserAvatar from './UserAvatar.vue'

const { t } = useI18n()
const chat = useChatStore()
const contact = useContactStore()
const group = useGroupStore()
const showCreate = ref(false)

onMounted(async () => {
  if (!contact.friends.length) void contact.loadFriends().catch(() => undefined)
  try {
    if (!group.groups.length) await group.loadGroups()
    await chat.syncGroupMetadata(group.groups)
  } catch (error) {
    console.warn('conversation group metadata sync failed', error)
  }
})

function isActive(c: { peerId: string; chatType: string }): boolean {
  return chat.current?.peerId === c.peerId && chat.current.chatType === c.chatType
}

function friendFor(c: ConversationRow) {
  if (c.chatType !== 'private') return null
  return contact.friends.find((friend) => String(friend.friendId) === c.peerId) ?? null
}

function conversationName(c: ConversationRow): string {
  const friend = friendFor(c)
  if (friend) return friendDisplayName(friend)
  if (c.chatType === 'group') {
    return group.getGroup(c.peerId) ? group.getGroupDisplayName(c.peerId) : c.name || `群聊 ${c.peerId}`
  }
  return c.name || c.peerId
}

function conversationAvatar(c: ConversationRow): string | null {
  const friend = friendFor(c)
  if (friend) return friendAvatar(friend) || c.avatar
  if (c.chatType === 'group') return group.getGroupAvatar(c.peerId) || c.avatar
  return c.avatar
}

function formatTime(value: number): string {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
}
</script>

<style scoped>
.list {
  width: 294px;
  border-right: 1px solid #e7eaf0;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.list-header {
  min-height: 64px;
  box-sizing: border-box;
  padding: 15px 18px;
  border-bottom: 1px solid #eef0f4;
  color: #1f293b;
  font-size: 18px;
  font-weight: 680;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.list-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.item {
  display: flex;
  min-height: 66px;
  box-sizing: border-box;
  align-items: center;
  gap: 11px;
  padding: 9px 10px;
  border-radius: 13px;
  cursor: pointer;
}
.item:hover {
  background: #f5f7fa;
}
.item.active {
  background: linear-gradient(90deg, #eaf0ff, #f2f0ff);
}
.item-copy {
  min-width: 0;
  flex: 1;
}
.item-top,
.item-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
}
.item-top time {
  margin-left: auto;
  color: #a2a9b5;
  font-size: 11px;
}
.name {
  min-width: 0;
  font-size: 14px;
  font-weight: 620;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.last {
  min-width: 0;
  flex: 1;
  font-size: 12px;
  color: #959daa;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.unread {
  min-width: 18px;
  height: 18px;
  box-sizing: border-box;
  padding: 0 5px;
  border-radius: 10px;
  background: #ef5b66;
  color: #fff;
  font-size: 10px;
  line-height: 18px;
  text-align: center;
}
.empty {
  padding: 24px;
  text-align: center;
  color: #bbb;
}
</style>
