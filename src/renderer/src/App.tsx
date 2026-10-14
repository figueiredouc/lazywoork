import { useEffect, useRef, useState } from 'react'
import type { Agent, InboxRequest, InboxState } from '../../shared/model'
import { CompactView, DetailView, ListView, type Actions } from './views'

const SHOWING_MS = 5000

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/**
 * Expanded: report the panel's natural height (main resizes the window, capped).
 * The panel sizes to its content and scrolls only when capped, so resizing doesn't feed back.
 */
function useFitHeight(expanded: boolean): void {
  useEffect(() => {
    const root = document.getElementById('root')
    if (!expanded || !root) return
    let last = 0
    const measure = () => {
      const panel = root.querySelector<HTMLElement>('.panel')
      if (!panel) return
      let height = panel.offsetHeight + 4 // + solid shadow
      // Scroll areas hide what doesn't fit under the cap: add it back.
      for (const s of panel.querySelectorAll<HTMLElement>('.scroll')) height += s.scrollHeight - s.clientHeight
      if (height !== last) window.inbox.fitHeight((last = height))
    }
    const ro = new ResizeObserver(measure)
    const observe = () => {
      ro.disconnect()
      const panel = root.querySelector<HTMLElement>('.panel')
      if (!panel) return
      ro.observe(panel)
      for (const el of panel.querySelectorAll<HTMLElement>('.scroll > *')) ro.observe(el)
    }
    const mo = new MutationObserver(() => {
      observe()
      measure()
    })
    mo.observe(root, { childList: true, subtree: true, characterData: true })
    observe()
    measure()
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [expanded])
}

export function App() {
  const [{ agents, requests }, setState] = useState<InboxState>({ agents: [], requests: [] })
  const [expanded, setExpanded] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pinned, setPinned] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  // Request whose card shows "A mostrar no terminal…" for a few seconds.
  const [showing, setShowing] = useState<string | null>(null)
  const now = useNow()

  useEffect(() => window.inbox.setMode(expanded ? 'expanded' : 'compact'), [expanded])
  useEffect(() => window.inbox.setPinned(pinned), [pinned])
  useFitHeight(expanded)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!showing) return
    const t = setTimeout(() => setShowing(null), SHOWING_MS)
    return () => clearTimeout(t)
  }, [showing])

  useEffect(() => {
    const off = window.inbox.onState(setState)
    window.inbox.getState().then(setState)
    return off
  }, [])

  // Expand when the first request arrives, compact when the last one goes; otherwise leave it to the user.
  const prevCount = useRef(0)
  useEffect(() => {
    if (prevCount.current === 0 && requests.length > 0) setExpanded(true)
    if (prevCount.current > 0 && requests.length === 0) setExpanded(false)
    prevCount.current = requests.length
  }, [requests.length])

  const actions: Actions = {
    dismiss: (req: InboxRequest) => window.inbox.dismiss(req.id),
    decide: (req, reply, message, failMessage = 'Já tinha sido respondido no terminal.') => {
      setOpenId(null)
      window.inbox.answer(req.id, reply).then((ok) => setToast(ok ? message : failMessage))
    },
    open: setOpenId,
    goToTerminal: (req) => {
      const { terminal } = agentById(req.agentId)
      window.inbox.focus(req.agentId).then((ok) => {
        if (!ok) return setToast(terminal ? 'Não consegui mostrar o terminal.' : 'Este agente não está num terminal que eu saiba controlar.')
        setOpenId(null)
        setShowing(req.id)
      })
    }
  }

  const agentById = (id: string): Agent =>
    agents.find((a) => a.id === id) ?? { id, name: '?', branch: '', color: '#FFD43B', working: false }
  const ctx = { agent: agentById, now, actions, showing }
  const index = requests.findIndex((r) => r.id === openId)
  const open = requests[index]

  let view
  if (!expanded) {
    view = <CompactView agents={agents} count={requests.length} onExpand={() => setExpanded(true)} />
  } else if (open && open.kind !== 'done') {
    view = <DetailView key={open.id} req={open} position={index + 1} total={requests.length}
      onBack={() => setOpenId(null)} {...ctx} />
  } else {
    view = <ListView requests={requests} agents={agents} pinned={pinned}
      onPin={() => setPinned((p) => !p)} onCompact={() => setExpanded(false)}
      onSettings={() => setToast('Definições: ainda não existem.')} {...ctx} />
  }

  return (
    <>
      {view}
      <div className="toast-slot" aria-live="polite">
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  )
}
