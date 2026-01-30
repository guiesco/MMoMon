# Guia de Integração de Eventos de Ação Multiplayer

## Visão Geral

Este documento descreve como integrar eventos de ação do servidor (ataques, capturas, extração) com o sistema de renderização de jogadores remotos já implementado.

## Arquitetura Preparada

### RemotePlayerSprite - Campos de Ação
```typescript
actionIndicator: Phaser.GameObjects.Arc | null;  // Visual do indicador
actionType: "idle" | "attacking" | "extracting" | null;  // Tipo de ação
actionTimer: number;  // Tempo restante da animação
```

### Método Pronto para Uso
```typescript
private updateRemotePlayers(dt: number): void {
  // ... código de interpolação ...
  
  // Já implementado: Anima indicadores de ação
  if (remotePlayer.actionType && remotePlayer.actionTimer > 0) {
    remotePlayer.actionIndicator.setVisible(true);
    // Pulse animation
    const pulse = 1 + Math.sin(this.expeditionTime * 6) * 0.3;
    remotePlayer.actionIndicator.setScale(pulse);
    
    // Muda cor conforme a ação
    if (remotePlayer.actionType === "attacking") {
      remotePlayer.actionIndicator.setFillStyle(0xef4444); // Vermelho
    } else if (remotePlayer.actionType === "extracting") {
      remotePlayer.actionIndicator.setFillStyle(0x3b82f6); // Azul
    }
    
    remotePlayer.actionTimer -= dt;
  }
}
```

## Como Integrar Eventos

### Passo 1: Adicionar Handlers no MultiplayerClient

Já existe preparado em `src/scenes/ExpeditionScene.ts` (linhas 795-802):

```typescript
// Exemplo de handlers a serem implementados:
this.mpClient.on("attackResult", (result) => {
  // result: { attackerId, targetId, damage, targetHp }
  this.handleRemoteAttackResult(result);
});

this.mpClient.on("captureResult", (result) => {
  // result: { playerId, targetId, success }
  this.handleRemoteCaptureResult(result);
});

this.mpClient.on("extractionState", (state) => {
  // state: { playerId, status, progress }
  this.handleRemoteExtractionState(state);
});
```

### Passo 2: Implementar Handlers de Eventos

```typescript
/**
 * Processa resultado de ataque de jogador remoto.
 * Mostra indicador visual de ataque.
 */
private handleRemoteAttackResult(result: AttackResult): void {
  const remotePlayer = this.remotePlayers.get(result.attackerId);
  if (!remotePlayer) return;
  
  // Ativa indicador de ataque
  remotePlayer.actionType = "attacking";
  remotePlayer.actionTimer = 0.5; // 500ms de animação
  
  // Opcional: Som de ataque
  // this.sound.play("attack_sound", { volume: 0.3 });
  
  // Opcional: Efeito de partícula
  // this.createAttackEffect(remotePlayer.currentX, remotePlayer.currentY);
}

/**
 * Processa resultado de captura de jogador remoto.
 */
private handleRemoteCaptureResult(result: CaptureResult): void {
  const remotePlayer = this.remotePlayers.get(result.playerId);
  if (!remotePlayer) return;
  
  if (result.success) {
    remotePlayer.actionType = "attacking"; // Reusa como sucesso de captura
    remotePlayer.actionTimer = 0.8;
    
    // Opcional: Efeito visual especial
    // this.createCaptureSuccessEffect(remotePlayer.currentX, remotePlayer.currentY);
  } else {
    // Falha de captura - pode mostrar indicador negativo
    // this.createCaptureFailEffect(remotePlayer.currentX, remotePlayer.currentY);
  }
}

/**
 * Processa estado de extração de jogador remoto.
 */
private handleRemoteExtractionState(state: ExtractionState): void {
  const remotePlayer = this.remotePlayers.get(state.playerId);
  if (!remotePlayer) return;
  
  if (state.status === "in_progress") {
    remotePlayer.actionType = "extracting";
    remotePlayer.actionTimer = 0.2; // Atualiza frequentemente
  } else if (state.status === "completed") {
    remotePlayer.actionType = null; // Para animação
    // Opcional: Efeito de conclusão de extração
  }
}
```

### Passo 3: Adicionar Efeitos Visuais (Opcional)

```typescript
/**
 * Cria efeito visual de ataque próximo ao jogador remoto.
 */
private createAttackEffect(x: number, y: number): void {
  // Exemplo: Círculo que explode
  const effect = this.add.circle(x, y, 15, 0xef4444, 0.6);
  
  this.tweens.add({
    targets: effect,
    scale: { from: 1, to: 2 },
    alpha: { from: 0.6, to: 0 },
    duration: 300,
    onComplete: () => effect.destroy()
  });
}

/**
 * Cria efeito visual de captura bem-sucedida.
 */
private createCaptureSuccessEffect(x: number, y: number): void {
  const effect = this.add.star(x, y, 5, 10, 20, 0x22c55e, 1);
  
  this.tweens.add({
    targets: effect,
    y: { from: y, to: y - 40 },
    alpha: { from: 1, to: 0 },
    duration: 400,
    ease: "Power2",
    onComplete: () => effect.destroy()
  });
}

/**
 * Cria efeito visual de captura falhada.
 */
private createCaptureFailEffect(x: number, y: number): void {
  // X vermelho piscante
  for (let i = 0; i < 2; i++) {
    const line = this.add.line(x, y, -5, -5, 5, 5, 0xef4444, 1);
    this.tweens.add({
      targets: line,
      alpha: { from: 1, to: 0 },
      duration: 200,
      delay: i * 100,
      onComplete: () => line.destroy()
    });
  }
}
```

### Passo 4: Integrar com Notificações/HUD

```typescript
/**
 * Mostra notificação de ação de jogador remoto no HUD.
 */
private showRemoteActionNotification(
  playerName: string,
  actionType: "attack" | "capture" | "extraction"
): void {
  const messages = {
    attack: `${playerName} atacou!`,
    capture: `${playerName} capturou uma criatura!`,
    extraction: `${playerName} está extraindo...`
  };
  
  // Exemplo: Mostrar em HUD flutuante
  const notification = this.add.text(
    this.scale.width / 2,
    50,
    messages[actionType],
    {
      fontSize: "14px",
      color: "#fbbf24",
      backgroundColor: "#1e293b",
      padding: { x: 10, y: 5 }
    }
  );
  
  notification.setOrigin(0.5);
  notification.setScrollFactor(0);
  notification.setDepth(1000);
  
  this.tweens.add({
    targets: notification,
    alpha: { from: 1, to: 0 },
    y: { from: 50, to: 30 },
    duration: 2000,
    delay: 500,
    onComplete: () => notification.destroy()
  });
}
```

## Fluxo Completo de Integração

```
Servidor simula ação
  ↓
Servidor envia "attack_result" via WebSocket
  ↓
MultiplayerClient recebe mensagem
  ↓
Dispara evento: mpClient.events.attackResult?.(result)
  ↓
handleRemoteAttackResult() é chamado
  ↓
remotePlayer.actionType = "attacking"
remotePlayer.actionTimer = 0.5
  ↓
updateRemotePlayers() no próximo frame
  ↓
Anima indicador com pulse e cor apropriada
  ↓
Após 0.5s, actionTimer expira
  ↓
Indicador desaparece, actionType retorna a null
```

## Verificação de Implementação

### Checklist para Integração de Cada Tipo de Evento

#### Attack Result
- [ ] Handler "attackResult" registrado
- [ ] `handleRemoteAttackResult()` implementado
- [ ] `actionType = "attacking"` ativado
- [ ] Indicador pisca com cor vermelha
- [ ] Efeito visual opcional adicionado
- [ ] Testado com múltiplos ataques

#### Capture Result
- [ ] Handler "captureResult" registrado
- [ ] `handleRemoteCaptureResult()` implementado
- [ ] Diferenciação entre sucesso/falha
- [ ] Efeitos visuais específicos
- [ ] Testado com sucesso e falha

#### Extraction State
- [ ] Handler "extractionState" registrado
- [ ] `handleRemoteExtractionState()` implementado
- [ ] Mostra "extracting" durante progresso
- [ ] Para ao final
- [ ] Testado início, progresso e conclusão

## Performance Considerations

### Limite de Efeitos
Para evitar lag com muitos eventos simultâneos:

```typescript
// Limitar número de efeitos ativos
private activeEffects = 0;
private maxActiveEffects = 20;

private createAttackEffect(x: number, y: number): void {
  if (this.activeEffects >= this.maxActiveEffects) return;
  
  this.activeEffects++;
  
  const effect = this.add.circle(x, y, 15, 0xef4444, 0.6);
  
  this.tweens.add({
    targets: effect,
    scale: { from: 1, to: 2 },
    alpha: { from: 0.6, to: 0 },
    duration: 300,
    onComplete: () => {
      effect.destroy();
      this.activeEffects--;
    }
  });
}
```

### Pooling de Efeitos (Futuro)
Para otimizar ainda mais:

```typescript
private effectPool: Phaser.GameObjects.Arc[] = [];
private createPooledEffect(): Phaser.GameObjects.Arc {
  if (this.effectPool.length > 0) {
    return this.effectPool.pop()!;
  }
  return this.add.circle(0, 0, 15, 0xef4444, 0.6);
}
```

## Testes Recomendados

### Teste 1: Eventos de Ataque
```
1. Abra 2 abas com ?mp=1
2. Em Tab A: ataque (espaço ou clique)
3. Verifique em Tab B: indicador vermelho pisca em ~500ms
```

### Teste 2: Captura com Sucesso
```
1. Simule captura bem-sucedida no servidor
2. Envie captureResult com success: true
3. Verifique efeito visual de sucesso em Tab B
```

### Teste 3: Extração
```
1. Simule início de extração em servidor
2. Envie extractionState com status: "in_progress"
3. Verifique indicador azul em Tab B
4. Simule conclusão, verifique parada
```

### Teste 4: Performance
```
1. Simule 10+ eventos simultâneos
2. Verifique FPS não cai abaixo de 30
3. Sem memory leaks ao longo do tempo
```

## Arquivos a Modificar

Quando implementar eventos, você precisará:

1. **`src/scenes/ExpeditionScene.ts`**:
   - Registrar handlers no `create()` (após linha 795)
   - Implementar métodos de tratamento
   - Adicionar métodos de efeitos visuais

2. **`src/services/multiplayerClient.ts`** (se necessário):
   - Garantir que eventos são disparados corretamente
   - Adicionar novos tipos de eventos se necessário

3. **`server/src/index.ts`** (se necessário):
   - Enviar mensagens de evento quando apropriado
   - Incluir dados corretos no payload

## Referências

- Interface `RemotePlayerSprite`: Linha ~165 em ExpeditionScene.ts
- Método `updateRemotePlayers()`: Linha ~2950 em ExpeditionScene.ts
- MultiplayerClient types: `src/services/multiplayerClient.ts`
- Eventos do servidor: `multiplayer-plan.md`

## Conclusão

O sistema de renderização de jogadores remotos está **totalmente preparado** para receber eventos de ação. A integração é direta e não requer mudanças na arquitetura existente.

**Próximo passo recomendado**: Implementar eventos de ação no servidor (item 3 do Multiplayer Phase em activeContext.md)
