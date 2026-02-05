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
      hp: 80,
      moveSpeed: 260,
      defense: 8,
      attackDamage: 20,
      skillCooldown: 12,
      ai: {
        detectionRange: 180,
        preferredDistance: 140
      }
    },
    basicAttack: ATTACK_CHAMA_RAPIDA,
    specialSkill: SKILL_NEVOEIRO_INCENDIARIO,
    statProgression: {
      hpPerLevel: 0.02, // +2% por nível
      attackDamagePerLevel: 0.018, // +1.8% por nível (ligeiramente acima da média)
      defensePerLevel: 0.01, // +1% por nível
      moveSpeedPerLevel: 0.006, // +0.6% por nível (voador, mais rápido)
      detectionRangePerLevel: 0.004 // +0.4% por nível
    },
    evolutionChain: ["Pyrognat", "Pyrodactyl", "Solaraptor"]
  },
  {
    id: "aquaryl",
    name: "Aquaryl",
    primaryType: "Água",
    stats: {
      hp: 90,
      moveSpeed: 240,
      defense: 10,
      attackDamage: 16,
      skillCooldown: 10,
      ai: {
        detectionRange: 200,
        preferredDistance: 160
      }
    },
    basicAttack: ATTACK_JATO_AGUA,
    specialSkill: SKILL_MARE_CURATIVA,
    statProgression: {
      hpPerLevel: 0.022, // +2.2% por nível (tanque, mais HP)
      attackDamagePerLevel: 0.015, // +1.5% por nível
      defensePerLevel: 0.012, // +1.2% por nível (mais defesa)
      moveSpeedPerLevel: 0.005, // +0.5% por nível
      detectionRangePerLevel: 0.004 // +0.4% por nível
    }
  },
  {
    id: "verdant",
    name: "Verdant",
    primaryType: "Planta",
    stats: {
      hp: 100,
      moveSpeed: 220,
      defense: 12,
      attackDamage: 14,
      skillCooldown: 11,
      ai: {
        detectionRange: 150,
        preferredDistance: 30
      }
    },
    basicAttack: ATTACK_CHICOTE_VINHA,
    specialSkill: SKILL_RAIZES_PRENDENTES,
    statProgression: {
      hpPerLevel: 0.021, // +2.1% por nível (tanque)
      attackDamagePerLevel: 0.014, // +1.4% por nível
      defensePerLevel: 0.013, // +1.3% por nível (mais defesa)
      moveSpeedPerLevel: 0.004, // +0.4% por nível (mais lento)
      detectionRangePerLevel: 0.003 // +0.3% por nível (melee, menos range)
    }
  },
  {
    id: "voltiger",
    name: "Voltiger",
    primaryType: "Elétrico",
    secondaryType: "Lutador",
    stats: {
      hp: 70,
      moveSpeed: 280,
      defense: 6,
      attackDamage: 22,
      skillCooldown: 9,
      ai: {
        detectionRange: 220,
        preferredDistance: 180
      }
    },
    basicAttack: ATTACK_RAIO_CORTANTE,
    specialSkill: SKILL_SURTO_ELETRICO,
    statProgression: {
      hpPerLevel: 0.018, // +1.8% por nível (glass cannon, menos HP)
      attackDamagePerLevel: 0.02, // +2% por nível (mais dano)
      defensePerLevel: 0.008, // +0.8% por nível (menos defesa)
      moveSpeedPerLevel: 0.007, // +0.7% por nível (mais rápido)
      detectionRangePerLevel: 0.005 // +0.5% por nível (mais range)
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
