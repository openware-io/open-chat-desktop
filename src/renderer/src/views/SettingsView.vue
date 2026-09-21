<template>
  <section class="account-page">
    <header>{{ t('settings.title') }}</header>
    <main>
      <el-form class="form-card" label-position="left" label-width="180px">
        <h3>{{ t('settings.notifications') }}</h3>
        <el-form-item :label="t('settings.notifyPrivate')"><el-switch v-model="notif.notifyPrivate" /></el-form-item>
        <el-form-item :label="t('settings.notifyGroup')"><el-switch v-model="notif.notifyGroup" /></el-form-item>
        <el-form-item :label="t('settings.notifyChannel')"><el-switch v-model="notif.notifyChannel" /></el-form-item>
        <el-button type="primary" @click="saveNotifications">{{ t('settings.saveNotifications') }}</el-button>

        <el-divider />
        <h3>{{ t('settings.privacy') }}</h3>
        <el-form-item :label="t('settings.allowGroupFriendRequest')">
          <el-switch v-model="privacy.allowGroupFriendRequest" />
        </el-form-item>
        <el-button type="primary" @click="savePrivacy">{{ t('settings.savePrivacy') }}</el-button>

        <el-divider />
        <h3>{{ t('settings.language') }}</h3>
        <el-select :model-value="localeStore.locale" style="width: 180px" @change="onLocaleChange">
          <el-option :label="t('settings.languageZh')" value="zh-CN" />
          <el-option :label="t('settings.languageEn')" value="en" />
        </el-select>
      </el-form>
    </main>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useLocaleStore } from '../stores/locale'
import { useSettingsStore } from '../stores/settings'

const { t } = useI18n()
const settings = useSettingsStore()
const localeStore = useLocaleStore()
const notif = reactive({ notifyPrivate: true, notifyGroup: true, notifyChannel: true })
const privacy = reactive({ allowGroupFriendRequest: true })

onMounted(async () => {
  await settings.load()
  if (settings.notif) Object.assign(notif, settings.notif)
  if (settings.privacy) privacy.allowGroupFriendRequest = settings.privacy.allowGroupFriendRequest
})

function onLocaleChange(value: unknown): void {
  localeStore.set(value === 'en' ? 'en' : 'zh-CN')
}

async function saveNotifications(): Promise<void> {
  try {
    await settings.updateNotif({ ...notif })
    ElMessage.success(t('settings.saved'))
  } catch {
    ElMessage.error(t('common.operationFailed'))
  }
}

async function savePrivacy(): Promise<void> {
  try {
    await settings.updatePrivacy({ allowGroupFriendRequest: privacy.allowGroupFriendRequest })
    ElMessage.success(t('settings.saved'))
  } catch {
    ElMessage.error(t('common.operationFailed'))
  }
}
</script>

<style scoped src="./account-page.css"></style>
<style scoped>
h3 { margin: 0 0 18px; color: #586276; font-size: 14px; }
</style>
