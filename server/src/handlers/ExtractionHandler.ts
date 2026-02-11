/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Handler de Extração - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Gerencia o processamento do sistema de extração a cada tick do game loop.
 * 
 * @module server/handlers/ExtractionHandler
 */

import { WebSocket } from "ws";
import type { Room } from "../types/ServerTypes";
import {
  updateExtractions,
  completeExtraction,
  type RoomForExtraction
} from "../systems/extraction";
import { createExtractionStateMessage } from "../messages";
import { StateBroadcaster } from "../broadcast/StateBroadcaster";
import { isFirebaseAvailable } from "../firebase";
import { saveExpeditionRewards, getUser } from "../firestoreOperations";
import type { SaveExpeditionData } from "../firebaseTypes";
import { calculateExpeditionXp, type ExpeditionXpParams } from "../creatureProgression";

/**
 * Chamado em onBeforeWorldUpdate (antes do combate). Atualiza progresso de extração,
 * marca jogadores que completaram no combatState (extractedAt) e enfileira conclusões
 * para broadcast/Firebase/desconexão no onTick. Assim o jogador não recebe dano no mesmo tick.
 */
export function runExtractionBeforeWorldUpdate(room: Room, deltaMs: number): void {
  const roomForExtraction: RoomForExtraction = {
    id: room.id,
    players: room.players,
    extractionPoints: room.worldState.extractionPoints,
    activeExtractions: room.activeExtractions
  };

  const updates = updateExtractions(roomForExtraction, deltaMs);
  room.pendingExtractionUpdates = updates;

  for (const update of updates) {
    if (update.status === "completed") {
      const reward = completeExtraction(roomForExtraction, update.playerId, update.pointId);
      if (reward && room.gameLoop) {
        const combatPlayer = room.gameLoop.getCombatState().players.get(update.playerId);
        if (combatPlayer) {
          combatPlayer.extractedAt = Date.now();
        }
        if (!room.pendingExtractionCompletions) room.pendingExtractionCompletions = [];
        room.pendingExtractionCompletions.push({
          playerId: update.playerId,
          pointId: update.pointId,
          reward
        });
      }
    }
  }
}

/**
 * Processa o sistema de extração para uma sala (chamado em onTick).
 * Usa pendingExtractionUpdates e pendingExtractionCompletions preenchidos em onBeforeWorldUpdate.
 */
export async function processExtractionSystem(room: Room): Promise<void> {
  const completions = room.pendingExtractionCompletions ?? [];
  const updates = room.pendingExtractionUpdates ?? [];

  room.pendingExtractionCompletions = [];
  room.pendingExtractionUpdates = [];

  for (const comp of completions) {
    const lastBroadcastProgress = room.lastExtractionBroadcast?.get(comp.playerId) ?? -1;
    if (lastBroadcastProgress < 100) {
      const finalProgressMessage = createExtractionStateMessage(
        comp.pointId,
        comp.playerId,
        "in_progress",
        100
      );
      StateBroadcaster.broadcastExtractionMessage(room, finalProgressMessage);
      if (!room.lastExtractionBroadcast) room.lastExtractionBroadcast = new Map();
      room.lastExtractionBroadcast.set(comp.playerId, 100);
    }
    await handleExtractionCompletedAsync(room, comp);
  }

  for (const update of updates) {
    if (update.status === "cancelled") {
      handleExtractionCancelled(room, update);
    } else if (update.status === "in_progress") {
      handleExtractionProgress(room, update);
    }
  }
}

/**
 * Processa broadcast, Firebase e desconexão de uma extração já completada (recompensa já calculada em onBeforeWorldUpdate).
 */
async function handleExtractionCompletedAsync(
  room: Room,
  comp: { playerId: string; pointId: string; reward: import("../systems/extraction").ExtractionReward }
): Promise<void> {
  const update = { playerId: comp.playerId, pointId: comp.pointId, progress: 100 };
  const reward = comp.reward;

  console.log(`[ExtractionHandler] ✅ handleExtractionCompletedAsync para jogador ${update.playerId} no ponto ${update.pointId}`);

  const player = room.players.get(update.playerId);

  if (!player) {
    console.error(`[ExtractionHandler] ❌ Jogador ${update.playerId} não encontrado na sala - recompensas não serão salvas`);
    return;
  }

  const userId = player.userId || update.playerId;
  if (player.userId && player.id !== update.playerId) {
    console.error(`[ExtractionHandler] ❌ ERRO CRÍTICO: player.id (${player.id}) não corresponde ao update.playerId (${update.playerId})`);
    return;
  }

  const resourcesCount = Array.from(reward.resources.values()).reduce((a, b) => a + b, 0);

  // Log de início do salvamento
  if (!player.userId) {
    console.log(`[Firebase] ⚠️  Jogador ${update.playerId} completou extração sem userId - recompensas não serão salvas no Firebase`);
    console.log(`[Firebase] ℹ️  Recompensas INDIVIDUAIS: ${reward.creaturesCaptured} criaturas, ${resourcesCount} recursos`);
  } else if (!isFirebaseAvailable()) {
    console.log(`[Firebase] ⚠️  Jogador ${update.playerId} (userId: ${userId}) completou extração, mas Firebase não está disponível`);
    console.log(`[Firebase] ℹ️  Recompensas INDIVIDUAIS não salvas: ${reward.creaturesCaptured} criaturas, ${resourcesCount} recursos`);
  } else {
    console.log(`[Firebase] 💾 Salvando recompensas INDIVIDUAIS no Firebase para usuário ${userId} (playerId: ${update.playerId})...`);
    console.log(`[Firebase] ℹ️  Recompensas: ${reward.creaturesCaptured} criaturas, ${resourcesCount} recursos, ${reward.resources.size} tipos de recursos`);
  }

  // ✅ Salvar recompensas INDIVIDUAIS no Firebase
  let saved = false;
  if (isFirebaseAvailable() && player && player.userId) {
    try {
      // ✅ VALIDAÇÃO: Garantir que estamos salvando para o userId correto
      if (player.userId !== userId) {
        console.error(`[Firebase] ❌ ERRO CRÍTICO: userId mismatch - player.userId (${player.userId}) !== userId (${userId})`);
        return;
      }

      // Buscar dados do usuário para obter equipe ativa e calcular XP
      const userData = await getUser(userId);
      if (!userData) {
        console.error(`[ExtractionHandler] ❌ Não foi possível buscar dados do usuário ${userId} para calcular XP`);
        return;
      }

      const activeTeamIds = userData.activeTeam?.creatureIds || [];
      const activeCreatureId = player.activeCreatureId || null;
      const durationSeconds = (Date.now() - room.startedAt) / 1000;
      const resourcesCollected = Array.from(reward.resources.values()).reduce((a, b) => a + b, 0);

      // Calcular XP para cada criatura da equipe (com bônus por nível das criaturas derrotadas)
      const defeatedLevels = player.defeatedCreatureLevels ?? [];
      const xpParams: ExpeditionXpParams = {
        durationSeconds,
        extractionSuccess: true, // Extração bem-sucedida
        creaturesDefeated: defeatedLevels.length,
        defeatedCreatureLevels: defeatedLevels.length > 0 ? defeatedLevels : undefined,
        resourcesCollected,
        teamCreatureIds: activeTeamIds,
        activeCreatureId,
        // Se não houver tempo ativo por criatura, será dividido igualmente na função
        activeTimeByCreature: undefined
      };

      const xpByCreature = calculateExpeditionXp(xpParams);
      console.log(`[ExtractionHandler] ⭐ XP calculado para ${xpByCreature.size} criaturas da equipe`);

      // Converter criaturas capturadas para formato do Firestore
      // Curar todas as criaturas ao máximo de vida após extração
      const capturedCreaturesForFirestore = reward.capturedCreatures.map(creature => ({
        definitionId: creature.speciesId,
        level: creature.level,
        currentHp: creature.maxHp, // Curar ao máximo após extração
        maxHp: creature.maxHp
      }));

      const expeditionData: SaveExpeditionData = {
        userId, // ✅ userId individual do jogador
        mapId: room.id,
        startedAt: new Date(room.startedAt),
        duration: Date.now() - room.startedAt,
        success: true,
        rewards: {
          resources: reward.resources, // ✅ Recursos individuais do jogador
          capturedCreatures: capturedCreaturesForFirestore // ✅ Criaturas individuais do jogador
        },
        stats: {
          damageDealt: 0, // TODO: Rastrear dano causado
          damageTaken: 0, // TODO: Rastrear dano recebido
          resourcesCollected,
          creaturesCaptured: reward.creaturesCaptured // ✅ Contador individual
        },
        xpByCreature, // ✅ XP calculado para cada criatura da equipe
        unusedItems: reward.unusedItems // ✅ Itens não usados que serão retornados à mochila
      };

      saved = await saveExpeditionRewards(expeditionData);

      if (saved) {
        console.log(`[Firebase] ✅ Recompensas INDIVIDUAIS salvas com sucesso no Firebase para usuário ${userId} (playerId: ${update.playerId})`);
      } else {
        console.log(`[Firebase] ⚠️  Falha ao salvar recompensas INDIVIDUAIS no Firebase para usuário ${userId}`);
      }
    } catch (error) {
      console.error(`[Firebase] ❌ Erro ao salvar recompensas INDIVIDUAIS para ${update.playerId} (userId: ${userId}):`, error);
    }
  }

  // ✅ Broadcast de extração completa com recompensas INDIVIDUAIS
  // IMPORTANTE: O message contém apenas dados do jogador específico (update.playerId)
  const message = createExtractionStateMessage(
    update.pointId,
    update.playerId, // ✅ playerId específico
    "completed",
    100,
    {
      resources: Object.fromEntries(reward.resources), // ✅ Recursos individuais
      creaturesCaptured: reward.creaturesCaptured, // ✅ Contador individual
      unusedItems: reward.unusedItems ? Object.fromEntries(reward.unusedItems) : undefined, // ✅ Itens não usados
      savedToCloud: saved,
      ...(saved ? {} : { error: "Failed to save to cloud" })
    }
  );

  // ✅ Enviar mensagem apenas para o jogador que extraiu (não para todos)
  StateBroadcaster.broadcastExtractionMessage(room, message);

  // Limpar último broadcast de progresso para este jogador específico
  if (room.lastExtractionBroadcast) {
    room.lastExtractionBroadcast.delete(update.playerId);
  }

  console.log(`[ExtractionHandler] ✅ Extração INDIVIDUAL completa processada para jogador ${update.playerId}`);

  // IMPORTANTE: Desconectar apenas o jogador que extraiu, não todos
  // A sala continua ativa para os outros jogadores até o tempo acabar ou todos extraírem
  // Aguardar um delay para garantir que a mensagem de extração foi enviada e processada pelo cliente
  setTimeout(() => {
    const playerWs = room.clients.get(update.playerId);
    if (playerWs && playerWs.readyState === WebSocket.OPEN) {
      console.log(`[ExtractionHandler] Desconectando jogador ${update.playerId} após extração bem-sucedida`);
      // Fechar conexão do jogador que extraiu
      // O evento 'close' no index.ts irá remover o jogador da sala automaticamente
      playerWs.close(1000, "extraction_completed");
    }
  }, 500); // Delay de 500ms para garantir que a mensagem foi enviada e processada
}

/**
 * Processa uma extração cancelada.
 */
function handleExtractionCancelled(
  room: Room,
  update: { playerId: string; pointId: string; progress: number }
): void {
  const message = createExtractionStateMessage(
    update.pointId,
    update.playerId,
    "available",
    0
  );

  StateBroadcaster.broadcastExtractionMessage(room, message);

  // Limpar último broadcast de progresso
  if (room.lastExtractionBroadcast) {
    room.lastExtractionBroadcast.delete(update.playerId);
  }
}

/**
 * Processa atualização de progresso de extração.
 */
function handleExtractionProgress(
  room: Room,
  update: { playerId: string; pointId: string; progress: number }
): void {
  // Update de progresso - enviar updates mais frequentes para progresso suave
  const progressPercent = Math.floor(update.progress);
  const lastBroadcastProgress = room.lastExtractionBroadcast?.get(update.playerId) ?? -1;

  // Broadcast se progresso aumentou em pelo menos 1% OU se está próximo de completar (>= 95%)
  // Isso garante progresso suave e que o cliente sempre recebe o update final
  const shouldBroadcast =
    progressPercent - lastBroadcastProgress >= 1 || // A cada 1% para progresso suave
    progressPercent === 0 || // Sempre enviar no início
    progressPercent >= 95; // Sempre enviar quando próximo de completar (garante que 100% seja enviado)

  if (shouldBroadcast) {
    const message = createExtractionStateMessage(
      update.pointId,
      update.playerId,
      "in_progress",
      update.progress
    );

    StateBroadcaster.broadcastExtractionMessage(room, message);

    // Atualizar último progresso broadcastado
    if (!room.lastExtractionBroadcast) {
      room.lastExtractionBroadcast = new Map();
    }
    room.lastExtractionBroadcast.set(update.playerId, progressPercent);
  }
}
