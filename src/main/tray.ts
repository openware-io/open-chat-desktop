/** 系统托盘：最小化到托盘、点击恢复、退出 */
import { Tray, Menu, nativeImage, app } from 'electron'
import type { BrowserWindow } from 'electron'
import { getAppIconPath } from './icon'

let tray: Tray | null = null

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  if (tray) return tray
  const icon = nativeImage.createFromPath(getAppIconPath())
  tray = new Tray(icon)
  tray.setToolTip('WV Chat')
  const menu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => getWindow()?.show() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => getWindow()?.show())
  return tray
}
