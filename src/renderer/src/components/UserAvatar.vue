<template>
  <span
    class="user-avatar"
    :style="avatarStyle"
    :aria-label="name"
  >
    <img
      v-if="imageSrc && !imageFailed"
      :src="imageSrc"
      :alt="name"
      @error="imageFailed = true"
    />
    <span v-else class="avatar-fallback">{{ initial }}</span>
    <span v-if="online !== undefined" class="online-dot" :class="{ online }" />
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveMediaUrl } from '../core/mediaUrl'

const props = withDefaults(
  defineProps<{
    name: string
    src?: string | null
    uid?: string | number
    size?: number
    online?: boolean
  }>(),
  { src: null, uid: '', size: 42, online: undefined }
)

const imageFailed = ref(false)
const imageSrc = computed(() => resolveMediaUrl(props.src))
const initial = computed(() => props.name.trim().slice(0, 1).toUpperCase() || '?')
const gradients = [
  ['#5ac8fa', '#007aff'],
  ['#ff6482', '#ff2d55'],
  ['#ffcc00', '#ff9500'],
  ['#4cd964', '#34c759'],
  ['#bf5af2', '#af52de'],
  ['#ff6b6b', '#ff3b30'],
  ['#64d2ff', '#30b0c7'],
  ['#ffd426', '#ff9f0a']
] as const
const gradient = computed(() => {
  const numericId = Number(props.uid)
  const index = Number.isFinite(numericId) ? Math.abs(Math.trunc(numericId)) % gradients.length : 0
  return gradients[index]
})
const avatarStyle = computed(() => ({
  '--avatar-size': props.size + 'px',
  '--avatar-start': gradient.value[0],
  '--avatar-end': gradient.value[1]
}))

watch(imageSrc, () => {
  imageFailed.value = false
})
</script>

<style scoped>
.user-avatar {
  position: relative;
  display: inline-flex;
  width: var(--avatar-size);
  height: var(--avatar-size);
  flex: 0 0 var(--avatar-size);
  align-items: center;
  justify-content: center;
  overflow: visible;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--avatar-start), var(--avatar-end));
  color: #fff;
  font-weight: 400;
  user-select: none;
}
.user-avatar img,
.avatar-fallback {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}
.user-avatar img {
  display: block;
  object-fit: cover;
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--avatar-size) * 0.4);
}
.online-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #b8bec8;
}
.online-dot.online {
  background: #22c55e;
}
</style>
