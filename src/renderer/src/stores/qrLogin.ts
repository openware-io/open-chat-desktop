/** 扫码登录 store：创建会话 → 展示二维码 → 轮询确认 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import QRCode from 'qrcode'
import * as qrApi from '../services/api/qrLogin'
import { QR_LOGIN_SCHEME } from '../services/api/qrLogin'
import { useAuthStore } from './auth'
import type { AuthUser } from './auth'
import { t } from '../i18n'

export type QrStatus = 'idle' | 'pending' | 'expired' | 'confirmed' | 'error'

export const useQrLoginStore = defineStore('qrLogin', () => {
  const qrDataUrl = ref<string | null>(null)
  const status = ref<QrStatus>('idle')
  const errorMsg = ref('')
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function start(): Promise<void> {
    stopPolling()
    errorMsg.value = ''
    try {
      const session = await qrApi.createQrSession()
      qrDataUrl.value = await QRCode.toDataURL(QR_LOGIN_SCHEME + session.qrToken, {
        width: 220,
        margin: 1
      })
      status.value = 'pending'
      pollTimer = setInterval(() => {
        void poll(session.qrToken)
      }, 2000)
    } catch (e) {
      status.value = 'error'
      errorMsg.value = e instanceof Error ? e.message : t('login.qrFailed')
    }
  }

  async function poll(qrToken: string): Promise<void> {
    try {
      const res = await qrApi.pollQrSession(qrToken)
      if (res.status === 'confirmed' && res.access_token && res.user) {
        status.value = 'confirmed'
        stopPolling()
        const auth = useAuthStore()
        auth.setSession(res.access_token, res.user as AuthUser)
      } else if (res.status === 'expired') {
        status.value = 'expired'
        stopPolling()
      }
    } catch {
      /* 网络抖动忽略，继续下一轮 */
    }
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function reset(): void {
    stopPolling()
    qrDataUrl.value = null
    status.value = 'idle'
  }

  return { qrDataUrl, status, errorMsg, start, stopPolling, reset }
})
