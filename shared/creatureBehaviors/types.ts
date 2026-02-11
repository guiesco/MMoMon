/**
 * Tipos para o sistema de comportamentos de criaturas (shared).
 * Usado por player e IA no servidor para executar skills sem duplicar lógica.
 */

export type SkillTypeName = "fire_fog" | "root_trap" | "electric_surge" | "heal_wave";

/** Uma zona de skill a ser criada pelo servidor (receita pura, sem IDs). */
export interface SkillZoneRecipe {
  x: number;
  y: number;
  radius: number;
  damagePerTick: number;
  tickInterval: number;
  lifetime: number;
  slowModifier?: number;
  attackerAttack?: number;
}

/** Parâmetros de entrada para execução de skill (posição, alvo, stats). */
export interface SkillExecutionParams {
  ownerId: string;
  skillType: SkillTypeName;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  skillRange: number;
  radius: number;
  damagePerTick: number;
  tickInterval: number;
  lifetime: number;
  slowModifier: number;
  attackerAttack?: number;
}

/** Resultado da execução: onde criar zonas, se há dash, buff opcional. */
export interface SkillExecutionRecipe {
  zones: SkillZoneRecipe[];
  /** Nova posição do dono (dash). Se definido, o servidor move o owner. */
  dashTarget?: { x: number; y: number };
  /** Buff de velocidade pós-dash (ex.: apenas para player). */
  speedBuff?: { duration: number; multiplier: number };
}

/** Contrato do comportamento de skill de uma criatura. */
export interface CreatureSkillBehavior {
  readonly creatureId: string;
  executeSpecialSkill(params: SkillExecutionParams): SkillExecutionRecipe;
}
