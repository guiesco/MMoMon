/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Sistema de Extração - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo implementa toda a lógica server-authoritative de extração.
 * 
 * Fluxo de extração:
 * 1. Jogador envia intent "extraction_request" com action="start"
 * 2. Servidor valida se jogador está dentro do raio do ponto
 * 3. Se válido, inicia contagem de progresso (0 a 100%)
 * 4. A cada tick, progresso aumenta (updateExtractions)
 * 5. Se jogador sair da zona, progresso é resetado
 * 6. Se jogador cancelar (action="cancel"), progresso é resetado
 * 7. Ao atingir 100%, extração é completa e recompensas são calculadas
 * 8. Jogador é marcado como "extraído" e não participa mais da partida
 * 
 * @module server/systems/extraction
 */

import { EXTRACTION_REQUIRED_SECONDS } from "../constants";
import type { ServerExtractionPoint } from "../types";

// ============================================================================
// Tipos para o Sistema de Extração
// ============================================================================

/**
 * Estrutura para rastrear estado de extração de um jogador.
 */
export interface PlayerExtractionState {
  /** ID do jogador */
  playerId: string;
  /** ID do ponto de extração onde está extraindo */
  pointId: string;
  /** Progresso atual em segundos (0 a EXTRACTION_REQUIRED_SECONDS) */
  progressSeconds: number;
  /** Posição X do jogador quando iniciou extração */
  startX: number;
  /** Posição Y do jogador quando iniciou extração */
  startY: number;
}

/**
 * Estrutura para rastrear presença de jogadores na sala.
 * Estendida com informações de extração.
 */
export interface PlayerPresence {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Inventário temporário de pokébolas e criaturas capturadas durante a expedição */
  expeditionInventory?: {
    capturedCreatures: Array<{
      instanceId: string;
      speciesId: string;
      level: number;
      tier: string;
      currentHp: number;
      maxHp: number;
    }>;
  };
  /** Progresso de extração (0-100) */
  extractionProgress: number;
  /** Timestamp quando extraiu com sucesso (null se ainda não extraiu) */
  extractedAt: number | null;
  /** Recursos coletados durante a partida */
  resourcesCollected: Map<string, number>;
  /** Número de criaturas capturadas durante a partida */
  creaturesCaptured: number;
}

/**
 * Intent de extração enviado pelo cliente.
 */
export interface ExtractionIntent {
  playerId: string;
  pointId: string;
  action: "start" | "cancel";
}

/**
 * Update de progresso de extração para broadcast.
 */
export interface ExtractionUpdate {
  /** ID do ponto de extração */
  pointId: string;
  /** ID do jogador */
  playerId: string;
  /** Status da extração */
  status: "in_progress" | "completed" | "cancelled";
  /** Progresso em porcentagem (0-100) */
  progress: number;
}

/**
 * Resultado de extração completa.
 */
export interface ExtractionReward {
  /** ID do jogador */
  playerId: string;
  /** ID do ponto de extração */
  pointId: string;
  /** Recursos coletados */
  resources: Map<string, number>;
  /** Número de criaturas capturadas */
  creaturesCaptured: number;
  /** Detalhes das criaturas capturadas */
  capturedCreatures: Array<{
    instanceId: string;
    speciesId: string;
    level: number;
    tier: string;
    currentHp: number;
    maxHp: number;
  }>;
  /** Timestamp da extração */
  timestamp: number;
}

/**
 * Estrutura de sala simplificada para o sistema de extração.
 */
export interface RoomForExtraction {
  id: string;
  players: Map<string, PlayerPresence>;
  extractionPoints: ServerExtractionPoint[];
  /** Mapa de jogadores que estão extraindo ativamente */
  activeExtractions: Map<string, PlayerExtractionState>;
}

// ============================================================================
// Funções Principais do Sistema de Extração
// ============================================================================

/**
 * Processa um intent de extração (iniciar ou cancelar).
 * 
 * Validações realizadas:
 * - Verifica se o ponto de extração existe
 * - Verifica se o ponto está ativo
 * - Verifica se o jogador existe na sala
 * - Verifica se o jogador já extraiu
 * - Para "start": verifica se está dentro do raio do ponto
 * 
 * @param room - Sala onde ocorrerá a extração
 * @param playerId - ID do jogador que deseja extrair
 * @param intent - Intent com pointId e action
 * @returns true se o intent foi processado com sucesso, false caso contrário
 */
export function processExtractionIntent(
  room: RoomForExtraction,
  playerId: string,
  intent: ExtractionIntent
): boolean {
  const player = room.players.get(playerId);
  if (!player) {
    console.warn(`[Extraction] Jogador ${playerId} não encontrado na sala ${room.id}`);
    return false;
  }

  // Jogadores que já extraíram não podem extrair novamente
  if (player.extractedAt !== null) {
    console.warn(`[Extraction] Jogador ${playerId} já extraiu anteriormente`);
    return false;
  }

  const point = room.extractionPoints.find(p => p.id === intent.pointId);
  if (!point) {
    console.warn(`[Extraction] Ponto de extração ${intent.pointId} não encontrado`);
    return false;
  }

  if (!point.isActive) {
    console.warn(`[Extraction] Ponto de extração ${intent.pointId} não está ativo`);
    return false;
  }

  if (intent.action === "start") {
    // Verificar se jogador está dentro do raio do ponto
    const distance = Math.sqrt(
      Math.pow(player.x - point.x, 2) + Math.pow(player.y - point.y, 2)
    );

    if (distance > point.radius) {
      console.warn(
        `[Extraction] Jogador ${playerId} está fora do raio do ponto ${intent.pointId} ` +
        `(distância: ${distance.toFixed(1)}, raio: ${point.radius})`
      );
      return false;
    }

    // Iniciar extração
    const existingExtraction = room.activeExtractions.get(playerId);
    if (existingExtraction && existingExtraction.pointId === intent.pointId) {
      // Já está extraindo neste ponto, não fazer nada
      return true;
    }

    // Criar novo estado de extração
    room.activeExtractions.set(playerId, {
      playerId,
      pointId: intent.pointId,
      progressSeconds: 0,
      startX: player.x,
      startY: player.y
    });

    // Atualizar mapa de jogadores extraindo no ponto
    point.playersExtracting.set(playerId, 0);

    console.log(`[Extraction] Jogador ${playerId} iniciou extração em ${intent.pointId}`);
    return true;

  } else if (intent.action === "cancel") {
    // Cancelar extração
    const extraction = room.activeExtractions.get(playerId);
    if (!extraction) {
      // Não estava extraindo, não fazer nada
      return true;
    }

    room.activeExtractions.delete(playerId);
    point.playersExtracting.delete(playerId);
    player.extractionProgress = 0;

    console.log(`[Extraction] Jogador ${playerId} cancelou extração em ${intent.pointId}`);
    return true;
  }

  return false;
}

/**
 * Atualiza o progresso de todas as extrações ativas.
 * 
 * Para cada jogador extraindo:
 * - Verifica se ainda está dentro da zona
 * - Incrementa progresso se estiver
 * - Cancela se saiu da zona
 * - Completa se atingiu 100%
 * 
 * @param room - Sala com extrações ativas
 * @param deltaTimeMs - Tempo decorrido desde o último update (em milissegundos)
 * @returns Lista de updates para broadcast aos clientes
 */
export function updateExtractions(
  room: RoomForExtraction,
  deltaTimeMs: number
): ExtractionUpdate[] {
  const updates: ExtractionUpdate[] = [];
  const deltaSeconds = deltaTimeMs / 1000;

  // Criar lista de extrações a remover (não podemos modificar Map enquanto iteramos)
  const extractionsToRemove: string[] = [];

  for (const [playerId, extraction] of room.activeExtractions.entries()) {
    const player = room.players.get(playerId);
    if (!player) {
      // Jogador desconectou, remover extração
      extractionsToRemove.push(playerId);
      continue;
    }

    const point = room.extractionPoints.find(p => p.id === extraction.pointId);
    if (!point || !point.isActive) {
      // Ponto foi desativado ou removido, cancelar extração
      extractionsToRemove.push(playerId);
      player.extractionProgress = 0;
      updates.push({
        pointId: extraction.pointId,
        playerId,
        status: "cancelled",
        progress: 0
      });
      continue;
    }

    // Verificar se jogador ainda está na zona
    const distance = Math.sqrt(
      Math.pow(player.x - point.x, 2) + Math.pow(player.y - point.y, 2)
    );

    if (distance > point.radius) {
      // Jogador saiu da zona, cancelar extração
      extractionsToRemove.push(playerId);
      point.playersExtracting.delete(playerId);
      player.extractionProgress = 0;
      
      console.log(
        `[Extraction] Jogador ${playerId} saiu da zona de extração ${extraction.pointId}`
      );

      updates.push({
        pointId: extraction.pointId,
        playerId,
        status: "cancelled",
        progress: 0
      });
      continue;
    }

    // Incrementar progresso
    extraction.progressSeconds += deltaSeconds;
    const progressPercent = Math.min(
      100,
      (extraction.progressSeconds / EXTRACTION_REQUIRED_SECONDS) * 100
    );

    // Atualizar progresso no player e no ponto
    player.extractionProgress = progressPercent;
    point.playersExtracting.set(playerId, extraction.progressSeconds);

    // Verificar se completou
    if (extraction.progressSeconds >= EXTRACTION_REQUIRED_SECONDS) {
      extractionsToRemove.push(playerId);
      
      console.log(
        `[Extraction] Jogador ${playerId} completou extração em ${extraction.pointId}`
      );

      updates.push({
        pointId: extraction.pointId,
        playerId,
        status: "completed",
        progress: 100
      });

      // IMPORTANTE: NÃO marcar jogador como extraído aqui!
      // Isso será feito em completeExtraction() para evitar que completeExtraction retorne null
      // Apenas atualizar progresso e remover do ponto
      player.extractionProgress = 100;
      point.playersExtracting.delete(playerId);
    } else {
      // Enviar update de progresso
      updates.push({
        pointId: extraction.pointId,
        playerId,
        status: "in_progress",
        progress: progressPercent
      });
    }
  }

  // Remover extrações finalizadas/canceladas
  for (const playerId of extractionsToRemove) {
    room.activeExtractions.delete(playerId);
  }

  return updates;
}

/**
 * Completa uma extração e calcula as recompensas.
 * 
 * Esta função deve ser chamada quando um jogador completa a extração
 * (progressSeconds >= EXTRACTION_REQUIRED_SECONDS).
 * 
 * @param room - Sala onde ocorreu a extração
 * @param playerId - ID do jogador que extraiu
 * @param pointId - ID do ponto de extração
 * @returns Objeto com as recompensas calculadas, ou null se inválido
 */
export function completeExtraction(
  room: RoomForExtraction,
  playerId: string,
  pointId: string
): ExtractionReward | null {
  const player = room.players.get(playerId);
  if (!player) {
    console.warn(`[Extraction] Jogador ${playerId} não encontrado ao completar extração`);
    return null;
  }

  // Verificar se jogador já extraiu
  if (player.extractedAt !== null) {
    console.warn(`[Extraction] Jogador ${playerId} já havia extraído anteriormente`);
    return null;
  }

  const point = room.extractionPoints.find(p => p.id === pointId);
  if (!point) {
    console.warn(`[Extraction] Ponto de extração ${pointId} não encontrado`);
    return null;
  }

  // Marcar jogador como extraído
  player.extractedAt = Date.now();
  player.extractionProgress = 100;

  // Remover de extrações ativas se ainda estiver lá
  room.activeExtractions.delete(playerId);
  point.playersExtracting.delete(playerId);

  // Debug: Verificar estado do jogador
  console.log(`[Extraction] DEBUG - Estado do jogador ${playerId}:`);
  console.log(`  - resourcesCollected:`, player.resourcesCollected);
  console.log(`  - creaturesCaptured:`, player.creaturesCaptured);

  // ✅ FASE 3: Coletar detalhes das criaturas capturadas do inventário da expedição
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
    currentHp: creature.currentHp ?? creature.maxHp ?? 100, // Usa HP salvo na captura, ou maxHp como fallback
    maxHp: creature.maxHp ?? 100 // Usa HP máximo salvo na captura
  }));

  // Preparar recompensas
  const reward: ExtractionReward = {
    playerId,
    pointId,
    resources: new Map(player.resourcesCollected),
    creaturesCaptured: player.creaturesCaptured,
    capturedCreatures,
    timestamp: Date.now()
  };

  console.log(
    `[Extraction] Recompensas calculadas para ${playerId}: ` +
    `${reward.creaturesCaptured} criaturas, ` +
    `${reward.resources.size} tipos de recursos`
  );

  return reward;
}

/**
 * Verifica se todos os jogadores extraíram ou foram eliminados.
 * Usado para determinar se a partida pode encerrar antecipadamente.
 * 
 * @param room - Sala para verificar
 * @returns true se todos jogadores extraíram ou foram eliminados
 */
export function allPlayersExtractedOrDead(room: RoomForExtraction): boolean {
  for (const player of room.players.values()) {
    // Se houver pelo menos um jogador que não extraiu e não morreu, retornar false
    // Verificar se jogador extraiu ou morreu (isDead vem do combatState)
    const hasExtracted = player.extractedAt !== null;
    // Nota: isDead é verificado no combatState, mas como RoomForExtraction não tem acesso direto,
    // assumimos que jogadores mortos teriam extractedAt marcado ou serão verificados no gameLoop
    if (!hasExtracted) {
      return false;
    }
  }

  return room.players.size > 0; // Só retorna true se houver jogadores na sala
}

/**
 * Calcula estatísticas de extração da sala.
 * Útil para debug e telemetria.
 * 
 * @param room - Sala para calcular estatísticas
 * @returns Objeto com estatísticas de extração
 */
export function getExtractionStats(room: RoomForExtraction): {
  totalPlayers: number;
  playersExtracting: number;
  playersExtracted: number;
  activeExtractionPoints: number;
} {
  let playersExtracted = 0;

  for (const player of room.players.values()) {
    if (player.extractedAt !== null) {
      playersExtracted++;
    }
  }

  return {
    totalPlayers: room.players.size,
    playersExtracting: room.activeExtractions.size,
    playersExtracted,
    activeExtractionPoints: room.extractionPoints.filter(p => p.isActive).length
  };
}

/**
 * Inicializa a estrutura de extração para um jogador.
 * Deve ser chamado quando um jogador entra na sala.
 * 
 * @param player - Jogador a inicializar
 */
export function initializePlayerExtractionData(player: PlayerPresence): void {
  player.extractionProgress = 0;
  player.extractedAt = null;
  
  if (!player.resourcesCollected) {
    player.resourcesCollected = new Map();
  }
  
  if (player.creaturesCaptured === undefined) {
    player.creaturesCaptured = 0;
  }
}

// ============================================================================
// Fluxo Completo de Extração
// ============================================================================

/*
 * FLUXO DE EXTRAÇÃO - DOCUMENTAÇÃO
 * 
 * 1. INICIALIZAÇÃO DA SALA
 *    - Criar pontos de extração usando createExtractionPoint() de types.ts
 *    - Inicializar room.activeExtractions = new Map()
 *    - Para cada jogador que entra, chamar initializePlayerExtractionData()
 * 
 * 2. INTENT DE INÍCIO (action="start")
 *    Cliente → Servidor:
 *    {
 *      "type": "extraction_request",
 *      "pointId": "extract-0",
 *      "action": "start"
 *    }
 *    
 *    Servidor:
 *    - Recebe intent no gameLoop
 *    - Chama processExtractionIntent(room, playerId, intent)
 *    - Valida posição e estado do jogador
 *    - Se válido, adiciona a room.activeExtractions
 * 
 * 3. UPDATE A CADA TICK
 *    No gameLoop.updateWorld():
 *    - Chama updateExtractions(room, deltaMs)
 *    - Retorna lista de updates com progresso
 *    - Para cada update:
 *      - Se status="completed": chama completeExtraction()
 *      - Broadcast ExtractionStateMessage aos clientes
 * 
 * 4. CANCELAMENTO (action="cancel" ou saiu da zona)
 *    - processExtractionIntent com action="cancel"
 *    - Ou updateExtractions detecta que saiu da zona
 *    - Remove de activeExtractions
 *    - Reseta extractionProgress para 0
 * 
 * 5. CONCLUSÃO
 *    Quando progressSeconds >= EXTRACTION_REQUIRED_SECONDS:
 *    - updateExtractions retorna status="completed"
 *    - Chama completeExtraction(room, playerId, pointId)
 *    - Calcula recompensas (recursos + criaturas)
 *    - Marca player.extractedAt = Date.now()
 *    - Broadcast ExtractionStateMessage com rewards
 *    - Cliente recebe e persiste recompensas no PlayerState
 * 
 * 6. FIM DE PARTIDA
 *    No gameLoop.checkMatchEnd():
 *    - Verificar tempo esgotado
 *    - OU allPlayersExtractedOrDead(room)
 *    - Se fim, emitir MatchEventMessage com event="finished"
 *    - Jogadores que não extraíram perdem tudo
 * 
 * EXEMPLO DE INTEGRAÇÃO NO GAMELOOP:
 * 
 * ```typescript
 * // No processIntent() quando type="extraction"
 * case "extraction":
 *   processExtractionIntent(room, intent.playerId, {
 *     playerId: intent.playerId,
 *     pointId: intent.data.pointId,
 *     action: intent.data.action
 *   });
 *   break;
 * 
 * // No updateWorld()
 * const extractionUpdates = updateExtractions(room, deltaMs);
 * for (const update of extractionUpdates) {
 *   if (update.status === "completed") {
 *     const reward = completeExtraction(room, update.playerId, update.pointId);
 *     if (reward) {
 *       // Broadcast recompensas
 *       broadcastExtractionComplete(room, update.playerId, reward);
 *     }
 *   } else {
 *     // Broadcast progresso
 *     broadcastExtractionProgress(room, update);
 *   }
 * }
 * 
 * // No checkMatchEnd()
 * if (allPlayersExtractedOrDead(room)) {
 *   this.setMatchState("finished");
 *   this.debugLog("Partida finalizada: todos jogadores extraíram");
 * }
 * ```
 */
