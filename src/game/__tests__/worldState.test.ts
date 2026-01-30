/**
 * Testes para GameWorldState (Fase 4A)
 * 
 * Valida as implementações LocalWorldState e RemoteWorldState
 * para garantir que o gerenciamento unificado funciona corretamente.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  LocalWorldState, 
  RemoteWorldState, 
  type CreatureState, 
  type ResourceState,
  type PlayerState
} from '../worldState';

describe('LocalWorldState', () => {
  let worldState: LocalWorldState;

  beforeEach(() => {
    worldState = new LocalWorldState();
  });

  describe('Creature Management', () => {
    it('should add a creature', () => {
      const creature: CreatureState = {
        id: 'wild-1',
        x: 100,
        y: 200,
        currentHp: 50,
        maxHp: 100,
        tier: 'comum',
        behaviorType: 'melee',
        aiState: 'idle',
        aiConfig: {
          behaviorType: 'melee',
          detectionRange: 150,
          aggroRange: 200,
          attackRange: 50,
          attackDamage: 10,
          attackCooldown: 2,
          attackWindup: 0.5,
          moveSpeed: 80,
          retreatDistance: 0,
          patrolRadius: 50,
          patrolInterval: 3,
          stunDuration: 1.5,
          aggroIndicatorColor: 0xff0000
        },
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 100, y: 200 },
        patrolTimer: 0,
        speciesId: 'bulbasaur',
        creatureType: 'grass',
        level: 5,
        state: 'active'
      };

      worldState.addCreature(creature);

      expect(worldState.creatures.size).toBe(1);
      expect(worldState.getCreature('wild-1')).toEqual(creature);
    });

    it('should update a creature', () => {
      const creature: CreatureState = {
        id: 'wild-1',
        x: 100,
        y: 200,
        currentHp: 100,
        maxHp: 100,
        tier: 'comum',
        behaviorType: 'melee',
        aiState: 'idle',
        aiConfig: {} as any,
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 100, y: 200 },
        patrolTimer: 0
      };

      worldState.addCreature(creature);
      worldState.updateCreature('wild-1', { currentHp: 50, x: 150 });

      const updated = worldState.getCreature('wild-1');
      expect(updated?.currentHp).toBe(50);
      expect(updated?.x).toBe(150);
      expect(updated?.y).toBe(200); // Não modificado
    });

    it('should remove a creature', () => {
      const creature: CreatureState = {
        id: 'wild-1',
        x: 100,
        y: 200,
        currentHp: 100,
        maxHp: 100,
        tier: 'comum',
        behaviorType: 'melee',
        aiState: 'idle',
        aiConfig: {} as any,
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 100, y: 200 },
        patrolTimer: 0
      };

      worldState.addCreature(creature);
      expect(worldState.creatures.size).toBe(1);

      worldState.removeCreature('wild-1');
      expect(worldState.creatures.size).toBe(0);
      expect(worldState.getCreature('wild-1')).toBeUndefined();
    });

    it('should get all creatures', () => {
      const creature1: CreatureState = {
        id: 'wild-1',
        x: 100,
        y: 200,
        currentHp: 100,
        maxHp: 100,
        tier: 'comum',
        behaviorType: 'melee',
        aiState: 'idle',
        aiConfig: {} as any,
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 100, y: 200 },
        patrolTimer: 0
      };

      const creature2: CreatureState = {
        id: 'wild-2',
        x: 300,
        y: 400,
        currentHp: 80,
        maxHp: 120,
        tier: 'perigosa',
        behaviorType: 'ranged',
        aiState: 'chasing',
        aiConfig: {} as any,
        attackCooldownRemaining: 1,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 300, y: 400 },
        patrolTimer: 0
      };

      worldState.addCreature(creature1);
      worldState.addCreature(creature2);

      const all = worldState.getAllCreatures();
      expect(all).toHaveLength(2);
      expect(all.some(c => c.id === 'wild-1')).toBe(true);
      expect(all.some(c => c.id === 'wild-2')).toBe(true);
    });

    it('should clear all creatures', () => {
      const creature: CreatureState = {
        id: 'wild-1',
        x: 100,
        y: 200,
        currentHp: 100,
        maxHp: 100,
        tier: 'comum',
        behaviorType: 'melee',
        aiState: 'idle',
        aiConfig: {} as any,
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 100, y: 200 },
        patrolTimer: 0
      };

      worldState.addCreature(creature);
      expect(worldState.creatures.size).toBe(1);

      worldState.clear();
      expect(worldState.creatures.size).toBe(0);
    });
  });

  describe('Resource Management', () => {
    it('should add a resource', () => {
      const resource: ResourceState = {
        id: 'res-1',
        type: 'ferro-cristalino',
        resourceType: 'ferro-cristalino',
        x: 150,
        y: 250,
        amount: 5,
        quantity: 5,
        isRare: false,
        size: 10,
        color: 0x9ca3af,
        borderColor: 0x92400e,
        borderWidth: 1
      };

      worldState.addResource(resource);

      expect(worldState.resources.size).toBe(1);
      expect(worldState.getResource('res-1')).toEqual(resource);
    });

    it('should update a resource', () => {
      const resource: ResourceState = {
        id: 'res-1',
        type: 'ferro-cristalino',
        resourceType: 'ferro-cristalino',
        x: 150,
        y: 250,
        amount: 5,
        quantity: 5,
        isRare: false,
        size: 10,
        color: 0x9ca3af,
        borderColor: 0x92400e,
        borderWidth: 1
      };

      worldState.addResource(resource);
      worldState.updateResource('res-1', { amount: 3, quantity: 3 });

      const updated = worldState.getResource('res-1');
      expect(updated?.amount).toBe(3);
      expect(updated?.quantity).toBe(3);
    });

    it('should remove a resource', () => {
      const resource: ResourceState = {
        id: 'res-1',
        type: 'ferro-cristalino',
        resourceType: 'ferro-cristalino',
        x: 150,
        y: 250,
        amount: 5,
        quantity: 5,
        isRare: false,
        size: 10,
        color: 0x9ca3af,
        borderColor: 0x92400e,
        borderWidth: 1
      };

      worldState.addResource(resource);
      worldState.removeResource('res-1');

      expect(worldState.resources.size).toBe(0);
      expect(worldState.getResource('res-1')).toBeUndefined();
    });
    
    it('should handle rare resources with larger size', () => {
      const rareResource: ResourceState = {
        id: 'res-rare-1',
        type: 'cristal-energia',
        resourceType: 'cristal-energia',
        x: 200,
        y: 300,
        amount: 3,
        quantity: 3,
        isRare: true,
        size: 14, // Recursos raros são maiores
        color: 0x8b5cf6,
        borderColor: 0x92400e,
        borderWidth: 2 // Borda mais grossa
      };

      worldState.addResource(rareResource);
      const retrieved = worldState.getResource('res-rare-1');

      expect(retrieved?.isRare).toBe(true);
      expect(retrieved?.size).toBe(14);
      expect(retrieved?.borderWidth).toBe(2);
    });

    it('should get all resources', () => {
      const resource1: ResourceState = {
        id: 'res-1',
        type: 'ferro-cristalino',
        resourceType: 'ferro-cristalino',
        x: 150,
        y: 250,
        amount: 5,
        quantity: 5,
        isRare: false,
        size: 10,
        color: 0x9ca3af,
        borderColor: 0x92400e,
        borderWidth: 1
      };

      const resource2: ResourceState = {
        id: 'res-2',
        type: 'cristal-energia',
        resourceType: 'cristal-energia',
        x: 200,
        y: 300,
        amount: 3,
        quantity: 3,
        isRare: true,
        size: 14,
        color: 0x8b5cf6,
        borderColor: 0x92400e,
        borderWidth: 2
      };

      worldState.addResource(resource1);
      worldState.addResource(resource2);

      const all = worldState.getAllResources();
      expect(all).toHaveLength(2);
      expect(all.some(r => r.id === 'res-1')).toBe(true);
      expect(all.some(r => r.id === 'res-2')).toBe(true);
    });
  });
});

describe('RemoteWorldState', () => {
  let worldState: RemoteWorldState;
  let stateChanges: Array<{ type: string; action: string; id: string }>;

  beforeEach(() => {
    worldState = new RemoteWorldState();
    stateChanges = [];

    // Setup callback para capturar mudanças
    worldState.setOnStateChange((type, action, id) => {
      stateChanges.push({ type, action, id });
    });
  });

  describe('State Change Notifications', () => {
    it('should notify when creature is added', () => {
      const creature: CreatureState = {
        id: 'wild-1',
        x: 100,
        y: 200,
        currentHp: 100,
        maxHp: 100,
        tier: 'comum',
        behaviorType: 'melee',
        aiState: 'idle',
        aiConfig: {} as any,
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 100, y: 200 },
        patrolTimer: 0
      };

      worldState.addCreature(creature);

      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0]).toEqual({
        type: 'creature',
        action: 'add',
        id: 'wild-1'
      });
    });

    it('should notify when creature is updated', () => {
      const creature: CreatureState = {
        id: 'wild-1',
        x: 100,
        y: 200,
        currentHp: 100,
        maxHp: 100,
        tier: 'comum',
        behaviorType: 'melee',
        aiState: 'idle',
        aiConfig: {} as any,
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 100, y: 200 },
        patrolTimer: 0
      };

      worldState.addCreature(creature);
      stateChanges = []; // Reset

      worldState.updateCreature('wild-1', { currentHp: 50 });

      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0]).toEqual({
        type: 'creature',
        action: 'update',
        id: 'wild-1'
      });
    });

    it('should notify when creature is removed', () => {
      const creature: CreatureState = {
        id: 'wild-1',
        x: 100,
        y: 200,
        currentHp: 100,
        maxHp: 100,
        tier: 'comum',
        behaviorType: 'melee',
        aiState: 'idle',
        aiConfig: {} as any,
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 100, y: 200 },
        patrolTimer: 0
      };

      worldState.addCreature(creature);
      stateChanges = []; // Reset

      worldState.removeCreature('wild-1');

      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0]).toEqual({
        type: 'creature',
        action: 'remove',
        id: 'wild-1'
      });
    });

    it('should not notify when removing non-existent creature', () => {
      worldState.removeCreature('non-existent');
      expect(stateChanges).toHaveLength(0);
    });
  });

  describe('Synchronization Scenarios', () => {
    it('should handle server creature spawn', () => {
      // Simula servidor enviando nova criatura
      const serverCreature: CreatureState = {
        id: 'wild-server-1',
        x: 500,
        y: 600,
        currentHp: 120,
        maxHp: 120,
        tier: 'elite',
        behaviorType: 'ranged',
        aiState: 'idle',
        aiConfig: {} as any,
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 500, y: 600 },
        patrolTimer: 0
      };

      worldState.addCreature(serverCreature);

      expect(worldState.getCreature('wild-server-1')).toEqual(serverCreature);
      expect(stateChanges[0].action).toBe('add');
    });

    it('should handle server damage update', () => {
      const creature: CreatureState = {
        id: 'wild-1',
        x: 100,
        y: 200,
        currentHp: 100,
        maxHp: 100,
        tier: 'comum',
        behaviorType: 'melee',
        aiState: 'idle',
        aiConfig: {} as any,
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 100, y: 200 },
        patrolTimer: 0
      };

      worldState.addCreature(creature);

      // Simula servidor enviando HP atualizado
      worldState.updateCreature('wild-1', { 
        currentHp: 70,
        aiState: 'chasing'
      });

      const updated = worldState.getCreature('wild-1');
      expect(updated?.currentHp).toBe(70);
      expect(updated?.aiState).toBe('chasing');
    });

    it('should handle server creature death', () => {
      const creature: CreatureState = {
        id: 'wild-1',
        x: 100,
        y: 200,
        currentHp: 100,
        maxHp: 100,
        tier: 'comum',
        behaviorType: 'melee',
        aiState: 'idle',
        aiConfig: {} as any,
        attackCooldownRemaining: 0,
        windupTimer: 0,
        stunTimer: 0,
        patrolOrigin: { x: 100, y: 200 },
        patrolTimer: 0
      };

      worldState.addCreature(creature);
      worldState.removeCreature('wild-1');

      expect(worldState.getCreature('wild-1')).toBeUndefined();
      expect(stateChanges.some(c => c.action === 'remove')).toBe(true);
    });
  });
});

describe('Player Management (Fase 4C)', () => {
  let worldState: LocalWorldState;

  beforeEach(() => {
    worldState = new LocalWorldState();
  });

  it('should add a player', () => {
    const player: PlayerState = {
      id: 'player-1',
      name: 'TestPlayer',
      x: 500,
      y: 500,
      hp: 100,
      maxHp: 100,
      lastUpdate: Date.now(),
      color: 0x00ffff,
      radius: 12,
      actionType: 'idle',
      actionTimer: 0,
      isVisible: true
    };

    worldState.addPlayer(player);

    expect(worldState.players.size).toBe(1);
    expect(worldState.getPlayer('player-1')).toEqual(player);
  });

  it('should update a player', () => {
    const player: PlayerState = {
      id: 'player-1',
      name: 'TestPlayer',
      x: 500,
      y: 500,
      hp: 100,
      maxHp: 100,
      lastUpdate: Date.now(),
      color: 0x00ffff,
      radius: 12,
      actionType: 'idle',
      actionTimer: 0,
      isVisible: true
    };

    worldState.addPlayer(player);
    worldState.updatePlayer('player-1', { 
      x: 550, 
      hp: 80, 
      actionType: 'attacking',
      actionTimer: 2
    });

    const updated = worldState.getPlayer('player-1');
    expect(updated?.x).toBe(550);
    expect(updated?.hp).toBe(80);
    expect(updated?.actionType).toBe('attacking');
    expect(updated?.actionTimer).toBe(2);
    expect(updated?.y).toBe(500); // Não modificado
  });

  it('should remove a player', () => {
    const player: PlayerState = {
      id: 'player-1',
      name: 'TestPlayer',
      x: 500,
      y: 500,
      hp: 100,
      maxHp: 100,
      lastUpdate: Date.now(),
      color: 0x00ffff,
      radius: 12,
      actionType: 'idle',
      actionTimer: 0,
      isVisible: true
    };

    worldState.addPlayer(player);
    expect(worldState.players.size).toBe(1);

    worldState.removePlayer('player-1');
    expect(worldState.players.size).toBe(0);
    expect(worldState.getPlayer('player-1')).toBeUndefined();
  });

  it('should get all players', () => {
    const player1: PlayerState = {
      id: 'player-1',
      name: 'Player1',
      x: 100,
      y: 200,
      hp: 100,
      maxHp: 100,
      lastUpdate: Date.now(),
      color: 0x00ffff,
      radius: 12,
      actionType: 'idle',
      actionTimer: 0,
      isVisible: true
    };

    const player2: PlayerState = {
      id: 'player-2',
      name: 'Player2',
      x: 300,
      y: 400,
      hp: 80,
      maxHp: 100,
      lastUpdate: Date.now(),
      color: 0x00ffff,
      radius: 12,
      actionType: 'extracting',
      actionTimer: 5,
      isVisible: true
    };

    worldState.addPlayer(player1);
    worldState.addPlayer(player2);

    const all = worldState.getAllPlayers();
    expect(all).toHaveLength(2);
    expect(all.some(p => p.id === 'player-1')).toBe(true);
    expect(all.some(p => p.id === 'player-2')).toBe(true);
  });

  it('should handle player action states', () => {
    const player: PlayerState = {
      id: 'player-1',
      name: 'TestPlayer',
      x: 500,
      y: 500,
      hp: 100,
      maxHp: 100,
      lastUpdate: Date.now(),
      color: 0x00ffff,
      radius: 12,
      actionType: 'idle',
      actionTimer: 0,
      isVisible: true
    };

    worldState.addPlayer(player);

    // Simula início de ataque
    worldState.updatePlayer('player-1', { actionType: 'attacking', actionTimer: 1.5 });
    let updated = worldState.getPlayer('player-1');
    expect(updated?.actionType).toBe('attacking');
    expect(updated?.actionTimer).toBe(1.5);

    // Simula fim de ação
    worldState.updatePlayer('player-1', { actionType: 'idle', actionTimer: 0 });
    updated = worldState.getPlayer('player-1');
    expect(updated?.actionType).toBe('idle');
    expect(updated?.actionTimer).toBe(0);
  });

  it('should handle player visibility culling', () => {
    const player: PlayerState = {
      id: 'player-1',
      name: 'TestPlayer',
      x: 500,
      y: 500,
      hp: 100,
      maxHp: 100,
      lastUpdate: Date.now(),
      color: 0x00ffff,
      radius: 12,
      actionType: 'idle',
      actionTimer: 0,
      isVisible: true
    };

    worldState.addPlayer(player);

    // Simula jogador saindo do range de visão
    worldState.updatePlayer('player-1', { isVisible: false });
    let updated = worldState.getPlayer('player-1');
    expect(updated?.isVisible).toBe(false);

    // Simula jogador voltando ao range
    worldState.updatePlayer('player-1', { isVisible: true });
    updated = worldState.getPlayer('player-1');
    expect(updated?.isVisible).toBe(true);
  });

  it('should clear all players', () => {
    const player: PlayerState = {
      id: 'player-1',
      name: 'TestPlayer',
      x: 500,
      y: 500,
      hp: 100,
      maxHp: 100,
      lastUpdate: Date.now(),
      color: 0x00ffff,
      radius: 12,
      actionType: 'idle',
      actionTimer: 0,
      isVisible: true
    };

    worldState.addPlayer(player);
    expect(worldState.players.size).toBe(1);

    worldState.clear();
    expect(worldState.players.size).toBe(0);
  });
});

describe('GameWorldState Interface Compliance', () => {
  it('LocalWorldState should comply with GameWorldState interface', () => {
    const worldState = new LocalWorldState();

    // Verifica que possui todas as coleções
    expect(worldState.creatures).toBeDefined();
    expect(worldState.resources).toBeDefined();
    expect(worldState.players).toBeDefined();
    expect(worldState.extractionPoints).toBeDefined();

    // Verifica métodos de criatura
    expect(typeof worldState.getCreature).toBe('function');
    expect(typeof worldState.updateCreature).toBe('function');
    expect(typeof worldState.addCreature).toBe('function');
    expect(typeof worldState.removeCreature).toBe('function');
    expect(typeof worldState.getAllCreatures).toBe('function');
    
    // FASE 4C: Verifica métodos de jogador
    expect(typeof worldState.getPlayer).toBe('function');
    expect(typeof worldState.updatePlayer).toBe('function');
    expect(typeof worldState.addPlayer).toBe('function');
    expect(typeof worldState.removePlayer).toBe('function');
    expect(typeof worldState.getAllPlayers).toBe('function');

    // Verifica método clear
    expect(typeof worldState.clear).toBe('function');
  });

  it('RemoteWorldState should comply with GameWorldState interface', () => {
    const worldState = new RemoteWorldState();

    // Verifica que possui todas as coleções
    expect(worldState.creatures).toBeDefined();
    expect(worldState.resources).toBeDefined();
    expect(worldState.players).toBeDefined();
    expect(worldState.extractionPoints).toBeDefined();

    // Verifica métodos de criatura
    expect(typeof worldState.getCreature).toBe('function');
    expect(typeof worldState.updateCreature).toBe('function');
    expect(typeof worldState.addCreature).toBe('function');
    expect(typeof worldState.removeCreature).toBe('function');
    expect(typeof worldState.getAllCreatures).toBe('function');
    
    // FASE 4C: Verifica métodos de jogador
    expect(typeof worldState.getPlayer).toBe('function');
    expect(typeof worldState.updatePlayer).toBe('function');
    expect(typeof worldState.addPlayer).toBe('function');
    expect(typeof worldState.removePlayer).toBe('function');
    expect(typeof worldState.getAllPlayers).toBe('function');

    // Verifica método clear
    expect(typeof worldState.clear).toBe('function');
  });
});
