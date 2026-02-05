/**
 * Configurações de IA de Inimigos.
 * 
 * Este arquivo é compartilhado entre cliente e servidor.
 * Define comportamentos de IA para criaturas selvagens.
 */

import type { ThreatTier, EnemyBehaviorType } from "./enums";

/**
 * Configuração de comportamento por perfil de inimigo.
 */
export interface EnemyBehaviorConfig {
  /** Tipo de comportamento */
  behaviorType: EnemyBehaviorType;
  /** Velocidade de movimento (pixels/segundo) */
  moveSpeed: number;
  /** Distância máxima para detectar o jogador (pixels) */
  detectionRange: number;
  /** Distância para iniciar ataque (pixels) */
  attackRange: number;
  /** Tempo de cooldown entre ataques (segundos) */
  attackCooldown: number;
  /** Dano causado por ataque */
  attackDamage: number;
  /** Duração do "tell" antes do ataque (segundos) - antecipação visual */
  attackWindup: number;
  /** Para ranged: distância mínima que tenta manter do jogador */
  preferredDistance?: number;
  /** Para ranged: velocidade do projétil (pixels/segundo) */
  projectileSpeed?: number;
  /** Tempo de stun ao receber dano (segundos) */
  stunDuration: number;
  /** Cor do indicador de estado agressivo */
  aggroIndicatorColor: number;
}

/**
 * Configurações de IA por tier de ameaça e tipo de comportamento.
 * 
 * Cada tier tem duas variantes: melee e ranged.
 * O tier afeta os valores base, e o tipo de comportamento define a estratégia.
 */
export const ENEMY_AI_CONFIG: Record<ThreatTier, Record<EnemyBehaviorType, EnemyBehaviorConfig>> = {
  comum: {
    melee: {
      behaviorType: "melee",
      moveSpeed: 100,
      detectionRange: 180,
      attackRange: 30,
      attackCooldown: 1.5,
      attackDamage: 8,
      attackWindup: 0.4,
      stunDuration: 0.15,
      aggroIndicatorColor: 0xf97373,
      preferredDistance: 30,
      projectileSpeed: 0
    },
    ranged: {
      behaviorType: "ranged",
      moveSpeed: 70,
      detectionRange: 220,
      attackRange: 160,
      attackCooldown: 2.0,
      attackDamage: 6,
      attackWindup: 0.5,
      preferredDistance: 120,
      projectileSpeed: 200,
      stunDuration: 0.2,
      aggroIndicatorColor: 0xfca5a5
    }
  },
  perigosa: {
    melee: {
      behaviorType: "melee",
      moveSpeed: 130,
      detectionRange: 220,
      attackRange: 35,
      attackCooldown: 1.2,
      attackDamage: 14,
      attackWindup: 0.35,
      stunDuration: 0.12,
      aggroIndicatorColor: 0xf97316,
      preferredDistance: 40,
      projectileSpeed: 0
    },
    ranged: {
      behaviorType: "ranged",
      moveSpeed: 90,
      detectionRange: 260,
      attackRange: 200,
      attackCooldown: 1.6,
      attackDamage: 10,
      attackWindup: 0.45,
      preferredDistance: 150,
      projectileSpeed: 250,
      stunDuration: 0.15,
      aggroIndicatorColor: 0xfb923c
    }
  },
  elite: {
    melee: {
      behaviorType: "melee",
      moveSpeed: 160,
      detectionRange: 280,
      attackRange: 40,
      attackCooldown: 1.0,
      attackDamage: 22,
      attackWindup: 0.3,
      stunDuration: 0.1,
      aggroIndicatorColor: 0xdc2626,
      preferredDistance: 50,
      projectileSpeed: 0
    },
    ranged: {
      behaviorType: "ranged",
      moveSpeed: 110,
      detectionRange: 300,
      attackRange: 240,
      attackCooldown: 1.4,
      attackDamage: 18,
      attackWindup: 0.4,
      preferredDistance: 180,
      projectileSpeed: 300,
      stunDuration: 0.12,
      aggroIndicatorColor: 0xef4444
    }
  }
} as const;
