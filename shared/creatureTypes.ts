/**
 * Mapeamento de criaturas para tipos elementais (derivado do CreatureRegistry).
 *
 * Fonte de verdade: shared/creatures/ (CreatureRegistry.getTypesMap).
 */

import type { ElementType } from "./types";
import { getTypesMap, calculateTypeEffectiveness as registryCalculateTypeEffectiveness } from "./creatures/index";

/** Derivado do registry; mantido para compatibilidade com quem importa CREATURE_TYPES. */
export const CREATURE_TYPES: Record<string, { primaryType: ElementType; secondaryType?: ElementType }> =
  getTypesMap();

/**
 * Calcula o multiplicador de dano por vantagem/desvantagem de tipos.
 * Delega para CreatureRegistry.calculateTypeEffectiveness.
 */
export function calculateTypeEffectiveness(attackerType: string, defenderType: string): number {
  return registryCalculateTypeEffectiveness(attackerType, defenderType);
}
