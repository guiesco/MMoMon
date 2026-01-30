import type { CreatureRank, OwnedCreature, PlayerInventoryEntry, PlayerProgress } from "./types";
import { DEFAULT_MAP_ID, type MapId } from "./maps";
import { CREATURES } from "./creatures";
import {
  getXpRequiredForLevel,
  LEVEL_CONFIG,
  RANK_CONFIG,
  getEffectiveStats,
  type ExpeditionXpParams,
  calculateExpeditionXp,
} from "./creatureProgression";
import {
  initializeFirebaseClient,
  isFirebaseClientAvailable,
  signInAnonymous,
  getCurrentUser,
  getUserId,
  subscribeToUserData,
  unsubscribeFromUserData,
  type UserData
} from "../services/firebaseClient";
import type { Unsubscribe } from "firebase/firestore";

const LOCAL_STORAGE_KEY = "pokextract_player_progress_v1";

class PlayerStateManager {
  private progress: PlayerProgress;
  private firebaseUnsubscribe: Unsubscribe | null = null;
  private useFirebase: boolean = false;

  constructor() {
    this.progress = this.loadFromStorage() ?? this.createDefaultProgress();

    // Garante que novos campos (como selectedMapId) sejam preenchidos em saves antigos
    if (!this.progress.selectedMapId) {
      this.progress.selectedMapId = DEFAULT_MAP_ID;
      this.saveToStorage(this.progress);
    }

    // Tentar inicializar Firebase
    this.initializeFirebase();
  }

  /**
   * Inicializa Firebase e sincronização em tempo real
   */
  private async initializeFirebase(): Promise<void> {
    const initialized = initializeFirebaseClient();
    if (!initialized) {
      console.log('[PlayerState] Firebase não disponível - usando localStorage');
      return;
    }

    try {
      // Aguardar autenticação (feita na AuthScene)
      // Verificar periodicamente se há usuário autenticado
      const maxAttempts = 10;
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        const user = getCurrentUser();
        if (user) {
          console.log('[PlayerState] ✅ Usuário autenticado:', user.uid);
          this.useFirebase = true;
          
          // Escutar mudanças em tempo real
          this.firebaseUnsubscribe = subscribeToUserData(user.uid, (data) => {
            if (data) {
              this.syncFromFirebase(data);
            } else {
              // Primeira vez - migrar dados do localStorage
              console.log('[PlayerState] 📦 Primeira vez - migrando dados do localStorage');
              this.migrateLocalDataToFirebase(user.uid);
            }
          });
          
          return;
        }
        
        // Aguardar 100ms antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      console.warn('[PlayerState] Timeout aguardando autenticação - usando localStorage');
    } catch (error) {
      console.error('[PlayerState] Erro ao inicializar Firebase:', error);
      this.useFirebase = false;
    }
  }

  /**
   * Migra dados do localStorage para Firebase (primeira vez)
   */
  private async migrateLocalDataToFirebase(userId: string): Promise<void> {
    console.log('[PlayerState] 🔄 Iniciando migração de dados...');
    
    // Dados já estão em this.progress (carregados do localStorage no construtor)
    const localData = this.progress;
    
    // Verificar se há dados significativos para migrar
    const hasSignificantData = 
      localData.creatures.length > 1 || // Mais que o starter
      localData.inventory.length > 2 || // Mais que os itens iniciais
      localData.displayName !== "Convidado";
    
    if (!hasSignificantData) {
      console.log('[PlayerState] ℹ️  Nenhum dado significativo para migrar');
      return;
    }
    
    console.log('[PlayerState] 📤 Enviando dados para Firebase...');
    console.log(`[PlayerState] - Criaturas: ${localData.creatures.length}`);
    console.log(`[PlayerState] - Itens: ${localData.inventory.length}`);
    console.log(`[PlayerState] - Nome: ${localData.displayName}`);
    
    // Atualizar UID para o Firebase
    this.progress.uid = userId;
    
    // Salvar no localStorage com novo UID
    this.saveToStorage(this.progress);
    
    // Nota: A sincronização com Firebase será feita pelo servidor
    // quando o jogador completar uma expedição ou realizar ações
    // O cliente tem acesso SOMENTE LEITURA ao Firestore
    
    console.log('[PlayerState] ✅ Migração preparada - dados serão sincronizados pelo servidor');
  }

  /**
   * Sincroniza dados do Firebase para o estado local
   */
  private syncFromFirebase(data: UserData): void {
    console.log('[PlayerState] 📥 Sincronizando dados do Firebase...');

    // Converter formato Firebase para PlayerProgress
    const creatures: OwnedCreature[] = Object.values(data.creatures || {}).map((c: any) => ({
      instanceId: c.instanceId,
      definitionId: c.definitionId,
      level: c.level,
      currentHp: c.currentHp,
      experience: c.experience,
      rank: c.rank,
      copiesFused: c.copiesFused,
      totalExpeditionXp: c.totalExpeditionXp
    }));

    const inventory: PlayerInventoryEntry[] = Object.entries(data.inventory.items || {}).map(
      ([itemId, quantity]) => ({ itemId, quantity: quantity as number })
    );

    this.progress = {
      uid: getUserId() || 'local-offline',
      displayName: data.profile.displayName,
      teamSlots: data.inventory.teamSlots,
      movementSpeedBonus: data.inventory.movementSpeedBonus,
      captureChanceBonus: data.inventory.captureChanceBonus,
      inventoryCapacity: data.inventory.inventoryCapacity,
      creatures,
      inventory,
      activeTeamIds: data.activeTeam.creatureIds,
      selectedMapId: data.activeTeam.selectedMapId as MapId
    };

    // Salvar também no localStorage como backup
    this.saveToStorage(this.progress);

    console.log('[PlayerState] ✅ Dados sincronizados do Firebase');
  }

  /**
   * Verifica se está usando Firebase
   */
  isUsingFirebase(): boolean {
    return this.useFirebase;
  }

  /**
   * Limpa conexão com Firebase
   */
  cleanup(): void {
    if (this.firebaseUnsubscribe) {
      this.firebaseUnsubscribe();
      this.firebaseUnsubscribe = null;
    }
    unsubscribeFromUserData();
  }

  private createDefaultProgress(): PlayerProgress {
    const starter = CREATURES[0];
    const starterInstance: OwnedCreature = {
      instanceId: `starter-${starter.id}`,
      definitionId: starter.id,
      level: 5,
      currentHp: starter.stats.hp,
      experience: 0,
      rank: 1,
      copiesFused: 0,
      totalExpeditionXp: 0,
    };

    const base: PlayerProgress = {
      uid: "local-offline",
      displayName: "Convidado",
      teamSlots: 3,
      movementSpeedBonus: 0,
      captureChanceBonus: 0,
      inventoryCapacity: 50,
      creatures: [starterInstance],
      inventory: [
        { itemId: "poke-ball-basic", quantity: 5 },
        { itemId: "resource-ferro-cristalino", quantity: 4 }
      ],
      activeTeamIds: [starterInstance.instanceId],
      selectedMapId: DEFAULT_MAP_ID
    };

    this.saveToStorage(base);
    return base;
  }

  private loadFromStorage(): PlayerProgress | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PlayerProgress;
    } catch {
      return null;
    }
  }

  private saveToStorage(progress: PlayerProgress) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore
    }
  }

  getProgress(): PlayerProgress {
    return this.progress;
  }

  getSelectedMapId(): MapId {
    return this.progress.selectedMapId ?? DEFAULT_MAP_ID;
  }

  setSelectedMapId(mapId: MapId) {
    this.progress.selectedMapId = mapId;
    this.saveToStorage(this.progress);
  }

  setDisplayName(name: string) {
    this.progress.displayName = name;
    this.saveToStorage(this.progress);
  }

  updateInventory(updater: (entries: PlayerInventoryEntry[]) => PlayerInventoryEntry[]) {
    this.progress.inventory = updater(this.progress.inventory);
    this.saveToStorage(this.progress);
  }

  addItem(itemId: string, quantity: number) {
    this.updateInventory((entries) => {
      const next = [...entries];
      const existing = next.find((e) => e.itemId === itemId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        next.push({ itemId, quantity });
      }
      return next.filter((e) => e.quantity > 0);
    });
  }

  consumeItem(itemId: string, quantity: number): boolean {
    let success = false;
    this.updateInventory((entries) => {
      const next = [...entries];
      const existing = next.find((e) => e.itemId === itemId);
      if (!existing || existing.quantity < quantity) return entries;
      existing.quantity -= quantity;
      success = true;
      return next.filter((e) => e.quantity > 0);
    });
    return success;
  }

  syncFromRemote(progress: PlayerProgress) {
    this.progress = progress;
    this.saveToStorage(progress);
  }

  getItemQuantity(itemId: string): number {
    return this.progress.inventory.find((e) => e.itemId === itemId)?.quantity ?? 0;
  }

  addCreature(definitionId: string, level = 1): OwnedCreature {
    const base = CREATURES.find((c) => c.id === definitionId) ?? CREATURES[0];
    const instance: OwnedCreature = {
      instanceId: `owned-${definitionId}-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`,
      definitionId: base.id,
      level,
      currentHp: base.stats.hp,
      experience: 0,
      rank: 1,
      copiesFused: 0,
      totalExpeditionXp: 0,
    };

    this.progress.creatures.push(instance);
    if (this.progress.activeTeamIds.length < this.progress.teamSlots) {
      this.progress.activeTeamIds.push(instance.instanceId);
    }
    this.saveToStorage(this.progress);
    return instance;
  }

  /**
   * Atualiza o time ativo do jogador, garantindo que:
   * - todos os IDs existem na lista de criaturas possuídas
   * - não há duplicados
   * - o tamanho não ultrapassa o número de slots disponíveis
   * - se o array estiver vazio, mantém o primeiro slot com alguma criatura existente (se houver)
   */
  setActiveTeam(instanceIds: string[]) {
    const ownedIds = new Set(this.progress.creatures.map((c) => c.instanceId));

    // Filtra apenas ids válidos e únicos
    const uniqueFiltered = Array.from(
      new Set(instanceIds.filter((id) => ownedIds.has(id)))
    );

    const maxSlots = this.progress.teamSlots;
    let finalTeam = uniqueFiltered.slice(0, maxSlots);

    // Garante que exista ao menos uma criatura ativa se o jogador tiver criaturas
    if (finalTeam.length === 0 && this.progress.creatures.length > 0) {
      finalTeam = [this.progress.creatures[0].instanceId];
    }

    this.progress.activeTeamIds = finalTeam;
    this.saveToStorage(this.progress);
  }

  /**
   * Aumenta o número de slots de criatura disponíveis na equipe.
   * Usado por upgrades de base via sistema de crafting.
   */
  increaseTeamSlots(amount: number, maxSlots = 6) {
    this.progress.teamSlots = Math.min(
      maxSlots,
      this.progress.teamSlots + amount
    );
    this.saveToStorage(this.progress);
  }

  // ============================================================================
  // SISTEMA DE PROGRESSÃO DE CRIATURAS
  // ============================================================================

  /**
   * Adiciona XP a uma criatura específica e processa level up automático.
   * @returns Objeto com informações do level up (se houver)
   */
  addCreatureXp(
    instanceId: string,
    xpAmount: number
  ): { leveledUp: boolean; oldLevel: number; newLevel: number; xpGained: number } {
    const creature = this.progress.creatures.find(
      (c) => c.instanceId === instanceId
    );
    if (!creature) {
      return { leveledUp: false, oldLevel: 0, newLevel: 0, xpGained: 0 };
    }

    const oldLevel = creature.level;
    creature.experience += xpAmount;
    creature.totalExpeditionXp = (creature.totalExpeditionXp ?? 0) + xpAmount;

    // Processa level ups automáticos
    while (creature.level < LEVEL_CONFIG.maxLevel) {
      const xpNeeded = getXpRequiredForLevel(creature.level + 1);
      if (creature.experience >= xpNeeded) {
        creature.experience -= xpNeeded;
        creature.level += 1;

        // Atualiza HP máximo ao subir de nível
        const effectiveStats = getEffectiveStats(creature);
        creature.currentHp = effectiveStats.hp;
      } else {
        break;
      }
    }

    this.saveToStorage(this.progress);

    return {
      leveledUp: creature.level > oldLevel,
      oldLevel,
      newLevel: creature.level,
      xpGained: xpAmount,
    };
  }

  /**
   * Processa XP de expedição para todas as criaturas da equipe.
   * @returns Map com resultados de XP por criatura
   */
  processExpeditionXp(
    params: ExpeditionXpParams
  ): Map<string, { leveledUp: boolean; oldLevel: number; newLevel: number; xpGained: number }> {
    const xpByCreature = calculateExpeditionXp(params);
    const results = new Map<
      string,
      { leveledUp: boolean; oldLevel: number; newLevel: number; xpGained: number }
    >();

    for (const [creatureId, xp] of xpByCreature.entries()) {
      const result = this.addCreatureXp(creatureId, xp);
      results.set(creatureId, result);
    }

    return results;
  }

  /**
   * Conta quantas cópias de uma mesma espécie o jogador possui.
   * Exclui a criatura principal (instanceId) da contagem.
   */
  countCreatureCopies(
    definitionId: string,
    excludeInstanceId?: string
  ): number {
    return this.progress.creatures.filter(
      (c) =>
        c.definitionId === definitionId &&
        c.instanceId !== excludeInstanceId
    ).length;
  }

  /**
   * Retorna todas as cópias de uma mesma espécie (exceto a principal).
   */
  getCreatureCopies(
    definitionId: string,
    excludeInstanceId?: string
  ): OwnedCreature[] {
    return this.progress.creatures.filter(
      (c) =>
        c.definitionId === definitionId &&
        c.instanceId !== excludeInstanceId
    );
  }

  /**
   * Promove uma criatura para o próximo rank usando cópias.
   * Remove as cópias usadas do inventário de criaturas.
   * @returns true se a promoção foi bem-sucedida
   */
  promoteCreatureRank(instanceId: string): {
    success: boolean;
    newRank?: CreatureRank;
    copiesConsumed?: number;
    error?: string;
  } {
    const creature = this.progress.creatures.find(
      (c) => c.instanceId === instanceId
    );
    if (!creature) {
      return { success: false, error: "Criatura não encontrada" };
    }

    const currentRank: CreatureRank = creature.rank ?? 1;
    if (currentRank >= 5) {
      return { success: false, error: "Criatura já está no rank máximo" };
    }

    const nextRank = (currentRank + 1) as CreatureRank;
    const currentCopiesFused = creature.copiesFused ?? 0;
    const totalCopiesNeeded = RANK_CONFIG[nextRank].copiesRequired;
    const copiesNeeded = totalCopiesNeeded - currentCopiesFused;

    // Busca cópias disponíveis
    const availableCopies = this.getCreatureCopies(
      creature.definitionId,
      instanceId
    );

    if (availableCopies.length < copiesNeeded) {
      return {
        success: false,
        error: `Cópias insuficientes. Necessário: ${copiesNeeded}, disponível: ${availableCopies.length}`,
      };
    }

    // Remove as cópias necessárias
    const copiesToRemove = availableCopies.slice(0, copiesNeeded);
    for (const copy of copiesToRemove) {
      // Remove da equipe ativa se estiver lá
      this.progress.activeTeamIds = this.progress.activeTeamIds.filter(
        (id) => id !== copy.instanceId
      );
      // Remove do array de criaturas
      this.progress.creatures = this.progress.creatures.filter(
        (c) => c.instanceId !== copy.instanceId
      );
    }

    // Atualiza a criatura principal
    creature.rank = nextRank;
    creature.copiesFused = totalCopiesNeeded;

    // Atualiza HP com o novo multiplicador de rank
    const effectiveStats = getEffectiveStats(creature);
    creature.currentHp = effectiveStats.hp;

    this.saveToStorage(this.progress);

    return {
      success: true,
      newRank: nextRank,
      copiesConsumed: copiesNeeded,
    };
  }

  /**
   * Retorna uma criatura pelo instanceId.
   */
  getCreatureByInstanceId(instanceId: string): OwnedCreature | undefined {
    return this.progress.creatures.find((c) => c.instanceId === instanceId);
  }

  /**
   * Restaura o HP de todas as criaturas ao máximo.
   * Útil após retornar à base.
   */
  healAllCreatures() {
    for (const creature of this.progress.creatures) {
      const effectiveStats = getEffectiveStats(creature);
      creature.currentHp = effectiveStats.hp;
    }
    this.saveToStorage(this.progress);
  }
}

export const PlayerState = new PlayerStateManager();

