<template>
  <div class="window-controls">
    <button type="button" :title="t('common.windowMinimize')" @click="minimize">
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5h8" /></svg>
    </button>
    <button
      type="button"
      :title="maximized ? t('common.windowRestore') : t('common.windowMaximize')"
      @click="toggleMaximize"
    >
      <svg v-if="maximized" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M4 3h5v5M3 4h5v5H3z" />
      </svg>
      <svg v-else viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" /></svg>
    </button>
    <button type="button" class="close-button" :title="t('common.windowClose')" @click="close">
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7" /></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{ maximizedChange: [maximized: boolean] }>()
const { t } = useI18n()
const maximized = ref(false)
let unsubscribe: (() => void) | undefined

function setMaximized(value: boolean): void {
  maximized.value = value
  emit('maximizedChange', value)
}

onMounted(async () => {
  setMaximized(await window.api.windowControls.isMaximized())
  unsubscribe = window.api.windowControls.onMaximizedChange(setMaximized)
})

onBeforeUnmount(() => unsubscribe?.())

function minimize(): void {
  void window.api.windowControls.minimize()
}

async function toggleMaximize(): Promise<void> {
  setMaximized(await window.api.windowControls.toggleMaximize())
}

function close(): void {
  void window.api.windowControls.close()
}
</script>

<style scoped>
.window-controls {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 5001;
  display: flex;
  align-items: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-app-region: no-drag;
}

button {
  display: grid;
  width: 44px;
  height: 34px;
  place-items: center;
  border: 0;
  background: transparent;
  color: #7b8495;
  cursor: default;
}

button:hover { background: rgb(66 82 117 / 7%); color: #273248; }
.close-button:hover { background: #e5484d; color: #fff; }

svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.25;
}
</style>
