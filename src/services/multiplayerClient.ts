/**
 * Cliente WebSocket para sincronizar estado de jogo multiplayer.
 * 
 * Este cliente encapsula toda a comunicação WebSocket com o servidor,
 * fornecendo uma API tipada para enviar intents e receber eventos.
 * 
 * Mantém a experiência jogável mesmo se o servidor não estiver disponível.
 */

// =============================================================================
// Tipos de Estado
// =============================================================================

export interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  hp?: number;
  maxHp?: number;
  lastUpdate?: number;
  
  // FASE 4C: Propriedades visuais e de ação (alinhadas com PlayerState)
  color?: number; // Cor do sprite (hex)
  radius?: number; // Raio do sprite
  actionType?: "idle" | "attacking" | "extracting" | "capturing" | null;
  actionTimer?: number; // Tempo restante da ação
  isVisible?: boolean; // Se está visível (dentro do range)
}

/**
 * Snapshot de estado de partida enviado pelo servidor.
 */
export interface MatchState {
  elapsedSeconds: number;
  timeLeft: number;
  durationSeconds: number;
  state?: "waiting" | "in_progress" | "finished";
}

/**
 * Dados de uma criatura do time do jogador.
 */
export interface TeamCreatureData {
  instanceId: string;
  definitionId: string;
  level: number;
  currentHp: number;
  maxHp: number;
  rank?: number;
}

/**
 * Representação de uma criatura selvagem recebida do servidor.
 * Agora inclui propriedades de IA para unificação com WildCreature.
 */
export interface RemoteCreature {
  id: string;
  speciesId?: string;
  creatureType?: string;
  x: number;
  y: number;
  currentHp: number;
  maxHp: number;
  state?: string;
  level?: number;
  
  // Dados de IA e comportamento (sincronizados do servidor)
  tier?: string;
  behaviorType?: string;
  aiState?: string;
  attackCooldownRemaining?: number;
  windupTimer?: number;
  stunTimer?: number;
  patrolOriginX?: number;
  patrolOriginY?: number;
  patrolTimer?: number;
  
  // Configuração de IA (pode ser derivada do behaviorType no cliente)
  aiConfig?: {
    aggroRange?: number;
    attackRange?: number;
    attackDamage?: number;
    attackCooldown?: number;
    attackWindup?: number;
    moveSpeed?: number;
    retreatDistance?: number;
    patrolRadius?: number;
    patrolInterval?: number;
  };
}

/**
 * Representação de um recurso recebido do servidor.
 * FASE 4B: Expandido com propriedades visuais.
 */
export interface RemoteResource {
  id: string;
  type?: string;
  resourceType?: string;
  x: number;
  y: number;
  amount?: number;
  quantity?: number;
  
  // FASE 4B: Propriedades visuais
  isRare?: boolean;
  size?: number;
  color?: number;
  borderColor?: number;
  borderWidth?: number;
}

/**
 * Representação de um ponto de extração recebido do servidor.
 */
export interface RemoteExtractionPoint {
  id: string;
  x: number;
  y: number;
  radius?: number;
  status?: string;
  currentPlayerId?: string;
  progress?: number;
}

/**
 * Estado do mundo recebido do servidor.
 */
export interface RemoteWorldState {
  creatures?: RemoteCreature[];
  resources?: RemoteResource[];
  extractionPoints?: RemoteExtractionPoint[];
}

// =============================================================================
// Tipos de Mensagens do Servidor
// =============================================================================

/**
 * Resultado de ataque processado pelo servidor.
 */
export interface AttackResult {
  attackerId: string;
  targetId?: string;
  damage: number;
  targetHp?: number;
  targetMaxHp?: number;
  isCritical?: boolean;
  targetDestroyed?: boolean;
}

/**
 * Resultado de tentativa de captura.
 */
export interface CaptureResult {
  playerId: string;
  targetId: string;
  success: boolean;
  /** Chance calculada de captura (0.0 a 1.0) */
  captureChance: number;
  /** Valor rolado no dado (0.0 a 1.0) */
  roll: number;
  capturedCreature?: {
    instanceId: string;
    speciesId: string;
    level: number;
    nickname?: string;
  };
  failReason?: string;
}

/**
 * Estado de extração de um jogador.
 */
export interface ExtractionState {
  pointId: string;
  playerId: string;
  status: string;
  progress: number;
  rewards?: {
    resources?: Record<string, number>;
    creaturesCaptured?: number;
  };
}

/**
 * Evento de partida.
 */
export interface MatchEvent {
  event: "started" | "almost_finished" | "finished" | "state_change";
  timeLeft: number;
  matchState?: string;
}

/**
 * Notificação de morte de jogador.
 */
export interface PlayerDeath {
  playerId: string;
  reason: string;
  killedBy?: string;
}

/**
 * Atualização de posição de um jogador específico.
 */
export interface PlayerMove {
  playerId: string;
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Representação de um projétil recebido do servidor.
 */
export interface RemoteProjectile {
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

/**
 * Representação de uma skill zone recebida do servidor.
 */
export interface RemoteSkillZone {
  id: string;
  ownerId: string;
  skillType: "fire_fog" | "root_trap" | "electric_surge";
  x: number;
  y: number;
  radius: number;
  lifetime: number;
}

/**
 * Confirmação de entrada na sala.
 */
export interface JoinedConfirmation {
  clientId: string;
  roomId: string;
  matchState: string;
  initialPosition?: {
    x: number;
    y: number;
  };
}

// =============================================================================
// Tipos de Ball (para captura)
// =============================================================================

export type BallType = "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra" | "pokeball" | "greatball" | "ultraball" | "masterball";

// =============================================================================
// Eventos do Cliente
// =============================================================================

type MultiplayerEvents = {
  /** Snapshot de presença/posição de todos os jogadores na sala. */
  state: (players: RemotePlayer[], match?: MatchState, world?: RemoteWorldState) => void;
  
  /** Confirmação de entrada na sala com ID do cliente. */
  joined: (data: JoinedConfirmation) => void;
  
  /** Conexão estabelecida com sucesso. */
  connected: () => void;
  
  /** Conexão perdida. */
  disconnected: () => void;
  
  /** Atualização de criaturas. */
  creaturesUpdate: (creatures: RemoteCreature[]) => void;
  
  /** Atualização de recursos. */
  resourcesUpdate: (resources: RemoteResource[]) => void;
  
  /** Atualização de projéteis. */
  projectilesUpdate: (projectiles: RemoteProjectile[]) => void;
  
  /** Atualização de skill zones. */
  skillZonesUpdate: (skillZones: RemoteSkillZone[]) => void;
  
  /** Resultado de um ataque processado. */
  attackResult: (result: AttackResult) => void;
  
  /** Resultado de tentativa de captura. */
  captureResult: (result: CaptureResult) => void;
  
  /** Estado de extração. */
  extractionState: (state: ExtractionState) => void;
  
  /** Evento de partida. */
  matchEvent: (event: MatchEvent) => void;
  
  /** Morte de jogador. */
  playerDeath: (death: PlayerDeath) => void;
  
  /** Movimento de um jogador específico. */
  playerMove: (move: PlayerMove) => void;
  
  /** Erro recebido do servidor. */
  error: (reason: string, details?: string) => void;
};

// =============================================================================
// Classe Principal
// =============================================================================

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private roomId: string;
  private name: string;
  private events: Partial<MultiplayerEvents> = {};
  private clientId: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private url: string = "ws://localhost:3003";

  constructor(roomId: string, name: string) {
    this.roomId = roomId;
    this.name = name;
  }

  /**
   * Registra um handler para um evento.
   */
  on<K extends keyof MultiplayerEvents>(event: K, handler: MultiplayerEvents[K]): void {
    this.events[event] = handler;
  }

  /**
   * Remove um handler de evento.
   */
  off<K extends keyof MultiplayerEvents>(event: K): void {
    delete this.events[event];
  }

  /**
   * Retorna o ID do cliente (após conectar).
   */
  getClientId(): string | null {
    return this.clientId;
  }

  /**
   * Conecta ao servidor WebSocket.
   */
  connect(url: string = "ws://localhost:3003"): void {
    this.url = url;
    
    try {
      this.ws = new WebSocket(url);
    } catch {
      console.error("[MultiplayerClient] Falha ao criar WebSocket");
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.ws?.send(
        JSON.stringify({
          type: "join",
          roomId: this.roomId,
          name: this.name
        })
      );
      this.events.connected?.();
    };

    this.ws.onmessage = (ev) => {
      this.handleMessage(ev.data as string);
    };

    this.ws.onclose = () => {
      this.events.disconnected?.();
      this.ws = null;
      
      // Tentar reconectar
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => {
          console.log(`[MultiplayerClient] Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          this.connect(this.url);
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (error) => {
      console.error("[MultiplayerClient] Erro WebSocket:", error);
    };
  }

  /**
   * Desconecta do servidor.
   */
  disconnect(): void {
    this.maxReconnectAttempts = 0; // Evitar reconexão automática
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Verifica se está conectado.
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ===========================================================================
  // Métodos de Envio de Intents
  // ===========================================================================

  /**
   * Envia posição do jogador.
   */
  sendPosition(x: number, y: number): void {
    this.send({
      type: "move",
      x,
      y
    });
  }

  /**
   * Envia intent de ataque básico.
   */
  sendAttack(
    targetX: number, 
    targetY: number, 
    creatureId?: string,
    attackType?: "basic" | "special"
  ): void {
    this.send({
      type: "attack_basic",
      targetX,
      targetY,
      creatureId,
      attackType
    });
  }

  /**
   * Envia intent de uso de skill especial.
   */
  sendSkill(
    skillType: "fire_fog" | "root_trap" | "electric_surge" | "heal_wave",
    targetX: number,
    targetY: number,
    creatureId?: string
  ): void {
    this.send({
      type: "use_skill",
      skillType,
      targetX,
      targetY,
      creatureId
    });
  }

  /**
   * Envia intent de tentativa de captura.
   */
  sendCaptureAttempt(targetId: string, ballType: BallType = "poke-ball-basic"): void {
    this.send({
      type: "capture_attempt",
      targetId,
      ballType
    });
  }

  /**
   * Envia intent de interação com recurso.
   */
  sendResourceInteract(resourceId: string): void {
    this.send({
      type: "resource_interact",
      resourceId
    });
  }

  /**
   * Envia intent de extração.
   */
  sendExtractionRequest(pointId: string, action: "start" | "cancel"): void {
    this.send({
      type: "extraction_request",
      pointId,
      action
    });
  }

  /**
   * Envia ping para verificar latência.
   */
  sendPing(): void {
    this.send({ type: "ping" });
  }

  /**
   * Envia dados do time do jogador ao servidor.
   * Deve ser chamado logo após entrar na sala.
   */
  sendTeamData(creatures: TeamCreatureData[], activeCreatureInstanceId: string | null): void {
    this.send({
      type: "team_sync",
      creatures,
      activeCreatureInstanceId
    });
  }

  /**
   * Envia atualização de criatura ativa ao servidor.
   * Chamado quando o jogador troca de criatura.
   */
  sendActiveCreatureUpdate(instanceId: string, currentHp: number, maxHp: number): void {
    this.send({
      type: "active_creature_update",
      instanceId,
      currentHp,
      maxHp
    });
  }

  // ===========================================================================
  // Métodos Internos
  // ===========================================================================

  /**
   * Envia uma mensagem ao servidor.
   */
  private send(message: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Processa mensagem recebida do servidor.
   */
  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case "state":
          this.handleStateMessage(msg);
          break;

        case "joined":
          this.clientId = msg.clientId;
          this.events.joined?.({
            clientId: msg.clientId,
            roomId: msg.roomId,
            matchState: msg.matchState
          });
          break;

        case "creatures_update":
          this.events.creaturesUpdate?.(msg.creatures ?? []);
          break;

        case "resources_update":
          this.events.resourcesUpdate?.(msg.resources ?? []);
          break;

        case "projectiles_update":
          this.events.projectilesUpdate?.(msg.projectiles ?? []);
          break;

        case "skill_zones_update":
          this.events.skillZonesUpdate?.(msg.skillZones ?? []);
          break;

        case "attack_result":
          this.events.attackResult?.({
            attackerId: msg.attackerId,
            targetId: msg.targetId,
            damage: msg.damage,
            targetHp: msg.targetHp,
            targetMaxHp: msg.targetMaxHp,
            isCritical: msg.isCritical,
            targetDestroyed: msg.targetDestroyed
          });
          break;

        case "capture_result":
          this.events.captureResult?.({
            playerId: msg.playerId,
            targetId: msg.targetId,
            success: msg.success,
            captureChance: msg.captureChance,
            roll: msg.roll,
            capturedCreature: msg.capturedCreature,
            failReason: msg.failReason
          });
          break;

        case "extraction_state":
          this.events.extractionState?.({
            pointId: msg.pointId,
            playerId: msg.playerId,
            status: msg.status,
            progress: msg.progress,
            rewards: msg.rewards
          });
          break;

        case "match_event":
          this.events.matchEvent?.({
            event: msg.event,
            timeLeft: msg.timeLeft ?? 0,
            matchState: msg.matchState
          });
          break;

        case "player_death":
          this.events.playerDeath?.({
            playerId: msg.playerId,
            reason: msg.reason,
            killedBy: msg.killedBy
          });
          break;

        case "player_move":
          this.events.playerMove?.({
            playerId: msg.playerId,
            x: msg.x,
            y: msg.y,
            timestamp: msg.timestamp
          });
          break;

        case "error":
          this.events.error?.(msg.reason, msg.details);
          break;

        case "pong":
          // Pong recebido - pode ser usado para calcular latência
          break;

        default:
          // Mensagem desconhecida - ignorar silenciosamente
          break;
      }
    } catch {
      // JSON inválido - ignorar
    }
  }

  /**
   * Processa mensagem de estado.
   */
  private handleStateMessage(msg: Record<string, unknown>): void {
    const players = (msg.players ?? []) as RemotePlayer[];
    const match = msg.match as MatchState | undefined;
    const world = msg.world as RemoteWorldState | undefined;
    
    this.events.state?.(players, match, world);
  }
}
