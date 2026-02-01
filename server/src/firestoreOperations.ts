/**
 * Operações do Firestore para persistência de dados
 * 
 * Este módulo contém todas as operações de leitura/escrita no Firestore.
 * Todas as operações são server-authoritative (cliente não pode manipular).
 */

import { getDb, isFirebaseAvailable, FieldValue } from './firebase';
import {
  UserDocument,
  UserProfile,
  UserInventory,
  UserActiveTeam,
  UserStats,
  UserCreature,
  ExpeditionDocument,
  SaveExpeditionData,
  CreateUserData
} from './firebaseTypes';

// ============================================================================
// USER OPERATIONS
// ============================================================================

/**
 * Cria um novo usuário no Firestore
 */
export async function createUser(
  userId: string,
  data: CreateUserData
): Promise<void> {
  if (!isFirebaseAvailable()) {
    console.warn('[Firestore] Firebase não disponível - usuário não criado');
    return;
  }

  const db = getDb();
  const userRef = db.collection('users').doc(userId);

  // Verificar se usuário já existe
  const userDoc = await userRef.get();
  if (userDoc.exists) {
    console.log(`[Firestore] Usuário ${userId} já existe`);
    return;
  }

  const now = new Date();

  // Criar criatura inicial (starter) - Pyrognat nível 5
  const starterInstanceId = `starter-pyrognat-${Date.now()}`;
  const starterCreature: UserCreature = {
    instanceId: starterInstanceId,
    definitionId: 'pyrognat',
    level: 5,
    currentHp: 80, // HP base do Pyrognat
    maxHp: 80,
    experience: 0,
    rank: 1,
    copiesFused: 0,
    totalExpeditionXp: 0,
    capturedAt: now
  };

  const newUser: UserDocument = {
    profile: {
      displayName: data.displayName,
      createdAt: now,
      lastLogin: now,
      totalPlayTime: 0
    },
    inventory: {
      items: {
        'poke-ball-basic': 5, // Começar com 5 pokébolas básicas (corrigido nome)
      },
      teamSlots: data.initialTeamSlots || 3,
      movementSpeedBonus: 0,
      captureChanceBonus: 0,
      inventoryCapacity: data.initialInventoryCapacity || 20
    },
    creatures: {
      [starterInstanceId]: starterCreature
    },
    activeTeam: {
      creatureIds: [starterInstanceId], // Time inicial com a criatura starter
      selectedMapId: 'floresta-celestial' // Mapa padrão
    },
    stats: {
      expeditionsCompleted: 0,
      expeditionsFailed: 0,
      totalResourcesCollected: 0,
      totalCreaturesCaptured: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0
    }
  };

  await userRef.set(newUser);
  console.log(`[Firestore] ✅ Usuário ${userId} criado: ${data.displayName}`);
}

/**
 * Atualiza último login do usuário
 */
export async function updateLastLogin(userId: string): Promise<void> {
  if (!isFirebaseAvailable()) return;

  const db = getDb();
  await db.collection('users').doc(userId).update({
    'profile.lastLogin': FieldValue.serverTimestamp()
  });
}

/**
 * Busca dados completos de um usuário
 */
export async function getUser(userId: string): Promise<UserDocument | null> {
  if (!isFirebaseAvailable()) return null;

  const db = getDb();
  const userDoc = await db.collection('users').doc(userId).get();

  if (!userDoc.exists) {
    return null;
  }

  return userDoc.data() as UserDocument;
}

/**
 * Salva/atualiza dados completos de um usuário
 * 
 * IMPORTANTE: Para sincronização de crafting/evolução, usa set() completo (sem merge)
 * para garantir que itens consumidos e criaturas fundidas sejam removidos corretamente.
 */
export async function saveUserData(
  userId: string,
  data: UserDocument
): Promise<void> {
  if (!isFirebaseAvailable()) {
    console.warn('[Firestore] Firebase não disponível - dados não salvos');
    return;
  }

  const db = getDb();
  const userRef = db.collection('users').doc(userId);

  // Verificar se usuário existe
  const userDoc = await userRef.get();
  
  if (userDoc.exists) {
    // IMPORTANTE: Usar set() completo (sem merge) para garantir que:
    // - Itens consumidos sejam removidos do inventário
    // - Criaturas fundidas sejam removidas da coleção
    // - O estado do cliente seja o estado final no Firebase
    await userRef.set(data, { merge: false });
    console.log(`[Firestore] ✅ Dados sincronizados completamente para usuário ${userId}`);
    console.log(`[Firestore] - Inventário: ${Object.keys(data.inventory.items).length} tipos de itens`);
    console.log(`[Firestore] - Criaturas: ${Object.keys(data.creatures).length} criaturas`);
  } else {
    // Criar novo usuário
    await userRef.set(data);
    console.log(`[Firestore] ✅ Novo usuário criado: ${userId}`);
  }
}

// ============================================================================
// EXPEDITION OPERATIONS
// ============================================================================

/**
 * Salva recompensas de expedição no Firestore
 * 
 * Esta função:
 * 1. Atualiza inventário do jogador (adiciona recursos)
 * 2. Adiciona criaturas capturadas
 * 3. Atualiza estatísticas do jogador
 * 4. Salva histórico da expedição
 * 
 * Todas as operações são atômicas (batch write).
 */
export async function saveExpeditionRewards(
  data: SaveExpeditionData
): Promise<boolean> {
  console.log(`[Firestore] 💾 Iniciando salvamento de recompensas para usuário ${data.userId}...`);
  
  if (!isFirebaseAvailable()) {
    console.warn('[Firestore] ⚠️  Firebase não disponível - recompensas não salvas');
    return false;
  }

  const db = getDb();
  const batch = db.batch();

  try {
    const userRef = db.collection('users').doc(data.userId);

    // Verificar se usuário existe
    console.log(`[Firestore] 🔍 Verificando se usuário ${data.userId} existe no Firestore...`);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      console.error(`[Firestore] ❌ Usuário ${data.userId} não existe no Firestore`);
      return false;
    }
    console.log(`[Firestore] ✅ Usuário ${data.userId} encontrado no Firestore`);

    // ========================================================================
    // 1. ATUALIZAR INVENTÁRIO (Recursos)
    // ========================================================================
    const inventoryUpdates: Record<string, any> = {};
    
    for (const [itemId, quantity] of data.rewards.resources.entries()) {
      inventoryUpdates[`inventory.items.${itemId}`] = FieldValue.increment(quantity);
    }

    if (Object.keys(inventoryUpdates).length > 0) {
      console.log(`[Firestore] 📦 Atualizando inventário: ${Object.keys(inventoryUpdates).length} tipos de recursos`);
      batch.update(userRef, inventoryUpdates);
    }

    // ========================================================================
    // 2. ADICIONAR CRIATURAS CAPTURADAS
    // ========================================================================
    const userData = userDoc.data() as UserDocument;
    const newCreatures: Record<string, UserCreature> = {};

    for (const capturedCreature of data.rewards.capturedCreatures) {
      const instanceId = `creature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const creature: UserCreature = {
        instanceId,
        definitionId: capturedCreature.definitionId,
        level: capturedCreature.level,
        currentHp: capturedCreature.currentHp,
        maxHp: capturedCreature.maxHp,
        experience: 0,
        rank: 1,
        copiesFused: 0,
        totalExpeditionXp: 0,
        capturedAt: new Date()
      };

      newCreatures[instanceId] = creature;
    }

    if (Object.keys(newCreatures).length > 0) {
      console.log(`[Firestore] 🐾 Adicionando ${Object.keys(newCreatures).length} criaturas capturadas`);
      batch.update(userRef, {
        creatures: { ...userData.creatures, ...newCreatures }
      });
    }

    // ========================================================================
    // 3. ATUALIZAR ESTATÍSTICAS
    // ========================================================================
    const totalResourcesCollected = Array.from(data.rewards.resources.values())
      .reduce((sum, qty) => sum + qty, 0);

    console.log(`[Firestore] 📊 Atualizando estatísticas: ${data.success ? 'expedição completada' : 'expedição falhou'}`);

    const statsUpdates: Record<string, any> = {
      'stats.expeditionsCompleted': FieldValue.increment(data.success ? 1 : 0),
      'stats.expeditionsFailed': FieldValue.increment(data.success ? 0 : 1),
      'stats.totalResourcesCollected': FieldValue.increment(totalResourcesCollected),
      'stats.totalCreaturesCaptured': FieldValue.increment(data.rewards.capturedCreatures.length),
      'stats.totalDamageDealt': FieldValue.increment(data.stats.damageDealt),
      'stats.totalDamageTaken': FieldValue.increment(data.stats.damageTaken)
    };

    batch.update(userRef, statsUpdates);

    // ========================================================================
    // 4. SALVAR HISTÓRICO DE EXPEDIÇÃO
    // ========================================================================
    console.log(`[Firestore] 📝 Salvando histórico da expedição no mapa ${data.mapId}`);
    const expeditionRef = db.collection('expeditions').doc();
    
    const expeditionDoc: ExpeditionDocument = {
      userId: data.userId,
      mapId: data.mapId,
      startedAt: data.startedAt,
      completedAt: new Date(),
      success: data.success,
      duration: data.duration,
      rewards: {
        resources: Object.fromEntries(data.rewards.resources),
        creatures: Object.values(newCreatures)
      },
      stats: data.stats
    };

    batch.set(expeditionRef, expeditionDoc);

    // ========================================================================
    // COMMIT BATCH (Transação Atômica)
    // ========================================================================
    console.log(`[Firestore] 🔄 Executando commit do batch (transação atômica)...`);
    await batch.commit();

    console.log(`[Firestore] ✅ Recompensas salvas com sucesso para usuário ${data.userId}`);
    console.log(`[Firestore] ℹ️  Resumo: ${totalResourcesCollected} recursos, ${data.rewards.capturedCreatures.length} criaturas capturadas`);

    return true;
  } catch (error) {
    console.error('[Firestore] ❌ Erro ao salvar recompensas:', error);
    return false;
  }
}

/**
 * Busca histórico de expedições de um usuário
 */
export async function getUserExpeditions(
  userId: string,
  limit: number = 10
): Promise<ExpeditionDocument[]> {
  if (!isFirebaseAvailable()) return [];

  const db = getDb();
  
  const snapshot = await db
    .collection('expeditions')
    .where('userId', '==', userId)
    .orderBy('completedAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => doc.data() as ExpeditionDocument);
}

// ============================================================================
// CREATURE OPERATIONS
// ============================================================================

/**
 * Atualiza XP e nível de uma criatura
 */
export async function updateCreatureProgress(
  userId: string,
  creatureId: string,
  xpGained: number,
  newLevel?: number
): Promise<void> {
  if (!isFirebaseAvailable()) return;

  const db = getDb();
  const userRef = db.collection('users').doc(userId);

  const updates: Record<string, any> = {
    [`creatures.${creatureId}.experience`]: FieldValue.increment(xpGained),
    [`creatures.${creatureId}.totalExpeditionXp`]: FieldValue.increment(xpGained)
  };

  if (newLevel !== undefined) {
    updates[`creatures.${creatureId}.level`] = newLevel;
  }

  await userRef.update(updates);
}

/**
 * Funde criaturas (aumenta rank)
 */
export async function fuseCreature(
  userId: string,
  targetCreatureId: string,
  sacrificeCreatureIds: string[]
): Promise<void> {
  if (!isFirebaseAvailable()) return;

  const db = getDb();
  const userRef = db.collection('users').doc(userId);

  const batch = db.batch();

  // Incrementar rank e copiesFused
  batch.update(userRef, {
    [`creatures.${targetCreatureId}.rank`]: FieldValue.increment(1),
    [`creatures.${targetCreatureId}.copiesFused`]: FieldValue.increment(sacrificeCreatureIds.length)
  });

  // Remover criaturas sacrificadas
  for (const creatureId of sacrificeCreatureIds) {
    batch.update(userRef, {
      [`creatures.${creatureId}`]: FieldValue.delete()
    });
  }

  await batch.commit();
  console.log(`[Firestore] ✅ Criatura ${targetCreatureId} fusionada (rank +1)`);
}
