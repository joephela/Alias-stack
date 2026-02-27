'use strict'

const os   = require('os')
const path = require('path')
const fs   = require('fs')

// ── Regex ─────────────────────────────────────────────────────────────────────
// Matches:  alias gs='git status' # Short for git status
// Groups:   [1]=name  [2]=quote  [3]=command  [4]=description
const ALIAS_RE = /^alias\s+([\w.:\-]+)\s*=\s*(['"])([\s\S]*?)\2\s*(?:#\s*(.*))?$/

// ── Shell File Resolution ─────────────────────────────────────────────────────

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

  // Fallback for fish, dash, etc.
  return path.join(home, '.bashrc')
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function parseLines(lines) {
  return lines.reduce((aliases, line, index) => {
    const match = ALIAS_RE.exec(line.trim())
    if (match) {
      aliases.push({
        name:        match[1],
        command:     match[3],
        description: match[4] ? match[4].trim() : '',
        _lineIndex:  index,
      })
    }
    return aliases
  }, [])
}

// ── Serialization ─────────────────────────────────────────────────────────────

function quoteCommand(command) {
  // Use double quotes if command contains single quotes, else single quotes
  if (command.includes("'")) return `"${command}"`
  return `'${command}'`
}

function aliasToLine({ name, command, description }) {
  const quoted  = quoteCommand(command)
  const comment = description && description.trim() ? ` # ${description.trim()}` : ''
  return `alias ${name}=${quoted}${comment}`
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getAll() {
  const filePath    = resolveShellFile()
  const displayPath = filePath.replace(os.homedir(), '~')

  if (!fs.existsSync(filePath)) {
    return { filePath, displayPath, aliases: [] }
  }

  const content = await fs.promises.readFile(filePath, 'utf8')
  const lines   = content.split('\n')
  const parsed  = parseLines(lines)

  // Strip internal _lineIndex before returning
  const aliases = parsed.map(({ name, command, description }) =>
    ({ name, command, description })
  )

  return { filePath, displayPath, aliases }
}

async function save({ name, command, description }) {
  const filePath = resolveShellFile()

  // Create file if missing (common for .bash_aliases)
  if (!fs.existsSync(filePath)) {
    await fs.promises.writeFile(filePath, '', 'utf8')
  }

  const content = await fs.promises.readFile(filePath, 'utf8')
  const lines   = content.split('\n')
  const parsed  = parseLines(lines)
  const newLine = aliasToLine({ name, command, description })

  const existing = parsed.find(a => a.name === name)

  let updatedLines
  if (existing) {
    // Replace in-place — all other lines untouched
    updatedLines = lines.map((line, i) =>
      i === existing._lineIndex ? newLine : line
    )
  } else {
    // Append — add blank separator if last line is not already blank
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('')
    }
    lines.push(newLine)
    updatedLines = lines
  }

  const output = updatedLines.join('\n')
  await fs.promises.writeFile(
    filePath,
    output.endsWith('\n') ? output : output + '\n',
    'utf8'
  )
}

async function remove(name) {
  const filePath = resolveShellFile()

  if (!fs.existsSync(filePath)) return

  const content = await fs.promises.readFile(filePath, 'utf8')
  const lines   = content.split('\n')
  const parsed  = parseLines(lines)

  const target = parsed.find(a => a.name === name)
  if (!target) return  // Idempotent — not an error

  const updatedLines = lines.filter((_, i) => i !== target._lineIndex)
  await fs.promises.writeFile(filePath, updatedLines.join('\n'), 'utf8')
}

module.exports = {
  resolveShellFile,
  getAll,
  save,
  remove,
  // Exported for unit testing:
  parseLines,
  aliasToLine,
  quoteCommand,
}
