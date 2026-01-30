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

  const newUser: UserDocument = {
    profile: {
      displayName: data.displayName,
      createdAt: now,
      lastLogin: now,
      totalPlayTime: 0
    },
    inventory: {
      items: {
        'pokeball-basic': 5, // Começar com 5 pokébolas básicas
      },
      teamSlots: data.initialTeamSlots || 3,
      movementSpeedBonus: 0,
      captureChanceBonus: 0,
      inventoryCapacity: data.initialInventoryCapacity || 20
    },
    creatures: {},
    activeTeam: {
      creatureIds: [],
      selectedMapId: 'forest'
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
    // Atualizar usuário existente (merge)
    await userRef.set(data, { merge: true });
    console.log(`[Firestore] ✅ Dados atualizados para usuário ${userId}`);
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
  if (!isFirebaseAvailable()) {
    console.warn('[Firestore] Firebase não disponível - recompensas não salvas');
    return false;
  }

  const db = getDb();
  const batch = db.batch();

  try {
    const userRef = db.collection('users').doc(data.userId);

    // Verificar se usuário existe
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      console.error(`[Firestore] Usuário ${data.userId} não existe`);
      return false;
    }

    // ========================================================================
    // 1. ATUALIZAR INVENTÁRIO (Recursos)
    // ========================================================================
    const inventoryUpdates: Record<string, any> = {};
    
    for (const [itemId, quantity] of data.rewards.resources.entries()) {
      inventoryUpdates[`inventory.items.${itemId}`] = FieldValue.increment(quantity);
    }

    if (Object.keys(inventoryUpdates).length > 0) {
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
      batch.update(userRef, {
        creatures: { ...userData.creatures, ...newCreatures }
      });
    }

    // ========================================================================
    // 3. ATUALIZAR ESTATÍSTICAS
    // ========================================================================
    const totalResourcesCollected = Array.from(data.rewards.resources.values())
      .reduce((sum, qty) => sum + qty, 0);

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
    await batch.commit();

    console.log(`[Firestore] ✅ Recompensas salvas para usuário ${data.userId}`);
    console.log(`[Firestore] ℹ️  Recursos: ${totalResourcesCollected}, Criaturas: ${data.rewards.capturedCreatures.length}`);

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
