# Sprint 4: Integração Times + Expedição - Plano de Execução

**Data**: Janeiro 2026  
**Status**: Pronto para Execução  
**Duração Estimada**: 3-4 dias

---

## 📋 Contexto do Projeto

**PokéExtract: Wild Expedition** é um jogo multiplayer de extração em browser onde jogadores exploram mapas top-down, capturam criaturas, coletam recursos e enfrentam outros jogadores em combate de ação em tempo real.

### Arquitetura
- **Server-Authoritative**: Servidor valida e processa todas as ações
- **Multiplayer-First**: Sempre conecta ao servidor, sem modo offline
- **Game Loop**: 20 ticks/s no servidor
- **Comunicação**: WebSocket em tempo real + HTTP REST API
- **Persistência**: Firebase Firestore

### Status das Sprints Anteriores
✅ Sprint 1 concluída: Sistema de PvP básico
✅ Sprint 2 concluída: Polimento PvP
✅ Sprint 3 concluída: Sistema de Times

---

## 🎯 Objetivos da Sprint

Integrar sistema de times com expedições:
1. Entrada em expedição com time (join em grupo)
2. Marcar membros como "em jogo"
3. Friendly fire para times (opcional - estrutura para futuro)
4. Melhorias de UX para times em jogo

---

## 📁 Arquivos de Referência

### Arquivos a Ler para Contexto
1. `server/src/handlers/JoinHandler.ts` - Handler de entrada em sala
2. `server/src/managers/TeamManager.ts` - Gerenciador de times
3. `server/src/types/TeamTypes.ts` - Tipos de times
4. `server/src/types/ServerTypes.ts` - PlayerPresence, Room, JoinMessage
5. `server/src/room/RoomManager.ts` - Gerenciamento de salas
6. `server/src/systems/combat.ts` - Sistema de combate (para friendly fire)
7. `src/scenes/TeamLobbyScene.ts` - Lobby de times
8. `src/scenes/ExpeditionScene.ts` - Cena de expedição
9. `server/src/constants.ts` - Constantes (MAX_PLAYERS_PER_ROOM, etc)

### Arquivos a Modificar
1. `server/src/handlers/JoinHandler.ts` - Verificar time e permitir join em grupo
2. `server/src/managers/TeamManager.ts` - Adicionar método setTeamInGame()
3. `server/src/types/ServerTypes.ts` - Adicionar campo disableTeamFriendlyFire (opcional)
4. `server/src/systems/combat.ts` - Adicionar validação de friendly fire (opcional)
5. `src/scenes/TeamLobbyScene.ts` - Adicionar botão "Iniciar Expedição"
6. `server/src/room/RoomManager.ts` - Verificar espaço para time (se necessário)

---

## ✅ Tarefas Detalhadas

### Fase 9: Entrada em Expedição com Time

#### 9.1 Modificar Join Handler para Times
**Arquivo**: `server/src/handlers/JoinHandler.ts`

**O que fazer**:
- Localizar função que processa mensagem `join`
- Verificar se jogador está em time usando `teamManager.getTeamByUserId()`
- Se está em time, verificar se outros membros já estão na sala
- Verificar se há espaço suficiente para todos os membros do time
- Permitir join se houver espaço

**Código de referência** (do plano):
```typescript
// Verificar se jogador está em time
const team = teamManager.getTeamByUserId(msg.userId || "");
if (team) {
  // Verificar se outros membros do time já estão na sala
  const teamMembersInRoom = team.members
    .filter(m => m.currentRoomId === msg.roomId)
    .map(m => m.userId);
  
  // Permitir join se houver espaço para todos os membros
  const availableSlots = MAX_PLAYERS_PER_ROOM - room.clients.size;
  const membersNotInRoom = team.members.length - teamMembersInRoom.length;
  
  if (membersNotInRoom > 0 && availableSlots < membersNotInRoom) {
    return { success: false, error: "not_enough_slots_for_team" };
  }
}
```

**Nota**: Ajustar lógica conforme estrutura existente de `JoinHandler`. Pode ser que a verificação precise ser feita antes de criar o player ou em outro lugar.

#### 9.2 Marcar Membros como "em jogo"
**Arquivo**: `server/src/managers/TeamManager.ts`

**Novo Método**:
```typescript
/**
 * Marca membros do time como "em jogo".
 */
setTeamInGame(teamId: string, roomId: string): void {
  const team = this.teams.get(teamId);
  if (!team) return;

  for (const member of team.members) {
    member.status = "in_game";
    member.currentRoomId = roomId;
  }
}

/**
 * Marca membros do time como "online" (saiu do jogo).
 */
setTeamOffline(teamId: string): void {
  const team = this.teams.get(teamId);
  if (!team) return;

  for (const member of team.members) {
    if (member.status === "in_game") {
      member.status = "online";
      member.currentRoomId = undefined;
    }
  }
}
```

**Integração**:
- Chamar `setTeamInGame()` quando jogador entra na sala (se está em time)
- Chamar `setTeamOffline()` quando jogador sai da sala (se está em time)
- Verificar onde isso deve ser feito (JoinHandler, GameLoopManager, etc)

#### 9.3 Atualizar Status ao Entrar/Sair
**Arquivo**: `server/src/handlers/JoinHandler.ts` e onde jogador sai

**Mudança em JoinHandler**:
```typescript
// Após criar player com sucesso
if (team) {
  teamManager.setTeamInGame(team.id, room.id);
}
```

**Mudança ao sair** (verificar onde jogador desconecta):
```typescript
// Quando jogador sai da sala
const team = teamManager.getTeamByUserId(player.userId || "");
if (team) {
  // Verificar se ainda há membros na sala
  const membersStillInRoom = team.members.some(m => 
    m.currentRoomId === room.id && m.userId !== player.userId
  );
  
  if (!membersStillInRoom) {
    teamManager.setTeamOffline(team.id);
  } else {
    // Apenas atualizar status deste membro
    const member = team.members.find(m => m.userId === player.userId);
    if (member) {
      member.status = "online";
      member.currentRoomId = undefined;
    }
  }
}
```

---

### Fase 10: Friendly Fire para Times (Opcional)

#### 10.1 Adicionar Flag de Friendly Fire
**Arquivo**: `server/src/types/ServerTypes.ts`

**Mudança em `Room`**:
```typescript
export interface Room {
  // ... campos existentes
  /** Se friendly fire está desabilitado para times */
  disableTeamFriendlyFire: boolean;
}
```

**Valor padrão**: `false` (friendly fire ligado - FFA)

#### 10.2 Modificar Sistema de Combate
**Arquivo**: `server/src/systems/combat.ts`

**Mudança em `updateProjectiles()`** (onde verifica colisão PvP):
```typescript
// Verificar se atacante e alvo estão no mesmo time
if (room.disableTeamFriendlyFire) {
  const attackerTeam = teamManager.getTeamByUserId(proj.ownerId);
  const targetTeam = teamManager.getTeamByUserId(targetPlayerId);
  
  if (attackerTeam && targetTeam && attackerTeam.id === targetTeam.id) {
    continue; // Não pode atacar membro do mesmo time
  }
}
```

**Nota**: Esta funcionalidade é opcional e pode ser ativada no futuro. Por enquanto, manter FFA (friendly fire ligado).

---

### Melhorias de UX

#### 11.1 Botão "Iniciar Expedição" no Lobby
**Arquivo**: `src/scenes/TeamLobbyScene.ts`

**Funcionalidade**:
- Adicionar botão "Iniciar Expedição" ou "Entrar em Expedição"
- Verificar se todos os membros estão online
- Navegar para seleção de expedição ou entrar direto

**Código sugerido**:
```typescript
private renderActions() {
  // ... outros botões
  
  if (this.teamData && this.isLeader()) {
    const startButton = this.add.text(x, y, "Iniciar Expedição", {
      fontSize: '24px',
      color: '#00ff00'
    });
    startButton.setInteractive({ useHandCursor: true });
    startButton.on('pointerdown', () => {
      // Navegar para seleção de expedição
      // Ou entrar direto em uma sala
      this.scene.start('ExpeditionInventorySelectionScene');
    });
  }
}
```

#### 11.2 Indicador Visual de Membros do Time
**Arquivo**: `src/scenes/ExpeditionScene.ts`

**Funcionalidade**:
- Mostrar indicador visual de membros do time (ex: cor diferente, nome destacado)
- Mostrar posição de membros no minimap (se houver)
- Mostrar status de membros (vida, etc)

**Código sugerido**:
```typescript
// Ao renderizar jogadores remotos
private renderRemotePlayer(player: RemotePlayer) {
  // Verificar se é membro do time
  const isTeammate = this.isTeammate(player.userId);
  
  if (isTeammate) {
    // Renderizar com cor/estilo diferente
    // Ex: borda verde, nome destacado
  }
}

private isTeammate(userId: string): boolean {
  // Verificar se userId está no time atual
  // Pode precisar buscar dados do time
  return false; // Implementar
}
```

#### 11.3 Atualizar Status no Lobby em Tempo Real
**Arquivo**: `src/scenes/TeamLobbyScene.ts`

**Funcionalidade**:
- Polling ou WebSocket para atualizar status de membros
- Mostrar quando membro entra/sai de jogo
- Atualizar lista de membros automaticamente

**Código sugerido**:
```typescript
private startStatusPolling() {
  // Polling a cada 2-3 segundos
  this.statusPollTimer = setInterval(async () => {
    await this.loadTeamData();
    this.renderTeamMembers();
  }, 3000);
}

private stopStatusPolling() {
  if (this.statusPollTimer) {
    clearInterval(this.statusPollTimer);
  }
}
```

---

## 🚀 Prompt de Execução

```
Implementar Sprint 4: Integração Times + Expedição conforme o plano em PVP_AND_TEAMS_IMPLEMENTATION_PLAN.md.

CONTEXTO:
- Sistema de times já implementado (Sprint 3)
- Sistema de expedições já existe
- Agora integrar os dois sistemas

TAREFAS:

1. FASE 9: Entrada em Expedição com Time
   - Modificar JoinHandler.ts para verificar se jogador está em time
   - Verificar espaço suficiente para todos os membros
   - Permitir join em grupo
   - Adicionar método setTeamInGame() no TeamManager
   - Marcar membros como "in_game" ao entrar
   - Atualizar status ao sair

2. FASE 10: Friendly Fire (Opcional)
   - Adicionar flag disableTeamFriendlyFire em Room
   - Modificar combat.ts para verificar times
   - Por enquanto manter FFA (friendly fire ligado)

3. MELHORIAS DE UX
   - Adicionar botão "Iniciar Expedição" no TeamLobbyScene
   - Indicador visual de membros do time na expedição
   - Atualizar status no lobby em tempo real (opcional)

VALIDAÇÕES IMPORTANTES:
- Verificar espaço suficiente antes de permitir join
- Atualizar status de membros corretamente
- Tratar casos de membros desconectando
- Status deve refletir estado real

REFERÊNCIAS:
- Ler server/src/handlers/JoinHandler.ts para entender entrada em sala
- Ler server/src/managers/TeamManager.ts para entender gerenciamento de times
- Ler server/src/room/RoomManager.ts para entender gerenciamento de salas
- Seguir padrões existentes de código

NOTAS:
- Friendly fire pode ser desabilitado no futuro, mas por enquanto manter FFA
- Melhorias de UX são importantes para experiência do jogador
- Testar casos de membros entrando/saindo em momentos diferentes

Ao finalizar, testar:
- Time pode entrar em expedição juntos
- Status de membros é atualizado corretamente
- Espaço é verificado antes de permitir join
- Membros são marcados como "in_game"
- Status é atualizado ao sair
- Indicadores visuais funcionam (se implementados)
```

---

## ✅ Checklist de Validação

- [ ] JoinHandler verifica se jogador está em time
- [ ] Espaço suficiente é verificado antes de permitir join
- [ ] Membros são marcados como "in_game" ao entrar
- [ ] Status é atualizado ao sair
- [ ] setTeamInGame() funciona corretamente
- [ ] setTeamOffline() funciona corretamente
- [ ] Flag disableTeamFriendlyFire existe (opcional)
- [ ] Validação de friendly fire funciona (opcional)
- [ ] Botão "Iniciar Expedição" funciona
- [ ] Indicadores visuais de membros funcionam (opcional)
- [ ] Status no lobby é atualizado (opcional)

---

## 📝 Notas de Implementação

- **Join em Grupo**: Pode ser que todos os membros precisem fazer join individualmente, mas o servidor deve verificar se há espaço para todos.
- **Status**: Status de membros deve ser atualizado em tempo real para melhor UX.
- **Friendly Fire**: Por enquanto manter FFA, mas estrutura pronta para desabilitar no futuro.
- **UX**: Indicadores visuais ajudam jogadores a identificar membros do time na expedição.
- **Edge Cases**: Tratar casos como membro desconectando, time dissolvendo durante jogo, etc.
