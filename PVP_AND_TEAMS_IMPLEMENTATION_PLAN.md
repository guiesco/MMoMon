# Plano de Implementação: PvP + Sistema de Times

**Data**: Janeiro 2026  
**Status**: Planejamento Completo  
**Decisões Confirmadas**: ✅

---

## 📋 Decisões de Design Confirmadas

1. ✅ **Zonas Seguras**: Pontos de extração são zonas seguras (sem PvP)
2. ✅ **Drop Completo**: Todos os itens da mochila + 1 criatura aleatória do time + criaturas capturadas na expedição
3. ✅ **Loot Coletável**: Qualquer jogador pode coletar loot bags
4. ✅ **Expiração**: Loot bags NÃO expiram - ficam até acabar a expedição ou alguém pegar
5. ✅ **Proteção de Spawn**: 5 segundos de invulnerabilidade após spawn
6. ✅ **Friendly Fire**: SIM - todas as partidas são FFA (Free For All) por enquanto

---

## PARTE 1: SISTEMA DE PvP COM DROP DE ITENS

### Fase 1: Sistema de Combate PvP

#### 1.1 Modificar Detecção de Colisão de Projéteis
**Arquivo**: `server/src/systems/combat.ts`

**Mudanças**:
- Modificar `updateProjectiles()` para permitir projéteis de jogadores atingirem outros jogadores
- Adicionar validação para evitar auto-dano (`proj.ownerId !== playerId`)
- Adicionar validação de zona segura antes de aplicar dano PvP
- Adicionar validação de invulnerabilidade de spawn (5 segundos)

**Código**:
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

#### 1.2 Funções Auxiliares de Validação
**Arquivo**: `server/src/systems/combat.ts`

**Novas Funções**:
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
  player: CombatPlayer,
  roomStartTime: number
): boolean {
  const SPAWN_PROTECTION_SECONDS = 5;
  const timeSinceStart = (Date.now() - roomStartTime) / 1000;
  
  // Assumindo que jogador entrou no início (precisamos rastrear quando entrou)
  // TODO: Adicionar player.joinedAt timestamp
  return timeSinceStart < SPAWN_PROTECTION_SECONDS;
}
```

#### 1.3 Adicionar Timestamp de Join ao PlayerPresence
**Arquivo**: `server/src/types/ServerTypes.ts`

**Mudança**:
```typescript
export interface PlayerPresence {
  // ... campos existentes
  /** Timestamp quando jogador entrou na sala (para proteção de spawn) */
  joinedAt: number;
}
```

**Arquivo**: `server/src/handlers/JoinHandler.ts`

**Mudança**: Adicionar `joinedAt: Date.now()` ao criar `newPlayer`.

---

### Fase 2: Sistema de Drop de Itens

#### 2.1 Estrutura de Loot Bag
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

#### 2.2 Adicionar Loot Bags ao WorldState
**Arquivo**: `server/src/types.ts`

**Mudança em `WorldState`**:
```typescript
export interface WorldState {
  // ... campos existentes
  lootBags: Map<string, ServerLootBag>;
}
```

**Arquivo**: `server/src/types.ts` (função `createEmptyWorldState`)

**Mudança**:
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

#### 2.3 Função de Criação de Loot Bag
**Arquivo**: `server/src/systems/combat.ts` (ou novo arquivo `server/src/systems/loot.ts`)

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
    roomId: player.roomId // Precisamos adicionar roomId ao PlayerPresence
  };
}
```

#### 2.4 Modificar Handler de Morte
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

#### 2.5 Adicionar roomId ao PlayerPresence
**Arquivo**: `server/src/types/ServerTypes.ts`

**Mudança**:
```typescript
export interface PlayerPresence {
  // ... campos existentes
  /** ID da sala onde o jogador está */
  roomId: string;
}
```

**Arquivo**: `server/src/handlers/JoinHandler.ts`

**Mudança**: Adicionar `roomId: room.id` ao criar `newPlayer`.

---

### Fase 3: Sistema de Coleta de Loot

#### 3.1 Nova Mensagem de Intent
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
}
```

#### 3.2 Handler de Coleta de Loot
**Arquivo**: `server/src/handlers/LootHandler.ts` (NOVO)

**Código**:
```typescript
import type { Room, LootInteractMessage, PlayerPresence } from "../types/ServerTypes";
import type { ServerLootBag } from "../types";

/**
 * Handler para coleta de loot bags.
 */
export class LootHandler {
  /**
   * Processa intent de coleta de loot.
   */
  static handle(
    room: Room,
    playerId: string,
    msg: LootInteractMessage
  ): { success: boolean; error?: string } {
    const player = room.players.get(playerId);
    if (!player) {
      return { success: false, error: "player_not_found" };
    }

    if (player.isDead) {
      return { success: false, error: "player_dead" };
    }

    const lootBag = room.worldState.lootBags.get(msg.lootBagId);
    if (!lootBag) {
      return { success: false, error: "loot_not_found" };
    }

    // Verificar distância (raio de 30px)
    const LOOT_COLLECT_RADIUS = 30;
    const dx = player.x - lootBag.x;
    const dy = player.y - lootBag.y;
    const distance = Math.hypot(dx, dy);

    if (distance > LOOT_COLLECT_RADIUS) {
      return { success: false, error: "too_far" };
    }

    // Transferir recursos para inventário do jogador
    for (const [resourceId, quantity] of lootBag.resources.entries()) {
      const currentQty = player.resourcesCollected.get(resourceId) || 0;
      player.resourcesCollected.set(resourceId, currentQty + quantity);
    }

    // Transferir pokébolas para inventário de expedição
    for (const [ballType, quantity] of lootBag.pokeballs.entries()) {
      const currentQty = player.expeditionInventory.pokeballs.get(ballType) || 0;
      player.expeditionInventory.pokeballs.set(ballType, currentQty + quantity);
    }

    // Transferir criaturas capturadas
    for (const creature of lootBag.capturedCreatures) {
      player.expeditionInventory.capturedCreatures.push(creature);
      player.creaturesCaptured++;
    }

    // Transferir criatura do time (se houver)
    if (lootBag.teamCreature) {
      // Adicionar ao inventário de expedição como criatura capturada
      player.expeditionInventory.capturedCreatures.push({
        instanceId: lootBag.teamCreature.instanceId,
        speciesId: lootBag.teamCreature.speciesId,
        level: lootBag.teamCreature.level,
        tier: "captured", // Ajustar conforme necessário
        currentHp: lootBag.teamCreature.currentHp,
        maxHp: lootBag.teamCreature.maxHp
      });
      player.creaturesCaptured++;
    }

    // Remover loot bag do mundo
    room.worldState.lootBags.delete(msg.lootBagId);

    // Broadcast de remoção
    broadcastLootBagsUpdate(room);

    // Broadcast de confirmação para o jogador que coletou
    const ws = room.clients.get(playerId);
    if (ws) {
      ws.send(JSON.stringify({
        type: "loot_collected",
        lootBagId: msg.lootBagId,
        items: {
          resources: Object.fromEntries(lootBag.resources),
          pokeballs: Object.fromEntries(lootBag.pokeballs),
          creatures: lootBag.capturedCreatures.length + (lootBag.teamCreature ? 1 : 0)
        }
      }));
    }

    return { success: true };
  }
}
```

#### 3.3 Integrar Handler no MessageRouter
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

---

### Fase 4: Renderização no Cliente

#### 4.1 Interface de Loot Bag no Cliente
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
```

#### 4.2 Handler de Updates de Loot Bags
**Arquivo**: `src/services/multiplayerClient.ts`

**Nova Mensagem**:
```typescript
export interface LootBagsUpdateMessage extends BaseMessage {
  type: "lootBagsUpdate";
  lootBags: RemoteLootBag[];
}
```

**Handler**:
```typescript
private handleLootBagsUpdate(msg: LootBagsUpdateMessage): void {
  if (this.onLootBagsUpdate) {
    this.onLootBagsUpdate(msg.lootBags);
  }
}
```

#### 4.3 Sprite de Loot Bag
**Arquivo**: `src/scenes/ExpeditionScene.ts`

**Novos Campos**:
```typescript
private lootBagSprites: Map<string, Phaser.GameObjects.Container> = new Map();
```

**Métodos**:
```typescript
/**
 * Cria sprite de loot bag no chão.
 */
private createLootBagSprite(lootBag: RemoteLootBag): void {
  const container = this.add.container(lootBag.x, lootBag.y);
  
  // Sprite de baú/bolsa
  const bagSprite = this.add.rectangle(0, 0, 24, 24, 0x8b4513); // Marrom
  bagSprite.setStrokeStyle(2, 0xffd700); // Borda dourada
  
  // Indicador de brilho (pisca)
  const glow = this.add.circle(0, 0, 16, 0xffd700, 0.3);
  
  // Animação de brilho
  this.tweens.add({
    targets: glow,
    alpha: { from: 0.3, to: 0.8 },
    duration: 1000,
    yoyo: true,
    repeat: -1
  });
  
  // Texto com quantidade de itens
  const itemCount = Object.keys(lootBag.resources).length + 
                    Object.keys(lootBag.pokeballs).length + 
                    lootBag.capturedCreatures + 
                    (lootBag.hasTeamCreature ? 1 : 0);
  
  const text = this.add.text(0, -20, `${itemCount}`, {
    fontSize: '12px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2
  });
  text.setOrigin(0.5);
  
  container.add([bagSprite, glow, text]);
  container.setDepth(100); // Acima do chão, abaixo dos jogadores
  
  this.lootBagSprites.set(lootBag.id, container);
}

/**
 * Remove sprite de loot bag.
 */
private destroyLootBagSprite(lootBagId: string): void {
  const sprite = this.lootBagSprites.get(lootBagId);
  if (sprite) {
    sprite.destroy();
    this.lootBagSprites.delete(lootBagId);
  }
}

/**
 * Handler de updates de loot bags do servidor.
 */
private handleLootBagsUpdate(lootBags: RemoteLootBag[]): void {
  const existingIds = new Set(this.lootBagSprites.keys());
  const receivedIds = new Set(lootBags.map(b => b.id));
  
  // Remover loot bags que não existem mais
  for (const id of existingIds) {
    if (!receivedIds.has(id)) {
      this.destroyLootBagSprite(id);
    }
  }
  
  // Criar/atualizar loot bags existentes
  for (const lootBag of lootBags) {
    if (!this.lootBagSprites.has(lootBag.id)) {
      this.createLootBagSprite(lootBag);
    } else {
      // Atualizar posição (se necessário)
      const sprite = this.lootBagSprites.get(lootBag.id);
      if (sprite) {
        sprite.setPosition(lootBag.x, lootBag.y);
      }
    }
  }
}
```

#### 4.4 Interação com Loot Bag
**Arquivo**: `src/scenes/ExpeditionScene.ts`

**Mudança em `handleInteractions()`**:
```typescript
// Verificar interação com loot bags
for (const [lootBagId, sprite] of this.lootBagSprites.entries()) {
  const dx = sprite.x - this.player.x;
  const dy = sprite.y - this.player.y;
  const distance = Math.hypot(dx, dy);
  
  if (distance <= 30) {
    // Mostrar prompt de coleta
    this.showLootPrompt(lootBagId);
    
    // Coletar com E
    if (this.input.keyboard?.checkDown(this.input.keyboard.addKey('E'), 500)) {
      this.mpClient?.sendLootInteract(lootBagId);
    }
  }
}
```

**Novo Método**:
```typescript
/**
 * Envia intent de coleta de loot.
 */
sendLootInteract(lootBagId: string): void {
  this.send({
    type: "loot_interact",
    lootBagId
  });
}
```

---

### Fase 5: Limpeza de Loot Bags ao Final da Expedição

#### 5.1 Limpar Loot Bags ao Finalizar Partida
**Arquivo**: `server/src/managers/GameLoopManager.ts`

**Mudança em `handleMatchEnd()`**:
```typescript
function handleMatchEnd(room: Room): void {
  // ... lógica existente
  
  // Limpar todos os loot bags
  room.worldState.lootBags.clear();
  
  // Broadcast de limpeza
  broadcastLootBagsUpdate(room);
}
```

---

## PARTE 2: SISTEMA DE TIMES, LOBBY E INVITES

### Fase 6: Estrutura de Dados de Times

#### 6.1 Interface de Time
**Arquivo**: `server/src/types/TeamTypes.ts` (NOVO)

**Código**:
```typescript
/**
 * Representa um time de jogadores.
 */
export interface Team {
  id: string;
  name: string;
  leaderId: string; // ID do líder do time
  members: TeamMember[];
  createdAt: number;
  /** Configurações do time */
  settings: {
    maxMembers: number; // Padrão: 4
    isPublic: boolean; // Se aparece na lista pública
    allowInvites: boolean; // Se aceita invites
  };
}

/**
 * Membro de um time.
 */
export interface TeamMember {
  userId: string;
  displayName: string;
  role: "leader" | "member";
  joinedAt: number;
  /** Status atual do membro */
  status: "online" | "offline" | "in_game";
  /** ID da sala atual (se estiver em jogo) */
  currentRoomId?: string;
}

/**
 * Convite para entrar em um time.
 */
export interface TeamInvite {
  id: string;
  teamId: string;
  inviterId: string; // Quem enviou o convite
  inviteeId: string; // Quem recebeu o convite
  createdAt: number;
  expiresAt: number; // Expira após 5 minutos
  status: "pending" | "accepted" | "rejected" | "expired";
}
```

#### 6.2 Gerenciador de Times
**Arquivo**: `server/src/managers/TeamManager.ts` (NOVO)

**Código**:
```typescript
import type { Team, TeamMember, TeamInvite } from "../types/TeamTypes";

/**
 * Gerencia times, membros e convites.
 */
export class TeamManager {
  private teams: Map<string, Team> = new Map();
  private invites: Map<string, TeamInvite> = new Map();
  private userToTeam: Map<string, string> = new Map(); // userId -> teamId

  /**
   * Cria um novo time.
   */
  createTeam(leaderId: string, teamName: string): Team {
    const teamId = `team-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    
    const team: Team = {
      id: teamId,
      name: teamName,
      leaderId,
      members: [{
        userId: leaderId,
        displayName: "", // Buscar do Firebase
        role: "leader",
        joinedAt: Date.now(),
        status: "online"
      }],
      createdAt: Date.now(),
      settings: {
        maxMembers: 4,
        isPublic: true,
        allowInvites: true
      }
    };

    this.teams.set(teamId, team);
    this.userToTeam.set(leaderId, teamId);
    
    return team;
  }

  /**
   * Remove um time.
   */
  disbandTeam(teamId: string): void {
    const team = this.teams.get(teamId);
    if (!team) return;

    // Remover referências de membros
    for (const member of team.members) {
      this.userToTeam.delete(member.userId);
    }

    // Remover convites pendentes
    for (const [inviteId, invite] of this.invites.entries()) {
      if (invite.teamId === teamId) {
        this.invites.delete(inviteId);
      }
    }

    this.teams.delete(teamId);
  }

  /**
   * Adiciona membro a um time.
   */
  addMember(teamId: string, userId: string, displayName: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) return false;

    // Verificar se já está em um time
    if (this.userToTeam.has(userId)) {
      return false;
    }

    // Verificar limite de membros
    if (team.members.length >= team.settings.maxMembers) {
      return false;
    }

    team.members.push({
      userId,
      displayName,
      role: "member",
      joinedAt: Date.now(),
      status: "online"
    });

    this.userToTeam.set(userId, teamId);
    return true;
  }

  /**
   * Remove membro de um time.
   */
  removeMember(teamId: string, userId: string): void {
    const team = this.teams.get(teamId);
    if (!team) return;

    team.members = team.members.filter(m => m.userId !== userId);
    this.userToTeam.delete(userId);

    // Se era o líder e não há mais membros, dissolver time
    if (team.leaderId === userId && team.members.length === 0) {
      this.disbandTeam(teamId);
    } else if (team.leaderId === userId && team.members.length > 0) {
      // Transferir liderança para primeiro membro
      team.leaderId = team.members[0].userId;
      team.members[0].role = "leader";
    }
  }

  /**
   * Cria um convite.
   */
  createInvite(teamId: string, inviterId: string, inviteeId: string): TeamInvite | null {
    const team = this.teams.get(teamId);
    if (!team) return null;

    // Verificar se inviter é líder ou membro
    const inviter = team.members.find(m => m.userId === inviterId);
    if (!inviter) return null;

    // Verificar se invitee já está em um time
    if (this.userToTeam.has(inviteeId)) {
      return null;
    }

    // Verificar limite de membros
    if (team.members.length >= team.settings.maxMembers) {
      return null;
    }

    const inviteId = `invite-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const invite: TeamInvite = {
      id: inviteId,
      teamId,
      inviterId,
      inviteeId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutos
      status: "pending"
    };

    this.invites.set(inviteId, invite);
    return invite;
  }

  /**
   * Aceita um convite.
   */
  acceptInvite(inviteId: string, userId: string): boolean {
    const invite = this.invites.get(inviteId);
    if (!invite) return false;

    if (invite.inviteeId !== userId) return false;
    if (invite.status !== "pending") return false;
    if (Date.now() > invite.expiresAt) {
      invite.status = "expired";
      return false;
    }

    // Buscar displayName do Firebase
    // TODO: Implementar busca de displayName
    
    const success = this.addMember(invite.teamId, userId, "");
    if (success) {
      invite.status = "accepted";
    }

    return success;
  }

  /**
   * Rejeita um convite.
   */
  rejectInvite(inviteId: string, userId: string): boolean {
    const invite = this.invites.get(inviteId);
    if (!invite) return false;

    if (invite.inviteeId !== userId) return false;
    if (invite.status !== "pending") return false;

    invite.status = "rejected";
    return true;
  }

  /**
   * Obtém time de um usuário.
   */
  getTeamByUserId(userId: string): Team | null {
    const teamId = this.userToTeam.get(userId);
    if (!teamId) return null;
    return this.teams.get(teamId) || null;
  }

  /**
   * Lista times públicos.
   */
  getPublicTeams(): Team[] {
    return Array.from(this.teams.values()).filter(t => t.settings.isPublic);
  }
}
```

---

### Fase 7: API de Times (HTTP)

#### 7.1 Endpoints HTTP
**Arquivo**: `server/src/httpServer.ts`

**Novos Endpoints**:
```typescript
import { TeamManager } from "./managers/TeamManager";

const teamManager = new TeamManager();

// Criar time
app.post('/api/teams/create', async (req: Request, res: Response) => {
  try {
    const { userId, teamName } = req.body;
    
    if (!userId || !teamName) {
      return res.status(400).json({ error: "Missing userId or teamName" });
    }

    const team = teamManager.createTeam(userId, teamName);
    res.json({ team });
  } catch (error) {
    console.error('[API] Erro ao criar time:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Obter time do usuário
app.get('/api/teams/my-team', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const team = teamManager.getTeamByUserId(userId as string);
    res.json({ team });
  } catch (error) {
    console.error('[API] Erro ao buscar time:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Listar times públicos
app.get('/api/teams/public', async (req: Request, res: Response) => {
  try {
    const teams = teamManager.getPublicTeams();
    res.json({ teams });
  } catch (error) {
    console.error('[API] Erro ao listar times:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Criar convite
app.post('/api/teams/invite', async (req: Request, res: Response) => {
  try {
    const { teamId, inviterId, inviteeId } = req.body;
    
    if (!teamId || !inviterId || !inviteeId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const invite = teamManager.createInvite(teamId, inviterId, inviteeId);
    
    if (!invite) {
      return res.status(400).json({ error: "Failed to create invite" });
    }

    res.json({ invite });
  } catch (error) {
    console.error('[API] Erro ao criar convite:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Aceitar convite
app.post('/api/teams/invite/accept', async (req: Request, res: Response) => {
  try {
    const { inviteId, userId } = req.body;
    
    if (!inviteId || !userId) {
      return res.status(400).json({ error: "Missing inviteId or userId" });
    }

    const success = teamManager.acceptInvite(inviteId, userId);
    
    if (!success) {
      return res.status(400).json({ error: "Failed to accept invite" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Erro ao aceitar convite:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Rejeitar convite
app.post('/api/teams/invite/reject', async (req: Request, res: Response) => {
  try {
    const { inviteId, userId } = req.body;
    
    if (!inviteId || !userId) {
      return res.status(400).json({ error: "Missing inviteId or userId" });
    }

    const success = teamManager.rejectInvite(inviteId, userId);
    res.json({ success });
  } catch (error) {
    console.error('[API] Erro ao rejeitar convite:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

---

### Fase 8: Lobby de Times

#### 8.1 Nova Cena de Lobby
**Arquivo**: `src/scenes/TeamLobbyScene.ts` (NOVO)

**Funcionalidades**:
- Lista de membros do time
- Status de cada membro (online, offline, em jogo)
- Botão para iniciar expedição em grupo
- Lista de convites pendentes
- Botão para sair do time
- Botão para dissolver time (apenas líder)

**Estrutura**:
```typescript
export class TeamLobbyScene extends Phaser.Scene {
  private teamData: Team | null = null;
  private invites: TeamInvite[] = [];

  async create() {
    // Carregar dados do time
    await this.loadTeamData();
    
    // Renderizar UI
    this.renderTeamMembers();
    this.renderInvites();
    this.renderActions();
  }

  private async loadTeamData() {
    // Buscar time do servidor
    const response = await fetch(`/api/teams/my-team?userId=${this.getUserId()}`);
    const data = await response.json();
    this.teamData = data.team;
  }

  private renderTeamMembers() {
    // Renderizar lista de membros
  }

  private renderInvites() {
    // Renderizar convites pendentes
  }

  private renderActions() {
    // Botões de ação
  }
}
```

#### 8.2 Integração com Base Hub
**Arquivo**: `src/scenes/BaseHubScene.ts`

**Mudança**: Adicionar botão "Times" que leva para `TeamLobbyScene`.

---

### Fase 9: Entrada em Expedição com Time

#### 9.1 Modificar Join Handler para Times
**Arquivo**: `server/src/handlers/JoinHandler.ts`

**Mudança**: Verificar se jogador está em time e permitir join em grupo:
```typescript
// Verificar se jogador está em time
const team = teamManager.getTeamByUserId(msg.userId || "");
if (team) {
  // Verificar se outros membros do time já estão na sala
  const teamMembersInRoom = team.members
    .filter(m => m.currentRoomId === msg.roomId)
    .map(m => m.userId);
  
  // Permitir join se houver espaço para todos os membros
  const availableSlots = MAX_PLAYERS_PER_ROOM - room.clients.size;
  if (teamMembersInRoom.length > 0 && availableSlots < team.members.length) {
    return { success: false, error: "not_enough_slots_for_team" };
  }
}
```

#### 9.2 Marcar Membros como "em jogo"
**Arquivo**: `server/src/managers/TeamManager.ts`

**Novo Método**:
```typescript
/**
 * Marca membros do time como "em jogo".
 */
setTeamInGame(teamId: string, roomId: string): void {
  const team = this.teams.get(teamId);
  if (!team) return;

  for (const member of team.members) {
    member.status = "in_game";
    member.currentRoomId = roomId;
  }
}
```

---

### Fase 10: Friendly Fire para Times (Futuro)

#### 10.1 Flag de Friendly Fire
**Arquivo**: `server/src/types/ServerTypes.ts`

**Mudança em `Room`**:
```typescript
export interface Room {
  // ... campos existentes
  /** Se friendly fire está desabilitado para times */
  disableTeamFriendlyFire: boolean;
}
```

**Arquivo**: `server/src/systems/combat.ts`

**Mudança em `updateProjectiles()`**:
```typescript
// Verificar se atacante e alvo estão no mesmo time
if (room.disableTeamFriendlyFire) {
  const attackerTeam = teamManager.getTeamByUserId(proj.ownerId);
  const targetTeam = teamManager.getTeamByUserId(targetPlayerId);
  
  if (attackerTeam && targetTeam && attackerTeam.id === targetTeam.id) {
    continue; // Não pode atacar membro do mesmo time
  }
}
```

---

## Ordem de Implementação Recomendada

### Sprint 1: PvP Básico
1. ✅ Fase 1: Sistema de Combate PvP
2. ✅ Fase 2: Sistema de Drop de Itens
3. ✅ Fase 3: Sistema de Coleta de Loot
4. ✅ Fase 4: Renderização no Cliente

### Sprint 2: Polimento PvP
5. ✅ Fase 5: Limpeza de Loot Bags
6. Testes e balanceamento

### Sprint 3: Sistema de Times
7. ✅ Fase 6: Estrutura de Dados de Times
8. ✅ Fase 7: API de Times (HTTP)
9. ✅ Fase 8: Lobby de Times

### Sprint 4: Integração Times + Expedição
10. ✅ Fase 9: Entrada em Expedição com Time
11. ✅ Fase 10: Friendly Fire para Times (opcional)

---

## Arquivos a Criar

1. `server/src/types/TeamTypes.ts` - Tipos de times
2. `server/src/managers/TeamManager.ts` - Gerenciador de times
3. `server/src/handlers/LootHandler.ts` - Handler de loot
4. `server/src/systems/loot.ts` - Sistema de loot (opcional - pode ir em combat.ts)
5. `src/scenes/TeamLobbyScene.ts` - Cena de lobby de times

## Arquivos a Modificar

1. `server/src/systems/combat.ts` - PvP e validações
2. `server/src/types/ServerTypes.ts` - Adicionar campos novos
3. `server/src/types.ts` - Adicionar ServerLootBag e WorldState.lootBags
4. `server/src/managers/GameLoopManager.ts` - Handler de morte com loot
5. `server/src/handlers/JoinHandler.ts` - Adicionar joinedAt, roomId
6. `server/src/httpServer.ts` - Endpoints de times
7. `server/src/connection/MessageRouter.ts` - Handler de loot_interact
8. `server/src/messages.ts` - Mensagens de loot bags
9. `src/services/multiplayerClient.ts` - Handlers de loot bags
10. `src/scenes/ExpeditionScene.ts` - Renderização de loot bags
11. `src/scenes/BaseHubScene.ts` - Botão de times

---

## Notas de Implementação

- **Loot bags não expiram**: Ficam no chão até alguém coletar ou expedição terminar
- **Drop completo**: Todos os itens + 1 criatura aleatória do time + criaturas capturadas
- **Zonas seguras**: Pontos de extração são zonas seguras (sem PvP)
- **Proteção de spawn**: 5 segundos de invulnerabilidade
- **Times**: Sistema completo com lobby, invites e entrada em grupo
- **Friendly fire**: Por enquanto FFA, mas estrutura pronta para desabilitar friendly fire entre times

---

**Status**: ✅ Plano Completo e Pronto para Implementação
