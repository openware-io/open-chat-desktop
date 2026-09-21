/** E2EE 管理器：设备密钥注册 / 密聊建立 / 加密收发 */
import { E2eeSessionStore, SafeStorageKeyValueStore } from './store'
import { generateKeyPair, deriveSharedSecret, encrypt, decrypt, computeSafeCode } from './crypto'
import * as secretApi from '../api/secretChat'
import type { SecretChatResult, SecretMessageWire } from './types'
import { t } from '../../i18n'

const kv = new SafeStorageKeyValueStore()
const store = new E2eeSessionStore(kv)
let storeReady: Promise<void> | null = null
function ensureStoreReady(): Promise<void> {
  if (!storeReady) storeReady = kv.init()
  return storeReady
}

export interface DecryptedMessage {
  msgId: string
  fromUserId: string
  seq: number
  status: string
  plaintext: string | null
}

export async function ensureDeviceKey(): Promise<{ deviceId: string; publicKey: string }> {
  await ensureStoreReady()
  const pub = store.getPublicKey()
  const priv = store.getPrivateKey()
  const deviceId = store.getDeviceId()
  if (pub && priv && deviceId) return { deviceId, publicKey: pub }

  const pair = await generateKeyPair()
  const id = crypto.randomUUID()
  store.setKeyPair(pair.privateKey, pair.publicKey)
  store.setDeviceId(id)
  await secretApi.registerDeviceKey(id, pair.publicKey)
  return { deviceId: id, publicKey: pair.publicKey }
}

export async function createSecretChat(userB: string): Promise<SecretChatResult> {
  const { publicKey } = await ensureDeviceKey()
  return secretApi.createSecretChat(userB, publicKey)
}

export async function handshakeSecretChat(id: string): Promise<SecretChatResult> {
  const { publicKey } = await ensureDeviceKey()
  return secretApi.secretChatHandshake(id, publicKey)
}

/** 派生并持久化共享密钥，返回共享密钥 base64（失败返回 null） */
export async function establishSecretChat(sc: SecretChatResult, myUserId: string): Promise<string | null> {
  await ensureStoreReady()
  const priv = store.getPrivateKey()
  const userAPub = sc.userAPublicKey
  const userBPub = sc.userBPublicKey
  if (!priv || !userAPub || !userBPub) return null
  const isA = myUserId === sc.userA
  const peerPub = isA ? userBPub : userAPub
  const shared = await deriveSharedSecret(priv, peerPub)
  const safeCode = await computeSafeCode(userAPub, userBPub)
  store.setSharedSecret(sc.id, shared, safeCode)
  return shared
}

export async function sendSecretText(secretChatId: string, text: string): Promise<SecretMessageWire> {
  await ensureStoreReady()
  const shared = store.getSharedSecret(secretChatId)
  if (!shared) throw new Error(t('errors.secretKeyMissing'))
  const ciphertext = await encrypt(shared, text)
  const msgId = crypto.randomUUID()
  return secretApi.sendSecretMessage(secretChatId, msgId, ciphertext)
}

export async function loadSecretMessages(secretChatId: string, afterSeq = 0): Promise<DecryptedMessage[]> {
  await ensureStoreReady()
  const shared = store.getSharedSecret(secretChatId)
  const list = await secretApi.getSecretMessages(secretChatId, afterSeq, 100)
  const out: DecryptedMessage[] = []
  for (const m of list) {
    const plaintext = shared ? await decrypt(shared, m.ciphertext) : null
    out.push({ msgId: m.msgId, fromUserId: m.fromUserId, seq: m.seq, status: m.status, plaintext })
  }
  return out
}

export function getSafeCode(secretChatId: string): string | null {
  return store.getSafeCode(secretChatId)
}

export function getLocalStore(): E2eeSessionStore {
  return store
}
