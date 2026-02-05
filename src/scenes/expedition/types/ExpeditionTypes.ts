import Phaser from "phaser";
import type { ThreatTier, EnemyBehaviorType, EnemyAIState, EnemyBehaviorConfig } from "../../../game/constants";

/**
 * Estados da expedição.
 * TODO(server-authoritative): Em um futuro multiplayer completo,
 * estes estados devem ser validados/controlados pelo servidor.
 */
export type ExpeditionState =
  | "exploring"
  | "combat"
  | "capturing"
  | "extracting"
  | "extracted"
  | "failed";

/**
 * Projétil básico disparado pelo jogador.
 * TODO(server-authoritative): Em multiplayer real, validação de acertos
 * e dano deverá ser feita no servidor.
 */
export interface Projectile {
  sprite: Phaser.GameObjects.Arc;
  lifetime: number;
  // ✅ Adicionar velocidade para atualização manual (sincronização com servidor)
  velocityX?: number;
  velocityY?: number;
}

/**
 * Projétil de pokébola para captura de criaturas.
 * Viaja na direção do mouse e tenta capturar a criatura ao colidir.
 */
export interface PokeballProjectile {
  sprite: Phaser.GameObjects.Arc;
  velocityX: number;
  velocityY: number;
  lifetime: number;
  ballType: "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra";
}

/**
 * Projétil disparado por inimigos ranged.
 * Causa dano ao jogador se colidirem.
 */
export interface EnemyProjectile {
  sprite: Phaser.GameObjects.Arc;
  lifetime: number;
  damage: number;
  velocityX: number;
  velocityY: number;
}

/**
 * Projétil remoto (de outros jogadores ou IA) sincronizado do servidor.
 * Usado para renderização visual apenas - colisões são processadas no servidor.
 */
export interface RemoteProjectileSprite {
  id: string;
  sprite: Phaser.GameObjects.Arc;
  ownerId: string;
  isPlayerProjectile: boolean;
  velocityX: number;
  velocityY: number;
  lifetime: number;
}

/**
 * Habilidades ativas da criatura do jogador.
 * Cada habilidade tem um comportamento específico implementado na cena.
 */
export type SpecialSkillKind = "pyrognat_fire_fog" | "aquaryl_heal_wave" | "voltiger_electric_surge" | "verdant_root_trap";

/**
 * Zona de habilidade especial (ex: nevoeiro incendiário).
 */
export interface SkillZone {
  sprite: Phaser.GameObjects.Arc;
  kind: "fire_fog";
  remaining: number;
  tickTimer: number;
}

/**
 * Telemetria coletada durante a expedição.
 * Usado para análise de balanceamento e debug.
 */
export interface ExpeditionTelemetry {
  expeditionStartTime: number;
  resourcesCollected: number;
  creaturesEncountered: number;
  creaturesCaptured: number;
  captureAttempts: number;
  captureSuccesses: number;
  captureFailures: number;
  extractionSuccess: boolean;
  extractionFailed: boolean;
  timeSpent: number;
  combatEncounters: number;
  damageDealt: number;
  damageTaken: number;
  projectilesFired: number;
  resourcesPerMinute: number;
  creaturesPerMinute: number;
  averageCaptureChance: number;
  totalCaptureChanceSum: number;
}

/**
 * Renderização de um jogador remoto em tempo real.
 * Cada jogador remoto tem um sprite, nome, barra de HP e indicadores visuais.
 * As posições são interpoladas suavemente entre snapshots para melhor UX.
 */
export interface RemotePlayerSprite {
  id: string;
  name: string;
  sprite: Phaser.GameObjects.Arc;
  nameText: Phaser.GameObjects.Text;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarText: Phaser.GameObjects.Text;
  
  // Posições para interpolação suave
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  
  // Estado de HP (recebido do servidor)
  currentHp: number;
  maxHp: number;
  
  // Timestamp do último update recebido (para evitar updates antigos)
  lastUpdate: number;
  
  // Flag para evitar deslizamento inicial
  skipFirstInterpolation: boolean;
  
  // Propriedades visuais (alinhadas com PlayerState)
  color: number; // Cor do sprite (ciano para remotos)
  radius: number; // Tamanho do sprite
  
  // Indicadores visuais de ação
  actionIndicator: Phaser.GameObjects.Arc | null;
  actionType: "idle" | "attacking" | "extracting" | "capturing" | null;
  actionTimer: number;
  
  // ✅ Indicadores visuais de windup
  windupIndicator: Phaser.GameObjects.Arc | null;
  skillWindupIndicator: Phaser.GameObjects.Arc | null;
  windupTimer: number;
  skillWindupTimer: number;
  
  // Visibilidade (culling)
  isVisible: boolean;
}

/**
 * Interface UNIFICADA para todas as criaturas.
 * Serve tanto para criaturas locais (single-player) quanto remotas (multiplayer).
 */
export interface RemoteCreatureSprite {
  id: string;
  sprite: Phaser.GameObjects.Arc;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarText: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  
  // Posições para interpolação
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  
  // Estado de HP e combate
  currentHp: number;
  maxHp: number;
  tier: ThreatTier;
  
  // Flag para evitar deslizamento inicial
  skipFirstInterpolation: boolean;
  
  // Tipo de criatura (para tema visual)
  creatureType?: string;
  speciesId?: string;
  level?: number;
  
  // Propriedades de IA
  behaviorType: EnemyBehaviorType;
  aiState: EnemyAIState;
  aiConfig: EnemyBehaviorConfig;
  attackCooldownRemaining: number;
  windupTimer: number;
  skillWindupTimer?: number; // ✅ Windup de skill de criaturas
  stunTimer: number;
  
  // Visuais de IA
  aggroIndicator: Phaser.GameObjects.Arc | null;
  attackTellIndicator?: Phaser.GameObjects.Arc;
  skillTellIndicator?: Phaser.GameObjects.Arc; // ✅ Indicador visual de windup de skill
  
  // Patrulha
  patrolOrigin: { x: number; y: number };
  patrolTimer: number;
  
  // Estado geral
  state?: string;
}

/**
 * Sprite visual de um recurso (local ou remoto).
 * Unifica recursos locais e remotos com propriedades visuais completas.
 */
export interface RemoteResourceSprite {
  id: string;
  sprite: Phaser.GameObjects.Rectangle; // Losango (rectangle rotacionado 45°)
  
  // Posições para interpolação
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  
  // Identificação
  resourceType: string; // ID do item (ex: "resource-ferro-cristalino")
  amount: number;
  
  // Propriedades visuais
  isRare: boolean;
  
  // Flag para evitar deslizamento inicial
  skipFirstInterpolation: boolean;
  size: number;
  color: number;
  borderColor: number;
  borderWidth: number;
}
