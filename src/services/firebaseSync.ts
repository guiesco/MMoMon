/**
 * Serviço de Sincronização com Firebase
 * 
 * Este módulo gerencia a sincronização de dados do jogador com o servidor Firebase.
 * O cliente envia dados para o servidor via HTTP, que então atualiza o Firestore.
 * O servidor retorna os dados atualizados do Firebase para garantir sincronização.
 */

import { PlayerState } from "../game/playerState";
import { getUserId } from "./firebaseClient";
import type { UserData } from "./firebaseClient";

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
    
    if (result.success && result.userData) {
      // IMPORTANTE: Atualizar PlayerState com dados retornados do Firebase
      // Isso garante que sempre temos a versão mais atualizada (incluindo criaturas capturadas)
      console.log('[FirebaseSync] 📥 Atualizando PlayerState com dados do Firebase...');
      console.log(`[FirebaseSync] - Criaturas recebidas: ${Object.keys(result.userData.creatures || {}).length}`);
      console.log(`[FirebaseSync] - Itens recebidos: ${Object.keys(result.userData.inventory?.items || {}).length}`);
      
      // Sincronizar dados retornados diretamente no PlayerState
      // Isso evita usar dados desatualizados do localStorage
      PlayerState.syncFromRemoteData(result.userData as UserData);
      
      console.log('[FirebaseSync] ✅ Estado sincronizado e atualizado com dados do Firebase');
    } else {
      console.log('[FirebaseSync] ✅ Estado sincronizado com sucesso (sem dados retornados)');
    }
    
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
 * NOTA: Syncs de expedição (recompensas, início, fim) foram removidos.
 * Todas as operações de expedição são agora gerenciadas pelo servidor.
 * O servidor salva automaticamente recompensas quando extração completa.
 * 
 * Mantido apenas: syncPlayerStateToServer() para crafting/loadout/equipe.
 */
