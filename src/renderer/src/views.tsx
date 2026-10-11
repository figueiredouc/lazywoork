import { useState, type ReactNode } from 'react'
import { Avatar, CommandBox, Icon, MessageBox, OptionButton, Tag } from './components'
import {
  elapsed,
  findDestructive,
  needsForm,
  visibleOptions,
  type Agent,
  type InboxRequest,
  type PermissionRequest,
  type Question,
  type QuestionRequest,
  type Reply
} from '../../shared/model'

export type Actions = {
  dismiss: (req: InboxRequest) => void
  /** Answers a permission request; the toast is shown only if it was delivered. */
  decide: (req: PermissionRequest | QuestionRequest, reply: Reply, toast: string, failToast?: string) => void
  open: (id: string) => void
  goToTerminal: (req: InboxRequest) => void
}

type Ctx = { agent: (id: string) => Agent; now: number; actions: Actions; showing: string | null }

const meta = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ')

// ---------- Screen 1: compact ----------

export function CompactView({ agents, count, onExpand }: { agents: Agent[]; count: number; onExpand: () => void }) {
  return (
    <div className="panel compact">
      <div className="row drag">
        <h1 className="title-sm">{count ? `${count} à tua espera` : 'Tudo tranquilo'}</h1>
        {!count && <span className="muted">ninguém à tua espera</span>}
        <div className="grow" />
        <button className="icon-btn" aria-label="Expandir" onClick={onExpand}>
          <Icon name="chevronDown" size={16} />
        </button>
      </div>
      <ul className="pills">
        {agents.map((a) => (
          <li key={a.id} className="pill">
            <span className="pill-swatch" style={{ background: a.color }} aria-hidden="true" />
            {a.name}
            <span className={a.working ? 'dot dot-on' : 'dot'} />
            <span className="sr-only">{a.working ? 'a trabalhar' : 'inativo'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- Screen 2: list ----------

type ListProps = Ctx & {
  requests: InboxRequest[]
  agents: Agent[]
  pinned: boolean
  onPin: () => void
  onCompact: () => void
  onSettings: () => void
}

export function ListView({ requests, agents, pinned, onPin, onCompact, onSettings, ...ctx }: ListProps) {
  const working = agents.filter((a) => a.working).length
  return (
    <div className="panel">
      <header className="row drag header">
        <h1 className="title">{requests.length ? `${requests.length} à tua espera` : 'Tudo tranquilo'}</h1>
        <div className="grow" />
        <button className={pinned ? 'icon-btn icon-btn-on' : 'icon-btn'} aria-label="Fixar por cima"
          aria-pressed={pinned} onClick={onPin}>
          <Icon name="pin" />
        </button>
        <button className="icon-btn" aria-label="Compactar" onClick={onCompact}>
          <Icon name="minus" />
        </button>
      </header>

      <main className="scroll list">
        {requests.length === 0 && <p className="empty">Nada por aqui por agora.</p>}
        {requests.map((r) => <Card key={r.id} req={r} {...ctx} />)}
      </main>

      <footer className="row footer">
        <span>{agents.length} {agents.length === 1 ? 'agente' : 'agentes'} · {working} a trabalhar</span>
        <div className="grow" />
        <button className="link" onClick={onSettings}>Definições</button>
      </footer>
    </div>
  )
}

function Card({ req, agent, now, actions, showing }: Ctx & { req: InboxRequest }) {
  const a = agent(req.agentId)
  return (
    <article className={showing === req.id ? 'card card-showing' : 'card'}>
      <div className="row">
        <Avatar agent={a} />
        <div className="grow stack-tight">
          <div className="card-name">{a.name}</div>
          {showing === req.id
            ? <div className="showing">A mostrar no terminal…</div>
            : <div className="mono-meta">{meta(a.branch, elapsed(req.createdAt, now))}</div>}
        </div>
        <Tag kind={req.kind} />
      </div>
      {req.kind === 'permission' && <PermissionCardBody req={req} agent={a} actions={actions} />}
      {req.kind === 'question' && <QuestionCardBody req={req} agent={a} actions={actions} />}
      {req.kind === 'done' && (
        <>
          <p className="body-text">{req.summary}</p>
          <div className="row">
            <button className="btn btn-secondary" onClick={() => actions.goToTerminal(req)}>
              <Icon name="terminal" /> Ver no terminal
            </button>
            <button className="btn btn-ghost" onClick={() => actions.dismiss(req)}>Ok</button>
          </div>
        </>
      )}
    </article>
  )
}

function PermissionCardBody({ req, agent, actions }: { req: PermissionRequest; agent: Agent; actions: Actions }) {
  const opts = visibleOptions(req)
  const yes = opts.find((o) => o.kind === 'allow')
  const no = opts.find((o) => o.kind === 'deny')
  // Flagged commands can only be approved from the detail screen, after confirming.
  const destructive = findDestructive(req.command) !== null
  return (
    <>
      <CommandBox command={req.command} />
      <div className="row">
        {yes && !destructive && (
          <button className="btn btn-primary" onClick={() => actions.decide(req, { optionId: yes.id }, `«${yes.label}» enviado a ${agent.name}`)}>
            {yes.label}
          </button>
        )}
        {no && (
          <button className="btn btn-secondary" onClick={() => actions.decide(req, { optionId: no.id }, `«${no.label}» enviado a ${agent.name}`)}>
            {no.label}
          </button>
        )}
        <button className="link" onClick={() => actions.open(req.id)}>
          {destructive ? 'Rever e confirmar' : 'Mais opções'}
        </button>
      </div>
    </>
  )
}

function QuestionCardBody({ req, agent, actions }: { req: QuestionRequest; agent: Agent; actions: Actions }) {
  // Several questions or multi-select: answered right here, same form as the detail.
  if (needsForm(req)) {
    return (
      <QuestionForm req={req} agent={agent} actions={actions} compact
        extra={<button className="btn btn-secondary" onClick={() => actions.goToTerminal(req)}>
          <Icon name="terminal" /> Ir para o terminal
        </button>} />
    )
  }
  return (
    <>
      <p className="body-text">{req.short ?? req.question}</p>
      <div className="row">
        <div className="row wrap grow">
          {req.options.map((o) => (
            <button key={o.key} className="btn btn-secondary btn-sm"
              onClick={() => actions.decide(req, { optionId: o.key }, `Resposta ${o.key} enviada a ${agent.name}`)}>
              {o.key} · {o.short}
            </button>
          ))}
          {req.options.length === 0 && <button className="btn btn-secondary btn-sm" onClick={() => actions.open(req.id)}>Responder</button>}
        </div>
        <button className="link link-more" aria-label="Abrir pergunta" onClick={() => actions.open(req.id)}>
          Ver detalhes <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </>
  )
}

/** Only hook questions can be answered from the app for now; the rest get the "not yet" toast. */
function replyInTerminal(req: QuestionRequest, agent: Agent, actions: Actions, text: string) {
  actions.decide(req, { text }, `Resposta escrita na sessão de ${agent.name}`,
    agent.pane ? 'Não consegui escrever no WezTerm.' : 'Este agente não está no WezTerm: responde no terminal.')
}

// ---------- Screens 3–5: detail ----------

type DetailProps = Ctx & { req: PermissionRequest | QuestionRequest; position: number; total: number; onBack: () => void }

export function DetailView({ req, position, total, onBack, ...ctx }: DetailProps) {
  const a = ctx.agent(req.agentId)
  const destructive = req.kind === 'permission' && findDestructive(req.command) !== null
  return (
    <div className="panel">
      <header className="row drag header">
        <button className="back" onClick={onBack}>
          <Icon name="chevronLeft" /> Todos ({total})
        </button>
        <div className="grow" />
        <span className="position">{position} de {total}</span>
      </header>
      {destructive && (
        <div className="danger-banner" role="alert">
          <Icon name="warning" size={20} /> Calma aí: isto apaga ficheiros
        </div>
      )}
      <main className="scroll detail">
        <div className="row gap-12">
          <Avatar agent={a} large />
          <div className="grow stack-tight">
            <h2 className="title">{a.name}</h2>
            <div className="mono-meta">{meta(a.branch, a.pane && `painel ${a.pane}`, elapsed(req.createdAt, ctx.now))}</div>
          </div>
        </div>
        {req.kind === 'permission'
          ? <PermissionDetail req={req} agent={a} actions={ctx.actions} destructive={destructive} />
          : <QuestionDetail req={req} agent={a} actions={ctx.actions} />}
      </main>
    </div>
  )
}

type PermissionDetailProps = { req: PermissionRequest; agent: Agent; actions: Actions; destructive: boolean }

function PermissionDetail({ req, agent, actions, destructive }: PermissionDetailProps) {
  const [confirmed, setConfirmed] = useState(false)
  const opts = visibleOptions(req)
  return (
    <>
      <section className="stack">
        <div className="row">
          <Tag kind="permission" />
          <span className="muted strong">{req.tool}</span>
        </div>
        <CommandBox command={req.command} />
        {req.reason && <p className="body-text"><strong>Porquê:</strong> {req.reason}</p>}
      </section>

      {destructive && (
        <div className="box row-start">
          <input id="confirm" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <label htmlFor="confirm" className="strong">Li o comando e quero mesmo apagar estes ficheiros</label>
        </div>
      )}

      <section className="stack">
        {opts.map((o, i) => {
          const primary = destructive ? o.kind === 'deny' : i === 0
          return (
            <OptionButton key={o.id} badge={String(i + 1)}
              variant={primary ? (destructive ? 'primary-danger' : 'primary') : undefined}
              disabled={destructive && o.kind === 'allow' && !confirmed}
              onClick={() => actions.decide(req, { optionId: o.id }, `«${o.label}${o.code ? ` ${o.code}` : ''}» enviado a ${agent.name}`)}>
              {o.label}
              {o.code && <> <code className="code-chip">{o.code}</code></>}
            </OptionButton>
          )
        })}
      </section>

      <MessageBox label="Ou diz-lhe outra coisa"
        hint={destructive ? 'Sem «não voltar a perguntar» aqui.' : 'Recusa o pedido e o agente segue a tua mensagem.'}
        onSend={(text) => actions.decide(req, { text }, `Pedido recusado e mensagem enviada a ${agent.name}`)} />
    </>
  )
}

function QuestionDetail({ req, agent, actions }: { req: QuestionRequest; agent: Agent; actions: Actions }) {
  const terminalButton = (
    <button className="btn btn-secondary" onClick={() => actions.goToTerminal(req)}>
      <Icon name="terminal" /> Ir para o terminal
    </button>
  )
  return (
    <>
      <section className="stack">
        <Tag kind="question" />
        {!needsForm(req) && <p className="bubble">{req.question}</p>}
      </section>

      {req.options.length > 0 && (
        <section className="stack">
          {req.options.map((o) => (
            <OptionButton key={o.key} badge={o.key} variant="question"
              onClick={() => actions.decide(req, { optionId: o.key }, `Resposta ${o.key} enviada a ${agent.name}`)}>
              {o.label}
            </OptionButton>
          ))}
        </section>
      )}

      {/* Several questions or multi-select: one block per question, sent together. */}
      {needsForm(req) && <QuestionForm req={req} agent={agent} actions={actions} extra={terminalButton} />}
      {req.replyVia === 'hook' && !needsForm(req) && (
        <MessageBox label="Ou responde à tua maneira" hint="A resposta vai diretamente para o agente."
          onSend={(text) => actions.decide(req, { text }, `Resposta enviada a ${agent.name}`)}
          extra={terminalButton} />
      )}
      {/* Free-text question from Stop: typed into the agent's WezTerm pane, if we know it. */}
      {req.replyVia === 'terminal' && (agent.pane ? (
        <MessageBox label="Ou responde à tua maneira" hint="A resposta é escrita na sessão do agente no WezTerm."
          onSend={(text) => replyInTerminal(req, agent, actions, text)}
          extra={terminalButton} />
      ) : (
        <div className="stack">
          <div className="row">{terminalButton}</div>
          <div className="hint">Responde no terminal.</div>
        </div>
      ))}
    </>
  )
}

type Draft = { optionKeys: string[]; text: string }

type QuestionFormProps = { req: QuestionRequest; agent: Agent; actions: Actions; extra: ReactNode; compact?: boolean }

/** compact: inline in the list card (plain question text, tighter options). */
function QuestionForm({ req, agent, actions, extra, compact }: QuestionFormProps) {
  const questions = req.questions ?? []
  const [drafts, setDrafts] = useState<Draft[]>(() => questions.map(() => ({ optionKeys: [], text: '' })))
  const update = (i: number, d: Partial<Draft>) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, ...d } : x)))
  const toggle = (i: number, q: Question, key: string) => {
    const keys = drafts[i].optionKeys
    if (!q.multiSelect) return update(i, { optionKeys: [key] })
    update(i, { optionKeys: keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key] })
  }
  const complete = drafts.every((d) => d.text.trim() || d.optionKeys.length)
  const send = () => {
    const answers = drafts.map((d) => (d.text.trim() ? { text: d.text.trim() } : { optionKeys: d.optionKeys }))
    actions.decide(req, { answers }, `${questions.length > 1 ? 'Respostas enviadas' : 'Resposta enviada'} a ${agent.name}`)
  }
  return (
    <div className={compact ? 'stack question-form form-compact' : 'stack question-form'}>
      {questions.map((q, i) => (
        <section key={i} className="stack">
          {q.header && <span className="muted strong">{q.header}</span>}
          <p className={compact ? 'body-text strong' : 'bubble'}>{q.question}</p>
          {q.multiSelect && <div className="hint">Podes escolher várias.</div>}
          {q.options.map((o) => (
            <OptionButton key={o.key} badge={o.key} variant="question"
              selected={!drafts[i].text.trim() && drafts[i].optionKeys.includes(o.key)}
              onClick={() => toggle(i, q, o.key)}>
              {o.label}
            </OptionButton>
          ))}
          <input className="field" placeholder="Ou escreve outra coisa…" aria-label={`Outra resposta: ${q.question}`}
            value={drafts[i].text} onChange={(e) => update(i, { text: e.target.value })} />
        </section>
      ))}
      <div className="row wrap">
        <button className="btn btn-primary" disabled={!complete} onClick={send}>Enviar</button>
        {extra}
      </div>
      {!complete && <div className="hint">Responde a todas as perguntas para enviar.</div>}
    </div>
  )
}
