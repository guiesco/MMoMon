/**
 * Constantes de configuração do jogo centralizadas.
 *
 * Este módulo agrupa valores de balanceamento e configuração usados
 * em diferentes partes do jogo, facilitando ajustes e evitando "números mágicos"
 * espalhados pelo código.
 * 
 * ✅ Agora re-exporta do diretório compartilhado para manter sincronizado com servidor
 */

// ✅ Re-exportar tipos e constantes do shared
export type { ThreatTier, EnemyBehaviorType, EnemyAIState } from "../../shared/enums";
export type { ThreatTierConfig } from "../../shared/threatTiers";
export type { EnemyBehaviorConfig } from "../../shared/enemyAI";
export { ENEMY_AI_CONFIG } from "../../shared/enemyAI";
export { EXPEDITION_DURATION_SECONDS, EXTRACTION_REQUIRED_SECONDS } from "../../shared/expedition";

// ✅ Re-exportar constantes de jogo do shared
export {
  WILD_CREATURE_CONFIG,
  RESOURCE_CONFIG,
  BIOME_RESOURCES,
  COMBAT_CONFIG,
  CAPTURE_CONFIG,
  CAPTURE_BALL_MODIFIERS,
  CAPTURE_TIER_PENALTIES,
  EXPEDITION_EVENT_CONFIG,
  GREED_RISK_CONFIG,
  ELEMENTAL_SYNERGIES,
  ENEMY_VISUAL_CONFIG,
  type ExpeditionEventId,
  type ExpeditionEventConfig,
  type ElementalSynergyType,
  type ElementalSynergyConfig,
  type CaptureBallModifier
} from "../../shared/gameConstants";

// ✅ Todas as constantes agora estão no shared/gameConstants.ts
// Este arquivo mantém apenas os re-exports para compatibilidade
