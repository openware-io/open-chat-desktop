<template>
  <div class="channels">
    <div class="header">{{ t('channel.title') }}</div>
    <div class="create-row">
      <el-input v-model="name" :placeholder="t('channel.namePlaceholder')" size="small" />
      <el-button size="small" type="primary" @click="onCreate">{{ t('channel.create') }}</el-button>
    </div>
    <div class="list">
      <div v-for="c in ch.channels" :key="c.id" class="item">
        <span class="name">{{ c.name || c.id }}</span>
        <el-button v-if="!c.subscribed" size="small" @click="ch.subscribe(c.id)">{{ t('channel.subscribe') }}</el-button>
        <span v-else class="subscribed">{{ t('channel.subscribed') }}</span>
      </div>
      <div v-if="!ch.channels.length" class="empty">{{ t('channel.empty') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChannelStore } from '../stores/channel'

const { t } = useI18n()
const ch = useChannelStore()
const name = ref('')

onMounted(() => {
  void ch.load()
})

function onCreate(): void {
  const n = name.value.trim()
  if (!n) return
  name.value = ''
  void ch.create(n)
}
</script>

<style scoped>
.channels {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.header {
  padding: 16px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
}
.create-row {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
}
.list {
  padding: 0 16px;
}
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}
.name {
  font-size: 14px;
}
.subscribed {
  font-size: 12px;
  color: #67c23a;
}
.empty {
  color: #bbb;
  text-align: center;
  padding: 24px 0;
}
</style>
