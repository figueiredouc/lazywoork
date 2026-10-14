# Agent Inbox: arquitetura (v1)

Estado: **proposta, a aguardar aprovação.** Decisões já tomadas (2026-10-07): opções Sim / Sim+sugestão / Não; `Stop` a acabar em "?" = pergunta em texto livre. Baseada nos resultados em [`technical-notes.md`](technical-notes.md).

## Visão geral

```
WSL                                   Windows
┌──────────────────────┐   HTTP      ┌───────────────────────────────────────┐
│ claude (sessão N)    │  localhost  │ Agent Inbox (Electron)                │
│  hooks (curl) ───────┼────────────►│  main: servidor HTTP 127.0.0.1:41823  │
│  headers: pane,      │◄────────────┼─  inbox (estado dos pedidos)          │
│  socket, nome        │  decisão    │  terminal.ts (wezterm.ts / iterm.ts)  │
└──────────────────────┘             │  renderer: UI do dummy (React)        │
                                     └───────────────────────────────────────┘
```

No macOS é o mesmo desenho sem a fronteira: Claude Code, iTerm2 e a app na mesma máquina.

Sem scripts de hook: cada hook é um `curl` que faz o POST, e a app responde.
App fechada → ligação recusada → `|| true` → o Claude Code segue como hoje.

## Hooks (`~/.claude/settings.json`, no WSL ou no Mac)

Todos `type: "command"`: um `curl` que envia o stdin (JSON do hook) por POST para `http://127.0.0.1:41823/hook`,
com cabeçalhos `X-Wezterm-Pane: $WEZTERM_PANE`, `X-Wezterm-Socket: $WEZTERM_UNIX_SOCKET`,
`X-Iterm-Session: $ITERM_SESSION_ID`, `X-Agent-Name: $AGENT_INBOX_NAME`, `X-Wsl-Distro: $WSL_DISTRO_NAME`, e `|| true` no fim.
Um só conjunto de cabeçalhos para as duas plataformas: variável não definida → cabeçalho vazio → a app trata-o como ausente.

- `PermissionRequest`: `--max-time 600`; o stdout do `curl` (decisão JSON da app, ou vazio) é a saída do hook.
- Restantes: `--max-time 2 -o /dev/null` (não há decisão).

Porquê `command` e não `type: "http"`: com a app fechada, os hooks `http` mostram
"Stop hook error: connect ECONNREFUSED" no terminal a cada turno. Com `curl … || true` o hook sai com 0 e sem
saída, e o Claude Code comporta-se exatamente como hoje.

| Evento | Para quê | A app responde |
|---|---|---|
| `PermissionRequest` (matcher `*`) | Cartão de permissão **e** de pergunta (`AskUserQuestion`) | Segura a ligação até haver resposta (corrida com o terminal) |
| `PostToolUse`, `PostToolUseFailure` | "Respondido no terminal" (Sim) | Logo, vazio |
| `UserPromptSubmit` | Sessão voltou a ser usada → limpa pendentes dela | Logo, vazio |
| `Stop` | Cartão "terminou" (ou pergunta em texto livre) | Logo, vazio |
| `SessionEnd` | Remove os cartões da sessão | Logo, vazio |

Não usar `PreToolUse` (bloqueia o terminal) nem `Notification` (chega ~6 s depois).

## Ciclo de um pedido

1. `PermissionRequest` chega → cria cartão; a resposta HTTP fica pendurada.
2. Termina por uma de:
   - **resposta na app** → a app responde com a decisão e remove o cartão;
   - **ligação fechada pelo Claude Code** (Não/Esc no terminal) → remove;
   - **`PostToolUse`/`PostToolUseFailure`** da mesma sessão com o mesmo `tool_name` + `tool_input` (Sim no terminal) → responde vazio e remove;
   - **`UserPromptSubmit`/`Stop`/`SessionEnd`** da mesma sessão → responde vazio e remove todos os pendentes dela.
3. Um cartão por pedido; um só cartão "terminou" por sessão (o novo substitui o anterior).

## Mapeamento de respostas

| Na app | Resposta ao `PermissionRequest` |
|---|---|
| Sim | `{behavior: "allow"}` |
| Sim, e não voltar a perguntar para «X» | `{behavior: "allow", updatedPermissions: [<sugestão recebida>]}` (uma opção por sugestão; o texto vem do `ruleContent`) |
| Não | `{behavior: "deny", message: "The user denied this from Agent Inbox."}` |
| Ou diz-lhe outra coisa | `{behavior: "deny", message: "The user denied this from Agent Inbox and replied: \"<texto>\""}` |
| Opção A/B de uma pergunta | `{behavior: "allow", updatedInput: {...tool_input, answers: {"<pergunta>": "<label>"}}}` |
| Ou responde à tua maneira (pergunta com opções) | igual, com o texto em vez do label |
| Enviar (pergunta em texto livre, vinda do `Stop`) | `sendText` no adaptador do terminal do agente |

Comandos destrutivos: a lista de padrões filtra as opções "não voltar a perguntar" e exige confirmação (já feito no dummy).

## Identidade do agente

- Sessão = `session_id`. Nome = `X-Agent-Name` ou o nome da pasta de `cwd`.
- Branch: a app lê `.git/HEAD` a procurar para cima a partir de `cwd` — em `\\wsl.localhost\<distro><cwd>` quando há `X-Wsl-Distro`, no caminho local (macOS) quando não há.
- Cor: hash do nome → uma das 4 cores de avatar.
- Terminal: `X-Wezterm-Pane` ou `X-Iterm-Session`; sem nenhum → modo reduzido. O `Agent` só leva `terminal: { app, label }` (nome a mostrar + localizador curto, vazio no iTerm2); o id da sessão fica no main.

## Terminais (`src/main/terminal.ts` + adaptadores)

Interface comum, três funções: `focus(target, nome)`, `clearHighlight(target)`, `sendText(target, texto)`.
O `target` é `{ pane, socket, iterm }`; o router escolhe o adaptador pelo **cabeçalho que chegou** (não pelo `process.platform`),
para que o mesmo binário sirva as duas plataformas. Destaque de 5 s nos dois, reposto por `clearHighlight`.

**WezTerm (`wezterm.ts`, Windows):**

- `focus`: `wezterm cli activate-pane` + `AppActivate(<pid>)` (pid tirado de `gui-sock-<pid>`).
- destaque: `set-tab-title "aqui! · nome"` / `""`; o resto está no `.wezterm.lua`.
- `sendText`: `send-text --no-paste` + `\r`.

**iTerm2 (`iterm.ts`, macOS):** um `osascript` por operação, com o script em stdin (`osascript -`, nunca `-e`: evita aspas em argv)
e as strings interpoladas escapadas (`\` e `"`). O id da sessão é o que vem depois do primeiro `:` em `ITERM_SESSION_ID`
(`w0t2p0:<uuid>` → `<uuid>`); o script percorre `windows` → `tabs` → `sessions` à procura do `id of s`, e falha se não existir
(a app devolve `false` e a UI mostra o aviso).

- `focus`: `activate` + `select w` / `select t` / `select s` + `set name of s to "aqui! · nome"` (`select` sozinho não levanta a app).
- destaque: `set name of s to ""` repõe o título controlado pelo programa.
- `sendText`: `write text "<texto>"` — a newline implícita submete.

Sem terminal conhecido → modo reduzido: `focus` e `sendText` indisponíveis (botão escondido, avisos na app).

## Renderer

A UI do dummy fica. `fake-data.ts` é substituído por estado vindo do main (IPC `inbox:state`); as ações (`answer`, `goToTerminal`) passam a IPC. Os tipos de `model.ts` mantêm-se.

## Instalação (F4)

Script que faz merge dos hooks em `~/.claude/settings.json` (com backup) e acrescenta o bloco ao `.wezterm.lua`. Até lá, configuro à mão para os testes.

## Fora da v1 / decisões adiadas

- Perguntas `multiSelect` (mostradas como escolha simples; marcar se aparecerem).
- Visível em todos os ambientes de trabalho virtuais (E5).
- Porta configurável (fixa em 41823).
