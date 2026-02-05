/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Sistema de Skills Server-Side - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo implementa toda a lógica de habilidades server-authoritative:
 * - Criação de skill zones
 * - Validação de cooldowns
 * - Aplicação de dano periódico
 * - Efeitos especiais (slow, stun, etc)
 * 
 * O servidor é a única fonte de verdade para:
 * - Existência de skill zones
 * - Cooldowns de habilidades
 * - Dano aplicado por skills
 * 
 * @module server/systems/skills
 */

import { ServerSkillZone, ServerCreature, createSkillZone } from "../types";
import { applyDamageToCreature, DamageResult } from "./combat";
import { addBuffToCreature, BUFF_CONFIG } from "./buffs";

// ✅ Importar do shared
import { SKILL_COOLDOWN_MS } from "../../../shared/serverConstants";
import { getCreatureById } from "../../../shared/creatures";
import { calculateEffectiveStats } from "../../../shared/creatureProgression";
import { getSpecialSkillByCreatureId } from "../../../shared/attacks";

// ============================================================================
// Constantes
// ============================================================================

/**
 * Tipos de skills disponíveis.
 */
export type SkillType = "fire_fog" | "root_trap" | "water_pulse" | "electric_surge";

/**
 * Configuração de cada tipo de skill.
 */
interface SkillConfig {
  /** Raio da zona de efeito (em pixels) */
  radius: number;
  /** Dano por tick */
  damagePerTick: number;
  /** Intervalo entre ticks de dano (em segundos) */
  tickInterval: number;
  /** Tempo de vida total da zona (em segundos) */
  lifetime: number;
  /** Modificador de velocidade (opcional, 0.0 a 1.0) */
  slowModifier?: number;
}

/**
 * Configurações de todas as skills.
 */
export const SKILL_CONFIG: Record<SkillType, SkillConfig> = {
  fire_fog: {
    radius: 70,
    damagePerTick: 8,
    tickInterval: 0.5,
    lifetime: 4,
    slowModifier: 0.7 // 30% mais lento
  },
  root_trap: {
    radius: 60,
    damagePerTick: 5,
    tickInterval: 0.5,
    lifetime: 5,
    slowModifier: 0.3 // 70% mais lento (quase imobilizado)
  },
  water_pulse: {
    radius: 80,
    damagePerTick: 12,
    tickInterval: 0.3,
    lifetime: 2
  },
  electric_surge: {
    radius: 90,
    damagePerTick: 15,
    tickInterval: 0.4,
    lifetime: 3
  }
};

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Representa um jogador para propósitos de skills.
 */
export interface SkillPlayer {
  id: string;
  x: number;
  y: number;
  /** Timestamp da última skill usada (em ms) */
  lastSkillTime: number;
}

/**
 * Estado da sala para processamento de skills.
 */
export interface SkillRoomState {
  /** Jogadores na sala */
  players: Map<string, SkillPlayer>;
  /** Criaturas na sala */
  creatures: ServerCreature[];
  /** Skill zones ativas */
  skillZones: ServerSkillZone[];
}

/**
 * Resultado de uma tentativa de usar skill.
 */
export interface SkillResult {
  /** Se a skill foi usada com sucesso */
  success: boolean;
  /** Razão da falha (se aplicável) */
  reason?: "cooldown" | "invalid_position" | "player_not_found" | "invalid_skill_type";
  /** ID da skill zone criada (se sucesso) */
  skillZoneId?: string;
  /** Tipo de skill usado (se sucesso) */
  skillType?: SkillType;
}

// ============================================================================
// Processamento de Skills
// ============================================================================

/**
 * Processa uma tentativa de usar skill.
 * 
 * Valida:
 * - Se o jogador existe
 * - Se o cooldown já passou
 * - Se o tipo de skill é válido
 * - Se as coordenadas são válidas
 * 
 * Se válido:
 * - Cria skill zone no mundo
 * - Atualiza cooldown do jogador
 * 
 * @param room - Estado da sala
 * @param playerId - ID do jogador que está usando a skill
 * @param skillType - Tipo de skill a usar
 * @param targetX - Posição X do centro da skill zone
 * @param targetY - Posição Y do centro da skill zone
 * @param currentTime - Timestamp atual em ms (para cooldown)
 * @returns Resultado da tentativa
 * 
 * @example
 * ```ts
 * const result = processSkillIntent(room, "player-1", "fire_fog", 300, 200, Date.now());
 * if (result.success) {
 *   console.log(`Skill zone criada: ${result.skillZoneId}`);
 *   // Broadcast skillZonesUpdate para clientes
 * }
 * ```
 */
export function processSkillIntent(
  room: SkillRoomState,
  playerId: string,
  skillType: string,
  targetX: number,
  targetY: number,
  currentTime: number,
  creatureId?: string,
  creatureLevel?: number,
  creatureRank?: number
): SkillResult {
  // Validação: jogador existe
  const player = room.players.get(playerId);
  if (!player) {
    return {
      success: false,
      reason: "player_not_found"
    };
  }

  // Validação: tipo de skill válido
  if (!SKILL_CONFIG[skillType as SkillType]) {
    return {
      success: false,
      reason: "invalid_skill_type"
    };
  }

  // Validação: coordenadas válidas
  if (!isFinite(targetX) || !isFinite(targetY)) {
    return {
      success: false,
      reason: "invalid_position"
    };
  }

  // Obter configuração base da skill
  const baseConfig = SKILL_CONFIG[skillType as SkillType];
  
  // Calcular valores escalados se tiver creatureId, level e rank
  let radius = baseConfig.radius;
  let damagePerTick = baseConfig.damagePerTick;
  let lifetime = baseConfig.lifetime;
  let skillCooldown = SKILL_COOLDOWN_MS;

  if (creatureId && creatureLevel !== undefined && creatureRank !== undefined) {
    const effectiveStats = calculateEffectiveStats(
      { definitionId: creatureId, level: creatureLevel, rank: creatureRank },
      getCreatureById
    );
    
    // Usar valores escalados da special skill
    radius = effectiveStats.specialSkillRadius;
    damagePerTick = effectiveStats.specialSkillDamagePerTick;
    lifetime = effectiveStats.specialSkillLifetime;
    skillCooldown = effectiveStats.specialSkillCooldown * 1000; // Converter para ms
  } else if (creatureId) {
    // Se não tiver level/rank, usar valores base da special skill
    const specialSkill = getSpecialSkillByCreatureId(creatureId);
    if (specialSkill) {
      radius = specialSkill.radius;
      damagePerTick = specialSkill.damagePerTick;
      lifetime = specialSkill.lifetime;
      skillCooldown = specialSkill.cooldown * 1000;
    }
  }

  // Validação: cooldown escalado
  const timeSinceLastSkill = currentTime - player.lastSkillTime;
  if (timeSinceLastSkill < skillCooldown) {
    return {
      success: false,
      reason: "cooldown"
    };
  }

  // Criar skill zone com valores escalados
  const skillZone = createSkillZone(
    playerId,
    skillType as "fire_fog" | "root_trap" | "electric_surge",
    targetX,
    targetY,
    radius,
    damagePerTick,
    baseConfig.tickInterval, // tickInterval não escala
    lifetime,
    baseConfig.slowModifier // slowModifier não escala
  );

  room.skillZones.push(skillZone);

  // Atualizar cooldown do jogador
  player.lastSkillTime = currentTime;

  return {
    success: true,
    skillZoneId: skillZone.id,
    skillType: skillType as SkillType
  };
}

/**
 * Atualiza todas as skill zones ativas.
 * 
 * Para cada zona:
 * 1. Reduz tempo de vida
 * 2. Atualiza timer de tick
 * 3. Aplica dano periódico em criaturas dentro da zona
 * 4. Remove zonas expiradas
 * 
 * @param room - Estado da sala
 * @param deltaTime - Tempo decorrido desde último tick (em segundos)
 * @returns Lista de resultados de dano aplicados
 * 
 * @example
 * ```ts
 * const damageResults = updateSkillZones(room, 0.05); // 50ms tick
 * for (const result of damageResults) {
 *   // Broadcast DamageMessage para clientes
 *   broadcastDamageResult(result);
 * }
 * ```
 */
export function updateSkillZones(
  room: SkillRoomState,
  deltaTime: number
): DamageResult[] {
  const damageResults: DamageResult[] = [];
  const zonesToKeep: ServerSkillZone[] = [];

  for (const zone of room.skillZones) {
    // 1. Reduzir tempo de vida
    zone.lifetime -= deltaTime;

    // 2. Verificar se expirou
    if (zone.lifetime <= 0) {
      continue; // Não adiciona em zonesToKeep = remove
    }

    // 3. Atualizar timer de tick
    zone.tickTimer -= deltaTime;

    // 4. Aplicar dano se tick atingiu 0
    if (zone.tickTimer <= 0) {
      zone.tickTimer = zone.tickInterval; // Resetar timer para próximo tick

      // Encontrar criaturas dentro da zona
      for (const creature of room.creatures) {
        const dx = creature.x - zone.x;
        const dy = creature.y - zone.y;
        const distance = Math.hypot(dx, dy);

        if (distance <= zone.radius) {
          // Criatura está dentro da zona - aplicar dano
          const damageResult = applyDamageToCreature(
            creature,
            zone.damagePerTick,
            zone.ownerId
          );
          damageResults.push(damageResult);

          // ✅ FASE 9: Aplicar efeitos especiais baseados no tipo de skill
          switch (zone.skillType) {
            case "fire_fog":
              // Nevoeiro incendiário: slow moderado + dano contínuo
              addBuffToCreature(creature, 'slow', 0.8, 0.7, zone.ownerId);
              break;
              
            case "root_trap":
              // Armadilha de raízes: freeze severo (quase imobiliza)
              addBuffToCreature(creature, 'freeze', 1.0, undefined, zone.ownerId);
              break;
              
            case "water_pulse":
              // Pulso de água: slow leve
              addBuffToCreature(creature, 'slow', 0.6, 0.8, zone.ownerId);
              break;
              
            case "electric_surge":
              // Surto elétrico: stun periódico
              // Aplicar stun apenas no primeiro tick para evitar stun permanente
              if (zone.tickTimer >= zone.tickInterval - 0.1) {
                addBuffToCreature(creature, 'stun', 0.5, undefined, zone.ownerId);
              }
              break;
          }
        }
      }
    }

    zonesToKeep.push(zone);
  }

  // Atualizar array de zonas (remover expiradas)
  room.skillZones = zonesToKeep;

  return damageResults;
}

// ============================================================================
// Utilitários
// ============================================================================

/**
 * Verifica se um jogador pode usar uma skill.
 * 
 * @param player - Jogador
 * @param currentTime - Timestamp atual em ms
 * @returns true se o cooldown já passou
 */
export function canUseSkill(player: SkillPlayer, currentTime: number): boolean {
  const timeSinceLastSkill = currentTime - player.lastSkillTime;
  return timeSinceLastSkill >= SKILL_COOLDOWN_MS;
}

/**
 * Obtém o tempo restante de cooldown de skill.
 * 
 * @param player - Jogador
 * @param currentTime - Timestamp atual em ms
 * @returns Tempo restante em ms (0 se pode usar)
 */
export function getSkillCooldownRemaining(
  player: SkillPlayer,
  currentTime: number
): number {
  const timeSinceLastSkill = currentTime - player.lastSkillTime;
  const remaining = SKILL_COOLDOWN_MS - timeSinceLastSkill;
  return Math.max(0, remaining);
}

/**
 * Verifica se uma posição está dentro de uma skill zone.
 * 
 * @param x - Posição X
 * @param y - Posição Y
 * @param zone - Skill zone
 * @returns true se a posição está dentro da zona
 */
export function isInSkillZone(
  x: number,
  y: number,
  zone: ServerSkillZone
): boolean {
  const dx = x - zone.x;
  const dy = y - zone.y;
  const distance = Math.hypot(dx, dy);
  return distance <= zone.radius;
}
