'use strict'

const assert = require('assert')
const { parseLines, aliasToLine, quoteCommand } = require('./shellManager')

let passed = 0
let failed = 0

function test(label, fn) {
  try {
    fn()
    console.log(`  ✓ ${label}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${label}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

// ── parseLines ────────────────────────────────────────────────────────────────

const sampleLines = [
  '# My shell config',
  'export PATH=$PATH:/usr/local/bin',
  "alias gs='git status' # Short for git status",
  "alias ll='ls -la'",
  'alias foo="bar baz"  # with spaces',
  '',
  'source ~/.nvm/nvm.sh',
]

console.log('\nparseLines:')

test('parses exactly 3 alias lines', () => {
  const aliases = parseLines(sampleLines)
  assert.strictEqual(aliases.length, 3)
})

test('parses name correctly', () => {
  const [a] = parseLines(sampleLines)
  assert.strictEqual(a.name, 'gs')
})

test('parses single-quoted command correctly', () => {
  const [a] = parseLines(sampleLines)
  assert.strictEqual(a.command, 'git status')
})

test('parses inline comment as description', () => {
  const [a] = parseLines(sampleLines)
  assert.strictEqual(a.description, 'Short for git status')
})

test('empty description when no comment', () => {
  const aliases = parseLines(sampleLines)
  assert.strictEqual(aliases[1].description, '')
})

test('parses double-quoted command correctly', () => {
  const aliases = parseLines(sampleLines)
  assert.strictEqual(aliases[2].command, 'bar baz')
})

test('tracks _lineIndex correctly', () => {
  const aliases = parseLines(sampleLines)
  assert.strictEqual(aliases[0]._lineIndex, 2)
  assert.strictEqual(aliases[1]._lineIndex, 3)
  assert.strictEqual(aliases[2]._lineIndex, 4)
})

test('ignores non-alias lines', () => {
  const nonAlias = ['# comment', 'export FOO=bar', '  ', '', 'source ~/.nvm']
  assert.strictEqual(parseLines(nonAlias).length, 0)
})

test('handles alias with no spaces around =', () => {
  const lines = ["alias g='git'"]
  const [a] = parseLines(lines)
  assert.strictEqual(a.name, 'g')
  assert.strictEqual(a.command, 'git')
})

test('handles alias with spaces around =', () => {
  const lines = ["alias g = 'git'"]
  const [a] = parseLines(lines)
  assert.strictEqual(a.name, 'g')
  assert.strictEqual(a.command, 'git')
})

test('handles alias names with dots and dashes', () => {
  const lines = ["alias git.status='git status'", "alias my-alias='echo hi'"]
  const aliases = parseLines(lines)
  assert.strictEqual(aliases[0].name, 'git.status')
  assert.strictEqual(aliases[1].name, 'my-alias')
})

// ── quoteCommand ──────────────────────────────────────────────────────────────

console.log('\nquoteCommand:')

test('uses single quotes when command has no single quotes', () => {
  assert.strictEqual(quoteCommand('git status'), "'git status'")
})

test('uses double quotes when command contains single quote', () => {
  assert.strictEqual(quoteCommand("it's alive"), '"it\'s alive"')
})

test('uses double quotes for command with apostrophe mid-word', () => {
  assert.strictEqual(quoteCommand("don't do this"), '"don\'t do this"')
})

// ── aliasToLine ───────────────────────────────────────────────────────────────

console.log('\naliasToLine:')

test('generates alias line with description', () => {
  const line = aliasToLine({ name: 'gs', command: 'git status', description: 'Short for git status' })
  assert.strictEqual(line, "alias gs='git status' # Short for git status")
})

test('generates alias line without description', () => {
  const line = aliasToLine({ name: 'll', command: 'ls -la', description: '' })
  assert.strictEqual(line, "alias ll='ls -la'")
})

test('generates alias line with undefined description', () => {
  const line = aliasToLine({ name: 'll', command: 'ls -la', description: undefined })
  assert.strictEqual(line, "alias ll='ls -la'")
})

test('trims whitespace from description', () => {
  const line = aliasToLine({ name: 'gs', command: 'git status', description: '  trimmed  ' })
  assert.strictEqual(line, "alias gs='git status' # trimmed")
})

test('round-trips: aliasToLine output is parseable', () => {
  const original = { name: 'gs', command: 'git status', description: 'a description' }
  const line   = aliasToLine(original)
  const parsed = parseLines([line])
  assert.strictEqual(parsed.length, 1)
  assert.strictEqual(parsed[0].name,        original.name)
  assert.strictEqual(parsed[0].command,     original.command)
  assert.strictEqual(parsed[0].description, original.description)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
