# Guia Modo Multiplayer - ExpeditionScene

## Visão Geral

O modo multiplayer sincroniza entidades do servidor (criaturas selvagens, recursos e jogadores remotos) com o cliente. O sistema é **server-authoritative**, ou seja, o servidor é a fonte de verdade para o estado do mundo.

## Como Ativar

### Query Parameter
```
http://localhost:5173/?mp=1
```

Ao adicionar `?mp=1` à URL:
1. **Multiplayer é ativado** (`this.isMultiplayer = true`)
2. **Não faz spawn local** de criaturas e recursos (`spawnResourcesAndCreatures` é pulado)
3. **Aguarda atualizações do servidor** via WebSocket
4. **MultiplayerClient se conecta** automaticamente

### Sem Query Parameter (Single-Player)
- Modo single-player funciona normalmente
- Spawn local de criaturas e recursos ativo
- Sem dependência de servidor

## Arquitetura de Sincronização

### Estruturas de Dados Remotas

#### 1. **RemotePlayerSprite** (Jogadores remotos)
```typescript
interface RemotePlayerSprite {
  id: string;
  name: string;
  sprite: Phaser.GameObjects.Arc;
  nameText: Phaser.GameObjects.Text;
  
  // Interpolação suave
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  
  // Estado de HP
  currentHp: number;
  maxHp: number;
}
```

#### 2. **RemoteCreatureSprite** (Criaturas selvagens do servidor)
```typescript
interface RemoteCreatureSprite {
  id: string;
  sprite: Phaser.GameObjects.Arc;
  
  // Interpolação suave
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  
  // Estado de HP
  currentHp: number;
  maxHp: number;
  creatureType?: string;
}
```

#### 3. **RemoteResourceSprite** (Recursos do servidor)
```typescript
interface RemoteResourceSprite {
  id: string;
  sprite: Phaser.GameObjects.Arc;
  
  // Interpolação suave
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  
  // Tipo e quantidade
  resourceType?: string;
  amount?: number;
}
```

### Fluxo de Sincronização

```
Servidor envia eventos → MultiplayerClient recebe → Handler processa → Sprites atualizados
```

#### Evento: `creaturesUpdate`
**Payload:**
```json
{
  "type": "creaturesUpdate",
  "creatures": [
    {
      "id": "wild-1",
      "x": 300,
      "y": 200,
      "currentHp": 42,
      "maxHp": 60,
      "creatureType": "pyrognat",
      "state": "idle"
    }
  ]
}
```

**Handler:** `handleCreaturesUpdate(creatures: RemoteCreature[])`

**O que faz:**
1. Para cada criatura:
   - Se existe: atualiza posição alvo (`targetX`, `targetY`) e HP
   - Se nova: cria novo sprite via `createServerCreatureSprite()`
2. Remove criaturas não presentes no update (mortas/capturadas)

#### Evento: `resourcesUpdate`
**Payload:**
```json
{
  "type": "resourcesUpdate",
  "resources": [
    {
      "id": "res-1",
      "x": 150,
      "y": 250,
      "resourceType": "ferro-cristalino",
      "amount": 1
    }
  ]
}
```

**Handler:** `handleResourcesUpdate(resources: RemoteResource[])`

**O que faz:**
1. Para cada recurso:
   - Se existe: atualiza posição alvo
   - Se novo: cria novo sprite via `createServerResourceSprite()`
2. Remove recursos não presentes (coletados)

#### Evento: `state` (Snapshot completo)
**Payload:**
```json
{
  "type": "state",
  "players": [
    {
      "id": "player-1",
      "name": "TrainerX",
      "x": 100,
      "y": 200
    }
  ],
  "match": {
    "elapsedSeconds": 42,
    "timeLeft": 138,
    "durationSeconds": 180
  }
}
```

**Handler:** Automático via `mpClient.on("state", ...)`

**O que faz:**
1. Sincroniza jogadores remotos via `syncRemotePlayers()`
2. Atualiza timer da partida (TODO: integrar com UI)

## Interpolação de Movimento

### Por que Interpolação?

O servidor envia updates em intervalos fixos (ex: 10Hz = a cada 100ms). Sem interpolação, os sprites "pulam" para a nova posição. Com interpolação, eles se movem suavemente.

### Implementação

**Em `update()` (cada frame):**

```typescript
// Calcula distância até alvo
const dx = targetX - currentX;
const dy = targetY - currentY;
const distance = Math.sqrt(dx * dx + dy * dy);

if (distance > 0.5) {
  // Move em direção ao alvo
  const moveSpeed = interpolationSpeed * dt;
  const moveRatio = Math.min(1, moveSpeed / distance);
  
  currentX += dx * moveRatio;
  currentY += dy * moveRatio;
} else {
  // Snap ao alvo quando muito próximo
  currentX = targetX;
  currentY = targetY;
}
```

### Velocidades de Interpolação

- **Jogadores remotos**: `8` (rápido, feedback responsivo)
- **Criaturas selvagens**: `8` (igual aos jogadores)
- **Recursos**: `4` (mais lento, raramente se movem)

## Ciclo de Vida Multiplayer

### 1. Create (Inicialização)
```typescript
// Se modo multiplayer
if (enableMp) {
  this.isMultiplayer = true;
  this.mpClient = new MultiplayerClient("floresta-celestial", name);
  
  // Registra handlers
  this.mpClient.on("state", (players, match) => this.syncRemotePlayers(players));
  this.mpClient.on("creaturesUpdate", (creatures) => this.handleCreaturesUpdate(creatures));
  this.mpClient.on("resourcesUpdate", (resources) => this.handleResourcesUpdate(resources));
  
  // Conecta ao servidor
  this.mpClient.connect();
} else {
  // Spawn local (single-player)
  this.spawnResourcesAndCreatures();
}
```

### 2. Update (A cada frame)
```typescript
// Renderiza entidades remotas com interpolação
this.updateRemotePlayers(dt);      // Jogadores remotos
this.updateServerCreatures(dt);    // Criaturas do servidor
this.updateServerResources(dt);    // Recursos do servidor
```

### 3. Shutdown (Limpeza)
```typescript
shutdown(): void {
  // Desconecta WebSocket
  if (this.mpClient) {
    this.mpClient.disconnect();
  }
  
  // Limpa referências
  this.remotePlayers.clear();
  this.serverCreatures.clear();
  this.serverResources.clear();
}
```

## Remoção Automática de Entidades

### Quando uma criatura morre/é capturada:

1. Servidor remove da lista de criaturas ativas
2. Próximo `creaturesUpdate` não inclui a criatura
3. Cliente detecta a ausência e chama `destroyServerCreatureSprite()`
4. Sprite é destruído sem delay (conforme especificação)

**Mesmo fluxo para recursos coletados.**

## Resolução de Conflitos

### O que acontece se...

**A criatura foi movida para fora da tela no servidor?**
- Sprite continua renderizado localmente
- Quando `creaturesUpdate` chegar, posição será atualizada corretamente

**O cliente recebe ataques de outras criaturas?**
- Se modo multiplayer: HP é sincronizado via `attackResult` do servidor
- Feedback visual é exibido imediatamente

**O servidor demora a enviar atualização?**
- Interpolação continua movimentando entidades suavemente
- Quando update chegar, `targetX/targetY` é atualizado

## Performance & Otimizações

### Render Distance (Jogadores remotos)
```typescript
private readonly remotePlayerRenderDistance = 800;
```
- Jogadores muito distantes não são renderizados
- Reduz chamadas de GPU

### Depth Layers
```
10 = Jogadores remotos (sprites)
5  = Criaturas selvagens (sprites)
4  = Recursos (sprites)
```
- Garante ordem de renderização correta

## Testando Multiplayer

### 1. Inicie o servidor
```bash
cd server
npm run dev
```

### 2. Abra múltiplas abas do cliente
```
http://localhost:5173/?mp=1&name=Player1
http://localhost:5173/?mp=1&name=Player2
```

### 3. Observe:
- ✅ Jogadores remotos aparecem com nomes
- ✅ Criaturas aparecem sincronizadas
- ✅ Recursos aparecem sincronizados
- ✅ Movimento é suave (interpolação)
- ✅ HP atualiza conforme servidor envia

### 4. Debug
Abra console e procure por logs:
```
[MP] Criaturas atualizadas: 5 criaturas no servidor
[MP] Recursos atualizados: 3 recursos no servidor
[MP] Conectado com ID: ...
```

## Próximos Passos

### MVP Multiplayer Completo
- [x] Sincronizar criaturas do servidor
- [x] Sincronizar recursos do servidor
- [x] Sincronizar jogadores remotos
- [x] Interpolação suave
- [ ] Sincronizar dano/combate
- [ ] Sincronizar captura
- [ ] Sincronizar extração com múltiplos jogadores

### Futuro
- [ ] Dead Reckoning (predição de movimento)
- [ ] Lag compensation
- [ ] Rollback/resync em caso de dessincronização
- [ ] Validação de colisões no servidor
