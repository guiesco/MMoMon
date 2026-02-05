/**
 * Constantes Específicas do Servidor
 * 
 * Este arquivo contém constantes que são usadas apenas no servidor.
 * Não são compartilhadas com o cliente, mas são mantidas aqui para organização.
 * 
 * IMPORTANTE: Estas constantes são apenas para o servidor.
 */

// ============================================================================
// Configurações de Rede e Performance
// ============================================================================

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
 * Habilita logs de debug do game loop.
 */
export const DEBUG_GAME_LOOP = true;

// ============================================================================
// Configurações de Skills
// ============================================================================

/**
 * Cooldown global de skills (em milissegundos).
 * Jogador deve esperar este tempo entre usar habilidades.
 */
export const SKILL_COOLDOWN_MS = 8000; // 8 segundos

// ============================================================================
// Configurações de Buffs
// ============================================================================

/**
 * Configurações de buffs e debuffs.
 */
export const BUFF_CONFIG = {
  // Buffs de velocidade
  SPEED_BOOST_MULTIPLIER: 1.5,    // +50% velocidade
  SLOW_MULTIPLIER: 0.5,            // -50% velocidade
  FREEZE_MULTIPLIER: 0,            // 0% velocidade (congelado)
  
  // Durações padrão
  DEFAULT_SPEED_DURATION: 3,       // segundos
  DEFAULT_SLOW_DURATION: 2,
  DEFAULT_FREEZE_DURATION: 1.5,
  DEFAULT_STUN_DURATION: 1,
  DEFAULT_POISON_DURATION: 5,
  DEFAULT_SHIELD_DURATION: 5,
  DEFAULT_INVULNERABLE_DURATION: 0.5,
  DEFAULT_REGEN_DURATION: 5,
  
  // Valores
  POISON_DAMAGE_PER_SECOND: 2,
  REGEN_HP_PER_SECOND: 5,
} as const;
