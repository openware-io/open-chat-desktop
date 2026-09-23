<template>
  <section class="account-page">
    <header>{{ t('account.myQrCode') }}</header>
    <main class="qr-main">
      <div class="qr-card">
        <div class="qr-image-wrap">
          <img v-if="qrDataUrl" :src="qrDataUrl" :alt="t('account.myQrCode')" />
          <UserAvatar class="qr-avatar" :name="auth.displayName" :src="auth.user?.avatar" :uid="auth.userId" :size="52" />
        </div>
        <strong>{{ auth.displayName }}</strong>
        <small>{{ auth.user?.username }}</small>
        <p>{{ t('account.qrHint') }}</p>
        <el-button type="primary" :disabled="!qrDataUrl" @click="download">{{ t('account.saveQr') }}</el-button>
      </div>
    </main>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import { useAuthStore } from '../stores/auth'
import UserAvatar from '../components/UserAvatar.vue'

const { t } = useI18n()
const auth = useAuthStore()
const qrDataUrl = ref('')

onMounted(async () => {
  qrDataUrl.value = await QRCode.toDataURL('GV_UID:' + (auth.user?.username ?? '').trim(), {
    width: 260,
    margin: 2,
    errorCorrectionLevel: 'H'
  })
})

function download(): void {
  const link = document.createElement('a')
  link.href = qrDataUrl.value
  link.download = `open-chat-${auth.user?.username || 'user'}-qr.png`
  link.click()
}
</script>

<style scoped src="./account-page.css"></style>
<style scoped>
.qr-main { display: grid; place-items: start center; }
.qr-card { width: 340px; padding: 28px; border: 1px solid #e8ebf0; border-radius: 18px; background: #fff; box-shadow: 0 12px 34px rgb(36 46 65 / 8%); text-align: center; }
.qr-image-wrap { position: relative; width: 260px; height: 260px; margin: 0 auto 14px; }
.qr-image-wrap > img { width: 100%; height: 100%; border-radius: 12px; }
.qr-avatar { position: absolute; top: 50%; left: 50%; padding: 3px; background: #fff; transform: translate(-50%, -50%); }
.qr-card > strong, .qr-card > small { display: block; }
.qr-card > strong { color: #2f3849; font-size: 17px; }
.qr-card > small, .qr-card > p { color: #929baa; }
.qr-card > p { margin: 15px 0; font-size: 12px; }
</style>
