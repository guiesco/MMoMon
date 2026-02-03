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
  normalizeCreatureHp,
} from "./creatureProgression";
import {
  initializeFirebaseClient,
  isFirebaseClientAvailable,
  signInAnonymous,
  getCurrentUser,
  getUserId,
  subscribeToUserData,
  unsubscribeFromUserData,
  onAuthChange,
  type UserData
} from "../services/firebaseClient";
import type { Unsubscribe } from "firebase/firestore";
import type { User } from "firebase/auth";

const LOCAL_STORAGE_KEY = "pokextract_player_progress_v1";

class PlayerStateManager {
  private progress: PlayerProgress;
  private firebaseUnsubscribe: Unsubscribe | null = null;
  private authUnsubscribe: (() => void) | null = null;
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
      // Escutar mudanças de autenticação em tempo real
      onAuthChange(async (user: User | null) => {
        if (user) {
          console.log('[PlayerState] ✅ Usuário autenticado:', user.uid);
          this.useFirebase = true;
          
          // Pequeno delay para garantir que Firebase está pronto
          await new Promise(resolve => setTimeout(resolve, 100));
          
          this.setupFirebaseSync(user.uid);
        } else {
          console.log('[PlayerState] ⚠️  Usuário deslogado');
          this.useFirebase = false;
          if (this.firebaseUnsubscribe) {
            this.firebaseUnsubscribe();
            this.firebaseUnsubscribe = null;
          }
        }
      });

      // Verificar se já há usuário autenticado (caso de refresh da página)
      const currentUser = getCurrentUser();
      if (currentUser) {
        console.log('[PlayerState] ✅ Usuário já autenticado:', currentUser.uid);
        this.useFirebase = true;
        
        // Pequeno delay para garantir que Firebase está pronto
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.setupFirebaseSync(currentUser.uid);
      } else {
        console.log('[PlayerState] ⏳ Aguardando autenticação...');
      }
    } catch (error) {
      console.error('[PlayerState] Erro ao inicializar Firebase:', error);
      this.useFirebase = false;
    }
  }

  /**
   * Configura sincronização em tempo real com Firebase
   */
  private setupFirebaseSync(userId: string): void {
    // Limpar subscription anterior se existir
    if (this.firebaseUnsubscribe) {
      console.log('[PlayerState] 🔄 Limpando subscription anterior');
      this.firebaseUnsubscribe();
      this.firebaseUnsubscribe = null;
    }

    console.log(`[PlayerState] 🔍 Configurando sincronização para usuário ${userId}...`);

    // Escutar mudanças em tempo real
    this.firebaseUnsubscribe = subscribeToUserData(userId, (data) => {
      if (data) {
        console.log('[PlayerState] 📥 Dados recebidos do Firebase - sincronizando...');
        console.log(`[PlayerState] - Criaturas: ${Object.keys(data.creatures || {}).length}`);
        console.log(`[PlayerState] - Itens: ${Object.keys(data.inventory?.items || {}).length}`);
        this.syncFromFirebase(data);
      } else {
        // Primeira vez - migrar dados do localStorage
        console.log('[PlayerState] 📦 Usuário não encontrado no Firebase - primeira vez');
        console.log('[PlayerState] 📦 Iniciando migração de dados do localStorage...');
        this.migrateLocalDataToFirebase(userId);
      }
    });

    if (!this.firebaseUnsubscribe) {
      console.error('[PlayerState] ❌ Falha ao configurar sincronização Firebase');
    } else {
      console.log('[PlayerState] ✅ Sincronização configurada com sucesso');
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
    
    // Criar usuário no Firebase se não existir
    const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3004";
    
    try {
      console.log('[PlayerState] 📝 Criando usuário no Firebase...');
      const response = await fetch(`${SERVER_URL}/api/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          displayName: localData.displayName || 'Convidado'
        })
      });
      
      if (response.ok) {
        console.log('[PlayerState] ✅ Usuário criado no Firebase');
        
        // Atualizar UID para o Firebase
        this.progress.uid = userId;
        
        // Salvar no localStorage com novo UID
        this.saveToStorage(this.progress);
        
        // Aguardar um pouco para garantir que o documento foi criado e o snapshot atualize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Se há dados significativos, sincronizar após criar usuário
        if (hasSignificantData) {
          console.log('[PlayerState] 📤 Sincronizando dados locais para Firebase...');
          console.log(`[PlayerState] - Criaturas: ${localData.creatures.length}`);
          console.log(`[PlayerState] - Itens: ${localData.inventory.length}`);
          console.log(`[PlayerState] - Nome: ${localData.displayName}`);
          
          // Sincronizar dados locais via servidor
          const { syncPlayerStateToServer } = await import('../services/firebaseSync');
          await syncPlayerStateToServer();
        } else {
          // Mesmo sem dados significativos, aguardar snapshot atualizar
          // O onSnapshot vai disparar quando o documento for criado
          console.log('[PlayerState] ℹ️  Aguardando snapshot atualizar com dados do Firebase...');
        }
      } else {
        const errorText = await response.text();
        console.error('[PlayerState] ❌ Erro ao criar usuário:', errorText);
      }
    } catch (error) {
      console.error('[PlayerState] ❌ Erro ao criar usuário:', error);
    }
  }

  /**
   * Sincroniza dados do Firebase para o estado local
   */
  private syncFromFirebase(data: UserData): void {
    console.log('[PlayerState] 📥 Sincronizando dados do Firebase...');
    const creaturesData = data.creatures || {};
    const creaturesCount = Object.keys(creaturesData).length;
    console.log(`[PlayerState] 📥 Criaturas recebidas do Firebase: ${creaturesCount}`);
    console.log(`[PlayerState] 📥 IDs das criaturas:`, Object.keys(creaturesData));
    
    // Log detalhado de cada criatura recebida
    if (creaturesCount > 0) {
      console.log('[PlayerState] 📥 Detalhes das criaturas recebidas:');
      Object.entries(creaturesData).forEach(([id, c]: [string, any]) => {
        console.log(`[PlayerState] 📥   - ${id}: ${c.definitionId} (nível ${c.level}, rank ${c.rank || 1})`);
      });
    }

    // Converter formato Firebase para PlayerProgress
    let creatures: OwnedCreature[] = Object.values(creaturesData).map((c: any) => {
      if (!c.instanceId || !c.definitionId) {
        console.warn('[PlayerState] ⚠️  Criatura inválida encontrada:', c);
        return null;
      }
      
      const creature: OwnedCreature = {
        instanceId: c.instanceId,
        definitionId: c.definitionId,
        level: c.level || 1,
        currentHp: c.currentHp || c.maxHp || 80,
        experience: c.experience || 0,
        rank: c.rank || 1,
        copiesFused: c.copiesFused || 0,
        totalExpeditionXp: c.totalExpeditionXp || 0
      };
      // Normalizar HP ao carregar do Firebase
      creature.currentHp = normalizeCreatureHp(creature);
      return creature;
    }).filter((c): c is OwnedCreature => c !== null); // Filtrar criaturas inválidas

    // Se não houver criaturas, criar starter (fallback de segurança)
    if (creatures.length === 0) {
      console.log('[PlayerState] ⚠️  Nenhuma criatura encontrada - criando starter...');
      const starter = CREATURES[0];
      const starterInstance: OwnedCreature = {
        instanceId: `starter-${starter.id}-${Date.now()}`,
        definitionId: starter.id,
        level: 5,
        currentHp: starter.stats.hp, // Será normalizado abaixo
        experience: 0,
        rank: 1,
        copiesFused: 0,
        totalExpeditionXp: 0,
      };
      // Normalizar HP usando getEffectiveStats
      starterInstance.currentHp = normalizeCreatureHp(starterInstance);
      creatures = [starterInstance];
    }

    const inventory: PlayerInventoryEntry[] = Object.entries(data.inventory.items || {}).map(
      ([itemId, quantity]) => ({ itemId, quantity: quantity as number })
    );

    // Garantir que há pelo menos 5 pokébolas básicas (fallback)
    const hasPokeballs = inventory.some(item => item.itemId === 'poke-ball-basic');
    if (!hasPokeballs) {
      console.log('[PlayerState] ⚠️  Nenhuma pokébola encontrada - adicionando 5 básicas...');
      inventory.push({ itemId: 'poke-ball-basic', quantity: 5 });
    }

    // Garantir que há pelo menos uma criatura no time ativo
    let activeTeamIds = data.activeTeam.creatureIds || [];
    if (activeTeamIds.length === 0 && creatures.length > 0) {
      console.log('[PlayerState] ⚠️  Time vazio - adicionando primeira criatura...');
      activeTeamIds = [creatures[0].instanceId];
    }

    // Converter preparedExpeditionInventory do Firebase (se existir)
    const preparedExpeditionInventory: PlayerInventoryEntry[] = 
      data.preparedExpeditionInventory 
        ? Object.entries(data.preparedExpeditionInventory).map(
            ([itemId, quantity]) => ({ itemId, quantity: quantity as number })
          )
        : [];

    this.progress = {
      uid: getUserId() || 'local-offline',
      displayName: data.profile.displayName,
      teamSlots: data.inventory.teamSlots || 3,
      movementSpeedBonus: data.inventory.movementSpeedBonus || 0,
      captureChanceBonus: data.inventory.captureChanceBonus || 0,
      inventoryCapacity: data.inventory.inventoryCapacity || 50,
      creatures,
      inventory,
      activeTeamIds,
      selectedMapId: (data.activeTeam.selectedMapId as MapId) || DEFAULT_MAP_ID,
      preparedExpeditionInventory
    };

    // Salvar também no localStorage como backup
    this.saveToStorage(this.progress);

    console.log('[PlayerState] ✅ Dados sincronizados do Firebase');
    console.log(`[PlayerState] - Criaturas: ${creatures.length} (esperado: ${creaturesCount})`);
    if (creatures.length !== creaturesCount) {
      console.warn(`[PlayerState] ⚠️  DISCREPÂNCIA: Recebidas ${creaturesCount} criaturas do Firebase, mas apenas ${creatures.length} foram processadas`);
      const receivedIds = Object.keys(creaturesData);
      const processedIds = creatures.map(c => c.instanceId);
      const missingIds = receivedIds.filter(id => !processedIds.includes(id));
      if (missingIds.length > 0) {
        console.warn(`[PlayerState] ⚠️  IDs não processados:`, missingIds);
      }
    }
    console.log(`[PlayerState] - IDs das criaturas sincronizadas:`, creatures.map(c => c.instanceId));
    console.log(`[PlayerState] - Itens: ${inventory.length}`);
    console.log(`[PlayerState] - Time ativo: ${activeTeamIds.length} criaturas`);
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
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }
    unsubscribeFromUserData();
  }

  private createDefaultProgress(): PlayerProgress {
    const starter = CREATURES[0];
    const starterInstance: OwnedCreature = {
      instanceId: `starter-${starter.id}`,
      definitionId: starter.id,
      level: 5,
      currentHp: starter.stats.hp, // Será normalizado abaixo
      experience: 0,
      rank: 1,
      copiesFused: 0,
      totalExpeditionXp: 0,
    };
    
    // Normalizar HP usando getEffectiveStats
    starterInstance.currentHp = normalizeCreatureHp(starterInstance);

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
      selectedMapId: DEFAULT_MAP_ID,
      preparedExpeditionInventory: [] // Inicializa vazio
    };

    this.saveToStorage(base);
    return base;
  }

  private loadFromStorage(): PlayerProgress | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return null;
      const progress = JSON.parse(raw) as PlayerProgress;
      
      // Normalizar HP de todas as criaturas ao carregar do localStorage
      if (progress.creatures) {
        progress.creatures.forEach(creature => {
          creature.currentHp = normalizeCreatureHp(creature);
        });
      }
      
      // Garantir que preparedExpeditionInventory existe
      if (!progress.preparedExpeditionInventory) {
        progress.preparedExpeditionInventory = [];
      }
      
      return progress;
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
      currentHp: base.stats.hp, // Será normalizado abaixo
      experience: 0,
      rank: 1,
      copiesFused: 0,
      totalExpeditionXp: 0,
    };

    // Normalizar HP usando getEffectiveStats
    instance.currentHp = normalizeCreatureHp(instance);

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
        // Antes de subir de nível, calcular HP atual proporcionalmente
        const oldEffectiveStats = getEffectiveStats(creature);
        const oldMaxHp = oldEffectiveStats.hp;
        const hpRatio = oldMaxHp > 0 ? creature.currentHp / oldMaxHp : 1;

        creature.experience -= xpNeeded;
        creature.level += 1;

        // Atualiza HP proporcionalmente ao novo maxHp
        const newEffectiveStats = getEffectiveStats(creature);
        const newMaxHp = newEffectiveStats.hp;
        creature.currentHp = Math.floor(newMaxHp * hpRatio);
        
        // Garantir que HP não ultrapasse o máximo
        creature.currentHp = Math.min(creature.currentHp, newMaxHp);
      } else {
        break;
      }
    }
    
    // Normalizar HP após processar level ups (garantir que está dentro do range válido)
    creature.currentHp = normalizeCreatureHp(creature);

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

    // Antes de promover, calcular HP atual proporcionalmente
    const oldEffectiveStats = getEffectiveStats(creature);
    const oldMaxHp = oldEffectiveStats.hp;
    const hpRatio = oldMaxHp > 0 ? creature.currentHp / oldMaxHp : 1;

    // Atualiza a criatura principal
    creature.rank = nextRank;
    creature.copiesFused = totalCopiesNeeded;

    // Atualiza HP proporcionalmente ao novo maxHp
    const newEffectiveStats = getEffectiveStats(creature);
    const newMaxHp = newEffectiveStats.hp;
    creature.currentHp = Math.floor(newMaxHp * hpRatio);
    
    // Normalizar HP para garantir que está dentro do range válido
    creature.currentHp = normalizeCreatureHp(creature);

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

  // ============================================================================
  // GERENCIAMENTO DE INVENTÁRIO PREPARADO PARA EXPEDIÇÃO
  // ============================================================================

  /**
   * Retorna o inventário preparado para expedição.
   */
  getPreparedExpeditionInventory(): PlayerInventoryEntry[] {
    return this.progress.preparedExpeditionInventory || [];
  }

  /**
   * Adiciona um item ao inventário preparado para expedição.
   */
  addToPreparedExpeditionInventory(itemId: string, quantity: number): boolean {
    if (!this.progress.preparedExpeditionInventory) {
      this.progress.preparedExpeditionInventory = [];
    }

    // Verifica se o jogador tem o item no inventário permanente
    const availableQuantity = this.getItemQuantity(itemId);
    if (availableQuantity < quantity) {
      return false; // Não tem quantidade suficiente
    }

    const existing = this.progress.preparedExpeditionInventory.find(e => e.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.progress.preparedExpeditionInventory.push({ itemId, quantity });
    }

    this.saveToStorage(this.progress);
    return true;
  }

  /**
   * Remove um item do inventário preparado para expedição.
   */
  removeFromPreparedExpeditionInventory(itemId: string, quantity: number): boolean {
    if (!this.progress.preparedExpeditionInventory) {
      return false;
    }

    const existing = this.progress.preparedExpeditionInventory.find(e => e.itemId === itemId);
    if (!existing || existing.quantity < quantity) {
      return false; // Não tem quantidade suficiente
    }

    existing.quantity -= quantity;
    if (existing.quantity <= 0) {
      this.progress.preparedExpeditionInventory = this.progress.preparedExpeditionInventory.filter(
        e => e.itemId !== itemId
      );
    }

    this.saveToStorage(this.progress);
    return true;
  }

  /**
   * Transfere um item do inventário permanente para o preparado (ou vice-versa).
   * @param itemId - ID do item
   * @param quantity - Quantidade a transferir
   * @param toPrepared - true para transferir para preparado, false para retornar ao permanente
   */
  transferItem(itemId: string, quantity: number, toPrepared: boolean): boolean {
    if (toPrepared) {
      // Transferir do permanente para preparado
      if (!this.consumeItem(itemId, quantity)) {
        return false; // Não tem quantidade suficiente no permanente
      }
      return this.addToPreparedExpeditionInventory(itemId, quantity);
    } else {
      // Retornar do preparado para permanente
      if (!this.removeFromPreparedExpeditionInventory(itemId, quantity)) {
        return false; // Não tem quantidade suficiente no preparado
      }
      this.addItem(itemId, quantity);
      return true;
    }
  }

  /**
   * Limpa o inventário preparado (retorna todos os itens ao permanente).
   */
  clearPreparedExpeditionInventory(): void {
    if (!this.progress.preparedExpeditionInventory) {
      return;
    }

    // Retorna todos os itens ao inventário permanente
    for (const entry of this.progress.preparedExpeditionInventory) {
      this.addItem(entry.itemId, entry.quantity);
    }

    this.progress.preparedExpeditionInventory = [];
    this.saveToStorage(this.progress);
  }

  /**
   * Obtém a quantidade de um item no inventário preparado.
   */
  getPreparedItemQuantity(itemId: string): number {
    if (!this.progress.preparedExpeditionInventory) {
      return 0;
    }
    return this.progress.preparedExpeditionInventory.find(e => e.itemId === itemId)?.quantity ?? 0;
  }
}

export const PlayerState = new PlayerStateManager();

