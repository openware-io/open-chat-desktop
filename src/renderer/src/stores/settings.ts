/** 设置 store */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { NotificationSettings, PrivacySettings, SelfDestructPolicy, UserProfile } from '../services/api/user'
import * as userApi from '../services/api/user'

export const useSettingsStore = defineStore('settings', () => {
  const profile = ref<UserProfile | null>(null)
  const notif = ref<NotificationSettings | null>(null)
  const privacy = ref<PrivacySettings | null>(null)
  const selfDestruct = ref<SelfDestructPolicy>('off')

  async function load(): Promise<void> {
    try {
      const [p, n, pr, sd] = await Promise.all([
        userApi.getMe(),
        userApi.getNotificationSettings(),
        userApi.getPrivacySettings(),
        userApi.getSelfDestruct()
      ])
      profile.value = p
      notif.value = n
      privacy.value = pr
      selfDestruct.value = sd.policy
    } catch (e) {
      console.error('load settings failed', e)
    }
  }

  async function updateProfile(
    req: Partial<Pick<UserProfile, 'nickname' | 'avatar' | 'email' | 'phone' | 'signature'>>
  ): Promise<UserProfile> {
    profile.value = await userApi.updateMe(req)
    return profile.value
  }

  async function updateNotif(req: NotificationSettings): Promise<void> {
    notif.value = await userApi.updateNotificationSettings(req)
  }

  async function updatePrivacy(req: PrivacySettings): Promise<void> {
    privacy.value = await userApi.updatePrivacySettings(req)
  }

  async function updateSelfDestruct(policy: SelfDestructPolicy): Promise<void> {
    await userApi.setSelfDestruct(policy)
    selfDestruct.value = policy
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await userApi.changePassword(currentPassword, newPassword)
  }

  return { profile, notif, privacy, selfDestruct, load, updateProfile, updateNotif, updatePrivacy, updateSelfDestruct, changePassword }
})
