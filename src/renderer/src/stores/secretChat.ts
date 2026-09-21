/** 密聊 store */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SecretChatResult } from '../services/e2ee/types'
import * as secretApi from '../services/api/secretChat'
import {
  createSecretChat,
  establishSecretChat,
  sendSecretText,
  loadSecretMessages,
  getSafeCode,
  type DecryptedMessage
} from '../services/e2ee/manager'
import { useAuthStore } from './auth'

export const useSecretChatStore = defineStore('secretChat', () => {
  const auth = useAuthStore()
  const chats = ref<SecretChatResult[]>([])
  const activeChatId = ref<string | null>(null)
  const messages = ref<DecryptedMessage[]>([])

  async function loadChats(): Promise<void> {
    chats.value = await secretApi.getMySecretChats()
  }

  async function startWith(userB: string): Promise<void> {
    const sc = await createSecretChat(userB)
    await establishSecretChat(sc, auth.userId)
    await loadChats()
    activeChatId.value = sc.id
    await refresh()
  }

  async function openChat(id: string): Promise<void> {
    activeChatId.value = id
    await refresh()
  }

  async function refresh(): Promise<void> {
    const id = activeChatId.value
    if (!id) {
      messages.value = []
      return
    }
    messages.value = await loadSecretMessages(id)
  }

  async function send(text: string): Promise<void> {
    const id = activeChatId.value
    if (!id || !text.trim()) return
    await sendSecretText(id, text.trim())
    await refresh()
  }

  function safeCode(): string | null {
    return activeChatId.value ? getSafeCode(activeChatId.value) : null
  }

  return { chats, activeChatId, messages, loadChats, startWith, openChat, send, refresh, safeCode }
})
