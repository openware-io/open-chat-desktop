import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authApi from '../services/api/auth'
import { http } from '../services/http/httpClient'
import { connectWs, closeWs, getWsClient } from '../services/ws/session'
import { normalizeEntityId } from '../../../shared/id'

const TOKEN_KEY = 'gv_chat_access_token'
const USER_KEY = 'gv_chat_user'

function readStoredValue(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

export interface AuthUser {
  id: string
  username: string
  nickname?: string | null
  avatar?: string | null
  signature?: string | null
  [key: string]: unknown
}

function loadUser(): AuthUser | null {
  try {
    const raw = readStoredValue(USER_KEY)
    return raw ? normalizeUser(JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function normalizeUser(value: AuthUser): AuthUser {
  return { ...value, id: normalizeEntityId(value.id) }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(readStoredValue(TOKEN_KEY))
  const user = ref<AuthUser | null>(loadUser())
  const isLoggedIn = computed(() => token.value != null)
  const userId = computed(() => normalizeEntityId(user.value?.id))
  const displayName = computed(() => user.value?.nickname || user.value?.username || '')

  function setSession(t: string, u: AuthUser, remember = true): void {
    const normalizedUser = normalizeUser(u)
    token.value = t
    user.value = normalizedUser
    http.setToken(t)
    const targetStorage = remember ? localStorage : sessionStorage
    const staleStorage = remember ? sessionStorage : localStorage
    targetStorage.setItem(TOKEN_KEY, t)
    targetStorage.setItem(USER_KEY, JSON.stringify(normalizedUser))
    staleStorage.removeItem(TOKEN_KEY)
    staleStorage.removeItem(USER_KEY)
  }

  async function login(username: string, password: string, remember = true): Promise<AuthUser> {
    const res = await authApi.login(username, password)
    setSession(res.access_token, res.user as AuthUser, remember)
    await connectWs()
    return user.value as AuthUser
  }

  async function ensureRealtimeConnected(): Promise<void> {
    if (!token.value || getWsClient()) return
    await connectWs()
  }

  function logout(): void {
    closeWs()
    token.value = null
    user.value = null
    http.setToken(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  }

  function updateUser(patch: Partial<AuthUser>): void {
    if (!user.value) return
    user.value = normalizeUser({ ...user.value, ...patch })
    const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage
    storage.setItem(USER_KEY, JSON.stringify(user.value))
  }

  // 自动登录：恢复 token 到 HTTP 客户端
  if (token.value) http.setToken(token.value)

  return {
    token,
    user,
    isLoggedIn,
    userId,
    displayName,
    login,
    logout,
    updateUser,
    setSession,
    ensureRealtimeConnected
  }
})
