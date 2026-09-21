<template>
  <section class="account-page">
    <header>{{ t('account.profile') }}</header>
    <main>
      <el-form class="form-card" label-position="top">
        <div class="avatar-editor">
          <button type="button" :disabled="saving" @click="avatarInput?.click()">
            <UserAvatar :name="nickname || username" :src="avatarPreview || profileAvatar" :uid="auth.userId" :size="88" />
            <span>{{ t('account.changeAvatar') }}</span>
          </button>
          <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatarSelected" />
        </div>
        <el-form-item :label="t('settings.username')">
          <el-input v-model="username" disabled />
        </el-form-item>
        <el-form-item :label="t('settings.nickname')">
          <el-input v-model="nickname" maxlength="40" show-word-limit />
        </el-form-item>
        <el-form-item :label="t('account.phone')">
          <el-input v-model="phone" />
        </el-form-item>
        <el-form-item :label="t('account.email')">
          <el-input v-model="email" type="email" />
        </el-form-item>
        <el-form-item :label="t('settings.signature')">
          <el-input v-model="signature" type="textarea" :rows="3" maxlength="160" show-word-limit />
        </el-form-item>
        <el-button type="primary" :loading="saving" @click="save">{{ t('settings.saveProfile') }}</el-button>
      </el-form>
    </main>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { uploadMedia } from '../services/media/upload'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'
import UserAvatar from '../components/UserAvatar.vue'

const { t } = useI18n()
const auth = useAuthStore()
const settings = useSettingsStore()
const username = ref('')
const nickname = ref('')
const phone = ref('')
const email = ref('')
const signature = ref('')
const profileAvatar = ref<string | null>(null)
const avatarFile = ref<File | null>(null)
const avatarPreview = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const saving = ref(false)

onMounted(async () => {
  await settings.load()
  const profile = settings.profile
  username.value = profile?.username ?? auth.user?.username ?? ''
  nickname.value = profile?.nickname ?? auth.user?.nickname ?? ''
  phone.value = profile?.phone ?? ''
  email.value = profile?.email ?? ''
  signature.value = profile?.signature ?? auth.user?.signature ?? ''
  profileAvatar.value = profile?.avatar ?? auth.user?.avatar ?? null
})

onBeforeUnmount(clearPreview)

function clearPreview(): void {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarPreview.value = ''
}

function onAvatarSelected(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning(t('account.avatarImageOnly'))
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning(t('account.avatarTooLarge'))
    return
  }
  clearPreview()
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

async function save(): Promise<void> {
  if (!nickname.value.trim()) {
    ElMessage.warning(t('account.nicknameRequired'))
    return
  }
  saving.value = true
  try {
    let avatarObjectId: string | undefined
    if (avatarFile.value) {
      avatarObjectId = (await uploadMedia(avatarFile.value, { scope: 'avatar' })).objectId
    }
    const profile = await settings.updateProfile({
      nickname: nickname.value.trim(),
      phone: phone.value.trim() || null,
      email: email.value.trim() || null,
      signature: signature.value.trim(),
      ...(avatarObjectId ? { avatar: avatarObjectId } : {})
    })
    auth.updateUser({
      id: String(profile.id),
      username: profile.username,
      nickname: profile.nickname,
      avatar: profile.avatar,
      signature: profile.signature,
      email: profile.email,
      phone: profile.phone
    })
    profileAvatar.value = profile.avatar ?? profileAvatar.value
    avatarFile.value = null
    clearPreview()
    ElMessage.success(t('account.profileSaved'))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('common.operationFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped src="./account-page.css"></style>
<style scoped>
.avatar-editor {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}
.avatar-editor button {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 9px;
  border: 0;
  background: transparent;
  color: #5f73d5;
  cursor: pointer;
}
</style>
