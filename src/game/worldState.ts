/**
 * Abstração unificada para gerenciamento de estado do mundo do jogo.
 * 
 * Arquitetura multiplayer-first: o servidor é sempre a fonte de verdade.
 * Cliente apenas recebe e renderiza o estado sincronizado.
 * 
 * RemoteWorldState: Implementação padrão - sincroniza com servidor via WebSocket
 */

import type { ThreatTier, EnemyBehaviorType, EnemyAIState, EnemyBehaviorConfig } from "./constants";

// =============================================================================
// Tipos Base de Estado
// =============================================================================

/**
 * Estado completo de uma criatura no mundo.
 * Combina dados de gameplay (HP, posição) com dados de IA (comportamento, timers).
 */
export interface CreatureState {
  id: string;
  
  // Dados básicos
  speciesId?: string;
  creatureType?: string;
  level?: number;
  
  // Posição e movimento
  x: number;
  y: number;
  
  // Combate
  currentHp: number;
  maxHp: number;
  tier: ThreatTier;
  
  // IA e comportamento
  behaviorType: EnemyBehaviorType;
  aiState: EnemyAIState;
  aiConfig: EnemyBehaviorConfig;
  attackCooldownRemaining: number;
  windupTimer: number;
  skillWindupTimer?: number; // ✅ Windup de skill de criaturas
  stunTimer: number;
  
  // Patrulha
  patrolOrigin: { x: number; y: number };
  patrolTimer: number;
  
  // Estado geral
  state?: string;
}

/**
 * Estado de um recurso coletável no mundo.
 * FASE 4B: Expandido com propriedades visuais para unificação.
 */
export interface ResourceState {
  id: string;
  
  // Identificação
  type: string;  // ID do item (ex: "resource-ferro-cristalino")
  resourceType?: string; // Alias para compatibilidade
  
  // Posição
  x: number;
  y: number;
  
  // Quantidade
  amount: number;
  quantity?: number; // Alias para compatibilidade
  
  // Propriedades visuais (FASE 4B)
  isRare: boolean; // Se é recurso raro (maior visibilidade)
  size: number; // Tamanho do sprite (recursos raros são maiores)
  color: number; // Cor do sprite (hex)
  borderColor: number; // Cor da borda (hex)
  borderWidth: number; // Largura da borda
}

/**
 * Estado de um jogador no mundo.
 * FASE 4C: Expandido com propriedades visuais e de ação.
 */
export interface PlayerState {
  id: string;
  name: string;
  
  // Posição
  x: number;
  y: number;
  
  // HP
  hp: number;
  maxHp: number;
  
  // Sincronização
  lastUpdate: number; // Timestamp para descartar updates antigos
  
  // FASE 4C: Propriedades visuais e de estado
  
  /** Cor do sprite do jogador (hex) - ciano para remotos, verde para local */
  color: number;
  
  /** Raio do sprite */
  radius: number;
  
  /** Tipo de ação atual do jogador */
  actionType: "idle" | "attacking" | "extracting" | "capturing" | null;
  
  /** Timer da ação atual (para animações/feedbacks) */
  actionTimer: number;
  
  /** Se o jogador está visível (dentro do range de renderização) */
  isVisible: boolean;
  
  // ✅ Windup timers para efeitos visuais
  windupTimer?: number;
  skillWindupTimer?: number;
}

/**
 * Estado de um ponto de extração.
 */
export interface ExtractionPointState {
  id: string;
  x: number;
  y: number;
  radius?: number;
  status?: string;
  currentPlayerId?: string;
  progress?: number;
}

// =============================================================================
// Interface Principal
// =============================================================================

/**
 * Interface para gerenciamento de estado do mundo.
 * Implementada por RemoteWorldState (multiplayer-first, padrão).
 */
export interface GameWorldState {
  // Coleções de entidades
  readonly creatures: Map<string, CreatureState>;
  readonly resources: Map<string, ResourceState>;
  readonly players: Map<string, PlayerState>;
  readonly extractionPoints: Map<string, ExtractionPointState>;
  
  // Métodos de leitura
  getCreature(id: string): CreatureState | undefined;
  getResource(id: string): ResourceState | undefined;
  getPlayer(id: string): PlayerState | undefined;
  getExtractionPoint(id: string): ExtractionPointState | undefined;
  
  // Métodos de escrita
  updateCreature(id: string, updates: Partial<CreatureState>): void;
  updateResource(id: string, updates: Partial<ResourceState>): void;
  updatePlayer(id: string, updates: Partial<PlayerState>): void;
  updateExtractionPoint(id: string, updates: Partial<ExtractionPointState>): void;
  
  // Métodos de criação
  addCreature(creature: CreatureState): void;
  addResource(resource: ResourceState): void;
  addPlayer(player: PlayerState): void;
  addExtractionPoint(point: ExtractionPointState): void;
  
  // Métodos de remoção
  removeCreature(id: string): void;
  removeResource(id: string): void;
  removePlayer(id: string): void;
  removeExtractionPoint(id: string): void;
  
  // Métodos de utilidade
  getAllCreatures(): CreatureState[];
  getAllResources(): ResourceState[];
  getAllPlayers(): PlayerState[];
  getAllExtractionPoints(): ExtractionPointState[];
  
  clear(): void;
}

// =============================================================================
// Implementação Remota (Multiplayer-First - Padrão)
// =============================================================================

/**
 * Implementação remota do estado do mundo (padrão).
 * Arquitetura multiplayer-first: o servidor é sempre a fonte de verdade.
 * As atualizações são sincronizadas via WebSocket.
 * 
 * Esta é a implementação padrão - sempre use esta em produção.
 */
export class RemoteWorldState implements GameWorldState {
  readonly creatures: Map<string, CreatureState> = new Map();
  readonly resources: Map<string, ResourceState> = new Map();
  readonly players: Map<string, PlayerState> = new Map();
  readonly extractionPoints: Map<string, ExtractionPointState> = new Map();
  
  // Callback para notificar mudanças (usado pelo MultiplayerClient)
  private onStateChangeCallback?: (type: 'creature' | 'resource' | 'player' | 'extraction', action: 'add' | 'update' | 'remove', id: string) => void;
  
  setOnStateChange(callback: (type: 'creature' | 'resource' | 'player' | 'extraction', action: 'add' | 'update' | 'remove', id: string) => void): void {
    this.onStateChangeCallback = callback;
  }
  
  // Leitura
  getCreature(id: string): CreatureState | undefined {
    return this.creatures.get(id);
  }
  
  getResource(id: string): ResourceState | undefined {
    return this.resources.get(id);
  }
  
  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }
  
  getExtractionPoint(id: string): ExtractionPointState | undefined {
    return this.extractionPoints.get(id);
  }
  
  // Escrita (sincronizada com servidor)
  updateCreature(id: string, updates: Partial<CreatureState>): void {
    const existing = this.creatures.get(id);
    if (existing) {
      this.creatures.set(id, { ...existing, ...updates });
      this.onStateChangeCallback?.('creature', 'update', id);
    }
  }
  
  updateResource(id: string, updates: Partial<ResourceState>): void {
    const existing = this.resources.get(id);
    if (existing) {
      this.resources.set(id, { ...existing, ...updates });
      this.onStateChangeCallback?.('resource', 'update', id);
    }
  }
  
  updatePlayer(id: string, updates: Partial<PlayerState>): void {
    const existing = this.players.get(id);
    if (existing) {
      this.players.set(id, { ...existing, ...updates });
      this.onStateChangeCallback?.('player', 'update', id);
    }
  }
  
  updateExtractionPoint(id: string, updates: Partial<ExtractionPointState>): void {
    const existing = this.extractionPoints.get(id);
    if (existing) {
      this.extractionPoints.set(id, { ...existing, ...updates });
      this.onStateChangeCallback?.('extraction', 'update', id);
    }
  }
  
  // Criação
  addCreature(creature: CreatureState): void {
    this.creatures.set(creature.id, creature);
    this.onStateChangeCallback?.('creature', 'add', creature.id);
  }
  
  addResource(resource: ResourceState): void {
    this.resources.set(resource.id, resource);
    this.onStateChangeCallback?.('resource', 'add', resource.id);
  }
  
  addPlayer(player: PlayerState): void {
    this.players.set(player.id, player);
    this.onStateChangeCallback?.('player', 'add', player.id);
  }
  
  addExtractionPoint(point: ExtractionPointState): void {
    this.extractionPoints.set(point.id, point);
    this.onStateChangeCallback?.('extraction', 'add', point.id);
  }
  
  // Remoção
  removeCreature(id: string): void {
    if (this.creatures.has(id)) {
      this.creatures.delete(id);
      this.onStateChangeCallback?.('creature', 'remove', id);
    }
  }
  
  removeResource(id: string): void {
    if (this.resources.has(id)) {
      this.resources.delete(id);
      this.onStateChangeCallback?.('resource', 'remove', id);
    }
  }
  
  removePlayer(id: string): void {
    if (this.players.has(id)) {
      this.players.delete(id);
      this.onStateChangeCallback?.('player', 'remove', id);
    }
  }
  
  removeExtractionPoint(id: string): void {
    if (this.extractionPoints.has(id)) {
      this.extractionPoints.delete(id);
      this.onStateChangeCallback?.('extraction', 'remove', id);
    }
  }
  
  // Utilidade
  getAllCreatures(): CreatureState[] {
    return Array.from(this.creatures.values());
  }
  
  getAllResources(): ResourceState[] {
    return Array.from(this.resources.values());
  }
  
  getAllPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }
  
  getAllExtractionPoints(): ExtractionPointState[] {
    return Array.from(this.extractionPoints.values());
  }
  
  clear(): void {
    this.creatures.clear();
    this.resources.clear();
    this.players.clear();
    this.extractionPoints.clear();
  }
}
