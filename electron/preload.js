'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aliasAPI', {
  getAll:       ()      => ipcRenderer.invoke('alias:get-all'),
  save:         (alias) => ipcRenderer.invoke('alias:save', alias),
  delete:       (name)  => ipcRenderer.invoke('alias:delete', name),
  getShellFile: ()      => ipcRenderer.invoke('alias:get-shell-file'),
})
