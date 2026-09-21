/** 私密聊天 + 设备密钥 API（契约 1.5 / 1.8 / 3.5） */
import { http } from '../http/httpClient'
import type { SecretChatResult, SecretMessageWire, DeviceKeyResult } from '../e2ee/types'

export function registerDeviceKey(deviceId: string, publicKey: string): Promise<DeviceKeyResult> {
  return http.post('/device-keys', { deviceId, publicKey })
}

export function getMyDeviceKeys(): Promise<DeviceKeyResult[]> {
  return http.get('/device-keys/me')
}

export function createSecretChat(userB: string, publicKey: string): Promise<SecretChatResult> {
  return http.post('/secret-chats', { userB, publicKey })
}

export function getMySecretChats(): Promise<SecretChatResult[]> {
  return http.get('/secret-chats/mine')
}

export function getSecretChat(id: string): Promise<SecretChatResult> {
  return http.get('/secret-chats/' + id)
}

export function secretChatHandshake(id: string, publicKey: string): Promise<SecretChatResult> {
  return http.post('/secret-chats/' + id + '/handshake', { publicKey })
}

export function sendSecretMessage(
  secretChatId: string,
  msgId: string,
  ciphertext: string
): Promise<SecretMessageWire> {
  return http.post('/secret-messages', { secretChatId, msgId, ciphertext })
}

export function getSecretMessages(
  secretChatId: string,
  afterSeq: number,
  limit = 100
): Promise<SecretMessageWire[]> {
  return http.get('/secret-messages', { secretChatId, afterSeq, limit })
}
