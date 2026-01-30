# Plano de Implementação Multiplayer – PokéExtract: Wild Expedition

Este documento define o planejamento completo para implementar o multiplayer server-authoritative do jogo.
Os prompts estão organizados em **fases sequenciais**, onde cada fase pode ter **múltiplos agentes em paralelo**.

## Visão Geral das Fases

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 1: FUNDAÇÕES DO SERVIDOR (Paralelo)                                │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│ │ 1A: WorldState  │ │ 1B: Protocolo   │ │ 1C: Game Loop   │            │
│ │    e Tipos      │ │    Mensagens    │ │    Tick System  │            │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 2: SISTEMAS DE JOGO NO SERVIDOR (Paralelo)                         │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│ │ 2A: Sistema de  │ │ 2B: Sistema de  │ │ 2C: Sistema de  │            │
│ │    Spawns       │ │    Combate      │ │    Captura      │            │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘            │
│                     ┌─────────────────┐                                │
│                     │ 2D: Sistema de  │                                │
│                     │    Extração     │                                │
│                     └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 3: ADAPTAÇÃO DO CLIENTE (Paralelo)                                 │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│ │ 3A: Receber e   │ │ 3B: Enviar      │ │ 3C: Renderizar  │            │
│ │    Renderizar   │ │    Intents e    │ │    Outros       │            │
│ │    WorldState   │ │    Aplicar      │ │    Jogadores    │            │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 4: INTEGRAÇÃO E POLISH (Sequencial)                                │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ 4A: Integração, Testes e Estabilização Final                       ││
│ └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## Regras Gerais para Todos os Agentes

- **Sempre** ler os arquivos em `memory-bank/` antes de começar.
- **Sempre** ler `multiplayer-plan.md` para entender o contrato de mensagens planejado.
- Respeitar o estilo e padrões descritos em `systemPatterns.md` e `techContext.md`.
- Rodar linter/TypeScript nos arquivos modificados.
- **NÃO quebrar** o modo single-player existente (multiplayer deve ser opcional via `?mp=1`).
- Usar comentários `TODO(multiplayer)` para indicar pontos que ainda precisam de work.

---

# FASE 1: Fundações do Servidor

> **Objetivo**: Criar a estrutura base que permitirá os sistemas de jogo rodarem no servidor.
> **Paralelismo**: Os 3 agentes desta fase podem rodar em paralelo.
> **Dependência**: Nenhuma. Esta é a primeira fase.

---

## 1A. Estrutura de WorldState e Tipos Compartilhados

**Prompt para o agente:**

> Você é responsável por criar a estrutura de dados de **WorldState** no servidor e os **tipos compartilhados** entre cliente e servidor.
>
> 1. Leia `memory-bank/projectbrief.md`, `systemPatterns.md`, `techContext.md` e `multiplayer-plan.md` para entender a arquitetura planejada.
>
> 2. Analise `server/src/index.ts` para entender o modelo atual de `Room` e `PlayerPresence`.
>
> 3. Analise `src/scenes/ExpeditionScene.ts` para entender as entidades que existem hoje no cliente:
>    - `WildCreature` (id, currentHp, maxHp, tier, posição, comportamento de IA)
>    - Recursos (posição, tipo, quantidade)
>    - Pontos de extração (posição, estado)
>    - Projéteis (posição, velocidade, dano)
>
> 4. Crie um novo arquivo `server/src/types.ts` (ou `shared/types.ts` se preferir compartilhar com cliente) contendo:
>    - Interface `ServerCreature` com: id, creatureType, x, y, currentHp, maxHp, tier, aiState, behaviorType
>    - Interface `ServerResource` com: id, resourceType, x, y, quantity
>    - Interface `ServerExtractionPoint` com: id, x, y, radius, playersExtracting (map de playerId → progress)
>    - Interface `ServerProjectile` com: id, ownerId, x, y, velocityX, velocityY, damage, lifetime
>    - Interface `WorldState` agrupando: creatures, resources, extractionPoints, projectiles
>
> 5. Atualize `server/src/index.ts` para que `Room` inclua um campo `worldState: WorldState` inicializado vazio.
>
> 6. Crie funções factory simples para instanciar cada tipo de entidade com IDs únicos:
>    - `createCreature(type, x, y, tier): ServerCreature`
>    - `createResource(type, x, y): ServerResource`
>    - `createExtractionPoint(x, y, radius): ServerExtractionPoint`
>
> 7. Garanta que os tipos estejam bem documentados com JSDoc explicando cada campo.
>
> 8. Rode `npm run build` (ou equivalente) no servidor e corrija erros de TypeScript.
>
> 9. Ao final, faça um resumo curto (3–5 bullets) das estruturas criadas.

---

## 1B. Protocolo de Mensagens WebSocket Completo

**Prompt para o agente:**

> Você é responsável por definir e implementar o **protocolo completo de mensagens WebSocket** entre cliente e servidor.
>
> 1. Leia `multiplayer-plan.md` para entender o contrato de mensagens já planejado.
>
> 2. Analise `server/src/index.ts` para ver as mensagens já implementadas (`join`, `move`, `ping`).
>
> 3. Analise `src/services/multiplayerClient.ts` para ver como o cliente consome mensagens hoje.
>
> 4. Crie/atualize `server/src/messages.ts` com tipos TypeScript para TODAS as mensagens:
>
>    **Cliente → Servidor (Intents):**
>    - `JoinMessage` (já existe)
>    - `MoveMessage` (já existe)
>    - `AttackBasicMessage` { type: "attack_basic", targetX, targetY }
>    - `CaptureAttemptMessage` { type: "capture_attempt", targetId, ballType }
>    - `ResourceInteractMessage` { type: "resource_interact", resourceId }
>    - `ExtractionRequestMessage` { type: "extraction_request", pointId, action: "start" | "cancel" }
>    - `PingMessage` (já existe)
>
>    **Servidor → Cliente (State/Events):**
>    - `StateMessage` (expandir para incluir worldState)
>    - `CreaturesUpdateMessage` { type: "creatures_update", creatures: [...] }
>    - `ResourcesUpdateMessage` { type: "resources_update", resources: [...] }
>    - `AttackResultMessage` { type: "attack_result", attackerId, targetId?, damage, targetHp? }
>    - `CaptureResultMessage` { type: "capture_result", targetId, success, capturedCreature? }
>    - `ExtractionStateMessage` { type: "extraction_state", pointId, playerId, status, progress }
>    - `MatchEventMessage` { type: "match_event", event: "started" | "almost_finished" | "finished", timeLeft }
>    - `PlayerDeathMessage` { type: "player_death", playerId, reason }
>    - `ErrorMessage` (já existe)
>
> 5. Crie um type union `IncomingMessage` (cliente→servidor) e `OutgoingMessage` (servidor→cliente).
>
> 6. Adicione funções helper para criar cada tipo de mensagem:
>    - `createStateMessage(room): StateMessage`
>    - `createAttackResultMessage(...): AttackResultMessage`
>    - etc.
>
> 7. No `server/src/index.ts`, atualize o handler de mensagens para reconhecer os novos tipos (por enquanto, só logar que recebeu, sem implementar a lógica).
>
> 8. No `src/services/multiplayerClient.ts`, adicione métodos para enviar os novos tipos de intent:
>    - `sendAttack(targetX, targetY)`
>    - `sendCaptureAttempt(targetId, ballType)`
>    - `sendResourceInteract(resourceId)`
>    - `sendExtractionRequest(pointId, action)`
>
> 9. Adicione novos eventos no cliente para receber as novas mensagens:
>    - Expandir `MultiplayerEvents` com: `creaturesUpdate`, `attackResult`, `captureResult`, `extractionState`, `matchEvent`, `playerDeath`
>
> 10. Rode linter/TypeScript em ambos servidor e cliente.
>
> 11. Ao final, documente em um comentário no topo de `messages.ts` a lista completa de mensagens e seus propósitos.

---

## 1C. Game Loop e Sistema de Tick no Servidor

**Prompt para o agente:**

> Você é responsável por implementar o **game loop (tick system)** no servidor que processará a simulação do jogo.
>
> 1. Leia `memory-bank/systemPatterns.md` e `multiplayer-plan.md` para entender a visão de servidor autoritativo.
>
> 2. Analise `server/src/index.ts` para entender como as salas funcionam hoje.
>
> 3. Implemente um sistema de **game loop** para cada sala ativa:
>
>    - Crie `server/src/gameLoop.ts` com uma classe ou funções para gerenciar o loop.
>    - O loop deve rodar a uma taxa fixa (ex: 20 ticks/segundo = 50ms por tick).
>    - Use `setInterval` para o MVP (pode evoluir para requestAnimationFrame-like depois).
>
> 4. O game loop de cada sala deve:
>    - Ter uma **fila de intents** (ações dos jogadores) a processar.
>    - A cada tick:
>      - Processar intents na fila (movimento, ataque, captura, extração).
>      - Atualizar estado do mundo (IA de criaturas, projéteis, cooldowns).
>      - Verificar condições de fim de partida (tempo, todos extraíram/morreram).
>      - Emitir snapshot de estado para todos os clientes (pode ser a cada N ticks para economizar banda).
>
> 5. Integre o game loop com `Room`:
>    - Ao criar uma sala, iniciar o loop.
>    - Ao sala ficar vazia, pausar/destruir o loop.
>    - Adicionar método `room.queueIntent(playerId, intent)` para enfileirar ações.
>
> 6. Implemente controle de **estado da partida**:
>    - Estados: `waiting`, `in_progress`, `finished`
>    - Transições automáticas baseadas em tempo e condições.
>
> 7. Adicione logs de debug para visualizar o tick acontecendo (toggle via env var).
>
> 8. Configure constantes em `server/src/constants.ts`:
>    - `TICK_RATE` (ex: 20)
>    - `STATE_BROADCAST_RATE` (ex: a cada 3 ticks)
>    - `MATCH_DURATION_SECONDS` (usar mesmo valor do cliente)
>
> 9. Garanta que o loop seja resiliente a erros (try/catch para não derrubar o servidor).
>
> 10. Rode o servidor e verifique que o loop está rodando (via logs).
>
> 11. Ao final, faça um resumo curto explicando como o tick system funciona.

---

# FASE 2: Sistemas de Jogo no Servidor

> **Objetivo**: Implementar a lógica de jogo (spawns, combate, captura, extração) no servidor.
> **Paralelismo**: Os 4 agentes desta fase podem rodar em paralelo.
> **Dependência**: Requer FASE 1 completa (WorldState, Mensagens, Game Loop).

---

## 2A. Sistema de Spawns Server-Side

**Prompt para o agente:**

> Você é responsável por implementar o **sistema de spawns de criaturas e recursos** no servidor.
>
> 1. Leia `memory-bank/projectbrief.md` e `multiplayer-plan.md` para entender o papel de spawns no multiplayer.
>
> 2. Analise `src/scenes/ExpeditionScene.ts` procurando por:
>    - `spawnResourcesAndCreatures` e funções relacionadas
>    - Como criaturas e recursos são posicionados hoje
>    - Configurações de densidade, tipos, posições
>
> 3. Analise `src/game/constants.ts` para entender:
>    - `WILD_CREATURE_CONFIG` (quantidade, HP, comportamento)
>    - `RESOURCE_CONFIG` (tipos, quantidade)
>    - `CAPTURE_CREATURE_POOL` (pool de criaturas por bioma)
>    - `BIOME_RESOURCES` (recursos por bioma)
>
> 4. Crie `server/src/systems/spawns.ts` com:
>
>    - Função `initializeWorldSpawns(room, mapConfig): void` que:
>      - Gera criaturas com posições aleatórias válidas (evitando bordas, zonas de spawn de jogador)
>      - Gera recursos espalhados pelo mapa
>      - Gera pontos de extração nas posições configuradas
>      - Popula `room.worldState` com todas as entidades
>
>    - Função `respawnCreature(room, position?): ServerCreature` para respawn durante partida
>
>    - Função `respawnResource(room, position?): ServerResource` para respawn de recursos
>
> 5. Copie/adapte as configurações relevantes de `src/game/constants.ts` para `server/src/constants.ts`:
>    - Configurações de spawn (quantidade, tipos, distribuição)
>    - Configurações por mapa/bioma
>
> 6. Integre com o game loop:
>    - Chamar `initializeWorldSpawns` quando a partida começar
>    - (Opcional) Implementar respawn periódico de recursos durante a partida
>
> 7. Atualize o `StateMessage` para incluir o estado inicial do mundo no primeiro broadcast.
>
> 8. Adicione seed opcional para spawns determinísticos (útil para debug/replay).
>
> 9. Teste iniciando uma sala e verificando que o worldState está populado (via logs).
>
> 10. Ao final, documente as configurações de spawn em comentários no código.

---

## 2B. Sistema de Combate Server-Side

**Prompt para o agente:**

> Você é responsável por implementar o **sistema de combate** (ataque, dano, projéteis) no servidor.
>
> 1. Leia `memory-bank/projectbrief.md` e `multiplayer-plan.md` com foco em combate e validação server-side.
>
> 2. Analise `src/scenes/ExpeditionScene.ts` procurando por:
>    - Lógica de ataque do jogador (básico e especial)
>    - Sistema de projéteis (`Projectile`, `EnemyProjectile`)
>    - Cálculo de dano e redução de HP
>    - Detecção de colisão
>
> 3. Analise `src/game/constants.ts` para entender:
>    - `COMBAT_CONFIG` (dano base, alcance, cooldowns)
>    - `ENEMY_AI_CONFIG` (dano de inimigos)
>
> 4. Crie `server/src/systems/combat.ts` com:
>
>    - Função `processAttackIntent(room, playerId, intent): AttackResult` que:
>      - Valida se o jogador pode atacar (cooldown, estado)
>      - Cria projétil no worldState
>      - Retorna resultado para broadcast
>
>    - Função `updateProjectiles(room, deltaTime): void` que:
>      - Move todos os projéteis baseado em velocidade
>      - Detecta colisões com criaturas e jogadores
>      - Aplica dano em caso de hit
>      - Remove projéteis expirados ou que colidiram
>
>    - Função `applyDamage(target, damage, attackerId): DamageResult` que:
>      - Reduz HP da criatura/jogador
>      - Verifica morte e dispara eventos apropriados
>      - Retorna resultado para broadcast
>
>    - Função `updateCreatureAI(room, deltaTime): void` que:
>      - Atualiza estado de IA de cada criatura
>      - Move criaturas em direção a jogadores próximos
>      - Dispara ataques de criaturas (melee ou ranged)
>
> 5. Copie configurações de combate para `server/src/constants.ts`:
>    - Dano base, cooldowns, alcances
>    - Velocidade de projéteis
>    - Configurações de IA de criaturas
>
> 6. Integre com o game loop:
>    - Processar intents de ataque da fila
>    - Chamar `updateProjectiles` e `updateCreatureAI` a cada tick
>    - Emitir `AttackResultMessage` e `CreaturesUpdateMessage` quando relevante
>
> 7. Implemente detecção de morte de jogador:
>    - Quando HP chega a 0, emitir `PlayerDeathMessage`
>    - Marcar jogador como morto no estado da sala
>
> 8. Teste atacando criaturas e verificando que o dano é calculado corretamente.
>
> 9. Ao final, documente a fórmula de dano e os parâmetros configuráveis.

---

## 2C. Sistema de Captura Server-Side

**Prompt para o agente:**

> Você é responsável por implementar o **sistema de captura de criaturas** no servidor.
>
> 1. Leia `memory-bank/projectbrief.md` e `multiplayer-plan.md` com foco em captura e validação server-side.
>
> 2. Analise `src/scenes/ExpeditionScene.ts` procurando por:
>    - Lógica de tentativa de captura
>    - Cálculo de chance de captura (baseChance + bonus por HP baixo + tipo de bola)
>    - Consumo de pokébolas
>    - Remoção de criatura ao capturar
>
> 3. Analise `src/game/constants.ts` para entender:
>    - `CAPTURE_CONFIG` (chance base, multiplicadores)
>    - `CAPTURE_BALL_MODIFIERS` (bônus por tipo de pokébola)
>
> 4. Crie `server/src/systems/capture.ts` com:
>
>    - Função `processCaptureIntent(room, playerId, intent): CaptureResult` que:
>      - Valida se o jogador tem a pokébola do tipo especificado
>      - Valida se a criatura existe e está viva
>      - Valida distância do jogador até a criatura
>      - Calcula chance de captura: `baseChance + hpBonus + ballBonus`
>      - Rola o dado e determina sucesso/falha
>      - Se sucesso: remove criatura do mundo, adiciona ao inventário temporário do jogador
>      - Consome a pokébola do inventário do jogador
>      - Retorna resultado para broadcast
>
>    - Função `calculateCaptureChance(creature, ballType): number` que:
>      - Calcula chance baseada em HP atual vs máximo
>      - Aplica modificador do tipo de pokébola
>      - Aplica modificador de tier da criatura (criaturas raras são mais difíceis)
>
> 5. Adicione ao `PlayerPresence` (ou nova estrutura) campos para:
>    - Inventário temporário de pokébolas na expedição
>    - Lista de criaturas capturadas nesta expedição
>
> 6. Copie configurações de captura para `server/src/constants.ts`:
>    - Chances base, multiplicadores, distância máxima
>
> 7. Integre com o game loop:
>    - Processar intents de captura da fila
>    - Emitir `CaptureResultMessage` com resultado
>    - Emitir `CreaturesUpdateMessage` se criatura foi removida
>
> 8. Teste capturando criaturas e verificando que a chance está correta e o inventário é atualizado.
>
> 9. Ao final, documente a fórmula de captura em comentários.

---

## 2D. Sistema de Extração Server-Side

**Prompt para o agente:**

> Você é responsável por implementar o **sistema de extração** no servidor.
>
> 1. Leia `memory-bank/projectbrief.md` e `multiplayer-plan.md` com foco em extração e fim de partida.
>
> 2. Analise `src/scenes/ExpeditionScene.ts` procurando por:
>    - Zona de extração e verificação de presença
>    - Barra de progresso de extração (segurar E)
>    - Conclusão de extração e persistência de recompensas
>    - Retorno à base após extração
>
> 3. Analise `src/game/constants.ts` para entender:
>    - `EXTRACTION_REQUIRED_SECONDS` (tempo para extrair)
>
> 4. Crie `server/src/systems/extraction.ts` com:
>
>    - Função `processExtractionIntent(room, playerId, intent): void` que:
>      - Se action="start": inicia extração para o jogador no ponto especificado
>      - Se action="cancel": cancela extração em andamento
>      - Valida se jogador está dentro do raio do ponto de extração
>      - Atualiza `extractionPoint.playersExtracting`
>
>    - Função `updateExtractions(room, deltaTime): ExtractionUpdate[]` que:
>      - Para cada jogador extraindo, incrementa progresso
>      - Se progresso >= 100%, marca extração como completa
>      - Jogadores que saem da zona perdem o progresso
>      - Retorna lista de updates para broadcast
>
>    - Função `completeExtraction(room, playerId, pointId): ExtractionReward` que:
>      - Calcula recompensas (recursos coletados, criaturas capturadas)
>      - Marca jogador como "extraído" (não participa mais da partida)
>      - Prepara dados para persistência (será enviado ao cliente para salvar)
>      - Retorna resultado para broadcast
>
> 5. Adicione ao `PlayerPresence`:
>    - `extractionProgress: number` (0-100)
>    - `extractedAt: number | null` (timestamp se já extraiu)
>    - `resourcesCollected: Map<string, number>`
>
> 6. Integre com o game loop:
>    - Processar intents de extração da fila
>    - Chamar `updateExtractions` a cada tick
>    - Emitir `ExtractionStateMessage` com progresso
>    - Verificar se todos os jogadores extraíram ou morreram para encerrar partida
>
> 7. Implemente verificação de fim de partida:
>    - Tempo esgotado: jogadores que não extraíram perdem tudo
>    - Todos extraídos/mortos: partida encerra antecipadamente
>    - Emitir `MatchEventMessage` com evento "finished"
>
> 8. Teste extraindo e verificando que o progresso e conclusão funcionam.
>
> 9. Ao final, documente o fluxo de extração em comentários.

---

# FASE 3: Adaptação do Cliente

> **Objetivo**: Adaptar o cliente para consumir o estado do servidor e enviar intents.
> **Paralelismo**: Os 3 agentes desta fase podem rodar em paralelo.
> **Dependência**: Requer FASE 2 completa (sistemas de jogo no servidor funcionando).

---

## 3A. Cliente: Receber e Renderizar WorldState

**Prompt para o agente:**

> Você é responsável por adaptar o cliente para **receber e renderizar o WorldState** vindo do servidor.
>
> 1. Leia `memory-bank/activeContext.md` e `multiplayer-plan.md` para entender a migração planejada.
>
> 2. Analise `src/scenes/ExpeditionScene.ts` para entender como criaturas e recursos são renderizados hoje.
>
> 3. Analise `src/services/multiplayerClient.ts` para entender como o estado é recebido.
>
> 4. Modifique `ExpeditionScene.ts` para criar um **modo multiplayer** (ativado via `?mp=1`):
>
>    - Quando em modo MP, **não** chamar `spawnResourcesAndCreatures` local
>    - Criar estruturas para armazenar entidades recebidas do servidor:
>      - `serverCreatures: Map<string, { data: ServerCreature, sprite: Phaser.GameObjects.Arc }>`
>      - `serverResources: Map<string, { data: ServerResource, sprite: Phaser.GameObjects.Arc }>`
>
>    - Implementar handler para `creaturesUpdate`:
>      - Criar sprites para novas criaturas
>      - Atualizar posição/HP de criaturas existentes
>      - Remover sprites de criaturas que não existem mais
>
>    - Implementar handler para `resourcesUpdate`:
>      - Criar sprites para novos recursos
>      - Remover sprites de recursos coletados
>
>    - Implementar handler para `state` (snapshot completo):
>      - Sincronizar worldState completo na conexão inicial
>      - Atualizar timer da partida com `match.timeLeft` do servidor
>
> 5. Adicione **interpolação básica** para movimento suave de criaturas:
>    - Guardar posição anterior e alvo
>    - No update, interpolar entre elas
>
> 6. Garanta que o modo single-player continue funcionando:
>    - Usar flag `this.isMultiplayer` para decidir fonte de dados
>    - Código de spawn local só roda quando `!this.isMultiplayer`
>
> 7. Teste conectando ao servidor e verificando que criaturas/recursos aparecem corretamente.
>
> 8. Ao final, documente como alternar entre modos single/multiplayer.

---

## 3B. Cliente: Enviar Intents e Aplicar Resultados

**Prompt para o agente:**

> Você é responsável por adaptar o cliente para **enviar intents ao servidor** e **aplicar os resultados** recebidos.
>
> 1. Leia `multiplayer-plan.md` para entender o fluxo de intents e resultados.
>
> 2. Analise `src/scenes/ExpeditionScene.ts` para entender onde as ações são processadas hoje:
>    - Ataque (clique/espaço)
>    - Captura (Q perto de criatura)
>    - Coleta de recursos (colisão)
>    - Extração (segurar E na zona)
>
> 3. Modifique as ações para **modo multiplayer**:
>
>    **Ataque:**
>    - Em vez de criar projétil local, chamar `multiplayerClient.sendAttack(targetX, targetY)`
>    - Implementar handler para `attackResult`:
>      - Criar efeito visual de projétil/hit
>      - Atualizar HP da criatura atingida
>      - Mostrar feedback de dano
>
>    **Captura:**
>    - Em vez de calcular chance local, chamar `multiplayerClient.sendCaptureAttempt(targetId, ballType)`
>    - Implementar handler para `captureResult`:
>      - Mostrar animação de sucesso/falha
>      - Atualizar contador de criaturas capturadas
>      - Atualizar inventário de pokébolas (consumir)
>
>    **Coleta de Recursos:**
>    - Em vez de coletar local, chamar `multiplayerClient.sendResourceInteract(resourceId)`
>    - Implementar handler para `resourcesUpdate`:
>      - Remover recurso da tela
>      - Atualizar contador de recursos coletados
>
>    **Extração:**
>    - Chamar `multiplayerClient.sendExtractionRequest(pointId, "start")` ao iniciar
>    - Chamar `multiplayerClient.sendExtractionRequest(pointId, "cancel")` ao cancelar
>    - Implementar handler para `extractionState`:
>      - Atualizar barra de progresso com valor do servidor
>      - Mostrar conclusão e recompensas ao completar
>
> 4. Implemente handlers para eventos de partida:
>    - `matchEvent`: mostrar avisos de tempo, fim de partida
>    - `playerDeath`: mostrar tela de morte, desabilitar controles
>
> 5. Adicione **predição local leve** para responsividade:
>    - Ao atacar, mostrar efeito imediato (será confirmado/corrigido pelo servidor)
>    - Ao mover, continuar movimento local (já existe)
>
> 6. Garanta que o modo single-player continue funcionando:
>    - Ações locais executam normalmente quando `!this.isMultiplayer`
>
> 7. Teste todas as ações e verifique que funcionam em multiplayer.
>
> 8. Ao final, documente o fluxo de cada ação em modo multiplayer.

---

## 3C. Cliente: Renderizar Outros Jogadores

**Prompt para o agente:**

> Você é responsável por **renderizar e animar outros jogadores** na expedição multiplayer.
>
> 1. Leia `multiplayer-plan.md` para entender o formato de dados de jogadores.
>
> 2. Analise `src/scenes/ExpeditionScene.ts` para entender como o jogador local é renderizado.
>
> 3. Analise `src/services/multiplayerClient.ts` para entender o evento `state` com lista de players.
>
> 4. Implemente renderização de **outros jogadores** em `ExpeditionScene.ts`:
>
>    - Criar estrutura `remotePlayers: Map<string, RemotePlayerSprite>` onde:
>      ```typescript
>      interface RemotePlayerSprite {
>        id: string;
>        name: string;
>        sprite: Phaser.GameObjects.Arc;
>        nameText: Phaser.GameObjects.Text;
>        hpBar: Phaser.GameObjects.Rectangle;
>        targetX: number;
>        targetY: number;
>        lastX: number;
>        lastY: number;
>      }
>      ```
>
>    - No handler de `state`:
>      - Criar sprites para novos jogadores (cor diferente do local)
>      - Atualizar posição alvo de jogadores existentes
>      - Remover sprites de jogadores que saíram
>
>    - No `update`:
>      - Interpolar posição de cada jogador remoto para movimento suave
>      - Atualizar posição do texto de nome
>
> 5. Diferencie visualmente jogadores:
>    - Jogador local: cor principal (já existe)
>    - Outros jogadores: cor secundária/diferente
>    - Nome flutuante acima de cada jogador remoto
>
> 6. Implemente **barra de HP** para jogadores remotos:
>    - Usar sistema de HPBarManager existente ou criar similar
>    - Atualizar quando receber dano (via eventos)
>
> 7. Implemente indicadores de ação de outros jogadores:
>    - Quando outro jogador ataca, mostrar efeito visual
>    - Quando outro jogador está extraindo, mostrar indicador
>
> 8. Garanta que o jogador local seja filtrado da lista de remotos (evitar duplicação).
>
> 9. Adicione limite de renderização (ex: só mostrar jogadores próximos se houver muitos).
>
> 10. Teste com múltiplas abas/clientes e verifique que todos os jogadores aparecem corretamente.
>
> 11. Ao final, documente como outros jogadores são renderizados.

---

# FASE 4: Integração e Polish

> **Objetivo**: Integrar todo o trabalho, testar e estabilizar o multiplayer.
> **Paralelismo**: Esta fase deve ser executada por um único agente após as anteriores.
> **Dependência**: Requer FASE 3 completa.

---

## 4A. Integração, Testes e Estabilização Final

**Prompt para o agente:**

> Você é responsável por **integrar todo o trabalho** das fases anteriores e deixar o multiplayer **estável e jogável**.
>
> 1. Leia `memory-bank/activeContext.md`, `progress.md` e `multiplayer-plan.md` para entender o estado esperado.
>
> 2. **Verifique a integração** entre todos os sistemas:
>
>    - **Servidor:**
>      - WorldState está sendo populado com spawns
>      - Game loop está processando intents e atualizando estado
>      - Mensagens estão sendo enviadas corretamente
>      - Combate, captura e extração funcionam
>
>    - **Cliente:**
>      - Recebe e renderiza WorldState do servidor
>      - Envia intents corretamente
>      - Aplica resultados do servidor
>      - Renderiza outros jogadores
>
> 3. **Teste o fluxo completo** em modo multiplayer (`?mp=1`):
>    - Iniciar expedição (conectar na sala)
>    - Ver criaturas e recursos vindos do servidor
>    - Atacar criaturas e ver dano
>    - Capturar criaturas e ver resultado
>    - Coletar recursos
>    - Extrair e ver recompensas
>    - Testar com 2+ clientes simultaneamente
>
> 4. **Corrija bugs de integração** encontrados:
>    - Sincronização de estado
>    - Timing de mensagens
>    - Renderização de entidades
>    - Interpolação de movimento
>    - Persistência de recompensas
>
> 5. **Garanta que o modo single-player** continue funcionando perfeitamente:
>    - Testar sem `?mp=1`
>    - Verificar que não há regressões
>
> 6. **Rode linter/TypeScript** em todos os arquivos modificados e corrija erros.
>
> 7. **Adicione tratamento de erros** para casos comuns:
>    - Servidor não disponível: fallback para single-player
>    - Desconexão durante partida: reconexão ou fim gracioso
>    - Sala cheia: mensagem de erro clara
>
> 8. **Otimize broadcast de estado** se necessário:
>    - Enviar apenas deltas em vez de estado completo
>    - Reduzir frequência de updates se performance for problema
>
> 9. **Atualize a documentação**:
>
>    - `memory-bank/activeContext.md`: estado atual do multiplayer
>    - `memory-bank/progress.md`: resumo do que foi implementado
>    - `multiplayer-plan.md`: marcar itens como implementados
>    - `README.md`: adicionar seção "Modo Multiplayer" com:
>      - Como rodar o servidor
>      - Como ativar multiplayer no cliente
>      - Limitações conhecidas
>
> 10. **Produza um resumo final** (5-7 bullets) descrevendo:
>    - O que o multiplayer faz agora
>    - Limitações conhecidas
>    - Próximos passos sugeridos
>
> 11. Ao final, verifique que tudo está commitável e pronto para merge.

---

# Resumo de Execução

## Ordem de Execução

```
Fase 1 (Paralelo) → Fase 2 (Paralelo) → Fase 3 (Paralelo) → Fase 4 (Sequencial)
```

## Alocação de Agentes

| Fase | Agente | Tarefa | Pode Paralelo? |
|------|--------|--------|----------------|
| 1 | A | WorldState e Tipos | ✅ Sim |
| 1 | B | Protocolo de Mensagens | ✅ Sim |
| 1 | C | Game Loop | ✅ Sim |
| 2 | D | Sistema de Spawns | ✅ Sim |
| 2 | E | Sistema de Combate | ✅ Sim |
| 2 | F | Sistema de Captura | ✅ Sim |
| 2 | G | Sistema de Extração | ✅ Sim |
| 3 | H | Receber WorldState | ✅ Sim |
| 3 | I | Enviar Intents | ✅ Sim |
| 3 | J | Renderizar Jogadores | ✅ Sim |
| 4 | K | Integração Final | ❌ Sequencial |

## Checkpoints de Validação

Antes de iniciar cada fase, verifique:

1. **Antes da Fase 2**: 
   - `server/src/types.ts` existe com todas as interfaces
   - `server/src/messages.ts` existe com todas as mensagens
   - Game loop está rodando e processando (mesmo que vazio)

2. **Antes da Fase 3**:
   - Servidor popula worldState com spawns ao criar sala
   - Servidor processa ataques e aplica dano
   - Servidor processa capturas e retorna resultado
   - Servidor processa extração e calcula recompensas

3. **Antes da Fase 4**:
   - Cliente renderiza criaturas/recursos do servidor
   - Cliente envia intents e aplica resultados
   - Cliente renderiza outros jogadores
   - Fluxo básico funciona end-to-end

---

# Anexo: Arquivos Chave

## Servidor

- `server/src/index.ts` - Entry point, WebSocket, salas
- `server/src/types.ts` - Interfaces de WorldState
- `server/src/messages.ts` - Tipos de mensagens
- `server/src/constants.ts` - Configurações de jogo
- `server/src/gameLoop.ts` - Sistema de tick
- `server/src/systems/spawns.ts` - Sistema de spawns
- `server/src/systems/combat.ts` - Sistema de combate
- `server/src/systems/capture.ts` - Sistema de captura
- `server/src/systems/extraction.ts` - Sistema de extração

## Cliente

- `src/services/multiplayerClient.ts` - Cliente WebSocket
- `src/scenes/ExpeditionScene.ts` - Cena principal (adaptar para MP)
- `src/game/constants.ts` - Configurações (espelhar no servidor)
- `src/game/types.ts` - Tipos compartilhados

---

Este plano foi desenhado para maximizar paralelismo enquanto respeita dependências reais entre os sistemas. Cada prompt é auto-contido e pode ser executado por um agente independente, desde que as fases anteriores estejam completas.
