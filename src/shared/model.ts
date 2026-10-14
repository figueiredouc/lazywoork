export type Agent = {
  id: string
  name: string
  branch: string
  color: string
  /** Terminal we can drive; absent = reduced mode. `label` is a short locator, may be empty. */
  terminal?: { app: string; label: string }
  working: boolean
}

export type PermissionOption = {
  id: string
  label: string
  /** Fragment shown in mono, e.g. the command prefix an "always allow" rule covers. */
  code?: string
  kind: 'allow' | 'allow-always' | 'deny'
}

export type QuestionOption = { key: string; label: string; short: string }

/** One question of an AskUserQuestion. */
export type Question = { question: string; header?: string; options: QuestionOption[]; multiSelect: boolean }

type Base = { id: string; agentId: string; createdAt: number }

export type PermissionRequest = Base & {
  kind: 'permission'
  tool: string
  command: string
  reason?: string
  options: PermissionOption[]
}

export type QuestionRequest = Base & {
  kind: 'question'
  question: string
  /** Short version for the list card. */
  short?: string
  /** Options of a single single-select question; empty otherwise (free text, or see `questions`). */
  options: QuestionOption[]
  /** AskUserQuestion: every question, answered together when there are several or any is multi-select. */
  questions?: Question[]
  /** hook: AskUserQuestion, answered via the held hook; terminal: free text from Stop. */
  replyVia: 'hook' | 'terminal'
}

/** Answer to one question: free text overrides the selected option keys. */
export type QuestionAnswer = { optionKeys?: string[]; text?: string }

/** What the renderer sends: an option, free text, or (multi-question form) one answer per question. */
export type Reply = { optionId?: string; text?: string; answers?: QuestionAnswer[] }

/** Several questions or any multi-select: answered with the form, not one click. */
export function needsForm(req: QuestionRequest): boolean {
  return Boolean(req.questions && (req.questions.length > 1 || req.questions.some((q) => q.multiSelect)))
}

export type DoneRequest = Base & { kind: 'done'; summary: string }

export type InboxRequest = PermissionRequest | QuestionRequest | DoneRequest

export type InboxState = { agents: Agent[]; requests: InboxRequest[] }

// Configurable in the real app (settings).
export const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+-[a-z]*(rf|fr)[a-z]*\b/i,
  /\bgit\s+push\b.*\s(--force|-f)\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i,
  /\bTRUNCATE\b/i
]

export function findDestructive(command: string): { start: number; end: number } | null {
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    const m = pattern.exec(command)
    if (m) return { start: m.index, end: m.index + m[0].length }
  }
  return null
}

/** Options to show: flagged commands never offer "don't ask again". */
export function visibleOptions(req: PermissionRequest): PermissionOption[] {
  return findDestructive(req.command)
    ? req.options.filter((o) => o.kind !== 'allow-always')
    : req.options
}

export function initials(name: string): string {
  return name
    .split(/[-_\s/.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export function elapsed(createdAt: number, now: number): string {
  const s = Math.max(0, Math.floor((now - createdAt) / 1000))
  if (s < 60) return `há ${s} s`
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  return `há ${Math.floor(s / 3600)} h`
}
