# Arquitetura do Sistema - PokéExtract: Wild Expedition

**Última Atualização**: Janeiro 2026  
**Arquitetura**: Multiplayer-First, Server-Authoritative

---

## Visão Geral

PokéExtract é um jogo multiplayer de extração em tempo real com arquitetura **multiplayer-first** e **server-authoritative**. O servidor é sempre a fonte de verdade para o estado do mundo, e o cliente apenas renderiza e envia intents.

### Princípios Fundamentais

1. **Server-Authoritative**: Servidor valida e processa todas as ações
2. **Multiplayer-First**: Sempre conecta ao servidor, sem modo offline
3. **Fonte Única de Verdade**: Servidor inicializa e gerencia todo o estado do mundo
4. **Cliente Leve**: Cliente apenas renderiza e envia intents, não processa lógica de jogo

---

## Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE (Browser)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              ExpeditionScene (Phaser)                  │  │
│  │  • Renderização visual                                 │  │
│  │  • Input handling (WASD, ações)                        │  │
│  │  • Interpolação de movimento                           │  │
│  │  • Feedback visual                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          │ WebSocket                         │
│                          │ (Intents + Updates)               │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │
┌─────────────────────────────────────────────────────────────┐
│                    SERVIDOR (Node.js)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Game Loop (20 ticks/s)                    │  │
│  │  • Processa intents                                    │  │
│  │  • Atualiza IA de criaturas                            │  │
│  │  • Calcula combate/captura/extração                    │  │
│  │  • Valida todas as ações                               │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          │ Firebase Admin SDK                │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Firebase (Firestore)                      │  │
│  │  • Persistência de dados                               │  │
│  │  • Histórico de expedições                             │  │
│  │  • Dados de jogadores                                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Componentes Principais

### Cliente (`src/`)

#### `ExpeditionScene.ts`
- **Responsabilidade**: Renderização e input
- **Não faz**: Spawn de entidades, processamento de IA, validação de ações
- **Faz**: 
  - Renderiza entidades recebidas do servidor
  - Envia intents (ataque, captura, extração, movimento)
  - Interpola movimento suave
  - Feedback visual imediato (predição local)

#### `MultiplayerClient.ts`
- **Responsabilidade**: Comunicação WebSocket
- **Funcionalidades**:
  - Conexão/reconexão automática
  - Envio de intents
  - Recebimento de updates
  - Handlers de eventos

#### `worldState.ts`
- **Responsabilidade**: Estado local sincronizado
- **Tipo**: `RemoteWorldState` (sempre)
- **Dados**: Criaturas, recursos, jogadores, pontos de extração
- **Sincronização**: Via callbacks do `MultiplayerClient`

### Servidor (`server/src/`)

#### `index.ts`
- **Responsabilidade**: Servidor WebSocket e gerenciamento de salas
- **Funcionalidades**:
  - Criação de salas por mapa
  - Gerenciamento de conexões
  - Roteamento de mensagens
  - Integração com Firebase

#### `gameLoop.ts`
- **Responsabilidade**: Loop principal de jogo (20 ticks/s)
- **Funcionalidades**:
  - Processa intents da fila
  - Atualiza estado do mundo
  - Broadcast de updates
  - Gerenciamento de timer de partida

#### `systems/`
- **`combat.ts`**: Sistema de combate server-side
- **`capture.ts`**: Sistema de captura server-side
- **`extraction.ts`**: Sistema de extração server-side
- **`spawns.ts`**: Geração inicial de mundo
- **`skills.ts`**: Sistema de habilidades

---

## Fluxo de Comunicação

### 1. Inicialização

```
Cliente                          Servidor
   │                                │
   ├─ Conecta WebSocket ───────────>│
   │                                ├─ Cria/entra em sala
   │                                ├─ Inicializa mundo
   │                                │  (spawns, recursos, criaturas)
   │                                │
   │<─ state (snapshot completo) ───┤
   │   • players                    │
   │   • world (creatures, resources)│
   │   • match (timer)              │
   │                                │
   ├─ Envia dados do time ─────────>│
   │   (team_sync)                  │
```

### 2. Durante Jogo

```
Cliente                          Servidor
   │                                │
   ├─ move (posição) ──────────────>│
   │                                ├─ Valida posição
   │                                ├─ Atualiza estado
   │                                │
   ├─ attack (targetX, targetY) ───>│
   │                                ├─ Valida cooldown
   │                                ├─ Cria projétil
   │                                ├─ Calcula dano
   │<─ attackResult ────────────────┤
   │   • damage                     │
   │   • targetHp                   │
   │                                │
   ├─ capture (creatureId, ballType)>│
   │                                ├─ Calcula chance
   │                                ├─ Valida sucesso
   │<─ captureResult ────────────────┤
   │   • success                    │
   │   • creature                   │
   │                                │
   ├─ extraction (pointId, action) ─>│
   │                                ├─ Valida progresso
   │                                ├─ Calcula recompensas
   │<─ extractionState ─────────────┤
   │   • progress                   │
   │   • rewards                    │
```

### 3. Updates Periódicos

```
Servidor                          Cliente
   │                                │
   ├─ creaturesUpdate (10Hz) ───────>│
   │   • Posições                   │
   │   • HP                         │
   │   • Estados de IA              │
   │                                │
   ├─ resourcesUpdate (10Hz) ───────>│
   │   • Posições                   │
   │   • Quantidades                │
   │                                │
   ├─ projectilesUpdate (20Hz) ─────>│
   │   • Posições                   │
   │   • Velocidades                │
   │                                │
   ├─ skillZonesUpdate (20Hz) ──────>│
   │   • Posições                   │
   │   • Timers                     │
```

---

## Estado do Mundo

### Inicialização pelo Servidor

O servidor **sempre** inicializa o mundo completo:

1. **Criação de Sala**:
   - Gera seed aleatória
   - Cria mapa baseado no `mapId`
   - Spawna criaturas (baseado em densidade do mapa)
   - Spawna recursos (baseado em bioma)
   - Cria pontos de extração

2. **Envio Inicial**:
   - Envia snapshot completo via `state` message
   - Inclui: `world.creatures`, `world.resources`, `world.extractionPoints`
   - Cliente renderiza tudo imediatamente

### Sincronização Contínua

- **Criaturas**: Updates a cada 10 ticks (~500ms)
- **Recursos**: Updates a cada 10 ticks (~500ms)
- **Jogadores**: Updates a cada tick (20Hz)
- **Projéteis**: Updates a cada tick (20Hz)
- **Skill Zones**: Updates a cada tick (20Hz)

---

## Interpolação e Predição

### Interpolação de Movimento

O cliente interpola suavemente entre snapshots do servidor:

- **Velocidade**: 8px/s para criaturas e jogadores, 4px/s para recursos
- **Snap**: Quando distância < 0.5px, teleporta para posição alvo
- **Objetivo**: Movimento suave mesmo com updates em intervalos fixos

### Predição Local

O cliente faz predição visual imediata para melhor responsividade:

- **Ataque**: Efeito visual imediato, sincroniza HP real depois
- **Captura**: Feedback visual imediato, confirma sucesso depois
- **Extração**: Barra de progresso local, sincroniza com servidor

**Importante**: Predição é apenas visual. Estado real sempre vem do servidor.

---

## Segurança e Anti-Cheat

### Validações Server-Side

1. **Movimento**:
   - Valida velocidade máxima
   - Valida posição dentro dos bounds
   - Previne teleportação

2. **Combate**:
   - Valida cooldown de ataque
   - Calcula dano no servidor
   - Valida colisões

3. **Captura**:
   - Calcula chance no servidor
   - Valida distância
   - Consome pokébola apenas se sucesso

4. **Extração**:
   - Valida posição na zona
   - Calcula recompensas no servidor
   - Persiste apenas após validação

### Firebase Integration

- **Escritas**: Apenas servidor (Firebase Admin SDK)
- **Leituras**: Cliente pode ler apenas seus próprios dados
- **Validação**: Todas as recompensas validadas antes de persistir

---

## Performance

### Otimizações do Cliente

- **Distance Culling**: Jogadores remotos não renderizados além de 800px
- **Interpolação**: Movimento suave sem overhead de rede
- **Depth Layers**: Renderização ordenada eficiente

### Otimizações do Servidor

- **Tick Rate**: 20 ticks/s (balance entre responsividade e carga)
- **Broadcast Rate**: 10Hz para entidades estáticas, 20Hz para dinâmicas
- **Batch Updates**: Múltiplas entidades em uma mensagem

---

## Tecnologias

### Cliente
- **Phaser 3**: Engine de jogo 2D
- **TypeScript**: Tipagem estática
- **Vite**: Build tool e dev server
- **Firebase Client SDK**: Autenticação e sync

### Servidor
- **Node.js + TypeScript**: Runtime e tipagem
- **WebSocket (ws)**: Comunicação em tempo real
- **Firebase Admin SDK**: Persistência e autenticação
- **Express**: HTTP server (para APIs futuras)

### Persistência
- **Firebase Firestore**: Banco de dados NoSQL
- **localStorage**: Fallback offline (apenas leitura)

---

**Nota**: Esta arquitetura reflete o estado atual após a refatoração multiplayer-first (Janeiro 2026). Todas as referências a "modo single-player" ou "modo offline" foram removidas.
