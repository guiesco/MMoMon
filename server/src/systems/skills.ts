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
import { applyDamageToCreature, DamageResult, CombatPlayer } from "./combat";
import { addBuffToCreature, addBuffToPlayer, BUFF_CONFIG } from "./buffs";

// ✅ Importar do shared
import { SKILL_COOLDOWN_MS } from "../../../shared/serverConstants";
import { getCreatureById } from "../../../shared/creatures";
import { calculateEffectiveStats } from "../../../shared/creatureProgression";
import { getSpecialSkillByCreatureId, getSpecialSkillByType } from "../../../shared/attacks";

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
  /** ✅ Tempo restante do windup de skill (em segundos) - bloqueia movimento */
  skillWindupTimer?: number;
  /** ✅ Dados da skill pendente durante windup */
  pendingSkill?: {
    skillType: string;
    targetX: number;
    targetY: number;
    creatureId?: string;
    creatureLevel?: number;
    creatureRank?: number;
  };
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
  /** ✅ Informação sobre dash (se aplicável) */
  dashMovement?: {
    playerId: string;
    newX: number;
    newY: number;
  };
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

  // ✅ Validação: jogador não pode usar skill se já está em windup
  if (player.skillWindupTimer && player.skillWindupTimer > 0) {
    return {
      success: false,
      reason: "cooldown" // Usar cooldown como motivo genérico
    };
  }

  // ✅ Obter windup time da special skill (escalado)
  let skillWindupTime = 0.5; // Default
  let skillRange = 0; // Default
  if (creatureId && creatureLevel !== undefined && creatureRank !== undefined) {
    const effectiveStats = calculateEffectiveStats(
      { definitionId: creatureId, level: creatureLevel, rank: creatureRank },
      getCreatureById
    );
    // Usar windup escalado do effectiveStats
    skillWindupTime = effectiveStats.specialSkillWindup;
    skillRange = effectiveStats.specialSkillRange;
  } else if (creatureId) {
    const specialSkill = getSpecialSkillByCreatureId(creatureId);
    if (specialSkill) {
      skillWindupTime = specialSkill.attackWindup;
      skillRange = specialSkill.range;
    }
  }

  // ✅ Se skill tem range 0, castar na posição do jogador (auto-cast)
  let finalTargetX = targetX;
  let finalTargetY = targetY;
  if (skillRange === 0) {
    finalTargetX = player.x;
    finalTargetY = player.y;
  }

  // ✅ Se há windup, iniciar timer e armazenar dados da skill
  if (skillWindupTime > 0) {
    if (!player.skillWindupTimer) {
      player.skillWindupTimer = 0;
    }
    player.skillWindupTimer = skillWindupTime;
    player.pendingSkill = {
      skillType,
      targetX: finalTargetX,
      targetY: finalTargetY,
      creatureId,
      creatureLevel,
      creatureRank
    };

    return {
      success: true,
      skillZoneId: undefined, // Skill zone será criada após windup
      skillType: skillType as SkillType
    };
  }

  // Se não há windup, criar skill zone imediatamente
  // Obter attackDamage do effectiveStats se disponível
  let attackerAttack: number | undefined;
  if (creatureId && creatureLevel !== undefined && creatureRank !== undefined) {
    const effectiveStats = calculateEffectiveStats(
      { definitionId: creatureId, level: creatureLevel, rank: creatureRank },
      getCreatureById
    );
    attackerAttack = effectiveStats.attackDamage;
  }

  const skillZone = createSkillZone(
    playerId,
    skillType as "fire_fog" | "root_trap" | "electric_surge",
    finalTargetX,
    finalTargetY,
    radius,
    damagePerTick,
    baseConfig.tickInterval, // tickInterval não escala
    lifetime,
    baseConfig.slowModifier, // slowModifier não escala
    attackerAttack // ✅ Ataque do atacante para calcular dano com defesa
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
            zone.ownerId,
            zone.attackerAttack
          );
          damageResults.push(damageResult);

          // ✅ Aplicar efeitos especiais usando valores programáticos da definição da skill
          const skillDef = getSpecialSkillByType(zone.skillType);
          if (skillDef) {
            // Aplicar slow se definido
            if (skillDef.slowModifier !== undefined && skillDef.slowDuration !== undefined) {
              addBuffToCreature(creature, 'slow', skillDef.slowDuration, skillDef.slowModifier, zone.ownerId);
            }

            // Aplicar freeze se definido
            if (skillDef.freezeDuration !== undefined) {
              addBuffToCreature(creature, 'freeze', skillDef.freezeDuration, undefined, zone.ownerId);
            }

            // Aplicar stun se definido (apenas no primeiro tick para evitar stun permanente)
            if (skillDef.stunDuration !== undefined && skillDef.stunDuration > 0) {
              if (zone.tickTimer >= zone.tickInterval - 0.1) {
                addBuffToCreature(creature, 'stun', skillDef.stunDuration, undefined, zone.ownerId);
              }
            }
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

/**
 * ✅ Atualiza windup de skills de todos os jogadores e executa skills quando windup termina.
 * Deve ser chamado a cada tick do game loop.
 * 
 * @param room - Estado da sala
 * @param deltaTime - Tempo decorrido desde último tick (em segundos)
 * @returns Lista de resultados de skills executadas
 */
export function updatePlayerSkillWindups(
  room: SkillRoomState,
  deltaTime: number
): SkillResult[] {
  const skillResults: SkillResult[] = [];

  for (const [playerId, player] of room.players) {
    if (player.skillWindupTimer && player.skillWindupTimer > 0) {
      // Reduzir windup timer
      player.skillWindupTimer = Math.max(0, player.skillWindupTimer - deltaTime);

      // Se windup terminou, executar skill
      if (player.skillWindupTimer <= 0 && player.pendingSkill) {
        const { skillType, targetX, targetY, creatureId, creatureLevel, creatureRank } = player.pendingSkill;
        player.pendingSkill = undefined;

        // Obter configuração base da skill
        const baseConfig = SKILL_CONFIG[skillType as SkillType];
        if (!baseConfig) {
          continue; // Skill inválida, pular
        }

        // Calcular valores escalados
        let radius = baseConfig.radius;
        let damagePerTick = baseConfig.damagePerTick;
        let lifetime = baseConfig.lifetime;
        let skillRange = 0;

        if (creatureId && creatureLevel !== undefined && creatureRank !== undefined) {
          const effectiveStats = calculateEffectiveStats(
            { definitionId: creatureId, level: creatureLevel, rank: creatureRank },
            getCreatureById
          );

          radius = effectiveStats.specialSkillRadius;
          damagePerTick = effectiveStats.specialSkillDamagePerTick;
          lifetime = effectiveStats.specialSkillLifetime;
          skillRange = effectiveStats.specialSkillRange;
        } else if (creatureId) {
          const specialSkill = getSpecialSkillByCreatureId(creatureId);
          if (specialSkill) {
            radius = specialSkill.radius;
            damagePerTick = specialSkill.damagePerTick;
            lifetime = specialSkill.lifetime;
            skillRange = specialSkill.range;
          }
        }

        // ✅ Se skill tem range 0, castar na posição do jogador (auto-cast)
        let finalTargetX = targetX;
        let finalTargetY = targetY;
        if (skillRange === 0) {
          finalTargetX = player.x;
          finalTargetY = player.y;
        }

        // Obter attackDamage do effectiveStats se disponível
        let attackerAttack: number | undefined;
        if (creatureId && creatureLevel !== undefined && creatureRank !== undefined) {
          const effectiveStats = calculateEffectiveStats(
            { definitionId: creatureId, level: creatureLevel, rank: creatureRank },
            getCreatureById
          );
          attackerAttack = effectiveStats.attackDamage;
        }

        // ✅ DASH DO PYROGNAT: Se for Pyrognat usando fire_fog, criar múltiplas zonas ao longo do caminho
        if (creatureId === "pyrognat" && skillType === "fire_fog" && skillRange > 0) {
          // Calcular caminho do dash
          const startX = player.x;
          const startY = player.y;
          const dx = finalTargetX - startX;
          const dy = finalTargetY - startY;
          const totalDistance = Math.hypot(dx, dy);

          // Limitar distância ao alcance da skill
          const dashDistance = Math.min(totalDistance, skillRange);
          const normalizedDx = dx / totalDistance;
          const normalizedDy = dy / totalDistance;

          // Criar múltiplas skill zones ao longo do caminho (rastro de fogo)
          const zoneSpacing = radius * 0.6; // Espaçamento entre zonas (60% do raio)
          const numZones = Math.ceil(dashDistance / zoneSpacing);

          for (let i = 0; i < numZones; i++) {
            const t = i / Math.max(1, numZones - 1); // 0 a 1
            const zoneX = startX + normalizedDx * dashDistance * t;
            const zoneY = startY + normalizedDy * dashDistance * t;

            const trailZone = createSkillZone(
              playerId,
              skillType as "fire_fog" | "root_trap" | "electric_surge",
              zoneX,
              zoneY,
              radius,
              damagePerTick,
              baseConfig.tickInterval,
              lifetime,
              baseConfig.slowModifier,
              attackerAttack
            );

            room.skillZones.push(trailZone);
          }

          // ✅ Implementar dash: mover jogador instantaneamente para o destino
          const dashTargetX = startX + normalizedDx * dashDistance;
          const dashTargetY = startY + normalizedDy * dashDistance;

          // Mover jogador para o destino do dash
          player.x = dashTargetX;
          player.y = dashTargetY;

          // ✅ Adicionar informação de dash no resultado para o gameLoop processar
          skillResults.push({
            success: true,
            skillZoneId: `dash-${playerId}-${Date.now()}`,
            skillType: skillType as SkillType,
            dashMovement: {
              playerId,
              newX: dashTargetX,
              newY: dashTargetY
            }
          });

          // Aplicar buff de velocidade temporário para o dash (2x velocidade por 0.3s)
          const dashDuration = 0.3; // Duração do dash em segundos
          // Cast para CombatPlayer para usar addBuffToPlayer
          const combatPlayer = player as unknown as CombatPlayer;
          if (!combatPlayer.buffs) {
            combatPlayer.buffs = [];
          }
          addBuffToPlayer(combatPlayer, 'speed', dashDuration, 2.0, playerId);

          // Criar skill zone no destino final também
          const finalZone = createSkillZone(
            playerId,
            skillType as "fire_fog" | "root_trap" | "electric_surge",
            dashTargetX,
            dashTargetY,
            radius,
            damagePerTick,
            baseConfig.tickInterval,
            lifetime,
            baseConfig.slowModifier,
            attackerAttack
          );

          room.skillZones.push(finalZone);

          // Atualizar cooldown do jogador
          player.lastSkillTime = Date.now();

          skillResults.push({
            success: true,
            skillZoneId: finalZone.id, // Retornar ID da zona final
            skillType: skillType as SkillType
          });
        } else {
          // Comportamento normal: criar uma única skill zone
          const skillZone = createSkillZone(
            playerId,
            skillType as "fire_fog" | "root_trap" | "electric_surge",
            finalTargetX,
            finalTargetY,
            radius,
            damagePerTick,
            baseConfig.tickInterval,
            lifetime,
            baseConfig.slowModifier,
            attackerAttack // ✅ Ataque do atacante para calcular dano com defesa
          );

          room.skillZones.push(skillZone);

          // Atualizar cooldown do jogador
          player.lastSkillTime = Date.now();

          skillResults.push({
            success: true,
            skillZoneId: skillZone.id,
            skillType: skillType as SkillType
          });
        }
      }
    }
  }

  return skillResults;
}
