/** 登录用户对应的服务端客户端配置。 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as clientConfigApi from '../services/api/clientConfig'

export const useRemoteConfigStore = defineStore('remoteConfig', () => {
  // 与 App 一致：远端未配置或拉取失败时，密聊默认关闭。
  const secretChatEnabled = ref(false)
  const recallEnabled = ref(true)
  const chatDeleteEnabled = ref(true)
  const loaded = ref(false)

  async function refresh(): Promise<void> {
    secretChatEnabled.value = false
    loaded.value = false
    try {
      const config = await clientConfigApi.getClientConfig()
      secretChatEnabled.value = config.secretChatEnabled
      recallEnabled.value = config.recallEnabled
      chatDeleteEnabled.value = config.chatDeleteEnabled
      loaded.value = true
    } catch {
      secretChatEnabled.value = false
      recallEnabled.value = true
      chatDeleteEnabled.value = true
    }
  }

  function reset(): void {
    secretChatEnabled.value = false
    recallEnabled.value = true
    chatDeleteEnabled.value = true
    loaded.value = false
  }

  return { secretChatEnabled, recallEnabled, chatDeleteEnabled, loaded, refresh, reset }
})
