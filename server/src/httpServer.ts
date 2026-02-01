/**
 * Servidor HTTP para sincronização de dados com Firebase
 * 
 * Este servidor fornece endpoints REST para o cliente sincronizar
 * dados do jogador com o Firestore via Firebase Admin SDK.
 * 
 * CORS configurado para aceitar requisições do cliente Vite (porta 5173)
 */

import express, { Request, Response } from 'express';
import { isFirebaseAvailable } from './firebase';
import { saveUserData, saveExpeditionRewards, createUser } from './firestoreOperations';
import type { SaveExpeditionData } from './firebaseTypes';

const app = express();

console.log('[HTTP Server] 🔧 Configurando CORS customizado - VERSÃO NOVA');

// Middleware CORS - configuração manual completa
app.use((req, res, next) => {
  const origin = req.headers.origin || 'http://localhost:5173';
  console.log(`[HTTP] ${req.method} ${req.path} - Origin: ${origin}`);
  
  // Lista de origens permitidas
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ];
  
  // Verificar se a origem está na lista permitida
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!req.headers.origin) {
    // Se não há header origin (requisições do mesmo domínio), permitir
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas de cache para preflight
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log(`[HTTP] ✓ Preflight request para ${req.path} - Origin permitida: ${origin}`);
    return res.status(204).end();
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
 * Sincroniza estado completo do jogador
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
    const userData = {
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

    // Converter inventário
    if (progress.inventory && Array.isArray(progress.inventory)) {
      for (const item of progress.inventory) {
        userData.inventory.items[item.itemId] = item.quantity;
      }
    }

    // Converter criaturas
    if (progress.creatures && Array.isArray(progress.creatures)) {
      for (const creature of progress.creatures) {
        // Buscar dados completos da criatura do Firebase se existir (para preservar capturedAt)
        const existingCreature = existingUserData?.creatures?.[creature.instanceId];
        
        userData.creatures[creature.instanceId] = {
          instanceId: creature.instanceId,
          definitionId: creature.definitionId,
          level: creature.level,
          currentHp: creature.currentHp,
          maxHp: existingCreature?.maxHp || creature.currentHp, // Preservar maxHp se existir
          experience: creature.experience,
          rank: creature.rank || 1,
          copiesFused: creature.copiesFused || 0,
          totalExpeditionXp: creature.totalExpeditionXp || 0,
          // Preservar capturedAt se existir
          capturedAt: existingCreature?.capturedAt || new Date()
        };
      }
    }
    
    console.log(`[HTTP] 📊 Estado convertido:`);
    console.log(`[HTTP] - Itens no inventário: ${Object.keys(userData.inventory.items).length}`);
    console.log(`[HTTP] - Criaturas: ${Object.keys(userData.creatures).length}`);
    console.log(`[HTTP] - Time ativo: ${userData.activeTeam.creatureIds.length} criaturas`);

    await saveUserData(userId, userData);

    console.log(`[HTTP] ✅ Estado sincronizado para ${userId}`);

    res.json({
      success: true,
      message: 'Estado sincronizado com sucesso'
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao sincronizar estado:', error);
    res.status(500).json({
      error: 'Erro ao sincronizar estado'
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
