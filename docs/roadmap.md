# Agent Inbox: roadmap

## Passo 0: documentação base ✅

`CLAUDE.md` + `docs/`. A aguardar revisão.

## Passo 0.5: dummy da UI ✅

App Electron + React + Vite com cartões falsos e todas as interações dos ecrãs 1–5, sem hooks nem terminal. É a base da UI real: depois só se troca a fonte de dados. Serve também para testar E1–E7 (`technical-notes.md`).

## Passo 1: investigação ✅

Investigação e pequenos testes dos pressupostos mais arriscados (ver [`technical-notes.md`](technical-notes.md)):

- associação hook → painel do WezTerm (incl. WSL);
- opções do `PermissionRequest`;
- perguntas estruturadas;
- timeouts;
- escrever texto na sessão.

Resultado: estados atualizados em `technical-notes.md`.

## Passo 2: plano de arquitetura

Proposta em [`architecture.md`](architecture.md).

Plano para aprovação. **Nada de implementação antes da aprovação.**

## Passo 3: implementação passo a passo

Cada passo é implementado por um agente de código, a partir de um briefing meu, e testado pelo utilizador na app antes do passo seguinte.

| Passo | Feature que se testa | Estado |
|---|---|---|
| 1 | **Cartões reais (só ver):** servidor de hooks na app; pedidos de permissão, perguntas e "terminou" das sessões reais aparecem no PiP; desaparecem quando se responde no terminal; pílulas de agentes reais. Inclui o script que instala os hooks (com backup). | ✅ testado (2026-10-07) |
| 2 | **Responder a permissões na app:** Sim / Sim e não voltar a perguntar / Não / "Ou diz-lhe outra coisa" / destrutivos. | ✅ testado (2026-10-07) |
| 3 | **Responder a perguntas com opções na app** (A/B e texto livre). | ✅ testado (2026-10-07) |
| 4 | **"Ir para o terminal"** com destaque no WezTerm. | ✅ testado (2026-10-07) |
| 5 | **Perguntas em texto livre** (`Stop` a acabar em "?") e "Enviar" escrito no WezTerm. | ✅ testado (2026-10-07) |
| 6 | **Polimento:** instalador final (hooks + `.wezterm.lua`), arranque, casos-limite. | |
| 7 | **macOS + iTerm2:** adaptadores atrás de uma interface comum (`terminal.ts`); focar/destacar/escrever por AppleScript; janela `panel` em todos os Spaces. | ⏳ por testar |

## Passo 4: testes por fase

No fim de cada fase: instruções exatas de como testar, ligadas aos critérios de aceitação em [`product.md`](product.md#4-critérios-de-aceitação-v1).

## Depois da v1

- Se fizer falta: tmux, Windows Terminal, Terminal.app.
