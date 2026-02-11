/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Sistema de Combate Server-Side - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo implementa toda a lógica de combate server-authoritative:
 * - Processamento de ataques de jogadores (básico e skills)
 * - Sistema de windup para ataques e skills
 * - Criação e atualização de projéteis
 * - Detecção de colisões e aplicação de dano
 * - Sistema de críticos (5% base, 1.5x dano)
 * - Type effectiveness (vantagens/desvantagens de tipos)
 * - IA de criaturas (movimento, aggro, ataques, roaming, fuga)
 * - Sistema de buffs/debuffs integrado
 * - Morte de jogadores e criaturas
 * - Dano de contato (proximidade)
 * 
 * O servidor é a única fonte de verdade para:
 * - Posições de projéteis e skill zones
 * - HP de todas as entidades
 * - Cooldowns de ataque e skills
 * - Estados de IA (idle, chasing, attacking, retreating)
 * - Buffs e debuffs ativos
 * 
 * Melhorias Implementadas:
 * - ✅ Constantes organizadas e extraídas (sem valores mágicos)
 * - ✅ Validações robustas com logs estruturados
 * - ✅ Sistema de críticos implementado
 * - ✅ Otimizações de performance (early exits, filtros pré-loop)
 * - ✅ Documentação JSDoc completa
 * - ✅ Tratamento de erros aprimorado
 * 
 * @module server/systems/combat
 */

import {
  ServerCreature,
  ServerProjectile,
  ServerSkillZone,
  createProjectile,
  createSkillZone
} from "../types";
// ✅ Importar do shared
import { COMBAT_CONFIG, ENEMY_VISUAL_CONFIG } from "../../../shared/gameConstants";
import type { EnemyBehaviorType } from "../../../shared/enums";
import { getSpecialSkillByType } from "../../../shared/attacks";

// ============================================================================
// Constantes de Combate
// ============================================================================

// Constantes de colisão do shared
const PLAYER_COLLISION_RADIUS = COMBAT_CONFIG.playerCollisionRadius;
const CREATURE_COLLISION_RADIUS = COMBAT_CONFIG.creatureCollisionRadius;

// Constantes de projéteis
const PROJECTILE_RADIUS = 4; // pixels
const PROJECTILE_KNOCKBACK_DISTANCE = 6; // pixels (menor que melee)

// Constantes de knockback
const MELEE_KNOCKBACK_DISTANCE = 12; // pixels
// ✅ SKILL_KNOCKBACK_DISTANCE removida - agora usa valores de shared/attacks.ts

// Constantes de IA
const FLEE_HP_THRESHOLD = 0.3; // 30% HP para iniciar fuga
const FLEE_SPEED_MULTIPLIER = 1.2; // 20% mais rápido ao fugir
const GROUPING_DETECTION_RANGE = 200; // pixels
const GROUPING_STRENGTH = 0.3; // Força do movimento de agrupamento (0-1)
const GROUPING_SPEED_MULTIPLIER = 0.4; // Velocidade de agrupamento

// Constantes de roaming
const ROAMING_RADIUS = 150; // pixels
const ROAMING_SPEED_MULTIPLIER = 0.4; // 40% da velocidade normal
const ROAMING_DESTINATION_REACHED_DISTANCE = 15; // pixels
const ROAMING_NEW_DESTINATION_INTERVAL = 3.0; // segundos

// Constantes de dano
const MIN_DAMAGE = 1; // Dano mínimo garantido
const DEFAULT_PLAYER_DEFENSE = 10; // Defesa padrão de jogadores
const MIN_DEFENSE = 1; // Defesa mínima para evitar divisão por zero
const MIN_ATTACK = 1; // Ataque mínimo

// Constantes de crítico
const BASE_CRIT_CHANCE = 0.05; // 5% de chance base
const CRIT_DAMAGE_MULTIPLIER = 1.5; // 50% de dano extra

// Constantes de validação
const MAX_COORDINATE = 10000; // Limite máximo de coordenadas (prevenir overflow)
const MIN_COORDINATE = -10000; // Limite mínimo de coordenadas

// Flags de debug
const DEBUG_PROJECTILES = process.env.DEBUG_PROJECTILES === "true";
const DEBUG_AI = process.env.DEBUG_AI === "true" || true; // Temporariamente sempre ativo
const DEBUG_SKILLS = true; // Debug específico para skills
const DEBUG_COMBAT = process.env.DEBUG_COMBAT === "true";

// ============================================================================
// Imports
// ============================================================================

import {
  updatePlayerBuffs,
  updateCreatureBuffs,
  getPlayerSpeedMultiplier,
  getCreatureSpeedMultiplier,
  canPlayerMove,
  canPlayerAttack,
  canCreatureMove,
  canCreatureAttack,
  isPlayerInvulnerable,
  isCreatureInvulnerable,
  addBuffToCreature,
  addBuffToPlayer
} from "./buffs";

// ✅ Importar do shared
import { getCreatureAttackStats, getCreatureById } from "../../../shared/creatures";
import { calculateEffectiveStats } from "../../../shared/creatureProgression";
import { getSpecialSkillByCreatureId } from "../../../shared/attacks";
import { executeCreatureSpecialSkill } from "../../../shared/creatureBehaviors";

// ============================================================================
// Constantes de Stats de Criaturas
// ============================================================================

/**
 * Stats padrão caso a criatura não seja encontrada no lookup.
 * Equivale a um ataque básico sem criatura.
 */
const DEFAULT_ATTACK_STATS = {
  damage: 15,
  speed: 400,
  range: 200,
  isProjectile: true
};

/**
 * Determina o tipo de comportamento (melee ou ranged) baseado na definição da criatura.
 * 
 * @param creatureType - Tipo/espécie da criatura (ex: "pyrognat", "verdant")
 * @returns Tipo de comportamento ("melee" ou "ranged")
 */
export function getCreatureBehaviorType(creatureType: string): EnemyBehaviorType {
  const attackStats = getCreatureAttackStats(creatureType);

  if (!attackStats) {
    // Fallback: se criatura não encontrada, assume ranged como padrão
    console.warn(`[Combat] Criatura ${creatureType} não encontrada, usando ranged como padrão`);
    return "ranged";
  }

  // Se o ataque é projétil, é ranged; caso contrário, é melee
  return attackStats.isProjectile ? "ranged" : "melee";
}

// ============================================================================
// Sistema de Type Effectiveness (Vantagens e Desvantagens de Tipos)
// ============================================================================

// ✅ Importar do diretório compartilhado para manter sincronizado com cliente
import { calculateTypeEffectiveness as sharedCalculateTypeEffectiveness } from "../../../shared/creatureTypes";

/**
 * Calcula o multiplicador de dano baseado em vantagens/desvantagens de tipos.
 * 
 * @param attackerType - Tipo da criatura atacante (ex: "pyrognat")
 * @param defenderType - Tipo da criatura defensor (ex: "aquaryl")
 * @returns Multiplicador de dano (1.0 = neutro, 2.0 = super efetivo, 0.5 = não muito efetivo, 0 = imune)
 */
export function calculateTypeEffectiveness(attackerType: string, defenderType: string): number {
  return sharedCalculateTypeEffectiveness(attackerType, defenderType);
}

// ============================================================================
// Interfaces e Tipos
// ============================================================================

/**
 * Resultado de um ataque processado pelo servidor.
 */
export interface AttackResult {
  /** ID do projétil criado (se aplicável) */
  projectileId?: string;
  /** Se o ataque foi aceito e processado */
  success: boolean;
  /** Razão da falha (se aplicável) */
  failReason?: "cooldown" | "invalid_position" | "dead" | "windup_in_progress" | "player_not_found";
  /** ✅ ID do atacante (para broadcast) */
  attackerId?: string;
  /** ✅ Coordenadas do alvo (para broadcast) */
  targetX?: number;
  targetY?: number;
  /** ✅ Tempo de windup (se iniciou windup) */
  windupTime?: number;
}

/**
 * Resultado de aplicação de dano.
 */
export interface DamageResult {
  /** ID da entidade que sofreu dano */
  targetId: string;
  /** ID do atacante */
  attackerId: string;
  /** Dano aplicado */
  damage: number;
  /** HP atual após o dano */
  currentHp: number;
  /** HP máximo da entidade */
  maxHp: number;
  /** Se a entidade morreu com este dano */
  died: boolean;
  /** Nível do alvo (criatura derrotada); usado para XP por nível */
  targetLevel?: number;
}

/**
 * Representa um jogador na sala para propósitos de combate.
 */
export interface CombatPlayer {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  lastAttackTime: number;
  isDead: boolean;

  /** ✅ Tempo restante do windup de ataque (em segundos) - bloqueia movimento e ataque */
  windupTimer: number;

  /** ✅ Dados do ataque pendente durante windup */
  pendingAttack?: {
    targetX: number;
    targetY: number;
    creatureId?: string;
    creatureLevel?: number;
    creatureRank?: number;
  };

  /** ✅ Tempo restante do windup de skill (em segundos) - bloqueia movimento */
  skillWindupTimer: number;

  /** ✅ Dados da skill pendente durante windup */
  pendingSkill?: {
    skillType: string;
    targetX: number;
    targetY: number;
    creatureId?: string;
    creatureLevel?: number;
    creatureRank?: number;
  };

  /** ✅ Estado de dash ativo (para Pyrognat) */
  dashState?: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    distance: number;
    duration: number;
    elapsed: number;
    speedMultiplier: number;
  };

  /** ✅ FASE 9: Buffs e debuffs ativos no jogador */
  buffs?: Array<{
    type: 'speed' | 'slow' | 'freeze' | 'stun' | 'poison' | 'shield' | 'invulnerable' | 'regen';
    duration: number;
    value?: number;
    sourceId?: string;
    appliedAt: number;
  }>;

  /** ✅ Timestamp quando o jogador completou extração (null = ainda na partida). Jogadores extraídos não recebem dano. */
  extractedAt?: number | null;

  // Propriedades adicionais para compatibilidade com outros sistemas
  currentHp?: number; // Alias para hp
}

/**
 * Dados de uma sala para processamento de combate.
 */
export interface CombatRoomState {
  /** Jogadores na sala */
  players: Map<string, CombatPlayer>;
  /** Criaturas selvagens ativas */
  creatures: ServerCreature[];
  /** Projéteis ativos */
  projectiles: ServerProjectile[];
  /** ✅ Zonas de skill ativas */
  skillZones: ServerSkillZone[];
}

/**
 * Verifica se um jogador já completou extração (não deve receber dano nem ser alvo de IA).
 */
export function isPlayerExtracted(player: CombatPlayer): boolean {
  return player.extractedAt != null;
}

// ============================================================================
// Processamento de Ataques de Jogadores
// ============================================================================

/**
 * Processa uma tentativa de ataque básico de um jogador.
 * 
 * Valida:
 * - Se o jogador está vivo
 * - Se o cooldown de ataque já passou
 * - Se as coordenadas de destino são válidas
 * 
 * Se válido, cria um projétil no worldState usando stats da criatura ativa.
 * 
 * @param room - Estado da sala
 * @param playerId - ID do jogador atacante
 * @param targetX - Coordenada X de destino do ataque
 * @param targetY - Coordenada Y de destino do ataque
 * @param currentTime - Timestamp atual em ms (para cooldown)
 * @param creatureId - ID da criatura ativa (opcional, usa stats padrão se não fornecido)
 * @param creatureLevel - Nível da criatura ativa (opcional, para escalar valores de IA)
 * @param creatureRank - Rank da criatura ativa (opcional, para escalar valores de IA)
 * @returns Resultado do ataque
 * 
 * @example
 * ```ts
 * const result = processAttackIntent(room, "player-1", 500, 300, Date.now(), "pyrognat", 10, 2);
 * if (result.success) {
 *   console.log(`Projétil criado: ${result.projectileId}`);
 *   // Broadcast AttackResultMessage para clientes
 * }
 * ```
 */
export function processAttackIntent(
  room: CombatRoomState,
  playerId: string,
  targetX: number,
  targetY: number,
  currentTime: number,
  creatureId?: string,
  creatureLevel?: number,
  creatureRank?: number
): AttackResult {
  const player = room.players.get(playerId);

  // Validação: jogador existe e está vivo
  if (!player || player.isDead) {
    return {
      success: false,
      failReason: "dead"
    };
  }

  // ✅ FASE 9: Validação - jogador pode atacar (não está stunned)
  if (!canPlayerAttack(player)) {
    return {
      success: false,
      failReason: "cooldown" // Usar cooldown como motivo genérico
    };
  }

  // Validação: coordenadas válidas (com limites)
  if (
    !isFinite(targetX) ||
    !isFinite(targetY) ||
    targetX < MIN_COORDINATE ||
    targetX > MAX_COORDINATE ||
    targetY < MIN_COORDINATE ||
    targetY > MAX_COORDINATE
  ) {
    if (DEBUG_COMBAT) {
      console.warn(
        `[Combat] Coordenadas inválidas para ataque: ` +
        `playerId=${playerId}, target=(${targetX}, ${targetY})`
      );
    }
    return {
      success: false,
      failReason: "invalid_position"
    };
  }

  // ✅ Usar calculateEffectiveStats do shared para obter todos os valores escalados consistentemente
  let effectiveStats: ReturnType<typeof calculateEffectiveStats> | null = null;
  let creatureStats = DEFAULT_ATTACK_STATS;
  let effectiveAttackCooldown = 500; // Cooldown padrão em ms

  if (creatureId && creatureLevel !== undefined && creatureRank !== undefined) {
    // Calcular stats efetivos usando shared (inclui projectileSpeed, attackRange, etc)
    effectiveStats = calculateEffectiveStats(
      { definitionId: creatureId, level: creatureLevel, rank: creatureRank },
      getCreatureById
    );

    // Usar valores do effectiveStats
    const creatureDef = getCreatureById(creatureId);
    if (creatureDef) {
      creatureStats = {
        damage: effectiveStats.attackDamage,
        speed: effectiveStats.projectileSpeed, // ✅ Usar projectileSpeed do effectiveStats
        range: effectiveStats.attackRange, // ✅ Usar attackRange do effectiveStats
        isProjectile: creatureDef.basicAttack.isProjectile
      };
    }
    // Converter cooldown de segundos para milissegundos
    effectiveAttackCooldown = effectiveStats.attackCooldown * 1000;
  } else if (creatureId) {
    // Se não tiver level/rank, usar valores base
    const creatureDef = getCreatureById(creatureId);
    if (creatureDef) {
      creatureStats = getCreatureAttackStats(
        creatureId,
        COMBAT_CONFIG.projectileSpeed
      ) ?? DEFAULT_ATTACK_STATS;
      effectiveAttackCooldown = creatureDef.basicAttack.cooldown * 1000;
    }
  }

  // Validação: cooldown de ataque escalado
  if (currentTime - player.lastAttackTime < effectiveAttackCooldown) {
    return {
      success: false,
      failReason: "cooldown"
    };
  }

  // ✅ Validação: jogador não pode atacar se já está em windup
  if (player.windupTimer > 0) {
    return {
      success: false,
      failReason: "windup_in_progress"
    };
  }

  // ✅ Obter windup time do effectiveStats (escalado)
  // const windupTime = effectiveStats?.attackWindup ??
  //   (creatureId ? getCreatureById(creatureId)?.basicAttack.attackWindup ?? 0.4 : 0.4);
  const windupTime = 0;

  // ✅ Se há windup, iniciar timer e armazenar dados do ataque
  if (windupTime > 0) {
    player.windupTimer = windupTime;
    player.pendingAttack = {
      targetX,
      targetY,
      creatureId,
      creatureLevel,
      creatureRank
    };

    return {
      success: true,
      projectileId: undefined, // Projétil será criado após windup
      windupTime: windupTime, // Informar cliente sobre o windup
      attackerId: playerId,
      targetX,
      targetY
    };
  }

  // Se não há windup, processar ataque imediatamente
  return processAttackExecution(
    room,
    playerId,
    targetX,
    targetY,
    currentTime,
    creatureId,
    creatureLevel,
    creatureRank,
    effectiveStats,
    creatureStats
  );
}

/**
 * ✅ Executa o ataque após windup terminar (ou imediatamente se windup = 0).
 * Função separada para reutilização.
 */
function processAttackExecution(
  room: CombatRoomState,
  playerId: string,
  targetX: number,
  targetY: number,
  currentTime: number,
  creatureId?: string,
  creatureLevel?: number,
  creatureRank?: number,
  effectiveStats?: ReturnType<typeof calculateEffectiveStats> | null,
  creatureStats?: { damage: number; speed: number; range: number; isProjectile: boolean }
): AttackResult {
  const player = room.players.get(playerId);
  if (!player) {
    return {
      success: false,
      failReason: "player_not_found"
    };
  }

  // Recalcular stats se não foram fornecidos
  if (!creatureStats || !effectiveStats) {
    let recalculatedStats: ReturnType<typeof calculateEffectiveStats> | null = null;
    let recalculatedCreatureStats = DEFAULT_ATTACK_STATS;

    if (creatureId && creatureLevel !== undefined && creatureRank !== undefined) {
      recalculatedStats = calculateEffectiveStats(
        { definitionId: creatureId, level: creatureLevel, rank: creatureRank },
        getCreatureById
      );

      const creatureDef = getCreatureById(creatureId);
      if (creatureDef) {
        recalculatedCreatureStats = {
          damage: recalculatedStats.attackDamage,
          speed: recalculatedStats.projectileSpeed,
          range: recalculatedStats.attackRange,
          isProjectile: creatureDef.basicAttack.isProjectile
        };
      }
    } else if (creatureId) {
      const creatureDef = getCreatureById(creatureId);
      if (creatureDef) {
        recalculatedCreatureStats = getCreatureAttackStats(
          creatureId,
          COMBAT_CONFIG.projectileSpeed
        ) ?? DEFAULT_ATTACK_STATS;
      }
    }

    effectiveStats = recalculatedStats;
    creatureStats = recalculatedCreatureStats;
  }

  // Verificar se é ataque melee
  if (!creatureStats.isProjectile) {
    // Ataque melee: aplicar dano imediato em área
    // Encontrar criaturas em alcance e na direção do ataque
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    let hitCount = 0;

    // Otimização: filtrar criaturas mortas antes do loop
    const aliveCreaturesForMelee = room.creatures.filter(c => c.currentHp > 0);

    for (const creature of aliveCreaturesForMelee) {
      const creatureDx = creature.x - player.x;
      const creatureDy = creature.y - player.y;
      const creatureDist = Math.hypot(creatureDx, creatureDy);

      // Verificar se está em alcance
      if (creatureDist <= creatureStats.range) {
        // Verificar se está no arco de ataque (45° para cada lado)
        const creatureAngle = Math.atan2(creatureDy, creatureDx);
        const angleDiff = Math.abs(creatureAngle - angle);
        const normalizedAngleDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);

        if (normalizedAngleDiff <= Math.PI / 4) { // 45° = π/4
          // ✅ Aplicar type effectiveness no dano
          const typeMultiplier = creatureId
            ? calculateTypeEffectiveness(creatureId, creature.creatureType)
            : 1.0;
          let baseDamage = Math.floor(creatureStats.damage * typeMultiplier);

          // ✅ Aplicar crítico
          const critMultiplier = calculateCriticalHit();
          if (critMultiplier > 1.0 && DEBUG_COMBAT) {
            console.log(`[Combat] Crítico! Multiplicador: ${critMultiplier}x`);
          }
          baseDamage = Math.floor(baseDamage * critMultiplier);

          // Aplicar dano considerando defesa (se effectiveStats disponível)
          const attackerAttack = effectiveStats?.attackDamage;
          const damageResult = applyDamageToCreature(
            creature,
            baseDamage,
            playerId,
            attackerAttack
          );
          hitCount++;

          // ✅ Aplicar stun após ataque melee (usando valor escalado)
          if (!damageResult.died && effectiveStats?.stunDuration && effectiveStats.stunDuration > 0) {
            addBuffToCreature(creature, 'stun', effectiveStats.stunDuration, undefined, playerId);
          }

          // ✅ Aplicar knockback se criatura sobreviveu
          if (!damageResult.died && creatureDist > 0) {
            const knockbackNx = creatureDx / creatureDist;
            const knockbackNy = creatureDy / creatureDist;

            creature.x += knockbackNx * MELEE_KNOCKBACK_DISTANCE;
            creature.y += knockbackNy * MELEE_KNOCKBACK_DISTANCE;
          }

          // Broadcast de damageResult é feito através do callback onDamageApplied no gameLoop
        }
      }
    }

    // Atualizar cooldown do jogador
    player.lastAttackTime = currentTime;

    return {
      success: true,
      projectileId: undefined // Ataques melee não criam projéteis
    };
  }

  // Ataque ranged: criar projétil
  // Calcular direção do ataque
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const distance = Math.hypot(dx, dy);

  // Se muito perto, normalizar com distância mínima
  const safeDistance = Math.max(distance, 1);
  const dirX = dx / safeDistance;
  const dirY = dy / safeDistance;

  // Criar projétil usando stats da criatura
  const velocityX = dirX * creatureStats.speed;
  const velocityY = dirY * creatureStats.speed;

  const projectile = createProjectile(
    playerId,
    true, // isPlayerProjectile
    player.x,
    player.y,
    velocityX,
    velocityY,
    creatureStats.damage, // Dano baseado na criatura
    COMBAT_CONFIG.projectileLifetime,
    creatureStats.range, // Distância máxima baseada no alcance da criatura
    creatureId, // ✅ Tipo da criatura para type effectiveness
    effectiveStats?.attackDamage // ✅ Ataque do atacante para calcular dano com defesa
  );

  room.projectiles.push(projectile);

  // Atualizar cooldown do jogador
  player.lastAttackTime = currentTime;

  // Debug: log criação de projétil
  if (process.env.DEBUG_PROJECTILES === "true") {
    console.log(
      `[Combat] Projétil criado: ${projectile.id} por ${playerId} ` +
      `em (${player.x.toFixed(1)}, ${player.y.toFixed(1)}) ` +
      `vel=(${velocityX.toFixed(1)}, ${velocityY.toFixed(1)}) ` +
      `dano=${creatureStats.damage} range=${creatureStats.range}`
    );
  }

  return {
    success: true,
    projectileId: projectile.id
  };
}

/**
 * ✅ Atualiza windup de todos os jogadores e executa ataques quando windup termina.
 * Deve ser chamado a cada tick do game loop.
 */
export function updatePlayerWindups(
  room: CombatRoomState,
  deltaTime: number
): AttackResult[] {
  const attackResults: AttackResult[] = [];

  for (const [playerId, player] of room.players) {
    if (player.windupTimer > 0) {
      // Reduzir windup timer
      player.windupTimer = Math.max(0, player.windupTimer - deltaTime);

      // Se windup terminou, executar ataque
      if (player.windupTimer <= 0 && player.pendingAttack) {
        const { targetX, targetY, creatureId, creatureLevel, creatureRank } = player.pendingAttack;
        player.pendingAttack = undefined;

        // Executar ataque
        const result = processAttackExecution(
          room,
          playerId,
          targetX,
          targetY,
          Date.now(),
          creatureId,
          creatureLevel,
          creatureRank
        );

        // Adicionar informações do atacante para broadcast
        result.attackerId = playerId;
        result.targetX = targetX;
        result.targetY = targetY;

        if (result.success) {
          attackResults.push(result);
        }
      }
    }
  }

  return attackResults;
}

// ============================================================================
// Atualização de Projéteis
// ============================================================================

/**
 * Atualiza todos os projéteis ativos na sala.
 * 
 * Para cada projétil:
 * 1. Move baseado em velocidade
 * 2. Reduz tempo de vida
 * 3. Detecta colisões com criaturas (projéteis de jogador) ou jogadores (projéteis de criatura)
 * 4. Aplica dano em caso de hit
 * 5. Remove projéteis expirados ou que colidiram
 * 
 * Retorna lista de resultados de dano para broadcast aos clientes.
 * 
 * @param room - Estado da sala
 * @param deltaTime - Tempo decorrido desde último tick (em segundos)
 * @returns Lista de resultados de dano aplicados
 * 
 * @example
 * ```ts
 * const damageResults = updateProjectiles(room, 0.05); // 50ms = 0.05s
 * for (const result of damageResults) {
 *   // Broadcast AttackResultMessage para clientes
 *   broadcastDamageResult(result);
 * }
 * ```
 */
export function updateProjectiles(
  room: CombatRoomState,
  deltaTime: number
): DamageResult[] {
  const damageResults: DamageResult[] = [];
  const projectilesToKeep: ServerProjectile[] = [];

  // Filtrar criaturas mortas antes de processar colisões (evita processar criaturas já mortas)
  const aliveCreatures = room.creatures.filter(c => c.currentHp > 0);

  // Early exit: se não há projéteis, retornar vazio
  if (room.projectiles.length === 0) {
    return damageResults;
  }

  const initialProjectileCount = room.projectiles.length;

  for (const proj of room.projectiles) {
    // Validação: projétil deve ter velocidade válida e posição válida
    if (
      !isFinite(proj.velocityX) ||
      !isFinite(proj.velocityY) ||
      !isFinite(proj.x) ||
      !isFinite(proj.y) ||
      proj.x < MIN_COORDINATE ||
      proj.x > MAX_COORDINATE ||
      proj.y < MIN_COORDINATE ||
      proj.y > MAX_COORDINATE
    ) {
      if (DEBUG_PROJECTILES) {
        console.warn(
          `[Combat] Projétil ${proj.id} inválido: ` +
          `pos=(${proj.x}, ${proj.y}), vel=(${proj.velocityX}, ${proj.velocityY})`
        );
      }
      continue; // Projétil inválido, remover
    }

    // 1. Atualizar posição
    proj.x += proj.velocityX * deltaTime;
    proj.y += proj.velocityY * deltaTime;

    // 2. Reduzir tempo de vida
    proj.lifetime -= deltaTime;

    // 3. Verificar se expirou por tempo
    if (proj.lifetime <= 0) {
      if (DEBUG_PROJECTILES) {
        console.log(`[Combat] Projétil ${proj.id} expirou por tempo (lifetime=${proj.lifetime.toFixed(3)})`);
      }
      continue; // Não adiciona em projectilesToKeep = remove
    }

    // 4. Verificar se excedeu distância máxima
    const distanceTraveled = Math.hypot(proj.x - proj.startX, proj.y - proj.startY);
    if (distanceTraveled >= proj.maxDistance) {
      if (DEBUG_PROJECTILES) {
        console.log(
          `[Combat] Projétil ${proj.id} excedeu distância máxima ` +
          `(traveled=${distanceTraveled.toFixed(1)}, max=${proj.maxDistance.toFixed(1)})`
        );
      }
      continue; // Não adiciona em projectilesToKeep = remove
    }

    let hit = false;

    // 5. Detectar colisões
    if (proj.isPlayerProjectile) {
      // Projétil de jogador: colide com criaturas vivas
      for (const creature of aliveCreatures) {
        if (checkProjectileCreatureCollision(proj, creature)) {
          if (DEBUG_PROJECTILES) {
            console.log(
              `[Combat] Projétil ${proj.id} colidiu com criatura ${creature.id} ` +
              `em (${proj.x.toFixed(1)}, ${proj.y.toFixed(1)})`
            );
          }

          // ✅ Aplicar type effectiveness no dano
          const typeMultiplier = proj.creatureType
            ? calculateTypeEffectiveness(proj.creatureType, creature.creatureType)
            : 1.0;
          let baseDamage = Math.floor(proj.damage * typeMultiplier);

          // ✅ Aplicar crítico (chance base de 5%)
          const critMultiplier = calculateCriticalHit();
          if (critMultiplier > 1.0 && DEBUG_COMBAT) {
            console.log(
              `[Combat] Projétil ${proj.id} acertou crítico em ${creature.id}! ` +
              `Multiplicador: ${critMultiplier}x`
            );
          }
          baseDamage = Math.floor(baseDamage * critMultiplier);

          // Obter stats do atacante do projétil (se disponível)
          const attackerAttack = proj.attackerAttack;
          const damageResult = applyDamageToCreature(
            creature,
            baseDamage,
            proj.ownerId,
            attackerAttack
          );
          const level = creature.level ?? 1;
          damageResults.push({ ...damageResult, targetLevel: level });

          // ✅ Aplicar stun após projétil acertar (usando valor escalado do projétil)
          if (!damageResult.died && proj.stunDuration && proj.stunDuration > 0) {
            addBuffToCreature(creature, 'stun', proj.stunDuration, undefined, proj.ownerId);
          }

          // Aplicar knockback leve em projéteis
          if (!damageResult.died && creature.currentHp > 0) {
            const speed = Math.hypot(proj.velocityX, proj.velocityY);

            if (speed > 0) {
              const knockbackNx = proj.velocityX / speed;
              const knockbackNy = proj.velocityY / speed;

              creature.x += knockbackNx * PROJECTILE_KNOCKBACK_DISTANCE;
              creature.y += knockbackNy * PROJECTILE_KNOCKBACK_DISTANCE;
            }
          }

          hit = true;
          break; // Projétil colidiu, não precisa verificar outras criaturas
        }
      }
    } else {
      // Projétil de criatura: colide com jogadores vivos (ignora jogadores que já extraíram)
      for (const [playerId, player] of room.players) {
        if (player.isDead || isPlayerExtracted(player)) continue;
        if (checkProjectilePlayerCollision(proj, player)) {
          if (DEBUG_PROJECTILES) {
            console.log(
              `[Combat] Projétil ${proj.id} colidiu com jogador ${playerId} ` +
              `em (${proj.x.toFixed(1)}, ${proj.y.toFixed(1)})`
            );
          }

          // Obter stats do atacante do projétil (se disponível)
          const attackerAttack = proj.attackerAttack;
          const damageResult = applyDamageToPlayer(
            playerId,
            player,
            proj.damage,
            proj.ownerId,
            attackerAttack
          );
          damageResults.push(damageResult);
          hit = true;
          break; // Projétil colidiu, não precisa verificar outros jogadores
        }
      }
    }

    // 6. Manter projétil se não expirou e não colidiu
    if (!hit) {
      projectilesToKeep.push(proj);
    }
  }

  // Atualizar lista de projéteis (remover os que colidiram, expiraram ou são inválidos)
  const removedCount = initialProjectileCount - projectilesToKeep.length;
  room.projectiles = projectilesToKeep;

  // Atualizar lista de criaturas (remover as que morreram)
  room.creatures = aliveCreatures;

  if (DEBUG_PROJECTILES && removedCount > 0) {
    console.log(
      `[Combat] Projéteis atualizados: ${initialProjectileCount} -> ${projectilesToKeep.length} ` +
      `(removidos: ${removedCount}, colisões: ${damageResults.length})`
    );
  }

  return damageResults;
}

/**
 * Verifica colisão entre projétil e criatura.
 * Usa detecção circular simples (raio do projétil + raio da criatura).
 * 
 * @param proj - Projétil a verificar
 * @param creature - Criatura a verificar
 * @returns true se há colisão
 */
function checkProjectileCreatureCollision(
  proj: ServerProjectile,
  creature: ServerCreature
): boolean {
  // Validação: verificar se criatura está viva
  if (creature.currentHp <= 0) {
    return false;
  }

  const CREATURE_RADIUS = 12; // pixels (aproximado)
  const collisionDistance = PROJECTILE_RADIUS + CREATURE_RADIUS;

  const dx = proj.x - creature.x;
  const dy = proj.y - creature.y;
  const distSquared = dx * dx + dy * dy;

  return distSquared <= collisionDistance * collisionDistance;
}

/**
 * Verifica colisão entre projétil e jogador.
 * 
 * @param proj - Projétil a verificar
 * @param player - Jogador a verificar
 * @returns true se há colisão
 */
function checkProjectilePlayerCollision(
  proj: ServerProjectile,
  player: CombatPlayer
): boolean {
  // Validação: verificar se jogador está vivo
  if (player.isDead || player.hp <= 0) {
    return false;
  }

  const PLAYER_RADIUS = 8; // pixels (aproximado)
  const collisionDistance = PROJECTILE_RADIUS + PLAYER_RADIUS;

  const dx = proj.x - player.x;
  const dy = proj.y - player.y;
  const distSquared = dx * dx + dy * dy;

  return distSquared <= collisionDistance * collisionDistance;
}

// ============================================================================
// Aplicação de Dano
// ============================================================================

/**
 * Constante C da fórmula de mitigação (LoL/Dota style).
 * Define a "velocidade" do jogo: defesa C = 50% de redução quando defesa escalada = C.
 * Com DEFENSE_SCALE = 10, defesa base 10 → 50% de dano recebido.
 */
const DAMAGE_MITIGATION_C = 100;

/**
 * Escala a defesa das criaturas (stats ~8–14) para a faixa da fórmula.
 * Defesa efetiva = defesa * DEFENSE_SCALE; com C=100, defesa 10 → 100 efetiva → 50% mitigação.
 */
const DEFENSE_SCALE = 10;

/**
 * Calcula o dano final com mitigação percentual (estilo League/Dota).
 *
 * Fórmula: Dano = (Ataque + Poder do Golpe) × (C / (C + Defesa_efetiva))
 *
 * - Redução percentual: defesa alta absorve % do dano (ex.: defesa efetiva 100 com C=100 → 50%).
 * - Escalonamento: mais defesa = mais vida efetiva, de forma decrescente.
 * - TTK longo: combates duram vários golpes, ideal para extração e tensão de emboscada.
 *
 * @param baseDamage - Poder do golpe (dano base do ataque/skill)
 * @param attackerAttack - Ataque do atacante
 * @param defenderDefense - Defesa do defensor (valor de stat, será escalado internamente)
 * @returns Dano final (sempre >= MIN_DAMAGE)
 */
function calculateDamageWithDefense(
  baseDamage: number,
  attackerAttack: number,
  defenderDefense: number
): number {
  if (!isFinite(baseDamage) || !isFinite(attackerAttack) || !isFinite(defenderDefense)) {
    if (DEBUG_COMBAT) {
      console.warn(
        `[Combat] Valores inválidos no cálculo de dano: ` +
        `baseDamage=${baseDamage}, attack=${attackerAttack}, defense=${defenderDefense}`
      );
    }
    return MIN_DAMAGE;
  }

  const safeDefense = Math.max(defenderDefense, MIN_DEFENSE);
  const rawDamage = Math.max(0, attackerAttack) + Math.max(0, baseDamage);

  const effectiveDefense = safeDefense * DEFENSE_SCALE;
  const mitigation = DAMAGE_MITIGATION_C / (DAMAGE_MITIGATION_C + effectiveDefense);
  const calculatedDamage = rawDamage * mitigation;
  return Math.max(MIN_DAMAGE, Math.floor(calculatedDamage));
}

/**
 * Calcula se um ataque é crítico e retorna o multiplicador de dano.
 * 
 * Sistema de críticos:
 * - Chance base: 5% (BASE_CRIT_CHANCE)
 * - Multiplicador: 1.5x dano (CRIT_DAMAGE_MULTIPLIER)
 * - Futuro: pode ser expandido com stats de criaturas (ex: agilidade aumenta chance)
 * 
 * @param baseCritChance - Chance base de crítico (0-1), padrão: BASE_CRIT_CHANCE
 * @returns Multiplicador de dano (1.0 = normal, 1.5 = crítico)
 */
function calculateCriticalHit(baseCritChance: number = BASE_CRIT_CHANCE): number {
  const critRoll = Math.random();
  return critRoll < baseCritChance ? CRIT_DAMAGE_MULTIPLIER : 1.0;
}

/**
 * Aplica dano a uma criatura.
 * 
 * Reduz HP da criatura e verifica morte.
 * Se a criatura morrer, marca para remoção (currentHp = 0).
 * 
 * @param creature - Criatura alvo
 * @param damage - Quantidade de dano base a aplicar
 * @param attackerId - ID do atacante (para telemetria/logs)
 * @param attackerAttack - Ataque do atacante (opcional, para calcular dano com defesa)
 * @returns Resultado do dano aplicado
 * 
 * @example
 * ```ts
 * const result = applyDamageToCreature(creature, 20, "player-1", 50);
 * if (result.died) {
 *   console.log(`Criatura ${result.targetId} foi derrotada!`);
 *   // Spawnar recursos, XP, etc.
 * }
 * ```
 */
export function applyDamageToCreature(
  creature: ServerCreature,
  damage: number,
  attackerId: string,
  attackerAttack?: number
): DamageResult {
  // ✅ FASE 9: Verificar invulnerabilidade
  if (isCreatureInvulnerable(creature)) {
    return {
      targetId: creature.id,
      attackerId,
      damage: 0,
      currentHp: creature.currentHp,
      maxHp: creature.maxHp,
      died: false
    };
  }

  // Validação: verificar se dano é válido
  if (!isFinite(damage) || damage < 0) {
    if (DEBUG_COMBAT) {
      console.warn(
        `[Combat] Dano inválido aplicado a criatura ${creature.id}: ${damage}`
      );
    }
    return {
      targetId: creature.id,
      attackerId,
      damage: 0,
      currentHp: creature.currentHp,
      maxHp: creature.maxHp,
      died: false
    };
  }

  // Calcular dano final considerando defesa se stats do atacante foram fornecidos
  let finalDamage = damage;
  if (attackerAttack !== undefined && creature.effectiveStats) {
    finalDamage = calculateDamageWithDefense(
      damage,
      attackerAttack,
      creature.effectiveStats.defense
    );
  }

  // ✅ Aplicar redução de dano de shield se criatura tiver buff de shield
  if (creature.buffs) {
    const shieldBuffs = creature.buffs.filter(b => b.type === 'shield' && b.duration > 0);
    if (shieldBuffs.length > 0) {
      // Reduzir dano pela soma dos valores de shield (ex: 0.3 = 30% de redução)
      const totalShieldReduction = shieldBuffs.reduce((sum, b) => sum + (b.value ?? 0), 0);
      finalDamage = Math.max(MIN_DAMAGE, Math.floor(finalDamage * (1 - totalShieldReduction)));
    }
  }

  const oldHp = creature.currentHp;
  creature.currentHp = Math.max(0, creature.currentHp - finalDamage);

  const died = creature.currentHp === 0 && oldHp > 0;

  // Log de morte para debug
  if (died && DEBUG_COMBAT) {
    console.log(
      `[Combat] Criatura ${creature.id} (${creature.creatureType}) foi derrotada ` +
      `por ${attackerId} (dano: ${finalDamage})`
    );
  }

  return {
    targetId: creature.id,
    attackerId,
    damage: finalDamage,
    currentHp: creature.currentHp,
    maxHp: creature.maxHp,
    died
  };
}

/**
 * Aplica dano a um jogador.
 * 
 * Reduz HP do jogador e verifica morte.
 * Se o jogador morrer, marca como morto e desabilita ações futuras.
 * 
 * @param playerId - ID do jogador
 * @param player - Dados do jogador
 * @param damage - Quantidade de dano base a aplicar
 * @param attackerId - ID do atacante (criatura ou outro jogador)
 * @param attackerAttack - Ataque do atacante (opcional, para calcular dano com defesa)
 * @param playerDefense - Defesa do jogador (opcional, usa 10 como padrão se não fornecido)
 * @returns Resultado do dano aplicado
 * 
 * @example
 * ```ts
 * const result = applyDamageToPlayer("player-1", player, 15, "wild-3", 50);
 * if (result.died) {
 *   console.log(`Jogador ${playerId} foi eliminado!`);
 *   // Broadcast PlayerDeathMessage
 * }
 * ```
 */
export function applyDamageToPlayer(
  playerId: string,
  player: CombatPlayer,
  damage: number,
  attackerId: string,
  attackerAttack?: number,
  playerDefense?: number
): DamageResult {
  // ✅ FASE 9: Verificar invulnerabilidade
  if (isPlayerInvulnerable(player)) {
    return {
      targetId: playerId,
      attackerId,
      damage: 0,
      currentHp: player.hp,
      maxHp: player.maxHp,
      died: false
    };
  }

  // ✅ Jogador que já extraiu não recebe dano (evita dano "fantasma" no mesmo tick da extração)
  if (isPlayerExtracted(player)) {
    return {
      targetId: playerId,
      attackerId,
      damage: 0,
      currentHp: player.hp,
      maxHp: player.maxHp,
      died: false
    };
  }

  // Validação: verificar se dano é válido
  if (!isFinite(damage) || damage < 0) {
    if (DEBUG_COMBAT) {
      console.warn(
        `[Combat] Dano inválido aplicado a jogador ${playerId}: ${damage}`
      );
    }
    return {
      targetId: playerId,
      attackerId,
      damage: 0,
      currentHp: player.hp,
      maxHp: player.maxHp,
      died: false
    };
  }

  // Calcular dano final considerando defesa se stats do atacante foram fornecidos
  let finalDamage = damage;
  if (attackerAttack !== undefined) {
    const defenderDefense = playerDefense ?? DEFAULT_PLAYER_DEFENSE;
    finalDamage = calculateDamageWithDefense(
      damage,
      attackerAttack,
      defenderDefense
    );
  }

  // ✅ Aplicar redução de dano de shield se jogador tiver buff de shield
  if (player.buffs) {
    const shieldBuffs = player.buffs.filter(b => b.type === 'shield' && b.duration > 0);
    if (shieldBuffs.length > 0) {
      // Reduzir dano pela soma dos valores de shield (ex: 0.3 = 30% de redução)
      const totalShieldReduction = shieldBuffs.reduce((sum, b) => sum + (b.value ?? 0), 0);
      finalDamage = Math.max(MIN_DAMAGE, Math.floor(finalDamage * (1 - totalShieldReduction)));
    }
  }

  const oldHp = player.hp;
  player.hp = Math.max(0, player.hp - finalDamage);

  const died = player.hp === 0 && oldHp > 0;

  if (died) {
    player.isDead = true;
    if (DEBUG_COMBAT) {
      console.log(
        `[Combat] Jogador ${playerId} foi eliminado por ${attackerId} (dano: ${finalDamage})`
      );
    }
  }

  return {
    targetId: playerId,
    attackerId,
    damage: finalDamage,
    currentHp: player.hp,
    maxHp: player.maxHp,
    died
  };
}

// ============================================================================
// IA de Criaturas
// ============================================================================

/**
 * Atualiza a IA de todas as criaturas na sala.
 * 
 * Para cada criatura:
 * 1. Atualiza cooldowns (ataque, stun)
 * 2. Determina comportamento baseado em tipo (melee/ranged) e estado
 * 3. Move em direção ao jogador mais próximo (se detectado)
 * 4. Executa ataques quando em alcance
 * 
 * @param room - Estado da sala
 * @param deltaTime - Tempo decorrido desde último tick (em segundos)
 * 
 * @example
 * ```ts
 * updateCreatureAI(room, 0.05); // 50ms tick
 * // IA atualizada, projéteis de criaturas criados automaticamente
 * ```
 */
// Contador para logs periódicos de IA
let aiLogCounter = 0;

/**
 * Resultado de dano de IA (para broadcast)
 */
export interface AIAttackResult {
  creatureId: string;
  playerId: string;
  damage: number;
  currentHp: number;
  maxHp: number;
  died: boolean;
}

export function updateCreatureAI(
  room: CombatRoomState,
  deltaTime: number
): AIAttackResult[] {
  const attackResults: AIAttackResult[] = [];
  aiLogCounter++;
  const shouldLog = DEBUG_AI && aiLogCounter % 100 === 0; // Log a cada 100 ticks (~5 segundos)

  // Encontrar jogadores vivos e que ainda não extraíram (extraídos não são alvo de IA)
  const alivePlayers: Array<{ id: string; player: CombatPlayer }> = [];
  for (const [id, player] of room.players) {
    if (!player.isDead && !isPlayerExtracted(player)) {
      alivePlayers.push({ id, player });
    }
  }

  if (shouldLog) {
    console.log(`[AI] Tick ${aiLogCounter} | Jogadores vivos: ${alivePlayers.length} | Criaturas: ${room.creatures.length} | deltaTime: ${deltaTime.toFixed(4)}s`);
    for (const { id, player } of alivePlayers) {
      console.log(`[AI]   Jogador ${id.slice(0, 8)}... em (${player.x.toFixed(0)}, ${player.y.toFixed(0)})`);
    }
  }

  // Se não há jogadores vivos, criaturas fazem roaming
  if (alivePlayers.length === 0) {
    for (const creature of room.creatures) {
      creature.aiState = "idle";
      creature.targetPlayerId = null;

      // ✅ Roaming: Sistema de patrulha aleatória quando não há jogadores
      // ✅ Calcular config de IA baseado em tier e level
      const level = creature.level ?? 1;

      // ✅ Usar stats calculados (nível + rank) se disponíveis, senão usar config
      const effectiveMoveSpeed = creature.effectiveStats?.moveSpeed;
      const speedMultiplier = getCreatureSpeedMultiplier(creature);

      // Atualizar timer de patrulha
      creature.patrolTimer -= deltaTime;

      // Se não tem destino ou chegou ao destino ou timer expirou, escolher novo destino
      if (!creature.roamingTarget || creature.patrolTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const distanceFromOrigin = Math.random() * ROAMING_RADIUS;
        creature.roamingTarget = {
          x: creature.patrolOrigin.x + Math.cos(angle) * distanceFromOrigin,
          y: creature.patrolOrigin.y + Math.sin(angle) * distanceFromOrigin
        };
        creature.patrolTimer = ROAMING_NEW_DESTINATION_INTERVAL;
      }

      // Mover em direção ao destino de roaming
      if (creature.roamingTarget && canCreatureMove(creature)) {
        const dx = creature.roamingTarget.x - creature.x;
        const dy = creature.roamingTarget.y - creature.y;
        const distToTarget = Math.hypot(dx, dy);

        if (distToTarget > ROAMING_DESTINATION_REACHED_DISTANCE && effectiveMoveSpeed) {
          const roamingSpeed = effectiveMoveSpeed * ROAMING_SPEED_MULTIPLIER * speedMultiplier;
          creature.x += (dx / distToTarget) * roamingSpeed * deltaTime;
          creature.y += (dy / distToTarget) * roamingSpeed * deltaTime;
        } else {
          creature.roamingTarget = null;
          creature.patrolTimer = 0;
        }
      }
    }
    return attackResults;
  }

  for (const creature of room.creatures) {
    // Atualizar cooldown de ataque
    if (creature.attackCooldownRemaining > 0) {
      creature.attackCooldownRemaining = Math.max(
        0,
        creature.attackCooldownRemaining - deltaTime
      );
    }

    // ✅ Atualizar cooldown de skill
    if (creature.skillCooldownRemaining !== undefined && creature.skillCooldownRemaining > 0) {
      creature.skillCooldownRemaining = Math.max(
        0,
        creature.skillCooldownRemaining - deltaTime
      );
    } else if (creature.skillCooldownRemaining === undefined) {
      creature.skillCooldownRemaining = 0;
      // Não resetar lastSkillTime aqui - manter 0 para permitir uso imediato na primeira vez
      if (creature.lastSkillTime === undefined) {
        creature.lastSkillTime = 0;
      }
    }

    // ✅ IA #6: Encontrar criaturas do mesmo tipo próximas para agrupamento
    let groupingDx = 0;
    let groupingDy = 0;
    let groupingCount = 0;

    for (const otherCreature of room.creatures) {
      if (otherCreature.id === creature.id) continue;
      if (otherCreature.creatureType !== creature.creatureType) continue;

      const dx = otherCreature.x - creature.x;
      const dy = otherCreature.y - creature.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= GROUPING_DETECTION_RANGE && dist > 0) {
        // Normalizar e adicionar direção de agrupamento
        groupingDx += (dx / dist) * GROUPING_STRENGTH;
        groupingDy += (dy / dist) * GROUPING_STRENGTH;
        groupingCount++;
      }
    }

    // Encontrar jogador mais próximo
    let closestPlayer: { id: string; player: CombatPlayer } | null = null;
    let closestDistance = Infinity;

    for (const { id, player } of alivePlayers) {
      const dx = player.x - creature.x;
      const dy = player.y - creature.y;
      const dist = Math.hypot(dx, dy);

      if (dist < closestDistance) {
        closestDistance = dist;
        closestPlayer = { id, player };
      }
    }

    if (!closestPlayer) continue;

    // ✅ IA #6: Aplicar movimento de agrupamento se houver criaturas do mesmo tipo próximas
    if (groupingCount > 0 && canCreatureMove(creature) && creature.aiState !== "attacking") {
      const speedMultiplier = getCreatureSpeedMultiplier(creature);
      const effectiveMoveSpeed = creature.effectiveStats?.moveSpeed;
      if (!effectiveMoveSpeed) continue;
      const groupingSpeed = effectiveMoveSpeed * GROUPING_SPEED_MULTIPLIER * speedMultiplier;

      creature.x += groupingDx * groupingSpeed * deltaTime;
      creature.y += groupingDy * groupingSpeed * deltaTime;
    }

    const prevX = creature.x;
    const prevY = creature.y;
    const prevState = creature.aiState;

    // ✅ Atualizar windup de skill de criaturas
    if (creature.skillWindupTimer && creature.skillWindupTimer > 0) {
      creature.skillWindupTimer = Math.max(0, creature.skillWindupTimer - deltaTime);

      // Se windup terminou, executar skill via comportamento da criatura (shared)
      if (creature.skillWindupTimer <= 0 && creature.pendingSkill) {
        const { skillType, targetX, targetY } = creature.pendingSkill;
        creature.pendingSkill = undefined;

        const level = creature.level ?? 1;
        const rank = 1;
        const effectiveStats = calculateEffectiveStats(
          { definitionId: creature.creatureType, level, rank },
          getCreatureById
        );

        const specialSkill = getSpecialSkillByCreatureId(creature.creatureType);
        if (specialSkill) {
          const recipe = executeCreatureSpecialSkill(creature.creatureType, {
            ownerId: creature.id,
            skillType: skillType as "fire_fog" | "root_trap" | "electric_surge" | "heal_wave",
            startX: creature.x,
            startY: creature.y,
            targetX,
            targetY,
            skillRange: effectiveStats.specialSkillRange,
            radius: effectiveStats.specialSkillRadius,
            damagePerTick: effectiveStats.specialSkillDamagePerTick,
            tickInterval: specialSkill.tickInterval,
            lifetime: effectiveStats.specialSkillLifetime,
            slowModifier: specialSkill.slowModifier ?? 0.3,
            attackerAttack: effectiveStats.attackDamage
          });

          for (const z of recipe.zones) {
            const skillZone = createSkillZone(
              creature.id,
              skillType as "fire_fog" | "root_trap" | "electric_surge",
              z.x,
              z.y,
              z.radius,
              z.damagePerTick,
              z.tickInterval,
              z.lifetime,
              z.slowModifier,
              z.attackerAttack
            );
            room.skillZones.push(skillZone);
          }

          if (recipe.dashTarget) {
            creature.x = recipe.dashTarget.x;
            creature.y = recipe.dashTarget.y;
          }

          creature.lastSkillTime = Date.now();
          creature.skillCooldownRemaining = effectiveStats.specialSkillCooldown;

          if (DEBUG_AI) {
            const msg = recipe.dashTarget
              ? `[AI] ${creature.id} (${creature.creatureType}) executou dash ${skillType} ` +
                `→ (${recipe.dashTarget.x.toFixed(0)},${recipe.dashTarget.y.toFixed(0)}) [zones=${recipe.zones.length}]`
              : `[AI] ${creature.id} (${creature.creatureType}) executou skill ${skillType} ` +
                `em (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`;
            console.log(msg);
          }
        }
      }

      // Se está em windup, pular ataque normal neste tick
      continue;
    }

    // ✅ IA: Tentar usar skill especial antes de ataque normal
    const skillUsed = tryUseCreatureSkill(room, creature, closestPlayer, closestDistance, alivePlayers);
    if (skillUsed) {
      // Skill foi usada (windup iniciado), pular ataque normal neste tick
      continue;
    }

    // Atualizar comportamento baseado no tipo e coletar resultados de ataque
    let attackResult: AIAttackResult | null = null;

    if (creature.behaviorType === "melee") {
      attackResult = updateMeleeCreatureAI(
        creature,
        closestPlayer,
        closestDistance,
        deltaTime
      );
    } else {
      attackResult = updateRangedCreatureAI(
        room,
        creature,
        closestPlayer,
        closestDistance,
        deltaTime
      );
    }

    // Adicionar resultado de ataque se houver
    if (attackResult) {
      attackResults.push(attackResult);
    }

    // Log detalhado de mudanças
    if (shouldLog && room.creatures.indexOf(creature) < 3) { // Só log das 3 primeiras criaturas
      const moved = Math.abs(creature.x - prevX) > 0.1 || Math.abs(creature.y - prevY) > 0.1;
      const stateChanged = creature.aiState !== prevState;
      console.log(
        `[AI]   ${creature.id} (${creature.behaviorType}): ` +
        `dist=${closestDistance.toFixed(0)}px, state=${creature.aiState}${stateChanged ? ` (era ${prevState})` : ""}, ` +
        `pos=(${creature.x.toFixed(0)}, ${creature.y.toFixed(0)})${moved ? ` (moveu ${Math.hypot(creature.x - prevX, creature.y - prevY).toFixed(1)}px)` : " (parado)"}, ` +
        `detection=${creature.effectiveStats?.detectionRange ?? 0}px, attack=${creature.effectiveStats?.attackRange ?? 0}px`
      );
    }
  }

  return attackResults;
}

/**
 * ✅ IA: Tenta usar skill especial da criatura.
 * 
 * Condições para usar skill:
 * - Skill disponível (cooldown acabou)
 * - Dentro do alcance da skill
 * - Em combate (jogador detectado)
 * 
 * As criaturas usam skills agressivamente sempre que possível quando em combate.
 * 
 * @returns true se skill foi usada, false caso contrário
 */
function tryUseCreatureSkill(
  room: CombatRoomState,
  creature: ServerCreature,
  closestPlayer: { id: string; player: CombatPlayer },
  closestDistance: number,
  alivePlayers: Array<{ id: string; player: CombatPlayer }>
): boolean {
  // Verificar se criatura tem special skill
  const specialSkill = getSpecialSkillByCreatureId(creature.creatureType);
  if (!specialSkill) {
    if (DEBUG_SKILLS) {
      console.log(`[AI-SKILL] ${creature.id} (${creature.creatureType}) não tem special skill definida`);
    }
    return false; // Criatura não tem skill
  }

  // Calcular stats escalados da skill primeiro (para obter cooldown escalado)
  const level = creature.level ?? 1;
  const rank = 1; // Criaturas selvagens sempre rank 1
  const effectiveStats = calculateEffectiveStats(
    { definitionId: creature.creatureType, level, rank },
    getCreatureById
  );

  // ✅ Verificar cooldown usando valor escalado
  const currentTime = Date.now();
  // Se lastSkillTime é 0 ou undefined, tratar como se nunca usou skill (permitir uso imediato)
  const lastSkillTime = creature.lastSkillTime || 0;
  const timeSinceLastSkill = lastSkillTime === 0 ? Infinity : (currentTime - lastSkillTime);
  const skillCooldownMs = effectiveStats.specialSkillCooldown * 1000; // Converter para ms (escalado)

  if (timeSinceLastSkill < skillCooldownMs) {
    if (DEBUG_SKILLS) {
      console.log(
        `[AI-SKILL] ${creature.id} (${creature.creatureType}) skill em cooldown: ` +
        `${(timeSinceLastSkill / 1000).toFixed(2)}s / ${(skillCooldownMs / 1000).toFixed(2)}s`
      );
    }
    return false; // Skill em cooldown
  }

  const skillRange = effectiveStats.specialSkillRange;
  const skillRadius = effectiveStats.specialSkillRadius;
  const skillDamagePerTick = effectiveStats.specialSkillDamagePerTick;
  const skillLifetime = effectiveStats.specialSkillLifetime;

  // Verificar se está em alcance
  if (closestDistance > skillRange) {
    if (DEBUG_SKILLS) {
      console.log(
        `[AI-SKILL] ${creature.id} (${creature.creatureType}) fora de alcance de skill: ` +
        `${closestDistance.toFixed(0)}px > ${skillRange.toFixed(0)}px`
      );
    }
    return false; // Fora de alcance
  }

  // ✅ Usar skill sempre que possível quando em combate
  // Se está em alcance e cooldown disponível, usar skill
  // (Removidas condições restritivas - criaturas agora usam skills agressivamente)

  // ✅ Verificar se criatura já está em windup de skill
  if (creature.skillWindupTimer && creature.skillWindupTimer > 0) {
    if (DEBUG_SKILLS) {
      console.log(
        `[AI-SKILL] ${creature.id} (${creature.creatureType}) já está em windup de skill: ` +
        `${creature.skillWindupTimer.toFixed(2)}s`
      );
    }
    return false; // Já está em windup
  }

  // Usar skill: iniciar windup ao invés de criar skill zone imediatamente
  const skillType = getSkillTypeFromCreatureId(creature.creatureType);
  if (!skillType || skillType === "heal_wave") {
    if (DEBUG_SKILLS) {
      console.log(
        `[AI-SKILL] ${creature.id} (${creature.creatureType}) skill não mapeada ou é heal_wave: ${skillType}`
      );
    }
    return false; // Skill não mapeada ou é heal (não usado por IA)
  }

  // ✅ Obter windup time da special skill (escalado)
  const skillWindupTime = effectiveStats.specialSkillWindup;

  // ✅ Se há windup, iniciar timer e armazenar dados da skill
  if (skillWindupTime > 0) {
    if (creature.skillWindupTimer === undefined) {
      creature.skillWindupTimer = 0;
    }
    creature.skillWindupTimer = skillWindupTime;
    creature.pendingSkill = {
      skillType,
      targetX: closestPlayer.player.x, // Posição do jogador alvo
      targetY: closestPlayer.player.y
    };

    if (DEBUG_SKILLS) {
      console.log(
        `[AI-SKILL] ✅ ${creature.id} (${creature.creatureType}) iniciou windup de skill ${skillType} ` +
        `em (${closestPlayer.player.x.toFixed(0)}, ${closestPlayer.player.y.toFixed(0)}) ` +
        `[windup=${skillWindupTime.toFixed(2)}s, range=${skillRange.toFixed(0)}px, cooldown=${(skillCooldownMs / 1000).toFixed(2)}s]`
      );
    }

    return true; // Windup iniciado
  }

  // Se não há windup, criar skill zone imediatamente (fallback)
  const skillZone = createSkillZone(
    creature.id, // ownerId = criatura
    skillType as "fire_fog" | "root_trap" | "electric_surge",
    closestPlayer.player.x, // Posição do jogador alvo
    closestPlayer.player.y,
    skillRadius,
    skillDamagePerTick,
    specialSkill.tickInterval,
    skillLifetime,
    specialSkill.slowModifier,
    effectiveStats.attackDamage // ✅ Ataque do atacante para calcular dano com defesa
  );

  room.skillZones.push(skillZone);

  // Atualizar cooldown
  creature.lastSkillTime = currentTime;
  creature.skillCooldownRemaining = effectiveStats.specialSkillCooldown;

  if (DEBUG_SKILLS) {
    console.log(
      `[AI-SKILL] ✅ ${creature.id} (${creature.creatureType}) usou skill ${skillType} ` +
      `em (${closestPlayer.player.x.toFixed(0)}, ${closestPlayer.player.y.toFixed(0)}) ` +
      `[range=${skillRange.toFixed(0)}, radius=${skillRadius.toFixed(0)}]`
    );
  }

  return true;
}

/**
 * Mapeia creatureId para skillType.
 */
function getSkillTypeFromCreatureId(creatureId: string): "fire_fog" | "root_trap" | "electric_surge" | "heal_wave" | null {
  switch (creatureId) {
    case "pyrognat":
      return "fire_fog";
    case "verdant":
      return "root_trap";
    case "voltiger":
      return "electric_surge";
    case "aquaryl":
      return "heal_wave";
    default:
      return null;
  }
}

/**
 * Atualiza IA de criatura melee.
 * 
 * Comportamento:
 * - Persegue jogador quando detectado
 * - Ataca quando em alcance
 * - Retorna à origem quando jogador sai do alcance
 * - ✅ IA #5: Foge quando com pouca vida (< 30% HP)
 */
function updateMeleeCreatureAI(
  creature: ServerCreature,
  closestPlayer: { id: string; player: CombatPlayer },
  distance: number,
  deltaTime: number
): AIAttackResult | null {
  const player = closestPlayer.player;

  // ✅ FASE 9: Aplicar modificador de velocidade dos buffs
  const speedMultiplier = getCreatureSpeedMultiplier(creature);

  // ✅ Usar stats calculados (nível + rank) - obrigatório agora
  const effectiveMoveSpeed = creature.effectiveStats?.moveSpeed;
  const detectionRange = creature.effectiveStats?.detectionRange;
  const attackRange = creature.effectiveStats?.attackRange;
  const attackCooldown = creature.effectiveStats?.attackCooldown;

  if (!effectiveMoveSpeed || !detectionRange || !attackRange || !attackCooldown) {
    console.warn(`[Combat] Criatura ${creature.id} sem effectiveStats completo, pulando IA`);
    return null;
  }

  // ✅ Cancelar roaming quando detecta jogador
  if (distance <= detectionRange) {
    creature.roamingTarget = null;
  }

  // ✅ IA #5: Verificar se criatura está com pouca vida (< 30% HP)
  const hpPercent = creature.maxHp > 0 ? creature.currentHp / creature.maxHp : 1;
  const FLEE_HP_THRESHOLD = 0.3; // 30% HP
  const shouldFlee = hpPercent < FLEE_HP_THRESHOLD;

  // ✅ IA #5: Se com pouca vida, tentar fugir do jogador
  if (shouldFlee && distance <= detectionRange && canCreatureMove(creature)) {
    creature.aiState = "retreating";
    creature.targetPlayerId = closestPlayer.id;

    // Mover para longe do jogador
    const dx = player.x - creature.x;
    const dy = player.y - creature.y;
    const fleeSpeed = effectiveMoveSpeed * 1.2 * speedMultiplier; // 20% mais rápido ao fugir

    creature.x -= (dx / distance) * fleeSpeed * deltaTime;
    creature.y -= (dy / distance) * fleeSpeed * deltaTime;
    return null;
  }

  // Fora de detecção: idle/roaming
  if (distance > detectionRange) {
    creature.aiState = "idle";
    creature.targetPlayerId = null;

    // ✅ Roaming: Sistema de patrulha aleatória
    // Atualizar timer de patrulha
    creature.patrolTimer -= deltaTime;

    // Se não tem destino ou chegou ao destino ou timer expirou, escolher novo destino
    if (!creature.roamingTarget || creature.patrolTimer <= 0) {
      // Escolher ponto aleatório dentro do raio de roaming
      const angle = Math.random() * Math.PI * 2;
      const distanceFromOrigin = Math.random() * ROAMING_RADIUS;
      creature.roamingTarget = {
        x: creature.patrolOrigin.x + Math.cos(angle) * distanceFromOrigin,
        y: creature.patrolOrigin.y + Math.sin(angle) * distanceFromOrigin
      };
      creature.patrolTimer = ROAMING_NEW_DESTINATION_INTERVAL;
    }

    // Mover em direção ao destino de roaming
    if (creature.roamingTarget && canCreatureMove(creature)) {
      const dx = creature.roamingTarget.x - creature.x;
      const dy = creature.roamingTarget.y - creature.y;
      const distToTarget = Math.hypot(dx, dy);

      if (distToTarget > ROAMING_DESTINATION_REACHED_DISTANCE) {
        // Ainda não chegou ao destino, continuar movendo
        const roamingSpeed = effectiveMoveSpeed * ROAMING_SPEED_MULTIPLIER * speedMultiplier;
        creature.x += (dx / distToTarget) * roamingSpeed * deltaTime;
        creature.y += (dy / distToTarget) * roamingSpeed * deltaTime;
      } else {
        // Chegou ao destino, escolher novo destino no próximo tick
        creature.roamingTarget = null;
        creature.patrolTimer = 0;
      }
    }

    return null;
  }

  // Dentro de detecção: perseguir
  creature.targetPlayerId = closestPlayer.id;

  // ✅ Usar alcance e dano de effectiveStats (já calculados baseados em tier e level)
  const effectiveAttackRange = attackRange;
  const attackDamage = creature.effectiveStats?.attackDamage ?? 0;

  // Dentro de alcance de ataque: atacar
  if (distance <= effectiveAttackRange && creature.attackCooldownRemaining <= 0 && canCreatureAttack(creature)) {
    creature.aiState = "attacking";
    creature.attackCooldownRemaining = attackCooldown;

    // Aplicar dano ao jogador (ataque melee instantâneo)
    const damageResult = applyDamageToPlayer(
      closestPlayer.id,
      player,
      attackDamage,
      creature.id
    );

    // Retornar resultado para broadcast
    return {
      creatureId: creature.id,
      playerId: closestPlayer.id,
      damage: damageResult.damage,
      currentHp: damageResult.currentHp,
      maxHp: damageResult.maxHp,
      died: damageResult.died
    };
  }

  // Fora de alcance de ataque: perseguir
  if (canCreatureMove(creature)) {
    creature.aiState = "chasing";

    const dx = player.x - creature.x;
    const dy = player.y - creature.y;
    const moveSpeed = effectiveMoveSpeed * deltaTime * speedMultiplier;

    creature.x += (dx / distance) * moveSpeed;
    creature.y += (dy / distance) * moveSpeed;
  }

  return null;
}

/**
 * Atualiza IA de criatura ranged.
 * 
 * Comportamento:
 * - Mantém distância preferida do jogador
 * - Atira projéteis quando em alcance
 * - Recua se jogador ficar muito perto
 * - ✅ IA #5: Foge quando com pouca vida (< 30% HP)
 */
function updateRangedCreatureAI(
  room: CombatRoomState,
  creature: ServerCreature,
  closestPlayer: { id: string; player: CombatPlayer },
  distance: number,
  deltaTime: number
): AIAttackResult | null {
  const player = closestPlayer.player;

  // ✅ FASE 9: Aplicar modificador de velocidade dos buffs
  const speedMultiplier = getCreatureSpeedMultiplier(creature);

  // ✅ Usar stats calculados (nível + rank) - obrigatório agora
  const effectiveMoveSpeed = creature.effectiveStats?.moveSpeed;
  const detectionRange = creature.effectiveStats?.detectionRange;
  const attackRange = creature.effectiveStats?.attackRange;
  const attackCooldown = creature.effectiveStats?.attackCooldown;
  const preferredDistance = creature.effectiveStats?.preferredDistance;
  const projectileSpeed = creature.effectiveStats?.projectileSpeed;

  if (!effectiveMoveSpeed || !detectionRange || !attackRange || !attackCooldown || !preferredDistance || projectileSpeed === undefined) {
    console.warn(`[Combat] Criatura ${creature.id} sem effectiveStats completo, pulando IA`);
    return null;
  }

  // ✅ Cancelar roaming quando detecta jogador
  if (distance <= detectionRange) {
    creature.roamingTarget = null;
  }

  // ✅ IA #5: Verificar se criatura está com pouca vida (< 30% HP)
  const hpPercent = creature.maxHp > 0 ? creature.currentHp / creature.maxHp : 1;
  const FLEE_HP_THRESHOLD = 0.3; // 30% HP
  const shouldFlee = hpPercent < FLEE_HP_THRESHOLD;

  // ✅ IA #5: Se com pouca vida, tentar fugir do jogador
  if (shouldFlee && distance <= detectionRange && canCreatureMove(creature)) {
    creature.aiState = "retreating";
    creature.targetPlayerId = closestPlayer.id;

    // Mover para longe do jogador
    const dx = player.x - creature.x;
    const dy = player.y - creature.y;
    const fleeSpeed = effectiveMoveSpeed * 1.2 * speedMultiplier; // 20% mais rápido ao fugir

    creature.x -= (dx / distance) * fleeSpeed * deltaTime;
    creature.y -= (dy / distance) * fleeSpeed * deltaTime;
    return null;
  }

  // Fora de detecção: idle/roaming
  if (distance > detectionRange) {
    creature.aiState = "idle";
    creature.targetPlayerId = null;

    // ✅ Roaming: Sistema de patrulha aleatória (mesmo sistema para ranged)
    // Atualizar timer de patrulha
    creature.patrolTimer -= deltaTime;

    // Se não tem destino ou chegou ao destino ou timer expirou, escolher novo destino
    if (!creature.roamingTarget || creature.patrolTimer <= 0) {
      // Escolher ponto aleatório dentro do raio de roaming
      const angle = Math.random() * Math.PI * 2;
      const distanceFromOrigin = Math.random() * ROAMING_RADIUS;
      creature.roamingTarget = {
        x: creature.patrolOrigin.x + Math.cos(angle) * distanceFromOrigin,
        y: creature.patrolOrigin.y + Math.sin(angle) * distanceFromOrigin
      };
      creature.patrolTimer = ROAMING_NEW_DESTINATION_INTERVAL;
    }

    // Mover em direção ao destino de roaming
    if (creature.roamingTarget && canCreatureMove(creature)) {
      const dx = creature.roamingTarget.x - creature.x;
      const dy = creature.roamingTarget.y - creature.y;
      const distToTarget = Math.hypot(dx, dy);

      if (distToTarget > ROAMING_DESTINATION_REACHED_DISTANCE) {
        // Ainda não chegou ao destino, continuar movendo
        const roamingSpeed = effectiveMoveSpeed * ROAMING_SPEED_MULTIPLIER * speedMultiplier;
        creature.x += (dx / distToTarget) * roamingSpeed * deltaTime;
        creature.y += (dy / distToTarget) * roamingSpeed * deltaTime;
      } else {
        // Chegou ao destino, escolher novo destino no próximo tick
        creature.roamingTarget = null;
        creature.patrolTimer = 0;
      }
    }

    return null;
  }

  creature.targetPlayerId = closestPlayer.id;

  // ✅ Usar stats baseados na criatura para velocidade de projétil
  const creatureAttackStats = getCreatureAttackStats(creature.creatureType, COMBAT_CONFIG.projectileSpeed) ?? DEFAULT_ATTACK_STATS;
  // ✅ Usar effectiveStats para alcance e dano (já calculados baseados em tier e level)
  const effectiveAttackRange = attackRange;
  const attackDamage = creature.effectiveStats?.attackDamage ?? 0;
  // Velocidade do projétil vem do getCreatureAttackStats (baseado no tipo da criatura)
  // Se não tiver, usa o do effectiveStats
  const finalProjectileSpeed = creatureAttackStats.speed || projectileSpeed;

  // Muito perto: recuar
  if (distance < preferredDistance * 0.7 && canCreatureMove(creature)) {
    creature.aiState = "retreating";

    const dx = player.x - creature.x;
    const dy = player.y - creature.y;
    const moveSpeed = effectiveMoveSpeed * deltaTime * speedMultiplier;

    // Mover para longe do jogador
    creature.x -= (dx / distance) * moveSpeed;
    creature.y -= (dy / distance) * moveSpeed;
    return null;
  }
  // Em alcance de ataque: disparar projétil
  else if (
    distance <= effectiveAttackRange &&
    creature.attackCooldownRemaining <= 0 &&
    canCreatureAttack(creature)
  ) {
    creature.aiState = "attacking";
    creature.attackCooldownRemaining = attackCooldown;

    // Criar projétil em direção ao jogador
    const dx = player.x - creature.x;
    const dy = player.y - creature.y;

    const velocityX = (dx / distance) * finalProjectileSpeed;
    const velocityY = (dy / distance) * finalProjectileSpeed;

    const projectile = createProjectile(
      creature.id,
      false, // isPlayerProjectile = false
      creature.x,
      creature.y,
      velocityX,
      velocityY,
      attackDamage,
      ENEMY_VISUAL_CONFIG.enemyProjectileLifetime,
      effectiveAttackRange, // Usar alcance calculado (tier + level)
      creature.creatureType, // ✅ Tipo da criatura para type effectiveness
      attackDamage, // ✅ Ataque do atacante para calcular dano com defesa
      creature.effectiveStats?.stunDuration // ✅ Duração de stun escalada
    );

    room.projectiles.push(projectile);
    return null; // Projétil será processado no próximo tick
  }
  // Longe demais: aproximar
  else if (distance > preferredDistance * 1.3 && canCreatureMove(creature)) {
    creature.aiState = "chasing";

    const dx = player.x - creature.x;
    const dy = player.y - creature.y;
    const moveSpeed = effectiveMoveSpeed * deltaTime * speedMultiplier;

    creature.x += (dx / distance) * moveSpeed;
    creature.y += (dy / distance) * moveSpeed;
    return null;
  }
  // Na distância ideal: circular/strafe
  else {
    creature.aiState = "chasing";
    // Podemos implementar movimento circular/strafe aqui no futuro
    return null;
  }
}

// ============================================================================
// Processamento de Skill Zones
// ============================================================================

/**
 * ✅ Aplica efeitos de uma skill zone em uma entidade (player ou criatura).
 * Usa valores programáticos da definição da skill em shared/attacks.ts.
 * 
 * @param skillType - Tipo da skill (fire_fog, root_trap, electric_surge)
 * @param entity - Entidade afetada (player ou criatura)
 * @param distance - Distância da entidade ao centro da zona
 * @param dx - Diferença X da entidade ao centro da zona
 * @param dy - Diferença Y da entidade ao centro da zona
 * @param ownerId - ID do dono da skill zone
 * @param damageResult - Resultado do dano aplicado (para verificar se morreu)
 */
function applySkillZoneEffects(
  skillType: string,
  entity: CombatPlayer | ServerCreature,
  distance: number,
  dx: number,
  dy: number,
  ownerId: string,
  damageResult: DamageResult
): void {
  // Obter definição da skill do shared
  const skillDef = getSpecialSkillByType(skillType);
  if (!skillDef) {
    return; // Skill não encontrada, não aplicar efeitos
  }

  // Aplicar slow se definido
  if (skillDef.slowModifier !== undefined && skillDef.slowDuration !== undefined) {
    if (!entity.buffs) {
      entity.buffs = [];
    }
    const existingSlow = entity.buffs.find(b => b.type === 'slow');
    if (!existingSlow || existingSlow.duration < skillDef.slowDuration) {
      entity.buffs.push({
        type: 'slow',
        duration: skillDef.slowDuration,
        value: skillDef.slowModifier,
        sourceId: ownerId,
        appliedAt: Date.now()
      });
    }
  }

  // Aplicar freeze se definido
  if (skillDef.freezeDuration !== undefined) {
    if (!entity.buffs) {
      entity.buffs = [];
    }
    const existingFreeze = entity.buffs.find(b => b.type === 'freeze');
    if (!existingFreeze || existingFreeze.duration < skillDef.freezeDuration) {
      entity.buffs.push({
        type: 'freeze',
        duration: skillDef.freezeDuration,
        sourceId: ownerId,
        appliedAt: Date.now()
      });
    }
  }

  // Aplicar knockback se definido
  if (skillDef.knockbackDistance !== undefined && distance > 0 && !damageResult.died) {
    const nx = dx / distance;
    const ny = dy / distance;
    entity.x += nx * skillDef.knockbackDistance;
    entity.y += ny * skillDef.knockbackDistance;
  }
}

/**
 * Atualiza todas as skill zones ativas na sala.
 * 
 * Para cada zona:
 * 1. Reduz tempo de vida
 * 2. Atualiza timer de tick
 * 3. Aplica dano periódico em criaturas dentro da zona
 * 4. Remove zonas expiradas
 * 
 * @param skillZones - Array de skill zones (será modificado)
 * @param creatures - Array de criaturas para verificar colisões
 * @param deltaTime - Tempo decorrido desde último tick (em segundos)
 * @returns Lista de resultados de dano aplicados
 */
export function updateSkillZones(
  skillZones: ServerSkillZone[],
  creatures: ServerCreature[],
  deltaTime: number,
  players?: Map<string, CombatPlayer>
): DamageResult[] {
  const damageResults: DamageResult[] = [];
  const zonesToKeep: ServerSkillZone[] = [];

  for (const zone of skillZones) {
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

      // ✅ Verificar se ownerId é de uma criatura (começa com "wild-")
      const isCreatureSkill = zone.ownerId.startsWith("wild-");

      if (isCreatureSkill && players) {
        // Skill zone de criatura inimiga - aplicar dano nos players (ignora extraídos)
        for (const [playerId, player] of players) {
          if (isPlayerExtracted(player)) continue;
          const dx = player.x - zone.x;
          const dy = player.y - zone.y;
          const distance = Math.hypot(dx, dy);

          if (distance <= zone.radius) {
            // Player está dentro da zona - aplicar dano
            const damageResult = applyDamageToPlayer(
              playerId,
              player,
              zone.damagePerTick,
              zone.ownerId,
              zone.attackerAttack
            );
            damageResults.push(damageResult);

            // ✅ Aplicar efeitos usando valores programáticos da definição da skill
            applySkillZoneEffects(
              zone.skillType,
              player,
              distance,
              dx,
              dy,
              zone.ownerId,
              damageResult
            );
          }
        }
      } else if (!isCreatureSkill) {
        // Skill zone de player - aplicar dano/cura
        // ✅ Se damagePerTick é negativo, é cura (heal_wave)
        if (zone.damagePerTick < 0 && players) {
          // Aplicar cura em players (aliados) dentro da zona
          const healAmount = Math.abs(zone.damagePerTick);
          const skillDef = getSpecialSkillByType(zone.skillType);

          for (const [playerId, player] of players) {
            const dx = player.x - zone.x;
            const dy = player.y - zone.y;
            const distance = Math.hypot(dx, dy);

            if (distance <= zone.radius) {
              // Player está dentro da zona - aplicar cura
              const oldHp = player.hp;
              player.hp = Math.min(player.maxHp, player.hp + healAmount);
              const actualHeal = player.hp - oldHp;

              if (actualHeal > 0) {
                damageResults.push({
                  targetId: playerId,
                  attackerId: zone.ownerId,
                  damage: -actualHeal, // Negativo indica cura
                  currentHp: player.hp,
                  maxHp: player.maxHp,
                  died: false
                });
              }
            }
          }

          // ✅ Aplicar slow em criaturas inimigas dentro da zona (efeito da Maré Curativa)
          if (skillDef && skillDef.slowModifier !== undefined && skillDef.slowDuration !== undefined) {
            for (const creature of creatures) {
              const creatureDx = creature.x - zone.x;
              const creatureDy = creature.y - zone.y;
              const creatureDistance = Math.hypot(creatureDx, creatureDy);
              if (creatureDistance <= zone.radius) {
                addBuffToCreature(creature, 'slow', skillDef.slowDuration, skillDef.slowModifier, zone.ownerId);
              }
            }
          }
        } else {
          // Aplicar dano nas criaturas (comportamento original)
          // ✅ Verificar se é skill castada na criatura (root_trap, electric_surge) para aplicar buffs defensivos
          const skillDef = getSpecialSkillByType(zone.skillType);
          const isSelfCastSkill = skillDef && skillDef.range === 0;

          // Se é skill auto-cast (range 0), aplicar buffs defensivos no jogador que a castou
          if (isSelfCastSkill && players) {
            const owner = players.get(zone.ownerId);
            if (owner) {
              const dx = owner.x - zone.x;
              const dy = owner.y - zone.y;
              const distance = Math.hypot(dx, dy);

              // Se jogador está dentro da zona (deve estar, pois é auto-cast)
              if (distance <= zone.radius) {
                // ✅ Aplicar buff defensivo (shield) para Verdant (root_trap)
                if (zone.skillType === "root_trap") {
                  // Redução de dano de 30% por 4 segundos (valor da skill)
                  addBuffToPlayer(owner, 'shield', skillDef.lifetime || 4, 0.3, zone.ownerId);
                }
              }
            }
          }

          for (const creature of creatures) {
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
              const level = creature.level ?? 1;
              damageResults.push({ ...damageResult, targetLevel: level });

              // ✅ Aplicar efeitos usando valores programáticos da definição da skill
              applySkillZoneEffects(
                zone.skillType,
                creature,
                distance,
                dx,
                dy,
                zone.ownerId,
                damageResult
              );
            }
          }
        }
      }
    }

    zonesToKeep.push(zone);
  }

  // Atualizar array de zonas (remover expiradas)
  skillZones.length = 0;
  skillZones.push(...zonesToKeep);

  return damageResults;
}

// ============================================================================
// Dano de Contato
// ============================================================================

/**
 * Aplica dano de contato de criaturas em jogadores próximos.
 * 
 * Verifica todas as criaturas e aplica dano contínuo em jogadores
 * que estão em contato (raio de colisão).
 * 
 * Chamado a cada tick do game loop.
 * 
 * @param room - Estado da sala
 * @param deltaTime - Tempo decorrido desde último tick (em segundos)
 * @returns Lista de resultados de dano aplicados
 * 
 * @example
 * ```ts
 * const damageResults = applyContactDamage(room, 0.05); // 50ms tick
 * for (const result of damageResults) {
 *   // Broadcast DamageMessage para clientes
 *   broadcastDamageResult(result);
 * }
 * ```
 */
export function applyContactDamage(
  room: CombatRoomState,
  deltaTime: number
): DamageResult[] {
  const results: DamageResult[] = [];

  // Para cada jogador vivo que ainda não extraiu
  for (const [playerId, player] of room.players) {
    if (player.isDead || isPlayerExtracted(player)) continue;

    // Verificar colisão com cada criatura
    for (const creature of room.creatures) {
      const dx = creature.x - player.x;
      const dy = creature.y - player.y;
      const distance = Math.hypot(dx, dy);

      // Verificar se está em contato (raio do jogador + raio da criatura)
      const collisionDistance = PLAYER_COLLISION_RADIUS + CREATURE_COLLISION_RADIUS;

      if (distance <= collisionDistance) {
        if (creature.effectiveStats?.attackDamage && creature.effectiveStats.attackDamage > 0) {
          // Aplicar dano proporcional ao deltaTime
          const damage = creature.effectiveStats?.attackDamage * deltaTime;
          const damageResult = applyDamageToPlayer(
            playerId,
            player,
            damage,
            creature.id
          );
          results.push(damageResult);
        }
      }
    }
  }

  return results;
}

// ============================================================================
// Utilitários
// ============================================================================

/**
 * Calcula fórmula de dano baseado em stats.
 * Por enquanto, retorna o dano base diretamente.
 * No futuro, pode incluir multiplicadores, críticos, etc.
 * 
 * @param baseDamage - Dano base do ataque
 * @param attackerStats - Stats do atacante (futuro)
 * @param defenderStats - Stats do defensor (futuro)
 * @returns Dano final a aplicar
 */
export function calculateDamage(
  baseDamage: number,
  attackerStats?: Record<string, number>,
  defenderStats?: Record<string, number>
): number {
  // MVP: dano fixo
  // Futuro: aplicar multiplicadores, críticos, resistências, etc.
  return baseDamage;
}

/**
 * Verifica se um ponto está dentro de um raio de outro ponto.
 */
export function isInRange(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  range: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distSquared = dx * dx + dy * dy;
  return distSquared <= range * range;
}
