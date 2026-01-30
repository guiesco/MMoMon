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
import { saveUserData, saveExpeditionRewards } from './firestoreOperations';
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

    // Converter formato do cliente para formato do Firestore
    const userData = {
      profile: {
        displayName: progress.displayName || 'Convidado',
        createdAt: new Date(),
        lastLogin: new Date(),
        totalPlayTime: 0
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
        selectedMapId: progress.selectedMapId || 'forest-clearing'
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

    // Converter inventário
    if (progress.inventory && Array.isArray(progress.inventory)) {
      for (const item of progress.inventory) {
        userData.inventory.items[item.itemId] = item.quantity;
      }
    }

    // Converter criaturas
    if (progress.creatures && Array.isArray(progress.creatures)) {
      for (const creature of progress.creatures) {
        userData.creatures[creature.instanceId] = {
          instanceId: creature.instanceId,
          definitionId: creature.definitionId,
          level: creature.level,
          currentHp: creature.currentHp,
          experience: creature.experience,
          rank: creature.rank || 1,
          copiesFused: creature.copiesFused || 0,
          totalExpeditionXp: creature.totalExpeditionXp || 0
        };
      }
    }

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
 * Sincroniza recompensas de expedição
 */
app.post('/api/sync-expedition-rewards', async (req: Request, res: Response) => {
  try {
    const { userId, rewards } = req.body;

    if (!userId || !rewards) {
      return res.status(400).json({
        error: 'userId e rewards são obrigatórios'
      });
    }

    if (!isFirebaseAvailable()) {
      return res.status(503).json({
        error: 'Firebase não disponível'
      });
    }

    console.log(`[HTTP] 📥 Sincronizando recompensas de expedição para ${userId}`);

    const expeditionData: SaveExpeditionData = {
      userId,
      success: true,
      mapId: 'unknown', // Será atualizado se tivermos essa info
      startedAt: new Date(),
      duration: 0,
      rewards: {
        resources: new Map(Object.entries(rewards.resourcesCollected || {})),
        capturedCreatures: rewards.creaturesCaptures || []
      },
      stats: {
        damageDealt: 0,
        damageTaken: 0,
        resourcesCollected: rewards.resourcesCollected 
          ? (Object.values(rewards.resourcesCollected) as number[]).reduce((a, b) => a + b, 0) 
          : 0,
        creaturesCaptured: (rewards.creaturesCaptures || []).length
      }
    };

    await saveExpeditionRewards(expeditionData);

    console.log(`[HTTP] ✅ Recompensas sincronizadas para ${userId}`);

    res.json({
      success: true,
      message: 'Recompensas sincronizadas com sucesso'
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao sincronizar recompensas:', error);
    res.status(500).json({
      error: 'Erro ao sincronizar recompensas'
    });
  }
});

/**
 * Registra início de expedição
 */
app.post('/api/expedition-start', async (req: Request, res: Response) => {
  try {
    const { userId, mapId, timestamp } = req.body;

    if (!userId || !mapId) {
      return res.status(400).json({
        error: 'userId e mapId são obrigatórios'
      });
    }

    console.log(`[HTTP] 📥 Registrando início de expedição: ${userId} em ${mapId}`);

    // Por enquanto apenas log - pode ser expandido para salvar no Firestore
    res.json({
      success: true,
      message: 'Início de expedição registrado'
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao registrar início:', error);
    res.status(500).json({
      error: 'Erro ao registrar início de expedição'
    });
  }
});

/**
 * Registra fim de expedição
 */
app.post('/api/expedition-end', async (req: Request, res: Response) => {
  try {
    const { userId, success, stats, timestamp } = req.body;

    if (!userId || success === undefined) {
      return res.status(400).json({
        error: 'userId e success são obrigatórios'
      });
    }

    console.log(`[HTTP] 📥 Registrando fim de expedição: ${userId} (${success ? 'sucesso' : 'falha'})`);

    // Por enquanto apenas log - pode ser expandido para salvar no Firestore
    res.json({
      success: true,
      message: 'Fim de expedição registrado'
    });
  } catch (error) {
    console.error('[HTTP] ❌ Erro ao registrar fim:', error);
    res.status(500).json({
      error: 'Erro ao registrar fim de expedição'
    });
  }
});

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
