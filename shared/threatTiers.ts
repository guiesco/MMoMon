/**
 * Configurações de Tiers de Ameaça.
 * 
 * Este arquivo é compartilhado entre cliente e servidor.
 * Define os tiers de ameaça e suas configurações.
 */

import type { ThreatTier } from "./enums";

/**
 * Configuração completa de um tier de ameaça.
 */
export interface ThreatTierConfig {
  /** Nome amigável exibido em HUD / documentação */
  label: string;
  /** HP aproximado da criatura nesse tier (usado como base para o spawn) */
  baseHp: number;
  /** Dano de contato que o jogador recebe por tick de colisão */
  contactDamagePerSecond: number;
  /** Multiplicador aplicado à velocidade de movimento da criatura em relação ao jogador */
  moveSpeedMultiplier: number;
}
