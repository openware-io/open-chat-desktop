<template>
  <div class="secret-chat">
    <aside class="sc-list">
      <div class="sc-header">{{ t('secret.title') }}</div>
      <div
        v-for="c in sc.chats"
        :key="c.id"
        class="sc-item"
        :class="{ active: c.id === sc.activeChatId }"
        @click="sc.openChat(c.id)"
      >
        {{ c.peerUserId }}
      </div>
      <div v-if="!sc.chats.length" class="empty">{{ t('secret.empty') }}</div>
    </aside>
    <section class="sc-main">
      <div class="sc-title">{{ t('secret.chatTitle') }}{{ sc.safeCode() ? ' · ' + t('secret.safeCode') + ' ' + sc.safeCode() : '' }}</div>
      <div class="sc-messages">
        <div v-for="m in sc.messages" :key="m.msgId" class="sc-msg" :class="{ mine: m.fromUserId === auth.userId }">
          <span class="bubble">{{ m.plaintext ?? t('secret.undecryptable') }}</span>
        </div>
      </div>
      <div class="sc-input">
        <el-input v-model="draft" :placeholder="t('secret.inputPlaceholder')" @keyup.enter="send" />
        <el-button type="primary" @click="send">{{ t('secret.send') }}</el-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSecretChatStore } from '../stores/secretChat'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const sc = useSecretChatStore()
const auth = useAuthStore()
const draft = ref('')

onMounted(() => {
  void sc.loadChats()
})

function send(): void {
  const t = draft.value.trim()
  if (!t) return
  draft.value = ''
  void sc.send(t)
}
</script>

<style scoped>
.secret-chat {
  flex: 1;
  display: flex;
  min-width: 0;
}
.sc-list {
  width: 240px;
  border-right: 1px solid #e5e5e5;
  display: flex;
  flex-direction: column;
}
.sc-header {
  padding: 16px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
}
.sc-item {
  padding: 12px 16px;
  cursor: pointer;
}
.sc-item:hover {
  background: #f5f6f7;
}
.sc-item.active {
  background: #e8f0fe;
}
.empty {
  padding: 24px;
  text-align: center;
  color: #bbb;
}
.sc-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sc-title {
  padding: 16px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
}
.sc-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.sc-msg {
  display: flex;
  margin-bottom: 10px;
}
.sc-msg.mine {
  justify-content: flex-end;
}
.bubble {
  max-width: 60%;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f2f3f5;
  font-size: 14px;
  word-break: break-word;
}
.mine .bubble {
  background: #95ec69;
}
.sc-input {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}
</style>
