# Alias Manager

A cross-platform desktop app for managing CLI shell aliases. Built with Electron, React, and Vite.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron) ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)

---

## What it does

Alias Manager provides a GUI for the aliases stored in your shell config file. No more manually editing `~/.zshrc` or `~/.bashrc` — add, edit, and delete aliases from a clean native interface, while your config file is updated automatically.

**Alias format written to your shell file:**
```sh
alias gs='git status'           # Short for git status
alias ll='ls -la'
alias k='kubectl'               # Kubernetes shorthand
```

---

## Shell file detection

The app automatically detects and reads from the right file:

| Shell | File used |
|-------|-----------|
| zsh   | `~/.zshrc` |
| bash  | `~/.bash_aliases` (if it exists), otherwise `~/.bashrc` |
| other | `~/.bashrc` (fallback) |

Non-alias lines (exports, PATH settings, functions, comments) are **never modified**.

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm 9+

### Install and run

```bash
# Clone the repo
git clone <repo-url>
cd alias-manager

# Install dependencies
npm install

# Run in development mode
npm run dev
```

This opens an Electron window connected to the Vite dev server with hot reload.

### Run unit tests

```bash
npm run test:shell
```

Runs 19 unit tests covering the shell file parser, quote selection, and alias serialization. No framework required — plain Node.js assertions.

---

## Building for distribution

```bash
# Linux (.AppImage + .deb + .rpm)
npm run build:linux

# macOS (.dmg — Intel + Apple Silicon)
npm run build:mac

# Both platforms (requires the right OS or CI)
npm run build
```

Output goes to `dist-electron/`.

### macOS notes

- Builds produce a **universal binary** (x64 + arm64 in one `.dmg`).
- For distribution outside the Mac App Store, set these environment variables for notarization:
  ```
  APPLE_ID
  APPLE_APP_SPECIFIC_PASSWORD
  APPLE_TEAM_ID
  CSC_LINK          # base64-encoded .p12 certificate
  CSC_KEY_PASSWORD
  ```

### Linux notes

- `.AppImage` runs on any modern Linux distribution without installation.
- `.deb` targets Debian/Ubuntu. `.rpm` targets Fedora/RHEL.

---

## Project structure

```
alias-manager/
├── electron/
│   ├── main.js              # Main process: window, IPC handlers
│   ├── preload.js           # contextBridge → window.aliasAPI
│   └── shellManager.js      # Shell file I/O: parse, upsert, delete
│   └── shellManager.test.js # Unit tests (run with npm run test:shell)
├── src/
│   ├── components/
│   │   ├── AliasList.jsx    # Home screen table
│   │   ├── AliasRow.jsx     # Table row with edit/delete actions
│   │   ├── AliasForm.jsx    # Add / edit form
│   │   └── ConfirmDialog.jsx# Delete confirmation modal
│   ├── hooks/
│   │   └── useAliases.js    # IPC data hook (load, save, delete)
│   ├── App.jsx              # State-based router (list ↔ form)
│   ├── main.jsx             # React entry point
│   └── index.css            # Styles + dark mode
├── public/
│   └── icon.png             # App icon (replace with your own 512×512)
├── build/
│   └── entitlements.mac.plist
├── index.html
├── package.json
├── vite.config.js
└── electron-builder.yml
```

---

## IPC API

The renderer communicates with the main process exclusively through `window.aliasAPI`:

| Method | Description | Returns |
|--------|-------------|---------|
| `aliasAPI.getAll()` | Read and parse all aliases from the shell file | `{ success, aliases[], shellFile, shellFileDisplay }` |
| `aliasAPI.save(alias)` | Add or update an alias (upsert by name) | `{ success, error? }` |
| `aliasAPI.delete(name)` | Remove an alias by name | `{ success, error? }` |
| `aliasAPI.getShellFile()` | Get the path to the current shell config file | `{ success, path, displayPath }` |

---

## Customizing the icon

Replace `public/icon.png` with a 512×512 PNG. For macOS, also provide `public/icon.icns` (electron-builder can auto-convert from a high-res PNG using `iconutil` on macOS).

---

## CI

GitHub Actions builds both platforms on every push to `main`:

```
.github/workflows/build.yml
```

Artifacts are uploaded and retained for 7 days.
