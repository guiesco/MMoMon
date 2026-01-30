export type ElementType =
  | "Fogo"
  | "Água"
  | "Planta"
  | "Elétrico"
  | "Psíquico"
  | "Terrestre"
  | "Voador"
  | "Lutador";

export interface CreatureStats {
  hp: number;
  moveSpeed: number;
  defense: number;
  attackDamage: number;
  skillCooldown: number;
}

export interface BasicAttack {
  name: string;
  description: string;
  range: number;
  damage: number;
  cooldown: number;
  isProjectile: boolean;
}

export interface SpecialSkill {
  name: string;
  description: string;
  cooldown: number;
}

export interface CreatureDefinition {
  id: string;
  name: string;
  primaryType: ElementType;
  secondaryType?: ElementType;
  stats: CreatureStats;
  basicAttack: BasicAttack;
  specialSkill: SpecialSkill;
  evolutionChain?: string[];
}

export type ItemTier = "Básico" | "Avançado" | "Épico" | "Lendário";

export type ItemKind =
  | "capture_tool"
  | "evolution_item"
  | "consumable"
  | "raw_resource"
  | "base_upgrade";

export interface ItemDefinition {
  id: string;
  name: string;
  kind: ItemKind;
  tier: ItemTier;
  description: string;
}

export interface CraftingIngredient {
  itemId: string;
  quantity: number;
}

export interface CraftingRecipe {
  id: string;
  resultItemId: string;
  timeSeconds: number;
  ingredients: CraftingIngredient[];
}

export interface PlayerInventoryEntry {
  itemId: string;
  quantity: number;
}

/**
 * Rank de estrelas da criatura, aumentado através de fusão de cópias.
 * Cada rank aumenta os multiplicadores de stats base.
 */
export type CreatureRank = 1 | 2 | 3 | 4 | 5;

/**
 * Representa uma criatura possuída pelo jogador.
 * Contém dados de progressão: nível, XP, rank e bônus acumulados.
 */
export interface OwnedCreature {
  instanceId: string;
  definitionId: string;
  nickname?: string;
  /** Nível atual da criatura (1-50) */
  level: number;
  /** HP atual (pode estar reduzido após combate) */
  currentHp: number;
  /** XP acumulado no nível atual */
  experience: number;
  /** 
   * Rank de estrelas (1-5), aumentado via fusão de cópias.
   * Default: 1
   */
  rank?: CreatureRank;
  /**
   * Quantidade de cópias sacrificadas para este rank.
   * Usado para tracking de progresso de fusão.
   */
  copiesFused?: number;
  /**
   * Total de XP ganho em todas as expedições (para stats/tracking)
   */
  totalExpeditionXp?: number;
}

import type { MapId } from "./maps";

export interface PlayerProgress {
  uid: string;
  displayName: string | null;
  teamSlots: number;
  movementSpeedBonus: number;
  captureChanceBonus: number;
  inventoryCapacity: number;
  creatures: OwnedCreature[];
  inventory: PlayerInventoryEntry[];
  activeTeamIds: string[]; // instanceIds
  /** Último mapa/bioma selecionado para expedições */
  selectedMapId?: MapId;
}

