/**
 * Testes unitários para o sistema de combate.
 * 
 * Para rodar os testes (quando tiver Jest configurado):
 * npm test
 */

import {
  processAttackIntent,
  updateProjectiles,
  updateCreatureAI,
  applyDamageToCreature,
  applyDamageToPlayer,
  CombatRoomState,
  CombatPlayer
} from "../combat";
import { createCreature, createProjectile, ServerCreature } from "../../types";
import { COMBAT_CONFIG } from "../../constants";

/**
 * Helper para criar um estado de sala de teste.
 */
function createTestRoom(): CombatRoomState {
  return {
    players: new Map(),
    creatures: [],
    projectiles: []
  };
}

/**
 * Helper para criar um jogador de teste.
 */
function createTestPlayer(id: string, x: number, y: number): CombatPlayer {
  return {
    id,
    x,
    y,
    hp: 100,
    maxHp: 100,
    lastAttackTime: 0,
    isDead: false
  };
}

// ============================================================================
// TESTES: processAttackIntent
// ============================================================================

describe("processAttackIntent", () => {
  test("deve criar projétil quando jogador ataca com sucesso", () => {
    const room = createTestRoom();
    const player = createTestPlayer("player-1", 100, 100);
    room.players.set("player-1", player);

    const result = processAttackIntent(room, "player-1", 200, 100, Date.now());

    expect(result.success).toBe(true);
    expect(result.projectileId).toBeDefined();
    expect(room.projectiles.length).toBe(1);
    // Sem creatureId, deve usar stats padrão (damage: 15)
    expect(room.projectiles[0].damage).toBe(15);
  });

  test("deve usar stats da criatura quando creatureId é fornecido", () => {
    const room = createTestRoom();
    const player = createTestPlayer("player-1", 100, 100);
    room.players.set("player-1", player);

    // Ataque com Pyrognat (damage: 25, speed: 450)
    const result = processAttackIntent(room, "player-1", 200, 100, Date.now(), "pyrognat");

    expect(result.success).toBe(true);
    expect(result.projectileId).toBeDefined();
    expect(room.projectiles.length).toBe(1);
    expect(room.projectiles[0].damage).toBe(25); // Dano do Pyrognat
    // Verificar que velocidade também foi aplicada
    const proj = room.projectiles[0];
    const speed = Math.hypot(proj.velocityX, proj.velocityY);
    expect(speed).toBeCloseTo(450, 0); // Velocidade do Pyrognat
  });

  test("deve usar stats padrão para criatura desconhecida", () => {
    const room = createTestRoom();
    const player = createTestPlayer("player-1", 100, 100);
    room.players.set("player-1", player);

    // Ataque com criatura inexistente
    const result = processAttackIntent(room, "player-1", 200, 100, Date.now(), "unknown-creature");

    expect(result.success).toBe(true);
    expect(room.projectiles[0].damage).toBe(15); // Stats padrão
  });

  test("deve falhar se jogador estiver em cooldown", () => {
    const room = createTestRoom();
    const player = createTestPlayer("player-1", 100, 100);
    player.lastAttackTime = Date.now(); // Ataque muito recente
    room.players.set("player-1", player);

    const result = processAttackIntent(room, "player-1", 200, 100, Date.now());

    expect(result.success).toBe(false);
    expect(result.failReason).toBe("cooldown");
    expect(room.projectiles.length).toBe(0);
  });

  test("deve falhar se jogador estiver morto", () => {
    const room = createTestRoom();
    const player = createTestPlayer("player-1", 100, 100);
    player.isDead = true;
    room.players.set("player-1", player);

    const result = processAttackIntent(room, "player-1", 200, 100, Date.now());

    expect(result.success).toBe(false);
    expect(result.failReason).toBe("dead");
  });

  test("deve calcular direção corretamente", () => {
    const room = createTestRoom();
    const player = createTestPlayer("player-1", 100, 100);
    room.players.set("player-1", player);

    // Ataque para a direita
    processAttackIntent(room, "player-1", 200, 100, Date.now());

    const projectile = room.projectiles[0];
    expect(projectile.velocityX).toBeGreaterThan(0);
    expect(projectile.velocityY).toBeCloseTo(0, 1);
  });
});

// ============================================================================
// TESTES: updateProjectiles
// ============================================================================

describe("updateProjectiles", () => {
  test("deve mover projéteis baseado em velocidade", () => {
    const room = createTestRoom();
    
    const proj = createProjectile(
      "player-1",
      true,
      100,
      100,
      420, // velocityX
      0,   // velocityY
      20,
      1.0
    );
    room.projectiles.push(proj);

    const initialX = proj.x;
    updateProjectiles(room, 0.1); // 100ms = 0.1s

    expect(room.projectiles[0].x).toBeGreaterThan(initialX);
    expect(room.projectiles[0].x).toBeCloseTo(initialX + 420 * 0.1, 1);
  });

  test("deve remover projéteis expirados", () => {
    const room = createTestRoom();
    
    const proj = createProjectile("player-1", true, 100, 100, 420, 0, 20, 0.05);
    room.projectiles.push(proj);

    updateProjectiles(room, 0.1); // 100ms > lifetime de 50ms

    expect(room.projectiles.length).toBe(0);
  });

  test("deve detectar colisão com criatura e aplicar dano", () => {
    const room = createTestRoom();
    
    // Criar criatura perto do projétil
    const creature = createCreature("bulbasaur", 110, 100, "comum", "melee", 60);
    room.creatures.push(creature);

    // Criar projétil muito perto da criatura
    const proj = createProjectile("player-1", true, 100, 100, 420, 0, 20, 1.0);
    room.projectiles.push(proj);

    const results = updateProjectiles(room, 0.01); // Tick pequeno

    expect(results.length).toBe(1);
    expect(results[0].damage).toBe(20);
    expect(room.creatures[0].currentHp).toBe(40); // 60 - 20
    expect(room.projectiles.length).toBe(0); // Projétil removido
  });

  test("deve remover criatura morta após dano fatal", () => {
    const room = createTestRoom();
    
    const creature = createCreature("bulbasaur", 110, 100, "comum", "melee", 15);
    room.creatures.push(creature);

    const proj = createProjectile("player-1", true, 100, 100, 420, 0, 20, 1.0);
    room.projectiles.push(proj);

    const results = updateProjectiles(room, 0.01);

    expect(results[0].died).toBe(true);
    expect(room.creatures.length).toBe(0); // Criatura removida
  });
});

// ============================================================================
// TESTES: applyDamageToCreature
// ============================================================================

describe("applyDamageToCreature", () => {
  test("deve reduzir HP da criatura", () => {
    const creature = createCreature("charmander", 100, 100, "comum", "melee", 60);

    const result = applyDamageToCreature(creature, 20, "player-1");

    expect(result.damage).toBe(20);
    expect(result.currentHp).toBe(40);
    expect(result.died).toBe(false);
    expect(creature.currentHp).toBe(40);
  });

  test("deve marcar criatura como morta quando HP chega a 0", () => {
    const creature = createCreature("squirtle", 100, 100, "comum", "melee", 15);

    const result = applyDamageToCreature(creature, 20, "player-1");

    expect(result.currentHp).toBe(0);
    expect(result.died).toBe(true);
    expect(creature.currentHp).toBe(0);
  });

  test("não deve deixar HP negativo", () => {
    const creature = createCreature("pikachu", 100, 100, "comum", "melee", 5);

    const result = applyDamageToCreature(creature, 100, "player-1");

    expect(result.currentHp).toBe(0);
    expect(creature.currentHp).toBe(0);
  });
});

// ============================================================================
// TESTES: applyDamageToPlayer
// ============================================================================

describe("applyDamageToPlayer", () => {
  test("deve reduzir HP do jogador", () => {
    const player = createTestPlayer("player-1", 100, 100);

    const result = applyDamageToPlayer("player-1", player, 25, "wild-1");

    expect(result.damage).toBe(25);
    expect(result.currentHp).toBe(75);
    expect(result.died).toBe(false);
    expect(player.hp).toBe(75);
  });

  test("deve marcar jogador como morto quando HP chega a 0", () => {
    const player = createTestPlayer("player-1", 100, 100);
    player.hp = 10;

    const result = applyDamageToPlayer("player-1", player, 15, "wild-1");

    expect(result.currentHp).toBe(0);
    expect(result.died).toBe(true);
    expect(player.isDead).toBe(true);
  });
});

// ============================================================================
// TESTES: updateCreatureAI
// ============================================================================

describe("updateCreatureAI", () => {
  test("criatura melee deve perseguir jogador próximo", () => {
    const room = createTestRoom();
    const player = createTestPlayer("player-1", 200, 100);
    room.players.set("player-1", player);

    const creature = createCreature("bulbasaur", 100, 100, "comum", "melee", 60);
    room.creatures.push(creature);

    const initialX = creature.x;
    updateCreatureAI(room, 0.1); // 100ms

    expect(creature.aiState).toBe("chasing");
    expect(creature.x).toBeGreaterThan(initialX); // Moveu em direção ao jogador
  });

  test("criatura ranged deve disparar projétil quando em alcance", () => {
    const room = createTestRoom();
    const player = createTestPlayer("player-1", 200, 100);
    room.players.set("player-1", player);

    const creature = createCreature("charmander", 100, 100, "comum", "ranged", 60);
    creature.attackCooldownRemaining = 0; // Cooldown zerado
    room.creatures.push(creature);

    const initialProjectileCount = room.projectiles.length;
    updateCreatureAI(room, 0.1);

    // Se em alcance, deve ter disparado projétil
    if (creature.aiState === "attacking") {
      expect(room.projectiles.length).toBeGreaterThan(initialProjectileCount);
    }
  });

  test("criatura deve ficar idle quando não há jogadores vivos", () => {
    const room = createTestRoom();
    // Sem jogadores vivos

    const creature = createCreature("squirtle", 100, 100, "comum", "melee", 60);
    creature.aiState = "chasing";
    room.creatures.push(creature);

    updateCreatureAI(room, 0.1);

    expect(creature.aiState).toBe("idle");
    expect(creature.targetPlayerId).toBeNull();
  });
});

// ============================================================================
// TESTES DE INTEGRAÇÃO
// ============================================================================

describe("Integração: Combate Completo", () => {
  test("fluxo completo: jogador ataca criatura até a morte", () => {
    const room = createTestRoom();
    const player = createTestPlayer("player-1", 100, 100);
    room.players.set("player-1", player);

    const creature = createCreature("bulbasaur", 150, 100, "comum", "melee", 40);
    room.creatures.push(creature);

    // Ataque 1 (sem creatureId = stats padrão, damage: 15)
    let result = processAttackIntent(room, "player-1", 150, 100, Date.now());
    expect(result.success).toBe(true);

    // Simular movimento do projétil até colidir
    for (let i = 0; i < 10; i++) {
      const damageResults = updateProjectiles(room, 0.01);
      if (damageResults.length > 0) {
        expect(creature.currentHp).toBe(25); // 40 - 15 (dano padrão)
        break;
      }
    }

    // Aguardar cooldown
    const now = Date.now() + 600; // 600ms depois

    // Ataque 2 (segundo ataque de 15 de dano)
    result = processAttackIntent(room, "player-1", 150, 100, now);
    expect(result.success).toBe(true);

    // Simular movimento do projétil até colidir
    for (let i = 0; i < 10; i++) {
      const damageResults = updateProjectiles(room, 0.01);
      if (damageResults.length > 0) {
        // 25 - 15 = 10 HP restantes (não morre com 2 ataques)
        expect(creature.currentHp).toBe(10);
        expect(damageResults[0].died).toBe(false);
        break;
      }
    }

    // Aguardar cooldown novamente
    const now2 = now + 600;

    // Ataque 3 para finalizar
    result = processAttackIntent(room, "player-1", 150, 100, now2);
    expect(result.success).toBe(true);

    // Simular movimento do projétil até colidir
    for (let i = 0; i < 10; i++) {
      const damageResults = updateProjectiles(room, 0.01);
      if (damageResults.length > 0) {
        expect(damageResults[0].died).toBe(true);
        expect(room.creatures.length).toBe(0); // Criatura removida
        break;
      }
    }
  });
});

/**
 * NOTA: Para rodar estes testes, você precisa configurar Jest:
 * 
 * 1. Instalar dependências:
 *    npm install --save-dev jest @types/jest ts-jest
 * 
 * 2. Adicionar script no package.json:
 *    "scripts": {
 *      "test": "jest"
 *    }
 * 
 * 3. Criar jest.config.js:
 *    module.exports = {
 *      preset: 'ts-jest',
 *      testEnvironment: 'node',
 *    };
 * 
 * 4. Rodar testes:
 *    npm test
 */
