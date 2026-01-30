/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Sistema de Captura de Criaturas - Server-Authoritative
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo implementa toda a lógica de captura de criaturas no servidor.
 * 
 * FÓRMULA DE CAPTURA:
 * -------------------
 * 1. Chance base = CAPTURE_CONFIG.baseChance (35%)
 * 2. Bônus de HP = (1 - hpRatio) * CAPTURE_CONFIG.hpBonusMultiplier
 *    - hpRatio = currentHp / maxHp
 *    - Quanto menor o HP da criatura, maior o bônus
 * 3. Modificador de pokébola = ballMods.multiplier e ballMods.flatBonus
 * 4. Penalidade de tier = CAPTURE_TIER_PENALTIES[tier]
 * 5. Chance final = ((baseChance + hpBonus - penalty) * multiplier) + flatBonus
 * 6. Clamp entre 5% e CAPTURE_CONFIG.maxChance (95%)
 * 
 * VALIDAÇÕES:
 * -----------
 * - Jogador possui a pokébola do tipo especificado
 * - Criatura existe e está viva (currentHp > 0)
 * - Distância do jogador até a criatura <= CAPTURE_CONFIG.maxCaptureDistance
 * 
 * RESULTADO:
 * ----------
 * Se sucesso:
 * - Remove criatura do WorldState
 * - Adiciona criatura ao inventário temporário do jogador
 * - Consome pokébola do inventário
 * - Gera instanceId único para a criatura capturada
 * 
 * Se falha:
 * - Consome pokébola do inventário
 * - Criatura permanece no mundo
 * 
 * @module server/systems/capture
 */

import type { ServerCreature } from "../types";
import {
  CAPTURE_CONFIG,
  CAPTURE_BALL_MODIFIERS,
  CAPTURE_TIER_PENALTIES,
  CAPTURE_CREATURE_POOL
} from "../constants";

// =============================================================================
// Tipos
// =============================================================================

/**
 * Tipo de pokébola disponível.
 */
export type BallType = "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra";

/**
 * Resultado de uma tentativa de captura.
 */
export interface CaptureResult {
  /** Se a captura foi bem-sucedida */
  success: boolean;
  /** Chance calculada de captura (0.0 a 1.0) */
  captureChance: number;
  /** Valor rolado no dado (0.0 a 1.0) */
  roll: number;
  /** Criatura capturada (se sucesso) */
  capturedCreature?: {
    instanceId: string;
    speciesId: string;
    level: number;
    tier: string;
    currentHp: number;
    maxHp: number;
  };
  /** Razão da falha (se falhou) */
  failReason?: "escaped" | "out_of_range" | "no_pokeball" | "invalid_target" | "creature_dead";
}

/**
 * Inventário temporário de pokébolas do jogador durante a expedição.
 */
export interface PlayerExpeditionInventory {
  pokeballs: Map<BallType, number>;
  capturedCreatures: Array<{
    instanceId: string;
    speciesId: string;
    level: number;
    tier: string;
    capturedAt: number;
  }>;
}

// =============================================================================
// Funções Auxiliares
// =============================================================================

/**
 * Gera um ID único para uma criatura capturada.
 */
function generateCreatureInstanceId(): string {
  return `captured-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Escolhe aleatoriamente uma espécie de criatura do pool de captura.
 */
function selectRandomCreatureSpecies(): string {
  const pool = CAPTURE_CREATURE_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Calcula a distância euclidiana entre dois pontos.
 */
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// =============================================================================
// Funções Principais
// =============================================================================

/**
 * Calcula a chance de captura de uma criatura.
 * 
 * @param creature - Criatura alvo
 * @param ballType - Tipo de pokébola usada
 * @returns Chance de captura (0.0 a 1.0)
 * 
 * @example
 * ```ts
 * const creature = { currentHp: 20, maxHp: 100, tier: "comum" };
 * const chance = calculateCaptureChance(creature, "poke-ball-ultra");
 * console.log(`Chance: ${(chance * 100).toFixed(1)}%`); // Ex: "Chance: 78.4%"
 * ```
 */
export function calculateCaptureChance(
  creature: Pick<ServerCreature, "currentHp" | "maxHp" | "tier">,
  ballType: BallType
): number {
  // 1. Chance base
  const baseRate = CAPTURE_CONFIG.baseChance;

  // 2. Bônus por HP baixo (quanto menor o HP, maior a chance)
  const hpRatio = creature.currentHp / creature.maxHp;
  const hpBonus = (1 - hpRatio) * CAPTURE_CONFIG.hpBonusMultiplier;

  // 3. Penalidade por tier da criatura (criaturas raras são mais difíceis)
  const penalty = CAPTURE_TIER_PENALTIES[creature.tier] ?? 0;

  // 4. Modificador da pokébola
  const ballMods = CAPTURE_BALL_MODIFIERS[ballType] ?? CAPTURE_BALL_MODIFIERS["poke-ball-basic"];

  // 5. Calcula chance final: ((base + hpBonus - penalty) * multiplier) + flatBonus
  const rawChance = (baseRate + hpBonus - penalty) * ballMods.multiplier + ballMods.flatBonus;

  // 6. Clamp entre 5% e o máximo configurado (95%)
  return Math.max(0.05, Math.min(CAPTURE_CONFIG.maxChance, rawChance));
}

/**
 * Processa uma tentativa de captura de criatura.
 * 
 * @param playerId - ID do jogador que está tentando capturar
 * @param playerX - Posição X do jogador
 * @param playerY - Posição Y do jogador
 * @param creature - Criatura alvo
 * @param ballType - Tipo de pokébola (default: "poke-ball-basic")
 * @param inventory - Inventário do jogador na expedição
 * @param player - Objeto do jogador (para atualizar contador de capturas)
 * @returns Resultado da tentativa de captura
 * 
 * @example
 * ```ts
 * const result = processCaptureIntent(
 *   "player-1",
 *   100, 200,
 *   creature,
 *   "poke-ball-ultra",
 *   playerInventory,
 *   player
 * );
 * 
 * if (result.success) {
 *   console.log(`Capturou ${result.capturedCreature.speciesId}!`);
 * } else {
 *   console.log(`Falhou: ${result.failReason}`);
 * }
 * ```
 */
export function processCaptureIntent(
  playerId: string,
  playerX: number,
  playerY: number,
  creature: ServerCreature,
  ballType: BallType = "poke-ball-basic",
  inventory: PlayerExpeditionInventory,
  player?: { creaturesCaptured?: number }
): CaptureResult {
  // Validação 1: Criatura está viva?
  if (creature.currentHp <= 0) {
    return {
      success: false,
      captureChance: 0,
      roll: 0,
      failReason: "creature_dead"
    };
  }

  // Validação 2: Jogador tem pokébola?
  const ballCount = inventory.pokeballs.get(ballType) ?? 0;
  if (ballCount <= 0) {
    return {
      success: false,
      captureChance: 0,
      roll: 0,
      failReason: "no_pokeball"
    };
  }

  // Validação 3: Criatura está em range?
  const distance = calculateDistance(playerX, playerY, creature.x, creature.y);
  if (distance > CAPTURE_CONFIG.maxCaptureDistance) {
    return {
      success: false,
      captureChance: 0,
      roll: 0,
      failReason: "out_of_range"
    };
  }

  // Calcula chance de captura
  const captureChance = calculateCaptureChance(creature, ballType);

  // Rola o dado
  const roll = Math.random();

  // Consome pokébola independentemente do resultado
  inventory.pokeballs.set(ballType, ballCount - 1);

  // Verifica sucesso
  const success = roll <= captureChance;

  if (success) {
    // Gera instância da criatura capturada
    const instanceId = generateCreatureInstanceId();
    const speciesId = selectRandomCreatureSpecies();
    const level = Math.floor(Math.random() * 5) + 1; // Nível 1-5 para MVP

    const capturedCreature = {
      instanceId,
      speciesId,
      level,
      tier: creature.tier,
      currentHp: creature.currentHp,
      maxHp: creature.maxHp
    };

    // Adiciona ao inventário temporário do jogador
    inventory.capturedCreatures.push({
      instanceId,
      speciesId,
      level,
      tier: creature.tier,
      capturedAt: Date.now()
    });

    // Incrementar contador de criaturas capturadas (para extração)
    if (player && player.creaturesCaptured !== undefined) {
      player.creaturesCaptured++;
    }

    console.log(
      `[Capture] Sucesso! Jogador ${playerId} capturou ${speciesId} (${creature.tier}) ` +
      `| Chance: ${(captureChance * 100).toFixed(1)}% | Roll: ${(roll * 100).toFixed(1)}% ` +
      `| Total capturado: ${player?.creaturesCaptured ?? 0}`
    );

    return {
      success: true,
      captureChance,
      roll,
      capturedCreature
    };
  } else {
    console.log(
      `[Capture] Falha! Jogador ${playerId} falhou em capturar ${creature.creatureType} ` +
      `| Chance: ${(captureChance * 100).toFixed(1)}% | Roll: ${(roll * 100).toFixed(1)}%`
    );

    return {
      success: false,
      captureChance,
      roll,
      failReason: "escaped"
    };
  }
}

/**
 * Valida se uma tentativa de captura é possível antes de processar.
 * Útil para validação antecipada sem consumir recursos.
 * 
 * @param playerId - ID do jogador
 * @param playerX - Posição X do jogador
 * @param playerY - Posição Y do jogador
 * @param creature - Criatura alvo
 * @param ballType - Tipo de pokébola
 * @param inventory - Inventário do jogador
 * @returns Objeto com { valid: boolean, reason?: string }
 */
export function validateCaptureIntent(
  playerId: string,
  playerX: number,
  playerY: number,
  creature: ServerCreature,
  ballType: BallType,
  inventory: PlayerExpeditionInventory
): { valid: boolean; reason?: string } {
  if (creature.currentHp <= 0) {
    return { valid: false, reason: "creature_dead" };
  }

  const ballCount = inventory.pokeballs.get(ballType) ?? 0;
  if (ballCount <= 0) {
    return { valid: false, reason: "no_pokeball" };
  }

  const distance = calculateDistance(playerX, playerY, creature.x, creature.y);
  if (distance > CAPTURE_CONFIG.maxCaptureDistance) {
    return { valid: false, reason: "out_of_range" };
  }

  return { valid: true };
}

/**
 * Cria um inventário de expedição vazio para um jogador.
 * 
 * @param initialPokeballs - Pokébolas iniciais (opcional)
 * @returns Novo inventário de expedição
 */
export function createExpeditionInventory(
  initialPokeballs?: Partial<Record<BallType, number>>
): PlayerExpeditionInventory {
  return {
    pokeballs: new Map([
      ["poke-ball-basic", initialPokeballs?.["poke-ball-basic"] ?? 5],
      ["poke-ball-precisa", initialPokeballs?.["poke-ball-precisa"] ?? 2],
      ["poke-ball-ultra", initialPokeballs?.["poke-ball-ultra"] ?? 1]
    ]),
    capturedCreatures: []
  };
}
