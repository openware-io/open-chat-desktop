/** E2EE 相关类型与契约值 */

/** 阅后即焚销毁策略（契约值，全小写，11 值）。 */
export type DestroyPolicy =
  | 'off'
  | '1s'
  | '2s'
  | '5s'
  | '10s'
  | '30s'
  | '1m'
  | '5m'
  | '1h'
  | '1d'
  | '1w'

export const DESTROY_POLICIES: DestroyPolicy[] = [
  'off',
  '1s',
  '2s',
  '5s',
  '10s',
  '30s',
  '1m',
  '5m',
  '1h',
  '1d',
  '1w'
]

/** 密聊状态 */
export type SecretChatStatus = 'handshake' | 'ready'
export type SecretChatHandshakeState = 'pending' | 'ready'

export interface SecretChatResult {
  id: string
  userA: string
  userB: string
  peerUserId: string
  status: SecretChatStatus
  safeCode: string
  destroyPolicy: DestroyPolicy
  userAPublicKey: string | null
  userBPublicKey: string | null
  handshakeState: SecretChatHandshakeState
}

export interface SecretMessageWire {
  secretChatId: string
  msgId: string
  fromUserId: string
  ciphertext: string
  seq: number
  status: string
  destroyAt?: string | null
  createdAt?: string | null
}

export interface DeviceKeyResult {
  id: string
  userId: string
  deviceId: string
  publicKey: string
  status: string
}
