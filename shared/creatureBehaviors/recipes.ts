/**
 * Helpers para gerar receitas de skill (shared).
 */

import type { SkillExecutionParams, SkillExecutionRecipe, SkillZoneRecipe } from "./types";

/** Cria receita de uma única zona no alvo (comportamento padrão). */
export function createSingleZoneRecipe(params: SkillExecutionParams): SkillExecutionRecipe {
  const zone: SkillZoneRecipe = {
    x: params.targetX,
    y: params.targetY,
    radius: params.radius,
    damagePerTick: params.damagePerTick,
    tickInterval: params.tickInterval,
    lifetime: params.lifetime,
    slowModifier: params.slowModifier,
    attackerAttack: params.attackerAttack
  };
  return { zones: [zone] };
}
