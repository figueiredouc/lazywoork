# Agent Inbox: arquitetura (v1)

Estado: **proposta, a aguardar aprovação.** Decisões já tomadas (2026-10-07): opções Sim / Sim+sugestão / Não; `Stop` a acabar em "?" = pergunta em texto livre. Baseada nos resultados em [`technical-notes.md`](technical-notes.md).

## Visão geral

```
WSL                                   Windows
┌──────────────────────┐   HTTP      ┌───────────────────────────────────────┐
│ claude (sessão N)    │  localhost  │ Agent Inbox (Electron)                │
│  hooks (curl) ───────┼────────────►│  main: servidor HTTP 127.0.0.1:41823  │
│  headers: pane,      │◄────────────┼─  inbox (estado dos pedidos)          │
│  socket, nome        │  decisão    │  wezterm.ts (wezterm.exe cli + foco)  │
└──────────────────────┘             │  renderer: UI do dummy (React)        │
                                     └───────────────────────────────────────┘
```

Sem scripts de hook: cada hook é um `curl` que faz o POST, e a app responde.
App fechada → ligação recusada → `|| true` → o Claude Code segue como hoje.

## Hooks (`~/.claude/settings.json` no WSL)

Todos `type: "command"`: um `curl` que envia o stdin (JSON do hook) por POST para `http://127.0.0.1:41823/hook`,
com cabeçalhos `X-Wezterm-Pane: $WEZTERM_PANE`, `X-Wezterm-Socket: $WEZTERM_UNIX_SOCKET`,
`X-Agent-Name: $AGENT_INBOX_NAME`, `X-Wsl-Distro: $WSL_DISTRO_NAME`, e `|| true` no fim.

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
| Enviar (pergunta em texto livre, vinda do `Stop`) | `wezterm cli send-text` na sessão do agente |

Comandos destrutivos: a lista de padrões filtra as opções "não voltar a perguntar" e exige confirmação (já feito no dummy).

## Identidade do agente

- Sessão = `session_id`. Nome = `X-Agent-Name` ou o nome da pasta de `cwd`.
- Branch: a app lê `.git/HEAD` em `\\wsl.localhost\Ubuntu<cwd>` (procura para cima).
- Cor: hash do nome → uma das 4 cores de avatar.
- Separador: `X-Wezterm-Pane`; sem ele → modo reduzido.

## WezTerm (`src/main/wezterm.ts`)

Quatro funções, sem interface abstrata (só há um terminal na v1):

- `focus(pane, socket)`: `wezterm cli activate-pane` + `AppActivate(<pid>)` (pid tirado de `gui-sock-<pid>`), chamado no clique.
- `highlight(pane, nome)` / `clearHighlight(pane)`: `set-tab-title "aqui! · nome"` / `""`; o resto está no `.wezterm.lua`.
- `sendText(pane, texto)`: `send-text --no-paste` + `\n`.

Sem pane → `focus` só traz o WezTerm para a frente; `sendText` indisponível (botão escondido).

## Renderer

A UI do dummy fica. `fake-data.ts` é substituído por estado vindo do main (IPC `inbox:state`); as ações (`answer`, `goToTerminal`) passam a IPC. Os tipos de `model.ts` mantêm-se.

## Instalação (F4)

Script que faz merge dos hooks em `~/.claude/settings.json` (com backup) e acrescenta o bloco ao `.wezterm.lua`. Até lá, configuro à mão para os testes.

## Fora da v1 / decisões adiadas

- Perguntas `multiSelect` (mostradas como escolha simples; marcar se aparecerem).
- Visível em todos os ambientes de trabalho virtuais (E5).
- Porta configurável (fixa em 41823).
