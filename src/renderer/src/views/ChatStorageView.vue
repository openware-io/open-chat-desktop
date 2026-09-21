<template>
  <section class="account-page">
    <header>{{ t('account.chatStorage') }}</header>
    <main>
      <div class="storage-note">{{ t('account.localOnly') }}</div>
      <div v-if="!chat.conversations.length" class="empty-state">{{ t('conversation.empty') }}</div>
      <div v-else class="list-card">
        <div v-for="conversation in chat.conversations" :key="conversation.chatType + '-' + conversation.peerId" class="person-row">
          <UserAvatar :name="conversation.name || conversation.peerId" :src="conversation.avatar" :uid="conversation.peerId" :size="44" />
          <span><strong>{{ conversation.name || conversation.peerId }}</strong><small>{{ conversation.lastMessage || t('chat.noMessages') }}</small></span>
          <el-button type="danger" link @click="clearOne(conversation)">{{ t('account.clear') }}</el-button>
        </div>
      </div>
      <el-button class="clear-all" type="danger" :disabled="!chat.conversations.length" @click="clearAll">
        {{ t('account.clearAll') }}
      </el-button>

      <div class="policy-card">
        <strong>{{ t('settings.autoClean') }}</strong>
        <el-select v-model="policy" @change="savePolicy">
          <el-option :label="t('settings.cleanOff')" value="off" />
          <el-option :label="t('settings.clean1mo')" value="1mo" />
          <el-option :label="t('settings.clean3mo')" value="3mo" />
          <el-option :label="t('settings.clean6mo')" value="6mo" />
          <el-option :label="t('settings.clean1yr')" value="1yr" />
        </el-select>
      </div>
    </main>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ConversationRow } from '../../../shared/db'
import type { SelfDestructPolicy } from '../services/api/user'
import { useChatStore } from '../stores/chat'
import { useSettingsStore } from '../stores/settings'
import UserAvatar from '../components/UserAvatar.vue'

const { t } = useI18n()
const chat = useChatStore()
const settings = useSettingsStore()
const policy = ref<SelfDestructPolicy>('off')

onMounted(async () => {
  await Promise.all([chat.loadConversations(), settings.load()])
  policy.value = settings.selfDestruct
})

async function clearOne(conversation: ConversationRow): Promise<void> {
  try {
    await ElMessageBox.confirm(t('account.clearConversationConfirm', { name: conversation.name || conversation.peerId }), t('account.chatStorage'), {
      type: 'warning', confirmButtonText: t('account.clear'), cancelButtonText: t('common.cancel')
    })
    await chat.clearConversationHistory(conversation.peerId, conversation.chatType)
    ElMessage.success(t('account.cleared'))
  } catch { /* cancelled */ }
}

async function clearAll(): Promise<void> {
  try {
    await ElMessageBox.confirm(t('account.clearAllConfirm'), t('account.clearAll'), {
      type: 'warning', confirmButtonText: t('account.clearAll'), cancelButtonText: t('common.cancel')
    })
    await chat.clearAllHistory()
    ElMessage.success(t('account.cleared'))
  } catch { /* cancelled */ }
}

async function savePolicy(value: SelfDestructPolicy): Promise<void> {
  try {
    await settings.updateSelfDestruct(value)
    ElMessage.success(t('account.policySaved'))
  } catch { ElMessage.error(t('common.operationFailed')) }
}
</script>

<style scoped src="./account-page.css"></style>
<style scoped>
.storage-note { margin-bottom: 14px; padding: 11px 13px; border-radius: 10px; background: #eef2ff; color: #6673aa; font-size: 12px; }
.clear-all { width: 100%; margin-top: 16px; }
.policy-card { display: flex; align-items: center; justify-content: space-between; margin-top: 20px; padding: 17px; border: 1px solid #e8ebf0; border-radius: 14px; background: #fff; }
</style>
