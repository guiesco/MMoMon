# Plano de Integração Firebase

**Data:** 29 de Janeiro de 2026  
**Objetivo:** Persistir dados de expedição no Firebase através do servidor, garantindo integridade e evitando manipulação do cliente

---

## 🎯 Por Que Firebase Agora?

### Problemas Atuais
1. ❌ Dados salvos apenas no `localStorage` do cliente (vulnerável a manipulação)
2. ❌ Sem persistência entre dispositivos
3. ❌ Sem backup ou recuperação de dados
4. ❌ Difícil rastrear progressão e métricas dos jogadores
5. ❌ Impossível validar recompensas server-side

### Benefícios do Firebase
1. ✅ **Server-Authoritative**: Servidor controla todas as escritas
2. ✅ **Persistência Real**: Dados salvos na nuvem
3. ✅ **Multi-Dispositivo**: Mesma conta em diferentes dispositivos
4. ✅ **Autenticação**: Firebase Auth para gerenciar usuários
5. ✅ **Realtime**: Sincronização automática entre cliente e servidor
6. ✅ **Segurança**: Regras de segurança impedem manipulação
7. ✅ **Analytics**: Métricas de uso e progressão

---

## 📋 Escopo da Implementação

### Fase 1: Setup e Autenticação (Prioridade Alta)
- [ ] Configurar projeto Firebase
- [ ] Instalar Firebase Admin SDK no servidor
- [ ] Instalar Firebase Client SDK no cliente
- [ ] Implementar autenticação anônima (para MVP)
- [ ] Implementar autenticação com email/senha (opcional)

### Fase 2: Estrutura de Dados (Prioridade Alta)
- [ ] Definir schema do Firestore
- [ ] Criar regras de segurança
- [ ] Implementar migração de dados do localStorage

### Fase 3: Integração Server-Side (Prioridade Alta)
- [ ] Salvar recompensas de expedição no Firestore
- [ ] Atualizar inventário do jogador
- [ ] Atualizar criaturas capturadas
- [ ] Atualizar progressão e estatísticas

### Fase 4: Integração Client-Side (Prioridade Média)
- [ ] Carregar dados do jogador ao iniciar
- [ ] Sincronizar inventário em tempo real
- [ ] Sincronizar criaturas em tempo real
- [ ] Fallback para localStorage se offline

### Fase 5: Features Avançadas (Prioridade Baixa)
- [ ] Leaderboards
- [ ] Histórico de expedições
- [ ] Achievements/Conquistas
- [ ] Trading entre jogadores

---

## 🗄️ Estrutura de Dados Proposta

### Coleção: `users`
```typescript
users/{userId}
  ├─ profile
  │   ├─ displayName: string
  │   ├─ createdAt: timestamp
  │   ├─ lastLogin: timestamp
  │   └─ totalPlayTime: number
  │
  ├─ inventory
  │   ├─ items: Map<itemId, quantity>
  │   ├─ teamSlots: number
  │   ├─ movementSpeedBonus: number
  │   ├─ captureChanceBonus: number
  │   └─ inventoryCapacity: number
  │
  ├─ creatures
  │   └─ [creatureId]
  │       ├─ instanceId: string
  │       ├─ definitionId: string
  │       ├─ level: number
  │       ├─ currentHp: number
  │       ├─ experience: number
  │       ├─ rank: number
  │       ├─ copiesFused: number
  │       └─ totalExpeditionXp: number
  │
  ├─ activeTeam
  │   ├─ creatureIds: string[]
  │   └─ selectedMapId: string
  │
  └─ stats
      ├─ expeditionsCompleted: number
      ├─ expeditionsFailed: number
      ├─ totalResourcesCollected: number
      ├─ totalCreaturesCaptured: number
      ├─ totalDamageDealt: number
      └─ totalDamageTaken: number
```

### Coleção: `expeditions` (Histórico)
```typescript
expeditions/{expeditionId}
  ├─ userId: string
  ├─ mapId: string
  ├─ startedAt: timestamp
  ├─ completedAt: timestamp | null
  ├─ success: boolean
  ├─ duration: number
  ├─ rewards
  │   ├─ resources: Map<itemId, quantity>
  │   └─ creatures: Array<capturedCreature>
  └─ stats
      ├─ damageDealt: number
      ├─ damageTaken: number
      ├─ resourcesCollected: number
      └─ creaturesCaptured: number
```

---

## 🔒 Regras de Segurança

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

## 🔧 Implementação Técnica

### 1. Setup do Servidor

```typescript
// server/src/firebase.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inicializar Firebase Admin
const serviceAccount = require('../firebase-service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

export const db = getFirestore();
```

### 2. Salvar Recompensas no Servidor

```typescript
// server/src/systems/extraction.ts
import { db } from '../firebase';

export async function saveExpeditionRewards(
  userId: string,
  rewards: ExtractionReward,
  expeditionData: ExpeditionData
): Promise<void> {
  const batch = db.batch();
  
  // 1. Atualizar inventário
  const userRef = db.collection('users').doc(userId);
  
  for (const [itemId, quantity] of rewards.resources) {
    batch.update(userRef, {
      [`inventory.items.${itemId}`]: FieldValue.increment(quantity)
    });
  }
  
  // 2. Adicionar criaturas capturadas
  for (const creature of rewards.capturedCreatures) {
    const creatureRef = userRef.collection('creatures').doc();
    batch.set(creatureRef, creature);
  }
  
  // 3. Atualizar estatísticas
  batch.update(userRef, {
    'stats.expeditionsCompleted': FieldValue.increment(1),
    'stats.totalResourcesCollected': FieldValue.increment(
      Array.from(rewards.resources.values()).reduce((a, b) => a + b, 0)
    ),
    'stats.totalCreaturesCaptured': FieldValue.increment(
      rewards.capturedCreatures.length
    )
  });
  
  // 4. Salvar histórico de expedição
  const expeditionRef = db.collection('expeditions').doc();
  batch.set(expeditionRef, {
    userId,
    mapId: expeditionData.mapId,
    startedAt: expeditionData.startedAt,
    completedAt: new Date(),
    success: true,
    duration: expeditionData.duration,
    rewards: {
      resources: Object.fromEntries(rewards.resources),
      creatures: rewards.capturedCreatures
    },
    stats: expeditionData.stats
  });
  
  // Commit em batch (transação atômica)
  await batch.commit();
  
  console.log(`[Firebase] Recompensas salvas para usuário ${userId}`);
}
```

### 3. Integração no Fluxo de Extração

```typescript
// server/src/index.ts
async function processExtractionSystem(room: Room, deltaMs: number) {
  const updates = updateExtractions(roomForExtraction, deltaMs);
  
  for (const update of updates) {
    if (update.status === "completed") {
      const reward = completeExtraction(
        roomForExtraction,
        update.playerId,
        update.pointId
      );
      
      if (reward) {
        // ✅ Salvar no Firebase
        try {
          await saveExpeditionRewards(
            update.playerId, // userId do Firebase
            reward,
            {
              mapId: room.id,
              startedAt: room.startedAt,
              duration: Date.now() - room.startedAt,
              stats: {
                damageDealt: player.damageDealt || 0,
                damageTaken: player.damageTaken || 0,
                resourcesCollected: reward.resources.size,
                creaturesCaptured: reward.creaturesCaptured
              }
            }
          );
          
          // Broadcast de sucesso
          const message = createExtractionStateMessage(
            update.pointId,
            update.playerId,
            "completed",
            100,
            {
              resources: Object.fromEntries(reward.resources),
              creaturesCaptured: reward.creaturesCaptured,
              savedToCloud: true // ✅ Indica que foi salvo
            }
          );
          
          broadcastExtractionMessage(room, message);
        } catch (error) {
          console.error(`[Firebase] Erro ao salvar recompensas:`, error);
          
          // Broadcast de erro
          const errorMessage = createExtractionStateMessage(
            update.pointId,
            update.playerId,
            "error",
            100,
            {
              error: "Failed to save rewards"
            }
          );
          
          broadcastExtractionMessage(room, errorMessage);
        }
      }
    }
  }
}
```

### 4. Cliente Carrega Dados do Firebase

```typescript
// src/game/playerState.ts
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

class PlayerStateManager {
  private unsubscribe: (() => void) | null = null;
  
  async initializeFromFirebase(): Promise<void> {
    // Autenticar
    const auth = getAuth();
    const userCredential = await signInAnonymously(auth);
    const userId = userCredential.user.uid;
    
    // Escutar mudanças em tempo real
    const db = getFirestore();
    const userRef = doc(db, 'users', userId);
    
    this.unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Atualizar estado local
        this.progress = {
          uid: userId,
          displayName: data.profile.displayName,
          teamSlots: data.inventory.teamSlots,
          movementSpeedBonus: data.inventory.movementSpeedBonus,
          captureChanceBonus: data.inventory.captureChanceBonus,
          inventoryCapacity: data.inventory.inventoryCapacity,
          creatures: data.creatures || [],
          inventory: Object.entries(data.inventory.items).map(
            ([itemId, quantity]) => ({ itemId, quantity })
          ),
          activeTeamIds: data.activeTeam.creatureIds,
          selectedMapId: data.activeTeam.selectedMapId
        };
        
        console.log('[Firebase] Dados sincronizados do servidor');
      }
    });
  }
  
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
```

---

## 📊 Fluxo Completo com Firebase

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INÍCIO DO JOGO                                               │
└─────────────────────────────────────────────────────────────────┘
Cliente
   │
   ├─> Firebase Auth: signInAnonymously()
   ├─> Recebe userId
   ├─> Firestore: onSnapshot(users/{userId})
   ├─> Carrega inventário, criaturas, etc.
   └─> Inicia jogo com dados sincronizados

┌─────────────────────────────────────────────────────────────────┐
│ 2. DURANTE A EXPEDIÇÃO                                          │
└─────────────────────────────────────────────────────────────────┘
Cliente                          Servidor
   │                                │
   ├──── Coleta recursos ──────────>│
   │                                ├─> Rastreia em memória
   │                                │   (resourcesCollected)
   │                                │
   ├──── Captura criaturas ────────>│
   │                                ├─> Rastreia em memória
   │                                │   (creaturesCaptured)

┌─────────────────────────────────────────────────────────────────┐
│ 3. EXTRAÇÃO COMPLETA                                            │
└─────────────────────────────────────────────────────────────────┘
Cliente                          Servidor                Firebase
   │                                │                        │
   ├──── extraction_complete ──────>│                        │
   │                                ├─> Calcula recompensas  │
   │                                │                        │
   │                                ├──── saveRewards() ────>│
   │                                │                        ├─> Batch Write:
   │                                │                        │   - Atualiza inventory
   │                                │                        │   - Adiciona creatures
   │                                │                        │   - Atualiza stats
   │                                │                        │   - Salva expedition
   │                                │<──── Success ──────────┤
   │                                │                        │
   │<──── extraction_state ──────────┤                        │
   │   (completed, savedToCloud)    │                        │
   │                                │                        │
   │<──── onSnapshot() ──────────────────────────────────────┤
   │   (dados atualizados)          │                        │
   │                                │                        │
   └─> UI atualiza automaticamente  │                        │
```

---

## 🧪 Testes

### Teste 1: Persistência Básica
1. Completar expedição com recursos e criaturas
2. Verificar logs do servidor: `[Firebase] Recompensas salvas`
3. Recarregar página
4. Verificar que inventário foi mantido

### Teste 2: Multi-Dispositivo
1. Fazer login no dispositivo A
2. Completar expedição
3. Fazer login no dispositivo B com mesma conta
4. Verificar que progresso está sincronizado

### Teste 3: Offline/Online
1. Desconectar internet
2. Tentar completar expedição
3. Verificar fallback para localStorage
4. Reconectar internet
5. Verificar sincronização automática

---

## 📝 Checklist de Implementação

### Setup Inicial
- [ ] Criar projeto Firebase no console
- [ ] Baixar `firebase-service-account.json`
- [ ] Adicionar ao `.gitignore`
- [ ] Instalar dependências:
  ```bash
  # Servidor
  cd server && npm install firebase-admin
  
  # Cliente
  cd .. && npm install firebase
  ```

### Servidor
- [ ] Criar `server/src/firebase.ts`
- [ ] Implementar `saveExpeditionRewards()`
- [ ] Integrar no `processExtractionSystem()`
- [ ] Adicionar tratamento de erros
- [ ] Adicionar logs detalhados

### Cliente
- [ ] Configurar Firebase Client SDK
- [ ] Implementar autenticação
- [ ] Implementar sincronização em tempo real
- [ ] Adicionar fallback para localStorage
- [ ] Atualizar UI para mostrar status de sincronização

### Testes
- [ ] Testar fluxo completo de expedição
- [ ] Testar reconexão após desconexão
- [ ] Testar múltiplos jogadores simultâneos
- [ ] Testar migração de dados do localStorage

---

## 💡 Próximos Passos Imediatos

1. **Debug Atual**: Adicionar logs para verificar se `resourcesCollected` e `creaturesCaptured` estão sendo populados
2. **Setup Firebase**: Criar projeto e configurar credenciais
3. **Implementação MVP**: Focar em salvar recompensas de expedição
4. **Migração Gradual**: Manter localStorage como fallback durante transição

---

## ⚠️ Considerações Importantes

### Segurança
- ✅ Servidor usa Admin SDK (acesso total)
- ✅ Cliente usa SDK normal (acesso restrito)
- ✅ Regras de segurança impedem manipulação
- ✅ Todas as escritas passam pelo servidor

### Performance
- ✅ Batch writes para operações atômicas
- ✅ Índices no Firestore para queries rápidas
- ✅ Cache local para reduzir leituras
- ✅ onSnapshot para sincronização eficiente

### Custo
- ✅ Plano gratuito: 50k leituras/dia, 20k escritas/dia
- ✅ Suficiente para MVP e testes
- ✅ Escala conforme necessário

---

## 🎯 Resultado Esperado

Após implementação:
- ✅ Dados persistidos na nuvem (não apenas localStorage)
- ✅ Impossível manipular recompensas no cliente
- ✅ Sincronização automática entre dispositivos
- ✅ Histórico completo de expedições
- ✅ Base sólida para features futuras (leaderboards, trading, etc.)
