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

    // Gerar IDs únicos para cada criatura capturada
    let creatureIndex = 0;
    for (const capturedCreature of data.rewards.capturedCreatures) {
      // Usar timestamp + índice + random para garantir unicidade
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const instanceId = `creature-${timestamp}-${creatureIndex}-${random}`;
      creatureIndex++;
      
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
      console.log(`[Firestore] 🐾 Criatura ${creatureIndex}/${data.rewards.capturedCreatures.length} preparada: ${instanceId} (${capturedCreature.definitionId}, nível ${capturedCreature.level})`);
    }

    if (Object.keys(newCreatures).length > 0) {
      console.log(`[Firestore] 🐾 Adicionando ${Object.keys(newCreatures).length} criaturas capturadas`);
      console.log(`[Firestore] 🐾 Detalhes das criaturas:`, Object.keys(newCreatures).map(id => ({
        instanceId: id,
        definitionId: newCreatures[id].definitionId,
        level: newCreatures[id].level,
        currentHp: newCreatures[id].currentHp,
        maxHp: newCreatures[id].maxHp
      })));
      
      const existingCreatures = userData.creatures || {};
      const existingCount = Object.keys(existingCreatures).length;
      console.log(`[Firestore] 🐾 Criaturas existentes antes: ${existingCount}`);
      console.log(`[Firestore] 🐾 IDs das criaturas existentes:`, Object.keys(existingCreatures));
      
      // IMPORTANTE: Merge correto - preservar criaturas existentes e adicionar novas
      const mergedCreatures = { ...existingCreatures, ...newCreatures };
      const mergedCount = Object.keys(mergedCreatures).length;
      console.log(`[Firestore] 🐾 Total de criaturas após merge: ${mergedCount} (${existingCount} existentes + ${Object.keys(newCreatures).length} novas)`);
      console.log(`[Firestore] 🐾 IDs de todas as criaturas após merge:`, Object.keys(mergedCreatures));
      
      batch.update(userRef, {
        creatures: mergedCreatures
      });
    } else {
      console.log(`[Firestore] ⚠️  Nenhuma criatura capturada para adicionar`);
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

    // Verificar que as criaturas foram realmente salvas
    const verifyDoc = await userRef.get();
    if (verifyDoc.exists) {
      const verifyData = verifyDoc.data() as UserDocument;
      const savedCreatures = verifyData.creatures || {};
      const savedCount = Object.keys(savedCreatures).length;
      console.log(`[Firestore] ✅ Verificação pós-commit: ${savedCount} criaturas no documento`);
      console.log(`[Firestore] ✅ IDs das criaturas salvas:`, Object.keys(savedCreatures));
    }

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

/**
 * Executa múltiplos crafts em batch de forma protegida
 */
export async function craftItemsBatch(
  userId: string,
  crafts: Array<{
    recipeId: string;
    ingredients: Array<{ itemId: string; quantity: number }>;
    resultItemId: string;
    resultQuantity?: number;
    teamSlotsIncrease?: number;
  }>
): Promise<{ success: boolean; error?: string; failedIndex?: number }> {
  if (!isFirebaseAvailable()) {
    return { success: false, error: 'Firebase não disponível' };
  }

  const db = getDb();
  const userRef = db.collection('users').doc(userId);

  // Buscar dados atuais do usuário
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return { success: false, error: 'Usuário não encontrado' };
  }

  const userData = userDoc.data() as UserDocument;
  let currentInventory = { ...(userData.inventory?.items || {}) };
  let currentTeamSlots = userData.inventory?.teamSlots || 3;

  // Validar todos os crafts antes de executar qualquer um
  for (let i = 0; i < crafts.length; i++) {
    const craft = crafts[i];
    
    // Validar ingredientes
    for (const ing of craft.ingredients) {
      const currentQuantity = currentInventory[ing.itemId] || 0;
      if (currentQuantity < ing.quantity) {
        return {
          success: false,
          error: `Craft ${i + 1}/${crafts.length}: Quantidade insuficiente de ${ing.itemId}. Necessário: ${ing.quantity}, possui: ${currentQuantity}`,
          failedIndex: i
        };
      }
    }

    // Simular consumo para validação do próximo craft
    for (const ing of craft.ingredients) {
      currentInventory[ing.itemId] = (currentInventory[ing.itemId] || 0) - ing.quantity;
      if (currentInventory[ing.itemId] <= 0) {
        delete currentInventory[ing.itemId];
      }
    }

    // Simular adição do resultado
    currentInventory[craft.resultItemId] = (currentInventory[craft.resultItemId] || 0) + (craft.resultQuantity || 1);

    // Simular upgrade de slots
    if (craft.teamSlotsIncrease && craft.teamSlotsIncrease > 0) {
      currentTeamSlots = Math.min(6, currentTeamSlots + craft.teamSlotsIncrease);
    }
  }

  // Se chegou aqui, todos os crafts são válidos - executar em batch
  const batch = db.batch();
  currentInventory = { ...(userData.inventory?.items || {}) };
  currentTeamSlots = userData.inventory?.teamSlots || 3;

  for (const craft of crafts) {
    // Consumir ingredientes
    for (const ing of craft.ingredients) {
      const currentQuantity = currentInventory[ing.itemId] || 0;
      const newQuantity = currentQuantity - ing.quantity;
      
      if (newQuantity > 0) {
        currentInventory[ing.itemId] = newQuantity;
        batch.update(userRef, {
          [`inventory.items.${ing.itemId}`]: newQuantity
        });
      } else {
        delete currentInventory[ing.itemId];
        batch.update(userRef, {
          [`inventory.items.${ing.itemId}`]: FieldValue.delete()
        });
      }
    }

    // Adicionar item resultante
    const currentResultQuantity = currentInventory[craft.resultItemId] || 0;
    const newResultQuantity = currentResultQuantity + (craft.resultQuantity || 1);
    currentInventory[craft.resultItemId] = newResultQuantity;
    batch.update(userRef, {
      [`inventory.items.${craft.resultItemId}`]: newResultQuantity
    });

    // Aplicar upgrade de slots se necessário
    if (craft.teamSlotsIncrease && craft.teamSlotsIncrease > 0) {
      currentTeamSlots = Math.min(6, currentTeamSlots + craft.teamSlotsIncrease);
      batch.update(userRef, {
        'inventory.teamSlots': currentTeamSlots
      });
    }
  }

  await batch.commit();
  console.log(`[Firestore] ✅ Batch crafting executado: ${crafts.length} crafts`);
  return { success: true };
}

/**
 * Executa crafting de forma protegida (valida e aplica no servidor)
 */
export async function craftItem(
  userId: string,
  recipeId: string,
  ingredients: Array<{ itemId: string; quantity: number }>,
  resultItemId: string,
  resultQuantity: number = 1,
  teamSlotsIncrease?: number
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseAvailable()) {
    return { success: false, error: 'Firebase não disponível' };
  }

  const db = getDb();
  const userRef = db.collection('users').doc(userId);

  // Buscar dados atuais do usuário
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return { success: false, error: 'Usuário não encontrado' };
  }

  const userData = userDoc.data() as UserDocument;
  const currentInventory = userData.inventory?.items || {};

  // Validar se possui todos os ingredientes
  for (const ing of ingredients) {
    const currentQuantity = currentInventory[ing.itemId] || 0;
    if (currentQuantity < ing.quantity) {
      return {
        success: false,
        error: `Quantidade insuficiente de ${ing.itemId}. Necessário: ${ing.quantity}, possui: ${currentQuantity}`
      };
    }
  }

  const batch = db.batch();

  // Consumir ingredientes
  for (const ing of ingredients) {
    const currentQuantity = currentInventory[ing.itemId] || 0;
    const newQuantity = currentQuantity - ing.quantity;
    
    if (newQuantity > 0) {
      batch.update(userRef, {
        [`inventory.items.${ing.itemId}`]: newQuantity
      });
    } else {
      // Remover item se quantidade chegar a zero
      batch.update(userRef, {
        [`inventory.items.${ing.itemId}`]: FieldValue.delete()
      });
    }
  }

  // Adicionar item resultante
  const currentResultQuantity = currentInventory[resultItemId] || 0;
  batch.update(userRef, {
    [`inventory.items.${resultItemId}`]: currentResultQuantity + resultQuantity
  });

  // Aplicar upgrade de slots se necessário
  if (teamSlotsIncrease && teamSlotsIncrease > 0) {
    const currentSlots = userData.inventory?.teamSlots || 3;
    batch.update(userRef, {
      'inventory.teamSlots': Math.min(6, currentSlots + teamSlotsIncrease)
    });
  }

  await batch.commit();
  console.log(`[Firestore] ✅ Crafting executado: ${recipeId} -> ${resultItemId}`);
  return { success: true };
}

/**
 * Atualiza equipe ativa de forma protegida (valida e aplica no servidor)
 */
export async function setActiveTeam(
  userId: string,
  creatureIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseAvailable()) {
    return { success: false, error: 'Firebase não disponível' };
  }

  const db = getDb();
  const userRef = db.collection('users').doc(userId);

  // Buscar dados atuais do usuário
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return { success: false, error: 'Usuário não encontrado' };
  }

  const userData = userDoc.data() as UserDocument;
  const creatures = userData.creatures || {};
  const teamSlots = userData.inventory?.teamSlots || 3;

  // Validar que todas as criaturas existem
  for (const creatureId of creatureIds) {
    if (!creatures[creatureId]) {
      return { success: false, error: `Criatura ${creatureId} não encontrada` };
    }
  }

  // Validar número de slots
  if (creatureIds.length > teamSlots) {
    return { success: false, error: `Número de criaturas (${creatureIds.length}) excede slots disponíveis (${teamSlots})` };
  }

  // Garantir que há pelo menos uma criatura se o jogador tiver criaturas
  if (creatureIds.length === 0 && Object.keys(creatures).length > 0) {
    // Se não há criaturas selecionadas mas o jogador tem criaturas, usar a primeira
    const firstCreatureId = Object.keys(creatures)[0];
    creatureIds = [firstCreatureId];
  }

  // Remover duplicatas
  const uniqueCreatureIds = Array.from(new Set(creatureIds));

  // Atualizar equipe ativa
  await userRef.update({
    'activeTeam.creatureIds': uniqueCreatureIds
  });

  console.log(`[Firestore] ✅ Equipe ativa atualizada: ${uniqueCreatureIds.length} criaturas`);
  return { success: true };
}

/**
 * Promove criatura (aumenta rank) de forma protegida (valida e aplica no servidor)
 */
export async function promoteCreature(
  userId: string,
  targetCreatureId: string,
  sacrificeCreatureIds: string[],
  newRank: number
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseAvailable()) {
    return { success: false, error: 'Firebase não disponível' };
  }

  const db = getDb();
  const userRef = db.collection('users').doc(userId);

  // Buscar dados atuais do usuário
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return { success: false, error: 'Usuário não encontrado' };
  }

  const userData = userDoc.data() as UserDocument;
  const creatures = userData.creatures || {};

  // Validar se a criatura alvo existe
  const targetCreature = creatures[targetCreatureId];
  if (!targetCreature) {
    return { success: false, error: 'Criatura alvo não encontrada' };
  }

  // Validar se todas as criaturas sacrificadas existem
  for (const sacrificeId of sacrificeCreatureIds) {
    if (!creatures[sacrificeId]) {
      return { success: false, error: `Criatura sacrificada ${sacrificeId} não encontrada` };
    }
  }

  const batch = db.batch();

  // Atualizar criatura alvo
  batch.update(userRef, {
    [`creatures.${targetCreatureId}.rank`]: newRank,
    [`creatures.${targetCreatureId}.copiesFused`]: (targetCreature.copiesFused || 0) + sacrificeCreatureIds.length
  });

  // Remover criaturas sacrificadas
  for (const sacrificeId of sacrificeCreatureIds) {
    batch.update(userRef, {
      [`creatures.${sacrificeId}`]: FieldValue.delete()
    });
  }

  // Remover criaturas sacrificadas do time ativo se estiverem lá
  const activeTeamIds = userData.activeTeam?.creatureIds || [];
  const updatedTeamIds = activeTeamIds.filter(id => !sacrificeCreatureIds.includes(id));
  if (updatedTeamIds.length !== activeTeamIds.length) {
    batch.update(userRef, {
      'activeTeam.creatureIds': updatedTeamIds
    });
  }

  await batch.commit();
  console.log(`[Firestore] ✅ Criatura ${targetCreatureId} promovida para rank ${newRank}`);
  return { success: true };
}
