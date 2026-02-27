'use strict'

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const os   = require('os')
const shellManager = require('./shellManager')

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // Renderer cannot access Node APIs
      nodeIntegration: false,   // No direct Node in renderer
      sandbox: false,           // Preload needs require()
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('alias:get-all', async () => {
  try {
    const result = await shellManager.getAll()
    return {
      success: true,
      aliases: result.aliases,
      shellFile: result.filePath,
      shellFileDisplay: result.displayPath,
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('alias:save', async (_event, alias) => {
  // alias = { name, command, description }
  try {
    await shellManager.save(alias)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('alias:delete', async (_event, name) => {
  try {
    await shellManager.remove(name)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('alias:get-shell-file', async () => {
  try {
    const filePath    = shellManager.resolveShellFile()
    const displayPath = filePath.replace(os.homedir(), '~')
    return { success: true, path: filePath, displayPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
