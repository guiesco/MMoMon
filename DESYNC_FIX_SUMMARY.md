# Correção de Desync Cliente-Servidor

**Data:** 29 de Janeiro de 2026  
**Problemas Corrigidos:**
1. HP das criaturas do jogador não sincronizado com servidor
2. Itens coletados durante expedição não persistidos após extração
3. ID do ponto de extração hardcoded no cliente (causava falha no servidor)

---

## 🐛 Problema 1: HP das Criaturas Desincronizado

### Sintoma
- Servidor registrava jogadores sempre com HP padrão (100/100)
- HP real das criaturas do jogador não era considerado em combate
- Jogadores com criaturas feridas apareciam com HP cheio no servidor

### Causa Raiz
O cliente enviava apenas `name` e `roomId` ao entrar na sala, sem incluir dados do time:

```typescript
// ANTES (incompleto)
{
  type: "join",
  roomId: this.roomId,
  name: this.name
}
```

### Solução Implementada

#### 1. Novo Tipo de Dados
```typescript
export interface TeamCreatureData {
  instanceId: string;
  definitionId: string;
  level: number;
  currentHp: number;
  maxHp: number;
  rank?: number;
}
```

#### 2. Envio de Dados do Time (Cliente)
Após conexão bem-sucedida, o cliente agora envia:

```typescript
this.mpClient.on("joined", (data) => {
  // ... código existente ...
  
  // Enviar dados do time ao servidor
  const teamData = this.activeTeamIds.map(instanceId => {
    const owned = progress.creatures.find(c => c.instanceId === instanceId);
    const def = owned ? getCreatureById(owned.definitionId) : null;
    
    return {
      instanceId: owned.instanceId,
      definitionId: owned.definitionId,
      level: owned.level,
      currentHp: owned.currentHp,
      maxHp: def.stats.hp,
      rank: owned.rank
    };
  }).filter(c => c !== null);
  
  this.mpClient.sendTeamData(teamData, this.activeCreatureInstanceId);
});
```

#### 3. Recebimento no Servidor
```typescript
case "team_sync": {
  const player = currentRoom.players.get(clientId);
  const creatures = msg.creatures;
  const activeCreatureId = msg.activeCreatureInstanceId;
  
  if (activeCreatureId) {
    player.activeCreatureId = activeCreatureId;
    
    const activeCreature = creatures.find(c => c.instanceId === activeCreatureId);
    if (activeCreature && currentRoom.gameLoop) {
      currentRoom.gameLoop.updatePlayerHp(
        clientId, 
        activeCreature.currentHp, 
        activeCreature.maxHp
      );
    }
  }
  break;
}
```

#### 4. Sincronização Contínua
Quando o jogador troca de criatura:

```typescript
// Cliente
this.mpClient.sendActiveCreatureUpdate(
  instanceId,
  this.activeCreatureHp,
  this.activeCreatureMaxHp
);

// Servidor
case "active_creature_update": {
  player.activeCreatureId = msg.instanceId;
  if (currentRoom.gameLoop) {
    currentRoom.gameLoop.updatePlayerHp(
      clientId, 
      msg.currentHp, 
      msg.maxHp
    );
  }
  break;
}
```

---

## 🐛 Problema 2: Itens não Persistidos Após Extração

### Sintoma
- Relatório de extração mostrava itens coletados
- Ao voltar para a base, inventário estava vazio
- Criaturas capturadas não eram contabilizadas

### Causa Raiz
O servidor calculava as recompensas corretamente, mas os contadores `resourcesCollected` e `creaturesCaptured` nunca eram atualizados durante a partida:

```typescript
// Sistema de extração usava estes valores
const reward: ExtractionReward = {
  playerId,
  pointId,
  resources: new Map(player.resourcesCollected), // ❌ Sempre vazio!
  creaturesCaptured: player.creaturesCaptured,    // ❌ Sempre 0!
  timestamp: Date.now()
};
```

### Solução Implementada

#### 1. Rastreamento de Recursos Coletados
**Arquivo:** `server/src/systems/resources.ts`

```typescript
// Em processResourceCollection()
const currentQuantity = player.expeditionInventory.get(resource.resourceType) ?? 0;
player.expeditionInventory.set(
  resource.resourceType,
  currentQuantity + resource.quantity
);

// ✅ NOVO: Adicionar ao contador de extração
if (player.resourcesCollected) {
  const collectedQuantity = player.resourcesCollected.get(resource.resourceType) ?? 0;
  player.resourcesCollected.set(
    resource.resourceType,
    collectedQuantity + resource.quantity
  );
}
```

#### 2. Rastreamento de Criaturas Capturadas
**Arquivo:** `server/src/systems/capture.ts`

```typescript
// Em processCaptureIntent()
if (success) {
  // Adiciona ao inventário temporário
  inventory.capturedCreatures.push({
    instanceId,
    speciesId,
    level,
    tier: creature.tier,
    capturedAt: Date.now()
  });

  // ✅ NOVO: Incrementar contador
  if (player && player.creaturesCaptured !== undefined) {
    player.creaturesCaptured++;
  }
}
```

#### 3. Persistência no Cliente
**Arquivo:** `src/scenes/ExpeditionScene.ts`

```typescript
private handleExtractionState(state: ExtractionState) {
  if (state.status === "completed") {
    // Processa recompensas
    if (state.rewards) {
      // ✅ Adicionar recursos coletados
      for (const [itemId, qty] of Object.entries(state.rewards.resources ?? {})) {
        if (qty > 0) {
          LocalPlayerState.addItem(itemId, qty);
          console.log(`[Extraction] Recurso adicionado: ${itemId} x${qty}`);
        }
      }
      
      // ✅ Adicionar pokébolas equivalentes às criaturas capturadas
      const creaturesCaptured = state.rewards.creaturesCaptured ?? 0;
      if (creaturesCaptured > 0) {
        LocalPlayerState.addItem("poke-ball-basic", creaturesCaptured);
        console.log(`[Extraction] Pokébolas adicionadas: ${creaturesCaptured}`);
      }
    }
  }
}
```

---

## 📊 Fluxo Completo de Sincronização

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ENTRADA NA EXPEDIÇÃO                                         │
└─────────────────────────────────────────────────────────────────┘
Cliente                          Servidor
   │                                │
   ├──── join (nome, roomId) ──────>│
   │<──── joined (clientId) ─────────┤
   │                                │
   ├──── team_sync ────────────────>│
   │   (criaturas, HP, ativa)       │
   │                                ├─> Atualiza HP no combate
   │                                │

┌─────────────────────────────────────────────────────────────────┐
│ 2. DURANTE A EXPEDIÇÃO                                          │
└─────────────────────────────────────────────────────────────────┘
Cliente                          Servidor
   │                                │
   ├──── resource_interact ────────>│
   │                                ├─> resourcesCollected++
   │                                │
   ├──── capture_attempt ──────────>│
   │                                ├─> creaturesCaptured++
   │                                │
   ├──── active_creature_update ───>│
   │   (nova criatura, HP)          │
   │                                ├─> Atualiza HP no combate
   │                                │

┌─────────────────────────────────────────────────────────────────┐
│ 3. EXTRAÇÃO                                                     │
└─────────────────────────────────────────────────────────────────┘
Cliente                          Servidor
   │                                │
   ├──── extraction_request ───────>│
   │   (start)                      │
   │<──── extraction_state ──────────┤
   │   (in_progress, 0%)            │
   │                                │
   │   ... progresso ...            │
   │                                │
   │<──── extraction_state ──────────┤
   │   (completed, rewards)         │
   │                                │
   ├─> Persiste recursos            │
   ├─> Persiste pokébolas           │
```

---

## 🧪 Como Testar

### Teste 1: Sincronização de HP
1. Iniciar expedição com criatura ferida (ex: 50/100 HP)
2. Verificar logs do servidor: `[Team Sync] Jogador ... sincronizou X criaturas`
3. Verificar logs do GameLoop: `[GameLoop] HP do jogador ... atualizado: 50/100`
4. Trocar de criatura durante expedição
5. Verificar logs: `[Active Creature] Jogador ... trocou para ...`

### Teste 2: Persistência de Itens
1. Coletar recursos durante expedição (ex: 5 ferro-cristalino)
2. Capturar 2 criaturas
3. Extrair com sucesso
4. Verificar logs do servidor:
   ```
   [Extraction] Recompensas calculadas: 2 criaturas, 1 tipos de recursos
   ```
5. Verificar logs do cliente:
   ```
   [Extraction] Recurso adicionado: resource-ferro-cristalino x5
   [Extraction] Pokébolas adicionadas: 2
   ```
6. Voltar para base e verificar inventário

---

## 📝 Arquivos Modificados

### Cliente
- `src/services/multiplayerClient.ts`
  - ✅ Novo tipo `TeamCreatureData`
  - ✅ Método `sendTeamData()`
  - ✅ Método `sendActiveCreatureUpdate()`

- `src/scenes/ExpeditionScene.ts`
  - ✅ Envio de dados do time após conexão
  - ✅ Envio de atualização ao trocar criatura
  - ✅ Persistência de recompensas melhorada
  - ✅ Processamento de pontos de extração do servidor
  - ✅ Uso de ID dinâmico nas requisições de extração

### Servidor
- `server/src/index.ts`
  - ✅ Tipos `TeamSyncMessage` e `ActiveCreatureUpdateMessage`
  - ✅ Handler `team_sync`
  - ✅ Handler `active_creature_update`
  - ✅ Passa objeto `player` para `processCaptureIntent()`

- `server/src/gameLoop.ts`
  - ✅ Método `updatePlayerHp()`

- `server/src/systems/resources.ts`
  - ✅ Atualiza `resourcesCollected` em `processResourceCollection()`
  - ✅ Atualiza `resourcesCollected` em `processAutoCollection()`
  - ✅ Tipo `ResourcePlayer` expandido

- `server/src/systems/capture.ts`
  - ✅ Incrementa `creaturesCaptured` ao capturar
  - ✅ Parâmetro `player` adicionado a `processCaptureIntent()`

---

## 🐛 Problema 3: ID do Ponto de Extração Incorreto

### Sintoma
- Cliente enviava requisição de extração
- Servidor retornava erro: "Ponto de extração extract-1 não encontrado"
- Cliente mostrava extração como sucesso (desync)

### Causa Raiz
Cliente usava ID hardcoded (`extract-1`) enquanto servidor gerava IDs incrementais começando do 0:

```typescript
// Cliente (ANTES - hardcoded)
this.mpClient.sendExtractionRequest("extract-1", "start"); // ❌

// Servidor (geração dinâmica)
const extractionPoint = {
  id: generateId("extract"), // Gera "extract-0" para primeiro ponto
  x, y, radius
};
```

### Solução Implementada

#### 1. Armazenar ID do Servidor
```typescript
// ExpeditionScene.ts
private serverExtractionPointId: string | null = null;
```

#### 2. Processar Pontos de Extração
```typescript
if (world.extractionPoints && world.extractionPoints.length > 0) {
  // Armazenar ID do primeiro ponto de extração
  if (world.extractionPoints[0]) {
    this.serverExtractionPointId = world.extractionPoints[0].id;
    console.log(`[MP] Ponto de extração registrado: ${this.serverExtractionPointId}`);
  }
}
```

#### 3. Usar ID Correto
```typescript
// DEPOIS - usa ID do servidor
const pointId = this.serverExtractionPointId ?? "extract-0";
this.mpClient.sendExtractionRequest(pointId, "start"); // ✅
```

---

## ✅ Resultado

- ✅ HP das criaturas sincronizado corretamente com servidor
- ✅ Servidor usa HP real das criaturas em combate
- ✅ Recursos coletados são rastreados durante expedição
- ✅ Criaturas capturadas são contabilizadas
- ✅ Recompensas são persistidas corretamente no inventário
- ✅ Cliente usa ID correto do ponto de extração do servidor
- ✅ Extração funciona corretamente em multiplayer
- ✅ Logs detalhados para debug

---

## 🔍 Logs de Debug Adicionados

```typescript
// Cliente
"[MP] Dados do time enviados: [...]"
"[MP] Criatura ativa atualizada: Pyrognat (80/100 HP)"
"[MP] Recebendo 1 pontos de extração do servidor"
"[MP] Ponto de extração registrado: extract-0"
"[Extraction] Enviando pedido de extração ao servidor (ponto: extract-0)..."
"[Extraction] Recurso adicionado: resource-ferro-cristalino x5"
"[Extraction] Pokébolas adicionadas: 2"
"[Extraction] Recompensas aplicadas: 1 tipos de recursos, 2 criaturas"

// Servidor
"[Team Sync] Jogador abc12345... sincronizou 3 criaturas, ativa: def67890..."
"[GameLoop] HP do jogador abc12345... atualizado: 80/100"
"[Active Creature] Jogador abc12345... trocou para ghi34567... (60/80 HP)"
"[Capture] Sucesso! ... | Total capturado: 2"
"[Extraction] Recebido pedido de start para ponto extract-0 do jogador abc12345..."
"[Extraction] Pedido processado: SUCESSO"
"[Extraction] Recompensas calculadas para abc12345...: 2 criaturas, 1 tipos de recursos"
```
