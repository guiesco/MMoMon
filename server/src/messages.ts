/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Protocolo de Mensagens WebSocket - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este arquivo define o contrato completo de comunicação entre cliente e servidor.
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ MENSAGENS CLIENTE → SERVIDOR (Intents)                                      │
 * ├─────────────────────┬───────────────────────────────────────────────────────┤
 * │ Tipo                │ Propósito                                             │
 * ├─────────────────────┼───────────────────────────────────────────────────────┤
 * │ join                │ Entrar em uma sala de jogo                            │
 * │ move                │ Informar nova posição do jogador                      │
 * │ attack_basic        │ Solicitar ataque básico em coordenadas                │
 * │ capture_attempt     │ Tentar capturar uma criatura selvagem                 │
 * │ resource_interact   │ Interagir/coletar um recurso                          │
 * │ extraction_request  │ Iniciar ou cancelar extração em um ponto              │
 * │ ping                │ Verificar latência/conexão                            │
 * └─────────────────────┴───────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ MENSAGENS SERVIDOR → CLIENTE (State/Events)                                 │
 * ├─────────────────────┬───────────────────────────────────────────────────────┤
 * │ Tipo                │ Propósito                                             │
 * ├─────────────────────┼───────────────────────────────────────────────────────┤
 * │ joined              │ Confirmação de entrada na sala com ID do cliente      │
 * │ state               │ Snapshot completo do estado da partida                │
 * │ creatures_update    │ Atualização de estado das criaturas                   │
 * │ resources_update    │ Atualização de estado dos recursos                    │
 * │ attack_result       │ Resultado de um ataque processado                     │
 * │ capture_result      │ Resultado de tentativa de captura                     │
 * │ extraction_state    │ Estado/progresso de extração                          │
 * │ match_event         │ Eventos da partida (início, fim, avisos)              │
 * │ player_death        │ Notificação de morte de jogador                       │
 * │ pong                │ Resposta ao ping                                      │
 * │ error               │ Erro genérico                                         │
 * └─────────────────────┴───────────────────────────────────────────────────────┘
 * 
 * @module server/messages
 */

// =============================================================================
// Tipos Auxiliares Compartilhados
// =============================================================================

/** Identificador único de cliente/jogador */
export type ClientId = string;

/** Identificador único de criatura */
export type CreatureId = string;

/** Identificador único de recurso */
export type ResourceId = string;

/** Identificador único de ponto de extração */
export type ExtractionPointId = string;

/** Tipo de bola de captura */
export type BallType = "pokeball" | "greatball" | "ultraball" | "masterball";

/** Estado de uma criatura selvagem */
export type CreatureState = "idle" | "wandering" | "chasing" | "fleeing" | "stunned";

/** Status de um ponto de extração */
export type ExtractionStatus = "available" | "in_progress" | "completed" | "contested";

/** Tipo de evento de partida */
export type MatchEventType = "started" | "almost_finished" | "finished" | "state_change";

/** Razão de morte de jogador */
export type DeathReason = "creature_attack" | "player_attack" | "time_expired" | "disconnected";

/** Estado da partida */
export type MatchState = "waiting" | "in_progress" | "finished";

// =============================================================================
// Estruturas de Dados para Entidades
// =============================================================================

/** Representação de um jogador no estado */
export interface PlayerPresence {
  id: ClientId;
  name: string;
  x: number;
  y: number;
  hp?: number;
  maxHp?: number;
  
  // ✅ FASE 9: Buffs ativos no jogador
  buffs?: Array<{
    type: 'speed' | 'slow' | 'freeze' | 'stun' | 'poison' | 'shield' | 'invulnerable' | 'regen';
    duration: number;
    value?: number;
  }>;
  
  // ✅ Windup timers para sincronização visual
  windupTimer?: number;
  skillWindupTimer?: number;
}

/** Representação de uma criatura selvagem */
export interface WildCreatureState {
  id: CreatureId;
  speciesId: string;
  x: number;
  y: number;
  currentHp: number;
  maxHp: number;
  state: CreatureState;
  level?: number;
  
  // Propriedades de IA para renderização e comportamento (FASE 4A Multiplayer)
  tier?: "comum" | "perigosa" | "elite";
  behaviorType?: "melee" | "ranged";
  attackCooldownRemaining?: number;
  windupTimer?: number;
  skillWindupTimer?: number; // ✅ Windup de skill de criaturas
  stunTimer?: number;
  patrolOriginX?: number;
  patrolOriginY?: number;
  patrolTimer?: number;
  
  // ✅ FASE 9: Buffs ativos na criatura
  buffs?: Array<{
    type: 'speed' | 'slow' | 'freeze' | 'stun' | 'poison' | 'shield' | 'invulnerable' | 'regen';
    duration: number;
    value?: number;
  }>;
}

/** Representação de um recurso coletável */
export interface ResourceState {
  id: ResourceId;
  type: string;
  x: number;
  y: number;
  amount: number;
}

/** Representação de um ponto de extração */
export interface ExtractionPointState {
  id: ExtractionPointId;
  x: number;
  y: number;
  status: ExtractionStatus;
  currentPlayerId?: ClientId;
  progress?: number; // 0-100
}

/** Estado do match/partida */
export interface MatchStateData {
  elapsedSeconds: number;
  timeLeft: number;
  durationSeconds: number;
  state?: MatchState;
}

/** Estado completo do mundo */
export interface WorldState {
  creatures: WildCreatureState[];
  resources: ResourceState[];
  extractionPoints: ExtractionPointState[];
}

// =============================================================================
// MENSAGENS CLIENTE → SERVIDOR (Intents)
// =============================================================================

interface BaseMessage {
  type: string;
}

/** Entrar em uma sala de jogo */
export interface JoinMessage extends BaseMessage {
  type: "join";
  roomId: string;
  name: string;
}

/** Atualizar posição do jogador */
export interface MoveMessage extends BaseMessage {
  type: "move";
  x: number;
  y: number;
}

/** Solicitar ataque básico em coordenadas */
export interface AttackBasicMessage extends BaseMessage {
  type: "attack_basic";
  targetX: number;
  targetY: number;
}

/** Tentar capturar uma criatura */
export interface CaptureAttemptMessage extends BaseMessage {
  type: "capture_attempt";
  targetId: CreatureId;
  ballType?: BallType;
}

/** Interagir com um recurso */
export interface ResourceInteractMessage extends BaseMessage {
  type: "resource_interact";
  resourceId: ResourceId;
}

/** Iniciar ou cancelar extração */
export interface ExtractionRequestMessage extends BaseMessage {
  type: "extraction_request";
  pointId: ExtractionPointId;
  action: "start" | "cancel";
}

/** Ping para verificar latência */
export interface PingMessage extends BaseMessage {
  type: "ping";
}

/** Union de todas as mensagens que o servidor pode receber */
export type IncomingMessage =
  | JoinMessage
  | MoveMessage
  | AttackBasicMessage
  | CaptureAttemptMessage
  | ResourceInteractMessage
  | ExtractionRequestMessage
  | PingMessage;

// =============================================================================
// MENSAGENS SERVIDOR → CLIENTE (State/Events)
// =============================================================================

/** Confirmação de entrada na sala */
export interface JoinedMessage extends BaseMessage {
  type: "joined";
  clientId: ClientId;
  roomId: string;
  matchState: MatchState;
}

/** Snapshot completo do estado da partida */
export interface StateMessage extends BaseMessage {
  type: "state";
  players: PlayerPresence[];
  match: MatchStateData;
  world?: WorldState;
}

/** Atualização de criaturas (delta ou completo) */
export interface CreaturesUpdateMessage extends BaseMessage {
  type: "creatures_update";
  creatures: WildCreatureState[];
}

/** Atualização de recursos (delta ou completo) */
export interface ResourcesUpdateMessage extends BaseMessage {
  type: "resources_update";
  resources: ResourceState[];
}

/** Representação de um projétil para broadcast */
export interface ProjectileState {
  id: string;
  ownerId: string;
  isPlayerProjectile: boolean;
  x: number;
  y: number;
  startX: number;
  startY: number;
  velocityX: number;
  velocityY: number;
  damage: number;
  lifetime: number;
  maxDistance: number;
}

/** Atualização de projéteis (para sincronização visual) */
export interface ProjectilesUpdateMessage extends BaseMessage {
  type: "projectiles_update";
  projectiles: ProjectileState[];
}

/** Representação de uma skill zone para broadcast */
export interface SkillZoneState {
  id: string;
  ownerId: string;
  skillType: "fire_fog" | "root_trap" | "water_pulse" | "electric_surge";
  x: number;
  y: number;
  radius: number;
  lifetime: number;
}

/** Atualização de skill zones (para sincronização visual) */
export interface SkillZonesUpdateMessage extends BaseMessage {
  type: "skill_zones_update";
  skillZones: SkillZoneState[];
}

/** Resultado de um ataque processado */
export interface AttackResultMessage extends BaseMessage {
  type: "attack_result";
  attackerId: ClientId;
  targetId?: CreatureId | ClientId;
  damage: number;
  targetHp?: number;
  targetMaxHp?: number;
  isCritical?: boolean;
  targetDestroyed?: boolean;
}

/** Resultado de tentativa de captura */
export interface CaptureResultMessage extends BaseMessage {
  type: "capture_result";
  playerId: ClientId;
  targetId: CreatureId;
  success: boolean;
  /** Chance calculada de captura (0.0 a 1.0) */
  captureChance: number;
  /** Valor rolado no dado (0.0 a 1.0) */
  roll: number;
  /** Instância da criatura capturada (se sucesso) */
  capturedCreature?: {
    instanceId: string;
    speciesId: string;
    level: number;
    nickname?: string;
  };
  /** Razão da falha (se falhou) */
  failReason?: "escaped" | "blocked" | "invalid_target" | "out_of_range" | "no_pokeball" | "creature_dead";
}

/** Estado/progresso de extração */
export interface ExtractionStateMessage extends BaseMessage {
  type: "extraction_state";
  pointId: ExtractionPointId;
  playerId: ClientId;
  status: ExtractionStatus;
  progress: number; // 0-100
  rewards?: {
    resources?: Record<string, number>;
    creaturesCaptured?: number;
    unusedItems?: Record<string, number>; // Itens não usados que serão retornados ao inventário permanente
    savedToCloud?: boolean; // ✅ Indica se foi salvo no Firebase
    error?: string; // Mensagem de erro se salvamento falhou
  };
}

/** Eventos da partida */
export interface MatchEventMessage extends BaseMessage {
  type: "match_event";
  event: MatchEventType;
  timeLeft: number;
  matchState?: MatchState;
}

/** Notificação de morte de jogador */
export interface PlayerDeathMessage extends BaseMessage {
  type: "player_death";
  playerId: ClientId;
  reason: DeathReason;
  killedBy?: ClientId | CreatureId;
}

/** Atualização de posição de um jogador específico */
export interface PlayerMoveMessage extends BaseMessage {
  type: "player_move";
  playerId: ClientId;
  x: number;
  y: number;
  timestamp: number;
}

/** Resposta ao ping */
export interface PongMessage extends BaseMessage {
  type: "pong";
  serverTime?: number;
}

/** Erro genérico */
export interface ErrorMessage extends BaseMessage {
  type: "error";
  reason: string;
  details?: string;
}

/** Union de todas as mensagens que o cliente pode receber */
export type OutgoingMessage =
  | JoinedMessage
  | StateMessage
  | CreaturesUpdateMessage
  | ResourcesUpdateMessage
  | ProjectilesUpdateMessage
  | AttackResultMessage
  | CaptureResultMessage
  | ExtractionStateMessage
  | MatchEventMessage
  | PlayerDeathMessage
  | PlayerMoveMessage
  | PongMessage
  | ErrorMessage;

// =============================================================================
// FUNÇÕES HELPER PARA CRIAR MENSAGENS
// =============================================================================

/**
 * Interface interna para criação de StateMessage
 * (aceita Room ou dados mínimos necessários)
 */
interface RoomStateData {
  players: Map<ClientId, PlayerPresence> | PlayerPresence[];
  startedAt: number;
  durationSeconds: number;
  matchState?: MatchState;
  world?: WorldState;
}

/** Cria uma mensagem de confirmação de join */
export function createJoinedMessage(
  clientId: ClientId,
  roomId: string,
  matchState: MatchState
): JoinedMessage {
  return {
    type: "joined",
    clientId,
    roomId,
    matchState
  };
}

/** Cria uma mensagem de estado completo da partida */
export function createStateMessage(room: RoomStateData): StateMessage {
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - room.startedAt) / 1000);
  const timeLeft = Math.max(0, room.durationSeconds - elapsedSeconds);

  const players = room.players instanceof Map
    ? Array.from(room.players.values())
    : room.players;

  return {
    type: "state",
    players,
    match: {
      elapsedSeconds,
      timeLeft,
      durationSeconds: room.durationSeconds,
      state: room.matchState
    },
    world: room.world
  };
}

/** Cria uma mensagem de atualização de criaturas */
export function createCreaturesUpdateMessage(
  creatures: WildCreatureState[]
): CreaturesUpdateMessage {
  return {
    type: "creatures_update",
    creatures
  };
}

/** Cria uma mensagem de atualização de recursos */
export function createResourcesUpdateMessage(
  resources: ResourceState[]
): ResourcesUpdateMessage {
  return {
    type: "resources_update",
    resources
  };
}

/** Cria uma mensagem de atualização de projéteis */
export function createProjectilesUpdateMessage(
  projectiles: ProjectileState[]
): ProjectilesUpdateMessage {
  return {
    type: "projectiles_update",
    projectiles
  };
}

/**
 * Cria mensagem de atualização de skill zones.
 */
export function createSkillZonesUpdateMessage(
  skillZones: SkillZoneState[]
): SkillZonesUpdateMessage {
  return {
    type: "skill_zones_update",
    skillZones
  };
}

/** Cria uma mensagem de resultado de ataque */
export function createAttackResultMessage(
  attackerId: ClientId,
  damage: number,
  options?: {
    targetId?: CreatureId | ClientId;
    targetHp?: number;
    targetMaxHp?: number;
    isCritical?: boolean;
    targetDestroyed?: boolean;
  }
): AttackResultMessage {
  return {
    type: "attack_result",
    attackerId,
    damage,
    ...options
  };
}

/** Cria uma mensagem de resultado de captura */
export function createCaptureResultMessage(
  playerId: ClientId,
  targetId: CreatureId,
  success: boolean,
  captureChance: number,
  roll: number,
  options?: {
    capturedCreature?: CaptureResultMessage["capturedCreature"];
    failReason?: CaptureResultMessage["failReason"];
  }
): CaptureResultMessage {
  return {
    type: "capture_result",
    playerId,
    targetId,
    success,
    captureChance,
    roll,
    ...options
  };
}

/** Cria uma mensagem de estado de extração */
export function createExtractionStateMessage(
  pointId: ExtractionPointId,
  playerId: ClientId,
  status: ExtractionStatus,
  progress: number,
  rewards?: ExtractionStateMessage["rewards"]
): ExtractionStateMessage {
  return {
    type: "extraction_state",
    pointId,
    playerId,
    status,
    progress,
    rewards
  };
}

/** Cria uma mensagem de evento de partida */
export function createMatchEventMessage(
  event: MatchEventType,
  timeLeft: number,
  matchState?: MatchState
): MatchEventMessage {
  return {
    type: "match_event",
    event,
    timeLeft,
    matchState
  };
}

/** Cria uma mensagem de morte de jogador */
export function createPlayerDeathMessage(
  playerId: ClientId,
  reason: DeathReason,
  killedBy?: ClientId | CreatureId
): PlayerDeathMessage {
  return {
    type: "player_death",
    playerId,
    reason,
    killedBy
  };
}

/** Cria uma mensagem de movimento de jogador */
export function createPlayerMoveMessage(
  playerId: ClientId,
  x: number,
  y: number
): PlayerMoveMessage {
  return {
    type: "player_move",
    playerId,
    x,
    y,
    timestamp: Date.now()
  };
}

/** Cria uma mensagem pong */
export function createPongMessage(serverTime?: number): PongMessage {
  return {
    type: "pong",
    serverTime
  };
}

/** Cria uma mensagem de erro */
export function createErrorMessage(
  reason: string,
  details?: string
): ErrorMessage {
  return {
    type: "error",
    reason,
    details
  };
}

// =============================================================================
// FUNÇÕES DE VALIDAÇÃO DE MENSAGENS
// =============================================================================

/** Verifica se uma mensagem é do tipo IncomingMessage válido */
export function isValidIncomingMessage(msg: unknown): msg is IncomingMessage {
  if (typeof msg !== "object" || msg === null) return false;
  
  const m = msg as Record<string, unknown>;
  if (typeof m.type !== "string") return false;

  switch (m.type) {
    case "join":
      return typeof m.roomId === "string" && typeof m.name === "string";
    case "move":
      return typeof m.x === "number" && typeof m.y === "number";
    case "attack_basic":
      return typeof m.targetX === "number" && typeof m.targetY === "number";
    case "capture_attempt":
      return typeof m.targetId === "string";
    case "resource_interact":
      return typeof m.resourceId === "string";
    case "extraction_request":
      return (
        typeof m.pointId === "string" &&
        (m.action === "start" || m.action === "cancel")
      );
    case "ping":
      return true;
    default:
      return false;
  }
}
