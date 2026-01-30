# Sistema de Captura de Criaturas - Documentação

## Visão Geral

O sistema de captura foi implementado de forma **server-authoritative**, ou seja, toda a lógica de validação e cálculo ocorre no servidor. O cliente apenas envia intents de captura e recebe os resultados.

## Arquitetura

```
Cliente                    Servidor
  │                          │
  │  capture_attempt         │
  ├────────────────────────►│
  │  (targetId, ballType)   │
  │                         │
  │                         │ 1. Validar jogador/criatura
  │                         │ 2. Verificar distância
  │                         │ 3. Verificar inventário de pokébolas
  │                         │ 4. Calcular chance de captura
  │                         │ 5. Rolar dado
  │                         │ 6. Aplicar resultado
  │                         │
  │  capture_result         │
  │◄────────────────────────┤
  │  (success, creature)    │
  │                         │
  │  creatures_update       │
  │◄────────────────────────┤
  │  (se sucesso)           │
```

## Fórmula de Captura

A chance de captura é calculada da seguinte forma:

```typescript
chance = ((baseChance + hpBonus - tierPenalty) * ballMultiplier) + ballFlatBonus

Onde:
- baseChance = 0.35 (35%)
- hpBonus = (1 - hpRatio) * 0.5
  - hpRatio = currentHp / maxHp
  - Quanto menor o HP, maior o bônus (até +50%)
- tierPenalty:
  - comum: 0%
  - perigosa: 5%
  - elite: 15%
- ballMultiplier e ballFlatBonus:
  - poke-ball-basic: 1.0x + 0%
  - poke-ball-precisa: 1.2x + 5%
  - poke-ball-ultra: 1.6x + 10%

Chance final é clamped entre 5% e 95%
```

### Exemplos de Cálculo

**Exemplo 1: Criatura comum com 50% HP usando pokébola básica**
```
baseChance = 0.35
hpBonus = (1 - 0.5) * 0.5 = 0.25
tierPenalty = 0
ballMultiplier = 1.0
ballFlatBonus = 0

chance = ((0.35 + 0.25 - 0) * 1.0) + 0 = 0.60 = 60%
```

**Exemplo 2: Criatura elite com 20% HP usando pokébola ultra**
```
baseChance = 0.35
hpBonus = (1 - 0.2) * 0.5 = 0.40
tierPenalty = 0.15
ballMultiplier = 1.6
ballFlatBonus = 0.10

chance = ((0.35 + 0.40 - 0.15) * 1.6) + 0.10 = 0.96 + 0.10 = 1.06
clamped = min(0.95, 1.06) = 0.95 = 95%
```

**Exemplo 3: Criatura perigosa com 100% HP usando pokébola precisa**
```
baseChance = 0.35
hpBonus = (1 - 1.0) * 0.5 = 0
tierPenalty = 0.05
ballMultiplier = 1.2
ballFlatBonus = 0.05

chance = ((0.35 + 0 - 0.05) * 1.2) + 0.05 = 0.36 + 0.05 = 0.41 = 41%
```

## Validações

Antes de processar a captura, o servidor valida:

1. **Criatura existe e está viva**
   - `creature.currentHp > 0`
   - Falha com: `creature_dead`

2. **Jogador tem pokébola**
   - `inventory.pokeballs.get(ballType) > 0`
   - Falha com: `no_pokeball`

3. **Distância está dentro do alcance**
   - `distance(player, creature) <= 150 pixels`
   - Falha com: `out_of_range`

4. **Criatura é válida**
   - Criatura existe no WorldState
   - Falha com: `invalid_target`

## Resultado da Captura

### Se Sucesso

1. **Criatura é removida do mundo**
   - `gameLoop.removeCreature(creatureId)`
   - Broadcast `CreaturesUpdateMessage` para todos os clientes

2. **Criatura é adicionada ao inventário temporário**
   ```typescript
   {
     instanceId: "captured-1738177234567-abc123",
     speciesId: "pyrognat", // Escolhido aleatoriamente do pool
     level: 3, // 1-5 para MVP
     tier: "comum",
     capturedAt: 1738177234567
   }
   ```

3. **Pokébola é consumida**
   - `inventory.pokeballs.set(ballType, count - 1)`

4. **Broadcast do resultado**
   - `CaptureResultMessage` enviada para todos

### Se Falha

1. **Criatura permanece no mundo**
   - Nenhuma alteração no WorldState

2. **Pokébola é consumida**
   - `inventory.pokeballs.set(ballType, count - 1)`

3. **Broadcast do resultado**
   - `CaptureResultMessage` com `success: false` e `failReason`

## Arquivos Implementados

### 1. `server/src/constants.ts`
Configurações de captura:
- `CAPTURE_CONFIG`: Chance base, multiplicadores, distância máxima
- `CAPTURE_BALL_MODIFIERS`: Modificadores por tipo de pokébola
- `CAPTURE_TIER_PENALTIES`: Penalidades por tier de criatura
- `CAPTURE_CREATURE_POOL`: Pool de espécies disponíveis

### 2. `server/src/systems/capture.ts`
Sistema principal de captura:
- `calculateCaptureChance()`: Calcula chance de captura
- `processCaptureIntent()`: Processa tentativa de captura
- `validateCaptureIntent()`: Valida antes de processar
- `createExpeditionInventory()`: Cria inventário inicial

### 3. `server/src/gameLoop.ts`
Integração com o game loop:
- `processCaptureIntent()`: Processa intent de captura
- `removeCreature()`: Remove criatura do combatState
- `getCombatState()`: Retorna estado para acesso externo

### 4. `server/src/index.ts`
Callbacks e broadcast:
- `onCaptureResult`: Processa captura com acesso ao inventário
- Broadcast de `CaptureResultMessage`
- Broadcast de `CreaturesUpdateMessage`

### 5. `server/src/messages.ts`
Protocolo WebSocket atualizado:
- `CaptureResultMessage`: Resultado da captura
- `CreaturesUpdateMessage`: Atualização de criaturas
- Novos `failReason`: `out_of_range`, `no_pokeball`, `creature_dead`

### 6. `server/src/types.ts`
Tipos do servidor (mantido sem alterações significativas)

## Protocolo de Mensagens

### Cliente → Servidor

```typescript
{
  type: "capture_attempt",
  targetId: "wild-3",
  ballType: "poke-ball-ultra" // opcional, default: "poke-ball-basic"
}
```

### Servidor → Cliente (Sucesso)

```typescript
{
  type: "capture_result",
  playerId: "player-1",
  targetId: "wild-3",
  success: true,
  capturedCreature: {
    instanceId: "captured-1738177234567-abc123",
    speciesId: "voltiger",
    level: 3
  }
}
```

### Servidor → Cliente (Falha)

```typescript
{
  type: "capture_result",
  playerId: "player-1",
  targetId: "wild-3",
  success: false,
  failReason: "escaped" // ou "out_of_range", "no_pokeball", etc.
}
```

### Servidor → Cliente (Atualização de Criaturas)

```typescript
{
  type: "creatures_update",
  creatures: [
    {
      id: "wild-1",
      speciesId: "pyrognat",
      x: 300,
      y: 200,
      currentHp: 45,
      maxHp: 60,
      state: "idle"
    }
    // ... outras criaturas
  ]
}
```

## Inventário de Expedição

Cada jogador possui um inventário temporário durante a expedição:

```typescript
{
  pokeballs: Map<BallType, number> {
    "poke-ball-basic" => 5,
    "poke-ball-precisa" => 2,
    "poke-ball-ultra" => 1
  },
  capturedCreatures: [
    {
      instanceId: "captured-...",
      speciesId: "pyrognat",
      level: 2,
      tier: "comum",
      capturedAt: 1738177234567
    }
  ]
}
```

Este inventário é:
- Inicializado quando o jogador entra na sala
- Atualizado a cada captura (sucesso ou falha)
- Usado para validar tentativas de captura
- Persistido ao final da expedição (quando o jogador extrai)

## Fluxo de Integração com Cliente

Para integrar o sistema de captura no cliente (`ExpeditionScene.ts`):

1. **Remover lógica local de captura**
   - Deletar `calculateCatchRate()`
   - Deletar `attemptCapture()`

2. **Enviar intent de captura**
   ```typescript
   multiplayerClient.sendCaptureAttempt(creatureId, ballType);
   ```

3. **Escutar resultados**
   ```typescript
   multiplayerClient.on("capture_result", (result) => {
     if (result.success) {
       // Mostrar feedback visual de sucesso
       // Remover criatura da cena (já foi removida do servidor)
       this.showCaptureSuccess(result.capturedCreature);
     } else {
       // Mostrar feedback visual de falha
       this.showCaptureFailed(result.failReason);
     }
   });

   multiplayerClient.on("creatures_update", (creatures) => {
     // Atualizar criaturas na cena
     this.syncCreatures(creatures);
   });
   ```

## Testes

Para testar o sistema de captura:

1. **Iniciar o servidor**
   ```bash
   cd server
   npm run build
   npm start
   ```

2. **Conectar cliente e enviar intent**
   ```javascript
   ws.send(JSON.stringify({
     type: "capture_attempt",
     targetId: "wild-0",
     ballType: "poke-ball-basic"
   }));
   ```

3. **Verificar logs do servidor**
   ```
   [Capture] Sucesso! Jogador player-1 capturou pyrognat (comum)
   | Chance: 65.0% | Roll: 42.3%
   ```

## Próximos Passos

- [ ] Integrar sistema de captura no cliente (`ExpeditionScene.ts`)
- [ ] Adicionar animações de pokébola no cliente
- [ ] Implementar persistência de criaturas capturadas no Firebase
- [ ] Adicionar sistema de XP e evolução de criaturas
- [ ] Implementar mecânica de captura PvP (roubar criaturas de outros jogadores)

## Notas de Balanceamento

As configurações atuais foram calibradas para:
- Taxa de captura média de ~50% com criaturas em HP cheio
- Taxa de captura de ~80-90% com criaturas em HP crítico (< 20%)
- Criaturas elite são significativamente mais difíceis de capturar
- Pokébolas melhores fazem diferença real (+10-20% de chance)

Estes valores podem ser ajustados em `server/src/constants.ts` sem alterar código.
