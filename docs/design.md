# Agent Inbox: design (estilo "Limão")

Estilo descontraído, neo-brutalista suave: fundo amarelo-creme, contornos pretos grossos, sombras sólidas deslocadas, cores vivas por tipo.

## Referências visuais

Fonte: canvas de design https://claude.ai/artifact/5LUAccViHxtMUEBKmz4b7G (secção "Design v1 — Limão"; as secções "wireframes v1" e "4 paletas" são exploração e não contam).

Cópia dos ecrãs finais em [`docs/design/`](design/), em HTML (fonte exata de medidas, cores e textos; descrição de cada um em [`product.md`](product.md#2-ecrãs-v1)):

| # | Ecrã | Ficheiro |
|---|---|---|
| 1 | Sem pedidos (compacto) | [`01-sem-pedidos.dc.html`](design/01-sem-pedidos.dc.html) |
| 2 | Lista de pedidos | [`02-lista.dc.html`](design/02-lista.dc.html) |
| 3 | Detalhe de permissão | [`03-permissao.dc.html`](design/03-permissao.dc.html) |
| 4 | Comando destrutivo | [`04-destrutivo.dc.html`](design/04-destrutivo.dc.html) |
| 5 | Detalhe de pergunta | [`05-pergunta.dc.html`](design/05-pergunta.dc.html) |
| 6 | No ecrã (PiP + separador do terminal destacado) | [`06-no-ecra.dc.html`](design/06-no-ecra.dc.html) |

Notas:

- São fontes do editor de design (`<x-dc>`, estilos inline); não abrem sozinhas no browser. Ver o aspeto no canvas; usar os ficheiros para tirar valores exatos.
- Os ecrãs mencionam o iTerm2 (ex: "A resposta é escrita na sessão do agente no iTerm2", janela "iTerm2" no ecrã 6). Na v1 o terminal é o WezTerm: na app, usar "terminal" ou o nome do terminal detetado.

## Tokens

### Cores

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#FFF8D6` | fundo da janela |
| `ink` | `#1A1A1A` | texto principal, contornos, sombras |
| `text-secondary` | `#555048` | texto secundário |
| `card` | `#FFFFFF` | fundo dos cartões |
| `permission` | `#FFD43B` | permissão / destaque |
| `question` | `#9EE6FF` | pergunta |
| `done` | `#C7F59A` | concluído |
| `danger` | `#FF7A59` | perigo / destrutivo |
| `avatar-1..4` | `#FF8FAB`, `#9EE6FF`, `#C7F59A`, `#FFD43B` | cores dos agentes |
| `disabled-bg` | `#F2EBC7` | fundo desativado |
| `disabled-text` | `#6B6553` | texto desativado |
| `disabled-border` | `#8A8473` | contorno desativado (tracejado) |

### Tipografia

- **Figtree:** UI; pesos 600–800 para títulos e botões.
- **JetBrains Mono:** comandos, branches, tempos.
- Se a stack não permitir estas fontes, usar as alternativas de sistema adequadas (ex: SF Pro / SF Mono).

### Forma

| Elemento | Valor |
|---|---|
| Contornos | 2px `ink` |
| Cantos: cartões e janela | 18–20px |
| Cantos: botões de opção | 14px |
| Botões e etiquetas | pílula |
| Sombra | sólida `3px 3px 0 #1A1A1A` (4px na janela) |

## Componentes

- **Botão principal:** fundo `#1A1A1A`, texto `#FFF8D6`.
- **Botão secundário:** fundo branco, contorno preto.
- **Botão desativado:** fundo `disabled-bg`, texto `disabled-text`, contorno tracejado `disabled-border`.
- **Caixa de comando:** fundo `#1A1A1A`, texto `#FFF8D6`, JetBrains Mono. Nos destrutivos, o padrão perigoso aparece realçado.
- **Etiqueta de tipo (pílula):** "quer correr" (`permission`), "pergunta" (`question`), "terminou" (`done`).
- **Avatar:** quadrado arredondado, iniciais, cor fixa do agente.
- **Pílula de agente (ecrã compacto):** cor, nome, ponto preenchido (a trabalhar) / vazio (inativo).
- **Faixa de perigo:** fundo `danger`, "Calma aí: isto apaga ficheiros".
- **Botões de opção:** numerados como no terminal (1, 2, 3…) nas permissões; letras (A, B…) nas perguntas.

## Tom do texto

Português de Portugal, informal e direto. Exemplos:

- "Tudo tranquilo"
- "3 à tua espera"
- "quer correr" · "pergunta" · "terminou"
- "Calma aí: isto apaga ficheiros"
- "Li o comando e quero mesmo apagar estes ficheiros"
- "Ou diz-lhe outra coisa" · "Ou responde à tua maneira"
- "Ir para o terminal" · "Ver no terminal" · "A mostrar no terminal…"

## Acessibilidade

- Botões reais (acessíveis por teclado e VoiceOver).
- Rótulos acessíveis nos botões só com ícone (fixar, compactar, definições, voltar, seta).
- Contraste de texto ≥ 4.5:1.
