<template>
  <div class="home">
    <h1>{{ t('home.title') }}</h1>
    <p>{{ t('home.subtitle') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #303133;
}
</style>
