# Plano de Polimento e Melhoria da Gameplay Multiplayer

**Data de Criação**: 29/01/2026  
**Status**: Planejamento  
**Versão**: 1.0

## Visão Geral

Com o sistema multiplayer funcional, é hora de polir a experiência de gameplay para garantir uma experiência fluida e sem bugs visuais. Este documento descreve os problemas identificados e o plano de resolução.

---

## Problemas Identificados

### 🔴 P1 - Alta Prioridade (Bugs Críticos)

#### 1.1 - Fantasma do Player após Extração/Morte
**Descrição**: Após extrair ou morrer, o sprite do jogador permanece visível no mapa para outros jogadores, criando um "fantasma".

**Causa Provável**: 
- O servidor não está notificando corretamente os outros clientes quando um jogador extrai ou morre
- Ou o cliente não está processando corretamente a remoção do sprite do jogador que saiu

**Arquivos Envolvidos**:
- `src/scenes/ExpeditionScene.ts` - handlers de `playerDeath`, `extractionState`
- `server/src/index.ts` - broadcast de eventos de saída

**Solução Proposta**:
1. Garantir que o servidor envia evento de remoção de jogador ao extrair/morrer
2. Garantir que o cliente processa a remoção do sprite corretamente
3. Adicionar cleanup explícito do jogador no worldState

---

#### 1.2 - Cliente Permanece Conectado após Sair do Mapa
**Descrição**: Depois de extrair ou morrer, o cliente continua conectado na room do WebSocket. Ao retornar ao mapa, pode haver conflitos.

**Causa Provável**:
- No código atual (linha 2039-2041), apenas `this.mpClient = null` é chamado, mas `disconnect()` não é invocado
- O comentário diz "MultiplayerClient não tem método disconnect explícito", mas na verdade **tem** (linha 373 do multiplayerClient.ts)

**Arquivos Envolvidos**:
- `src/scenes/ExpeditionScene.ts` - método `update()` quando `state === "extracted" || "failed"`

**Solução Proposta**:
1. Chamar `this.mpClient.disconnect()` antes de `this.mpClient = null`
2. Garantir que a desconexão também é chamada no `shutdown()`

---

### 🟡 P2 - Média Prioridade (Bugs Visuais)

#### 2.1 - Deslizamento Inicial das Entidades
**Descrição**: Quando o jogador entra no mapa, todas as entidades (criaturas, recursos, jogadores) "deslizam" pela tela por uma pequena janela de tempo antes de se moverem normalmente.

**Causa Provável**:
- Quando os sprites são criados, `currentX/currentY` são definidos como a posição inicial
- Porém, o primeiro update do servidor pode vir com posições diferentes
- A interpolação então move os sprites da posição inicial para a posição do servidor

**Arquivos Envolvidos**:
- `src/scenes/ExpeditionScene.ts` - `createCreatureSprite()`, `createResourceSprite()`, `createPlayerSprite()`
- `src/scenes/ExpeditionScene.ts` - `handleCreaturesUpdate()`, `handleResourcesUpdate()`, `syncRemotePlayers()`

**Solução Proposta**:
1. Ao criar sprites, verificar se é a primeira sincronização e fazer "snap" direto à posição
2. Ou: não interpolar no primeiro frame após criação do sprite
3. Adicionar flag `isFirstSync` nas estruturas de sprite

---

#### 2.2 - Interpolação de Criaturas Trava em Uma Criatura
**Descrição**: A interpolação com criaturas às vezes "trava" em uma criatura (possivelmente morta) e não interage com mais nenhuma outra.

**Causa Provável**:
- Referência a uma criatura que foi removida do worldState mas ainda está sendo processada
- Loop de interpolação pode estar quebrando silenciosamente
- Criatura morta pode não estar sendo removida corretamente do Map de sprites

**Arquivos Envolvidos**:
- `src/scenes/ExpeditionScene.ts` - `updateCreatureSprites()`, `handleCreaturesUpdate()`
- `src/scenes/ExpeditionScene.ts` - `destroyCreatureSprite()`, `removeCreature()`

**Solução Proposta**:
1. Adicionar logs de debug para identificar quando criaturas são removidas
2. Verificar se há referências órfãs no Map de sprites
3. Garantir que criaturas mortas são removidas imediatamente do servidor e cliente
4. Adicionar validação antes de processar interpolação

---

### 🟢 P3 - Baixa Prioridade (Melhorias de UX)

#### 3.1 - Mensagens das Pokébolas Não Aparecem Corretamente
**Descrição**: As pokébolas não estão mostrando as mensagens apropriadamente ao interagir com as criaturas.

**Causa Provável**:
- Em modo multiplayer, a captura é enviada ao servidor e o feedback vem do `handleCaptureResult()`
- Porém, pode haver delay ou a mensagem pode não estar sendo exibida corretamente
- O `createFloatingText()` pode estar sendo chamado em posição incorreta

**Arquivos Envolvidos**:
- `src/scenes/ExpeditionScene.ts` - `handleCaptureResult()`, `attemptCapture()`, `throwPokeball()`
- `src/scenes/ExpeditionScene.ts` - `createFloatingText()`

**Solução Proposta**:
1. Verificar se `handleCaptureResult()` está sendo chamado corretamente
2. Garantir que a posição do feedback é baseada na posição atual do sprite (não target)
3. Adicionar feedback imediato ao lançar a pokébola ("Lançando...")
4. Melhorar visibilidade das mensagens (tamanho, cor, duração)

---

## Melhorias Adicionais Sugeridas

### 4.1 - Feedback Visual de Conexão
- Mostrar indicador de conexão/desconexão no HUD
- Mostrar ping/latência

### 4.2 - Sincronização de Projéteis de Outros Jogadores
- Atualmente projéteis de outros jogadores não são visíveis
- Implementar renderização de projéteis remotos

### 4.3 - Animações de Entrada/Saída
- Adicionar fade-in quando entidades aparecem
- Adicionar fade-out quando entidades desaparecem

### 4.4 - Otimização de Rede
- Implementar delta compression para updates
- Reduzir frequência de updates para entidades distantes

---

## Plano de Execução

### Fase 1: Bugs Críticos (P1)
**Estimativa**: 2-3 horas

| # | Tarefa | Complexidade |
|---|--------|--------------|
| 1.1 | Corrigir fantasma do player | Média |
| 1.2 | Corrigir desconexão da room | Baixa |

### Fase 2: Bugs Visuais (P2)
**Estimativa**: 3-4 horas

| # | Tarefa | Complexidade |
|---|--------|--------------|
| 2.1 | Corrigir deslizamento inicial | Média |
| 2.2 | Corrigir interpolação travada | Alta |

### Fase 3: Melhorias de UX (P3)
**Estimativa**: 2-3 horas

| # | Tarefa | Complexidade |
|---|--------|--------------|
| 3.1 | Corrigir mensagens das pokébolas | Baixa |

### Fase 4: Melhorias Adicionais (Opcional)
**Estimativa**: 4-6 horas

| # | Tarefa | Complexidade |
|---|--------|--------------|
| 4.1 | Feedback de conexão | Baixa |
| 4.2 | Projéteis remotos | Média |
| 4.3 | Animações de entrada/saída | Média |
| 4.4 | Otimização de rede | Alta |

---

## Prompts para Execução por Agente

Abaixo estão os prompts individuais para cada tarefa, prontos para serem executados por um agente de código.

---

### PROMPT 1.1 - Corrigir Fantasma do Player após Extração/Morte

```
## Contexto
Após um jogador extrair ou morrer no modo multiplayer, seu sprite permanece visível para outros jogadores como um "fantasma".

## Problema
O servidor não está notificando corretamente os outros clientes quando um jogador extrai ou morre, ou o cliente não está processando a remoção.

## Arquivos a Analisar
- `src/scenes/ExpeditionScene.ts` - handlers de `playerDeath`, `extractionState`, `handlePlayerMove()`
- `server/src/index.ts` - broadcast de eventos de saída de jogador
- `src/services/multiplayerClient.ts` - eventos relacionados a jogadores

## Tarefas
1. Verificar se o servidor envia evento de remoção quando jogador extrai/morre
2. Verificar se o cliente processa corretamente a remoção do sprite
3. Garantir que `destroyPlayerSprite()` é chamado quando um jogador sai
4. Adicionar evento específico `playerLeft` se necessário
5. Testar com 2 clientes: um extrai, o outro deve ver o sprite desaparecer

## Critérios de Aceite
- [ ] Quando jogador extrai, seu sprite desaparece para outros jogadores
- [ ] Quando jogador morre, seu sprite desaparece para outros jogadores
- [ ] Não há sprites órfãos após saída de jogadores
- [ ] Zero erros de linter
```

---

### PROMPT 1.2 - Corrigir Desconexão da Room ao Sair

```
## Contexto
Após extrair ou morrer, o cliente continua conectado na room do WebSocket, causando potenciais conflitos ao retornar.

## Problema
No código atual (ExpeditionScene.ts, linha ~2039-2041), apenas `this.mpClient = null` é chamado, mas `disconnect()` não é invocado.

## Arquivos a Modificar
- `src/scenes/ExpeditionScene.ts` - método `update()` quando `state === "extracted" || "failed"`

## Tarefas
1. Localizar o trecho onde `this.mpClient = null` é chamado após extração/morte
2. Adicionar chamada a `this.mpClient.disconnect()` ANTES de `this.mpClient = null`
3. Verificar se `shutdown()` também precisa dessa correção (já parece ter)
4. Garantir que não há reconexão automática após desconexão intencional

## Código Atual (aproximado)
```typescript
if (this.endSceneTimer >= this.endSceneDelay) {
  if (this.mpClient) {
    // MultiplayerClient não tem método disconnect explícito, apenas limpa a referência
    this.mpClient = null;  // ❌ Não desconecta!
  }
  // ...
}
```

## Código Esperado
```typescript
if (this.endSceneTimer >= this.endSceneDelay) {
  if (this.mpClient) {
    this.mpClient.disconnect();  // ✅ Desconecta primeiro
    this.mpClient = null;
  }
  // ...
}
```

## Critérios de Aceite
- [ ] Cliente desconecta do WebSocket ao extrair
- [ ] Cliente desconecta do WebSocket ao morrer
- [ ] Servidor mostra log de desconexão do jogador
- [ ] Ao voltar ao mapa, conecta em nova sessão limpa
- [ ] Zero erros de linter
```

---

### PROMPT 2.1 - Corrigir Deslizamento Inicial das Entidades

```
## Contexto
Quando o jogador entra no mapa multiplayer, todas as entidades "deslizam" pela tela por uma pequena janela de tempo antes de se moverem normalmente.

## Problema
Quando sprites são criados, `currentX/currentY` são definidos como a posição inicial. Porém, o primeiro update do servidor pode vir com posições diferentes, causando interpolação indesejada.

## Arquivos a Modificar
- `src/scenes/ExpeditionScene.ts`:
  - `createCreatureSprite()` - linha ~1038
  - `createResourceSprite()` - linha ~1251
  - `createPlayerSprite()` - linha ~1370
  - Interfaces: `RemoteCreatureSprite`, `RemoteResourceSprite`, `RemotePlayerSprite`

## Tarefas
1. Adicionar flag `skipFirstInterpolation: boolean` nas interfaces de sprite
2. Ao criar sprite, definir `skipFirstInterpolation = true`
3. No primeiro update (`updateCreatureSprites`, etc), se flag for true:
   - Fazer "snap" direto para a posição (sem interpolação)
   - Definir flag como false
4. Alternativamente: verificar se `currentX === targetX` e `currentY === targetY` para determinar se é primeiro update

## Solução Alternativa (mais simples)
Ao criar o sprite, inicializar `currentX/currentY` com valores inválidos (ex: -9999) e no update, se detectar esses valores, fazer snap direto.

## Critérios de Aceite
- [ ] Ao entrar no mapa, entidades aparecem na posição correta imediatamente
- [ ] Não há "deslizamento" inicial
- [ ] Interpolação funciona normalmente após o primeiro frame
- [ ] Zero erros de linter
```

---

### PROMPT 2.2 - Corrigir Interpolação de Criaturas Travando

```
## Contexto
A interpolação com criaturas às vezes "trava" em uma criatura (possivelmente morta) e não interage com mais nenhuma outra.

## Problema
Possível referência a criatura removida do worldState mas ainda presente no Map de sprites, ou loop de interpolação quebrando silenciosamente.

## Arquivos a Analisar
- `src/scenes/ExpeditionScene.ts`:
  - `updateCreatureSprites()` - linha ~1173
  - `handleCreaturesUpdate()` - handler de criaturas do servidor
  - `destroyCreatureSprite()` - linha ~1155
  - `removeCreature()` - método de remoção

## Tarefas
1. Adicionar logs de debug no loop de interpolação para identificar problemas
2. Verificar se há try/catch no loop que está engolindo erros
3. Garantir que criaturas removidas do worldState também são removidas do Map de sprites
4. Adicionar validação: se criatura não existe no worldState, remover do Map de sprites
5. Verificar se o servidor está enviando criaturas mortas na lista de updates
6. Considerar adicionar "garbage collection" periódica para sprites órfãos

## Código de Debug Sugerido
```typescript
private updateCreatureSprites(dt: number): void {
  console.log(`[DEBUG] Atualizando ${this.creatureSprites.size} sprites de criaturas`);
  
  for (const [creatureId, sprite] of this.creatureSprites) {
    // Validação: criatura ainda existe no worldState?
    if (!this.worldState.getCreature(creatureId)) {
      console.warn(`[DEBUG] Criatura órfã detectada: ${creatureId}`);
      this.destroyCreatureSprite(creatureId);
      continue;
    }
    // ... resto da interpolação
  }
}
```

## Critérios de Aceite
- [ ] Interpolação funciona para todas as criaturas
- [ ] Criaturas mortas são removidas corretamente
- [ ] Não há sprites órfãos no Map
- [ ] Console não mostra erros silenciosos
- [ ] Zero erros de linter
```

---

### PROMPT 3.1 - Corrigir Mensagens das Pokébolas

```
## Contexto
As pokébolas não estão mostrando as mensagens apropriadamente ao interagir com as criaturas no modo multiplayer.

## Problema
Em modo multiplayer, a captura é enviada ao servidor e o feedback vem do `handleCaptureResult()`. Pode haver delay ou a mensagem pode não estar sendo exibida corretamente.

## Arquivos a Analisar
- `src/scenes/ExpeditionScene.ts`:
  - `throwPokeball()` - linha ~4370
  - `updatePokeballProjectiles()` - linha ~4442
  - `handleCaptureResult()` - linha ~5383
  - `createFloatingText()` - método de feedback visual

## Tarefas
1. Verificar se `handleCaptureResult()` está sendo chamado (adicionar log)
2. Verificar se a criatura existe quando o resultado chega
3. Adicionar feedback imediato ao lançar: "Lançando..." ou efeito visual
4. Garantir que a posição do texto é baseada em `sprite.currentX/Y` (não target)
5. Aumentar visibilidade: tamanho maior, duração mais longa, cor mais vibrante
6. Considerar adicionar som de feedback

## Melhorias de UX Sugeridas
- Ao lançar pokébola: mostrar "🎯 Lançando..." na posição do jogador
- Ao acertar: mostrar "⏳ Capturando..." na posição da criatura
- Ao sucesso: mostrar "✅ CAPTURADO!" em verde grande
- Ao falhar: mostrar "❌ Escapou!" em vermelho

## Critérios de Aceite
- [ ] Mensagem aparece ao lançar pokébola
- [ ] Mensagem de sucesso/falha aparece corretamente
- [ ] Mensagens são visíveis e legíveis
- [ ] Posição das mensagens está correta
- [ ] Zero erros de linter
```

---

### PROMPT 4.1 - Adicionar Feedback Visual de Conexão (Opcional)

```
## Contexto
Atualmente não há indicação visual do estado da conexão multiplayer no HUD.

## Objetivo
Adicionar indicador de conexão/desconexão e opcionalmente ping/latência.

## Arquivos a Modificar
- `src/scenes/ExpeditionScene.ts`:
  - `updateHud()` - adicionar status de conexão
  - Handlers de `connected`, `disconnected`

## Tarefas
1. Adicionar variável de estado de conexão
2. Atualizar estado nos handlers de conexão/desconexão
3. Mostrar indicador no HUD: 🟢 Conectado / 🔴 Desconectado / 🟡 Reconectando
4. Opcionalmente: calcular e mostrar ping

## Critérios de Aceite
- [ ] Indicador mostra estado correto
- [ ] Atualiza em tempo real
- [ ] Não polui o HUD (discreto mas visível)
- [ ] Zero erros de linter
```

---

### PROMPT 4.2 - Renderizar Projéteis de Outros Jogadores (Opcional)

```
## Contexto
Atualmente projéteis de outros jogadores não são visíveis, apenas os do jogador local.

## Objetivo
Implementar renderização de projéteis remotos para melhor feedback visual de combate.

## Arquivos a Modificar
- `src/scenes/ExpeditionScene.ts`:
  - `handleProjectilesUpdate()` - handler existente
  - Adicionar Map de projéteis remotos
  - Adicionar loop de update para projéteis remotos

## Tarefas
1. Criar interface `RemoteProjectileSprite`
2. Criar Map para armazenar projéteis remotos
3. Implementar criação/destruição de sprites de projéteis
4. Implementar interpolação de posição
5. Diferenciar visualmente projéteis de outros jogadores (cor diferente)

## Critérios de Aceite
- [ ] Projéteis de outros jogadores são visíveis
- [ ] Movimento é suave (interpolado)
- [ ] Projéteis desaparecem corretamente
- [ ] Performance não é afetada significativamente
- [ ] Zero erros de linter
```

---

### PROMPT 4.3 - Animações de Entrada/Saída (Opcional)

```
## Contexto
Entidades aparecem e desaparecem abruptamente, sem transição visual.

## Objetivo
Adicionar fade-in quando entidades aparecem e fade-out quando desaparecem.

## Arquivos a Modificar
- `src/scenes/ExpeditionScene.ts`:
  - `createCreatureSprite()`, `createResourceSprite()`, `createPlayerSprite()`
  - `destroyCreatureSprite()`, `destroyResourceSprite()`, `destroyPlayerSprite()`

## Tarefas
1. Ao criar sprite, definir alpha = 0 e fazer tween para alpha = 1
2. Ao destruir sprite, fazer tween de alpha para 0, depois destroy
3. Garantir que tweens são cancelados se entidade for removida antes de terminar
4. Usar duração curta (200-300ms) para não atrapalhar gameplay

## Critérios de Aceite
- [ ] Entidades aparecem com fade-in suave
- [ ] Entidades desaparecem com fade-out suave
- [ ] Animações não causam bugs ou memory leaks
- [ ] Zero erros de linter
```

---

## Observações Finais

### Ordem de Execução Recomendada
1. **1.2** (Desconexão da room) - Mais simples, resolve problema crítico
2. **1.1** (Fantasma do player) - Depende de entender o fluxo de eventos
3. **2.1** (Deslizamento inicial) - Melhoria visual importante
4. **3.1** (Mensagens pokébolas) - UX importante
5. **2.2** (Interpolação travada) - Mais complexo, requer debug

### Testes Recomendados
- Testar sempre com 2+ clientes
- Testar cenários: extrair, morrer, desconectar, reconectar
- Verificar console do servidor e cliente para logs de debug

### Métricas de Sucesso
- Zero bugs visuais reportados
- Experiência fluida ao entrar/sair do mapa
- Feedback claro de todas as ações
- Conexão estável e limpa
