/** 聊天 store：会话列表 / 当前会话消息 / 发送接收 / 离线同步 / 已读 / 撤回 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ConversationRow, MessageRow, ChatType, MsgType } from '../../../shared/db'
import { getWsClient } from '../services/ws/session'
import * as messageApi from '../services/api/message'
import { uploadMedia } from '../services/media/upload'
import { encodeImageContent, encodeFileContent, messagePreview } from '../models/content'
import { groupDisplayName, type GroupItem } from '../models/group'
import type { MessageResponse } from '../models/message'
import { useAuthStore } from './auth'
import { t } from '../i18n'
import { normalizeEntityId } from '../../../shared/id'

export interface ReceivedMessage {
  msgId: string
  from: string
  fromUsername?: string
  toId: string
  chatType: ChatType
  msgType: MsgType
  content: string
  media?: { objectId: string; url: string }[]
  seq: number
  syncSeq?: number
  conversationId?: string
  timestamp?: number | string
  clientMsgId?: string
  replyMsgId?: string
  atUsers?: string[]
}

export interface ForwardTarget {
  peerId: string
  chatType: ChatType
  name?: string | null
  avatar?: string | null
}

function timestampMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value
  }
  if (typeof value === 'string') {
    const numeric = Number(value)
    if (value.trim() && Number.isFinite(numeric)) {
      return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
    }
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return Date.now()
}

function normalizedContent(
  msgType: MsgType,
  content: string,
  media?: Array<{ objectId: string; url: string }>
): string {
  const url = media?.find((item) => item.url?.trim())?.url.trim()
  if (!url) return content
  if (msgType === 'image') {
    try {
      const metadata = JSON.parse(content) as Record<string, unknown>
      if (metadata && typeof metadata === 'object') {
        return JSON.stringify({ ...metadata, v: metadata.v ?? 1, url })
      }
    } catch {
      // Legacy image content can be a caption rather than JSON.
    }
    return encodeImageContent(url, { caption: content.trim() || undefined })
  }
  if (msgType === 'file') {
    try {
      const metadata = JSON.parse(content) as { name?: unknown }
      const name = typeof metadata.name === 'string' ? metadata.name.trim() : ''
      return encodeFileContent(name || t('chat.file'), url)
    } catch {
      return encodeFileContent(content.trim() || t('chat.file'), url)
    }
  }
  if (msgType === 'video' || msgType === 'voice' || msgType === 'emoji') return url
  return content
}

function sortMessages(rows: MessageRow[]): MessageRow[] {
  const unique: MessageRow[] = []
  for (const raw of rows) {
    const row = { ...raw, fromUserId: normalizeEntityId(raw.fromUserId) }
    const index = unique.findIndex(
      (item) =>
        item.msgId === row.msgId ||
        (!!row.clientMsgId &&
          item.clientMsgId === row.clientMsgId &&
          item.fromUserId === row.fromUserId)
    )
    if (index < 0) {
      unique.push(row)
      continue
    }
    const existing = unique[index]
    const existingIsPlaceholder =
      !!existing.clientMsgId && existing.msgId === existing.clientMsgId
    const rowIsPlaceholder = !!row.clientMsgId && row.msgId === row.clientMsgId
    if (
      (existingIsPlaceholder && !rowIsPlaceholder) ||
      (existingIsPlaceholder === rowIsPlaceholder &&
        (row.seq > existing.seq ||
          (row.seq === existing.seq && row.timestamp >= existing.timestamp)))
    ) {
      unique[index] = row
    }
  }
  rows.splice(0, rows.length, ...unique)
  return rows.sort((a, b) => a.timestamp - b.timestamp || a.msgId.localeCompare(b.msgId))
}

function loadDraftMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('gv_chat_drafts') ?? '{}')
  } catch {
    return {}
  }
}

function loadClearMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem('gv_chat_clear_cutoffs') ?? '{}')
  } catch {
    return {}
  }
}

function loadHiddenMap(): Record<string, string[]> {
  try {
    const raw = JSON.parse(localStorage.getItem('gv_chat_hidden_messages') ?? '{}') as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(String) : []
      ])
    )
  } catch {
    return {}
  }
}

export const useChatStore = defineStore('chat', () => {
  const auth = useAuthStore()
  const conversations = ref<ConversationRow[]>([])
  const current = ref<{ peerId: string; chatType: ChatType } | null>(null)
  const messages = ref<MessageRow[]>([])
  const draftMap = ref<Record<string, string>>(loadDraftMap())
  const clearMap = ref<Record<string, number>>(loadClearMap())
  const hiddenMap = ref<Record<string, string[]>>(loadHiddenMap())
  const pendingByClientId = new Map<string, MessageRow>()
  const localMediaUrls = new Map<string, string>()
  const cancelledMediaClientIds = new Set<string>()
  let openGeneration = 0
  let boundWs: ReturnType<typeof getWsClient> = null
  let resendingOutbox = false

  const scopeId = computed(() =>
    auth.userId ? (auth.user?.username ?? auth.userId) + '|' + auth.userId : ''
  )

  function peerFor(chatType: ChatType, fromUserId: string, toId: string): string {
    if (chatType === 'private' || chatType === 'secret') {
      return fromUserId === String(auth.userId) ? toId : fromUserId
    }
    return toId
  }

  function clearKey(peerId: string, chatType: ChatType): string {
    return scopeId.value + '|' + peerId + '|' + chatType
  }

  function clearedAt(peerId: string, chatType: ChatType): number {
    return clearMap.value[clearKey(peerId, chatType)] ?? 0
  }

  function isMessageHidden(peerId: string, chatType: ChatType, msgId: string): boolean {
    return hiddenMap.value[clearKey(peerId, chatType)]?.includes(msgId) ?? false
  }

  function isRowHidden(row: MessageRow): boolean {
    return isMessageHidden(row.peerId, row.chatType, row.msgId) ||
      (!!row.clientMsgId && isMessageHidden(row.peerId, row.chatType, row.clientMsgId))
  }

  function saveHiddenMap(): void {
    localStorage.setItem('gv_chat_hidden_messages', JSON.stringify(hiddenMap.value))
  }

  function saveClearMap(): void {
    localStorage.setItem('gv_chat_clear_cutoffs', JSON.stringify(clearMap.value))
  }

  function sortConversations(): void {
    conversations.value.sort(
      (a, b) => b.pinned - a.pinned || (b.lastTime ?? 0) - (a.lastTime ?? 0)
    )
  }

  async function saveConversation(
    peerId: string,
    chatType: ChatType,
    options: {
      name?: string | null
      avatar?: string | null
      lastMessage?: string | null
      lastTime?: number | null
      incrementUnread?: boolean
      resetUnread?: boolean
    } = {}
  ): Promise<ConversationRow | null> {
    const sc = scopeId.value
    if (!sc) return null
    const index = conversations.value.findIndex(
      (item) => item.peerId === peerId && item.chatType === chatType
    )
    const existing = index >= 0 ? conversations.value[index] : null
    const optionName = options.name?.trim()
    const optionAvatar = options.avatar?.trim()
    const olderThanExisting =
      options.lastTime != null &&
      existing?.lastTime != null &&
      options.lastTime < existing.lastTime
    const row: ConversationRow = {
      scopeId: sc,
      peerId,
      chatType,
      name: optionName || existing?.name || null,
      avatar: optionAvatar || existing?.avatar || null,
      lastMessage: olderThanExisting
        ? existing?.lastMessage ?? null
        : options.lastMessage !== undefined
          ? options.lastMessage
          : existing?.lastMessage ?? null,
      lastTime: olderThanExisting
        ? existing?.lastTime ?? null
        : options.lastTime !== undefined
          ? options.lastTime
          : existing?.lastTime ?? null,
      unread: options.resetUnread
        ? 0
        : (existing?.unread ?? 0) + (options.incrementUnread ? 1 : 0),
      pinned: existing?.pinned ?? 0,
      muted: existing?.muted ?? 0,
      draftText: existing?.draftText ?? null
    }
    await window.api.db.upsertConversation(row)
    if (index >= 0) conversations.value[index] = row
    else conversations.value.push(row)
    sortConversations()
    return row
  }

  function rowFromResponse(m: MessageResponse, sc: string): MessageRow {
    const chatType = String(m.chatType).toLowerCase() as ChatType
    const msgType = String(m.msgType).toLowerCase() as MsgType
    const fromUserId = normalizeEntityId(m.fromUserId)
    const toId = normalizeEntityId(m.toId)
    return {
      scopeId: sc,
      msgId: String(m.msgId),
      peerId: peerFor(chatType, fromUserId, toId),
      fromUserId,
      fromUsername: m.senderUsername ?? null,
      fromAvatar: null,
      toId,
      chatType,
      msgType,
      content: normalizedContent(msgType, m.content ?? '', m.media),
      timestamp: timestampMillis(m.createdAt),
      seq: Number(m.seq) || 0,
      clientMsgId: m.clientMsgId ? String(m.clientMsgId) : null,
      replyMsgId: m.replyMsgId ? String(m.replyMsgId) : null,
      atUsersJson: m.atUsers ? JSON.stringify(m.atUsers) : null,
      mediaObjectIdsJson: m.media ? JSON.stringify(m.media.map((x) => x.objectId)) : null,
      status: String(m.status ?? 'sent').toLowerCase() as MessageRow['status']
    }
  }

  function mergeCurrentMessages(rows: MessageRow[]): void {
    const merged = [...messages.value]
    for (const row of rows) {
      const index = merged.findIndex(
        (item) =>
          item.msgId === row.msgId ||
          (!!row.clientMsgId && item.clientMsgId === row.clientMsgId)
      )
      if (index >= 0) merged[index] = row
      else merged.push(row)
    }
    messages.value = sortMessages(merged)
  }

  async function loadConversations(): Promise<void> {
    if (!scopeId.value) return
    conversations.value = await window.api.db.getConversations(scopeId.value)
    sortConversations()
  }

  /** 用服务端群资料修正本地会话的群名、成员数后缀和头像。 */
  async function syncGroupMetadata(groups: GroupItem[]): Promise<void> {
    for (let index = 0; index < conversations.value.length; index++) {
      const currentRow = conversations.value[index]
      if (currentRow.chatType !== 'group') continue
      const group = groups.find((item) => String(item.id) === currentRow.peerId)
      if (!group) continue
      const name = groupDisplayName(group)
      const avatar = group.avatar?.trim() || null
      if (currentRow.name === name && currentRow.avatar === avatar) continue
      const updated = { ...currentRow, name, avatar }
      conversations.value[index] = updated
      await window.api.db.upsertConversation(updated)
    }
  }

  async function openConversation(peerId: string, chatType: ChatType): Promise<void> {
    const generation = ++openGeneration
    const sc = scopeId.value
    current.value = { peerId, chatType }
    if (!sc) {
      messages.value = []
      return
    }

    const cached = await window.api.db.getMessages(sc, peerId, chatType, 50)
    if (generation !== openGeneration) return
    messages.value = sortMessages(
      cached.filter((row) => !isRowHidden(row))
    )
    await saveConversation(peerId, chatType, { resetUnread: true })

    try {
      const history = await messageApi.getHistory({ peerId, chatType, pageSize: 50 })
      const cutoff = clearedAt(peerId, chatType)
      const rows = history
        .map((item) => rowFromResponse(item, sc))
        .filter(
          (row) =>
            row.timestamp > cutoff &&
            !isRowHidden(row)
        )
      await Promise.all(rows.map((row) => window.api.db.upsertMessage(row)))
      if (generation !== openGeneration) return
      mergeCurrentMessages(rows)
    } catch (error) {
      // Cached messages stay visible when history is temporarily unavailable.
      console.warn('load chat history failed', error)
    }
    if (generation === openGeneration) await markCurrentRead()
  }

  async function openOrCreateConversation(
    peerId: string,
    chatType: ChatType,
    options: { name?: string | null; avatar?: string | null } = {}
  ): Promise<void> {
    if (!peerId || peerId === '0') return
    await saveConversation(peerId, chatType, options)
    await openConversation(peerId, chatType)
  }

  function appendMessage(row: MessageRow): void {
    const c = current.value
    if (c && row.peerId === c.peerId && row.chatType === c.chatType) {
      const idx = messages.value.findIndex(
        (m) =>
          m.msgId === row.msgId ||
          (!!row.clientMsgId && m.clientMsgId === row.clientMsgId)
      )
      if (idx >= 0) messages.value[idx] = row
      else messages.value.push(row)
      sortMessages(messages.value)
    }
  }

  async function sendText(text: string, replyMsgId: string | null = null): Promise<void> {
    const c = current.value
    const sc = scopeId.value
    if (!c || !sc || !text.trim()) return
    const clientMsgId = crypto.randomUUID()
    const now = Date.now()
    const row: MessageRow = {
      scopeId: sc,
      msgId: clientMsgId,
      peerId: c.peerId,
      fromUserId: normalizeEntityId(auth.userId),
      fromUsername: auth.user?.username ?? null,
      fromAvatar: auth.user?.avatar ?? null,
      toId: c.peerId,
      chatType: c.chatType,
      msgType: 'text',
      content: text,
      timestamp: now,
      seq: 0,
      clientMsgId,
      replyMsgId,
      atUsersJson: null,
      mediaObjectIdsJson: null,
      status: 'sending'
    }
    await window.api.db.upsertMessage(row)
    await window.api.db.upsertOutbox({
      scopeId: sc,
      clientMsgId,
      peerId: c.peerId,
      toId: c.peerId,
      chatType: c.chatType,
      msgType: 'text',
      content: text,
      replyMsgId,
      atUsersJson: null,
      mediaObjectIdsJson: null,
      createdAt: now
    })
    pendingByClientId.set(clientMsgId, row)
    appendMessage(row)
    await saveConversation(c.peerId, c.chatType, {
      lastMessage: messagePreview('text', text),
      lastTime: now
    })
    getWsClient()?.send('chat:send', {
      toId: c.peerId,
      chatType: c.chatType,
      msgType: 'text',
      content: text,
      clientMsgId,
      replyMsgId: replyMsgId ?? undefined
    })
  }

  async function handleAck(data: unknown): Promise<void> {
    const a = data as {
      clientMsgId?: string
      msgId?: string
      content?: string
      timestamp?: number | string
      seq?: number
    }
    const sc = scopeId.value
    if (!sc || !a.clientMsgId || !a.msgId) return
    const idx = messages.value.findIndex((m) => m.clientMsgId === a.clientMsgId)
    const pending = idx >= 0 ? messages.value[idx] : pendingByClientId.get(a.clientMsgId)
    if (pending) {
      const confirmed: MessageRow = {
        ...pending,
        msgId: String(a.msgId),
        content: a.content || pending.content,
        status: 'sent',
        timestamp: timestampMillis(a.timestamp ?? pending.timestamp),
        seq: Number(a.seq) || pending.seq
      }
      if (idx >= 0) {
        messages.value[idx] = confirmed
        sortMessages(messages.value)
      }
      await window.api.db.upsertMessage(confirmed)
    }
    pendingByClientId.delete(a.clientMsgId)
    await window.api.db.deleteOutbox(sc, a.clientMsgId)
  }

  async function handleSingleReceive(m: ReceivedMessage): Promise<void> {
    const sc = scopeId.value
    if (!sc || !m?.msgId || !m.chatType || !m.msgType) return
    const chatType = String(m.chatType).toLowerCase() as ChatType
    const msgType = String(m.msgType).toLowerCase() as MsgType
    const fromUserId = normalizeEntityId(m.from)
    const toId = normalizeEntityId(m.toId)
    const selfId = normalizeEntityId(auth.userId)
    const peerId = peerFor(chatType, fromUserId, toId)
    const timestamp = timestampMillis(m.timestamp)
    const content = normalizedContent(msgType, m.content ?? '', m.media)
    const row: MessageRow = {
      scopeId: sc,
      msgId: String(m.msgId),
      peerId,
      fromUserId,
      fromUsername: m.fromUsername ?? null,
      fromAvatar: null,
      toId,
      chatType,
      msgType,
      content,
      timestamp,
      seq: Number(m.seq) || 0,
      clientMsgId: m.clientMsgId ?? null,
      replyMsgId: m.replyMsgId ?? null,
      atUsersJson: m.atUsers ? JSON.stringify(m.atUsers) : null,
      mediaObjectIdsJson: m.media ? JSON.stringify(m.media.map((x) => x.objectId)) : null,
      status: 'sent'
    }
    if (
      row.timestamp <= clearedAt(peerId, chatType) ||
      isRowHidden(row)
    ) return
    await window.api.db.upsertMessage(row)
    if (row.clientMsgId) pendingByClientId.delete(row.clientMsgId)
    const isCurrent = current.value?.peerId === peerId && current.value.chatType === chatType
    const isIncoming = fromUserId !== selfId
    await saveConversation(peerId, chatType, {
      name: chatType === 'private' && isIncoming ? m.fromUsername : undefined,
      lastMessage: messagePreview(msgType, content),
      lastTime: timestamp,
      incrementUnread: isIncoming && !isCurrent,
      resetUnread: isCurrent
    })
    appendMessage(row)
    // 非本人消息 → 桌面通知（主进程据窗口焦点决定是否展示）
    if (isIncoming && !isCurrent) {
      void window.api.notify.show(
        m.fromUsername ?? t('chat.newMessage'),
        msgType === 'text' ? content : t('chat.nonTextMessage')
      )
    }
    if (isCurrent && isIncoming) await markCurrentRead()
  }

  async function handleReceive(data: unknown): Promise<void> {
    if (Array.isArray(data)) {
      for (const item of data) await handleSingleReceive(item as ReceivedMessage)
      return
    }
    const envelope = data as { messages?: unknown[] } | null
    if (Array.isArray(envelope?.messages)) {
      for (const item of envelope.messages) await handleSingleReceive(item as ReceivedMessage)
      return
    }
    await handleSingleReceive(data as ReceivedMessage)
  }

  async function applyRecalledMessage(msgId: string): Promise<MessageRow | null> {
    const sc = scopeId.value
    const idx = messages.value.findIndex((m) => m.msgId === msgId)
    if (idx < 0) return null
    const original = messages.value[idx]
    const recalled: MessageRow = {
      ...original,
      msgType: 'recall',
      content: t('chat.recalled'),
      replyMsgId: null,
      atUsersJson: null,
      mediaObjectIdsJson: null,
      status: 'recalled'
    }
    messages.value[idx] = recalled
    if (sc) await window.api.db.upsertMessage(recalled)
    const conversation = conversations.value.find(
      (item) => item.peerId === recalled.peerId && item.chatType === recalled.chatType
    )
    if (conversation?.lastTime === original.timestamp) {
      await saveConversation(recalled.peerId, recalled.chatType, {
        lastMessage: t('chat.recalled'),
        lastTime: original.timestamp
      })
    }
    return original
  }

  function handleRecallNotify(data: unknown): void {
    const d = data as { msgId: string }
    if (d?.msgId) void applyRecalledMessage(String(d.msgId))
  }

  async function markCurrentRead(): Promise<void> {
    const c = current.value
    const sc = scopeId.value
    if (!c || !sc) return
    const selfId = normalizeEntityId(auth.userId)
    const received = messages.value.filter((m) => m.fromUserId !== selfId && m.status !== 'read')
    if (!received.length) return
    const ids = received.map((m) => m.msgId)
    try {
      await messageApi.markRead(ids)
    } catch (error) {
      console.warn('mark messages read failed', error)
      return
    }
    for (const id of ids) {
      const idx = messages.value.findIndex((m) => m.msgId === id)
      if (idx >= 0) {
        messages.value[idx] = { ...messages.value[idx], status: 'read' }
        void window.api.db.upsertMessage(messages.value[idx])
      }
    }
    await saveConversation(c.peerId, c.chatType, { resetUnread: true })
  }

  async function recall(msgId: string): Promise<void> {
    const original = await applyRecalledMessage(msgId)
    try {
      await messageApi.recallMessage(msgId)
    } catch (error) {
      if (original) {
        const idx = messages.value.findIndex((m) => m.msgId === msgId)
        if (idx >= 0) messages.value[idx] = original
        await window.api.db.upsertMessage(original)
        await saveConversation(original.peerId, original.chatType, {
          lastMessage: messagePreview(original.msgType, original.content),
          lastTime: original.timestamp
        })
      }
      throw error
    }
  }

  async function refreshCurrentConversationPreview(peerId: string, chatType: ChatType): Promise<void> {
    if (current.value?.peerId !== peerId || current.value.chatType !== chatType) return
    const latest = [...messages.value]
      .reverse()
      .find((item) => item.msgType !== 'recall' && !isMessageHidden(peerId, chatType, item.msgId))
    await saveConversation(peerId, chatType, {
      lastMessage: latest ? messagePreview(latest.msgType, latest.content) : null,
      lastTime: latest?.timestamp ?? null
    })
  }

  async function hideMessageForMe(message: MessageRow): Promise<void> {
    const key = clearKey(message.peerId, message.chatType)
    const hidden = new Set(hiddenMap.value[key] ?? [])
    hidden.add(message.msgId)
    hiddenMap.value = { ...hiddenMap.value, [key]: [...hidden] }
    saveHiddenMap()
    messages.value = messages.value.filter((item) => item.msgId !== message.msgId)
    if (message.clientMsgId && message.msgId === message.clientMsgId) {
      cancelledMediaClientIds.add(message.clientMsgId)
      pendingByClientId.delete(message.clientMsgId)
      await window.api.db.deleteOutbox(message.scopeId, message.clientMsgId)
      const localUrl = localMediaUrls.get(message.clientMsgId)
      if (localUrl) URL.revokeObjectURL(localUrl)
      localMediaUrls.delete(message.clientMsgId)
    }
    await refreshCurrentConversationPreview(message.peerId, message.chatType)
  }

  async function applyDeletedMessage(msgId: string): Promise<void> {
    const sc = scopeId.value
    const existing = messages.value.find((item) => item.msgId === msgId) ?? null
    messages.value = messages.value.filter((item) => item.msgId !== msgId)
    if (sc) await window.api.db.deleteMessage(sc, msgId)
    let hiddenChanged = false
    for (const [key, ids] of Object.entries(hiddenMap.value)) {
      const next = ids.filter((id) => id !== msgId)
      if (next.length !== ids.length) {
        hiddenMap.value[key] = next
        hiddenChanged = true
      }
    }
    if (hiddenChanged) saveHiddenMap()
    if (existing) await refreshCurrentConversationPreview(existing.peerId, existing.chatType)
  }

  function handleDeleteNotify(data: unknown): void {
    const raw = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    const msgId = String(raw.msgId ?? raw.msg_id ?? '').trim()
    if (msgId) void applyDeletedMessage(msgId)
  }

  async function deleteMessageForEveryone(message: MessageRow): Promise<void> {
    if (message.chatType === 'secret' || message.chatType === 'secret_group') {
      throw new Error('secret messages require the E2EE delete endpoint')
    }
    if (message.clientMsgId && message.msgId === message.clientMsgId) {
      await hideMessageForMe(message)
      return
    }
    await messageApi.deleteForEveryone(message.msgId)
    await applyDeletedMessage(message.msgId)
  }

  async function editMessage(message: MessageRow, newContent: string): Promise<void> {
    const content = newContent.trim()
    if (!content || content === message.content) return
    await messageApi.editMessage(message.msgId, content)
    const index = messages.value.findIndex((item) => item.msgId === message.msgId)
    if (index < 0) return
    const updated = { ...messages.value[index], content }
    messages.value[index] = updated
    await window.api.db.upsertMessage(updated)
    const conversation = conversations.value.find(
      (item) => item.peerId === updated.peerId && item.chatType === updated.chatType
    )
    if (conversation?.lastTime === updated.timestamp) {
      await saveConversation(updated.peerId, updated.chatType, {
        lastMessage: messagePreview(updated.msgType, updated.content),
        lastTime: updated.timestamp
      })
    }
  }

  function addFavorite(message: MessageRow): Promise<unknown> {
    return messageApi.addFavorite(message.msgId, message.peerId, message.chatType)
  }

  function addUserSticker(url: string): Promise<unknown> {
    return messageApi.addUserSticker(url)
  }

  async function forwardMessage(source: MessageRow, target: ForwardTarget): Promise<void> {
    const sc = scopeId.value
    if (!sc || source.msgType === 'recall') return
    const clientMsgId = crypto.randomUUID()
    const now = Date.now()
    const row: MessageRow = {
      ...source,
      scopeId: sc,
      msgId: clientMsgId,
      peerId: target.peerId,
      fromUserId: normalizeEntityId(auth.userId),
      fromUsername: auth.user?.username ?? null,
      fromAvatar: auth.user?.avatar ?? null,
      toId: target.peerId,
      chatType: target.chatType,
      timestamp: now,
      seq: 0,
      clientMsgId,
      replyMsgId: null,
      atUsersJson: null,
      status: 'sending'
    }
    await window.api.db.upsertMessage(row)
    await window.api.db.upsertOutbox({
      scopeId: sc,
      clientMsgId,
      peerId: target.peerId,
      toId: target.peerId,
      chatType: target.chatType,
      msgType: row.msgType,
      content: row.content,
      replyMsgId: null,
      atUsersJson: null,
      mediaObjectIdsJson: row.mediaObjectIdsJson,
      createdAt: now
    })
    pendingByClientId.set(clientMsgId, row)
    appendMessage(row)
    await saveConversation(target.peerId, target.chatType, {
      name: target.name,
      avatar: target.avatar,
      lastMessage: messagePreview(row.msgType, row.content),
      lastTime: now
    })
    getWsClient()?.send('chat:send', {
      toId: target.peerId,
      chatType: target.chatType,
      msgType: row.msgType,
      content: row.content,
      clientMsgId,
      mediaObjectIds: row.mediaObjectIdsJson
        ? JSON.parse(row.mediaObjectIdsJson)
        : undefined
    })
  }

  function getDraft(peerId: string, chatType: ChatType): string {
    return draftMap.value[scopeId.value + '|' + peerId + '|' + chatType] ?? ''
  }

  function setDraft(peerId: string, chatType: ChatType, text: string): void {
    const key = scopeId.value + '|' + peerId + '|' + chatType
    if (text) draftMap.value[key] = text
    else delete draftMap.value[key]
    localStorage.setItem('gv_chat_drafts', JSON.stringify(draftMap.value))
  }

  async function sendMedia(file: File, msgType: 'image' | 'video' | 'voice' | 'file'): Promise<void> {
    const c = current.value
    const sc = scopeId.value
    if (!c || !sc) return
    const clientMsgId = crypto.randomUUID()
    const now = Date.now()
    const localUrl = URL.createObjectURL(file)
    localMediaUrls.set(clientMsgId, localUrl)
    const previewContent = msgType === 'image'
      ? encodeImageContent(localUrl)
      : msgType === 'file'
        ? encodeFileContent(file.name, localUrl)
        : localUrl
    const pendingRow: MessageRow = {
      scopeId: sc,
      msgId: clientMsgId,
      peerId: c.peerId,
      fromUserId: normalizeEntityId(auth.userId),
      fromUsername: auth.user?.username ?? null,
      fromAvatar: auth.user?.avatar ?? null,
      toId: c.peerId,
      chatType: c.chatType,
      msgType,
      content: previewContent,
      timestamp: now,
      seq: 0,
      clientMsgId,
      replyMsgId: null,
      atUsersJson: null,
      mediaObjectIdsJson: null,
      status: 'sending'
    }
    appendMessage(pendingRow)
    await saveConversation(c.peerId, c.chatType, {
      lastMessage: messagePreview(msgType, previewContent),
      lastTime: now
    })
    try {
      const uploaded = await uploadMedia(file)
      if (cancelledMediaClientIds.delete(clientMsgId)) {
        localMediaUrls.delete(clientMsgId)
        URL.revokeObjectURL(localUrl)
        return
      }
      let content: string
      if (msgType === 'image') content = encodeImageContent(uploaded.url)
      else if (msgType === 'file') content = encodeFileContent(file.name, uploaded.url)
      else content = uploaded.url

      const row: MessageRow = {
        ...pendingRow,
        content,
        mediaObjectIdsJson: JSON.stringify([uploaded.objectId]),
        status: 'sending'
      }
      await window.api.db.upsertMessage(row)
      await window.api.db.upsertOutbox({
        scopeId: sc,
        clientMsgId,
        peerId: c.peerId,
        toId: c.peerId,
        chatType: c.chatType,
        msgType,
        content,
        replyMsgId: null,
        atUsersJson: null,
        mediaObjectIdsJson: JSON.stringify([uploaded.objectId]),
        createdAt: now
      })
      pendingByClientId.set(clientMsgId, row)
      appendMessage(row)
      await saveConversation(c.peerId, c.chatType, {
        lastMessage: messagePreview(msgType, content),
        lastTime: now
      })
      getWsClient()?.send('chat:send', {
        toId: c.peerId,
        chatType: c.chatType,
        msgType,
        content,
        clientMsgId,
        mediaObjectIds: [uploaded.objectId]
      })
      localMediaUrls.delete(clientMsgId)
      setTimeout(() => URL.revokeObjectURL(localUrl), 0)
    } catch (e) {
      console.error('sendMedia failed', e)
      if (!cancelledMediaClientIds.delete(clientMsgId)) {
        appendMessage({ ...pendingRow, status: 'failed' })
      }
    }
  }

  async function sync(): Promise<void> {
    const sc = scopeId.value
    if (!sc) return
    const selfId = normalizeEntityId(auth.userId)
    const state = await window.api.db.getSyncState(sc)
    let cursor = state.lastSyncedSyncSeq
    for (let i = 0; i < 50; i++) {
      const res = await messageApi.syncMessages(cursor, 200)
      for (const item of res.items) {
        const m = item.message
        const row = rowFromResponse(m, sc)
        if (
          row.timestamp <= clearedAt(row.peerId, row.chatType) ||
          isRowHidden(row)
        ) continue
        if (item.readAt) row.status = 'read'
        await window.api.db.upsertMessage(row)
        const isCurrent =
          current.value?.peerId === row.peerId && current.value.chatType === row.chatType
        const isIncoming = row.fromUserId !== selfId
        await saveConversation(row.peerId, row.chatType, {
          name:
            row.chatType === 'private' && isIncoming
              ? row.fromUsername
              : undefined,
          lastMessage: messagePreview(row.msgType, row.content),
          lastTime: row.timestamp,
          incrementUnread: isIncoming && !isCurrent && !item.readAt,
          resetUnread: isCurrent
        })
        appendMessage(row)
      }
      if (res.nextSyncSeq < cursor || (res.hasMore && res.nextSyncSeq <= cursor)) {
        throw new Error('message sync cursor did not advance')
      }
      cursor = res.nextSyncSeq
      await window.api.db.setSyncState(sc, cursor)
      if (!res.hasMore) break
    }
    if (current.value) await markCurrentRead()
  }

  async function resendOutbox(): Promise<void> {
    const sc = scopeId.value
    const ws = getWsClient()
    if (!sc || !ws || resendingOutbox) return
    resendingOutbox = true
    try {
      const pending = await window.api.db.getOutbox(sc)
      for (const item of pending) {
        const row: MessageRow = {
          scopeId: sc,
          msgId: item.clientMsgId,
          peerId: item.peerId,
          fromUserId: normalizeEntityId(auth.userId),
          fromUsername: auth.user?.username ?? null,
          fromAvatar: auth.user?.avatar ?? null,
          toId: item.toId,
          chatType: item.chatType,
          msgType: item.msgType,
          content: item.content,
          timestamp: item.createdAt,
          seq: 0,
          clientMsgId: item.clientMsgId,
          replyMsgId: item.replyMsgId,
          atUsersJson: item.atUsersJson,
          mediaObjectIdsJson: item.mediaObjectIdsJson,
          status: 'sending'
        }
        pendingByClientId.set(item.clientMsgId, row)
        await window.api.db.upsertMessage(row)
        appendMessage(row)
        const sent = ws.send('chat:send', {
          toId: item.toId,
          chatType: item.chatType,
          msgType: item.msgType,
          content: item.content,
          clientMsgId: item.clientMsgId,
          replyMsgId: item.replyMsgId ?? undefined,
          atUsers: item.atUsersJson ? JSON.parse(item.atUsersJson) : undefined,
          mediaObjectIds: item.mediaObjectIdsJson
            ? JSON.parse(item.mediaObjectIdsJson)
            : undefined
        })
        if (!sent) break
      }
    } finally {
      resendingOutbox = false
    }
  }

  async function clearConversationHistory(peerId: string, chatType: ChatType): Promise<void> {
    const sc = scopeId.value
    if (!sc) return
    clearMap.value[clearKey(peerId, chatType)] = Date.now()
    saveClearMap()
    delete hiddenMap.value[clearKey(peerId, chatType)]
    saveHiddenMap()
    await window.api.db.clearConversationMessages(sc, peerId, chatType)
    for (const [clientMsgId, row] of pendingByClientId) {
      if (row.peerId === peerId && row.chatType === chatType) pendingByClientId.delete(clientMsgId)
    }
    if (current.value?.peerId === peerId && current.value.chatType === chatType) {
      messages.value = []
    }
    await saveConversation(peerId, chatType, { lastMessage: null, lastTime: null, resetUnread: true })
  }

  async function clearAllHistory(): Promise<void> {
    const sc = scopeId.value
    if (!sc) return
    const now = Date.now()
    for (const conversation of conversations.value) {
      clearMap.value[clearKey(conversation.peerId, conversation.chatType)] = now
    }
    saveClearMap()
    const scopePrefix = scopeId.value + '|'
    hiddenMap.value = Object.fromEntries(
      Object.entries(hiddenMap.value).filter(([key]) => !key.startsWith(scopePrefix))
    )
    saveHiddenMap()
    await window.api.db.clearAllMessages(sc)
    pendingByClientId.clear()
    messages.value = []
    await Promise.all(
      conversations.value.map((conversation) =>
        saveConversation(conversation.peerId, conversation.chatType, {
          lastMessage: null,
          lastTime: null,
          resetUnread: true
        })
      )
    )
  }

  async function getConversationHistory(
    peerId: string,
    chatType: ChatType,
    limit = 200
  ): Promise<MessageRow[]> {
    const sc = scopeId.value
    if (!sc) return []
    const cached = await window.api.db.getMessages(sc, peerId, chatType, limit)
    let rows = cached.filter(
      (row) => row.msgType !== 'recall' && !isRowHidden(row) && row.timestamp > clearedAt(peerId, chatType)
    )
    try {
      const remote = await messageApi.getHistory({ peerId, chatType, pageSize: Math.min(limit, 200) })
      const incoming = remote
        .map((item) => rowFromResponse(item, sc))
        .filter(
          (row) => row.msgType !== 'recall' && !isRowHidden(row) && row.timestamp > clearedAt(peerId, chatType)
        )
      await Promise.all(incoming.map((row) => window.api.db.upsertMessage(row)))
      rows = sortMessages([...rows, ...incoming])
    } catch {
      // 离线时仍展示本机已缓存记录。
    }
    if (current.value?.peerId === peerId && current.value.chatType === chatType) {
      mergeCurrentMessages(rows)
    }
    return sortMessages(rows).reverse()
  }

  async function removeConversation(peerId: string, chatType: ChatType): Promise<void> {
    const sc = scopeId.value
    if (!sc) return
    await Promise.all([
      window.api.db.clearConversationMessages(sc, peerId, chatType),
      window.api.db.deleteConversation(sc, peerId, chatType)
    ])
    conversations.value = conversations.value.filter(
      (item) => item.peerId !== peerId || item.chatType !== chatType
    )
    if (current.value?.peerId === peerId && current.value.chatType === chatType) {
      current.value = null
      messages.value = []
    }
  }

  function bindWs(): void {
    const ws = getWsClient()
    if (!ws || boundWs === ws) return
    boundWs = ws
    ws.on('chat:ack', (data) => void handleAck(data))
    ws.on('chat:receive', (d) => void handleReceive(d))
    ws.on('chat:recall_notify', handleRecallNotify)
    ws.on('chat:delete_notify', handleDeleteNotify)
    ws.on('chat:clear_group_notify', (data) => {
      if (!data || typeof data !== 'object') return
      const raw = data as Record<string, unknown>
      const groupId = String(raw.groupId ?? raw.group_id ?? raw.id ?? '').trim().replace(/\.0$/, '')
      if (groupId) void clearConversationHistory(groupId, 'group')
    })
    let reconnectPending = false
    ws.onStatus((status) => {
      if (status === 'reconnecting') {
        reconnectPending = true
        return
      }
      if (status !== 'connected') return
      void resendOutbox()
      if (reconnectPending) {
        reconnectPending = false
        void sync().catch((error) => console.warn('message sync after reconnect failed', error))
      }
    })
  }

  return {
    conversations,
    current,
    messages,
    loadConversations,
    syncGroupMetadata,
    openConversation,
    openOrCreateConversation,
    sendText,
    sendMedia,
    markCurrentRead,
    recall,
    hideMessageForMe,
    deleteMessageForEveryone,
    editMessage,
    addFavorite,
    addUserSticker,
    forwardMessage,
    clearConversationHistory,
    clearAllHistory,
    getConversationHistory,
    removeConversation,
    getDraft,
    setDraft,
    sync,
    bindWs
  }
})
