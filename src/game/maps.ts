/**
 * Configurações de mapas/biomas de expedição.
 *
 * Esta camada isola identidade de cada mapa (layout, risco x recompensa,
 * densidade de recursos/criaturas e estilo visual) sem duplicar lógica de cena.
 */

export type MapId =
  | "floresta-celestial"
  | "cavernas-cristalinas"
  | "ruinas-antigas";

export interface MapVisualConfig {
  /** Cor de fundo principal (fundo distante) */
  backgroundPrimary: number;
  /** Cor de fundo secundária (faixa central) */
  backgroundSecondary: number;
  /** Paleta de elementos de cenário (blocos, pedras, ruínas, árvores etc.) */
  tileColors: number[];
}

export interface MapSpawnConfig {
  /** Número de criaturas selvagens spawnadas no início da expedição */
  wildSpawnCount: number;
  /** HP máximo padrão das criaturas selvagens neste mapa */
  wildMaxHp: number;
  /** Raio de captura: distância máxima do jogador para tentar capturar */
  captureRadius: number;
  /** Número de recursos spawnados no início da expedição */
  resourceSpawnCount: number;
  /** Tamanho visual dos recursos (em pixels) */
  resourceSize: number;
}

export interface MapWorldConfig {
  /** Largura total do mundo em pixels (maior que a viewport) */
  worldWidth: number;
  /** Altura total do mundo em pixels (maior que a viewport) */
  worldHeight: number;
  /** Nível de zoom da câmera (1 = 100%, 1.5 = 150% zoom in) */
  cameraZoom: number;
  /** Posição X inicial do jogador (normalizada 0-1 do mundo) */
  playerSpawnX: number;
  /** Posição Y inicial do jogador (normalizada 0-1 do mundo) */
  playerSpawnY: number;
}

export interface MapExtractionConfig {
  /** Tempo necessário parado na zona para extrair (segundos) */
  extractionRequiredSeconds: number;
  /**
   * Posição da zona de extração principal.
   * A cena usa valores proporcionais à tela (0–1) para facilitar reaproveitamento.
   */
  zoneNormalizedX: number;
  zoneNormalizedY: number;
  /** Largura/altura relativas à largura da tela (frações de 0–1) */
  zoneWidthRatio: number;
  zoneHeightRatio: number;
}

export interface MapConfig {
  id: MapId;
  name: string;
  description: string;
  /** Duração da expedição neste mapa (segundos) */
  durationSeconds: number;
  /** Perfil de risco x recompensa simples para UI/documentação */
  riskLevel: "Baixo" | "Médio" | "Alto";
  rewardProfile: "Estável" | "Explosivo" | "Balanceado";
  visual: MapVisualConfig;
  spawns: MapSpawnConfig;
  extraction: MapExtractionConfig;
  /** Configurações do mundo/câmera para criar sensação de exploração */
  world: MapWorldConfig;
}

export const DEFAULT_MAP_ID: MapId = "floresta-celestial";

export const MAP_CONFIGS: Record<MapId, MapConfig> = {
  "floresta-celestial": {
    id: "floresta-celestial",
    name: "Floresta Celestial",
    description:
      "Clareiras amplas com blocos de vegetação luminescente. Bioma de risco médio, ideal para o primeiro contato com o loop de extração.",
    durationSeconds: 240,
    riskLevel: "Médio",
    rewardProfile: "Balanceado",
    visual: {
      backgroundPrimary: 0x020617,
      backgroundSecondary: 0x020b1b,
      tileColors: [0x14532d, 0x166534, 0x15803d]
    },
    spawns: {
      wildSpawnCount: 12,
      wildMaxHp: 70,
      captureRadius: 80,
      resourceSpawnCount: 25,
      resourceSize: 14
    },
    extraction: {
      extractionRequiredSeconds: 5,
      // Zona de extração centralizada na parte superior
      zoneNormalizedX: 0.5,
      zoneNormalizedY: 0.08,
      zoneWidthRatio: 0.08,
      zoneHeightRatio: 0.06
    },
    world: {
      worldWidth: 2400,
      worldHeight: 1800,
      cameraZoom: 1.0,
      playerSpawnX: 0.5,
      playerSpawnY: 0.85
    }
  },
  "cavernas-cristalinas": {
    id: "cavernas-cristalinas",
    name: "Cavernas Cristalinas",
    description:
      "Galerias estreitas repletas de cristais que refletem luz. Muitos recursos concentrados, mas com linhas de visão limitadas.",
    durationSeconds: 210,
    riskLevel: "Médio",
    rewardProfile: "Estável",
    visual: {
      backgroundPrimary: 0x020617,
      backgroundSecondary: 0x0f172a,
      tileColors: [0x1d4ed8, 0x22d3ee, 0x38bdf8]
    },
    spawns: {
      wildSpawnCount: 10,
      wildMaxHp: 75,
      captureRadius: 70,
      resourceSpawnCount: 30,
      resourceSize: 16
    },
    extraction: {
      extractionRequiredSeconds: 5,
      // Zona de extração deslocada para a lateral direita superior
      zoneNormalizedX: 0.88,
      zoneNormalizedY: 0.12,
      zoneWidthRatio: 0.07,
      zoneHeightRatio: 0.07
    },
    world: {
      worldWidth: 2800,
      worldHeight: 2000,
      cameraZoom: 1.0,
      playerSpawnX: 0.15,
      playerSpawnY: 0.85
    }
  },
  "ruinas-antigas": {
    id: "ruinas-antigas",
    name: "Ruínas Antigas",
    description:
      "Plataformas de pedra quebradas e pilares destruídos. Criaturas mais agressivas protegem artefatos valiosos.",
    durationSeconds: 240,
    riskLevel: "Alto",
    rewardProfile: "Explosivo",
    visual: {
      backgroundPrimary: 0x111827,
      backgroundSecondary: 0x1f2937,
      tileColors: [0x4b5563, 0x9ca3af, 0xf97316]
    },
    spawns: {
      wildSpawnCount: 16,
      wildMaxHp: 80,
      captureRadius: 85,
      resourceSpawnCount: 20,
      resourceSize: 16
    },
    extraction: {
      extractionRequiredSeconds: 6,
      // Zona de extração central, forçando travessia do mapa
      zoneNormalizedX: 0.5,
      zoneNormalizedY: 0.15,
      zoneWidthRatio: 0.08,
      zoneHeightRatio: 0.06
    },
    world: {
      worldWidth: 3200,
      worldHeight: 2400,
      cameraZoom: 1.0,
      playerSpawnX: 0.5,
      playerSpawnY: 0.9
    }
  }
};

export function getMapConfig(id: MapId): MapConfig {
  return MAP_CONFIGS[id] ?? MAP_CONFIGS[DEFAULT_MAP_ID];
}

export function normalizeMapId(raw: string | null): MapId | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower in MAP_CONFIGS) {
    return lower as MapId;
  }
  return null;
}

export function getNextMapId(current: MapId): MapId {
  const ids: MapId[] = ["floresta-celestial", "cavernas-cristalinas", "ruinas-antigas"];
  const idx = ids.indexOf(current);
  if (idx === -1) return DEFAULT_MAP_ID;
  return ids[(idx + 1) % ids.length];
}

