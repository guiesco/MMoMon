# Teste de Renderização de Jogadores Remotos

## Setup Rápido

### Pré-requisitos
- Servidor WebSocket em execução (`npm run server`)
- Cliente compilado e executando (`npm run dev`)

### Ativar Multiplayer
Adicione `?mp=1` à URL:
```
http://localhost:5173?mp=1
```

## Teste Manual - Múltiplas Abas

### Procedimento

1. **Abra 2+ abas com multiplayer ativo**:
   ```
   Tab A: http://localhost:5173?mp=1
   Tab B: http://localhost:5173?mp=1
   Tab C: http://localhost:5173?mp=1
   ```

2. **Entre em expedição em cada aba**:
   - Autentique com nomes diferentes (ex: "Jogador1", "Jogador2", "Jogador3")
   - Clique em "Entrar em Expedição"

3. **Verifique renderização inicial**:
   - Em Tab A, deve ver círculos ciano para Jogador2 e Jogador3
   - Verificar que cada aba só vê os OUTROS jogadores (não a si mesma)
   - Verificar que nomes aparecem acima de cada sprite

### Testes Específicos

#### Teste 1: Renderização Correta
```
✓ Jogador local não aparece entre remotos
✓ Outros jogadores aparecem com cor ciano (#06b6d4)
✓ Nomes flutuam acima de cada jogador
✓ Barras de HP aparecem abaixo de cada jogador
```

#### Teste 2: Interpolação Suave
```
Procedimento:
1. Mova o jogador em Tab A (press WASD)
2. Observe em Tab B como o sprite se move SUAVEMENTE
   (não "teleporta", mas desliza)
3. Velocidade deve ser responsiva mas não "pula"
```

#### Teste 3: Atualização de HP
```
Procedimento:
1. Simule dano em Tab A (aperte espaço para atacar aliados/criar dano)
2. Observe em Tab B: barra de HP deve mudar cor conforme HP cai
   - Verde (>50%): #10b981
   - Amarelo (25-50%): #fbbf24
   - Vermelho (<25%): #ef4444
```

#### Teste 4: Distance Culling
```
Procedimento:
1. Em Tab B, mova longe (>800px) de outro jogador
2. Sprite remoto deve desaparecer
3. Mova de volta (<800px)
4. Sprite remoto deve reaparecer
```

#### Teste 5: Remoção de Jogadores
```
Procedimento:
1. Feche Tab A enquanto expedição está ativa
2. Em Tab B: sprite de "Jogador1" deve desaparecer
3. Não deve haver lag ou erro no console
```

#### Teste 6: Performance
```
Procedimento:
1. Abra 5+ abas com multiplayer
2. Mantenha todos visíveis (dentro de 800px)
3. Monitore no DevTools:
   - FPS deve manter acima de 30 mesmo com 5+ jogadores
   - Sem memory leaks ao fechar/reabrir abas
```

## Console Debug

### Logs Relevantes

**Conexão Multiplayer:**
```
[MP] Conectado com ID: c1
[MP] Estado de partida recebido { ... }
```

**Criação/Remoção de Sprites:**
Não há logs específicos, mas você pode adicionar no futuro em:
- `createRemotePlayerSprite()`
- `destroyRemotePlayerSprite()`
- `syncRemotePlayers()`

### Debug Manual

No console browser:
```javascript
// Ver lista de jogadores remotos atuais
console.log(game.scene.getScene('ExpeditionScene').remotePlayers);

// Ver informações de um jogador específico
const remotePlayer = game.scene.getScene('ExpeditionScene').remotePlayers.get('c2');
console.log(remotePlayer);

// Ver ID do cliente local
console.log(game.scene.getScene('ExpeditionScene').clientId);
```

## Problemas Esperados e Soluções

### Problema: Sprites remotos não aparecem
**Causas possíveis:**
1. Servidor não está enviando snapshots de "state"
2. clientId não foi capturado (não recebeu mensagem "joined")
3. Multiplicador está desligado (?mp=1 não presente)

**Debug:**
```javascript
const scene = game.scene.getScene('ExpeditionScene');
console.log('clientId:', scene.clientId);
console.log('mpClient conectado:', scene.mpClient?.isConnected());
console.log('remotePlayers:', scene.remotePlayers.size);
```

### Problema: Sprites "teleportam" ao invés de interpolar
**Causa:** Velocidade de interpolação muito alta ou muito baixa
**Solução:** Ajuste `interpolationSpeed` em `updateRemotePlayers()`:
```typescript
const interpolationSpeed = 8; // Aumentar para mais rápido, diminuir para mais lento
```

### Problema: HP bar não atualiza
**Causa:** Servidor não está enviando HP no snapshot de "state"
**Debug:**
```javascript
// Adicione log no MultiplayerClient.handleStateMessage()
console.log('Players recebidos:', players);
// Verificar se players[i].hp e players[i].maxHp estão presentes
```

### Problema: Nomes cortados ou ilegíveis
**Solução:** Ajuste tamanho/posição do nameText em `createRemotePlayerSprite()`:
```typescript
const nameText = this.add.text(p.x, p.y - 20, p.name, {
  fontSize: "12px",  // Aumentar se necessário
  // ...
});
```

## Métricas de Sucesso

Implementação completa quando:

- ✅ Múltiplos jogadores remotos renderizados corretamente
- ✅ Posições interpoladas suavemente entre snapshots
- ✅ Nomes flutuantes legíveis acima de cada jogador
- ✅ Barras de HP com cores dinâmicas
- ✅ Distance culling funciona (800px limit)
- ✅ Jogador local filtrado corretamente
- ✅ Remoção de jogadores sem memleaks
- ✅ FPS acima de 30 com 5+ jogadores simultâneos
- ✅ Sem erros de TypeScript/linter

## Próximos Passos Após Validação

1. **Implementar eventos de ação**:
   - Receber "attack_result", "capture_result" do servidor
   - Ativar `actionIndicator` com cores específicas

2. **Adicionar efeitos visuais**:
   - Piscar sprite ao tomar dano
   - Partículas de crítico/miss

3. **Integrar com sistema de combate**:
   - Mostrar ataques de jogadores remotos
   - Validação no servidor

## Referências

- Arquivo: `/src/scenes/ExpeditionScene.ts`
- Métodos relacionados:
  - `syncRemotePlayers()` - linha ~2830
  - `createRemotePlayerSprite()` - linha ~2875
  - `destroyRemotePlayerSprite()` - linha ~2940
  - `updateRemotePlayers()` - linha ~2950
