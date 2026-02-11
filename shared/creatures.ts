/**
 * Definições de Criaturas (thin wrapper)
 *
 * Fonte de verdade: shared/creatures/ (classes + CreatureRegistry).
 * Este arquivo re-exporta e mantém compatibilidade (getCreatureById, CREATURES, etc.).
 */

import { RANK_CONFIG } from "./creatureProgression";
import {
  getCreatureById as registryGet,
  getCreaturesList,
  CAPTURE_CREATURE_POOL,
  CREATURE_TYPE_POOL
} from "./creatures/index";
import type { CreatureDefinition, CreatureStats } from "./creatures/index";

// Re-exportar tipos e registry
export type {
  Creature,
  CreatureDefinition,
  CreatureTheme,
  CreatureStats,
  CreatureAIStats,
  CreatureStatProgression
} from "./creatures/index";
export type { BasicAttack, SpecialSkill } from "./attacks";
export {
  getCreatureById,
  getTypesMap,
  calculateTypeEffectiveness,
  CAPTURE_CREATURE_POOL,
  CREATURE_TYPE_POOL
} from "./creatures/index";

/** Lista de todas as criaturas (compatibilidade com CREATURES). */
export const CREATURES: CreatureDefinition[] = getCreaturesList();

/**
 * Obtém os stats base de uma criatura por ID.
 */
export function getCreatureBaseStats(id: string): CreatureStats | undefined {
  const creature = registryGet(id);
  return creature?.stats;
}

/**
 * Obtém os stats de ataque de uma criatura por ID.
 */
export function getCreatureAttackStats(
  id: string,
  projectileSpeed: number = 420,
  level?: number,
  rank?: number
): { damage: number; speed: number; range: number; isProjectile: boolean } | undefined {
  const creature = registryGet(id);
  if (!creature) return undefined;

  const basicAttack = creature.basicAttack;

  if (level !== undefined && rank !== undefined) {
    const rankConfig = RANK_CONFIG[rank];
    if (rankConfig) {
      const rankMultiplier = rankConfig.statMultiplier;
      const levelBonus = level - 1;
      const attackRangeBonus = 1 + levelBonus * basicAttack.attackRangePerLevel;
      const attackRange = Math.floor(basicAttack.range * attackRangeBonus * rankMultiplier);
      const finalProjectileSpeed = basicAttack.projectileSpeed;
      return {
        damage: basicAttack.damage,
        speed: basicAttack.isProjectile ? finalProjectileSpeed : 0,
        range: attackRange,
        isProjectile: basicAttack.isProjectile
      };
    }
  }

  return {
    damage: basicAttack.damage,
    speed: basicAttack.isProjectile ? (basicAttack.projectileSpeed || projectileSpeed) : 0,
    range: basicAttack.range,
    isProjectile: basicAttack.isProjectile
  };
}
