/**
 * Comportamento de skill do Pyrognat (Dash Explosivo / Nevoeiro Incendiário).
 * Skill com dash: múltiplas zonas ao longo do caminho + movimento instantâneo.
 */

import type { CreatureSkillBehavior, SkillExecutionParams, SkillExecutionRecipe, SkillZoneRecipe } from "./types";
import { createSingleZoneRecipe } from "./recipes";

const CREATURE_ID = "pyrognat";
const ZONE_SPACING_RATIO = 0.6; // Espaçamento entre zonas = radius * 0.6
const DASH_SPEED_BUFF_DURATION = 0.3;
const DASH_SPEED_BUFF_MULTIPLIER = 2.0;

export class PyrognatBehavior implements CreatureSkillBehavior {
  readonly creatureId = CREATURE_ID;

  executeSpecialSkill(params: SkillExecutionParams): SkillExecutionRecipe {
    const { skillType, startX, startY, targetX, targetY, skillRange } = params;

    // Dash + rastro apenas para fire_fog com alcance > 0
    if (skillType === "fire_fog" && skillRange > 0) {
      return this.executeFireFogDash(params);
    }

    return createSingleZoneRecipe(params);
  }

  private executeFireFogDash(params: SkillExecutionParams): SkillExecutionRecipe {
    const {
      startX,
      startY,
      targetX,
      targetY,
      skillRange,
      radius,
      damagePerTick,
      tickInterval,
      lifetime,
      slowModifier,
      attackerAttack
    } = params;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const totalDistance = Math.hypot(dx, dy);

    const dashDistance = totalDistance > 0 ? Math.min(totalDistance, skillRange) : 0;
    const normalizedDx = totalDistance > 0 ? dx / totalDistance : 0;
    const normalizedDy = totalDistance > 0 ? dy / totalDistance : 0;

    const zoneSpacing = radius * ZONE_SPACING_RATIO;
    const numZones = Math.ceil(dashDistance / zoneSpacing) || 1;

    const zones: SkillZoneRecipe[] = [];

    for (let i = 0; i < numZones; i++) {
      const t = numZones > 1 ? i / (numZones - 1) : 1;
      zones.push({
        x: startX + normalizedDx * dashDistance * t,
        y: startY + normalizedDy * dashDistance * t,
        radius,
        damagePerTick,
        tickInterval,
        lifetime,
        slowModifier,
        attackerAttack
      });
    }

    const dashTargetX = startX + normalizedDx * dashDistance;
    const dashTargetY = startY + normalizedDy * dashDistance;

    // Zona final no destino do dash
    zones.push({
      x: dashTargetX,
      y: dashTargetY,
      radius,
      damagePerTick,
      tickInterval,
      lifetime,
      slowModifier,
      attackerAttack
    });

    return {
      zones,
      dashTarget: { x: dashTargetX, y: dashTargetY },
      speedBuff: { duration: DASH_SPEED_BUFF_DURATION, multiplier: DASH_SPEED_BUFF_MULTIPLIER }
    };
  }
}
