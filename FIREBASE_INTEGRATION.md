# Integração Firebase - PokéExtract: Wild Expedition

**Última Atualização**: Janeiro 2026  
**Status**: ⚠️ **PARCIALMENTE IMPLEMENTADO** - Requer Correções

> 📋 **Nota**: Para análise detalhada do que está funcionando e o que precisa ser corrigido, consulte `FIREBASE_INTEGRATION_STATUS.md`

---

## Visão Geral

O Firebase é usado para persistência de dados na nuvem com arquitetura **server-authoritative**. O cliente apenas lê seus próprios dados e sincroniza no login, enquanto o servidor faz todas as escritas.

### Princípios

1. **Server-Authoritative**: Todas as escritas são feitas pelo servidor
2. **Cliente Leve**: Cliente apenas lê e sincroniza no login
3. **Ações Locais**: Crafting, loadout e equipe são sincronizados pelo cliente
4. **Ações de Jogo**: Extração, recompensas e progresso são gerenciados pelo servidor

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE FIRESTORE                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   users/    │  │ expeditions/│  │leaderboards/│        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
         ↑                        ↑
         │                        │
    [READ ONLY]            [WRITE ONLY]
         │                        │
    ┌────┴────┐            ┌──────┴──────┐
    │ CLIENTE │            │   SERVIDOR   │
    │         │            │              │
    │ Firebase│            │ Firebase     │
    │ Client  │            │ Admin SDK   │
    │ SDK     │            │              │
    └─────────┘            └──────────────┘
```

---

## Estrutura de Dados

### Collection: `users/{userId}`

```typescript
{
  profile: {
    displayName: string;
    createdAt: Timestamp;
    lastLogin: Timestamp;
    totalPlayTime: number; // segundos
  },
  inventory: {
    items: Record<string, number>; // itemId -> quantity
    teamSlots: number;
    movementSpeedBonus: number;
    captureChanceBonus: number;
    inventoryCapacity: number;
  },
  creatures: Record<string, UserCreature>; // instanceId -> creature
  activeTeam: {
    creatureIds: string[]; // instanceIds
    selectedMapId: string;
  },
  stats: {
    totalExpeditions: number;
    successfulExpeditions: number;
    totalResourcesCollected: number;
    totalCreaturesCaptured: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
  }
}
```

### Collection: `expeditions/{expeditionId}`

```typescript
{
  userId: string;
  mapId: string;
  startedAt: Timestamp;
  completedAt: Timestamp;
  success: boolean;
  duration: number; // milissegundos
  rewards: {
    resources: Record<string, number>; // itemId -> quantity
    capturedCreatures: Array<{
      definitionId: string;
      level: number;
      rank: number;
    }>;
  },
  stats: {
    damageDealt: number;
    damageTaken: number;
    resourcesCollected: number;
    creaturesCaptured: number;
  }
}
```

---

## Fluxos de Integração

### 1. Login e Sincronização Inicial (Cliente)

**Quando**: Ao iniciar o jogo, após autenticação

**Fluxo Atual** (Parcial):
```
Cliente                          Firebase
   │                                │
   ├─ initializeFirebaseClient() ──>│
   │                                │
   ├─ signInAnonymously() ─────────>│
   │<─ userId ──────────────────────┤
   │                                │
   ├─ onSnapshot(users/{userId}) ──>│
   │<─ UserData ou null ─────────────┤
   │                                │
   ├─ Se null: tenta migrar local  │
   │  (mas NÃO cria no Firebase) ❌   │
   │                                │
   └─ Se existe: syncFromFirebase() │
      • Carrega criaturas            │
      • Carrega inventário           │
      • Carrega equipe ativa         │
      • Atualiza PlayerState         │
```

**⚠️ Problema**: Se usuário não existe, não cria documento no Firebase.

**Código**: `src/game/playerState.ts` → `syncFromFirebase()`, `migrateLocalDataToFirebase()`

**Correção Necessária**: Ver `FIREBASE_INTEGRATION_STATUS.md` - Seção 1.1 e 1.2

### 2. Crafting (Cliente → Servidor → Firebase)

**Quando**: Jogador crafta um item na base

**Fluxo Desejado**:
```
Cliente                          Servidor                    Firebase
   │                                │                            │
   ├─ Craft item localmente         │                            │
   │  (PlayerState.addItem)          │                            │
   │                                │                            │
   ├─ Ao sair da tela:               │                            │
   │  syncPlayerStateToServer() ────>│                            │
   │                                ├─ Atualiza Firestore ──────>│
   │                                │  (inventory.items)         │
   │<─ Success ─────────────────────┤                            │
   │                                │                            │
   │<─ onSnapshot() atualizado ──────────────────────────────────┤
   │                                │                            │
   └─ UI atualiza automaticamente   │                            │
```

**⚠️ Problema**: `CraftingScene` não chama `syncPlayerStateToServer()` ao sair.

**Código**: 
- Cliente: `src/services/firebaseSync.ts` → `syncPlayerStateToServer()`
- Servidor: `server/src/httpServer.ts` → `/api/sync-player` ✅ (existe)
- Cena: `src/scenes/CraftingScene.ts` ❌ (não sincroniza)

**Correção Necessária**: Ver `FIREBASE_INTEGRATION_STATUS.md` - Seção 2.1

### 3. Loadout/Equipe (Cliente → Servidor → Firebase)

**Quando**: Jogador altera equipe ativa na base

**Fluxo Desejado**:
```
Cliente                          Servidor                    Firebase
   │                                │                            │
   ├─ Atualiza equipe localmente    │                            │
   │  (PlayerState.setActiveTeam)   │                            │
   │                                │                            │
   ├─ Ao sair da tela:               │                            │
   │  syncPlayerStateToServer() ────>│                            │
   │                                ├─ Atualiza Firestore ──────>│
   │                                │  (activeTeam)               │
   │<─ Success ─────────────────────┤                            │
```

**⚠️ Problema**: `TeamManagementScene` não chama `syncPlayerStateToServer()` ao sair.

**Código**: 
- Cliente: `src/services/firebaseSync.ts` → `syncPlayerStateToServer()`
- Servidor: `server/src/httpServer.ts` → `/api/sync-player` ✅ (existe)
- Cena: `src/scenes/TeamManagementScene.ts` ❌ (não sincroniza)

**Correção Necessária**: Ver `FIREBASE_INTEGRATION_STATUS.md` - Seção 2.3

### 4. Extração e Recompensas (Servidor → Firebase)

**Quando**: Jogador completa extração na expedição

**Fluxo Atual** (Funciona ✅):
```
Cliente                          Servidor                    Firebase
   │                                │                            │
   ├─ sendExtractionRequest() ─────>│                            │
   │                                │                            │
   │                                ├─ Valida extração           │
   │                                ├─ Calcula recompensas       │
   │                                │                            │
   │                                ├─ saveExpeditionRewards() ──>│
   │                                │  • Atualiza inventory      │
   │                                │  • Adiciona creatures      │
   │                                │  • Atualiza stats          │
   │                                │  • Salva expedition        │
   │                                │                            │
   │<─ extractionState ─────────────┤                            │
   │   (savedToCloud: true)         │                            │
   │                                │                            │
   │<─ onSnapshot() atualizado ──────────────────────────────────┤
   │                                │                            │
   └─ UI atualiza automaticamente   │                            │
```

**⚠️ Problema**: Quando jogador morre, recompensas parciais não são salvas ❌

**Código**: 
- Servidor: `server/src/firestoreOperations.ts` → `saveExpeditionRewards()` ✅
- Integração: `server/src/handlers/ExtractionHandler.ts` → `handleExtractionCompleted()` ✅
- Morte: ❌ Não implementado

**Correção Necessária**: Ver `FIREBASE_INTEGRATION_STATUS.md` - Seção 3 (Salvamento em Morte)

---

## Regras de Segurança

### Firestore Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Usuários podem ler apenas seus próprios dados
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      // Escritas são controladas pelo servidor via Admin SDK
      allow write: if false;
    }
    
    // Histórico de expedições
    match /expeditions/{expeditionId} {
      allow read: if request.auth != null && 
                     resource.data.userId == request.auth.uid;
      allow write: if false; // Apenas servidor pode escrever
    }
    
    // Leaderboards são públicos (leitura)
    match /leaderboards/{leaderboardId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

---

## Módulos de Código

### Cliente

#### `src/services/firebaseClient.ts`
- **Responsabilidade**: Autenticação e inicialização
- **Funções**:
  - `initializeFirebaseClient()`: Inicializa SDK
  - `signInAnonymously()`: Login anônimo
  - `getUserId()`: Retorna UID atual
  - `isFirebaseClientAvailable()`: Verifica disponibilidade

#### `src/services/firebaseSync.ts`
- **Responsabilidade**: Sincronização de ações locais
- **Funções**:
  - `syncPlayerStateToServer()`: Sincroniza estado completo (crafting, loadout)
  - `syncExpeditionStart()`: Registra início de expedição
  - `syncExpeditionEnd()`: Registra fim de expedição

#### `src/game/playerState.ts`
- **Responsabilidade**: Gerenciamento de estado local
- **Integração Firebase**:
  - `syncFromFirebase()`: Carrega dados do Firestore
  - `onSnapshot()`: Escuta mudanças em tempo real
  - Fallback para localStorage se Firebase não disponível

### Servidor

#### `server/src/firebase.ts`
- **Responsabilidade**: Inicialização do Firebase Admin SDK
- **Funções**:
  - `initializeFirebase()`: Inicializa Admin SDK
  - `isFirebaseAvailable()`: Verifica disponibilidade

#### `server/src/firestoreOperations.ts`
- **Responsabilidade**: Operações CRUD no Firestore
- **Funções**:
  - `saveExpeditionRewards()`: Salva recompensas de extração
  - `saveUserData()`: Cria/atualiza usuário
  - `getUserData()`: Lê dados do usuário

#### `server/src/httpServer.ts`
- **Responsabilidade**: API HTTP para ações do cliente
- **Endpoints**:
  - `POST /api/sync-player`: Sincroniza estado do jogador (crafting, loadout)
  - `POST /api/expedition-start`: Registra início de expedição
  - `POST /api/expedition-end`: Registra fim de expedição

---

## Quando Usar Cada Fluxo

### Cliente Sincroniza (via HTTP → Servidor → Firebase)
- ✅ **Crafting**: Criar itens na base
- ✅ **Loadout**: Alterar equipe ativa
- ✅ **Equipe**: Adicionar/remover criaturas da equipe
- ✅ **Upgrades**: Aplicar upgrades de base

### Servidor Sincroniza (diretamente no Firebase)
- ✅ **Extração**: Recompensas de expedição
- ✅ **Progresso**: XP de criaturas
- ✅ **Estatísticas**: Métricas de jogo
- ✅ **Histórico**: Registro de expedições

---

## Configuração

### Setup Inicial

1. **Criar projeto no Firebase Console**
2. **Baixar credenciais**:
   - `firebase-service-account.json` (servidor)
   - Criar `src/services/firebaseConfig.ts` (cliente)
3. **Configurar regras**: Deploy `firestore.rules`
4. **Seguir guia**: `FIREBASE_SETUP_GUIDE.md`

### Arquivos Necessários

- `server/firebase-service-account.json`: Credenciais do Admin SDK
- `src/services/firebaseConfig.ts`: Configuração do Client SDK
- `firestore.rules`: Regras de segurança

---

## Fallback e Degradação

### Sem Firebase Configurado

- **Cliente**: Usa localStorage como fallback
- **Servidor**: Logs de aviso, mas continua funcionando
- **Funcionalidade**: Jogo funciona normalmente, mas sem persistência na nuvem

### Durante Desconexão

- **Cliente**: Continua usando dados locais
- **Servidor**: Tenta salvar, mas não falha se Firebase indisponível
- **Reconexão**: Sincroniza automaticamente quando Firebase volta

---

## ⚠️ Correções Necessárias (Prioridade Alta)

> 📋 **Documento Detalhado**: Consulte `FIREBASE_INTEGRATION_STATUS.md` para análise completa

### 1. Criação de Usuário no Login ❌
- **Problema**: Cliente não cria usuário no Firebase quando não existe
- **Solução**: Criar endpoint `POST /api/create-user` e chamar no login

### 2. Sincronização de Menus ❌
- **Problema**: Alterações em Crafting, Evolução e Time não sincronizam ao sair
- **Solução**: Chamar `syncPlayerStateToServer()` antes de sair de cada tela

### 3. Validação de Usuário no Join ❌
- **Problema**: Servidor não valida existência do usuário e permite conexão mesmo sem dados
- **Solução**: **Bloquear conexão** em `JoinHandler` se `getUser()` retorna null (erro "user_not_found")

### 4. Salvamento de Itens Gastos em Caso de Morte ❌
- **Problema**: Itens gastos (pokebolas, potions) não são salvos quando jogador morre
- **Solução**: Rastrear itens gastos durante expedição e decrementar do inventário ao morrer
- **Importante**: **NÃO salvar** recursos coletados ou criaturas capturadas (jogador perde progresso)

## Próximas Melhorias (Futuro)

### Autenticação
- [ ] Login com email/senha (já implementado na UI, precisa testar)
- [ ] Recuperação de senha
- [ ] Migração de contas anônimas

### Features Sociais
- [ ] Leaderboards globais
- [ ] Sistema de amigos
- [ ] Trading entre jogadores

### Analytics
- [ ] Dashboard de estatísticas
- [ ] Histórico de expedições na UI
- [ ] Achievements/Conquistas

---

**Nota**: Esta documentação reflete a arquitetura após a refatoração (Janeiro 2026), onde o cliente sincroniza apenas ações locais (crafting, loadout) e o servidor gerencia todas as ações de jogo (extração, recompensas).

---

## 📋 Documentação Relacionada

- **`FIREBASE_INTEGRATION_STATUS.md`**: Análise detalhada do estado atual, problemas identificados e plano de correção completo
- **`FIREBASE_SETUP_GUIDE.md`**: Guia passo a passo para configurar Firebase
- **`FIREBASE_IMPLEMENTATION_SUMMARY.md`**: Resumo histórico da implementação inicial
