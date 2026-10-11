# Agent Inbox: produto

## 1. A ideia

Trabalho com o Claude Code em 3–5 sessões em paralelo, cada uma num separador do terminal. Os agentes ficam muitas vezes parados à espera (a pedir permissão, a fazer uma pergunta, ou porque terminaram) e não dou por isso.

O **Agent Inbox** é uma app desktop: uma janela pequena, flutuante e sempre por cima (estilo picture-in-picture), que mostra um cartão por cada pedido pendente de um agente. Posso responder ali mesmo, ou ser levado ao separador certo do terminal, que fica destacado.

Na v1 a plataforma é **Windows**: a app e o WezTerm correm no Windows, o Claude Code corre no WSL. O terminal suportado por completo é o **WezTerm**. Noutros terminais a app funciona em modo reduzido (ver [Terminais](#terminais)).

**Princípio central:** a app nunca pode bloquear o meu trabalho. Se não estiver aberta ou eu não responder, o Claude Code comporta-se exatamente como hoje.

## 2. Ecrãs (v1)

Imagens em [`docs/design/`](design/). Visual e tokens em [`design.md`](design.md).

### Ecrã 1: Sem pedidos (compacto)

- Janela pequena com "Tudo tranquilo".
- Uma pílula por agente ligado: cor do agente, nome, ponto preenchido = a trabalhar, ponto vazio = inativo.
- Botão para expandir.

### Ecrã 2: Lista de pedidos

- Cabeçalho: título "N à tua espera"; botões "fixar por cima" e "compactar".
- Um cartão por pedido, com:
  - avatar quadrado arredondado com iniciais e a cor do agente;
  - nome do agente;
  - branch e tempo decorrido (mono);
  - etiqueta do tipo.
- Rodapé: "4 agentes · 1 a trabalhar" + Definições.

Tipos de cartão:

| Tipo | Etiqueta | Conteúdo | Ações |
|---|---|---|---|
| Permissão | amarela "quer correr" | comando numa caixa escura | "Sim", "Não", "Mais opções" (→ ecrã 3) |
| Pergunta | azul "pergunta" | texto da pergunta | um botão por opção (se existirem), seta (→ ecrã 5) |
| Concluído | verde "terminou" | resumo | "Ver no terminal", "Ok" (dispensa) |

### Ecrã 3: Detalhe de permissão

- Voltar ("Todos (3)") e posição ("1 de 3").
- Agente em grande e o separador do terminal.
- Ferramenta (ex: Bash), **comando completo**, "Porquê:" (motivo dado pelo agente).
- **Um botão por cada opção que o Claude Code oferece nesse pedido**, numerados como no terminal. Ex:
  1. Sim
  2. Sim e não voltar a perguntar para `npm install` neste projeto
  3. Não
- Por baixo, sempre: caixa "Ou diz-lhe outra coisa" + Enviar, que **recusa o pedido e envia a mensagem ao agente**.

### Ecrã 4: Comando destrutivo

Igual ao ecrã 3, mais:

- faixa laranja-vermelha "Calma aí: isto apaga ficheiros";
- o padrão perigoso realçado dentro do comando;
- caixa de confirmação "Li o comando e quero mesmo apagar estes ficheiros";
- "Sim" desativado até confirmar; "Não" é a opção em destaque;
- **nunca há opção "não voltar a perguntar"** para comandos marcados.

### Ecrã 5: Detalhe de pergunta

- Agente e a pergunta num balão.
- **Um botão por opção** (A, B…).
- Caixa "Ou responde à tua maneira" + Enviar (a resposta é escrita na sessão do agente no terminal).
- "Ir para o terminal".

### Ecrã 6: No ecrã

- O PiP fica no canto superior direito.
- Ao ir para o terminal: a janela do terminal vem para a frente com moldura amarela, e o separador do agente fica amarelo com um "aqui!".
- O cartão no PiP mostra "A mostrar no terminal…".

## 3. Regras de comportamento

- **Opções dinâmicas:** os botões dos ecrãs 3–5 são gerados a partir de cada pedido, nunca fixos na app. Nas permissões, o hook não recebe a lista exata do terminal; decidido (2026-10-07): **Sim / Sim, e não voltar a perguntar para «comando exato» (uma por sugestão recebida) / Não**.
- **Perguntas:** só há botões de opção quando a pergunta chega com opções estruturadas (ex: a ferramenta de perguntas com escolhas do Claude Code). Quando o agente pergunta em texto livre, mostra-se a pergunta e só a caixa de resposta. Decidido (2026-10-07): um `Stop` cuja última mensagem acaba em "?" gera um cartão de **pergunta** (texto livre) em vez de "terminou"; a resposta é escrita na sessão pelo WezTerm. **Não** extrair opções de texto livre na v1.
- **Sincronização:** se eu responder no terminal, o cartão desaparece sozinho. Nunca há cartões duplicados para o mesmo pedido. Quando a sessão termina, os cartões dela desaparecem.
- **Fallback:** com a app fechada, ou sem resposta dentro de um tempo configurável, o hook sai e aparece o diálogo normal no terminal.
- **Comandos destrutivos:** lista de padrões configurável. Por omissão, algo como `rm -rf`, `git push --force`, `git reset --hard`, `DROP`, `TRUNCATE`…
- **Identidade do agente:** nome da pasta do projeto + branch git; possibilidade de definir um nome próprio (ex: variável de ambiente na sessão). Cada agente tem uma cor fixa.
- **Foco:** um cartão novo chama a atenção mas **nunca rouba o foco do teclado**.
- **Privacidade:** comunicação hooks ↔ app apenas local (HTTP em localhost). Nada sai da máquina.
- **Instalação:** um passo instala a app e regista os hooks em `~/.claude/settings.json`, fazendo merge com hooks existentes e backup antes de alterar.

## 4. Critérios de aceitação (v1)

1. Com 3 sessões em separadores diferentes do WezTerm, um pedido aparece no PiP em menos de 1 s, com o agente correto.
2. Os botões de opção correspondem às opções disponíveis no pedido (ver regra "Opções dinâmicas") e têm o mesmo efeito que responder no terminal.
3. "Ou diz-lhe outra coisa" recusa o pedido e o Claude recebe a mensagem.
4. Comandos destrutivos exigem confirmação e não oferecem "não voltar a perguntar".
5. "Ir para o terminal" foca a janela e o separador certos (mesmo minimizada ou noutro ambiente de trabalho virtual do Windows) e destaca-os.
6. "Enviar" numa pergunta escreve a resposta na sessão certa.
7. Responder no terminal remove o cartão. Não há duplicados.
8. Com a app fechada, o Claude Code funciona exatamente como hoje.

## Terminais

A app tem duas camadas:

- **Núcleo**, que funciona em qualquer terminal: hooks, cartões, respostas a permissões (opções dinâmicas, "Ou diz-lhe outra coisa", destrutivos), concluídos.
- **Adaptador de terminal**, um por terminal: "Ir para o terminal" (janela + separador certos), destaque do separador, escrever a resposta a perguntas na sessão.

| Terminal | Estado |
|---|---|
| WezTerm | v1, suporte completo |
| iTerm2 | depois da v1 (adaptador AppleScript) |
| tmux, Windows Terminal, outros | mais tarde, se fizer falta |

**Modo reduzido** (terminal sem adaptador):

- cartões e permissões funcionam normalmente;
- "Ir para o terminal" só traz a app do terminal para a frente, sem escolher o separador;
- sem destaque do separador;
- responder a perguntas por texto pode não estar disponível; fica "Ir para o terminal".

## Fora do âmbito da v1

macOS e Linux (a app e o núcleo devem continuar portáveis). Adaptadores para iTerm2, Terminal.app, VS Code, tmux e Windows Terminal. A arquitetura não os deve impedir.
