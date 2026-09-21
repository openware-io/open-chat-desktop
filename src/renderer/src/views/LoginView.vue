<template>
  <main class="login-page">
    <section class="login-shell">
      <aside class="brand-panel">
        <div class="brand-logo">
          <img class="brand-logo-image" src="../assets/wv-chat-icon.png" alt="" />
          <span>{{ t('login.title') }}</span>
        </div>

        <div class="brand-copy">
          <div class="brand-kicker">{{ t('login.brandKicker') }}</div>
          <h1>{{ t('login.brandTitleLine1') }}<br />{{ t('login.brandTitleLine2') }}</h1>
          <p>{{ t('login.brandSubtitle') }}</p>
        </div>

        <div class="brand-presence">
          <div class="avatar-stack" aria-hidden="true">
            <span>林</span><span>M</span><span>乔</span>
          </div>
          <small>{{ t('login.brandPresence') }}</small>
        </div>
      </aside>

      <section class="auth-panel">
        <button
          type="button"
          class="locale-switch"
          :aria-label="t('login.switchLanguage')"
          @click="toggleLocale"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
          </svg>
          <span>{{ locale.locale === 'zh-CN' ? '简体中文' : 'English' }}</span>
        </button>

        <div class="auth-content">
          <header class="welcome-copy">
            <h2>{{ t('login.welcome') }}</h2>
            <p>{{ t('login.welcomeSubtitle') }}</p>
          </header>

          <div class="login-tabs" :class="{ qr: mode === 'qr' }" role="tablist">
            <button
              type="button"
              role="tab"
              :aria-selected="mode === 'password'"
              :class="{ active: mode === 'password' }"
              @click="switchPassword"
            >
              {{ t('login.passwordLogin') }}
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="mode === 'qr'"
              :class="{ active: mode === 'qr' }"
              @click="switchQr"
            >
              {{ t('login.qrLogin') }}
            </button>
            <span class="tab-indicator" aria-hidden="true" />
          </div>

          <form v-if="mode === 'password'" class="password-form" @submit.prevent="onSubmit">
            <label class="field">
              <span>{{ t('login.usernameLabel') }}</span>
              <span class="input-shell">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
                </svg>
                <input
                  v-model="username"
                  type="text"
                  autocomplete="username"
                  :placeholder="t('login.usernamePlaceholder')"
                />
              </span>
            </label>

            <label class="field">
              <span>{{ t('login.passwordLabel') }}</span>
              <span class="input-shell">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="3" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  :placeholder="t('login.passwordPlaceholder')"
                />
                <button
                  type="button"
                  class="reveal-password"
                  :aria-label="showPassword ? t('login.hidePassword') : t('login.showPassword')"
                  @click="showPassword = !showPassword"
                >
                  <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.8 10.8 0 0 1 12 4c5.4 0 9 6 9 6a16.8 16.8 0 0 1-2.2 2.8M6.6 6.6C4.3 8.1 3 10 3 10s3.6 6 9 6a9.7 9.7 0 0 0 3.4-.6" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 12s3.6-6 9-6 9 6 9 6-3.6 6-9 6-9-6-9-6Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                </button>
              </span>
            </label>

            <div class="form-meta">
              <label class="remember-option">
                <input v-model="rememberMe" type="checkbox" />
                <span>{{ t('login.rememberMe') }}</span>
              </label>
              <button type="button" class="text-action" @click="showForgot = true">
                {{ t('login.forgotPassword') }}
              </button>
            </div>

            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
            <button type="submit" class="login-submit" :disabled="loading">
              <span v-if="loading" class="button-spinner" aria-hidden="true" />
              <span>{{ loading ? t('common.loading') : t('login.submit') }}</span>
            </button>
            <p class="register-prompt">
              {{ t('login.noAccount') }}
              <button type="button" class="text-action" @click="showRegister = true">
                {{ t('login.registerNow') }}
              </button>
            </p>
          </form>

          <section v-else class="qr-login" aria-live="polite">
            <div class="qr-frame">
              <img
                v-if="qr.status === 'pending' && qr.qrDataUrl"
                :src="qr.qrDataUrl"
                :alt="t('login.qrAlt')"
              />
              <div v-else-if="qr.status === 'confirmed'" class="qr-state success-state">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
              </div>
              <div v-else-if="qr.status === 'expired'" class="qr-state">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M20 20v-6h-6M5.5 18.5A9 9 0 0 0 20 12M18.5 5.5A9 9 0 0 0 4 12" /></svg>
              </div>
              <div v-else-if="qr.status === 'error'" class="qr-state error-state">!</div>
              <div v-else class="qr-state"><span class="qr-spinner" aria-hidden="true" /></div>
            </div>
            <h3>{{ qrTitle }}</h3>
            <p :class="{ 'form-error': qr.status === 'error' }">{{ qrDescription }}</p>
            <button
              v-if="qr.status === 'expired' || qr.status === 'error'"
              type="button"
              class="qr-retry"
              @click="qr.start()"
            >
              {{ qr.status === 'expired' ? t('login.qrRefresh') : t('login.retry') }}
            </button>
            <span v-else-if="qr.status === 'pending'" class="qr-waiting">
              {{ t('login.qrWaiting') }}
            </span>
          </section>
        </div>
      </section>
    </section>

    <el-dialog v-model="showRegister" :title="t('login.registerTitle')" width="400px">
      <el-form @submit.prevent="onRegister">
        <el-form-item><el-input v-model="reg.username" :placeholder="t('login.usernamePlaceholder')" /></el-form-item>
        <el-form-item><el-input v-model="reg.password" type="password" show-password :placeholder="t('login.passwordPlaceholder')" /></el-form-item>
        <el-form-item><el-input v-model="reg.email" :placeholder="t('login.emailPlaceholder')" /></el-form-item>
        <el-form-item><el-input v-model="reg.nickname" :placeholder="t('login.nicknamePlaceholder')" /></el-form-item>
        <el-button type="primary" native-type="submit" :loading="regLoading" class="dialog-submit">
          {{ t('login.registerAndLogin') }}
        </el-button>
        <div v-if="regError" class="dialog-message error-message">{{ regError }}</div>
      </el-form>
    </el-dialog>

    <el-dialog v-model="showForgot" :title="t('login.forgotTitle')" width="400px">
      <el-form @submit.prevent="onForgot">
        <el-form-item><el-input v-model="forgotEmail" :placeholder="t('login.registeredEmailPlaceholder')" /></el-form-item>
        <el-button type="primary" native-type="submit" :loading="forgotLoading" class="dialog-submit">
          {{ t('login.sendResetEmail') }}
        </el-button>
        <div v-if="forgotMsg" class="dialog-message">{{ forgotMsg }}</div>
        <el-divider />
        <el-form-item><el-input v-model="resetToken" :placeholder="t('login.resetTokenPlaceholder')" /></el-form-item>
        <el-form-item><el-input v-model="resetPwd" type="password" show-password :placeholder="t('login.newPasswordPlaceholder')" /></el-form-item>
        <el-button type="primary" class="dialog-submit" :loading="resetLoading" @click="onReset">
          {{ t('login.resetPassword') }}
        </el-button>
      </el-form>
    </el-dialog>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useLocaleStore } from '../stores/locale'
import { useQrLoginStore } from '../stores/qrLogin'
import * as authApi from '../services/api/auth'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const locale = useLocaleStore()
const qr = useQrLoginStore()
const mode = ref<'password' | 'qr'>('password')
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const rememberMe = ref(true)
const loading = ref(false)
const error = ref('')
const showRegister = ref(false)
const showForgot = ref(false)
const reg = reactive({ username: '', password: '', email: '', nickname: '' })
const regLoading = ref(false)
const regError = ref('')
const forgotEmail = ref('')
const forgotLoading = ref(false)
const forgotMsg = ref('')
const resetToken = ref('')
const resetPwd = ref('')
const resetLoading = ref(false)

const qrTitle = computed(() => {
  if (qr.status === 'confirmed') return t('login.qrConfirmedTitle')
  if (qr.status === 'expired') return t('login.qrExpired')
  if (qr.status === 'error') return t('login.qrFailed')
  return t('login.qrScanTitle')
})

const qrDescription = computed(() => {
  if (qr.status === 'confirmed') return t('login.qrConfirmed')
  if (qr.status === 'expired') return t('login.qrExpiredHint')
  if (qr.status === 'error') return qr.errorMsg || t('login.qrFailed')
  return t('login.qrHint')
})

watch(
  () => qr.status,
  (status) => {
    if (status === 'confirmed') void router.push({ name: 'main' })
  }
)

onBeforeUnmount(() => qr.stopPolling())

function toggleLocale(): void {
  locale.set(locale.locale === 'zh-CN' ? 'en' : 'zh-CN')
}

function switchPassword(): void {
  if (mode.value === 'password') return
  mode.value = 'password'
  qr.reset()
}

function switchQr(): void {
  if (mode.value === 'qr' && qr.status === 'pending') return
  mode.value = 'qr'
  void qr.start()
}

async function onSubmit(): Promise<void> {
  error.value = ''
  loading.value = true
  try {
    await auth.login(username.value, password.value, rememberMe.value)
    await router.push({ name: 'main' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('login.loginFailed')
  } finally {
    loading.value = false
  }
}

async function onRegister(): Promise<void> {
  regError.value = ''
  regLoading.value = true
  try {
    const res = await authApi.register({ ...reg })
    auth.setSession(res.access_token, res.user as never)
    await router.push({ name: 'main' })
  } catch (e) {
    regError.value = e instanceof Error ? e.message : t('login.registerFailed')
  } finally {
    regLoading.value = false
  }
}

async function onForgot(): Promise<void> {
  if (!forgotEmail.value.trim()) return
  forgotLoading.value = true
  forgotMsg.value = ''
  try {
    await authApi.forgotPassword(forgotEmail.value.trim())
    forgotMsg.value = t('login.resetEmailSent')
  } catch (e) {
    forgotMsg.value = e instanceof Error ? e.message : t('login.sendFailed')
  } finally {
    forgotLoading.value = false
  }
}

async function onReset(): Promise<void> {
  if (!resetToken.value.trim() || !resetPwd.value) return
  resetLoading.value = true
  try {
    await authApi.resetPassword(resetToken.value.trim(), resetPwd.value)
    forgotMsg.value = t('login.passwordReset')
  } catch (e) {
    forgotMsg.value = e instanceof Error ? e.message : t('login.resetFailed')
  } finally {
    resetLoading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  min-width: 0;
  height: 100%;
  min-height: 100%;
  align-items: stretch;
  justify-content: stretch;
  overflow: auto;
  box-sizing: border-box;
  padding: 0;
  background: #fbfcff;
  color: #182033;
}
.login-shell {
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 560px;
  grid-template-columns: minmax(330px, 0.92fr) minmax(420px, 1.08fr);
  overflow: hidden;
  border-radius: 0;
  background: #fbfcff;
  box-shadow: none;
}
.brand-panel {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  padding: clamp(30px, 4vw, 46px);
  background: radial-gradient(circle at 16% 20%, rgb(121 158 255 / 42%), transparent 32%), radial-gradient(circle at 86% 76%, rgb(136 92 246 / 32%), transparent 34%), linear-gradient(145deg, #19294c 0%, #182039 46%, #111725 100%);
  color: #f7f9ff;
}
.brand-panel::before,
.brand-panel::after {
  position: absolute;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 50%;
  content: '';
}
.brand-panel::before { top: -110px; right: -150px; width: 390px; height: 390px; }
.brand-panel::after { right: 24px; bottom: 52px; width: 190px; height: 190px; }
.brand-logo,
.brand-copy,
.brand-presence { position: relative; z-index: 1; }
.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 17px;
  font-weight: 600;
}
.brand-logo-image {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 11px;
  object-fit: cover;
  box-shadow: 0 8px 18px rgb(0 0 0 / 18%);
}
.brand-copy { margin: auto 0; padding: 48px 0; }
.brand-kicker {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 20px;
  color: #b8c8ef;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.brand-kicker::before { width: 24px; height: 1px; background: #8eabf7; content: ''; }
.brand-copy h1 {
  margin: 0 0 18px;
  font-size: clamp(34px, 4vw, 50px);
  font-weight: 600;
  letter-spacing: -0.045em;
  line-height: 1.14;
}
.brand-copy p { max-width: 340px; margin: 0; color: #b8c3da; font-size: 15px; line-height: 1.75; }
.brand-presence { display: flex; align-items: center; gap: 11px; color: #aeb9d0; }
.avatar-stack { display: flex; padding-left: 7px; }
.avatar-stack span {
  display: grid;
  width: 28px;
  height: 28px;
  margin-left: -7px;
  place-items: center;
  border: 2px solid #182039;
  border-radius: 50%;
  color: #fff;
  font-size: 9px;
}
.avatar-stack span:nth-child(1) { background: #5878db; }
.avatar-stack span:nth-child(2) { background: #9b6bd6; }
.avatar-stack span:nth-child(3) { background: #3c9a91; }
.auth-panel {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  padding: clamp(46px, 6vw, 72px);
  background: #fbfcff;
}
.locale-switch {
  position: absolute;
  top: 40px;
  right: 24px;
  z-index: 5001;
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 7px;
  border: 0;
  padding: 0 8px;
  background: transparent;
  color: #7a8498;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  -webkit-app-region: no-drag;
}
.locale-switch svg,
.input-shell > svg,
.reveal-password svg,
.qr-state svg {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}
.locale-switch svg { width: 16px; height: 16px; }
.auth-content { width: min(100%, 382px); }
.welcome-copy { margin-bottom: 30px; }
.welcome-copy h2 { margin: 0 0 9px; color: #151c2d; font-size: 30px; font-weight: 600; letter-spacing: -0.035em; }
.welcome-copy p { margin: 0; color: #7a8496; font-size: 14px; line-height: 1.6; }
.login-tabs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 28px;
  border-bottom: 1px solid #e5e9f2;
}
.login-tabs button {
  min-height: 44px;
  border: 0;
  background: transparent;
  color: #8992a4;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
}
.login-tabs button.active { color: #315dc3; font-weight: 600; }
.tab-indicator {
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 50%;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: #4f73d2;
  transition: transform 220ms ease;
}
.login-tabs.qr .tab-indicator { transform: translateX(100%); }
.field { display: block; margin-bottom: 17px; }
.field > span:first-child { display: block; margin-bottom: 8px; color: #465066; font-size: 13px; font-weight: 600; }
.input-shell {
  display: flex;
  min-height: 50px;
  align-items: center;
  border: 1px solid #dde3ee;
  border-radius: 12px;
  background: #fff;
  color: #8c95a7;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.input-shell:focus-within { border-color: #6e8dde; box-shadow: 0 0 0 3px rgb(91 124 250 / 11%); }
.input-shell > svg { width: 18px; height: 18px; flex: 0 0 18px; margin-left: 15px; }
.input-shell input {
  width: 100%;
  min-width: 0;
  height: 48px;
  border: 0;
  outline: 0;
  padding: 0 13px;
  background: transparent;
  color: #1d2638;
  font: inherit;
  font-size: 15px;
}
.input-shell input::placeholder { color: #a8b0bf; }
.reveal-password {
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  place-items: center;
  border: 0;
  background: transparent;
  color: #8b95a7;
  cursor: pointer;
}
.reveal-password svg { width: 18px; height: 18px; }
.form-meta { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 24px; color: #707b90; font-size: 13px; }
.remember-option { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.remember-option input { width: 15px; height: 15px; accent-color: #587ce0; }
.text-action { border: 0; padding: 0; background: transparent; color: #4569c3; cursor: pointer; font: inherit; font-size: inherit; }
.form-error { margin: -10px 0 16px; color: #d64d5b !important; font-size: 13px; line-height: 1.5; text-align: center; }
.login-submit {
  display: flex;
  width: 100%;
  min-height: 50px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #4e73d6, #6c64d9);
  box-shadow: 0 12px 28px rgb(73 96 188 / 24%);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
}
.login-submit:hover:not(:disabled) { filter: brightness(1.05); }
.login-submit:disabled { cursor: wait; opacity: 0.72; }
.button-spinner,
.qr-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgb(255 255 255 / 35%);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: login-spin 800ms linear infinite;
}
.register-prompt { margin: 23px 0 0; color: #7c8699; font-size: 13px; text-align: center; }
.qr-login { text-align: center; }
.qr-frame {
  display: inline-grid;
  width: 216px;
  height: 216px;
  place-items: center;
  margin: 0 auto 20px;
  border: 1px solid #e3e7ef;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 15px 40px rgb(45 57 88 / 10%);
}
.qr-frame img { width: 184px; height: 184px; }
.qr-state {
  display: grid;
  width: 74px;
  height: 74px;
  place-items: center;
  border-radius: 50%;
  background: #eef2fb;
  color: #5878cf;
  font-size: 30px;
  font-weight: 600;
}
.qr-state svg { width: 36px; height: 36px; stroke-width: 2; }
.success-state { background: #e8f8ef; color: #28a762; }
.error-state { background: #fff0f1; color: #d64d5b; }
.qr-login h3 { margin: 0 0 8px; color: #20283a; font-size: 17px; font-weight: 600; }
.qr-login > p { margin: 0 auto 18px; color: #7e889b; font-size: 13px; line-height: 1.65; }
.qr-waiting { display: inline-flex; align-items: center; gap: 8px; color: #4b6fca; font-size: 12px; }
.qr-waiting::before { width: 7px; height: 7px; border-radius: 50%; background: #5f82df; box-shadow: 0 0 0 4px rgb(95 130 223 / 13%); content: ''; }
.qr-retry { min-height: 38px; border: 1px solid #d8e0ef; border-radius: 10px; padding: 0 18px; background: #fff; color: #4569c3; cursor: pointer; font: inherit; font-size: 13px; }
.dialog-submit { width: 100%; }
.dialog-message { margin-top: 12px; color: #35a366; font-size: 13px; text-align: center; }
.error-message { color: #d64d5b; }
@keyframes login-spin { to { transform: rotate(360deg); } }
@media (max-width: 760px) {
  .login-page { padding: 0; }
  .login-shell { height: auto; min-height: 100vh; grid-template-columns: 1fr; border-radius: 0; }
  .brand-panel { min-height: 190px; padding: 28px; }
  .brand-copy { margin: 34px 0 0; padding: 0; }
  .brand-copy h1 { margin-bottom: 10px; font-size: 30px; }
  .brand-copy p,
  .brand-kicker,
  .brand-presence { display: none; }
  .auth-panel { min-height: 560px; padding: 68px 28px 44px; }
}
@media (max-height: 620px) and (min-width: 761px) {
  .login-page { padding: 0; }
  .login-shell { height: 100%; min-height: 500px; }
  .brand-copy { padding: 24px 0; }
  .brand-copy h1 { font-size: 36px; }
  .brand-kicker { margin-bottom: 12px; }
  .auth-panel { padding-top: 52px; padding-bottom: 34px; }
  .welcome-copy { margin-bottom: 20px; }
  .login-tabs { margin-bottom: 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .tab-indicator,
  .button-spinner,
  .qr-spinner { animation: none; transition: none; }
}
</style>
