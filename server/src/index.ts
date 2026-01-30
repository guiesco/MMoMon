import { WebSocketServer, WebSocket } from "ws";
import { GameLoop, MatchState, AnyIntent } from "./gameLoop";
import {
  MATCH_DURATION_SECONDS,
  EXPEDITION_DURATION_SECONDS,
  MAX_PLAYERS_PER_ROOM,
  DEBUG_GAME_LOOP,
  getMapSpawnConfig
} from "./constants";
import type { WorldState, ServerCreature } from "./types";
import { 
  createEmptyWorldState,
  serializeWorldState,
  createSkillZone
} from "./types";
import { initializeWorldSpawns } from "./systems/spawns";
import { DamageResult, updateSkillZones } from "./systems/combat";
import {
  createAttackResultMessage,
  createPlayerDeathMessage,
  createPlayerMoveMessage,
  createCaptureResultMessage,
  createCreaturesUpdateMessage,
  createResourcesUpdateMessage,
  createProjectilesUpdateMessage,
  createSkillZonesUpdateMessage,
  createExtractionStateMessage,
  createMatchEventMessage,
  type AttackResultMessage,
  type PlayerDeathMessage,
  type PlayerMoveMessage,
  type OutgoingMessage
} from "./messages";
import { 
  type PlayerExpeditionInventory,
  type BallType,
  createExpeditionInventory,
  processCaptureIntent
} from "./systems/capture";
import {
  processExtractionIntent,
  updateExtractions,
  completeExtraction,
  allPlayersExtractedOrDead,
  initializePlayerExtractionData,
  type PlayerExtractionState
} from "./systems/extraction";
import { initializeFirebase, isFirebaseAvailable } from "./firebase";
import { saveExpeditionRewards } from "./firestoreOperations";
import type { SaveExpeditionData } from "./firebaseTypes";

type ClientId = string;

interface PlayerPresence {
  id: ClientId;
  name: string;
  x: number;
  y: number;
  /** ID da criatura ativa do jogador (para visualização e cálculo de dano) */
  activeCreatureId?: string;
  /** Inventário temporário de pokébolas e criaturas capturadas durante a expedição */
  expeditionInventory: PlayerExpeditionInventory;
  /** Progresso de extração (0-100) */
  extractionProgress: number;
  /** Timestamp quando extraiu com sucesso (null se ainda não extraiu) */
  extractedAt: number | null;
  /** Recursos coletados durante a partida */
  resourcesCollected: Map<string, number>;
  /** Número de criaturas capturadas durante a partida */
  creaturesCaptured: number;
  
  // FASE 4C: Propriedades visuais e de ação (sincronizadas com cliente)
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
 * Estados de partida conforme definido no gameLoop.
 */
export { MatchState };

/**
 * Modelo de sala com suporte a game loop.
 */
interface Room {
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
   * Timer para cleanup automático de sala vazia.
   */
  emptyRoomTimer: NodeJS.Timeout | null;
}

interface BaseMessage {
  type: string;
}

interface JoinMessage extends BaseMessage {
  type: "join";
  roomId: string;
  name: string;
}

interface MoveMessage extends BaseMessage {
  type: "move";
  x: number;
  y: number;
}

interface PingMessage extends BaseMessage {
  type: "ping";
}

/**
 * Mensagens de intent planejadas para o futuro.
 */
interface AttackMessage extends BaseMessage {
  type: "attack_basic";
  targetX: number;
  targetY: number;
  creatureId?: string;
  attackType?: "basic" | "special";
}

interface SkillMessage extends BaseMessage {
  type: "use_skill";
  skillType: "fire_fog" | "root_trap" | "electric_surge" | "heal_wave";
  targetX: number;
  targetY: number;
  creatureId?: string;
}

interface CaptureMessage extends BaseMessage {
  type: "capture_attempt";
  targetId: string;
  ballType?: string;
}

interface ResourceInteractMessage extends BaseMessage {
  type: "resource_interact";
  resourceId: string;
}

interface ExtractionMessage extends BaseMessage {
  type: "extraction_request";
  pointId: string;
  action: "start" | "cancel";
}

interface TeamSyncMessage extends BaseMessage {
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

interface ActiveCreatureUpdateMessage extends BaseMessage {
  type: "active_creature_update";
  instanceId: string;
  currentHp: number;
  maxHp: number;
}

type IncomingMessage =
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

// Porta do servidor WebSocket.
// Pode ser sobrescrita via variável de ambiente PORT.
// Por padrão usamos 3003 para evitar conflito com outros serviços locais.
const PORT = Number(process.env.PORT ?? 3003);

const wss = new WebSocketServer({ port: PORT });
const rooms = new Map<string, Room>();

/**
 * Broadcast do estado da sala para todos os clientes conectados.
 */
function broadcastState(room: Room, includeWorld = false): void {
  const matchTime = room.gameLoop?.getMatchTime() ?? {
    elapsedSeconds: Math.floor((Date.now() - room.startedAt) / 1000),
    timeLeft: Math.max(0, room.durationSeconds - Math.floor((Date.now() - room.startedAt) / 1000)),
    durationSeconds: room.durationSeconds
  };

  // Adicionar timestamp a cada jogador para sincronização
  const now = Date.now();
  const playersWithTimestamp = Array.from(room.players.values()).map(p => ({
    ...p,
    lastUpdate: now
  }));

  const message: Record<string, unknown> = {
    type: "state",
    players: playersWithTimestamp,
    match: {
      elapsedSeconds: matchTime.elapsedSeconds,
      timeLeft: matchTime.timeLeft,
      durationSeconds: matchTime.durationSeconds,
      state: room.matchState
    }
  };

  // Incluir worldState apenas no primeiro broadcast ou quando solicitado
  if (includeWorld) {
    message.world = serializeWorldState(room.worldState);
  }

  const payload = JSON.stringify(message);

  for (const ws of room.clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Envia evento de mudança de estado de partida para todos os clientes.
 */
function broadcastMatchEvent(room: Room, event: string, data?: Record<string, unknown>): void {
  const payload = JSON.stringify({
    type: "match_event",
    event,
    matchState: room.matchState,
    ...data
  });

  for (const ws of room.clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Envia mensagem para todos os clientes da sala.
 */
function broadcastMessage(room: Room, message: AttackResultMessage | PlayerDeathMessage | object): void {
  const payload = JSON.stringify(message);

  for (const ws of room.clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Processa o sistema de extração para uma sala.
 * Chamado a cada tick do game loop.
 * 
 * @param room - Sala para processar extração
 * @param deltaMs - Tempo decorrido desde o último tick (em milissegundos)
 */
async function processExtractionSystem(room: Room, deltaMs: number): Promise<void> {
  // Converter Room para RoomForExtraction (interface compatível)
  const roomForExtraction = {
    id: room.id,
    players: room.players,
    extractionPoints: room.worldState.extractionPoints,
    activeExtractions: room.activeExtractions
  };

  // Atualizar progresso de todas as extrações ativas
  const updates = updateExtractions(roomForExtraction, deltaMs);

  // Processar updates e enviar broadcasts
  for (const update of updates) {
    if (update.status === "completed") {
      // Extração completa - calcular recompensas
      const reward = completeExtraction(
        roomForExtraction,
        update.playerId,
        update.pointId
      );

      if (reward) {
        // ✅ FIREBASE: Salvar recompensas no Firestore
        if (isFirebaseAvailable()) {
          try {
            const player = room.players.get(update.playerId);
            if (player) {
              // Preparar dados para salvar
              const expeditionData: SaveExpeditionData = {
                userId: update.playerId, // TODO: Usar Firebase UID real quando autenticação estiver implementada
                mapId: room.id,
                startedAt: new Date(room.startedAt),
                duration: Date.now() - room.startedAt,
                success: true,
                rewards: {
                  resources: reward.resources,
                  capturedCreatures: [] // TODO: Adicionar detalhes das criaturas capturadas
                },
                stats: {
                  damageDealt: 0, // TODO: Rastrear dano causado
                  damageTaken: 0, // TODO: Rastrear dano recebido
                  resourcesCollected: Array.from(reward.resources.values()).reduce((a, b) => a + b, 0),
                  creaturesCaptured: reward.creaturesCaptured
                }
              };

              const saved = await saveExpeditionRewards(expeditionData);

              // Broadcast de extração completa com recompensas
              const message = createExtractionStateMessage(
                update.pointId,
                update.playerId,
                "completed",
                100,
                {
                  resources: Object.fromEntries(reward.resources),
                  creaturesCaptured: reward.creaturesCaptured,
                  savedToCloud: saved // ✅ Indica se foi salvo no Firebase
                }
              );

              broadcastExtractionMessage(room, message);

              if (DEBUG_GAME_LOOP) {
                console.log(
                  `[Room:${room.id}] Jogador ${update.playerId} completou extração: ` +
                  `${reward.creaturesCaptured} criaturas, ${reward.resources.size} tipos de recursos` +
                  (saved ? ' [✅ Salvo no Firebase]' : ' [⚠️  Não salvo - Firebase indisponível]')
                );
              }
            }
          } catch (error) {
            console.error(`[Firebase] Erro ao salvar recompensas para ${update.playerId}:`, error);
            
            // Broadcast mesmo com erro (cliente pode usar fallback localStorage)
            const message = createExtractionStateMessage(
              update.pointId,
              update.playerId,
              "completed",
              100,
              {
                resources: Object.fromEntries(reward.resources),
                creaturesCaptured: reward.creaturesCaptured,
                savedToCloud: false,
                error: "Failed to save to cloud"
              }
            );

            broadcastExtractionMessage(room, message);
          }
        } else {
          // Firebase não disponível - broadcast sem salvamento
          const message = createExtractionStateMessage(
            update.pointId,
            update.playerId,
            "completed",
            100,
            {
              resources: Object.fromEntries(reward.resources),
              creaturesCaptured: reward.creaturesCaptured,
              savedToCloud: false
            }
          );

          broadcastExtractionMessage(room, message);

          if (DEBUG_GAME_LOOP) {
            console.log(
              `[Room:${room.id}] Jogador ${update.playerId} completou extração: ` +
              `${reward.creaturesCaptured} criaturas, ${reward.resources.size} tipos de recursos ` +
              `[⚠️  Firebase não configurado]`
            );
          }
        }
      }
    } else if (update.status === "cancelled") {
      // Extração cancelada
      const message = createExtractionStateMessage(
        update.pointId,
        update.playerId,
        "available",
        0
      );

      broadcastExtractionMessage(room, message);
    } else if (update.status === "in_progress") {
      // Update de progresso (broadcast apenas a cada N ticks para economizar banda)
      // Por exemplo, a cada 20 ticks (1 segundo no tick rate de 20/s)
      const shouldBroadcastProgress = Math.floor(update.progress) % 20 === 0;
      
      if (shouldBroadcastProgress) {
        const message = createExtractionStateMessage(
          update.pointId,
          update.playerId,
          "in_progress",
          update.progress
        );

        broadcastExtractionMessage(room, message);
      }
    }
  }
}

/**
 * Envia mensagem de extração para todos os clientes da sala.
 */
function broadcastExtractionMessage(
  room: Room,
  message: ReturnType<typeof createExtractionStateMessage>
): void {
  const payload = JSON.stringify(message);

  for (const ws of room.clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Cria e configura o game loop para uma sala.
 */
function createGameLoop(room: Room): GameLoop {
  const gameLoop = new GameLoop(room.id, {
    onBroadcastState: () => {
      broadcastState(room);
    },
    onMatchStateChange: (newState, oldState) => {
      room.matchState = newState;
      
      if (DEBUG_GAME_LOOP) {
        console.log(`[Room:${room.id}] Estado da partida: ${oldState} -> ${newState}`);
      }

      // Notificar clientes sobre mudança de estado
      broadcastMatchEvent(room, newState === "finished" ? "finished" : "state_change", {
        timeLeft: room.gameLoop?.getMatchTime().timeLeft ?? 0
      });

      // Se partida finalizou, marcar para cleanup
      if (newState === "finished") {
        handleMatchFinished(room);
      }
    },
    onTick: (tickNumber, deltaMs) => {
      // Processar sistema de extração (async - não bloqueante)
      processExtractionSystem(room, deltaMs).catch(error => {
        console.error(`[Room:${room.id}] Erro no sistema de extração:`, error);
      });
      
      // Processar skill zones (dano por área)
      if (room.gameLoop && room.worldState.skillZones && room.worldState.skillZones.length > 0) {
        const combatState = room.gameLoop.getCombatState();
        const skillZoneDamageResults = updateSkillZones(
          room.worldState.skillZones,
          combatState.creatures,
          deltaMs / 1000 // Converter para segundos
        );
        
        // Broadcast resultados de dano das skill zones
        if (skillZoneDamageResults.length > 0) {
          for (const result of skillZoneDamageResults) {
            const attackResultMsg = createAttackResultMessage(
              result.attackerId,
              result.damage,
              {
                targetId: result.targetId,
                targetHp: result.currentHp,
                targetMaxHp: result.maxHp,
                isCritical: false,
                targetDestroyed: result.died
              }
            );
            broadcastMessage(room, attackResultMsg);
          }
        }
      }
      
      // Verificar se todos jogadores extraíram ou morreram para encerrar antecipadamente
      if (room.matchState === "in_progress") {
        const roomForExtraction = {
          id: room.id,
          players: room.players,
          extractionPoints: room.worldState.extractionPoints,
          activeExtractions: room.activeExtractions
        };
        
        if (allPlayersExtractedOrDead(roomForExtraction)) {
          gameLoop.forceMatchState("finished");
        }
      }
      
      // Broadcast periódico de criaturas (a cada 2 ticks = 100ms para melhor sincronização)
      // Isso sincroniza posições e estados de criaturas para todos os clientes
      if (tickNumber % 2 === 0 && room.gameLoop) {
        const combatState = room.gameLoop.getCombatState();
        if (combatState.creatures.length > 0) {
          const creaturesUpdateMsg = createCreaturesUpdateMessage(
            combatState.creatures.map(c => ({
              id: c.id,
              speciesId: c.creatureType,
              x: c.x,
              y: c.y,
              currentHp: c.currentHp,
              maxHp: c.maxHp,
              state: c.aiState as "idle" | "wandering" | "chasing" | "fleeing" | "stunned",
              // Propriedades de IA para animações e comportamento específico
              tier: c.tier,
              behaviorType: c.behaviorType,
              attackCooldownRemaining: c.attackCooldownRemaining,
              windupTimer: c.windupTimer,
              stunTimer: c.stunTimer,
              patrolOriginX: c.patrolOrigin.x,
              patrolOriginY: c.patrolOrigin.y,
              patrolTimer: c.patrolTimer,
              // ✅ FASE 9: Buffs ativos
              buffs: c.buffs?.map(b => ({
                type: b.type,
                duration: b.duration,
                value: b.value
              }))
            }))
          );
          broadcastMessage(room, creaturesUpdateMsg);
        }
        
        // Broadcast de projéteis ativos (para sincronização visual)
        if (combatState.projectiles.length > 0) {
          const projectilesUpdateMsg = createProjectilesUpdateMessage(
            combatState.projectiles.map(p => ({
              id: p.id,
              ownerId: p.ownerId,
              isPlayerProjectile: p.isPlayerProjectile,
              x: p.x,
              y: p.y,
              startX: p.startX,
              startY: p.startY,
              velocityX: p.velocityX,
              velocityY: p.velocityY,
              damage: p.damage,
              lifetime: p.lifetime,
              maxDistance: p.maxDistance
            }))
          );
          broadcastMessage(room, projectilesUpdateMsg);
        }
        
        // Broadcast de skill zones ativas (para sincronização visual)
        if (room.worldState.skillZones && room.worldState.skillZones.length > 0) {
          const skillZonesUpdateMsg = createSkillZonesUpdateMessage(
            room.worldState.skillZones.map(z => ({
              id: z.id,
              ownerId: z.ownerId,
              skillType: z.skillType,
              x: z.x,
              y: z.y,
              radius: z.radius,
              lifetime: z.lifetime
            }))
          );
          broadcastMessage(room, skillZonesUpdateMsg);
        }
      }
      
      // Debug periódico
      if (DEBUG_GAME_LOOP && tickNumber % 100 === 0) {
        console.log(`[Room:${room.id}] Tick ${tickNumber}, ${room.players.size} jogadores`);
      }
    },
    onDamageApplied: (results: DamageResult[]) => {
      // Broadcast de resultados de dano para todos os clientes
      let anyCreatureDied = false;
      
      for (const result of results) {
        // Verificar se é jogador ou criatura
        const isPlayerTarget = room.players.has(result.targetId);
        
        const message = createAttackResultMessage(
          result.attackerId,
          result.damage,
          {
            targetId: result.targetId,
            targetHp: result.currentHp,
            targetMaxHp: result.maxHp,
            targetDestroyed: result.died
          }
        );

        broadcastMessage(room, message);

        if (DEBUG_GAME_LOOP) {
          const targetType = isPlayerTarget ? "jogador" : "criatura";
          console.log(
            `[Room:${room.id}] Dano aplicado: ${result.damage} de ${result.attackerId} em ${targetType} ${result.targetId} ` +
            `(HP: ${result.currentHp}/${result.maxHp}${result.died ? " - MORTO" : ""})`
          );
        }
        
        // Marcar se alguma criatura morreu
        if (!isPlayerTarget && result.died) {
          anyCreatureDied = true;
        }
      }
      
      // Se alguma criatura morreu, enviar update de criaturas
      if (anyCreatureDied && room.gameLoop) {
        const combatState = room.gameLoop.getCombatState();
        const creaturesUpdateMsg = createCreaturesUpdateMessage(
          combatState.creatures.map(c => ({
            id: c.id,
            speciesId: c.creatureType,
            x: c.x,
            y: c.y,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            state: c.aiState as "idle" | "wandering" | "chasing" | "fleeing" | "stunned",
            // Propriedades de IA para animações e comportamento específico
            tier: c.tier,
            behaviorType: c.behaviorType,
            attackCooldownRemaining: c.attackCooldownRemaining,
            windupTimer: c.windupTimer,
            stunTimer: c.stunTimer,
            patrolOriginX: c.patrolOrigin.x,
            patrolOriginY: c.patrolOrigin.y,
            patrolTimer: c.patrolTimer,
            // ✅ FASE 9: Buffs ativos
            buffs: c.buffs?.map(b => ({
              type: b.type,
              duration: b.duration,
              value: b.value
            }))
          }))
        );
        broadcastMessage(room, creaturesUpdateMsg);
      }
    },
    onPlayerDeath: (playerId: string, killedBy: string) => {
      const message = createPlayerDeathMessage(
        playerId,
        "creature_attack",
        killedBy
      );

      broadcastMessage(room, message);

      if (DEBUG_GAME_LOOP) {
        console.log(`[Room:${room.id}] Jogador ${playerId} foi eliminado por ${killedBy}`);
      }
    },
    onCaptureResult: (playerId: string, targetId: string, _placeholderResult) => {
      // Este callback é chamado quando uma tentativa de captura é processada
      // Vamos processar a captura completa aqui, já que temos acesso ao inventário
      
      const player = room.players.get(playerId);
      const combatState = gameLoop.getCombatState();
      const creature = combatState.creatures.find(c => c.id === targetId);

      if (!player || !creature) {
        if (DEBUG_GAME_LOOP) {
          console.log(`[Room:${room.id}] Captura falhou: jogador ou criatura não encontrados`);
        }
        return;
      }

      // Processar captura com acesso ao inventário
      const result = processCaptureIntent(
        playerId,
        player.x,
        player.y,
        creature,
        "poke-ball-basic" as BallType, // TODO: pegar do intent
        player.expeditionInventory,
        player // Passar objeto player para atualizar contador
      );

      // Se sucesso, remover criatura do mundo
      if (result.success) {
        gameLoop.removeCreature(targetId);
        
        // Broadcast atualização de criaturas
        const creaturesUpdateMsg = createCreaturesUpdateMessage(
          combatState.creatures.map(c => ({
            id: c.id,
            speciesId: c.creatureType,
            x: c.x,
            y: c.y,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            state: c.aiState as "idle" | "wandering" | "chasing" | "fleeing" | "stunned",
            // Propriedades de IA para animações e comportamento específico
            tier: c.tier,
            behaviorType: c.behaviorType,
            attackCooldownRemaining: c.attackCooldownRemaining,
            windupTimer: c.windupTimer,
            stunTimer: c.stunTimer,
            patrolOriginX: c.patrolOrigin.x,
            patrolOriginY: c.patrolOrigin.y,
            patrolTimer: c.patrolTimer,
            // ✅ FASE 9: Buffs ativos
            buffs: c.buffs?.map(b => ({
              type: b.type,
              duration: b.duration,
              value: b.value
            }))
          }))
        );
        broadcastMessage(room, creaturesUpdateMsg);
      }

      // Broadcast resultado da captura
      const captureMsg = createCaptureResultMessage(
        playerId,
        targetId,
        result.success,
        result.captureChance,
        result.roll,
        {
          capturedCreature: result.capturedCreature ? {
            instanceId: result.capturedCreature.instanceId,
            speciesId: result.capturedCreature.speciesId,
            level: result.capturedCreature.level
          } : undefined,
          failReason: result.failReason
        }
      );
      broadcastMessage(room, captureMsg);

      if (DEBUG_GAME_LOOP) {
        if (result.success) {
          console.log(
            `[Room:${room.id}] ✓ Captura bem-sucedida! Jogador ${playerId} capturou ` +
            `${result.capturedCreature?.speciesId} (chance: ${(result.captureChance * 100).toFixed(1)}%)`
          );
        } else {
          console.log(
            `[Room:${room.id}] ✗ Captura falhou! Jogador ${playerId} não capturou ${targetId} ` +
            `(chance: ${(result.captureChance * 100).toFixed(1)}%, roll: ${(result.roll * 100).toFixed(1)}%)`
          );
        }
      }
    },
    onCreatureRemoved: (creatureId: string) => {
      if (DEBUG_GAME_LOOP) {
        console.log(`[Room:${room.id}] Criatura ${creatureId} removida do mundo`);
      }
    },
    onSkillUsed: (playerId: string, skillType, targetX, targetY, creatureId) => {
      // Configurações por tipo de skill
      let zone;
      switch (skillType) {
        case "fire_fog": // Pyrognat - Nevoeiro Incendiário
          zone = createSkillZone(
            playerId,
            "fire_fog",
            targetX,
            targetY,
            70,  // radius
            8,   // damagePerTick
            0.5, // tickInterval (0.5s)
            4,   // lifetime (4s)
            0.3  // slowModifier (30% mais lento)
          );
          break;
          
        case "root_trap": // Verdant - Raízes Prendentes
          zone = createSkillZone(
            playerId,
            "root_trap",
            targetX,
            targetY,
            60,  // radius
            5,   // damagePerTick (menor que fire_fog)
            0.5, // tickInterval
            3,   // lifetime (3s - mais curto)
            0.7  // slowModifier (70% mais lento - efeito maior)
          );
          break;
          
        case "electric_surge": // Voltiger - Surto Elétrico
          zone = createSkillZone(
            playerId,
            "electric_surge",
            targetX,
            targetY,
            80,  // radius (maior área)
            12,  // damagePerTick (alto dano)
            0.3, // tickInterval (ticks mais rápidos)
            2,   // lifetime (2s - explosão rápida)
            0    // sem slow
          );
          break;
          
        case "heal_wave": // Aquaryl - Maré Curativa (não cria zona de dano)
          // Heal é processado no cliente (cura o próprio jogador)
          // Não cria zona de skill no servidor
          if (DEBUG_GAME_LOOP) {
            console.log(`[Room:${room.id}] Jogador ${playerId} usou Maré Curativa (heal)`);
          }
          return;
      }
      
      // Adicionar zona ao worldState
      room.worldState.skillZones.push(zone);
      
      if (DEBUG_GAME_LOOP) {
        console.log(
          `[Room:${room.id}] Skill ${skillType} criada por ${playerId} em (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`
        );
      }
    },
    onResourceCollected: (playerId: string, resourceId: string, resourceType: string, quantity: number) => {
      // Broadcast remoção do recurso para todos os clientes
      const fullState = gameLoop.getFullState();
      const resourcesUpdateMsg = createResourcesUpdateMessage(
        fullState.resources.map(r => ({
          id: r.id,
          type: r.resourceType,
          x: r.x,
          y: r.y,
          amount: r.quantity
        }))
      );
      broadcastMessage(room, resourcesUpdateMsg);

      if (DEBUG_GAME_LOOP) {
        console.log(
          `[Room:${room.id}] Recurso coletado: jogador ${playerId} coletou ${quantity}x ${resourceType} (${resourceId})`
        );
      }
    },
    onSkillZoneCreated: (playerId: string, skillZoneId: string, skillType: string, x: number, y: number) => {
      // Broadcast criação da skill zone para todos os clientes
      const fullState = gameLoop.getFullState();
      const skillZonesUpdateMsg = createSkillZonesUpdateMessage(
        fullState.skillZones.map(z => ({
          id: z.id,
          ownerId: z.ownerId,
          skillType: z.skillType,
          x: z.x,
          y: z.y,
          radius: z.radius,
          lifetime: z.lifetime
        }))
      );
      broadcastMessage(room, skillZonesUpdateMsg);

      if (DEBUG_GAME_LOOP) {
        console.log(
          `[Room:${room.id}] Skill zone criada: ${skillZoneId} (${skillType}) por ${playerId} em (${x.toFixed(0)}, ${y.toFixed(0)})`
        );
      }
    }
  });

  gameLoop.setDuration(room.durationSeconds);
  return gameLoop;
}

/**
 * Handler para quando uma partida termina.
 */
function handleMatchFinished(room: Room): void {
  if (DEBUG_GAME_LOOP) {
    console.log(`[Room:${room.id}] Partida finalizada. Jogadores: ${room.players.size}`);
  }

  // TODO: Persistir resultados da partida
  // TODO: Calcular e enviar recompensas para cada jogador
  // TODO: Dar tempo para clientes verem resultado antes de limpar sala
}

/**
 * Obtém ou cria uma sala.
 */
function getOrCreateRoom(id: string): Room {
  let room = rooms.get(id);
  if (!room) {
    // Cria estado de mundo vazio
    const worldState = createEmptyWorldState();
    
    // Obtém configuração do mapa e inicializa spawns
    const mapConfig = getMapSpawnConfig(id);
    
    // Gera seed baseado no timestamp (pode ser customizado no futuro para partidas determinísticas)
    const seed = Date.now();
    
    console.log(`[Server] Criando sala "${id}"...`);
    initializeWorldSpawns(worldState, mapConfig, seed);
    
    room = {
      id,
      clients: new Map(),
      players: new Map(),
      startedAt: Date.now(),
      durationSeconds: EXPEDITION_DURATION_SECONDS,
      gameLoop: null,
      matchState: "waiting",
      worldState,
      activeExtractions: new Map(),
      emptyRoomTimer: null
    };
    rooms.set(id, room);

    console.log(`[Server] ✓ Sala "${id}" criada e populada com spawns`);
  }
  return room;
}

/**
 * Inicia o game loop de uma sala se ainda não estiver rodando.
 */
function startRoomGameLoop(room: Room): void {
  if (!room.gameLoop) {
    room.gameLoop = createGameLoop(room);
    
    // Adicionar criaturas do worldState ao combatState do game loop
    for (const creature of room.worldState.creatures) {
      room.gameLoop.addCreature(creature);
    }
    
    // Adicionar recursos do worldState ao combatState do game loop
    for (const resource of room.worldState.resources) {
      room.gameLoop.addResource(resource);
    }
    
    if (DEBUG_GAME_LOOP) {
      console.log(
        `[Room:${room.id}] ${room.worldState.creatures.length} criaturas e ` +
        `${room.worldState.resources.length} recursos adicionados ao combatState`
      );
    }
  }

  if (!room.gameLoop.isRunning() && room.matchState !== "finished") {
    room.startedAt = Date.now();
    room.gameLoop.start();

    if (DEBUG_GAME_LOOP) {
      console.log(`[Room:${room.id}] Game loop iniciado`);
    }
  }
}

/**
 * Para o game loop de uma sala quando fica vazia.
 */
function stopRoomGameLoop(room: Room): void {
  if (room.gameLoop) {
    room.gameLoop.stop();
    room.gameLoop = null;

    if (DEBUG_GAME_LOOP) {
      console.log(`[Room:${room.id}] Game loop parado (sala vazia)`);
    }
  }
}

/**
 * Limpa e remove uma sala do servidor completamente.
 * - Para o game loop
 * - Desconecta todos os clientes com mensagem de erro
 * - Remove a sala do Map `rooms`
 * - Limpa todas as referências incluindo timers
 */
function cleanupRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  if (DEBUG_GAME_LOOP) {
    console.log(`[Server] Iniciando cleanup da sala: ${roomId}`);
  }

  // Parar game loop
  stopRoomGameLoop(room);

  // Cancelar timer de cleanup se existir
  if (room.emptyRoomTimer) {
    clearTimeout(room.emptyRoomTimer);
    room.emptyRoomTimer = null;
  }

  // Desconectar todos os clientes com mensagem de encerramento
  room.clients.forEach((ws, clientId) => {
    try {
      ws.send(JSON.stringify({
        type: "error",
        reason: "room_cleanup",
        message: "Sala foi encerrada"
      }));
      ws.close();
    } catch (error) {
      console.error(`[Server] Erro ao desconectar cliente ${clientId}:`, error);
    }
  });

  // Limpar estado do mundo
  room.worldState.creatures = [];
  room.worldState.resources = [];
  room.worldState.extractionPoints = [];
  room.worldState.projectiles = [];

  // Limpar jogadores e clientes
  room.players.clear();
  room.clients.clear();
  room.activeExtractions.clear();

  // Remover do Map global
  rooms.delete(roomId);

  if (DEBUG_GAME_LOOP) {
    console.log(`[Server] ✓ Sala removida completamente: ${roomId}`);
  }
}

/**
 * Remove uma sala do servidor completamente.
 * @deprecated Use cleanupRoom() ao invés desta função.
 */
function removeRoom(roomId: string): void {
  cleanupRoom(roomId);
}

/**
 * Enfileira um intent no game loop da sala.
 */
function queueIntent(room: Room, playerId: string, intent: AnyIntent): void {
  if (room.gameLoop && room.matchState === "in_progress") {
    room.gameLoop.queueIntent(intent);
  }
}

/**
 * Converte mensagem de movimento em intent.
 */
function createMoveIntent(playerId: string, msg: MoveMessage): AnyIntent {
  return {
    playerId,
    type: "move",
    timestamp: Date.now(),
    data: { x: msg.x, y: msg.y }
  };
}

/**
 * Converte mensagem de ataque em intent.
 */
function createAttackIntent(playerId: string, msg: AttackMessage): AnyIntent {
  return {
    playerId,
    type: "attack",
    timestamp: Date.now(),
    data: { 
      targetX: msg.targetX, 
      targetY: msg.targetY,
      creatureId: msg.creatureId,
      attackType: msg.attackType
    }
  };
}

/**
 * Cria um intent de uso de skill especial.
 */
function createSkillIntent(playerId: string, msg: SkillMessage): AnyIntent {
  return {
    playerId,
    type: "skill",
    timestamp: Date.now(),
    data: {
      skillType: msg.skillType,
      targetX: msg.targetX,
      targetY: msg.targetY,
      creatureId: msg.creatureId
    }
  };
}

/**
 * Mapeia tipos de pokébola do cliente para o formato do servidor.
 */
function mapBallType(clientBallType: string | undefined): string {
  const mapping: Record<string, string> = {
    "pokeball": "poke-ball-basic",
    "greatball": "poke-ball-precisa",
    "ultraball": "poke-ball-ultra",
    "masterball": "poke-ball-ultra", // masterball não existe no servidor, usa ultra
    "poke-ball-basic": "poke-ball-basic",
    "poke-ball-precisa": "poke-ball-precisa",
    "poke-ball-ultra": "poke-ball-ultra"
  };
  return mapping[clientBallType ?? "pokeball"] ?? "poke-ball-basic";
}

/**
 * Converte mensagem de captura em intent.
 */
function createCaptureIntent(playerId: string, msg: CaptureMessage): AnyIntent {
  return {
    playerId,
    type: "capture",
    timestamp: Date.now(),
    data: { 
      targetId: msg.targetId,
      ballType: mapBallType(msg.ballType)
    }
  };
}

/**
 * Converte mensagem de coleta de recurso em intent.
 */
function createResourceIntent(playerId: string, msg: ResourceInteractMessage): AnyIntent {
  return {
    playerId,
    type: "resource",
    timestamp: Date.now(),
    data: { resourceId: msg.resourceId }
  };
}

/**
 * Converte mensagem de extração em intent.
 */
function createExtractionIntent(playerId: string, msg: ExtractionMessage): AnyIntent {
  return {
    playerId,
    type: "extraction",
    timestamp: Date.now(),
    data: { pointId: msg.pointId, action: msg.action }
  };
}

wss.on("connection", (ws) => {
  const clientId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  let currentRoom: Room | null = null;

  if (DEBUG_GAME_LOOP) {
    console.log(`[Server] Cliente conectado: ${clientId}`);
  }

  ws.on("message", (data) => {
    let msg: IncomingMessage;
    try {
      msg = JSON.parse(data.toString()) as IncomingMessage;
    } catch {
      return;
    }

    if (msg.type === "join") {
      // Verificar se já existe uma sala com este ID
      let existingRoom = rooms.get(msg.roomId);
      
      // Se a partida terminou, SEMPRE criar nova sala
      if (existingRoom && existingRoom.matchState === "finished") {
        if (DEBUG_GAME_LOOP) {
          console.log(`[Server] Sala ${msg.roomId} terminou, limpando e criando nova...`);
        }
        // Limpar sala antiga completamente (desconecta clientes, para loop, etc)
        cleanupRoom(msg.roomId);
        existingRoom = undefined;
      }
      
      // Cancelar timer de cleanup se a sala existir e estiver vazia
      if (existingRoom?.emptyRoomTimer) {
        if (DEBUG_GAME_LOOP) {
          console.log(`[Server] Cancelando timer de cleanup da sala ${msg.roomId}`);
        }
        clearTimeout(existingRoom.emptyRoomTimer);
        existingRoom.emptyRoomTimer = null;
      }
      
      // Obter ou criar sala
      let room = existingRoom ?? getOrCreateRoom(msg.roomId);

      // Verificar se sala está cheia
      if (room.clients.size >= MAX_PLAYERS_PER_ROOM) {
        ws.send(JSON.stringify({ type: "error", reason: "room_full" }));
        return;
      }

      currentRoom = room;
      room.clients.set(clientId, ws);
      
      // Criar jogador com dados inicializados
      const newPlayer: PlayerPresence = {
        id: clientId,
        name: msg.name,
        x: Math.random() * 800 + 80,
        y: Math.random() * 400 + 80,
        expeditionInventory: createExpeditionInventory(),
        extractionProgress: 0,
        extractedAt: null,
        resourcesCollected: new Map(),
        creaturesCaptured: 0
      };
      
      // Inicializar dados de extração
      initializePlayerExtractionData(newPlayer);
      
      room.players.set(clientId, newPlayer);

      // Iniciar game loop se for o primeiro jogador (ou retomar se já existe)
      if (room.players.size === 1 || !room.gameLoop?.isRunning()) {
        startRoomGameLoop(room);
      }

      // Registrar jogador no sistema de combate do game loop
      if (room.gameLoop) {
        room.gameLoop.registerPlayer(
          clientId,
          newPlayer.x,
          newPlayer.y,
          100, // HP inicial
          100  // HP máximo
        );
      }

      // Enviar confirmação de join com ID do cliente e posição inicial
      ws.send(JSON.stringify({
        type: "joined",
        clientId,
        roomId: room.id,
        matchState: room.matchState,
        initialPosition: {
          x: newPlayer.x,
          y: newPlayer.y
        }
      }));

      // Broadcast inicial inclui worldState para sincronizar spawns
      // E notifica TODOS os jogadores (incluindo existentes) sobre o novo jogador
      broadcastState(room, true);
      
      console.log(`[Server] Jogador ${msg.name} (${clientId}) entrou na sala ${room.id} | Total: ${room.players.size} jogadores`);
      return;
    }

    if (!currentRoom) return;

    // Debug: Log de mensagens recebidas (a cada 50 mensagens para não poluir)
    const DEBUG_MESSAGES = true;
    
    switch (msg.type) {
      case "move": {
        const player = currentRoom.players.get(clientId);
        if (!player) return;

        // Log de movimento (a cada 20 movimentos)
        if (DEBUG_MESSAGES && Math.random() < 0.05) {
          console.log(`[Move] ${clientId.slice(0, 8)}... -> (${msg.x.toFixed(0)}, ${msg.y.toFixed(0)})`);
        }

        // Atualizar posição imediatamente (para broadcast)
        player.x = msg.x;
        player.y = msg.y;

        // Atualizar posição no combatState do game loop
        if (currentRoom.gameLoop) {
          currentRoom.gameLoop.updatePlayerPosition(clientId, msg.x, msg.y);
        }

        // Também enfileirar como intent para processamento do game loop
        queueIntent(currentRoom, clientId, createMoveIntent(clientId, msg));

        // Enviar mensagem específica de movimento para todos os clientes
        // Isso é mais eficiente que broadcast completo e mais responsivo
        const moveMsg = createPlayerMoveMessage(clientId, msg.x, msg.y);
        broadcastMessage(currentRoom, moveMsg);
        break;
      }

      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;

      case "team_sync": {
        const player = currentRoom.players.get(clientId);
        if (!player) return;
        
        // Armazenar dados do time do jogador
        const creatures = msg.creatures as Array<{
          instanceId: string;
          definitionId: string;
          level: number;
          currentHp: number;
          maxHp: number;
          rank?: number;
        }>;
        
        const activeCreatureId = msg.activeCreatureInstanceId as string | null;
        
        // Atualizar criatura ativa do jogador
        if (activeCreatureId) {
          player.activeCreatureId = activeCreatureId;
          
          // Atualizar HP do jogador no sistema de combate baseado na criatura ativa
          const activeCreature = creatures.find(c => c.instanceId === activeCreatureId);
          if (activeCreature && currentRoom.gameLoop) {
            currentRoom.gameLoop.updatePlayerHp(clientId, activeCreature.currentHp, activeCreature.maxHp);
          }
        }
        
        console.log(`[Team Sync] Jogador ${clientId.slice(0, 8)}... sincronizou ${creatures.length} criaturas, ativa: ${activeCreatureId?.slice(0, 8) || 'nenhuma'}`);
        break;
      }

      case "active_creature_update": {
        const player = currentRoom.players.get(clientId);
        if (!player) return;
        
        const instanceId = msg.instanceId as string;
        const currentHp = msg.currentHp as number;
        const maxHp = msg.maxHp as number;
        
        // Atualizar criatura ativa do jogador
        player.activeCreatureId = instanceId;
        
        // Atualizar HP do jogador no sistema de combate
        if (currentRoom.gameLoop) {
          currentRoom.gameLoop.updatePlayerHp(clientId, currentHp, maxHp);
        }
        
        if (DEBUG_MESSAGES && Math.random() < 0.2) {
          console.log(`[Active Creature] Jogador ${clientId.slice(0, 8)}... trocou para ${instanceId.slice(0, 8)}... (${currentHp}/${maxHp} HP)`);
        }
        break;
      }

      case "attack_basic":
        queueIntent(currentRoom, clientId, createAttackIntent(clientId, msg));
        break;

      case "use_skill":
        queueIntent(currentRoom, clientId, createSkillIntent(clientId, msg));
        break;

      case "capture_attempt":
        queueIntent(currentRoom, clientId, createCaptureIntent(clientId, msg));
        break;

      case "resource_interact":
        queueIntent(currentRoom, clientId, createResourceIntent(clientId, msg));
        break;

      case "extraction_request": {
        console.log(`[Extraction] Recebido pedido de ${msg.action} para ponto ${msg.pointId} do jogador ${clientId.slice(0, 8)}...`);
        
        // Processar intent de extração imediatamente (não enfileirar)
        const roomForExtraction = {
          id: currentRoom.id,
          players: currentRoom.players,
          extractionPoints: currentRoom.worldState.extractionPoints,
          activeExtractions: currentRoom.activeExtractions
        };

        const success = processExtractionIntent(
          roomForExtraction,
          clientId,
          {
            playerId: clientId,
            pointId: msg.pointId,
            action: msg.action
          }
        );

        console.log(`[Extraction] Pedido processado: ${success ? 'SUCESSO' : 'FALHOU'}`);

        if (success && msg.action === "start") {
          // Enviar confirmação de início de extração
          const message = createExtractionStateMessage(
            msg.pointId,
            clientId,
            "in_progress",
            0
          );
          console.log(`[Extraction] Enviando confirmação ao cliente`);
          ws.send(JSON.stringify(message));
        }
        break;
      }
    }
  });

  ws.on("close", () => {
    if (DEBUG_GAME_LOOP) {
      console.log(`[Server] Cliente desconectado: ${clientId}`);
    }

    if (!currentRoom) return;

    // Desregistrar jogador do sistema de combate
    if (currentRoom.gameLoop) {
      currentRoom.gameLoop.unregisterPlayer(clientId);
    }

    currentRoom.clients.delete(clientId);
    currentRoom.players.delete(clientId);
    
    console.log(`[Server] Jogador removido: ${clientId}. Jogadores restantes: ${currentRoom.players.size}`);

    // Se sala ficou vazia, iniciar timer de cleanup
    if (currentRoom.clients.size === 0) {
      stopRoomGameLoop(currentRoom);
      
      // Remover sala imediatamente se partida já terminou
      if (currentRoom.matchState === "finished") {
        if (DEBUG_GAME_LOOP) {
          console.log(`[Server] Sala ${currentRoom.id} vazia e partida terminada, removendo imediatamente`);
        }
        cleanupRoom(currentRoom.id);
      } else {
        // Iniciar timer de 30 segundos para remover sala vazia
        const roomId = currentRoom.id; // Capturar roomId para uso no timeout
        if (DEBUG_GAME_LOOP) {
          console.log(`[Server] Sala ${roomId} vazia, iniciando timer de cleanup (30s)`);
        }
        currentRoom.emptyRoomTimer = setTimeout(() => {
          // Verificar se sala ainda existe e está vazia
          const room = rooms.get(roomId);
          if (room && room.clients.size === 0) {
            if (DEBUG_GAME_LOOP) {
              console.log(`[Server] Timer expirado, removendo sala vazia: ${roomId}`);
            }
            cleanupRoom(roomId);
          }
        }, 30000); // 30 segundos
      }
    } else {
      console.log(`[Server] Broadcasting state para ${currentRoom.clients.size} clientes. Jogadores na lista: ${Array.from(currentRoom.players.keys()).map(id => id.slice(0, 8)).join(', ')}`);
      broadcastState(currentRoom);
    }
  });
});

// ============================================================================
// INICIALIZAR FIREBASE
// ============================================================================
console.log('\n=== Inicializando Firebase ===');
initializeFirebase();
if (isFirebaseAvailable()) {
  console.log('✅ Firebase configurado - dados serão persistidos na nuvem');
} else {
  console.log('⚠️  Firebase não disponível - dados não serão persistidos');
  console.log('ℹ️  Para habilitar Firebase, configure firebase-service-account.json');
}

// Iniciar servidor HTTP para sincronização
import { startHttpServer } from './httpServer';
const HTTP_PORT = 3004;
startHttpServer(HTTP_PORT);

console.log('\n=== Servidor WebSocket ===');
console.log(`PokéExtract WebSocket server listening on ws://localhost:${PORT}`);
console.log(`Debug mode: ${DEBUG_GAME_LOOP ? "ENABLED" : "disabled"}`);
console.log(`Tick rate: 20 ticks/second, State broadcast: every 3 ticks`);
