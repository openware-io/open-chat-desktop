<template>
  <div class="main">
    <aside class="nav">
      <UserAvatar
        :name="auth.displayName || initial"
        :src="auth.user?.avatar"
        :uid="auth.userId"
        :size="40"
      />
      <button class="nav-btn" :class="{ active: ui.activeTab === 'chat' }" :title="t('nav.messages')" @click="ui.activeTab = 'chat'">◉</button>
      <button class="nav-btn" :class="{ active: ui.activeTab === 'contacts' }" :title="t('nav.contacts')" @click="ui.activeTab = 'contacts'">◎</button>
      <button v-if="remoteConfig.secretChatEnabled" class="nav-btn" :class="{ active: ui.activeTab === 'secret' }" :title="t('nav.secretChat')" @click="ui.activeTab = 'secret'">◇</button>
      <button class="nav-btn" :class="{ active: ui.activeTab === 'channel' }" :title="t('nav.channel')" @click="ui.activeTab = 'channel'">▤</button>
      <!-- <button class="nav-btn" :class="{ active: ui.activeTab === 'services' }" :title="t('nav.services')" @click="ui.activeTab = 'services'">▦</button> -->
      <div class="spacer"></div>
      <el-dropdown placement="right-end" trigger="click" @command="onAccountCommand">
        <button class="nav-btn account-btn" :class="{ active: accountPageActive }" :title="t('nav.accountMenu')">•••</button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">♙&nbsp;&nbsp;{{ t('account.profile') }}</el-dropdown-item>
            <el-dropdown-item command="password">⌁&nbsp;&nbsp;{{ t('settings.changePassword') }}</el-dropdown-item>
            <el-dropdown-item command="chatStorage">▤&nbsp;&nbsp;{{ t('account.chatStorage') }}</el-dropdown-item>
            <el-dropdown-item command="blacklist">⊘&nbsp;&nbsp;{{ t('account.blacklist') }}</el-dropdown-item>
            <el-dropdown-item command="myQr">▦&nbsp;&nbsp;{{ t('account.myQrCode') }}</el-dropdown-item>
            <el-dropdown-item command="settings" divided>⌘&nbsp;&nbsp;{{ t('nav.settings') }}</el-dropdown-item>
            <el-dropdown-item command="logout" divided>↪&nbsp;&nbsp;{{ t('nav.logout') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </aside>
    <template v-if="ui.activeTab === 'chat'">
      <ConversationList />
      <ChatPanel />
    </template>
    <ContactsPanel v-else-if="ui.activeTab === 'contacts'" />
    <SecretChatPanel v-else-if="ui.activeTab === 'secret' && remoteConfig.secretChatEnabled" />
    <ChannelPanel v-else-if="ui.activeTab === 'channel'" />
    <!-- <ServicePanel v-else-if="ui.activeTab === 'services'" /> -->
    <ProfileView v-else-if="ui.activeTab === 'profile'" />
    <ChangePasswordView v-else-if="ui.activeTab === 'password'" />
    <ChatStorageView v-else-if="ui.activeTab === 'chatStorage'" />
    <BlacklistView v-else-if="ui.activeTab === 'blacklist'" />
    <MyQrView v-else-if="ui.activeTab === 'myQr'" />
    <SettingsView v-else-if="ui.activeTab === 'settings'" />
    <CallOverlay />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessageBox, ElNotification } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { useCallStore } from '../stores/call'
import { useContactStore } from '../stores/contact'
import { useGroupStore } from '../stores/group'
import { useUiStore } from '../stores/ui'
import { useRemoteConfigStore } from '../stores/remoteConfig'
import ConversationList from '../components/ConversationList.vue'
import ChatPanel from '../components/ChatPanel.vue'
import ContactsPanel from '../components/ContactsPanel.vue'
import SecretChatPanel from '../components/SecretChatPanel.vue'
import ChannelPanel from '../components/ChannelPanel.vue'
// import ServicePanel from '../components/ServicePanel.vue'
import CallOverlay from '../components/CallOverlay.vue'
import UserAvatar from '../components/UserAvatar.vue'
import BlacklistView from './BlacklistView.vue'
import ChangePasswordView from './ChangePasswordView.vue'
import ChatStorageView from './ChatStorageView.vue'
import MyQrView from './MyQrView.vue'
import ProfileView from './ProfileView.vue'
import SettingsView from './SettingsView.vue'
import type { MainTab } from '../stores/ui'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const chat = useChatStore()
const call = useCallStore()
const contact = useContactStore()
const group = useGroupStore()
const ui = useUiStore()
const remoteConfig = useRemoteConfigStore()
const initial = computed(() => (auth.displayName || 'G').slice(0, 1).toUpperCase())
const accountPageActive = computed(() =>
  ['profile', 'password', 'chatStorage', 'blacklist', 'myQr', 'settings'].includes(ui.activeTab)
)

watch(
  () => contact.friendNotification,
  (notification) => {
    if (!notification) return
    if (notification.kind === 'request') {
      ElNotification({
        title: t('contacts.requestNotificationTitle'),
        message: t('contacts.requestNotificationBody', {
          id: notification.fromUserId || '-'
        }),
        type: 'info',
        duration: 5000
      })
    } else {
      ElNotification({
        title: t('contacts.acceptNotificationTitle'),
        message: t('contacts.acceptNotificationBody', {
          id: notification.friendId || '-'
        }),
        type: 'success',
        duration: 5000
      })
    }
  },
  { deep: false }
)

onMounted(async () => {
  await remoteConfig.refresh()
  if (!remoteConfig.secretChatEnabled && ui.activeTab === 'secret') ui.activeTab = 'chat'
  try {
    await auth.ensureRealtimeConnected()
  } catch (error) {
    console.warn('realtime connection failed; continuing with cached/HTTP chat', error)
  }
  chat.bindWs()
  group.bindWs()
  call.bindWs()
  contact.bindWs()
  await chat.loadConversations()
  const groupsLoaded = await group.loadGroups().then(
    () => true,
    (error) => {
      console.warn('group list sync failed', error)
      return false
    }
  )
  try {
    await chat.sync()
  } catch (error) {
    console.warn('initial message sync failed', error)
  }
  if (groupsLoaded) await chat.syncGroupMetadata(group.groups)
})

async function onLogout(): Promise<void> {
  await ElMessageBox.confirm(t('nav.logoutConfirmBody'), t('nav.logoutConfirmTitle'), {
    type: 'warning',
    confirmButtonText: t('nav.logout'),
    cancelButtonText: t('common.cancel')
  })
  remoteConfig.reset()
  group.reset()
  auth.logout()
  void router.push({ name: 'login' })
}

function onAccountCommand(command: MainTab | 'logout'): void {
  if (command === 'logout') void onLogout().catch(() => undefined)
  else ui.activeTab = command
}
</script>

<style scoped>
.main {
  display: flex;
  height: 100%;
  background: #fff;
}
.nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 64px;
  padding: 12px 0;
  background: linear-gradient(180deg, #202839, #171d29);
  color: #fff;
  gap: 8px;
}
.nav > .user-avatar {
  margin-bottom: 10px;
}
.spacer {
  flex: 1;
}
.nav-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: #ddd;
  font-size: 20px;
  cursor: pointer;
}
.nav-btn.active {
  background: rgb(255 255 255 / 14%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 8%);
  color: #fff;
}
.contacts-badge {
  display: inline-flex;
  height: 40px;
}
.account-btn {
  letter-spacing: 1px;
}
</style>
