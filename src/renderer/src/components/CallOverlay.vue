<template>
  <div v-if="call.status !== 'idle'" class="call-overlay">
    <div class="ambient ambient-one" />
    <div class="ambient ambient-two" />

    <div v-if="call.status === 'incoming'" class="call-card">
      <span class="eyebrow">{{ t('call.incoming') }}</span>
      <UserAvatar :name="remoteDisplayName" :src="remoteAvatar" :uid="call.remoteUserId" :size="104" />
      <h2>{{ remoteDisplayName }}</h2>
      <p class="call-kind">
        {{ call.mediaType === 'video' ? t('call.videoCall') : t('call.voiceCall') }}
      </p>
      <p v-if="mediaErrorText" class="media-error">{{ mediaErrorText }}</p>
      <div class="call-actions">
        <button type="button" class="call-action reject" :aria-label="t('call.reject')" @click="call.reject()">
          <span class="action-icon">×</span>
          <span>{{ t('call.reject') }}</span>
        </button>
        <button type="button" class="call-action accept" :aria-label="t('call.accept')" @click="call.accept()">
          <span class="action-icon">☎</span>
          <span>{{ mediaErrorText ? t('call.retry') : t('call.accept') }}</span>
        </button>
      </div>
    </div>

    <div v-else-if="call.status === 'error'" class="call-card">
      <UserAvatar :name="remoteDisplayName" :src="remoteAvatar" :uid="call.remoteUserId" :size="104" />
      <h2>{{ remoteDisplayName }}</h2>
      <p class="media-error">{{ mediaErrorText }}</p>
      <el-button type="danger" round @click="call.reset()">{{ t('call.close') }}</el-button>
    </div>

    <template v-else>
      <video
        v-if="call.remoteStream && call.mediaType === 'video'"
        ref="remoteMediaEl"
        autoplay
        playsinline
        class="remote"
      />
      <audio v-else-if="call.remoteStream" ref="remoteMediaEl" autoplay />
      <div v-if="call.mediaType === 'audio' || !call.remoteStream" class="call-profile">
        <UserAvatar :name="remoteDisplayName" :src="remoteAvatar" :uid="call.remoteUserId" :size="112" />
        <h2>{{ remoteDisplayName }}</h2>
        <p>{{ statusText }}</p>
      </div>
      <video
        v-if="call.localStream && call.mediaType === 'video'"
        ref="localVideoEl"
        autoplay
        playsinline
        muted
        class="local"
      />
      <div v-if="call.mediaType === 'video' && call.remoteStream" class="call-status">
        <span class="status-dot" />{{ remoteDisplayName }} · {{ statusText }}
      </div>
      <div class="controls">
        <button type="button" class="call-action reject" :aria-label="t('call.hangup')" @click="call.hangup()">
          <span class="action-icon">×</span>
          <span>{{ t('call.hangup') }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { friendAvatar, friendDisplayName } from '../models/friend'
import { useCallStore } from '../stores/call'
import { useChatStore } from '../stores/chat'
import { useContactStore } from '../stores/contact'
import UserAvatar from './UserAvatar.vue'

const { t } = useI18n()
const call = useCallStore()
const chat = useChatStore()
const contact = useContactStore()
const remoteMediaEl = ref<HTMLMediaElement | null>(null)
const localVideoEl = ref<HTMLVideoElement | null>(null)

const remoteFriend = computed(
  () => contact.friends.find((friend) => String(friend.friendId) === call.remoteUserId) ?? null
)
const remoteConversation = computed(
  () =>
    chat.conversations.find(
      (conversation) =>
        conversation.chatType === 'private' && conversation.peerId === call.remoteUserId
    ) ?? null
)
const remoteDisplayName = computed(() => {
  if (call.remoteName.trim()) return call.remoteName.trim()
  if (remoteFriend.value) return friendDisplayName(remoteFriend.value)
  return (
    remoteConversation.value?.name?.trim() ||
    (call.remoteUserId ? t('call.userFallback', { id: call.remoteUserId }) : t('common.unknown'))
  )
})
const remoteAvatar = computed(
  () =>
    call.remoteAvatar.trim() ||
    (remoteFriend.value ? friendAvatar(remoteFriend.value) : null) ||
    remoteConversation.value?.avatar ||
    null
)
const statusText = computed(() => {
  if (call.status === 'ringing') return t('call.ringing')
  if (call.status === 'connecting') return t('call.connecting')
  return t('call.connected')
})
const mediaErrorText = computed(() => {
  if (!call.mediaError) return ''
  if (call.mediaError === 'permissionDenied') return t('call.mediaPermissionDenied')
  if (call.mediaError === 'deviceNotFound') {
    return call.mediaType === 'video'
      ? t('call.videoDeviceNotFound')
      : t('call.microphoneNotFound')
  }
  if (call.mediaError === 'deviceBusy') return t('call.mediaDeviceBusy')
  if (call.mediaError === 'unsupported') return t('call.mediaUnsupported')
  return t('call.mediaUnavailable')
})

watch(
  [() => call.remoteStream, remoteMediaEl],
  ([stream, element]) => {
    if (element) element.srcObject = stream
  },
  { flush: 'post', immediate: true }
)
watch(
  [() => call.localStream, localVideoEl],
  ([stream, element]) => {
    if (element) element.srcObject = stream
  },
  { flush: 'post', immediate: true }
)
</script>

<style scoped>
.call-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  background: radial-gradient(circle at 50% 20%, #26334c 0%, #111722 46%, #080b11 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ambient {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.24;
  pointer-events: none;
}
.ambient-one {
  top: -160px;
  left: -80px;
  background: #5b7cfa;
}
.ambient-two {
  right: -100px;
  bottom: -180px;
  background: #8b5cf6;
}
.call-card,
.call-profile {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: #fff;
}
.call-card {
  width: min(390px, calc(100vw - 48px));
  box-sizing: border-box;
  padding: 36px 32px 32px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 28px;
  background: rgb(24 31 45 / 78%);
  box-shadow: 0 28px 80px rgb(0 0 0 / 38%);
  backdrop-filter: blur(28px);
}
.call-card h2,
.call-profile h2 {
  margin: 20px 0 6px;
  font-size: 24px;
  font-weight: 650;
}
.call-card :deep(.user-avatar),
.call-profile :deep(.user-avatar) {
  border-radius: 50%;
  box-shadow: 0 18px 46px rgb(0 0 0 / 34%);
}
.call-card > .el-button {
  margin-top: 28px;
}
.eyebrow {
  margin-bottom: 22px;
  color: #aebbd1;
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.call-kind,
.call-profile p {
  margin: 0;
  color: #aeb8ca;
  font-size: 15px;
}
.media-error {
  width: 100%;
  box-sizing: border-box;
  margin: 20px 0 0;
  padding: 12px 14px;
  border: 1px solid rgb(248 113 113 / 25%);
  border-radius: 12px;
  background: rgb(127 29 29 / 22%);
  color: #fecaca;
  font-size: 13px;
  line-height: 1.55;
}
.call-actions {
  display: flex;
  gap: 54px;
  justify-content: center;
  margin-top: 32px;
}
.call-action {
  display: flex;
  min-width: 72px;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  border: 0;
  background: transparent;
  color: #dbe3ef;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}
.action-icon {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  font-size: 25px;
  line-height: 1;
  transition: transform 160ms ease, filter 160ms ease;
}
.call-action:hover .action-icon {
  filter: brightness(1.1);
  transform: translateY(-2px);
}
.call-action.accept .action-icon {
  background: #22c55e;
  box-shadow: 0 10px 28px rgb(34 197 94 / 30%);
}
.call-action.reject .action-icon {
  background: #ef4444;
  box-shadow: 0 10px 28px rgb(239 68 68 / 28%);
}
.call-profile {
  max-width: calc(100vw - 48px);
}
.remote {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.local {
  position: absolute;
  right: 24px;
  bottom: 24px;
  width: 180px;
  border-radius: 8px;
  border: 2px solid #fff;
  background: #000;
}
.call-status {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 999px;
  background: rgb(10 14 22 / 56%);
  color: #fff;
  font-size: 14px;
  backdrop-filter: blur(16px);
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgb(34 197 94 / 16%);
}
.controls {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
}
</style>
