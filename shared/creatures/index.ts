/**
 * Sistema de criaturas centralizado: uma classe por criatura + registry.
 * Fonte de verdade: CreatureRegistry.get(id).
 */

export type {
  Creature,
  CreatureDefinition,
  CreatureTheme,
  CreatureStats,
  CreatureAIStats,
  CreatureStatProgression
} from "./types";
export { get, getAll, getTypesMap, calculateTypeEffectiveness, CAPTURE_CREATURE_POOL, CREATURE_TYPE_POOL } from "./CreatureRegistry";
export { Pyrognat } from "./Pyrognat";
export { Aquaryl } from "./Aquaryl";
export { Verdant } from "./Verdant";
export { Voltiger } from "./Voltiger";

import * as CreatureRegistry from "./CreatureRegistry";

/**
 * Obtém a definição da criatura por ID (compatibilidade com getCreatureById).
 * Retorna Creature (extends CreatureDefinition) com theme e executeSpecialSkill.
 */
export function getCreatureById(id: string): import("./types").Creature | undefined {
  return CreatureRegistry.get(id);
}

/** Lista de todas as criaturas (compatibilidade com CREATURES). */
export function getCreaturesList(): import("./types").Creature[] {
  return CreatureRegistry.getAll();
}
