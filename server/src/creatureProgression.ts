/**
 * Sistema de Progressão de Criaturas no Servidor
 * 
 * Este módulo usa a lógica compartilhada de progressão para garantir
 * que o servidor calcule stats (especialmente maxHP) de forma consistente com o cliente.
 * 
 * ✅ Agora usa funções do diretório compartilhado para manter sincronizado
 */

import type { UserCreature } from './firebaseTypes';
import {
  calculateEffectiveStats,
  type EffectiveCreatureStats,
  XP_REWARDS,
  calculateExpeditionXp,
  getXpRequiredForLevel,
  type ExpeditionXpParams
} from "../../shared/creatureProgression";
import { getCreatureById } from "../../shared/creatures";

// ✅ Re-exportar do shared para manter compatibilidade
export {
  XP_REWARDS,
  calculateExpeditionXp,
  getXpRequiredForLevel,
  type ExpeditionXpParams,
  type EffectiveCreatureStats
} from "../../shared/creatureProgression";


// ============================================================================
// FUNÇÕES DE CÁLCULO DE STATS
// ============================================================================

/**
 * Calcula os stats efetivos de uma criatura considerando nível e rank.
 * 
 * Agora inclui valores de IA escalados (attackRange, attackCooldown, attackWindup, stunDuration).
 * 
 * Esta função é um wrapper que adapta UserCreature para usar a função genérica do shared.
 * 
 * @param creature A criatura do Firebase (UserCreature)
 * @returns Stats efetivos calculados (incluindo valores de IA relevantes para player)
 */
export function getEffectiveStats(creature: UserCreature): EffectiveCreatureStats {
  const rank: number = creature.rank ?? 1;
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
 * Calcula o maxHP de uma criatura baseado em nível e rank.
 * Função auxiliar para facilitar uso.
 */
export function calculateMaxHp(creature: UserCreature): number {
  return getEffectiveStats(creature).hp;
}

// ✅ Re-exportar função de cálculo de nível do shared
export { getLevelFromTotalXp as calculateLevelFromXp } from "../../shared/creatureProgression";
