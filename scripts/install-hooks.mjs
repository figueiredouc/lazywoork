// Merges the Agent Inbox hooks into ~/.claude/settings.json (run where Claude Code runs: WSL node, or macOS node).
// Default: dry run. --apply: write (with backup). --remove: remove our hooks (with backup).
// Command hooks with curl, not http hooks: with the app closed they must fail silently (|| true).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const URL = 'http://127.0.0.1:41823/hook'
const HEADERS = {
  'X-Wezterm-Pane': 'WEZTERM_PANE',
  'X-Wezterm-Socket': 'WEZTERM_UNIX_SOCKET',
  'X-Iterm-Session': 'ITERM_SESSION_ID',
  'X-Agent-Name': 'AGENT_INBOX_NAME',
  'X-Wsl-Distro': 'WSL_DISTRO_NAME'
}
const EVENTS = ['PermissionRequest', 'PostToolUse', 'PostToolUseFailure', 'UserPromptSubmit', 'Stop', 'SessionEnd']

// PermissionRequest waits for the app's decision (printed to stdout); the rest are fire-and-forget.
const command = (decision) =>
  [
    `curl -s --max-time ${decision ? 600 : 2}`,
    ...(decision ? [] : ['-o /dev/null']),
    `-X POST -H 'Content-Type: application/json'`,
    ...Object.entries(HEADERS).map(([h, v]) => `-H "${h}: $${v}"`),
    `--data-binary @- ${URL} || true`
  ].join(' ')
const isOurs = (h) =>
  (h?.type === 'command' && String(h.command ?? '').includes('127.0.0.1:41823/hook')) ||
  (h?.type === 'http' && String(h.url ?? '').includes('127.0.0.1:41823'))

const mode = process.argv.includes('--remove') ? 'remove' : process.argv.includes('--apply') ? 'apply' : 'dry-run'
const file = join(homedir(), '.claude', 'settings.json')
const original = existsSync(file) ? readFileSync(file, 'utf8') : '{}'
const settings = JSON.parse(original)
const hooks = settings.hooks ?? {}

// Drop our entries (and groups left empty by that), keep everything else.
for (const [event, groups] of Object.entries(hooks)) {
  if (!Array.isArray(groups)) continue
  hooks[event] = groups
    .map((g) => ({ g, ours: (g.hooks ?? []).some(isOurs) }))
    .map(({ g, ours }) => ({ g: ours ? { ...g, hooks: g.hooks.filter((h) => !isOurs(h)) } : g, ours }))
    .filter(({ g, ours }) => !ours || g.hooks.length)
    .map(({ g }) => g)
  if (!hooks[event].length) delete hooks[event]
}

const added = {}
if (mode !== 'remove') {
  for (const event of EVENTS) {
    const decision = event === 'PermissionRequest'
    const group = { ...(decision && { matcher: '*' }), hooks: [{ type: 'command', command: command(decision) }] }
    added[event] = group
    hooks[event] = [...(hooks[event] ?? []), group]
  }
}
if (Object.keys(hooks).length) settings.hooks = hooks
else delete settings.hooks

const result = JSON.stringify(settings, null, 2) + '\n'
const changed = JSON.stringify(JSON.parse(original)) !== JSON.stringify(settings)

console.log(`File: ${file}${existsSync(file) ? '' : ' (does not exist yet)'}`)
if (mode !== 'remove') console.log('\nHooks to add (one group per event):\n' + JSON.stringify(added, null, 2))
console.log('\nResulting "hooks" section:\n' + JSON.stringify(settings.hooks ?? {}, null, 2))

if (!changed) console.log('\nNothing to change.')
else if (mode === 'dry-run') console.log('\nDry run: nothing written. Use --apply to write or --remove to uninstall.')
else {
  mkdirSync(dirname(file), { recursive: true })
  if (existsSync(file)) {
    const backup = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`
    copyFileSync(file, backup)
    console.log(`\nBackup: ${backup}`)
  }
  writeFileSync(file, result)
  console.log(`\nWritten (${mode}).`)
}
