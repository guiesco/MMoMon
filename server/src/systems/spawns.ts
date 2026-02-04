/**
 * Sistema de Spawns de Criaturas e Recursos
 * 
 * Este módulo gerencia a criação inicial de todas as entidades do mundo:
 * - Criaturas selvagens (com IA variada)
 * - Recursos coletáveis
 * - Pontos de extração
 * 
 * O servidor é a fonte de verdade para posições e propriedades de todas as entidades.
 * 
 * @module server/systems/spawns
 */

import type { WorldState, ThreatTier, EnemyBehaviorType } from "../types";
import {
  createCreature,
  createResource,
  createExtractionPoint,
  resetIdCounter
} from "../types";
import { getEffectiveStatsForWildCreature } from "./wildCreatureStats";

/**
 * Configuração de um mapa para spawns.
 * Espelha a estrutura de MapConfig do cliente.
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
// CONFIGURAÇÕES DE SPAWN (copiadas/adaptadas de src/game/constants.ts)
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

/**
 * Chance de uma criatura ser ranged vs melee.
 * 0.35 = 35% de chance de ser ranged, 65% de ser melee.
 */
export const RANGED_SPAWN_CHANCE = 0.35;

/**
 * HP base por tier de ameaça.
 * Valores espelhados de src/game/constants.ts (THREAT_TIERS).
 */
export const TIER_BASE_HP: Record<ThreatTier, number> = {
  comum: 60,
  perigosa: 90,
  elite: 130
};

/**
 * Recursos disponíveis por bioma.
 * Espelhado de src/game/constants.ts (BIOME_RESOURCES).
 */
export const BIOME_RESOURCES: Record<string, BiomeResourceConfig> = {
  "floresta-celestial": {
    common: ["resource-ferro-cristalino"],
    rare: ["resource-seiva-eterna"]
  },
  "cavernas-cristalinas": {
    common: ["resource-ferro-cristalino"],
    rare: ["resource-cristal-caverna", "resource-energia-pura"]
  },
  "ruinas-antigas": {
    common: ["resource-ferro-cristalino", "resource-mola-precisao"],
    rare: ["resource-energia-pura"]
  },
  "pantano-sombrio": {
    common: ["resource-ferro-cristalino"],
    rare: ["resource-essencia-sombria"]
  }
};

/**
 * Chance de spawnar um recurso raro (vs comum).
 * 0.2 = 20% de chance de recurso raro.
 */
export const RARE_RESOURCE_CHANCE = 0.2;

/**
 * Pool de tipos de criaturas disponíveis para spawn.
 * Por enquanto, usa um pool genérico. No futuro pode variar por bioma.
 */
export const CREATURE_TYPE_POOL = [
  "pyrognat",
  "aquaryl",
  "verdant",
  "voltiger"
];

// ============================================================================
// FUNÇÕES DE SPAWN
// ============================================================================

/**
 * Classe auxiliar para geração de números pseudo-aleatórios determinísticos.
 * Implementa um Mulberry32 PRNG simples e rápido.
 * 
 * Útil para spawns determinísticos (replay, debug, testes).
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Retorna um número aleatório entre 0 (inclusivo) e 1 (exclusivo).
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Retorna um inteiro aleatório entre min (inclusivo) e max (inclusivo).
   */
  between(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

/**
 * Sorteia um tier de ameaça baseado nos pesos configurados.
 * 
 * @param rng - Gerador de números aleatórios
 * @param weights - Pesos de cada tier
 * @returns Tier sorteado
 */
function pickTier(rng: SeededRandom, weights: ThreatTierWeights): ThreatTier {
  const tierKeys = Object.keys(weights) as ThreatTier[];
  const totalWeight = tierKeys.reduce(
    (sum, key) => sum + (weights[key] ?? 0),
    0
  );

  const roll = rng.next() * totalWeight;
  let acc = 0;
  for (const key of tierKeys) {
    acc += weights[key] ?? 0;
    if (roll <= acc) return key;
  }
  return "comum";
}

/**
 * Sorteia um tipo de comportamento de IA (melee vs ranged).
 * 
 * @param rng - Gerador de números aleatórios
 * @returns Tipo de comportamento
 */
function pickBehaviorType(rng: SeededRandom): EnemyBehaviorType {
  return rng.next() < RANGED_SPAWN_CHANCE ? "ranged" : "melee";
}

/**
 * Sorteia um tipo de criatura do pool.
 * 
 * @param rng - Gerador de números aleatórios
 * @returns Tipo de criatura
 */
function pickCreatureType(rng: SeededRandom): string {
  return CREATURE_TYPE_POOL[rng.between(0, CREATURE_TYPE_POOL.length - 1)];
}

/**
 * Sorteia um recurso baseado no bioma.
 * 
 * @param rng - Gerador de números aleatórios
 * @param biomeId - ID do bioma
 * @returns Tupla [resourceType, isRare]
 */
function pickResource(
  rng: SeededRandom,
  biomeId: string
): [string, boolean] {
  const biomeConfig = BIOME_RESOURCES[biomeId] ?? BIOME_RESOURCES["floresta-celestial"];
  
  const isRare = rng.next() < RARE_RESOURCE_CHANCE && biomeConfig.rare.length > 0;
  
  if (isRare) {
    const idx = rng.between(0, biomeConfig.rare.length - 1);
    return [biomeConfig.rare[idx], true];
  } else {
    const idx = rng.between(0, biomeConfig.common.length - 1);
    return [biomeConfig.common[idx], false];
  }
}

/**
 * Inicializa o mundo com spawns de criaturas, recursos e pontos de extração.
 * 
 * Esta função deve ser chamada quando uma sala começa, antes de qualquer jogador
 * entrar no mundo.
 * 
 * @param worldState - Estado do mundo a ser populado (modificado in-place)
 * @param mapConfig - Configuração do mapa
 * @param seed - Seed opcional para spawns determinísticos (útil para debug/replay)
 * @param tierWeights - Pesos de tier customizados (opcional, usa DEFAULT_TIER_WEIGHTS se não fornecido)
 * 
 * @example
 * ```ts
 * const worldState = createEmptyWorldState();
 * const mapConfig: MapSpawnConfig = {
 *   id: "floresta-celestial",
 *   wildSpawnCount: 12,
 *   resourceSpawnCount: 25,
 *   worldWidth: 2400,
 *   worldHeight: 1800,
 *   extractionPoints: [{ x: 1200, y: 150, radius: 100 }]
 * };
 * initializeWorldSpawns(worldState, mapConfig, 12345);
 * ```
 */
export function initializeWorldSpawns(
  worldState: WorldState,
  mapConfig: MapSpawnConfig,
  seed?: number,
  tierWeights?: ThreatTierWeights
): void {
  // Reseta contador de IDs para garantir IDs consistentes
  resetIdCounter();

  // Inicializa RNG (usa Date.now() se seed não for fornecido)
  const rng = new SeededRandom(seed ?? Date.now());
  // ✅ Usa distribuição de tiers baseada no mapa, ou a fornecida como parâmetro
  const weights = tierWeights ?? getMapTierWeights(mapConfig.id);
  
  // ✅ Obtém configurações de nível e rank baseadas no mapa
  const levelConfig = getMapLevelConfig(mapConfig.id);
  const rankConfig = getMapRankConfig(mapConfig.id);
  
  // Log das configurações do mapa
  console.log(`[SPAWNS] Configurações do mapa "${mapConfig.id}":`, {
    tierWeights: weights,
    levelRanges: levelConfig,
    rankRanges: rankConfig
  });

  const { worldWidth, worldHeight } = mapConfig;

  // Margens para evitar spawn muito perto das bordas
  const marginX = 60;
  const marginY = 60;
  const spawnMinY = 150; // Evita spawn muito perto do topo (onde geralmente fica zona de extração)

  console.log(`[SPAWNS] Inicializando mundo "${mapConfig.id}" (seed: ${seed ?? "random"})`);

  // ========== SPAWNA CRIATURAS SELVAGENS ==========
  console.log(`[SPAWNS] Spawnando ${mapConfig.wildSpawnCount} criaturas...`);
  for (let i = 0; i < mapConfig.wildSpawnCount; i++) {
    const x = rng.between(marginX, worldWidth - marginX);
    const y = rng.between(spawnMinY, worldHeight - marginY);
    
    const tier = pickTier(rng, weights);
    const behaviorType = pickBehaviorType(rng);
    const creatureType = pickCreatureType(rng);
    
    // ✅ Calcular nível e estrelas baseado no tier E no mapa
    const tierLevelRange = levelConfig[tier];
    const level = rng.between(tierLevelRange.min, tierLevelRange.max);
    
    // Estrelas (rank) baseado no tier E no mapa
    const tierRankRange = rankConfig[tier];
    const rank = rng.between(tierRankRange.min, tierRankRange.max);
    
    // ✅ IA #9: Calcular HP baseado em tipo + nível + estrelas ao invés de tier direto
    const effectiveStats = getEffectiveStatsForWildCreature(creatureType, level, rank);
    const maxHp = effectiveStats.hp;

    const creature = createCreature(creatureType, x, y, tier, behaviorType, maxHp);
    // Garantir que o nível está definido (já é definido em createCreature, mas garantimos)
    creature.level = level;
    worldState.creatures.push(creature);
  }

  console.log(`[SPAWNS] ✓ ${worldState.creatures.length} criaturas spawnadas`);

  // ========== SPAWNA RECURSOS ==========
  console.log(`[SPAWNS] Spawnando ${mapConfig.resourceSpawnCount} recursos...`);
  for (let i = 0; i < mapConfig.resourceSpawnCount; i++) {
    const x = rng.between(marginX, worldWidth - marginX);
    const y = rng.between(spawnMinY, worldHeight - marginY);
    
    const [resourceType, isRare] = pickResource(rng, mapConfig.id);
    const quantity = 1; // Por enquanto, todos os recursos dão 1 unidade
    
    const resource = createResource(resourceType, x, y, quantity, isRare);
    worldState.resources.push(resource);
  }

  console.log(`[SPAWNS] ✓ ${worldState.resources.length} recursos spawnados`);

  // ========== SPAWNA PONTOS DE EXTRAÇÃO ==========
  console.log(`[SPAWNS] Criando ${mapConfig.extractionPoints.length} ponto(s) de extração...`);
  for (const point of mapConfig.extractionPoints) {
    const extractionPoint = createExtractionPoint(point.x, point.y, point.radius);
    worldState.extractionPoints.push(extractionPoint);
  }

  console.log(`[SPAWNS] ✓ ${worldState.extractionPoints.length} ponto(s) de extração criado(s)`);

  // Log final de resumo
  console.log(`[SPAWNS] Mundo inicializado com sucesso:`, {
    criaturas: worldState.creatures.length,
    recursos: worldState.resources.length,
    pontos_extracao: worldState.extractionPoints.length
  });
}

/**
 * Respawna uma criatura em uma posição específica ou aleatória.
 * 
 * Útil para respawn durante a partida (ex: após morte de criatura).
 * 
 * @param worldState - Estado do mundo
 * @param mapConfig - Configuração do mapa (deve incluir 'id' para determinar níveis e tiers)
 * @param position - Posição específica (opcional, gera aleatória se não fornecido)
 * @param tier - Tier da criatura (opcional, sorteia baseado no mapa se não fornecido)
 * @param rng - Gerador de números aleatórios (opcional, cria um novo se não fornecido)
 * @returns Criatura spawnada
 * 
 * @example
 * ```ts
 * const newCreature = respawnCreature(worldState, mapConfig, { x: 500, y: 600 }, "elite");
 * worldState.creatures.push(newCreature);
 * ```
 */
export function respawnCreature(
  worldState: WorldState,
  mapConfig: Pick<MapSpawnConfig, "id" | "worldWidth" | "worldHeight">,
  position?: { x: number; y: number },
  tier?: ThreatTier,
  rng?: SeededRandom
): ReturnType<typeof createCreature> {
  const random = rng ?? new SeededRandom(Date.now());
  
  // Posição (usa fornecida ou gera aleatória)
  const x = position?.x ?? random.between(60, mapConfig.worldWidth - 60);
  const y = position?.y ?? random.between(150, mapConfig.worldHeight - 60);
  
  // ✅ Usa distribuição de tiers baseada no mapa
  const mapTierWeights = getMapTierWeights(mapConfig.id);
  const finalTier = tier ?? pickTier(random, mapTierWeights);
  
  // ✅ Obtém configurações de nível e rank baseadas no mapa
  const levelConfig = getMapLevelConfig(mapConfig.id);
  const rankConfig = getMapRankConfig(mapConfig.id);
  
  const behaviorType = pickBehaviorType(random);
  const creatureType = pickCreatureType(random);
  
  // ✅ Calcular nível e estrelas baseado no tier E no mapa
  const tierLevelRange = levelConfig[finalTier];
  const level = random.between(tierLevelRange.min, tierLevelRange.max);
  
  // Estrelas (rank) baseado no tier E no mapa
  const tierRankRange = rankConfig[finalTier];
  const rank = random.between(tierRankRange.min, tierRankRange.max);
  
  // ✅ Calcular HP baseado em tipo + nível + estrelas ao invés de tier direto
  const effectiveStats = getEffectiveStatsForWildCreature(creatureType, level, rank);
  const maxHp = effectiveStats.hp;

  const creature = createCreature(creatureType, x, y, finalTier, behaviorType, maxHp);
  creature.level = level;
  return creature;
}

/**
 * Respawna um recurso em uma posição específica ou aleatória.
 * 
 * Útil para respawn periódico de recursos durante a partida.
 * 
 * @param worldState - Estado do mundo
 * @param mapConfig - Configuração do mapa (para limites de mundo e bioma)
 * @param position - Posição específica (opcional, gera aleatória se não fornecido)
 * @param rng - Gerador de números aleatórios (opcional, cria um novo se não fornecido)
 * @returns Recurso spawnado
 * 
 * @example
 * ```ts
 * const newResource = respawnResource(worldState, mapConfig);
 * worldState.resources.push(newResource);
 * ```
 */
export function respawnResource(
  worldState: WorldState,
  mapConfig: Pick<MapSpawnConfig, "id" | "worldWidth" | "worldHeight">,
  position?: { x: number; y: number },
  rng?: SeededRandom
): ReturnType<typeof createResource> {
  const random = rng ?? new SeededRandom(Date.now());
  
  // Posição (usa fornecida ou gera aleatória)
  const x = position?.x ?? random.between(60, mapConfig.worldWidth - 60);
  const y = position?.y ?? random.between(150, mapConfig.worldHeight - 60);
  
  const [resourceType, isRare] = pickResource(random, mapConfig.id);
  const quantity = 1;

  return createResource(resourceType, x, y, quantity, isRare);
}
