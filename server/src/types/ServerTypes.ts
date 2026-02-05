import { WebSocket } from "ws";
import type { GameLoop, MatchState } from "../gameLoop";
import type { WorldState } from "../types";
import type { PlayerExtractionState } from "../systems/extraction";

export type ClientId = string;

export interface PlayerPresence {
  id: ClientId;
  name: string;
  x: number;
  y: number;
  /** Firebase UID do jogador (opcional - para salvar recompensas) */
  userId?: string;
  /** ID da criatura ativa do jogador (para visualização e cálculo de dano) */
  activeCreatureId?: string;
  /** Inventário temporário de pokébolas e criaturas capturadas durante a expedição */
  expeditionInventory: any; // PlayerExpeditionInventory
  /** Progresso de extração (0-100) */
  extractionProgress: number;
  /** Timestamp quando extraiu com sucesso (null se ainda não extraiu) */
  extractedAt: number | null;
  /** Recursos coletados durante a partida */
  resourcesCollected: Map<string, number>;
  /** Número de criaturas capturadas durante a partida */
  creaturesCaptured: number;
  /** Itens consumidos durante a expedição (itemId -> quantidade) */
  itemsConsumed: Map<string, number>;
  
  // Propriedades visuais e de ação (sincronizadas com cliente)
  /** Cor do sprite do jogador (hex) */
  color?: number;
  /** Raio do sprite */
  radius?: number;
  /** Tipo de ação atual do jogador */
  actionType?: "idle" | "attacking" | "extracting" | "capturing" | null;
  /** Timer da ação atual (segundos restantes) */
  actionTimer?: number;
  /** Se o jogador está visível (usado no cliente para culling) */
  isVisible?: boolean;
  /** Timestamp do último update (para descartar updates antigos) */
  lastUpdate?: number;
}

/**
 * Modelo de sala com suporte a game loop.
 */
export interface Room {
  id: string;
  clients: Map<ClientId, WebSocket>;
  players: Map<ClientId, PlayerPresence>;
  /**
   * Timer simples de partida: conta quantos segundos se passaram desde o início.
   */
  startedAt: number;
  durationSeconds: number;
  /**
   * Game loop da sala - gerencia a simulação do jogo.
   */
  gameLoop: GameLoop | null;
  /**
   * Estado atual da partida.
   */
  matchState: MatchState;
  /**
   * Estado do mundo (criaturas, recursos, pontos de extração).
   * Populado na criação da sala e atualizado durante o jogo.
   */
  worldState: WorldState;
  /**
   * Mapa de jogadores que estão extraindo ativamente.
   * Chave: playerId, Valor: estado de extração
   */
  activeExtractions: Map<string, PlayerExtractionState>;
  /**
   * Mapa de último progresso broadcastado para cada jogador (para evitar spam de updates).
   * Chave: playerId, Valor: último progresso em porcentagem (0-100)
   */
  lastExtractionBroadcast?: Map<string, number>;
  /**
   * Timer para cleanup automático de sala vazia.
   */
  emptyRoomTimer: NodeJS.Timeout | null;
}

export interface BaseMessage {
  type: string;
}

export interface JoinMessage extends BaseMessage {
  type: "join";
  roomId: string;
  name: string;
  /** Firebase UID do jogador (opcional - para recuperar time do Firebase) */
  userId?: string;
  /** Itens selecionados do inventário permanente para levar na expedição (opcional) */
  selectedItems?: Record<string, number>;
}

export interface MoveMessage extends BaseMessage {
  type: "move";
  x: number;
  y: number;
}

export interface PingMessage extends BaseMessage {
  type: "ping";
}

export interface AttackMessage extends BaseMessage {
  type: "attack_basic";
  targetX: number;
  targetY: number;
  creatureId?: string;
  attackType?: "basic" | "special";
  creatureLevel?: number;
  creatureRank?: number;
}

export interface SkillMessage extends BaseMessage {
  type: "use_skill";
  skillType: "fire_fog" | "root_trap" | "electric_surge" | "heal_wave";
  targetX: number;
  targetY: number;
  creatureId?: string;
  creatureLevel?: number;
  creatureRank?: number;
}

export interface CaptureMessage extends BaseMessage {
  type: "capture_attempt";
  targetId: string;
  ballType?: string;
}

export interface ResourceInteractMessage extends BaseMessage {
  type: "resource_interact";
  resourceId: string;
}

export interface ExtractionMessage extends BaseMessage {
  type: "extraction_request";
  pointId: string;
  action: "start" | "cancel";
}

export interface TeamSyncMessage extends BaseMessage {
  type: "team_sync";
  creatures: Array<{
    instanceId: string;
    definitionId: string;
    level: number;
    currentHp: number;
    maxHp: number;
    rank?: number;
  }>;
  activeCreatureInstanceId: string | null;
}

export interface ActiveCreatureUpdateMessage extends BaseMessage {
  type: "active_creature_update";
  instanceId: string;
  currentHp: number;
  maxHp: number;
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
  | ActiveCreatureUpdateMessage;
