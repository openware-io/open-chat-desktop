/** 语言 store：单一数据源，切换时同步 i18n + localStorage */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getLocale, setLocale, type AppLocale } from '../i18n'

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<AppLocale>(getLocale())

  function set(lang: AppLocale): void {
    locale.value = lang
    setLocale(lang)
  }

  return { locale, set }
})
