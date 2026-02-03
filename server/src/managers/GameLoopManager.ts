/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Game Loop Manager - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Gerencia criação e configuração do game loop para salas.
 * 
 * @module server/managers/GameLoopManager
 */

import { WebSocket } from "ws";
import { GameLoop, type GameLoopCallbacks, type MatchState } from "../gameLoop";
import type { DamageResult } from "../systems/combat";
import type { Room } from "../types/ServerTypes";
import { createSkillZone } from "../types";
import { updateSkillZones } from "../systems/combat";
import { processCaptureIntent, type BallType } from "../systems/capture";
import { allPlayersExtractedOrDead, processExtractionIntent } from "../systems/extraction";
import { processExtractionSystem } from "../handlers/ExtractionHandler";
import {
  createAttackResultMessage,
  createPlayerDeathMessage,
  createCaptureResultMessage,
  createCreaturesUpdateMessage,
  createResourcesUpdateMessage,
  createProjectilesUpdateMessage,
  createSkillZonesUpdateMessage
} from "../messages";
import { StateBroadcaster } from "../broadcast/StateBroadcaster";
import { DEBUG_GAME_LOOP } from "../constants";
import { isFirebaseAvailable, getDb, FieldValue } from "../firebase";
import type { ExpeditionDocument } from "../firebaseTypes";

/**
 * Cria e configura o game loop para uma sala.
 */
export function createGameLoop(room: Room): GameLoop {
  const callbacks = createGameLoopCallbacks(room);
  const gameLoop = new GameLoop(room.id, callbacks);
  gameLoop.setDuration(room.durationSeconds);
  return gameLoop;
}

/**
 * Cria os callbacks do game loop para uma sala.
 */
function createGameLoopCallbacks(room: Room): GameLoopCallbacks {
  return {
    onBroadcastState: () => {
      StateBroadcaster.broadcastState(room);
    },

    onMatchStateChange: (newState: MatchState, oldState: MatchState) => {
      room.matchState = newState;
      
      if (DEBUG_GAME_LOOP) {
        console.log(`[Room:${room.id}] Estado da partida: ${oldState} -> ${newState}`);
      }

      // Notificar clientes sobre mudança de estado
      StateBroadcaster.broadcastMatchEvent(
        room,
        newState === "finished" ? "finished" : "state_change",
        {
          timeLeft: room.gameLoop?.getMatchTime().timeLeft ?? 0
        }
      );

      // Se partida finalizou, marcar para cleanup
      if (newState === "finished") {
        handleMatchFinished(room);
      }
    },

    onTick: (tickNumber: number, deltaMs: number) => {
      // IMPORTANTE: Processar sistema de extração ANTES de verificar fim de partida
      // Isso garante que extraction_state completed seja enviado antes de match_event finished
      // Usar then() para garantir ordem de execução sem bloquear o tick
      processExtractionSystem(room, deltaMs)
        .then(() => {
          // Verificar se todos jogadores extraíram ou morreram para encerrar antecipadamente
          // IMPORTANTE: Isso é feito DEPOIS de processar extrações para garantir ordem correta
          if (room.matchState === "in_progress") {
            const roomForExtraction = {
              id: room.id,
              players: room.players,
              extractionPoints: room.worldState.extractionPoints,
              activeExtractions: room.activeExtractions
            };
            
            if (allPlayersExtractedOrDead(roomForExtraction)) {
              room.gameLoop?.forceMatchState("finished");
            }
          }
        })
        .catch(error => {
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
            StateBroadcaster.broadcastMessage(room, attackResultMsg);
          }
        }
      }
      
      // Broadcast periódico de criaturas (a cada 2 ticks = 100ms para melhor sincronização)
      if (tickNumber % 2 === 0 && room.gameLoop) {
        broadcastGameStateUpdates(room);
      }
      
      // Debug periódico
      if (DEBUG_GAME_LOOP && tickNumber % 100 === 0) {
        console.log(`[Room:${room.id}] Tick ${tickNumber}, ${room.players.size} jogadores`);
      }
    },

    onAttackAccepted: (playerId: string, targetX: number, targetY: number, success: boolean, projectileId?: string, failReason?: string) => {
      handleAttackAccepted(room, playerId, targetX, targetY, success, projectileId, failReason);
    },

    onDamageApplied: (results: DamageResult[]) => {
      handleDamageApplied(room, results);
    },

    onPlayerDeath: async (playerId: string, killedBy: string) => {
      const message = createPlayerDeathMessage(
        playerId,
        "creature_attack",
        killedBy
      );

      StateBroadcaster.broadcastMessage(room, message);

      if (DEBUG_GAME_LOOP) {
        console.log(`[Room:${room.id}] Jogador ${playerId} foi eliminado por ${killedBy}`);
      }

      // Salvar itens gastos quando jogador morre
      await handlePlayerDeath(room, playerId);
    },

    onCaptureResult: (playerId: string, targetId: string, ballType: BallType, _placeholderResult) => {
      handleCaptureResult(room, playerId, targetId, ballType);
    },

    onCreatureRemoved: (creatureId: string) => {
      if (DEBUG_GAME_LOOP) {
        console.log(`[Room:${room.id}] Criatura ${creatureId} removida do mundo`);
      }
    },

    onSkillUsed: (playerId: string, skillType, targetX, targetY, creatureId) => {
      handleSkillUsed(room, playerId, skillType, targetX, targetY, creatureId);
    },

    onResourceCollected: (playerId: string, resourceId: string, resourceType: string, quantity: number) => {
      handleResourceCollected(room, playerId, resourceId, resourceType, quantity);
    },

    onSkillZoneCreated: (playerId: string, skillZoneId: string, skillType: string, x: number, y: number) => {
      handleSkillZoneCreated(room, playerId, skillZoneId, skillType, x, y);
    },

    onExtractionIntent: (playerId: string, pointId: string, action: "start" | "cancel") => {
      handleExtractionIntent(room, playerId, pointId, action);
    }
  };
}

/**
 * Handler para quando uma partida termina.
 */
function handleMatchFinished(room: Room): void {
  if (DEBUG_GAME_LOOP) {
    console.log(`[Room:${room.id}] Partida finalizada. Jogadores: ${room.players.size}`);
  }

  // Nota: A persistência de recompensas é feita individualmente quando cada jogador completa a extração
  // (ver handleExtractionCompleted em ExtractionHandler.ts). Quando a partida termina por tempo esgotado,
  // apenas os jogadores que extraíram antes do fim têm recompensas para persistir.
  // Os jogadores que não extraíram perdem tudo (mecânica do jogo).
  
  // O broadcast do evento "finished" já notifica os clientes sobre o fim da partida
  // (feito em onMatchStateChange acima). Os clientes têm tempo para processar antes
  // da sala ser limpa (gerenciado pelo RoomManager).
}

/**
 * Broadcast atualizações periódicas de estado do jogo.
 */
function broadcastGameStateUpdates(room: Room): void {
  if (!room.gameLoop) return;

  const combatState = room.gameLoop.getCombatState();
  
  // Broadcast de criaturas
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
        tier: c.tier,
        behaviorType: c.behaviorType,
        attackCooldownRemaining: c.attackCooldownRemaining,
        windupTimer: c.windupTimer,
        stunTimer: c.stunTimer,
        patrolOriginX: c.patrolOrigin.x,
        patrolOriginY: c.patrolOrigin.y,
        patrolTimer: c.patrolTimer,
        buffs: c.buffs?.map(b => ({
          type: b.type,
          duration: b.duration,
          value: b.value
        }))
      }))
    );
    StateBroadcaster.broadcastMessage(room, creaturesUpdateMsg);
  }
  
  // Broadcast de projéteis ativos
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
    StateBroadcaster.broadcastMessage(room, projectilesUpdateMsg);
  }
  
  // Broadcast de skill zones ativas
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
    StateBroadcaster.broadcastMessage(room, skillZonesUpdateMsg);
  }
}

/**
 * Handler para ataque aceito/rejeitado.
 */
function handleAttackAccepted(
  room: Room,
  playerId: string,
  targetX: number,
  targetY: number,
  success: boolean,
  projectileId?: string,
  failReason?: string
): void {
  const message = createAttackResultMessage(
    playerId,
    0, // Dano ainda não aplicado
    {
      targetId: undefined,
      targetHp: undefined,
      targetMaxHp: undefined,
      isCritical: false,
      targetDestroyed: false
    }
  );

  if (success) {
    // Ataque aceito
    if (projectileId) {
      (message as any).projectileId = projectileId;
    }
    (message as any).accepted = true;
    
    if (DEBUG_GAME_LOOP) {
      console.log(`[Room:${room.id}] Ataque aceito de ${playerId} (projétil: ${projectileId ?? "melee"})`);
    }
  } else {
    // Ataque rejeitado
    (message as any).accepted = false;
    (message as any).failReason = failReason;
    
    if (DEBUG_GAME_LOOP) {
      console.log(`[Room:${room.id}] Ataque rejeitado de ${playerId}: ${failReason}`);
    }
  }
  
  // Enviar apenas para o jogador que atacou
  const playerWs = room.clients.get(playerId);
  if (playerWs && playerWs.readyState === WebSocket.OPEN) {
    playerWs.send(JSON.stringify(message));
  }
}

/**
 * Handler para dano aplicado.
 */
function handleDamageApplied(room: Room, results: DamageResult[]): void {
  let anyCreatureDied = false;
  
  for (const result of results) {
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

    StateBroadcaster.broadcastMessage(room, message);

    if (DEBUG_GAME_LOOP) {
      const targetType = isPlayerTarget ? "jogador" : "criatura";
      console.log(
        `[Room:${room.id}] Dano aplicado: ${result.damage} de ${result.attackerId} em ${targetType} ${result.targetId} ` +
        `(HP: ${result.currentHp}/${result.maxHp}${result.died ? " - MORTO" : ""})`
      );
    }
    
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
        tier: c.tier,
        behaviorType: c.behaviorType,
        attackCooldownRemaining: c.attackCooldownRemaining,
        windupTimer: c.windupTimer,
        stunTimer: c.stunTimer,
        patrolOriginX: c.patrolOrigin.x,
        patrolOriginY: c.patrolOrigin.y,
        patrolTimer: c.patrolTimer,
        buffs: c.buffs?.map(b => ({
          type: b.type,
          duration: b.duration,
          value: b.value
        }))
      }))
    );
    StateBroadcaster.broadcastMessage(room, creaturesUpdateMsg);
  }
}

/**
 * Handler para resultado de captura.
 */
function handleCaptureResult(room: Room, playerId: string, targetId: string, ballType: BallType): void {
  const player = room.players.get(playerId);
  const gameLoop = room.gameLoop;
  if (!player || !gameLoop) return;

  const combatState = gameLoop.getCombatState();
  const creature = combatState.creatures.find(c => c.id === targetId);

  if (!creature) {
    if (DEBUG_GAME_LOOP) {
      console.log(`[Room:${room.id}] Captura falhou: criatura não encontrada`);
    }
    return;
  }

  // ✅ VALIDAÇÃO: Garantir que expeditionInventory é individual
  if (!player.expeditionInventory) {
    console.warn(`[Room:${room.id}] ⚠️ Jogador ${playerId} não possui expeditionInventory - criando novo`);
    const { createExpeditionInventory } = require("../systems/capture");
    player.expeditionInventory = createExpeditionInventory();
  }

  // ✅ Processar captura com acesso ao inventário INDIVIDUAL do jogador
  const result = processCaptureIntent(
    playerId,
    player.x,
    player.y,
    creature,
    ballType,
    player.expeditionInventory, // ✅ Inventário individual
    player // ✅ Player individual (para atualizar creaturesCaptured)
  );

  // Rastrear pokébola consumida
  if (!player.itemsConsumed) {
    player.itemsConsumed = new Map();
  }
  const currentConsumed = player.itemsConsumed.get(ballType) || 0;
  player.itemsConsumed.set(ballType, currentConsumed + 1);

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
        tier: c.tier,
        behaviorType: c.behaviorType,
        attackCooldownRemaining: c.attackCooldownRemaining,
        windupTimer: c.windupTimer,
        stunTimer: c.stunTimer,
        patrolOriginX: c.patrolOrigin.x,
        patrolOriginY: c.patrolOrigin.y,
        patrolTimer: c.patrolTimer,
        buffs: c.buffs?.map(b => ({
          type: b.type,
          duration: b.duration,
          value: b.value
        }))
      }))
    );
    StateBroadcaster.broadcastMessage(room, creaturesUpdateMsg);
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
  StateBroadcaster.broadcastMessage(room, captureMsg);

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
}

/**
 * Handler para uso de skill.
 */
function handleSkillUsed(
  room: Room,
  playerId: string,
  skillType: "fire_fog" | "root_trap" | "electric_surge" | "heal_wave",
  targetX: number,
  targetY: number,
  creatureId?: string
): void {
  // Heal não cria zona de skill no servidor
  if (skillType === "heal_wave") {
    if (DEBUG_GAME_LOOP) {
      console.log(`[Room:${room.id}] Jogador ${playerId} usou Maré Curativa (heal)`);
    }
    return;
  }

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
        5,   // damagePerTick
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
  }
  
  if (zone) {
    // Adicionar zona ao worldState
    room.worldState.skillZones.push(zone);
    
    if (DEBUG_GAME_LOOP) {
      console.log(
        `[Room:${room.id}] Skill ${skillType} criada por ${playerId} em (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`
      );
    }
  }
}

/**
 * Handler para recurso coletado.
 * 
 * IMPORTANTE: Garante que cada jogador tem seu próprio resourcesCollected Map.
 * Não há compartilhamento de estado entre jogadores.
 */
function handleResourceCollected(
  room: Room,
  playerId: string,
  resourceId: string,
  resourceType: string,
  quantity: number
): void {
  if (!room.gameLoop) return;

  // ✅ VALIDAÇÃO: Verificar que playerId está presente
  if (!playerId) {
    console.error(`[Room:${room.id}] ❌ playerId não fornecido ao coletar recurso`);
    return;
  }

  // ✅ IMPORTANTE: Sincronizar recursos coletados do combatState para o player na Room
  // O sistema de extração lê os recursos do player na Room, não do combatState
  const playerInRoom = room.players.get(playerId);
  if (!playerInRoom) {
    console.warn(`[Room:${room.id}] ⚠️ Jogador ${playerId} não encontrado na Room ao coletar recurso`);
    return;
  }

  // ✅ VALIDAÇÃO: Garantir que resourcesCollected é individual (não compartilhado)
  // Criar novo Map se não existir ou se for compartilhado
  if (!playerInRoom.resourcesCollected) {
    playerInRoom.resourcesCollected = new Map();
    console.log(`[Room:${room.id}] ✅ Criado novo Map de resourcesCollected para jogador ${playerId}`);
  }

  // ✅ Atualizar resourcesCollected INDIVIDUAL do jogador
  const currentQuantity = playerInRoom.resourcesCollected.get(resourceType) ?? 0;
  playerInRoom.resourcesCollected.set(resourceType, currentQuantity + quantity);
  
  if (DEBUG_GAME_LOOP) {
    const totalCollected = Array.from(playerInRoom.resourcesCollected.values()).reduce((a, b) => a + b, 0);
    console.log(
      `[Room:${room.id}] ✅ Recurso INDIVIDUAL coletado: jogador ${playerId} coletou ${quantity}x ${resourceType} (${resourceId}) ` +
      `| Total coletado por este jogador: ${totalCollected}`
    );
  }

  // Broadcast remoção do recurso para todos os clientes
  const fullState = room.gameLoop.getFullState();
  const resourcesUpdateMsg = createResourcesUpdateMessage(
    fullState.resources.map(r => ({
      id: r.id,
      type: r.resourceType,
      x: r.x,
      y: r.y,
      amount: r.quantity
    }))
  );
  StateBroadcaster.broadcastMessage(room, resourcesUpdateMsg);
}

/**
 * Handler para skill zone criada.
 */
function handleSkillZoneCreated(
  room: Room,
  playerId: string,
  skillZoneId: string,
  skillType: string,
  x: number,
  y: number
): void {
  if (!room.gameLoop) return;

  // Broadcast criação da skill zone para todos os clientes
  const fullState = room.gameLoop.getFullState();
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
  StateBroadcaster.broadcastMessage(room, skillZonesUpdateMsg);

  if (DEBUG_GAME_LOOP) {
    console.log(
      `[Room:${room.id}] Skill zone criada: ${skillZoneId} (${skillType}) por ${playerId} em (${x.toFixed(0)}, ${y.toFixed(0)})`
    );
  }
}

/**
 * Handler para intent de extração (start/cancel).
 */
function handleExtractionIntent(
  room: Room,
  playerId: string,
  pointId: string,
  action: "start" | "cancel"
): void {
  const roomForExtraction = {
    id: room.id,
    players: room.players,
    extractionPoints: room.worldState.extractionPoints,
    activeExtractions: room.activeExtractions
  };

  const intent = {
    playerId,
    pointId,
    action
  };

  const success = processExtractionIntent(roomForExtraction, playerId, intent);

  if (DEBUG_GAME_LOOP) {
    if (success) {
      console.log(
        `[Room:${room.id}] Extração ${action}: jogador ${playerId} ${action === "start" ? "iniciou" : "cancelou"} extração em ${pointId}`
      );
    } else {
      console.log(
        `[Room:${room.id}] Extração ${action} falhou: jogador ${playerId} não pôde ${action === "start" ? "iniciar" : "cancelar"} extração em ${pointId}`
      );
    }
  }
}

/**
 * Handler para quando um jogador morre.
 * Salva itens gastos durante a expedição no Firebase.
 */
async function handlePlayerDeath(room: Room, playerId: string): Promise<void> {
  const player = room.players.get(playerId);
  if (!player || !player.userId) {
    return;
  }

  if (!isFirebaseAvailable()) {
    console.log(`[Firebase] ⚠️  Firebase não disponível - itens gastos não salvos para ${playerId}`);
    return;
  }

  // Coletar itens gastos durante a expedição
  const itemsConsumed = player.itemsConsumed || new Map<string, number>();

  if (itemsConsumed.size === 0) {
    console.log(`[Firebase] ℹ️  Nenhum item consumido para salvar para jogador ${playerId}`);
    return;
  }

  try {
    const db = getDb();
    const userRef = db.collection('users').doc(player.userId);
    const batch = db.batch();

    // Decrementar itens do inventário no Firebase
    for (const [itemId, quantity] of itemsConsumed.entries()) {
      batch.update(userRef, {
        [`inventory.items.${itemId}`]: FieldValue.increment(-quantity)
      });
    }

    // Salvar expedição como falha
    const expeditionRef = db.collection('expeditions').doc();
    const expeditionDoc: ExpeditionDocument = {
      userId: player.userId,
      mapId: room.id,
      startedAt: new Date(room.startedAt),
      completedAt: new Date(),
      success: false,
      duration: Date.now() - room.startedAt,
      rewards: {
        resources: {}, // Nenhum recurso (jogador morreu)
        creatures: [] // Nenhuma criatura (jogador morreu)
      },
      stats: {
        damageDealt: 0, // TODO: Rastrear se necessário
        damageTaken: 0, // TODO: Rastrear se necessário
        resourcesCollected: 0, // Nenhum recurso coletado
        creaturesCaptured: 0 // Nenhuma criatura capturada
      }
    };

    batch.set(expeditionRef, expeditionDoc);

    // Atualizar estatísticas
    batch.update(userRef, {
      'stats.expeditionsFailed': FieldValue.increment(1)
    });

    await batch.commit();
    console.log(`[Firebase] ✅ Itens gastos salvos para usuário ${player.userId} (morte)`);
    console.log(`[Firebase] ℹ️  Itens consumidos: ${Array.from(itemsConsumed.entries()).map(([id, qty]) => `${qty}x ${id}`).join(', ')}`);
  } catch (error) {
    console.error(`[Firebase] ❌ Erro ao salvar itens gastos para ${player.userId}:`, error);
  }
}
