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
 * Busca dados do jogador do servidor (apenas leitura - não sobrescreve nada)
 * Usado para sincronizar dados após expedições ou ao entrar na base
 */
export async function fetchPlayerDataFromServer(): Promise<boolean> {
  const userId = getUserId();
  if (!userId) {
    console.warn('[FirebaseSync] Usuário não autenticado - busca de dados ignorada');
    return false;
  }

  try {
    console.log('[FirebaseSync] 📖 Buscando dados do jogador do servidor...');
    console.log('[FirebaseSync] URL:', `${SERVER_URL}/api/get-player?userId=${userId}`);
    
    const response = await fetch(`${SERVER_URL}/api/get-player?userId=${userId}`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('[FirebaseSync] Response status (get-player):', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FirebaseSync] Response error (get-player):', errorText);
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
      PlayerState.syncFromRemoteData(result.userData as UserData);
      
      console.log('[FirebaseSync] ✅ Dados atualizados com sucesso do Firebase');
    } else {
      console.log('[FirebaseSync] ⚠️  Dados não retornados pelo servidor');
    }
    
    return true;
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao buscar dados:', error);
    if (error instanceof Error) {
      console.error('[FirebaseSync] Mensagem:', error.message);
    }
    return false;
  }
}

/**
 * Executa crafting de forma protegida no servidor
 */
export async function craftItemOnServer(
  recipeId: string,
  ingredients: Array<{ itemId: string; quantity: number }>,
  resultItemId: string,
  resultQuantity: number = 1,
  teamSlotsIncrease?: number
): Promise<{ success: boolean; error?: string; userData?: UserData }> {
  const userId = getUserId();
  if (!userId) {
    return { success: false, error: 'Usuário não autenticado' };
  }

  try {
    console.log('[FirebaseSync] 🔨 Executando crafting no servidor...');
    console.log('[FirebaseSync] Recipe:', recipeId, '->', resultItemId);
    
    const response = await fetch(`${SERVER_URL}/api/craft-item`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        recipeId,
        ingredients,
        resultItemId,
        resultQuantity,
        teamSlotsIncrease
      })
    });

    if (!response.ok) {
      let errorMessage = 'Erro ao executar crafting';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    const result = await response.json();
    
    if (result.success && result.userData) {
      // Atualizar PlayerState com dados retornados
      PlayerState.syncFromRemoteData(result.userData as UserData);
      console.log('[FirebaseSync] ✅ Crafting executado com sucesso');
      return { success: true, userData: result.userData as UserData };
    } else {
      return { success: false, error: result.error || 'Erro desconhecido' };
    }
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao executar crafting:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

/**
 * Promove criatura (evolução) de forma protegida no servidor
 */
export async function promoteCreatureOnServer(
  targetCreatureId: string,
  sacrificeCreatureIds: string[],
  newRank: number
): Promise<{ success: boolean; error?: string; userData?: UserData }> {
  const userId = getUserId();
  if (!userId) {
    return { success: false, error: 'Usuário não autenticado' };
  }

  try {
    console.log('[FirebaseSync] ⭐ Executando evolução no servidor...');
    console.log('[FirebaseSync] Target:', targetCreatureId, '-> Rank', newRank);
    console.log('[FirebaseSync] Sacrificando:', sacrificeCreatureIds.length, 'criaturas');
    
    const response = await fetch(`${SERVER_URL}/api/promote-creature`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        targetCreatureId,
        sacrificeCreatureIds,
        newRank
      })
    });

    if (!response.ok) {
      let errorMessage = 'Erro ao executar evolução';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    const result = await response.json();
    
    if (result.success && result.userData) {
      // Atualizar PlayerState com dados retornados
      PlayerState.syncFromRemoteData(result.userData as UserData);
      console.log('[FirebaseSync] ✅ Evolução executada com sucesso');
      return { success: true, userData: result.userData as UserData };
    } else {
      return { success: false, error: result.error || 'Erro desconhecido' };
    }
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao executar evolução:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

/**
 * Atualiza equipe ativa de forma protegida no servidor
 */
export async function setActiveTeamOnServer(
  creatureIds: string[]
): Promise<{ success: boolean; error?: string; userData?: UserData }> {
  const userId = getUserId();
  if (!userId) {
    return { success: false, error: 'Usuário não autenticado' };
  }

  try {
    console.log('[FirebaseSync] 👥 Atualizando equipe ativa no servidor...');
    console.log('[FirebaseSync] Criaturas:', creatureIds.length);
    
    const response = await fetch(`${SERVER_URL}/api/set-active-team`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        creatureIds
      })
    });

    if (!response.ok) {
      let errorMessage = 'Erro ao atualizar equipe';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    const result = await response.json();
    
    if (result.success && result.userData) {
      // Atualizar PlayerState com dados retornados
      PlayerState.syncFromRemoteData(result.userData as UserData);
      console.log('[FirebaseSync] ✅ Equipe atualizada com sucesso');
      return { success: true, userData: result.userData as UserData };
    } else {
      return { success: false, error: result.error || 'Erro desconhecido' };
    }
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao atualizar equipe:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

/**
 * Executa múltiplos crafts em batch (reduz requisições ao servidor)
 */
export async function craftItemsBatch(
  crafts: Array<{
    recipeId: string;
    ingredients: Array<{ itemId: string; quantity: number }>;
    resultItemId: string;
    resultQuantity?: number;
    teamSlotsIncrease?: number;
  }>
): Promise<{ success: boolean; error?: string; userData?: UserData }> {
  const userId = getUserId();
  if (!userId) {
    return { success: false, error: 'Usuário não autenticado' };
  }

  if (crafts.length === 0) {
    return { success: false, error: 'Nenhum craft especificado' };
  }

  try {
    console.log('[FirebaseSync] 🔨 Executando batch crafting no servidor...');
    console.log('[FirebaseSync] Quantidade de crafts:', crafts.length);
    
    const response = await fetch(`${SERVER_URL}/api/craft-items-batch`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        crafts
      })
    });

    if (!response.ok) {
      let errorMessage = 'Erro ao executar batch crafting';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    const result = await response.json();
    
    if (result.success && result.userData) {
      // Atualizar PlayerState com dados retornados
      PlayerState.syncFromRemoteData(result.userData as UserData);
      console.log('[FirebaseSync] ✅ Batch crafting executado com sucesso');
      return { success: true, userData: result.userData as UserData };
    } else {
      return { success: false, error: result.error || 'Erro desconhecido' };
    }
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao executar batch crafting:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

/**
 * Sincroniza o estado completo do jogador com o servidor (DEPRECATED)
 * Mantido apenas para compatibilidade - usar fetchPlayerDataFromServer() para leitura
 */
export async function syncPlayerStateToServer(): Promise<boolean> {
  // Redirecionar para fetchPlayerDataFromServer (apenas leitura)
  return fetchPlayerDataFromServer();
}

/**
 * Salva a mochila (preparedExpeditionInventory) no servidor
 */
export async function saveBackpackToServer(
  backpack: Array<{ itemId: string; quantity: number }>
): Promise<{ success: boolean; error?: string; userData?: UserData }> {
  const userId = getUserId();
  if (!userId) {
    return { success: false, error: 'Usuário não autenticado' };
  }

  try {
    console.log('[FirebaseSync] 📦 Salvando mochila no servidor...');
    console.log('[FirebaseSync] Itens:', backpack.length);
    
    const response = await fetch(`${SERVER_URL}/api/save-backpack`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        backpack
      })
    });

    if (!response.ok) {
      let errorMessage = 'Erro ao salvar mochila';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    const result = await response.json();
    
    if (result.success && result.userData) {
      // Atualizar PlayerState com dados retornados
      PlayerState.syncFromRemoteData(result.userData as UserData);
      console.log('[FirebaseSync] ✅ Mochila salva com sucesso');
      return { success: true, userData: result.userData as UserData };
    } else {
      return { success: false, error: result.error || 'Erro desconhecido' };
    }
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao salvar mochila:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

/**
 * Atualiza o mapa selecionado no servidor
 */
export async function setSelectedMapIdOnServer(
  mapId: string
): Promise<{ success: boolean; error?: string; userData?: UserData }> {
  const userId = getUserId();
  if (!userId) {
    return { success: false, error: 'Usuário não autenticado' };
  }

  try {
    console.log('[FirebaseSync] 🗺️  Atualizando mapa selecionado no servidor...');
    console.log('[FirebaseSync] Mapa:', mapId);
    
    const response = await fetch(`${SERVER_URL}/api/set-selected-map`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        mapId
      })
    });

    if (!response.ok) {
      let errorMessage = 'Erro ao atualizar mapa selecionado';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    const result = await response.json();
    
    if (result.success && result.userData) {
      // Atualizar PlayerState com dados retornados
      PlayerState.syncFromRemoteData(result.userData as UserData);
      console.log('[FirebaseSync] ✅ Mapa selecionado atualizado com sucesso');
      return { success: true, userData: result.userData as UserData };
    } else {
      return { success: false, error: result.error || 'Erro desconhecido' };
    }
  } catch (error) {
    console.error('[FirebaseSync] ❌ Erro ao atualizar mapa selecionado:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

/**
 * NOTA: Syncs de expedição (recompensas, início, fim) foram removidos.
 * Todas as operações de expedição são agora gerenciadas pelo servidor.
 * O servidor salva automaticamente recompensas quando extração completa.
 * 
 * Mantido apenas: syncPlayerStateToServer() para crafting/loadout/equipe.
 */
