<template>
  <div class="contacts-shell">
    <aside class="contacts-sidebar">
      <div class="sidebar-header">
        <div>
          <h1>{{ t('contacts.title') }}</h1>
          <span>{{ t('contacts.friendCount', { count: contact.friends.length }) }}</span>
        </div>
      </div>

      <div class="add-row">
        <el-input
          v-model="newFriendId"
          :placeholder="t('contacts.addPlaceholder')"
          @keyup.enter="onAdd"
        />
        <el-button type="primary" @click="onAdd">{{ t('contacts.add') }}</el-button>
      </div>

      <div class="contacts-scroll">
        <section v-if="contact.requests.length" class="contact-section">
          <div class="section-title">
            <span>{{ t('contacts.requests') }}</span>
            <span class="count-badge">{{ contact.requests.length }}</span>
          </div>
          <div v-for="request in contact.requests" :key="request.id" class="request-item">
            <UserAvatar
              :name="requestName(request)"
              :src="request.fromUser?.avatar"
              :uid="request.fromUserId"
              :size="40"
            />
            <div class="friend-copy">
              <strong>{{ requestName(request) }}</strong>
              <small>{{ t('contacts.wantsToAddYou') }}</small>
            </div>
            <div class="request-actions">
              <el-button size="small" type="primary" @click="acceptRequest(request.id)">
                {{ t('contacts.accept') }}
              </el-button>
              <el-button size="small" @click="contact.reject(request.id)">
                {{ t('contacts.reject') }}
              </el-button>
            </div>
          </div>
        </section>

        <section class="contact-section">
          <div class="section-title">{{ t('contacts.friends') }}</div>
          <button
            v-for="friend in contact.friends"
            :key="friend.friendId"
            class="friend-item"
            :class="{ active: selectedFriendId === friend.friendId }"
            type="button"
            @click="selectedFriendId = friend.friendId"
          >
            <UserAvatar
              :name="displayName(friend)"
              :src="avatar(friend)"
              :uid="friend.friendId"
              :size="46"
            />
            <span class="friend-copy">
              <strong>{{ displayName(friend) }}</strong>
              <small>{{ username(friend) }}</small>
            </span>
            <span class="chevron">›</span>
          </button>
          <div v-if="!contact.friends.length" class="empty">{{ t('contacts.noFriends') }}</div>
        </section>

        <section v-if="contact.blocked.length" class="contact-section blocked-section">
          <div class="section-title">{{ t('contacts.blocked') }}</div>
          <div v-for="friend in contact.blocked" :key="friend.friendId" class="blocked-item">
            <UserAvatar
              :name="displayName(friend)"
              :src="avatar(friend)"
              :uid="friend.friendId"
              :size="38"
            />
            <span>{{ displayName(friend) }}</span>
            <el-button size="small" link @click="contact.unblock(friend.friendId)">
              {{ t('contacts.unblock') }}
            </el-button>
          </div>
        </section>
      </div>
    </aside>

    <ContactDetailPanel
      v-if="selectedFriend"
      :friend="selectedFriend"
      @chat="startChat(selectedFriend)"
      @voice="startCall(selectedFriend, 'audio')"
      @video="startCall(selectedFriend, 'video')"
      @secret="startSecret(selectedFriend)"
      @edit-remark="editRemark(selectedFriend)"
      @edit-group="editGroup(selectedFriend)"
      @block="blockFriend(selectedFriend)"
      @remove="removeFriend(selectedFriend)"
    />
    <section v-else class="detail-placeholder">
      <div class="placeholder-mark">◎</div>
      <h2>{{ t('contacts.selectFriend') }}</h2>
      <p>{{ t('contacts.selectFriendHint') }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import type { FriendItem, FriendRequestItem } from '../models/friend'
import {
  friendAvatar,
  friendDisplayName,
  friendUsername
} from '../models/friend'
import { useCallStore, type CallMedia } from '../stores/call'
import { useChatStore } from '../stores/chat'
import { useContactStore } from '../stores/contact'
import { useSecretChatStore } from '../stores/secretChat'
import { useRemoteConfigStore } from '../stores/remoteConfig'
import { useUiStore } from '../stores/ui'
import ContactDetailPanel from './ContactDetailPanel.vue'
import UserAvatar from './UserAvatar.vue'

const { t } = useI18n()
const contact = useContactStore()
const chat = useChatStore()
const call = useCallStore()
const secretChat = useSecretChatStore()
const remoteConfig = useRemoteConfigStore()
const ui = useUiStore()
const newFriendId = ref('')
const selectedFriendId = ref<number | null>(null)
const selectedFriend = computed(
  () => contact.friends.find((item) => item.friendId === selectedFriendId.value) ?? null
)

onMounted(async () => {
  try {
    await Promise.all([
      contact.loadFriends(),
      contact.loadRequests(),
      contact.loadBlocked()
    ])
  } catch (error) {
    showError(error)
  }
})

function displayName(friend: FriendItem): string {
  return friendDisplayName(friend)
}

function username(friend: FriendItem): string {
  return friendUsername(friend)
}

function avatar(friend: FriendItem): string | null {
  return friendAvatar(friend)
}

function requestName(request: FriendRequestItem): string {
  return (
    request.fromUser?.nickname?.trim() ||
    request.fromUser?.username?.trim() ||
    request.fromNickname?.trim() ||
    request.fromUsername?.trim() ||
    String(request.fromUserId)
  )
}

function showError(error: unknown): void {
  ElMessage.error(error instanceof Error ? error.message : t('common.operationFailed'))
}

async function onAdd(): Promise<void> {
  const id = newFriendId.value.trim()
  if (!id) return
  try {
    await contact.addFriend(id)
    newFriendId.value = ''
    ElMessage.success(t('contacts.requestSent'))
  } catch (error) {
    showError(error)
  }
}

async function acceptRequest(id: number): Promise<void> {
  try {
    await contact.accept(id)
  } catch (error) {
    showError(error)
  }
}

async function startChat(friend: FriendItem): Promise<void> {
  const peerId = String(friend.friendId)
  ui.activeTab = 'chat'
  try {
    await chat.openOrCreateConversation(peerId, 'private', {
      name: displayName(friend),
      avatar: avatar(friend)
    })
  } catch (error) {
    showError(error)
  }
}

function startCall(friend: FriendItem, media: CallMedia): void {
  void call.startCall(String(friend.friendId), media)
}

async function startSecret(friend: FriendItem): Promise<void> {
  if (!remoteConfig.secretChatEnabled) return
  try {
    await secretChat.startWith(String(friend.friendId))
    ui.activeTab = 'secret'
  } catch (error) {
    showError(error)
  }
}

async function editRemark(friend: FriendItem): Promise<void> {
  try {
    const result = await ElMessageBox.prompt(
      t('contacts.remarkPlaceholder'),
      t('contacts.editRemark'),
      {
        inputValue: friend.remark ?? '',
        confirmButtonText: t('common.save'),
        cancelButtonText: t('common.cancel')
      }
    )
    await contact.updateRemark(friend.friendId, result.value.trim())
    ElMessage.success(t('contacts.remarkSaved'))
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    showError(error)
  }
}

async function editGroup(friend: FriendItem): Promise<void> {
  try {
    const result = await ElMessageBox.prompt(
      t('contacts.groupPlaceholder'),
      t('contacts.editFriendGroup'),
      {
        inputValue: friend.groupName ?? '',
        confirmButtonText: t('common.save'),
        cancelButtonText: t('common.cancel')
      }
    )
    await contact.updateGroup(friend.friendId, result.value.trim())
    ElMessage.success(t('contacts.groupSaved'))
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    showError(error)
  }
}

async function blockFriend(friend: FriendItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('contacts.blockConfirm', { name: displayName(friend) }),
      t('contacts.block'),
      {
        type: 'warning',
        confirmButtonText: t('contacts.block'),
        cancelButtonText: t('common.cancel')
      }
    )
    await contact.block(friend.friendId)
    selectedFriendId.value = null
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    showError(error)
  }
}

async function removeFriend(friend: FriendItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('contacts.removeConfirm', { name: displayName(friend) }),
      t('contacts.removeFriend'),
      {
        type: 'warning',
        confirmButtonText: t('contacts.removeFriend'),
        cancelButtonText: t('common.cancel')
      }
    )
    await contact.remove(friend.friendId)
    selectedFriendId.value = null
    ElMessage.success(t('contacts.friendRemoved'))
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    showError(error)
  }
}
</script>

<style scoped>
.contacts-shell {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 100%;
  background: #fff;
}
.contacts-sidebar {
  display: flex;
  width: 330px;
  min-width: 280px;
  flex-direction: column;
  border-right: 1px solid #e7eaf0;
  background: #fff;
}
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 12px;
}
.sidebar-header h1 {
  margin: 0;
  color: #182033;
  font-size: 21px;
  font-weight: 680;
}
.sidebar-header span {
  display: block;
  margin-top: 4px;
  color: #98a0ae;
  font-size: 12px;
}
.add-row {
  display: flex;
  gap: 8px;
  padding: 8px 16px 14px;
}
.contacts-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 20px;
}
.contact-section {
  margin-top: 10px;
}
.section-title {
  display: flex;
  min-height: 30px;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  color: #929baa;
  font-size: 12px;
  font-weight: 600;
}
.count-badge {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 10px;
  background: #eef1f7;
  color: #697386;
  text-align: center;
}
.friend-item,
.request-item,
.blocked-item {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  align-items: center;
  gap: 11px;
  border: 0;
  border-radius: 13px;
  background: transparent;
  color: inherit;
  text-align: left;
}
.friend-item {
  min-height: 64px;
  padding: 8px 10px;
  cursor: pointer;
}
.friend-item:hover {
  background: #f5f7fa;
}
.friend-item.active {
  background: linear-gradient(90deg, #edf1ff, #f5f3ff);
}
.friend-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}
.friend-copy strong {
  overflow: hidden;
  color: #303849;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.friend-copy small {
  overflow: hidden;
  color: #9aa2af;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron {
  color: #b7bec8;
  font-size: 22px;
}
.request-item,
.blocked-item {
  padding: 9px 10px;
}
.request-actions {
  display: flex;
  gap: 3px;
}
.blocked-item > span:nth-child(2) {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.blocked-section {
  padding-top: 6px;
  border-top: 1px solid #f0f2f5;
}
.empty {
  padding: 30px 12px;
  color: #aab1bd;
  text-align: center;
  font-size: 13px;
}
.detail-placeholder {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f6f7f9;
  color: #9ba4b2;
}
.placeholder-mark {
  display: flex;
  width: 78px;
  height: 78px;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  background: #e9edf5;
  color: #aab4c5;
  font-size: 38px;
}
.detail-placeholder h2 {
  margin: 20px 0 7px;
  color: #697386;
  font-size: 17px;
}
.detail-placeholder p {
  margin: 0;
  font-size: 13px;
}
</style>
