/**
 * Sistema de Cálculo de Stats para Criaturas Selvagens
 * 
 * ✅ IA #9: Calcula stats baseados em tipo + nível + estrelas (rank)
 * ao invés de usar valores fixos baseados em tier.
 * 
 * ✅ Valores de IA agora fazem parte dos atributos das criaturas e escalam
 * da mesma forma que outros atributos (atk, hp, etc).
 * 
 * Este módulo replica a lógica de progressão do cliente para garantir
 * consistência entre servidor e cliente.
 */

import { calculateEffectiveStats, RANK_CONFIG } from "../../../shared/creatureProgression";
import { getCreatureBaseStats, getCreatureById } from "../../../shared/creatures";

// ============================================================================
// FUNÇÕES DE CÁLCULO DE STATS
// ============================================================================

/**
 * ✅ IA #9: Calcula os stats efetivos de uma criatura selvagem
 * baseado em tipo + nível + estrelas (rank).
 * 
 * Agora inclui valores de IA escalados como parte dos stats.
 * 
 * @param creatureType - Tipo/espécie da criatura (ex: "pyrognat")
 * @param level - Nível da criatura (1-50)
 * @param rank - Estrelas/rank da criatura (1-5)
 * @returns Stats efetivos calculados (incluindo valores de IA)
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
  detectionRange: number;
  attackRange: number;
  attackCooldown: number;
  attackWindup: number;
  stunDuration: number;
  preferredDistance: number;
  projectileSpeed: number;
} {
  // Usa a função genérica do shared para calcular stats base
  const baseStats = calculateEffectiveStats(
    {
      definitionId: creatureType,
      level: level,
      rank: rank
    },
    getCreatureById
  );

  // Adiciona campos específicos de IA que não estão na interface genérica
  const creature = getCreatureById(creatureType);
  if (!creature) {
    // Fallback se definição não encontrada
    console.warn(`[WildCreatureStats] Criatura ${creatureType} não encontrada, usando stats padrão`);
    return {
      ...baseStats,
      detectionRange: 150,
      preferredDistance: 50
    };
  }

  const baseAI = creature.stats.ai;
  const statProgression = creature.statProgression;
  const rankConfig = RANK_CONFIG[rank] || RANK_CONFIG[1];
  const rankMultiplier = rankConfig.statMultiplier;
  const levelBonus = level - 1;
  const detectionRangeBonus = 1 + levelBonus * statProgression.detectionRangePerLevel;

  const detectionRange = Math.floor(baseAI.detectionRange * detectionRangeBonus * rankMultiplier);

  return {
    ...baseStats,
    detectionRange,
    preferredDistance: baseAI.preferredDistance // não escala
  };
}

/**
 * Calcula os valores de IA de uma criatura baseados em tipo, nível e rank.
 * 
 * Agora usa os valores de IA das definições de criaturas ao invés de valores
 * baseados em tier.
 * 
 * @param creatureType - Tipo/espécie da criatura (ex: "pyrognat")
 * @param level - Nível da criatura (1-50)
 * @param rank - Estrelas/rank da criatura (1-5)
 * @returns Valores de IA escalados baseados no nível e rank
 */
export function getAIConfigForWildCreature(
  creatureType: string,
  level: number,
  rank: number
): {
  detectionRange: number;
  attackRange: number;
  attackCooldown: number;
  attackWindup: number;
  stunDuration: number;
  preferredDistance: number;
  projectileSpeed: number;
} {
  const effectiveStats = getEffectiveStatsForWildCreature(creatureType, level, rank);
  
  return {
    detectionRange: effectiveStats.detectionRange,
    attackRange: effectiveStats.attackRange,
    attackCooldown: effectiveStats.attackCooldown,
    attackWindup: effectiveStats.attackWindup,
    stunDuration: effectiveStats.stunDuration,
    preferredDistance: effectiveStats.preferredDistance,
    projectileSpeed: effectiveStats.projectileSpeed
  };
}
