# 🔥 Status da Integração Firebase - Análise e Plano de Correção

**Data**: Janeiro 2026  
**Status**: ⚠️ **PARCIALMENTE IMPLEMENTADO** - Requer correções

---

## 📋 Resumo Executivo

A integração Firebase está parcialmente implementada. O fluxo básico funciona, mas há lacunas importantes no ciclo completo de sincronização entre cliente e servidor. Este documento detalha o estado atual e o que precisa ser corrigido.

---

## 🎯 Fluxo Desejado (Conforme Especificação)

### Cliente (Menu/Base)
1. **Login**: Verifica se existe save com `userId` no Firebase
   - ✅ Se existe: Carrega dados do Firebase
   - ❌ Se não existe: **DEVE criar save novo** (atualmente não cria)
2. **Menus (Crafting, Evoluir, Time)**: Ao sair das telas
   - ❌ **DEVE sincronizar alterações** com Firebase via servidor (atualmente não sincroniza)

### Servidor (Expedição)
1. **Início da Expedição**: Recebe `userId` no join
   - ✅ Busca dados do player no Firebase
   - ✅ Carrega time ativo no jogo
   - ❌ **DEVE bloquear conexão** se usuário não existir (atualmente não valida)
2. **Fim da Expedição** (morte ou sucesso):
   - ✅ Salva recompensas quando extração completa
   - ❌ **DEVE salvar itens gastos** quando jogador morre (atualmente não salva)

---

## ✅ O Que Está Funcionando Corretamente

### 1. Cliente - Login e Sincronização Inicial ✅

**Arquivo**: `src/game/playerState.ts`

- ✅ Inicializa Firebase Client SDK
- ✅ Faz login anônimo (via `AuthScene`)
- ✅ Escuta mudanças em tempo real (`onSnapshot`)
- ✅ Sincroniza dados do Firebase para `PlayerState` local
- ✅ Mantém localStorage como backup

**Fluxo Atual**:
```
AuthScene → signInAnonymous() → PlayerState.initializeFirebase() 
→ subscribeToUserData() → syncFromFirebase() quando dados chegam
```

### 2. Cliente - Sincronização em Tempo Real ✅

**Arquivo**: `src/game/playerState.ts` → `syncFromFirebase()`

- ✅ Converte formato Firebase (`UserData`) para formato local (`PlayerProgress`)
- ✅ Atualiza criaturas, inventário, equipe ativa
- ✅ Salva também no localStorage

### 3. Servidor - Carregamento de Dados no Join ✅

**Arquivo**: `server/src/handlers/JoinHandler.ts`

- ✅ Recebe `userId` na mensagem de join
- ✅ Busca dados do usuário no Firebase (`getUser()`)
- ✅ Carrega `activeTeam.creatureIds` no `PlayerPresence`
- ✅ Usa primeira criatura do time como `activeCreatureId`

**Código Relevante**:
```typescript
// JoinHandler.ts linhas 29-47
if (msg.userId && isFirebaseAvailable()) {
  const userData = await getUser(msg.userId);
  if (userData?.activeTeam?.creatureIds && userData.activeTeam.creatureIds.length > 0) {
    activeCreatureId = userData.activeTeam.creatureIds[0];
  }
}
```

### 4. Servidor - Salvamento de Recompensas ✅

**Arquivo**: `server/src/handlers/ExtractionHandler.ts`

- ✅ Quando extração completa, calcula recompensas
- ✅ Salva no Firebase via `saveExpeditionRewards()`
- ✅ Atualiza inventário, criaturas, estatísticas
- ✅ Salva histórico de expedição
- ✅ Envia flag `savedToCloud` para cliente

**Código Relevante**:
```typescript
// ExtractionHandler.ts linhas 125-165
if (isFirebaseAvailable() && player && player.userId) {
  const expeditionData: SaveExpeditionData = { ... };
  saved = await saveExpeditionRewards(expeditionData);
}
```

---

## ❌ O Que Está Faltando ou Incorreto

### 1. Cliente - Criação de Save Novo no Login ❌

**Problema**: Quando usuário faz login pela primeira vez, o código tenta migrar dados do localStorage, mas **não cria um documento novo no Firebase** se não existir.

**Arquivo**: `src/game/playerState.ts` → `migrateLocalDataToFirebase()`

**Código Atual** (linhas 95-128):
```typescript
private async migrateLocalDataToFirebase(userId: string): Promise<void> {
  // Verifica se há dados significativos para migrar
  // Mas NÃO cria usuário no Firebase se não existir
  // Apenas prepara dados para sincronização futura
}
```

**O Que Falta**:
- Chamar endpoint do servidor para criar usuário no Firebase
- Criar usuário antes de tentar conectar ao servidor (servidor bloqueia se não existir)

**Solução Necessária**:
- Criar endpoint no servidor: `POST /api/create-user`
- Cliente chama este endpoint quando detecta que usuário não existe
- Servidor cria documento no Firebase com dados iniciais

### 2. Cliente - Sincronização ao Sair dos Menus ❌

**Problema**: Quando jogador altera dados nas telas de menu (Crafting, Evoluir Criaturas, Gerenciar Time), as alterações **não são sincronizadas** com Firebase ao sair.

**Telas Afetadas**:
- `CraftingScene.ts`: Crafta itens, atualiza inventário
- `CreatureUpgradeScene.ts`: Funde criaturas, atualiza ranks
- `TeamManagementScene.ts`: Altera equipe ativa

**Código Atual**:
- `CraftingScene.ts` linha 186: `this.scene.start("BaseHubScene")` - **SEM sincronização**
- `CreatureUpgradeScene.ts` linha 98: `this.scene.start("BaseHubScene")` - **SEM sincronização**
- `TeamManagementScene.ts` linha 273: `this.scene.start("BaseHubScene")` - **SEM sincronização**

**O Que Falta**:
- Chamar `syncPlayerStateToServer()` antes de sair de cada tela
- Ou chamar ao voltar para `BaseHubScene`

**Solução Necessária**:
- Adicionar `syncPlayerStateToServer()` antes de `scene.start("BaseHubScene")` em cada tela
- Ou adicionar hook em `BaseHubScene.create()` para sincronizar ao entrar

### 3. Servidor - Validação de Usuário no Join ❌

**Problema**: Quando jogador faz join sem documento no Firebase, o servidor **não valida a existência do usuário** e permite conexão mesmo sem dados.

**Arquivo**: `server/src/handlers/JoinHandler.ts`

**Código Atual** (linhas 37-46):
```typescript
const userData = await getUser(msg.userId);
if (userData?.activeTeam?.creatureIds && userData.activeTeam.creatureIds.length > 0) {
  activeCreatureId = userData.activeTeam.creatureIds[0];
}
// Se userData é null, não faz nada - permite conexão mesmo sem usuário
```

**O Que Falta**:
- Verificar se `userData` é `null`
- Se for `null`, **bloquear conexão** e retornar erro
- Não permitir join se usuário não existe no Firebase

**Solução Necessária**:
```typescript
if (msg.userId && isFirebaseAvailable()) {
  const userData = await getUser(msg.userId);
  
  if (!userData) {
    console.log(`[Firebase] ❌ Usuário ${msg.userId} não encontrado no Firebase - conexão bloqueada`);
    return { 
      success: false, 
      error: "user_not_found" // Cliente deve criar usuário primeiro
    };
  }
  
  // Se usuário existe, carregar time
  if (userData.activeTeam?.creatureIds && userData.activeTeam.creatureIds.length > 0) {
    activeCreatureId = userData.activeTeam.creatureIds[0];
  }
}
```

### 4. Servidor - Salvamento de Itens Gastos em Caso de Morte ❌

**Problema**: Quando jogador morre na expedição, os **itens gastos durante a expedição** (pokebolas, potions, etc.) **não são salvos** no Firebase. Apenas quando completa extração.

**Arquivo**: `server/src/managers/GameLoopManager.ts` (ou onde morte é processada)

**O Que Falta**:
- Detectar quando jogador morre
- Rastrear itens gastos durante a expedição (pokebolas usadas, potions consumidas)
- Salvar consumo de itens no Firebase (decrementar do inventário)
- Marcar expedição como `success: false`
- **NÃO salvar** recursos coletados ou criaturas capturadas (jogador morreu, perde progresso)

**Solução Necessária**:
- Encontrar handler de morte do jogador
- Rastrear itens gastos durante a expedição
- Criar função para salvar consumo de itens (decrementar inventário)
- Chamar salvamento com `success: false` e apenas itens gastos

---

## 🔧 Plano de Correção

### Prioridade 1: Fluxo Básico Funcional

#### 1.1. Criar Endpoint para Criar Usuário (Servidor)

**Arquivo**: `server/src/httpServer.ts`

**Ação**:
- Adicionar endpoint `POST /api/create-user`
- Recebe `userId` e `displayName`
- Chama `createUser()` do Firestore
- Retorna sucesso/erro

**Código Sugerido**:
```typescript
app.post('/api/create-user', async (req: Request, res: Response) => {
  try {
    const { userId, displayName } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }
    
    if (!isFirebaseAvailable()) {
      return res.status(503).json({ error: 'Firebase não disponível' });
    }
    
    await createUser(userId, {
      displayName: displayName || 'Convidado',
      initialTeamSlots: 3,
      initialInventoryCapacity: 50
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('[HTTP] Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});
```

#### 1.2. Cliente Criar Usuário no Login (Cliente)

**Arquivo**: `src/game/playerState.ts` → `migrateLocalDataToFirebase()`

**Ação**:
- Quando `subscribeToUserData()` retorna `null` (usuário não existe)
- Chamar `POST /api/create-user` para criar usuário
- Depois sincronizar dados locais

**Código Sugerido**:
```typescript
private async migrateLocalDataToFirebase(userId: string): Promise<void> {
  // Verificar se usuário existe no Firebase
  // Se não existir, criar via servidor
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3004";
  
  try {
    const response = await fetch(`${SERVER_URL}/api/create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        displayName: this.progress.displayName || 'Convidado'
      })
    });
    
    if (response.ok) {
      console.log('[PlayerState] ✅ Usuário criado no Firebase');
      // Dados serão sincronizados via onSnapshot
    }
  } catch (error) {
    console.error('[PlayerState] ❌ Erro ao criar usuário:', error);
  }
}
```

#### 1.3. Servidor Validar e Bloquear Join se Usuário Não Existe (Servidor)

**Arquivo**: `server/src/handlers/JoinHandler.ts`

**Ação**:
- Verificar se `userData` é `null` após `getUser()`
- Se for `null`, **bloquear conexão** e retornar erro
- Não permitir join se usuário não existe no Firebase

**Código Sugerido**:
```typescript
// Linha 29-47, substituir por:
if (!msg.userId) {
  console.log(`[Firebase] ⚠️  Jogador ${msg.name} (${clientId}) entrou sem userId`);
  // Permitir conexão sem userId (modo offline/local)
} else if (!isFirebaseAvailable()) {
  console.log(`[Firebase] ⚠️  Firebase não está disponível`);
  // Permitir conexão mesmo sem Firebase (modo offline)
} else {
  console.log(`[Firebase] 🔍 Buscando dados do usuário ${msg.userId}...`);
  
  const userData = await getUser(msg.userId);
  
  if (!userData) {
    console.log(`[Firebase] ❌ Usuário ${msg.userId} não encontrado no Firebase - conexão bloqueada`);
    return { 
      success: false, 
      error: "user_not_found" 
    };
  }
  
  // Usuário existe - carregar time ativo
  if (userData.activeTeam?.creatureIds && userData.activeTeam.creatureIds.length > 0) {
    activeCreatureId = userData.activeTeam.creatureIds[0];
    console.log(`[Firebase] ✅ Time recuperado: ${userData.activeTeam.creatureIds.length} criaturas`);
  }
}
```

### Prioridade 2: Sincronização de Menus

#### 2.1. Sincronizar ao Sair de CraftingScene

**Arquivo**: `src/scenes/CraftingScene.ts`

**Ação**:
- Antes de `this.scene.start("BaseHubScene")`, chamar `syncPlayerStateToServer()`

**Código Sugerido**:
```typescript
// Linha 186, substituir por:
this.input.keyboard?.on("keydown-ESC", async () => {
  await syncPlayerStateToServer();
  this.scene.start("BaseHubScene");
});
```

#### 2.2. Sincronizar ao Sair de CreatureUpgradeScene

**Arquivo**: `src/scenes/CreatureUpgradeScene.ts`

**Ação**:
- Antes de `this.scene.start("BaseHubScene")`, chamar `syncPlayerStateToServer()`

**Código Sugerido**:
```typescript
// Linha 98, substituir por:
this.input.keyboard?.on("keydown-ESC", async () => {
  await syncPlayerStateToServer();
  this.scene.start("BaseHubScene");
});
```

#### 2.3. Sincronizar ao Sair de TeamManagementScene

**Arquivo**: `src/scenes/TeamManagementScene.ts`

**Ação**:
- No método `returnToBase()`, chamar `syncPlayerStateToServer()` antes de sair

**Código Sugerido**:
```typescript
// Linha 270-274, substituir por:
private async returnToBase() {
  PlayerState.setActiveTeam(this.tempTeamIds);
  await syncPlayerStateToServer();
  this.scene.start("BaseHubScene");
}
```

**Import Necessário**:
```typescript
import { syncPlayerStateToServer } from "../services/firebaseSync";
```

### Prioridade 3: Salvamento de Itens Gastos em Caso de Morte

#### 3.1. Encontrar Handler de Morte

**Ação**:
- Localizar onde morte do jogador é processada
- Provavelmente em `server/src/managers/GameLoopManager.ts` ou `server/src/systems/combat.ts`
- Identificar onde `player.health <= 0` ou similar é detectado

#### 3.2. Rastrear Itens Gastos Durante Expedição

**Ação**:
- Adicionar campo em `PlayerPresence` para rastrear itens gastos
- Incrementar contador quando:
  - Pokebola é usada (captura)
  - Potion é consumida (cura)
  - Outros consumíveis são usados

**Estrutura Sugerida**:
```typescript
// Em PlayerPresence ou Room
itemsConsumed: Map<string, number>; // itemId -> quantidade gastada
```

#### 3.3. Salvar Consumo de Itens ao Morrer

**Ação**:
- Quando jogador morre, coletar itens gastos (`player.itemsConsumed`)
- **NÃO salvar** recursos coletados ou criaturas capturadas (jogador perde progresso)
- Decrementar itens do inventário no Firebase
- Salvar expedição com `success: false`

**Código Sugerido**:
```typescript
// Quando jogador morre:
if (player.userId && isFirebaseAvailable()) {
  // Coletar itens gastos durante a expedição
  const itemsConsumed = player.itemsConsumed || new Map<string, number>();
  
  // Decrementar itens do inventário no Firebase
  const db = getDb();
  const userRef = db.collection('users').doc(player.userId);
  const batch = db.batch();
  
  for (const [itemId, quantity] of itemsConsumed.entries()) {
    batch.update(userRef, {
      [`inventory.items.${itemId}`]: FieldValue.increment(-quantity)
    });
  }
  
  // Salvar expedição como falha
  const expeditionRef = db.collection('expeditions').doc();
  const expeditionDoc: ExpeditionDocument = {
    userId: player.userId,
    mapId: room.id,
    startedAt: new Date(room.startedAt),
    completedAt: new Date(),
    success: false,
    duration: Date.now() - room.startedAt,
    rewards: {
      resources: {}, // Nenhum recurso (jogador morreu)
      creatures: [] // Nenhuma criatura (jogador morreu)
    },
    stats: {
      damageDealt: 0, // TODO: Rastrear
      damageTaken: 0, // TODO: Rastrear
      resourcesCollected: 0, // Nenhum recurso coletado
      creaturesCaptured: 0 // Nenhuma criatura capturada
    }
  };
  
  batch.set(expeditionRef, expeditionDoc);
  
  // Atualizar estatísticas
  batch.update(userRef, {
    'stats.expeditionsFailed': FieldValue.increment(1)
  });
  
  await batch.commit();
  console.log(`[Firebase] ✅ Itens gastos salvos para usuário ${player.userId} (morte)`);
}
```

**Nota Importante**: 
- Jogador **perde** recursos coletados e criaturas capturadas ao morrer
- Apenas itens **gastos** (pokebolas, potions) são salvos (decrementados do inventário)
- Isso simula que o jogador usou os itens, mas não conseguiu extrair com sucesso

---

## 📊 Checklist de Implementação

### Fase 1: Fluxo Básico ✅ → ❌
- [ ] Criar endpoint `POST /api/create-user` no servidor
- [ ] Cliente criar usuário quando não existe no login
- [ ] Servidor **bloquear conexão** se usuário não existe no join

### Fase 2: Sincronização de Menus ✅ → ❌
- [ ] `CraftingScene`: Sincronizar ao sair
- [ ] `CreatureUpgradeScene`: Sincronizar ao sair
- [ ] `TeamManagementScene`: Sincronizar ao sair

### Fase 3: Salvamento de Itens Gastos em Morte ✅ → ❌
- [ ] Localizar handler de morte do jogador
- [ ] Rastrear itens gastos durante expedição (pokebolas, potions)
- [ ] Salvar consumo de itens no Firebase (decrementar inventário)
- [ ] Salvar expedição com `success: false` (sem recursos/criaturas)

---

## 🔍 Arquivos que Precisam ser Modificados

### Servidor
1. `server/src/httpServer.ts` - Adicionar endpoint `POST /api/create-user`
2. `server/src/handlers/JoinHandler.ts` - **Bloquear conexão** se usuário não existir
3. `server/src/managers/GameLoopManager.ts` (ou onde morte é processada) - Salvar itens gastos em caso de morte
4. `server/src/types/ServerTypes.ts` (ou onde PlayerPresence é definido) - Adicionar campo `itemsConsumed`

### Cliente
1. `src/game/playerState.ts` - Criar usuário quando não existe
2. `src/scenes/CraftingScene.ts` - Sincronizar ao sair
3. `src/scenes/CreatureUpgradeScene.ts` - Sincronizar ao sair
4. `src/scenes/TeamManagementScene.ts` - Sincronizar ao sair

---

## 📝 Notas Importantes

### Sobre Criação de Usuário

- **Cliente não pode criar diretamente** no Firestore (regras de segurança bloqueiam)
- **Solução**: Cliente chama servidor via HTTP (`POST /api/create-user`), servidor cria via Admin SDK
- **Servidor não cria automaticamente**: Se usuário não existe no join, **bloqueia conexão**
- **Fluxo**: Cliente deve criar usuário no login antes de tentar conectar ao servidor

### Sobre Sincronização de Menus

- **Quando sincronizar**: Ao sair da tela (ESC) ou ao voltar para BaseHub
- **O que sincronizar**: Estado completo (`PlayerState.getProgress()`)
- **Endpoint**: `POST /api/sync-player` (já existe)

### Sobre Salvamento em Morte

- **Dados a salvar**: Apenas **itens gastos** (pokebolas, potions, etc.)
- **Dados NÃO salvos**: Recursos coletados e criaturas capturadas (jogador perde progresso)
- **Ação**: Decrementar itens do inventário no Firebase
- **Status**: `success: false` para indicar falha
- **Quando salvar**: Imediatamente quando morte é detectada
- **Rastreamento**: Adicionar campo `itemsConsumed` em `PlayerPresence` para rastrear itens gastos durante expedição

---

## 🎯 Resultado Esperado Após Correções

### Fluxo Completo Corrigido

1. **Login**:
   - Cliente faz login → Verifica Firebase → Se não existe, cria via servidor → Carrega dados

2. **Menus**:
   - Jogador altera dados (craft, evolução, time) → Ao sair, sincroniza com Firebase

3. **Expedição - Início**:
   - Jogador faz join → Servidor verifica Firebase → Se não existe, cria → Carrega time

4. **Expedição - Fim**:
   - Sucesso: Salva recompensas completas ✅ (já funciona)
   - Morte: Salva apenas itens gastos (decrementa inventário) ❌ (precisa implementar)

---

**Última Atualização**: Janeiro 2026  
**Próximo Passo**: Implementar correções da Fase 1 (Fluxo Básico)
