import { execFile } from 'node:child_process'
import type { Target } from './terminal'

const HIGHLIGHT_MS = 5000
const highlights = new Map<string, NodeJS.Timeout>()
const MISSING = '__no_session__'

/** AppleScript string literal: agent names and user text are untrusted. */
const lit = (s: string) => `"${s.replace(/[\\"]/g, '\\$&')}"`

/** ITERM_SESSION_ID is "w0t2p0:<uuid>"; the uuid is the AppleScript session id. */
const sessionId = (iterm: string) => iterm.slice(iterm.indexOf(':') + 1)

/** Runs `body` on the agent's session (w/t/s bound). Rejects if the session is gone. */
function onSession(target: Target, body: string): Promise<void> {
  const id = sessionId(target.iterm ?? '')
  if (!id) return Promise.reject(new Error('No iTerm2 session'))
  // Script on stdin, never -e args: no argv quoting to get wrong.
  const script = `tell application "iTerm2"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with s in sessions of t
        if id of s is ${lit(id)} then
          ${body}
          return ""
        end if
      end repeat
    end repeat
  end repeat
  return "${MISSING}"
end tell`
  return new Promise((resolve, reject) => {
    const child = execFile('osascript', ['-'], (err, stdout) => {
      if (err) reject(err)
      else if (stdout.includes(MISSING)) reject(new Error('iTerm2 session not found'))
      else resolve()
    })
    child.stdin?.end(script)
  })
}

/** Selects the session's window/tab, raises iTerm2 and marks the tab "aqui!" for a few seconds. */
export async function focus(target: Target, name: string): Promise<void> {
  // select alone doesn't raise the app. macOS allows it because the user just clicked the panel.
  await onSession(target, `activate
          select w
          select t
          select s
          set name of s to ${lit(`aqui! · ${name}`)}`)
  const key = target.iterm ?? ''
  clearTimeout(highlights.get(key))
  highlights.set(key, setTimeout(() => clearHighlight(target), HIGHLIGHT_MS))
}

/** Best effort: gives the title back to the program if a highlight is pending. */
export function clearHighlight(target: Target): void {
  const key = target.iterm ?? ''
  if (!highlights.has(key)) return
  clearTimeout(highlights.get(key))
  highlights.delete(key)
  onSession(target, 'set name of s to ""').catch(() => {})
}

/** Types text into the session and submits it. Newlines would submit early, so they become spaces. */
export function sendText(target: Target, text: string): Promise<void> {
  // write text appends a newline of its own, which submits it.
  return onSession(target, `write text ${lit(text.replace(/\s*[\r\n]+\s*/g, ' ').trim())}`)
}
