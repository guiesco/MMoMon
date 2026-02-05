import type { CreatureRank, OwnedCreature } from "./types";
import { getCreatureById } from "../../shared/creatures";
import {
  LEVEL_CONFIG,
  getXpRequiredForLevel,
  RANK_CONFIG,
  calculateEffectiveStats,
  type EffectiveCreatureStats
} from "../../shared/creatureProgression";

// ✅ Re-exportar do shared para manter compatibilidade
export {
  LEVEL_CONFIG,
  XP_REWARDS,
  LEVEL_STAT_BONUS,
  RANK_CONFIG,
  getXpRequiredForLevel,
  getTotalXpForLevel,
  getLevelFromTotalXp,
  getXpInCurrentLevel,
  calculateExpeditionXp,
  formatXp,
  getRankDisplay,
  getRankColorHex,
  type ExpeditionXpParams,
  type EffectiveCreatureStats
} from "../../shared/creatureProgression";

/**
 * Calcula a porcentagem de progresso no nível atual (0-1).
 */
export function getLevelProgress(creature: OwnedCreature): number {
  if (creature.level >= LEVEL_CONFIG.maxLevel) return 1;
  const xpForNext = getXpRequiredForLevel(creature.level + 1);
  if (xpForNext <= 0) return 1;
  return Math.min(1, creature.experience / xpForNext);
}

// ============================================================================
// FUNÇÕES DE STATS COM PROGRESSÃO
// ============================================================================

/**
 * Calcula os stats efetivos de uma criatura considerando nível e rank.
 * Agora inclui valores de IA escalados (attackRange, attackCooldown, attackWindup, stunDuration).
 * 
 * Esta função é um wrapper que adapta OwnedCreature para usar a função genérica do shared.
 */
export function getEffectiveStats(creature: OwnedCreature): EffectiveCreatureStats {
  const rank: CreatureRank = creature.rank ?? 1;
  return calculateEffectiveStats(
    {
      definitionId: creature.definitionId,
      level: creature.level,
      rank: rank
    },
    getCreatureById
  );
}

/**
 * Retorna uma descrição dos bônus de stats comparado ao base.
 */
export function getStatBonusDescription(creature: OwnedCreature): string[] {
  const def = getCreatureById(creature.definitionId);
  if (!def) return [];

  const effective = getEffectiveStats(creature);
  const base = def.stats;

  const bonuses: string[] = [];

  if (effective.hp > base.hp) {
    bonuses.push(`HP: +${effective.hp - base.hp} (${base.hp} → ${effective.hp})`);
  }
  if (effective.attackDamage > base.attackDamage) {
    bonuses.push(
      `Dano: +${effective.attackDamage - base.attackDamage} (${base.attackDamage} → ${effective.attackDamage})`
    );
  }
  if (effective.defense > base.defense) {
    bonuses.push(
      `Defesa: +${effective.defense - base.defense} (${base.defense} → ${effective.defense})`
    );
  }
  if (effective.moveSpeed > base.moveSpeed) {
    bonuses.push(
      `Velocidade: +${effective.moveSpeed - base.moveSpeed} (${base.moveSpeed} → ${effective.moveSpeed})`
    );
  }

  return bonuses;
}

// ============================================================================
// FUNÇÕES DE FUSÃO DE CÓPIAS
// ============================================================================

/**
 * Verifica se uma criatura pode ser promovida para o próximo rank.
 * @param creature A criatura a verificar
 * @param availableCopies Número de cópias disponíveis da mesma espécie
 */
export function canPromoteRank(
  creature: OwnedCreature,
  availableCopies: number
): { canPromote: boolean; copiesNeeded: number; nextRank: CreatureRank | null } {
  const currentRank: CreatureRank = creature.rank ?? 1;

  if (currentRank >= 5) {
    return { canPromote: false, copiesNeeded: 0, nextRank: null };
  }

  const nextRank = (currentRank + 1) as CreatureRank;
  const currentCopiesFused = creature.copiesFused ?? 0;
  const totalCopiesNeeded = RANK_CONFIG[nextRank].copiesRequired;
  const copiesNeeded = totalCopiesNeeded - currentCopiesFused;

  return {
    canPromote: availableCopies >= copiesNeeded,
    copiesNeeded: Math.max(0, copiesNeeded),
    nextRank,
  };
}

/**
 * Retorna o progresso atual de fusão para o próximo rank.
 */
export function getFusionProgress(creature: OwnedCreature): {
  currentCopies: number;
  requiredCopies: number;
  progress: number;
} {
  const currentRank: CreatureRank = creature.rank ?? 1;
  const currentCopiesFused = creature.copiesFused ?? 0;

  if (currentRank >= 5) {
    return { currentCopies: currentCopiesFused, requiredCopies: 0, progress: 1 };
  }

  const nextRank = (currentRank + 1) as CreatureRank;
  const requiredCopies = RANK_CONFIG[nextRank].copiesRequired;

  return {
    currentCopies: currentCopiesFused,
    requiredCopies,
    progress: requiredCopies > 0 ? currentCopiesFused / requiredCopies : 1,
  };
}


/**
 * Normaliza o HP atual de uma criatura para garantir que está dentro do range válido.
 * Garante que 0 <= currentHp <= maxHp (onde maxHp é calculado via getEffectiveStats).
 * @param creature A criatura a normalizar
 * @returns O HP normalizado
 */
export function normalizeCreatureHp(creature: OwnedCreature): number {
  const effectiveStats = getEffectiveStats(creature);
  const maxHp = effectiveStats.hp;
  return Math.max(0, Math.min(creature.currentHp, maxHp));
}
