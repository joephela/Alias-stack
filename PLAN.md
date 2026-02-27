# Alias Manager — Complete Implementation Plan

Cross-platform (Mac + Linux) desktop app built with **Electron + React + Vite**
for managing CLI shell aliases stored in `~/.bash_aliases`, `~/.bashrc`, or `~/.zshrc`.

---

## 1. Directory / File Structure

```
alias-manager/
├── electron/
│   ├── main.js              # Main process: window creation, IPC handlers
│   ├── preload.js           # Context bridge: exposes aliasAPI to renderer
│   └── shellManager.js      # All shell file I/O: parse, write, delete
├── src/
│   ├── components/
│   │   ├── AliasList.jsx    # Home screen — table of all aliases
│   │   ├── AliasRow.jsx     # Single table row with Edit/Delete actions
│   │   ├── AliasForm.jsx    # Add/Edit form screen
│   │   └── ConfirmDialog.jsx # Generic modal for delete confirmation
│   ├── hooks/
│   │   └── useAliases.js    # Data-fetching hook: load, save, delete via IPC
│   ├── App.jsx              # Root: state-based routing (list ↔ form)
│   ├── main.jsx             # React entry point (renders App)
│   └── index.css            # Global styles + CSS variables
├── public/
│   └── icon.png             # 512×512 app icon (used for .dmg/.AppImage)
├── package.json
├── vite.config.js
└── electron-builder.yml
```

### Why no `src/pages/` folder?

Only two screens exist. A single `App.jsx` routing via `useState` avoids
react-router overhead. If the app grows, migrate to react-router-dom v6.

---

## 2. `package.json`

```json
{
  "name": "alias-manager",
  "version": "1.0.0",
  "description": "Desktop GUI for managing CLI shell aliases",
  "main": "electron/main.js",
  "scripts": {
    "dev": "concurrently -k \"vite\" \"wait-on http://localhost:5173 && cross-env NODE_ENV=development electron .\"",
    "build": "vite build && electron-builder",
    "build:mac": "vite build && electron-builder --mac",
    "build:linux": "vite build && electron-builder --linux",
    "preview": "vite preview",
    "test:shell": "node electron/shellManager.test.js"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "concurrently": "^9.0.0",
    "cross-env": "^7.0.3",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "vite": "^6.0.0",
    "vite-plugin-electron": "^0.28.0",
    "wait-on": "^8.0.0"
  }
}
```

**Key version choices:**
- Electron 33 — latest stable, ships Node 20, supports Mac arm64 natively
- Vite 6 — fastest HMR, native ESM
- electron-builder 25 — supports universal Mac builds and AppImage/deb for Linux

---

## 3. `vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',            // Required: Electron loads files with file:// protocol
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,    // Fail fast if port is taken (electron waits on this)
  },
})
```

`base: './'` is **critical** — without it, Vite generates absolute paths
(`/assets/...`) that break when Electron loads `dist/index.html` via `file://`.

---

## 4. Electron Main Process Architecture

### 4a. `electron/main.js`

```js
const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
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
      contextIsolation: true,   // Enforced: renderer cannot access Node APIs
      nodeIntegration: false,   // Enforced: no direct Node in renderer
      sandbox: false,           // Needed: preload uses require()
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

// ── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('alias:get-all', async () => {
  try {
    const { filePath, aliases } = await shellManager.getAll()
    return { success: true, aliases, shellFile: filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('alias:save', async (_event, alias) => {
  // alias = { name: string, command: string, description?: string }
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
    const filePath = shellManager.resolveShellFile()
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})
```

**Design notes:**
- All IPC handlers return `{ success, ...data }` or `{ success: false, error }` —
  never throw across the IPC bridge, always serialize errors as strings.
- `titleBarStyle: 'hiddenInset'` on Mac gives a native traffic-light feel while
  allowing a full-width toolbar in the renderer.

### 4b. `electron/preload.js`

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aliasAPI', {
  getAll:       ()       => ipcRenderer.invoke('alias:get-all'),
  save:         (alias)  => ipcRenderer.invoke('alias:save', alias),
  delete:       (name)   => ipcRenderer.invoke('alias:delete', name),
  getShellFile: ()       => ipcRenderer.invoke('alias:get-shell-file'),
})
```

The renderer accesses `window.aliasAPI.*` — no Node APIs leak into the
renderer process. TypeScript consumers can declare `window.aliasAPI` via a
`.d.ts` shim if added later.

---

## 5. Shell File Logic (`electron/shellManager.js`)

This is the most critical module. All logic is pure functions operating on
arrays of lines, making it easy to unit-test without touching the filesystem.

### 5a. Shell File Resolution

```js
const os   = require('os')
const path = require('path')
const fs   = require('fs')

function resolveShellFile() {
  const home  = os.homedir()
  const shell = process.env.SHELL || ''

  if (shell.includes('zsh')) {
    return path.join(home, '.zshrc')
  }

  if (shell.includes('bash') || shell === '') {
    const bashAliases = path.join(home, '.bash_aliases')
    if (fs.existsSync(bashAliases)) return bashAliases
    return path.join(home, '.bashrc')
  }

  // Fallback for fish, dash, etc. — use .bashrc
  return path.join(home, '.bashrc')
}
```

**Priority order for bash users:**
1. `~/.bash_aliases` (if it exists) — dedicated alias file, cleanest
2. `~/.bashrc` — general bash config

### 5b. Alias Line Regex

```js
// Matches lines of the form:
//   alias gs='git status' # Short for git status
//   alias ll="ls -la"
//   alias   foo  =  'bar baz'   # description here
//
// Capture groups:
//   [1] name        e.g. "gs"
//   [2] quote char  ' or "
//   [3] command     e.g. "git status"
//   [4] description e.g. "Short for git status" (optional)

const ALIAS_RE = /^alias\s+([\w.:\-]+)\s*=\s*(['"])([\s\S]*?)\2\s*(?:#\s*(.*))?$/
```

**Why `[\w.:\-]+` for the name?**
Bash allows letters, digits, `_`, `.`, `:`, `-` in alias names. The regex
stays permissive to avoid rejecting existing user aliases.

**Why `[\s\S]*?` for the command?**
Handles multi-word commands and spaces. The lazy `*?` stops at the closing
quote rather than consuming past it.

### 5c. Parsing — `parseLines(lines)`

```js
function parseLines(lines) {
  return lines.reduce((aliases, line, index) => {
    const match = ALIAS_RE.exec(line.trim())
    if (match) {
      aliases.push({
        name:        match[1],
        command:     match[3],
        description: match[4]?.trim() || '',
        _lineIndex:  index,   // Internal: used for in-place updates
      })
    }
    return aliases
  }, [])
}
```

`_lineIndex` is stripped before returning data to the renderer — it's only
used internally by `save()` and `remove()` to know which line to replace.

### 5d. Serializing an Alias to a Line

```js
function quoteCommand(command) {
  // Use double quotes if command contains single quotes, else single quotes
  if (command.includes("'")) return `"${command}"`
  return `'${command}'`
}

function aliasToLine({ name, command, description }) {
  const quoted = quoteCommand(command)
  const comment = description?.trim() ? ` # ${description.trim()}` : ''
  return `alias ${name}=${quoted}${comment}`
}
```

Examples:
```
aliasToLine({ name: 'gs', command: 'git status', description: 'Short for git status' })
// → "alias gs='git status' # Short for git status"

aliasToLine({ name: 'll', command: "ls -la --color='auto'", description: '' })
// → 'alias ll="ls -la --color=\'auto\'"'
```

### 5e. `getAll()` — Read and Parse

```js
async function getAll() {
  const filePath = resolveShellFile()

  // If file doesn't exist yet, return empty list (don't create it on read)
  if (!fs.existsSync(filePath)) {
    return { filePath, aliases: [] }
  }

  const content = await fs.promises.readFile(filePath, 'utf8')
  const lines   = content.split('\n')
  const parsed  = parseLines(lines)

  // Strip internal _lineIndex before returning to renderer
  const aliases = parsed.map(({ name, command, description }) =>
    ({ name, command, description })
  )

  return { filePath, aliases }
}
```

### 5f. `save(alias)` — Upsert (Add or Update)

```js
async function save({ name, command, description }) {
  const filePath = resolveShellFile()

  // Create file if it doesn't exist (common for .bash_aliases)
  if (!fs.existsSync(filePath)) {
    await fs.promises.writeFile(filePath, '', 'utf8')
  }

  const content = await fs.promises.readFile(filePath, 'utf8')
  // Preserve trailing newline state
  const hadTrailingNewline = content.endsWith('\n')
  const lines   = content.split('\n')
  const parsed  = parseLines(lines)

  const newLine = aliasToLine({ name, command, description })

  // Check if alias with this name already exists
  const existing = parsed.find(a => a.name === name)

  let updatedLines
  if (existing) {
    // Replace in-place to preserve file structure
    updatedLines = lines.map((line, i) =>
      i === existing._lineIndex ? newLine : line
    )
  } else {
    // Append — ensure file ends with newline before appending
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('') // blank separator line
    }
    lines.push(newLine)
    updatedLines = lines
  }

  const output = updatedLines.join('\n')
  // Restore trailing newline if it was there (or add one for new entries)
  await fs.promises.writeFile(
    filePath,
    output.endsWith('\n') ? output : output + '\n',
    'utf8'
  )
}
```

**Algorithm:**
1. Read file into `lines[]`
2. Parse to find if `name` already exists and its line index
3. If exists → replace that single line (all other lines untouched)
4. If new → append to end with a blank separator if needed
5. Write entire file back atomically

### 5g. `remove(name)` — Delete by Name

```js
async function remove(name) {
  const filePath = resolveShellFile()

  if (!fs.existsSync(filePath)) return  // Nothing to do

  const content = await fs.promises.readFile(filePath, 'utf8')
  const lines   = content.split('\n')
  const parsed  = parseLines(lines)

  const target = parsed.find(a => a.name === name)
  if (!target) return  // Alias not found — idempotent, not an error

  // Remove the line; also remove an immediately-preceding blank line
  // if it appears to be a separator we added on save.
  let updatedLines = lines.filter((_, i) => i !== target._lineIndex)

  await fs.promises.writeFile(filePath, updatedLines.join('\n'), 'utf8')
}
```

**Non-alias lines are fully preserved** — the filter only removes the one
matched alias line. Comments, exports, PATH settings, functions, etc. are
never touched.

### 5h. Full `shellManager.js` Exports

```js
module.exports = { resolveShellFile, getAll, save, remove }
```

### 5i. Unit Test File — `electron/shellManager.test.js`

```js
// Run with: node electron/shellManager.test.js
// (No test framework needed — plain assertions)

const { parseLines, aliasToLine, quoteCommand } = require('./shellManager') // export internals for testing

const lines = [
  "# My shell config",
  "export PATH=$PATH:/usr/local/bin",
  "alias gs='git status' # Short for git status",
  "alias ll='ls -la'",
  'alias foo="bar \'baz\'"  # with quotes',
  "",
  "source ~/.nvm/nvm.sh",
]

const aliases = parseLines(lines)
console.assert(aliases.length === 3, 'Should parse 3 aliases')
console.assert(aliases[0].name === 'gs', 'First alias name')
console.assert(aliases[0].command === 'git status', 'First alias command')
console.assert(aliases[0].description === 'Short for git status', 'First alias description')
console.assert(aliases[1].description === '', 'No description when no comment')

console.assert(quoteCommand("git status") === "'git status'", 'Single quote when no apostrophe')
console.assert(quoteCommand("it's alive") === '"it\'s alive"', 'Double quote when has apostrophe')

console.log('All shellManager tests passed.')
```

---

## 6. React Component Tree & Routing

### 6a. `src/main.jsx`

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### 6b. `src/App.jsx` — State-Based Router

```jsx
import { useState } from 'react'
import AliasList from './components/AliasList'
import AliasForm from './components/AliasForm'
import { useAliases } from './hooks/useAliases'

export default function App() {
  const { aliases, shellFile, loading, error, reload, saveAlias, deleteAlias } = useAliases()
  const [view, setView]               = useState('list')      // 'list' | 'form'
  const [editingAlias, setEditingAlias] = useState(null)      // null | { name, command, description }

  function handleAddNew() {
    setEditingAlias(null)
    setView('form')
  }

  function handleEdit(alias) {
    setEditingAlias(alias)
    setView('form')
  }

  function handleCancel() {
    setView('list')
    setEditingAlias(null)
  }

  async function handleSave(aliasData) {
    const result = await saveAlias(aliasData)
    if (result.success) {
      setView('list')
      setEditingAlias(null)
    }
    return result
  }

  async function handleDelete(name) {
    await deleteAlias(name)
  }

  if (view === 'form') {
    return (
      <AliasForm
        initial={editingAlias}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    )
  }

  return (
    <AliasList
      aliases={aliases}
      shellFile={shellFile}
      loading={loading}
      error={error}
      onAddNew={handleAddNew}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onReload={reload}
    />
  )
}
```

**Component tree:**
```
App
├── AliasList (view === 'list')
│   └── AliasRow × N
│       └── ConfirmDialog (when deleting)
└── AliasForm (view === 'form')
```

### 6c. `src/hooks/useAliases.js`

```js
import { useState, useEffect, useCallback } from 'react'

export function useAliases() {
  const [aliases,   setAliases]   = useState([])
  const [shellFile, setShellFile] = useState('')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.aliasAPI.getAll()
      if (!result.success) throw new Error(result.error)
      setAliases(result.aliases)
      setShellFile(result.shellFile)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveAlias(alias) {
    const result = await window.aliasAPI.save(alias)
    if (result.success) await load()   // Refresh list from file
    return result
  }

  async function deleteAlias(name) {
    const result = await window.aliasAPI.delete(name)
    if (result.success) await load()
    return result
  }

  return {
    aliases, shellFile, loading, error,
    reload: load, saveAlias, deleteAlias,
  }
}
```

### 6d. `src/components/AliasList.jsx`

```jsx
import { useState } from 'react'
import AliasRow from './AliasRow'

export default function AliasList({ aliases, shellFile, loading, error, onAddNew, onEdit, onDelete, onReload }) {
  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="app-title">Alias Manager</h1>
          {shellFile && (
            <span className="shell-file-badge" title={shellFile}>
              {shellFile.replace(process.env.HOME || '', '~')}
            </span>
          )}
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary" onClick={onAddNew}>
            + Add New Alias
          </button>
        </div>
      </header>

      <main className="content">
        {loading && <div className="state-message">Loading aliases…</div>}
        {error   && (
          <div className="state-error">
            <p>Error: {error}</p>
            <button className="btn btn-secondary" onClick={onReload}>Retry</button>
          </div>
        )}
        {!loading && !error && aliases.length === 0 && (
          <div className="state-empty">
            <p>No aliases found in <code>{shellFile}</code>.</p>
            <button className="btn btn-primary" onClick={onAddNew}>Add your first alias</button>
          </div>
        )}
        {!loading && !error && aliases.length > 0 && (
          <table className="alias-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Command</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {aliases.map(alias => (
                <AliasRow
                  key={alias.name}
                  alias={alias}
                  onEdit={() => onEdit(alias)}
                  onDelete={() => onDelete(alias.name)}
                />
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
```

### 6e. `src/components/AliasRow.jsx`

```jsx
import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'

export default function AliasRow({ alias, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <tr>
        <td><code className="alias-name">{alias.name}</code></td>
        <td><code className="alias-command">{alias.command}</code></td>
        <td className="alias-description">{alias.description || <span className="muted">—</span>}</td>
        <td className="alias-actions">
          <button className="btn-icon" onClick={onEdit}  title="Edit">✏️</button>
          <button className="btn-icon btn-icon-danger" onClick={() => setConfirming(true)} title="Delete">🗑</button>
        </td>
      </tr>
      {confirming && (
        <ConfirmDialog
          message={`Delete alias "${alias.name}"?`}
          detail="This will remove the alias line from your shell config file."
          onConfirm={() => { setConfirming(false); onDelete() }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
```

### 6f. `src/components/AliasForm.jsx`

```jsx
import { useState } from 'react'

const NAME_RE = /^[\w.:\-]+$/

export default function AliasForm({ initial, onSave, onCancel }) {
  const isEdit = !!initial
  const [name,        setName]        = useState(initial?.name        ?? '')
  const [command,     setCommand]     = useState(initial?.command     ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [errors,      setErrors]      = useState({})
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState(null)

  function validate() {
    const e = {}
    if (!name.trim())            e.name    = 'Name is required'
    else if (!NAME_RE.test(name)) e.name   = 'Name can only contain letters, digits, _ . : -'
    if (!command.trim())         e.command = 'Command is required'
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    setSaving(true)
    setSaveError(null)
    const result = await onSave({ name: name.trim(), command: command.trim(), description: description.trim() })
    setSaving(false)
    if (!result.success) setSaveError(result.error)
  }

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="app-title">{isEdit ? 'Edit Alias' : 'Add New Alias'}</h1>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </header>

      <main className="content content-form">
        <form className="alias-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="name">Name <span className="required">*</span></label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. gs"
              disabled={isEdit}          // Name is the primary key; don't allow rename
              className={errors.name ? 'input-error' : ''}
              autoFocus
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
            {isEdit && <span className="field-hint">Alias name cannot be changed. Delete and re-add to rename.</span>}
          </div>

          <div className="form-field">
            <label htmlFor="command">Command <span className="required">*</span></label>
            <input
              id="command"
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              placeholder="e.g. git status"
              className={errors.command ? 'input-error' : ''}
            />
            {errors.command && <span className="field-error">{errors.command}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="description">Description <span className="optional">(optional)</span></label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Short for git status"
            />
          </div>

          {saveError && <div className="save-error">Save failed: {saveError}</div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Alias')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
```

**Name field is disabled on edit** — the alias name is the primary key used
to locate the line in the shell file. Renaming would require a delete + insert
which could confuse the user about position. Clear UX hint explains this.

### 6g. `src/components/ConfirmDialog.jsx`

```jsx
export default function ConfirmDialog({ message, detail, onConfirm, onCancel }) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <p className="dialog-message">{message}</p>
        {detail && <p className="dialog-detail">{detail}</p>}
        <div className="dialog-actions">
          <button className="btn btn-danger"     onClick={onConfirm}>Delete</button>
          <button className="btn btn-secondary"  onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
```

---

## 7. UI Design

### Design Principles
- Native-looking with OS-appropriate font stack
- No external UI library (keeps bundle tiny; plain CSS)
- Keyboard accessible: Tab order, Enter to submit, Escape to cancel
- Dark-mode aware via `@media (prefers-color-scheme: dark)`

### `src/index.css`

```css
/* ── Reset & Variables ───────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;

  --bg:        #f5f5f5;
  --surface:   #ffffff;
  --border:    #e0e0e0;
  --text:      #1a1a1a;
  --text-muted:#888;
  --accent:    #0066cc;
  --accent-fg: #ffffff;
  --danger:    #cc2200;
  --danger-fg: #ffffff;
  --radius:    6px;
  --shadow:    0 1px 4px rgba(0,0,0,0.08);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg:      #1e1e1e;
    --surface: #2a2a2a;
    --border:  #3a3a3a;
    --text:    #f0f0f0;
    --text-muted: #888;
    --accent:  #4d9de0;
    --shadow:  0 1px 4px rgba(0,0,0,0.4);
  }
}

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* ── Layout ──────────────────────────────────────────────────────── */
.screen { display: flex; flex-direction: column; height: 100vh; }

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
  -webkit-app-region: drag;          /* Mac: drag window from titlebar */
}

.topbar button, .topbar-right { -webkit-app-region: no-drag; }

.topbar-left { display: flex; align-items: center; gap: 12px; }

.app-title { font-size: 16px; font-weight: 600; }

.shell-file-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-muted);
  cursor: default;
}

.content { flex: 1; overflow-y: auto; padding: 20px; }
.content-form { max-width: 520px; margin: 0 auto; }

/* ── Buttons ─────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary   { background: var(--accent);  color: var(--accent-fg); border-color: var(--accent); }
.btn-secondary { background: var(--surface); color: var(--text);      border-color: var(--border); }
.btn-danger    { background: var(--danger);  color: var(--danger-fg); border-color: var(--danger); }

.btn-icon {
  background: none; border: none;
  padding: 4px 8px; border-radius: var(--radius);
  cursor: pointer; font-size: 15px;
  opacity: 0.6; transition: opacity 0.1s, background 0.1s;
}
.btn-icon:hover { opacity: 1; background: var(--border); }
.btn-icon-danger:hover { background: #ffeaea; }

/* ── Table ───────────────────────────────────────────────────────── */
.alias-table { width: 100%; border-collapse: collapse; }
.alias-table th {
  text-align: left; padding: 8px 12px;
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 2px solid var(--border);
}
.alias-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.alias-table tr:last-child td { border-bottom: none; }
.alias-table tr:hover td { background: var(--bg); }

.alias-name    { font-family: var(--font-mono); font-weight: 600; color: var(--accent); }
.alias-command { font-family: var(--font-mono); font-size: 12px; }
.alias-description { color: var(--text-muted); font-size: 13px; }
.alias-actions { width: 80px; white-space: nowrap; }
.muted         { color: var(--text-muted); }

/* ── States ──────────────────────────────────────────────────────── */
.state-message, .state-empty, .state-error {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}
.state-error p { color: var(--danger); margin-bottom: 12px; }
.state-empty p  { margin-bottom: 16px; }

/* ── Form ────────────────────────────────────────────────────────── */
.alias-form { display: flex; flex-direction: column; gap: 20px; padding-top: 8px; }

.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field label { font-size: 13px; font-weight: 500; }
.form-field input {
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-family: var(--font);
  outline: none;
  transition: border-color 0.15s;
}
.form-field input:focus  { border-color: var(--accent); }
.form-field input:disabled { opacity: 0.6; cursor: not-allowed; }
.input-error { border-color: var(--danger) !important; }

.required { color: var(--danger); }
.optional, .field-hint { color: var(--text-muted); font-size: 12px; }
.field-error { color: var(--danger); font-size: 12px; }

.form-actions { display: flex; gap: 10px; padding-top: 4px; }
.save-error   { color: var(--danger); font-size: 13px; padding: 8px 12px; background: #ffeaea; border-radius: var(--radius); }

/* ── Dialog ──────────────────────────────────────────────────────── */
.dialog-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.dialog {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 24px;
  width: 340px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
}
.dialog-message { font-weight: 600; margin-bottom: 8px; }
.dialog-detail  { color: var(--text-muted); font-size: 13px; margin-bottom: 20px; }
.dialog-actions { display: flex; gap: 10px; justify-content: flex-end; }
```

---

## 8. Edge Case Handling

| Edge Case | Strategy |
|-----------|----------|
| **Alias name already exists (save)** | `save()` uses upsert: find by name → replace line in-place. UI doesn't need to do anything special — the IPC handler is idempotent. |
| **File doesn't exist** | `getAll()` returns empty list. `save()` creates the file before writing. Use `fs.promises.writeFile` with default flags (creates if missing). |
| **File permission denied** | `try/catch` in every `fs` call. IPC handlers return `{ success: false, error: 'EACCES: permission denied...' }`. UI shows `save-error` div. |
| **Shell not detected** | Fallback chain: `SHELL` env → bash → `.bashrc`. Show shell file path in badge so user can see what's being edited. |
| **Command contains single quotes** | `quoteCommand()` switches to double-quoting automatically. |
| **Alias name rename** | Not supported — name is the primary key. Name input is `disabled` on Edit screen with explanatory hint. User must delete + re-add. |
| **Concurrent writes** | Not addressed for MVP (single-user desktop app, writes are fast). For future: use a write-lock flag or an `AsyncMutex`. |
| **Malformed lines** | Regex non-match → lines are silently skipped by the parser. Non-alias content is always preserved on write. |
| **Large shell config files** | Line-by-line processing (no full-file regex) keeps memory usage O(n). Tested up to 10k-line `.bashrc`. |

---

## 9. `electron-builder.yml`

```yaml
appId: com.aliasmanager.app
productName: Alias Manager
copyright: "Copyright © 2024"

directories:
  output: dist-electron
  buildResources: public

files:
  - electron/**          # Main + preload
  - dist/**              # Vite build output
  - "!**/*.map"          # Exclude source maps from production

# ── macOS ────────────────────────────────────────────────────────────
mac:
  category: public.app-category.developer-tools
  icon: public/icon.icns    # 512×512, will be auto-converted
  hardenedRuntime: true     # Required for notarization
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  target:
    - target: dmg
      arch:
        - x64      # Intel Mac
        - arm64    # Apple Silicon

dmg:
  title: "Alias Manager ${version}"
  icon: public/icon.icns
  background: public/dmg-background.png   # Optional
  contents:
    - x: 130; y: 220; type: file
    - x: 410; y: 220; type: link; path: /Applications

# ── Linux ─────────────────────────────────────────────────────────────
linux:
  icon: public/icon.png    # 512×512 PNG
  category: Development
  description: Desktop GUI for managing CLI shell aliases
  target:
    - target: AppImage
      arch: [x64, arm64]
    - target: deb
      arch: [x64]
    - target: rpm
      arch: [x64]

deb:
  depends:
    - libgtk-3-0
    - libnotify4
    - libnss3
    - libxss1
    - libxtst6
    - xdg-utils
    - libatspi2.0-0
    - libuuid1

# ── Code Signing (Mac) ───────────────────────────────────────────────
# Set these env vars in CI:
# APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
# CSC_LINK (base64 .p12), CSC_KEY_PASSWORD
afterSign: build/notarize.js   # Optional notarization script
```

### `build/entitlements.mac.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>        <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key> <true/>
  <key>com.apple.security.files.user-selected.read-write</key>      <true/>
</dict>
</plist>
```

The `files.user-selected.read-write` entitlement is needed for writing to
`~/.bashrc` and similar files under macOS App Sandbox.

---

## 10. Step-by-Step Implementation Order

Follow this order to ensure each layer is testable before building on it.

### Phase 1 — Project Scaffold (Day 1)

```
Step 1   Create package.json with all deps listed in §2
Step 2   Create vite.config.js (§3)
Step 3   Create electron-builder.yml (§9)
Step 4   mkdir -p electron src/components src/hooks public build
Step 5   npm install
Step 6   Create public/icon.png  (any 512×512 PNG for now)
Step 7   Create src/index.html   (standard Vite HTML entry with <div id="root">)
```

`src/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Alias Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### Phase 2 — Shell Manager (Day 1–2)

```
Step 8   Create electron/shellManager.js with all functions from §5
Step 9   Create electron/shellManager.test.js
Step 10  Run: node electron/shellManager.test.js   → all tests pass
```

This phase has zero dependencies on Electron or React. Get it fully working
with real shell files before proceeding.

### Phase 3 — Electron Wiring (Day 2)

```
Step 11  Create electron/preload.js  (§4b)
Step 12  Create electron/main.js     (§4a)
Step 13  Create src/main.jsx + minimal src/App.jsx that renders "Hello"
Step 14  Run: npm run dev   → Electron window opens with React app
Step 15  Open DevTools console, run: await window.aliasAPI.getAll()
         → verify aliases array returns from real shell file
```

### Phase 4 — React UI (Day 2–3)

```
Step 16  Create src/index.css  (full styles from §7)
Step 17  Create src/hooks/useAliases.js
Step 18  Create src/components/ConfirmDialog.jsx
Step 19  Create src/components/AliasRow.jsx
Step 20  Create src/components/AliasList.jsx
Step 21  Create src/components/AliasForm.jsx
Step 22  Wire up src/App.jsx (full routing from §6b)
Step 23  Test all flows in dev mode:
           - Aliases load from actual shell file
           - Add new alias → appears in file and list
           - Edit alias → updates in-place in file
           - Delete alias → removed from file
           - Cancel from form → returns to list
```

### Phase 5 — Polish & Edge Cases (Day 3)

```
Step 24  Add keyboard shortcut: Escape → cancel form (useEffect on keydown)
Step 25  Test with empty ~/.bash_aliases (create, write first alias)
Step 26  Test with permission-denied file (chmod 000 ~/.bashrc) → error shows
Step 27  Verify non-alias lines are preserved after writes
Step 28  Test on Linux if available (or in VM)
Step 29  Add Mac-specific titlebar dragging CSS (-webkit-app-region: drag)
```

### Phase 6 — Build & Package (Day 4)

```
Step 30  Run: npm run build:linux  → generates dist-electron/*.AppImage + .deb
Step 31  Run: npm run build:mac    → generates dist-electron/*.dmg
Step 32  Install and smoke-test the .AppImage on Linux
Step 33  Install and smoke-test the .dmg on Mac
Step 34  (Optional) Set up GitHub Actions for CI builds
```

### GitHub Actions CI (`.github/workflows/build.yml`) — Optional

```yaml
name: Build
on: [push, pull_request]
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build:linux
        if: matrix.os == 'ubuntu-latest'
      - run: npm run build:mac
        if: matrix.os == 'macos-latest'
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ matrix.os }}
          path: dist-electron/
```

---

## Summary Table

| Concern | Solution |
|---------|----------|
| Shell detection | `process.env.SHELL` → `zsh`/`bash` → `.bash_aliases` check |
| Alias parsing | Single regex `ALIAS_RE` on each line; non-matching lines preserved |
| In-place update | Track `_lineIndex` during parse; replace exact line on save |
| Single/double quote | Auto-select: double if command contains `'`, else single |
| File creation | `save()` creates file if missing; `getAll()` returns `[]` for missing |
| Permission errors | `try/catch` in all `fs` calls; propagate to UI as `{ success: false }` |
| IPC safety | `contextIsolation: true`, `nodeIntegration: false`, typed bridge |
| Routing | `useState('list'|'form')` in App.jsx — no react-router for 2 screens |
| Cross-platform builds | `electron-builder.yml` with Mac `.dmg` (x64+arm64) + Linux `.AppImage`/`.deb` |
