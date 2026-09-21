<template>
  <section class="contact-detail">
    <div class="detail-content">
      <div class="profile-card">
        <UserAvatar
          :name="displayName"
          :src="avatar"
          :uid="friend.friendId"
          :size="82"
        />
        <div class="profile-copy">
          <h2>{{ displayName }}</h2>
          <div class="account">{{ t('contacts.account') }}：{{ username }}</div>
          <p class="signature">
            {{ signature || t('contacts.noSignature') }}
          </p>
        </div>
      </div>

      <div class="info-card">
        <button class="info-row editable" type="button" @click="emit('editRemark')">
          <span>{{ t('contacts.remark') }}</span>
          <span class="row-value">{{ friend.remark?.trim() || t('contacts.notSet') }} ›</span>
        </button>
        <button class="info-row editable" type="button" @click="emit('editGroup')">
          <span>{{ t('contacts.friendGroup') }}</span>
          <span class="row-value">{{ friend.groupName?.trim() || t('contacts.noGroup') }} ›</span>
        </button>
        <div class="info-row">
          <span>{{ t('contacts.userId') }}</span>
          <span class="row-value">{{ friend.friendId }}</span>
        </div>
      </div>

      <button class="message-button" type="button" @click="emit('chat')">
        {{ t('contacts.sendMessage') }}
      </button>

      <div class="action-grid">
        <button type="button" @click="emit('voice')">
          <span class="action-icon">☎</span>
          <span>{{ t('contacts.voiceCall') }}</span>
        </button>
        <button type="button" @click="emit('video')">
          <span class="action-icon">▣</span>
          <span>{{ t('contacts.videoCall') }}</span>
        </button>
        <button v-if="remoteConfig.secretChatEnabled" type="button" @click="emit('secret')">
          <span class="action-icon">◇</span>
          <span>{{ t('contacts.secretChat') }}</span>
        </button>
      </div>

      <div class="danger-card">
        <button type="button" @click="emit('block')">{{ t('contacts.block') }}</button>
        <button type="button" @click="emit('remove')">{{ t('contacts.removeFriend') }}</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FriendItem } from '../models/friend'
import {
  friendAvatar,
  friendDisplayName,
  friendSignature,
  friendUsername
} from '../models/friend'
import { useRemoteConfigStore } from '../stores/remoteConfig'
import UserAvatar from './UserAvatar.vue'

const props = defineProps<{ friend: FriendItem }>()
const emit = defineEmits<{
  chat: []
  voice: []
  video: []
  secret: []
  editRemark: []
  editGroup: []
  block: []
  remove: []
}>()
const { t } = useI18n()
const remoteConfig = useRemoteConfigStore()
const displayName = computed(() => friendDisplayName(props.friend))
const username = computed(() => friendUsername(props.friend))
const avatar = computed(() => friendAvatar(props.friend))
const signature = computed(() => friendSignature(props.friend))
</script>

<style scoped>
.contact-detail {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  background: #f6f7f9;
}
.detail-content {
  width: min(680px, calc(100% - 56px));
  margin: 48px auto;
}
.profile-card,
.info-card,
.danger-card {
  border: 1px solid #e8ebf0;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 30px rgb(30 41 59 / 5%);
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 28px;
}
.profile-copy {
  min-width: 0;
}
.profile-copy h2 {
  margin: 0 0 7px;
  color: #172033;
  font-size: 24px;
  font-weight: 680;
  letter-spacing: -0.3px;
}
.account,
.signature {
  color: #7a8495;
  font-size: 14px;
}
.signature {
  margin: 8px 0 0;
  line-height: 1.6;
}
.info-card {
  margin-top: 18px;
  overflow: hidden;
}
.info-row {
  display: flex;
  width: 100%;
  min-height: 54px;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border: 0;
  border-bottom: 1px solid #eef0f3;
  background: transparent;
  color: #30394a;
  font: inherit;
  text-align: left;
}
.info-row:last-child {
  border-bottom: 0;
}
.info-row.editable {
  cursor: pointer;
}
.info-row.editable:hover {
  background: #fafbfc;
}
.row-value {
  max-width: 65%;
  overflow: hidden;
  color: #8b94a3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.message-button {
  width: 100%;
  height: 50px;
  margin-top: 18px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f73f1, #6759e8);
  box-shadow: 0 10px 22px rgb(79 115 241 / 20%);
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: 650;
}
.message-button:hover {
  filter: brightness(1.04);
}
.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 14px;
}
.action-grid button {
  display: flex;
  min-height: 84px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #e5e9f0;
  border-radius: 14px;
  background: #fff;
  color: #4b5567;
  cursor: pointer;
}
.action-grid button:hover {
  border-color: #bac6f8;
  background: #f8f9ff;
  color: #4f64d8;
}
.action-icon {
  color: #6475df;
  font-size: 22px;
  line-height: 1;
}
.danger-card {
  display: flex;
  margin-top: 18px;
  overflow: hidden;
}
.danger-card button {
  flex: 1;
  height: 48px;
  border: 0;
  border-right: 1px solid #eef0f3;
  background: #fff;
  color: #d54f57;
  cursor: pointer;
}
.danger-card button:last-child {
  border-right: 0;
}
.danger-card button:hover {
  background: #fff7f7;
}
</style>
