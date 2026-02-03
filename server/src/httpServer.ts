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
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    // GitHub Pages (ajuste com seu username/repo)
    process.env.CLIENT_URL || 'https://YOUR_USERNAME.github.io',
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
