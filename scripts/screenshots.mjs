// README screenshots: renders the built UI with fake data and captures each screen.
// Run after a build: npm run build && npx electron scripts/screenshots.mjs
// Output: docs/screenshots/*.png (transparent background, window width).
import { app, BrowserWindow, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, 'docs/screenshots')
const PRELOAD = join(import.meta.dirname, 'screenshots-preload.cjs')
const WIDTH = 384
const now = Date.now()

const agents = [
  { id: 's1', name: 'lazywoork', branch: 'main', color: '#FFD43B', working: false, terminal: { app: 'iTerm2', label: '' } },
  { id: 's2', name: 'fibersight-api', branch: 'feat/webhooks', color: '#FF8FAB', working: true, terminal: { app: 'iTerm2', label: '' } },
  { id: 's3', name: 'site', branch: 'main', color: '#9EE6FF', working: false, terminal: { app: 'WezTerm', label: 'painel 3' } },
  { id: 's4', name: 'scripts', branch: 'main', color: '#C7F59A', working: true }
]

const permission = {
  id: 'r1', agentId: 's2', createdAt: now - 42_000, kind: 'permission', tool: 'Bash',
  command: 'npm install @tanstack/react-query',
  reason: 'Instalar a dependência que falta para o painel de métricas.',
  options: [
    { id: 'yes', label: 'Sim', kind: 'allow' },
    { id: 'always-0', label: 'Sim, e não voltar a perguntar para', code: 'npm install:*', kind: 'allow-always' },
    { id: 'no', label: 'Não', kind: 'deny' }
  ]
}

const questionOptions = [
  { key: 'A', label: 'Memória: simples, perde-se em cada reinício', short: 'Em memória' },
  { key: 'B', label: 'Redis: persiste entre reinícios, mais uma peça a manter', short: 'Redis' }
]

const question = {
  id: 'r2', agentId: 's1', createdAt: now - 95_000, kind: 'question', replyVia: 'hook',
  question: 'Onde guardo a cache das respostas dos webhooks?',
  options: questionOptions,
  questions: [{ question: 'Onde guardo a cache das respostas dos webhooks?', header: 'Cache', multiSelect: false, options: questionOptions }]
}

const done = {
  id: 'r3', agentId: 's3', createdAt: now - 8 * 60_000, kind: 'done',
  summary: 'Página de preços publicada: 3 ficheiros alterados e os testes continuam a passar.'
}

const destructive = {
  id: 'r4', agentId: 's4', createdAt: now - 12_000, kind: 'permission', tool: 'Bash',
  command: 'rm -rf node_modules dist .cache',
  reason: 'Limpar tudo antes de reinstalar as dependências.',
  options: [
    { id: 'yes', label: 'Sim', kind: 'allow' },
    { id: 'always-0', label: 'Sim, e não voltar a perguntar para', code: 'rm:*', kind: 'allow-always' },
    { id: 'no', label: 'Não', kind: 'deny' }
  ]
}

/** Clicks the button with this label, to reach the detail screens. */
const click = (text) =>
  `[...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(text)})).click()`

const scenes = [
  { name: '1-compacto', state: { agents, requests: [] } },
  { name: '2-lista', state: { agents, requests: [permission, question, done] } },
  { name: '3-permissao', state: { agents, requests: [permission, question, done] }, js: click('Mais opções') },
  { name: '4-destrutivo', state: { agents, requests: [destructive, question] }, js: click('Rever e confirmar') },
  { name: '5-pergunta', state: { agents, requests: [question, done] }, js: click('Ver detalhes') }
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The renderer reports its natural height, as it does to the real main process.
let height = 160
ipcMain.on('shot:height', (_e, h) => { height = h })
ipcMain.on('shot:mode', (_e, mode) => { if (mode === 'compact') height = 154 })

async function shoot({ name, state, js }) {
  height = 160
  const win = new BrowserWindow({
    width: WIDTH, height: 800, show: false, frame: false, transparent: true,
    backgroundColor: '#00000000', hasShadow: false,
    webPreferences: { preload: PRELOAD, sandbox: true, additionalArguments: [`--state=${JSON.stringify(state)}`] }
  })
  await win.loadFile(join(ROOT, 'out/renderer/index.html'))
  await sleep(1200) // fonts, first paint
  if (js) {
    await win.webContents.executeJavaScript(js)
    await sleep(800)
  }
  win.setBounds({ width: WIDTH, height: Math.round(height) })
  await sleep(600)
  const image = await win.webContents.capturePage()
  await writeFile(join(OUT, `${name}.png`), image.toPNG())
  console.log(name, image.getSize())
  win.destroy()
}

// Electron quits once the last window closes; these windows come and go.
app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  for (const scene of scenes) await shoot(scene)
  app.quit()
})
