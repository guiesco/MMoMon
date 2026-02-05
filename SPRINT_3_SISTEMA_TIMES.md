# Sprint 3: Sistema de Times - Plano de Execução

**Data**: Janeiro 2026  
**Status**: Pronto para Execução  
**Duração Estimada**: 4-6 dias

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

---

## 🎯 Objetivos da Sprint

Implementar sistema completo de times:
1. Estrutura de dados de times (Team, TeamMember, TeamInvite)
2. Gerenciador de times (TeamManager)
3. API HTTP para operações de times
4. Lobby de times no cliente

---

## 📁 Arquivos de Referência

### Arquivos a Ler para Contexto
1. `server/src/httpServer.ts` - Estrutura de API HTTP existente
2. `server/src/types/ServerTypes.ts` - Interfaces e tipos existentes
3. `server/src/firestoreOperations.ts` - Operações com Firebase
4. `src/scenes/BaseHubScene.ts` - Cena base do hub
5. `src/scenes/TeamManagementScene.ts` - Cena existente de times (verificar se já existe)
6. `src/services/firebaseClient.ts` - Cliente Firebase
7. `server/src/constants.ts` - Constantes do jogo

### Arquivos a Criar
1. `server/src/types/TeamTypes.ts` - Tipos de times, membros e convites
2. `server/src/managers/TeamManager.ts` - Gerenciador de times
3. `src/scenes/TeamLobbyScene.ts` - Cena de lobby de times

### Arquivos a Modificar
1. `server/src/httpServer.ts` - Adicionar endpoints de times
2. `src/scenes/BaseHubScene.ts` - Adicionar botão/navegação para times
3. `server/src/firestoreOperations.ts` - Adicionar operações de times (se necessário para persistência)

---

## ✅ Tarefas Detalhadas

### Fase 6: Estrutura de Dados de Times

#### 6.1 Criar Interfaces de Times
**Arquivo**: `server/src/types/TeamTypes.ts` (NOVO)

**Interfaces a criar**:
```typescript
/**
 * Representa um time de jogadores.
 */
export interface Team {
  id: string;
  name: string;
  leaderId: string; // ID do líder do time
  members: TeamMember[];
  createdAt: number;
  /** Configurações do time */
  settings: {
    maxMembers: number; // Padrão: 4
    isPublic: boolean; // Se aparece na lista pública
    allowInvites: boolean; // Se aceita invites
  };
}

/**
 * Membro de um time.
 */
export interface TeamMember {
  userId: string;
  displayName: string;
  role: "leader" | "member";
  joinedAt: number;
  /** Status atual do membro */
  status: "online" | "offline" | "in_game";
  /** ID da sala atual (se estiver em jogo) */
  currentRoomId?: string;
}

/**
 * Convite para entrar em um time.
 */
export interface TeamInvite {
  id: string;
  teamId: string;
  inviterId: string; // Quem enviou o convite
  inviteeId: string; // Quem recebeu o convite
  createdAt: number;
  expiresAt: number; // Expira após 5 minutos
  status: "pending" | "accepted" | "rejected" | "expired";
}
```

**Nota**: Ajustar tipos conforme necessário para compatibilidade com Firebase e estrutura existente.

---

### Fase 7: Gerenciador de Times

#### 7.1 Criar TeamManager
**Arquivo**: `server/src/managers/TeamManager.ts` (NOVO)

**Funcionalidades a implementar**:

1. **createTeam(leaderId, teamName)**: Cria novo time
   - Gerar ID único
   - Adicionar líder como primeiro membro
   - Configurações padrão (maxMembers: 4, isPublic: true, allowInvites: true)

2. **disbandTeam(teamId)**: Remove time
   - Remover referências de membros
   - Remover convites pendentes
   - Limpar mapeamentos

3. **addMember(teamId, userId, displayName)**: Adiciona membro
   - Verificar se já está em time
   - Verificar limite de membros
   - Adicionar ao array de membros

4. **removeMember(teamId, userId)**: Remove membro
   - Remover do array
   - Se era líder e há outros membros, transferir liderança
   - Se era líder e não há outros membros, dissolver time

5. **createInvite(teamId, inviterId, inviteeId)**: Cria convite
   - Validar permissões
   - Validar se invitee já está em time
   - Validar limite de membros
   - Criar convite com expiração (5 minutos)

6. **acceptInvite(inviteId, userId)**: Aceita convite
   - Validar convite existe e está pendente
   - Validar não expirou
   - Adicionar membro ao time
   - Marcar convite como aceito

7. **rejectInvite(inviteId, userId)**: Rejeita convite
   - Validar convite existe e está pendente
   - Marcar como rejeitado

8. **getTeamByUserId(userId)**: Obtém time do usuário
   - Retornar Team ou null

9. **getPublicTeams()**: Lista times públicos
   - Filtrar por `settings.isPublic === true`

**Estrutura de dados interna**:
```typescript
export class TeamManager {
  private teams: Map<string, Team> = new Map();
  private invites: Map<string, TeamInvite> = new Map();
  private userToTeam: Map<string, string> = new Map(); // userId -> teamId
  // ... métodos
}
```

**Nota**: Verificar se precisa buscar `displayName` do Firebase. Se sim, usar `firestoreOperations.ts`.

---

### Fase 8: API HTTP de Times

#### 8.1 Adicionar Endpoints
**Arquivo**: `server/src/httpServer.ts`

**Endpoints a criar**:

1. **POST /api/teams/create**
   - Body: `{ userId, teamName }`
   - Retorna: `{ team }`
   - Validações: userId e teamName obrigatórios

2. **GET /api/teams/my-team**
   - Query: `?userId=xxx`
   - Retorna: `{ team }` ou `{ team: null }`
   - Validações: userId obrigatório

3. **GET /api/teams/public**
   - Retorna: `{ teams: Team[] }`
   - Sem parâmetros

4. **POST /api/teams/invite**
   - Body: `{ teamId, inviterId, inviteeId }`
   - Retorna: `{ invite }` ou erro
   - Validações: todos os campos obrigatórios

5. **POST /api/teams/invite/accept**
   - Body: `{ inviteId, userId }`
   - Retorna: `{ success: true }` ou erro
   - Validações: todos os campos obrigatórios

6. **POST /api/teams/invite/reject**
   - Body: `{ inviteId, userId }`
   - Retorna: `{ success: boolean }`
   - Validações: todos os campos obrigatórios

7. **POST /api/teams/leave** (opcional)
   - Body: `{ userId }`
   - Retorna: `{ success: boolean }`
   - Remove membro do time

8. **POST /api/teams/disband** (opcional)
   - Body: `{ userId, teamId }`
   - Retorna: `{ success: boolean }`
   - Apenas líder pode dissolver

**Estrutura**:
```typescript
import { TeamManager } from "./managers/TeamManager";

const teamManager = new TeamManager();

// Endpoints aqui...
```

**Nota**: Verificar estrutura existente de `httpServer.ts` para seguir padrões (middleware, error handling, etc).

---

### Fase 9: Lobby de Times no Cliente

#### 9.1 Criar TeamLobbyScene
**Arquivo**: `src/scenes/TeamLobbyScene.ts` (NOVO)

**Funcionalidades**:

1. **Carregar dados do time**
   - Fazer fetch para `/api/teams/my-team?userId=xxx`
   - Se não tem time, mostrar opção de criar ou buscar times públicos

2. **Renderizar lista de membros**
   - Nome, status (online/offline/in_game), role (líder/membro)
   - Indicador visual de status
   - Botão para remover membro (apenas líder)

3. **Renderizar convites pendentes**
   - Lista de convites recebidos
   - Botões Aceitar/Rejeitar
   - Mostrar quem convidou e quando

4. **Ações do time**
   - Botão "Criar Time" (se não tem time)
   - Botão "Sair do Time" (se é membro)
   - Botão "Dissolver Time" (apenas líder)
   - Botão "Iniciar Expedição" (futuro - Sprint 4)
   - Botão "Convidar Jogador" (futuro - precisa sistema de busca)

5. **Lista de times públicos**
   - Mostrar times públicos disponíveis
   - Botão para solicitar entrada (futuro)

**Estrutura básica**:
```typescript
export class TeamLobbyScene extends Phaser.Scene {
  private teamData: Team | null = null;
  private invites: TeamInvite[] = [];

  async create() {
    // Carregar dados
    await this.loadTeamData();
    
    // Renderizar UI
    this.renderTeamMembers();
    this.renderInvites();
    this.renderActions();
  }

  private async loadTeamData() {
    const userId = this.getUserId(); // Implementar método para obter userId
    const response = await fetch(`/api/teams/my-team?userId=${userId}`);
    const data = await response.json();
    this.teamData = data.team;
  }

  private renderTeamMembers() {
    // Renderizar lista de membros
  }

  private renderInvites() {
    // Renderizar convites
  }

  private renderActions() {
    // Botões de ação
  }
}
```

**Nota**: Usar padrões visuais similares a outras cenas (BaseHubScene, InventoryScene, etc).

#### 9.2 Integrar com BaseHubScene
**Arquivo**: `src/scenes/BaseHubScene.ts`

**Mudança**: Adicionar botão "Times" que navega para `TeamLobbyScene`.

**Código sugerido**:
```typescript
// Adicionar botão na UI
const teamButton = this.add.text(x, y, "Times", {
  fontSize: '24px',
  color: '#ffffff'
});
teamButton.setInteractive({ useHandCursor: true });
teamButton.on('pointerdown', () => {
  this.scene.start('TeamLobbyScene');
});
```

**Registrar cena** no BootScene ou onde as cenas são registradas:
```typescript
this.scene.add('TeamLobbyScene', TeamLobbyScene);
```

---

## 🚀 Prompt de Execução

```
Implementar Sprint 3: Sistema de Times conforme o plano em PVP_AND_TEAMS_IMPLEMENTATION_PLAN.md.

CONTEXTO:
- Jogo multiplayer server-authoritative
- API HTTP já existe (httpServer.ts)
- Firebase Firestore para persistência (opcional nesta sprint - pode ser em memória)
- Sistema de PvP já implementado

TAREFAS:

1. FASE 6: Estrutura de Dados
   - Criar server/src/types/TeamTypes.ts com interfaces Team, TeamMember, TeamInvite
   - Definir estrutura completa de times

2. FASE 7: Gerenciador de Times
   - Criar server/src/managers/TeamManager.ts
   - Implementar todos os métodos:
     * createTeam, disbandTeam
     * addMember, removeMember
     * createInvite, acceptInvite, rejectInvite
     * getTeamByUserId, getPublicTeams
   - Usar Map para armazenamento em memória (persistência pode vir depois)

3. FASE 8: API HTTP
   - Adicionar endpoints em server/src/httpServer.ts:
     * POST /api/teams/create
     * GET /api/teams/my-team
     * GET /api/teams/public
     * POST /api/teams/invite
     * POST /api/teams/invite/accept
     * POST /api/teams/invite/reject
   - Seguir padrões existentes de API
   - Tratar erros adequadamente

4. FASE 9: Lobby de Times
   - Criar src/scenes/TeamLobbyScene.ts
   - Implementar UI para:
     * Lista de membros do time
     * Status de cada membro
     * Convites pendentes
     * Ações (criar, sair, dissolver)
   - Integrar com BaseHubScene (botão "Times")

VALIDAÇÕES IMPORTANTES:
- Apenas líder pode dissolver time
- Apenas líder pode remover membros
- Convites expiram após 5 minutos
- Usuário não pode estar em múltiplos times
- Limite de 4 membros por time (configurável)
- Validações de permissões em todos os endpoints

REFERÊNCIAS:
- Ler server/src/httpServer.ts para entender estrutura de API
- Ler src/scenes/BaseHubScene.ts para entender padrões de UI
- Seguir padrões existentes de código

NOTAS:
- Persistência em Firebase pode ser adicionada depois (por enquanto em memória)
- Sistema de busca de jogadores para convites pode ser Sprint futura
- UI deve ser clara e intuitiva

Ao finalizar, testar:
- Criar time funciona
- Adicionar membro funciona
- Criar convite funciona
- Aceitar/rejeitar convite funciona
- Lobby mostra dados corretos
- Permissões estão corretas
```

---

## ✅ Checklist de Validação

- [ ] Interfaces de times criadas
- [ ] TeamManager implementado com todos os métodos
- [ ] Endpoints HTTP criados e funcionando
- [ ] Validações de permissões implementadas
- [ ] Convites expiram após 5 minutos
- [ ] Limite de membros funciona
- [ ] TeamLobbyScene criada e funcional
- [ ] UI mostra lista de membros
- [ ] UI mostra convites pendentes
- [ ] Botões de ação funcionam
- [ ] Integração com BaseHubScene funciona
- [ ] Erros são tratados adequadamente

---

## 📝 Notas de Implementação

- **Persistência**: Por enquanto, times podem ser em memória. Persistência em Firebase pode ser adicionada em sprint futura.
- **Busca de Jogadores**: Sistema de busca para convites pode ser implementado depois (precisa de lista de jogadores online).
- **UI/UX**: Seguir padrões visuais das outras cenas. Usar cores e estilos consistentes.
- **Testes**: Testar todos os fluxos (criar, convidar, aceitar, rejeitar, sair, dissolver).
- **Edge Cases**: Tratar casos como líder saindo, time vazio, múltiplos convites, etc.
