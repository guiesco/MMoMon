/**
 * Sistema de Cálculo de Stats para Criaturas Selvagens
 * 
 * ✅ IA #9: Calcula stats baseados em tipo + nível + estrelas (rank)
 * ao invés de usar valores fixos baseados em tier.
 * 
 * Este módulo replica a lógica de progressão do cliente para garantir
 * consistência entre servidor e cliente.
 */

// ============================================================================
// CONFIGURAÇÃO DE PROGRESSÃO (Sincronizado com cliente)
// ============================================================================

/**
 * Configuração do sistema de ranks (estrelas).
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
const CREATURE_BASE_STATS: Record<string, { 
  hp: number; 
  moveSpeed: number; 
  defense: number; 
  attackDamage: number; 
  skillCooldown: number 
}> = {
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
 * ✅ IA #9: Calcula os stats efetivos de uma criatura selvagem
 * baseado em tipo + nível + estrelas (rank).
 * 
 * @param creatureType - Tipo/espécie da criatura (ex: "pyrognat")
 * @param level - Nível da criatura (1-50)
 * @param rank - Estrelas/rank da criatura (1-5)
 * @returns Stats efetivos calculados
 */
export function getEffectiveStatsForWildCreature(
  creatureType: string,
  level: number,
  rank: number
): {
  hp: number;
  moveSpeed: number;
  defense: number;
  attackDamage: number;
  skillCooldown: number;
} {
  const baseStats = CREATURE_BASE_STATS[creatureType];
  if (!baseStats) {
    // Fallback se definição não encontrada
    console.warn(`[WildCreatureStats] Criatura ${creatureType} não encontrada, usando stats padrão`);
    return {
      hp: 100,
      moveSpeed: 200,
      defense: 10,
      attackDamage: 15,
      skillCooldown: 10,
    };
  }

  const rankConfig = RANK_CONFIG[rank];
  if (!rankConfig) {
    console.warn(`[WildCreatureStats] Rank ${rank} inválido, usando rank 1`);
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
