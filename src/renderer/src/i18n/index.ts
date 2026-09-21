import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'

/** 应用支持的语言：默认 zh-CN，可切换到 en（对齐 Flutter 端行为） */
export type AppLocale = 'zh-CN' | 'en'

export const DEFAULT_LOCALE: AppLocale = 'zh-CN'
export const LOCALE_STORAGE_KEY = 'gv_chat_locale'

function readStoredLocale(): AppLocale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved === 'zh-CN' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  locale: readStoredLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': zhCN,
    en
  }
})

/** 读取当前活动语言（供 config.lang / x-lang 头等使用） */
export function getLocale(): AppLocale {
  const v = i18n.global.locale.value as string
  return v === 'en' ? 'en' : 'zh-CN'
}

/** 切换语言：更新 i18n 活动语言 + 持久化到 localStorage */
export function setLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale)
  }
}

/** 供非组件代码（stores / models / services）使用的全局翻译函数 */
export function t(key: string, params?: Record<string, string | number>): string {
  return (params ? i18n.global.t(key, params) : i18n.global.t(key)) as string
}
