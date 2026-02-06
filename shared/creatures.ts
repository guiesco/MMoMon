/**
 * Definições de Criaturas
 * 
 * Este arquivo é compartilhado entre cliente e servidor.
 * Define todas as criaturas disponíveis, seus stats base, tipos e habilidades.
 * 
 * IMPORTANTE: Qualquer mudança aqui deve ser refletida em ambos os lados.
 */

import type { ElementType } from "./types";
import { RANK_CONFIG } from "./creatureProgression";
import type { BasicAttack, SpecialSkill } from "./attacks";
import {
  ATTACK_CHAMA_RAPIDA,
  ATTACK_JATO_AGUA,
  ATTACK_CHICOTE_VINHA,
  ATTACK_RAIO_CORTANTE,
  SKILL_NEVOEIRO_INCENDIARIO,
  SKILL_MARE_CURATIVA,
  SKILL_RAIZES_PRENDENTES,
  SKILL_SURTO_ELETRICO
} from "./attacks";

// ============================================================================
// TIPOS
// ============================================================================

/**
 * Valores de IA base de uma criatura.
 * Apenas valores relacionados ao comportamento de IA, não aos ataques.
 */
export interface CreatureAIStats {
  detectionRange: number;
  preferredDistance: number;
}

/**
 * Stats base de uma criatura.
 */
export interface CreatureStats {
  hp: number;
  moveSpeed: number;
  defense: number;
  attackDamage: number;
  skillCooldown: number;
  ai: CreatureAIStats;
}

/**
 * Progressões individuais de stats por nível para cada criatura.
 * Cada criatura pode ter valores diferentes de progressão.
 */
export interface CreatureStatProgression {
  /** % de HP adicional por nível */
  hpPerLevel: number;
  /** % de dano adicional por nível */
  attackDamagePerLevel: number;
  /** % de defesa adicional por nível */
  defensePerLevel: number;
  /** % de velocidade adicional por nível */
  moveSpeedPerLevel: number;
  /** % de alcance de detecção adicional por nível */
  detectionRangePerLevel: number;
}

// Re-exportar tipos para compatibilidade
export type { BasicAttack, SpecialSkill } from "./attacks";

/**
 * Definição completa de uma criatura.
 */
export interface CreatureDefinition {
  id: string;
  name: string;
  primaryType: ElementType;
  secondaryType?: ElementType;
  stats: CreatureStats;
  basicAttack: BasicAttack;
  specialSkill: SpecialSkill;
  /** Progressões individuais de stats por nível */
  statProgression: CreatureStatProgression;
  evolutionChain?: string[];
}

// ============================================================================
// DEFINIÇÕES DE CRIATURAS
// ============================================================================

/**
 * Pool completo de criaturas disponíveis no jogo.
 */
export const CREATURES: CreatureDefinition[] = [
  {
    id: "pyrognat",
    name: "Pyrognat",
    primaryType: "Fogo",
    secondaryType: "Voador",
    stats: {
      hp: 70, // -10 (DPS Rápido: menos HP)
      moveSpeed: 280, // +20 (DPS Rápido: mais velocidade)
      defense: 6, // -2 (DPS Rápido: menos defesa)
      attackDamage: 24, // +4 (DPS Rápido: mais dano)
      skillCooldown: 12,
      ai: {
        detectionRange: 180,
        preferredDistance: 140
      }
    },
    basicAttack: ATTACK_CHAMA_RAPIDA,
    specialSkill: SKILL_NEVOEIRO_INCENDIARIO,
    statProgression: {
      hpPerLevel: 0.025, // +2.5% por nível (era 2%) - DPS Rápido: menos HP
      attackDamagePerLevel: 0.035, // +3.5% por nível (era 1.8%) - DPS Rápido: foco em ATK
      defensePerLevel: 0.015, // +1.5% por nível (era 1%) - DPS Rápido: menos DEF
      moveSpeedPerLevel: 0.01, // +1.0% por nível (era 0.6%) - DPS Rápido: foco em SPD
      detectionRangePerLevel: 0.005 // +0.5% por nível (era 0.4%)
    },
    evolutionChain: ["Pyrognat", "Pyrodactyl", "Solaraptor"]
  },
  {
    id: "aquaryl",
    name: "Aquaryl",
    primaryType: "Água",
    stats: {
      hp: 110, // +20 (Tank/Support: mais HP)
      moveSpeed: 220, // -20 (Tank/Support: menos velocidade)
      defense: 12, // -2 (Tank/Support: defesa reduzida para melhorar TTK)
      attackDamage: 15, // +1 (Tank/Support: dano ligeiramente aumentado)
      skillCooldown: 10,
      ai: {
        detectionRange: 200,
        preferredDistance: 160
      }
    },
    basicAttack: ATTACK_JATO_AGUA,
    specialSkill: SKILL_MARE_CURATIVA,
    statProgression: {
      hpPerLevel: 0.035, // +3.5% por nível (era 2.2%) - Tank/Support: foco em HP
      attackDamagePerLevel: 0.022, // +2.2% por nível (aumentado para melhorar TTK) - Tank/Support: menos ATK
      defensePerLevel: 0.02, // +2.0% por nível (reduzido para melhorar TTK) - Tank/Support: foco em DEF
      moveSpeedPerLevel: 0.008, // +0.8% por nível (era 0.5%) - Tank/Support: menos SPD
      detectionRangePerLevel: 0.004 // +0.4% por nível (mantém)
    }
  },
  {
    id: "verdant",
    name: "Verdant",
    primaryType: "Planta",
    stats: {
      hp: 120, // +20 (Tank Melee: mais HP)
      moveSpeed: 200, // -20 (Tank Melee: menos velocidade)
      defense: 14, // -2 (Tank Melee: defesa reduzida para melhorar TTK)
      attackDamage: 13, // +1 (Tank Melee: dano ligeiramente aumentado)
      skillCooldown: 11,
      ai: {
        detectionRange: 150,
        preferredDistance: 30
      }
    },
    basicAttack: ATTACK_CHICOTE_VINHA,
    specialSkill: SKILL_RAIZES_PRENDENTES,
    statProgression: {
      hpPerLevel: 0.038, // +3.8% por nível (era 2.1%) - Tank Melee: foco em HP
      attackDamagePerLevel: 0.02, // +2.0% por nível (aumentado para melhorar TTK) - Tank Melee: menos ATK
      defensePerLevel: 0.025, // +2.5% por nível (reduzido para melhorar TTK) - Tank Melee: foco em DEF
      moveSpeedPerLevel: 0.005, // +0.5% por nível (era 0.4%) - Tank Melee: menos SPD
      detectionRangePerLevel: 0.003 // +0.3% por nível (mantém)
    }
  },
  {
    id: "voltiger",
    name: "Voltiger",
    primaryType: "Elétrico",
    secondaryType: "Lutador",
    stats: {
      hp: 65, // +5 (Glass Cannon: HP ligeiramente aumentado para não morrer tão rápido)
      moveSpeed: 300, // +20 (Glass Cannon: mais velocidade)
      defense: 5, // -1 (Glass Cannon: menos defesa)
      attackDamage: 26, // -2 (Glass Cannon: dano ligeiramente reduzido)
      skillCooldown: 9,
      ai: {
        detectionRange: 220,
        preferredDistance: 180
      }
    },
    basicAttack: ATTACK_RAIO_CORTANTE,
    specialSkill: SKILL_SURTO_ELETRICO,
    statProgression: {
      hpPerLevel: 0.02, // +2.0% por nível (era 1.8%) - Glass Cannon: menos HP
      attackDamagePerLevel: 0.045, // +4.5% por nível (era 2.0%) - Glass Cannon: foco extremo em ATK
      defensePerLevel: 0.01, // +1.0% por nível (era 0.8%) - Glass Cannon: menos DEF
      moveSpeedPerLevel: 0.012, // +1.2% por nível (era 0.7%) - Glass Cannon: foco em SPD
      detectionRangePerLevel: 0.006 // +0.6% por nível (era 0.5%) - Glass Cannon: mais range
    }
  }
];

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Obtém a definição de uma criatura por ID.
 */
export function getCreatureById(id: string): CreatureDefinition | undefined {
  return CREATURES.find((c) => c.id === id);
}

/**
 * Obtém os stats base de uma criatura por ID.
 */
export function getCreatureBaseStats(id: string): CreatureStats | undefined {
  const creature = getCreatureById(id);
  return creature?.stats;
}

/**
 * Obtém os stats de ataque de uma criatura por ID.
 * Retorna um objeto com damage, speed, range e isProjectile.
 * 
 * Se level e rank forem fornecidos, usa valores escalados (range e cooldown escalam).
 * Caso contrário, usa valores base de BasicAttack.
 * 
 * @param id - ID da criatura
 * @param projectileSpeed - Velocidade padrão de projétil (opcional, padrão 420, usado apenas se level/rank não fornecidos)
 * @param level - Nível da criatura (opcional, para escalar valores)
 * @param rank - Rank da criatura (opcional, para escalar valores)
 */
export function getCreatureAttackStats(
  id: string,
  projectileSpeed: number = 420,
  level?: number,
  rank?: number
): { damage: number; speed: number; range: number; isProjectile: boolean } | undefined {
  const creature = getCreatureById(id);
  if (!creature) return undefined;

  const basicAttack = creature.basicAttack;

  // Se level e rank foram fornecidos, escalar valores
  if (level !== undefined && rank !== undefined) {
    const rankConfig = RANK_CONFIG[rank];
    if (rankConfig) {
      const rankMultiplier = rankConfig.statMultiplier;
      const levelBonus = level - 1;
      const attackRangeBonus = 1 + levelBonus * basicAttack.attackRangePerLevel;

      // Range escala com nível e rank
      const attackRange = Math.floor(basicAttack.range * attackRangeBonus * rankMultiplier);
      // ProjectileSpeed não escala (vem direto do basicAttack)
      const finalProjectileSpeed = basicAttack.projectileSpeed;

      return {
        damage: basicAttack.damage,
        speed: basicAttack.isProjectile ? finalProjectileSpeed : 0,
        range: attackRange,
        isProjectile: basicAttack.isProjectile
      };
    }
  }

  // Fallback: usar valores base de BasicAttack
  return {
    damage: basicAttack.damage,
    speed: basicAttack.isProjectile ? (basicAttack.projectileSpeed || projectileSpeed) : 0,
    range: basicAttack.range,
    isProjectile: basicAttack.isProjectile
  };
}

/**
 * Pool de criaturas disponíveis para captura aleatória.
 * Usado quando uma captura é bem-sucedida para determinar qual criatura
 * é adicionada ao inventário do jogador.
 */
export const CAPTURE_CREATURE_POOL = [
  "pyrognat",
  "aquaryl",
  "verdant",
  "voltiger"
] as const;

/**
 * Pool de tipos de criaturas disponíveis para spawn.
 * Por enquanto, usa um pool genérico. No futuro pode variar por bioma.
 */
export const CREATURE_TYPE_POOL = [
  "pyrognat",
  "aquaryl",
  "verdant",
  "voltiger"
] as const;
