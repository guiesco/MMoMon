import {
  TICK_RATE,
  TICK_INTERVAL_MS,
  STATE_BROADCAST_RATE,
  MATCH_DURATION_SECONDS,
  DEBUG_GAME_LOOP
} from "./constants";
import {
  type BallType,
  type CaptureResult,
  processCaptureIntent as processCaptureAttempt
} from "./systems/capture";
import {
  CombatRoomState,
  CombatPlayer,
  processAttackIntent,
  updateProjectiles,
  updateCreatureAI,
  applyContactDamage,
  updatePlayerWindups,
  DamageResult,
  AIAttackResult
} from "./systems/combat";
import {
  updatePlayerBuffs,
  updateCreatureBuffs
} from "./systems/buffs";
import {
  processResourceCollection,
  ResourceRoomState,
  ResourcePlayer,
  ResourceCollectionResult
} from "./systems/resources";
import {
  processSkillIntent,
  updatePlayerSkillWindups,
  SkillRoomState,
  SkillPlayer,
  SkillResult,
  SkillType
} from "./systems/skills";
import { updateSkillZones } from "./systems/combat";
import { ServerCreature, ServerProjectile, ServerSkillZone, ServerResource } from "./types";

/**
 * Estados possíveis de uma partida.
 */
export type MatchState = "waiting" | "in_progress" | "finished";

/**
 * Tipos de intent que jogadores podem enviar.
 * MVP: movimento, ataque, captura, coleta de recurso, extração, skills.
 */
export type IntentType = "move" | "attack" | "skill" | "capture" | "resource" | "extraction";

/**
 * Intent base para ações de jogadores.
 */
export interface Intent {
  playerId: string;
  type: IntentType;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Intent de movimento.
 */
export interface MoveIntent extends Intent {
  type: "move";
  data: {
    x: number;
    y: number;
  };
}

/**
 * Intent de ataque básico.
 */
export interface AttackIntent extends Intent {
  type: "attack";
  data: {
    targetX: number;
    targetY: number;
    targetId?: string;
    creatureId?: string;
    attackType?: "basic" | "special";
    creatureLevel?: number;
    creatureRank?: number;
  };
}

/**
 * Intent de captura.
 */
export interface CaptureIntent extends Intent {
  type: "capture";
  data: {
    targetId: string;
    ballType?: string;
  };
}

/**
 * Intent de coleta de recurso.
 */
export interface ResourceIntent extends Intent {
  type: "resource";
  data: {
    resourceId: string;
  };
}

/**
 * Intent de skill especial.
 */
export interface SkillIntent extends Intent {
  type: "skill";
  data: {
    skillType: "fire_fog" | "root_trap" | "electric_surge" | "heal_wave";
    targetX: number;
    targetY: number;
    creatureId?: string;
    creatureLevel?: number;
    creatureRank?: number;
  };
}

/**
 * Intent de extração.
 */
export interface ExtractionIntent extends Intent {
  type: "extraction";
  data: {
    pointId: string;
    action: "start" | "cancel";
  };
}

export type AnyIntent = MoveIntent | AttackIntent | SkillIntent | CaptureIntent | ResourceIntent | ExtractionIntent;

/**
 * Interface para callbacks do game loop.
 */
export interface GameLoopCallbacks {
  /**
   * Chamado quando o estado deve ser transmitido aos clientes.
   */
  onBroadcastState: () => void;

  /**
   * Chamado quando o estado da partida muda.
   */
  onMatchStateChange: (newState: MatchState, oldState: MatchState) => void;

  /**
   * Chamado a cada tick para processar lógica customizada.
   */
  onTick?: (tickNumber: number, deltaMs: number) => void;

  /**
   * Chamado quando dano é aplicado (para broadcast de resultados).
   */
  onDamageApplied?: (results: DamageResult[]) => void;

  /**
   * Chamado quando um jogador morre.
   */
  onPlayerDeath?: (playerId: string, killedBy: string) => void;

  /**
   * Chamado quando uma captura é processada (sucesso ou falha).
   */
  onCaptureResult?: (playerId: string, targetId: string, ballType: BallType, result: CaptureResult) => void;

  /**
   * Chamado quando uma criatura é removida do mundo (ex: capturada).
   */
  onCreatureRemoved?: (creatureId: string) => void;

  /**
   * Chamado quando um jogador usa uma skill especial.
   */
  onSkillUsed?: (
    playerId: string,
    skillType: "fire_fog" | "root_trap" | "electric_surge" | "heal_wave",
    targetX: number,
    targetY: number,
    creatureId?: string,
    creatureLevel?: number,
    creatureRank?: number
  ) => void;

  /**
   * Chamado quando um recurso é coletado.
   */
  onResourceCollected?: (
    playerId: string,
    resourceId: string,
    resourceType: string,
    quantity: number
  ) => void;

  /**
   * Chamado quando uma skill zone é criada.
   */
  onSkillZoneCreated?: (
    playerId: string,
    skillZoneId: string,
    skillType: SkillType,
    x: number,
    y: number
  ) => void;

  /**
   * Chamado quando um intent de extração é processado (start/cancel).
   */
  onExtractionIntent?: (
    playerId: string,
    pointId: string,
    action: "start" | "cancel"
  ) => void;

  /**
   * Chamado quando um ataque é processado (para confirmação imediata ao cliente).
   */
  onAttackAccepted?: (
    playerId: string,
    targetX: number,
    targetY: number,
    success: boolean,
    projectileId?: string,
    failReason?: string
  ) => void;
}

/**
 * Informações de diagnóstico do game loop.
 */
export interface GameLoopDiagnostics {
  tickNumber: number;
  matchState: MatchState;
  elapsedSeconds: number;
  timeLeft: number;
  durationSeconds: number;
  intentsInQueue: number;
  lastTickDurationMs: number;
}

/**
 * Classe GameLoop - gerencia o loop de simulação de uma sala de jogo.
 * 
 * Responsabilidades:
 * - Processar intents dos jogadores em fila
 * - Atualizar estado do mundo a cada tick
 * - Controlar estados de partida (waiting, in_progress, finished)
 * - Emitir broadcasts de estado em intervalos configuráveis
 */
export class GameLoop {
  private roomId: string;
  private intervalId: NodeJS.Timeout | null = null;
  private tickNumber: number = 0;
  private intentQueue: AnyIntent[] = [];
  private matchState: MatchState = "waiting";
  private startedAt: number = 0;
  private durationSeconds: number = MATCH_DURATION_SECONDS;
  private lastTickTime: number = 0;
  private lastTickDurationMs: number = 0;
  private callbacks: GameLoopCallbacks;
  private isPaused: boolean = false;

  // Estado de combate (expandido para incluir recursos e skill zones)
  private combatState: CombatRoomState & {
    resources: ServerResource[];
    skillZones: ServerSkillZone[];
  } = {
      players: new Map(),
      creatures: [],
      projectiles: [],
      resources: [],
      skillZones: []
    };

  constructor(roomId: string, callbacks: GameLoopCallbacks) {
    this.roomId = roomId;
    this.callbacks = callbacks;
    this.debugLog(`GameLoop criado para sala ${roomId}`);
  }

  /**
   * Inicia o game loop.
   */
  start(): void {
    if (this.intervalId) {
      this.debugLog(`GameLoop já está rodando para sala ${this.roomId}`);
      return;
    }

    this.startedAt = Date.now();
    this.lastTickTime = this.startedAt;
    this.tickNumber = 0;
    this.setMatchState("in_progress");

    this.intervalId = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);

    this.debugLog(`GameLoop iniciado para sala ${this.roomId} (${TICK_RATE} ticks/s)`);
  }

  /**
   * Para o game loop.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.debugLog(`GameLoop parado para sala ${this.roomId}`);
    }
  }

  /**
   * Pausa o game loop (mantém o interval mas não processa).
   */
  pause(): void {
    this.isPaused = true;
    this.debugLog(`GameLoop pausado para sala ${this.roomId}`);
  }

  /**
   * Retoma o game loop.
   */
  resume(): void {
    this.isPaused = false;
    this.debugLog(`GameLoop retomado para sala ${this.roomId}`);
  }

  /**
   * Verifica se o loop está rodando.
   */
  isRunning(): boolean {
    return this.intervalId !== null && !this.isPaused;
  }

  /**
   * Adiciona um intent à fila para processamento no próximo tick.
   */
  queueIntent(intent: AnyIntent): void {
    this.intentQueue.push(intent);
    this.debugLog(
      `Intent enfileirado: ${intent.type} de ${intent.playerId} (fila: ${this.intentQueue.length})`
    );
  }

  /**
   * Retorna o estado atual da partida.
   */
  getMatchState(): MatchState {
    return this.matchState;
  }

  /**
   * Retorna informações de tempo da partida.
   */
  getMatchTime(): { elapsedSeconds: number; timeLeft: number; durationSeconds: number } {
    const elapsedSeconds = this.startedAt
      ? Math.floor((Date.now() - this.startedAt) / 1000)
      : 0;
    const timeLeft = Math.max(0, this.durationSeconds - elapsedSeconds);

    return {
      elapsedSeconds,
      timeLeft,
      durationSeconds: this.durationSeconds
    };
  }

  /**
   * Retorna diagnósticos do loop.
   */
  getDiagnostics(): GameLoopDiagnostics {
    const { elapsedSeconds, timeLeft } = this.getMatchTime();
    return {
      tickNumber: this.tickNumber,
      matchState: this.matchState,
      elapsedSeconds,
      timeLeft,
      durationSeconds: this.durationSeconds,
      intentsInQueue: this.intentQueue.length,
      lastTickDurationMs: this.lastTickDurationMs
    };
  }

  /**
   * Força mudança de estado de partida (útil para testes ou admin).
   */
  forceMatchState(state: MatchState): void {
    this.setMatchState(state);
  }

  /**
   * Define a duração da partida em segundos.
   */
  setDuration(seconds: number): void {
    this.durationSeconds = seconds;
  }

  /**
   * Registra um jogador no sistema de combate.
   */
  registerPlayer(
    playerId: string,
    x: number,
    y: number,
    hp: number,
    maxHp: number
  ): void {
    // Criar jogador com todas as propriedades necessárias
    const player: CombatPlayer & ResourcePlayer & SkillPlayer = {
      id: playerId,
      x,
      y,
      hp,
      maxHp,
      lastAttackTime: 0,
      isDead: false,
      windupTimer: 0, // ✅ Inicializar windup timer
      skillWindupTimer: 0, // ✅ Inicializar skill windup timer
      expeditionInventory: new Map(),
      lastSkillTime: 0
    };

    this.combatState.players.set(playerId, player as CombatPlayer);
    console.log(`[GameLoop] Jogador ${playerId.slice(0, 8)}... registrado em (${x.toFixed(0)}, ${y.toFixed(0)}) - Total: ${this.combatState.players.size} jogadores`);
  }

  /**
   * Remove um jogador do sistema de combate.
   */
  unregisterPlayer(playerId: string): void {
    this.combatState.players.delete(playerId);
    this.debugLog(`Jogador ${playerId} removido do sistema de combate`);
  }

  /**
   * Atualiza a posição de um jogador.
   */
  updatePlayerPosition(playerId: string, x: number, y: number): void {
    const player = this.combatState.players.get(playerId);
    if (player) {
      player.x = x;
      player.y = y;
      // Log periódico para debug (a cada 100 atualizações)
      if (this.tickNumber % 100 === 0) {
        console.log(`[GameLoop] Posição atualizada: ${playerId.slice(0, 8)}... -> (${x.toFixed(0)}, ${y.toFixed(0)})`);
      }
    } else {
      console.log(`[GameLoop] ⚠️ Tentando atualizar posição de jogador não registrado: ${playerId.slice(0, 8)}...`);
      console.log(`[GameLoop]   Jogadores registrados: ${Array.from(this.combatState.players.keys()).map(k => k.slice(0, 8)).join(", ")}`);
    }
  }

  /**
   * Atualiza o HP de um jogador.
   */
  updatePlayerHp(playerId: string, hp: number, maxHp: number): void {
    const player = this.combatState.players.get(playerId);
    if (player) {
      player.hp = hp;
      player.maxHp = maxHp;
      console.log(`[GameLoop] HP do jogador ${playerId.slice(0, 8)}... atualizado: ${hp}/${maxHp}`);
    } else {
      console.log(`[GameLoop] ⚠️ Tentando atualizar HP de jogador não registrado: ${playerId.slice(0, 8)}...`);
    }
  }

  /**
   * Adiciona uma criatura ao estado de combate.
   */
  addCreature(creature: ServerCreature): void {
    this.combatState.creatures.push(creature);
    console.log(`[GameLoop] Criatura ${creature.id} adicionada (${creature.tier}, ${creature.behaviorType}) - Total: ${this.combatState.creatures.length}`);
  }

  /**
   * Adiciona um recurso ao estado de combate.
   */
  addResource(resource: ServerResource): void {
    this.combatState.resources.push(resource);
    this.debugLog(`Recurso ${resource.id} adicionado (${resource.resourceType}) - Total: ${this.combatState.resources.length}`);
  }

  /**
   * Retorna informações de um jogador.
   */
  getPlayer(playerId: string): CombatPlayer | undefined {
    return this.combatState.players.get(playerId);
  }

  /**
   * Retorna o estado completo (incluindo recursos e skill zones).
   */
  public getFullState(): typeof this.combatState {
    return this.combatState;
  }

  /**
   * Executa um tick do game loop.
   */
  private tick(): void {
    if (this.isPaused) return;

    const tickStart = Date.now();
    const deltaMs = tickStart - this.lastTickTime;

    try {
      this.tickNumber++;

      // 1. Processar intents na fila
      this.processIntents();

      // 2. Atualizar estado do mundo (IA de criaturas, projéteis, cooldowns)
      // TODO: Implementar quando movermos lógica de jogo para servidor
      this.updateWorld(deltaMs);

      // 3. Verificar condições de fim de partida
      this.checkMatchEnd();

      // 4. Callback de tick customizado
      if (this.callbacks.onTick) {
        this.callbacks.onTick(this.tickNumber, deltaMs);
      }

      // 5. Broadcast de estado a cada N ticks
      if (this.tickNumber % STATE_BROADCAST_RATE === 0) {
        this.callbacks.onBroadcastState();
      }

      // Debug periódico (a cada segundo, se debug habilitado)
      if (DEBUG_GAME_LOOP && this.tickNumber % TICK_RATE === 0) {
        const diag = this.getDiagnostics();
        console.log(
          `[GameLoop:${this.roomId}] Tick ${diag.tickNumber} | ` +
          `State: ${diag.matchState} | ` +
          `Time: ${diag.elapsedSeconds}s/${diag.durationSeconds}s | ` +
          `Queue: ${diag.intentsInQueue}`
        );
      }
    } catch (error) {
      // Resiliência: log do erro mas não derrubar o servidor
      console.error(`[GameLoop:${this.roomId}] Erro no tick ${this.tickNumber}:`, error);
    }

    this.lastTickTime = tickStart;
    this.lastTickDurationMs = Date.now() - tickStart;
  }

  /**
   * Processa todos os intents na fila.
   */
  private processIntents(): void {
    const intentsToProcess = this.intentQueue.splice(0, this.intentQueue.length);

    for (const intent of intentsToProcess) {
      try {
        this.processIntent(intent);
      } catch (error) {
        console.error(
          `[GameLoop:${this.roomId}] Erro processando intent ${intent.type}:`,
          error
        );
      }
    }
  }

  /**
   * Processa um único intent.
   */
  private processIntent(intent: AnyIntent): void {
    switch (intent.type) {
      case "move":
        // Atualizar posição do jogador no combatState
        const player = this.combatState.players.get(intent.playerId);
        if (player) {
          player.x = intent.data.x as number;
          player.y = intent.data.y as number;
          // Log periódico para debug (a cada 100 movimentos)
          if (this.tickNumber % 100 === 0) {
            console.log(`[GameLoop] Movimento processado: ${intent.playerId.slice(0, 8)}... -> (${intent.data.x.toFixed(0)}, ${intent.data.y.toFixed(0)})`);
          }
        } else {
          console.log(`[GameLoop] ⚠️ Tentando mover jogador não registrado: ${intent.playerId.slice(0, 8)}...`);
        }
        this.debugLog(`Processando movimento de ${intent.playerId}: (${intent.data.x}, ${intent.data.y})`);
        break;

      case "attack":
        // Processar ataque usando sistema de combate
        const attackResult = processAttackIntent(
          this.combatState,
          intent.playerId,
          intent.data.targetX as number,
          intent.data.targetY as number,
          Date.now(),
          intent.data.creatureId as string | undefined,
          intent.data.creatureLevel as number | undefined,
          intent.data.creatureRank as number | undefined
        );

        // Enviar confirmação imediata ao cliente
        if (this.callbacks.onAttackAccepted) {
          this.callbacks.onAttackAccepted(
            intent.playerId,
            intent.data.targetX as number,
            intent.data.targetY as number,
            attackResult.success,
            attackResult.projectileId,
            attackResult.failReason
          );
        }

        if (attackResult.success) {
          this.debugLog(`Ataque de ${intent.playerId} criou projétil ${attackResult.projectileId}`);
        } else {
          this.debugLog(`Ataque de ${intent.playerId} falhou: ${attackResult.failReason}`);
        }
        break;

      case "resource":
        // Processar coleta de recurso
        const resourceResult = processResourceCollection(
          this.combatState as unknown as ResourceRoomState,
          intent.playerId,
          intent.data.resourceId as string
        );

        if (resourceResult.success && this.callbacks.onResourceCollected) {
          this.callbacks.onResourceCollected(
            intent.playerId,
            resourceResult.resourceId!,
            resourceResult.resourceType!,
            resourceResult.quantity!
          );
          this.debugLog(
            `Recurso coletado: jogador ${intent.playerId} coletou ${resourceResult.quantity}x ${resourceResult.resourceType}`
          );
        } else {
          this.debugLog(
            `Coleta falhou: jogador ${intent.playerId}, recurso ${intent.data.resourceId}, razão: ${resourceResult.reason}`
          );
        }
        break;

      case "skill":
        // Processar skill usando sistema de skills
        const skillResult = processSkillIntent(
          this.combatState as unknown as SkillRoomState,
          intent.playerId,
          intent.data.skillType as string,
          intent.data.targetX as number,
          intent.data.targetY as number,
          Date.now(),
          intent.data.creatureId as string | undefined,
          intent.data.creatureLevel as number | undefined,
          intent.data.creatureRank as number | undefined
        );

        if (skillResult.success && this.callbacks.onSkillZoneCreated) {
          this.callbacks.onSkillZoneCreated(
            intent.playerId,
            skillResult.skillZoneId!,
            skillResult.skillType!,
            intent.data.targetX as number,
            intent.data.targetY as number
          );
          this.debugLog(
            `Skill usada: jogador ${intent.playerId} usou ${skillResult.skillType} em (${intent.data.targetX}, ${intent.data.targetY})`
          );
        } else {
          this.debugLog(
            `Skill falhou: jogador ${intent.playerId}, tipo ${intent.data.skillType}, razão: ${skillResult.reason}`
          );
        }

        // Delegar também para callback legado (para compatibilidade)
        if (this.callbacks.onSkillUsed) {
          this.callbacks.onSkillUsed(
            intent.playerId,
            intent.data.skillType as "fire_fog" | "root_trap" | "electric_surge" | "heal_wave",
            intent.data.targetX as number,
            intent.data.targetY as number,
            intent.data.creatureId as string | undefined,
            intent.data.creatureLevel as number | undefined,
            intent.data.creatureRank as number | undefined
          );
          this.debugLog(`Skill ${intent.data.skillType} usada por ${intent.playerId}`);
        }
        break;

      case "capture":
        // Processar captura usando sistema de captura
        this.processCaptureIntent(intent);
        break;

      case "extraction":
        // Processar extração (start/cancel) - delega para callback que tem acesso à Room
        if (this.callbacks.onExtractionIntent) {
          this.callbacks.onExtractionIntent(
            intent.playerId,
            intent.data.pointId as string,
            intent.data.action as "start" | "cancel"
          );
        } else {
          this.debugLog(
            `Extração não processada: callback onExtractionIntent não definido para ${intent.playerId}`
          );
        }
        break;
    }
  }

  /**
   * Processa um intent de captura.
   * 
   * NOTA: Esta função delega para um callback porque precisa de acesso
   * ao inventário do jogador, que está armazenado na Room (no index.ts).
   * O callback onCaptureResult deve processar a captura e retornar o resultado.
   */
  private processCaptureIntent(intent: CaptureIntent): void {
    const targetId = intent.data.targetId as string;
    const ballType = (intent.data.ballType as BallType) ?? "poke-ball-basic";

    // Buscar o jogador no combatState
    const player = this.combatState.players.get(intent.playerId);
    if (!player) {
      this.debugLog(`Captura falhou: jogador ${intent.playerId} não encontrado`);
      return;
    }

    // Buscar a criatura no combatState
    const creatureIndex = this.combatState.creatures.findIndex(c => c.id === targetId);
    if (creatureIndex === -1) {
      this.debugLog(`Captura falhou: criatura ${targetId} não encontrada`);

      if (this.callbacks.onCaptureResult) {
        this.callbacks.onCaptureResult(intent.playerId, targetId, ballType, {
          success: false,
          captureChance: 0,
          roll: 0,
          failReason: "invalid_target"
        });
      }
      return;
    }

    const creature = this.combatState.creatures[creatureIndex];

    this.debugLog(
      `Tentativa de captura: jogador ${intent.playerId} tenta capturar ${targetId} ` +
      `com ${ballType} | Criatura HP: ${creature.currentHp}/${creature.maxHp}`
    );

    // Delegar processamento para callback que tem acesso ao inventário
    if (this.callbacks.onCaptureResult) {
      this.callbacks.onCaptureResult(intent.playerId, targetId, ballType, {
        success: false,
        captureChance: 0,
        roll: 0,
        failReason: "escaped" // placeholder, será substituído pelo callback real
      });
    }
  }

  /**
   * Retorna o combatState para acesso externo (apenas leitura recomendada).
   * Útil para processar intents que precisam de contexto adicional (ex: inventários).
   */
  public getCombatState(): CombatRoomState {
    return this.combatState;
  }

  /**
   * Remove uma criatura do combatState (usado após captura bem-sucedida).
   */
  public removeCreature(creatureId: string): boolean {
    const index = this.combatState.creatures.findIndex(c => c.id === creatureId);
    if (index !== -1) {
      this.combatState.creatures.splice(index, 1);
      this.debugLog(`Criatura ${creatureId} removida do mundo`);
      return true;
    }
    return false;
  }

  /**
   * Atualiza o estado do mundo (criaturas, projéteis, skill zones, dano de contato).
   */
  private updateWorld(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    // 0. ✅ FASE 9: Atualizar buffs de jogadores e criaturas
    for (const [playerId, player] of this.combatState.players) {
      const buffEffects = updatePlayerBuffs(playerId, player, deltaSeconds);
      // TODO: Broadcast efeitos de poison/regen se houver
    }

    for (const creature of this.combatState.creatures) {
      const buffEffects = updateCreatureBuffs(creature, deltaSeconds);
      // TODO: Broadcast efeitos de poison/regen se houver
    }

    // ✅ 0.5: Atualizar windup de jogadores e executar ataques quando windup termina
    const windupAttackResults = updatePlayerWindups(this.combatState, deltaSeconds);
    // Processar resultados de ataques que foram executados após windup
    if (windupAttackResults.length > 0 && this.callbacks.onAttackAccepted) {
      for (const result of windupAttackResults) {
        if (result.success) {
          this.callbacks.onAttackAccepted(
            result.attackerId!,
            result.targetX ?? 0,
            result.targetY ?? 0,
            true,
            result.projectileId
          );
        }
      }
    }

    // ✅ 0.6: Atualizar windup de skills de jogadores e executar skills quando windup termina
    const windupSkillResults = updatePlayerSkillWindups(
      this.combatState as unknown as SkillRoomState,
      deltaSeconds
    );
    // Processar resultados de skills que foram executadas após windup
    if (windupSkillResults.length > 0 && this.callbacks.onSkillZoneCreated) {
      for (const result of windupSkillResults) {
        if (result.success && result.skillZoneId) {
          // Encontrar a skill zone criada
          const skillZone = this.combatState.skillZones.find(z => z.id === result.skillZoneId);
          if (skillZone) {
            this.callbacks.onSkillZoneCreated(
              skillZone.ownerId,
              skillZone.id,
              result.skillType!,
              skillZone.x,
              skillZone.y
            );
          }
        }
      }
    }

    // 1. Atualizar projéteis e detectar colisões
    const damageResults = updateProjectiles(this.combatState, deltaSeconds);

    // 2. Atualizar IA de criaturas (agora retorna resultados de ataque melee)
    const aiAttackResults = updateCreatureAI(this.combatState, deltaSeconds);

    // 3. Aplicar dano de contato (criaturas tocando jogadores)
    const contactDamageResults = applyContactDamage(this.combatState, deltaSeconds);

    // 4. Atualizar skill zones e aplicar dano periódico
    const skillDamageResults = updateSkillZones(
      this.combatState.skillZones,
      this.combatState.creatures,
      deltaSeconds,
      this.combatState.players // ✅ Passar players para aplicar dano de skill zones de criaturas
    );

    // 5. Consolidar todos os resultados de dano
    for (const aiResult of aiAttackResults) {
      damageResults.push({
        attackerId: aiResult.creatureId,
        targetId: aiResult.playerId,
        damage: aiResult.damage,
        currentHp: aiResult.currentHp,
        maxHp: aiResult.maxHp,
        died: aiResult.died
      });
    }

    damageResults.push(...contactDamageResults);
    damageResults.push(...skillDamageResults);

    // 6. Notificar callbacks sobre dano aplicado
    if (damageResults.length > 0 && this.callbacks.onDamageApplied) {
      this.callbacks.onDamageApplied(damageResults);

      // 7. Verificar mortes de jogadores
      for (const result of damageResults) {
        if (result.died) {
          const player = this.combatState.players.get(result.targetId);
          if (player && this.callbacks.onPlayerDeath) {
            // Encontrar o atacante (dono do projétil que matou)
            this.callbacks.onPlayerDeath(result.targetId, result.attackerId);
            this.debugLog(`Jogador ${result.targetId} foi eliminado por ${result.attackerId}!`);
          }
        }
      }
    }
  }

  /**
   * Verifica condições de fim de partida.
   * 
   * IMPORTANTE: A partida só termina quando o timer chegar a 0.
   * Quando um jogador extrai, apenas ele sai da partida, os outros continuam jogando.
   * A room só será fechada quando:
   * 1. O timer da partida chegar a 0 (esta função)
   * 2. OU quando não houver mais jogadores na sala por 30 segundos (gerenciado no index.ts)
   */
  private checkMatchEnd(): void {
    if (this.matchState !== "in_progress") return;

    const { timeLeft } = this.getMatchTime();

    // ÚNICA condição de fim de partida: tempo esgotado
    // Quando um jogador extrai, apenas ele é desconectado, a partida continua para os outros
    if (timeLeft <= 0) {
      this.setMatchState("finished");
      this.debugLog(`Partida finalizada: tempo esgotado`);
      return;
    }

    // NOTA: Não verificamos se todos os jogadores extraíram aqui.
    // Quando um jogador extrai, apenas ele é desconectado individualmente.
    // A partida continua até o timer chegar a 0, mesmo que todos os jogadores tenham extraído.
  }

  /**
   * Altera o estado da partida.
   */
  private setMatchState(newState: MatchState): void {
    if (newState === this.matchState) return;

    const oldState = this.matchState;
    this.matchState = newState;

    this.debugLog(`Estado da partida: ${oldState} -> ${newState}`);
    this.callbacks.onMatchStateChange(newState, oldState);

    // Se partida finalizou, parar o loop
    if (newState === "finished") {
      this.stop();
    }
  }

  /**
   * Log de debug (só imprime se DEBUG_GAME_LOOP estiver habilitado).
   */
  private debugLog(message: string): void {
    if (DEBUG_GAME_LOOP) {
      console.log(`[GameLoop:${this.roomId}] ${message}`);
    }
  }
}
