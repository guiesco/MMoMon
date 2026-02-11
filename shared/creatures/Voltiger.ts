/**
 * Voltiger - Elétrico/Lutador. Classe central: dados + tema + executeSpecialSkill.
 */

import type { Creature } from "./types";
import type { ElementType } from "../types";
import { executeCreatureSpecialSkill } from "../creatureBehaviors";
import type { SkillExecutionParams, SkillExecutionRecipe } from "../creatureBehaviors";
import { ATTACK_RAIO_CORTANTE, SKILL_SURTO_ELETRICO } from "../attacks";

export class Voltiger implements Creature {
  readonly id = "voltiger";
  readonly name = "Voltiger";
  readonly primaryType: ElementType = "Elétrico";
  readonly secondaryType: ElementType = "Lutador";
  readonly stats = {
    hp: 72,
    moveSpeed: 300,
    defense: 8,
    attackDamage: 17,
    skillCooldown: 9,
    ai: { detectionRange: 220, preferredDistance: 180 }
  };
  readonly basicAttack = ATTACK_RAIO_CORTANTE;
  readonly specialSkill = SKILL_SURTO_ELETRICO;
  readonly statProgression = {
    hpPerLevel: 0.022,
    attackDamagePerLevel: 0.028,
    defensePerLevel: 0.012,
    moveSpeedPerLevel: 0.012,
    detectionRangePerLevel: 0.006
  };
  readonly evolutionChain = undefined;
  readonly theme = {
    primaryColor: 0xfacc15,
    strokeColor: 0xeab308,
    attackColor: 0xfef08a,
    particleColor: 0xfef9c3,
    hitFlashColor: 0xfefce8,
    projectileRadius: 4,
    meleeArcWidth: 0,
    typeLabel: "Elétrico/Lutador"
  };

  getTypes(): { primaryType: ElementType; secondaryType?: ElementType } {
    return { primaryType: this.primaryType, secondaryType: this.secondaryType };
  }

  executeSpecialSkill(params: SkillExecutionParams): SkillExecutionRecipe {
    return executeCreatureSpecialSkill(this.id, params);
  }
}
