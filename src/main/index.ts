import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { answer, dismiss, focusAgent, getState, PORT, startInbox, type Reply } from './inbox'

// Panel is 380px wide; the window adds 4px on the right/bottom for the solid CSS shadow.
const WIDTH = 384
const HEIGHT = { compact: 154, expanded: 724 }
const MARGIN = 16
/** Expanded window fits its content between these; HEIGHT.expanded is the cap. */
const MIN_EXPANDED = 200

let win: BrowserWindow | null = null
let mode: keyof typeof HEIGHT = 'compact'

function createWindow(): void {
  const { workArea } = screen.getPrimaryDisplay()
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT.compact,
    x: workArea.x + workArea.width - WIDTH - MARGIN,
    y: workArea.y + MARGIN,
    title: 'Agent Inbox',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true }
  })
  win.setAlwaysOnTop(true, 'floating')
  // Never steal keyboard focus: show without activating.
  win.once('ready-to-show', () => win?.showInactive())
  win.on('focus', () => win?.flashFrame(false))

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// Both keep the top-left corner where it is (no showInactive/focus: never steals focus).
ipcMain.on('set-mode', (_e, next: keyof typeof HEIGHT) => {
  if (!win || !(next in HEIGHT)) return
  mode = next
  const { x, y } = win.getBounds()
  win.setBounds({ x, y, width: WIDTH, height: HEIGHT[mode] })
})

ipcMain.on('fit-height', (_e, height: number) => {
  if (!win || mode !== 'expanded' || !Number.isFinite(height)) return
  const { x, y } = win.getBounds()
  win.setBounds({ x, y, width: WIDTH, height: Math.round(Math.min(HEIGHT.expanded, Math.max(MIN_EXPANDED, height))) })
})

ipcMain.on('set-pinned', (_e, pinned: boolean) => win?.setAlwaysOnTop(pinned, 'floating'))

ipcMain.handle('inbox:get', () => getState())
ipcMain.on('inbox:dismiss', (_e, id: string) => dismiss(id))
ipcMain.handle('inbox:focus', (_e, agentId: string) => focusAgent(agentId))
ipcMain.handle('inbox:answer', (_e, id: string, reply: Reply) => answer(id, reply ?? {}))

function onInboxChange(added: boolean): void {
  if (!win) return
  win.webContents.send('inbox:state', getState())
  // Draw attention via the taskbar button without taking focus.
  if (added && !win.isFocused()) win.flashFrame(true)
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.whenReady().then(() => {
    createWindow()
    startInbox(onInboxChange).on('error', (err: NodeJS.ErrnoException) => {
      console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is busy; quitting.` : err)
      app.quit()
    })
  })
}

app.on('window-all-closed', () => app.quit())
