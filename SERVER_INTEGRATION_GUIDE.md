# Guia de Integração - Servidor WebSocket

## 📌 Objetivo

Integrar o servidor WebSocket para enviar `creaturesUpdate` e `resourcesUpdate` para o cliente, sincronizando entidades em tempo real.

---

## 🎯 O que o Cliente Espera

### Evento: `creaturesUpdate`

**Tipo**: Evento enviado pelo servidor periodicamente (ex: 10Hz = 100ms)

**Payload**:
```json
{
  "type": "creaturesUpdate",
  "creatures": [
    {
      "id": "wild-1",
      "x": 300.5,
      "y": 250.3,
      "currentHp": 42,
      "maxHp": 60,
      "creatureType": "pyrognat",
      "level": 5,
      "state": "idle"
    }
  ]
}
```

**Campos**:
- `id`: Identificador único da criatura (string)
- `x`, `y`: Posição no mapa (números)
- `currentHp`: HP atual (número)
- `maxHp`: HP máximo (número)
- `creatureType`: Tipo de criatura (string, ex: "pyrognat", "aquaryl")
- `level`: Nível da criatura (número, opcional)
- `state`: Estado da criatura (string, ex: "idle", "attacking")

---

### Evento: `resourcesUpdate`

**Tipo**: Evento enviado pelo servidor periodicamente

**Payload**:
```json
{
  "type": "resourcesUpdate",
  "resources": [
    {
      "id": "res-1",
      "x": 150.2,
      "y": 180.5,
      "resourceType": "ferro-cristalino",
      "type": "ferro-cristalino",
      "amount": 1,
      "quantity": 1
    }
  ]
}
```

**Campos**:
- `id`: Identificador único do recurso (string)
- `x`, `y`: Posição no mapa (números)
- `resourceType` ou `type`: Tipo de recurso (string)
  - `"cristal-energia"`
  - `"ferro-cristalino"`
  - `"energia-etérea"`
- `amount` ou `quantity`: Quantidade (número)

---

## 🔧 Implementação no Servidor

### 1. Adicionar Tipos (TypeScript)

```typescript
// server/src/types.ts

export interface ServerCreature {
  id: string;
  x: number;
  y: number;
  currentHp: number;
  maxHp: number;
  creatureType: string;
  level?: number;
  state?: string;
}

export interface ServerResource {
  id: string;
  x: number;
  y: number;
  resourceType: string;
  type?: string;
  amount?: number;
  quantity?: number;
}

export interface WorldState {
  creatures: ServerCreature[];
  resources: ServerResource[];
}
```

### 2. Adicionar ao Room

```typescript
// server/src/index.ts

interface Room {
  id: string;
  players: Map<string, Player>;
  startedAt: number;
  durationSeconds: number;
  
  // NOVO:
  worldState: WorldState;
  lastCreaturesUpdateTime: number;
  lastResourcesUpdateTime: number;
}

// Inicializar ao criar sala
function createRoom(id: string): Room {
  return {
    id,
    players: new Map(),
    startedAt: Date.now(),
    durationSeconds: 240,
    
    // NOVO:
    worldState: {
      creatures: generateCreatures(), // Função para gerar criaturas
      resources: generateResources()   // Função para gerar recursos
    },
    lastCreaturesUpdateTime: 0,
    lastResourcesUpdateTime: 0
  };
}
```

### 3. Função de Geração

```typescript
// server/src/index.ts

function generateCreatures(): ServerCreature[] {
  const creatures: ServerCreature[] = [];
  const types = ["pyrognat", "aquaryl", "verdant", "voltiger"];
  
  // Gerar 5-10 criaturas aleatoriamente no mapa
  for (let i = 0; i < 7; i++) {
    creatures.push({
      id: `wild-${i}`,
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100,
      currentHp: 50 + Math.random() * 30,
      maxHp: 80,
      creatureType: types[Math.floor(Math.random() * types.length)],
      level: 1 + Math.floor(Math.random() * 5),
      state: "idle"
    });
  }
  
  return creatures;
}

function generateResources(): ServerResource[] {
  const resources: ServerResource[] = [];
  const types = ["ferro-cristalino", "cristal-energia", "energia-etérea"];
  
  // Gerar 10-15 recursos aleatoriamente
  for (let i = 0; i < 12; i++) {
    resources.push({
      id: `res-${i}`,
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100,
      resourceType: types[Math.floor(Math.random() * types.length)],
      type: types[Math.floor(Math.random() * types.length)],
      amount: 1,
      quantity: 1
    });
  }
  
  return resources;
}
```

### 4. Broadcast Periódico

```typescript
// server/src/index.ts

setInterval(() => {
  const now = Date.now();
  
  for (const room of rooms.values()) {
    // Broadcast creaturesUpdate a cada 100ms (10Hz)
    if (now - room.lastCreaturesUpdateTime >= 100) {
      broadcast(room, {
        type: "creaturesUpdate",
        creatures: room.worldState.creatures
      });
      room.lastCreaturesUpdateTime = now;
    }
    
    // Broadcast resourcesUpdate a cada 200ms (5Hz) - menos frequente
    if (now - room.lastResourcesUpdateTime >= 200) {
      broadcast(room, {
        type: "resourcesUpdate",
        resources: room.worldState.resources
      });
      room.lastResourcesUpdateTime = now;
    }
  }
}, 50); // Check a cada 50ms
```

### 5. Função de Broadcast

```typescript
// server/src/index.ts

function broadcast(room: Room, message: any) {
  const payload = JSON.stringify(message);
  
  for (const player of room.players.values()) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  }
}
```

---

## 🎮 Interações (Futuro)

### Quando Criatura Morre
```typescript
// Remover da lista de criaturas
room.worldState.creatures = room.worldState.creatures.filter(
  c => c.id !== deathCreatureId
);
```

### Quando Recurso é Coletado
```typescript
// Remover da lista de recursos
room.worldState.resources = room.worldState.resources.filter(
  r => r.id !== collectedResourceId
);
```

### Quando Criatura Toma Dano
```typescript
// Atualizar HP
const creature = room.worldState.creatures.find(c => c.id === targetId);
if (creature) {
  creature.currentHp = Math.max(0, creature.currentHp - damageAmount);
}
```

---

## 📋 Checklist de Implementação

- [ ] Adicionar tipos `ServerCreature` e `ServerResource`
- [ ] Adicionar `worldState` ao `Room`
- [ ] Implementar `generateCreatures()`
- [ ] Implementar `generateResources()`
- [ ] Implementar broadcast periódico
- [ ] Testar com múltiplos clientes
- [ ] Verificar taxas de atualização (10Hz criaturas, 5Hz recursos)

---

## 🧪 Teste Rápido

### 1. Servidor enviando criaturas
```bash
cd server && npm run dev
# Aguarde: Server listening on port 3003
```

### 2. Cliente recebendo
```bash
npm run dev
# Abra: http://localhost:5173/?mp=1
# Console: [MP] Criaturas atualizadas: N criaturas no servidor
```

### 3. Verificar no console
```javascript
// DevTools Console
scene.serverCreatures  // Deve ter criaturas
scene.serverResources  // Deve ter recursos
```

---

## ⚡ Otimizações Futuras

1. **Delta Updates**: Apenas enviar mudanças, não tudo
2. **Spatial Partitioning**: Enviar apenas entidades próximas
3. **Client Prediction**: Antecipar movimento no cliente
4. **Lag Compensation**: Considerar latência na sincronização

---

## 📚 Referências

- Cliente: `src/services/multiplayerClient.ts`
- Tipos remotes: `RemoteCreature`, `RemoteResource`
- Handler: `handleCreaturesUpdate()`, `handleResourcesUpdate()`
- Documentação completa: `MULTIPLAYER_MODE_GUIDE.md`

---

Boa sorte com a integração! 🚀
