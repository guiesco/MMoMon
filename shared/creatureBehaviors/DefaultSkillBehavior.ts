/**
 * Comportamento padrão de skill: uma única zona no alvo.
 * Usado por Verdant, Voltiger e outras criaturas sem mecânica especial (ex.: dash).
 */

import type { CreatureSkillBehavior, SkillExecutionParams } from "./types";
import { createSingleZoneRecipe } from "./recipes";

/**
 * Comportamento que sempre cria uma única skill zone na posição alvo.
 * Pode ser reutilizado por várias criaturas (Verdant, Voltiger, etc.).
 */
export function createDefaultSkillBehavior(creatureId: string): CreatureSkillBehavior {
  return {
    creatureId,
    executeSpecialSkill(params: SkillExecutionParams) {
      return createSingleZoneRecipe(params);
    }
  };
}
