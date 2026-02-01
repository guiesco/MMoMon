/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Handler de Extração - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Gerencia o processamento do sistema de extração a cada tick do game loop.
 * 
 * @module server/handlers/ExtractionHandler
 */

import type { Room } from "../types/ServerTypes";
import {
  updateExtractions,
  completeExtraction,
  type RoomForExtraction
} from "../systems/extraction";
import { createExtractionStateMessage } from "../messages";
import { StateBroadcaster } from "../broadcast/StateBroadcaster";
import { isFirebaseAvailable } from "../firebase";
import { saveExpeditionRewards } from "../firestoreOperations";
import type { SaveExpeditionData } from "../firebaseTypes";

/**
 * Processa o sistema de extração para uma sala.
 * Chamado a cada tick do game loop.
 * 
 * @param room - Sala para processar extração
 * @param deltaMs - Tempo decorrido desde o último tick (em milissegundos)
 */
export async function processExtractionSystem(
  room: Room,
  deltaMs: number
): Promise<void> {
  // Converter Room para RoomForExtraction (interface compatível)
  const roomForExtraction: RoomForExtraction = {
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
      console.log(`[ExtractionHandler] Processando extração completa para jogador ${update.playerId} no ponto ${update.pointId}`);
      
      // IMPORTANTE: Enviar um update final de progresso (100%) antes de marcar como completed
      // Isso garante que o cliente receba o update de 100% antes do status "completed"
      // Verificar se o último broadcast não foi 100% para evitar duplicação
      const lastBroadcastProgress = room.lastExtractionBroadcast?.get(update.playerId) ?? -1;
      if (lastBroadcastProgress < 100) {
        const finalProgressMessage = createExtractionStateMessage(
          update.pointId,
          update.playerId,
          "in_progress",
          100
        );
        StateBroadcaster.broadcastExtractionMessage(room, finalProgressMessage);
        
        // Atualizar último progresso broadcastado
        if (!room.lastExtractionBroadcast) {
          room.lastExtractionBroadcast = new Map();
        }
        room.lastExtractionBroadcast.set(update.playerId, 100);
      }
      
      await handleExtractionCompleted(room, roomForExtraction, update);
    } else if (update.status === "cancelled") {
      handleExtractionCancelled(room, update);
    } else if (update.status === "in_progress") {
      handleExtractionProgress(room, update);
    }
  }
}

/**
 * Processa uma extração completa.
 */
async function handleExtractionCompleted(
  room: Room,
  roomForExtraction: RoomForExtraction,
  update: { playerId: string; pointId: string; progress: number }
): Promise<void> {
  console.log(`[ExtractionHandler] handleExtractionCompleted chamado para jogador ${update.playerId} no ponto ${update.pointId}`);
  
  // Extração completa - calcular recompensas
  const reward = completeExtraction(
    roomForExtraction,
    update.playerId,
    update.pointId
  );

  if (!reward) {
    console.warn(`[ExtractionHandler] completeExtraction retornou null para jogador ${update.playerId} - recompensas não serão enviadas`);
    return;
  }
  
  console.log(`[ExtractionHandler] Recompensas calculadas para jogador ${update.playerId}: ${reward.creaturesCaptured} criaturas, ${reward.resources.size} tipos de recursos`);

  const player = room.players.get(update.playerId);
  
  // Log de início do salvamento
  if (!player) {
    console.log(`[Firebase] ⚠️  Jogador ${update.playerId} não encontrado na sala - recompensas não serão salvas`);
  } else {
    const userId = player.userId || update.playerId;
    const resourcesCount = Array.from(reward.resources.values()).reduce((a, b) => a + b, 0);
    
    if (!player.userId) {
      console.log(`[Firebase] ⚠️  Jogador ${update.playerId} completou extração sem userId - recompensas não serão salvas no Firebase`);
      console.log(`[Firebase] ℹ️  Recompensas: ${reward.creaturesCaptured} criaturas, ${resourcesCount} recursos`);
    } else if (!isFirebaseAvailable()) {
      console.log(`[Firebase] ⚠️  Jogador ${update.playerId} (userId: ${userId}) completou extração, mas Firebase não está disponível`);
      console.log(`[Firebase] ℹ️  Recompensas não salvas: ${reward.creaturesCaptured} criaturas, ${resourcesCount} recursos`);
    } else {
      console.log(`[Firebase] 💾 Salvando recompensas no Firebase para usuário ${userId}...`);
      console.log(`[Firebase] ℹ️  Recompensas: ${reward.creaturesCaptured} criaturas, ${resourcesCount} recursos, ${reward.resources.size} tipos de recursos`);
    }
  }
  
  let saved = false;
  if (isFirebaseAvailable() && player && player.userId) {
    try {
      // Converter criaturas capturadas para formato do Firestore
      const capturedCreaturesForFirestore = reward.capturedCreatures.map(creature => ({
        definitionId: creature.speciesId,
        level: creature.level,
        currentHp: creature.currentHp,
        maxHp: creature.maxHp
      }));

      const userId = player.userId;

      const expeditionData: SaveExpeditionData = {
        userId,
        mapId: room.id,
        startedAt: new Date(room.startedAt),
        duration: Date.now() - room.startedAt,
        success: true,
        rewards: {
          resources: reward.resources,
          capturedCreatures: capturedCreaturesForFirestore
        },
        stats: {
          damageDealt: 0, // TODO: Rastrear dano causado
          damageTaken: 0, // TODO: Rastrear dano recebido
          resourcesCollected: Array.from(reward.resources.values()).reduce((a, b) => a + b, 0),
          creaturesCaptured: reward.creaturesCaptured
        }
      };

      saved = await saveExpeditionRewards(expeditionData);
      
      if (saved) {
        console.log(`[Firebase] ✅ Recompensas salvas com sucesso no Firebase para usuário ${userId}`);
      } else {
        console.log(`[Firebase] ⚠️  Falha ao salvar recompensas no Firebase para usuário ${userId}`);
      }
    } catch (error) {
      console.error(`[Firebase] ❌ Erro ao salvar recompensas para ${update.playerId}:`, error);
    }
  }

  // Broadcast de extração completa com recompensas
  const message = createExtractionStateMessage(
    update.pointId,
    update.playerId,
    "completed",
    100,
    {
      resources: Object.fromEntries(reward.resources),
      creaturesCaptured: reward.creaturesCaptured,
      savedToCloud: saved,
      ...(saved ? {} : { error: "Failed to save to cloud" })
    }
  );

  StateBroadcaster.broadcastExtractionMessage(room, message);

  // Limpar último broadcast de progresso
  if (room.lastExtractionBroadcast) {
    room.lastExtractionBroadcast.delete(update.playerId);
  }
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
