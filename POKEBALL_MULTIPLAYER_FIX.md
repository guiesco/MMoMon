# Correção: Interação de Pokébolas com Inimigos no Multiplayer

## Problema Identificado

A interação entre pokébolas e inimigos no modo multiplayer não estava executando as mesmas ações do modo single player, resultando em comportamento inconsistente.

## Diferenças Encontradas

### Single Player (`attemptCapture`)
Quando uma pokébola colide com uma criatura:
1. ✅ Incrementa `telemetry.creaturesEncountered`
2. ✅ Calcula chance de captura localmente
3. ✅ Registra `totalCaptureChanceSum` para média
4. ✅ Incrementa `captureSuccesses` ou `captureFailures`
5. ✅ Mostra feedback visual apropriado
6. ✅ Remove criatura se sucesso
7. ✅ **Torna criatura agressiva (`aiState = "chasing"`) se falha**
8. ✅ Adiciona criatura capturada ao inventário
9. ✅ Mostra log detalhado com chance e roll

### Multiplayer (`handleCaptureResult`) - ANTES
Quando o servidor responde com resultado:
1. ❌ **NÃO incrementava** `telemetry.creaturesEncountered`
2. ❌ **NÃO registrava** `totalCaptureChanceSum`
3. ❌ **NÃO incrementava** `captureSuccesses` em caso de sucesso
4. ✅ Incrementava `captureFailures` se falha
5. ✅ Mostrava feedback visual
6. ✅ Removia criatura se sucesso
7. ❌ **NÃO tornava criatura agressiva se falha** - **PROBLEMA PRINCIPAL**
8. ✅ Adicionava criatura capturada ao inventário
9. ❌ **Servidor não enviava** `captureChance` e `roll`

## Correções Implementadas

### 1. Cliente (`ExpeditionScene.ts`)

**Linha ~5553**: Adicionado ao `handleCaptureResult()`:

```typescript
// Incrementa contador de criaturas encontradas (igual ao single player)
this.telemetry.creaturesEncountered += 1;

// Registra chance de captura para cálculo de média (se fornecido pelo servidor)
if (result.captureChance !== undefined) {
  this.telemetry.totalCaptureChanceSum += result.captureChance;
}

// Log de tentativa de captura (similar ao single player)
console.log("[CAPTURA MP] Resultado", {
  targetId: result.targetId,
  chance: result.captureChance ? (result.captureChance * 100).toFixed(1) + "%" : "N/A",
  roll: result.roll ? (result.roll * 100).toFixed(1) + "%" : "N/A",
  success: result.success,
  failReason: result.failReason
});
```

**Em caso de sucesso:**
```typescript
this.telemetry.captureSuccesses += 1; // NOVO: incrementa sucessos
```

**Em caso de falha:**
```typescript
// IMPORTANTE: A criatura fica agressiva após falha na captura (igual ao single player)
creature.aiState = "chasing";
this.worldState.updateCreature(result.targetId, { aiState: "chasing" });
```

**Linha ~4565**: Simplificado envio de tipo de pokébola (não precisa mais converter):
```typescript
// Envia tentativa de captura com o tipo de bola original (servidor espera o formato do cliente)
this.mpClient.sendCaptureAttempt(creatureId, pb.ballType);
```

### 2. Servidor (`server/src/messages.ts`)

**Interface `CaptureResultMessage`**: Adicionados campos obrigatórios:
```typescript
export interface CaptureResultMessage extends BaseMessage {
  type: "capture_result";
  playerId: ClientId;
  targetId: CreatureId;
  success: boolean;
  /** Chance calculada de captura (0.0 a 1.0) */ // NOVO
  captureChance: number;                          // NOVO
  /** Valor rolado no dado (0.0 a 1.0) */        // NOVO
  roll: number;                                   // NOVO
  capturedCreature?: { ... };
  failReason?: ...;
}
```

**Função `createCaptureResultMessage`**: Parâmetros atualizados:
```typescript
export function createCaptureResultMessage(
  playerId: ClientId,
  targetId: CreatureId,
  success: boolean,
  captureChance: number,  // NOVO parâmetro obrigatório
  roll: number,           // NOVO parâmetro obrigatório
  options?: { ... }
): CaptureResultMessage
```

### 3. Servidor (`server/src/index.ts`)

**Callback `onCaptureResult` (linha ~552)**: Passando valores de chance e roll:
```typescript
const captureMsg = createCaptureResultMessage(
  playerId,
  targetId,
  result.success,
  result.captureChance,  // NOVO: passa chance calculada
  result.roll,           // NOVO: passa valor do roll
  {
    capturedCreature: ...,
    failReason: ...
  }
);
```

**Mapeamento de projéteis (linha ~421)**: Corrigido para incluir todos os campos:
```typescript
combatState.projectiles.map(p => ({
  id: p.id,
  ownerId: p.ownerId,
  isPlayerProjectile: p.isPlayerProjectile,
  x: p.x,
  y: p.y,
  startX: p.startX,      // NOVO
  startY: p.startY,      // NOVO
  velocityX: p.velocityX,
  velocityY: p.velocityY,
  damage: p.damage,
  lifetime: p.lifetime,
  maxDistance: p.maxDistance  // NOVO
}))
```

### 4. Cliente (`multiplayerClient.ts`)

**Interface `CaptureResult`**: Adicionados campos:
```typescript
export interface CaptureResult {
  playerId: string;
  targetId: string;
  success: boolean;
  captureChance: number;  // NOVO
  roll: number;           // NOVO
  capturedCreature?: { ... };
  failReason?: string;
}
```

**Parser de mensagem (linha ~524)**: Propagando novos campos:
```typescript
case "capture_result":
  this.events.captureResult?.({
    playerId: msg.playerId,
    targetId: msg.targetId,
    success: msg.success,
    captureChance: msg.captureChance,  // NOVO
    roll: msg.roll,                    // NOVO
    capturedCreature: msg.capturedCreature,
    failReason: msg.failReason
  });
```

**Tipo `BallType`**: Expandido para aceitar ambos os formatos:
```typescript
export type BallType = "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra" | "pokeball" | "greatball" | "ultraball" | "masterball";
```

**Assinatura `sendCaptureAttempt`**: Valor padrão corrigido:
```typescript
sendCaptureAttempt(targetId: string, ballType: BallType = "poke-ball-basic"): void
```

## Impacto

### Comportamento Corrigido
1. ✅ **Criaturas agora ficam agressivas após falha de captura no multiplayer**
2. ✅ **Telemetria completa** - estatísticas de captura agora batem entre single/multiplayer
3. ✅ **Logs detalhados** - chance e roll são exibidos no console
4. ✅ **Dados completos do servidor** - cliente recebe todas as informações da tentativa

### Melhorias de UX
- **Feedback consistente**: Jogadores veem o mesmo comportamento em ambos os modos
- **IA reativa**: Criaturas que escapam agora perseguem o jogador (mais desafiador)
- **Debug melhorado**: Logs mostram chance exata e roll para troubleshooting

## Testes Recomendados

1. **Teste de Captura Falhada**
   - Jogar multiplayer
   - Tentar capturar criatura com HP alto (baixa chance)
   - Verificar se criatura fica vermelha (agressiva) após falha
   - Verificar se criatura persegue jogador

2. **Teste de Estatísticas**
   - Capturar múltiplas criaturas no multiplayer
   - Verificar se contadores de telemetria batem:
     - `creaturesEncountered` aumenta a cada tentativa
     - `captureSuccesses` aumenta quando captura
     - `captureFailures` aumenta quando falha
     - `totalCaptureChanceSum` acumula para média

3. **Teste de Tipos de Pokébola**
   - Testar com `poke-ball-basic`
   - Testar com `poke-ball-precisa`
   - Testar com `poke-ball-ultra`
   - Verificar se servidor processa corretamente

4. **Teste de Console**
   - Abrir console do navegador
   - Tentar captura
   - Verificar se aparece log `[CAPTURA MP] Resultado` com chance e roll

## Arquivos Modificados

- ✅ `src/scenes/ExpeditionScene.ts` - Handler de resultado de captura
- ✅ `src/services/multiplayerClient.ts` - Interface e tipos
- ✅ `server/src/messages.ts` - Protocolo de mensagem
- ✅ `server/src/index.ts` - Broadcast de resultado e projéteis
- ✅ Servidor recompilado com sucesso

## Próximos Passos

1. Testar em ambiente multiplayer real
2. Verificar se comportamento agora está idêntico ao single player
3. Se necessário, ajustar constantes de agressividade das criaturas
