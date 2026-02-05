/**
 * Constantes de configuração do servidor.
 * 
 * Este arquivo agrupa todas as configurações e valores de balanceamento
 * usados no servidor para manter consistência com as regras de jogo.
 * 
 * ✅ Agora re-exporta do diretório compartilhado para manter sincronizado com cliente
 */

import { EXPEDITION_DURATION_SECONDS } from "../../shared/expedition";
export { EXTRACTION_REQUIRED_SECONDS } from "../../shared/expedition";


// ✅ Re-exportar constantes do servidor do shared
export {
  TICK_RATE,
  TICK_INTERVAL_MS,
  STATE_BROADCAST_RATE,
  MAX_PLAYERS_PER_ROOM,
  DEBUG_GAME_LOOP,
  SKILL_COOLDOWN_MS,
  BUFF_CONFIG
} from "../../shared/serverConstants";

// Alias para compatibilidade (MATCH_DURATION_SECONDS = EXPEDITION_DURATION_SECONDS)
export const MATCH_DURATION_SECONDS = EXPEDITION_DURATION_SECONDS;

// ✅ Re-exportar constantes de jogo do shared
export {
  COMBAT_CONFIG,
  CAPTURE_CONFIG,
  CAPTURE_BALL_MODIFIERS,
  CAPTURE_TIER_PENALTIES,
  type CaptureBallModifier
} from "../../shared/gameConstants";

// ✅ Re-exportar configurações de spawn do shared
export {
  MAP_SPAWN_CONFIGS,
  getMapSpawnConfig,
  type MapSpawnConfig
} from "../../shared/spawnConfig";

// ✅ Re-exportar tipos e constantes de IA do shared
export type { ThreatTier, EnemyBehaviorType, EnemyAIState } from "../../shared/enums";
export type { EnemyBehaviorConfig } from "../../shared/enemyAI";
export { ENEMY_AI_CONFIG } from "../../shared/enemyAI";

// ✅ Re-exportar configurações visuais de inimigos do shared
export { ENEMY_VISUAL_CONFIG } from "../../shared/gameConstants";

// ✅ Todas as constantes agora estão no shared
// Este arquivo mantém apenas os re-exports para compatibilidade
