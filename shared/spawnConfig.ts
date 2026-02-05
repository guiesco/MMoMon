/**
 * Configurações de Spawn
 * 
 * Este arquivo é compartilhado entre cliente e servidor.
 * Define configurações de spawn de criaturas, recursos e mapas.
 * 
 * IMPORTANTE: Qualquer mudança aqui deve ser refletida em ambos os lados.
 */

// ============================================================================
// TIPOS
// ============================================================================

/**
 * Configuração de um mapa para spawns.
 */
export interface MapSpawnConfig {
  /** ID do mapa/bioma */
  id: string;
  /** Número de criaturas selvagens a spawnar */
  wildSpawnCount: number;
  /** Número de recursos a spawnar */
  resourceSpawnCount: number;
  /** Largura do mundo em pixels */
  worldWidth: number;
  /** Altura do mundo em pixels */
  worldHeight: number;
  /** Pontos de extração (posição e raio) */
  extractionPoints: Array<{ x: number; y: number; radius: number }>;
}

/**
 * Configuração de spawns de criaturas por tier.
 * Define a distribuição de tiers de ameaça.
 */
export interface ThreatTierWeights {
  comum: number;
  perigosa: number;
  elite: number;
}

/**
 * Configuração de níveis por tier para um mapa.
 * Define o range de níveis que cada tier pode ter em um mapa específico.
 */
export interface MapLevelConfig {
  comum: { min: number; max: number };
  perigosa: { min: number; max: number };
  elite: { min: number; max: number };
}

/**
 * Configuração de ranks (estrelas) por tier para um mapa.
 * Define o range de ranks que cada tier pode ter em um mapa específico.
 */
export interface MapRankConfig {
  comum: { min: number; max: number };
  perigosa: { min: number; max: number };
  elite: { min: number; max: number };
}

/**
 * Configuração de spawns por bioma.
 * Define quais recursos aparecem em cada bioma.
 */
export interface BiomeResourceConfig {
  common: string[];
  rare: string[];
}

// ============================================================================
// CONFIGURAÇÕES DE MAPAS
// ============================================================================

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

// ============================================================================
// CONFIGURAÇÕES DE SPAWN
// ============================================================================

/**
 * Distribuição padrão de tiers de ameaça.
 * A soma não precisa ser 1.0 (é normalizada em runtime).
 */
export const DEFAULT_TIER_WEIGHTS: ThreatTierWeights = {
  comum: 0.55,
  perigosa: 0.3,
  elite: 0.15
};

/**
 * Configuração de níveis por tier por mapa.
 * Mapas mais difíceis têm níveis mais altos, podendo chegar até nível 50.
 */
export const MAP_LEVEL_CONFIGS: Record<string, MapLevelConfig> = {
  "floresta-celestial": {
    comum: { min: 1, max: 5 },
    perigosa: { min: 4, max: 10 },
    elite: { min: 8, max: 15 }
  },
  "cavernas-cristalinas": {
    comum: { min: 5, max: 12 },
    perigosa: { min: 10, max: 20 },
    elite: { min: 18, max: 30 }
  },
  "ruinas-antigas": {
    comum: { min: 10, max: 20 },
    perigosa: { min: 18, max: 35 },
    elite: { min: 30, max: 50 }
  },
  "pantano-sombrio": {
    comum: { min: 8, max: 15 },
    perigosa: { min: 15, max: 28 },
    elite: { min: 25, max: 45 }
  }
};

/**
 * Configuração de ranks (estrelas) por tier por mapa.
 * Mapas mais difíceis têm mais estrelas.
 */
export const MAP_RANK_CONFIGS: Record<string, MapRankConfig> = {
  "floresta-celestial": {
    comum: { min: 1, max: 1 },
    perigosa: { min: 2, max: 3 },
    elite: { min: 3, max: 4 }
  },
  "cavernas-cristalinas": {
    comum: { min: 1, max: 2 },
    perigosa: { min: 2, max: 4 },
    elite: { min: 4, max: 5 }
  },
  "ruinas-antigas": {
    comum: { min: 2, max: 3 },
    perigosa: { min: 3, max: 5 },
    elite: { min: 4, max: 5 }
  },
  "pantano-sombrio": {
    comum: { min: 1, max: 2 },
    perigosa: { min: 3, max: 4 },
    elite: { min: 4, max: 5 }
  }
};

/**
 * Distribuição de tiers de ameaça por mapa.
 * Mapas mais difíceis têm mais elites e menos comuns.
 */
export const MAP_TIER_WEIGHTS: Record<string, ThreatTierWeights> = {
  "floresta-celestial": {
    comum: 0.60,  // 60% comuns (mapa fácil)
    perigosa: 0.30, // 30% perigosas
    elite: 0.10    // 10% elites
  },
  "cavernas-cristalinas": {
    comum: 0.45,  // 45% comuns
    perigosa: 0.35, // 35% perigosas
    elite: 0.20    // 20% elites
  },
  "ruinas-antigas": {
    comum: 0.30,  // 30% comuns (mapa difícil)
    perigosa: 0.40, // 40% perigosas
    elite: 0.30    // 30% elites
  },
  "pantano-sombrio": {
    comum: 0.40,  // 40% comuns
    perigosa: 0.40, // 40% perigosas
    elite: 0.20    // 20% elites
  }
};

/**
 * Retorna a configuração de níveis para um mapa.
 * Se o mapa não existir, retorna configuração padrão (floresta-celestial).
 */
export function getMapLevelConfig(mapId: string): MapLevelConfig {
  return MAP_LEVEL_CONFIGS[mapId] ?? MAP_LEVEL_CONFIGS["floresta-celestial"];
}

/**
 * Retorna a configuração de ranks para um mapa.
 * Se o mapa não existir, retorna configuração padrão (floresta-celestial).
 */
export function getMapRankConfig(mapId: string): MapRankConfig {
  return MAP_RANK_CONFIGS[mapId] ?? MAP_RANK_CONFIGS["floresta-celestial"];
}

/**
 * Retorna a distribuição de tiers para um mapa.
 * Se o mapa não existir, retorna distribuição padrão.
 */
export function getMapTierWeights(mapId: string): ThreatTierWeights {
  return MAP_TIER_WEIGHTS[mapId] ?? DEFAULT_TIER_WEIGHTS;
}

// ✅ Re-exportar CREATURE_TYPE_POOL do creatures.ts
export { CREATURE_TYPE_POOL } from "./creatures";
