## Prompts para Agentes em Paralelo – Profundidade de Gameplay e Identidade das Criaturas

Este arquivo assume que o MVP single-player já está funcional (fluxo Auth → Base → Expedição → Extração → Retorno à Base) e que já existem sistemas básicos de criaturas, combate, captura e crafting.  
Cada seção abaixo é um prompt pronto para ser colado em um agente do Cursor, focando especificamente em **profundidade de gameplay**, **identidade das criaturas**, **leitura de combate** e **variedade visual**.

Todos os agentes devem sempre:
- Ler os arquivos em `memory-bank/` antes de começar.
- Respeitar o estilo e padrões descritos em `systemPatterns.md` e `techContext.md`.
- Rodar linter/TypeScript nos arquivos que modificarem.
- Evitar quebrar o fluxo principal de jogo já estável.

---

## 1. IA de Inimigos: Movimento e Ataque

**Prompt para um agente focado em comportamento de inimigos (se mover e atacar de forma interessante):**

> Você é responsável por fazer com que os inimigos sejam ameaças ativas, que **se movimentam e atacam o jogador** de forma legível e divertida.  
> 1. Leia `memory-bank/projectbrief.md`, `productContext.md` e `activeContext.md` para entender o papel de criaturas selvagens como fonte de risco e recompensa.  
> 2. Analise `src/scenes/ExpeditionScene.ts`, `src/game/creatures.ts` e `src/game/constants.ts` (ou arquivos equivalentes) para entender como as criaturas inimigas são instanciadas hoje e como o combate funciona.  
> 3. Projete um sistema simples de **IA de inimigos**, priorizando:  
>    - Movimento básico: perseguir o jogador quando em alcance, recuar em certas condições, ou patrulhar uma área.  
>    - Ataque: ataques corpo a corpo (hitbox clara) e, quando fizer sentido, projéteis simples com cooldown.  
>    - Variedade mínima: pelo menos 2 perfis distintos (ex: melee agressivo, ranged que kiteia).  
> 4. Implemente essa IA dentro de `ExpeditionScene.ts` (ou módulos auxiliares) de forma bem organizada, evitando lógica espaguete:  
>    - Centralize parâmetros (velocidade, alcance de visão, alcance de ataque, cooldown) em `constants.ts` ou similar.  
>    - Garanta que cada inimigo mantenha estado suficiente para tomar decisões (ex: perseguindo, atacando, recuando).  
> 5. Adicione feedbacks mínimos para o jogador entender o comportamento do inimigo (ex: pequena antecipação visual/“tell” antes do ataque, mudança de cor/efeito quando o inimigo entra em estado agressivo).  
> 6. Teste diferentes situações (poucos inimigos, muitos inimigos) e ajuste números para que o combate seja tenso, mas não injusto.  
> 7. Documente rapidamente em uma seção de `README.md` (“Comportamento Básico de Inimigos”) os tipos de inimigo que existem e como se comportam.

---

## 2. Gameplay de Expedição: Câmera, Tamanho de Mapa e Minimap

**Prompt para um agente focado em sensação de exploração (câmera, mapa grande e minimap):**

> Você é responsável por **aprofundar a sensação de expedição** tornando o mapa maior, a câmera mais fechada e dando ferramentas de navegação (minimapa).  
> 1. Leia `memory-bank/productContext.md` e `projectbrief.md` com foco em “explorar o mapa”, “achar extração” e risco x recompensa.  
> 2. Analise `src/scenes/ExpeditionScene.ts` e `src/game/maps.ts` (ou arquivos equivalentes) para entender:  
>    - Como o mapa atual é definido (dimensões, tiles, zonas especiais).  
>    - Como a câmera está configurada hoje (zoom/seguimento do player).  
> 3. Aumente significativamente o **tamanho do mapa** da expedição, mantendo a performance, de forma que:  
>    - O jogador precise de tempo real para explorar.  
>    - Os pontos de extração não sejam triviais de encontrar.  
> 4. Ajuste a **câmera** para ser mais aproximada do jogador (maior zoom):  
>    - Garanta que o campo de visão reduza a “onisciência” do player, aumentando tensão.  
>    - Evite motion sickness e travamentos; use suavização se fizer sentido.  
> 5. Implemente um **minimapa simples** que:  
>    - Mostre a posição aproximada do jogador.  
>    - Mostre, de forma estilizada, a área geral das extrações (por exemplo, ícone ou área marcada, sem revelar tudo detalhes).  
>    - Use renderização leve (ex: desenhar um retângulo/shape, não precisa ser tile-precise).  
> 6. Garanta que o HUD continue legível mesmo com o novo minimapa (reposicionar elementos se necessário).  
> 7. Atualize o `README.md` com uma subseção “Exploração e Navegação” explicando:  
>    - Tamanho do mapa.  
>    - Como funciona a câmera.  
>    - Como ler o minimapa para encontrar extração.

---

## 3. Progressão das Criaturas: XP, Evolução e Uso de Cópias

**Prompt para um agente focado em sistema de progressão/motivação para capturar e fazer expedições:**

> Você é responsável por criar **mecânicas de evolução e desenvolvimento de criaturas** que tornem capturas e expedições mais motivadoras.  
> 1. Leia `memory-bank/projectbrief.md`, `productContext.md` e `progress.md` para entender o papel de progressão persistente e de “voltar para expedições melhores”.  
> 2. Analise `src/game/creatures.ts`, `src/game/playerState.ts`, `src/game/items.ts` e `BaseHubScene.ts` para ver como criaturas são armazenadas, usadas e mostradas hoje.  
> 3. Proponha um sistema de **progressão de criaturas** que combine pelo menos duas ideias:  
>    - Ganho de XP por expedição (por criatura usada) com níveis que melhoram stats leves (HP, dano, talvez velocidade).  
>    - Uso de **cópias da mesma criatura** para promover fusão/upgrade (ex: “sacrificar” cópias para aumentar raridade ou liberar perks).  
> 4. Modele os dados de criatura para suportar:  
>    - Nível e XP atual.  
>    - Potenciais incrementos nos stats por nível.  
>    - Um contador ou flag de “rank/estrela” caso use a mecânica de fusão de cópias.  
> 5. Implemente a lógica de:  
>    - Ganhar XP ao final da expedição, baseado em participação/tempo em campo.  
>    - Evoluir de nível automaticamente ao atingir thresholds.  
>    - Uma ação na base (ex: menu em `BaseHubScene`) para consumir cópias da mesma criatura e melhorá-la.  
> 6. Garanta que o progresso de criaturas (XP, nível, upgrades) seja **persistido** entre sessões.  
> 7. Ajuste o HUD ou telas da base para mostrar claramente:  
>    - Nível/XP da criatura.  
>    - Benefícios ganhos (ex: +HP, +dano).  
> 8. Documente em uma seção “Progressão de Criaturas” no `README.md` explicando:  
>    - Como funciona o ganho de XP.  
>    - Como funciona o uso de cópias para upgrades.  
>    - Qual o impacto prático dessa progressão na gameplay.

---

## 4. Identidade de Cada Criatura: Cores, Ataques e Feedback de Hit

**Prompt para um agente focado em dar identidade visual e de gameplay a cada criatura:**

> Você é responsável por reforçar a **identidade individual de cada criatura**, com cores, ataques distintos e feedbacks claros de acerto.  
> 1. Leia `memory-bank/productContext.md` para entender a fantasia de “treinador de criaturas em expedições de alto risco”.  
> 2. Analise `src/game/creatures.ts`, `ExpeditionScene.ts` e qualquer código de render/FX para ver como as criaturas e seus ataques são representados hoje.  
> 3. Para cada criatura jogável (e, se fizer sentido, para grandes arquétipos de inimigos), defina:  
>    - **Uma cor principal** que represente seu tipo/identidade (ex: fogo, água, planta, elétrico).  
>    - **Tamanho/Formato de ataque** (projétil ou melee) que reforce essa identidade (largura, comprimento, duração).  
> 4. Implemente essas identidades no código de renderização:  
>    - Usando cores distintas em sprites/placeholders, projéteis e efeitos de ataque.  
>    - Mantendo um sistema de configuração de “tema” por criatura (ex: tabela de cores/tamanhos em um módulo).  
> 5. Adicione **feedback claro de hit** especialmente para ataques corpo a corpo:  
>    - Delimitação de hitbox visível no momento do ataque (flash, outline ou shape).  
>    - Pequeno efeito de impacto quando um ataque acerta (cor do inimigo, pequeno knockback, ou flash).  
> 6. Garanta que, mesmo com identidades diferentes, os ataques continuem legíveis e não poluam demais a tela.  
> 7. Atualize o `README.md` com uma pequena tabela “Identidade de Criaturas” listando: nome, tipo, cor principal, tipo de ataque e qualquer particularidade visual.

---

## 5. Barras de HP por Criatura e Legibilidade de Combate

**Prompt para um agente focado em barras de HP e leitura de vida/dano:**

> Você é responsável por melhorar a **leitura de HP** durante o combate, com barras de vida claras e integradas à identidade de cada criatura.  
> 1. Leia `memory-bank/productContext.md` e `techContext.md` com foco em UX/HUD e performance.  
> 2. Analise `ExpeditionScene.ts` (e quaisquer helpers de HUD) para ver como o HP é mostrado hoje (player, criaturas aliadas, inimigos).  
> 3. Projete um sistema de **barras de HP** que:  
>    - Mostre HP do jogador e das criaturas aliadas de forma proeminente.  
>    - Mostre HP dos inimigos que estão em combate próximo (evite mostrar HP de tudo ao mesmo tempo se poluir).  
>    - Use **cores ligadas à criatura** (por exemplo, barra do player/aliado usando cor principal da criatura).  
> 4. Implemente essas barras de HP de forma eficiente:  
>    - Reaproveitando objetos gráficos quando possível.  
>    - Atualizando só quando o HP muda, para não custar performance desnecessária.  
> 5. Adicione pequenos efeitos quando o HP está baixo ou tomando muito dano rapidamente (ex: piscar barra, mudar cor para laranja/vermelho).  
> 6. Garanta que as barras não escondam o campo de visão nem confundam o jogador (posicionamento e tamanho cuidadosos).  
> 7. Atualize o `README.md` com uma subseção “HUD de HP” explicando o que cada barra representa e como ler rapidamente o estado de combate.

---

## 6. Identidade Visual de Itens: Cores e Categorias

**Prompt para um agente focado em cores diferentes para itens e clareza de inventário:**

> Você é responsável por criar um sistema de **identidade visual para itens**, usando cores para reforçar categorias e raridade.  
> 1. Leia `memory-bank/productContext.md` e `projectbrief.md` com foco em coleta de recursos, crafting e decisão de risco x recompensa.  
> 2. Analise `src/game/items.ts`, `src/game/playerState.ts`, `ExpeditionScene.ts`, `InventoryScene.ts` e `CraftingScene.ts` para entender os tipos de itens atuais (pokébolas, recursos, consumíveis, etc.) e como são apresentados.  
> 3. Defina uma taxonomia simples de **categorias de itens** (ex: captura, recurso bruto, consumível de combate, upgrade de criatura/base) e, opcionalmente, **raridade**.  
> 4. Associe **cores e talvez ícones/shapes simples** a cada categoria/raridade e centralize isso em um módulo de configuração (ex: `ITEM_VISUAL_CONFIG`).  
> 5. Aplique essas cores/identidade visual:  
>    - Nos pickups/itens que aparecem no mapa.  
>    - No inventário e crafting (bordas, fundos, texto).  
>    - Em qualquer tooltip ou descrição rápida.  
> 6. Garanta que o jogador consiga, em um olhar rápido, distinguir:  
>    - Itens que valem mais a pena arriscar para extrair.  
>    - Itens de uso imediato vs itens de longo prazo.  
> 7. Atualize o `README.md` com uma tabela “Categorias de Itens e Cores” explicando a legenda visual.

---

## 7. Profundidade Extra de Gameplay: Risco x Recompensa e Sinergias

**Prompt para um agente focado em adicionar mecânicas extras que aprofundem o gameplay (sem reescrever tudo):**

> Você é responsável por adicionar **mecânicas complementares** que aumentem a profundidade do gameplay, reforçando risco x recompensa e sinergias entre criaturas/itens.  
> 1. Leia `memory-bank/projectbrief.md`, `productContext.md`, `activeContext.md` e `progress.md` para entender o estado atual do jogo e os próximos passos desejados.  
> 2. Analise os sistemas já existentes (combate, captura, recursos, progressão de criaturas, itens) nos arquivos principais de jogo (`creatures.ts`, `items.ts`, `playerState.ts`, `ExpeditionScene.ts`, cenas de base/inventário/crafting).  
> 3. Proponha **2–4 pequenas mecânicas adicionais** que:  
>    - Reforcem a fantasia de extração arriscada (ex: bônus temporários quando o jogador está carregando muitos recursos, mas também maior perigo).  
>    - Criem sinergia entre tipos de criatura e itens (ex: criatura de fogo ganhando bônus com certo recurso, ou combo de pokébola + status).  
>    - Não exijam reescrever o core loop.  
> 4. Selecione as ideias mais viáveis (1–2 para implementar agora) e implemente-as de forma incremental, com:  
>    - Parâmetros configuráveis em `constants.ts` ou módulos de dados.  
>    - Feedback visual/textual claro quando essas mecânicas entram em ação.  
> 5. Garanta que essas novas mecânicas **não quebrem o balanceamento básico**; ajuste números se necessário.  
> 6. Documente em uma seção “Mecânicas Avançadas de Gameplay” no `README.md` o que foi adicionado, por que existe e como o jogador percebe isso durante a partida.

---

## Sugestão de Execução em Paralelo

- Agente A: Seção 1 (IA de inimigos: movimento/ataque).  
- Agente B: Seção 2 (Câmera, mapa grande e minimapa).  
- Agente C: Seção 3 (Progressão das criaturas: XP e cópias).  
- Agente D: Seção 4 (Identidade de criaturas: cores, ataques, feedback de hit).  
- Agente E: Seção 5 (Barras de HP e leitura de combate).  
- Agente F: Seção 6 (Identidade visual de itens e cores).  
- Agente G: Seção 7 (Mecânicas extras de profundidade de gameplay).

