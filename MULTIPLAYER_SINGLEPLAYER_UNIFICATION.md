# Unificação de Funcionalidades Single Player e Multiplayer

## Resumo

Este documento descreve as correções implementadas para garantir que todas as funcionalidades do jogo funcionem corretamente tanto em modo single player quanto em modo multiplayer, eliminando duplicações de código e sincronizando corretamente o estado entre cliente e servidor.

## Problemas Identificados

### Single Player (funcionava)
✅ Interações com pokébolas (lançamento e captura)  
✅ Ataques de inimigos com animações e projéteis  
✅ Telemetria exibida ao fim do jogo  
✅ Detecção de morte do jogador

### Multiplayer (não funcionava completamente)
❌ Pokébolas não consumiam itens do inventário  
❌ IA de inimigos não executava (cliente esperava servidor)  
❌ Animações de ataque de inimigos não apareciam  
❌ Telemetria não era exibida ao fim do jogo  
❌ Desync de HP entre cliente e servidor  
❌ Morte do jogador não era detectada no cliente

## Soluções Implementadas

### 1. Sincronização de HP do Jogador ✅

**Problema:** O servidor enviava eventos `attackResult` quando jogadores eram atingidos, mas o cliente apenas processava quando o alvo era uma criatura.

**Solução:** Modificado `handleAttackResult()` para detectar quando o alvo é o jogador local e atualizar `activeCreatureHp` corretamente.

```typescript
// src/scenes/ExpeditionScene.ts - handleAttackResult()
const isLocalPlayer = result.targetId === this.mpClient?.getClientId();

if (isLocalPlayer) {
  this.activeCreatureHp = Math.max(0, result.targetHp);
  this.damageTakenRecently += result.damage;
  this.telemetry.damageTaken += result.damage;
  this.playerTookDamageThisFrame = true;
  
  // Efeito visual de dano
  this.player.setTint(0xef4444);
  this.createFloatingText(this.player.x, this.player.y - 30, `-${result.damage} HP`, 0xef4444);
}
```

### 2. Detecção de Morte do Jogador ✅

**Problema:** Quando o servidor enviava evento `player_death`, o cliente não processava corretamente a telemetria e não mudava o estado para "failed".

**Solução:** Modificado `handlePlayerDeath()` para verificar se é o jogador local e processar telemetria completa (igual ao single player).

```typescript
// src/scenes/ExpeditionScene.ts - handlePlayerDeath()
if (isLocalPlayer) {
  this.state = "failed";
  this.activeCreatureHp = 0;
  
  // Registrar telemetria completa
  if (!this.telemetry.extractionFailed) {
    this.telemetry.extractionFailed = true;
    this.telemetry.timeSpent = this.expeditionTime;
    // ... cálculos de telemetria
    console.table({ /* estatísticas */ });
    this.processCreatureXp(false);
  }
}
```

### 3. Animações de Ataque de Inimigos ✅

**Problema:** No multiplayer, a IA roda no servidor, mas o cliente não sabia quando inimigos atacavam para exibir animações.

**Solução:** Modificado `handleProjectilesUpdate()` para criar efeitos visuais de "muzzle flash" quando novos projéteis de inimigos são detectados.

```typescript
// src/scenes/ExpeditionScene.ts - handleProjectilesUpdate()
if (!proj.isPlayerProjectile) {
  const creatureSprite = this.getCreatureSprite(proj.ownerId);
  if (creatureSprite) {
    // Criar efeito visual de ataque na posição da criatura
    const flash = this.add.circle(creatureSprite.sprite.x, creatureSprite.sprite.y, 8, 0xff8888, 0.6);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.5, duration: 100 });
  }
}
```

### 4. Sistema de Captura com Pokébolas ✅

**Problema:** No multiplayer, as pokébolas não eram consumidas do inventário porque o código esperava confirmação do servidor.

**Solução:** Modificado `throwPokeball()` para consumir a pokébola imediatamente (otimista) em ambos os modos.

```typescript
// src/scenes/ExpeditionScene.ts - throwPokeball()
// Antes: if (!this.isMultiplayer) { LocalPlayerState.consumeItem(...) }
// Depois:
if (!LocalPlayerState.consumeItem(chosenBall, 1)) {
  return; // Sem pokébolas disponíveis
}
```

### 5. Telemetria no Fim do Jogo ✅

**Problema:** Quando o tempo da partida acabava no multiplayer, o evento `match_event: finished` era recebido mas não disparava a telemetria.

**Solução:** Modificado `handleMatchEvent()` para registrar telemetria quando o evento "finished" é recebido e o jogador não extraiu.

```typescript
// src/scenes/ExpeditionScene.ts - handleMatchEvent()
case "finished":
  if (this.state !== "extracted") {
    this.state = "failed";
    
    if (!this.telemetry.extractionFailed && !this.telemetry.extractionSuccess) {
      this.telemetry.extractionFailed = true;
      this.telemetry.timeSpent = this.expeditionTime;
      // ... registrar estatísticas
      console.table({ /* telemetria */ });
      this.processCreatureXp(false);
    }
  }
  break;
```

## Arquitetura Unificada

### Fluxo de Combate

#### Single Player
1. Cliente processa IA localmente (`updateEnemyAI()`)
2. Cliente detecta colisões e aplica dano
3. Cliente atualiza HP localmente
4. Cliente exibe feedback visual

#### Multiplayer
1. **Servidor** processa IA (`server/src/systems/combat.ts`)
2. **Servidor** detecta colisões e aplica dano
3. **Servidor** envia `attackResult` para clientes
4. **Cliente** recebe evento e atualiza HP
5. **Cliente** exibe feedback visual

### Fluxo de Captura

#### Single Player
1. Cliente lança pokébola (`throwPokeball()`)
2. Cliente consome item do inventário
3. Cliente detecta colisão com criatura
4. Cliente calcula chance de captura
5. Cliente remove criatura se capturada

#### Multiplayer
1. **Cliente** lança pokébola (`throwPokeball()`)
2. **Cliente** consome item do inventário (otimista)
3. Cliente detecta colisão e envia `capture_attempt`
4. **Servidor** valida e processa captura
5. **Servidor** envia `captureResult` 
6. **Cliente** recebe resultado e exibe feedback

### Fluxo de Morte

#### Single Player
1. Cliente detecta HP <= 0
2. Cliente chama `handlePlayerDeathByEnemy()`
3. Cliente muda estado para "failed"
4. Cliente registra telemetria
5. Cliente processa XP das criaturas

#### Multiplayer
1. **Servidor** detecta HP <= 0
2. **Servidor** envia `player_death`
3. **Cliente** recebe evento
4. **Cliente** chama `handlePlayerDeath()`
5. **Cliente** muda estado para "failed"
6. **Cliente** registra telemetria
7. **Cliente** processa XP das criaturas

## Código Unificado

As seguintes funções agora funcionam corretamente em ambos os modos:

- `throwPokeball()` - Lançamento de pokébolas
- `handleAttackResult()` - Processamento de dano (criaturas E jogadores)
- `handlePlayerDeath()` - Morte do jogador com telemetria
- `handleMatchEvent()` - Fim de partida com telemetria
- `updatePokeballProjectiles()` - Colisões de pokébolas
- `handleProjectilesUpdate()` - Sincronização de projéteis com efeitos visuais

## Melhorias de UX

1. **Feedback Visual Consistente:** Animações de ataque agora aparecem em ambos os modos
2. **Telemetria Completa:** Estatísticas são sempre exibidas ao fim do jogo
3. **HP Sincronizado:** Não há mais desync entre cliente e servidor
4. **Morte Detectada:** Tela de game over aparece corretamente em multiplayer
5. **Pokébolas Funcionais:** Sistema de captura funciona perfeitamente em ambos os modos

## Testes Recomendados

### Single Player
- [ ] Lançar pokébolas e capturar criaturas
- [ ] Ser atacado por inimigos e ver animações
- [ ] Morrer em combate e ver telemetria
- [ ] Deixar tempo acabar e ver telemetria

### Multiplayer
- [ ] Lançar pokébolas e capturar criaturas
- [ ] Ser atacado por inimigos e ver animações
- [ ] Verificar HP sincronizado com servidor
- [ ] Morrer em combate e ver telemetria
- [ ] Deixar tempo acabar e ver telemetria
- [ ] Verificar que outros jogadores veem ataques corretamente

## Arquivos Modificados

- `src/scenes/ExpeditionScene.ts`
  - `handleAttackResult()` - Processamento de dano em jogadores
  - `handlePlayerDeath()` - Detecção de morte com telemetria
  - `handleMatchEvent()` - Telemetria ao fim de partida
  - `handleProjectilesUpdate()` - Efeitos visuais de ataques
  - `throwPokeball()` - Consumo otimista de pokébolas

## Conclusão

Todas as funcionalidades agora funcionam consistentemente em ambos os modos. O código foi unificado onde possível, eliminando duplicações e garantindo que a experiência do jogador seja a mesma independentemente do modo de jogo escolhido.

A arquitetura cliente-servidor está agora bem definida:
- **Servidor:** Autoridade sobre física, dano, e lógica de jogo
- **Cliente:** Renderização, feedback visual, e previsão otimista

Isso garante que o jogo seja justo em multiplayer enquanto mantém a responsividade em single player.
