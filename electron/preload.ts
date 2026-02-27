'use strict'

import { contextBridge, ipcRenderer } from 'electron'
import type { Alias } from './shellManager'

contextBridge.exposeInMainWorld('aliasAPI', {
  getAll:       ()             => ipcRenderer.invoke('alias:get-all'),
  save:         (alias: Alias) => ipcRenderer.invoke('alias:save', alias),
  delete:       (name: string) => ipcRenderer.invoke('alias:delete', name),
  getShellFile: ()             => ipcRenderer.invoke('alias:get-shell-file'),
})
