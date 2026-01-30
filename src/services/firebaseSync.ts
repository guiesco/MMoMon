/**
 * Serviço de Sincronização com Firebase
 * 
 * Este módulo gerencia a sincronização de dados do jogador com o servidor Firebase.
 * O cliente envia dados para o servidor via HTTP, que então atualiza o Firestore.
 */

import { PlayerState } from "../game/playerState";
import { getUserId } from "./firebaseClient";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3004";

/**
 * Sincroniza o estado completo do jogador com o servidor
 */
export async function syncPlayerStateToServer(): Promise<boolean> {
  const userId = getUserId();
  if (!userId) {
    console.warn('[FirebaseSync] Usuário não autenticado - sync de estado ignorado');
    return false;
  }

  const progress = PlayerState.getProgress();

  try {
    console.log('[FirebaseSync] 📤 Enviando estado do jogador para servidor...');
    console.log('[FirebaseSync] URL:', `${SERVER_URL}/api/sync-player`);
    console.log('[FirebaseSync] UserId:', userId);
    console.log('[FirebaseSync] Progress items:', progress.inventory?.length || 0, 'itens');
    console.log('[FirebaseSync] Progress creatures:', progress.creatures?.length || 0, 'criaturas');
    
    const response = await fetch(`${SERVER_URL}/api/sync-player`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        progress
      })
    });

    console.log('[FirebaseSync] Response status (sync-player):', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FirebaseSync] Response error (sync-player):', errorText);
      throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[FirebaseSync] ✅ Estado sincronizado com sucesso:', result);
    return true;
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao sincronizar estado:', error);
    if (error instanceof Error) {
      console.error('[FirebaseSync] Mensagem:', error.message);
    }
    return false;
  }
}

/**
 * Sincroniza recompensas de expedição com o servidor
 */
export async function syncExpeditionRewards(rewards: {
  resourcesCollected: { itemId: string; quantity: number }[];
  creaturesCaptures: { definitionId: string; level: number }[];
  xpGained: Map<string, number>;
}): Promise<boolean> {
  const userId = getUserId();
  if (!userId) {
    console.warn('[FirebaseSync] Usuário não autenticado - sync ignorado');
    return false;
  }

  try {
    console.log('[FirebaseSync] 📤 Enviando recompensas de expedição...');
    
    // Converter Map para objeto simples
    const xpGainedObj: Record<string, number> = {};
    rewards.xpGained.forEach((xp, creatureId) => {
      xpGainedObj[creatureId] = xp;
    });

    const response = await fetch(`${SERVER_URL}/api/sync-expedition-rewards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        rewards: {
          resourcesCollected: rewards.resourcesCollected,
          creaturesCaptures: rewards.creaturesCaptures,
          xpGained: xpGainedObj
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const result = await response.json();
    console.log('[FirebaseSync] ✅ Recompensas sincronizadas com sucesso');
    return true;
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao sincronizar recompensas:', error);
    return false;
  }
}

/**
 * Sincroniza início de expedição com o servidor
 */
export async function syncExpeditionStart(mapId: string): Promise<boolean> {
  const userId = getUserId();
  if (!userId) {
    console.warn('[FirebaseSync] Usuário não autenticado - sync ignorado');
    return false;
  }

  try {
    console.log('[FirebaseSync] 📤 Registrando início de expedição...');
    console.log('[FirebaseSync] URL:', `${SERVER_URL}/api/expedition-start`);
    console.log('[FirebaseSync] Payload:', { userId, mapId, timestamp: Date.now() });
    
    const response = await fetch(`${SERVER_URL}/api/expedition-start`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        mapId,
        timestamp: Date.now()
      })
    });

    console.log('[FirebaseSync] Response status:', response.status);
    console.log('[FirebaseSync] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FirebaseSync] Response error:', errorText);
      throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[FirebaseSync] ✅ Início de expedição registrado:', result);
    return true;
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao registrar início:', error);
    console.error('[FirebaseSync] Tipo do erro:', error instanceof TypeError ? 'TypeError (possivelmente CORS)' : (error as Error).constructor.name);
    if (error instanceof Error) {
      console.error('[FirebaseSync] Mensagem:', error.message);
      console.error('[FirebaseSync] Stack:', error.stack);
    }
    return false;
  }
}

/**
 * Sincroniza fim de expedição com o servidor
 */
export async function syncExpeditionEnd(
  success: boolean,
  stats: {
    duration: number;
    resourcesCollected: number;
    creaturesCaptures: number;
    damageDealt: number;
    damageTaken: number;
  }
): Promise<boolean> {
  const userId = getUserId();
  if (!userId) {
    console.warn('[FirebaseSync] Usuário não autenticado - sync de fim de expedição ignorado');
    return false;
  }

  try {
    console.log('[FirebaseSync] 📤 Registrando fim de expedição...');
    console.log('[FirebaseSync] URL:', `${SERVER_URL}/api/expedition-end`);
    console.log('[FirebaseSync] Payload:', { userId, success, stats, timestamp: Date.now() });
    
    const response = await fetch(`${SERVER_URL}/api/expedition-end`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        success,
        stats,
        timestamp: Date.now()
      })
    });

    console.log('[FirebaseSync] Response status (expedition-end):', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FirebaseSync] Response error (expedition-end):', errorText);
      throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[FirebaseSync] ✅ Fim de expedição registrado:', result);
    return true;
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao registrar fim de expedição:', error);
    if (error instanceof Error) {
      console.error('[FirebaseSync] Mensagem:', error.message);
    }
    return false;
  }
}
