/**
 * Pyrognat - Fogo/Voador. Classe central: dados + tema + executeSpecialSkill.
 */

import type { Creature } from "./types";
import type { ElementType } from "../types";
import { executeCreatureSpecialSkill } from "../creatureBehaviors";
import type { SkillExecutionParams, SkillExecutionRecipe } from "../creatureBehaviors";
import { ATTACK_CHAMA_RAPIDA, SKILL_NEVOEIRO_INCENDIARIO } from "../attacks";

export class Pyrognat implements Creature {
  readonly id = "pyrognat";
  readonly name = "Pyrognat";
  readonly primaryType: ElementType = "Fogo";
  readonly secondaryType: ElementType = "Voador";
  readonly stats = {
    hp: 70,
    moveSpeed: 280,
    defense: 11,
    attackDamage: 22,
    skillCooldown: 12,
    ai: { detectionRange: 180, preferredDistance: 140 }
  };
  readonly basicAttack = ATTACK_CHAMA_RAPIDA;
  readonly specialSkill = SKILL_NEVOEIRO_INCENDIARIO;
  readonly statProgression = {
    hpPerLevel: 0.025,
    attackDamagePerLevel: 0.032,
    defensePerLevel: 0.018,
    moveSpeedPerLevel: 0.01,
    detectionRangePerLevel: 0.005
  };
  readonly evolutionChain = ["Pyrognat", "Pyrodactyl", "Solaraptor"];
  readonly theme = {
    primaryColor: 0xf97316,
    strokeColor: 0xea580c,
    attackColor: 0xff6b35,
    particleColor: 0xfbbf24,
    hitFlashColor: 0xfef3c7,
    projectileRadius: 5,
    meleeArcWidth: 0,
    typeLabel: "Fogo/Voador"
  };

  getTypes(): { primaryType: ElementType; secondaryType?: ElementType } {
    return { primaryType: this.primaryType, secondaryType: this.secondaryType };
  }

  executeSpecialSkill(params: SkillExecutionParams): SkillExecutionRecipe {
    return executeCreatureSpecialSkill(this.id, params);
  }
}
