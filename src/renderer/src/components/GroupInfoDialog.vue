<template>
  <Teleport to="body">
    <Transition name="group-drawer">
      <div v-if="visible" class="group-info-layer" @click.self="visible = false">
        <aside class="group-info-drawer" role="dialog" :aria-label="t('group.infoTitle')">
          <header class="drawer-header">
            <button type="button" class="drawer-close" :title="t('common.cancel')" @click="visible = false">×</button>
            <strong>{{ info?.name || t('group.infoTitle') }}</strong>
            <span class="drawer-header-spacer" />
          </header>
          <div v-loading="loading" class="group-info-body">
      <section class="info-card members-card">
        <div class="card-heading">
          <strong>{{ t('group.membersTitle') }}</strong>
          <span>{{ t('group.memberCount', { count: group.members.length }) }}</span>
        </div>
        <div class="member-grid">
          <div
            v-for="member in displayedMembers"
            :key="member.userId"
            class="member-cell"
            role="button"
            tabindex="0"
            @click="openMemberProfile(member)"
            @keyup.enter="openMemberProfile(member)"
          >
            <UserAvatar
              :name="memberName(member)"
              :src="memberAvatar(member)"
              :uid="member.userId"
              :size="44"
            />
            <span class="member-name" :title="memberName(member)">{{ memberName(member) }}</span>
            <small v-if="normalizedRole(member.role) === 'owner'" class="owner-badge">
              {{ t('group.owner') }}
            </small>
            <small v-else-if="normalizedRole(member.role) === 'admin'" class="admin-badge">
              {{ t('group.admin') }}
            </small>
            <el-dropdown
              v-if="canManage(member)"
              trigger="click"
              placement="bottom"
              @command="(command: string) => onMemberCommand(command, member)"
            >
              <button type="button" class="member-menu" :title="t('group.manageMember')" @click.stop>•••</button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="canMute(member)" command="mute10">{{ t('group.mute10Minutes') }}</el-dropdown-item>
                  <el-dropdown-item v-if="canMute(member)" command="mute60">{{ t('group.mute1Hour') }}</el-dropdown-item>
                  <el-dropdown-item v-if="canMute(member)" command="mute1440">{{ t('group.mute1Day') }}</el-dropdown-item>
                  <el-dropdown-item v-if="canMute(member)" command="unmute">{{ t('group.unmute') }}</el-dropdown-item>
                  <el-dropdown-item v-if="canSetRole(member)" :command="normalizedRole(member.role) === 'admin' ? 'member' : 'admin'">
                    {{ normalizedRole(member.role) === 'admin' ? t('group.unsetAdmin') : t('group.setAdmin') }}
                  </el-dropdown-item>
                  <el-dropdown-item v-if="canRemove(member)" command="remove" divided>{{ t('group.remove') }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <button v-if="canInvite" type="button" class="invite-cell" @click="openInvite">
            <span class="invite-plus">＋</span>
            <span>{{ t('group.invite') }}</span>
          </button>
        </div>
        <el-button
          v-if="group.members.length > 12"
          class="show-members"
          link
          @click="showAllMembers = !showAllMembers"
        >
          {{ showAllMembers ? t('group.collapseMembers') : t('group.showAllMembers', { count: group.members.length }) }}
        </el-button>
      </section>

      <section class="info-card rows-card">
        <button type="button" class="info-row" :disabled="!canEditGroupInfo" @click="editGroupName">
          <span>{{ t('group.name') }}</span>
          <span class="row-value">{{ info?.name || t('group.unnamed') }}</span>
          <span v-if="canEditGroupInfo" class="chevron">›</span>
        </button>
        <button type="button" class="info-row" @click="openAnnouncement">
          <span>{{ t('group.announcement') }}</span>
          <span class="row-value">{{ info?.announcement || t('group.notSet') }}</span>
          <span class="chevron">›</span>
        </button>
        <label class="info-row switch-row">
          <span>{{ t('group.allowMemberInvite') }}</span>
          <el-switch
            :model-value="info?.allowMemberInvite ?? true"
            :disabled="!canEditGroupInfo || saving"
            @change="(value) => updateSetting('allowMemberInvite', Boolean(value))"
          />
        </label>
        <label class="info-row switch-row">
          <span>{{ t('group.allowMemberFriendRequest') }}</span>
          <el-switch
            :model-value="info?.allowMemberFriendRequest ?? true"
            :disabled="!isOwner || saving"
            @change="(value) => updateSetting('allowMemberFriendRequest', Boolean(value))"
          />
        </label>
        <label class="info-row switch-row">
          <span>{{ t('group.allowMemberViewAccount') }}</span>
          <el-switch
            :model-value="info?.allowMemberViewAccount ?? true"
            :disabled="!isOwner || saving"
            @change="(value) => updateSetting('allowMemberViewAccount', Boolean(value))"
          />
        </label>
      </section>

      <section class="info-card rows-card">
        <button type="button" class="info-row" @click="editMyNickname">
          <span>{{ t('group.myNickname') }}</span>
          <span class="row-value">{{ myMembership?.nickname || t('group.notSet') }}</span>
          <span class="chevron">›</span>
        </button>
      </section>

      <section class="info-card rows-card">
        <button type="button" class="info-row" @click="showHistory = true">
          <span>{{ t('group.chatHistory') }}</span>
          <span class="chevron">›</span>
        </button>
        <button
          v-if="remoteConfig.chatDeleteEnabled"
          type="button"
          class="info-row danger-row"
          @click="clearLocalHistory"
        >
          <span>{{ t('group.clearLocalHistory') }}</span>
        </button>
      </section>

      <div class="danger-actions">
        <el-button v-if="isOwner" type="danger" plain :loading="saving" @click="dissolveGroup">
          {{ t('group.dissolve') }}
        </el-button>
        <el-button type="danger" plain :loading="saving" @click="leaveGroup">
          {{ t('group.leave') }}
        </el-button>
      </div>
          </div>

    <el-dialog
      v-model="showAnnouncementEditor"
      :title="t('group.editAnnouncement')"
      width="500px"
      append-to-body
    >
      <el-input
        v-model="announcementDraft"
        type="textarea"
        :rows="7"
        maxlength="2000"
        show-word-limit
        :placeholder="t('group.announcementPlaceholder')"
      />
      <template #footer>
        <el-button @click="showAnnouncementEditor = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveAnnouncement">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showInvite" :title="t('group.invite')" width="480px" append-to-body>
      <div class="invite-list">
        <button
          v-for="friend in availableFriends"
          :key="friend.friendId"
          type="button"
          class="invite-row"
          :class="{ selected: inviteSelection.includes(String(friend.friendId)) }"
          @click="toggleInvite(String(friend.friendId))"
        >
          <el-checkbox :model-value="inviteSelection.includes(String(friend.friendId))" />
          <UserAvatar :name="friendDisplayName(friend)" :src="friendAvatar(friend)" :uid="friend.friendId" :size="38" />
          <strong>{{ friendDisplayName(friend) }}</strong>
        </button>
        <el-empty v-if="!availableFriends.length" :description="t('group.noFriendsToInvite')" />
      </div>
      <template #footer>
        <el-button @click="showInvite = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :disabled="!inviteSelection.length" :loading="saving" @click="inviteMembers">
          {{ t('group.inviteSelected', { count: inviteSelection.length }) }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showMemberProfile" :title="t('group.memberProfile')" width="430px" append-to-body>
      <div v-if="selectedMember" class="member-profile">
        <UserAvatar
          :name="memberName(selectedMember)"
          :src="memberAvatar(selectedMember)"
          :uid="selectedMember.userId"
          :size="72"
        />
        <h3>{{ memberName(selectedMember) }}</h3>
        <template v-if="canViewSelectedAccount">
          <p>{{ t('group.userAccount') }}：{{ selectedMember.username || selectedMember.userId }}</p>
          <p>{{ t('group.userId') }}：{{ selectedMember.userId }}</p>
        </template>
        <p v-else class="account-hidden">{{ t('group.accountHidden') }}</p>
        <el-button
          v-if="canAddSelectedMember"
          type="primary"
          :loading="saving"
          @click="addSelectedMember"
        >
          {{ t('group.addFriend') }}
        </el-button>
      </div>
    </el-dialog>

          <ChatHistoryDialog v-model="showHistory" :group-id="groupId" @select="selectHistoryMessage" />
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { friendAvatar, friendDisplayName } from '../models/friend'
import { groupMemberName, type GroupInfo, type GroupMember } from '../models/group'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { useContactStore } from '../stores/contact'
import { useGroupStore } from '../stores/group'
import { useRemoteConfigStore } from '../stores/remoteConfig'
import ChatHistoryDialog from './ChatHistoryDialog.vue'
import UserAvatar from './UserAvatar.vue'

const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ groupId: string }>()
const emit = defineEmits<{ selectMessage: [msgId: string] }>()
const { t } = useI18n()
const auth = useAuthStore()
const chat = useChatStore()
const contact = useContactStore()
const group = useGroupStore()
const remoteConfig = useRemoteConfigStore()
const loading = ref(false)
const saving = ref(false)
const showAllMembers = ref(false)
const showHistory = ref(false)
const showInvite = ref(false)
const inviteSelection = ref<string[]>([])
const showAnnouncementEditor = ref(false)
const announcementDraft = ref('')
const showMemberProfile = ref(false)
const selectedMember = ref<GroupMember | null>(null)

const info = computed<GroupInfo | null>(() => group.infoById[props.groupId] ?? null)
const myMembership = computed(() =>
  group.members.find((member) => String(member.userId) === String(auth.userId)) ?? null
)
const isOwner = computed(() => String(info.value?.ownerId ?? '') === String(auth.userId) || normalizedRole(myMembership.value?.role) === 'owner')
const myRole = computed(() => isOwner.value ? 'owner' : normalizedRole(myMembership.value?.role))
const canEditGroupInfo = computed(() => ['owner', 'admin'].includes(myRole.value))
const canInvite = computed(() => canEditGroupInfo.value || (info.value?.allowMemberInvite ?? true))
const displayedMembers = computed(() => showAllMembers.value ? group.members : group.members.slice(0, 12))
const availableFriends = computed(() => {
  const memberIds = new Set(group.members.map((member) => String(member.userId)))
  return contact.friends.filter((friend) => !memberIds.has(String(friend.friendId)))
})
const selectedMemberFriend = computed(() => selectedMember.value ? friendForMember(selectedMember.value) : null)
const canViewSelectedAccount = computed(() => {
  const member = selectedMember.value
  return member ? mayViewMemberAccount(member) : false
})
const canAddSelectedMember = computed(() => {
  const member = selectedMember.value
  if (!member || String(member.userId) === String(auth.userId) || selectedMemberFriend.value) return false
  return isOwner.value || (info.value?.allowMemberFriendRequest ?? true)
})

watch(visible, (open) => {
  if (open) void load()
  else {
    showHistory.value = false
    showInvite.value = false
    showAnnouncementEditor.value = false
    showMemberProfile.value = false
  }
})

async function load(): Promise<void> {
  loading.value = true
  showAllMembers.value = false
  try {
    await group.loadGroupInfo(props.groupId)
    await Promise.all([
      group.loadMembers(props.groupId),
      contact.loadFriends().catch(() => undefined)
    ])
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
}

function normalizedRole(role?: string | null): 'owner' | 'admin' | 'member' {
  const value = (role ?? '').trim().toLowerCase().replace(/[-\s]/g, '_')
  if (['owner', 'group_owner', 'creator', 'group_creator'].includes(value)) return 'owner'
  if (['admin', 'administrator', 'group_admin'].includes(value)) return 'admin'
  return 'member'
}

function roleWeight(role?: string | null): number {
  const normalized = normalizedRole(role)
  return normalized === 'owner' ? 3 : normalized === 'admin' ? 2 : 1
}
function canRemove(member: GroupMember): boolean {
  return String(member.userId) !== String(auth.userId) && roleWeight(myRole.value) > roleWeight(member.role)
}
function canMute(member: GroupMember): boolean { return canRemove(member) }
function canSetRole(member: GroupMember): boolean {
  return isOwner.value && String(member.userId) !== String(auth.userId) && normalizedRole(member.role) !== 'owner'
}
function canManage(member: GroupMember): boolean { return canRemove(member) || canMute(member) || canSetRole(member) }

function friendForMember(member: GroupMember) {
  return contact.friends.find((friend) => String(friend.friendId) === String(member.userId)) ?? null
}
function memberName(member: GroupMember): string {
  if (member.nickname?.trim()) return member.nickname.trim()
  const friend = friendForMember(member)
  if (friend) return friendDisplayName(friend)
  return mayViewMemberAccount(member)
    ? groupMemberName(member)
    : t('group.memberFallback', { id: member.userId })
}
function memberAvatar(member: GroupMember): string | null {
  const friend = friendForMember(member)
  if (friend) return friendAvatar(friend)
  return mayViewMemberAccount(member) ? member.avatar?.trim() || null : null
}
function mayViewMemberAccount(member: GroupMember): boolean {
  // 与 App 一致：本人、群主和已经是好友的成员不受群开关影响；
  // 开关关闭时，普通成员不能查看其他非好友成员的账号与真实头像。
  return String(member.userId) === String(auth.userId) ||
    isOwner.value ||
    !!friendForMember(member) ||
    (info.value?.allowMemberViewAccount ?? true)
}

async function runSaving(action: () => Promise<void>, success?: string): Promise<boolean> {
  if (saving.value) return false
  saving.value = true
  try {
    await action()
    if (success) ElMessage.success(success)
    return true
  } catch (error) {
    showError(error)
    return false
  } finally {
    saving.value = false
  }
}
function showError(error: unknown): void {
  ElMessage.error(error instanceof Error && error.message ? error.message : t('common.operationFailed'))
}

async function editGroupName(): Promise<void> {
  if (!canEditGroupInfo.value) return
  const result = await ElMessageBox.prompt(t('group.namePlaceholder'), t('group.editName'), {
    inputValue: info.value?.name ?? '',
    inputValidator: (value) => value.trim() ? true : t('group.nameRequired'),
    confirmButtonText: t('common.save'),
    cancelButtonText: t('common.cancel')
  }).catch(() => null)
  const name = result?.value.trim()
  if (!name || name === info.value?.name) return
  await runSaving(async () => {
    await group.updateGroup(props.groupId, { name })
    await chat.syncGroupMetadata(group.groups)
  }, t('group.saved'))
}

function openAnnouncement(): void {
  if (!canEditGroupInfo.value) {
    void ElMessageBox.alert(info.value?.announcement || t('group.noAnnouncement'), t('group.announcement'), {
      confirmButtonText: t('common.confirm')
    })
    return
  }
  announcementDraft.value = info.value?.announcement ?? ''
  showAnnouncementEditor.value = true
}
async function saveAnnouncement(): Promise<void> {
  const announcement = announcementDraft.value.trim()
  const ok = await runSaving(() => group.updateGroup(props.groupId, { announcement }), t('group.saved'))
  if (ok) showAnnouncementEditor.value = false
}
async function updateSetting(
  key: 'allowMemberInvite' | 'allowMemberFriendRequest' | 'allowMemberViewAccount',
  value: boolean
): Promise<void> {
  await runSaving(() => group.updateGroup(props.groupId, { [key]: value }), t('group.saved'))
}

async function editMyNickname(): Promise<void> {
  const result = await ElMessageBox.prompt(t('group.nicknamePlaceholder'), t('group.myNickname'), {
    inputValue: myMembership.value?.nickname ?? '',
    inputValidator: (value) => value.length <= 64 || t('group.nicknameTooLong'),
    confirmButtonText: t('common.save'),
    cancelButtonText: t('common.cancel')
  }).catch(() => null)
  if (!result || result.value.trim() === (myMembership.value?.nickname ?? '').trim()) return
  await runSaving(() => group.updateMyNickname(props.groupId, result.value.trim()), t('group.nicknameSaved'))
}

async function clearLocalHistory(): Promise<void> {
  const confirmed = await ElMessageBox.confirm(t('group.clearHistoryConfirm'), t('group.clearHistoryTitle'), {
    type: 'warning',
    confirmButtonText: t('group.clear'),
    cancelButtonText: t('common.cancel')
  }).then(() => true, () => false)
  if (!confirmed) return
  await runSaving(() => chat.clearConversationHistory(props.groupId, 'group'), t('group.historyCleared'))
}
async function dissolveGroup(): Promise<void> {
  const confirmed = await ElMessageBox.confirm(t('group.dissolveConfirm'), t('group.dissolve'), {
    type: 'warning',
    confirmButtonText: t('group.dissolve'),
    cancelButtonText: t('common.cancel')
  }).then(() => true, () => false)
  if (!confirmed) return
  const ok = await runSaving(async () => {
    await group.dissolveGroup(props.groupId)
    await chat.removeConversation(props.groupId, 'group')
  })
  if (ok) visible.value = false
}
async function leaveGroup(): Promise<void> {
  const confirmed = await ElMessageBox.confirm(t('group.leaveConfirm'), t('group.leave'), {
    type: 'warning',
    confirmButtonText: t('group.leave'),
    cancelButtonText: t('common.cancel')
  }).then(() => true, () => false)
  if (!confirmed) return
  const ok = await runSaving(async () => {
    await group.leaveGroup(props.groupId)
    await chat.removeConversation(props.groupId, 'group')
  })
  if (ok) visible.value = false
}

async function onMemberCommand(command: string, member: GroupMember): Promise<void> {
  if (command.startsWith('mute')) {
    const duration = Number(command.slice(4))
    await runSaving(() => group.muteMember(props.groupId, String(member.userId), duration), t('group.muted'))
  } else if (command === 'unmute') {
    await runSaving(() => group.muteMember(props.groupId, String(member.userId), 0), t('group.unmuted'))
  } else if (command === 'admin' || command === 'member') {
    await runSaving(() => group.setRole(props.groupId, String(member.userId), command), t('group.roleSaved'))
  } else if (command === 'remove') {
    const confirmed = await ElMessageBox.confirm(
      t('group.removeConfirm', { name: memberName(member) }),
      t('group.remove'),
      { type: 'warning', confirmButtonText: t('group.remove'), cancelButtonText: t('common.cancel') }
    ).then(() => true, () => false)
    if (confirmed) await runSaving(() => group.removeMember(props.groupId, String(member.userId)), t('group.removed'))
  }
}

function openMemberProfile(member: GroupMember): void {
  selectedMember.value = member
  showMemberProfile.value = true
}

async function addSelectedMember(): Promise<void> {
  const member = selectedMember.value
  if (!member) return
  const ok = await runSaving(() => contact.addFriend(String(member.userId)), t('group.friendRequestSent'))
  if (ok) showMemberProfile.value = false
}

function openInvite(): void {
  inviteSelection.value = []
  showInvite.value = true
}
function toggleInvite(userId: string): void {
  const index = inviteSelection.value.indexOf(userId)
  if (index >= 0) inviteSelection.value.splice(index, 1)
  else inviteSelection.value.push(userId)
}
async function inviteMembers(): Promise<void> {
  const ok = await runSaving(() => group.addMembers(props.groupId, inviteSelection.value), t('group.invited'))
  if (ok) showInvite.value = false
}
function selectHistoryMessage(msgId: string): void {
  showHistory.value = false
  visible.value = false
  emit('selectMessage', msgId)
}
</script>

<style scoped>
.group-info-layer { position: fixed; inset: 0; z-index: 2900; background: rgb(16 24 40 / 12%); }
.group-info-drawer { position: absolute; top: 0; right: 0; display: flex; width: clamp(320px, 32vw, 360px); height: 100%; box-sizing: border-box; flex-direction: column; overflow: hidden; border-left: 1px solid #e2e6ed; background: #f6f7f9; box-shadow: -18px 0 45px rgb(24 34 52 / 16%); }
.drawer-header { display: grid; flex: 0 0 58px; grid-template-columns: 44px minmax(0, 1fr) 132px; align-items: center; padding: 8px 12px; border-bottom: 1px solid #e5e8ed; background: rgb(255 255 255 / 96%); }
.drawer-header strong { overflow: hidden; color: #252e3e; font-size: 16px; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.drawer-close { display: grid; width: 34px; height: 34px; place-items: center; border: 0; border-radius: 10px; background: transparent; color: #697386; cursor: pointer; font-size: 25px; font-weight: 300; line-height: 1; }
.drawer-close:hover { background: #eef0f4; color: #323b4b; }
.drawer-header-spacer { width: 132px; }
.group-info-body { display: flex; min-height: 0; flex: 1 1 auto; box-sizing: border-box; flex-direction: column; gap: 14px; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: 16px 14px 28px; scrollbar-gutter: stable; }
.group-info-body > * { flex: 0 0 auto; }
.group-drawer-enter-active, .group-drawer-leave-active { transition: background-color 240ms ease; }
.group-drawer-enter-active .group-info-drawer, .group-drawer-leave-active .group-info-drawer { transition: transform 280ms cubic-bezier(.22, 1, .36, 1), box-shadow 280ms ease; }
.group-drawer-enter-from, .group-drawer-leave-to { background: transparent; }
.group-drawer-enter-from .group-info-drawer, .group-drawer-leave-to .group-info-drawer { transform: translateX(100%); box-shadow: none; }
.info-card { border: 1px solid #e7eaf0; border-radius: 15px; background: #fff; box-shadow: 0 2px 9px rgb(25 34 50 / 4%); }
.members-card { padding: 15px; }
.card-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.card-heading strong { color: #293142; font-size: 15px; }
.card-heading span { color: #9299a7; font-size: 12px; }
.member-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px 10px; }
.member-cell, .invite-cell { position: relative; display: flex; min-width: 0; align-items: center; flex-direction: column; gap: 5px; }
.member-cell { border-radius: 10px; cursor: pointer; outline: none; }
.member-cell:hover, .member-cell:focus-visible { background: #f6f7fa; }
.member-name { width: 100%; overflow: hidden; color: #485062; font-size: 12px; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.owner-badge, .admin-badge { padding: 1px 5px; border-radius: 7px; font-size: 9px; }
.owner-badge { background: #fff0ca; color: #a46b00; }
.admin-badge { background: #edf1ff; color: #536bd1; }
.member-menu { position: absolute; top: -4px; right: 1px; width: 25px; height: 20px; border: 0; border-radius: 9px; background: rgb(255 255 255 / 92%); color: #7a8495; cursor: pointer; line-height: 12px; }
.invite-cell { border: 0; background: transparent; color: #657083; cursor: pointer; font-size: 12px; }
.invite-plus { display: grid; width: 44px; height: 44px; place-items: center; border: 1px dashed #b9c1ce; border-radius: 13px; background: #f7f8fb; color: #5969c7; font-size: 26px; font-weight: 300; }
.show-members { display: block; margin: 12px auto -5px; }
.rows-card { overflow: hidden; }
.info-row { display: flex; width: 100%; min-height: 52px; box-sizing: border-box; align-items: center; gap: 12px; padding: 12px 16px; border: 0; border-bottom: 1px solid #edf0f4; background: #fff; color: #303849; cursor: pointer; font-size: 14px; text-align: left; }
.info-row:last-child { border-bottom: 0; }
button.info-row:not(:disabled):hover { background: #f8f9fb; }
button.info-row:disabled { cursor: default; }
.row-value { min-width: 0; flex: 1; overflow: hidden; color: #9299a7; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.chevron { color: #b1b7c1; font-size: 22px; line-height: 1; }
.switch-row { justify-content: space-between; cursor: default; }
.switch-row > span:first-child { min-width: 0; flex: 1 1 auto; padding-right: 6px; line-height: 1.45; }
.switch-row :deep(.el-switch) { flex: 0 0 auto; margin-left: auto; }
.danger-row { color: #e14b50; }
.danger-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
.invite-list { max-height: 390px; overflow-y: auto; border: 1px solid #e7eaf0; border-radius: 13px; }
.invite-row { display: flex; width: 100%; align-items: center; gap: 10px; padding: 9px 12px; border: 0; border-bottom: 1px solid #edf0f4; background: #fff; color: #364052; cursor: pointer; text-align: left; }
.invite-row:last-child { border-bottom: 0; }
.invite-row.selected { background: #f0f3ff; }
.invite-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.member-profile { display: flex; align-items: center; flex-direction: column; padding: 8px 10px 12px; text-align: center; }
.member-profile h3 { margin: 12px 0 8px; color: #2e3748; }
.member-profile p { margin: 3px 0; color: #7f8897; font-size: 13px; }
.member-profile .el-button { width: 100%; margin-top: 18px; }
.account-hidden { padding: 12px; border-radius: 10px; background: #f5f6f8; }
@media (max-width: 720px) {
  .group-info-drawer { width: min(320px, calc(100vw - 32px)); }
}
@media (prefers-reduced-motion: reduce) {
  .group-drawer-enter-active, .group-drawer-leave-active,
  .group-drawer-enter-active .group-info-drawer, .group-drawer-leave-active .group-info-drawer { transition-duration: 1ms; }
}
</style>
