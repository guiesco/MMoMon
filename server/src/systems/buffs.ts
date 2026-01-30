/**
 * Sistema de Buffs e Debuffs
 * 
 * Gerencia efeitos temporários em jogadores e criaturas:
 * - Buffs de velocidade
 * - Debuffs de lentidão/congelamento
 * - Stuns e imobilização
 * - Veneno/DoT (Damage over Time)
 * - Escudos temporários
 * 
 * Cada buff/debuff tem:
 * - Tipo (speed, slow, stun, poison, shield, etc)
 * - Duração restante
 * - Intensidade/valor (ex: 50% de velocidade)
 * - Fonte (playerId ou creatureId)
 */

import { ServerCreature } from '../types.js';
import { CombatPlayer } from './combat.js';

// ============================================================================
// Tipos de Buffs
// ============================================================================

export type BuffType = 
  | 'speed'        // Aumenta velocidade
  | 'slow'         // Diminui velocidade
  | 'freeze'       // Congela (velocidade = 0)
  | 'stun'         // Atordoamento (não pode atacar/mover)
  | 'poison'       // Dano contínuo
  | 'shield'       // Escudo que absorve dano
  | 'invulnerable' // Invulnerabilidade temporária
  | 'regen';       // Regeneração de HP

export interface Buff {
  type: BuffType;
  duration: number;      // Segundos restantes
  value?: number;        // Valor opcional (ex: % velocidade, dano/segundo)
  sourceId?: string;     // Quem aplicou o buff
  appliedAt: number;     // Timestamp quando foi aplicado
}

// ============================================================================
// Constantes de Buffs
// ============================================================================

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
};

// ============================================================================
// Gerenciamento de Buffs em Players
// ============================================================================

/**
 * Adiciona um buff a um jogador.
 * Se já existe um buff do mesmo tipo, sobrescreve com a maior duração.
 */
export function addBuffToPlayer(
  player: CombatPlayer,
  buffType: BuffType,
  duration: number,
  value?: number,
  sourceId?: string
): void {
  if (!player.buffs) {
    player.buffs = [];
  }
  
  // Procurar buff existente do mesmo tipo
  const existingIndex = player.buffs.findIndex((b: Buff) => b.type === buffType);
  
  const newBuff: Buff = {
    type: buffType,
    duration,
    value,
    sourceId,
    appliedAt: Date.now()
  };
  
  if (existingIndex >= 0) {
    // Sobrescrever apenas se a nova duração for maior
    if (duration > player.buffs[existingIndex].duration) {
      player.buffs[existingIndex] = newBuff;
    }
  } else {
    // Adicionar novo buff
    player.buffs.push(newBuff);
  }
}

/**
 * Remove um buff específico de um jogador.
 */
export function removeBuffFromPlayer(player: CombatPlayer, buffType: BuffType): void {
  if (!player.buffs) return;
  player.buffs = player.buffs.filter((b: Buff) => b.type !== buffType);
}

/**
 * Remove todos os buffs de um jogador.
 */
export function clearPlayerBuffs(player: CombatPlayer): void {
  player.buffs = [];
}

/**
 * Verifica se um jogador tem um buff específico.
 */
export function playerHasBuff(player: CombatPlayer, buffType: BuffType): boolean {
  return player.buffs?.some((b: Buff) => b.type === buffType) ?? false;
}

/**
 * Obtém a intensidade acumulada de um tipo de buff.
 * Por exemplo: múltiplos slows acumulam.
 */
export function getPlayerBuffValue(player: CombatPlayer, buffType: BuffType): number {
  if (!player.buffs) return 0;
  
  return player.buffs
    .filter((b: Buff) => b.type === buffType)
    .reduce((sum: number, b: Buff) => sum + (b.value ?? 0), 0);
}

// ============================================================================
// Gerenciamento de Buffs em Creatures
// ============================================================================

/**
 * Adiciona um buff a uma criatura.
 */
export function addBuffToCreature(
  creature: ServerCreature,
  buffType: BuffType,
  duration: number,
  value?: number,
  sourceId?: string
): void {
  if (!creature.buffs) {
    creature.buffs = [];
  }
  
  const existingIndex = creature.buffs.findIndex(b => b.type === buffType);
  
  const newBuff: Buff = {
    type: buffType,
    duration,
    value,
    sourceId,
    appliedAt: Date.now()
  };
  
  if (existingIndex >= 0) {
    if (duration > creature.buffs[existingIndex].duration) {
      creature.buffs[existingIndex] = newBuff;
    }
  } else {
    creature.buffs.push(newBuff);
  }
}

/**
 * Remove um buff específico de uma criatura.
 */
export function removeBuffFromCreature(creature: ServerCreature, buffType: BuffType): void {
  if (!creature.buffs) return;
  creature.buffs = creature.buffs.filter(b => b.type !== buffType);
}

/**
 * Verifica se uma criatura tem um buff específico.
 */
export function creatureHasBuff(creature: ServerCreature, buffType: BuffType): boolean {
  return creature.buffs?.some(b => b.type === buffType) ?? false;
}

/**
 * Obtém a intensidade acumulada de um tipo de buff em uma criatura.
 */
export function getCreatureBuffValue(creature: ServerCreature, buffType: BuffType): number {
  if (!creature.buffs) return 0;
  
  return creature.buffs
    .filter((b: Buff) => b.type === buffType)
    .reduce((sum: number, b: Buff) => sum + (b.value ?? 0), 0);
}

// ============================================================================
// Atualização de Buffs (Tick)
// ============================================================================

/**
 * Atualiza todos os buffs de um jogador.
 * - Reduz durações
 * - Remove buffs expirados
 * - Aplica efeitos contínuos (poison, regen)
 * 
 * Retorna dano/cura aplicados para broadcast.
 */
export function updatePlayerBuffs(
  playerId: string,
  player: CombatPlayer,
  deltaTime: number
): { poisonDamage?: number; regenHeal?: number } {
  if (!player.buffs || player.buffs.length === 0) {
    return {};
  }
  
  let poisonDamage = 0;
  let regenHeal = 0;
  
  // Atualizar durações e aplicar efeitos
  for (const buff of player.buffs) {
    buff.duration -= deltaTime;
    
    // Aplicar efeitos contínuos
    if (buff.type === 'poison' && buff.duration > 0) {
      const damage = (buff.value ?? BUFF_CONFIG.POISON_DAMAGE_PER_SECOND) * deltaTime;
      player.hp = Math.max(0, player.hp - damage);
      poisonDamage += damage;
      
      if (player.hp <= 0) {
        player.isDead = true;
      }
    } else if (buff.type === 'regen' && buff.duration > 0) {
      const heal = (buff.value ?? BUFF_CONFIG.REGEN_HP_PER_SECOND) * deltaTime;
      const oldHp = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      regenHeal += player.hp - oldHp;
    }
  }
  
  // Remover buffs expirados
  player.buffs = player.buffs.filter(b => b.duration > 0);
  
  return {
    poisonDamage: poisonDamage > 0 ? poisonDamage : undefined,
    regenHeal: regenHeal > 0 ? regenHeal : undefined
  };
}

/**
 * Atualiza todos os buffs de uma criatura.
 */
export function updateCreatureBuffs(
  creature: ServerCreature,
  deltaTime: number
): { poisonDamage?: number; regenHeal?: number } {
  if (!creature.buffs || creature.buffs.length === 0) {
    return {};
  }
  
  let poisonDamage = 0;
  let regenHeal = 0;
  
  for (const buff of creature.buffs) {
    buff.duration -= deltaTime;
    
    if (buff.type === 'poison' && buff.duration > 0) {
      const damage = (buff.value ?? BUFF_CONFIG.POISON_DAMAGE_PER_SECOND) * deltaTime;
      creature.currentHp = Math.max(0, creature.currentHp - damage);
      poisonDamage += damage;
    } else if (buff.type === 'regen' && buff.duration > 0) {
      const heal = (buff.value ?? BUFF_CONFIG.REGEN_HP_PER_SECOND) * deltaTime;
      const oldHp = creature.currentHp;
      creature.currentHp = Math.min(creature.maxHp, creature.currentHp + heal);
      regenHeal += creature.currentHp - oldHp;
    }
  }
  
  creature.buffs = creature.buffs.filter(b => b.duration > 0);
  
  return {
    poisonDamage: poisonDamage > 0 ? poisonDamage : undefined,
    regenHeal: regenHeal > 0 ? regenHeal : undefined
  };
}

// ============================================================================
// Cálculo de Modificadores
// ============================================================================

/**
 * Calcula o modificador de velocidade de um jogador baseado em seus buffs.
 * Retorna um multiplicador (1.0 = velocidade normal, 1.5 = +50%, 0.5 = -50%, 0 = congelado).
 */
export function getPlayerSpeedMultiplier(player: CombatPlayer): number {
  if (!player.buffs || player.buffs.length === 0) {
    return 1.0;
  }
  
  // Prioridade: freeze > stun > slow/speed
  if (playerHasBuff(player, 'freeze') || playerHasBuff(player, 'stun')) {
    return 0;
  }
  
  let multiplier = 1.0;
  
  // Aplicar buffs de velocidade
  if (playerHasBuff(player, 'speed')) {
    multiplier *= BUFF_CONFIG.SPEED_BOOST_MULTIPLIER;
  }
  
  // Aplicar debuffs de lentidão
  if (playerHasBuff(player, 'slow')) {
    multiplier *= BUFF_CONFIG.SLOW_MULTIPLIER;
  }
  
  return multiplier;
}

/**
 * Calcula o modificador de velocidade de uma criatura.
 */
export function getCreatureSpeedMultiplier(creature: ServerCreature): number {
  if (!creature.buffs || creature.buffs.length === 0) {
    return 1.0;
  }
  
  if (creatureHasBuff(creature, 'freeze') || creatureHasBuff(creature, 'stun')) {
    return 0;
  }
  
  let multiplier = 1.0;
  
  if (creatureHasBuff(creature, 'speed')) {
    multiplier *= BUFF_CONFIG.SPEED_BOOST_MULTIPLIER;
  }
  
  if (creatureHasBuff(creature, 'slow')) {
    multiplier *= BUFF_CONFIG.SLOW_MULTIPLIER;
  }
  
  return multiplier;
}

/**
 * Verifica se um jogador pode se mover (não está stunned/frozen).
 */
export function canPlayerMove(player: CombatPlayer): boolean {
  return !playerHasBuff(player, 'stun') && !playerHasBuff(player, 'freeze');
}

/**
 * Verifica se um jogador pode atacar (não está stunned).
 */
export function canPlayerAttack(player: CombatPlayer): boolean {
  return !playerHasBuff(player, 'stun');
}

/**
 * Verifica se uma criatura pode se mover.
 */
export function canCreatureMove(creature: ServerCreature): boolean {
  return !creatureHasBuff(creature, 'stun') && !creatureHasBuff(creature, 'freeze');
}

/**
 * Verifica se uma criatura pode atacar.
 */
export function canCreatureAttack(creature: ServerCreature): boolean {
  return !creatureHasBuff(creature, 'stun');
}

/**
 * Verifica se um jogador é invulnerável (não recebe dano).
 */
export function isPlayerInvulnerable(player: CombatPlayer): boolean {
  return playerHasBuff(player, 'invulnerable');
}

/**
 * Verifica se uma criatura é invulnerável.
 */
export function isCreatureInvulnerable(creature: ServerCreature): boolean {
  return creatureHasBuff(creature, 'invulnerable');
}
