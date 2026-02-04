/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Sistema de Loot - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Gerencia criação e processamento de loot bags quando jogadores morrem.
 * 
 * @module server/systems/loot
 */

import type { ServerLootBag } from "../types";
import type { PlayerPresence } from "../types/ServerTypes";
import { getUser } from "../firestoreOperations";
import { isFirebaseAvailable } from "../firebase";

/**
 * Cria loot bag quando jogador morre.
 * 
 * Dropa:
 * - Todos os recursos coletados
 * - Todas as pokébolas não usadas
 * - Todas as criaturas capturadas na expedição
 * - 1 criatura aleatória do time do jogador (se disponível)
 * 
 * @param player - Jogador que morreu
 * @param killerId - ID do jogador/criatura que matou (opcional)
 * @returns Loot bag criado
 */
export async function createLootBagOnDeath(
  player: PlayerPresence,
  killerId?: string
): Promise<ServerLootBag> {
  const lootBagId = `loot-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  
  // Selecionar 1 criatura aleatória do time (se disponível)
  let teamCreature: ServerLootBag['teamCreature'] | undefined;
  
  // Tentar buscar time do Firebase se userId disponível
  if (player.userId && isFirebaseAvailable()) {
    try {
      const userData = await getUser(player.userId);
      if (userData?.activeTeam?.creatureIds && userData.activeTeam.creatureIds.length > 0) {
        // Buscar detalhes das criaturas do time
        const teamCreatureIds = userData.activeTeam.creatureIds;
        const randomIndex = Math.floor(Math.random() * teamCreatureIds.length);
        const selectedCreatureId = teamCreatureIds[randomIndex];
        
        // Buscar criatura no inventário do usuário
        const creature = userData.creatures?.[selectedCreatureId];
        if (creature) {
          teamCreature = {
            instanceId: creature.instanceId,
            speciesId: creature.definitionId,
            level: creature.level,
            rank: creature.rank,
            currentHp: creature.currentHp ?? creature.maxHp ?? 100,
            maxHp: creature.maxHp ?? 100
          };
        }
      }
    } catch (error) {
      console.error(`[Loot] Erro ao buscar time do Firebase para ${player.userId}:`, error);
    }
  }
  
  // Preparar recursos coletados
  const resources = new Map(player.resourcesCollected || new Map());
  
  // Preparar pokébolas não usadas
  const pokeballs = new Map<string, number>();
  if (player.expeditionInventory?.pokeballs) {
    player.expeditionInventory.pokeballs.forEach((qty: number, ballType: string) => {
      if (qty > 0) {
        pokeballs.set(ballType, qty);
      }
    });
  }
  
  // Preparar criaturas capturadas
  const capturedCreatures = (player.expeditionInventory?.capturedCreatures || []).map((creature: {
    instanceId: string;
    speciesId: string;
    level: number;
    tier: string;
    currentHp: number;
    maxHp: number;
  }) => ({
    instanceId: creature.instanceId,
    speciesId: creature.speciesId,
    level: creature.level,
    tier: creature.tier,
    currentHp: creature.currentHp,
    maxHp: creature.maxHp
  }));
  
  return {
    id: lootBagId,
    x: player.x,
    y: player.y,
    resources,
    pokeballs,
    capturedCreatures,
    teamCreature,
    createdAt: Date.now(),
    ownerId: player.id,
    killerId,
    roomId: player.roomId
  };
}
