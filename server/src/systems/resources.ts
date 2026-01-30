/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Sistema de Recursos Server-Side - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo implementa toda a lógica de coleta de recursos server-authoritative:
 * - Validação de distância para coleta
 * - Remoção de recursos do mundo
 * - Adição ao inventário temporário do jogador
 * - Prevenção de duplicação e trapaça
 * 
 * O servidor é a única fonte de verdade para:
 * - Existência de recursos no mapa
 * - Inventário temporário de expedição
 * - Validação de coleta
 * 
 * @module server/systems/resources
 */

import { ServerResource } from "../types";

// ============================================================================
// Constantes
// ============================================================================

/** Raio de coleta de recursos (em pixels) */
const RESOURCE_COLLECTION_RANGE = 20;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Representa um jogador para propósitos de coleta de recursos.
 */
export interface ResourcePlayer {
  id: string;
  x: number;
  y: number;
  /** Inventário temporário de expedição (resourceType -> quantidade) */
  expeditionInventory: Map<string, number>;
  /** Recursos coletados durante a partida (para extração) */
  resourcesCollected?: Map<string, number>;
}

/**
 * Estado da sala para processamento de recursos.
 */
export interface ResourceRoomState {
  /** Jogadores na sala */
  players: Map<string, ResourcePlayer>;
  /** Recursos disponíveis no mapa */
  resources: ServerResource[];
}

/**
 * Resultado de uma tentativa de coleta de recurso.
 */
export interface ResourceCollectionResult {
  /** Se a coleta foi bem-sucedida */
  success: boolean;
  /** Razão da falha (se aplicável) */
  reason?: "resource_not_found" | "out_of_range" | "player_not_found";
  /** Tipo de recurso coletado (se sucesso) */
  resourceType?: string;
  /** Quantidade coletada (se sucesso) */
  quantity?: number;
  /** ID do recurso coletado (para remoção) */
  resourceId?: string;
}

// ============================================================================
// Processamento de Coleta de Recursos
// ============================================================================

/**
 * Processa uma tentativa de coleta de recurso.
 * 
 * Valida:
 * - Se o jogador existe
 * - Se o recurso existe
 * - Se o jogador está em alcance do recurso
 * 
 * Se válido:
 * - Remove recurso do mundo
 * - Adiciona ao inventário temporário do jogador
 * 
 * @param room - Estado da sala
 * @param playerId - ID do jogador que está coletando
 * @param resourceId - ID do recurso a coletar
 * @returns Resultado da coleta
 * 
 * @example
 * ```ts
 * const result = processResourceCollection(room, "player-1", "res-5");
 * if (result.success) {
 *   console.log(`Coletado ${result.quantity}x ${result.resourceType}`);
 *   // Broadcast resourcesUpdate para remover o recurso
 * }
 * ```
 */
export function processResourceCollection(
  room: ResourceRoomState,
  playerId: string,
  resourceId: string
): ResourceCollectionResult {
  // Validação: jogador existe
  const player = room.players.get(playerId);
  if (!player) {
    return {
      success: false,
      reason: "player_not_found"
    };
  }

  // Validação: recurso existe
  const resourceIndex = room.resources.findIndex(r => r.id === resourceId);
  if (resourceIndex === -1) {
    return {
      success: false,
      reason: "resource_not_found"
    };
  }

  const resource = room.resources[resourceIndex];

  // Validação: distância
  const dx = resource.x - player.x;
  const dy = resource.y - player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > RESOURCE_COLLECTION_RANGE) {
    return {
      success: false,
      reason: "out_of_range"
    };
  }

  // Coleta válida: remover recurso do mundo
  room.resources.splice(resourceIndex, 1);

  // Adicionar ao inventário temporário do jogador
  const currentQuantity = player.expeditionInventory.get(resource.resourceType) ?? 0;
  player.expeditionInventory.set(
    resource.resourceType,
    currentQuantity + resource.quantity
  );

  // Adicionar ao contador de recursos coletados (para extração)
  if (player.resourcesCollected) {
    const collectedQuantity = player.resourcesCollected.get(resource.resourceType) ?? 0;
    player.resourcesCollected.set(
      resource.resourceType,
      collectedQuantity + resource.quantity
    );
  }

  return {
    success: true,
    resourceType: resource.resourceType,
    quantity: resource.quantity,
    resourceId: resource.id
  };
}

/**
 * Processa coleta automática de recursos próximos ao jogador.
 * 
 * Verifica todos os recursos no mapa e coleta automaticamente
 * aqueles que estão em alcance do jogador.
 * 
 * @param room - Estado da sala
 * @param playerId - ID do jogador
 * @returns Lista de recursos coletados
 * 
 * @example
 * ```ts
 * const collected = processAutoCollection(room, "player-1");
 * for (const result of collected) {
 *   console.log(`Auto-coletado: ${result.resourceType}`);
 * }
 * ```
 */
export function processAutoCollection(
  room: ResourceRoomState,
  playerId: string
): ResourceCollectionResult[] {
  const player = room.players.get(playerId);
  if (!player) {
    return [];
  }

  const results: ResourceCollectionResult[] = [];
  const resourcesToRemove: number[] = [];

  // Verificar todos os recursos
  for (let i = 0; i < room.resources.length; i++) {
    const resource = room.resources[i];

    // Calcular distância
    const dx = resource.x - player.x;
    const dy = resource.y - player.y;
    const distance = Math.hypot(dx, dy);

    // Se em alcance, coletar
    if (distance <= RESOURCE_COLLECTION_RANGE) {
      // Adicionar ao inventário
      const currentQuantity = player.expeditionInventory.get(resource.resourceType) ?? 0;
      player.expeditionInventory.set(
        resource.resourceType,
        currentQuantity + resource.quantity
      );

      // Adicionar ao contador de recursos coletados (para extração)
      if (player.resourcesCollected) {
        const collectedQuantity = player.resourcesCollected.get(resource.resourceType) ?? 0;
        player.resourcesCollected.set(
          resource.resourceType,
          collectedQuantity + resource.quantity
        );
      }

      // Marcar para remoção
      resourcesToRemove.push(i);

      // Adicionar resultado
      results.push({
        success: true,
        resourceType: resource.resourceType,
        quantity: resource.quantity,
        resourceId: resource.id
      });
    }
  }

  // Remover recursos coletados (em ordem reversa para não afetar índices)
  for (let i = resourcesToRemove.length - 1; i >= 0; i--) {
    room.resources.splice(resourcesToRemove[i], 1);
  }

  return results;
}

// ============================================================================
// Utilitários
// ============================================================================

/**
 * Verifica se um jogador está em alcance de um recurso.
 * 
 * @param playerX - Posição X do jogador
 * @param playerY - Posição Y do jogador
 * @param resource - Recurso a verificar
 * @returns true se o jogador está em alcance
 */
export function isPlayerInRange(
  playerX: number,
  playerY: number,
  resource: ServerResource
): boolean {
  const dx = resource.x - playerX;
  const dy = resource.y - playerY;
  const distance = Math.hypot(dx, dy);
  return distance <= RESOURCE_COLLECTION_RANGE;
}

/**
 * Obtém o total de recursos coletados por um jogador.
 * 
 * @param player - Jogador
 * @returns Total de recursos coletados
 */
export function getTotalResourcesCollected(player: ResourcePlayer): number {
  let total = 0;
  for (const quantity of player.expeditionInventory.values()) {
    total += quantity;
  }
  return total;
}
