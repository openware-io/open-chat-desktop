import { app, ipcMain, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { E2EE_CHANNELS } from '../shared/e2ee'

/**
 * E2EE 密钥安全存储（主进程）。
 *
 * 渲染进程的私钥/共享密钥等敏感材料，通过受限 IPC 交给主进程，用 Electron safeStorage
 * （Windows DPAPI / macOS Keychain / Linux libsecret）加密后落盘到
 * userData/e2ee-secrets.json。渲染进程永远拿不到明文密钥，也不会把密钥写进 localStorage。
 */
function secretsFilePath(): string {
  return join(app.getPath('userData'), 'e2ee-secrets.json')
}

function loadSecrets(): Record<string, string> {
  const p = secretsFilePath()
  if (!existsSync(p)) return {}
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}

function saveSecrets(secrets: Record<string, string>): void {
  writeFileSync(secretsFilePath(), JSON.stringify(secrets), 'utf-8')
}

export function registerE2eeIpc(): void {
  ipcMain.handle(E2EE_CHANNELS.loadAll, (): Record<string, string> => {
    const result: Record<string, string> = {}
    for (const [key, enc] of Object.entries(loadSecrets())) {
      try {
        result[key] = safeStorage.decryptString(Buffer.from(enc, 'base64'))
      } catch {
        // 单条解密失败（如换机器/系统 keychain 变化）时跳过，不阻断其余密钥加载。
      }
    }
    return result
  })

  ipcMain.handle(E2EE_CHANNELS.get, (_e, key: string): string | null => {
    const enc = loadSecrets()[key]
    if (!enc) return null
    try {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'))
    } catch {
      return null
    }
  })

  ipcMain.handle(E2EE_CHANNELS.set, (_e, key: string, value: string): void => {
    const secrets = loadSecrets()
    secrets[key] = safeStorage.encryptString(value).toString('base64')
    saveSecrets(secrets)
  })

  ipcMain.handle(E2EE_CHANNELS.remove, (_e, key: string): void => {
    const secrets = loadSecrets()
    delete secrets[key]
    saveSecrets(secrets)
  })

  ipcMain.handle(E2EE_CHANNELS.clear, (): void => {
    saveSecrets({})
  })
}
