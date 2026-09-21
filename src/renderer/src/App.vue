<template>
  <el-config-provider :locale="elLocale">
    <div class="desktop-window" :class="{ 'is-maximized': isMaximized }">
      <div class="window-drag-strip" aria-hidden="true" />
      <WindowControls @maximized-change="isMaximized = $event" />
      <router-view />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import WindowControls from './components/WindowControls.vue'

const { locale } = useI18n()
const elLocale = computed(() => (locale.value === 'en' ? en : zhCn))
const isMaximized = ref(false)
</script>

<style>
html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}

.desktop-window {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border: 0;
  border-radius: 20px;
  background: #fff;
  box-shadow: none;
}

.desktop-window.is-maximized {
  inset: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.window-drag-strip {
  position: absolute;
  top: 0;
  right: 128px;
  left: 0;
  z-index: 5000;
  height: 12px;
  -webkit-app-region: drag;
}

.desktop-window .main .chat-header,
.desktop-window .main .channels > .header,
.desktop-window .main .account-page > header {
  padding-right: 136px;
}
</style>
