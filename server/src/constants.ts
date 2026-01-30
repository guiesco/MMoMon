/**
 * Constantes de configuração do servidor.
 * 
 * Este arquivo agrupa todas as configurações e valores de balanceamento
 * usados no servidor para manter consistência com as regras de jogo.
 */

import type { MapSpawnConfig } from "./systems/spawns";

// =============================================================================
// Configurações de Rede e Performance
// =============================================================================

/**
 * Taxa de atualização do game loop (ticks por segundo).
 * 20 ticks/s = 50ms por tick
 */
export const TICK_RATE = 20;

/**
 * Intervalo de tempo entre ticks em milissegundos.
 */
export const TICK_INTERVAL_MS = 1000 / TICK_RATE;

/**
 * Taxa de broadcast de estado para os clientes.
 * A cada N ticks, enviar snapshot completo.
 * 2 ticks = ~10 snapshots por segundo (melhor responsividade)
 */
export const STATE_BROADCAST_RATE = 2;

/**
 * Número máximo de jogadores por sala.
 */
export const MAX_PLAYERS_PER_ROOM = 12;

/**
 * Duração padrão de uma partida em segundos.
 * @deprecated Use EXPEDITION_DURATION_SECONDS instead
 */
export const MATCH_DURATION_SECONDS = 240; // 4 minutos

/**
 * Duração padrão de uma expedição em segundos.
 */
export const EXPEDITION_DURATION_SECONDS = 240; // 4 minutos

/**
 * Habilita logs de debug do game loop.
 */
export const DEBUG_GAME_LOOP = true;

// =============================================================================
// Configurações de Expedição
// =============================================================================

/**
 * Tempo necessário (em segundos) para extrair com sucesso.
 * Jogador deve permanecer na zona de extração por este tempo.
 */
export const EXTRACTION_REQUIRED_SECONDS = 5;

// =============================================================================
// Configurações de Mapas e Spawns
// =============================================================================

/**
 * Configurações de mapas para spawns.
 * 
 * Define dimensões do mundo, quantidade de spawns e pontos de extração
 * para cada mapa/bioma disponível.
 */
export const MAP_SPAWN_CONFIGS: Record<string, MapSpawnConfig> = {
  "floresta-celestial": {
    id: "floresta-celestial",
    wildSpawnCount: 12,
    resourceSpawnCount: 25,
    worldWidth: 2400,
    worldHeight: 1800,
    extractionPoints: [
      // Ponto de extração centralizado na parte superior (normalizado)
      { x: 1200, y: 144, radius: 96 } // ~0.5 * 2400, ~0.08 * 1800, raio calculado
    ]
  },
  "cavernas-cristalinas": {
    id: "cavernas-cristalinas",
    wildSpawnCount: 10,
    resourceSpawnCount: 30,
    worldWidth: 2800,
    worldHeight: 2000,
    extractionPoints: [
      // Ponto de extração na lateral direita superior
      { x: 2464, y: 240, radius: 98 } // ~0.88 * 2800, ~0.12 * 2000
    ]
  },
  "ruinas-antigas": {
    id: "ruinas-antigas",
    wildSpawnCount: 16,
    resourceSpawnCount: 20,
    worldWidth: 3200,
    worldHeight: 2400,
    extractionPoints: [
      // Ponto de extração central, forçando travessia
      { x: 1600, y: 360, radius: 128 } // ~0.5 * 3200, ~0.15 * 2400
    ]
  }
};

/**
 * Retorna a configuração de spawn de um mapa.
 * Se o mapa não existir, retorna a configuração da "floresta-celestial".
 * 
 * @param mapId - ID do mapa
 * @returns Configuração de spawn do mapa
 */
export function getMapSpawnConfig(mapId: string): MapSpawnConfig {
  return MAP_SPAWN_CONFIGS[mapId] ?? MAP_SPAWN_CONFIGS["floresta-celestial"];
}

// =============================================================================
// Configurações de Captura de Criaturas
// =============================================================================

/**
 * Configurações de captura de criaturas.
 * Copiado de src/game/constants.ts para manter servidor e cliente sincronizados.
 */
export const CAPTURE_CONFIG = {
  /** Chance base de captura (0.0 a 1.0) */
  baseChance: 0.35,
  /** Multiplicador máximo de bônus baseado em HP baixo (quanto menor o HP, maior o bônus) */
  hpBonusMultiplier: 0.5,
  /** Chance máxima de captura (cap) */
  maxChance: 0.95,
  /** Distância máxima entre jogador e criatura para permitir captura (em pixels) */
  maxCaptureDistance: 150
} as const;

/**
 * Modificadores de captura por tipo de pokébola.
 * 
 * Cada pokébola tem um multiplicador e um bônus fixo aplicados à chance de captura.
 * - multiplier: multiplica a chance base + bônus de HP
 * - flatBonus: adiciona um valor fixo após o multiplicador
 */
export interface CaptureBallModifier {
  multiplier: number;
  flatBonus: number;
}

export const CAPTURE_BALL_MODIFIERS: Record<string, CaptureBallModifier> = {
  "poke-ball-basic": { multiplier: 1, flatBonus: 0 },
  "poke-ball-precisa": { multiplier: 1.2, flatBonus: 0.05 },
  "poke-ball-ultra": { multiplier: 1.6, flatBonus: 0.1 }
} as const;

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
 * Penalidades de captura por tier de criatura.
 * Criaturas de tier maior são mais difíceis de capturar.
 */
export const CAPTURE_TIER_PENALTIES: Record<string, number> = {
  comum: 0,
  perigosa: 0.05,
  elite: 0.15
} as const;

// =============================================================================
// Configurações de Combate
// =============================================================================

/**
 * Dano base de projétil do jogador.
 */
export const PLAYER_PROJECTILE_DAMAGE = 20;

/**
 * Velocidade do projétil em pixels por segundo.
 */
export const PROJECTILE_SPEED = 400;

/**
 * Tempo de vida do projétil em segundos.
 */
export const PROJECTILE_LIFETIME = 1.2;

/**
 * Configurações gerais de combate.
 */
export const COMBAT_CONFIG = {
  projectileDamage: PLAYER_PROJECTILE_DAMAGE,
  projectileSpeed: PROJECTILE_SPEED,
  projectileLifetime: PROJECTILE_LIFETIME
} as const;

// =============================================================================
// Tipos de Ameaça e Comportamento de IA
// =============================================================================

/**
 * Tiers de ameaça de criaturas.
 */
export type ThreatTier = "comum" | "perigosa" | "elite";

/**
 * Tipos de comportamento de IA.
 */
export type EnemyBehaviorType = "melee" | "ranged";

/**
 * Estados de IA de criatura.
 */
export type EnemyAIState = "idle" | "chasing" | "attacking" | "retreating" | "stunned";

/**
 * Configuração de comportamento de IA de inimigos.
 */
interface AIBehaviorConfig {
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  moveSpeed: number;
  damage: number;
  detectionRange: number;
  attackDamage: number;
  preferredDistance: number;
  projectileSpeed: number;
}

/**
 * Configuração de IA de inimigos por tier e tipo de comportamento.
 */
export const ENEMY_AI_CONFIG: Record<ThreatTier, Record<EnemyBehaviorType, AIBehaviorConfig>> = {
  comum: {
    melee: {
      aggroRange: 150,
      attackRange: 50,
      attackCooldown: 2.5,
      moveSpeed: 80,
      damage: 10,
      detectionRange: 150,
      attackDamage: 10,
      preferredDistance: 30,
      projectileSpeed: 0
    },
    ranged: {
      aggroRange: 180,
      attackRange: 150,
      attackCooldown: 3.0,
      moveSpeed: 70,
      damage: 8,
      detectionRange: 200,
      attackDamage: 8,
      preferredDistance: 120,
      projectileSpeed: 200
    }
  },
  perigosa: {
    melee: {
      aggroRange: 200,
      attackRange: 60,
      attackCooldown: 2.0,
      moveSpeed: 100,
      damage: 20,
      detectionRange: 200,
      attackDamage: 20,
      preferredDistance: 40,
      projectileSpeed: 0
    },
    ranged: {
      aggroRange: 220,
      attackRange: 180,
      attackCooldown: 2.5,
      moveSpeed: 85,
      damage: 15,
      detectionRange: 250,
      attackDamage: 15,
      preferredDistance: 140,
      projectileSpeed: 250
    }
  },
  elite: {
    melee: {
      aggroRange: 250,
      attackRange: 70,
      attackCooldown: 1.5,
      moveSpeed: 120,
      damage: 35,
      detectionRange: 250,
      attackDamage: 35,
      preferredDistance: 50,
      projectileSpeed: 0
    },
    ranged: {
      aggroRange: 280,
      attackRange: 200,
      attackCooldown: 2.0,
      moveSpeed: 100,
      damage: 28,
      detectionRange: 300,
      attackDamage: 28,
      preferredDistance: 160,
      projectileSpeed: 300
    }
  }
};

/**
 * Configuração visual de inimigos.
 */
export const ENEMY_VISUAL_CONFIG = {
  aggroIndicatorColor: 0xff0000,
  attackTellDuration: 0.5,
  enemyProjectileLifetime: 2.0,
  enemyProjectileSpeed: 200
} as const;

// =============================================================================
// Configurações de Dano de Contato
// =============================================================================

/**
 * Configuração de dano de contato por tier de criatura.
 * Dano aplicado por segundo quando jogador está em contato com a criatura.
 */
export const THREAT_TIERS: Record<ThreatTier, { contactDamagePerSecond: number }> = {
  comum: { contactDamagePerSecond: 5 },
  perigosa: { contactDamagePerSecond: 12 },
  elite: { contactDamagePerSecond: 25 }
} as const;

/**
 * Raio de colisão do jogador (em pixels).
 */
export const PLAYER_COLLISION_RADIUS = 18;

/**
 * Raio de colisão de criatura (em pixels).
 */
export const CREATURE_COLLISION_RADIUS = 11;
