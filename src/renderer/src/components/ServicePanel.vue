<template>
  <section class="service-panel">
    <header>
      <div>
        <h2>{{ t('services.title') }}</h2>
        <p>{{ t('services.subtitle') }}</p>
      </div>
      <el-button :loading="loading" @click="load">{{ t('services.refresh') }}</el-button>
    </header>

    <main>
      <div v-if="loading && !categories.length" class="state">
        {{ t('common.loading') }}
      </div>
      <div v-else-if="error && !categories.length" class="state">
        <span>{{ error }}</span>
        <el-button type="primary" @click="load">{{ t('services.retry') }}</el-button>
      </div>
      <div v-else-if="!visibleCategories.length" class="state">{{ t('services.empty') }}</div>
      <template v-else>
        <section v-for="category in visibleCategories" :key="category.typeName" class="category">
          <h3>{{ category.typeName }}</h3>
          <div class="service-grid">
            <button
              v-for="item in category.items"
              :key="item.id || item.name"
              type="button"
              class="service-card"
              @click="openService(item)"
            >
              <span class="service-icon">
                <img v-if="item.iconPath" :src="resolveMediaUrl(item.iconPath)" :alt="item.name" />
                <span v-else>▦</span>
              </span>
              <span class="service-copy">
                <strong>{{ item.name || t('services.unnamed') }}</strong>
                <small v-if="item.introduction">{{ item.introduction }}</small>
              </span>
              <span class="arrow">›</span>
            </button>
          </div>
        </section>
      </template>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { resolveMediaUrl } from '../core/mediaUrl'
import {
  getMiniAppServices,
  type MiniAppServiceCategory,
  type MiniAppServiceItem
} from '../services/api/miniapp'

const { t } = useI18n()
const categories = ref<MiniAppServiceCategory[]>([])
const loading = ref(false)
const error = ref('')
const visibleCategories = computed(() =>
  categories.value.filter((category) => category.items.length)
)

onMounted(() => void load())

async function load(): Promise<void> {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    categories.value = await getMiniAppServices()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('common.operationFailed')
  } finally {
    loading.value = false
  }
}

function openService(item: MiniAppServiceItem): void {
  const url = resolveMediaUrl(item.entryUrl)
  if (!url) {
    ElMessage.warning(t('services.noUrl'))
    return
  }
  void window.api.hybrid.open(url).catch((cause) => {
    ElMessage.error(cause instanceof Error ? cause.message : t('common.operationFailed'))
  })
}
</script>

<style scoped>
.service-panel {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  background: #f6f7fa;
}
header {
  display: flex;
  min-height: 76px;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid #e8ebf0;
  background: #fff;
}
header h2,
header p {
  margin: 0;
}
header h2 {
  color: #273043;
  font-size: 19px;
}
header p {
  margin-top: 5px;
  color: #959eac;
  font-size: 12px;
}
main {
  overflow-y: auto;
  padding: 18px 24px 30px;
}
.category {
  margin-bottom: 22px;
}
.category h3 {
  margin: 0 0 10px 3px;
  color: #697386;
  font-size: 13px;
  font-weight: 600;
}
.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.service-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 13px;
  border: 1px solid #e8ebf0;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 5px 18px rgb(47 57 76 / 5%);
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.service-card:hover {
  box-shadow: 0 9px 24px rgb(47 57 76 / 11%);
  transform: translateY(-1px);
}
.service-icon {
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border-radius: 13px;
  background: linear-gradient(145deg, #edf1ff, #e6eafa);
  color: #6679d9;
  font-size: 22px;
}
.service-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.service-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}
.service-copy strong,
.service-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.service-copy strong {
  color: #30394b;
  font-size: 14px;
}
.service-copy small {
  color: #929baa;
  font-size: 11px;
}
.arrow {
  color: #a3abba;
  font-size: 22px;
}
.state {
  display: flex;
  min-height: 260px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: #98a1b0;
}
</style>
