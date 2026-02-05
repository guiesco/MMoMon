/**
 * Sistema de Progressão de Criaturas
 * 
 * Este arquivo é compartilhado entre cliente e servidor.
 * Define todas as configurações de progressão: níveis, XP, ranks, stats.
 * 
 * IMPORTANTE: Qualquer mudança aqui deve ser refletida em ambos os lados.
 */

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
  number,
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
  /** % de alcance de detecção adicional por nível */
  detectionRangePerLevel: 0.004, // +0.4% por nível
  // Nota: Progressões de ataque (attackRangePerLevel, attackCooldownPerLevel, 
  // attackWindupPerLevel, stunDurationPerLevel) agora são definidas individualmente
  // em cada BasicAttack em attacks.ts
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
  activeTimeByCreature?: Map<string, number>;
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
export function getRankDisplay(rank: number): string {
  return "★".repeat(rank);
}

/**
 * Retorna a cor do rank em formato hex string.
 */
export function getRankColorHex(rank: number): string {
  return "#" + RANK_CONFIG[rank].color.toString(16).padStart(6, "0");
}

// ============================================================================
// INTERFACE E FUNÇÃO DE STATS EFETIVOS
// ============================================================================

/**
 * Stats efetivos de uma criatura incluindo valores de IA relevantes.
 * Esta interface é compartilhada entre cliente e servidor.
 */
export interface EffectiveCreatureStats {
  hp: number;
  moveSpeed: number;
  defense: number;
  attackDamage: number;
  skillCooldown: number;
  attackRange: number;
  attackCooldown: number;
  projectileSpeed: number;
  attackWindup: number;
  stunDuration: number;
  // Stats de special skill escalados
  specialSkillRange: number;
  specialSkillCooldown: number;
  specialSkillWindup: number;
  specialSkillStunDuration: number;
  specialSkillRadius: number;
  specialSkillDamagePerTick: number;
  specialSkillLifetime: number;
}

/**
 * Parâmetros mínimos necessários para calcular stats efetivos.
 */
export interface CreatureStatsParams {
  definitionId: string;
  level: number;
  rank: number;
}

/**
 * Tipo para a função getCreatureById (injetada para evitar dependência circular).
 */
export type GetCreatureByIdFn = (id: string) => {
  stats: {
    hp: number;
    moveSpeed: number;
    defense: number;
    attackDamage: number;
    skillCooldown: number;
  };
  basicAttack: {
    range: number;
    cooldown: number;
    attackWindup: number;
    stunDuration: number;
    projectileSpeed: number;
    attackRangePerLevel: number;
    attackCooldownPerLevel: number;
    attackWindupPerLevel: number;
    stunDurationPerLevel: number;
  };
  specialSkill: {
    range: number;
    cooldown: number;
    attackWindup: number;
    stunDuration: number;
    radius: number;
    damagePerTick: number;
    lifetime: number;
    attackRangePerLevel: number;
    attackCooldownPerLevel: number;
    attackWindupPerLevel: number;
    stunDurationPerLevel: number;
    radiusPerLevel: number;
    damagePerTickPerLevel: number;
    lifetimePerLevel: number;
  };
} | undefined;

/**
 * Calcula os stats efetivos de uma criatura considerando nível e rank.
 * Esta função é genérica e pode ser usada tanto no cliente quanto no servidor.
 * 
 * Inclui valores de IA escalados (attackRange, attackCooldown, attackWindup, stunDuration).
 * 
 * @param params Parâmetros da criatura (definitionId, level, rank)
 * @param getCreatureById Função para obter a definição da criatura (injetada para evitar dependência circular)
 * @returns Stats efetivos calculados
 */
export function calculateEffectiveStats(
  params: CreatureStatsParams,
  getCreatureById: GetCreatureByIdFn
): EffectiveCreatureStats {
  const creatureDef = getCreatureById(params.definitionId);
  if (!creatureDef) {
    // Fallback se definição não encontrada
    return {
      hp: 100,
      moveSpeed: 200,
      defense: 10,
      attackDamage: 15,
      skillCooldown: 10,
      attackRange: 200,
      attackCooldown: 2.0,
      projectileSpeed: 400,
      attackWindup: 0.4,
      stunDuration: 0.15,
      specialSkillRange: 250,
      specialSkillCooldown: 12,
      specialSkillWindup: 0.5,
      specialSkillStunDuration: 0,
      specialSkillRadius: 70,
      specialSkillDamagePerTick: 8,
      specialSkillLifetime: 4
    };
  }

  const baseStats = creatureDef.stats;
  const basicAttack = creatureDef.basicAttack;
  const specialSkill = creatureDef.specialSkill;
  const level = params.level;
  const rank = params.rank;
  const rankConfig = RANK_CONFIG[rank];
  
  if (!rankConfig) {
    // Fallback para rank inválido
    const rankMultiplier = RANK_CONFIG[1].statMultiplier;
    const levelBonus = level - 1;
    const hpBonus = 1 + levelBonus * LEVEL_STAT_BONUS.hpPerLevel;
    const attackBonus = 1 + levelBonus * LEVEL_STAT_BONUS.attackDamagePerLevel;
    const defenseBonus = 1 + levelBonus * LEVEL_STAT_BONUS.defensePerLevel;
    const speedBonus = 1 + levelBonus * LEVEL_STAT_BONUS.moveSpeedPerLevel;
    // Progressões de ataque agora vêm do basicAttack individual
    const attackRangeBonus = 1 + levelBonus * basicAttack.attackRangePerLevel;
    const attackCooldownBonus = 1 + levelBonus * basicAttack.attackCooldownPerLevel;
    const attackWindupBonus = 1 + levelBonus * basicAttack.attackWindupPerLevel;
    const stunDurationBonus = 1 + levelBonus * basicAttack.stunDurationPerLevel;

    const attackRange = Math.floor(basicAttack.range * attackRangeBonus * rankMultiplier);
    const attackCooldown = Math.max(
      0.1, // Cooldown mínimo
      basicAttack.cooldown * attackCooldownBonus
    );
    const attackWindup = Math.max(
      0.05, // Windup mínimo
      basicAttack.attackWindup * attackWindupBonus
    );
    const stunDuration = basicAttack.stunDuration * stunDurationBonus * rankMultiplier;
    const projectileSpeed = basicAttack.projectileSpeed; // não escala

    // Calcular stats de special skill escalados
    const specialSkillRangeBonus = 1 + levelBonus * specialSkill.attackRangePerLevel;
    const specialSkillCooldownBonus = 1 + levelBonus * specialSkill.attackCooldownPerLevel;
    const specialSkillWindupBonus = 1 + levelBonus * specialSkill.attackWindupPerLevel;
    const specialSkillStunDurationBonus = 1 + levelBonus * specialSkill.stunDurationPerLevel;
    const specialSkillRadiusBonus = 1 + levelBonus * specialSkill.radiusPerLevel;
    const specialSkillDamagePerTickBonus = 1 + levelBonus * specialSkill.damagePerTickPerLevel;
    const specialSkillLifetimeBonus = 1 + levelBonus * specialSkill.lifetimePerLevel;

    const specialSkillRange = Math.floor(specialSkill.range * specialSkillRangeBonus * rankMultiplier);
    const specialSkillCooldown = Math.max(
      0.1,
      specialSkill.cooldown * specialSkillCooldownBonus
    );
    const specialSkillWindup = Math.max(
      0.05,
      specialSkill.attackWindup * specialSkillWindupBonus
    );
    const specialSkillStunDuration = specialSkill.stunDuration * specialSkillStunDurationBonus * rankMultiplier;
    const specialSkillRadius = Math.floor(specialSkill.radius * specialSkillRadiusBonus * rankMultiplier);
    const specialSkillDamagePerTick = Math.floor(specialSkill.damagePerTick * specialSkillDamagePerTickBonus * rankMultiplier);
    const specialSkillLifetime = specialSkill.lifetime * specialSkillLifetimeBonus * rankMultiplier;

    return {
      hp: Math.floor(baseStats.hp * hpBonus * rankMultiplier),
      moveSpeed: Math.floor(baseStats.moveSpeed * speedBonus * rankMultiplier),
      defense: Math.floor(baseStats.defense * defenseBonus * rankMultiplier),
      attackDamage: Math.floor(baseStats.attackDamage * attackBonus * rankMultiplier),
      skillCooldown: baseStats.skillCooldown, // cooldown não escala
      attackRange,
      attackCooldown,
      projectileSpeed,
      attackWindup,
      stunDuration,
      specialSkillRange,
      specialSkillCooldown,
      specialSkillWindup,
      specialSkillStunDuration,
      specialSkillRadius,
      specialSkillDamagePerTick,
      specialSkillLifetime
    };
  }

  const rankMultiplier = rankConfig.statMultiplier;

  // Calcula bônus por nível (nível 1 = 0 bônus)
  const levelBonus = level - 1;

  const hpBonus = 1 + levelBonus * LEVEL_STAT_BONUS.hpPerLevel;
  const attackBonus = 1 + levelBonus * LEVEL_STAT_BONUS.attackDamagePerLevel;
  const defenseBonus = 1 + levelBonus * LEVEL_STAT_BONUS.defensePerLevel;
  const speedBonus = 1 + levelBonus * LEVEL_STAT_BONUS.moveSpeedPerLevel;
  // Progressões de ataque agora vêm do basicAttack individual
  const attackRangeBonus = 1 + levelBonus * basicAttack.attackRangePerLevel;
  const attackCooldownBonus = 1 + levelBonus * basicAttack.attackCooldownPerLevel;
  const attackWindupBonus = 1 + levelBonus * basicAttack.attackWindupPerLevel;
  const stunDurationBonus = 1 + levelBonus * basicAttack.stunDurationPerLevel;

  const attackRange = Math.floor(basicAttack.range * attackRangeBonus * rankMultiplier);
  const attackCooldown = Math.max(
    0.1, // Cooldown mínimo
    basicAttack.cooldown * attackCooldownBonus
  );
  const attackWindup = Math.max(
    0.05, // Windup mínimo
    basicAttack.attackWindup * attackWindupBonus
  );
  const stunDuration = basicAttack.stunDuration * stunDurationBonus * rankMultiplier;
  const projectileSpeed = basicAttack.projectileSpeed; // não escala

  // Calcular stats de special skill escalados
  const specialSkillRangeBonus = 1 + levelBonus * specialSkill.attackRangePerLevel;
  const specialSkillCooldownBonus = 1 + levelBonus * specialSkill.attackCooldownPerLevel;
  const specialSkillWindupBonus = 1 + levelBonus * specialSkill.attackWindupPerLevel;
  const specialSkillStunDurationBonus = 1 + levelBonus * specialSkill.stunDurationPerLevel;
  const specialSkillRadiusBonus = 1 + levelBonus * specialSkill.radiusPerLevel;
  const specialSkillDamagePerTickBonus = 1 + levelBonus * specialSkill.damagePerTickPerLevel;
  const specialSkillLifetimeBonus = 1 + levelBonus * specialSkill.lifetimePerLevel;

  const specialSkillRange = Math.floor(specialSkill.range * specialSkillRangeBonus * rankMultiplier);
  const specialSkillCooldown = Math.max(
    0.1,
    specialSkill.cooldown * specialSkillCooldownBonus
  );
  const specialSkillWindup = Math.max(
    0.05,
    specialSkill.attackWindup * specialSkillWindupBonus
  );
  const specialSkillStunDuration = specialSkill.stunDuration * specialSkillStunDurationBonus * rankMultiplier;
  const specialSkillRadius = Math.floor(specialSkill.radius * specialSkillRadiusBonus * rankMultiplier);
  const specialSkillDamagePerTick = Math.floor(specialSkill.damagePerTick * specialSkillDamagePerTickBonus * rankMultiplier);
  const specialSkillLifetime = specialSkill.lifetime * specialSkillLifetimeBonus * rankMultiplier;

  return {
    hp: Math.floor(baseStats.hp * hpBonus * rankMultiplier),
    moveSpeed: Math.floor(baseStats.moveSpeed * speedBonus * rankMultiplier),
    defense: Math.floor(baseStats.defense * defenseBonus * rankMultiplier),
    attackDamage: Math.floor(baseStats.attackDamage * attackBonus * rankMultiplier),
    skillCooldown: baseStats.skillCooldown, // cooldown não escala
    attackRange,
    attackCooldown,
    projectileSpeed,
    attackWindup,
    stunDuration,
    specialSkillRange,
    specialSkillCooldown,
    specialSkillWindup,
    specialSkillStunDuration,
    specialSkillRadius,
    specialSkillDamagePerTick,
    specialSkillLifetime
  };
}
