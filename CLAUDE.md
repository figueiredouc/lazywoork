# Agent Inbox (lazywoork)

App desktop (Electron) com uma janela pequena, flutuante e sempre por cima (estilo PiP) que mostra um cartão por cada pedido pendente das sessões do Claude Code: permissões, perguntas e tarefas concluídas. O utilizador responde ali mesmo ou salta para o separador certo do terminal, que fica destacado.

## Princípios inegociáveis

1. **Nunca bloquear.** Com a app fechada, com erro ou sem resposta dentro do timeout, o hook sai e o Claude Code comporta-se exatamente como hoje.
2. **Tudo local.** Hooks ↔ app só por HTTP em localhost. Nada sai da máquina.
3. **Nunca roubar o foco do teclado.** Cartões novos chamam a atenção, não tiram o foco.
4. **Opções dinâmicas.** Os botões de resposta vêm das opções reais de cada pedido, nunca fixos na app. Sem opções estruturadas → só caixa de texto (não extrair opções de texto livre na v1).
5. **Comandos destrutivos.** Padrões configuráveis; exigem confirmação explícita, "Não" em destaque, e **nunca** oferecem "não voltar a perguntar".
6. **Sem duplicados.** Um cartão por pedido; responder no terminal remove o cartão; fim de sessão remove os cartões dela.

## Stack

- **App:** Electron + TypeScript, UI em React + Vite. **Sem Swift.** Detalhes no plano de arquitetura.
- **Hooks ↔ app:** HTTP em localhost (funciona também entre WSL e Windows; unix socket não).
- **Duas camadas:**
  - **Núcleo** (independente do terminal): hooks, cartões, respostas a permissões, concluídos.
  - **Adaptadores de terminal** (um por terminal, atrás de uma interface comum): focar janela/separador, destacar, escrever texto na sessão.
- **Plataformas: Windows e macOS.** No Windows, a app Electron e o WezTerm correm no Windows e o Claude Code (e os hooks) no WSL. No macOS corre tudo na mesma máquina.
- **Terminais: WezTerm** (`wezterm cli`, `WEZTERM_PANE`) **e iTerm2** (`osascript`, `ITERM_SESSION_ID`), atrás da mesma interface (`src/main/terminal.ts`). Sem adaptador → modo reduzido (ver `docs/product.md`).
- Mais tarde, se fizer falta: tmux, Windows Terminal.

## Correr (Windows)

A app corre com o **Node do Windows**, não o do WSL. Numa PowerShell na pasta do projeto:

```
npm install
node node_modules\electron\install.js   # só na 1.ª vez: descarrega o binário do Electron
npm run dev                              # app com hot reload
npm run typecheck
```

A partir do WSL (sem pedidos de permissão): `bash scripts/npm-win run dev` / `bash scripts/npm-win run typecheck`. Não usar `cmd.exe`/`powershell.exe` para isto: pedem sempre permissão.

## Correr (macOS)

Tudo na mesma máquina, sem truques:

```
npm install
node node_modules/electron/install.js   # só na 1.ª vez: descarrega o binário do Electron
npm run dev
npm run typecheck
```

Se a pasta vier de uma instalação feita noutro sistema, apaga o `node_modules` antes do `npm install`: os binários nativos são por plataforma.

Na primeira vez que carregares em "Ir para o terminal", o macOS pede permissão de Automação para o iTerm (Definições → Privacidade e Segurança → Automação). Enquanto não a deres, o botão falha e a app mostra o aviso.

## Como trabalhar comigo

- Falar em português de Portugal. Código, nomes, comentários e commits em inglês. Texto da UI em PT-PT informal (ver `docs/design.md`).
- **Plano antes de código.** Nada de implementação sem aprovação do plano de arquitetura.
- O código é escrito por um agente de código, não pela sessão principal: a sessão principal faz o briefing, revê (typecheck/build) e dá ao utilizador as instruções de teste.
- Um passo de cada vez (`docs/roadmap.md`): o utilizador testa cada feature na app antes do passo seguinte.
- Pressupostos técnicos são hipóteses até serem verificados: atualizar o estado em `docs/technical-notes.md`.

## Docs

- `docs/product.md`: ideia, ecrãs, regras de comportamento, critérios de aceitação.
- `docs/design.md`: estilo "Limão": tokens, componentes, tom.
- `docs/design/`: PNG exportados do design (ecrãs 1–6).
- `docs/architecture.md`: arquitetura da v1 (hooks http → app, WezTerm).
- `docs/technical-notes.md`: pressupostos técnicos e respetivo estado.
- `docs/handoff-carlos.md`: passagem de contexto para o próximo agente orquestrador.
- `docs/roadmap.md`: plano de trabalho e fases.
