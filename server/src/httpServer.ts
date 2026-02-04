/**
 * Servidor HTTP para sincronização de dados com Firebase
 * 
 * Este servidor fornece endpoints REST para o cliente sincronizar
 * dados do jogador com o Firestore via Firebase Admin SDK.
 * 
 * CORS configurado para aceitar requisições do cliente Vite (porta 5173)
 */

import express, { Request, Response } from 'express';
import { isFirebaseAvailable, getDb, FieldValue } from './firebase';
import { saveUserData, saveExpeditionRewards, createUser, craftItem, craftItemsBatch, promoteCreature, setActiveTeam } from './firestoreOperations';
import type { SaveExpeditionData, UserCreature } from './firebaseTypes';
import { calculateMaxHp } from './creatureProgression';

const app = express();

// Configurar trust proxy para Cloudflare Tunnel (necessário para obter IP real e headers corretos)
// Cloudflare Tunnel passa headers de proxy, então precisamos confiar no proxy
app.set('trust proxy', true);

console.log('[HTTP Server] 🔧 Configurando CORS customizado - VERSÃO PRODUÇÃO');

// Middleware CORS - configuração manual completa
// IMPORTANTE: Este middleware deve ser o PRIMEIRO, antes de qualquer outro middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const method = req.method;
  const path = req.path;
  
  // Log detalhado para debug
  console.log(`[HTTP] ${method} ${path} - Origin: ${origin || '(none)'} - Headers:`, {
    'access-control-request-method': req.headers['access-control-request-method'],
    'access-control-request-headers': req.headers['access-control-request-headers']
  });
  
  // Lista de origens permitidas (normalizadas - sem trailing slash)
  const defaultClientUrl = 'https://guiesco.github.io';
  const clientUrl = process.env.CLIENT_URL || defaultClientUrl;
  
  // Adicionar tanto HTTP quanto HTTPS para GitHub Pages (caso o usuário acesse via HTTP)
  const clientUrlVariants = [clientUrl];
  if (clientUrl.startsWith('https://')) {
    clientUrlVariants.push(clientUrl.replace('https://', 'http://'));
  } else if (clientUrl.startsWith('http://')) {
    clientUrlVariants.push(clientUrl.replace('http://', 'https://'));
  }
  
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    // GitHub Pages (inclui HTTP e HTTPS)
    ...clientUrlVariants,
    // Domínios customizados (se houver)
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [])
  ].filter(Boolean).map(o => o.replace(/\/$/, '')); // Remove trailing slashes
  
  // Log de origens permitidas (apenas na primeira requisição para não poluir logs)
  if (!(global as any).__cors_logged) {
    console.log('[HTTP Server] 📋 Origens permitidas:', allowedOrigins);
    console.log('[HTTP Server] 🔐 CLIENT_URL:', process.env.CLIENT_URL || '(não configurado)');
    console.log('[HTTP Server] 🔐 ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS || '(não configurado)');
    (global as any).__cors_logged = true;
  }
  
  // Normalizar origem (remover trailing slash)
  const normalizedOrigin = origin ? origin.replace(/\/$/, '') : null;
  
  // Verificar se a origem está na lista permitida
  let isOriginAllowed = false;
  if (normalizedOrigin && allowedOrigins.includes(normalizedOrigin)) {
    isOriginAllowed = true;
  } else if (!origin) {
    // Se não há header origin (requisições do mesmo domínio), permitir
    isOriginAllowed = true;
  }
  
  // Para preflight OPTIONS: SEMPRE incluir Access-Control-Allow-Origin com a origem da requisição
  // (o navegador precisa desse header no preflight, mesmo que bloqueie depois)
  if (method === 'OPTIONS') {
    // CRÍTICO: Sempre definir Access-Control-Allow-Origin no preflight
    // O navegador precisa desse header para aceitar a resposta do preflight
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    // Headers obrigatórios para preflight
    const requestedMethod = req.headers['access-control-request-method'] || 'POST, GET, OPTIONS';
    const requestedHeaders = req.headers['access-control-request-headers'] || 'Content-Type, Authorization';
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', requestedHeaders);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas de cache para preflight
    
    // Log detalhado
    if (isOriginAllowed) {
      console.log(`[HTTP] ✓ Preflight OK para ${path} - Origin: ${origin}`);
    } else {
      console.log(`[HTTP] ⚠️ Preflight para ${path} - Origin NÃO permitida: ${origin} (mas respondendo com header)`);
      console.log(`[HTTP]   Requested Method: ${requestedMethod}, Requested Headers: ${requestedHeaders}`);
    }
    
    // CRÍTICO: Retornar 204 imediatamente, sem processar mais nada
    return res.status(204).end();
  }
  
  // Para requisições não-OPTIONS: definir Access-Control-Allow-Origin apenas se origem permitida
  if (isOriginAllowed) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
  
  // Sempre definir headers CORS para requisições reais também
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Para requisições não-OPTIONS, verificar origem antes de continuar
  if (origin && !isOriginAllowed) {
    console.log(`[HTTP] ❌ Requisição bloqueada - Origin não permitida: ${origin}`);
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  next();
});

app.use(express.json());

/**
 * Endpoint de health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    firebase: isFirebaseAvailable(),
    timestamp: Date.now()
  });
});

/**
 * Cria um novo usuário no Firebase
 */
app.post('/api/create-user', async (req: Request, res: Response) => {
  try {
    const { userId, displayName } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }
    
    if (!isFirebaseAvailable()) {
      return res.status(503).json({ error: 'Firebase não disponível' });
    }
    
    console.log(`[HTTP] 📝 Criando usuário ${userId}...`);
    
    await createUser(userId, {
      displayName: displayName || 'Convidado',
      initialTeamSlots: 3,
      initialInventoryCapacity: 50
    });
    
    console.log(`[HTTP] ✅ Usuário ${userId} criado com sucesso`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

/**
 * Busca dados do jogador (apenas leitura - não sobrescreve nada)
 * Usado para sincronizar dados após expedições ou ao entrar na base
 */
app.get('/api/get-player', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        error: 'userId é obrigatório'
      });
    }

    if (!isFirebaseAvailable()) {
      return res.status(503).json({
        error: 'Firebase não disponível'
      });
    }

    console.log(`[HTTP] 📖 Buscando dados do jogador ${userId} (apenas leitura)`);

    const { getUser } = await import('./firestoreOperations');
    const userData = await getUser(userId);

    if (!userData) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    console.log(`[HTTP] ✅ Dados encontrados: ${Object.keys(userData.creatures || {}).length} criaturas, ${Object.keys(userData.inventory?.items || {}).length} tipos de itens`);

    res.json({
      success: true,
      userData
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao buscar dados do jogador:', error);
    res.status(500).json({
      error: 'Erro ao buscar dados do jogador'
    });
  }
});

/**
 * Sincroniza estado completo do jogador (DEPRECATED - usar endpoints específicos)
 * Mantido apenas para compatibilidade, mas não deve ser usado para sync básico
 */
app.post('/api/sync-player', async (req: Request, res: Response) => {
  try {
    const { userId, progress } = req.body;

    if (!userId || !progress) {
      return res.status(400).json({
        error: 'userId e progress são obrigatórios'
      });
    }

    if (!isFirebaseAvailable()) {
      return res.status(503).json({
        error: 'Firebase não disponível'
      });
    }

    console.log(`[HTTP] 📥 Sincronizando estado do jogador ${userId}`);

    // Buscar dados atuais do Firebase para preservar campos importantes
    const { getUser } = await import('./firestoreOperations');
    const existingUserData = await getUser(userId);

    // Converter formato do cliente para formato do Firestore
    const userData: any = {
      profile: {
        displayName: progress.displayName || 'Convidado',
        // Preservar createdAt se já existir, senão usar data atual
        createdAt: existingUserData?.profile?.createdAt || new Date(),
        lastLogin: new Date(),
        totalPlayTime: existingUserData?.profile?.totalPlayTime || 0
      },
      inventory: {
        items: {} as Record<string, number>,
        teamSlots: progress.teamSlots || 3,
        movementSpeedBonus: progress.movementSpeedBonus || 0,
        captureChanceBonus: progress.captureChanceBonus || 0,
        inventoryCapacity: progress.inventoryCapacity || 50
      },
      creatures: {} as Record<string, any>,
      activeTeam: {
        creatureIds: progress.activeTeamIds || [],
        selectedMapId: progress.selectedMapId || 'floresta-celestial'
      },
      // Preservar estatísticas existentes (não são alteradas por crafting/evolução)
      stats: existingUserData?.stats || {
        expeditionsCompleted: 0,
        expeditionsFailed: 0,
        totalResourcesCollected: 0,
        totalCreaturesCaptured: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0
      }
    };

    // Converter inventário (armazem)
    if (progress.inventory && Array.isArray(progress.inventory)) {
      for (const item of progress.inventory) {
        userData.inventory.items[item.itemId] = item.quantity;
      }
    }

    // Converter mochila (preparedExpeditionInventory)
    if (progress.preparedExpeditionInventory && Array.isArray(progress.preparedExpeditionInventory)) {
      userData.preparedExpeditionInventory = {};
      for (const item of progress.preparedExpeditionInventory) {
        if (item.quantity > 0) {
          userData.preparedExpeditionInventory[item.itemId] = item.quantity;
        }
      }
    } else {
      // Se não foi enviado, manter o existente ou inicializar vazio
      userData.preparedExpeditionInventory = existingUserData?.preparedExpeditionInventory || {};
    }

    // IMPORTANTE: Preservar criaturas existentes no Firebase que não estão no progress do cliente
    // Isso evita sobrescrever criaturas capturadas em expedições que ainda não foram sincronizadas
    const existingCreatures = existingUserData?.creatures || {};
    const creaturesFromClient = progress.creatures || [];
    
    console.log(`[HTTP] 📊 Criaturas existentes no Firebase: ${Object.keys(existingCreatures).length}`);
    console.log(`[HTTP] 📊 Criaturas enviadas pelo cliente: ${creaturesFromClient.length}`);
    
    // Converter criaturas do cliente
    if (Array.isArray(creaturesFromClient)) {
      for (const creature of creaturesFromClient) {
        // Buscar dados completos da criatura do Firebase se existir (para preservar capturedAt)
        const existingCreature = existingCreatures[creature.instanceId];
        
        // Criar objeto temporário para calcular maxHP
        const creatureData: UserCreature = {
          instanceId: creature.instanceId,
          definitionId: creature.definitionId,
          level: creature.level,
          currentHp: creature.currentHp,
          maxHp: 0, // Será calculado abaixo
          experience: creature.experience,
          rank: creature.rank || 1,
          copiesFused: creature.copiesFused || 0,
          totalExpeditionXp: creature.totalExpeditionXp || 0,
          // Preservar capturedAt se existir
          capturedAt: existingCreature?.capturedAt || new Date()
        };
        
        // Recalcular maxHP baseado em nível e rank (sempre usar cálculo correto)
        creatureData.maxHp = calculateMaxHp(creatureData);
        
        // Garantir que currentHp não exceda maxHp
        creatureData.currentHp = creatureData.maxHp;
        
        userData.creatures[creature.instanceId] = creatureData;
      }
    }
    
    // IMPORTANTE: NÃO preservar criaturas que não foram enviadas pelo cliente
    // Quando o cliente faz sync de crafting/evolução, o estado do cliente é a fonte de verdade completa.
    // Criaturas removidas na evolução não devem ser preservadas.
    // Criaturas capturadas em expedições são salvas diretamente pelo servidor via saveExpeditionRewards(),
    // então não precisamos preservá-las aqui.
    // 
    // Se houver criaturas no Firebase que não foram enviadas, elas foram removidas pelo cliente
    // (ex: evolução) e devem ser removidas do Firebase também.
    const preservedCount = Object.keys(existingCreatures).length - creaturesFromClient.length;
    if (preservedCount > 0) {
      console.log(`[HTTP] 🗑️  Removendo ${preservedCount} criatura(s) que não foram enviadas pelo cliente (provavelmente removidas na evolução)`);
    }
    
    console.log(`[HTTP] 📊 Estado convertido:`);
    console.log(`[HTTP] - Itens no inventário: ${Object.keys(userData.inventory.items).length}`);
    console.log(`[HTTP] - Criaturas: ${Object.keys(userData.creatures).length} (${creaturesFromClient.length} do cliente + ${Object.keys(userData.creatures).length - creaturesFromClient.length} preservadas do Firebase)`);
    console.log(`[HTTP] - Time ativo: ${userData.activeTeam.creatureIds.length} criaturas`);

    await saveUserData(userId, userData);

    // IMPORTANTE: Buscar dados atualizados do Firebase após salvar para retornar ao cliente
    // Isso garante que o cliente sempre recebe a versão mais atualizada (incluindo criaturas capturadas)
    const updatedUserData = await getUser(userId);
    
    if (!updatedUserData) {
      console.error(`[HTTP] ❌ Erro: Dados não encontrados após salvar para ${userId}`);
      return res.status(500).json({
        error: 'Erro ao recuperar dados atualizados'
      });
    }

    console.log(`[HTTP] ✅ Estado sincronizado para ${userId}`);
    console.log(`[HTTP] 📤 Retornando dados atualizados: ${Object.keys(updatedUserData.creatures).length} criaturas, ${Object.keys(updatedUserData.inventory.items).length} tipos de itens`);

    // Retornar dados atualizados do Firebase para o cliente
    res.json({
      success: true,
      message: 'Estado sincronizado com sucesso',
      userData: updatedUserData // Dados atualizados do Firebase
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao sincronizar estado:', error);
    res.status(500).json({
      error: 'Erro ao sincronizar estado'
    });
  }
});

/**
 * Executa múltiplos crafts em batch (reduz requisições ao servidor)
 */
app.post('/api/craft-items-batch', async (req: Request, res: Response) => {
  try {
    const { userId, crafts } = req.body;

    if (!userId || !Array.isArray(crafts) || crafts.length === 0) {
      return res.status(400).json({
        error: 'userId e crafts (array não vazio) são obrigatórios'
      });
    }

    if (!isFirebaseAvailable()) {
      return res.status(503).json({
        error: 'Firebase não disponível'
      });
    }

    console.log(`[HTTP] 🔨 Executando batch crafting para usuário ${userId}: ${crafts.length} crafts`);

    const result = await craftItemsBatch(userId, crafts);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        failedIndex: result.failedIndex
      });
    }

    // Buscar dados atualizados do Firebase para retornar ao cliente
    const { getUser } = await import('./firestoreOperations');
    const updatedUserData = await getUser(userId);

    if (!updatedUserData) {
      return res.status(500).json({
        error: 'Erro ao recuperar dados atualizados'
      });
    }

    console.log(`[HTTP] ✅ Batch crafting executado com sucesso para ${userId}`);

    res.json({
      success: true,
      message: `Batch crafting executado: ${crafts.length} crafts`,
      userData: updatedUserData
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao executar batch crafting:', error);
    res.status(500).json({
      error: 'Erro ao executar batch crafting'
    });
  }
});

/**
 * Executa crafting de forma protegida (valida e aplica no servidor)
 */
app.post('/api/craft-item', async (req: Request, res: Response) => {
  try {
    const { userId, recipeId, ingredients, resultItemId, resultQuantity, teamSlotsIncrease } = req.body;

    if (!userId || !recipeId || !ingredients || !resultItemId) {
      return res.status(400).json({
        error: 'userId, recipeId, ingredients e resultItemId são obrigatórios'
      });
    }

    if (!isFirebaseAvailable()) {
      return res.status(503).json({
        error: 'Firebase não disponível'
      });
    }

    console.log(`[HTTP] 🔨 Executando crafting para usuário ${userId}: ${recipeId}`);

    const result = await craftItem(
      userId,
      recipeId,
      ingredients,
      resultItemId,
      resultQuantity || 1,
      teamSlotsIncrease
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Buscar dados atualizados do Firebase para retornar ao cliente
    const { getUser } = await import('./firestoreOperations');
    const updatedUserData = await getUser(userId);

    if (!updatedUserData) {
      return res.status(500).json({
        error: 'Erro ao recuperar dados atualizados'
      });
    }

    console.log(`[HTTP] ✅ Crafting executado com sucesso para ${userId}`);

    res.json({
      success: true,
      message: 'Crafting executado com sucesso',
      userData: updatedUserData
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao executar crafting:', error);
    res.status(500).json({
      error: 'Erro ao executar crafting'
    });
  }
});

/**
 * Atualiza equipe ativa de forma protegida (valida e aplica no servidor)
 */
app.post('/api/set-active-team', async (req: Request, res: Response) => {
  try {
    const { userId, creatureIds } = req.body;

    if (!userId || !Array.isArray(creatureIds)) {
      return res.status(400).json({
        error: 'userId e creatureIds (array) são obrigatórios'
      });
    }

    if (!isFirebaseAvailable()) {
      return res.status(503).json({
        error: 'Firebase não disponível'
      });
    }

    console.log(`[HTTP] 👥 Atualizando equipe ativa para usuário ${userId}: ${creatureIds.length} criaturas`);

    const result = await setActiveTeam(userId, creatureIds);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Buscar dados atualizados do Firebase para retornar ao cliente
    const { getUser } = await import('./firestoreOperations');
    const updatedUserData = await getUser(userId);

    if (!updatedUserData) {
      return res.status(500).json({
        error: 'Erro ao recuperar dados atualizados'
      });
    }

    console.log(`[HTTP] ✅ Equipe ativa atualizada com sucesso para ${userId}`);

    res.json({
      success: true,
      message: 'Equipe atualizada com sucesso',
      userData: updatedUserData
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao atualizar equipe:', error);
    res.status(500).json({
      error: 'Erro ao atualizar equipe'
    });
  }
});

/**
 * Promove criatura (evolução) de forma protegida (valida e aplica no servidor)
 */
app.post('/api/promote-creature', async (req: Request, res: Response) => {
  try {
    const { userId, targetCreatureId, sacrificeCreatureIds, newRank } = req.body;

    if (!userId || !targetCreatureId || !sacrificeCreatureIds || !Array.isArray(sacrificeCreatureIds) || newRank === undefined) {
      return res.status(400).json({
        error: 'userId, targetCreatureId, sacrificeCreatureIds (array) e newRank são obrigatórios'
      });
    }

    if (!isFirebaseAvailable()) {
      return res.status(503).json({
        error: 'Firebase não disponível'
      });
    }

    console.log(`[HTTP] ⭐ Executando evolução para usuário ${userId}: criatura ${targetCreatureId} -> rank ${newRank}`);

    const result = await promoteCreature(
      userId,
      targetCreatureId,
      sacrificeCreatureIds,
      newRank
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Buscar dados atualizados do Firebase para retornar ao cliente
    const { getUser } = await import('./firestoreOperations');
    const updatedUserData = await getUser(userId);

    if (!updatedUserData) {
      return res.status(500).json({
        error: 'Erro ao recuperar dados atualizados'
      });
    }

    console.log(`[HTTP] ✅ Evolução executada com sucesso para ${userId}`);

    res.json({
      success: true,
      message: 'Evolução executada com sucesso',
      userData: updatedUserData
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao executar evolução:', error);
    res.status(500).json({
      error: 'Erro ao executar evolução'
    });
  }
});

/**
 * Salva apenas a mochila (preparedExpeditionInventory) do jogador
 * Também atualiza o armazém, removendo os itens que foram movidos para a mochila
 */
app.post('/api/save-backpack', async (req: Request, res: Response) => {
  try {
    const { userId, backpack } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'userId é obrigatório'
      });
    }

    if (!isFirebaseAvailable()) {
      return res.status(503).json({
        error: 'Firebase não disponível'
      });
    }

    console.log(`[HTTP] 📦 Salvando mochila para jogador ${userId}`);

    const { getUser } = await import('./firestoreOperations');
    const existingUserData = await getUser(userId);

    if (!existingUserData) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    // Converter array para Record se necessário
    let backpackData: Record<string, number> = {};
    if (Array.isArray(backpack)) {
      for (const item of backpack) {
        if (item.quantity > 0) {
          backpackData[item.itemId] = item.quantity;
        }
      }
    } else if (backpack && typeof backpack === 'object') {
      backpackData = backpack;
    }

    // Comparar mochila antiga com a nova para calcular diferença
    const oldBackpack = existingUserData.preparedExpeditionInventory || {};
    const inventoryItems = existingUserData.inventory?.items || {};
    
    // Calcular itens que foram adicionados ou removidos da mochila
    const itemsToRemoveFromInventory: Record<string, number> = {}; // Itens adicionados à mochila (remover do armazém)
    const itemsToAddToInventory: Record<string, number> = {}; // Itens removidos da mochila (adicionar ao armazém)
    const allItemIds = new Set([...Object.keys(backpackData), ...Object.keys(oldBackpack)]);
    
    for (const itemId of allItemIds) {
      const oldQuantity = oldBackpack[itemId] || 0;
      const newQuantity = backpackData[itemId] || 0;
      const difference = newQuantity - oldQuantity;
      
      if (difference > 0) {
        // Itens foram adicionados à mochila - precisamos remover do armazém
        const availableInInventory = inventoryItems[itemId] || 0;
        
        if (availableInInventory < difference) {
          return res.status(400).json({
            error: `Itens insuficientes no armazém: ${itemId}. Disponível: ${availableInInventory}, Necessário: ${difference}`
          });
        }
        
        itemsToRemoveFromInventory[itemId] = difference;
        console.log(`[HTTP] 📤 Movendo ${difference}x ${itemId} do armazém para a mochila`);
      } else if (difference < 0) {
        // Itens foram removidos da mochila - adicionar de volta ao armazém
        itemsToAddToInventory[itemId] = Math.abs(difference);
        console.log(`[HTTP] 📥 Movendo ${Math.abs(difference)}x ${itemId} da mochila para o armazém`);
      }
    }

    // Atualizar mochila e armazém no Firebase usando batch para atomicidade
    const db = getDb();
    const userRef = db.collection('users').doc(userId);
    const batch = db.batch();
    
    // Atualizar mochila
    batch.update(userRef, {
      preparedExpeditionInventory: backpackData
    });
    
    // Remover itens do armazém (quando adicionados à mochila)
    for (const [itemId, quantity] of Object.entries(itemsToRemoveFromInventory)) {
      batch.update(userRef, {
        [`inventory.items.${itemId}`]: FieldValue.increment(-quantity)
      });
    }
    
    // Adicionar itens ao armazém (quando removidos da mochila)
    for (const [itemId, quantity] of Object.entries(itemsToAddToInventory)) {
      batch.update(userRef, {
        [`inventory.items.${itemId}`]: FieldValue.increment(quantity)
      });
    }
    
    // Executar batch (transação atômica)
    await batch.commit();

    console.log(`[HTTP] ✅ Mochila salva: ${Object.keys(backpackData).length} tipos de itens`);
    if (Object.keys(itemsToRemoveFromInventory).length > 0) {
      console.log(`[HTTP] ✅ Armazém atualizado: ${Object.keys(itemsToRemoveFromInventory).length} tipos de itens removidos`);
    }
    if (Object.keys(itemsToAddToInventory).length > 0) {
      console.log(`[HTTP] ✅ Armazém atualizado: ${Object.keys(itemsToAddToInventory).length} tipos de itens adicionados`);
    }

    // Buscar dados atualizados
    const updatedUserData = await getUser(userId);

    res.json({
      success: true,
      message: 'Mochila salva com sucesso',
      userData: updatedUserData
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao salvar mochila:', error);
    res.status(500).json({
      error: 'Erro ao salvar mochila'
    });
  }
});

/**
 * NOTA: Endpoints de expedição removidos (FASE 3).
 * 
 * - /api/sync-expedition-rewards: Removido - servidor salva automaticamente quando extração completa
 * - /api/expedition-start: Removido - não é mais necessário
 * - /api/expedition-end: Removido - servidor salva automaticamente quando extração completa
 * 
 * Todas as operações de expedição são agora gerenciadas pelo servidor WebSocket.
 * O servidor salva recompensas automaticamente no Firebase quando extração completa.
 */

/**
 * Inicia o servidor HTTP
 */
export function startHttpServer(port: number = 3004): void {
  app.listen(port, () => {
    console.log(`[HTTP Server] 🌐 Servidor HTTP rodando na porta ${port}`);
    console.log(`[HTTP Server] ℹ️  Firebase: ${isFirebaseAvailable() ? 'Disponível' : 'Indisponível'}`);
    console.log(`[HTTP Server] 🔗 URL: http://localhost:${port}`);
  });
}

export default app;
