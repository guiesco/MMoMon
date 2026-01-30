# Auditoria: Lógicas Cliente vs Servidor no Multiplayer

**Data**: 29/01/2026  
**Status**: 🔍 **ANÁLISE COMPLETA**

## 📊 Resumo Executivo

Esta auditoria identifica **sistemas de gameplay que rodam no cliente mas não estão completamente implementados no servidor**, criando inconsistências entre single-player e multiplayer.

### Status Atual por Sistema

| Sistema | Cliente | Servidor | Status | Prioridade |
|---------|---------|----------|--------|------------|
| **Combate (Ataques)** | ✅ Completo | ✅ Completo | ✅ OK | - |
| **IA de Criaturas** | ✅ Completo | ✅ Completo | ✅ OK | - |
| **Captura** | ✅ Completo | ✅ Completo | ✅ OK | - |
| **Extração** | ✅ Completo | ✅ Completo | ✅ OK | - |
| **Coleta de Recursos** | ✅ Completo | ⚠️ Parcial | ⚠️ INCONSISTENTE | 🔴 Alta |
| **Dano de Contato** | ✅ Completo | ❌ Ausente | ❌ FALTANDO | 🔴 Alta |
| **Skills (Habilidades)** | ✅ Completo | ⚠️ Parcial | ⚠️ INCONSISTENTE | 🟡 Média |
| **Projéteis do Jogador** | ✅ Completo | ✅ Completo | ✅ OK | - |

---

## 🔴 Problema 1: Coleta de Recursos (INCONSISTENTE)

### Cliente (`ExpeditionScene.ts:4222-4273`)

```typescript
private handleInteractions(dt: number) {
  // FASE 4B: Coleta de recursos usando worldState
  const resourcesToRemove: string[] = [];
  
  for (const resourceSprite of this.getAllResources()) {
    const dx = resourceSprite.sprite.x - this.player.x;
    const dy = resourceSprite.sprite.y - this.player.y;
    const dist = Math.hypot(dx, dy);
    
    // Raio de coleta (aproximadamente 16px)
    if (dist <= 20) {
      const resourceItemId = resourceSprite.resourceType;

      // ⚠️ TODO: Em modo multiplayer, envia intent ao servidor
      if (this.isMultiplayer && this.mpClient) {
        // TODO(multiplayer): Implementar envio de intent de coleta
        // Por enquanto, apenas coleta localmente para prototipagem
      }

      this.resourcesCollected += 1;
      this.telemetry.resourcesCollected += 1;
      const current = this.expeditionResources.get(resourceItemId) ?? 0;
      this.expeditionResources.set(resourceItemId, current + 1);

      // Feedback visual: partículas e texto flutuante
      this.createCollectionFeedback(
        resourceSprite.sprite.x,
        resourceSprite.sprite.y,
        resourceItemId
      );
      
      resourcesToRemove.push(resourceSprite.id);
    }
  }
  
  // ❌ PROBLEMA: Remove localmente sem validação do servidor
  for (const resourceId of resourcesToRemove) {
    this.removeResource(resourceId);
  }
}
```

### Servidor (`server/src/index.ts`)

```typescript
case "resource_interact":
  queueIntent(currentRoom, clientId, createResourceIntent(clientId, msg));
  break;
```

**Handler existe mas:**
- ✅ Servidor recebe intent
- ❌ **Não valida distância** (cliente pode coletar de longe)
- ❌ **Não remove recurso do WorldState**
- ❌ **Não adiciona ao inventário do jogador**
- ❌ **Não faz broadcast de remoção**

### Consequências

1. **Trapaça Possível**: Cliente pode enviar `resource_interact` para qualquer recurso, mesmo distante
2. **Dessincronia**: Recursos coletados por um jogador ainda aparecem para outros
3. **Duplicação**: Múltiplos jogadores podem coletar o mesmo recurso
4. **Inventário Incorreto**: Recursos coletados não são contabilizados no servidor

### Solução Necessária

```typescript
// server/src/systems/resources.ts (CRIAR)
export function processResourceCollection(
  room: ResourceRoomState,
  playerId: string,
  resourceId: string
): ResourceCollectionResult {
  const player = room.players.get(playerId);
  const resource = room.worldState.resources.find(r => r.id === resourceId);
  
  if (!resource) {
    return { success: false, reason: "resource_not_found" };
  }
  
  // Validar distância
  const dx = resource.x - player.x;
  const dy = resource.y - player.y;
  const dist = Math.hypot(dx, dy);
  
  if (dist > RESOURCE_COLLECTION_RANGE) {
    return { success: false, reason: "out_of_range" };
  }
  
  // Remover recurso do mundo
  room.worldState.resources = room.worldState.resources.filter(r => r.id !== resourceId);
  
  // Adicionar ao inventário temporário do jogador
  const current = player.expeditionInventory.resources.get(resource.resourceType) ?? 0;
  player.expeditionInventory.resources.set(resource.resourceType, current + resource.quantity);
  
  return {
    success: true,
    resourceType: resource.resourceType,
    quantity: resource.quantity
  };
}
```

---

## 🔴 Problema 2: Dano de Contato (FALTANDO NO SERVIDOR)

### Cliente (`ExpeditionScene.ts:4418-4463`)

```typescript
private applyContactDamage(dt: number) {
  if (this.state === "extracted" || this.state === "failed") return;

  const playerRadius = 18;
  let damageThisFrame = 0;

  // FASE 4A: Usa getAllCreatures()
  const creaturesInRange = this.getAllCreatures();
  
  for (const wc of creaturesInRange) {
    const dx = wc.sprite.x - this.player.x;
    const dy = wc.sprite.y - this.player.y;
    const dist = Math.hypot(dx, dy);
    const creatureRadius = (wc.sprite as Phaser.GameObjects.Arc).radius ?? 11;
    
    if (dist <= playerRadius + creatureRadius) {
      const tierConfig = THREAT_TIERS[wc.tier];
      const contactDps = tierConfig.contactDamagePerSecond ?? 0;
      
      if (contactDps > 0) {
        damageThisFrame += contactDps * dt;
      }
    }
  }

  if (damageThisFrame > 0) {
    this.activeCreatureHp = Math.max(0, this.activeCreatureHp - damageThisFrame);
    this.damageTakenRecently += damageThisFrame;
    this.damageTakenDecayTimer = 0.5;
    this.telemetry.damageTaken += damageThisFrame;
    this.playerTookDamageThisFrame = true;
    
    // ❌ PROBLEMA: Dano aplicado localmente, sem validação do servidor
    
    if (this.activeCreatureHp <= 0) {
      this.handlePlayerDeathByEnemy();
    }
  }
}
```

### Servidor

❌ **COMPLETAMENTE AUSENTE**

- Não há sistema de dano de contato no servidor
- Criaturas não aplicam dano por proximidade
- Em multiplayer, jogador pode ficar colado em criaturas sem tomar dano

### Consequências

1. **Inconsistência**: Single-player tem dano de contato, multiplayer não
2. **Trapaça**: Jogadores podem ignorar criaturas em multiplayer
3. **Gameplay Diferente**: Experiência completamente diferente entre modos

### Solução Necessária

```typescript
// server/src/systems/combat.ts (ADICIONAR)

/**
 * Aplica dano de contato de criaturas em jogadores próximos.
 * Chamado a cada tick do game loop.
 */
export function applyContactDamage(
  room: CombatRoomState,
  deltaTime: number
): DamageResult[] {
  const results: DamageResult[] = [];
  const PLAYER_RADIUS = 18;
  
  for (const [playerId, player] of room.players) {
    if (player.isDead) continue;
    
    for (const creature of room.creatures) {
      const dx = creature.x - player.x;
      const dy = creature.y - player.y;
      const dist = Math.hypot(dx, dy);
      const creatureRadius = 11; // Raio padrão da criatura
      
      if (dist <= PLAYER_RADIUS + creatureRadius) {
        const tierConfig = THREAT_TIERS[creature.tier];
        const contactDps = tierConfig.contactDamagePerSecond ?? 0;
        
        if (contactDps > 0) {
          const damage = contactDps * deltaTime;
          const result = applyDamageToPlayer(playerId, player, damage, creature.id);
          results.push(result);
        }
      }
    }
  }
  
  return results;
}
```

**Integração no Game Loop:**

```typescript
// server/src/gameLoop.ts
private updateWorld(deltaMs: number): void {
  const deltaSeconds = deltaMs / 1000;

  // 1. Atualizar projéteis
  const projectileDamage = updateProjectiles(this.combatState, deltaSeconds);

  // 2. Atualizar IA de criaturas
  const aiAttackResults = updateCreatureAI(this.combatState, deltaSeconds);
  
  // 3. ✅ NOVO: Aplicar dano de contato
  const contactDamage = applyContactDamage(this.combatState, deltaSeconds);
  
  // 4. Consolidar todos os resultados de dano
  const allDamage = [...projectileDamage, ...aiAttackResults, ...contactDamage];
  
  // 5. Notificar callbacks
  if (allDamage.length > 0 && this.callbacks.onDamageApplied) {
    this.callbacks.onDamageApplied(allDamage);
  }
}
```

---

## 🟡 Problema 3: Skills/Habilidades (PARCIALMENTE IMPLEMENTADO)

### Cliente (`ExpeditionScene.ts`)

**Skills Implementadas:**
1. ✅ `castVoltiger()` - Raio elétrico (projétil)
2. ✅ `castVerdantRootTrap()` - Armadilha de raízes (zona de dano)
3. ✅ `castAquarylWaterPulse()` - Pulso de água (projétil)
4. ✅ `castPyrognatFireFog()` - Nevoeiro de fogo (zona de dano)

**Lógica no Cliente:**
- Cria zonas de skill localmente
- Aplica dano a criaturas dentro da zona
- Atualiza visuais e efeitos

### Servidor (`server/src/index.ts`)

```typescript
case "skill":
  queueIntent(currentRoom, clientId, createSkillIntent(clientId, msg));
  break;
```

**Status:**
- ✅ Servidor recebe intent de skill
- ⚠️ **Não cria zonas de skill no WorldState**
- ⚠️ **Não aplica dano de skill zones**
- ⚠️ **Não faz broadcast de skill zones** (já tem handler `skillZonesUpdate` mas não é usado)

### Consequências

1. **Dessincronia**: Skills só aparecem para quem usou
2. **Dano Duplicado**: Cliente aplica dano, servidor não valida
3. **Trapaça**: Cliente pode enviar dano falso de skills

### Solução Necessária

```typescript
// server/src/systems/skills.ts (CRIAR)

export function processSkillIntent(
  room: SkillRoomState,
  playerId: string,
  skillType: SkillType,
  targetX: number,
  targetY: number
): SkillResult {
  const player = room.players.get(playerId);
  
  // Validar cooldown
  const lastSkillTime = player.lastSkillTime ?? 0;
  const now = Date.now();
  if (now - lastSkillTime < SKILL_COOLDOWN) {
    return { success: false, reason: "cooldown" };
  }
  
  // Criar zona de skill
  const skillZone = createSkillZone(
    playerId,
    skillType,
    targetX,
    targetY,
    SKILL_CONFIG[skillType].radius,
    SKILL_CONFIG[skillType].damagePerTick,
    SKILL_CONFIG[skillType].tickInterval,
    SKILL_CONFIG[skillType].lifetime
  );
  
  room.worldState.skillZones.push(skillZone);
  player.lastSkillTime = now;
  
  return { success: true, skillZoneId: skillZone.id };
}

/**
 * Atualiza skill zones e aplica dano.
 */
export function updateSkillZones(
  room: SkillRoomState,
  deltaTime: number
): DamageResult[] {
  const results: DamageResult[] = [];
  const zonesToRemove: string[] = [];
  
  for (const zone of room.worldState.skillZones) {
    // Atualizar lifetime
    zone.lifetime -= deltaTime;
    if (zone.lifetime <= 0) {
      zonesToRemove.push(zone.id);
      continue;
    }
    
    // Atualizar tick timer
    zone.tickTimer -= deltaTime;
    if (zone.tickTimer <= 0) {
      zone.tickTimer = zone.tickInterval;
      
      // Aplicar dano em criaturas dentro da zona
      for (const creature of room.creatures) {
        const dx = creature.x - zone.x;
        const dy = creature.y - zone.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist <= zone.radius) {
          const result = applyDamageToCreature(
            creature,
            zone.damagePerTick,
            zone.ownerId
          );
          results.push(result);
        }
      }
    }
  }
  
  // Remover zonas expiradas
  room.worldState.skillZones = room.worldState.skillZones.filter(
    z => !zonesToRemove.includes(z.id)
  );
  
  return results;
}
```

---

## ✅ Sistemas Já Implementados Corretamente

### 1. Combate (Ataques Básicos) ✅

- ✅ Cliente envia `attack_basic` com posição do cursor
- ✅ Servidor valida e cria projétil
- ✅ Servidor detecta colisões e aplica dano
- ✅ Servidor faz broadcast de `attackResult`
- ✅ Cliente renderiza feedback visual

**Arquivo**: `server/src/systems/combat.ts:186-308`

### 2. IA de Criaturas ✅

- ✅ Servidor processa IA a 20 ticks/s
- ✅ Servidor faz broadcast de posições e estados
- ✅ Cliente interpola movimento suavemente
- ✅ Cliente renderiza indicadores visuais

**Arquivo**: `server/src/systems/combat.ts:586-793`

### 3. Captura de Criaturas ✅

- ✅ Cliente envia `capture_attempt`
- ✅ Servidor valida distância e pokébolas
- ✅ Servidor calcula chance de captura
- ✅ Servidor remove criatura se sucesso
- ✅ Servidor faz broadcast de `captureResult`

**Arquivo**: `server/src/systems/capture.ts`

### 4. Extração ✅

- ✅ Cliente envia `extraction_request`
- ✅ Servidor valida posição na zona
- ✅ Servidor rastreia progresso
- ✅ Servidor calcula recompensas
- ✅ Servidor faz broadcast de `extractionState`

**Arquivo**: `server/src/systems/extraction.ts`

---

## 📋 Plano de Ação Recomendado

### Prioridade 🔴 Alta (Crítico)

#### 1. Implementar Coleta de Recursos no Servidor
- [ ] Criar `server/src/systems/resources.ts`
- [ ] Implementar `processResourceCollection()`
- [ ] Validar distância e existência do recurso
- [ ] Remover recurso do WorldState
- [ ] Adicionar ao inventário do jogador
- [ ] Fazer broadcast de remoção

**Estimativa**: 2-3 horas  
**Impacto**: Elimina trapaça e dessincronia

#### 2. Implementar Dano de Contato no Servidor
- [ ] Adicionar `applyContactDamage()` em `combat.ts`
- [ ] Integrar no game loop (chamada a cada tick)
- [ ] Fazer broadcast de dano via `onDamageApplied`
- [ ] Testar com múltiplos jogadores

**Estimativa**: 1-2 horas  
**Impacto**: Gameplay consistente entre modos

### Prioridade 🟡 Média (Importante)

#### 3. Completar Sistema de Skills no Servidor
- [ ] Criar `server/src/systems/skills.ts`
- [ ] Implementar `processSkillIntent()`
- [ ] Implementar `updateSkillZones()`
- [ ] Fazer broadcast de skill zones criadas
- [ ] Aplicar dano de skill zones a criaturas
- [ ] Testar sincronização visual entre clientes

**Estimativa**: 3-4 horas  
**Impacto**: Skills visíveis para todos os jogadores

### Prioridade 🟢 Baixa (Polimento)

#### 4. Validações Adicionais
- [ ] Validar velocidade de movimento (anti-speed hack)
- [ ] Validar cooldowns de ataques no servidor
- [ ] Validar uso de poções
- [ ] Rate limiting de ações por segundo

**Estimativa**: 2-3 horas  
**Impacto**: Anti-cheat mais robusto

---

## 🔍 Como Testar

### Teste de Coleta de Recursos
1. Abrir 2 clientes em multiplayer
2. Ambos tentarem coletar o mesmo recurso
3. **Esperado**: Apenas o primeiro consegue
4. **Atual**: Ambos conseguem (bug)

### Teste de Dano de Contato
1. Entrar em multiplayer
2. Ficar colado em uma criatura
3. **Esperado**: Tomar dano contínuo
4. **Atual**: Não toma dano (bug)

### Teste de Skills
1. Jogador A usa skill (ex: nevoeiro de fogo)
2. Jogador B observa
3. **Esperado**: Jogador B vê a zona de skill
4. **Atual**: Jogador B não vê nada (bug)

---

## 📊 Métricas de Impacto

| Problema | Exploitabilidade | Impacto em Gameplay | Dificuldade de Fix |
|----------|------------------|---------------------|-------------------|
| Coleta de Recursos | 🔴 Alta | 🔴 Alta | 🟢 Baixa |
| Dano de Contato | 🟡 Média | 🔴 Alta | 🟢 Baixa |
| Skills | 🟡 Média | 🟡 Média | 🟡 Média |

---

## 💡 Recomendações Gerais

### Princípio: Server-Authoritative

**Regra de Ouro**: 
> "Nunca confie no cliente. Toda ação que afeta o estado do jogo deve ser validada pelo servidor."

### Checklist para Novos Sistemas

Ao implementar um novo sistema de gameplay:

- [ ] Cliente envia **intent** (não resultado)
- [ ] Servidor **valida** intent (distância, cooldown, recursos)
- [ ] Servidor **processa** lógica (cálculos, RNG, colisões)
- [ ] Servidor **atualiza** WorldState
- [ ] Servidor **faz broadcast** de resultado
- [ ] Cliente **renderiza** feedback visual

### Exemplo de Fluxo Correto

```
1. Cliente: "Quero coletar recurso X"
   → sendResourceInteract(resourceId)

2. Servidor: "Vou validar isso"
   → Jogador está perto? ✓
   → Recurso existe? ✓
   → Recurso já foi coletado? ✗

3. Servidor: "OK, pode coletar"
   → Remove recurso do WorldState
   → Adiciona ao inventário do jogador
   → Broadcast: resourcesUpdate (sem recurso X)

4. Cliente: "Vou mostrar feedback"
   → Animação de coleta
   → Texto flutuante "+1 Ferro"
   → Remove sprite do recurso
```

---

## 📝 Conclusão

**Status Atual**: 60% Server-Authoritative

**Sistemas Faltantes**:
- 🔴 Coleta de Recursos (crítico)
- 🔴 Dano de Contato (crítico)
- 🟡 Skills Completas (importante)

**Tempo Estimado para 100%**: 6-9 horas de desenvolvimento

**Benefícios**:
- ✅ Elimina trapaças
- ✅ Gameplay consistente
- ✅ Sincronização perfeita
- ✅ Base sólida para expansão
