# Fase 3B: Implementação de Intents e Handlers no Cliente

## Visão Geral
Adaptar o `ExpeditionScene` para enviar **intents ao servidor** e aplicar os **resultados** recebidos pelo `MultiplayerClient`.

## Arquitetura de Mudanças

### Padrão: Dual-Mode (Single-Player vs Multiplayer)
Cada ação será modificada para:
```typescript
if (this.isMultiplayer) {
  // Envia intent ao servidor
  this.mpClient.sendXXX(...)
  // Aplica predição leve (opcional)
} else {
  // Executa lógica local (comportamento atual)
}
```

## Locais de Mudança no ExpeditionScene

### 1. **Ataque Básico** (`tryBasicAttack`)
- **Localização**: linha ~1525
- **Comportamento Single-Player**: Cria projétil local, calcula dano imediatamente
- **Novo Comportamento Multiplayer**:
  - Ao atacar: `this.mpClient.sendAttack(targetX, targetY)` + predição visual imediata
  - Receber `attackResult`: Sincronizar HP real, aplicar correções
  - Criar efeito visual do projétil/hit baseado no servidor

### 2. **Captura** (`throwPokeball` + `attemptCapture`)
- **Localização**: linhas ~3014-3157
- **Comportamento Single-Player**: Lança pokébola, calcula chance localmente
- **Novo Comportamento Multiplayer**:
  - Ao capturar: `this.mpClient.sendCaptureAttempt(targetId, ballType)` + feedback imediato
  - Receber `captureResult`: Confirmar sucesso/falha, atualizar inventário
  - Consumir pokébola apenas após confirmação do servidor

### 3. **Coleta de Recursos** (`handleInteractions`)
- **Localização**: linhas ~2738-2780
- **Comportamento Single-Player**: Coleta automática ao colidir
- **Novo Comportamento Multiplayer**:
  - Ao coletar: `this.mpClient.sendResourceInteract(resourceId)` + remoção imediata visual
  - Receber `resourcesUpdate`: Confirmar coleta, atualizar counter
  - Sem consumo de recurso até confirmação

### 4. **Extração** (`handleInteractions`)
- **Localização**: linhas ~2792-2859
- **Comportamento Single-Player**: Segura E por 5 segundos
- **Novo Comportamento Multiplayer**:
  - Ao iniciar: `this.mpClient.sendExtractionRequest(pointId, "start")`
  - Ao cancelar: `this.mpClient.sendExtractionRequest(pointId, "cancel")`
  - Receber `extractionState`: Sincronizar progresso, mostr conclusão
  - Sem finalização até confirmação do servidor

### 5. **Eventos de Partida** (novos handlers)
- **Match Events**: Avisos de tempo, fim de partida
- **Player Death**: Mostrar tela de morte, desabilitar controles

## Handlers do MultiplayerClient a Registrar

No método `create()` do `ExpeditionScene`:

```typescript
if (this.isMultiplayer && this.mpClient) {
  this.mpClient.on('attackResult', (result) => this.handleAttackResult(result));
  this.mpClient.on('captureResult', (result) => this.handleCaptureResult(result));
  this.mpClient.on('resourcesUpdate', (resources) => this.handleResourcesUpdate(resources));
  this.mpClient.on('extractionState', (state) => this.handleExtractionState(state));
  this.mpClient.on('matchEvent', (event) => this.handleMatchEvent(event));
  this.mpClient.on('playerDeath', (death) => this.handlePlayerDeath(death));
}
```

## Estado a Manter

### Predição Local
- Ao atacar: mostrar projétil imediatamente (será corrigido pelo servidor)
- Ao capturar: animar pokébola imediatamente
- Ao extrair: barra de progresso local (sincroniza com servidor)

### Reconciliação
- HP de criaturas: servidor é fonte de verdade
- Inventário: confirmado apenas após servidor

## Ordem de Implementação

1. Criar handlers vazios para todos os eventos
2. Implementar handler de `attackResult`
3. Implementar handler de `captureResult`
4. Implementar handler de `resourcesUpdate`
5. Implementar handler de `extractionState`
6. Implementar handlers de `matchEvent` e `playerDeath`
7. Testar cada ação individual
8. Testes de integração completa

## Checklist de Validação

- [ ] Ataque envia intent e aplica resultado
- [ ] Captura envia intent e aplica resultado
- [ ] Recursos coletados sincronizam com servidor
- [ ] Extração sincroniza progresso e conclusão
- [ ] Match events mostram avisos
- [ ] Player death desabilita controles
- [ ] Single-player continua funcionando
- [ ] Sem erros de TypeScript/linter
