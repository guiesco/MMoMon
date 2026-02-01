# Plano de Refatoração: Multiplayer-First + Firebase

**Data**: Janeiro 2026  
**Objetivo**: Reorganizar documentações, refatorar para arquitetura multiplayer-first e melhorar integração Firebase

---

## Fase 1: Limpeza e Reorganização de Documentações

### Documentações a Manter (Consolidar)
- `README.md` - Atualizar para refletir arquitetura multiplayer-first
- `FIREBASE_SETUP_GUIDE.md` - Manter (ainda relevante)
- `memory-bank/*.md` - Atualizar todos os arquivos

### Documentações a Remover (Obsoletas)
- Todas as fases antigas (PHASE_3B, PHASE_4A, PHASE_4B, PHASE_4C, PHASE_5, PHASE_6, PHASE_7, PHASE_8)
- Documentações de unificação single/multiplayer (já unificado)
- Documentações de correções pontuais antigas
- Prompts antigos de implementação

### Documentações a Consolidar
- Criar `ARCHITECTURE.md` consolidando arquitetura atual
- Criar `FIREBASE_INTEGRATION.md` consolidando integração Firebase
- Atualizar `memory-bank/` com estado atual

---

## Fase 2: Refatoração Multiplayer-First

### Objetivos
1. Remover flag `isMultiplayer` - sempre usar servidor
2. Remover lógica duplicada single/multiplayer
3. Garantir que mundo e valores sejam sempre iniciados pelo servidor
4. Cliente apenas recebe e renderiza

### Mudanças no Código

#### `ExpeditionScene.ts`
- Remover `isMultiplayer` flag
- Remover `if (isMultiplayer)` checks
- Sempre usar `RemoteWorldState`
- Sempre conectar ao servidor
- Remover spawn local de criaturas/recursos
- Remover lógica de IA local

#### `worldState.ts`
- Remover `LocalWorldState` (ou manter apenas para testes)
- Sempre usar `RemoteWorldState`
- Simplificar interface

#### `server/src/index.ts`
- Garantir que servidor sempre inicializa mundo completo
- Enviar estado inicial completo no `state` message
- Validar todas as ações server-side

---

## Fase 3: Melhorar Integração Firebase

### Objetivos
1. Client: sync apenas no login e ações de crafting/loadout/equipe
2. Server: todas as outras interações (extração, recompensas, etc.)

### Mudanças

#### Client (`firebaseSync.ts`, `firebaseClient.ts`)
- Manter: sync no login (carregar dados do jogador)
- Manter: sync em crafting (atualizar inventário)
- Manter: sync em loadout/equipe (atualizar time ativo)
- Remover: sync de expedição/recompensas (server-side)

#### Server (`firestoreOperations.ts`, `index.ts`)
- Manter: salvamento de recompensas de extração
- Adicionar: recuperar time usado do Firebase
- Adicionar: registrar itens de sucesso na extração
- Garantir: todas as operações de escrita são server-side

---

## Fase 4: Modularização e Separação de Responsabilidades

### Objetivos
1. Quebrar arquivos excessivamente grandes (>2000 linhas) em módulos menores e focados
2. Separar responsabilidades distintas em classes/sistemas dedicados
3. Melhorar manutenibilidade, testabilidade e legibilidade do código
4. Facilitar colaboração e desenvolvimento paralelo
5. Seguir princípios SOLID e boas práticas de arquitetura

### Arquivos Prioritários para Refatoração

#### `src/scenes/ExpeditionScene.ts` (~6176 linhas)
**Problema**: Arquivo monolítico com múltiplas responsabilidades misturadas.

**Estrutura Proposta**:
```
src/scenes/expedition/
├── ExpeditionScene.ts (arquivo principal, ~500-800 linhas)
├── managers/
│   ├── SpriteManager.ts (gerenciamento de sprites de criaturas, recursos, jogadores)
│   ├── ProjectileManager.ts (projéteis locais e remotos)
│   ├── SkillZoneManager.ts (áreas de habilidades especiais)
│   ├── HPBarManager.ts (já existe, mover para managers/)
│   └── MinimapManager.ts (sistema de minimapa)
├── systems/
│   ├── CombatSystem.ts (lógica de combate, ataques, dano)
│   ├── CaptureSystem.ts (sistema de captura de criaturas)
│   ├── ExtractionSystem.ts (sistema de extração)
│   ├── EnemyAISystem.ts (IA de inimigos - melee, ranged, patrulha)
│   ├── SkillSystem.ts (habilidades especiais - fire fog, heal wave, etc)
│   └── MovementSystem.ts (movimento do jogador e interpolação)
├── ui/
│   ├── HUDManager.ts (HUD principal, timer, recursos coletados)
│   ├── ExtractionUI.ts (UI de progresso de extração)
│   ├── SkillCooldownUI.ts (UI de cooldown de habilidades)
│   ├── FeedbackManager.ts (feedback visual - textos flutuantes, efeitos)
│   └── DebugPanel.ts (painel de debug)
├── visuals/
│   ├── EffectFactory.ts (efeitos visuais - morte, impacto, muzzle flash)
│   ├── FeedbackFactory.ts (feedback de captura, coleta, XP)
│   └── VisualEffects.ts (efeitos de habilidade, sinergia, greed)
└── types/
    └── ExpeditionTypes.ts (interfaces e tipos específicos da expedição)
```

**Responsabilidades por Módulo**:
- **ExpeditionScene**: Orquestração principal, ciclo de vida da cena, coordenação entre sistemas
- **SpriteManager**: Criação, atualização, destruição de sprites (creatures, resources, players)
- **CombatSystem**: Lógica de combate, cálculo de dano, cooldowns, ataques básicos/especiais
- **CaptureSystem**: Lógica de captura, pokébolas, cálculo de taxa de captura
- **ExtractionSystem**: Lógica de extração, progresso, validação
- **EnemyAISystem**: IA de inimigos (comportamentos, patrulha, aggro, ataques)
- **SkillSystem**: Habilidades especiais, cooldowns, áreas de efeito
- **MovementSystem**: Movimento do jogador, interpolação de entidades remotas
- **HUDManager**: Interface principal (timer, recursos, criaturas capturadas)
- **FeedbackManager**: Feedback visual (textos flutuantes, efeitos de sucesso/falha)

#### `server/src/index.ts` (~1501 linhas)
**Problema**: Arquivo centralizando gerenciamento de conexões, salas, mensagens e lógica de jogo.

**Estrutura Proposta**:
```
server/src/
├── index.ts (arquivo principal, ~200-300 linhas - apenas inicialização)
├── server/
│   ├── WebSocketServer.ts (configuração e inicialização do servidor)
│   └── HttpServer.ts (já existe, manter)
├── room/
│   ├── RoomManager.ts (criação, busca, limpeza de salas)
│   ├── Room.ts (classe Room com estado e métodos)
│   └── RoomLifecycle.ts (inicialização, game loop, finalização)
├── connection/
│   ├── ConnectionHandler.ts (gerenciamento de conexões WebSocket)
│   ├── MessageRouter.ts (roteamento de mensagens para handlers apropriados)
│   └── MessageValidator.ts (validação de mensagens recebidas)
├── handlers/
│   ├── JoinHandler.ts (handler de mensagem join)
│   ├── MoveHandler.ts (handler de mensagem move)
│   ├── AttackHandler.ts (handler de mensagem attack_basic)
│   ├── SkillHandler.ts (handler de mensagem use_skill)
│   ├── CaptureHandler.ts (handler de mensagem capture_attempt)
│   ├── ResourceHandler.ts (handler de mensagem resource_interact)
│   ├── ExtractionHandler.ts (handler de mensagem extraction_request)
│   └── TeamSyncHandler.ts (handler de mensagem team_sync)
├── broadcast/
│   ├── StateBroadcaster.ts (broadcast de estado da sala)
│   ├── MessageBroadcaster.ts (broadcast de mensagens específicas)
│   └── MatchEventBroadcaster.ts (broadcast de eventos de partida)
├── intents/
│   ├── IntentFactory.ts (criação de intents a partir de mensagens)
│   └── IntentValidator.ts (validação de intents antes de processar)
└── types/
    └── ServerTypes.ts (interfaces Room, PlayerPresence, mensagens, etc)
```

**Responsabilidades por Módulo**:
- **index.ts**: Apenas inicialização do servidor e configuração
- **WebSocketServer**: Configuração e setup do servidor WebSocket
- **RoomManager**: Gerenciamento do ciclo de vida de salas (criar, buscar, limpar)
- **Room**: Classe representando uma sala com seu estado e métodos
- **ConnectionHandler**: Gerenciamento de conexões individuais (conectar, desconectar, mensagens)
- **MessageRouter**: Roteamento de mensagens para handlers específicos
- **Handlers**: Cada handler processa um tipo específico de mensagem
- **StateBroadcaster**: Broadcast de estado completo da sala
- **IntentFactory**: Criação de intents a partir de mensagens recebidas

### Princípios a Seguir

1. **Single Responsibility Principle (SRP)**
   - Cada classe/módulo deve ter uma única responsabilidade
   - Evitar classes "God Objects"

2. **Separation of Concerns**
   - Lógica de negócio separada de renderização
   - Sistema de rede separado de lógica de jogo
   - UI separada de lógica de estado

3. **Dependency Injection**
   - Sistemas devem receber dependências via construtor
   - Facilitar testes e mock de dependências

4. **Composição sobre Herança**
   - Preferir composição de sistemas menores
   - Evitar hierarquias profundas de herança

5. **Interfaces e Contratos Claros**
   - Definir interfaces bem definidas entre módulos
   - Documentar contratos de comunicação

### Estratégia de Refatoração

#### Abordagem Incremental
1. **Fase 4.1**: Extrair sistemas mais independentes primeiro (ex: FeedbackManager, MinimapManager)
2. **Fase 4.2**: Extrair sistemas com dependências moderadas (ex: CombatSystem, CaptureSystem)
3. **Fase 4.3**: Refatorar núcleo principal (ExpeditionScene, server/index.ts)
4. **Fase 4.4**: Revisar e otimizar interfaces entre módulos

#### Técnicas
- **Extract Class**: Criar novas classes para responsabilidades específicas
- **Extract Method**: Quebrar métodos grandes em métodos menores
- **Move Method**: Mover métodos para classes mais apropriadas
- **Introduce Parameter Object**: Agrupar parâmetros relacionados em objetos

### Benefícios Esperados

1. **Manutenibilidade**: Código mais fácil de entender e modificar
2. **Testabilidade**: Sistemas isolados são mais fáceis de testar
3. **Colaboração**: Múltiplos desenvolvedores podem trabalhar em paralelo
4. **Reutilização**: Sistemas modulares podem ser reutilizados
5. **Debugging**: Problemas mais fáceis de localizar e corrigir
6. **Performance**: Possibilidade de otimizar sistemas específicos isoladamente

### Métricas de Sucesso

- Nenhum arquivo com mais de 1000 linhas (ideal: <500 linhas)
- Cada classe/módulo com responsabilidade única e clara
- Cobertura de testes aumentada (sistemas isolados são mais testáveis)
- Redução de acoplamento entre módulos
- Melhoria na velocidade de desenvolvimento de novas features

---

## Ordem de Execução

1. ✅ Fase 1: Limpeza de documentações
2. ✅ Fase 2: Refatoração multiplayer-first
3. ⏳ Fase 3: Melhorar Firebase
4. ⏳ Fase 4: Modularização e Separação de Responsabilidades
5. ⏳ Atualizar memory bank
