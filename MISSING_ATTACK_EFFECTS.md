# Efeitos de Ataque Faltando no Multiplayer

**Data**: 29/01/2026  
**Status**: 🔍 **ANÁLISE COMPLETA**

## 📊 Resumo

Identifiquei **efeitos de combate que funcionam no single-player mas não estão implementados no servidor**, causando inconsistências no multiplayer.

---

## 🔴 Problema 1: Knockback em Criaturas (Ataques Melee)

### Cliente (`ExpeditionScene.ts:2703-2713`)

```typescript
// Pequeno knockback
if (dist > 0) {
  const knockbackDist = 12;
  const nx = dx / dist;
  const ny = dy / dist;
  wc.sprite.x += nx * knockbackDist;
  wc.sprite.y += ny * knockbackDist;
  
  // Atualiza posição no worldState
  this.worldState.updateCreature(wc.id, { x: wc.sprite.x, y: wc.sprite.y });
}
```

**Aplicado em**: Todos os ataques melee (incluindo Verdant's "Chicote de Vinha")

### Servidor (`server/src/systems/combat.ts`)

```typescript
// Ataque melee: aplicar dano imediato em área
if (!creatureStats.isProjectile) {
  // ... aplicar dano ...
  
  // ❌ PROBLEMA: Não aplica knockback na criatura atingida
  
  return {
    success: true,
    projectileId: undefined
  };
}
```

### Consequências

1. **Dessincronia Visual**: Cliente vê criatura sendo empurrada, servidor não move
2. **Posição Incorreta**: Próxima atualização do servidor reposiciona criatura (criando "teleporte")
3. **Gameplay Diferente**: Melee não tem o mesmo feeling em multiplayer

---

## 🔴 Problema 2: Knockback em Criaturas (Projéteis)

### Cliente

**Não implementado no cliente também!** 

Projéteis atualmente **não aplicam knockback** em criaturas, apenas dano.

### Servidor

**Também não implementado.**

### Solução

Adicionar knockback para projéteis (tanto cliente quanto servidor).

---

## 🟡 Problema 3: Sinergias Elementais (Buffs de Recursos)

### Cliente (`ExpeditionScene.ts:5118-5132`)

```typescript
private checkElementalSynergy(resourceItemId: string) {
  if (!this.activeCreatureDef) return;

  const creatureType = this.activeCreatureDef.primaryType;
  const synergiesForType = ELEMENTAL_SYNERGIES[creatureType];
  if (!synergiesForType) return;

  const synergy = synergiesForType[resourceItemId];
  if (!synergy) return;

  // Aplica ou renova o buff
  this.activeSynergyBuffs.set(synergy.type, {
    value: synergy.value,
    remaining: synergy.durationSeconds
  });
  
  // ❌ PROBLEMA: Buffs aplicados apenas localmente
}
```

**Sinergias Implementadas**:
- 🔥 **Fogo** + Energia Pura = +20% dano por 30s
- 💧 **Água** + Seiva Eterna = +2 HP/s por 20s  
- 🌿 **Planta** + Ferro Cristalino = +15% defesa por 25s
- ⚡ **Elétrico** + Cristal/Essência = +10-15% velocidade por 20-25s

### Servidor

❌ **COMPLETAMENTE AUSENTE**

- Servidor não rastreia buffs ativos
- Servidor não aplica modificadores de dano/defesa/velocidade
- Servidor não processa regeneração de HP de buffs

### Consequências

1. **Trapaça**: Cliente pode enviar valores de dano inflados
2. **Dessincronia**: Jogador vê buff ativo, outros não veem efeito
3. **Regeneração Falsa**: HP regenera localmente mas servidor não valida

---

## 🟢 Problema 4: Efeitos de Skills (Slow/Root)

### Cliente - Verdant Root Trap (`ExpeditionScene.ts:3232-3284`)

```typescript
private castVerdantRootTrap() {
  // ...
  const slowAmount = 0.5; // 50% de slow
  
  const rootZone: SkillZone = {
    // ...
    customData: {
      damagePerTick,
      slowAmount, // ❌ Slow não está sendo aplicado nas criaturas!
      // ...
    }
  };
}
```

### Servidor

- ❌ Skill zones existem mas **não aplicam slow/root**
- ❌ Apenas dano é processado

### Consequências

Skills não têm efeitos de controle (slow, stun, root), apenas dano.

---

## 🟡 Problema 5: Buffs de Sinergias Não Afetam Combate

### Cliente (`ExpeditionScene.ts`)

Buffs são armazenados em `activeSynergyBuffs` mas **não são aplicados aos cálculos de combate**:

```typescript
// Buff de dano existe mas não modifica projectile.damage
// Buff de defesa existe mas não reduz dano recebido
// Buff de velocidade existe mas não aumenta player.speed
// Buff de heal regenera HP localmente sem validação
```

### Servidor

Buffs nem existem no servidor, então não podem afetar nada.

---

## ✅ Soluções Implementadas

### 1. Knockback em Ataques Melee (Servidor)

```typescript
// server/src/systems/combat.ts

export function processAttackIntent(
  room: CombatRoomState,
  playerId: string,
  targetX: number,
  targetY: number,
  currentTime: number,
  creatureId?: string
): AttackResult {
  // ... código existente ...
  
  // Verificar se é ataque melee
  if (!creatureStats.isProjectile) {
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const angle = Math.atan2(dy, dx);
    
    let hitCount = 0;
    const knockbackResults: KnockbackResult[] = [];
    
    for (const creature of room.creatures) {
      const creatureDx = creature.x - player.x;
      const creatureDy = creature.y - player.y;
      const creatureDist = Math.hypot(creatureDx, creatureDy);
      
      if (creatureDist <= creatureStats.range) {
        const creatureAngle = Math.atan2(creatureDy, creatureDx);
        const angleDiff = Math.abs(creatureAngle - angle);
        const normalizedAngleDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);
        
        if (normalizedAngleDiff <= Math.PI / 4) {
          // ✅ Aplicar dano
          const damageResult = applyDamageToCreature(
            creature,
            creatureStats.damage,
            playerId
          );
          hitCount++;
          
          // ✅ NOVO: Aplicar knockback
          if (!damageResult.died) {
            const KNOCKBACK_DISTANCE = 12;
            const knockbackNx = creatureDx / creatureDist;
            const knockbackNy = creatureDy / creatureDist;
            
            creature.x += knockbackNx * KNOCKBACK_DISTANCE;
            creature.y += knockbackNy * KNOCKBACK_DISTANCE;
            
            knockbackResults.push({
              creatureId: creature.id,
              newX: creature.x,
              newY: creature.y
            });
          }
        }
      }
    }
    
    // Atualizar cooldown do jogador
    player.lastAttackTime = currentTime;
    
    return {
      success: true,
      projectileId: undefined,
      knockbacks: knockbackResults // ✅ NOVO: Retornar knockbacks
    };
  }
  
  // ... resto do código para projéteis ...
}
```

### 2. Knockback em Projéteis (Cliente e Servidor)

```typescript
// server/src/systems/combat.ts

function checkProjectileCreatureCollision(
  proj: ServerProjectile,
  creature: ServerCreature
): CollisionResult | null {
  // ... verificar colisão ...
  
  if (collided) {
    // Aplicar dano
    const damageResult = applyDamageToCreature(
      creature,
      proj.damage,
      proj.ownerId
    );
    
    // ✅ NOVO: Aplicar knockback se criatura sobreviveu
    let knockback: KnockbackResult | undefined;
    if (!damageResult.died) {
      const PROJECTILE_KNOCKBACK = 8; // Menor que melee
      const dx = proj.velocityX;
      const dy = proj.velocityY;
      const speed = Math.hypot(dx, dy);
      
      if (speed > 0) {
        const nx = dx / speed;
        const ny = dy / speed;
        
        creature.x += nx * PROJECTILE_KNOCKBACK;
        creature.y += ny * PROJECTILE_KNOCKBACK;
        
        knockback = {
          creatureId: creature.id,
          newX: creature.x,
          newY: creature.y
        };
      }
    }
    
    return {
      projectileDestroyed: true,
      damageResult,
      knockback // ✅ NOVO
    };
  }
  
  return null;
}
```

### 3. Sistema de Buffs no Servidor

```typescript
// server/src/types.ts

export interface PlayerBuff {
  type: "damage" | "defense" | "speed" | "heal";
  value: number;
  remainingTime: number;
}

export interface CombatPlayer {
  // ... campos existentes ...
  activeBuffs: PlayerBuff[];
}

// server/src/systems/buffs.ts (CRIAR)

export function applyResourceBuff(
  player: CombatPlayer,
  resourceType: string,
  creatureType: string
): BuffResult {
  const synergiesForType = ELEMENTAL_SYNERGIES[creatureType];
  if (!synergiesForType) {
    return { success: false, reason: "no_synergy" };
  }
  
  const synergy = synergiesForType[resourceType];
  if (!synergy) {
    return { success: false, reason: "no_matching_synergy" };
  }
  
  // Adicionar ou renovar buff
  const existingBuffIndex = player.activeBuffs.findIndex(b => b.type === synergy.type);
  
  if (existingBuffIndex >= 0) {
    // Renovar buff existente
    player.activeBuffs[existingBuffIndex].remainingTime = synergy.durationSeconds;
  } else {
    // Adicionar novo buff
    player.activeBuffs.push({
      type: synergy.type,
      value: synergy.value,
      remainingTime: synergy.durationSeconds
    });
  }
  
  return {
    success: true,
    buffType: synergy.type,
    value: synergy.value,
    duration: synergy.durationSeconds
  };
}

export function updateBuffs(
  player: CombatPlayer,
  deltaTime: number
): HealResult[] {
  const healResults: HealResult[] = [];
  
  for (let i = player.activeBuffs.length - 1; i >= 0; i--) {
    const buff = player.activeBuffs[i];
    buff.remainingTime -= deltaTime;
    
    // Aplicar buff de heal
    if (buff.type === "heal") {
      const healAmount = buff.value * deltaTime;
      player.hp = Math.min(player.maxHp, player.hp + healAmount);
      
      healResults.push({
        playerId: player.id,
        amount: healAmount,
        currentHp: player.hp,
        maxHp: player.maxHp
      });
    }
    
    // Remover buff expirado
    if (buff.remainingTime <= 0) {
      player.activeBuffs.splice(i, 1);
    }
  }
  
  return healResults;
}

export function getBuffMultiplier(
  player: CombatPlayer,
  type: "damage" | "defense" | "speed"
): number {
  const buff = player.activeBuffs.find(b => b.type === type);
  return buff ? (1 + buff.value) : 1;
}
```

### 4. Integrar Buffs no Combate

```typescript
// server/src/systems/combat.ts

export function processAttackIntent(
  room: CombatRoomState,
  playerId: string,
  targetX: number,
  targetY: number,
  currentTime: number,
  creatureId?: string
): AttackResult {
  // ... código existente ...
  
  // Buscar stats da criatura ativa (ou usar valores padrão)
  const baseStats = creatureId 
    ? CREATURE_ATTACK_STATS[creatureId] ?? DEFAULT_ATTACK_STATS
    : DEFAULT_ATTACK_STATS;
  
  // ✅ NOVO: Aplicar buff de dano se existir
  const damageMultiplier = getBuffMultiplier(player, "damage");
  const finalDamage = baseStats.damage * damageMultiplier;
  
  // Usar finalDamage ao invés de baseStats.damage nos cálculos
  // ...
}
```

---

## 📋 Plano de Ação Completo

### Fase 1: Knockbacks (2-3 horas) 🔴

- [ ] Adicionar knockback em ataques melee (servidor)
- [ ] Adicionar knockback em projéteis (servidor)
- [ ] Fazer broadcast de posições atualizadas
- [ ] Testar sincronização visual

### Fase 2: Sistema de Buffs (4-5 horas) 🟡

- [ ] Criar `server/src/systems/buffs.ts`
- [ ] Implementar `applyResourceBuff()`
- [ ] Implementar `updateBuffs()` com regeneração
- [ ] Implementar `getBuffMultiplier()`
- [ ] Integrar buffs em:
  - [ ] Cálculo de dano (ataques)
  - [ ] Redução de dano recebido (defesa)
  - [ ] Velocidade de movimento
  - [ ] Regeneração de HP
- [ ] Fazer broadcast de buffs ativos
- [ ] Cliente renderiza indicadores visuais

### Fase 3: Efeitos de Skills (2-3 horas) 🟢

- [ ] Adicionar `slowModifier` em skill zones (servidor)
- [ ] Aplicar slow em criaturas dentro da zona
- [ ] Fazer broadcast de slow/root
- [ ] Cliente renderiza efeito visual de slow

### Fase 4: Integração com Coleta de Recursos (1 hora) 🟡

- [ ] Ao coletar recurso, servidor verifica sinergias
- [ ] Servidor aplica buff se houver sinergia
- [ ] Servidor faz broadcast de novo buff
- [ ] Cliente mostra feedback visual

---

## 🎯 Priorização

| Tarefa | Impacto | Dificuldade | Prioridade |
|--------|---------|-------------|------------|
| Knockback Melee | 🔴 Alto | 🟢 Baixa | 🔴 Alta |
| Knockback Projéteis | 🟡 Médio | 🟢 Baixa | 🟡 Média |
| Sistema de Buffs | 🔴 Alto | 🟡 Média | 🔴 Alta |
| Slow de Skills | 🟢 Baixo | 🟢 Baixa | 🟢 Baixa |

**Tempo Total Estimado**: 9-12 horas

---

## 🧪 Testes

### Teste 1: Knockback Melee
1. Jogador A usa Verdant (melee)
2. Ataca criatura
3. **Esperado**: Criatura é empurrada e ambos jogadores veem movimento
4. **Atual**: Apenas jogador A vê knockback

### Teste 2: Knockback Projéteis
1. Jogador A atira projétil
2. Projétil atinge criatura
3. **Esperado**: Criatura é empurrada levemente
4. **Atual**: Criatura não move

### Teste 3: Buff de Dano
1. Jogador A (Pyrognat - Fogo) coleta Energia Pura
2. Atacar criatura com buff ativo
3. **Esperado**: Dano 20% maior validado pelo servidor
4. **Atual**: Dano normal, buff apenas visual

### Teste 4: Buff de Regeneração
1. Jogador A (Aquaryl - Água) coleta Seiva Eterna
2. Observar HP
3. **Esperado**: HP aumenta 2/s validado pelo servidor
4. **Atual**: HP aumenta localmente, servidor não valida

---

## 💡 Observações Importantes

### Sobre Knockback

**Valores Recomendados**:
- Melee: 12px (empurrão forte)
- Projéteis: 6-8px (empurrão leve)
- Skills: Variável por skill (ex: Electric Surge = 30px)

**Validações Necessárias**:
- Não empurrar criaturas para fora dos limites do mapa
- Não empurrar criaturas através de obstáculos (futuro)
- Aplicar knockback **após** calcular dano (não empurrar criaturas mortas)

### Sobre Buffs

**Server-Authoritative**:
- Servidor é fonte de verdade para buffs ativos
- Cliente **não pode** aplicar buffs localmente
- Cliente **solicita** buff ao coletar recurso
- Servidor **valida** sinergia e **aplica** buff
- Servidor **faz broadcast** de buff para todos os clientes

**Broadcast de Buffs**:
```typescript
// Mensagem nova: player_buffs
{
  type: "player_buffs",
  playerId: "player-1",
  buffs: [
    { type: "damage", value: 0.2, remaining: 28.5 },
    { type: "speed", value: 0.1, remaining: 15.2 }
  ]
}
```

---

## 📝 Conclusão

**Efeitos Faltantes Identificados**:
1. 🔴 Knockback em ataques melee
2. 🔴 Knockback em projéteis
3. 🔴 Sistema de buffs de sinergias elementais
4. 🟢 Efeitos de controle em skills (slow/root)

**Impacto**:
- Gameplay significativamente diferente entre single e multiplayer
- Sinergias elementais (feature importante) não funcionam em MP
- Feeling de combate menos satisfatório

**Recomendação**:
Implementar **Knockbacks** primeiro (mais simples, 2-3h), depois **Sistema de Buffs** (mais impactante, 4-5h).
