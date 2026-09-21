<template>
  <el-dialog v-model="visible" :title="t('group.createTitle')" width="440px">
    <el-input v-model="name" :placeholder="t('group.namePlaceholder')" style="margin-bottom: 12px" />
    <div class="member-count">{{ t('group.selectedCount', { count: selected.length }) }}</div>
    <div class="members">
      <button
        v-for="f in contact.friends"
        :key="f.friendId"
        type="button"
        class="member-row"
        :class="{ selected: selected.includes(friendId(f)) }"
        @click="toggle(friendId(f))"
      >
        <el-checkbox :model-value="selected.includes(friendId(f))" @click.stop @change="toggle(friendId(f))" />
        <UserAvatar
          :name="displayName(f)"
          :src="friendAvatar(f)"
          :uid="f.friendId"
          :size="42"
        />
        <span class="member-copy">
          <strong>{{ displayName(f) }}</strong>
          <small>{{ f.friendUser?.username || f.friendUsername || f.friendId }}</small>
        </span>
      </button>
      <div v-if="!contact.friends.length" class="empty">{{ t('group.noFriends') }}</div>
    </div>
    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :disabled="!name.trim() || !selected.length" @click="onCreate">{{ t('group.create') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContactStore } from '../stores/contact'
import { useGroupStore } from '../stores/group'
import { useChatStore } from '../stores/chat'
import { friendAvatar, friendDisplayName, type FriendItem } from '../models/friend'
import UserAvatar from './UserAvatar.vue'

const visible = defineModel<boolean>({ default: false })
const { t } = useI18n()
const contact = useContactStore()
const group = useGroupStore()
const chat = useChatStore()
const name = ref('')
const selected = ref<string[]>([])

watch(visible, (v) => {
  if (v) {
    void contact.loadFriends()
    name.value = ''
    selected.value = []
  }
})

function friendId(f: FriendItem): string {
  return String(f.friendId)
}
function displayName(f: FriendItem): string {
  return friendDisplayName(f)
}
function toggle(id: string): void {
  const i = selected.value.indexOf(id)
  if (i >= 0) selected.value.splice(i, 1)
  else selected.value.push(id)
}
async function onCreate(): Promise<void> {
  const created = await group.createGroup(name.value.trim(), selected.value)
  visible.value = false
  await chat.openOrCreateConversation(String(created.id), 'group', {
    name: group.getGroupDisplayName(created.id),
    avatar: group.getGroupAvatar(created.id)
  })
}
</script>

<style scoped>
.members {
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid #e9ecf1;
  border-radius: 14px;
}
.member-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.member-row:hover {
  background: #f6f7fa;
}
.member-row.selected {
  background: #eef2ff;
}
.member-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}
.member-copy strong,
.member-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.member-copy strong {
  color: #303849;
  font-size: 14px;
}
.member-copy small,
.member-count {
  color: #929baa;
  font-size: 12px;
}
.member-count {
  margin: 0 0 8px 2px;
}
.empty {
  color: #bbb;
  text-align: center;
  padding: 16px 0;
}
</style>
