# Sprint 1: PvP Básico - Plano de Execução

**Data**: Janeiro 2026  
**Status**: ✅ CONCLUÍDA  
**Duração Estimada**: 3-5 dias  
**Progresso**: 100% (4/4 fases concluídas)

---

## 📊 Resumo do Progresso

### ✅ Todas as Fases Concluídas

**Fase 1: Sistema de Combate PvP** ✅
- Projéteis de jogadores podem atingir outros jogadores
- Validações de zona segura implementadas
- Proteção de spawn (5 segundos) implementada
- Auto-dano bloqueado
- Integração completa com game loop

**Fase 2: Sistema de Drop de Itens** ✅
- Interface `ServerLootBag` criada
- Sistema de criação de loot bags ao morrer
- Broadcast de loot bags implementado
- Integração com Firebase para buscar time do jogador

**Fase 3: Sistema de Coleta de Loot** ✅
- `LootHandler` criado com validações completas
- `LootInteractMessage` adicionada
- Integrado no `MessageRouter`
- Lógica de transferência de itens implementada
- Criatura do time transferida para inventário permanente (Firebase)

**Fase 4: Renderização no Cliente** ✅
- Interfaces e handlers adicionados em `multiplayerClient.ts`
- Sprites visuais criados em `ExpeditionScene.ts`
- Interação com tecla E implementada
- Verificação de proximidade (raio 30px) implementada
- Animações visuais implementadas

---

## 📋 Contexto do Projeto

**PokéExtract: Wild Expedition** é um jogo multiplayer de extração em browser onde jogadores exploram mapas top-down, capturam criaturas, coletam recursos e enfrentam outros jogadores em combate de ação em tempo real.

### Arquitetura
- **Server-Authoritative**: Servidor valida e processa todas as ações
- **Multiplayer-First**: Sempre conecta ao servidor, sem modo offline
- **Game Loop**: 20 ticks/s no servidor
- **Comunicação**: WebSocket em tempo real

### Decisões de Design Confirmadas
1. ✅ **Zonas Seguras**: Pontos de extração são zonas seguras (sem PvP)
2. ✅ **Drop Completo**: Todos os itens da mochila + 1 criatura aleatória do time + criaturas capturadas na expedição
3. ✅ **Loot Coletável**: Qualquer jogador pode coletar loot bags
4. ✅ **Expiração**: Loot bags NÃO expiram - ficam até acabar a expedição ou alguém pegar
5. ✅ **Proteção de Spawn**: 5 segundos de invulnerabilidade após spawn
6. ✅ **Friendly Fire**: SIM - todas as partidas são FFA (Free For All) por enquanto

---

## 🎯 Objetivos da Sprint

Implementar o sistema completo de PvP com drop de itens, incluindo:
1. Sistema de combate PvP (projéteis de jogadores podem atingir outros jogadores)
2. Sistema de drop de itens ao morrer
3. Sistema de coleta de loot bags
4. Renderização visual de loot bags no cliente

---

## 📁 Arquivos de Referência

### Arquivos a Ler para Contexto
1. `server/src/systems/combat.ts` - Sistema de combate atual (projéteis, colisões)
2. `server/src/types/ServerTypes.ts` - Interfaces de PlayerPresence, Room, mensagens
3. `server/src/types.ts` - WorldState, ServerProjectile, ServerCreature
4. `server/src/handlers/JoinHandler.ts` - Como jogadores entram na sala
5. `server/src/managers/GameLoopManager.ts` - Game loop e handler de morte
6. `server/src/connection/MessageRouter.ts` - Roteamento de mensagens
7. `server/src/systems/extraction.ts` - Sistema de extração (para entender zonas seguras)
8. `src/services/multiplayerClient.ts` - Cliente WebSocket
9. `src/scenes/ExpeditionScene.ts` - Cena principal de expedição
10. `server/src/constants.ts` - Constantes do jogo

### Arquivos a Criar
1. `server/src/handlers/LootHandler.ts` - Handler de coleta de loot ✅ CRIADO
2. `server/src/systems/loot.ts` - Funções auxiliares de loot ✅ CRIADO

### Arquivos a Modificar
1. `server/src/systems/combat.ts` - Adicionar PvP, validações de zona segura e spawn protection ✅ MODIFICADO
2. `server/src/types/ServerTypes.ts` - Adicionar `joinedAt`, `roomId` ao PlayerPresence, nova mensagem `LootInteractMessage` ✅ MODIFICADO
3. `server/src/types.ts` - Adicionar `ServerLootBag` e `lootBags` ao WorldState ✅ MODIFICADO
4. `server/src/handlers/JoinHandler.ts` - Adicionar `joinedAt` e `roomId` ao criar player ✅ MODIFICADO
5. `server/src/managers/GameLoopManager.ts` - Criar loot bag ao jogador morrer ✅ MODIFICADO
6. `server/src/connection/MessageRouter.ts` - Adicionar handler de `loot_interact` ✅ MODIFICADO
7. `server/src/messages.ts` - Adicionar mensagens de loot bags ✅ NÃO NECESSÁRIO (usando broadcast direto)
8. `server/src/broadcast/StateBroadcaster.ts` - Adicionar broadcast de loot bags ✅ MODIFICADO
9. `src/services/multiplayerClient.ts` - Adicionar handlers e métodos de loot bags ✅ MODIFICADO
10. `src/scenes/ExpeditionScene.ts` - Renderização e interação com loot bags ✅ MODIFICADO
11. `server/src/gameLoop.ts` - Adicionar método setPvPInfo() e passar informações para updateProjectiles ✅ MODIFICADO
12. `server/src/room/RoomManager.ts` - Atualizar informações de PvP quando sala inicia ✅ MODIFICADO
13. `server/src/index.ts` - Adicionar joinedAt e roomId ao criar player ✅ MODIFICADO

---

## ✅ Tarefas Detalhadas

### Fase 1: Sistema de Combate PvP ✅ CONCLUÍDA

#### 1.1 Modificar Detecção de Colisão de Projéteis ✅
**Arquivo**: `server/src/systems/combat.ts`

**O que fazer**:
- Localizar função `updateProjectiles()` ou similar
- Adicionar lógica para projéteis de jogadores atingirem outros jogadores
- Validar que projétil não atinge o próprio dono (`proj.ownerId !== playerId`)
- Validar que alvo não está em zona segura
- Validar que alvo não está protegido por spawn (5 segundos)

**Código de referência** (do plano):
```typescript
// Em updateProjectiles(), adicionar lógica para projéteis de jogadores vs jogadores
if (proj.isPlayerProjectile) {
  // Verificar colisão com criaturas (lógica existente)
  // NOVO: Verificar colisão com outros jogadores
  for (const [targetPlayerId, targetPlayer] of room.players) {
    if (targetPlayerId === proj.ownerId) continue; // Não pode se atacar
    if (targetPlayer.isDead) continue;
    
    // Verificar se está em zona segura
    if (isPlayerInSafeZone(targetPlayer, room.worldState.extractionPoints)) {
      continue; // Não pode atacar em zona segura
    }
    
    // Verificar invulnerabilidade de spawn
    if (isPlayerSpawnProtected(targetPlayer, room.startedAt)) {
      continue; // Protegido por 5 segundos após spawn
    }
    
    if (checkProjectilePlayerCollision(proj, targetPlayer)) {
      const damageResult = applyDamageToPlayer(
        targetPlayerId,
        targetPlayer,
        proj.damage,
        proj.ownerId
      );
      damageResults.push(damageResult);
      hit = true;
      break;
    }
  }
}
```

#### 1.2 Criar Funções Auxiliares de Validação ✅
**Arquivo**: `server/src/systems/combat.ts`

**Funções a criar**:
- `isPlayerInSafeZone()` - Verifica se jogador está em ponto de extração (raio 50px)
- `isPlayerSpawnProtected()` - Verifica se jogador está protegido (5 segundos após join)
- `checkProjectilePlayerCollision()` - Verifica colisão projétil vs jogador
- `applyDamageToPlayer()` - Aplica dano a jogador (pode já existir, verificar)

**Código de referência** (do plano):
```typescript
/**
 * Verifica se jogador está em zona segura (ponto de extração).
 */
function isPlayerInSafeZone(
  player: CombatPlayer,
  extractionPoints: ServerExtractionPoint[]
): boolean {
  const SAFE_ZONE_RADIUS = 50; // pixels
  
  for (const point of extractionPoints) {
    if (point.status !== "open") continue;
    
    const dx = player.x - point.x;
    const dy = player.y - point.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance <= SAFE_ZONE_RADIUS) {
      return true;
    }
  }
  
  return false;
}

/**
 * Verifica se jogador está protegido por invulnerabilidade de spawn.
 */
function isPlayerSpawnProtected(
  player: PlayerPresence,
  roomStartTime: number
): boolean {
  const SPAWN_PROTECTION_SECONDS = 5;
  
  // Usar player.joinedAt se disponível, senão usar roomStartTime
  const joinTime = player.joinedAt || roomStartTime;
  const timeSinceJoin = (Date.now() - joinTime) / 1000;
  
  return timeSinceJoin < SPAWN_PROTECTION_SECONDS;
}
```

#### 1.3 Adicionar Timestamp de Join ao PlayerPresence ✅
**Arquivo**: `server/src/types/ServerTypes.ts`

**Mudança**:
```typescript
export interface PlayerPresence {
  // ... campos existentes
  /** Timestamp quando jogador entrou na sala (para proteção de spawn) */
  joinedAt: number;
  /** ID da sala onde o jogador está */
  roomId: string;
}
```

**Arquivo**: `server/src/handlers/JoinHandler.ts`

**Mudança**: Adicionar `joinedAt: Date.now()` e `roomId: room.id` ao criar `newPlayer`.

---

### Fase 2: Sistema de Drop de Itens ✅ CONCLUÍDA

#### 2.1 Criar Interface de Loot Bag ✅
**Arquivo**: `server/src/types.ts`

**Nova Interface**:
```typescript
/**
 * Loot bag deixado no chão quando jogador morre.
 */
export interface ServerLootBag {
  id: string;
  x: number;
  y: number;
  /** Recursos coletados durante a expedição */
  resources: Map<string, number>;
  /** Pokébolas não usadas do inventário de expedição */
  pokeballs: Map<string, number>;
  /** Criaturas capturadas durante a expedição */
  capturedCreatures: Array<{
    instanceId: string;
    speciesId: string;
    level: number;
    tier: string;
    currentHp: number;
    maxHp: number;
  }>;
  /** 1 criatura aleatória do time do jogador morto */
  teamCreature?: {
    instanceId: string;
    speciesId: string;
    level: number;
    rank?: number;
    currentHp: number;
    maxHp: number;
  };
  /** Timestamp de criação */
  createdAt: number;
  /** ID do jogador que morreu */
  ownerId: string;
  /** ID do jogador que matou (opcional - pode ser criatura) */
  killerId?: string;
  /** ID da sala onde está o loot */
  roomId: string;
}
```

#### 2.2 Adicionar Loot Bags ao WorldState ✅
**Arquivo**: `server/src/types.ts`

**Mudança em `WorldState`**:
```typescript
export interface WorldState {
  // ... campos existentes
  lootBags: Map<string, ServerLootBag>;
}
```

**Mudança em `createEmptyWorldState()`**:
```typescript
export function createEmptyWorldState(): WorldState {
  return {
    creatures: [],
    resources: [],
    projectiles: [],
    skillZones: [],
    extractionPoints: [],
    lootBags: new Map() // NOVO
  };
}
```

#### 2.3 Criar Função de Criação de Loot Bag ✅
**Arquivo**: `server/src/systems/loot.ts` (criado novo arquivo)

**Nova Função**:
```typescript
/**
 * Cria loot bag quando jogador morre.
 * 
 * Dropa:
 * - Todos os recursos coletados
 * - Todas as pokébolas não usadas
 * - Todas as criaturas capturadas na expedição
 * - 1 criatura aleatória do time do jogador
 */
export function createLootBagOnDeath(
  player: PlayerPresence,
  killerId?: string
): ServerLootBag {
  const lootBagId = `loot-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  
  // Selecionar 1 criatura aleatória do time
  let teamCreature: ServerLootBag['teamCreature'] | undefined;
  if (player.activeTeam && player.activeTeam.length > 0) {
    const randomIndex = Math.floor(Math.random() * player.activeTeam.length);
    const selectedCreature = player.activeTeam[randomIndex];
    
    teamCreature = {
      instanceId: selectedCreature.instanceId,
      speciesId: selectedCreature.definitionId,
      level: selectedCreature.level,
      rank: selectedCreature.rank,
      currentHp: selectedCreature.currentHp,
      maxHp: selectedCreature.maxHp
    };
  }
  
  return {
    id: lootBagId,
    x: player.x,
    y: player.y,
    resources: new Map(player.resourcesCollected || new Map()),
    pokeballs: new Map(player.expeditionInventory?.pokeballs || new Map()),
    capturedCreatures: [...(player.expeditionInventory?.capturedCreatures || [])],
    teamCreature,
    createdAt: Date.now(),
    ownerId: player.id,
    killerId,
    roomId: player.roomId
  };
}
```

**Nota**: Verificar estrutura de `player.activeTeam` e `player.expeditionInventory` no código existente para ajustar conforme necessário.

#### 2.4 Modificar Handler de Morte ✅
**Arquivo**: `server/src/managers/GameLoopManager.ts`

**Mudança em `handlePlayerDeath()`**:
```typescript
async function handlePlayerDeath(
  room: Room,
  playerId: string,
  killerId?: string
): Promise<void> {
  const player = room.players.get(playerId);
  if (!player || !player.userId) {
    return;
  }

  // Criar loot bag na posição de morte
  const lootBag = createLootBagOnDeath(player, killerId);
  room.worldState.lootBags.set(lootBag.id, lootBag);
  
  // Broadcast de novo loot bag
  broadcastLootBagsUpdate(room);
  
  // ... resto da lógica existente (salvar itens gastos no Firebase, etc)
}
```

---

### Fase 3: Sistema de Coleta de Loot ✅ CONCLUÍDA

#### 3.1 Adicionar Nova Mensagem de Intent ✅
**Arquivo**: `server/src/types/ServerTypes.ts`

**Nova Interface**:
```typescript
export interface LootInteractMessage extends BaseMessage {
  type: "loot_interact";
  lootBagId: string;
}

export type IncomingMessage =
  | JoinMessage
  | MoveMessage
  | PingMessage
  | AttackMessage
  | SkillMessage
  | CaptureMessage
  | ResourceInteractMessage
  | ExtractionMessage
  | TeamSyncMessage
  | ActiveCreatureUpdateMessage
  | LootInteractMessage; // NOVO
```

#### 3.2 Criar Handler de Coleta de Loot ✅
**Arquivo**: `server/src/handlers/LootHandler.ts` ✅ CRIADO

**Código completo** (ver plano completo para detalhes):
- Validar jogador existe e não está morto
- Validar loot bag existe
- Validar distância (raio 30px)
- Transferir recursos, pokébolas e criaturas
- Remover loot bag do mundo
- Broadcast de atualização
- Enviar confirmação ao jogador

#### 3.3 Integrar Handler no MessageRouter ✅
**Arquivo**: `server/src/connection/MessageRouter.ts`

**Mudança**: Adicionar case para `loot_interact`:
```typescript
case "loot_interact":
  const lootResult = LootHandler.handle(currentRoom, clientId, msg as LootInteractMessage);
  if (!lootResult.success) {
    ws.send(JSON.stringify({ type: "error", reason: lootResult.error }));
  }
  break;
```

#### 3.4 Adicionar Broadcast de Loot Bags ✅
**Arquivo**: `server/src/broadcast/StateBroadcaster.ts`

**Nova Função**:
```typescript
/**
 * Broadcast de atualização de loot bags.
 */
export function broadcastLootBagsUpdate(room: Room): void {
  const lootBags = Array.from(room.worldState.lootBags.values()).map(bag => ({
    id: bag.id,
    x: bag.x,
    y: bag.y,
    resources: Object.fromEntries(bag.resources),
    pokeballs: Object.fromEntries(bag.pokeballs),
    capturedCreatures: bag.capturedCreatures.length,
    hasTeamCreature: !!bag.teamCreature,
    createdAt: bag.createdAt
  }));

  const message = {
    type: "lootBagsUpdate",
    lootBags
  };

  for (const [clientId, ws] of room.clients.entries()) {
    ws.send(JSON.stringify(message));
  }
}
```

---

### Fase 4: Renderização no Cliente ✅ CONCLUÍDA

#### 4.1 Adicionar Interfaces no Cliente ✅
**Arquivo**: `src/services/multiplayerClient.ts`

**Nova Interface**:
```typescript
export interface RemoteLootBag {
  id: string;
  x: number;
  y: number;
  resources: Record<string, number>;
  pokeballs: Record<string, number>;
  capturedCreatures: number;
  hasTeamCreature: boolean;
  createdAt: number;
}

export interface LootBagsUpdateMessage extends BaseMessage {
  type: "lootBagsUpdate";
  lootBags: RemoteLootBag[];
}
```

**Adicionar callback**:
```typescript
onLootBagsUpdate?: (lootBags: RemoteLootBag[]) => void;
```

**Adicionar handler**:
```typescript
private handleLootBagsUpdate(msg: LootBagsUpdateMessage): void {
  if (this.onLootBagsUpdate) {
    this.onLootBagsUpdate(msg.lootBags);
  }
}
```

**Registrar handler no switch de mensagens**.

#### 4.2 Adicionar Método de Envio ✅
**Arquivo**: `src/services/multiplayerClient.ts`

**Novo Método**:
```typescript
sendLootInteract(lootBagId: string): void {
  this.send({
    type: "loot_interact",
    lootBagId
  });
}
```

#### 4.3 Renderização de Loot Bags ✅
**Arquivo**: `src/scenes/ExpeditionScene.ts`

**Novos Campos**:
```typescript
private lootBagSprites: Map<string, Phaser.GameObjects.Container> = new Map();
```

**Métodos a criar**:
- `createLootBagSprite()` - Cria sprite visual de loot bag
- `destroyLootBagSprite()` - Remove sprite
- `handleLootBagsUpdate()` - Atualiza sprites baseado em updates do servidor

**Integração**:
- Registrar callback `onLootBagsUpdate` no `create()`
- Chamar `handleLootBagsUpdate()` quando receber update

#### 4.4 Interação com Loot Bag ✅
**Arquivo**: `src/scenes/ExpeditionScene.ts`

**Mudança em `update()` ou método de interação**:
- Verificar distância do jogador até loot bags
- Mostrar prompt visual quando próximo (raio 30px)
- Coletar com tecla E (ou botão)
- Chamar `this.mpClient?.sendLootInteract(lootBagId)`

---

## 🚀 Prompt de Execução

```
Continuar implementação do Sprint 1: PvP Básico.

STATUS ATUAL:
✅ FASE 1: Sistema de Combate PvP - CONCLUÍDA
✅ FASE 2: Sistema de Drop de Itens - CONCLUÍDA
⏳ FASE 3: Sistema de Coleta de Loot - PENDENTE
⏳ FASE 4: Renderização no Cliente - PENDENTE

CONTEXTO:
- Jogo multiplayer server-authoritative com WebSocket
- Game loop a 20 ticks/s
- Sistema de combate já existe (projéteis vs criaturas)
- Sistema de extração já existe (zonas seguras)
- PvP já implementado (projéteis de jogadores atingem outros jogadores)
- Sistema de drop já implementado (loot bags são criados ao morrer)

TAREFAS RESTANTES:

3. FASE 3: Sistema de Coleta de Loot
   - Criar LootInteractMessage em server/src/types/ServerTypes.ts
   - Criar server/src/handlers/LootHandler.ts com lógica de coleta:
     * Validar jogador existe e não está morto
     * Validar loot bag existe
     * Validar distância (raio 30px)
     * Transferir recursos, pokébolas e criaturas para o jogador
     * Remover loot bag do mundo
     * Broadcast de atualização
     * Enviar confirmação ao jogador
   - Integrar LootHandler no MessageRouter (case "loot_interact")
   - Adicionar mensagens de loot bags em server/src/messages.ts (se necessário)

4. FASE 4: Renderização no Cliente
   - Adicionar interfaces RemoteLootBag e LootBagsUpdateMessage em multiplayerClient.ts
   - Adicionar callback onLootBagsUpdate em multiplayerClient.ts
   - Adicionar handler handleLootBagsUpdate() em multiplayerClient.ts
   - Registrar handler no switch de mensagens
   - Adicionar método sendLootInteract() em multiplayerClient.ts
   - Criar sprites de loot bags em ExpeditionScene.ts
   - Implementar interação (tecla E quando próximo, raio 30px)

VALIDAÇÕES IMPORTANTES:
✅ Projéteis não podem atingir o próprio dono - IMPLEMENTADO
✅ Jogadores em zona segura não podem ser atacados - IMPLEMENTADO
✅ Jogadores têm 5 segundos de proteção após spawn - IMPLEMENTADO
✅ Loot bags são criados ao morrer - IMPLEMENTADO
⏳ Loot bags ficam no chão até serem coletadas ou expedição terminar - PENDENTE
⏳ Qualquer jogador pode coletar qualquer loot bag - PENDENTE

REFERÊNCIAS:
- server/src/systems/loot.ts - Função createLootBagOnDeath() já implementada
- server/src/systems/combat.ts - Sistema de PvP já implementado
- server/src/handlers/ExtractionHandler.ts - Exemplo de handler similar
- server/src/handlers/JoinHandler.ts - Exemplo de handler similar
- Seguir padrões existentes de handlers e broadcasts

Ao finalizar, testar:
✅ Projéteis de jogadores atingem outros jogadores - TESTAR
✅ Jogadores em zona segura não recebem dano - TESTAR
✅ Proteção de spawn funciona (5 segundos) - TESTAR
✅ Loot bag é criado ao morrer - TESTAR
⏳ Loot bag é coletável por qualquer jogador - TESTAR APÓS IMPLEMENTAÇÃO
⏳ Visual de loot bag aparece no cliente - TESTAR APÓS IMPLEMENTAÇÃO
```

---

## ✅ Checklist de Validação

### Fase 1: Sistema de Combate PvP
- [x] Projéteis de jogadores atingem outros jogadores ✅ IMPLEMENTADO
- [x] Auto-dano está bloqueado ✅ IMPLEMENTADO (validação proj.ownerId !== targetPlayerId)
- [x] Zonas seguras protegem jogadores ✅ IMPLEMENTADO (isPlayerInSafeZone)
- [x] Proteção de spawn funciona (5 segundos) ✅ IMPLEMENTADO (isPlayerSpawnProtected)
- [x] joinedAt e roomId adicionados ao PlayerPresence ✅ IMPLEMENTADO
- [x] Funções auxiliares criadas (isPlayerInSafeZone, isPlayerSpawnProtected) ✅ IMPLEMENTADO

### Fase 2: Sistema de Drop de Itens
- [x] Interface ServerLootBag criada ✅ IMPLEMENTADO
- [x] lootBags adicionado ao WorldState ✅ IMPLEMENTADO
- [x] Loot bag é criado ao morrer com todos os itens ✅ IMPLEMENTADO
- [x] Loot bag inclui recursos coletados ✅ IMPLEMENTADO
- [x] Loot bag inclui pokébolas não usadas ✅ IMPLEMENTADO
- [x] Loot bag inclui criaturas capturadas ✅ IMPLEMENTADO
- [x] Loot bag inclui 1 criatura aleatória do time (se disponível no Firebase) ✅ IMPLEMENTADO
- [x] Broadcast de loot bags funciona ✅ IMPLEMENTADO (broadcastLootBagsUpdate)

### Fase 3: Sistema de Coleta de Loot
- [x] LootInteractMessage criada ✅ IMPLEMENTADO
- [x] LootHandler criado com validações ✅ IMPLEMENTADO
- [x] Handler integrado no MessageRouter ✅ IMPLEMENTADO
- [x] Coleta de loot funciona (raio 30px) ✅ IMPLEMENTADO
- [x] Recursos são transferidos corretamente ✅ IMPLEMENTADO
- [x] Pokébolas são transferidas corretamente ✅ IMPLEMENTADO
- [x] Criaturas são transferidas corretamente ✅ IMPLEMENTADO
- [x] Criatura do time é transferida para inventário permanente ✅ IMPLEMENTADO
- [x] Loot bag é removido após coleta ✅ IMPLEMENTADO

### Fase 4: Renderização no Cliente
- [x] Interfaces adicionadas em multiplayerClient.ts ✅ IMPLEMENTADO
- [x] Handler de lootBagsUpdate implementado ✅ IMPLEMENTADO
- [x] Handler de lootCollected implementado ✅ IMPLEMENTADO
- [x] Método sendLootInteract implementado ✅ IMPLEMENTADO
- [x] Visual de loot bag aparece no cliente ✅ IMPLEMENTADO
- [x] Interação com tecla E funciona ✅ IMPLEMENTADO
- [x] Sprites de loot bags são criados/destruídos corretamente ✅ IMPLEMENTADO
- [x] Verificação de proximidade implementada ✅ IMPLEMENTADO
- [x] Animação de pulsação nos sprites ✅ IMPLEMENTADO

---

## 📝 Notas de Implementação

### ✅ Implementado

**Fase 1 - Sistema de Combate PvP:**
- Função `updateProjectiles()` modificada para permitir PvP
- Projéteis de jogadores agora verificam colisão com outros jogadores após verificar criaturas
- Funções `isPlayerInSafeZone()` e `isPlayerSpawnProtected()` criadas em `combat.ts`
- `joinedAt` e `roomId` adicionados ao `PlayerPresence` em `ServerTypes.ts`
- `JoinHandler` atualizado para definir `joinedAt` e `roomId` ao criar player
- `gameLoop.ts` modificado para armazenar e passar informações de PvP (extractionPoints, roomStartTime)
- `GameLoopManager` atualizado para definir informações de PvP ao criar game loop
- `RoomManager` atualizado para atualizar informações de PvP quando sala inicia
- `registerPlayer()` modificado para aceitar `joinedAt` opcional

**Fase 2 - Sistema de Drop de Itens:**
- Interface `ServerLootBag` criada em `types.ts` com todos os campos necessários
- `WorldState` atualizado para incluir `lootBags: Map<string, ServerLootBag>`
- `createEmptyWorldState()` atualizado para inicializar `lootBags` como novo Map
- Arquivo `server/src/systems/loot.ts` criado com função `createLootBagOnDeath()`
- Função `createLootBagOnDeath()` busca time do jogador do Firebase quando disponível
- `handlePlayerDeath()` em `GameLoopManager.ts` modificado para criar loot bag
- Função `broadcastLootBagsUpdate()` adicionada ao `StateBroadcaster`
- Broadcast é enviado automaticamente quando loot bag é criado

**Estrutura de Dados:**
- `expeditionInventory` tem estrutura: `{ pokeballs?: Map<string, number>, capturedCreatures: Array<...> }`
- `activeTeam` não está diretamente no `PlayerPresence`, é buscado do Firebase quando necessário
- `createLootBagOnDeath()` busca time do Firebase usando `getUser()` se `userId` disponível

**Fase 3 - Sistema de Coleta:**
- `LootHandler.handleLootInteract()` valida todas as condições antes de coletar
- Transferência de recursos atualiza `player.resourcesCollected`
- Transferência de pokébolas atualiza `player.expeditionInventory.pokeballs`
- Transferência de criaturas atualiza `player.expeditionInventory.capturedCreatures` e `player.creaturesCaptured`
- Criatura do time é salva diretamente no Firebase no inventário permanente do jogador
- Loot bag é removido do `worldState.lootBags` após coleta
- Broadcast de atualização é enviado automaticamente

**Fase 4 - Renderização:**
- Sprites de loot bags usam `Phaser.GameObjects.Container` para agrupar elementos
- Visual: retângulo roxo (0x8b5cf6) com borda roxa escura, círculo dourado pulsante, texto com contador
- Animação de pulsação contínua no círculo de brilho
- Verificação de proximidade a cada frame no `update()`
- Tecla E funciona para coletar quando próximo (prioridade sobre extração se não estiver em zona de extração)

### ⏳ Pendente

**Fase 3 - Sistema de Coleta de Loot:**
- Criar `LootInteractMessage` em `ServerTypes.ts`
- Criar `LootHandler.ts` com lógica completa de coleta
- Integrar handler no `MessageRouter`
- Adicionar mensagens de confirmação/erro

**Fase 3 - Sistema de Coleta de Loot:**
- `LootInteractMessage` criada em `ServerTypes.ts`
- `LootHandler.ts` criado com lógica completa de coleta
- Handler integrado no `MessageRouter` (case "loot_interact")
- Validações: jogador existe, não está morto, loot bag existe, distância (30px)
- Transferência de recursos, pokébolas e criaturas implementada
- Criatura do time transferida para inventário permanente via Firebase
- Loot bag removido após coleta bem-sucedida
- Confirmação enviada ao jogador

**Fase 4 - Renderização no Cliente:**
- Interfaces `RemoteLootBag`, `LootBagsUpdateMessage` e `LootCollected` adicionadas em `multiplayerClient.ts`
- Handlers `lootBagsUpdate` e `lootCollected` implementados
- Método `sendLootInteract()` adicionado
- Sprites visuais de loot bags criados em `ExpeditionScene.ts` (container com retângulo roxo, brilho dourado, contador de itens)
- Animação de pulsação implementada
- Verificação de proximidade (raio 30px) implementada
- Interação com tecla E implementada (quando próximo e não extraindo)
- Métodos `createLootBagSprite()`, `updateLootBagSprite()`, `destroyLootBagSprite()` criados
- Métodos `checkNearbyLootBags()` e `tryCollectLootBag()` criados

### 🔍 Observações Técnicas

- `createLootBagOnDeath()` é assíncrona porque busca time do Firebase
- Loot bags usam `Map` para recursos e pokébolas (serializados para JSON no broadcast)
- Proteção de spawn usa `joinedAt` do player ou `roomStartTime` como fallback
- Zona segura verifica raio de 50px dos pontos de extração ativos
- `broadcastLootBagsUpdate()` envia apenas dados resumidos (não detalhes completos das criaturas)

### 🧪 Testes Necessários

- Verificar que projéteis não causam auto-dano
- Testar proteção de spawn (5 segundos após join)
- Testar que jogadores em zona segura não recebem dano
- Verificar criação de loot bag com diferentes cenários (com/sem itens, com/sem time)
- Testar edge cases (jogador morre sem itens, loot bag em posição inválida, etc)
