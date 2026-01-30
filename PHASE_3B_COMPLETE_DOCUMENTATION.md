# Fase 3B: Fluxo de Ações Multiplayer - Documentação

## Resumo da Implementação

A Fase 3B foi implementada com sucesso. O `ExpeditionScene` agora suporta **modo dual** (single-player e multiplayer) com envio de intents ao servidor e aplicação de resultados.

## Arquitetura de Mudanças

### Padrão Implementado: Dual-Mode

```typescript
if (this.isMultiplayer && this.mpClient) {
  // Envia intent ao servidor
  this.mpClient.sendXXX(...)
  // Predição local
} else {
  // Lógica local (single-player)
}
```

### Propriedades Adicionadas

```typescript
private isMultiplayer = false;  // Flag ativada por ?mp=1
```

### Imports Adicionados

```typescript
import {
  MultiplayerClient,
  type RemotePlayer,
  type AttackResult,
  type CaptureResult,
  type RemoteResource,
  type ExtractionState,
  type MatchEvent,
  type PlayerDeath
} from "../services/multiplayerClient";
```

---

## Fluxo de Cada Ação

### 1. **ATAQUE BÁSICO** (Linha ~1605)

**Função**: `tryBasicAttack(targetX, targetY)`

#### Fluxo Single-Player (Original)
```
1. Verifica cooldown
2. Cria projétil visual
3. Calcula colisões com criaturas
4. Reduz HP localmente
5. Atualiza telemetria
```

#### Fluxo Multiplayer (Novo)
```
1. Verifica cooldown (local)
2. Reseta cooldown imediatamente (predição)
3. Envia intent ao servidor: mpClient.sendAttack(targetX, targetY)
4. Cria efeito visual imediato (predição): createImmediateAttackPrediction()
5. Aguarda resultado do servidor via handleAttackResult()

Server Retorna:
- attackResult: { attackerId, targetId, damage, targetHp, isCritical, targetDestroyed }

handleAttackResult():
- Sincroniza HP real da criatura
- Cria feedback visual de impacto
- Remove criatura se destruída
- Exibe texto flutuante de dano
```

**Predição Local**: Efeito visual imediato = melhor responsividade
**Reconciliação**: HP real vem do servidor (fonte de verdade)

---

### 2. **CAPTURA** (Linhas ~3071 + ~3393)

**Funções**: `throwPokeball()`, `updatePokeballProjectiles()`, `attemptCapture()`

#### Fluxo Single-Player
```
1. Seleciona melhor pokébola disponível
2. Consome pokébola do inventário
3. Lança projétil visual
4. Verifica colisão com criatura
5. Calcula chance de captura localmente
6. Aplica sucesso/falha com efeito visual
7. Adiciona criatura ao jogador
```

#### Fluxo Multiplayer
```
1. Seleciona melhor pokébola disponível
2. NÃO consome pokébola (será consumida após servidor confirmar)
3. Lança projétil visual
4. Verifica colisão com criatura
5. Envia intent ao servidor: mpClient.sendCaptureAttempt(targetId, ballType)
6. Aguarda resultado do servidor via handleCaptureResult()

Server Retorna:
- captureResult: { targetId, success, capturedCreature, failReason }

handleCaptureResult():
- Se sucesso:
  - Incrementa contador
  - Cria feedback de sucesso (partículas verdes)
  - Remove criatura do mapa
  - Adiciona criatura capturada ao inventário
- Se falha:
  - Cria feedback de falha
  - Exibe mensagem "Escapou!"
```

**Consumo de Pokébola**: Single-player = imediato | Multiplayer = após confirmação
**Predição Local**: Pokébola se move visualmente, confirmação vem do servidor

---

### 3. **COLETA DE RECURSOS** (Linha ~3067)

**Função**: `handleInteractions()` - seção de coleta

#### Fluxo Single-Player
```
1. Detecta colisão com recurso
2. Incrementa contador local
3. Armazena tipo/quantidade em mapa
4. Cria feedback visual
5. Destrói sprite do recurso
```

#### Fluxo Multiplayer
```
1. Detecta colisão com recurso
2. PLACEHOLDER: Local para envio de intent (ainda não implementado no servidor)
3. Incrementa contador local (predição)
4. Armazena tipo/quantidade em mapa
5. Cria feedback visual
6. Destrói sprite do recurso
7. Aguarda confirmação do servidor (futura)

TODO(multiplayer):
- Servidor deve enviar resourcesUpdate com lista de recursos sincronizados
- Cliente aplicaria handleResourcesUpdate() para reconciliação
```

**Status**: Coleta funciona em single-player; multiplayer awaits servidor

---

### 4. **EXTRAÇÃO** (Linha ~3115)

**Função**: `handleInteractions()` - seção de extração

#### Fluxo Single-Player
```
1. Detecta posição na zona de extração
2. Segura tecla E por 5 segundos (expeditionRequired)
3. Mostra barra de progresso
4. Persiste recursos e criaturas no PlayerState
5. Processa XP das criaturas
6. Retorna à base após 3 segundos
```

#### Fluxo Multiplayer
```
Ao iniciar extração (primeira frame):
  1. Detecta posição na zona
  2. Envia intent: mpClient.sendExtractionRequest("extract-1", "start")
  3. Mostra barra de progresso local (predição)

Durante extração:
  4. Aguarda eventos do servidor via handleExtractionState()

Server Envia:
  - extractionState: { pointId, playerId, status, progress, rewards }

Ao cancelar (tecla solta):
  1. Envia intent: mpClient.sendExtractionRequest("extract-1", "cancel")
  2. Reset progresso local

handleExtractionState():
  - Se in_progress: Sincroniza progresso com servidor
  - Se completed: 
    - State = "extracted"
    - Persiste recursos (se inclusos em rewards)
    - Cria feedback visual
  - Se cancelled: Reset progresso
```

**Progressão**: Local (predição visual) | Confirmação: Servidor
**Reconciliação**: Servidor é fonte de verdade para progresso

---

### 5. **EVENTOS DE PARTIDA** (Novos Handlers)

**Funções**: `handleMatchEvent()`, `handlePlayerDeath()`

#### Match Events

```typescript
handleMatchEvent(event: MatchEvent):
  - "started": Mostra "PARTIDA INICIADA!"
  - "almost_finished": Mostra "RESTAM Xs!" em amarelo
  - "finished": Mostra "TEMPO ESGOTADO!" em vermelho
             → Force state = "failed" se não extraiu
```

#### Player Death

```typescript
handlePlayerDeath(death: PlayerDeath):
  - state = "failed"
  - Mostra "MORTE: {reason}"
  - Desabilita controles de input
```

---

## Handlers Registrados

No método `create()` do `ExpeditionScene`, após criar o `MultiplayerClient`:

```typescript
this.mpClient.on("attackResult", (result) => this.handleAttackResult(result));
this.mpClient.on("captureResult", (result) => this.handleCaptureResult(result));
this.mpClient.on("resourcesUpdate", (resources) => this.handleResourcesUpdate(resources));
this.mpClient.on("extractionState", (state) => this.handleExtractionState(state));
this.mpClient.on("matchEvent", (event) => this.handleMatchEvent(event));
this.mpClient.on("playerDeath", (death) => this.handlePlayerDeath(death));
```

---

## Predição Local (Light Client Prediction)

### Implementada Para:
1. **Ataque**: Efeito visual imediato (projétil/arco)
2. **Extração**: Barra de progresso local sincroniza com servidor

### Benefícios:
- Melhor responsividade (feedback imediato)
- Reconciliação automática quando servidor responde
- Sem impacto visual se servidor confirma

### Reconciliação:
- HP de criaturas: Sempre aceita valor do servidor
- Progresso de extração: Sincroniza com servidor a cada frame
- Cooldowns: Reseta localmente, confirmado por servidor

---

## Compatibilidade Single-Player

**Garantida em todos os casos:**

1. **Ataque**: Sem `?mp=1` → executa lógica local (original)
2. **Captura**: Sem `?mp=1` → consome pokébola imediatamente
3. **Extração**: Sem `?mp=1` → persiste recursos localmente sem esperar servidor
4. **Coleta**: Sem `?mp=1` → coleta funciona normalmente

**Verificação**:
```typescript
if (this.isMultiplayer && this.mpClient) {
  // Multiplayer path
} else {
  // Single-player path (original)
}
```

---

## Validação de Implementação

### ✅ Completo
- [x] Ataque: envio e handler
- [x] Captura: envio e handler
- [x] Extração: envio e handler
- [x] Match Events: handler
- [x] Player Death: handler
- [x] Predição local
- [x] Compatibilidade single-player
- [x] Sem erros TypeScript/linter

### ⏳ Pendente (Requer Servidor)
- [ ] Coleta de recursos: servidor implementar resourcesUpdate
- [ ] Spawns sincronizados: servidor enviar WorldState
- [ ] Criaturas remotas: sincronização completa

---

## Próximos Passos

### Servidor (Paralelo)
1. **Validar intents**: attack, capture, extraction
2. **Calcular resultados**: dano, chance de captura, recompensas
3. **Emitir eventos**: attackResult, captureResult, etc.
4. **Sincronizar mundo**: creaturesUpdate, resourcesUpdate, extractionState
5. **Temporizador server-authoritative**: match timer

### Cliente (Quando Servidor Pronto)
1. Testes de integração completa
2. Ajustes de timing de predição
3. Feedback visual refinado
4. Performance profiling

---

## Notas Técnicas

### Timer de Extração
```typescript
// Verifica apenas na primeira frame de extração
if (this.extractionProgress - dt <= 0) {
  this.mpClient.sendExtractionRequest("extract-1", "start");
}
```
Isso garante que o intent é enviado apenas uma vez quando extração inicia.

### Tipos de Pokébola
```typescript
type BallType = "pokeball" | "greatball" | "ultraball" | "masterball";

// Na colisão, converte nome local para tipo do servidor
(pb.ballType as "pokeball" | "greatball" | "ultraball" | "masterball")
```

### ClientId para Filtro
```typescript
// Usado para distinguir jogadores locais de remotos
if (state.playerId === this.clientId) {
  // É a ação do jogador local
}
```

---

## Resumo Final

A **Fase 3B: Envio de Intents e Aplicação de Resultados** foi implementada com sucesso. O cliente agora:

✅ Envia intents ao servidor para todas as ações principais
✅ Aplica resultados recebidos do servidor
✅ Usa predição local para melhor responsividade
✅ Mantém compatibilidade 100% com single-player
✅ Está pronto para integração com o servidor completo

O sistema está **arquitectado para server-authoritative**, onde:
- Servidor valida e processa todas as ações
- Cliente aplica resultados como fonte de verdade
- Predição local melhora UX sem comprometer integridade
