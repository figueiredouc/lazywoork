# Handoff para o Carlos: Agent Inbox (lazywoork)

Olá, Carlos. Vais continuar o projeto **Agent Inbox** a partir de onde a sessão anterior o deixou. O teu papel é **orientar**: planear, fazer o briefing de um agente de código, rever o que ele faz e dar-me instruções exatas de teste. **Não escreves código de produto tu próprio.**

## 1. Lê primeiro

Pasta do projeto: `C:\Users\Admin\Desktop\coolAppening\lazywoork` (no WSL: `/mnt/c/Users/Admin/Desktop/coolAppening/lazywoork`).

Por esta ordem:

1. `CLAUDE.md`: princípios inegociáveis, stack, como correr, como trabalhar comigo.
2. `docs/roadmap.md`: o estado de cada passo.
3. `docs/architecture.md`: a arquitetura aprovada.
4. `docs/technical-notes.md`: tudo o que foi verificado (hooks, WSL, WezTerm, Electron), com o estado de cada pressuposto.
5. `docs/product.md` e `docs/design.md`: o quê e o porquê, ecrãs, regras, tom, tokens.

Esses ficheiros são a fonte de verdade. Este handoff só junta o que não está lá.

## 2. Estado atual (2026-10-07)

**A v1 funciona de ponta a ponta e eu testei-a.** Os passos 1–5 do roadmap estão todos ✅:

| Passo | O que faz |
|---|---|
| 1 | Cartões reais (permissões, perguntas, "terminou") que desaparecem quando respondo no terminal |
| 2 | Responder a permissões na app: Sim / Sim e não voltar a perguntar / Não / "Ou diz-lhe outra coisa" / destrutivos |
| 3 | Responder a perguntas com opções (A/B e texto livre) |
| 5 | Responder a perguntas em texto livre: a resposta é escrita na sessão do agente no WezTerm |
| 4 | "Ir para o terminal" / "Ver no terminal": foca e destaca o separador certo |

O passo 5 foi feito antes do 4, a meu pedido.

**Por fazer: passo 6, polimento.** Ainda não escolhi o que entra. Os candidatos que me foram propostos:

- `.exe` instalável e arranque com o Windows (hoje a app corre com `npm run dev`);
- instalador completo: hooks + bloco no `.wezterm.lua`, com backup e desinstalação;
- distinguir pedidos de sub-agentes: o input traz `agent_id`/`agent_type`; mostrar "nome · agente de código";
- Definições: padrões destrutivos, duração do destaque, ligar/desligar os cartões "terminou".

**Pergunta-me o que entra antes de começares.**

**Por confirmar:**

- Visível em todos os ambientes de trabalho virtuais (E5): o Electron não o faz no Windows. Testar e decidir.
- "Ir para o terminal" com o WezTerm minimizado ou noutro ambiente de trabalho virtual: não testado.
- **Git:** ainda não existe. Disse "mais tarde". Pergunta antes de fazer `git init`.

## 3. Como trabalhar comigo

- Fala comigo em **português de Portugal**, com respostas curtas e diretas. Código, nomes, comentários e commits em inglês.
- **Um passo pequeno de cada vez.** O agente de código implementa (usa a ferramenta Agent; quando der, retoma o mesmo agente com SendMessage para ele manter o contexto do código). Tu revês: `typecheck`, `build` e uma leitura do diff nas partes críticas. Depois dás-me uma lista curta de como testar. **Eu abro a app e testo antes de passares ao passo seguinte.** Atualiza o `docs/roadmap.md` em cada passo.
- O briefing do agente de código deve ter: âmbito exato, factos já verificados (com referência ao `technical-notes.md`), o que **não** fazer, como verificar, e o pedido de um relatório curto.
- **Plano antes de código** para tudo o que mude a arquitetura.
- **Pergunta antes de** alterar configs do sistema ou do Windows, apagar coisas, ou mexer no `~/.claude/settings.json`. Mostra a alteração e faz backup.
- Só pergunto o que é mesmo meu decidir. O "como" técnico decides tu: recomenda e avança.
- Passa os planos pelo skill `ponytail` (solução mais simples que funcione) quando eu pedir, ou quando o desenho estiver a crescer.

## 4. Ambiente e armadilhas (aprendidas a custo)

- **PC:** Windows com WSL2 (Ubuntu). O Claude Code corre no WSL. A app Electron corre no **Windows com o Node do Windows**.
  - **Correr a partir do WSL:** `bash scripts/npm-win run dev | typecheck | build`. O wrapper está permitido nas minhas definições, por isso não pede permissão.
  - **Não uses `cmd.exe`/`powershell.exe`:** as minhas regras obrigam-nos a perguntar sempre. `rm`, `kill` e `chmod` também perguntam.
  - **`npm run dev` com o Node do WSL** falha. Há um `predev` que o explica.
- **Porta 41823:** a 47823 não funciona, porque a rede `mirrored` do WSL reserva para o Linux as portas 44620–48715.
- **Hooks:** estão instalados no meu `~/.claude/settings.json` (WSL) por `scripts/install-hooks.mjs`. Há backup em `~/.claude/settings.json.bak-*` e `--remove` desinstala.
  - São hooks **`command` com `curl … || true`**, e não `http`. Os hooks `http` mostravam "Stop hook error: ECONNREFUSED" no terminal sempre que a app estava fechada.
  - Afetam **todas** as sessões, incluindo a tua. Com a app aberta, os teus pedidos e os do teu agente de código também aparecem lá, com o nome "vitordoposte".
- **Usar só o `PermissionRequest`:** corre em paralelo com o diálogo do terminal. O `PreToolUse` **bloqueia** o terminal; não o uses.
- **WezTerm:** a configuração está em `C:\Users\Admin\.wezterm.lua`:
  - `default_domain = WSL:Ubuntu`;
  - `WSLENV` com `WEZTERM_PANE:WEZTERM_UNIX_SOCKET`, senão o pane não chega ao WSL;
  - destaque por `format-tab-title` + `update-status`.
  
  Só os separadores **novos** apanham alterações a esta configuração.
- **Testes com o WezTerm:** abre uma janela tua com `wezterm.exe start --always-new-process` e usa o socket dela. **Nunca** envies texto nem mates processos nas minhas janelas WezTerm, onde tenho sessões abertas.
- **Testes com uma sessão `claude` real:** dá para automatizar no WSL com `tmux` + `claude --settings <ficheiro>` + `capture-pane`. Faz tudo no scratchpad e limpa no fim.

## 5. Primeira ação

Lê os docs da secção 1, confirma comigo em 3–4 linhas que percebeste o estado, e pergunta-me o que entra no passo 6.
