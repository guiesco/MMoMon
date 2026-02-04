/**
 * Tipos TypeScript para estrutura de dados do Firestore
 * 
 * Estrutura:
 * - users/{userId}: Dados do jogador
 * - expeditions/{expeditionId}: Histórico de expedições
 */

// ============================================================================
// USER DOCUMENT
// ============================================================================

export interface UserProfile {
  displayName: string;
  createdAt: Date;
  lastLogin: Date;
  totalPlayTime: number; // em segundos
}

export interface UserInventory {
  items: Record<string, number>; // itemId -> quantity
  teamSlots: number;
  movementSpeedBonus: number;
  captureChanceBonus: number;
  inventoryCapacity: number;
}

export interface UserCreature {
  instanceId: string;
  definitionId: string; // ex: "pyrognat"
  level: number;
  currentHp: number;
  maxHp: number;
  experience: number;
  rank: number; // 1-5 (estrelas)
  copiesFused: number;
  totalExpeditionXp: number;
  capturedAt: Date;
}

export interface UserActiveTeam {
  creatureIds: string[]; // array de instanceIds
  selectedMapId: string;
}

export interface UserStats {
  expeditionsCompleted: number;
  expeditionsFailed: number;
  totalResourcesCollected: number;
  totalCreaturesCaptured: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
}

export interface UserDocument {
  profile: UserProfile;
  inventory: UserInventory;
  creatures: Record<string, UserCreature>; // instanceId -> creature
  activeTeam: UserActiveTeam;
  stats: UserStats;
  /** Inventário preparado para expedição (mochila) - itemId -> quantity */
  preparedExpeditionInventory?: Record<string, number>;
}

// ============================================================================
// EXPEDITION DOCUMENT (Histórico)
// ============================================================================

export interface ExpeditionRewards {
  resources: Record<string, number>; // itemId -> quantity
  creatures: UserCreature[]; // criaturas capturadas nesta expedição
}

export interface ExpeditionStats {
  damageDealt: number;
  damageTaken: number;
  resourcesCollected: number;
  creaturesCaptured: number;
}

export interface ExpeditionDocument {
  userId: string;
  mapId: string;
  startedAt: Date;
  completedAt: Date | null;
  success: boolean;
  duration: number; // em milissegundos
  rewards: ExpeditionRewards;
  stats: ExpeditionStats;
}

// ============================================================================
// HELPER TYPES (para operações)
// ============================================================================

/**
 * Dados necessários para salvar uma expedição completa
 */
export interface SaveExpeditionData {
  userId: string;
  mapId: string;
  startedAt: Date;
  duration: number;
  success: boolean;
  rewards: {
    resources: Map<string, number>;
    capturedCreatures: Array<{
      definitionId: string;
      level: number;
      currentHp: number;
      maxHp: number;
    }>;
  };
  stats: {
    damageDealt: number;
    damageTaken: number;
    resourcesCollected: number;
    creaturesCaptured: number;
  };
  /** XP ganho por cada criatura da equipe (instanceId -> xp) */
  xpByCreature?: Map<string, number>;
}

/**
 * Dados iniciais para criar um novo usuário
 */
export interface CreateUserData {
  displayName: string;
  initialTeamSlots?: number;
  initialInventoryCapacity?: number;
}
