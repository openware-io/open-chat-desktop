/**
 * E2EE SessionStore —— 本地持久化（对应 Flutter e2ee_session_store.dart 的 6 类 key 语义）。
 *
 * key 语义与 base64 编码与 Flutter 端保持一致；私钥/共享密钥绝不上报服务端。
 * 持久化经主进程 Electron safeStorage（Windows DPAPI / macOS Keychain / Linux libsecret）
 * 加密后落盘到 userData/e2ee-secrets.json，渲染进程磁盘上无明文密钥。
 */

import { computeSafeCode, deriveSharedSecret } from './crypto'

const KEYS = {
  privateKey: 'e2ee_private_key',
  publicKey: 'e2ee_public_key',
  deviceId: 'e2ee_device_id',
  shared: (secretChatId: string): string => 'e2ee_shared_' + secretChatId,
  safeCode: (secretChatId: string): string => 'e2ee_safe_code_' + secretChatId,
  groupShared: (groupId: string, peerUserId: string): string =>
    'e2ee_group_shared_' + groupId + '_' + peerUserId
} as const

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
  clear(): void
}

export class LocalStorageKeyValueStore implements KeyValueStore {
  get(key: string): string | null {
    return window.localStorage.getItem(key)
  }
  set(key: string, value: string): void {
    window.localStorage.setItem(key, value)
  }
  remove(key: string): void {
    window.localStorage.removeItem(key)
  }
  clear(): void {
    window.localStorage.clear()
  }
}

/**
 * 主进程 safeStorage 加密存储（Electron 桌面端默认实现）。
 *
 * 渲染进程启动时通过 init() 一次性经 IPC 拉取全部解密后的密钥到内存缓存（同步读），
 * 写入时同步更新内存缓存并对主进程发起异步持久化（fire-and-forget）。
 * 磁盘上的密钥始终由主进程 safeStorage 加密，渲染进程不直接接触加密/明文落盘细节。
 */
export class SafeStorageKeyValueStore implements KeyValueStore {
  private cache = new Map<string, string>()

  async init(): Promise<void> {
    try {
      const all = await window.api.e2ee.loadAll()
      this.cache = new Map(Object.entries(all))
    } catch {
      // IPC 不可用（如 web 环境）时退化为空缓存，密钥将按需重新生成。
      this.cache = new Map()
    }
  }

  get(key: string): string | null {
    return this.cache.get(key) ?? null
  }

  set(key: string, value: string): void {
    this.cache.set(key, value)
    void window.api.e2ee.set(key, value)
  }

  remove(key: string): void {
    this.cache.delete(key)
    void window.api.e2ee.remove(key)
  }

  clear(): void {
    this.cache.clear()
    void window.api.e2ee.clear()
  }
}

export class E2eeSessionStore {
  constructor(private kv: KeyValueStore) {}

  getPrivateKey(): string | null {
    return this.kv.get(KEYS.privateKey)
  }

  getPublicKey(): string | null {
    return this.kv.get(KEYS.publicKey)
  }

  getDeviceId(): string | null {
    return this.kv.get(KEYS.deviceId)
  }

  setKeyPair(privateKey: string, publicKey: string): void {
    this.kv.set(KEYS.privateKey, privateKey)
    this.kv.set(KEYS.publicKey, publicKey)
  }

  setDeviceId(deviceId: string): void {
    this.kv.set(KEYS.deviceId, deviceId)
  }

  setSharedSecret(secretChatId: string, sharedSecret: string, safeCode: string): void {
    this.kv.set(KEYS.shared(secretChatId), sharedSecret)
    this.kv.set(KEYS.safeCode(secretChatId), safeCode)
  }

  getSharedSecret(secretChatId: string): string | null {
    return this.kv.get(KEYS.shared(secretChatId))
  }

  getSafeCode(secretChatId: string): string | null {
    return this.kv.get(KEYS.safeCode(secretChatId))
  }

  setGroupSharedSecret(groupId: string, peerUserId: string, sharedSecret: string): void {
    this.kv.set(KEYS.groupShared(groupId, peerUserId), sharedSecret)
  }

  getGroupSharedSecret(groupId: string, peerUserId: string): string | null {
    return this.kv.get(KEYS.groupShared(groupId, peerUserId))
  }

  /** 换账号/登出时清空本账号 E2EE 密钥。 */
  clearForAccount(): void {
    this.kv.clear()
  }

  /** 派生并持久化 1:1 会话共享密钥与安全码。 */
  async establishSecretChat(
    secretChatId: string,
    myPrivateKey: string,
    myUserId: string,
    userA: string,
    userAPublicKey: string,
    userBPublicKey: string
  ): Promise<void> {
    const isA = myUserId === userA
    const peerPub = isA ? userBPublicKey : userAPublicKey
    const sharedSecret = await deriveSharedSecret(myPrivateKey, peerPub)
    const safeCode = await computeSafeCode(userAPublicKey, userBPublicKey)
    this.setSharedSecret(secretChatId, sharedSecret, safeCode)
  }
}
