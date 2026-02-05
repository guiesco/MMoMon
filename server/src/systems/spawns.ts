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
import { getCreatureBehaviorType } from "./combat";

// ✅ Importar e re-exportar tipos e configurações do shared
import type { MapSpawnConfig, ThreatTierWeights } from "../../../shared/spawnConfig";
import {
  DEFAULT_TIER_WEIGHTS,
  MAP_LEVEL_CONFIGS,
  MAP_RANK_CONFIGS,
  MAP_TIER_WEIGHTS,
  CREATURE_TYPE_POOL,
  getMapLevelConfig,
  getMapRankConfig,
  getMapTierWeights
} from "../../../shared/spawnConfig";
import { BIOME_RESOURCES, RESOURCE_CONFIG, type BiomeId } from "../../../shared/gameConstants";

// Re-exportar para compatibilidade
export type {
  MapSpawnConfig,
  ThreatTierWeights,
  MapLevelConfig,
  MapRankConfig,
  BiomeResourceConfig
} from "../../../shared/spawnConfig";

export {
  DEFAULT_TIER_WEIGHTS,
  MAP_LEVEL_CONFIGS,
  MAP_RANK_CONFIGS,
  MAP_TIER_WEIGHTS,
  CREATURE_TYPE_POOL,
  getMapLevelConfig,
  getMapRankConfig,
  getMapTierWeights
} from "../../../shared/spawnConfig";

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
  const biomeConfig = BIOME_RESOURCES[biomeId as BiomeId] ?? BIOME_RESOURCES["floresta-celestial"];
  
  const isRare = rng.next() < RESOURCE_CONFIG.rareChance && biomeConfig.rare.length > 0;
  
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
    const creatureType = pickCreatureType(rng);
    // ✅ Determina behaviorType baseado na definição da criatura (não mais aleatório)
    const behaviorType = getCreatureBehaviorType(creatureType);
    
    // ✅ Calcular nível e estrelas baseado no tier E no mapa
    const tierLevelRange = levelConfig[tier];
    const level = rng.between(tierLevelRange.min, tierLevelRange.max);
    
    // Estrelas (rank) baseado no tier E no mapa
    const tierRankRange = rankConfig[tier];
    const rank = rng.between(tierRankRange.min, tierRankRange.max);
    
    // ✅ Calcular TODOS os stats baseados em tipo + nível + estrelas ao invés de tier direto
    const effectiveStats = getEffectiveStatsForWildCreature(creatureType, level, rank);
    const maxHp = effectiveStats.hp;

    const creature = createCreature(creatureType, x, y, tier, behaviorType, maxHp);
    // Garantir que o nível está definido (já é definido em createCreature, mas garantimos)
    creature.level = level;
    // ✅ Armazenar TODOS os stats calculados para uso na IA (incluindo valores de IA)
    creature.effectiveStats = {
      moveSpeed: effectiveStats.moveSpeed,
      defense: effectiveStats.defense,
      attackDamage: effectiveStats.attackDamage,
      detectionRange: effectiveStats.detectionRange,
      attackRange: effectiveStats.attackRange,
      attackCooldown: effectiveStats.attackCooldown,
      attackWindup: effectiveStats.attackWindup,
      stunDuration: effectiveStats.stunDuration,
      preferredDistance: effectiveStats.preferredDistance,
      projectileSpeed: effectiveStats.projectileSpeed
    };
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
  
  const creatureType = pickCreatureType(random);
  // ✅ Determina behaviorType baseado na definição da criatura (não mais aleatório)
  const behaviorType = getCreatureBehaviorType(creatureType);
  
  // ✅ Calcular nível e estrelas baseado no tier E no mapa
  const tierLevelRange = levelConfig[finalTier];
  const level = random.between(tierLevelRange.min, tierLevelRange.max);
  
  // Estrelas (rank) baseado no tier E no mapa
  const tierRankRange = rankConfig[finalTier];
  const rank = random.between(tierRankRange.min, tierRankRange.max);
  
  // ✅ Calcular TODOS os stats baseados em tipo + nível + estrelas ao invés de tier direto
  const effectiveStats = getEffectiveStatsForWildCreature(creatureType, level, rank);
  const maxHp = effectiveStats.hp;

  const creature = createCreature(creatureType, x, y, finalTier, behaviorType, maxHp);
  creature.level = level;
  // ✅ Armazenar TODOS os stats calculados para uso na IA (incluindo valores de IA)
  creature.effectiveStats = {
    moveSpeed: effectiveStats.moveSpeed,
    defense: effectiveStats.defense,
    attackDamage: effectiveStats.attackDamage,
    detectionRange: effectiveStats.detectionRange,
    attackRange: effectiveStats.attackRange,
    attackCooldown: effectiveStats.attackCooldown,
    attackWindup: effectiveStats.attackWindup,
    stunDuration: effectiveStats.stunDuration,
    preferredDistance: effectiveStats.preferredDistance,
    projectileSpeed: effectiveStats.projectileSpeed
  };
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
