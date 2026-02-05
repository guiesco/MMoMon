/**
 * Configurações Visuais
 * 
 * Este arquivo é compartilhado entre cliente e servidor.
 * Define todas as configurações visuais: cores, barras de HP, itens, etc.
 * 
 * IMPORTANTE: Qualquer mudança aqui deve ser refletida em ambos os lados.
 */

import type { ElementType } from "./types";

// ============================================================================
// CORES DE TIPOS ELEMENTAIS
// ============================================================================

/**
 * Cores primárias associadas a cada tipo de criatura.
 * Usadas para colorir as barras de HP e dar identidade visual.
 */
export const TYPE_COLORS: Record<ElementType, { primary: number; secondary: number; glow: number }> = {
  Fogo: { primary: 0xf97316, secondary: 0xfbbf24, glow: 0xff6b35 },
  Água: { primary: 0x3b82f6, secondary: 0x06b6d4, glow: 0x60a5fa },
  Planta: { primary: 0x22c55e, secondary: 0x84cc16, glow: 0x4ade80 },
  Elétrico: { primary: 0xfacc15, secondary: 0xfde047, glow: 0xfef08a },
  Psíquico: { primary: 0xa855f7, secondary: 0xc084fc, glow: 0xd8b4fe },
  Terrestre: { primary: 0x92400e, secondary: 0xb45309, glow: 0xd97706 },
  Voador: { primary: 0x7dd3fc, secondary: 0xbae6fd, glow: 0xe0f2fe },
  Lutador: { primary: 0xdc2626, secondary: 0xef4444, glow: 0xf87171 }
};

// ============================================================================
// CONFIGURAÇÕES DE BARRAS DE HP
// ============================================================================

/**
 * Configurações visuais das barras de HP
 */
export const HP_BAR_CONFIG = {
  // Barra do jogador no HUD
  player: {
    width: 200,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 0x374151,
    bgColor: 0x1f2937,
    bgAlpha: 0.9
  },
  // Barras de aliados (menores, no HUD)
  ally: {
    width: 140,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 0x374151,
    bgColor: 0x1f2937,
    bgAlpha: 0.85
  },
  // Barras de inimigos (flutuantes)
  enemy: {
    width: 40,
    height: 5,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 0x1f2937,
    bgColor: 0x374151,
    bgAlpha: 0.8,
    offsetY: -20, // acima do sprite
    maxDistance: 250 // distância máxima para mostrar barra
  },
  // Limiares de estado
  thresholds: {
    low: 0.3, // 30% - HP crítico
    medium: 0.6 // 60% - HP moderado
  },
  // Cores de estado
  stateColors: {
    healthy: 0x22c55e, // verde
    medium: 0xfacc15, // amarelo
    low: 0xef4444 // vermelho
  }
} as const;

// ============================================================================
// CONFIGURAÇÕES DE ITENS
// ============================================================================

/**
 * Tipo de categoria de item para visualização.
 */
export type ItemCategory = 
  | "capture"       // Pokébolas e ferramentas de captura
  | "raw_resource"  // Recursos brutos para crafting
  | "consumable"    // Itens de uso imediato (poções)
  | "upgrade";      // Upgrades de base/permanentes

/**
 * Tipo de tier de item.
 */
export type ItemTier = "Básico" | "Avançado" | "Épico" | "Lendário";

/**
 * Configuração visual por categoria de item.
 */
export interface CategoryVisualConfig {
  /** Nome amigável da categoria (para UI) */
  label: string;
  /** Cor principal da categoria (hex) */
  primaryColor: number;
  /** Cor de texto/contraste para a categoria */
  textColor: string;
  /** Ícone/símbolo simples representando a categoria */
  symbol: string;
  /** Forma base do pickup no mapa */
  shape: "diamond" | "circle" | "hexagon" | "star";
}

/**
 * Configuração visual por tier de raridade.
 */
export interface TierVisualConfig {
  /** Nome do tier */
  label: string;
  /** Cor de borda/destaque do tier */
  borderColor: number;
  /** Cor de fundo para UI (com alpha) */
  bgColor: string;
  /** Intensidade de brilho (0-1) - usado para efeitos visuais */
  glowIntensity: number;
  /** Espessura da borda */
  borderWidth: number;
  /** Cor do texto indicativo de tier */
  tierTextColor: string;
}

/**
 * Configuração visual por categoria de item.
 * Cores escolhidas para comunicar função rapidamente:
 * - Vermelho: captura (associação com pokébolas)
 * - Âmbar/Dourado: recursos (minérios, materiais)
 * - Verde: consumíveis (cura, vitalidade)
 * - Azul: upgrades (tecnologia, progressão)
 */
export const CATEGORY_VISUALS: Record<ItemCategory, CategoryVisualConfig> = {
  capture: {
    label: "Captura",
    primaryColor: 0xef4444, // vermelho
    textColor: "#fecaca",
    symbol: "◉",
    shape: "circle"
  },
  raw_resource: {
    label: "Recurso",
    primaryColor: 0xf59e0b, // âmbar
    textColor: "#fef3c7",
    symbol: "◆",
    shape: "diamond"
  },
  consumable: {
    label: "Consumível",
    primaryColor: 0x22c55e, // verde
    textColor: "#bbf7d0",
    symbol: "♥",
    shape: "hexagon"
  },
  upgrade: {
    label: "Upgrade",
    primaryColor: 0x3b82f6, // azul
    textColor: "#bfdbfe",
    symbol: "★",
    shape: "star"
  }
};

/**
 * Configuração visual por tier de raridade.
 * Tiers mais raros têm cores mais brilhantes e bordas mais destacadas.
 */
export const TIER_VISUALS: Record<ItemTier, TierVisualConfig> = {
  "Básico": {
    label: "Básico",
    borderColor: 0x6b7280, // cinza
    bgColor: "rgba(107, 114, 128, 0.15)",
    glowIntensity: 0,
    borderWidth: 1,
    tierTextColor: "#9ca3af"
  },
  "Avançado": {
    label: "Avançado",
    borderColor: 0x3b82f6, // azul
    bgColor: "rgba(59, 130, 246, 0.2)",
    glowIntensity: 0.3,
    borderWidth: 2,
    tierTextColor: "#60a5fa"
  },
  "Épico": {
    label: "Épico",
    borderColor: 0xa855f7, // roxo
    bgColor: "rgba(168, 85, 247, 0.25)",
    glowIntensity: 0.6,
    borderWidth: 2,
    tierTextColor: "#c084fc"
  },
  "Lendário": {
    label: "Lendário",
    borderColor: 0xfbbf24, // dourado
    bgColor: "rgba(251, 191, 36, 0.3)",
    glowIntensity: 1.0,
    borderWidth: 3,
    tierTextColor: "#fcd34d"
  }
};

/**
 * Cores rápidas para uso direto em código.
 * Evita ter que chamar funções para casos simples.
 */
export const QUICK_COLORS = {
  // Por categoria
  capture: 0xef4444,
  raw_resource: 0xf59e0b,
  consumable: 0x22c55e,
  upgrade: 0x3b82f6,
  
  // Por tier
  tierBasico: 0x6b7280,
  tierAvancado: 0x3b82f6,
  tierEpico: 0xa855f7,
  tierLendario: 0xfbbf24,

  // Cores de texto CSS
  textCapture: "#fecaca",
  textResource: "#fef3c7",
  textConsumable: "#bbf7d0",
  textUpgrade: "#bfdbfe"
} as const;

/**
 * Configuração de pickup por ID de recurso específico.
 * Permite customização fina de cores para recursos individuais.
 */
export const RESOURCE_PICKUP_OVERRIDES: Record<string, { color: number; borderColor: number }> = {
  // Recursos comuns (tons de âmbar)
  "resource-ferro-cristalino": { color: 0xfbbf24, borderColor: 0x78350f },
  
  // Recursos avançados (tons mais distintos)
  "resource-mola-precisao": { color: 0x60a5fa, borderColor: 0x1e40af },
  "resource-seiva-eterna": { color: 0x4ade80, borderColor: 0x166534 },
  "resource-cristal-caverna": { color: 0x22d3ee, borderColor: 0x0e7490 },
  
  // Recursos épicos (tons vibrantes)
  "resource-energia-pura": { color: 0xa855f7, borderColor: 0x6b21a8 },
  "resource-essencia-sombria": { color: 0x8b5cf6, borderColor: 0x4c1d95 }
};
