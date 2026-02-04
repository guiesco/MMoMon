/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Sistema de Combate Server-Side - PokéExtract: Wild Expedition
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo implementa toda a lógica de combate server-authoritative:
 * - Processamento de ataques de jogadores
 * - Criação e atualização de projéteis
 * - Detecção de colisões e aplicação de dano
 * - IA de criaturas (movimento, aggro, ataques)
 * - Morte de jogadores e criaturas
 * 
 * O servidor é a única fonte de verdade para:
 * - Posições de projéteis
 * - HP de todas as entidades
 * - Cooldowns de ataque
 * - Estados de IA
 * 
 * @module server/systems/combat
 */

import {
  ServerCreature,
  ServerProjectile,
  ServerSkillZone,
  createProjectile
} from "../types";
import {
  COMBAT_CONFIG,
  ENEMY_AI_CONFIG,
  ENEMY_VISUAL_CONFIG,
  THREAT_TIERS,
  PLAYER_COLLISION_RADIUS,
  CREATURE_COLLISION_RADIUS,
  ThreatTier,
  EnemyBehaviorType,
  EnemyAIState
} from "../constants";
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
  isCreatureInvulnerable
} from "./buffs";

// ============================================================================
// Constantes de Stats de Criaturas
// ============================================================================

/**
 * Stats de ataque por tipo de criatura.
 * Sincronizado com src/game/creatures.ts
 * 
 * Formato: { creatureId: { damage: número, speed: número, range: número, isProjectile: boolean } }
 * 
 * IMPORTANTE: Estes valores devem corresponder EXATAMENTE aos definidos em creatures.ts
 * para garantir consistência entre cliente e servidor.
 */
const CREATURE_ATTACK_STATS: Record<string, { damage: number; speed: number; range: number; isProjectile: boolean }> = {
  // Criaturas iniciais (tier 1) - SINCRONIZADO com creatures.ts
  "pyrognat": { 
    damage: 20,    // Chama Rápida
    speed: 420,    // Velocidade de projétil padrão
    range: 220,    // Alcance máximo
    isProjectile: true 
  },
  "aquaryl": { 
    damage: 18,    // Jato d'Água
    speed: 400,    
    range: 260,    
    isProjectile: true 
  },
  "verdant": { 
    damage: 16,    // Chicote de Vinha (melee)
    speed: 0,      // Não usa velocidade (melee)
    range: 80,     // Alcance melee
    isProjectile: false 
  },
  "voltiger": { 
    damage: 24,    // Raio Cortante
    speed: 450,    
    range: 280,    
    isProjectile: true 
  },
  
  // Criaturas intermediárias (tier 2) - valores ilustrativos
  "flameclaw": { damage: 35, speed: 480, range: 250, isProjectile: true },
  "tidalfin": { damage: 30, speed: 420, range: 280, isProjectile: true },
  "leafstorm": { damage: 32, speed: 400, range: 100, isProjectile: false },
  "sparkwing": { damage: 38, speed: 520, range: 300, isProjectile: true },
  
  // Criaturas avançadas (tier 3) - valores ilustrativos
  "infernodrake": { damage: 50, speed: 500, range: 280, isProjectile: true },
  "oceanleviathan": { damage: 45, speed: 440, range: 300, isProjectile: true },
  "foresttitan": { damage: 48, speed: 420, range: 120, isProjectile: false },
  "thunderbeast": { damage: 55, speed: 550, range: 320, isProjectile: true },
};

/**
 * Stats padrão caso a criatura não seja encontrada no lookup.
 * Equivale a um ataque básico sem criatura.
 */
const DEFAULT_ATTACK_STATS = { damage: 15, speed: 400, range: 200, isProjectile: true };

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
  failReason?: "cooldown" | "invalid_position" | "dead";
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
  
  /** ✅ FASE 9: Buffs e debuffs ativos no jogador */
  buffs?: Array<{
    type: 'speed' | 'slow' | 'freeze' | 'stun' | 'poison' | 'shield' | 'invulnerable' | 'regen';
    duration: number;
    value?: number;
    sourceId?: string;
    appliedAt: number;
  }>;
  
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
 * @returns Resultado do ataque
 * 
 * @example
 * ```ts
 * const result = processAttackIntent(room, "player-1", 500, 300, Date.now(), "pyrognat");
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
  creatureId?: string
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

  // Validação: cooldown de ataque (0.5s entre ataques para evitar spam)
  const ATTACK_COOLDOWN_MS = 500;
  if (currentTime - player.lastAttackTime < ATTACK_COOLDOWN_MS) {
    return {
      success: false,
      failReason: "cooldown"
    };
  }

  // Validação: coordenadas válidas (básica)
  if (!isFinite(targetX) || !isFinite(targetY)) {
    return {
      success: false,
      failReason: "invalid_position"
    };
  }

  // Buscar stats da criatura ativa (ou usar valores padrão)
  const creatureStats = creatureId 
    ? CREATURE_ATTACK_STATS[creatureId] ?? DEFAULT_ATTACK_STATS
    : DEFAULT_ATTACK_STATS;

  // Verificar se é ataque melee
  if (!creatureStats.isProjectile) {
    // Ataque melee: aplicar dano imediato em área
    // Encontrar criaturas em alcance e na direção do ataque
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    
    let hitCount = 0;
    const MELEE_KNOCKBACK_DISTANCE = 12; // Pixels de empurrão
    
    for (const creature of room.creatures) {
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
          // Aplicar dano
          const damageResult = applyDamageToCreature(
            creature,
            creatureStats.damage,
            playerId
          );
          hitCount++;
          
          // ✅ NOVO: Aplicar knockback se criatura sobreviveu
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
    creatureStats.range // Distância máxima baseada no alcance da criatura
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
  
  const DEBUG_PROJECTILES = process.env.DEBUG_PROJECTILES === "true";
  const initialProjectileCount = room.projectiles.length;

  for (const proj of room.projectiles) {
    // Validação: projétil deve ter velocidade válida
    if (!isFinite(proj.velocityX) || !isFinite(proj.velocityY)) {
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
          
          const damageResult = applyDamageToCreature(
            creature,
            proj.damage,
            proj.ownerId
          );
          damageResults.push(damageResult);
          
          // Aplicar knockback leve em projéteis
          if (!damageResult.died && creature.currentHp > 0) {
            const PROJECTILE_KNOCKBACK_DISTANCE = 6; // Menor que melee
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
      // Projétil de criatura: colide com jogadores vivos
      for (const [playerId, player] of room.players) {
        if (player.isDead) continue;
        if (checkProjectilePlayerCollision(proj, player)) {
          if (DEBUG_PROJECTILES) {
            console.log(
              `[Combat] Projétil ${proj.id} colidiu com jogador ${playerId} ` +
              `em (${proj.x.toFixed(1)}, ${proj.y.toFixed(1)})`
            );
          }
          
          const damageResult = applyDamageToPlayer(
            playerId,
            player,
            proj.damage,
            proj.ownerId
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
 */
function checkProjectileCreatureCollision(
  proj: ServerProjectile,
  creature: ServerCreature
): boolean {
  const PROJECTILE_RADIUS = 4; // pixels
  const CREATURE_RADIUS = 12; // pixels (aproximado)
  const collisionDistance = PROJECTILE_RADIUS + CREATURE_RADIUS;

  const dx = proj.x - creature.x;
  const dy = proj.y - creature.y;
  const distSquared = dx * dx + dy * dy;

  return distSquared <= collisionDistance * collisionDistance;
}

/**
 * Verifica colisão entre projétil e jogador.
 */
function checkProjectilePlayerCollision(
  proj: ServerProjectile,
  player: CombatPlayer
): boolean {
  const PROJECTILE_RADIUS = 4; // pixels
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
 * Aplica dano a uma criatura.
 * 
 * Reduz HP da criatura e verifica morte.
 * Se a criatura morrer, marca para remoção (currentHp = 0).
 * 
 * @param creature - Criatura alvo
 * @param damage - Quantidade de dano a aplicar
 * @param attackerId - ID do atacante (para telemetria/logs)
 * @returns Resultado do dano aplicado
 * 
 * @example
 * ```ts
 * const result = applyDamageToCreature(creature, 20, "player-1");
 * if (result.died) {
 *   console.log(`Criatura ${result.targetId} foi derrotada!`);
 *   // Spawnar recursos, XP, etc.
 * }
 * ```
 */
export function applyDamageToCreature(
  creature: ServerCreature,
  damage: number,
  attackerId: string
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
  
  const oldHp = creature.currentHp;
  creature.currentHp = Math.max(0, creature.currentHp - damage);

  const died = creature.currentHp === 0 && oldHp > 0;

  // Se levou dano mas não morreu, aplicar stun breve
  if (!died && damage > 0) {
    // Stun temporário (será resetado pela IA)
    // Não implementamos timer aqui pois a IA gerencia isso
  }

  return {
    targetId: creature.id,
    attackerId,
    damage,
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
 * @param damage - Quantidade de dano a aplicar
 * @param attackerId - ID do atacante (criatura ou outro jogador)
 * @returns Resultado do dano aplicado
 * 
 * @example
 * ```ts
 * const result = applyDamageToPlayer("player-1", player, 15, "wild-3");
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
  attackerId: string
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
  
  const oldHp = player.hp;
  player.hp = Math.max(0, player.hp - damage);

  const died = player.hp === 0 && oldHp > 0;

  if (died) {
    player.isDead = true;
  }

  return {
    targetId: playerId,
    attackerId,
    damage,
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
// Flag para habilitar logs detalhados de IA
const DEBUG_AI = process.env.DEBUG_AI === "true" || true; // Temporariamente sempre ativo
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
  
  // Encontrar jogadores vivos
  const alivePlayers: Array<{ id: string; player: CombatPlayer }> = [];
  for (const [id, player] of room.players) {
    if (!player.isDead) {
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
      const config = ENEMY_AI_CONFIG[creature.tier]?.[creature.behaviorType];
      if (!config) continue;
      
      const speedMultiplier = getCreatureSpeedMultiplier(creature);
      const ROAMING_RADIUS = 150;
      const ROAMING_SPEED = 0.4;
      const ROAMING_DESTINATION_REACHED_DISTANCE = 15;
      const ROAMING_NEW_DESTINATION_INTERVAL = 3.0;
      
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
        
        if (distToTarget > ROAMING_DESTINATION_REACHED_DISTANCE) {
          const roamingSpeed = config.moveSpeed * ROAMING_SPEED * speedMultiplier;
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
    // Obter configuração de IA baseada no tier e tipo
    const config = ENEMY_AI_CONFIG[creature.tier]?.[creature.behaviorType];
    if (!config) {
      if (shouldLog) {
        console.log(`[AI] ⚠️ Criatura ${creature.id} sem config: tier=${creature.tier}, behavior=${creature.behaviorType}`);
      }
      continue;
    }

    // Atualizar cooldown de ataque
    if (creature.attackCooldownRemaining > 0) {
      creature.attackCooldownRemaining = Math.max(
        0,
        creature.attackCooldownRemaining - deltaTime
      );
    }

    // ✅ IA #6: Encontrar criaturas do mesmo tipo próximas para agrupamento
    const GROUPING_DETECTION_RANGE = 200; // Raio de detecção para agrupamento
    const GROUPING_STRENGTH = 0.3; // Força do movimento de agrupamento (0-1)
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
      const groupingSpeed = config.moveSpeed * 0.4 * speedMultiplier; // Movimento mais lento para agrupamento
      
      creature.x += groupingDx * groupingSpeed * deltaTime;
      creature.y += groupingDy * groupingSpeed * deltaTime;
    }

    const prevX = creature.x;
    const prevY = creature.y;
    const prevState = creature.aiState;

    // Atualizar comportamento baseado no tipo e coletar resultados de ataque
    let attackResult: AIAttackResult | null = null;
    
    if (creature.behaviorType === "melee") {
      attackResult = updateMeleeCreatureAI(
        creature,
        config,
        closestPlayer,
        closestDistance,
        deltaTime
      );
    } else {
      attackResult = updateRangedCreatureAI(
        room,
        creature,
        config,
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
        `detection=${config.detectionRange}px, attack=${config.attackRange}px`
      );
    }
  }
  
  return attackResults;
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
  config: typeof ENEMY_AI_CONFIG.comum.melee,
  closestPlayer: { id: string; player: CombatPlayer },
  distance: number,
  deltaTime: number
): AIAttackResult | null {
  const player = closestPlayer.player;

  // ✅ FASE 9: Aplicar modificador de velocidade dos buffs
  const speedMultiplier = getCreatureSpeedMultiplier(creature);
  
  // ✅ Cancelar roaming quando detecta jogador
  if (distance <= config.detectionRange) {
    creature.roamingTarget = null;
  }
  
  // ✅ IA #5: Verificar se criatura está com pouca vida (< 30% HP)
  const hpPercent = creature.maxHp > 0 ? creature.currentHp / creature.maxHp : 1;
  const FLEE_HP_THRESHOLD = 0.3; // 30% HP
  const shouldFlee = hpPercent < FLEE_HP_THRESHOLD;
  
  // ✅ IA #5: Se com pouca vida, tentar fugir do jogador
  if (shouldFlee && distance <= config.detectionRange && canCreatureMove(creature)) {
    creature.aiState = "retreating";
    creature.targetPlayerId = closestPlayer.id;
    
    // Mover para longe do jogador
    const dx = player.x - creature.x;
    const dy = player.y - creature.y;
    const fleeSpeed = config.moveSpeed * 1.2 * speedMultiplier; // 20% mais rápido ao fugir
    
    creature.x -= (dx / distance) * fleeSpeed * deltaTime;
    creature.y -= (dy / distance) * fleeSpeed * deltaTime;
    return null;
  }
  
  // Fora de detecção: idle/roaming
  if (distance > config.detectionRange) {
    creature.aiState = "idle";
    creature.targetPlayerId = null;

    // ✅ Roaming: Sistema de patrulha aleatória
    const ROAMING_RADIUS = 150; // Raio máximo de roaming a partir da origem
    const ROAMING_SPEED = 0.4; // Velocidade de roaming (40% da velocidade normal)
    const ROAMING_DESTINATION_REACHED_DISTANCE = 15; // Distância para considerar destino alcançado
    const ROAMING_NEW_DESTINATION_INTERVAL = 3.0; // Tempo em segundos antes de escolher novo destino
    
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
        const roamingSpeed = config.moveSpeed * ROAMING_SPEED * speedMultiplier;
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

  // Dentro de alcance de ataque: atacar
  if (distance <= config.attackRange && creature.attackCooldownRemaining <= 0 && canCreatureAttack(creature)) {
    creature.aiState = "attacking";
    creature.attackCooldownRemaining = config.attackCooldown;

    // Aplicar dano ao jogador (ataque melee instantâneo)
    const damageResult = applyDamageToPlayer(
      closestPlayer.id,
      player,
      config.attackDamage,
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
    const moveSpeed = config.moveSpeed * deltaTime * speedMultiplier;

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
  config: typeof ENEMY_AI_CONFIG.comum.ranged,
  closestPlayer: { id: string; player: CombatPlayer },
  distance: number,
  deltaTime: number
): AIAttackResult | null {
  const player = closestPlayer.player;

  // ✅ FASE 9: Aplicar modificador de velocidade dos buffs
  const speedMultiplier = getCreatureSpeedMultiplier(creature);
  
  // ✅ Cancelar roaming quando detecta jogador
  if (distance <= config.detectionRange) {
    creature.roamingTarget = null;
  }
  
  // ✅ IA #5: Verificar se criatura está com pouca vida (< 30% HP)
  const hpPercent = creature.maxHp > 0 ? creature.currentHp / creature.maxHp : 1;
  const FLEE_HP_THRESHOLD = 0.3; // 30% HP
  const shouldFlee = hpPercent < FLEE_HP_THRESHOLD;
  
  // ✅ IA #5: Se com pouca vida, tentar fugir do jogador
  if (shouldFlee && distance <= config.detectionRange && canCreatureMove(creature)) {
    creature.aiState = "retreating";
    creature.targetPlayerId = closestPlayer.id;
    
    // Mover para longe do jogador
    const dx = player.x - creature.x;
    const dy = player.y - creature.y;
    const fleeSpeed = config.moveSpeed * 1.2 * speedMultiplier; // 20% mais rápido ao fugir
    
    creature.x -= (dx / distance) * fleeSpeed * deltaTime;
    creature.y -= (dy / distance) * fleeSpeed * deltaTime;
    return null;
  }

  // Fora de detecção: idle/roaming
  if (distance > config.detectionRange) {
    creature.aiState = "idle";
    creature.targetPlayerId = null;

    // ✅ Roaming: Sistema de patrulha aleatória (mesmo sistema para ranged)
    const ROAMING_RADIUS = 150; // Raio máximo de roaming a partir da origem
    const ROAMING_SPEED = 0.4; // Velocidade de roaming (40% da velocidade normal)
    const ROAMING_DESTINATION_REACHED_DISTANCE = 15; // Distância para considerar destino alcançado
    const ROAMING_NEW_DESTINATION_INTERVAL = 3.0; // Tempo em segundos antes de escolher novo destino
    
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
        const roamingSpeed = config.moveSpeed * ROAMING_SPEED * speedMultiplier;
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

  const preferredDistance = config.preferredDistance ?? 120;

  // Muito perto: recuar
  if (distance < preferredDistance * 0.7 && canCreatureMove(creature)) {
    creature.aiState = "retreating";

    const dx = player.x - creature.x;
    const dy = player.y - creature.y;
    const moveSpeed = config.moveSpeed * deltaTime * speedMultiplier;

    // Mover para longe do jogador
    creature.x -= (dx / distance) * moveSpeed;
    creature.y -= (dy / distance) * moveSpeed;
    return null;
  }
  // Em alcance de ataque: disparar projétil
  else if (
    distance <= config.attackRange &&
    creature.attackCooldownRemaining <= 0 &&
    canCreatureAttack(creature)
  ) {
    creature.aiState = "attacking";
    creature.attackCooldownRemaining = config.attackCooldown;

    // Criar projétil em direção ao jogador
    const dx = player.x - creature.x;
    const dy = player.y - creature.y;
    const projectileSpeed = config.projectileSpeed ?? 200;

    const velocityX = (dx / distance) * projectileSpeed;
    const velocityY = (dy / distance) * projectileSpeed;

    const projectile = createProjectile(
      creature.id,
      false, // isPlayerProjectile = false
      creature.x,
      creature.y,
      velocityX,
      velocityY,
      config.attackDamage,
      ENEMY_VISUAL_CONFIG.enemyProjectileLifetime
    );

    room.projectiles.push(projectile);
    return null; // Projétil será processado no próximo tick
  }
  // Longe demais: aproximar
  else if (distance > preferredDistance * 1.3 && canCreatureMove(creature)) {
    creature.aiState = "chasing";

    const dx = player.x - creature.x;
    const dy = player.y - creature.y;
    const moveSpeed = config.moveSpeed * deltaTime * speedMultiplier;

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
  deltaTime: number
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

      // Encontrar criaturas dentro da zona
      for (const creature of creatures) {
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

          // Aplicar efeitos adicionais baseados no tipo de skill
          if (zone.skillType === "fire_fog") {
            // Nevoeiro incendiário: slow moderado (30% mais lento)
            if (!creature.buffs) {
              creature.buffs = [];
            }
            const existingSlow = creature.buffs.find(b => b.type === 'slow');
            if (!existingSlow || existingSlow.duration < 0.8) {
              // Aplicar slow de 0.8s (dura até próximo tick)
              creature.buffs.push({
                type: 'slow',
                duration: 0.8,
                value: 0.7, // 30% mais lento
                sourceId: zone.ownerId,
                appliedAt: Date.now()
              });
            }
          } else if (zone.skillType === "root_trap") {
            // Armadilha de raízes: freeze (imobiliza)
            if (!creature.buffs) {
              creature.buffs = [];
            }
            const existingFreeze = creature.buffs.find(b => b.type === 'freeze');
            if (!existingFreeze || existingFreeze.duration < 1.0) {
              creature.buffs.push({
                type: 'freeze',
                duration: 1.0,
                sourceId: zone.ownerId,
                appliedAt: Date.now()
              });
            }
          } else if (zone.skillType === "electric_surge") {
            // Pulso elétrico: knockback leve
            if (distance > 0 && !damageResult.died) {
              const knockbackDistance = 30; // Distância de knockback
              const nx = dx / distance;
              const ny = dy / distance;
              creature.x += nx * knockbackDistance;
              creature.y += ny * knockbackDistance;
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

  // Para cada jogador vivo
  for (const [playerId, player] of room.players) {
    if (player.isDead) continue;

    // Verificar colisão com cada criatura
    for (const creature of room.creatures) {
      const dx = creature.x - player.x;
      const dy = creature.y - player.y;
      const distance = Math.hypot(dx, dy);

      // Verificar se está em contato (raio do jogador + raio da criatura)
      const collisionDistance = PLAYER_COLLISION_RADIUS + CREATURE_COLLISION_RADIUS;

      if (distance <= collisionDistance) {
        // Obter dano de contato baseado no tier
        const tierConfig = THREAT_TIERS[creature.tier];
        const contactDps = tierConfig.contactDamagePerSecond;

        if (contactDps > 0) {
          // Aplicar dano proporcional ao deltaTime
          const damage = contactDps * deltaTime;
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
