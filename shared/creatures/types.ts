/**
 * Tipos e interfaces para o sistema de criaturas centralizado (shared).
 * Uma única fonte de verdade por criatura: dados + tema + contrato de skill.
 */

import type { ElementType } from "../types";
import type { BasicAttack, SpecialSkill } from "../attacks";
import type { SkillExecutionParams, SkillExecutionRecipe } from "../creatureBehaviors";

// ============================================================================
// TEMA (movido para shared; antes em src/game/creatureThemes.ts)
// ============================================================================

export interface CreatureTheme {
  primaryColor: number;
  strokeColor: number;
  attackColor: number;
  particleColor: number;
  hitFlashColor: number;
  projectileRadius: number;
  meleeArcWidth: number;
  typeLabel: string;
}

// ============================================================================
// STATS E PROGRESSÃO (compatível com shared/creatures.ts atual)
// ============================================================================

export interface CreatureAIStats {
  detectionRange: number;
  preferredDistance: number;
}

export interface CreatureStats {
  hp: number;
  moveSpeed: number;
  defense: number;
  attackDamage: number;
  skillCooldown: number;
  ai: CreatureAIStats;
}

export interface CreatureStatProgression {
  hpPerLevel: number;
  attackDamagePerLevel: number;
  defensePerLevel: number;
  moveSpeedPerLevel: number;
  detectionRangePerLevel: number;
}

// ============================================================================
// DEFINIÇÃO (compatível com getCreatureById / CREATURES)
// ============================================================================

export interface CreatureDefinition {
  id: string;
  name: string;
  primaryType: ElementType;
  secondaryType?: ElementType;
  stats: CreatureStats;
  basicAttack: BasicAttack;
  specialSkill: SpecialSkill;
  statProgression: CreatureStatProgression;
  evolutionChain?: string[];
}

// ============================================================================
// CONTRATO DA CLASSE CENTRAL (Creature)
// ============================================================================

/**
 * Interface da classe central por criatura.
 * Agrega definição + tema + getTypes() + executeSpecialSkill().
 * getCreatureById retorna Creature (compatível com CreatureDefinition para leitura).
 */
export interface Creature extends CreatureDefinition {
  readonly theme: CreatureTheme;

  getTypes(): { primaryType: ElementType; secondaryType?: ElementType };

  executeSpecialSkill(params: SkillExecutionParams): SkillExecutionRecipe;
}
