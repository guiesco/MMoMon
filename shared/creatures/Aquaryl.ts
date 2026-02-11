/**
 * Aquaryl - Água. Classe central: dados + tema + executeSpecialSkill.
 */

import type { Creature } from "./types";
import type { ElementType } from "../types";
import { executeCreatureSpecialSkill } from "../creatureBehaviors";
import type { SkillExecutionParams, SkillExecutionRecipe } from "../creatureBehaviors";
import { ATTACK_JATO_AGUA, SKILL_MARE_CURATIVA } from "../attacks";

export class Aquaryl implements Creature {
  readonly id = "aquaryl";
  readonly name = "Aquaryl";
  readonly primaryType: ElementType = "Água";
  readonly secondaryType: ElementType | undefined = undefined;
  readonly stats = {
    hp: 108,
    moveSpeed: 220,
    defense: 12,
    attackDamage: 19,
    skillCooldown: 10,
    ai: { detectionRange: 200, preferredDistance: 160 }
  };
  readonly basicAttack = ATTACK_JATO_AGUA;
  readonly specialSkill = SKILL_MARE_CURATIVA;
  readonly statProgression = {
    hpPerLevel: 0.033,
    attackDamagePerLevel: 0.026,
    defensePerLevel: 0.02,
    moveSpeedPerLevel: 0.008,
    detectionRangePerLevel: 0.004
  };
  readonly evolutionChain = undefined;
  readonly theme = {
    primaryColor: 0x38bdf8,
    strokeColor: 0x0ea5e9,
    attackColor: 0x22d3ee,
    particleColor: 0x67e8f9,
    hitFlashColor: 0xe0f2fe,
    projectileRadius: 6,
    meleeArcWidth: 0,
    typeLabel: "Água"
  };

  getTypes(): { primaryType: ElementType; secondaryType?: ElementType } {
    return { primaryType: this.primaryType, secondaryType: this.secondaryType };
  }

  executeSpecialSkill(params: SkillExecutionParams): SkillExecutionRecipe {
    return executeCreatureSpecialSkill(this.id, params);
  }
}
