/**
 * Registry central de criaturas. Uma única fonte de verdade: get(id) retorna a classe da criatura.
 */

import type { Creature } from "./types";
import type { ElementType } from "../types";
import { TYPE_EFFECTIVENESS } from "../typeEffectiveness";
import { Pyrognat } from "./Pyrognat";
import { Aquaryl } from "./Aquaryl";
import { Verdant } from "./Verdant";
import { Voltiger } from "./Voltiger";

const BY_ID = new Map<string, Creature>([
  ["pyrognat", new Pyrognat()],
  ["aquaryl", new Aquaryl()],
  ["verdant", new Verdant()],
  ["voltiger", new Voltiger()]
]);

/**
 * Retorna a instância da classe da criatura (singleton por id).
 */
export function get(id: string): Creature | undefined {
  return BY_ID.get(id);
}

/**
 * Lista todas as criaturas registradas.
 */
export function getAll(): Creature[] {
  return Array.from(BY_ID.values());
}

/**
 * Mapa de ID de criatura para tipos (primaryType, secondaryType?).
 * Substitui CREATURE_TYPES; derivado do registry.
 */
export function getTypesMap(): Record<string, { primaryType: ElementType; secondaryType?: ElementType }> {
  const out: Record<string, { primaryType: ElementType; secondaryType?: ElementType }> = {};
  for (const c of BY_ID.values()) {
    out[c.id] = c.getTypes();
  }
  return out;
}

/**
 * Calcula o multiplicador de dano por vantagem/desvantagem de tipos.
 * @param attackerType - ID da criatura atacante (ex: "pyrognat")
 * @param defenderType - ID da criatura defensor (ex: "aquaryl")
 */
export function calculateTypeEffectiveness(attackerType: string, defenderType: string): number {
  const typesMap = getTypesMap();
  const attackerTypes = typesMap[attackerType];
  const defenderTypes = typesMap[defenderType];

  if (!attackerTypes || !defenderTypes) return 1.0;

  let multiplier = 1.0;

  const primaryEffectiveness = TYPE_EFFECTIVENESS[attackerTypes.primaryType];
  if (primaryEffectiveness) {
    if (primaryEffectiveness[defenderTypes.primaryType] !== undefined) {
      multiplier *= primaryEffectiveness[defenderTypes.primaryType]!;
    }
    if (defenderTypes.secondaryType && primaryEffectiveness[defenderTypes.secondaryType] !== undefined) {
      multiplier *= primaryEffectiveness[defenderTypes.secondaryType]!;
    }
  }

  if (attackerTypes.secondaryType) {
    const secondaryEffectiveness = TYPE_EFFECTIVENESS[attackerTypes.secondaryType];
    if (secondaryEffectiveness) {
      if (secondaryEffectiveness[defenderTypes.primaryType] !== undefined) {
        multiplier *= secondaryEffectiveness[defenderTypes.primaryType]!;
      }
      if (defenderTypes.secondaryType && secondaryEffectiveness[defenderTypes.secondaryType] !== undefined) {
        multiplier *= secondaryEffectiveness[defenderTypes.secondaryType]!;
      }
    }
  }

  return multiplier;
}

/** Pool de IDs para captura (derivado do registry). */
export const CAPTURE_CREATURE_POOL = ["pyrognat", "aquaryl", "verdant", "voltiger"] as const;

/** Pool de tipos para spawn (derivado do registry). */
export const CREATURE_TYPE_POOL = ["pyrognat", "aquaryl", "verdant", "voltiger"] as const;
