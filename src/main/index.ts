import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ChatDatabase } from './db/database'
import { registerDbIpc, registerNotifyIpc, registerApiIpc, registerMediaIpc, registerWindowIpc } from './ipc'
import { registerE2eeIpc } from './e2ee-store'
import { createTray } from './tray'
import { getAppIconPath } from './icon'
import { registerHybridIpc } from './hybrid'

let db: ChatDatabase | null = null
let mainWindow: BrowserWindow | null = null
let isQuitting = false

process.on('uncaughtException', (e) => console.error('[main] uncaughtException', e))
process.on('unhandledRejection', (e) => console.error('[main] unhandledRejection', e))

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    icon: getAppIconPath(),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow = win

  const emitMaximizedState = (): void => {
    win.webContents.send('window:maximized-changed', win.isMaximized())
  }
  win.on('maximize', emitMaximizedState)
  win.on('unmaximize', emitMaximizedState)

  win.on('ready-to-show', () => {
    win.show()
  })

  // 关闭 → 最小化到托盘（仅当非真正退出时）
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.gvchat.desktop')

  // Only the app window may request microphone/camera access for WebRTC calls.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' && webContents === mainWindow?.webContents)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  db = new ChatDatabase(join(app.getPath('userData'), 'gv-chat.db'))
  registerDbIpc(db)
  registerNotifyIpc()
  registerApiIpc()
  registerMediaIpc()
  registerWindowIpc()
  registerE2eeIpc()
  registerHybridIpc()

  createWindow()
  createTray(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  // 保留托盘，窗口全关不退出（除非真正退出）
})

app.on('will-quit', () => {
  db?.close()
  db = null
})
