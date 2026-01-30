# Renderização de Jogadores Remotos em Multiplayer

## Data de Implementação
29 de Janeiro de 2026

## Visão Geral

Implementação completa do sistema de renderização e animação de outros jogadores em tempo real dentro de expedições multiplayer. Cada jogador remoto recebe uma representação visual completa com:

- **Sprite diferenciado**: Cor ciano (#06b6d4) para distinguir visualmente de jogadores locais
- **Nome flutuante**: Exibido acima de cada jogador com background escuro para legibilidade
- **Barra de HP**: Mostra saúde atual com cor dinâmica (verde → amarelo → vermelho)
- **Indicadores de ação**: Mostra quando outro jogador está atacando ou extraindo
- **Interpolação suave**: Movimento suave entre posições sincronizadas pelo servidor

## Arquitetura de Dados

### Interface `RemotePlayerSprite`

```typescript
interface RemotePlayerSprite {
  id: string;                          // ID único do jogador
  name: string;                        // Nome do treinador
  
  // Elementos visuais
  sprite: Phaser.GameObjects.Arc;      // Círculo do jogador (10px raio)
  nameText: Phaser.GameObjects.Text;   // Nome flutuante
  hpBar: Phaser.GameObjects.Rectangle; // Barra de HP (preenchimento)
  hpBarBg: Phaser.GameObjects.Rectangle; // Fundo da barra de HP
  hpBarText: Phaser.GameObjects.Text;  // Porcentagem de HP
  
  // Posição para interpolação
  currentX: number;                    // Posição visual atual (interpolada)
  currentY: number;
  targetX: number;                     // Posição alvo (do servidor)
  targetY: number;
  
  // Estado de HP
  currentHp: number;
  maxHp: number;
  
  // Indicador de ação
  actionIndicator: Phaser.GameObjects.Arc | null;
  actionType: "idle" | "attacking" | "extracting" | null;
  actionTimer: number;
}
```

### Armazenamento

```typescript
private remotePlayers: Map<string, RemotePlayerSprite> = new Map();
private clientId: string | null = null;  // Para filtrar o jogador local
private readonly remotePlayerRenderDistance = 800; // px
```

## Fluxo de Sincronização

### 1. Inicialização Multiplayer (`create()`)

```
ExpeditionScene.create()
  → Inicializa MultiplayerClient
  → Registra handler "joined" → captura clientId
  → Registra handler "state" → chama syncRemotePlayers()
  → Conecta ao servidor
```

### 2. Sincronização de Estado (`syncRemotePlayers()`)

Quando o servidor envia snapshot de estado:

1. **Filtragem do jogador local**:
   ```typescript
   if (this.clientId && p.id === this.clientId) continue;
   ```

2. **Criação de novo sprite** (se não existe):
   ```typescript
   if (!this.remotePlayers.has(p.id)) {
     this.createRemotePlayerSprite(p);
   }
   ```

3. **Atualização de posição alvo** (para interpolação):
   ```typescript
   remotePlayer.targetX = p.x;
   remotePlayer.targetY = p.y;
   ```

4. **Remoção de desconectados**:
   ```typescript
   for (const [id, remotePlayer] of this.remotePlayers.entries()) {
     if (!seen.has(id)) {
       this.destroyRemotePlayerSprite(remotePlayer);
       this.remotePlayers.delete(id);
     }
   }
   ```

### 3. Atualização de Renderização (`updateRemotePlayers()`)

Executado a cada frame no loop principal:

#### Interpolação Suave
```typescript
const dx = remotePlayer.targetX - remotePlayer.currentX;
const dy = remotePlayer.targetY - remotePlayer.currentY;
const distance = Math.sqrt(dx * dx + dy * dy);

if (distance > 0.5) {
  const moveSpeed = interpolationSpeed * dt;
  const moveRatio = Math.min(1, moveSpeed / Math.max(distance, 0.1));
  
  remotePlayer.currentX += dx * moveRatio;
  remotePlayer.currentY += dy * moveRatio;
}
```

#### Culling de Distance
```typescript
const distFromPlayer = Math.sqrt(
  Math.pow(remotePlayer.currentX - this.player.x, 2) +
  Math.pow(remotePlayer.currentY - this.player.y, 2)
);

const shouldRender = distFromPlayer <= remotePlayerRenderDistance;
remotePlayer.sprite.setVisible(shouldRender);
```

#### Atualização de HP Visual
```typescript
const hpRatio = Math.max(0, Math.min(1, remotePlayer.currentHp / remotePlayer.maxHp));
remotePlayer.hpBar.setScale(hpRatio, 1);

// Cor dinâmica baseada em HP
if (hpRatio > 0.5) {
  remotePlayer.hpBar.setFillStyle(0x10b981); // Verde
} else if (hpRatio > 0.25) {
  remotePlayer.hpBar.setFillStyle(0xfacc15); // Amarelo
} else {
  remotePlayer.hpBar.setFillStyle(0xef4444); // Vermelho
}
```

#### Indicadores de Ação
```typescript
if (remotePlayer.actionType && remotePlayer.actionTimer > 0) {
  remotePlayer.actionIndicator.setVisible(true);
  
  // Animação com pulse
  const pulse = 1 + Math.sin(this.expeditionTime * 6) * 0.3;
  remotePlayer.actionIndicator.setScale(pulse);
  
  // Cor conforme ação
  if (remotePlayer.actionType === "attacking") {
    remotePlayer.actionIndicator.setFillStyle(0xef4444); // Vermelho
  } else if (remotePlayer.actionType === "extracting") {
    remotePlayer.actionIndicator.setFillStyle(0x3b82f6); // Azul
  }
  
  remotePlayer.actionTimer -= dt;
} else {
  remotePlayer.actionIndicator.setVisible(false);
}
```

## Diferenciação Visual

### Jogador Local
- Sprite: **Verde** (#4ade80)
- Raro: Renderizado sem limite de distância
- HP bar: Gerenciado pelo `HPBarManager`

### Jogadores Remotos
- Sprite: **Ciano** (#06b6d4)
- Nome: **Flutuante** com background
- HP Bar: **Individual** para cada remoto
- Limite: `remotePlayerRenderDistance = 800px`

## Otimizações de Performance

### 1. Distance Culling
Jogadores fora de 800 pixels são marcados como invisíveis:
```typescript
const distFromPlayer = Math.sqrt(
  Math.pow(remotePlayer.currentX - this.player.x, 2) +
  Math.pow(remotePlayer.currentY - this.player.y, 2)
);
shouldRender = distFromPlayer <= remotePlayerRenderDistance;
```

### 2. Interpolação Otimizada
Usar constante de velocidade (`interpolationSpeed = 8`) evita cálculos desnecessários.

### 3. Limpeza de Recursos
Ao sair da expedição:
```typescript
for (const remotePlayer of this.remotePlayers.values()) {
  remotePlayer.sprite?.destroy();
  remotePlayer.nameText?.destroy();
  remotePlayer.hpBar?.destroy();
  remotePlayer.hpBarBg?.destroy();
  remotePlayer.hpBarText?.destroy();
  remotePlayer.actionIndicator?.destroy();
}
this.remotePlayers.clear();
```

## Próximas Evoluções (Future)

### Curto Prazo
1. **Eventos de ação do servidor**: 
   - Receber eventos "attack_result", "capture_result" via MultiplayerClient
   - Ativar `actionIndicator` baseado nesses eventos

2. **Efeitos visuais de dano**:
   - Piscar sprite remoto quando toma dano
   - Partículas de número de dano

3. **Nomes acima da cabeça** (minimapa remoto):
   - Mostrar nomes remotos no minimapa
   - Indicadores de ameaça/amizade

### Médio Prazo
1. **Estados visuais adicionais**:
   - Indicador se está em zona segura de extração
   - Status de captura em progresso

2. **Animações de movimento**:
   - Rotação do sprite conforme direção
   - Efeito de corrida/caminhada

3. **Interações visuais**:
   - Mostrar criaturas sendo usadas por remotos
   - Mostrar efeitos de habilidades special skills

## Testes Recomendados

### Teste Local
1. Abrir múltiplas abas com `?mp=1`
2. Verificar que cada aba vê as outras (exceto a si mesma)
3. Mover em uma aba e observar interpolação suave nas outras

### Teste de Performance
```
Configuração: 12 jogadores na sala
Métrica: FPS mantém acima de 30 mesmo com todos visíveis
```

### Teste de Limites
1. Mover 800+ pixels de outro jogador → desaparece
2. Retornar para 799 pixels → reaparece
3. Remover jogador da sala → sprite destruído sem memleaks

## Ficheiros Modificados

- `src/scenes/ExpeditionScene.ts`
  - Interface `RemotePlayerSprite` adicionada
  - Propriedades: `remotePlayers`, `clientId`, `remotePlayerRenderDistance`
  - Métodos:
    - `syncRemotePlayers()` - handler de estado do servidor
    - `createRemotePlayerSprite()` - criação de novo sprite
    - `destroyRemotePlayerSprite()` - destruição e limpeza
    - `updateRemotePlayers()` - interpolação e atualização de renderização

## Referências

- `multiplayer-plan.md` - Plano geral de multiplayer
- `src/services/multiplayerClient.ts` - Cliente WebSocket
- `src/game/hpBars.ts` - Sistema de barras de HP (inspiração)
