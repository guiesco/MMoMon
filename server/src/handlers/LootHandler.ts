/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Handler de Loot - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Gerencia a coleta de loot bags deixados no chão quando jogadores morrem.
 * 
 * @module server/handlers/LootHandler
 */

import { WebSocket } from "ws";
import type { Room, LootInteractMessage, PlayerPresence } from "../types/ServerTypes";
import { StateBroadcaster } from "../broadcast/StateBroadcaster";
import { isFirebaseAvailable, getDb, FieldValue } from "../firebase";
import type { UserCreature } from "../firebaseTypes";

/**
 * Raio de coleta de loot bag (em pixels).
 */
const LOOT_COLLECTION_RANGE = 30;

/**
 * Resultado de uma tentativa de coleta de loot.
 */
export interface LootCollectionResult {
  success: boolean;
  error?: string;
}

/**
 * Processa uma tentativa de coleta de loot bag.
 * 
 * Valida:
 * - Se o jogador existe e não está morto
 * - Se o loot bag existe
 * - Se o jogador está em alcance (raio 30px)
 * 
 * Se válido:
 * - Transfere recursos para o jogador
 * - Transfere pokébolas para o inventário de expedição
 * - Transfere criaturas capturadas para o inventário de expedição
 * - Transfere criatura do time (se houver) para o inventário permanente do jogador
 * - Remove loot bag do mundo
 * - Broadcast de atualização
 * - Envia confirmação ao jogador
 * 
 * @param room - Sala onde ocorre a coleta
 * @param clientId - ID do cliente que está coletando
 * @param msg - Mensagem de interação com loot
 * @returns Resultado da coleta
 */
export async function handleLootInteract(
  room: Room,
  clientId: string,
  msg: LootInteractMessage
): Promise<LootCollectionResult> {
  // Validar jogador existe
  const player = room.players.get(clientId);
  if (!player) {
    return {
      success: false,
      error: "player_not_found"
    };
  }

  // Validar jogador não está morto
  const gameLoop = room.gameLoop;
  if (gameLoop) {
    const combatState = gameLoop.getCombatState();
    const combatPlayer = combatState.players.get(clientId);
    if (combatPlayer?.isDead) {
      return {
        success: false,
        error: "player_dead"
      };
    }
  }

  // Validar loot bag existe
  const lootBag = room.worldState.lootBags.get(msg.lootBagId);
  if (!lootBag) {
    return {
      success: false,
      error: "loot_bag_not_found"
    };
  }

  // Validar distância (raio 30px)
  const dx = player.x - lootBag.x;
  const dy = player.y - lootBag.y;
  const distance = Math.hypot(dx, dy);

  if (distance > LOOT_COLLECTION_RANGE) {
    return {
      success: false,
      error: "out_of_range"
    };
  }

  // Transferir recursos
  if (lootBag.resources.size > 0) {
    if (!player.resourcesCollected) {
      player.resourcesCollected = new Map();
    }
    for (const [resourceType, quantity] of lootBag.resources.entries()) {
      const currentQuantity = player.resourcesCollected.get(resourceType) || 0;
      player.resourcesCollected.set(resourceType, currentQuantity + quantity);
    }
  }

  // Transferir pokébolas para inventário de expedição
  if (lootBag.pokeballs.size > 0) {
    if (!player.expeditionInventory) {
      player.expeditionInventory = { pokeballs: new Map(), capturedCreatures: [] };
    }
    if (!player.expeditionInventory.pokeballs) {
      player.expeditionInventory.pokeballs = new Map();
    }
    for (const [ballType, quantity] of lootBag.pokeballs.entries()) {
      const currentQuantity = player.expeditionInventory.pokeballs.get(ballType) || 0;
      player.expeditionInventory.pokeballs.set(ballType, currentQuantity + quantity);
    }
  }

  // Transferir criaturas capturadas para inventário de expedição
  if (lootBag.capturedCreatures.length > 0) {
    if (!player.expeditionInventory) {
      player.expeditionInventory = { pokeballs: new Map(), capturedCreatures: [] };
    }
    if (!player.expeditionInventory.capturedCreatures) {
      player.expeditionInventory.capturedCreatures = [];
    }
    player.expeditionInventory.capturedCreatures.push(...lootBag.capturedCreatures);
    player.creaturesCaptured = (player.creaturesCaptured || 0) + lootBag.capturedCreatures.length;
  }

  // Transferir criatura do time para inventário permanente (se houver e se jogador tem userId)
  if (lootBag.teamCreature && player.userId && isFirebaseAvailable()) {
    try {
      const db = getDb();
      const userRef = db.collection('users').doc(player.userId);

      // Criar nova criatura no inventário permanente
      const newCreature: UserCreature = {
        instanceId: lootBag.teamCreature.instanceId,
        definitionId: lootBag.teamCreature.speciesId,
        level: lootBag.teamCreature.level,
        rank: lootBag.teamCreature.rank,
        currentHp: lootBag.teamCreature.currentHp,
        maxHp: lootBag.teamCreature.maxHp,
        capturedAt: new Date(),
        // Outros campos podem ser adicionados conforme necessário
      };

      await userRef.update({
        [`creatures.${newCreature.instanceId}`]: newCreature
      });

      console.log(`[LootHandler] ✅ Criatura do time transferida para inventário permanente: ${newCreature.instanceId}`);
    } catch (error) {
      console.error(`[LootHandler] ❌ Erro ao transferir criatura do time para inventário permanente:`, error);
      // Não falhar a coleta se houver erro ao salvar criatura
    }
  }

  // Remover loot bag do mundo
  room.worldState.lootBags.delete(msg.lootBagId);

  // Broadcast de atualização
  StateBroadcaster.broadcastLootBagsUpdate(room);

  // Enviar confirmação ao jogador
  const playerWs = room.clients.get(clientId);
  if (playerWs && playerWs.readyState === WebSocket.OPEN) {
    playerWs.send(JSON.stringify({
      type: "loot_collected",
      lootBagId: msg.lootBagId,
      resources: Object.fromEntries(lootBag.resources),
      pokeballs: Object.fromEntries(lootBag.pokeballs),
      capturedCreatures: lootBag.capturedCreatures.length,
      hasTeamCreature: !!lootBag.teamCreature
    }));
  }

  console.log(`[LootHandler] ✅ Jogador ${clientId} coletou loot bag ${msg.lootBagId}`);

  return {
    success: true
  };
}
