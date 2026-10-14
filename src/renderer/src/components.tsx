import { useId, useState, type ReactNode } from 'react'
import { findDestructive, initials, type Agent, type InboxRequest } from '../../shared/model'

const ICONS = {
  pin: <><path d="M12 17v5" /><path d="M9 3h6l-1 6 3 3H7l3-3z" /></>,
  minus: <path d="M5 12h14" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  terminal: <><path d="M4 17l6-5-6-5" /><path d="M12 19h8" /></>,
  check: <path d="M5 12l5 5 9-10" />,
  pencil: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></>,
  warning: <><path d="M12 3l10 18H2z" /><path d="M12 10v5" /><path d="M12 18v.5" /></>
}

export function Icon({ name, size = 15 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export function Avatar({ agent, large }: { agent: Agent; large?: boolean }) {
  return (
    <div className={large ? 'avatar avatar-lg' : 'avatar'} style={{ background: agent.color }} aria-hidden="true">
      {initials(agent.name)}
    </div>
  )
}

const TAGS = {
  permission: 'quer correr',
  question: 'pergunta',
  done: 'terminou'
} as const

export function Tag({ kind }: { kind: InboxRequest['kind'] }) {
  return (
    <span className={`tag tag-${kind}`}>
      {kind === 'done' && <Icon name="check" size={12} />}
      {TAGS[kind]}
    </span>
  )
}

export function CommandBox({ command }: { command: string }) {
  const hit = findDestructive(command)
  if (!hit) return <pre className="command">{command}</pre>
  return (
    <pre className="command">
      {command.slice(0, hit.start)}
      <mark className="danger-mark">{command.slice(hit.start, hit.end)}</mark>
      {command.slice(hit.end)}
    </pre>
  )
}

type OptionButtonProps = {
  badge: string
  children: ReactNode
  variant?: 'primary' | 'primary-danger' | 'question'
  disabled?: boolean
  /** Toggle mode (multi-question form): shows the selection, the badge becomes a check. */
  selected?: boolean
  onClick: () => void
}

export function OptionButton({ badge, children, variant, disabled, selected, onClick }: OptionButtonProps) {
  return (
    <button className={`option ${variant ? `option-${variant}` : ''} ${selected ? 'option-selected' : ''}`}
      disabled={disabled} aria-pressed={selected} onClick={onClick}>
      <span className="option-badge">{selected ? <Icon name="check" size={13} /> : badge}</span>
      <span>{children}</span>
    </button>
  )
}

type MessageBoxProps = {
  label: string
  hint: string
  onSend: (text: string) => void
  extra?: ReactNode
}

export function MessageBox({ label, hint, onSend, extra }: MessageBoxProps) {
  const id = useId()
  const [text, setText] = useState('')
  const send = () => text.trim() && onSend(text.trim())
  return (
    <div className="box">
      <label htmlFor={id} className="box-label">{label}</label>
      <textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send()
        }} />
      <div className="row wrap">
        <button className="btn btn-accent" disabled={!text.trim()} onClick={send}>Enviar</button>
        {extra}
      </div>
      <div className="hint">{hint}</div>
    </div>
  )
}

const MAX_NAME = 40

/** Agent name, click to rename (session-only). Enter/blur saves, Esc cancels, empty keeps the old name. */
export function AgentName({ agent }: { agent: Agent }) {
  const [editing, setEditing] = useState(false)
  if (!editing) {
    return (
      <button className="agent-name" title="Mudar o nome" onClick={() => setEditing(true)}>
        <h2 className="title">{agent.name}</h2>
        <span className="agent-name-pencil"><Icon name="pencil" size={14} /></span>
      </button>
    )
  }
  const save = (value: string) => {
    const name = value.replace(/\s+/g, ' ').trim()
    if (name && name !== agent.name) window.inbox.rename(agent.id, name)
    setEditing(false)
  }
  return (
    <input className="field agent-name-input" aria-label="Nome do agente" defaultValue={agent.name}
      maxLength={MAX_NAME} autoFocus onFocus={(e) => e.target.select()}
      onBlur={(e) => save(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.currentTarget.value = agent.name
          setEditing(false)
        }
      }} />
  )
}
