/**
 * Sistema de Identidade Visual de Itens
 * 
 * Este módulo centraliza todas as configurações visuais para representação de itens,
 * permitindo que o jogador identifique rapidamente:
 * - Categoria do item (captura, recurso, consumível, upgrade)
 * - Raridade/tier do item (Básico → Lendário)
 * - Valor relativo para decisões de risco x recompensa
 */

import type { ItemKind, ItemTier } from "./types";

// ============================================================================
// TIPOS
// ============================================================================

export type ItemCategory = 
  | "capture"       // Pokébolas e ferramentas de captura
  | "raw_resource"  // Recursos brutos para crafting
  | "consumable"    // Itens de uso imediato (poções)
  | "upgrade";      // Upgrades de base/permanentes

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

export interface ItemVisualResult {
  category: CategoryVisualConfig;
  tier: TierVisualConfig;
  /** Cor final do pickup no mapa (combinação de categoria + tier) */
  pickupColor: number;
  /** Cor de borda do pickup */
  pickupBorderColor: number;
}

// ============================================================================
// CONFIGURAÇÕES DE CATEGORIA
// ============================================================================

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

// ============================================================================
// CONFIGURAÇÕES DE RARIDADE/TIER
// ============================================================================

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

// ============================================================================
// MAPEAMENTO ITEM KIND → CATEGORY
// ============================================================================

/**
 * Mapeia o ItemKind do sistema antigo para a nova categoria visual.
 * Isso permite manter compatibilidade com items.ts existente.
 */
export function mapKindToCategory(kind: ItemKind): ItemCategory {
  switch (kind) {
    case "capture_tool":
      return "capture";
    case "evolution_item":
      return "consumable"; // evolução é tratada como consumível especial
    case "consumable":
      // Diferencia recursos brutos de consumíveis reais pelo ID
      return "consumable";
    case "base_upgrade":
      return "upgrade";
    default:
      return "raw_resource";
  }
}

/**
 * Verifica se um item é um recurso bruto (material de crafting)
 * baseado no ID do item.
 */
export function isRawResource(itemId: string): boolean {
  return itemId.startsWith("resource-");
}

// ============================================================================
// FUNÇÕES PRINCIPAIS
// ============================================================================

/**
 * Obtém a configuração visual completa para um item.
 * Combina categoria e tier para gerar cores finais de pickup e UI.
 */
export function getItemVisuals(
  kind: ItemKind,
  tier: ItemTier,
  itemId?: string
): ItemVisualResult {
  // Determina categoria - recursos brutos têm tratamento especial
  let category: ItemCategory;
  if (itemId && isRawResource(itemId)) {
    category = "raw_resource";
  } else {
    category = mapKindToCategory(kind);
  }

  const categoryConfig = CATEGORY_VISUALS[category];
  const tierConfig = TIER_VISUALS[tier];

  // Cor do pickup: mistura a cor da categoria com intensidade do tier
  const pickupColor = adjustColorByTier(categoryConfig.primaryColor, tier);
  const pickupBorderColor = tierConfig.borderColor;

  return {
    category: categoryConfig,
    tier: tierConfig,
    pickupColor,
    pickupBorderColor
  };
}

/**
 * Ajusta a cor base da categoria de acordo com o tier.
 * Tiers mais altos são mais brilhantes/saturados.
 */
function adjustColorByTier(baseColor: number, tier: ItemTier): number {
  const tierMultipliers: Record<ItemTier, number> = {
    "Básico": 0.7,      // mais escuro
    "Avançado": 0.9,    // levemente atenuado
    "Épico": 1.0,       // cor plena
    "Lendário": 1.1     // mais brilhante (clamped)
  };

  const multiplier = tierMultipliers[tier];
  
  // Extrai componentes RGB
  const r = ((baseColor >> 16) & 0xff);
  const g = ((baseColor >> 8) & 0xff);
  const b = (baseColor & 0xff);

  // Aplica multiplicador (clamp 0-255)
  const newR = Math.min(255, Math.floor(r * multiplier));
  const newG = Math.min(255, Math.floor(g * multiplier));
  const newB = Math.min(255, Math.floor(b * multiplier));

  return (newR << 16) | (newG << 8) | newB;
}

/**
 * Gera string CSS de cor a partir de número hex.
 */
export function hexToCSS(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/**
 * Obtém cor de texto para contraste com a cor de fundo do item.
 * Usado em tooltips e descrições.
 */
export function getContrastTextColor(bgColor: number): string {
  // Calcula luminância relativa
  const r = ((bgColor >> 16) & 0xff) / 255;
  const g = ((bgColor >> 8) & 0xff) / 255;
  const b = (bgColor & 0xff) / 255;
  
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  
  return luminance > 0.5 ? "#1f2937" : "#f9fafb";
}

// ============================================================================
// CONSTANTES DE REFERÊNCIA RÁPIDA
// ============================================================================

/**
 * Cores rápidas para uso direto em código.
 * Evita ter que chamar getItemVisuals para casos simples.
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

/**
 * Obtém cores de pickup para um recurso específico.
 * Usa override se disponível, senão calcula baseado no tier.
 */
export function getResourcePickupColors(
  resourceId: string,
  tier: ItemTier
): { color: number; borderColor: number } {
  // Verifica se há override específico
  if (RESOURCE_PICKUP_OVERRIDES[resourceId]) {
    return RESOURCE_PICKUP_OVERRIDES[resourceId];
  }

  // Fallback: usa sistema de categoria + tier
  const visuals = getItemVisuals("consumable", tier, resourceId);
  return {
    color: visuals.pickupColor,
    borderColor: visuals.pickupBorderColor
  };
}
