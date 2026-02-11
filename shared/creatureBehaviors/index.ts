/**
 * Sistema de comportamentos de criaturas (shared).
 * Centraliza a lógica de skills por criatura para ser usada por player e IA no servidor.
 */

import type { CreatureSkillBehavior, SkillExecutionParams, SkillExecutionRecipe } from "./types";
import { PyrognatBehavior } from "./PyrognatBehavior";
import { createDefaultSkillBehavior } from "./DefaultSkillBehavior";

export type {
  CreatureSkillBehavior,
  SkillExecutionParams,
  SkillExecutionRecipe,
  SkillZoneRecipe,
  SkillTypeName
} from "./types";
export { createSingleZoneRecipe } from "./recipes";
export { PyrognatBehavior } from "./PyrognatBehavior";
export { createDefaultSkillBehavior } from "./DefaultSkillBehavior";

const BEHAVIORS: Map<string, CreatureSkillBehavior> = new Map([
  ["pyrognat", new PyrognatBehavior()],
  ["verdant", createDefaultSkillBehavior("verdant")],
  ["voltiger", createDefaultSkillBehavior("voltiger")],
  ["aquaryl", createDefaultSkillBehavior("aquaryl")]
]);

/**
 * Retorna o comportamento de skill da criatura.
 * Se não houver registro específico, retorna comportamento padrão (uma zona no alvo).
 */
export function getCreatureBehavior(creatureId: string): CreatureSkillBehavior {
  let behavior = BEHAVIORS.get(creatureId);
  if (!behavior) {
    behavior = createDefaultSkillBehavior(creatureId);
  }
  return behavior;
}

/**
 * Executa a skill especial da criatura e retorna a receita (zonas, dash, buff).
 * Usado pelo servidor tanto para player quanto para IA.
 */
export function executeCreatureSpecialSkill(
  creatureId: string,
  params: SkillExecutionParams
): SkillExecutionRecipe {
  const behavior = getCreatureBehavior(creatureId);
  return behavior.executeSpecialSkill(params);
}
