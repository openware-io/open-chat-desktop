<template>
  <section class="chat-panel">
    <div class="chat-header">
      <div v-if="chat.current" class="header-person">
        <UserAvatar
          :name="title"
          :src="currentAvatar"
          :uid="chat.current.peerId"
          :size="40"
        />
        <strong>{{ title }}</strong>
      </div>
      <span v-if="chat.current?.chatType === 'private'" class="call-btns">
        <button type="button" :title="t('chat.voiceCall')" @click="startCall('audio')">☎</button>
        <button type="button" :title="t('chat.videoCall')" @click="startCall('video')">▣</button>
      </span>
      <span v-else-if="chat.current?.chatType === 'group'" class="call-btns">
        <button type="button" :title="t('chat.groupInfo')" @click="showGroupInfo = true">•••</button>
      </span>
    </div>
    <div
      v-if="chat.current && connectionNotice"
      class="connection-notice"
      :class="connectionNotice"
      role="status"
      aria-live="polite"
    >
      <span v-if="connectionNotice === 'reconnecting'" class="connection-spinner" />
      <span>{{ connectionNoticeText }}</span>
      <button v-if="connectionNotice === 'failed'" type="button" @click="retryRealtime">
        {{ t('chat.retryConnection') }}
      </button>
    </div>
    <div class="messages">
      <div
        v-for="m in visibleMessages"
        :key="m.msgId"
        :data-message-id="m.msgId"
        class="msg-row"
        :class="{ mine: isMine(m.fromUserId), selected: selectedMsgIds.has(m.msgId) }"
        @click="multiSelect && toggleMessageSelection(m.msgId)"
        @contextmenu.prevent="multiSelect ? toggleMessageSelection(m.msgId) : openContextMenu($event, m)"
      >
        <label v-if="multiSelect" class="message-selector" @click.stop>
          <input
            type="checkbox"
            :checked="selectedMsgIds.has(m.msgId)"
            @change="toggleMessageSelection(m.msgId)"
          />
        </label>
        <UserAvatar
          :name="messageSenderName(m.fromUserId, m.fromUsername)"
          :src="messageAvatar(m.fromUserId, m.fromAvatar)"
          :uid="m.fromUserId"
          :size="34"
        />
        <div class="msg-col">
          <button
            v-if="m.replyMsgId && quotedMessage(m.replyMsgId)"
            type="button"
            class="quoted-message"
            @click="scrollToMessage(m.replyMsgId)"
          >
            <strong>{{ quotedSender(m.replyMsgId) }}</strong>
            <span>{{ quotedPreview(m.replyMsgId) }}</span>
          </button>
          <template v-if="m.msgType === 'image'">
            <button
              type="button"
              class="media-preview"
              :title="t('chat.openMedia')"
              @click.stop="openMediaViewer('image', m.content)"
            >
              <img class="media-img" :src="imageUrl(m.content)" :alt="t('chat.image')" draggable="false" />
              <span v-if="m.status === 'sending'" class="media-upload-mask">
                <span class="upload-spinner" />{{ pendingMessageLabel(m) }}
              </span>
            </button>
          </template>
          <template v-else-if="m.msgType === 'video'">
            <button
              type="button"
              class="media-preview video-preview"
              :title="t('chat.openMedia')"
              @click.stop="openMediaViewer('video', m.content)"
            >
              <video class="media-video" :src="videoUrl(m.content)" muted preload="metadata" />
              <span class="video-play">▶</span>
              <span v-if="m.status === 'sending'" class="media-upload-mask">
                <span class="upload-spinner" />{{ pendingMessageLabel(m) }}
              </span>
            </button>
          </template>
          <template v-else-if="m.msgType === 'voice'">
            <audio class="media-voice" :src="mediaUrl(m.content)" controls />
          </template>
          <template v-else-if="m.msgType === 'file'">
            <a class="file-card" :href="fileUrl(m.content)" target="_blank">
              📄 {{ fileName(m.content) }}
            </a>
          </template>
          <template v-else-if="m.msgType === 'call'">
            <div class="bubble call-trace">
              <svg
                v-if="callTrace(m.content).isVideo"
                class="call-trace-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M4 6h11a2 2 0 0 1 2 2v1.6l4-2.6v10l-4-2.6V16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
              </svg>
              <svg
                v-else
                class="call-trace-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M6.7 10.8a15.8 15.8 0 0 0 6.5 6.5l2.2-2.2a1 1 0 0 1 1-.24c1.1.37 2.25.56 3.43.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.5 21 3 13.5 3 4.17a1 1 0 0 1 1-1h3.58a1 1 0 0 1 1 1c0 1.18.19 2.33.56 3.43a1 1 0 0 1-.24 1l-2.2 2.2Z" />
              </svg>
              <span>{{ callTrace(m.content).line }}</span>
            </div>
          </template>
          <template v-else>
            <div class="bubble">{{ m.content }}</div>
          </template>
          <time>{{ messageTime(m.timestamp) }}</time>
          <span
            v-if="m.status === 'sending' && m.msgType !== 'image' && m.msgType !== 'video'"
            class="transfer-state"
            aria-live="polite"
          >
            <span class="upload-spinner" />{{ pendingMessageLabel(m) }}
          </span>
          <span v-else-if="m.status === 'failed'" class="transfer-state failed" aria-live="polite">
            {{ t('chat.uploadFailed') }}
          </span>
        </div>
      </div>
      <div v-if="!chat.current" class="chat-empty">{{ t('chat.empty') }}</div>
      <div v-else-if="!visibleMessages.length" class="chat-empty">{{ t('chat.noMessages') }}</div>
    </div>
    <GroupInfoDialog
      v-if="chat.current?.chatType === 'group'"
      v-model="showGroupInfo"
      :group-id="chat.current.peerId"
      @select-message="onGroupHistorySelect"
    />
    <div v-if="chat.current && multiSelect" class="multi-select-bar">
      <button type="button" class="plain" @click="exitMultiSelect">{{ t('common.cancel') }}</button>
      <span>{{ t('chat.selectedCount', { count: selectedMsgIds.size }) }}</span>
      <button type="button" :disabled="!selectedMsgIds.size" @click="quoteSelected">{{ t('chat.quote') }}</button>
      <button type="button" class="danger" :disabled="!selectedMsgIds.size" @click="deleteSelected">{{ t('chat.deleteSelected') }}</button>
    </div>
    <div v-else-if="chat.current" class="composer">
      <div v-if="replyTo" class="reply-bar">
        <span>
          <strong>{{ t('chat.replyTo', { name: messageSenderName(replyTo.fromUserId, replyTo.fromUsername) }) }}</strong>
          <small>{{ messageSummary(replyTo) }}</small>
        </span>
        <button type="button" :title="t('chat.cancelReply')" @click="replyTo = null">×</button>
      </div>
      <div class="input-bar">
        <el-button @click="pickImage">🖼️</el-button>
        <el-button @click="pickVideo">🎬</el-button>
        <el-button @click="pickFile">📎</el-button>
        <el-input v-model="draft" :placeholder="t('chat.inputPlaceholder')" @keyup.enter="send" @input="onDraftInput" />
        <el-button type="primary" @click="send">{{ t('chat.send') }}</el-button>
        <input ref="imageInput" type="file" accept="image/*" hidden @change="onImage" />
        <input ref="videoInput" type="file" accept="video/*" hidden @change="onVideo" />
        <input ref="fileInput" type="file" hidden @change="onFile" />
      </div>
    </div>
    <ForwardMessageDialog v-model="showForward" :message="forwardSource" @forwarded="onForwarded" />
    <div
      v-if="contextMenu"
      class="message-context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @pointerdown.stop
      @contextmenu.prevent
    >
      <button v-if="canCopy(contextMenu.message)" type="button" @click="copyFromMenu">⧉ <span>{{ t('chat.copy') }}</span></button>
      <button v-if="canEdit(contextMenu.message)" type="button" @click="editFromMenu">✎ <span>{{ t('chat.edit') }}</span></button>
      <button type="button" @click="replyFromMenu">↩ <span>{{ t('chat.quote') }}</span></button>
      <button v-if="canFavorite(contextMenu.message)" type="button" @click="favoriteFromMenu">☆ <span>{{ t('chat.favorite') }}</span></button>
      <button v-if="canForward(contextMenu.message)" type="button" @click="forwardFromMenu">➤ <span>{{ t('chat.forward') }}</span></button>
      <button
        v-if="canRecall(contextMenu.message)"
        type="button"
        @click="recallFromMenu"
      >
        ⟲ <span>{{ t('chat.recall') }}</span>
      </button>
      <button v-if="canAddSticker(contextMenu.message)" type="button" @click="addStickerFromMenu">☺ <span>{{ t('chat.addSticker') }}</span></button>
      <button v-if="canDeleteEveryone(contextMenu.message)" type="button" class="danger" @click="deleteEveryoneFromMenu">⌫ <span>{{ t('chat.deleteEveryone') }}</span></button>
      <button v-if="remoteConfig.chatDeleteEnabled" type="button" class="danger" @click="deleteForMeFromMenu">− <span>{{ t('chat.deleteForMe') }}</span></button>
      <button v-if="remoteConfig.chatDeleteEnabled" type="button" @click="enterMultiSelect">☑ <span>{{ t('chat.multiSelect') }}</span></button>
    </div>
    <Teleport to="body">
      <div v-if="mediaViewer" class="media-viewer" @click.self="closeMediaViewer">
        <div class="media-viewer-actions">
          <button
            v-if="!mediaViewer.url.startsWith('blob:')"
            type="button"
            class="media-viewer-save"
            :title="t('chat.saveMedia')"
            @click="saveMedia"
          >
            ⇩ {{ t('chat.saveMedia') }}
          </button>
          <button type="button" class="media-viewer-close" :title="t('chat.closeMedia')" @click="closeMediaViewer">×</button>
        </div>
        <img
          v-if="mediaViewer.type === 'image'"
          class="media-viewer-image"
          :src="mediaViewer.url"
          :alt="t('chat.image')"
        />
        <video
          v-else
          class="media-viewer-video"
          :src="mediaViewer.url"
          controls
          autoplay
        />
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { MessageRow } from '../../../shared/db'
import { resolveMediaUrl } from '../core/mediaUrl'
import { friendAvatar, friendDisplayName } from '../models/friend'
import { groupMemberName } from '../models/group'
import { useChatStore } from '../stores/chat'
import { useAuthStore } from '../stores/auth'
import { useCallStore } from '../stores/call'
import { useContactStore } from '../stores/contact'
import { useGroupStore } from '../stores/group'
import { useRemoteConfigStore } from '../stores/remoteConfig'
import { retryWs, wsConnectionStatus } from '../services/ws/session'
import ForwardMessageDialog from './ForwardMessageDialog.vue'
import GroupInfoDialog from './GroupInfoDialog.vue'
import UserAvatar from './UserAvatar.vue'
import {
  messagePreview,
  parseCallTraceDisplay,
  parseImageContent,
  parseFileContent
} from '../models/content'
import { normalizeEntityId } from '../../../shared/id'

const { t } = useI18n()
const chat = useChatStore()
const auth = useAuthStore()
const call = useCallStore()
const contact = useContactStore()
const group = useGroupStore()
const remoteConfig = useRemoteConfigStore()
const draft = ref('')
const showGroupInfo = ref(false)
const replyTo = ref<MessageRow | null>(null)
const showForward = ref(false)
const forwardSource = ref<MessageRow | null>(null)
const contextMenu = ref<{ message: MessageRow; x: number; y: number } | null>(null)
const multiSelect = ref(false)
const selectedMsgIds = ref(new Set<string>())
const mediaViewer = ref<{ type: 'image' | 'video'; url: string; fileName: string } | null>(null)
const connectionNotice = ref<'reconnecting' | 'failed' | 'restored' | null>(null)
let reconnectNoticeShown = false
let reconnectNoticeTimer: ReturnType<typeof setTimeout> | null = null
let reconnectFailureTimer: ReturnType<typeof setTimeout> | null = null
let restoredNoticeTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => chat.current,
  () => {
    const c = chat.current
    draft.value = c ? chat.getDraft(c.peerId, c.chatType) : ''
    replyTo.value = null
    exitMultiSelect()
    closeMediaViewer()
    if (c?.chatType === 'group') void group.loadMembers(c.peerId).catch(() => undefined)
  }
)
const imageInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const currentConversation = computed(() => {
  const current = chat.current
  if (!current) return null
  return chat.conversations.find(
    (item) => item.peerId === current.peerId && item.chatType === current.chatType
  ) ?? null
})
const currentFriend = computed(() => {
  const current = chat.current
  if (!current || current.chatType !== 'private') return null
  return contact.friends.find((friend) => String(friend.friendId) === current.peerId) ?? null
})
const currentGroup = computed(() => {
  const current = chat.current
  if (!current || current.chatType !== 'group') return null
  return group.getGroup(current.peerId)
})
const title = computed(() => {
  const current = chat.current
  if (!current) return ''
  if (currentFriend.value) return friendDisplayName(currentFriend.value)
  if (currentGroup.value) return group.getGroupDisplayName(current.peerId)
  if (current.chatType === 'group') return currentConversation.value?.name || `群聊 ${current.peerId}`
  return currentConversation.value?.name || current.peerId
})
const currentAvatar = computed(
  () =>
    (currentFriend.value ? friendAvatar(currentFriend.value) : null) ||
    (chat.current?.chatType === 'group' ? group.getGroupAvatar(chat.current.peerId) : null) ||
    currentConversation.value?.avatar ||
    null
)
const visibleMessages = computed(() => chat.messages.filter((message) => message.msgType !== 'recall'))
const connectionNoticeText = computed(() => {
  if (connectionNotice.value === 'failed') return t('chat.connectionFailed')
  if (connectionNotice.value === 'restored') return t('chat.connectionRestored')
  return t('chat.connectionReconnecting')
})

function onGroupHistorySelect(msgId: string): void {
  requestAnimationFrame(() => scrollToMessage(msgId))
}

watch(
  wsConnectionStatus,
  (status) => {
    clearConnectionNoticeTimers()
    if (status === 'reconnecting') {
      connectionNotice.value = null
      reconnectNoticeShown = false
      reconnectNoticeTimer = setTimeout(() => {
        reconnectNoticeShown = true
        connectionNotice.value = 'reconnecting'
      }, 1_500)
      reconnectFailureTimer = setTimeout(() => {
        reconnectNoticeShown = true
        connectionNotice.value = 'failed'
      }, 30_000)
      return
    }
    if (status === 'connected' && reconnectNoticeShown) {
      connectionNotice.value = 'restored'
      reconnectNoticeShown = false
      restoredNoticeTimer = setTimeout(() => {
        connectionNotice.value = null
      }, 2_000)
      return
    }
    reconnectNoticeShown = false
    connectionNotice.value = null
  },
  { immediate: true }
)

onMounted(() => {
  if (!contact.friends.length) void contact.loadFriends().catch(() => undefined)
  document.addEventListener('pointerdown', closeContextMenu)
  document.addEventListener('scroll', closeContextMenu, true)
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('keydown', onWindowKeydown)
})

onBeforeUnmount(() => {
  clearConnectionNoticeTimers()
  document.removeEventListener('pointerdown', closeContextMenu)
  document.removeEventListener('scroll', closeContextMenu, true)
  window.removeEventListener('resize', closeContextMenu)
  window.removeEventListener('keydown', onWindowKeydown)
})

function clearConnectionNoticeTimers(): void {
  if (reconnectNoticeTimer) clearTimeout(reconnectNoticeTimer)
  if (reconnectFailureTimer) clearTimeout(reconnectFailureTimer)
  if (restoredNoticeTimer) clearTimeout(restoredNoticeTimer)
  reconnectNoticeTimer = null
  reconnectFailureTimer = null
  restoredNoticeTimer = null
}

function retryRealtime(): void {
  clearConnectionNoticeTimers()
  reconnectNoticeShown = true
  connectionNotice.value = 'reconnecting'
  reconnectFailureTimer = setTimeout(() => {
    connectionNotice.value = 'failed'
  }, 30_000)
  void retryWs().catch(() => undefined)
}

function pendingMessageLabel(message: MessageRow): string {
  if (wsConnectionStatus.value !== 'connected') return t('chat.waitingForConnection')
  return message.msgType === 'image' || message.msgType === 'video'
    ? t('chat.uploading')
    : t('chat.sending')
}

function isMine(fromUserId: string): boolean {
  return normalizeEntityId(fromUserId) === normalizeEntityId(auth.userId)
}

function messageSenderName(fromUserId: string, fromUsername: string | null): string {
  if (isMine(fromUserId)) return auth.displayName || auth.user?.username || String(auth.userId)
  if (chat.current?.chatType === 'private') return title.value
  const member = group.members.find((item) => String(item.userId) === String(fromUserId))
  if (member) return groupMemberName(member)
  return fromUsername?.trim() || String(fromUserId)
}

function messageAvatar(fromUserId: string, fromAvatar: string | null): string | null {
  if (isMine(fromUserId)) return auth.user?.avatar ?? null
  if (chat.current?.chatType === 'private') return currentAvatar.value
  const member = group.members.find((item) => String(item.userId) === String(fromUserId))
  if (member?.avatar) return member.avatar
  return fromAvatar
}

function messageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function messageSummary(message: MessageRow): string {
  return messagePreview(message.msgType, message.content)
}

function callTrace(content: string) {
  return parseCallTraceDisplay(content)
}

function quotedMessage(msgId: string | null): MessageRow | null {
  if (!msgId) return null
  return chat.messages.find((message) => message.msgId === msgId && message.msgType !== 'recall') ?? null
}

function quotedSender(msgId: string | null): string {
  const message = quotedMessage(msgId)
  return message ? messageSenderName(message.fromUserId, message.fromUsername) : ''
}

function quotedPreview(msgId: string | null): string {
  const message = quotedMessage(msgId)
  return message ? messageSummary(message) : ''
}

function scrollToMessage(msgId: string | null): void {
  if (!msgId) return
  document.querySelector(`[data-message-id="${CSS.escape(msgId)}"]`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  })
}

function startReply(message: MessageRow): void {
  replyTo.value = message
}

function startForward(message: MessageRow): void {
  forwardSource.value = message
  showForward.value = true
}

function openContextMenu(event: MouseEvent, message: MessageRow): void {
  if (message.msgType === 'system' || message.msgType === 'recall') return
  const width = 164
  const height = menuActionCount(message) * 36 + 12
  contextMenu.value = {
    message,
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8))
  }
}

function closeContextMenu(): void {
  contextMenu.value = null
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMediaViewer()
}

function isPending(message: MessageRow): boolean {
  return !!message.clientMsgId && message.msgId === message.clientMsgId
}

function canCopy(message: MessageRow): boolean {
  return message.msgType === 'text' && !!message.content
}

function canEdit(message: MessageRow): boolean {
  const age = Date.now() - message.timestamp
  return !['secret', 'secret_group'].includes(message.chatType) &&
    isMine(message.fromUserId) &&
    message.msgType === 'text' &&
    !isPending(message) &&
    age >= 0 && age < 2 * 60 * 1000
}

function canFavorite(message: MessageRow): boolean {
  return !isPending(message)
}

function canForward(message: MessageRow): boolean {
  return !isPending(message) &&
    !['system', 'recall', 'call'].includes(message.msgType) &&
    !['secret', 'secret_group'].includes(message.chatType)
}

function canRecall(message: MessageRow): boolean {
  return remoteConfig.recallEnabled &&
    remoteConfig.chatDeleteEnabled &&
    !['secret', 'secret_group'].includes(message.chatType) &&
    isMine(message.fromUserId) &&
    !isPending(message) &&
    !['recall', 'call'].includes(message.msgType)
}

function canAddSticker(message: MessageRow): boolean {
  return !isPending(message) && (message.msgType === 'image' || message.msgType === 'emoji')
}

function canDeleteEveryone(message: MessageRow): boolean {
  if (!remoteConfig.chatDeleteEnabled) return false
  if (message.chatType === 'secret' || message.chatType === 'secret_group') return false
  if (isPending(message) || isMine(message.fromUserId)) return true
  if (message.chatType === 'private') return true
  if (message.chatType !== 'group') return false
  const self = group.members.find(
    (item) => String(item.userId) === normalizeEntityId(auth.userId)
  )
  return ['owner', 'admin'].includes(self?.role?.toLowerCase() ?? '')
}

function menuActionCount(message: MessageRow): number {
  return [
    canCopy(message),
    canEdit(message),
    true,
    canFavorite(message),
    canForward(message),
    canRecall(message),
    canAddSticker(message),
    canDeleteEveryone(message),
    remoteConfig.chatDeleteEnabled,
    remoteConfig.chatDeleteEnabled
  ].filter(Boolean).length
}

async function copyFromMenu(): Promise<void> {
  const message = contextMenu.value?.message
  closeContextMenu()
  if (!message) return
  try {
    await navigator.clipboard.writeText(
      message.content.replace(/\[emoji\]\d+\[\/emoji\]/g, '[表情]')
    )
    ElMessage.success(t('chat.copied'))
  } catch {
    ElMessage.error(t('chat.copyFailed'))
  }
}

async function editFromMenu(): Promise<void> {
  const message = contextMenu.value?.message
  closeContextMenu()
  if (!message) return
  try {
    const result = await ElMessageBox.prompt(t('chat.editPrompt'), t('chat.edit'), {
      inputValue: message.content,
      inputType: 'textarea',
      confirmButtonText: t('common.save'),
      cancelButtonText: t('common.cancel'),
      inputValidator: (value) => value.trim() ? true : t('chat.editEmpty')
    })
    if (result.value.trim() === message.content) return
    await chat.editMessage(message, result.value)
    ElMessage.success(t('chat.editSuccess'))
  } catch (action) {
    if (action !== 'cancel' && action !== 'close') ElMessage.error(t('chat.editFailed'))
  }
}

async function favoriteFromMenu(): Promise<void> {
  const message = contextMenu.value?.message
  closeContextMenu()
  if (!message) return
  try {
    await chat.addFavorite(message)
    ElMessage.success(t('chat.favoriteSuccess'))
  } catch {
    ElMessage.error(t('chat.favoriteFailed'))
  }
}

function replyFromMenu(): void {
  const message = contextMenu.value?.message
  closeContextMenu()
  if (message) startReply(message)
}

function forwardFromMenu(): void {
  const message = contextMenu.value?.message
  closeContextMenu()
  if (message) startForward(message)
}

function recallFromMenu(): void {
  const message = contextMenu.value?.message
  closeContextMenu()
  if (message) void confirmRecall(message)
}

async function confirmRecall(message: MessageRow): Promise<void> {
  try {
    await ElMessageBox.confirm(t('chat.recallConfirm'), t('chat.recall'), {
      confirmButtonText: t('chat.recall'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
    await recallMessage(message.msgId)
  } catch {
    // User cancelled.
  }
}

async function addStickerFromMenu(): Promise<void> {
  const message = contextMenu.value?.message
  closeContextMenu()
  if (!message) return
  const url = message.msgType === 'image'
    ? parseImageContent(message.content).url
    : message.content
  try {
    await chat.addUserSticker(url)
    ElMessage.success(t('chat.stickerAdded'))
  } catch {
    ElMessage.error(t('chat.stickerAddFailed'))
  }
}

async function deleteEveryoneFromMenu(): Promise<void> {
  const message = contextMenu.value?.message
  closeContextMenu()
  if (!message) return
  try {
    await ElMessageBox.confirm(t('chat.deleteEveryoneConfirm'), t('chat.deleteEveryone'), {
      confirmButtonText: t('chat.deleteEveryone'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
    await chat.deleteMessageForEveryone(message)
    if (replyTo.value?.msgId === message.msgId) replyTo.value = null
  } catch (action) {
    if (action !== 'cancel' && action !== 'close') ElMessage.error(t('chat.deleteFailed'))
  }
}

function deleteForMeFromMenu(): void {
  const message = contextMenu.value?.message
  closeContextMenu()
  if (message) void chat.hideMessageForMe(message)
}

function enterMultiSelect(): void {
  closeContextMenu()
  replyTo.value = null
  multiSelect.value = true
  selectedMsgIds.value = new Set()
}

function exitMultiSelect(): void {
  multiSelect.value = false
  selectedMsgIds.value = new Set()
}

function toggleMessageSelection(msgId: string): void {
  const next = new Set(selectedMsgIds.value)
  if (next.has(msgId)) next.delete(msgId)
  else next.add(msgId)
  selectedMsgIds.value = next
}

function selectedMessages(): MessageRow[] {
  return visibleMessages.value.filter((message) => selectedMsgIds.value.has(message.msgId))
}

function quoteSelected(): void {
  const selected = selectedMessages()
  if (!selected.length) return
  if (selected.length === 1) {
    replyTo.value = selected[0]
  } else {
    const first = selected[0]
    replyTo.value = {
      ...first,
      msgType: 'text',
      content: selected
        .map(
          (message) =>
            `${messageSenderName(message.fromUserId, message.fromUsername)}: ${messageSummary(message)}`
        )
        .join('\n')
    }
  }
  exitMultiSelect()
}

async function deleteSelected(): Promise<void> {
  const selected = selectedMessages()
  if (!selected.length) return
  if (!selected.every(canDeleteEveryone)) {
    try {
      await ElMessageBox.confirm(
        t('chat.deleteSelectedLocalConfirm', { count: selected.length }),
        t('chat.deleteSelected'),
        {
          confirmButtonText: t('chat.deleteForMe'),
          cancelButtonText: t('common.cancel'),
          type: 'warning'
        }
      )
      await Promise.all(selected.map((message) => chat.hideMessageForMe(message)))
      exitMultiSelect()
    } catch {
      // User cancelled.
    }
    return
  }
  try {
    await ElMessageBox.confirm(
      t('chat.deleteSelectedConfirm', { count: selected.length }),
      t('chat.deleteSelected'),
      {
        distinguishCancelAndClose: true,
        confirmButtonText: t('chat.deleteEveryone'),
        cancelButtonText: t('chat.deleteForMe'),
        type: 'warning'
      }
    )
    await Promise.all(selected.map((message) => chat.deleteMessageForEveryone(message)))
    exitMultiSelect()
  } catch (action) {
    if (action === 'cancel') {
      await Promise.all(selected.map((message) => chat.hideMessageForMe(message)))
      exitMultiSelect()
    } else if (action !== 'close') {
      ElMessage.error(t('chat.deleteFailed'))
    }
  }
}

async function recallMessage(msgId: string): Promise<void> {
  try {
    await chat.recall(msgId)
    if (replyTo.value?.msgId === msgId) replyTo.value = null
  } catch {
    ElMessage.error(t('chat.recallFailed'))
  }
}

function onForwarded(): void {
  ElMessage.success(t('chat.forwardSuccess'))
}

function send(): void {
  const text = draft.value.trim()
  if (!text) return
  draft.value = ''
  if (chat.current) chat.setDraft(chat.current.peerId, chat.current.chatType, '')
  const replyMsgId = replyTo.value?.msgId ?? null
  replyTo.value = null
  void chat.sendText(text, replyMsgId)
}

function onDraftInput(): void {
  if (chat.current) chat.setDraft(chat.current.peerId, chat.current.chatType, draft.value)
}

function startCall(type: 'audio' | 'video'): void {
  if (chat.current) void call.startCall(chat.current.peerId, type)
}

function pickImage(): void {
  imageInput.value?.click()
}
function pickVideo(): void {
  videoInput.value?.click()
}
function pickFile(): void {
  fileInput.value?.click()
}
function onImage(e: Event): void {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) void chat.sendMedia(f, 'image')
  ;(e.target as HTMLInputElement).value = ''
}
function onVideo(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void chat.sendMedia(file, 'video')
  input.value = ''
}
function onFile(e: Event): void {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) void chat.sendMedia(f, 'file')
  ;(e.target as HTMLInputElement).value = ''
}
function imageUrl(content: string): string {
  return resolveMediaUrl(parseImageContent(content).url)
}
function videoUrl(content: string): string {
  try {
    const raw = JSON.parse(content) as Record<string, unknown>
    const url = raw.url ?? raw.playUrl ?? raw.play_url
    if (typeof url === 'string') return resolveMediaUrl(url)
  } catch {
    // Legacy video content is a direct URL.
  }
  return resolveMediaUrl(content)
}
function openMediaViewer(type: 'image' | 'video', content: string): void {
  const url = type === 'image' ? imageUrl(content) : videoUrl(content)
  if (url) mediaViewer.value = { type, url, fileName: mediaDownloadName(type, url) }
}
function closeMediaViewer(): void {
  mediaViewer.value = null
}
async function saveMedia(): Promise<void> {
  const viewer = mediaViewer.value
  if (!viewer || viewer.url.startsWith('blob:')) return
  try {
    const result = await window.api.media.save(viewer.url, viewer.fileName)
    if (!result.canceled) ElMessage.success(t('chat.mediaSaved'))
  } catch (error) {
    console.error('save media failed', error)
    ElMessage.error(t('chat.mediaSaveFailed'))
  }
}
function mediaDownloadName(type: 'image' | 'video', url: string): string {
  const fallbackExtension = type === 'image' ? 'png' : 'mp4'
  try {
    const path = decodeURIComponent(new URL(url).pathname)
    const lastSegment = path.split('/').pop() ?? ''
    const extension = lastSegment.match(/\.[a-z0-9]{2,5}$/i)?.[0].slice(1) || fallbackExtension
    return `wv-chat-${type}-${Date.now()}.${extension}`
  } catch {
    return `wv-chat-${type}-${Date.now()}.${fallbackExtension}`
  }
}
function fileName(content: string): string {
  return parseFileContent(content)?.name ?? t('chat.file')
}
function fileUrl(content: string): string {
  return resolveMediaUrl(parseFileContent(content)?.url ?? content)
}
function mediaUrl(content: string): string {
  return resolveMediaUrl(content)
}
</script>

<style scoped>
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #f7f8fa;
}
.chat-header {
  min-height: 64px;
  box-sizing: border-box;
  padding: 10px 18px;
  border-bottom: 1px solid #e9ecf1;
  background: rgb(255 255 255 / 94%);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-person {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}
.header-person strong {
  overflow: hidden;
  color: #252d3d;
  font-size: 15px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.call-btns {
  display: flex;
  gap: 8px;
}
.call-btns button {
  width: 34px;
  height: 34px;
  border: 1px solid #e2e6ed;
  border-radius: 10px;
  background: #fff;
  color: #687386;
  cursor: pointer;
  font-size: 15px;
}
.call-btns button:hover {
  border-color: #bac5f3;
  background: #f4f6ff;
  color: #5266d5;
}
.connection-notice {
  display: flex;
  min-height: 32px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 14px;
  border-bottom: 1px solid #f0dca9;
  background: #fff8e8;
  color: #88651b;
  font-size: 12px;
}
.connection-notice.failed {
  border-bottom-color: #f3cccc;
  background: #fff1f1;
  color: #b44040;
}
.connection-notice.restored {
  border-bottom-color: #cce8d7;
  background: #effaf3;
  color: #368457;
}
.connection-notice button {
  padding: 2px 9px;
  border: 1px solid currentColor;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.connection-spinner {
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: upload-spin 0.8s linear infinite;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 22px 24px;
}
.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 16px;
}
.msg-row.mine {
  flex-direction: row-reverse;
}
.msg-row.selected {
  border-radius: 12px;
  background: rgb(111 131 232 / 10%);
}
.message-selector {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  cursor: pointer;
}
.message-selector input {
  width: 17px;
  height: 17px;
  accent-color: #6377df;
}
.msg-col {
  display: flex;
  flex-direction: column;
  max-width: min(66%, 620px);
}
.bubble {
  padding: 9px 13px;
  border: 1px solid #e9ecf0;
  border-radius: 5px 14px 14px 14px;
  background: #fff;
  box-shadow: 0 3px 12px rgb(40 50 70 / 5%);
  color: #303746;
  font-size: 14px;
  line-height: 1.55;
  word-break: break-word;
}
.mine .bubble {
  border-color: #88df68;
  border-radius: 14px 5px 14px 14px;
  background: #95e878;
  box-shadow: 0 3px 12px rgb(73 175 57 / 10%);
}
.call-trace {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.call-trace-icon {
  width: 21px;
  height: 21px;
  flex: 0 0 21px;
  fill: currentColor;
}
.quoted-message {
  display: flex;
  max-width: 100%;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 5px;
  padding: 7px 10px;
  border: 0;
  border-left: 3px solid #7b8dec;
  border-radius: 5px 9px 9px 5px;
  background: rgb(232 235 244 / 86%);
  color: #737c8d;
  cursor: pointer;
  text-align: left;
}
.quoted-message strong,
.quoted-message span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quoted-message strong {
  color: #5969c8;
  font-size: 11px;
}
.quoted-message span {
  font-size: 12px;
}
.media-img {
  display: block;
  max-width: 240px;
  max-height: 240px;
  border-radius: 8px;
}
.media-video {
  display: block;
  width: min(320px, 48vw);
  max-height: 240px;
  border-radius: 8px;
  background: #151820;
  object-fit: contain;
}
.media-preview {
  position: relative;
  display: block;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  background: #e8ebf0;
  cursor: zoom-in;
}
.video-play {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 46px;
  height: 46px;
  box-sizing: border-box;
  place-items: center;
  padding-left: 3px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: rgb(18 22 31 / 68%);
  color: #fff;
  font-size: 18px;
}
.media-upload-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgb(24 29 39 / 55%);
  color: #fff;
  font-size: 13px;
}
.upload-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: upload-spin 0.8s linear infinite;
}
.transfer-state {
  display: inline-flex;
  align-self: flex-end;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  color: #8c95a5;
  font-size: 11px;
}
.transfer-state.failed {
  color: #df5b5b;
}
@keyframes upload-spin {
  to { transform: rotate(360deg); }
}
.media-viewer {
  position: fixed;
  z-index: 10000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 38px;
  background: rgb(8 11 17 / 92%);
}
.media-viewer-close {
  position: static;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 14%);
  color: #fff;
  cursor: pointer;
  font-size: 28px;
  line-height: 1;
}
.media-viewer-close:hover {
  background: rgb(255 255 255 / 24%);
}
.media-viewer-image,
.media-viewer-video {
  display: block;
  max-width: 94vw;
  max-height: 90vh;
  object-fit: contain;
}
.media-viewer-image {
  cursor: zoom-out;
}
.media-viewer-actions {
  position: fixed;
  z-index: 1;
  top: 20px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.media-viewer-save {
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 21px;
  background: rgb(255 255 255 / 14%);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.media-viewer-save:hover {
  background: rgb(255 255 255 / 24%);
}
.media-viewer-video {
  width: min(1100px, 94vw);
  background: #000;
}
.media-voice {
  width: 220px;
}
.file-card {
  display: inline-block;
  padding: 10px 14px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  color: #409eff;
  text-decoration: none;
  font-size: 14px;
}
.msg-col time {
  align-self: flex-start;
  margin-top: 4px;
  color: #a6adb8;
  font-size: 10px;
}
.mine .msg-col time {
  align-self: flex-end;
}
.message-context-menu {
  position: fixed;
  z-index: 4000;
  display: flex;
  width: 156px;
  max-height: calc(100vh - 16px);
  box-sizing: border-box;
  flex-direction: column;
  padding: 6px;
  border: 1px solid rgb(220 225 233 / 90%);
  border-radius: 11px;
  background: rgb(255 255 255 / 98%);
  box-shadow: 0 12px 34px rgb(32 41 57 / 18%);
  overflow-y: auto;
}
.message-context-menu button {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #3b4351;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}
.message-context-menu button:hover {
  background: #f2f4f8;
}
.message-context-menu button.danger {
  color: #e65e5e;
}
.chat-empty {
  color: #a7afbb;
  text-align: center;
  margin-top: 40px;
}
.multi-select-bar {
  display: flex;
  min-height: 58px;
  box-sizing: border-box;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 18px;
  border-top: 1px solid #e2e6ed;
  background: #fff;
}
.multi-select-bar span {
  margin-right: auto;
  color: #7a8496;
  font-size: 13px;
}
.multi-select-bar button {
  padding: 7px 13px;
  border: 1px solid #d8dde6;
  border-radius: 8px;
  background: #fff;
  color: #465067;
  cursor: pointer;
}
.multi-select-bar button:hover:not(:disabled) {
  border-color: #8292e8;
  color: #596fd8;
}
.multi-select-bar button.danger {
  border-color: #f2c8c8;
  color: #dd5656;
}
.multi-select-bar button:disabled {
  cursor: default;
  opacity: 0.45;
}
.composer {
  border-top: 1px solid #e9ecf1;
  background: #fff;
}
.reply-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 10px 18px 0;
  padding: 8px 11px;
  border-left: 3px solid #6f83e8;
  border-radius: 4px 9px 9px 4px;
  background: #f4f6fb;
}
.reply-bar span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.reply-bar strong,
.reply-bar small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reply-bar strong {
  color: #566bd1;
  font-size: 12px;
}
.reply-bar small {
  color: #858e9e;
}
.reply-bar button {
  border: 0;
  background: transparent;
  color: #8f98a8;
  cursor: pointer;
  font-size: 20px;
}
.input-bar {
  display: flex;
  gap: 8px;
  padding: 13px 18px;
  align-items: center;
}
</style>
