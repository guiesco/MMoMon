import type { CreatureRank, OwnedCreature, CreatureStats } from "./types";
import { getCreatureById } from "./creatures";

// ============================================================================
// CONFIGURAÇÃO DE PROGRESSÃO
// ============================================================================

/**
 * Configuração do sistema de níveis de criaturas.
 */
export const LEVEL_CONFIG = {
  /** Nível máximo que uma criatura pode alcançar */
  maxLevel: 50,
  /** Nível inicial de criaturas capturadas */
  baseLevel: 1,
  /** XP base necessário para o primeiro level up */
  baseXpRequired: 100,
  /** Multiplicador de XP por nível (curva exponencial suave) */
  xpScalingFactor: 1.15,
} as const;

/**
 * XP ganho por diferentes ações durante a expedição.
 */
export const XP_REWARDS = {
  /** XP base por minuto em campo (criatura ativa) */
  perMinuteActive: 15,
  /** XP bonus por participar da expedição (criatura na equipe) */
  expeditionParticipation: 30,
  /** XP bonus se a expedição for extraída com sucesso */
  successfulExtraction: 50,
  /** XP bonus por criatura selvagem derrotada (split entre equipe) */
  perCreatureDefeated: 10,
  /** XP bonus por recurso coletado (split entre equipe) */
  perResourceCollected: 3,
} as const;

/**
 * Configuração do sistema de ranks (fusão de cópias).
 */
export const RANK_CONFIG: Record<
  CreatureRank,
  {
    /** Nome do rank para exibição */
    name: string;
    /** Cópias necessárias para alcançar este rank */
    copiesRequired: number;
    /** Multiplicador de stats base */
    statMultiplier: number;
    /** Cor para UI (hex) */
    color: number;
  }
> = {
  1: { name: "Comum", copiesRequired: 0, statMultiplier: 1.0, color: 0x9ca3af },
  2: { name: "Incomum", copiesRequired: 2, statMultiplier: 1.1, color: 0x22c55e },
  3: { name: "Raro", copiesRequired: 5, statMultiplier: 1.2, color: 0x3b82f6 },
  4: { name: "Épico", copiesRequired: 10, statMultiplier: 1.35, color: 0xa855f7 },
  5: { name: "Lendário", copiesRequired: 20, statMultiplier: 1.5, color: 0xf59e0b },
};

/**
 * Bônus de stats por nível.
 * Cada nível adiciona uma porcentagem dos stats base.
 */
export const LEVEL_STAT_BONUS = {
  /** % de HP adicional por nível */
  hpPerLevel: 0.02, // +2% por nível
  /** % de dano adicional por nível */
  attackDamagePerLevel: 0.015, // +1.5% por nível
  /** % de defesa adicional por nível */
  defensePerLevel: 0.01, // +1% por nível
  /** % de velocidade adicional por nível */
  moveSpeedPerLevel: 0.005, // +0.5% por nível
} as const;

// ============================================================================
// FUNÇÕES DE CÁLCULO DE XP
// ============================================================================

/**
 * Calcula o XP necessário para alcançar um determinado nível.
 */
export function getXpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  const base = LEVEL_CONFIG.baseXpRequired;
  const factor = LEVEL_CONFIG.xpScalingFactor;
  return Math.floor(base * Math.pow(factor, level - 2));
}

/**
 * Calcula o XP total necessário desde o nível 1 até o nível alvo.
 */
export function getTotalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getXpRequiredForLevel(i);
  }
  return total;
}

/**
 * Calcula o nível baseado no XP total acumulado.
 */
export function getLevelFromTotalXp(totalXp: number): number {
  let level = 1;
  let xpSpent = 0;
  while (level < LEVEL_CONFIG.maxLevel) {
    const nextLevelXp = getXpRequiredForLevel(level + 1);
    if (xpSpent + nextLevelXp > totalXp) break;
    xpSpent += nextLevelXp;
    level++;
  }
  return level;
}

/**
 * Calcula quanto XP resta no nível atual.
 */
export function getXpInCurrentLevel(totalXp: number): number {
  let level = 1;
  let xpSpent = 0;
  while (level < LEVEL_CONFIG.maxLevel) {
    const nextLevelXp = getXpRequiredForLevel(level + 1);
    if (xpSpent + nextLevelXp > totalXp) break;
    xpSpent += nextLevelXp;
    level++;
  }
  return totalXp - xpSpent;
}

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
 */
export function getEffectiveStats(creature: OwnedCreature): CreatureStats {
  const def = getCreatureById(creature.definitionId);
  if (!def) {
    // Fallback se definição não encontrada
    return {
      hp: 100,
      moveSpeed: 200,
      defense: 10,
      attackDamage: 15,
      skillCooldown: 10,
    };
  }

  const baseStats = def.stats;
  const level = creature.level;
  const rank: CreatureRank = creature.rank ?? 1;
  const rankMultiplier = RANK_CONFIG[rank].statMultiplier;

  // Calcula bônus por nível (nível 1 = 0 bônus)
  const levelBonus = level - 1;

  const hpBonus = 1 + levelBonus * LEVEL_STAT_BONUS.hpPerLevel;
  const attackBonus = 1 + levelBonus * LEVEL_STAT_BONUS.attackDamagePerLevel;
  const defenseBonus = 1 + levelBonus * LEVEL_STAT_BONUS.defensePerLevel;
  const speedBonus = 1 + levelBonus * LEVEL_STAT_BONUS.moveSpeedPerLevel;

  return {
    hp: Math.floor(baseStats.hp * hpBonus * rankMultiplier),
    moveSpeed: Math.floor(baseStats.moveSpeed * speedBonus * rankMultiplier),
    defense: Math.floor(baseStats.defense * defenseBonus * rankMultiplier),
    attackDamage: Math.floor(baseStats.attackDamage * attackBonus * rankMultiplier),
    skillCooldown: baseStats.skillCooldown, // cooldown não escala
  };
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

// ============================================================================
// FUNÇÕES DE CÁLCULO DE XP DE EXPEDIÇÃO
// ============================================================================

/**
 * Parâmetros de uma expedição para cálculo de XP.
 */
export interface ExpeditionXpParams {
  /** Duração total da expedição em segundos */
  durationSeconds: number;
  /** Se a extração foi bem-sucedida */
  extractionSuccess: boolean;
  /** Número de criaturas derrotadas */
  creaturesDefeated: number;
  /** Número de recursos coletados */
  resourcesCollected: number;
  /** IDs das criaturas que participaram (na equipe ativa) */
  teamCreatureIds: string[];
  /** ID da criatura ativa no momento da extração/falha */
  activeCreatureId: string | null;
  /** Tempo que cada criatura passou ativa (em segundos) */
  activeTimeByCreature: Map<string, number>;
}

/**
 * Calcula o XP ganho por cada criatura após uma expedição.
 */
export function calculateExpeditionXp(
  params: ExpeditionXpParams
): Map<string, number> {
  const xpByCreature = new Map<string, number>();

  const teamSize = params.teamCreatureIds.length;
  if (teamSize === 0) return xpByCreature;

  // XP base por participação
  const participationXp = XP_REWARDS.expeditionParticipation;

  // XP por sucesso na extração
  const extractionXp = params.extractionSuccess
    ? XP_REWARDS.successfulExtraction
    : 0;

  // XP dividido entre a equipe por derrotas e coletas
  const sharedDefeatedXp =
    (params.creaturesDefeated * XP_REWARDS.perCreatureDefeated) / teamSize;
  const sharedResourceXp =
    (params.resourcesCollected * XP_REWARDS.perResourceCollected) / teamSize;

  for (const creatureId of params.teamCreatureIds) {
    let xp = 0;

    // XP de participação (todas ganham)
    xp += participationXp;

    // XP de extração bem-sucedida (todas ganham)
    xp += extractionXp;

    // XP compartilhado
    xp += sharedDefeatedXp;
    xp += sharedResourceXp;

    // XP por tempo ativo (proporcional)
    const activeTime = params.activeTimeByCreature.get(creatureId) ?? 0;
    const activeMinutes = activeTime / 60;
    xp += activeMinutes * XP_REWARDS.perMinuteActive;

    // Bonus extra se foi a criatura ativa no final
    if (creatureId === params.activeCreatureId) {
      xp += 10;
    }

    xpByCreature.set(creatureId, Math.floor(xp));
  }

  return xpByCreature;
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Formata XP para exibição (ex: 1.2k, 15k).
 */
export function formatXp(xp: number): string {
  if (xp < 1000) return xp.toString();
  if (xp < 10000) return (xp / 1000).toFixed(1) + "k";
  return Math.floor(xp / 1000) + "k";
}

/**
 * Retorna uma string descritiva do rank.
 */
export function getRankDisplay(rank: CreatureRank): string {
  return "★".repeat(rank);
}

/**
 * Retorna a cor do rank em formato hex string.
 */
export function getRankColorHex(rank: CreatureRank): string {
  return "#" + RANK_CONFIG[rank].color.toString(16).padStart(6, "0");
}
