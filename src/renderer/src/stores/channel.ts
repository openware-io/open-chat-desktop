/** 频道 store */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChannelResult } from '../models/group'
import * as conversationApi from '../services/api/conversation'

export const useChannelStore = defineStore('channel', () => {
  const channels = ref<ChannelResult[]>([])

  async function load(): Promise<void> {
    channels.value = await conversationApi.getMyChannels()
  }

  async function create(name: string): Promise<ChannelResult> {
    const c = await conversationApi.createChannel({ name })
    await load()
    return c
  }

  async function subscribe(id: string): Promise<void> {
    await conversationApi.subscribeChannel(id)
    await load()
  }

  return { channels, load, create, subscribe }
})
