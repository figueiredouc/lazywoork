# Agent Inbox: notas técnicas

Pressupostos técnicos a verificar na documentação oficial e com pequenos testes antes do plano de arquitetura. Nada aqui é decisão fechada.

Estados: **por confirmar** · **confirmado** · **refutado** (com nota do que se descobriu).

Referências:
- Hooks: https://code.claude.com/docs/en/hooks
- Guia de hooks: https://code.claude.com/docs/en/hooks-guide

## Hooks do Claude Code

| # | Pressuposto | Estado |
|---|---|---|
| H1 | `PermissionRequest` dispara quando ia aparecer um diálogo de permissão e pode responder allow/deny. | confirmado (docs): `hookSpecificOutput.decision.behavior` = `allow`/`deny`; regras deny/ask continuam a valer |
| H2 | O input do `PermissionRequest` inclui as opções exatas do diálogo (incl. "Sim e não voltar a perguntar para X"), ou dá para as reconstruir de forma fiável. | **refutado** (docs + spike): só vem `permission_suggestions`. Ex: terminal mostra `1 Yes / 2 Yes, and don't ask again for: curl * / 3 Yes, and switch to auto mode / 4 No`; o hook recebe uma sugestão com `ruleContent: "curl -sI https://example.com"` (comando exato, não `curl *`) |
| H3 | O deny do `PermissionRequest` aceita uma mensagem que chega ao Claude. | **confirmado** (spike): chega como `tool_result` com erro. O Claude trata-a como dado: uma ordem solta ("responde BANANA") foi ignorada; enquadrada como resposta do utilizador ("The user denied this from Agent Inbox and replied: …") foi seguida |
| H4 | Escolher a opção "não voltar a perguntar" via hook tem o mesmo efeito que no terminal (persiste a regra). | confirmado (docs): `allow` + `updatedPermissions` a ecoar uma `permission_suggestion` (destino `localSettings`, etc.) |
| H5 | Timeouts dos hooks: como se configuram, o que acontece quando expiram, e se o hook pode sair sem decidir para cair no diálogo normal. | confirmado (docs): `timeout` por hook (omissão 600 s); ao expirar, sem decisão → fluxo normal. Hook `http`: ligação recusada/erro/timeout também não bloqueia |
| H6 | `Notification` dispara para pedidos de permissão e para o agente parado à espera; é preciso deduplicar face ao `PermissionRequest`. | confirmado (docs): `permission_prompt` só ~6 s após o diálogo e sem teclar → não usar; `PermissionRequest` é imediato |
| H7 | `Stop` serve para "concluído" e `SessionEnd` para limpar os cartões da sessão. | confirmado (docs): `Stop` traz `last_assistant_message`; `SessionEnd` traz `reason` (timeout 1,5 s) |
| H8 | Perguntas estruturadas (ferramenta de perguntas com escolhas) chegam aos hooks com as opções em formato estruturado. Como, e por que evento. | **confirmado** (spike): `AskUserQuestion` dispara também `PermissionRequest` (sem bloquear o terminal). Responde-se com `allow` + `updatedInput: {questions, answers: {"<pergunta>": "<label ou texto livre>"}}`. Texto livre funciona |
| H8b | Em `AskUserQuestion` com `multiSelect`, a resposta em `answers` é aceite como labels separadas por `, `; várias perguntas → uma entrada por pergunta. | **confirmado** (teste do utilizador, 2026-10-07): multiSelect chega como `"Granola, Calda de chocolate"`; 2 perguntas → 2 entradas; texto livre por pergunta também funciona |
| H9 | Dá para detetar que um pedido foi respondido no terminal (para remover o cartão), ex: o processo do hook é terminado, ou chega um evento seguinte. | **confirmado** (spike): "No"/Esc no terminal → o Claude Code fecha a ligação HTTP do hook. "Yes" → a ligação fica aberta, mas chega `PostToolUse` da mesma sessão. Também servem `Stop`, `UserPromptSubmit` e `SessionEnd` (`reason: prompt_input_exit` no /exit) |
| H0 | **Crítico:** num terminal, o diálogo aparece enquanto o hook está pendente (corrida "quem responde primeiro")? | **confirmado para `PermissionRequest`** (spike 2026-10-07): o diálogo aparece logo e ganha quem responder primeiro. **Refutado para `PreToolUse`**: o terminal fica parado ("running PreToolUse hook") até o hook acabar → não usar `PreToolUse` |
| H10 | Registar hooks em `~/.claude/settings.json` com merge seguro em hooks existentes. | por confirmar |

## Plataforma da v1: Windows + WSL

| # | Pressuposto | Estado |
|---|---|---|
| P1 | Rede WSL em modo `mirrored` (`localhost` nos dois sentidos). | confirmado: `~/.wslconfig` tem `networkingMode=mirrored` e `hostAddressLoopback=true` |
| P2 | A app Electron corre do lado Windows (Node no Windows); os hooks correm no WSL. | confirmado (dummy + spikes) |
| P3 | O projeto em `C:\Users\Admin\Desktop\coolAppening\lazywoork` é acessível dos dois lados. | confirmado |
| P4 | WezTerm instalado no Windows, a abrir sessões WSL. | confirmado: 20240203, `default_domain = 'WSL:Ubuntu'` em `C:\Users\Admin\.wezterm.lua` |
| P5 | Porta da app fora das portas efémeras reservadas pelo WSL mirrored (44620–48715) | confirmado: 47823 dá EADDRINUSE no Node do Windows; usar 41823 |

## Resultado do spike de hooks (2026-10-07)

Claude Code 2.1.293, sessão interativa em tmux no WSL, hooks `type: "http"` para um servidor Node local.

- **Um só hook de decisão:** `PermissionRequest` (matcher `*`) cobre permissões **e** perguntas `AskUserQuestion`, em corrida com o diálogo do terminal. Não usar `PreToolUse` (bloqueia o terminal).
- **Sem script de hook:** `type: "http"` para a app; app fechada = ligação recusada = terminal normal.
- Hooks `http` com a app fechada mostram 'Stop hook error: connect ECONNREFUSED' no terminal → usar hooks `command` com `curl ... || true`.
- **Cabeçalhos com env vars:** `WEZTERM_PANE` chegou via `headers` + `allowedEnvVars`.
- **Sinais de "já respondido":** ligação fechada (No/Esc), `PostToolUse`/`PostToolUseFailure` da mesma sessão (Yes), `Stop`, `UserPromptSubmit`, `SessionEnd`.
- **`Notification`:** dispara `permission_prompt` ~6 s depois; ignorar.

## Terminal: WezTerm (v1)

| # | Pressuposto | Estado |
|---|---|---|
| W1 | `WEZTERM_PANE` é herdado pelo processo do hook e identifica de forma única o painel/separador. | confirmado **só com config**: por omissão o WezTerm não o passa ao WSL; resolvido acrescentando `WEZTERM_PANE:WEZTERM_UNIX_SOCKET` à `WSLENV` em `set_environment_variables` |
| W2 | `wezterm cli activate-pane` foca o painel certo **e** traz a janela para a frente. | **em parte**: `activate-pane` muda o separador mas não traz a janela. Trazer à frente: `WScript.Shell.AppActivate(<pid do wezterm-gui>)` funcionou (pid vem do nome do socket `gui-sock-<pid>`). Ambientes de trabalho virtuais: por testar |
| W3 | Dá para destacar o separador (cor amarela, "aqui!") a partir da app e repor depois. | confirmado: `wezterm cli set-tab-title --pane-id N "aqui! · nome"` + `format-tab-title` (separador amarelo) + `update-status` (moldura amarela 6px); `set-tab-title ""` repõe |
| W4 | `wezterm cli send-text` escreve texto na sessão certa sem roubar o foco. | confirmado (`--no-paste`, com `\n` no fim para submeter) |
| W5 | WSL: `WEZTERM_PANE` chega ao hook e `wezterm.exe cli` é chamável a partir do WSL. | confirmado com a config de W1. Do WSL, o `wezterm.exe cli` precisa de `WEZTERM_UNIX_SOCKET` explícito; a app corre no Windows e não tem esse problema |
| W6 | WSL: o hook no WSL chega à app no Windows por HTTP em localhost. | confirmado: 1–10 ms (rede `mirrored`) |

## Adaptador de terminal

| # | Pressuposto | Estado |
|---|---|---|
| T1 | Uma interface comum (identificar sessão, focar, destacar, enviar texto) cobre WezTerm, iTerm2 e tmux; cada capacidade pode faltar (modo reduzido). | **confirmado** (2026-10-11): `terminal.ts` com `focus`/`clearHighlight`/`sendText` serve os dois adaptadores sem alterar o núcleo; a escolha é pelo cabeçalho recebido, não pela plataforma |
| T2 | Num terminal sem adaptador, dá para pelo menos trazer a app do terminal para a frente (ex: via `TERM_PROGRAM`). | por confirmar |
| T3 | iTerm2 (depois da v1): `ITERM_SESSION_ID` + AppleScript permitem focar, destacar e escrever texto numa sessão. | **confirmado** (spike 2026-10-11): `ITERM_SESSION_ID` é `w0t2p0:<uuid>` e o `<uuid>` é o `id` da sessão em AppleScript; percorrer `windows` → `tabs of w` → `sessions of t` e comparar `id of s` encontra-a; `select w`/`select t`/`select s` + `set name of s to "aqui! · x"` funcionam e `set name of s to ""` repõe o título; `select` sozinho **não** levanta a app (é preciso `activate`); `write text "…"` compila contra o dicionário do iTerm2 |

## macOS + iTerm2

| # | Pressuposto | Estado |
|---|---|---|
| M1 | O título `aqui! · nome` sobrevive aos escapes de título que o próprio Claude Code escreve (não é logo substituído). | por confirmar |
| M2 | O Electron precisa da permissão de Automação do macOS para o iTerm; o pedido aparece no primeiro "Ir para o terminal" e, uma vez dado, não volta. | por confirmar |
| M3 | `write text` entra no TUI do Claude Code como texto normal e submete (sem colar nem partir linhas). | por confirmar |
| M4 | `showInactive()` + `type: 'panel'` + `setVisibleOnAllWorkspaces` nunca roubam o foco do teclado no macOS, e a janela fica por cima em todos os Spaces (incl. ecrã inteiro). | por confirmar |

## App

| # | Pressuposto | Estado |
|---|---|---|
| A1 | Stack web-based, sem Swift (decisão do utilizador). Candidata: Electron + TypeScript; alternativa Tauri. Propor e justificar no plano. | por confirmar |
| A2 | Uma janela Electron (`type: 'panel'`, `showInactive()`, `setAlwaysOnTop('floating')`, `setVisibleOnAllWorkspaces`) consegue, no Windows, ficar sempre por cima, em todos os ambientes de trabalho virtuais, sem roubar o foco do teclado, e ainda assim aceitar cliques e texto quando o utilizador interage. | por confirmar |
| A3 | Comunicação hooks ↔ app por HTTP em localhost, com latência < 1 s ponta a ponta. | por confirmar |
| A4 | Identidade do agente: pasta do projeto + branch git, com override por variável de ambiente; cor fixa derivada de forma estável. | por confirmar |

## Janela Electron no Windows (para o dummy)

Fonte: docs Electron (`BrowserWindow`, "Custom window styles"), lidas a 2026-10-07.

| # | Pressuposto | Estado |
|---|---|---|
| E1 | `setAlwaysOnTop(true, level)` mantém a janela por cima. A partir de `pop-up-menu` fica também por cima da barra de tarefas. | confirmado no dummy (2026-10-07) |
| E2 | `showInactive()` mostra sem tirar o foco; nunca chamar `focus()`. A janela continua a aceitar cliques e texto quando o utilizador clica nela. | confirmado no dummy (2026-10-07) |
| E3 | `frame: false` + `transparent: true`, cantos e sombra sólida em CSS. Limites documentados: janela transparente **não é redimensionável pelo utilizador**; a zona transparente **não deixa passar cliques**; DevTools aberto tira a transparência. A janela deve ter só a margem da sombra (4px). | confirmado no dummy (2026-10-07) |
| E4 | Arrastar por zona `app-region: drag`; mudar entre compacto e expandido com `setBounds()` a partir do código. | por testar |
| E5 | Visível em todos os ambientes de trabalho virtuais. | **refutado para o Electron**: `setVisibleOnAllWorkspaces` "does nothing on Windows". Alternativas (API não documentada do Windows, ou "Mostrar em todos os ambientes" manual) ficam para depois. |
| E6 | Correr o Electron com o Node do Windows a partir do projeto em `/mnt/c`. | confirmado. Nota: o Electron 44 já não descarrega o binário no `npm install` e o electron-vite não o faz sozinho; correr `node node_modules\electron\install.js` uma vez. Vite fixado em 7 (electron-vite 5 não suporta Vite 8). |
| E7 | Fontes Figtree e JetBrains Mono incluídas na app (woff2 locais). | confirmado no build (`@fontsource/*`, ficheiros em `out/renderer/assets`); aspeto confirmado |

## Fora do âmbito da v1

Adaptadores para Terminal.app, VS Code, tmux e Windows Terminal (o de iTerm2 entrou em 2026-10-11). A integração com o terminal fica atrás de uma interface para não os impedir.
