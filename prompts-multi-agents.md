## Prompts para Agentes em Paralelo – PokéExtract: Wild Expedition

Cada seção abaixo é um prompt que pode ser rodado em um agente do Cursor em paralelo.  
Use sempre o contexto do repositório atual e da `memory-bank/`.

---

## 1. Polimento de Gameplay da `ExpeditionScene`

**Prompt para um agente focado em gameplay moment‑to‑moment:**

> Você é um engenheiro de gameplay trabalhando neste repositório.  
> 1. Leia `memory-bank/projectbrief.md`, `productContext.md` e `systemPatterns.md` para entender o core loop de expedição.  
> 2. Estude `src/scenes/ExpeditionScene.ts` e identifique melhorias de jogabilidade para o protótipo single‑player (feedback visual, clareza de estado, dificuldade, ritmo de combate, UX da extração, balanceamento de HP/dano/tempo).  
> 3. Proponha uma lista de ajustes de polimento (no máximo 10 itens), priorizando:  
>    - Melhor sensação de coleta e captura (efeitos visuais/sonoros, texto de feedback).  
>    - Telemetria mínima (logs ou contadores) para entender se a expedição está fácil/difícil demais.  
>    - Clareza do estado da expedição (explorando/combatendo/extraindo/falha/sucesso) via HUD e elementos visuais.  
> 4. Implemente esses ajustes diretamente no código (principalmente em `ExpeditionScene.ts`) mantendo o código limpo e tipado.  
> 5. Garanta que os controles descritos em `memory-bank/techContext.md` e `README.md` continuem funcionando; atualize a HUD se necessário.  
> 6. Rode o linter e corrija eventuais avisos/erros introduzidos.  
> 7. No final, faça um resumo curto (3–5 bullets) das melhorias de gameplay aplicadas.

---

## 2. Refinar Criaturas, Itens e Progressão Inicial

**Prompt para um agente focado em sistemas de criaturas/itens:**

> Você é responsável por refinar o sistema inicial de criaturas, itens e progressão deste jogo.  
> 1. Leia `memory-bank/projectbrief.md` e `productContext.md` para entender o papel de criaturas, pokébolas e recursos no core loop de extração.  
> 2. Analise `src/game/creatures.ts`, `src/game/items.ts` e `src/game/playerState.ts` para entender como criaturas, itens e inventário estão modelados hoje.  
> 3. Com base nas mecânicas desejadas (captura com chance baseada em HP + tipo de bola, recursos usados para craft de pokébolas), proponha:  
>    - Um pequeno conjunto de criaturas iniciais (3–5) com stats e ataques diferenciados.  
>    - 2–3 tipos de pokébolas com efeitos e chances diferentes.  
>    - 2–3 tipos de recursos e usos básicos no crafting.  
> 4. Aplique essas mudanças nos arquivos de dados (`creatures.ts`, `items.ts`, `playerState.ts`) garantindo que:  
>    - A lógica de captura em `ExpeditionScene.ts` funcione com os novos tipos de bola.  
>    - O progresso do jogador (inventário/equipe ativa) seja salvo e carregado corretamente.  
> 5. Adapte e/ou crie helpers para facilitar consulta de stats e consumo de itens (sem duplicar lógica).  
> 6. Atualize qualquer HUD ou texto na `ExpeditionScene` necessário para refletir os novos itens/criaturas.  
> 7. Documente as novas criaturas/itens em uma nova seção no `README.md` (“Conteúdo Inicial de Criaturas e Itens”) com uma tabela simples.

---

## 3. Cena de Hub/Base e Fluxo de Core Loop (Auth → Base → Expedição)

**Prompt para um agente focado em UX de fluxo de telas:**

> Você é responsável por amarrar o core loop de fluxo de telas (login/base/expedição).  
> 1. Leia `memory-bank/projectbrief.md`, `productContext.md` e `activeContext.md` para entender o fluxo desejado (entrar → expedição → extrair → base).  
> 2. Estude `src/scenes/BootScene.ts`, `AuthScene.ts`, `BaseHubScene.ts`, `CraftingScene.ts` e `ExpeditionScene.ts` para entender como as cenas se conectam hoje.  
> 3. Defina e implemente um fluxo claro:  
>    - Tela de Auth simples (nome de jogador + botão “Entrar”).  
>    - Base/Hub mostrando: criaturas possuídas, recursos, pokébolas, botão “Iniciar Expedição”.  
>    - Retorno da `ExpeditionScene` para a Base após extração (sucesso ou falha) com um pequeno resumo dos resultados.  
> 4. Ajuste as transições de cenas no `main.ts` e nas cenas existentes para seguir esse fluxo sem dead‑ends.  
> 5. Garanta que o `PlayerState` seja atualizado corretamente entre as cenas e que o progresso persista (pelo menos em `localStorage` ou equivalente).  
> 6. Melhore os textos/UI para guiar o jogador (instruções claras na base e na expedição).  
> 7. Atualize o `README.md` com uma subseção “Fluxo Atual de Telas (MVP Single Player)” explicando o passo a passo.

---

## 4. Preparar o Protótipo para Evolução Multiplayer

**Prompt para um agente focado em arquitetura multiplayer:**

> Você é responsável por deixar este protótipo single‑player pronto para escalar para multiplayer, usando o que já existe.  
> 1. Leia `memory-bank/systemPatterns.md` e `techContext.md` para entender a visão de arquitetura server‑authoritative e uso de WebSockets.  
> 2. Analise `server/src/index.ts` e `src/services/multiplayerClient.ts` para entender o estado atual de networking.  
> 3. Mapeie tudo que a `ExpeditionScene` hoje faz apenas no cliente e que, no futuro, deveria ser responsabilidade do servidor (spawns, dano, captura, recursos, extração, morte, etc.).  
> 4. Refatore o código de cliente para:  
>    - Isolar melhor a lógica de “estado de mundo” em estruturas que possam ser sincronizadas com o servidor.  
>    - Centralizar pontos de envio/recebimento de mensagens WebSocket (sem espalhar chamadas ao `MultiplayerClient`).  
> 5. No servidor, implemente ou refine um modelo simples de “sala” que suporte pelo menos:  
>    - Presença e posição dos jogadores (já existe algo parcial).  
>    - Timer de partida básico.  
> 6. Sem ainda implementar todas as regras de jogo no servidor, deixe o código pronto para mover essas regras depois (com comentários claros e TODOs bem descritos).  
> 7. Documente em um novo arquivo `multiplayer-plan.md` na raiz do projeto:  
>    - Que parte da lógica ficará no servidor, que parte no cliente.  
>    - Formato básico das mensagens WebSocket (JSON) planejadas para: posição, ataque, captura, extração, eventos de partida.

---

## 5. Polimento de Código, Organização e Documentação Técnica

**Prompt para um agente focado em qualidade de código:**

> Você é o guardião de qualidade e organização deste repositório.  
> 1. Leia todos os arquivos em `memory-bank/` para entender o objetivo macro do projeto.  
> 2. Passe pelos diretórios `src/` e `server/src/` identificando:  
>    - Código duplicado ou funções muito grandes.  
>    - Falta de tipagem explícita em TypeScript onde ajudaria na manutenção.  
>    - Estrutura de pastas que possa ser melhor organizada (por domínio: `game/`, `scenes/`, `services/`, etc.).  
> 3. Proponha um pequeno refactor incremental (sem quebrar o jogo) que:  
>    - Quebre funções muito grandes em helpers menores.  
>    - Padronize nomes de tipos e interfaces (`PascalCase`, `camelCase`, etc.).  
>    - Centralize constantes de jogo (ex: duração da expedição, valores de dano base, etc.) em um módulo dedicado (`game/constants.ts`).  
> 4. Implemente esse refactor passo a passo, rodando o linter após as mudanças em cada arquivo principal modificado.  
> 5. Atualize ou crie comentários apenas onde eles ajudam a explicar decisões de design ou regras de jogo (evite comentários redundantes).  
> 6. No final, crie ou atualize uma seção “Arquitetura de Código (MVP)” em `README.md` descrevendo brevemente os principais diretórios e responsabilidades.

---

## 6. UX/UI e Feedback Visual

**Prompt para um agente focado em UX/UI e feedback:**

> Você é responsável por melhorar a apresentação visual e UX do protótipo, sem mudar o core das mecânicas.  
> 1. Leia `memory-bank/productContext.md` para entender a fantasia e a experiência desejada (tensão, risco x recompensa).  
> 2. Analise `src/scenes/ExpeditionScene.ts`, `BaseHubScene.ts` e `CraftingScene.ts` focando em:  
>    - Cores, contraste e leitura de elementos importantes (zona de extração, criaturas, recursos, player).  
>    - Textos e instruções na tela (HUD).  
> 3. Proponha um pequeno “visual pass” para:  
>    - Destacar melhor criaturas vs recursos com cores/formas/tamanhos.  
>    - Melhorar a legibilidade da HUD (hierarquia de informação, fontes, alinhamento).  
>    - Indicar visualmente quando o jogador está em perigo, extraindo, ou perto de acabar o tempo.  
> 4. Implemente essas melhorias usando as APIs de desenho do Phaser (shapes, textos, efeitos simples), sem depender de assets complexos.  
> 5. Garanta que o jogo continue performando bem (sem excesso de draw calls desnecessárias).  
> 6. Atualize `README.md` com 2–3 screenshots ou descrições que ajudem alguém novo a entender como é a tela da expedição e da base.

---

## 7. Telemetria e Balanceamento Básico

**Prompt para um agente focado em análise e balanceamento:**

> Você é responsável por adicionar instrumentos básicos de telemetria/balanceamento no protótipo.  
> 1. Leia `memory-bank/projectbrief.md` e `productContext.md` para entender as metas de tensão e risco x recompensa.  
> 2. Analise `ExpeditionScene.ts` e identifique pontos críticos de balanceamento: tempo de expedição, HP/dano de criaturas, chance de captura, quantidade de recursos e pokébolas obtidas na extração.  
> 3. Adicione um sistema simples de logging/local‑analytics (ex: objeto em memória + `console.table`) para registrar por sessão:  
>    - Tempo total de expedição.  
>    - Número de recursos coletados.  
>    - Número de criaturas encontradas vs capturadas.  
>    - Quantas vezes o jogador falhou vs extraiu com sucesso.  
> 4. Exponha, opcionalmente, um painel simples de debug (tecla oculta ou query param) que mostre esses dados na tela.  
> 5. Ajuste parâmetros básicos (ex: `expeditionDuration`, `damage`, `baseChance` de captura) para alcançar uma experiência de 3–5 minutos com tensão crescente.  
> 6. Documente, em um pequeno bloco no `README.md`, os valores atuais de balanceamento e o racional por trás deles.

---

## 8. Integração e Estabilização Final do MVP Single Player

**Prompt para um agente focado em integração final:**

> Você é responsável por integrar o trabalho dos outros agentes e deixar o MVP single‑player estável e coeso.  
> 1. Consuma as alterações feitas nos outros branches/agentes (assuma que o código já foi mergeado nesta base).  
> 2. Rode o projeto (frontend e, se necessário, backend) e faça um smoke test completo do fluxo: Auth → Base → Expedição → Extração → Retorno à Base.  
> 3. Liste e corrija bugs de integração (cenas quebradas, estados de jogador inconsistentes, textos desatualizados, HUD desalinhada, etc.).  
> 4. Garanta que não haja erros de TypeScript ou linter nos arquivos modificados.  
> 5. Atualize `memory-bank/progress.md` e `memory-bank/activeContext.md` para refletir o novo estado do MVP (o que funciona, o que falta, próximos passos em direção ao multiplayer).  
> 6. Produza um resumo final de 5–7 bullets em `progress.md` descrevendo o estado atual do MVP single‑player.

