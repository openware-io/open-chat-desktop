import { BrowserWindow, ipcMain, net, session, shell } from 'electron'
import { randomBytes, createHash } from 'node:crypto'
import { join } from 'node:path'

interface HybridPolicy {
  appId: string
  origin: string
  path: string
  scope: string
}

export interface HybridRequest {
  id: string
  method: string
  params: Record<string, unknown>
  nonce: string
}

const policies: HybridPolicy[] = [
  { appId: 'saas-a380-c', origin: 'https://miniservice.dev.example.com', path: '/a380/', scope: 'profile.basic' },
  { appId: 'saas-a380-h5', origin: 'https://miniservice.dev.example.com', path: '/b/', scope: 'profile.basic' }
]
const parents = new Map<number, BrowserWindow>()

export function resolveHybridPolicy(raw: string): HybridPolicy | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  return policies.find((policy) => url.origin === policy.origin && url.pathname === policy.path && !url.search && !url.hash) ?? null
}

function resolveHybridPage(raw: string): HybridPolicy | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  return policies.find((policy) => url.origin === policy.origin && url.pathname === policy.path && !url.hash) ?? null
}

function failure(id: string, code: string, message: string): Record<string, unknown> {
  return { id, ok: false, error: { code, message } }
}

function success(id: string, result: unknown): Record<string, unknown> {
  return { id, ok: true, result }
}

function randomString(size: number): string {
  return randomBytes(size).toString('base64url')
}

async function accessToken(parent: BrowserWindow): Promise<string> {
  const token = await parent.webContents.executeJavaScript(
    "localStorage.getItem('gv_chat_access_token') || sessionStorage.getItem('gv_chat_access_token') || ''",
    true
  )
  if (typeof token !== 'string' || !token) throw new Error('IM 登录态缺失')
  return token
}

async function login(child: BrowserWindow, request: HybridRequest): Promise<Record<string, string>> {
  const target = resolveHybridPage(child.webContents.getURL())
  if (!target) throw new Error('Bridge 来源未登记')
  const params = request.params
  const appId = String(params.appId ?? '')
  const scope = String(params.scope ?? target.scope)
  const redirectUri = String(params.redirectUri ?? '')
  const state = String(params.state ?? '')
  const nonce = String(params.nonce ?? '')
  const redirect = resolveHybridPolicy(redirectUri)
  if (appId !== target.appId || scope !== target.scope || !redirect || redirect.appId !== appId || !state || !nonce) {
    throw new Error('Bridge 请求未登记')
  }
  const verifier = randomString(48)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const base = (process.env.VITE_API_BASE ?? 'https://api.dev.example.com').replace(/\/+$/, '') + '/api/v1'
  const query = new URLSearchParams({ client_id: appId, response_type: 'code', redirect_uri: redirectUri, scope, code_challenge: challenge, code_challenge_method: 'S256', state, nonce })
  const token = await accessToken(parents.get(child.id) ?? child)
  const auth = await net.fetch(`${base}/oauth/authorize?${query}`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'manual' })
  let location = auth.headers.get('location') ?? ''
  let code = new URL(location, base).searchParams.get('code') ?? ''
  if (!code) {
    const consent = new URL(location, base).searchParams.get('request_id') ?? ''
    if (!consent) throw new Error(`授权码获取失败: HTTP ${auth.status}`)
    const approval = await net.fetch(`${base}/oauth/consent/approve?${new URLSearchParams({ request_id: consent, scope })}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, redirect: 'manual' })
    location = approval.headers.get('location') ?? ''
    code = new URL(location, base).searchParams.get('code') ?? ''
  }
  if (!code || new URL(location, base).searchParams.get('state') !== state) throw new Error('OAuth state 校验失败')
  return { code, code_verifier: verifier, redirect_uri: redirectUri, state, nonce }
}

async function dispatch(event: Electron.IpcMainInvokeEvent, request: HybridRequest): Promise<Record<string, unknown>> {
  const child = BrowserWindow.fromWebContents(event.sender)
  if (!child || !parents.has(child.id)) return failure(request?.id ?? '', 'forbidden', 'invalid hybrid window')
  if (!request || typeof request.id !== 'string' || typeof request.method !== 'string' || typeof request.nonce !== 'string') return failure('', 'invalid_request', 'invalid bridge request')
  const seen = (child as BrowserWindow & { __hybridNonces?: Set<string> }).__hybridNonces ?? new Set<string>()
  ;(child as BrowserWindow & { __hybridNonces?: Set<string> }).__hybridNonces = seen
  if (seen.has(request.nonce)) return failure(request.id, 'duplicate_nonce', 'nonce already used')
  seen.add(request.nonce)
  try {
    if (request.method === 'login') return success(request.id, await login(child, request))
    if (request.method === 'exitApp') { child.close(); return success(request.id, true) }
    return failure(request.id, 'unknown_method', 'method is not registered')
  } catch (error) {
    return failure(request.id, 'handler_error', error instanceof Error ? error.message : String(error))
  }
}

export function registerHybridIpc(): void {
  ipcMain.handle('hybrid:request', dispatch)
  ipcMain.handle('hybrid:open', (event, raw: string) => {
    const policy = resolveHybridPolicy(raw)
    if (!policy) throw new Error('Hybrid URL 未登记')
    const parent = BrowserWindow.fromWebContents(event.sender)
    if (!parent) throw new Error('invalid parent window')
    const partition = `persist:gv-hybrid-${policy.appId}`
    const hybridSession = session.fromPartition(partition)
    const child = new BrowserWindow({
      width: 1100, height: 760, parent,
      webPreferences: { preload: join(__dirname, '../preload/hybrid.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, session: hybridSession }
    })
    parents.set(child.id, parent)
    child.on('closed', () => parents.delete(child.id))
    child.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
    child.webContents.on('will-navigate', (navigation, url) => { if (!resolveHybridPage(url)) navigation.preventDefault() })
    void child.loadURL(raw)
    return true
  })
}
