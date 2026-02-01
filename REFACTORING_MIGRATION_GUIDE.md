# Guia de Migração - Fase 4: Modularização

Este documento descreve como integrar os novos sistemas modulares no `ExpeditionScene.ts`.

## Estrutura Criada

```
src/scenes/expedition/
├── types/
│   └── ExpeditionTypes.ts          ✅ Criado
├── managers/
│   ├── SpriteManager.ts            ✅ Criado
│   ├── ProjectileManager.ts        ✅ Criado
│   ├── SkillZoneManager.ts         ✅ Criado
│   └── MinimapManager.ts           ✅ Criado
├── systems/
│   ├── CaptureSystem.ts            ✅ Criado
│   ├── ExtractionSystem.ts         ✅ Criado
│   ├── MovementSystem.ts            ✅ Criado
│   └── SkillSystem.ts              ✅ Criado
└── ui/
    ├── HUDManager.ts               ✅ Criado
    ├── ExtractionUI.ts             ✅ Criado
    ├── SkillCooldownUI.ts          ✅ Criado
    ├── DebugPanel.ts               ✅ Criado
    └── FeedbackManager.ts           ✅ Criado
```

## Passos de Migração

### 1. Inicialização dos Sistemas (no método `create()`)

```typescript
// Inicializar sistemas modulares
this.feedbackManager = new FeedbackManager(this);
this.minimapManager = new MinimapManager(this);
this.hudManager = new HUDManager(this, viewportWidth, viewportHeight);
this.extractionUI = new ExtractionUI(this, viewportWidth, viewportHeight);
this.skillCooldownUI = new SkillCooldownUI(this, viewportWidth, viewportHeight);
this.debugPanel = new DebugPanel(this, viewportHeight);

// Inicializar worldState primeiro
this.worldState = new RemoteWorldState();

// SpriteManager precisa do worldState
this.spriteManager = new SpriteManager(this, this.worldState);

// ProjectileManager precisa de várias dependências
this.projectileManager = new ProjectileManager(this, this.player, {
  getAllCreatures: () => this.spriteManager.getAllCreatures(),
  removeCreature: (id) => {
    this.worldState.removeCreature(id);
    this.spriteManager.destroyCreatureSprite(id);
  },
  updateCreatureHp: (id, hp) => {
    this.worldState.updateCreature(id, { currentHp: hp });
  },
  worldState: this.worldState,
  telemetry: this.telemetry,
  mpClient: this.mpClient,
  dealDamageToPlayer: (damage) => this.dealDamageToPlayer(damage),
  createDeathEffect: (x, y, theme) => this.createDeathEffect(x, y, theme),
  createEnhancedFloatingText: (x, y, text, color, fontSize) => 
    this.feedbackManager.createEnhancedFloatingText(x, y, text, color, fontSize),
  attemptCapture: (creature, ballType) => 
    this.captureSystem.attemptCapture(creature, ballType),
  sendCaptureAttempt: (creatureId, ballType) => 
    this.mpClient?.sendCaptureAttempt(creatureId, ballType)
});

// SkillZoneManager
this.skillZoneManager = new SkillZoneManager(this, {
  getAllCreatures: () => this.spriteManager.getAllCreatures(),
  updateCreatureHp: (id, hp) => {
    this.worldState.updateCreature(id, { currentHp: hp });
  },
  worldState: this.worldState,
  telemetry: this.telemetry
});

// CaptureSystem
this.captureSystem = new CaptureSystem({
  telemetry: this.telemetry,
  creaturesCaptured: this.creaturesCaptured,
  createCaptureSuccessFeedback: (x, y) => 
    this.feedbackManager.createCaptureSuccessFeedback(x, y),
  createEnhancedFloatingText: (x, y, text, color, fontSize) => 
    this.feedbackManager.createEnhancedFloatingText(x, y, text, color, fontSize),
  removeCreature: (id) => {
    this.worldState.removeCreature(id);
    this.spriteManager.destroyCreatureSprite(id);
  },
  updateCreatureState: (id, state) => {
    this.worldState.updateCreature(id, state);
  },
  worldState: this.worldState
});

// ExtractionSystem
this.extractionSystem = new ExtractionSystem(this.state, {
  sendExtractionRequest: (pointId, action) => 
    this.mpClient?.sendExtractionRequest(pointId, action),
  extractionUI: this.extractionUI
});

// MovementSystem
this.movementSystem = new MovementSystem(
  this.player,
  this.cursors,
  this.wasdKeys,
  this.speed,
  this.state,
  this.mpClient
);

// SkillSystem
this.skillSystem = new SkillSystem(this, this.mpClient, {
  createFloatingText: (x, y, text, color) => 
    this.feedbackManager.createFloatingText(x, y, text, color),
  addSkillZone: (zone) => this.skillZoneManager.addSkillZone(zone),
  healCreature: (amount) => {
    this.activeCreatureHp = Math.min(
      this.activeCreatureMaxHp,
      this.activeCreatureHp + amount
    );
  },
  activeCreatureHp: this.activeCreatureHp,
  activeCreatureMaxHp: this.activeCreatureMaxHp
});
```

### 2. Substituir Métodos no `create()`

**Antes:**
```typescript
this.createMinimap(viewportWidth, viewportHeight, worldWidth, worldHeight, zoneX, zoneY);
```

**Depois:**
```typescript
this.minimapManager.create(
  viewportWidth,
  viewportHeight,
  worldWidth,
  worldHeight,
  zoneX,
  zoneY,
  this.mapConfig
);
```

**Antes:**
```typescript
this.hudText = this.add.text(...);
// ... código de criação do HUD
```

**Depois:**
```typescript
this.hudManager.create();
```

**Antes:**
```typescript
this.extractionProgressBg = this.add.rectangle(...);
this.extractionProgressBar = this.add.rectangle(...);
```

**Depois:**
```typescript
this.extractionUI.create();
```

**Antes:**
```typescript
this.skillCooldownBarBg = this.add.rectangle(...);
this.skillCooldownBarFill = this.add.rectangle(...);
this.skillCooldownText = this.add.text(...);
```

**Depois:**
```typescript
this.skillCooldownUI.create();
```

**Antes:**
```typescript
this.debugPanelText = this.add.text(...);
```

**Depois:**
```typescript
this.debugPanel.create();
```

### 3. Substituir Métodos no `update()`

**Antes:**
```typescript
this.handleMovement(dt);
```

**Depois:**
```typescript
this.movementSystem.update(dt, this.state);
```

**Antes:**
```typescript
this.updateProjectiles(dt);
this.updateEnemyProjectiles(dt);
this.updatePokeballProjectiles(dt);
```

**Depois:**
```typescript
this.state = this.projectileManager.update(dt, this.state);
```

**Antes:**
```typescript
this.updateSkillZones(dt);
```

**Depois:**
```typescript
this.skillZoneManager.update(dt);
```

**Antes:**
```typescript
this.updateCreatureSprites(dt);
this.updateResourceSprites(dt);
this.updatePlayerSprites(dt);
```

**Depois:**
```typescript
this.spriteManager.updateCreatureSprites(dt, this.player.x, this.player.y);
this.spriteManager.updateResourceSprites(dt);
this.spriteManager.updatePlayerSprites(dt, this.player.x, this.player.y);
```

**Antes:**
```typescript
this.updateHud();
```

**Depois:**
```typescript
this.hudManager.update(
  this.state,
  this.expeditionTime,
  this.expeditionDuration,
  this.creaturesCaptured,
  this.expeditionResources,
  this.extractionSystem.progress,
  this.extractionSystem.required,
  this.endSceneTimer,
  this.endSceneDelay,
  this.dangerLowHpThreshold,
  this.activeCreatureHp,
  this.activeCreatureMaxHp,
  this.damageTakenRecently
);
```

**Antes:**
```typescript
this.updateSkillCooldownBar();
```

**Depois:**
```typescript
this.skillCooldownUI.update(
  this.skillSystem.cooldown,
  this.skillSystem.cooldownTime,
  this.activeSpecialSkillKind,
  this.activeSpecialSkillName
);
```

**Antes:**
```typescript
this.updateDebugPanel();
```

**Depois:**
```typescript
this.debugPanel.update(
  this.expeditionTime,
  this.expeditionDuration,
  this.telemetry,
  this.state,
  this.clientId,
  this.spriteManager.playerSpritesSize,
  this.worldState,
  // Precisa de um getter para creatureSprites do SpriteManager
);
```

**Antes:**
```typescript
this.updateMinimap();
```

**Depois:**
```typescript
this.minimapManager.update(this.player.x, this.player.y);
```

### 4. Substituir Métodos de Captura

**Antes:**
```typescript
this.attemptCapture(creature, ballType);
```

**Depois:**
```typescript
const result = this.captureSystem.attemptCapture(creature, ballType);
this.creaturesCaptured = result.creaturesCaptured;
```

### 5. Substituir Métodos de Extração

**Antes:**
```typescript
if (inExtractionZone && this.extractKey.isDown) {
  if (this.mpClient && !this.isExtractionRequestSent) {
    this.mpClient.sendExtractionRequest(pointId, "start");
    this.isExtractionRequestSent = true;
  }
  // ...
}
```

**Depois:**
```typescript
this.extractionSystem.handleExtraction(
  inExtractionZone,
  this.extractKey.isDown,
  this.player.x,
  this.player.y
);
```

**Antes:**
```typescript
this.handleExtractionState(state);
```

**Depois:**
```typescript
this.state = this.extractionSystem.handleExtractionState(state);
```

### 6. Substituir Métodos de Habilidade

**Antes:**
```typescript
this.tryUseSpecialSkill();
```

**Depois:**
```typescript
const pointer = this.input.activePointer;
pointer.updateWorldPoint(this.cameras.main);
this.skillSystem.tryUseSpecialSkill(pointer.worldX, pointer.worldY);
```

**Antes:**
```typescript
if (this.specialSkillCooldown > 0) {
  this.specialSkillCooldown = Math.max(0, this.specialSkillCooldown - dt);
}
```

**Depois:**
```typescript
this.skillSystem.update(dt);
```

### 7. Substituir Métodos de Feedback

**Antes:**
```typescript
this.createFloatingText(x, y, text, color);
this.createCollectionFeedback(x, y, itemId);
this.createCaptureSuccessFeedback(x, y);
this.createHealFeedback(x, y);
```

**Depois:**
```typescript
this.feedbackManager.createFloatingText(x, y, text, color);
this.feedbackManager.createCollectionFeedback(x, y, itemId);
this.feedbackManager.createCaptureSuccessFeedback(x, y);
this.feedbackManager.createHealFeedback(x, y);
```

## Notas Importantes

1. **Dependências Circulares**: Alguns sistemas precisam de referências entre si. Use callbacks ou injeção de dependências.

2. **Estado Compartilhado**: Variáveis como `this.state`, `this.creaturesCaptured`, etc. ainda precisam ser mantidas na classe principal para coordenação.

3. **Métodos Legados**: Alguns métodos antigos podem precisar ser mantidos temporariamente durante a migração gradual.

4. **Testes**: Teste cada substituição individualmente antes de continuar.

## Próximos Passos

1. ✅ Criar todos os módulos modulares
2. ✅ Integrar módulos no ExpeditionScene.ts (concluído)
   - ✅ Sistemas modulares inicializados no create()
   - ✅ Métodos do update() substituídos pelos sistemas modulares
   - ✅ Métodos de feedback substituídos pelo FeedbackManager
   - ✅ Métodos de captura substituídos pelo CaptureSystem
   - ✅ Métodos de extração substituídos pelo ExtractionSystem
   - ✅ Métodos de habilidade substituídos pelo SkillSystem
   - ⚠️ Métodos legados mantidos como fallback temporário
3. ✅ Refatorar server/index.ts (concluído)
   - ✅ ExtractionHandler criado para processar sistema de extração
   - ✅ GameLoopManager criado para gerenciar criação e callbacks do game loop
   - ✅ broadcastExtractionMessage movido para StateBroadcaster
   - ✅ Métodos startRoomGameLoop e stopRoomGameLoop adicionados ao RoomManager
   - ✅ server/index.ts refatorado para usar os novos módulos
   - ✅ Código duplicado removido
   - ✅ Imports não utilizados removidos
4. ⏳ Testar e validar
5. ⏳ Remover métodos legados após validação completa
