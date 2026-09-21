<template>
  <el-dialog v-model="visible" :title="t('chat.forwardTitle')" width="460px" @closed="reset">
    <el-input v-model="keyword" clearable :placeholder="t('chat.forwardSearch')" />
    <div class="target-list">
      <template v-if="filteredFriends.length">
        <div class="section-title">{{ t('contacts.friends') }}</div>
        <button
          v-for="friend in filteredFriends"
          :key="`private-${friend.friendId}`"
          type="button"
          class="target-row"
          :class="{ selected: isSelected('private', String(friend.friendId)) }"
          @click="selectTarget({
            peerId: String(friend.friendId),
            chatType: 'private',
            name: friendDisplayName(friend),
            avatar: friendAvatar(friend)
          })"
        >
          <span class="check">{{ isSelected('private', String(friend.friendId)) ? '✓' : '' }}</span>
          <UserAvatar
            :name="friendDisplayName(friend)"
            :src="friendAvatar(friend)"
            :uid="friend.friendId"
            :size="42"
          />
          <span class="target-copy">
            <strong>{{ friendDisplayName(friend) }}</strong>
            <small>{{ friend.friendUser?.username || friend.friendUsername || friend.friendId }}</small>
          </span>
        </button>
      </template>

      <template v-if="filteredGroups.length">
        <div class="section-title">{{ t('group.listTitle') }}</div>
        <button
          v-for="groupItem in filteredGroups"
          :key="`group-${groupItem.id}`"
          type="button"
          class="target-row"
          :class="{ selected: isSelected('group', String(groupItem.id)) }"
          @click="selectTarget({
            peerId: String(groupItem.id),
            chatType: 'group',
            name: group.getGroupDisplayName(groupItem.id),
            avatar: groupItem.avatar
          })"
        >
          <span class="check">{{ isSelected('group', String(groupItem.id)) ? '✓' : '' }}</span>
          <UserAvatar :name="group.getGroupDisplayName(groupItem.id)" :src="groupItem.avatar" :uid="groupItem.id" :size="42" />
          <span class="target-copy">
            <strong>{{ group.getGroupDisplayName(groupItem.id) }}</strong>
            <small>{{ t('group.memberCount', { count: groupItem.memberCount ?? 0 }) }}</small>
          </span>
        </button>
      </template>

      <div v-if="!filteredFriends.length && !filteredGroups.length" class="empty">
        {{ t('chat.noForwardTargets') }}
      </div>
    </div>
    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!selected" @click="forward">
        {{ t('chat.forwardConfirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import type { MessageRow } from '../../../shared/db'
import { friendAvatar, friendDisplayName } from '../models/friend'
import { useChatStore, type ForwardTarget } from '../stores/chat'
import { useContactStore } from '../stores/contact'
import { useGroupStore } from '../stores/group'
import UserAvatar from './UserAvatar.vue'

const props = defineProps<{ message: MessageRow | null }>()
const emit = defineEmits<{ forwarded: [] }>()
const visible = defineModel<boolean>({ default: false })
const { t } = useI18n()
const chat = useChatStore()
const contact = useContactStore()
const group = useGroupStore()
const keyword = ref('')
const selected = ref<ForwardTarget | null>(null)
const submitting = ref(false)

const filteredFriends = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return contact.friends.filter((friend) => {
    return !query || friendDisplayName(friend).toLowerCase().includes(query) ||
      String(friend.friendId).includes(query)
  })
})

const filteredGroups = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return group.groups.filter((item) =>
    !query || group.getGroupDisplayName(item.id).toLowerCase().includes(query)
  )
})

watch(visible, (value) => {
  if (!value) return
  void Promise.all([
    contact.loadFriends(),
    group.loadGroups()
  ]).catch(() => ElMessage.error(t('common.operationFailed')))
})

function isSelected(chatType: ForwardTarget['chatType'], peerId: string): boolean {
  return selected.value?.chatType === chatType && selected.value.peerId === peerId
}

function selectTarget(target: ForwardTarget): void {
  selected.value = isSelected(target.chatType, target.peerId) ? null : target
}

function reset(): void {
  keyword.value = ''
  selected.value = null
  submitting.value = false
}

async function forward(): Promise<void> {
  if (!props.message || !selected.value || submitting.value) return
  submitting.value = true
  try {
    await chat.forwardMessage(props.message, selected.value)
    visible.value = false
    emit('forwarded')
  } catch {
    ElMessage.error(t('common.operationFailed'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.target-list {
  max-height: 390px;
  overflow-y: auto;
  margin-top: 12px;
  padding: 4px;
  border: 1px solid #e8ebf0;
  border-radius: 14px;
}
.section-title {
  padding: 10px 10px 5px;
  color: #929baa;
  font-size: 12px;
}
.target-row {
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
.target-row:hover {
  background: #f6f7fa;
}
.target-row.selected {
  background: #eef2ff;
}
.check {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  place-items: center;
  border: 2px solid #d4d9e2;
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
}
.selected .check {
  border-color: #667ce1;
  background: #667ce1;
}
.target-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}
.target-copy strong,
.target-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.target-copy strong {
  color: #303849;
  font-size: 14px;
}
.target-copy small {
  color: #929baa;
  font-size: 12px;
}
.empty {
  padding: 28px 10px;
  color: #a4acb8;
  text-align: center;
}
</style>
