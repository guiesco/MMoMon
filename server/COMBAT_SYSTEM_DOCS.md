# Sistema de Combate Server-Side - Documentação

## Visão Geral

O sistema de combate foi implementado completamente no servidor para garantir que toda a lógica de jogo seja authoritative e livre de trapaças. O cliente apenas envia **intents** de ataque e recebe **resultados** do servidor.

## Arquitetura

```
Cliente                    Servidor
   │                          │
   │──[attack_basic]─────────►│
   │  {targetX, targetY}       │
   │                          │
   │                    [Validação]
   │                     - Cooldown?
   │                     - Jogador vivo?
   │                     - Coords válidas?
   │                          │
   │                   [Criar Projétil]
   │                     - Calcular direção
   │                     - Adicionar ao worldState
   │                          │
   │◄─[attack_result]─────────│
   │  {projectileId, damage}   │
   │                          │
```

## Arquivos do Sistema

### `server/src/constants.ts`
Contém todas as configurações de balanceamento:

- **`COMBAT_CONFIG`**: Dano base, velocidade de projéteis, cooldowns
- **`ENEMY_AI_CONFIG`**: Configurações de IA por tier (comum, perigosa, elite) e tipo (melee, ranged)
- **`THREAT_TIERS`**: HP base, dano de contato, multiplicadores de velocidade

### `server/src/systems/combat.ts`
Implementa toda a lógica de combate:

#### Funções Principais

1. **`processAttackIntent(room, playerId, targetX, targetY, currentTime): AttackResult`**
   - Valida se o jogador pode atacar (cooldown, vivo, coords válidas)
   - Cria um projétil no worldState
   - Retorna resultado para broadcast

2. **`updateProjectiles(room, deltaTime): DamageResult[]`**
   - Move todos os projéteis baseado em velocidade
   - Detecta colisões com criaturas (projéteis de jogador) ou jogadores (projéteis de criatura)
   - Aplica dano em caso de hit
   - Remove projéteis expirados ou que colidiram
   - Retorna lista de resultados de dano

3. **`applyDamageToCreature(creature, damage, attackerId): DamageResult`**
   - Reduz HP da criatura
   - Verifica morte e marca para remoção
   - Retorna resultado para broadcast

4. **`applyDamageToPlayer(playerId, player, damage, attackerId): DamageResult`**
   - Reduz HP do jogador
   - Verifica morte e marca como morto
   - Retorna resultado para broadcast

5. **`updateCreatureAI(room, deltaTime): void`**
   - Atualiza estado de IA de cada criatura
   - Move criaturas em direção a jogadores próximos
   - Dispara ataques de criaturas (melee ou ranged)

### `server/src/gameLoop.ts`
Integra o sistema de combate no loop principal:

- **`processIntent()`**: Processa intents de ataque da fila
- **`updateWorld()`**: Chama `updateProjectiles()` e `updateCreatureAI()` a cada tick
- **Callbacks**: `onDamageApplied`, `onPlayerDeath` para broadcast de eventos

## Fórmulas de Dano

### Dano de Projétil de Jogador

```typescript
DANO_BASE = COMBAT_CONFIG.projectileDamage = 20

DANO_FINAL = DANO_BASE
```

**MVP**: Dano fixo de 20 por projétil.

**Futuro**: Pode incluir multiplicadores baseados em:
- Stats da criatura ativa do jogador
- Bônus de equipamentos
- Críticos (chance baseada em stats)
- Resistências elementais da criatura alvo

### Dano de Criatura (Melee)

```typescript
DANO = ENEMY_AI_CONFIG[tier][melee].attackDamage

Tiers:
- comum: 8 de dano
- perigosa: 14 de dano
- elite: 22 de dano
```

Aplicado instantaneamente quando criatura ataca em alcance.

### Dano de Criatura (Ranged)

```typescript
DANO = ENEMY_AI_CONFIG[tier][ranged].attackDamage

Tiers:
- comum: 6 de dano
- perigosa: 10 de dano
- elite: 16 de dano
```

Aplicado via projétil quando colide com jogador.

### Dano de Contato

```typescript
DANO_POR_SEGUNDO = THREAT_TIERS[tier].contactDamagePerSecond

Tiers:
- comum: 6 HP/s
- perigosa: 12 HP/s
- elite: 20 HP/s

TICK_INTERVAL = COMBAT_CONFIG.contactDamageTickSeconds = 0.25s
DANO_POR_TICK = DANO_POR_SEGUNDO * TICK_INTERVAL
```

**Exemplo**:
- Criatura **perigosa** causa 12 HP/s de contato
- Em tick de 0.25s: 12 * 0.25 = **3 HP por tick**

## Parâmetros Configuráveis

### Jogador

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `projectileSpeed` | 420 px/s | Velocidade do projétil de ataque básico |
| `projectileDamage` | 20 | Dano causado por projétil em criaturas |
| `projectileLifetime` | 1.2s | Tempo de vida do projétil antes de desaparecer |
| `attackCooldown` | 0.5s | Tempo mínimo entre ataques |

### Criaturas - Comum

#### Melee
| Parâmetro | Valor |
|-----------|-------|
| HP Base | 60 |
| Velocidade | 100 px/s |
| Alcance Detecção | 180 px |
| Alcance Ataque | 30 px |
| Dano Ataque | 8 |
| Cooldown Ataque | 1.5s |

#### Ranged
| Parâmetro | Valor |
|-----------|-------|
| HP Base | 60 |
| Velocidade | 70 px/s |
| Alcance Detecção | 220 px |
| Alcance Ataque | 160 px |
| Dano Ataque | 6 |
| Cooldown Ataque | 2.0s |
| Velocidade Projétil | 200 px/s |
| Distância Preferida | 120 px |

### Criaturas - Perigosa

#### Melee
| Parâmetro | Valor |
|-----------|-------|
| HP Base | 90 |
| Velocidade | 130 px/s |
| Alcance Detecção | 220 px |
| Alcance Ataque | 35 px |
| Dano Ataque | 14 |
| Cooldown Ataque | 1.2s |

#### Ranged
| Parâmetro | Valor |
|-----------|-------|
| HP Base | 90 |
| Velocidade | 90 px/s |
| Alcance Detecção | 260 px |
| Alcance Ataque | 200 px |
| Dano Ataque | 10 |
| Cooldown Ataque | 1.6s |
| Velocidade Projétil | 250 px/s |
| Distância Preferida | 150 px |

### Criaturas - Elite

#### Melee
| Parâmetro | Valor |
|-----------|-------|
| HP Base | 130 |
| Velocidade | 160 px/s |
| Alcance Detecção | 280 px |
| Alcance Ataque | 45 px |
| Dano Ataque | 22 |
| Cooldown Ataque | 1.0s |

#### Ranged
| Parâmetro | Valor |
|-----------|-------|
| HP Base | 130 |
| Velocidade | 110 px/s |
| Alcance Detecção | 320 px |
| Alcance Ataque | 240 px |
| Dano Ataque | 16 |
| Cooldown Ataque | 1.3s |
| Velocidade Projétil | 300 px/s |
| Distância Preferida | 180 px |

## Detecção de Colisões

### Projétil vs Criatura

```typescript
PROJECTILE_RADIUS = 4 px
CREATURE_RADIUS = 12 px
COLLISION_DISTANCE = PROJECTILE_RADIUS + CREATURE_RADIUS = 16 px

if (distance(projectile, creature) <= COLLISION_DISTANCE) {
  // HIT!
}
```

### Projétil vs Jogador

```typescript
PROJECTILE_RADIUS = 4 px
PLAYER_RADIUS = 8 px
COLLISION_DISTANCE = PROJECTILE_RADIUS + PLAYER_RADIUS = 12 px

if (distance(projectile, player) <= COLLISION_DISTANCE) {
  // HIT!
}
```

## Estados de IA

Cada criatura pode estar em um dos seguintes estados:

| Estado | Descrição |
|--------|-----------|
| `idle` | Parada ou patrulhando levemente na origem |
| `chasing` | Perseguindo um jogador detectado |
| `attacking` | Executando ataque (melee ou disparando projétil) |
| `retreating` | Recuando do jogador (apenas ranged quando muito perto) |
| `stunned` | Atordoado temporariamente (após levar dano crítico - não implementado no MVP) |

## Comportamento de IA

### Melee

1. **Idle**: Fora do alcance de detecção
   - Retorna lentamente à origem de patrulha
   
2. **Chasing**: Jogador detectado mas fora de alcance de ataque
   - Move em direção ao jogador mais próximo
   - Velocidade: `config.moveSpeed`
   
3. **Attacking**: Jogador em alcance de ataque e cooldown zerado
   - Aplica dano instantâneo ao jogador
   - Entra em cooldown

### Ranged

1. **Idle**: Fora do alcance de detecção
   - Retorna lentamente à origem de patrulha
   
2. **Retreating**: Jogador muito perto (< 70% da distância preferida)
   - Move para longe do jogador
   
3. **Attacking**: Jogador em alcance e cooldown zerado
   - Dispara projétil em direção ao jogador
   - Entra em cooldown
   
4. **Chasing**: Jogador longe demais (> 130% da distância preferida)
   - Move em direção ao jogador para manter distância ideal

## Mensagens WebSocket

### Cliente → Servidor

```json
{
  "type": "attack_basic",
  "targetX": 500.0,
  "targetY": 300.0
}
```

### Servidor → Cliente

#### Resultado de Ataque

```json
{
  "type": "attack_result",
  "attackerId": "player-1",
  "targetId": "wild-3",
  "damage": 20,
  "targetHp": 40,
  "targetMaxHp": 60,
  "targetDestroyed": false
}
```

#### Morte de Jogador

```json
{
  "type": "player_death",
  "playerId": "player-1",
  "reason": "creature_attack",
  "killedBy": "wild-5"
}
```

## Testes

### Teste 1: Ataque Básico de Jogador

```typescript
// Setup
const room: CombatRoomState = {
  players: new Map([
    ["player-1", { id: "player-1", x: 100, y: 100, hp: 100, maxHp: 100, lastAttackTime: 0, isDead: false }]
  ]),
  creatures: [
    { id: "wild-1", x: 200, y: 100, currentHp: 60, maxHp: 60, tier: "comum", behaviorType: "melee", ... }
  ],
  projectiles: []
};

// Teste
const result = processAttackIntent(room, "player-1", 200, 100, Date.now());

// Validação
assert(result.success === true);
assert(room.projectiles.length === 1);
assert(room.projectiles[0].damage === 20);
```

### Teste 2: Colisão de Projétil com Criatura

```typescript
// Setup (projétil já existe e está próximo da criatura)
room.projectiles = [
  { id: "proj-1", x: 195, y: 100, velocityX: 420, velocityY: 0, damage: 20, lifetime: 1.0, ... }
];

// Teste (simular 1 tick = 0.05s)
const damageResults = updateProjectiles(room, 0.05);

// Validação
assert(damageResults.length === 1);
assert(damageResults[0].targetId === "wild-1");
assert(damageResults[0].damage === 20);
assert(room.creatures[0].currentHp === 40); // 60 - 20
assert(room.projectiles.length === 0); // Projétil removido após colisão
```

### Teste 3: IA de Criatura Melee

```typescript
// Setup (criatura comum melee perto do jogador)
const creature = room.creatures[0];
creature.x = 150;
creature.y = 100;
creature.behaviorType = "melee";
creature.tier = "comum";

// Teste (simular 1 tick = 0.05s)
updateCreatureAI(room, 0.05);

// Validação
assert(creature.aiState === "chasing"); // Detectou jogador mas ainda fora de alcance
assert(creature.x > 150); // Moveu em direção ao jogador
```

## Ajustes de Balanceamento

Para ajustar o balanceamento do combate, edite os valores em `server/src/constants.ts`:

### Aumentar dificuldade:
- ↑ `ENEMY_AI_CONFIG[tier].attackDamage`
- ↑ `ENEMY_AI_CONFIG[tier].moveSpeed`
- ↓ `ENEMY_AI_CONFIG[tier].attackCooldown`
- ↑ `THREAT_TIERS[tier].baseHp`

### Diminuir dificuldade:
- ↑ `COMBAT_CONFIG.projectileDamage`
- ↓ `ENEMY_AI_CONFIG[tier].attackDamage`
- ↓ `ENEMY_AI_CONFIG[tier].moveSpeed`
- ↑ `ENEMY_AI_CONFIG[tier].attackCooldown`

## Próximos Passos

### Melhorias Planejadas

1. **Sistema de Críticos**
   - Chance de crítico baseada em stats da criatura do jogador
   - Multiplicador de 1.5x~2.0x no dano

2. **Resistências Elementais**
   - Criaturas de água levam mais dano de elétrico
   - Criaturas de fogo resistem a ataques de fogo

3. **Ataque Especial/Habilidades**
   - Cada criatura tem habilidade única
   - Cooldown separado do ataque básico

4. **Knockback e Stun**
   - Projéteis aplicam knockback leve
   - Dano crítico aplica stun temporário

5. **Detecção de Morte por PvP**
   - Rastrear quem matou quem para ranking/recompensas
   - Penalidades/recompensas por PvP

## Conclusão

O sistema de combate server-side está implementado e funcional, garantindo:

✅ **Server-Authoritative**: Toda lógica de dano e colisão no servidor
✅ **Anti-Cheat**: Cliente não pode manipular HP, dano ou cooldowns
✅ **IA de Criaturas**: Comportamento melee e ranged implementado
✅ **Projéteis**: Sistema completo de projéteis de jogadores e criaturas
✅ **Configurável**: Todos os parâmetros centralizados em constants.ts
✅ **Escalável**: Fácil adicionar novos tipos de ataque e comportamentos

O próximo passo é implementar o cliente para consumir esses eventos e renderizar os resultados de combate visualmente.
