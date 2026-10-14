import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Target } from './terminal'

const run = promisify(execFile)
// ponytail: fixed default install path; make it configurable if anyone installs WezTerm elsewhere.
const WEZTERM = 'C:\\Program Files\\WezTerm\\wezterm.exe'

const HIGHLIGHT_MS = 5000
const highlights = new Map<string, NodeJS.Timeout>()

function cli({ socket }: Target, args: string[]) {
  const env = socket ? { ...process.env, WEZTERM_UNIX_SOCKET: socket } : process.env
  return run(WEZTERM, ['cli', ...args], { env, windowsHide: true })
}

/** Selects the pane's tab, raises its window and marks the tab "aqui!" for a few seconds. */
export async function focus(target: Target, name: string): Promise<void> {
  const { pane, socket } = target
  if (!pane) throw new Error('No WezTerm pane')
  await cli(target, ['activate-pane', '--pane-id', pane])
  // activate-pane doesn't raise the window. Windows allows it because the user just clicked the panel.
  const pid = /gui-sock-(\d+)$/.exec(socket ?? '')?.[1] ?? '(Get-Process wezterm-gui | Select-Object -First 1).Id'
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `(New-Object -ComObject WScript.Shell).AppActivate(${pid}) | Out-Null`], { windowsHide: true })
  await cli(target, ['set-tab-title', '--pane-id', pane, `aqui! · ${name}`])
  clearTimeout(highlights.get(pane))
  highlights.set(pane, setTimeout(() => clearHighlight(target), HIGHLIGHT_MS))
}

/** Best effort: resets the tab title if a highlight is pending. */
export function clearHighlight(target: Target): void {
  const { pane } = target
  if (!pane || !highlights.has(pane)) return
  clearTimeout(highlights.get(pane))
  highlights.delete(pane)
  cli(target, ['set-tab-title', '--pane-id', pane, '']).catch(() => {})
}

/** Types text into a pane and submits it. Newlines would submit early, so they become spaces. */
export async function sendText({ pane, socket }: Target, text: string): Promise<void> {
  if (!pane) throw new Error('No WezTerm pane')
  const send = (t: string) => cli({ pane, socket }, ['send-text', '--pane-id', pane, '--no-paste', '--', t])
  await send(text.replace(/\s*[\r\n]+\s*/g, ' ').trim())
  await send('\r')
}
