# Guia de Debug e Telemetria Multiplayer

## 🔍 Logs Adicionados

### Servidor

#### 1. Logs de IA (server/src/systems/combat.ts)
**Frequência**: A cada 100 ticks (~5 segundos)

```
[AI] Tick 100 | Jogadores vivos: 2 | Criaturas: 15 | deltaTime: 0.0500s
[AI]   Jogador 12345678... em (450, 320)
[AI]   Jogador 87654321... em (600, 400)
[AI]   wild-0 (melee): dist=150px, state=chasing, pos=(400, 350) (moveu 4.0px), detection=150px, attack=50px
[AI]   wild-1 (ranged): dist=200px, state=idle, pos=(700, 500) (parado), detection=200px, attack=150px
```

**O que verificar**:
- ✅ Jogadores vivos aparecem na lista
- ✅ Criaturas mostram estado correto (idle/chasing/attacking)
- ✅ Criaturas estão se movendo (moveu Xpx)
- ✅ Distância ao jogador está correta

#### 2. Logs de Movimento (server/src/index.ts)
**Frequência**: ~5% das mensagens de movimento

```
[Move] 12345678... -> (450, 320)
```

**O que verificar**:
- ✅ Posições estão sendo recebidas do cliente
- ✅ Coordenadas parecem razoáveis (dentro do mapa)

#### 3. Logs de Registro de Jogadores (server/src/gameLoop.ts)

```
[GameLoop] Jogador 12345678... registrado em (450, 320) - Total: 2 jogadores
[GameLoop] Criatura wild-0 adicionada (comum, melee) - Total: 15
```

**O que verificar**:
- ✅ Jogadores estão sendo registrados no combatState
- ✅ Criaturas estão sendo adicionadas ao combatState

#### 4. Logs de Erro

```
[GameLoop] ⚠️ Tentando atualizar posição de jogador não registrado: 12345678...
[GameLoop]   Jogadores registrados: 87654321, 11111111
```

**O que verificar**:
- ❌ Se este log aparecer, há um problema de sincronização

---

### Cliente

#### 1. Logs de Movimento de Players (ExpeditionScene.ts)
**Frequência**: ~5% das mensagens recebidas

```
[MP:Move] 12345678... | Servidor: (450, 320) | Cliente: (440, 315) | Diff: 11px
```

**O que verificar**:
- ✅ Diff deve ser pequeno (<50px em condições normais)
- ❌ Se Diff for muito grande (>100px), há lag ou dessincronização

#### 2. Logs de Criaturas (ExpeditionScene.ts)
**Frequência**: ~10% dos updates

```
[MP:Creatures] Update: 15 criaturas do servidor
[MP:Creatures]   wild-0 (melee) | Servidor: (400, 350) | Cliente: (395, 348) | Diff: 5px | HP: 30/30 | State: chasing
```

**O que verificar**:
- ✅ Diff deve ser pequeno (<30px)
- ✅ State deve mudar (idle → chasing → attacking)
- ✅ HP deve diminuir quando atacado

#### 3. Logs de Descarte

```
[MP:Move] Descartando update antigo para 12345678...
```

**O que verificar**:
- ⚠️ Se aparecer frequentemente, pode indicar problemas de rede

---

## 📊 Painel de Debug Visual (F1)

Pressione **F1** no jogo para abrir o painel de debug. Em modo multiplayer, mostra:

```
=== PAINEL DE DEBUG (F1 para ocultar) ===
Tempo: 45s / 240s
Recursos: 5 (6.67/min)
Criaturas: 2/8
Capturas: 1/3 (33.3%)
Chance Média: 45.0%
Combate: 5 encontros
Dano: 120 causado
Projéteis: 15
Status: EXPLORING

=== MULTIPLAYER ===
Modo: ONLINE
ClientID: 12345678...
Players: 1 remotos
Criaturas (WS): 15
Recursos (WS): 20

=== INTERPOLAÇÃO ===
Criatura #1: diff=5px
  current: (395, 348)
  target:  (400, 350)
  state:   chasing
```

**O que verificar**:
- ✅ `Players` deve mostrar jogadores remotos
- ✅ `Criaturas (WS)` deve ser > 0
- ✅ `diff` deve ser pequeno e diminuindo
- ✅ `state` deve mudar conforme IA

---

## 🐛 Diagnóstico de Problemas

### Problema: IA não persegue jogadores

**Verificar no servidor**:
1. `[AI] Jogadores vivos: X` - X deve ser > 0
2. `dist=XXXpx` - deve ser menor que `detection=XXXpx`
3. `state=chasing` - deve aparecer quando perto

**Possíveis causas**:
- ❌ Jogador não registrado no combatState
- ❌ Posição do jogador não atualizada
- ❌ Criaturas não adicionadas ao combatState

### Problema: Movimento com delay/glitching

**Verificar no cliente**:
1. `Diff: XXpx` - se muito grande (>100px), há lag
2. Frequência de logs - se muito baixa, servidor não está enviando

**Possíveis causas**:
- ❌ Frequência de broadcast muito baixa
- ❌ Velocidade de interpolação muito alta/baixa
- ❌ Problemas de rede

### Problema: Dano não sincroniza

**Verificar no servidor**:
1. Logs de `onDamageApplied` devem aparecer
2. `HP: X/Y` deve diminuir nos logs de criatura

**Verificar no cliente**:
1. `[MP] Resultado de ataque recebido` deve aparecer
2. HP no painel de debug deve diminuir

---

## 🧪 Como Testar

### 1. Iniciar servidor com logs
```bash
cd server
DEBUG_AI=true npm run dev
```

### 2. Iniciar cliente com debug
```bash
npm run dev
# Abrir http://localhost:5173?mp=1&debug=1
```

### 3. Verificar logs
- **Servidor**: Terminal onde rodou `npm run dev`
- **Cliente**: DevTools (F12) → Console

### 4. Usar painel de debug
- Pressionar **F1** no jogo
- Verificar informações de multiplayer e interpolação

---

## 📈 Métricas Esperadas

### Servidor (20 ticks/s)
- Logs de IA a cada ~5 segundos
- Criaturas devem mover 80-120px/s (melee comum)
- Broadcast de criaturas a cada 100ms

### Cliente (60 FPS)
- Diff de posição < 30px em condições normais
- Interpolação deve convergir em ~200ms
- Updates de criaturas ~10x/segundo

---

## 🔧 Ajustes Rápidos

### Aumentar frequência de logs
```typescript
// server/src/systems/combat.ts
const shouldLog = DEBUG_AI && aiLogCounter % 20 === 0; // A cada 1 segundo
```

### Aumentar frequência de broadcast
```typescript
// server/src/index.ts
if (tickNumber % 1 === 0 && room.gameLoop) { // A cada tick (50ms)
```

### Aumentar velocidade de interpolação
```typescript
// src/scenes/ExpeditionScene.ts
const interpolationSpeed = 500; // Mais rápido
```

---

**Data**: 29 de Janeiro de 2026  
**Status**: ✅ Logs implementados  
**Próximo**: Testar e identificar problemas específicos
