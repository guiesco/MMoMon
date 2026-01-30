## Prompts para Agentes em Paralelo – Fase de Evolução e Polimento

Este arquivo assume que o MVP single-player já está funcional (fluxo Auth → Base → Expedição → Extração → Retorno à Base) e que há um plano de multiplayer em andamento.  
Cada seção abaixo é um prompt pronto para ser colado em um agente do Cursor, focando em **evolução de gameplay**, **novos conteúdos** (mapas, inimigos, recursos), **balanceamento de HP/dano** e **polimento/finalização**.

Todos os agentes devem sempre:
- Ler os arquivos em `memory-bank/` antes de começar.
- Respeitar o estilo e padrões descritos em `systemPatterns.md` e `techContext.md`.
- Rodar linter/TypeScript nos arquivos que modificarem.

---

## 1. Expansão de Mapas e Biomas (mais mapas e gameplay emergente)

**Prompt para um agente focado em novos mapas, layouts e biomas:**

> Você é responsável por expandir o conteúdo de mapas e biomas deste jogo, mantendo a fantasia e o core loop de extração.  
> 1. Leia `memory-bank/projectbrief.md`, `productContext.md` e `systemPatterns.md` para entender os mapas citados (Floresta Celestial, Cavernas Cristalinas, Ruínas Antigas, Pântano Sombrio) e o papel de risco x recompensa.  
> 2. Analise `src/scenes/ExpeditionScene.ts` e `src/game/constants.ts` (se existir) para entender como o mapa atual é configurado (tamanho, spawns, zonas de extração).  
> 3. Proponha pelo menos **2 novos mapas/biomas** com identidade própria, detalhando para cada um:  
>    - Tamanho e formato geral (mais aberto/fechado, corredores, áreas amplas).  
>    - Densidade de criaturas e recursos.  
>    - Posições/quantidade de pontos de extração.  
> 4. Implemente um sistema simples de seleção de mapa para expedição (ex: constante/enum `MapId`, configuração de mapas em um módulo de dados).  
> 5. Adapte a `ExpeditionScene` para carregar configuração de mapa a partir desses dados (sem duplicar lógica), permitindo:  
>    - Escolher o mapa via constante, query param ou botão na base (sem quebrar o fluxo atual).  
> 6. Ajuste visualmente o mapa (cores de fundo, elementos simples) para que cada bioma seja distinguível mesmo com arte minimalista.  
> 7. Documente no `README.md` uma nova seção “Mapas & Biomas” listando os mapas disponíveis, com foco em: risco, recompensas e estilo de gameplay de cada um.

---

## 2. Inimigos Mais Perigosos, HP e Dano (escala de dificuldade)

**Prompt para um agente focado em inimigos, HP, dano e sensação de perigo:**

> Você é responsável por tornar os inimigos mais interessantes e perigosos, ajustando HP/dano e padrões de ataque.  
> 1. Leia `memory-bank/projectbrief.md` e `productContext.md` com foco na fantasia de “expedição de alto risco”.  
> 2. Analise `src/game/creatures.ts`, `src/game/constants.ts` (se existir) e a lógica de combate em `src/scenes/ExpeditionScene.ts`.  
> 3. Crie uma **escala clara de ameaça** para criaturas (ex: comum, perigosa, elite), definindo para cada tier:  
>    - Faixa de HP.  
>    - Dano base.  
>    - Comportamento (ex: aproxima, kite, dispara projéteis mais rápidos).  
> 4. Ajuste os dados de criaturas e a lógica de combate para refletir essa escala, de forma que:  
>    - O jogador sinta aumento de perigo à medida que avança no mapa ou encontra biomas mais difíceis.  
>    - Inimigos perigosos possam matar o jogador se ele for descuidado, mas ainda sejam evitáveis/jogáveis.  
> 5. Adicione feedbacks claros de perigo na HUD/visual (cor de barra de HP, efeitos quando o jogador toma muito dano rapidamente, aviso quando HP está crítico).  
> 6. Centralize os principais números de balanceamento (HP base, dano, multiplicadores por tier/mapa) em `game/constants.ts` ou módulo similar para facilitar futuros ajustes.  
> 7. No final, escreva uma pequena tabela no `README.md` com os tiers de inimigos, HP/dano aproximados e onde/como eles aparecem.

---

## 3. Recursos Diferentes, Economia e Crafting Interessante

**Prompt para um agente focado em recursos, economia e crafting:**

> Você é responsável por deixar o sistema de recursos e crafting mais profundo e interessante.  
> 1. Leia `memory-bank/productContext.md` com atenção à progressão persistente (base, crafting, upgrades).  
> 2. Analise `src/game/items.ts`, `src/game/creatures.ts`, `src/game/playerState.ts` e qualquer cena ligada a crafting (`CraftingScene.ts`, `BaseHubScene.ts`).  
> 3. Defina um pequeno sistema de **recursos diferenciados por mapa/bioma**, por exemplo:  
>    - Recursos comuns presentes em todos os mapas.  
>    - Recursos raros específicos de certos biomas (ex: cristal de caverna, essência sombria do pântano).  
> 4. Expanda o crafting para usar esses recursos em **3–5 receitas significativas**, como:  
>    - Pokébolas mais fortes/raras.  
>    - Itens de cura ou escudo para expedições mais longas.  
>    - Melhorias de qualidade de vida (ex: aumento leve de slots de criatura na expedição).  
> 5. Implemente o novo modelo de recursos/receitas nos módulos de dados, garantindo que:  
>    - O loot da expedição reflita os novos recursos por bioma.  
>    - O crafting na base valide corretamente custos e mostre feedback textual claro de sucesso/erro.  
> 6. Ajuste a HUD da `ExpeditionScene` e da base para exibir esses novos recursos de forma organizada (sem poluir a tela).  
> 7. Atualize o `README.md` com uma seção “Economia & Crafting Inicial” contendo:  
>    - Lista de recursos e onde são encontrados.  
>    - Receitas disponíveis e seus efeitos.

---

## 4. Mecânicas Avançadas de Combate e Habilidades

**Prompt para um agente focado em mecânicas de combate e habilidades especiais:**

> Você é responsável por tornar o combate mais profundo e interessante, introduzindo habilidades e decisões táticas.  
> 1. Leia `memory-bank/projectbrief.md` e `systemPatterns.md` para entender o papel de combate PvE/PvP no core loop.  
> 2. Analise o combate atual em `ExpeditionScene.ts` e os dados de criaturas em `creatures.ts`.  
> 3. Proponha um sistema leve de **habilidades ativas** para criaturas, por exemplo:  
>    - Um ataque especial com cooldown.  
>    - Uma habilidade defensiva ou de mobilidade (dash, escudo curto, slow no inimigo).  
> 4. Estenda o modelo de criatura para suportar habilidades (dados + comportamento) sem quebrar o que já existe.  
> 5. Implemente pelo menos **2–3 habilidades distintas** em criaturas diferentes, garantindo que:  
>    - O input do jogador para ativar habilidades seja claro (tecla/mapeamento).  
>    - A HUD mostre cooldown/estado da habilidade.  
> 6. Ajuste o balanceamento de HP/dano/cooldown para que as habilidades sejam impactantes, mas não triviais (não “explodir” tudo sem risco).  
> 7. Documente as habilidades existentes no `README.md` em uma tabela simples (criatura, habilidade, efeito, cooldown).

---

## 5. Eventos Dinâmicos de Mapa e Tensão (gameplay mais interessante)

**Prompt para um agente focado em eventos dinâmicos e sensação de expedição viva:**

> Você é responsável por adicionar eventos dinâmicos no mapa que aumentem a tensão e variabilidade de cada expedição.  
> 1. Leia `memory-bank/productContext.md` com foco em “partidas tensas” e “risco x recompensa crescente”.  
> 2. Analise como o timer e o loop de expedição funcionam hoje em `ExpeditionScene.ts`.  
> 3. Proponha pelo menos **3 tipos de eventos dinâmicos** simples, como:  
>    - Aumento temporário de spawn de criaturas perigosas em uma área.  
>    - Janela curta com maior chance de recursos raros.  
>    - Avisos de que a região está “colapsando” e forçando o jogador a se mover.  
> 4. Implemente um sistema leve de agendamento de eventos ao longo da expedição (por tempo ou condições) que:  
>    - Use constantes configuráveis.  
>    - Mostre feedback claro quando um evento começa/termina (texto, cor de fundo, efeitos simples).  
> 5. Garanta que os eventos respeitem a performance e não sobrecarreguem o mapa com entidades.  
> 6. Atualize ou crie uma seção em `README.md` chamada “Eventos Dinâmicos de Expedição”, explicando rapidamente cada evento e seu impacto.

---

## 6. Polimento de UX/UI, Feedback Visual e Sonoro

**Prompt para um agente focado em polimento visual/sonoro e UX:**

> Você é responsável por elevar o nível de polimento visual e UX do jogo, sem alterar as regras centrais.  
> 1. Leia `memory-bank/productContext.md` para absorver a fantasia e a emoção que o jogo deve transmitir.  
> 2. Analise `ExpeditionScene.ts`, `BaseHubScene.ts` e `CraftingScene.ts` com foco em HUD, feedback visual e qualquer áudio já existente.  
> 3. Faça um “pass” de UX/UI para:  
>    - Organizar melhor HUD de HP, recursos, criaturas ativas e tempo restante.  
>    - Destacar claramente estados críticos (HP baixo, quase acabando o tempo, extração em andamento).  
>    - Melhorar textos e mensagens para remover ambiguidades.  
> 4. Adicione efeitos visuais simples (cores, piscadas, escala) para eventos importantes:  
>    - Dano recebido/dado.  
>    - Captura bem-sucedida ou falha.  
>    - Início/conclusão de extração.  
> 5. Se o projeto já tiver suporte a áudio, adicione sons leves para ações chave (ataque, coleta, captura, extração) com controle de volume centralizado.  
> 6. Garanta que tudo continue legível em diferentes tamanhos de janela.  
> 7. Atualize o `README.md` com uma descrição rápida da HUD e, se possível, instruções de controle/teclas atualizadas.

---

## 7. Balanceamento Global, Telemetria e Curva de Dificuldade

**Prompt para um agente focado em balanceamento global e telemetria de gameplay:**

> Você é responsável por garantir que a experiência de jogo tenha uma curva de dificuldade e recompensa coerente e mensurável.  
> 1. Leia `memory-bank/projectbrief.md`, `productContext.md` e `multiplayer-plan.md` (apenas para entender o futuro, mas foque no single-player atual).  
> 2. Analise os sistemas de combate, captura, recursos e tempo de expedição em `ExpeditionScene.ts`, `creatures.ts`, `items.ts` e `game/constants.ts`.  
> 3. Implemente um sistema simples de **telemetria local** (em memória + logs estruturados) que registre por expedição:  
>    - Duração da expedição.  
>    - Danos causados/recebidos.  
>    - Criaturas encontradas vs capturadas.  
>    - Recursos coletados e extraídos com sucesso.  
>    - Mortes do jogador e motivo principal (tempo, dano, etc.).  
> 4. (Opcional) Exponha um painel de debug (tecla ou query param) que mostre um resumo desses dados ao final da expedição.  
> 5. Use esses dados para propor e aplicar ajustes de balanceamento:  
>    - Tempo padrão de expedição.  
>    - HP/dano de criaturas por tier/bioma.  
>    - Chances base de captura e recompensas de recursos.  
> 6. Documente os parâmetros atuais de balanceamento e o racional em uma seção “Balanceamento Atual (Fase de Evolução)” no `README.md`.

---

## 8. Finalização, Estabilização e Polimento Geral

**Prompt para um agente focado em fechar a fase de evolução e deixar o jogo pronto para próxima etapa:**

> Você é responsável por integrar e estabilizar todas as melhorias feitas pelos outros agentes nesta fase de evolução.  
> 1. Considere que as mudanças de mapas, inimigos, recursos, habilidades, eventos e UX já foram integradas neste branch.  
> 2. Rode o jogo (frontend e, se necessário, backend) e faça um **smoke test completo** em:  
>    - Mapa/bioma básico.  
>    - Pelo menos 1 novo mapa mais perigoso.  
>    - Diferentes combinações de criaturas e pokébolas.  
> 3. Liste e corrija bugs de integração:  
>    - Inconsistências de HUD.  
>    - Recursos ou itens que não aparecem ou não são consumidos corretamente.  
>    - Habilidades que quebram o fluxo ou não respeitam cooldown.  
>    - Eventos de mapa que não disparam ou não terminam.  
> 4. Rode linter/TypeScript e corrija todos os erros/avisos nos arquivos modificados.  
> 5. Atualize `memory-bank/activeContext.md` e `memory-bank/progress.md` resumindo:  
>    - Quais evoluções principais foram concluídas (mapas, inimigos, recursos, habilidades, eventos, UX).  
>    - O estado atual do jogo (jogável? estável?).  
>    - Próximos passos sugeridos (ex: foco total em multiplayer, conteúdo endgame, etc.).  
> 6. Escreva no `progress.md` um resumo final em 5–7 bullets do estado do jogo após esta fase de evolução.

---

## Como Utilizar Estes Prompts em Paralelo

- **Sugestão de paralelismo**:  
  - Agente 1: Seção 1 (Mapas/biomas).  
  - Agente 2: Seção 2 (Inimigos/HP/dano).  
  - Agente 3: Seção 3 (Recursos/economia).  
  - Agente 4: Seção 4 (Combate/habilidades).  
  - Agente 5: Seção 5 (Eventos dinâmicos).  
  - Agente 6: Seção 6 (UX/UI/polimento visual/sonoro).  
  - Agente 7: Seção 7 (Balanceamento/telemetria).  
  - Agente 8: Seção 8 (Integração/finalização da fase).

Use estes prompts como base e adapte detalhes (como nomes de arquivos ou decisões de design) conforme o código evoluir.

