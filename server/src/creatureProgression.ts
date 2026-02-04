/**
 * Sistema de Progressão de Criaturas no Servidor
 * 
 * Este módulo replica a lógica de progressão do cliente (src/game/creatureProgression.ts)
 * para garantir que o servidor calcule stats (especialmente maxHP) de forma consistente.
 * 
 * IMPORTANTE: Qualquer mudança aqui deve ser refletida no cliente também.
 */

import type { UserCreature } from './firebaseTypes';

// ============================================================================
// CONFIGURAÇÃO DE PROGRESSÃO (Sincronizado com cliente)
// ============================================================================

/**
 * Configuração do sistema de ranks (fusão de cópias).
 * Sincronizado com src/game/creatureProgression.ts
 */
const RANK_CONFIG: Record<
  number,
  {
    name: string;
    copiesRequired: number;
    statMultiplier: number;
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
 * Sincronizado com src/game/creatureProgression.ts
 */
const LEVEL_STAT_BONUS = {
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
// DEFINIÇÕES DE CRIATURAS (Sincronizado com cliente)
// ============================================================================

/**
 * Stats base das criaturas.
 * Sincronizado com src/game/creatures.ts
 */
const CREATURE_BASE_STATS: Record<string, { hp: number; moveSpeed: number; defense: number; attackDamage: number; skillCooldown: number }> = {
  pyrognat: {
    hp: 80,
    moveSpeed: 260,
    defense: 8,
    attackDamage: 20,
    skillCooldown: 12
  },
  aquaryl: {
    hp: 90,
    moveSpeed: 240,
    defense: 10,
    attackDamage: 16,
    skillCooldown: 10
  },
  verdant: {
    hp: 100,
    moveSpeed: 220,
    defense: 12,
    attackDamage: 14,
    skillCooldown: 11
  },
  voltiger: {
    hp: 70,
    moveSpeed: 280,
    defense: 6,
    attackDamage: 22,
    skillCooldown: 9
  }
};

// ============================================================================
// FUNÇÕES DE CÁLCULO DE STATS
// ============================================================================

/**
 * Calcula os stats efetivos de uma criatura considerando nível e rank.
 * Replica a lógica de getEffectiveStats do cliente.
 * 
 * @param creature A criatura do Firebase (UserCreature)
 * @returns Stats efetivos calculados
 */
export function getEffectiveStats(creature: UserCreature): {
  hp: number;
  moveSpeed: number;
  defense: number;
  attackDamage: number;
  skillCooldown: number;
} {
  const baseStats = CREATURE_BASE_STATS[creature.definitionId];
  if (!baseStats) {
    // Fallback se definição não encontrada
    console.warn(`[CreatureProgression] Criatura ${creature.definitionId} não encontrada, usando stats padrão`);
    return {
      hp: 100,
      moveSpeed: 200,
      defense: 10,
      attackDamage: 15,
      skillCooldown: 10,
    };
  }

  const level = creature.level;
  const rank: number = creature.rank ?? 1;
  const rankConfig = RANK_CONFIG[rank];
  if (!rankConfig) {
    console.warn(`[CreatureProgression] Rank ${rank} inválido, usando rank 1`);
    const rankMultiplier = RANK_CONFIG[1].statMultiplier;
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

  const rankMultiplier = rankConfig.statMultiplier;

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
 * Calcula o maxHP de uma criatura baseado em nível e rank.
 * Função auxiliar para facilitar uso.
 */
export function calculateMaxHp(creature: UserCreature): number {
  return getEffectiveStats(creature).hp;
}

// ============================================================================
// CONFIGURAÇÃO DE XP (Sincronizado com cliente)
// ============================================================================

/**
 * Configuração do sistema de níveis de criaturas.
 * Sincronizado com src/game/creatureProgression.ts
 */
const LEVEL_CONFIG = {
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
function getTotalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getXpRequiredForLevel(i);
  }
  return total;
}

/**
 * Calcula o nível atual baseado no XP total.
 * Sincronizado com src/game/creatureProgression.ts getLevelFromTotalXp
 */
export function calculateLevelFromXp(totalXp: number): number {
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

// ============================================================================
// FUNÇÕES DE CÁLCULO DE XP DE EXPEDIÇÃO
// ============================================================================

/**
 * Configuração de XP ganho por diferentes ações durante a expedição.
 * Sincronizado com src/game/creatureProgression.ts
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
  /** Tempo que cada criatura passou ativa (em segundos) - opcional, se não fornecido, divide igualmente */
  activeTimeByCreature?: Map<string, number>;
}

/**
 * Calcula o XP ganho por cada criatura após uma expedição.
 * Sincronizado com src/game/creatureProgression.ts
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

  // Se não houver tempo ativo por criatura, dividir igualmente
  const totalDuration = params.durationSeconds;
  const defaultTimePerCreature = totalDuration / teamSize;

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
    const activeTime = params.activeTimeByCreature?.get(creatureId) ?? defaultTimePerCreature;
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
