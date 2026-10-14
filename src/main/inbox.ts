import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { posix } from 'node:path'
import { clearHighlight, focus, sendText } from './terminal'
import { findDestructive, type Agent, type InboxRequest, type InboxState, type PermissionOption, type Question, type QuestionAnswer, type QuestionRequest, type Reply } from '../shared/model'

export const PORT = 41823
const MAX_BODY = 1024 * 1024
const COLORS = ['#FF8FAB', '#9EE6FF', '#C7F59A', '#FFD43B']
const COMMAND_KEYS = ['command', 'file_path', 'notebook_path', 'url', 'query', 'pattern']

type Session = Agent & { pane?: string; socket: string; distro: string; iterm?: string }
/** A card plus, for PermissionRequest, the held HTTP response, what PostToolUse must match and the raw suggestions. */
type Card = {
  req: InboxRequest
  tool?: string
  input?: string
  res?: ServerResponse
  suggestions?: unknown[]
  toolInput?: HookInput
}
// Loose shape of the hook input JSON.
type HookInput = Record<string, any>

const sessions = new Map<string, Session>()
let cards: Card[] = []
let seq = 0
let onChange: (added: boolean) => void = () => {}

export function getState(): InboxState {
  return {
    agents: [...sessions.values()].map(({ pane: _p, socket: _s, distro: _d, iterm: _i, ...agent }) => agent),
    requests: cards.map((c) => c.req)
  }
}

export function dismiss(id: string): void {
  const card = cards.find((c) => c.req.id === id && c.req.kind === 'done')
  if (card) remove([card])
}

export type { Reply }

const MAX_NAME = 40

/** User rename from the app: session-only. touch() never renames an existing session, so hooks can't overwrite it. */
export function rename(agentId: string, name: unknown): boolean {
  const session = sessions.get(agentId)
  const clean = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim() : ''
  if (!session || !clean) return false
  session.name = clean
  onChange(false)
  return true
}

const DENIED = 'The user denied this from Agent Inbox.'

/** Answers a held PermissionRequest (permission or AskUserQuestion). False when already answered in the terminal (or refused). */
export async function answer(id: string, reply: Reply): Promise<boolean> {
  const card = cards.find((c) => c.req.id === id)
  if (card?.req.kind === 'question' && card.req.replyVia === 'terminal') return answerInTerminal(card, reply.text)
  if (!card?.res) return false
  if (card.res.writableEnded || card.res.destroyed) {
    remove([card])
    return false
  }
  const decision = card.req.kind === 'permission' ? permissionDecision(card, reply) : questionDecision(card, reply)
  if (!decision) return false

  const res = card.res
  cards = cards.filter((c) => c !== card)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } }))
  onChange(false)
  return true
}

/** Free-text question from Stop: type the answer into the agent's terminal session. */
async function answerInTerminal(card: Card, text: unknown): Promise<boolean> {
  const session = sessions.get(card.req.agentId)
  if (typeof text !== 'string' || !text.trim() || !session?.terminal) return false
  try {
    await sendText(session, text.trim())
  } catch (err) {
    console.error('terminal send-text failed:', err)
    return false
  }
  if (cards.includes(card)) remove([card])
  return true
}

function permissionDecision(card: Card, { optionId, text }: Reply): object | undefined {
  if (card.req.kind !== 'permission') return
  let decision: object | undefined
  if (typeof text === 'string' && text.trim()) {
    decision = { behavior: 'deny', message: `The user denied this from Agent Inbox and replied: "${text.trim()}"` }
  } else if (optionId === 'yes') decision = { behavior: 'allow' }
  else if (optionId === 'no') decision = { behavior: 'deny', message: DENIED }
  else if (optionId?.startsWith('always-')) {
    // Flagged commands never get "don't ask again", whatever the UI sends.
    const suggestion = card.suggestions?.[Number(optionId.slice('always-'.length))]
    if (suggestion && !findDestructive(card.req.command)) decision = { behavior: 'allow', updatedPermissions: [suggestion] }
  }
  return decision
}

/** AskUserQuestion: one answer per question, keyed by question text (original option labels or free text). */
function questionDecision(card: Card, { optionId, text, answers }: Reply): object | undefined {
  if (card.req.kind !== 'question' || card.req.replyVia !== 'hook' || !card.toolInput) return
  const questions: HookInput[] = Array.isArray(card.toolInput.questions) ? card.toolInput.questions : []
  // Single question: one click (optionId) or free text, as before.
  const replies: QuestionAnswer[] = Array.isArray(answers)
    ? answers
    : questions.length === 1 ? [{ optionKeys: typeof optionId === 'string' ? [optionId] : [], text }] : []
  if (!questions.length || replies.length !== questions.length) return
  const out: Record<string, string> = {}
  for (const [i, q] of questions.entries()) {
    const value = answerFor(q, replies[i])
    if (value === undefined || typeof q?.question !== 'string') return
    out[q.question] = value
  }
  return { behavior: 'allow', updatedInput: { ...card.toolInput, answers: out } }
}

/** Free text, or the selected options' original labels (", " when multi-select). Undefined if invalid. */
function answerFor(q: HookInput, reply: QuestionAnswer | undefined): string | undefined {
  const { optionKeys, text } = reply ?? {}
  if (typeof text === 'string' && text.trim()) return text.trim()
  if (!Array.isArray(optionKeys) || !optionKeys.length) return
  const keys = [...new Set(optionKeys)].sort()
  if (!q?.multiSelect && keys.length > 1) return
  const labels: string[] = []
  for (const key of keys) {
    const label = typeof key === 'string' && key.length === 1 ? q.options?.[key.charCodeAt(0) - 65]?.label : undefined
    if (typeof label !== 'string') return
    labels.push(label)
  }
  return labels.join(', ')
}

/** "Ir para o terminal": focus and highlight the agent's terminal session. */
export async function focusAgent(agentId: string): Promise<boolean> {
  const session = sessions.get(agentId)
  if (!session?.terminal) return false
  try {
    await focus(session, session.name)
    return true
  } catch (err) {
    console.error('terminal focus failed:', err)
    return false
  }
}

export function startInbox(listener: (added: boolean) => void): Server {
  onChange = listener
  const server = createServer(handle)
  server.listen(PORT, '127.0.0.1')
  return server
}

function handle(req: IncomingMessage, res: ServerResponse): void {
  // Requests with an Origin header come from web pages: never accept them.
  if (req.method !== 'POST' || req.url !== '/hook' || req.headers.origin !== undefined) {
    res.writeHead(404).end()
    return
  }
  const chunks: Buffer[] = []
  let size = 0
  req.on('data', (chunk: Buffer) => {
    size += chunk.length
    if (size <= MAX_BODY) chunks.push(chunk)
  })
  req.on('end', () => {
    if (size > MAX_BODY) return void res.writeHead(413).end()
    let input: HookInput
    try {
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      return void res.writeHead(400).end()
    }
    if (typeof input?.session_id !== 'string' || !input.session_id) return void res.writeHead(400).end()
    onEvent(input, req, res)
  })
}

function onEvent(input: HookInput, req: IncomingMessage, res: ServerResponse): void {
  const sid: string = input.session_id
  const event: string = input.hook_event_name
  if (event === 'SessionEnd') {
    const ended = sessions.get(sid)
    if (ended) clearHighlight(ended)
    removeSession(sid)
    if (sessions.delete(sid)) onChange(false)
    return ok(res)
  }
  const session = touch(sid, input, req)

  switch (event) {
    case 'PermissionRequest': {
      session.working = false
      const card: Card = {
        req: permissionCard(sid, input),
        tool: input.tool_name,
        input: JSON.stringify(input.tool_input ?? {}),
        res,
        suggestions: Array.isArray(input.permission_suggestions) ? input.permission_suggestions : [],
        toolInput: input.tool_input ?? {}
      }
      // Closed by Claude Code: answered No/Esc in the terminal, or the hook timed out.
      res.on('close', () => {
        if (cards.includes(card)) remove([card])
      })
      add(card)
      return
    }
    case 'PostToolUse':
    case 'PostToolUseFailure': {
      session.working = true
      const pending = cards.filter((c) => c.res && c.req.agentId === sid && c.tool === input.tool_name)
      const inputJson = JSON.stringify(input.tool_input ?? {})
      const match = pending.find((c) => c.input === inputJson) ?? pending[0]
      if (match) remove([match])
      else onChange(false)
      break
    }
    case 'UserPromptSubmit':
      session.working = true
      removeSession(sid)
      onChange(false)
      break
    case 'Stop': {
      session.working = false
      removeSession(sid)
      const card = stopCard(sid, input.last_assistant_message)
      if (card) add({ req: card })
      else onChange(false)
      updateBranch(session, input.cwd)
      break
    }
  }
  ok(res)
}

function ok(res: ServerResponse): void {
  if (!res.writableEnded) res.writeHead(200).end()
}

function add(card: Card): void {
  cards.push(card)
  onChange(true)
}

/** Removes cards; held responses get an empty 200 (no decision). */
function remove(toRemove: Card[]): void {
  cards = cards.filter((c) => !toRemove.includes(c))
  for (const c of toRemove) if (c.res) ok(c.res)
  onChange(false)
}

function removeSession(sid: string): void {
  const own = cards.filter((c) => c.req.agentId === sid)
  if (own.length) remove(own)
}

function header(req: IncomingMessage, name: string): string {
  const v = req.headers[name]
  return typeof v === 'string' ? v.trim() : ''
}

function touch(sid: string, input: HookInput, req: IncomingMessage): Session {
  const existing = sessions.get(sid)
  if (existing) return existing
  const cwd = typeof input.cwd === 'string' ? input.cwd : ''
  const name = header(req, 'x-agent-name') || posix.basename(cwd) || 'agente'
  const pane = header(req, 'x-wezterm-pane')
  const iterm = header(req, 'x-iterm-session')
  const session: Session = {
    id: sid,
    name,
    branch: '',
    color: pickColor(name),
    working: false,
    socket: header(req, 'x-wezterm-socket'),
    distro: header(req, 'x-wsl-distro'),
    // iTerm2 has no locator worth showing; the pill alone says we can drive it.
    ...(pane ? { pane, terminal: { app: 'WezTerm', label: `painel ${pane}` } }
      : iterm ? { iterm, terminal: { app: 'iTerm2', label: '' } } : {})
  }
  sessions.set(sid, session)
  updateBranch(session, cwd)
  return session
}

function pickColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const preferred = COLORS[hash % COLORS.length]
  const used = new Set([...sessions.values()].map((s) => s.color))
  if (!used.has(preferred)) return preferred
  return COLORS.find((c) => !used.has(c)) ?? preferred
}

function updateBranch(session: Session, cwd: unknown): void {
  if (typeof cwd !== 'string' || !cwd.startsWith('/')) return
  readBranch(session.distro, cwd).then((branch) => {
    if (branch !== session.branch && sessions.get(session.id) === session) {
      session.branch = branch
      onChange(false)
    }
  })
}

/** Reads .git/HEAD walking up from cwd: through the WSL share when the hook ran in WSL, locally otherwise. */
async function readBranch(distro: string, cwd: string): Promise<string> {
  for (let dir = cwd; ; dir = posix.dirname(dir)) {
    const winDir = dir === '/' ? '' : dir.replaceAll('/', '\\')
    const path = distro ? `\\\\wsl.localhost\\${distro}${winDir}\\.git\\HEAD` : posix.join(dir, '.git', 'HEAD')
    try {
      const head = (await readFile(path, 'utf8')).trim()
      const ref = /^ref: refs\/heads\/(.+)$/.exec(head)
      return ref ? ref[1] : head.slice(0, 7)
    } catch {
      if (dir === '/') return ''
    }
  }
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function base(sid: string) {
  return { id: `r${++seq}`, agentId: sid, createdAt: Date.now() }
}

function permissionCard(sid: string, input: HookInput): InboxRequest {
  const toolInput: HookInput = input.tool_input ?? {}
  if (input.tool_name === 'AskUserQuestion') return askCard(sid, toolInput)

  const key = COMMAND_KEYS.find((k) => typeof toolInput[k] === 'string')
  const suggestions: HookInput[] = Array.isArray(input.permission_suggestions) ? input.permission_suggestions : []
  return {
    ...base(sid),
    kind: 'permission',
    tool: String(input.tool_name ?? '?'),
    command: key ? toolInput[key] : clip(JSON.stringify(toolInput), 500),
    ...(typeof toolInput.description === 'string' && { reason: toolInput.description }),
    options: [
      { id: 'yes', label: 'Sim', kind: 'allow' },
      ...suggestions.map((s, i) => suggestionOption(s, i)),
      { id: 'no', label: 'Não', kind: 'deny' }
    ]
  }
}

function suggestionOption(s: HookInput, i: number): PermissionOption {
  const option = { id: `always-${i}`, kind: 'allow-always' as const }
  switch (s.type) {
    case 'addRules': {
      const where = s.destination === 'session' ? ' nesta sessão' : ''
      const rules: HookInput[] = Array.isArray(s.rules) ? s.rules : []
      const code = rules.map((r) => r.ruleContent ?? r.toolName).join(', ')
      return { ...option, label: `Sim, e não voltar a perguntar${where} para`, code }
    }
    case 'addDirectories':
      return { ...option, label: 'Sim, e permitir sempre', code: [s.directories ?? []].flat().join(', ') }
    case 'setMode':
      return { ...option, label: 'Sim, e mudar para o modo', code: String(s.mode ?? '') }
    default:
      return { ...option, label: 'Sim, e lembrar esta escolha' }
  }
}

function askCard(sid: string, toolInput: HookInput): QuestionRequest {
  const raw: HookInput[] = Array.isArray(toolInput.questions) ? toolInput.questions : []
  const questions: Question[] = raw.map((q) => {
    const options: HookInput[] = Array.isArray(q?.options) ? q.options : []
    return {
      question: String(q?.question ?? ''),
      ...(typeof q?.header === 'string' && q.header && { header: q.header }),
      multiSelect: Boolean(q?.multiSelect),
      options: options.map((o, i) => ({
        key: String.fromCharCode(65 + i),
        label: o.description ? `${o.label}: ${o.description}` : String(o.label),
        short: String(o.label)
      }))
    }
  })
  const single = questions.length === 1 && !questions[0].multiSelect
  return {
    ...base(sid),
    kind: 'question',
    question: questions.map((q) => q.question).filter(Boolean).join('\n\n'),
    ...(questions.length > 1 && { short: `${questions.length} perguntas: ${questions[0].question}` }),
    replyVia: 'hook',
    options: single ? questions[0].options : [],
    questions
  }
}

function stopCard(sid: string, message: unknown): InboxRequest | null {
  if (typeof message !== 'string') return null
  const paragraphs = message.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (!paragraphs.length) return null
  const last = paragraphs[paragraphs.length - 1]
  if (last.endsWith('?')) {
    return { ...base(sid), kind: 'question', question: clip(last, 500), replyVia: 'terminal', options: [] }
  }
  // Skip heading-only paragraphs (e.g. "## Feito") unless there is nothing else.
  const first = paragraphs.find((p) => !/^#+\s/.test(p) || p.includes('\n')) ?? paragraphs[0]
  const summary = first.replace(/^#+\s*/gm, '').replaceAll('**', '').replaceAll('`', '')
  return { ...base(sid), kind: 'done', summary: clip(summary, 280) }
}
