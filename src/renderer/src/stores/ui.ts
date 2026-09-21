/** 全局 UI 状态（当前标签页） */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type MainTab =
  | 'chat'
  | 'contacts'
  | 'secret'
  | 'channel'
  | 'services'
  | 'profile'
  | 'password'
  | 'chatStorage'
  | 'blacklist'
  | 'myQr'
  | 'settings'

export const useUiStore = defineStore('ui', () => {
  const activeTab = ref<MainTab>('chat')
  return { activeTab }
})
