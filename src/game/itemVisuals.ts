/**
 * Sistema de Identidade Visual de Itens
 * 
 * Este módulo centraliza todas as configurações visuais para representação de itens,
 * permitindo que o jogador identifique rapidamente:
 * - Categoria do item (captura, recurso, consumível, upgrade)
 * - Raridade/tier do item (Básico → Lendário)
 * - Valor relativo para decisões de risco x recompensa
 * 
 * ✅ Agora re-exporta do diretório compartilhado para manter sincronizado com servidor
 */

import type { ItemKind, ItemTier } from "./types";

// ✅ Re-exportar tipos e constantes do shared
export type {
  ItemCategory,
  CategoryVisualConfig,
  TierVisualConfig
} from "../../shared/visualConfig";

export {
  CATEGORY_VISUALS,
  TIER_VISUALS,
  QUICK_COLORS,
  RESOURCE_PICKUP_OVERRIDES
} from "../../shared/visualConfig";

// Importar do shared para uso nas funções
import { CATEGORY_VISUALS, TIER_VISUALS, RESOURCE_PICKUP_OVERRIDES, type ItemCategory } from "../../shared/visualConfig";

// Interface para resultado visual (específica do client)
export interface ItemVisualResult {
  category: CategoryVisualConfig;
  tier: TierVisualConfig;
  /** Cor final do pickup no mapa (combinação de categoria + tier) */
  pickupColor: number;
  /** Cor de borda do pickup */
  pickupBorderColor: number;
}

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
