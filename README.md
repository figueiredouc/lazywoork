<div align="center">

<img src="docs/screenshots/icon.png" width="110" alt="Agent Inbox" />

# Agent Inbox

**A caixa de entrada dos teus agentes.** Uma janela pequena, flutuante e sempre por cima que mostra um cartão por cada sessão do Claude Code que está à tua espera — permissões, perguntas e trabalhos terminados. Respondes ali mesmo, sem andar à procura do separador certo.

`macOS` · `Windows + WSL` · Electron + React · tudo local

<img src="docs/screenshots/2-lista.png" width="340" alt="Lista de pedidos" />

</div>

---

## O problema

Com 3 a 5 sessões do Claude Code em paralelo, os agentes passam metade do tempo parados: um quer correr um comando, outro fez uma pergunta, outro acabou há cinco minutos e ninguém deu por isso. A informação está toda lá — num separador de terminal que não estás a ver.

O Agent Inbox junta esses pedidos num sítio só.

## O que faz

- **Um cartão por pedido.** Permissões, perguntas e "terminou", de todas as sessões, com o nome do agente, a branch e há quanto tempo espera.
- **Respondes na app.** Os botões são as opções reais daquele pedido — nunca uma lista fixa. Ou escreves uma mensagem e o agente segue por aí.
- **Salta para o terminal.** Um clique traz a janela do terminal para a frente, no separador certo, com destaque.
- **Nunca te atrapalha.** Não rouba o foco do teclado, e com a app fechada o Claude Code comporta-se exatamente como hoje.

## Os ecrãs

<table>
<tr>
<td align="center" width="33%">
<img src="docs/screenshots/1-compacto.png" alt="Sem pedidos" /><br />
<b>Tudo tranquilo</b><br />
Modo compacto: uma pílula por agente ligado, ponto cheio = a trabalhar.
</td>
<td align="center" width="33%">
<img src="docs/screenshots/3-permissao.png" width="250" alt="Detalhe de permissão" /><br />
<b>Permissão</b><br />
O comando completo, o porquê, e um botão por cada opção que o pedido oferece.
</td>
<td align="center" width="33%">
<img src="docs/screenshots/5-pergunta.png" width="250" alt="Detalhe de pergunta" /><br />
<b>Pergunta</b><br />
Opções A/B quando existem; senão, só a caixa de resposta, escrita na sessão certa.
</td>
</tr>
</table>

### Comandos destrutivos

<div align="center">
<img src="docs/screenshots/4-destrutivo.png" width="300" alt="Comando destrutivo" />
</div>

Padrões como `rm -rf`, `git reset --hard` ou `DROP TABLE` ficam realçados dentro do comando, o "Sim" só desbloqueia depois de confirmares, o "Não" é a opção em destaque — e **nunca** há "não voltar a perguntar".

## Como funciona

Os hooks do Claude Code fazem um `curl` para a app, em localhost. Nada sai da máquina.

```
Claude Code (sessão N)            Agent Inbox (Electron)
  hooks (curl) ──── POST ───────► 127.0.0.1:41823/hook
               ◄─── decisão ────  cartão respondido na app
```

No `PermissionRequest` a app segura a ligação até haver resposta — na app ou no terminal, o que vier primeiro. Se responderes no terminal, o cartão desaparece sozinho. Se a app estiver fechada, o `curl` falha com `|| true` e o diálogo normal aparece no terminal, como sempre.

Detalhes em [`docs/architecture.md`](docs/architecture.md).

## Instalar (macOS)

```bash
npm install
node node_modules/electron/install.js   # só na 1.ª vez: descarrega o binário do Electron
npm run dist:mac                        # gera release/Agent Inbox-<versão>-arm64.dmg
```

Abre o `.dmg`, arrasta a app para as Aplicações e regista os hooks na sessão onde corre o Claude Code:

```bash
node scripts/install-hooks.mjs          # mostra o que vai mudar
node scripts/install-hooks.mjs --apply  # escreve em ~/.claude/settings.json (com backup)
```

Na primeira vez que carregares em "Ir para o terminal", o macOS pede permissão de Automação para o iTerm2 (Definições → Privacidade e Segurança → Automação).

A app não está assinada com uma conta de programador: na primeira abertura usa botão direito → Abrir.

### Windows + WSL

A app e o WezTerm correm no Windows, o Claude Code e os hooks no WSL. Instruções em [`CLAUDE.md`](CLAUDE.md).

## Desenvolvimento

```bash
npm run dev        # app com hot reload
npm run typecheck
```

## Terminais

| Terminal | Estado |
|---|---|
| WezTerm (`wezterm cli`) | suporte completo: focar, destacar o separador, escrever na sessão |
| iTerm2 (AppleScript) | suporte completo |
| Outros | modo reduzido: cartões e respostas a permissões funcionam; sem saltar para o separador |

## Princípios

1. **Nunca bloquear.** App fechada, com erro ou sem resposta dentro do tempo → o hook sai e o Claude Code segue como hoje.
2. **Tudo local.** Hooks ↔ app só por HTTP em localhost.
3. **Nunca roubar o foco do teclado.** Um cartão novo chama a atenção, não te tira do sítio.
4. **Opções dinâmicas.** Os botões vêm das opções reais de cada pedido.
5. **Comandos destrutivos** exigem confirmação explícita e nunca oferecem "não voltar a perguntar".
6. **Sem duplicados.** Um cartão por pedido; responder no terminal remove-o; o fim da sessão limpa os dela.

## Docs

| Ficheiro | O que tem |
|---|---|
| [`docs/product.md`](docs/product.md) | Ideia, ecrãs, regras de comportamento, critérios de aceitação |
| [`docs/design.md`](docs/design.md) | Estilo "Limão": tokens, componentes, tom |
| [`docs/architecture.md`](docs/architecture.md) | Hooks, ciclo de um pedido, adaptadores de terminal |
| [`docs/technical-notes.md`](docs/technical-notes.md) | Pressupostos técnicos e o seu estado |
| [`docs/roadmap.md`](docs/roadmap.md) | Plano de trabalho e fases |

## Licença

[Apache 2.0](LICENSE).
