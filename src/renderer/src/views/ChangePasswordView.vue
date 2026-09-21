<template>
  <section class="account-page">
    <header>{{ t('settings.changePassword') }}</header>
    <main>
      <el-form class="form-card" label-position="top" @submit.prevent="save">
        <el-form-item :label="t('settings.currentPassword')">
          <el-input v-model="currentPassword" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-form-item :label="t('settings.newPassword')">
          <el-input v-model="newPassword" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item :label="t('account.confirmPassword')">
          <el-input v-model="confirmPassword" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-button type="primary" :loading="saving" @click="save">{{ t('settings.changePassword') }}</el-button>
      </el-form>
    </main>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../stores/settings'

const { t } = useI18n()
const settings = useSettingsStore()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)

async function save(): Promise<void> {
  if (!currentPassword.value) {
    ElMessage.warning(t('account.enterCurrentPassword'))
    return
  }
  if (newPassword.value.length < 6) {
    ElMessage.warning(t('account.passwordTooShort'))
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    ElMessage.warning(t('account.passwordMismatch'))
    return
  }
  saving.value = true
  try {
    await settings.changePassword(currentPassword.value, newPassword.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    ElMessage.success(t('account.passwordChanged'))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('common.operationFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped src="./account-page.css"></style>
