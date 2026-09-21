<template>
  <el-dialog
    v-model="visible"
    :title="t('group.chatHistory')"
    width="620px"
    append-to-body
    destroy-on-close
  >
    <div class="history-toolbar">
      <el-segmented v-model="category" :options="categoryOptions" />
      <el-input
        v-if="category === 'text'"
        v-model="keyword"
        clearable
        :placeholder="t('group.searchHistory')"
      />
      <el-date-picker
        v-if="category === 'date'"
        v-model="selectedDate"
        type="date"
        value-format="YYYY-MM-DD"
        :placeholder="t('group.selectDate')"
      />
    </div>
    <div v-loading="loading" class="history-list">
      <button
        v-for="message in filteredMessages"
        :key="message.msgId"
        type="button"
        class="history-row"
        @click="selectMessage(message.msgId)"
      >
        <UserAvatar
          :name="senderName(message.fromUserId, message.fromUsername)"
          :src="message.fromAvatar"
          :uid="message.fromUserId"
          :size="36"
        />
        <span class="history-copy">
          <span class="history-meta">
            <strong>{{ senderName(message.fromUserId, message.fromUsername) }}</strong>
            <time>{{ formatTime(message.timestamp) }}</time>
          </span>
          <span class="history-content">{{ messagePreview(message.msgType, message.content) }}</span>
        </span>
      </button>
      <el-empty v-if="!loading && !filteredMessages.length" :description="t('group.noHistory')" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MessageRow } from '../../../shared/db'
import { messagePreview } from '../models/content'
import { groupMemberName } from '../models/group'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { useGroupStore } from '../stores/group'
import UserAvatar from './UserAvatar.vue'

type Category = 'text' | 'file' | 'image' | 'video' | 'date'

const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ groupId: string }>()
const emit = defineEmits<{ select: [msgId: string] }>()
const { t, locale } = useI18n()
const auth = useAuthStore()
const chat = useChatStore()
const group = useGroupStore()
const loading = ref(false)
const messages = ref<MessageRow[]>([])
const category = ref<Category>('text')
const keyword = ref('')
const selectedDate = ref('')

const categoryOptions = computed(() => [
  { label: t('group.historyText'), value: 'text' },
  { label: t('group.historyFiles'), value: 'file' },
  { label: t('group.historyImages'), value: 'image' },
  { label: t('group.historyVideos'), value: 'video' },
  { label: t('group.historyDate'), value: 'date' }
])

const filteredMessages = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return messages.value.filter((message) => {
    if (category.value === 'date') {
      if (!selectedDate.value) return true
      const date = new Date(message.timestamp)
      const localDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
      return localDate === selectedDate.value
    }
    if (message.msgType !== category.value) return false
    if (category.value !== 'text' || !query) return true
    return message.content.toLowerCase().includes(query) ||
      senderName(message.fromUserId, message.fromUsername).toLowerCase().includes(query)
  })
})

watch(visible, async (open) => {
  if (!open) return
  category.value = 'text'
  keyword.value = ''
  selectedDate.value = ''
  loading.value = true
  try {
    messages.value = await chat.getConversationHistory(props.groupId, 'group')
  } finally {
    loading.value = false
  }
})

function senderName(userId: string, username: string | null): string {
  if (String(userId) === String(auth.userId)) return t('group.me')
  const member = group.members.find((item) => String(item.userId) === String(userId))
  return member ? groupMemberName(member) : username?.trim() || t('group.unknownMember')
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(locale.value === 'zh-CN' ? 'zh-CN' : 'en', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

function selectMessage(msgId: string): void {
  visible.value = false
  emit('select', msgId)
}
</script>

<style scoped>
.history-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}
.history-list {
  min-height: 260px;
  max-height: 480px;
  overflow-y: auto;
  border: 1px solid #e8ebf0;
  border-radius: 14px;
}
.history-row {
  display: flex;
  width: 100%;
  gap: 10px;
  padding: 11px 13px;
  border: 0;
  border-bottom: 1px solid #eef0f4;
  background: #fff;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.history-row:last-child { border-bottom: 0; }
.history-row:hover { background: #f7f8fb; }
.history-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5px; }
.history-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.history-meta strong { font-size: 13px; }
.history-meta time { color: #9aa1ad; font-size: 11px; }
.history-content { overflow: hidden; color: #606978; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
</style>
