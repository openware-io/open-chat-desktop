/**
 * E2EE 密码学原语（X25519 + AES-256-GCM）
 *
 * 字节级对齐 Flutter 端 gv_chat_app/lib/services/e2ee/e2ee_crypto.dart：
 * - 共享密钥 = X25519(私钥, 对端公钥) 的原始 32 字节，直接作 AES-256 密钥（无 HKDF/salt/AAD）
 * - 密文布局 = base64( nonce[12B] || ciphertext || tag[16B] )
 * - 安全码 = SHA-256(utf8(pubA:pubB)) 前 8 字节，大写十六进制、空格分隔
 *
 * 实现基于 Web Crypto API，无第三方依赖（渲染进程 sandbox 内可用）。
 */

const X25519_PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20
])

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export interface E2eeKeyPair {
  /** 私钥种子，base64(32B)，对应 Flutter 端 e2ee_private_key */
  privateKey: string
  /** 公钥，base64(32B)，对应 e2ee_public_key */
  publicKey: string
}

// ---------- base64（分块，避免大输入栈溢出） ----------
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

// ---------- X25519 密钥对 ----------
/** 生成 X25519 密钥对；私钥种子经 pkcs8 导出取末 32 字节（RFC 8410）。 */
export async function generateKeyPair(): Promise<E2eeKeyPair> {
  const pair = (await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits'])) as CryptoKeyPair
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const privateKey = pkcs8.slice(-32)
  return { privateKey: bytesToBase64(privateKey), publicKey: bytesToBase64(publicKey) }
}

/** 由私钥种子重建 CryptoKey（Web Crypto 不直接 raw 导入私钥，需 pkcs8 包装）。 */
async function privateCryptoKey(seedB64: string): Promise<CryptoKey> {
  const seed = base64ToBytes(seedB64)
  const pkcs8 = new Uint8Array(48)
  pkcs8.set(X25519_PKCS8_PREFIX, 0)
  pkcs8.set(seed, 16)
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'X25519' }, false, ['deriveBits'])
}

async function publicCryptoKey(publicKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64ToBytes(publicKeyB64), { name: 'X25519' }, false, [])
}

// ---------- 共享密钥（无 KDF） ----------
/** 派生共享密钥，返回 base64(32B 原始 X25519 输出)。 */
export async function deriveSharedSecret(
  privateKeyB64: string,
  peerPublicKeyB64: string
): Promise<string> {
  const priv = await privateCryptoKey(privateKeyB64)
  const pub = await publicCryptoKey(peerPublicKeyB64)
  const bits = await crypto.subtle.deriveBits({ name: 'X25519', public: pub }, priv, 256)
  return bytesToBase64(new Uint8Array(bits))
}

// ---------- AES-256-GCM ----------
async function aesKey(sharedSecretB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(sharedSecretB64),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

/** 加密明文，返回 base64(nonce[12B] || ciphertext || tag[16B])。 */
export async function encrypt(sharedSecretB64: string, plaintext: string): Promise<string> {
  const key = await aesKey(sharedSecretB64)
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const data = textEncoder.encode(plaintext)
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, data)
  )
  const payload = new Uint8Array(nonce.length + ct.length)
  payload.set(nonce, 0)
  payload.set(ct, nonce.length)
  return bytesToBase64(payload)
}

/** 解密 base64(nonce[12B] || ciphertext || tag[16B])，失败返回 null。 */
export async function decrypt(sharedSecretB64: string, ciphertextB64: string): Promise<string | null> {
  try {
    const payload = base64ToBytes(ciphertextB64)
    if (payload.length < 28) return null
    const nonce = payload.slice(0, 12)
    const ct = payload.slice(12)
    const key = await aesKey(sharedSecretB64)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, ct)
    return textDecoder.decode(pt)
  } catch {
    return null
  }
}

// ---------- 安全码 ----------
/**
 * 计算 1:1 私聊安全码：SHA-256(utf8(pubA:pubB)) 前 8 字节，大写十六进制、空格分隔。
 * 调用方需保证 pubA/pubB 已按 userA=min(userId)、userB=max(userId) 排位。
 */
export async function computeSafeCode(
  userAPublicKeyB64: string,
  userBPublicKeyB64: string
): Promise<string> {
  const msg = userAPublicKeyB64 + ':' + userBPublicKeyB64
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', textEncoder.encode(msg))
  )
  const parts: string[] = []
  for (let i = 0; i < 8; i++) {
    parts.push(digest[i].toString(16).toUpperCase().padStart(2, '0'))
  }
  return parts.join(' ')
}
