# Plano de Refatoração do Sistema Multiplayer

**Data**: 29/01/2026
**Status**: Quick Fixes Aplicados ✅ - Prompts Prontos para Implementação

---

## ✅ Quick Fixes Já Aplicados

Os seguintes fixes de baixo esforço e alto impacto foram implementados:

1. **RoomId por Mapa** ✅
   - Cliente agora usa `mapConfig.id` como roomId
   - Cada mapa tem sua própria sala

2. **Reset Completo de Sala** ✅
   - `removeRoom()` agora limpa todos os recursos
   - Lógica de join reseta sala terminada corretamente

3. **Broadcast Mais Frequente** ✅
   - `STATE_BROADCAST_RATE` reduzido de 3 para 2 ticks

4. **Mensagem Específica de Movimento** ✅
   - Nova mensagem `player_move` para atualizações individuais
   - Mais eficiente que broadcast completo

5. **Visual de Ataque com Criatura Ativa** ✅
   - Predição local agora usa cores e visual da criatura ativa
   - Suporte a ataques melee (arco visual) e ranged (projétil colorido)
   - Partículas e efeitos visuais incluídos

---

## 📋 Diagnóstico dos Problemas

### 1. 🔴 Ataques Básicos Genéricos (Sem Animações das Criaturas)

**Problema**: O ataque básico no multiplayer é sempre um projétil genérico laranja, sem usar os ataques específicos das criaturas ativas do jogador.

**Causa Raiz Identificada**:
- O servidor processa ataques de forma genérica em `server/src/systems/combat.ts`
- Não há informação sobre qual criatura está ativa no jogador
- O cliente envia apenas `targetX, targetY`, não envia informações da criatura ativa
- O projétil criado no servidor usa configurações fixas (`COMBAT_CONFIG.projectileDamage`)

**Código Problemático**:
```typescript
// server/src/systems/combat.ts - linha 123-191
export function processAttackIntent(...) {
  // Cria projétil com dano fixo, sem considerar criatura ativa
  const projectile = createProjectile(
    playerId,
    true,
    player.x, player.y,
    velocityX, velocityY,
    COMBAT_CONFIG.projectileDamage, // Sempre 20 de dano
    COMBAT_CONFIG.projectileLifetime
  );
}
```

```typescript
// src/scenes/ExpeditionScene.ts - linha 1735-1759
if (this.mpClient) {
  this.mpClient.sendAttack(targetX, targetY);
  // Cria projétil local genérico, não usa criatura ativa
  const sprite = this.add.circle(this.player.x, this.player.y, 4, 0xf97316);
}
```

---

### 2. 🔴 Replicação de Players Não Funciona Bem

**Problema**: Jogadores remotos às vezes aparecem, mas não correspondem ao movimento real.

**Causas Identificadas**:

1. **Broadcast de estado não inclui posições atualizadas**:
   - `broadcastState()` é chamado no `onBroadcastState` callback
   - Mas o `STATE_BROADCAST_RATE = 3` (a cada 3 ticks = ~150ms)
   - Movimento é enviado imediatamente mas outros clientes só recebem no próximo broadcast

2. **Interpolação pode estar desatualizada**:
   - Cliente armazena `targetX/targetY` mas o servidor pode ter enviado posição antiga
   - Não há timestamp nas mensagens para ordenar atualizações

3. **Posição inicial aleatória no servidor**:
   ```typescript
   // server/src/index.ts - linha 778-779
   x: Math.random() * 800 + 80,
   y: Math.random() * 400 + 80,
   ```
   - Cliente pode ter posição diferente do servidor

**Código Problemático**:
```typescript
// server/src/index.ts - linha 840-841
// Broadcast imediato para movimento (responsividade)
broadcastState(currentRoom);
// Mas broadcastState não inclui world, apenas players
```

---

### 3. 🔴 Bug "Partida Já Terminou" Continua

**Problema**: Mesmo após correções, o erro persiste. Além disso, todos os mapas usam a mesma room.

**Causas Identificadas**:

1. **RoomId hardcoded no cliente**:
   ```typescript
   // src/scenes/ExpeditionScene.ts - linha 845
   this.mpClient = new MultiplayerClient("floresta-celestial", name);
   // SEMPRE usa "floresta-celestial" independente do mapa selecionado!
   ```

2. **Lógica de reset de sala incompleta**:
   ```typescript
   // server/src/index.ts - linha 754-762
   if (room.matchState === "finished") {
     removeRoom(room.id);
     room = getOrCreateRoom(msg.roomId);
   }
   // Problema: removeRoom pode não limpar completamente
   // E getOrCreateRoom pode retornar sala com estado inconsistente
   ```

3. **Sala não é removida quando todos saem após partida terminar**:
   ```typescript
   // server/src/index.ts - linha 910-917
   if (currentRoom.clients.size === 0) {
     stopRoomGameLoop(currentRoom);
     // Só remove se partida acabou, mas sala pode ficar "zumbi"
     if (currentRoom.matchState === "finished") {
       removeRoom(currentRoom.id);
     }
   }
   ```

---

### 4. 🟡 Implementações Duplicadas (Single vs Multiplayer)

**Problema**: Há código duplicado para single-player e multiplayer, causando inconsistências.

**Exemplos**:
- `wildCreatures` (local) vs `serverCreatures` (remoto)
- Lógica de ataque local vs servidor
- Spawn local vs spawn do servidor
- Timer local vs timer do servidor

---

## 🎯 Plano de Implementação

### Fase 1: Corrigir Gerenciamento de Rooms (Crítico)

**Objetivo**: Garantir que cada mapa tenha sua própria room e que rooms sejam limpas corretamente.

**Tarefas**:
1. Modificar cliente para usar mapId como roomId
2. Implementar limpeza completa de rooms
3. Adicionar validação de estado de sala antes de permitir join

---

### Fase 2: Corrigir Sincronização de Players (Crítico)

**Objetivo**: Garantir que posições de jogadores sejam sincronizadas em tempo real.

**Tarefas**:
1. Incluir timestamp em mensagens de movimento
2. Melhorar frequência de broadcast de posições
3. Sincronizar posição inicial do cliente com servidor

---

### Fase 3: Implementar Ataques com Criaturas Ativas (Importante)

**Objetivo**: Usar dados da criatura ativa do jogador para ataques.

**Tarefas**:
1. Enviar creatureId junto com ataque
2. Servidor usar stats da criatura para calcular dano
3. Cliente renderizar ataque com visual da criatura

---

### Fase 4: Unificar Implementações (Melhoria)

**Objetivo**: Remover duplicação de código entre single e multiplayer.

**Tarefas**:
1. Usar serverCreatures como fonte única
2. Abstrair lógica de ataque
3. Unificar sistema de spawns

---

## 📝 Prompts de Implementação

### PROMPT 1: Corrigir Gerenciamento de Rooms

```
Implemente as seguintes correções no sistema de gerenciamento de rooms do servidor multiplayer:

1. **No cliente** (`src/scenes/ExpeditionScene.ts`):
   - Modificar a criação do MultiplayerClient para usar o mapId atual como roomId
   - O mapId está disponível em `this.mapConfig.id`
   - Linha aproximada: 845

2. **No servidor** (`server/src/index.ts`):
   - Criar função `cleanupRoom(roomId)` que:
     - Para o gameLoop
     - Desconecta todos os clientes com mensagem de erro
     - Remove a sala do Map `rooms`
     - Limpa todas as referências
   
   - Modificar `removeRoom()` para usar `cleanupRoom()`
   
   - Na lógica de join (linha 751-818):
     - Se `room.matchState === "finished"`, sempre criar nova sala
     - Não importa se há jogadores ou não
     - Usar `cleanupRoom()` antes de criar nova
   
   - Adicionar cleanup automático de salas vazias após 30 segundos:
     - Quando último jogador sai, iniciar timer
     - Se ninguém entrar em 30s, remover sala

3. **Testes**:
   - Verificar que mapas diferentes criam rooms diferentes
   - Verificar que após partida terminar, nova partida pode ser criada
   - Verificar que salas vazias são limpas após timeout

Mantenha compatibilidade com o código existente e não quebre funcionalidades.
```

---

### PROMPT 2: Corrigir Sincronização de Players

```
Implemente as seguintes correções para sincronização de jogadores no multiplayer:

1. **No servidor** (`server/src/index.ts`):
   - Modificar `broadcastState()` para SEMPRE incluir posições atualizadas de todos os jogadores
   - Adicionar campo `lastUpdate: number` (timestamp) em cada player no broadcast
   
   - Modificar handler de "move" (linha 824-842):
     - Enviar update específico de posição para todos os clientes imediatamente
     - Criar nova mensagem `player_move` com: `{ playerId, x, y, timestamp }`
     - Isso é mais eficiente que broadcast completo
   
   - Quando jogador entra na sala:
     - Enviar posição inicial do servidor para o cliente que entrou
     - Não deixar cliente usar posição aleatória própria

2. **No cliente** (`src/services/multiplayerClient.ts`):
   - Adicionar handler para mensagem `player_move`
   - Atualizar apenas o jogador específico, não todos

3. **No cliente** (`src/scenes/ExpeditionScene.ts`):
   - Modificar `syncRemotePlayers()` para usar timestamp se disponível
   - Descartar updates antigos (se timestamp < último recebido)
   - Quando receber `joined`, usar posição do servidor como posição inicial do player local
   - Adicionar handler para `player_move` que atualiza apenas um jogador

4. **No servidor** (`server/src/messages.ts`):
   - Criar `createPlayerMoveMessage(playerId, x, y, timestamp)`

5. **Testes**:
   - Abrir 2 clientes e verificar que movimento é sincronizado em tempo real
   - Verificar que posição inicial é a mesma em todos os clientes
   - Verificar que não há "teleporte" ou dessincronização

Mantenha compatibilidade com o código existente.
```

---

### PROMPT 3: Implementar Ataques com Criaturas Ativas

```
Implemente ataques que usam os dados da criatura ativa do jogador:

1. **No cliente** (`src/services/multiplayerClient.ts`):
   - Modificar `sendAttack()` para aceitar parâmetros adicionais:
     ```typescript
     sendAttack(
       targetX: number, 
       targetY: number, 
       creatureId?: string,
       attackType?: "basic" | "special"
     ): void
     ```

2. **No cliente** (`src/scenes/ExpeditionScene.ts`):
   - Modificar `tryBasicAttack()` para enviar creatureId da criatura ativa
   - Usar `this.activeCreatureInstanceId` ou `this.activeCreatureDef.id`
   - Criar projétil visual usando tema da criatura ativa (já existe código para isso)

3. **No servidor** (`server/src/index.ts`):
   - Modificar `AttackMessage` para incluir `creatureId?: string`
   - Modificar `createAttackIntent()` para passar creatureId

4. **No servidor** (`server/src/types.ts`):
   - Adicionar `activeCreatureId?: string` em `PlayerPresence`

5. **No servidor** (`server/src/systems/combat.ts`):
   - Modificar `processAttackIntent()` para:
     - Receber creatureId opcional
     - Se creatureId fornecido, buscar stats da criatura
     - Calcular dano baseado nos stats
     - Por enquanto, usar lookup simples (pode expandir depois)
   
   - Criar constante `CREATURE_ATTACK_STATS`:
     ```typescript
     const CREATURE_ATTACK_STATS: Record<string, { damage: number, speed: number }> = {
       "pyrognat": { damage: 25, speed: 450 },
       "aquaryl": { damage: 20, speed: 400 },
       "verdant": { damage: 22, speed: 380 },
       "voltiger": { damage: 28, speed: 500 }
     };
     ```

6. **Testes**:
   - Verificar que dano varia conforme criatura ativa
   - Verificar que projétil visual usa cor/tema da criatura
   - Verificar que funciona em multiplayer

Mantenha compatibilidade com ataques sem creatureId (usar valores padrão).
```

---

### PROMPT 4: Unificar Implementações Single/Multiplayer

```
Refatore o código para unificar implementações de single-player e multiplayer:

1. **Princípio**: Usar servidor como fonte de verdade, mesmo em single-player
   - Em single-player, rodar um "servidor local" em memória
   - Ou: sempre usar estruturas do servidor, mesmo offline

2. **No cliente** (`src/scenes/ExpeditionScene.ts`):
   - Remover `wildCreatures` e usar apenas `serverCreatures`
   - Em single-player, popular `serverCreatures` localmente
   - Modificar todos os métodos que usam `wildCreatures`:
     - `updateEnemyAI()`
     - `handleInteractions()`
     - `updatePokeballProjectiles()`
     - `attemptCapture()`
     - etc.

3. **Criar abstração** (`src/game/worldState.ts`):
   ```typescript
   interface GameWorldState {
     creatures: Map<string, CreatureState>;
     resources: Map<string, ResourceState>;
     players: Map<string, PlayerState>;
     
     // Métodos
     getCreature(id: string): CreatureState | undefined;
     updateCreature(id: string, updates: Partial<CreatureState>): void;
     removeCreature(id: string): void;
     // etc.
   }
   ```

4. **Modificar ExpeditionScene**:
   - Usar `GameWorldState` ao invés de arrays separados
   - Injetar implementação local ou remota conforme modo

5. **Benefícios**:
   - Código mais limpo e testável
   - Menos bugs de sincronização
   - Mais fácil adicionar features

NOTA: Esta é uma refatoração maior. Pode ser feita incrementalmente:
- Fase 4a: Unificar criaturas
- Fase 4b: Unificar recursos
- Fase 4c: Unificar jogadores

Comece pela Fase 4a apenas.
```

---

## 🔧 Correções Rápidas (Quick Fixes)

Se não houver tempo para refatoração completa, aplicar estas correções mínimas:

### Quick Fix 1: RoomId por Mapa
```typescript
// src/scenes/ExpeditionScene.ts - linha 845
// DE:
this.mpClient = new MultiplayerClient("floresta-celestial", name);
// PARA:
const roomId = this.mapConfig?.id ?? "default-room";
this.mpClient = new MultiplayerClient(roomId, name);
```

### Quick Fix 2: Forçar Reset de Sala
```typescript
// server/src/index.ts - linha 754-762
// Adicionar após removeRoom():
rooms.delete(msg.roomId); // Garantir remoção do Map
```

### Quick Fix 3: Broadcast Mais Frequente
```typescript
// server/src/constants.ts - linha 30
// DE:
export const STATE_BROADCAST_RATE = 3;
// PARA:
export const STATE_BROADCAST_RATE = 1; // A cada tick
```

---

## 📊 Priorização

| Tarefa | Impacto | Esforço | Prioridade |
|--------|---------|---------|------------|
| Quick Fix 1 (RoomId) | Alto | Baixo | 🔴 P0 |
| Quick Fix 2 (Reset) | Alto | Baixo | 🔴 P0 |
| Prompt 1 (Rooms) | Alto | Médio | 🟠 P1 |
| Prompt 2 (Sync) | Alto | Médio | 🟠 P1 |
| Quick Fix 3 (Broadcast) | Médio | Baixo | 🟡 P2 |
| Prompt 3 (Ataques) | Médio | Médio | 🟡 P2 |
| Prompt 4 (Unificar) | Baixo | Alto | 🟢 P3 |

---

## 🧪 Plano de Testes

### Teste 1: Múltiplos Mapas
1. Abrir cliente 1 no mapa "floresta-celestial"
2. Abrir cliente 2 no mapa "cavernas-cristalinas"
3. Verificar que estão em rooms diferentes
4. Verificar que não veem um ao outro

### Teste 2: Reset de Partida
1. Entrar em uma sala
2. Aguardar partida terminar
3. Todos saírem
4. Entrar novamente
5. Verificar que nova partida começa do zero

### Teste 3: Sincronização de Movimento
1. Abrir 2 clientes na mesma sala
2. Mover jogador 1
3. Verificar que jogador 2 vê movimento em tempo real
4. Mover jogador 2
5. Verificar que jogador 1 vê movimento em tempo real

### Teste 4: Ataques com Criatura
1. Selecionar criatura específica
2. Atacar
3. Verificar que dano corresponde à criatura
4. Verificar visual do projétil

---

## 📁 Arquivos a Modificar

### Servidor
- `server/src/index.ts` - Gerenciamento de rooms, sync de players
- `server/src/constants.ts` - Configurações de broadcast
- `server/src/messages.ts` - Novas mensagens
- `server/src/systems/combat.ts` - Ataques com criaturas
- `server/src/types.ts` - Tipos atualizados

### Cliente
- `src/scenes/ExpeditionScene.ts` - RoomId, sync, ataques
- `src/services/multiplayerClient.ts` - Novos handlers
- `src/game/worldState.ts` (novo) - Abstração de estado

---

## ⏱️ Estimativa de Tempo

| Fase | Tempo Estimado |
|------|----------------|
| Quick Fixes | 15 min |
| Prompt 1 | 1-2 horas |
| Prompt 2 | 1-2 horas |
| Prompt 3 | 2-3 horas |
| Prompt 4 | 4-6 horas |
| **Total** | **8-13 horas** |

---

## 🚀 Próximos Passos

1. **Imediato**: Aplicar Quick Fixes 1 e 2
2. **Curto Prazo**: Implementar Prompts 1 e 2
3. **Médio Prazo**: Implementar Prompt 3
4. **Longo Prazo**: Considerar Prompt 4 para v2.0

---

---

## 📋 Resumo das Mudanças Aplicadas

### Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `src/scenes/ExpeditionScene.ts` | RoomId por mapa, visual de ataque com criatura, handler playerMove |
| `src/services/multiplayerClient.ts` | Interface PlayerMove, evento playerMove |
| `server/src/index.ts` | Reset completo de sala, mensagem player_move, lógica de join melhorada |
| `server/src/messages.ts` | Interface PlayerMoveMessage, função createPlayerMoveMessage |
| `server/src/constants.ts` | STATE_BROADCAST_RATE = 2 |

### Problemas Resolvidos

1. ✅ **Mapas diferentes agora criam rooms diferentes**
2. ✅ **Salas terminadas são resetadas corretamente**
3. ✅ **Movimento de jogadores é sincronizado mais rapidamente**
4. ✅ **Ataques usam visual da criatura ativa (cores, melee/ranged)**

### Problemas Pendentes (Requerem Prompts Adicionais)

1. ⚠️ **Dano baseado em stats da criatura** - Servidor ainda usa dano fixo
2. ⚠️ **Unificação single/multiplayer** - Código ainda tem duplicação

---

**Autor**: Claude (Cursor AI)
**Revisão**: Completa
**Última Atualização**: 29/01/2026
