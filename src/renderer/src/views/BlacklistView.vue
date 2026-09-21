<template>
  <section class="account-page">
    <header>{{ t('account.blacklist') }}</header>
    <main>
      <div v-if="loading" class="empty-state">{{ t('common.loading') }}</div>
      <div v-else-if="!contact.blocked.length" class="empty-state">{{ t('account.blacklistEmpty') }}</div>
      <div v-else class="list-card">
        <div v-for="friend in contact.blocked" :key="friend.friendId" class="person-row">
          <UserAvatar :name="friendDisplayName(friend)" :src="friendAvatar(friend)" :uid="friend.friendId" :size="44" />
          <span><strong>{{ friendDisplayName(friend) }}</strong><small>{{ friendUsername(friend) }}</small></span>
          <el-button @click="unblock(friend.friendId)">{{ t('contacts.unblock') }}</el-button>
        </div>
      </div>
    </main>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { friendAvatar, friendDisplayName, friendUsername } from '../models/friend'
import { useContactStore } from '../stores/contact'
import UserAvatar from '../components/UserAvatar.vue'

const { t } = useI18n()
const contact = useContactStore()
const loading = ref(true)

onMounted(async () => {
  try {
    await contact.loadBlocked()
  } catch {
    ElMessage.error(t('common.operationFailed'))
  } finally {
    loading.value = false
  }
})

async function unblock(friendId: number): Promise<void> {
  try {
    await ElMessageBox.confirm(t('account.unblockConfirm'), t('contacts.unblock'), {
      confirmButtonText: t('contacts.unblock'), cancelButtonText: t('common.cancel')
    })
    await contact.unblock(friendId)
    ElMessage.success(t('account.unblocked'))
  } catch {
    // Cancellation requires no feedback.
  }
}
</script>

<style scoped src="./account-page.css"></style>
