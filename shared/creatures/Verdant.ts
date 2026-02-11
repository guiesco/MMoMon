/**
 * Verdant - Planta. Classe central: dados + tema + executeSpecialSkill.
 */

import type { Creature } from "./types";
import type { ElementType } from "../types";
import { executeCreatureSpecialSkill } from "../creatureBehaviors";
import type { SkillExecutionParams, SkillExecutionRecipe } from "../creatureBehaviors";
import { ATTACK_CHICOTE_VINHA, SKILL_RAIZES_PRENDENTES } from "../attacks";

export class Verdant implements Creature {
  readonly id = "verdant";
  readonly name = "Verdant";
  readonly primaryType: ElementType = "Planta";
  readonly secondaryType: ElementType | undefined = undefined;
  readonly stats = {
    hp: 100,
    moveSpeed: 200,
    defense: 11,
    attackDamage: 14,
    skillCooldown: 11,
    ai: { detectionRange: 150, preferredDistance: 30 }
  };
  readonly basicAttack = ATTACK_CHICOTE_VINHA;
  readonly specialSkill = SKILL_RAIZES_PRENDENTES;
  readonly statProgression = {
    hpPerLevel: 0.03,
    attackDamagePerLevel: 0.022,
    defensePerLevel: 0.02,
    moveSpeedPerLevel: 0.005,
    detectionRangePerLevel: 0.003
  };
  readonly evolutionChain = undefined;
  readonly theme = {
    primaryColor: 0x22c55e,
    strokeColor: 0x16a34a,
    attackColor: 0x4ade80,
    particleColor: 0x86efac,
    hitFlashColor: 0xdcfce7,
    projectileRadius: 0,
    meleeArcWidth: 45,
    typeLabel: "Planta"
  };

  getTypes(): { primaryType: ElementType; secondaryType?: ElementType } {
    return { primaryType: this.primaryType, secondaryType: this.secondaryType };
  }

  executeSpecialSkill(params: SkillExecutionParams): SkillExecutionRecipe {
    return executeCreatureSpecialSkill(this.id, params);
  }
}
