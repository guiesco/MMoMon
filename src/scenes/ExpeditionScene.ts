import Phaser from "phaser";
import { PlayerState as LocalPlayerState } from "../game/playerState";
import { getCreatureById } from "../game/creatures";
import { getItemById } from "../game/items";
import { getCreatureTheme, type CreatureTheme } from "../game/creatureThemes";
import { getUserId } from "../services/firebaseClient";
import {
  type ExpeditionXpParams,
  formatXp,
  getRankDisplay,
  getEffectiveStats,
} from "../game/creatureProgression";
import {
  MultiplayerClient,
  type RemotePlayer,
  type RemoteCreature,
  type AttackResult,
  type CaptureResult,
  type RemoteResource,
  type ExtractionState,
  type MatchEvent,
  type MatchState,
  type PlayerDeath
} from "../services/multiplayerClient";
import {
  EXPEDITION_DURATION_SECONDS,
  EXTRACTION_REQUIRED_SECONDS,
  WILD_CREATURE_CONFIG,
  RESOURCE_CONFIG,
  COMBAT_CONFIG,
  CAPTURE_CONFIG,
  CAPTURE_BALL_MODIFIERS,
  CAPTURE_CREATURE_POOL,
  THREAT_TIERS,
  type ThreatTier,
  BIOME_RESOURCES,
  ENEMY_AI_CONFIG,
  ENEMY_RANGED_SPAWN_CHANCE,
  ENEMY_VISUAL_CONFIG,
  type EnemyBehaviorType,
  type EnemyAIState,
  type EnemyBehaviorConfig,
  GREED_RISK_CONFIG,
  ELEMENTAL_SYNERGIES,
  type ElementalSynergyType,
  type ElementalSynergyConfig
} from "../game/constants";
import { getMapConfig, normalizeMapId, type MapConfig } from "../game/maps";
import type { CreatureDefinition } from "../game/types";
import { getResourcePickupColors, getItemVisuals, QUICK_COLORS } from "../game/itemVisuals";
import { HPBarManager } from "../game/hpBars";
import { 
  type GameWorldState, 
  RemoteWorldState,
  type CreatureState,
  type ResourceState,
  type PlayerState
} from "../game/worldState";

import type { 
  ExpeditionState, 
  ExpeditionTelemetry,
  RemotePlayerSprite,
  RemoteCreatureSprite,
  RemoteResourceSprite,
  Projectile,
  EnemyProjectile,
  PokeballProjectile,
  RemoteProjectileSprite,
  SpecialSkillKind,
  SkillZone
} from "./expedition/types/ExpeditionTypes";
import { FeedbackManager } from "./expedition/ui/FeedbackManager";
import { LoadingOverlay } from "./expedition/ui/LoadingOverlay";
import { MinimapManager } from "./expedition/managers/MinimapManager";
import { HUDManager } from "./expedition/ui/HUDManager";
import { ExtractionUI } from "./expedition/ui/ExtractionUI";
import { SkillCooldownUI } from "./expedition/ui/SkillCooldownUI";
import { DebugPanel } from "./expedition/ui/DebugPanel";
import { SpriteManager } from "./expedition/managers/SpriteManager";
import { ProjectileManager } from "./expedition/managers/ProjectileManager";
import { SkillZoneManager } from "./expedition/managers/SkillZoneManager";
import { CaptureSystem } from "./expedition/systems/CaptureSystem";
import { ExtractionSystem } from "./expedition/systems/ExtractionSystem";
import { MovementSystem } from "./expedition/systems/MovementSystem";
import { SkillSystem } from "./expedition/systems/SkillSystem";
import { MultiplayerHandlers } from "./expedition/handlers/MultiplayerHandlers";
import { SceneInitializer } from "./expedition/initialization/SceneInitializer";

/**
 * TODO(server-authoritative):
 * Spawns, HP, dano e morte de criaturas hoje são calculados apenas no cliente.
 * No modelo final, a fonte de verdade para estas entidades deve ser o servidor,
 * com o cliente apenas apresentando/interpolando.
 */

export class ExpeditionScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private extractKey!: Phaser.Input.Keyboard.Key;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private captureKey!: Phaser.Input.Keyboard.Key;
  private skillKey!: Phaser.Input.Keyboard.Key;
  private healKey!: Phaser.Input.Keyboard.Key;
  private speed = 220;

  private extractionZone!: Phaser.GameObjects.Rectangle;
  private extractionZoneOutline!: Phaser.GameObjects.Rectangle;
  private extractionProgress = 0;
  private extractionRequired = EXTRACTION_REQUIRED_SECONDS;
  private isExtractionRequestSent = false; // Flag para controlar envio único do pedido
  private serverExtractionPointId: string | null = null; // ID do ponto de extração do servidor

  /**
   * Timer de expedição.
   * Sempre sincronizado com o servidor (multiplayer-first).
   */
  private expeditionTime = 0;
  private expeditionDuration = EXPEDITION_DURATION_SECONDS;
  private useServerTimer = false; // Flag para saber se está usando timer do servidor
  private lastMatchState: MatchState | null = null; // Último estado do match recebido do servidor

  /**
   * TODO(server-authoritative):
   * Recursos coletados e criaturas capturadas são contados só no cliente.
   * No futuro, o servidor deve calcular/persistir e enviar o resumo ao final.
   */
  private resourcesCollected = 0;
  private creaturesCaptured = 0;

  /**
   * Inventário de expedição atual (rastreado localmente durante a expedição).
   * Inicializado com preparedExpeditionInventory e atualizado quando pokébolas são consumidas.
   */
  private expeditionInventory: Map<string, number> = new Map();

  private state: ExpeditionState = "exploring";
  private endSceneTimer = 0;
  private endSceneDelay = 3; // segundos antes de voltar à base após término

  private hudText!: Phaser.GameObjects.Text;
  private timeWarningIndicator!: Phaser.GameObjects.Rectangle;
  private dangerRing!: Phaser.GameObjects.Arc;
  private mapConfig!: MapConfig;

  /**
   * Estado unificado do mundo (multiplayer-first).
   * Gerencia criaturas, recursos, jogadores e pontos de extração.
   * Sempre usa RemoteWorldState - o servidor é a fonte de verdade.
   */
  private worldState!: GameWorldState;

  /**
   * ✅ BUG FIX: Armazena posições de criaturas quando tentamos capturá-las.
   * Usado como fallback quando recebemos o resultado de captura e a criatura já foi removida.
   */
  private captureAttemptPositions = new Map<string, { x: number; y: number }>();
  
  /**
   * Map de sprites visuais para criaturas do worldState.
   * Chave: ID da criatura, Valor: sprite e visuais associados
   */
  private creatureSprites: Map<string, RemoteCreatureSprite> = new Map();
  
  /**
   * Map de sprites visuais para recursos do worldState.
   * Chave: ID do recurso, Valor: sprite e propriedades visuais
   */
  private resourceSprites: Map<string, RemoteResourceSprite> = new Map();
  
  /**
   * Set de IDs de recursos que já tiveram o intent de coleta enviado ao servidor.
   * Usado para evitar enviar múltiplos intents para o mesmo recurso.
   */
  private resourceIntentsSent: Set<string> = new Set();

  /**
   * Projéteis locais do jogador.
   * TODO(server-sync): Em um PvP ou coop real, precisariam ser derivados de eventos de ataque vindos do servidor.
   */
  private projectiles: Projectile[] = [];

  /**
   * Projéteis disparados por inimigos ranged.
   * Causa dano ao jogador se colidirem.
   */
  private enemyProjectiles: EnemyProjectile[] = [];

  /**
   * Projéteis remotos (de outros jogadores ou IA) sincronizados do servidor.
   * Usados para renderização visual - colisões são processadas no servidor.
   */
  private remoteProjectiles: Map<string, RemoteProjectileSprite> = new Map();

  /**
   * Skill zones remotas sincronizadas do servidor.
   * Renderizadas visualmente - dano é processado no servidor.
   */
  private remoteSkillZones: Map<string, Phaser.GameObjects.Arc> = new Map();

  /**
   * Projéteis de pokébola para captura à distância.
   * Disparados na direção do mouse e tentam capturar ao colidir.
   */
  private pokeballProjectiles: PokeballProjectile[] = [];

  /**
   * Recursos coletados nesta expedição, separados por tipo de item.
   * O depósito efetivo no inventário permanente só acontece na extração.
   */
  private expeditionResources: Map<string, number> = new Map();
  
  // Telemetria e balanceamento
  /**
   * TODO(persistência-servidor):
   * Telemetria atualmente é apenas log em console.
   * Quando houver backend completo, estes dados devem ser enviados para o servidor
   * ao final da expedição.
   */
  private telemetry: ExpeditionTelemetry = {
    expeditionStartTime: 0,
    resourcesCollected: 0,
    creaturesEncountered: 0,
    creaturesCaptured: 0,
    captureAttempts: 0,
    captureSuccesses: 0,
    captureFailures: 0,
    extractionSuccess: false,
    extractionFailed: false,
    timeSpent: 0,
    combatEncounters: 0,
    damageDealt: 0,
    damageTaken: 0,
    projectilesFired: 0,
    resourcesPerMinute: 0,
    creaturesPerMinute: 0,
    averageCaptureChance: 0,
    totalCaptureChanceSum: 0
  };

  // Painel de debug
  private debugPanelVisible = false;
  private debugPanelKey!: Phaser.Input.Keyboard.Key;
  private debugPanelText!: Phaser.GameObjects.Text;

  /**
   * TODO(server-authoritative):
   * HP da equipe é reduzido apenas no cliente.
   * Em multiplayer, o servidor deve ser a fonte de verdade para vida/dano.
   */
  private activeCreatureHp = 0;
  private activeCreatureMaxHp = 0;
  private activeCreatureIndex = 0;
  private activeCreatureInstanceId: string | null = null;
  private activeTeamIds: string[] = [];
  private creatureHpByInstance: Map<string, number> = new Map();
  private basicAttackCooldown = 0;
  private basicAttackCooldownTime = 0.8;

  // Controle de dano recebido do jogador
  private damageTakenRecently = 0;
  private damageTakenDecayTimer = 0;
  private readonly dangerLowHpThreshold = 0.3; // 30% do HP
  private specialSkillCooldown = 0;
  private specialSkillCooldownTime = 0;
  private activeCreatureDef: CreatureDefinition | null = null;
  private activeSpecialSkillKind: SpecialSkillKind | null = null;
  private activeSpecialSkillName = "Habilidade Especial";
  private activeCreatureTheme: CreatureTheme | null = null;

  // UI de cooldown da skill
  private skillCooldownBarBg!: Phaser.GameObjects.Rectangle;
  private skillCooldownBarFill!: Phaser.GameObjects.Rectangle;
  private skillCooldownText!: Phaser.GameObjects.Text;

  // Áreas persistentes de habilidade (ex: nevoeiro incendiário)
  private skillZones: SkillZone[] = [];

  // ============================================================================
  // MECÂNICAS AVANÇADAS
  // ============================================================================

  /**
   * Tier atual de "Carga Valiosa" (Greed Risk).
   * 0 = normal, 1 = carregando bastante, 2 = muito carregado
   */
  private greedTier = 0;
  /** Anel visual de brilho quando carregado */
  private greedGlowRing: Phaser.GameObjects.Arc | null = null;
  /** Velocidade base da criatura ativa (sem modificadores de carga) */
  private baseSpeed = 220;

  /**
   * Buffs ativos de sinergia elemental.
   * Cada entrada mapeia o tipo de buff para seu tempo restante e valor.
   */
  private activeSynergyBuffs: Map<ElementalSynergyType, { value: number; remaining: number }> = new Map();

  private mpClient: MultiplayerClient | null = null;
  private clientId: string | null = null; // ID do cliente local para filtrar da lista de remotos
  
  /**
   * Mapa de jogadores remotos com estrutura completa para renderização.
   * Inclui sprites, nomes, HP bars e interpolação de posição.
   * Key: player ID, Value: RemotePlayerSprite completo
   */
  private playerSprites: Map<string, RemotePlayerSprite> = new Map();
  
  /**
   * Limite de distância (pixels) para renderizar jogadores remotos.
   * Jogadores muito distantes não são renderizados (otimização de performance).
   */
  private readonly remotePlayerRenderDistance = 800;

  
  private teamSwitchKeys: Phaser.Input.Keyboard.Key[] = [];
  
  // ============================================================================
  // SISTEMA DE PROGRESSÃO DE CRIATURAS
  // ============================================================================
  
  /**
   * Tempo ativo (em segundos) de cada criatura durante a expedição.
   * Usado para calcular XP proporcional ao tempo em campo.
   */
  private activeTimeByCreature: Map<string, number> = new Map();
  /**
   * Contador de criaturas derrotadas nesta expedição.
   * Usado para cálculo de XP compartilhado.
   */
  private creaturesDefeatedCount = 0;
  /**
   * Flag para indicar se o XP já foi processado (evita duplicação).
   */
  private xpProcessed = false;
  
  // Minimapa
  private minimapContainer!: Phaser.GameObjects.Container;
  private minimapPlayerDot!: Phaser.GameObjects.Arc;
  private minimapExtractionDot!: Phaser.GameObjects.Arc;
  private minimapBg!: Phaser.GameObjects.Rectangle;
  private minimapBorder!: Phaser.GameObjects.Rectangle;
  private readonly minimapWidth = 140;
  private readonly minimapHeight = 100;
  
  // Sistema de barras de HP
  private hpBarManager!: HPBarManager;
  /** Flag para indicar que o jogador tomou dano recentemente (para efeito visual) */
  private playerTookDamageThisFrame = false;

  // ============================================================================
  // Sistemas Modulares
  // ============================================================================
  
  private feedbackManager!: FeedbackManager;
  private loadingOverlay!: LoadingOverlay;
  private minimapManager!: MinimapManager;
  private hudManager!: HUDManager;
  private extractionUI!: ExtractionUI;
  private skillCooldownUI!: SkillCooldownUI;
  private debugPanel!: DebugPanel;
  private spriteManager!: SpriteManager;
  private projectileManager!: ProjectileManager;
  private skillZoneManager!: SkillZoneManager;
  private captureSystem!: CaptureSystem;
  private extractionSystem!: ExtractionSystem;
  private movementSystem!: MovementSystem;
  private skillSystem!: SkillSystem;
  private multiplayerHandlers!: MultiplayerHandlers;
  private sceneInitializer!: SceneInitializer;
  /**
   * TODO(networking):
   * Para o MVP multiplayer apenas presença/posição é sincronizada.
   * Em iterações futuras, ataques, dano, captura e extração deverão
   * ser enviados como eventos discretos para o servidor.
   * A ideia é que toda integração WebSocket da expedição passe por
   * uma camada fina de adapter (`MultiplayerClient`) ao invés de
   * espalhar JSONs brutos pela cena.
   */

  constructor() {
    super("ExpeditionScene");
  }

  create(data?: { selectedItems?: Record<string, number> }) {
    // Reset de estado para cada nova expedição
    this.state = "exploring";
    this.expeditionTime = 0;
    this.endSceneTimer = 0;
    this.extractionProgress = 0;
    this.isExtractionRequestSent = false;
    this.resourcesCollected = 0;
    this.creaturesCaptured = 0;
    this.resourceIntentsSent.clear();
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.expeditionResources = new Map();
    
    // Itens selecionados para expedição (vindos da cena de seleção)
    const selectedItems = data?.selectedItems || {};
    
    // Inicializar inventário de expedição com preparedExpeditionInventory
    this.expeditionInventory.clear();
    const playerProgress = LocalPlayerState.getProgress();
    const preparedInventory = playerProgress.preparedExpeditionInventory || [];
    for (const entry of preparedInventory) {
      this.expeditionInventory.set(entry.itemId, entry.quantity);
    }
    console.log(`[ExpeditionScene] 📦 Inventário de expedição inicializado:`, Array.from(this.expeditionInventory.entries()));
    
    // Arquitetura multiplayer-first: sempre usa RemoteWorldState
    // O servidor é sempre a fonte de verdade para o estado do mundo
    this.worldState = new RemoteWorldState();
    console.log("[ExpeditionScene] Usando RemoteWorldState (multiplayer-first)");
    this.creatureSprites.clear();
    this.resourceSprites.clear();

    // ============================================================================
    // ============================================================================
    this.sceneInitializer = new SceneInitializer(this, this.worldState);
    this.mapConfig = this.sceneInitializer.initializeMapConfig();
    this.sceneInitializer.initializeExpeditionSettings();
    this.expeditionDuration = this.sceneInitializer.getExpeditionDuration();
    this.extractionRequired = this.sceneInitializer.getExtractionRequired();

    // Dimensões do mundo (maior que a viewport para criar sensação de exploração)
    const worldWidth = this.mapConfig.world.worldWidth;
    const worldHeight = this.mapConfig.world.worldHeight;
    const { width: viewportWidth, height: viewportHeight } = this.scale;

    // ============================================================================
    // Inicializar Sistemas Modulares
    // ============================================================================
    
    // Inicializar sistemas de UI primeiro (precisam das dimensões da viewport)
    this.feedbackManager = new FeedbackManager(this);
    this.loadingOverlay = new LoadingOverlay(this);
    this.hudManager = new HUDManager(this, viewportWidth, viewportHeight);
    this.extractionUI = new ExtractionUI(this, viewportWidth, viewportHeight);
    this.skillCooldownUI = new SkillCooldownUI(this, viewportWidth, viewportHeight);
    this.debugPanel = new DebugPanel(this, viewportHeight);
    
    // Inicializar SpriteManager (precisa do worldState)
    this.spriteManager = new SpriteManager(this, this.worldState);
    
    // Inicializar telemetria usando SceneInitializer (ANTES de criar MultiplayerHandlers)
    this.telemetry = this.sceneInitializer.initializeTelemetry();
    
    // Inicializar MultiplayerHandlers (DEPOIS de inicializar telemetria)
    this.multiplayerHandlers = new MultiplayerHandlers(
      this.worldState,
      this.spriteManager,
      this.telemetry,
      this.creatureSprites,
      this.resourceSprites
    );
    
    // Inicializar sistemas de lógica
    this.extractionSystem = new ExtractionSystem(this.state, {
      sendExtractionRequest: (pointId, action) => {
        if (this.mpClient) {
          this.mpClient.sendExtractionRequest(pointId, action);
        }
      },
      extractionUI: this.extractionUI
    });
    
    this.captureSystem = new CaptureSystem({
      telemetry: this.telemetry,
      creaturesCaptured: this.creaturesCaptured,
      createCaptureSuccessFeedback: (x, y) => this.feedbackManager.createCaptureSuccessFeedback(x, y),
      createEnhancedFloatingText: (x, y, text, color, fontSize) => 
        this.feedbackManager.createEnhancedFloatingText(x, y, text, color, fontSize),
      removeCreature: (id) => {
        this.worldState.removeCreature(id);
        this.spriteManager.destroyCreatureSprite(id);
      },
      updateCreatureState: (id, state) => {
        this.worldState.updateCreature(id, state);
      },
      worldState: this.worldState
    });

    // ============================================================================
    // ============================================================================
    this.sceneInitializer.setupPhysicsBounds(worldWidth, worldHeight);
    this.sceneInitializer.createBackground(worldWidth, worldHeight);
    this.sceneInitializer.createScenery(worldWidth, worldHeight);

    // Player (círculo representa o treinador/equipe) com anel de perigo
    // Posicionado conforme configuração do mapa (normalizada)
    const playerStartX = worldWidth * this.mapConfig.world.playerSpawnX;
    const playerStartY = worldHeight * this.mapConfig.world.playerSpawnY;
    
    this.player = this.physics.add
      .sprite(playerStartX, playerStartY, "")
      .setCircle(16)
      .setTint(0x4ade80)
      .setOrigin(0.5, 0.5)
      .setCollideWorldBounds(true);

    // hack visual: desenha um círculo usando graphics e usa textura
    const g = this.add.graphics();
    g.fillStyle(0x4ade80, 1);
    g.fillCircle(16, 16, 16);
    g.generateTexture("playerCircle", 32, 32);
    g.destroy();
    this.player.setTexture("playerCircle");

    // Anel visual de perigo em volta do player (ativado em combate/perigo)
    this.dangerRing = this.add.circle(
      this.player.x,
      this.player.y,
      26,
      0x7f1d1d,
      0.15
    );

    // Anel visual de "Carga Valiosa" (Greed Risk) - inicialmente invisível
    this.greedGlowRing = this.add.circle(
      this.player.x,
      this.player.y,
      30,
      GREED_RISK_CONFIG.tier1GlowColor,
      0
    );
    this.greedGlowRing.setVisible(false);

    // Área de extração (retângulo de destaque) posicionada conforme bioma
    // Agora usando dimensões do mundo
    const zoneWidth = worldWidth * this.mapConfig.extraction.zoneWidthRatio;
    const zoneHeight = worldHeight * this.mapConfig.extraction.zoneHeightRatio;
    const zoneX = worldWidth * this.mapConfig.extraction.zoneNormalizedX;
    const zoneY = worldHeight * this.mapConfig.extraction.zoneNormalizedY;

    this.extractionZone = this.add.rectangle(
      zoneX,
      zoneY,
      zoneWidth,
      zoneHeight,
      0x1d4ed8,
      0.65
    );
    this.extractionZoneOutline = this.add.rectangle(
      this.extractionZone.x,
      this.extractionZone.y,
      this.extractionZone.width + 6,
      this.extractionZone.height + 6,
      0x0f172a,
      0
    )
      .setStrokeStyle(2, 0x60a5fa, 1);

    this.add
      .text(
        this.extractionZone.x,
        this.extractionZone.y - 4,
        "ZONA DE EXTRAÇÃO",
        {
          fontSize: "14px",
          color: "#e5edff"
        }
      )
      .setOrigin(0.5);

    // Input - Setas e WASD para movimento
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.extractKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );
    this.attackKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.captureKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.Q
    );
    this.skillKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.F
    );
    this.healKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.H
    );
    // Troca de criatura da equipe (slots 1–3)
    this.teamSwitchKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE)
    ];
    // Tecla para toggle do painel de debug (F1)
    this.debugPanelKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.F1
    );

    // Verifica query param para debug
    const debugUrlParams = new URLSearchParams(window.location.search);
    if (debugUrlParams.get("debug") === "1") {
      this.debugPanelVisible = true;
    }

    // Configura a câmera para seguir o jogador com zoom
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(this.mapConfig.world.cameraZoom);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    this.hudManager.create();

    // Painel de instruções no canto inferior esquerdo (pequeno, semi-transparente)
    const controlsY = viewportHeight - 80;
    this.add
      .rectangle(12, controlsY, 260, 68, 0x020617, 0.6)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x1f2937, 0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.add.text(22, controlsY + 8, 
      "WASD/Setas: mover | ESPAÇO: atacar | H: poção\nQ: capturar | F: habilidade | E: extrair\n1-2-3: trocar criatura | F1: debug", 
      {
        fontSize: "10px",
        color: "#9ca3af",
        lineSpacing: 4
      }
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(101);

    this.skillCooldownUI.create();

    this.extractionUI.create();
    
    this.debugPanel.create();
    
    this.minimapManager = new MinimapManager(this);
    this.minimapManager.create(viewportWidth, viewportHeight, worldWidth, worldHeight, zoneX, zoneY, this.mapConfig);

    // Inicializa telemetria
    this.telemetry.expeditionStartTime = Date.now();

    // Inicializa criaturas da equipe (até 3 slots) e seleciona a criatura ativa
    const progress = LocalPlayerState.getProgress();
    this.activeTeamIds = progress.activeTeamIds.slice(0, progress.teamSlots,).slice(0, 3);
    this.creatureHpByInstance = new Map();
    this.activeCreatureIndex = 0;
    this.activeCreatureInstanceId = null;
    this.activeCreatureDef = null;

    if (this.activeTeamIds.length > 0) {
      this.setActiveCreatureByIndex(0);
    } else {
      // Fallback defensivo caso algo esteja inconsistente com o estado do jogador
      this.activeCreatureMaxHp = 100;
      this.activeCreatureHp = 100;
      this.basicAttackCooldownTime = 0.8;
      this.specialSkillCooldownTime = 12;
      this.activeSpecialSkillKind = null;
      this.activeSpecialSkillName = "Habilidade Especial";
      
      // Nota: skillSystem será atualizado após sua inicialização se necessário
    }

    // Arquitetura multiplayer-first: servidor sempre inicializa o mundo
    // Não faz spawn local - aguarda sincronização do servidor
    
    // Inicializa sistema de barras de HP (após criaturas da equipe serem configuradas)
    this.initializeHPBars(viewportWidth, viewportHeight, progress);
    
    // ============================================================================
    // ============================================================================
    
    // MovementSystem (precisa do player e controles)
    this.movementSystem = new MovementSystem(
      this.player,
      this.cursors,
      this.wasdKeys,
      this.speed,
      this.state,
      this.mpClient
    );
    
    // SkillZoneManager (precisa ser inicializado antes do SkillSystem)
    this.skillZoneManager = new SkillZoneManager(this, {
      getAllCreatures: () => this.spriteManager.getAllCreatures(),
      updateCreatureHp: (id, hp) => {
        this.worldState.updateCreature(id, { currentHp: hp });
        const sprite = this.spriteManager.getCreatureSprite(id);
        if (sprite) {
          sprite.currentHp = hp;
          this.spriteManager.updateCreatureSprite(id);
        }
      },
      worldState: this.worldState,
      telemetry: this.telemetry
    });
    
    // SkillSystem (precisa do scene, mpClient e skillZoneManager)
    this.skillSystem = new SkillSystem(this, this.mpClient, {
      createFloatingText: (x, y, text, color) => 
        this.feedbackManager.createFloatingText(x, y, text, color),
      addSkillZone: (zone) => this.skillZoneManager.addSkillZone(zone),
      healCreature: (amount) => {
        this.activeCreatureHp = Math.min(
          this.activeCreatureMaxHp,
          this.activeCreatureHp + amount
        );
      },
      activeCreatureHp: this.activeCreatureHp,
      activeCreatureMaxHp: this.activeCreatureMaxHp
    });
    
    // Atualizar skillSystem com a criatura ativa se já foi definida
    if (this.activeCreatureDef !== null && this.activeSpecialSkillKind !== null) {
      // TypeScript type narrowing - após verificar !== null, sabemos que não é null
      const creatureDef: CreatureDefinition = this.activeCreatureDef;
      const creatureTheme = getCreatureTheme(creatureDef.id);
      this.skillSystem.setActiveSkill(
        this.activeSpecialSkillKind,
        this.activeSpecialSkillName,
        this.specialSkillCooldownTime,
        creatureDef,
        creatureTheme
      );
    }
    
    // ProjectileManager (precisa de várias dependências)
    this.projectileManager = new ProjectileManager(this, this.player, {
      getAllCreatures: () => this.spriteManager.getAllCreatures(),
      removeCreature: (id) => {
        this.worldState.removeCreature(id);
        this.spriteManager.destroyCreatureSprite(id);
      },
      updateCreatureHp: (id, hp) => {
        this.worldState.updateCreature(id, { currentHp: hp });
        const sprite = this.spriteManager.getCreatureSprite(id);
        if (sprite) {
          sprite.currentHp = hp;
          this.spriteManager.updateCreatureSprite(id);
        }
      },
      worldState: this.worldState,
      telemetry: this.telemetry,
      mpClient: this.mpClient,
      dealDamageToPlayer: (damage) => this.dealDamageToPlayer(damage),
      createDeathEffect: (x, y, theme) => this.createDeathEffect(x, y, theme),
      createEnhancedFloatingText: (x, y, text, color, fontSize) => 
        this.feedbackManager.createEnhancedFloatingText(x, y, text, color, fontSize),
      attemptCapture: (creature, ballType: string) => {
        const result = this.captureSystem.attemptCapture(creature, ballType as "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra");
        this.creaturesCaptured = result.creaturesCaptured;
      },
      sendCaptureAttempt: (creatureId: string, ballType: string) => {
        if (this.mpClient) {
          // ✅ BUG FIX: Armazenar posição da criatura antes de enviar tentativa
          // Isso permite exibir feedback mesmo se a criatura já foi removida quando recebemos o resultado
          const creature = this.getCreatureSprite(creatureId);
          if (creature) {
            this.captureAttemptPositions.set(creatureId, {
              x: creature.sprite.x,
              y: creature.sprite.y
            });
            console.log(`[MP] 💾 Armazenando posição de captura para ${creatureId}: (${creature.sprite.x.toFixed(0)}, ${creature.sprite.y.toFixed(0)})`);
          }
          this.mpClient.sendCaptureAttempt(creatureId, ballType as "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra");
        }
      }
    });
    
    // Atualizar extractionSystem com serverExtractionPointId quando disponível
    if (this.serverExtractionPointId) {
      this.extractionSystem.setServerExtractionPointId(this.serverExtractionPointId);
    }
    
    // Log de início de expedição
    console.log("[TELEMETRIA] Expedição iniciada", {
      timestamp: new Date().toISOString(),
      duration: this.expeditionDuration
    });

    // Ataque com clique do mouse também
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && !this.loadingOverlay.visible) {
        this.tryBasicAttack(pointer.worldX, pointer.worldY);
      }
    });

    // ITEM 11: Exibir loading antes de conectar ao servidor
    this.loadingOverlay.show("Conectando ao servidor...");

    // Arquitetura multiplayer-first: sempre conecta ao servidor
    const name = LocalPlayerState.getProgress().displayName ?? "Convidado";
    // Usar mapId como roomId para que cada mapa tenha sua própria sala
    const roomId = this.mapConfig?.id ?? "default-room";
    const userId = getUserId();
    // Passa os itens selecionados para o MultiplayerClient
    this.mpClient = new MultiplayerClient(roomId, name, userId, selectedItems);
      
      // Captura o ID do cliente após conexão bem-sucedida
      this.mpClient.on("joined", (data) => {
        // ITEM 11: Remover loading após conexão bem-sucedida
        this.loadingOverlay.hide();
        this.clientId = data.clientId;
        console.log("[MP] Conectado com ID:", this.clientId);
        
        // Atualizar referência do mpClient nos sistemas após conexão
        if (this.movementSystem) {
          this.movementSystem.setMpClient(this.mpClient);
        }
        if (this.skillSystem) {
          this.skillSystem.setMpClient(this.mpClient);
        }
        if (this.projectileManager) {
          this.projectileManager.setMpClient(this.mpClient);
        }
        
        // Usar posição inicial fornecida pelo servidor
        if (data.initialPosition) {
          this.player.setPosition(data.initialPosition.x, data.initialPosition.y);
          console.log("[MP] Posição inicial do servidor:", data.initialPosition);
        }
        
        // Enviar dados do time ao servidor
        const teamData = this.activeTeamIds.map(instanceId => {
          const owned = progress.creatures.find(c => c.instanceId === instanceId);
          const def = owned ? getCreatureById(owned.definitionId) : null;
          if (!owned || !def) return null;
          
          const effectiveStats = getEffectiveStats(owned);
          return {
            instanceId: owned.instanceId,
            definitionId: owned.definitionId,
            level: owned.level,
            currentHp: owned.currentHp,
            maxHp: effectiveStats.hp,
            rank: owned.rank
          };
        }).filter((c): c is NonNullable<typeof c> => c !== null);
        
        if (this.mpClient) {
          this.mpClient.sendTeamData(teamData, this.activeCreatureInstanceId);
          console.log("[MP] Dados do time enviados:", teamData);
        }
      });
      
      // Sincroniza jogadores remotos quando recebe atualizações de estado
      this.mpClient.on("state", (players, match, world) => {
        this.syncRemotePlayers(players);

        // Processar worldState inicial (criaturas e recursos)
        if (world) {
          if (world.creatures && world.creatures.length > 0) {
            console.log(`[MP] Recebendo ${world.creatures.length} criaturas do servidor`);
            this.multiplayerHandlers.handleCreaturesUpdate(world.creatures);
          }
          
          if (world.resources && world.resources.length > 0) {
            console.log(`[MP] Recebendo ${world.resources.length} recursos do servidor`);
            this.multiplayerHandlers.handleResourcesUpdate(world.resources);
          }
          
          if (world.extractionPoints && world.extractionPoints.length > 0) {
            console.log(`[MP] Recebendo ${world.extractionPoints.length} pontos de extração do servidor`);
            // Armazenar ID do primeiro ponto de extração (assumindo 1 ponto por mapa)
            if (world.extractionPoints[0]) {
              this.serverExtractionPointId = world.extractionPoints[0].id;
              console.log(`[MP] Ponto de extração registrado: ${this.serverExtractionPointId}`);
              // Atualizar extractionSystem com o ID recebido do servidor
              if (this.extractionSystem) {
                this.extractionSystem.setServerExtractionPointId(this.serverExtractionPointId);
              }
            }
          }
        }

        // Sincronizar timer com o servidor em modo multiplayer
        if (match) {
          this.useServerTimer = true;
          this.expeditionDuration = match.durationSeconds;
          // Calcular expeditionTime a partir do timeLeft
          this.expeditionTime = match.durationSeconds - match.timeLeft;
          // Armazenar último estado do match para usar em telemetria
          this.lastMatchState = match;
          
          console.debug("[MP] Timer sincronizado:", {
            elapsed: match.elapsedSeconds,
            timeLeft: match.timeLeft,
            state: match.state
          });
        }
      });
      
      // attackResult precisa da lógica completa do método antigo (tem dependências da cena)
      this.mpClient.on("attackResult", (result) => {
        // Atualizar telemetria via MultiplayerHandlers
        this.multiplayerHandlers.handleAttackResult(result);
        // Processar resultado completo (lógica visual e de estado)
        this.handleAttackResult(result);
      });
      this.mpClient.on("captureResult", (result) => {
        console.log("[MP] 🎯 Evento captureResult recebido no handler:", result);
        // NOTA: Não atualizar telemetria aqui via MultiplayerHandlers
        // A telemetria será atualizada em handleCaptureResult() para evitar duplicação
        // Processar resultado completo (lógica visual e de estado)
        this.handleCaptureResult(result);
      });
      this.mpClient.on("creaturesUpdate", (creatures) => this.multiplayerHandlers.handleCreaturesUpdate(creatures));
      this.mpClient.on("resourcesUpdate", (resources) => this.multiplayerHandlers.handleResourcesUpdate(resources));
      this.mpClient.on("projectilesUpdate", (projectiles) => {
        // Atualizar telemetria via MultiplayerHandlers
        this.multiplayerHandlers.handleProjectilesUpdate(projectiles);
        // Processar atualização completa (lógica visual)
        this.handleProjectilesUpdate(projectiles);
      });
      this.mpClient.on("skillZonesUpdate", (skillZones) => {
        // Atualizar telemetria via MultiplayerHandlers
        this.multiplayerHandlers.handleSkillZonesUpdate(skillZones);
        // Processar atualização completa (lógica visual)
        this.handleSkillZonesUpdate(skillZones);
      });
      this.mpClient.on("extractionState", (state) => {
        // Atualizar estado através do ExtractionSystem
        const newState = this.extractionSystem.handleExtractionState({
          playerId: state.playerId,
          pointId: state.pointId,
          progress: state.progress,
          status: state.status === "in_progress" ? "extracting" : 
                  state.status === "completed" ? "completed" : "cancelled"
        });
        // IMPORTANTE: Atualizar this.state para garantir sincronização
        // Isso evita que match_event finished marque como falha quando extração foi completada
        this.state = newState;
        
        // Processar recompensas se extração completou (chamar handleExtractionState)
        if (state.status === "completed") {
          this.handleExtractionState(state);
        }
        
        // MultiplayerHandlers é usado apenas para telemetria, não para mudança de estado
        this.multiplayerHandlers.handleExtractionState(state);
      });
      this.mpClient.on("matchEvent", (event) => {
        // Atualizar telemetria via MultiplayerHandlers
        this.multiplayerHandlers.handleMatchEvent(event);
        // Processar evento completo (lógica de estado e UI)
        this.handleMatchEvent(event);
      });
      this.mpClient.on("playerDeath", (death) => {
        // Atualizar telemetria via MultiplayerHandlers
        this.multiplayerHandlers.handlePlayerDeath(death);
        // Processar morte completa (lógica de estado e UI)
        this.handlePlayerDeath(death);
      });
      this.mpClient.on("playerMove", (move) => this.multiplayerHandlers.handlePlayerMove(move));
      
      // Handlers para erros e conexão
      this.mpClient.on("error", (reason, details) => {
        // ITEM 11: Remover loading em caso de erro
        this.loadingOverlay.hide();
        console.error("[MP] Erro do servidor:", reason, details);
        
        // Tratar erros específicos
        if (reason === "room_full") {
          alert("Sala cheia! Tente novamente mais tarde.");
          this.scene.start("BaseHubScene");
        } else if (reason === "match_finished") {
          alert("Esta partida já terminou.");
          this.scene.start("BaseHubScene");
        } else {
          // Erro genérico - mostrar aviso mas continuar em modo local
          console.warn("[MP] Erro multiplayer - continuando em modo local");
        }
      });
      
      this.mpClient.on("disconnected", () => {
        console.warn("[MP] Desconectado do servidor - tentando reconectar...");
        // MultiplayerClient já tem lógica de reconexão automática
      });
    
    this.mpClient.connect();
  }

  // =============================================================================
  // Métodos Auxiliares para GameWorldState
  // =============================================================================

  /**
   * Cria um sprite visual para uma criatura do worldState.
   * Usado tanto para criaturas locais quanto remotas.
   */
  /**
   * Cria sprite de criatura.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   * @deprecated Use spriteManager.createCreatureSprite() diretamente
   */
  private createCreatureSprite(creature: CreatureState): void {
    // FASE 4: Delegar para SpriteManager
    if (this.spriteManager) {
      this.spriteManager.createCreatureSprite(creature);
      return;
    }
    
    // Fallback legado (não deveria acontecer)
    if (this.creatureSprites.has(creature.id)) {
      return;
    }

    // Determina a cor baseada no tier
    // Cores padrão por tier (vermelho para comum, laranja para perigosa, amarelo para elite)
    let creatureColor = 0x7f1d1d;
    switch (creature.tier) {
      case "comum":
        creatureColor = 0x7f1d1d; // vermelho escuro
        break;
      case "perigosa":
        creatureColor = 0x9a3412; // laranja escuro
        break;
      case "elite":
        creatureColor = 0x7c2d12; // marrom escuro
        break;
    }

    // Cria sprite principal
    const sprite = this.add.circle(creature.x, creature.y, 12, creatureColor, 1);
    sprite.setDepth(2);

    // Cria barra de HP
    const hpBarBg = this.add.rectangle(creature.x, creature.y - 20, 40, 4, 0x000000, 0.6);
    hpBarBg.setDepth(3);
    
    const hpBar = this.add.rectangle(creature.x, creature.y - 20, 40, 4, 0x00ff00, 1);
    hpBar.setDepth(3);
    
    const hpBarText = this.add.text(creature.x, creature.y - 24, `${creature.currentHp}/${creature.maxHp}`, {
      fontSize: "10px",
      color: "#ffffff"
    });
    hpBarText.setOrigin(0.5, 1);
    hpBarText.setDepth(3);

    // Cria indicador de aggro (inicialmente invisível)
    const aggroIndicator = this.add.circle(creature.x, creature.y, 20, 0xff0000, 0);
    aggroIndicator.setDepth(1);

    // Armazena o sprite completo
    const creatureSprite: RemoteCreatureSprite = {
      id: creature.id,
      sprite,
      hpBar,
      hpBarBg,
      hpBarText,
      currentX: creature.x,
      currentY: creature.y,
      targetX: creature.x,
      targetY: creature.y,
      currentHp: creature.currentHp,
      maxHp: creature.maxHp,
      tier: creature.tier,
      creatureType: creature.creatureType,
      speciesId: creature.speciesId,
      level: creature.level,
      behaviorType: creature.behaviorType,
      aiState: creature.aiState,
      aiConfig: creature.aiConfig,
      attackCooldownRemaining: creature.attackCooldownRemaining,
      windupTimer: creature.windupTimer,
      stunTimer: creature.stunTimer,
      aggroIndicator,
      attackTellIndicator: undefined,
      patrolOrigin: creature.patrolOrigin,
      patrolTimer: creature.patrolTimer,
      state: creature.state,
      skipFirstInterpolation: true
    };

    // Fallback legado - não deveria chegar aqui se spriteManager estiver disponível
    this.creatureSprites.set(creature.id, creatureSprite);
  }

  /**
   * Atualiza sprite de criatura existente baseado no estado.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   * @deprecated Use spriteManager.updateCreatureSprite() diretamente
   */
  private updateCreatureSprite(creatureId: string): void {
    // FASE 4: Delegar para SpriteManager
    if (this.spriteManager) {
      this.spriteManager.updateCreatureSprite(creatureId);
      return;
    }
    
    // Fallback legado
    const sprite = this.creatureSprites.get(creatureId);
    const state = this.worldState.getCreature(creatureId);
    
    if (!sprite || !state) return;

    // Atualiza posição alvo para interpolação
    sprite.targetX = state.x;
    sprite.targetY = state.y;
    
    // Atualiza HP
    sprite.currentHp = state.currentHp;
    sprite.maxHp = state.maxHp;
    
    // Atualiza timers de IA
    sprite.attackCooldownRemaining = state.attackCooldownRemaining;
    sprite.windupTimer = state.windupTimer;
    sprite.stunTimer = state.stunTimer;
    sprite.aiState = state.aiState;
    
    // Atualiza barra de HP visual
    const hpPercent = state.currentHp / state.maxHp;
    sprite.hpBar.setScale(hpPercent, 1);
    sprite.hpBarText.setText(`${state.currentHp}/${state.maxHp}`);
    
    // Atualiza cor da barra baseada no HP
    if (hpPercent > 0.6) {
      sprite.hpBar.setFillStyle(0x00ff00, 1);
    } else if (hpPercent > 0.3) {
      sprite.hpBar.setFillStyle(0xffff00, 1);
    } else {
      sprite.hpBar.setFillStyle(0xff0000, 1);
    }
  }

  /**
   * Remove sprite de criatura.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   * @deprecated Use spriteManager.destroyCreatureSprite() diretamente
   */
  private destroyCreatureSprite(creatureId: string): void {
    // FASE 4: Delegar para SpriteManager
    if (this.spriteManager) {
      this.spriteManager.destroyCreatureSprite(creatureId);
      return;
    }
    
    // Fallback legado
    const sprite = this.creatureSprites.get(creatureId);
    if (!sprite) return;

    sprite.sprite.destroy();
    sprite.hpBar.destroy();
    sprite.hpBarBg.destroy();
    sprite.hpBarText.destroy();
    sprite.aggroIndicator?.destroy();
    sprite.attackTellIndicator?.destroy();

    this.creatureSprites.delete(creatureId);
  }

  /**
   * Atualiza posições de todos os sprites de criaturas (interpolação suave).
   * Usa interpolação híbrida: lerp para movimento suave + velocidade máxima para catchup.
   */
  private updateCreatureSprites(dt: number): void {
    // Fator de interpolação baseado em tempo (mais suave que velocidade constante)
    // Valor entre 0 e 1, onde maior = mais rápido para alcançar o target
    const lerpFactor = Math.min(1, dt * 15); // ~15 = alcança 95% da distância em ~200ms
    const maxSpeed = 500; // Velocidade máxima em px/s para evitar teleporte

    for (const [creatureId, sprite] of this.creatureSprites) {
      try {
        // Validação: criatura ainda existe no worldState?
        const creatureState = this.worldState.getCreature(creatureId);
        if (!creatureState) {
          console.warn(`[DEBUG:Creatures] Sprite órfão detectado: ${creatureId.slice(0, 8)}... - Removendo`);
          this.destroyCreatureSprite(creatureId);
          continue;
        }
        
        // Validação adicional: criatura com HP <= 0 deve ser removida
        if (creatureState.currentHp <= 0) {
          console.warn(`[DEBUG:Creatures] Criatura morta detectada no loop: ${creatureId.slice(0, 8)}... (HP: ${creatureState.currentHp}) - Removendo`);
          this.removeCreature(creatureId);
          continue;
        }

        // Se é a primeira interpolação, faz snap direto para evitar deslizamento inicial
        if (sprite.skipFirstInterpolation) {
        sprite.currentX = sprite.targetX;
        sprite.currentY = sprite.targetY;
        sprite.skipFirstInterpolation = false;
        
        // Atualiza posições visuais
        sprite.sprite.setPosition(sprite.currentX, sprite.currentY);
        sprite.hpBar.setPosition(sprite.currentX, sprite.currentY - 20);
        sprite.hpBarBg.setPosition(sprite.currentX, sprite.currentY - 20);
        sprite.hpBarText.setPosition(sprite.currentX, sprite.currentY - 24);
        if (sprite.aggroIndicator) {
          sprite.aggroIndicator.setPosition(sprite.currentX, sprite.currentY);
        }
        if (sprite.attackTellIndicator) {
          sprite.attackTellIndicator.setPosition(sprite.currentX, sprite.currentY);
        }
        continue;
      }

      // Calcula distância ao target
      const dx = sprite.targetX - sprite.currentX;
      const dy = sprite.targetY - sprite.currentY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0.5) {
        // Interpolação híbrida: usa lerp mas limita velocidade máxima
        let newX = sprite.currentX + dx * lerpFactor;
        let newY = sprite.currentY + dy * lerpFactor;
        
        // Calcula quanto moveu
        const movedX = newX - sprite.currentX;
        const movedY = newY - sprite.currentY;
        const movedDist = Math.sqrt(movedX * movedX + movedY * movedY);
        
        // Se moveu mais que a velocidade máxima permite, limita
        const maxMove = maxSpeed * dt;
        if (movedDist > maxMove && distance > maxMove) {
          const scale = maxMove / movedDist;
          newX = sprite.currentX + movedX * scale;
          newY = sprite.currentY + movedY * scale;
        }
        
        sprite.currentX = newX;
        sprite.currentY = newY;
      } else {
        sprite.currentX = sprite.targetX;
        sprite.currentY = sprite.targetY;
      }

        // Atualiza posições visuais
        sprite.sprite.setPosition(sprite.currentX, sprite.currentY);
        sprite.hpBar.setPosition(sprite.currentX, sprite.currentY - 20);
        sprite.hpBarBg.setPosition(sprite.currentX, sprite.currentY - 20);
        sprite.hpBarText.setPosition(sprite.currentX, sprite.currentY - 24);
        sprite.aggroIndicator?.setPosition(sprite.currentX, sprite.currentY);
        sprite.attackTellIndicator?.setPosition(sprite.currentX, sprite.currentY);
      } catch (error) {
        // Captura erros silenciosos que possam travar a interpolação
        console.error(`[DEBUG:Creatures] Erro ao interpolar criatura ${creatureId.slice(0, 8)}...:`, error);
        // Remove sprite problemático para evitar travamento
        this.destroyCreatureSprite(creatureId);
      }
    }
  }

  /**
   * Obtém todas as criaturas do worldState.
   * Retorna array de RemoteCreatureSprite (interface unificada).
   */
  /**
   * Obtém todas as criaturas do worldState.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   */
  private getAllCreatures(): RemoteCreatureSprite[] {
    // Usa SpriteManager que é a fonte de verdade para criaturas
    return this.spriteManager?.getAllCreatures() ?? Array.from(this.creatureSprites.values());
  }

  /**
   * Encontra criatura sprite por ID.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   */
  private getCreatureSprite(creatureId: string): RemoteCreatureSprite | undefined {
    // Usa SpriteManager que é a fonte de verdade para criaturas
    return this.spriteManager?.getCreatureSprite(creatureId) ?? this.creatureSprites.get(creatureId);
  }

  /**
   * Remove criatura do worldState e destrói seu sprite.
   */
  private removeCreature(creatureId: string): void {
    this.worldState.removeCreature(creatureId);
    this.destroyCreatureSprite(creatureId);
  }

  // =============================================================================
  // Métodos Auxiliares para Recursos
  // =============================================================================

  /**
   * Cria um sprite visual para um recurso do worldState.
   * Usado tanto para recursos locais quanto remotos.
   */
  /**
   * Cria sprite de recurso.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   * @deprecated Use spriteManager.createResourceSprite() diretamente
   */
  private createResourceSprite(resource: import("../game/worldState").ResourceState): void {
    // FASE 4: Delegar para SpriteManager
    if (this.spriteManager) {
      this.spriteManager.createResourceSprite(resource);
      return;
    }
    
    // Fallback legado
    if (this.resourceSprites.has(resource.id)) {
      return;
    }

    // Cria sprite losango (rectangle rotacionado 45°)
    const sprite = this.add.rectangle(
      resource.x,
      resource.y,
      resource.size,
      resource.size,
      resource.color
    );
    sprite.setAngle(45);
    sprite.setStrokeStyle(resource.borderWidth, resource.borderColor, 0.95);
    sprite.setDepth(1);

    // Armazena o sprite completo
    const resourceSprite: RemoteResourceSprite = {
      id: resource.id,
      sprite,
      currentX: resource.x,
      currentY: resource.y,
      targetX: resource.x,
      targetY: resource.y,
      resourceType: resource.type,
      amount: resource.amount,
      isRare: resource.isRare,
      size: resource.size,
      color: resource.color,
      borderColor: resource.borderColor,
      borderWidth: resource.borderWidth,
      skipFirstInterpolation: true
    };

    // Fallback legado - não deveria chegar aqui se spriteManager estiver disponível
    this.resourceSprites.set(resource.id, resourceSprite);
  }

  /**
   * Atualiza sprite de recurso existente baseado no estado.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   * @deprecated Use spriteManager.updateResourceSprite() diretamente
   */
  private updateResourceSprite(resourceId: string): void {
    // FASE 4: Delegar para SpriteManager
    if (this.spriteManager) {
      this.spriteManager.updateResourceSprite(resourceId);
      return;
    }
    
    // Fallback legado
    const sprite = this.resourceSprites.get(resourceId);
    const state = this.worldState.getResource(resourceId);
    
    if (!sprite || !state) return;

    // Atualiza posição alvo para interpolação
    sprite.targetX = state.x;
    sprite.targetY = state.y;
    
    // Atualiza quantidade
    sprite.amount = state.amount;
  }

  /**
   * Remove sprite de recurso.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   */
  private destroyResourceSprite(resourceId: string): void {
    // Usa SpriteManager que é a fonte de verdade para recursos
    if (this.spriteManager) {
      this.spriteManager.destroyResourceSprite(resourceId);
    } else {
      // Fallback para compatibilidade (não deveria acontecer)
      const sprite = this.resourceSprites.get(resourceId);
      if (sprite) {
        sprite.sprite.destroy();
        this.resourceSprites.delete(resourceId);
      }
    }
  }

  /**
   * Atualiza posições de todos os sprites de recursos (interpolação suave).
   */
  private updateResourceSprites(dt: number): void {
    const interpolationSpeed = 200; // px por segundo (ajustado para melhor sincronização)

    for (const [resourceId, sprite] of this.resourceSprites) {
      // Se é a primeira interpolação, faz snap direto para evitar deslizamento inicial
      if (sprite.skipFirstInterpolation) {
        sprite.currentX = sprite.targetX;
        sprite.currentY = sprite.targetY;
        sprite.skipFirstInterpolation = false;
        sprite.sprite.setPosition(sprite.currentX, sprite.currentY);
        continue;
      }

      // Interpola posição
      const dx = sprite.targetX - sprite.currentX;
      const dy = sprite.targetY - sprite.currentY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0.5) {
        const moveAmount = Math.min(interpolationSpeed * dt, distance);
        sprite.currentX += (dx / distance) * moveAmount;
        sprite.currentY += (dy / distance) * moveAmount;
      } else {
        sprite.currentX = sprite.targetX;
        sprite.currentY = sprite.targetY;
      }

      // Atualiza posições visuais
      sprite.sprite.setPosition(sprite.currentX, sprite.currentY);
    }
  }

  /**
   * Obtém todos os recursos do worldState.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   */
  private getAllResources(): RemoteResourceSprite[] {
    // Usa SpriteManager que é a fonte de verdade para recursos
    return this.spriteManager?.getAllResources() ?? Array.from(this.resourceSprites.values());
  }

  /**
   * Encontra recurso sprite por ID.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   */
  private getResourceSprite(resourceId: string): RemoteResourceSprite | undefined {
    return this.spriteManager?.getResourceSprite(resourceId) ?? this.resourceSprites.get(resourceId);
  }

  /**
   * Remove recurso do worldState e destrói seu sprite.
   */
  private removeResource(resourceId: string): void {
    console.log(`[Resource] Removendo recurso: ${resourceId}`);
    // Remove do set de intents enviados quando o recurso é removido
    this.resourceIntentsSent.delete(resourceId);
    this.worldState.removeResource(resourceId);
    this.destroyResourceSprite(resourceId);
    console.log(`[Resource] Recurso removido: ${resourceId}`);
  }

  // ===== Métodos auxiliares para jogadores =====

  /**
   * Cria um sprite de jogador e adiciona ao mapa de sprites.
   */
  /**
   * Cria sprite de jogador.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   * @deprecated Use spriteManager.createPlayerSprite() diretamente
   */
  private createPlayerSprite(player: PlayerState): void {
    // FASE 4: Delegar para SpriteManager
    if (this.spriteManager) {
      this.spriteManager.createPlayerSprite(player);
      return;
    }
    
    // Fallback legado
    const sprite = this.add.circle(player.x, player.y, player.radius, player.color);
    sprite.setDepth(5);

    const nameText = this.add.text(player.x, player.y - player.radius - 10, player.name, {
      fontSize: "12px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 4, y: 2 }
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(5);

    const hpBarBg = this.add.rectangle(player.x, player.y - player.radius - 25, 50, 5, 0x333333);
    hpBarBg.setOrigin(0.5);
    hpBarBg.setDepth(5);

    const hpBar = this.add.rectangle(player.x, player.y - player.radius - 25, 50, 5, 0x00ff00);
    hpBar.setOrigin(0.5, 0.5);
    hpBar.setDepth(5);

    const hpBarText = this.add.text(player.x, player.y - player.radius - 35, `${player.hp}/${player.maxHp}`, {
      fontSize: "10px",
      color: "#ffffff"
    });
    hpBarText.setOrigin(0.5);
    hpBarText.setDepth(5);

    const playerSprite: RemotePlayerSprite = {
      id: player.id,
      name: player.name,
      sprite,
      nameText,
      hpBar,
      hpBarBg,
      hpBarText,
      currentX: player.x,
      currentY: player.y,
      targetX: player.x,
      targetY: player.y,
      currentHp: player.hp,
      maxHp: player.maxHp,
      lastUpdate: player.lastUpdate,
      color: player.color,
      radius: player.radius,
      actionIndicator: null,
      actionType: player.actionType,
      actionTimer: player.actionTimer,
      isVisible: player.isVisible,
      skipFirstInterpolation: true
    };

    this.playerSprites.set(player.id, playerSprite);
  }

  /**
   * Atualiza propriedades visuais de um sprite de jogador existente.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   * @deprecated Use spriteManager.updatePlayerSprite() diretamente
   */
  private updatePlayerSprite(player: PlayerState): void {
    // FASE 4: Delegar para SpriteManager
    if (this.spriteManager) {
      this.spriteManager.updatePlayerSprite(player);
      return;
    }
    
    // Fallback legado
    const sprite = this.playerSprites.get(player.id);
    if (!sprite) return;

    // Atualiza posição alvo
    sprite.targetX = player.x;
    sprite.targetY = player.y;

    // Atualiza HP
    sprite.currentHp = player.hp;
    sprite.maxHp = player.maxHp;

    // Atualiza nome (pode ter mudado)
    sprite.name = player.name;
    sprite.nameText.setText(player.name);

    // Atualiza timestamp
    sprite.lastUpdate = player.lastUpdate;

    // Atualiza propriedades visuais
    sprite.color = player.color;
    sprite.radius = player.radius;
    sprite.sprite.setRadius(player.radius);
    sprite.sprite.setFillStyle(player.color);

    // Atualiza ação
    sprite.actionType = player.actionType;
    sprite.actionTimer = player.actionTimer;
    sprite.isVisible = player.isVisible;

    // Atualiza visibilidade
    const visible = player.isVisible;
    sprite.sprite.setVisible(visible);
    sprite.nameText.setVisible(visible);
    sprite.hpBar.setVisible(visible);
    sprite.hpBarBg.setVisible(visible);
    sprite.hpBarText.setVisible(visible);
    if (sprite.actionIndicator) {
      sprite.actionIndicator.setVisible(visible);
    }
  }

  /**
   * Remove sprite de jogador.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   * @deprecated Use spriteManager.destroyPlayerSprite() diretamente
   */
  private destroyPlayerSprite(playerId: string): void {
    // FASE 4: Delegar para SpriteManager
    if (this.spriteManager) {
      this.spriteManager.destroyPlayerSprite(playerId);
      return;
    }
    
    // Fallback legado
    const sprite = this.playerSprites.get(playerId);
    if (!sprite) {
      console.warn(`[MP:Destroy] Tentou destruir sprite de jogador que não existe: ${playerId.slice(0, 8)}...`);
      return;
    }

    console.log(`[MP:Destroy] Destruindo sprite do jogador: ${playerId.slice(0, 8)}...`);
    sprite.sprite.destroy();
    sprite.nameText.destroy();
    sprite.hpBar.destroy();
    sprite.hpBarBg.destroy();
    sprite.hpBarText.destroy();
    if (sprite.actionIndicator) {
      sprite.actionIndicator.destroy();
    }
    this.playerSprites.delete(playerId);
  }

  /**
   * Atualiza posições de todos os sprites de jogadores (interpolação suave).
   * Usa interpolação híbrida: lerp para movimento suave + velocidade máxima para catchup.
   */
  private updatePlayerSprites(dt: number): void {
    if (!this.player) return;

    // Fator de interpolação baseado em tempo (mais suave que velocidade constante)
    const lerpFactor = Math.min(1, dt * 18); // ~18 = alcança 95% da distância em ~170ms (mais rápido para jogadores)
    const maxSpeed = 600; // Velocidade máxima em px/s
    const remoteRenderDistance = this.remotePlayerRenderDistance;

    for (const [playerId, sprite] of this.playerSprites) {
      // Se é a primeira interpolação, faz snap direto para evitar deslizamento inicial
      if (sprite.skipFirstInterpolation) {
        sprite.currentX = sprite.targetX;
        sprite.currentY = sprite.targetY;
        sprite.skipFirstInterpolation = false;
        
        // Atualiza posições visuais
        sprite.sprite.setPosition(sprite.currentX, sprite.currentY);
        sprite.nameText.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 10);
        sprite.hpBar.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 25);
        sprite.hpBarBg.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 25);
        sprite.hpBarText.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 35);
        if (sprite.actionIndicator) {
          sprite.actionIndicator.setPosition(sprite.currentX, sprite.currentY);
        }
        continue;
      }

      // Distance culling - oculta jogadores muito distantes
      const dx = sprite.targetX - this.player.x;
      const dy = sprite.targetY - this.player.y;
      const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

      const shouldBeVisible = distanceToPlayer < remoteRenderDistance;
      
      // Atualiza visibilidade
      if (sprite.isVisible !== shouldBeVisible) {
        sprite.isVisible = shouldBeVisible;
        sprite.sprite.setVisible(shouldBeVisible);
        sprite.nameText.setVisible(shouldBeVisible);
        sprite.hpBar.setVisible(shouldBeVisible);
        sprite.hpBarBg.setVisible(shouldBeVisible);
        sprite.hpBarText.setVisible(shouldBeVisible);
        if (sprite.actionIndicator) {
          sprite.actionIndicator.setVisible(shouldBeVisible);
        }
      }

      if (!sprite.isVisible) continue;

      // Interpola posição usando lerp híbrido
      const moveX = sprite.targetX - sprite.currentX;
      const moveY = sprite.targetY - sprite.currentY;
      const distance = Math.sqrt(moveX * moveX + moveY * moveY);

      if (distance > 0.5) {
        // Interpolação híbrida: usa lerp mas limita velocidade máxima
        let newX = sprite.currentX + moveX * lerpFactor;
        let newY = sprite.currentY + moveY * lerpFactor;
        
        // Calcula quanto moveu
        const movedX = newX - sprite.currentX;
        const movedY = newY - sprite.currentY;
        const movedDist = Math.sqrt(movedX * movedX + movedY * movedY);
        
        // Se moveu mais que a velocidade máxima permite, limita
        const maxMove = maxSpeed * dt;
        if (movedDist > maxMove && distance > maxMove) {
          const scale = maxMove / movedDist;
          newX = sprite.currentX + movedX * scale;
          newY = sprite.currentY + movedY * scale;
        }
        
        sprite.currentX = newX;
        sprite.currentY = newY;
      } else {
        sprite.currentX = sprite.targetX;
        sprite.currentY = sprite.targetY;
      }

      // Atualiza posições visuais
      sprite.sprite.setPosition(sprite.currentX, sprite.currentY);
      sprite.nameText.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 10);
      sprite.hpBarBg.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 25);
      sprite.hpBar.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 25);
      sprite.hpBarText.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 35);

      // Atualiza barra de HP
      const hpRatio = sprite.currentHp / sprite.maxHp;
      sprite.hpBar.setSize(50 * hpRatio, 5);
      sprite.hpBar.x = sprite.currentX - 25 + (50 * hpRatio) / 2;
      sprite.hpBarText.setText(`${Math.round(sprite.currentHp)}/${sprite.maxHp}`);

      // Atualiza cor da barra de HP
      if (hpRatio > 0.6) {
        sprite.hpBar.setFillStyle(0x00ff00); // Verde
      } else if (hpRatio > 0.3) {
        sprite.hpBar.setFillStyle(0xffaa00); // Laranja
      } else {
        sprite.hpBar.setFillStyle(0xff0000); // Vermelho
      }

      // Atualiza indicador de ação
      if (sprite.actionType && sprite.actionType !== "idle") {
        if (!sprite.actionIndicator) {
          sprite.actionIndicator = this.add.circle(sprite.currentX, sprite.currentY, sprite.radius + 5, 0xffff00, 0.3);
          sprite.actionIndicator.setDepth(4);
        }
        sprite.actionIndicator.setPosition(sprite.currentX, sprite.currentY);
        sprite.actionIndicator.setVisible(true);

        // Decrementa timer de ação
        sprite.actionTimer = Math.max(0, sprite.actionTimer - dt);
        if (sprite.actionTimer <= 0) {
          sprite.actionType = "idle";
        }
      } else if (sprite.actionIndicator) {
        sprite.actionIndicator.setVisible(false);
      }
    }
  }

  /**
   * Obtém todos os jogadores do worldState.
   */
  /**
   * Obtém todos os jogadores remotos.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   */
  private getAllPlayers(): RemotePlayerSprite[] {
    return this.spriteManager?.getAllPlayers() ?? Array.from(this.playerSprites.values());
  }

  /**
   * Encontra jogador sprite por ID.
   * FASE 4: Usa SpriteManager como fonte de verdade.
   */
  private getPlayerSprite(playerId: string): RemotePlayerSprite | undefined {
    return this.spriteManager?.getPlayerSprite(playerId) ?? this.playerSprites.get(playerId);
  }

  /**
   * Remove jogador do worldState e destrói seu sprite.
   */
  private removePlayer(playerId: string): void {
    this.worldState.removePlayer(playerId);
    this.destroyPlayerSprite(playerId);
  }


  /**
   * Cria o minimapa no canto inferior direito da tela.
   * O minimapa mostra:
   * - Posição aproximada do jogador (ponto verde)
   * - Área da zona de extração (ponto/área azul)
   */
  private createMinimap(
    viewportWidth: number,
    viewportHeight: number,
    worldWidth: number,
    worldHeight: number,
    extractionX: number,
    extractionY: number
  ) {
    const padding = 12;
    const minimapX = viewportWidth - this.minimapWidth - padding;
    const minimapY = viewportHeight - this.minimapHeight - padding;

    // Fundo do minimapa com transparência
    this.minimapBg = this.add
      .rectangle(minimapX, minimapY, this.minimapWidth, this.minimapHeight, 0x0f172a, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Borda do minimapa
    this.minimapBorder = this.add
      .rectangle(minimapX, minimapY, this.minimapWidth, this.minimapHeight, 0x000000, 0)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x334155, 1)
      .setScrollFactor(0)
      .setDepth(101);

    // Label do minimapa
    this.add
      .text(minimapX + this.minimapWidth / 2, minimapY - 6, "MAPA", {
        fontSize: "10px",
        color: "#64748b"
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(101);

    // Calcula posição da extração no minimapa
    const extractionMinimapX = minimapX + (extractionX / worldWidth) * this.minimapWidth;
    const extractionMinimapY = minimapY + (extractionY / worldHeight) * this.minimapHeight;

    // Ponto de extração (azul) - área destacada
    this.minimapExtractionDot = this.add
      .circle(extractionMinimapX, extractionMinimapY, 8, 0x3b82f6, 0.7)
      .setScrollFactor(0)
      .setDepth(102);
    
    // Adiciona animação pulsante na extração
    this.tweens.add({
      targets: this.minimapExtractionDot,
      scale: { from: 1, to: 1.3 },
      alpha: { from: 0.7, to: 0.4 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    // Label da extração no minimapa
    this.add
      .text(extractionMinimapX, extractionMinimapY - 12, "EXT", {
        fontSize: "8px",
        color: "#60a5fa"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);

    // Ponto do jogador (verde) - será atualizado no update
    this.minimapPlayerDot = this.add
      .circle(minimapX + this.minimapWidth / 2, minimapY + this.minimapHeight / 2, 4, 0x4ade80, 1)
      .setScrollFactor(0)
      .setDepth(103);
  }

  /**
   * Atualiza a posição do jogador no minimapa.
   */
  private updateMinimap() {
    if (!this.minimapPlayerDot || !this.minimapBg) return;

    const worldWidth = this.mapConfig.world.worldWidth;
    const worldHeight = this.mapConfig.world.worldHeight;
    
    const minimapX = this.minimapBg.x;
    const minimapY = this.minimapBg.y;

    // Calcula posição do jogador no minimapa
    const playerMinimapX = minimapX + (this.player.x / worldWidth) * this.minimapWidth;
    const playerMinimapY = minimapY + (this.player.y / worldHeight) * this.minimapHeight;

    // Garante que o ponto do jogador fique dentro dos limites do minimapa
    const clampedX = Phaser.Math.Clamp(playerMinimapX, minimapX + 4, minimapX + this.minimapWidth - 4);
    const clampedY = Phaser.Math.Clamp(playerMinimapY, minimapY + 4, minimapY + this.minimapHeight - 4);

    this.minimapPlayerDot.setPosition(clampedX, clampedY);
  }

  /**
   * Inicializa o sistema de barras de HP.
   * Cria a barra principal do jogador e barras para cada criatura da equipe.
   */
  private initializeHPBars(
    viewportWidth: number,
    viewportHeight: number,
    progress: ReturnType<typeof LocalPlayerState.getProgress>
  ) {
    this.hpBarManager = new HPBarManager(this);

    // Posição do HUD de barras de HP (abaixo do HUD de texto compacto)
    const hudX = 22;
    const hudY = 115; // Abaixo do HUD compacto (altura 90 + margem)

    // Cria barra de HP do jogador/criatura ativa
    this.hpBarManager.createPlayerBar(hudX, hudY, this.activeCreatureDef);

    // Cria barras para cada criatura da equipe (até 3)
    const allyBarStartY = hudY + 40;
    const allyBarSpacing = 35;

    for (let i = 0; i < this.activeTeamIds.length; i++) {
      const instanceId = this.activeTeamIds[i];
      const owned = progress.creatures.find((c) => c.instanceId === instanceId);
      const def = owned ? getCreatureById(owned.definitionId) ?? null : null;
      const isActive = i === this.activeCreatureIndex;

      this.hpBarManager.createAllyBar(
        instanceId,
        hudX,
        allyBarStartY + i * allyBarSpacing,
        def,
        isActive
      );
    }
  }

  /**
   * Atualiza todas as barras de HP baseado no estado atual.
   * Chamado a cada frame, mas o HPBarManager só atualiza visualmente quando há mudança.
   */
  private updateHPBars() {
    if (!this.hpBarManager) return;

    const progress = LocalPlayerState.getProgress();

    // Atualiza barra do jogador/criatura ativa
    this.hpBarManager.updatePlayerBar(
      this.activeCreatureHp,
      this.activeCreatureMaxHp,
      this.activeCreatureDef,
      this.playerTookDamageThisFrame
    );

    // Reset flag de dano após atualização
    this.playerTookDamageThisFrame = false;

    // Atualiza barras das criaturas aliadas
    for (let i = 0; i < this.activeTeamIds.length; i++) {
      const instanceId = this.activeTeamIds[i];
      const owned = progress.creatures.find((c) => c.instanceId === instanceId);
      const def = owned ? getCreatureById(owned.definitionId) ?? null : null;
      const isActive = i === this.activeCreatureIndex;

      // HP da criatura: se ativa, usa activeCreatureHp, senão busca do mapa
      let hp: number;
      let maxHp: number;

      if (isActive) {
        hp = this.activeCreatureHp;
        maxHp = this.activeCreatureMaxHp;
      } else {
        const owned = progress.creatures.find(c => c.instanceId === instanceId);
        const effectiveStats = owned ? getEffectiveStats(owned) : null;
        const maxHpValue = effectiveStats?.hp ?? def?.stats.hp ?? 100;
        hp = this.creatureHpByInstance.get(instanceId) ?? maxHpValue;
        maxHp = maxHpValue;
      }

      this.hpBarManager.updateAllyBar(instanceId, hp, maxHp, isActive);
    }

    // Atualiza barras de inimigos próximos
    const enemyData = this.getAllCreatures().map((wc) => ({
      id: wc.id,
      x: wc.sprite.x,
      y: wc.sprite.y,
      currentHp: wc.currentHp,
      maxHp: wc.maxHp,
      inCombat: this.state === "combat"
    }));

    this.hpBarManager.updateEnemyBars(enemyData, this.player.x, this.player.y);
  }

  /**
   * @deprecated Removido na Fase 2: Refatoração Multiplayer-First
   * Spawn de criaturas e recursos agora é sempre feito pelo servidor.
   * Esta função não é mais usada e será removida completamente no futuro.
   */
  // private spawnResourcesAndCreatures() { ... }

  update(time: number, delta: number) {
    const dt = delta / 1000;

    // Atualiza tempo de expedição primeiro
    // O timer é sincronizado pelo servidor via state updates
    // Fallback local apenas se servidor não enviar updates
    if (!this.useServerTimer) {
      this.expeditionTime += dt;
    }
    if (this.expeditionTime >= this.expeditionDuration) {
      // Se ainda não extraiu, falha a expedição
      if (this.state !== "extracted" && this.state !== "failed") {
        console.log("[Expedition] ⏱️ TEMPO ESGOTADO! Expedição falhou.");
        this.state = "failed";
        if (!this.telemetry.extractionFailed) {
          this.telemetry.extractionFailed = true;
          // Usar tempo do servidor se disponível, senão usar tempo local
          const finalTime = this.lastMatchState?.elapsedSeconds ?? this.expeditionTime;
          this.telemetry.timeSpent = finalTime;
          
          // Servidor já salva recompensas automaticamente quando extração completa
          // Não é mais necessário sync manual do cliente
          
          // Calcula métricas finais
          const timeMinutes = finalTime / 60;
          this.telemetry.resourcesPerMinute = this.telemetry.resourcesCollected / Math.max(0.1, timeMinutes);
          this.telemetry.creaturesPerMinute = this.telemetry.creaturesCaptured / Math.max(0.1, timeMinutes);
          this.telemetry.averageCaptureChance = this.telemetry.captureAttempts > 0
            ? this.telemetry.totalCaptureChanceSum / this.telemetry.captureAttempts
            : 0;
          
          // Log estruturado de falha
          const telemetryData = {
            "Tempo Total (s)": Math.floor(this.telemetry.timeSpent),
            "Tempo Total (min)": (this.telemetry.timeSpent / 60).toFixed(2),
            "Recursos Coletados": this.telemetry.resourcesCollected,
            "Recursos/min": this.telemetry.resourcesPerMinute.toFixed(2),
            "Criaturas Encontradas": this.telemetry.creaturesEncountered,
            "Tentativas de Captura": this.telemetry.captureAttempts,
            "Capturas Bem-sucedidas": this.telemetry.creaturesCaptured,
            "Taxa de Sucesso (%)": this.telemetry.captureAttempts > 0
              ? ((this.telemetry.creaturesCaptured / this.telemetry.captureAttempts) * 100).toFixed(1)
              : "0.0",
            "Chance Média de Captura (%)": (this.telemetry.averageCaptureChance * 100).toFixed(1),
            "Encontros de Combate": this.telemetry.combatEncounters,
            "Dano Causado": this.telemetry.damageDealt,
            "Projéteis Disparados": this.telemetry.projectilesFired,
            "Status": "FALHA (TEMPO ESGOTADO)"
          };
          
          console.log("[TELEMETRIA] Expedição falhou - tempo esgotado");
          console.table(telemetryData);
          
          // Mesmo em falha, criaturas ganham XP (sem bônus de extração)
          this.processCreatureXp(false);
        }
      }
    }

    if (this.state === "extracted" || this.state === "failed") {
      this.endSceneTimer += dt;
      // HUD já é atualizado no update() principal
      
      // Retorna à base após delay
      if (this.endSceneTimer >= this.endSceneDelay) {
        // Limpa conexão multiplayer se existir
        if (this.mpClient) {
          this.mpClient.disconnect(); // Desconecta do WebSocket antes de limpar referência
          this.mpClient = null;
        }
        for (const playerId of this.playerSprites.keys()) {
          this.destroyPlayerSprite(playerId);
        }
        this.playerSprites.clear();
        
        // Limpa o sistema de barras de HP antes de trocar de cena
        if (this.hpBarManager) {
          this.hpBarManager.destroy();
        }
        this.scene.start("BaseHubScene");
      }
      return;
    }
    
    // Atualiza cooldowns de ataque básico e habilidade especial
    if (this.basicAttackCooldown > 0) {
      this.basicAttackCooldown = Math.max(
        0,
        this.basicAttackCooldown - dt
      );
    }
    if (this.specialSkillCooldown > 0) {
      this.specialSkillCooldown = Math.max(
        0,
        this.specialSkillCooldown - dt
      );
    }

    // Atualiza indicador visual de tempo restante
    const timeRatio = Math.max(
      0,
      1 - this.expeditionTime / this.expeditionDuration
    );

    this.handleCreatureSwitching();
    
    // Bloquear movimento durante loading
    if (!this.loadingOverlay.visible) {
      this.movementSystem.update(dt, this.state);
      this.handleCombat(dt);
      this.handleInteractions(dt);
    } else {
      // Garantir que o jogador não se move durante loading
      if (this.player) {
        this.player.setVelocity(0, 0);
      }
    }
    
    this.state = this.projectileManager.update(dt, this.state) as ExpeditionState;
    
    this.skillZoneManager.update(dt);
    
    this.updateDangerRing(timeRatio);
    this.updateEnemyAI(dt);

    if (Phaser.Input.Keyboard.JustDown(this.debugPanelKey)) {
      this.debugPanel.toggle();
    }

    this.hudManager.update(
      this.state,
      this.expeditionTime,
      this.expeditionDuration,
      this.creaturesCaptured,
      this.expeditionResources,
      this.extractionSystem.progress,
      this.extractionSystem.required,
      this.endSceneTimer,
      this.endSceneDelay,
      this.dangerLowHpThreshold,
      this.activeCreatureHp,
      this.activeCreatureMaxHp,
      this.damageTakenRecently,
      this.expeditionInventory // Passar inventário de expedição atualizado
    );
    
    this.debugPanel.update(
      this.expeditionTime,
      this.expeditionDuration,
      this.telemetry,
      this.state,
      this.clientId,
      this.spriteManager.playerSpritesSize,
      this.worldState,
      this.spriteManager.creatureSpritesMap
    );
    
    this.skillCooldownUI.update(
      this.skillSystem.cooldown,
      this.skillSystem.cooldownTime,
      this.skillSystem.activeSkillKind,
      this.skillSystem.activeSkillName
    );
    
    // Atualiza renderização de jogadores remotos (interpolação suave)
    this.updateRemotePlayers(dt);
    
    this.spriteManager.updateCreatureSprites(dt, this.player.x, this.player.y);
    this.spriteManager.updateResourceSprites(dt);
    this.spriteManager.updatePlayerSprites(dt, this.player.x, this.player.y);
    
    // ProjectileManager já atualiza projéteis remotos no update()
    
    // Atualiza renderização de criaturas remotas do servidor (interpolação suave)
    this.updateServerCreatures(dt);
    
    // Atualiza renderização de recursos remotos do servidor
    this.updateServerResources(dt);
    
    // Atualiza barras de HP (jogador, aliados e inimigos)
    this.updateHPBars();
    
    this.minimapManager.update(this.player.x, this.player.y);
    
    // Registra tempo ativo da criatura atual
    this.trackActiveCreatureTime(dt);
    
    // FASE 4: Atualizar SkillSystem cooldown
    this.skillSystem.update(dt);
  }

  /**
   * Atualiza a barra visual de cooldown da skill.
   */
  private updateSkillCooldownBar() {
    if (!this.skillCooldownBarFill || !this.skillCooldownText) return;

    const maxWidth = 136; // skillBarWidth - 4

    if (this.specialSkillCooldownTime <= 0 || !this.activeSpecialSkillKind) {
      // Sem skill disponível
      this.skillCooldownBarFill.setSize(0, 16);
      this.skillCooldownText.setText("Sem skill");
      this.skillCooldownText.setColor("#6b7280");
      return;
    }

    if (this.specialSkillCooldown <= 0) {
      // Skill pronta
      this.skillCooldownBarFill.setSize(maxWidth, 16);
      this.skillCooldownBarFill.setFillStyle(0x22c55e); // Verde
      this.skillCooldownText.setText(`F: ${this.activeSpecialSkillName}`);
      this.skillCooldownText.setColor("#ffffff");
    } else {
      // Em cooldown
      const ratio = 1 - (this.specialSkillCooldown / this.specialSkillCooldownTime);
      const fillWidth = maxWidth * ratio;
      this.skillCooldownBarFill.setSize(fillWidth, 16);
      this.skillCooldownBarFill.setFillStyle(0x8b5cf6); // Roxo
      const seconds = Math.ceil(this.specialSkillCooldown);
      this.skillCooldownText.setText(`${this.activeSpecialSkillName} (${seconds}s)`);
      this.skillCooldownText.setColor("#d1d5db");
    }
  }

  private handleMovement(dt: number) {
    // Setas e WASD funcionam sempre que o jogador estiver em controle normal
    // (explorando, em combate, tentando captura ou extraindo). Apenas após
    // o término da expedição o movimento é bloqueado.
    if (this.state === "extracted" || this.state === "failed") {
      this.player.setVelocity(0, 0);
      return;
    }

    let vx = 0;
    let vy = 0;

    // Suporte a Setas e WASD
    if (this.cursors.left?.isDown || this.wasdKeys.A.isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.wasdKeys.D.isDown) vx += 1;
    if (this.cursors.up?.isDown || this.wasdKeys.W.isDown) vy -= 1;
    if (this.cursors.down?.isDown || this.wasdKeys.S.isDown) vy += 1;

    const len = Math.hypot(vx, vy) || 1;
    vx = (vx / len) * this.speed;
    vy = (vy / len) * this.speed;

    this.player.setVelocity(vx, vy);

    // Envia posição para o servidor apenas quando há input de movimento
    // Isso evita sobrecarregar o servidor com mensagens quando o jogador está parado
    if (this.mpClient && (vx !== 0 || vy !== 0)) {
      this.mpClient.sendPosition(this.player.x, this.player.y);
    }
  }

  private handleCombat(dt: number) {
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      const pointer = this.input.activePointer;
      // Força atualização das coordenadas do mundo baseado na posição atual do mouse
      pointer.updateWorldPoint(this.cameras.main);
      this.tryBasicAttack(pointer.worldX, pointer.worldY);
    }

    if (Phaser.Input.Keyboard.JustDown(this.skillKey)) {
      // FASE 4: Usar SkillSystem
      const pointer = this.input.activePointer;
      pointer.updateWorldPoint(this.cameras.main);
      this.skillSystem.tryUseSpecialSkill(pointer.worldX, pointer.worldY);
    }

    if (Phaser.Input.Keyboard.JustDown(this.healKey)) {
      this.tryUsePotion();
    }
  }

  /**
   * Tenta usar uma poção do inventário para curar a criatura ativa.
   * Prioriza poções mais básicas primeiro.
   */
  private tryUsePotion() {
    // Lista de poções em ordem de prioridade (básica primeiro)
    const potionPriority = ["potion-basic"];
    const progress = LocalPlayerState.getProgress();

    // Verifica se a criatura precisa de cura
    if (this.activeCreatureHp >= this.activeCreatureMaxHp) {
      // FASE 4: Usar FeedbackManager
      this.feedbackManager.createFloatingText(
        this.player.x,
        this.player.y - 30,
        "HP já está cheio!",
        0x22c55e
      );
      return;
    }

    // Encontra a primeira poção disponível
    const availablePotion = potionPriority.find(
      (potionId) => (progress.inventory.find((e) => e.itemId === potionId)?.quantity ?? 0) > 0
    );

    if (!availablePotion) {
      // FASE 4: Usar FeedbackManager
      this.feedbackManager.createFloatingText(
        this.player.x,
        this.player.y - 30,
        "Sem poções!",
        0xef4444
      );
      return;
    }

    // Consome a poção
    if (!LocalPlayerState.consumeItem(availablePotion, 1)) return;

    // Calcula a cura baseada no tipo de poção
    const healAmounts: Record<string, number> = {
      "potion-basic": 30
    };
    const healAmount = healAmounts[availablePotion] ?? 25;
    
    // Aplica a cura
    const oldHp = this.activeCreatureHp;
    this.activeCreatureHp = Math.min(
      this.activeCreatureMaxHp,
      this.activeCreatureHp + healAmount
    );
    const actualHeal = this.activeCreatureHp - oldHp;

    // Atualiza o HP salvo da criatura ativa
    if (this.activeCreatureInstanceId) {
      this.creatureHpByInstance.set(this.activeCreatureInstanceId, this.activeCreatureHp);
    }

    // Feedback visual
    // FASE 4: Usar FeedbackManager
    this.feedbackManager.createHealFeedback(this.player.x, this.player.y);
    this.feedbackManager.createFloatingText(
      this.player.x,
      this.player.y - 30,
      `+${actualHeal} HP`,
      0x22c55e
    );

    console.log("[POÇÃO] Usou", availablePotion, "| Curou", actualHeal, "HP");
  }

  /**
   * Cria feedback visual de cura (partículas verdes subindo).
   */
  private createHealFeedback(x: number, y: number) {
    // Partículas verdes subindo
    for (let i = 0; i < 8; i++) {
      const offsetX = (Math.random() - 0.5) * 30;
      const particle = this.add.circle(x + offsetX, y, 4, 0x22c55e, 0.8);
      
      this.tweens.add({
        targets: particle,
        y: y - 40 - Math.random() * 20,
        alpha: 0,
        scale: 0.5,
        duration: 600 + Math.random() * 200,
        onComplete: () => particle.destroy()
      });
    }

    // Círculo de cura expansivo
    const circle = this.add.circle(x, y, 0, 0x22c55e, 0.3);
    this.tweens.add({
      targets: circle,
      radius: 30,
      alpha: 0,
      duration: 400,
      onComplete: () => circle.destroy()
    });
  }

  /**
   * Permite trocar entre as criaturas da equipe (slots 1, 2 e 3).
   * Cada slot representa uma criatura diferente, com HP e stats próprios.
   */
  private handleCreatureSwitching() {
    if (this.activeTeamIds.length <= 1 || this.teamSwitchKeys.length === 0) return;

    for (let i = 0; i < this.teamSwitchKeys.length; i++) {
      const key = this.teamSwitchKeys[i];
      if (!key) continue;
      if (Phaser.Input.Keyboard.JustDown(key)) {
        if (i < this.activeTeamIds.length && i !== this.activeCreatureIndex) {
          this.setActiveCreatureByIndex(i);
          const label = this.activeCreatureDef?.name ?? `Criatura ${i + 1}`;
          // FASE 4: Usar FeedbackManager
          this.feedbackManager.createFloatingText(
            this.player.x,
            this.player.y - 40,
            `Criatura ativa: ${label}`,
            0x22c55e
          );
        }
      }
    }
  }

  /**
   * Registra o tempo ativo de cada criatura durante a expedição.
   * Usado para cálculo proporcional de XP.
   */
  private trackActiveCreatureTime(dt: number) {
    if (this.activeCreatureInstanceId) {
      const current = this.activeTimeByCreature.get(this.activeCreatureInstanceId) ?? 0;
      this.activeTimeByCreature.set(this.activeCreatureInstanceId, current + dt);
    }
  }

  /**
   * Atualiza a criatura ativa com base no índice da equipe.
   * Garante que cada criatura mantenha seu próprio HP durante a expedição.
   */
  private setActiveCreatureByIndex(index: number) {
    const progress = LocalPlayerState.getProgress();
    if (index < 0 || index >= this.activeTeamIds.length) return;

    // Salva o HP atual da criatura que estava ativa
    if (this.activeCreatureInstanceId) {
      this.creatureHpByInstance.set(
        this.activeCreatureInstanceId,
        this.activeCreatureHp
      );
    }

    const instanceId = this.activeTeamIds[index];
    const owned = progress.creatures.find((c) => c.instanceId === instanceId);
    const def = owned ? getCreatureById(owned.definitionId) ?? null : null;
    if (!owned || !def) return;

    this.activeCreatureIndex = index;
    this.activeCreatureInstanceId = instanceId;
    this.activeCreatureDef = def;

    const storedHp = this.creatureHpByInstance.get(instanceId);
    const effectiveStats = getEffectiveStats(owned);
    this.activeCreatureMaxHp = effectiveStats.hp;
    this.activeCreatureHp = Math.min(
      effectiveStats.hp,
      storedHp ?? owned.currentHp ?? effectiveStats.hp
    );

    this.speed = def.stats.moveSpeed;
    this.basicAttackCooldownTime = def.basicAttack.cooldown;
    this.specialSkillCooldownTime = def.stats.skillCooldown;
    this.activeSpecialSkillName = def.specialSkill.name;

    // Mapeia a definição para um tipo de habilidade concreta
    let skillKind: SpecialSkillKind | null = null;
    switch (def.id) {
      case "pyrognat":
        skillKind = "pyrognat_fire_fog";
        break;
      case "aquaryl":
        skillKind = "aquaryl_heal_wave";
        break;
      case "voltiger":
        skillKind = "voltiger_electric_surge";
        break;
      case "verdant":
        skillKind = "verdant_root_trap";
        break;
      default:
        // Fallback genérico para criaturas sem skill específica
        skillKind = null;
        console.warn(`[SKILL] Criatura ${def.id} não tem skill implementada`);
    }

    // Mantém campos antigos para compatibilidade (podem ser removidos depois)
    this.activeSpecialSkillKind = skillKind;
    this.activeSpecialSkillName = def.specialSkill.name;

    // FASE 4: Atualiza o SkillSystem com a skill ativa (se já foi inicializado)
    const creatureTheme = getCreatureTheme(def.id);
    if (this.skillSystem) {
      this.skillSystem.setActiveSkill(
        skillKind,
        def.specialSkill.name,
        def.stats.skillCooldown,
        def,
        creatureTheme
      );
    }

    // Aplica tema visual da criatura ativa
    this.activeCreatureTheme = creatureTheme;
    this.updatePlayerVisual();
    
    // Atualiza a cor da barra de HP para refletir a criatura ativa
    if (this.hpBarManager) {
      this.hpBarManager.updatePlayerBarColor(def);
    }
    
    // Notificar servidor sobre mudança de criatura ativa
    if (this.mpClient) {
      this.mpClient.sendActiveCreatureUpdate(
        instanceId,
        this.activeCreatureHp,
        this.activeCreatureMaxHp
      );
      console.log(`[MP] Criatura ativa atualizada: ${def.name} (${this.activeCreatureHp}/${this.activeCreatureMaxHp} HP)`);
    }
    
    // Continua com atualização da barra de HP
    if (this.hpBarManager) {
      
      // Atualiza estado ativo/inativo das barras aliadas
      for (let i = 0; i < this.activeTeamIds.length; i++) {
        const allyInstanceId = this.activeTeamIds[i];
        const allyOwned = progress.creatures.find((c) => c.instanceId === allyInstanceId);
        const allyDef = allyOwned ? getCreatureById(allyOwned.definitionId) ?? null : null;
        this.hpBarManager.setAllyBarActive(allyInstanceId, i === index, allyDef);
      }
    }
  }

  /**
   * Atualiza a aparência visual do player para refletir a criatura ativa.
   * Muda a cor do círculo do jogador de acordo com o tema da criatura.
   */
  private updatePlayerVisual() {
    if (!this.activeCreatureTheme || !this.player) return;

    const theme = this.activeCreatureTheme;
    
    // Recria a textura do círculo do player com a cor da criatura ativa
    const g = this.add.graphics();
    g.fillStyle(theme.primaryColor, 1);
    g.fillCircle(16, 16, 16);
    g.lineStyle(2, theme.strokeColor, 1);
    g.strokeCircle(16, 16, 15);
    g.generateTexture("playerCircle", 32, 32);
    g.destroy();
    this.player.setTexture("playerCircle");
  }

  private tryBasicAttack(targetX: number, targetY: number) {
    // Bloquear ataques durante loading
    if (this.loadingOverlay.visible) return;
    if (this.basicAttackCooldown > 0) return;
    const def = this.activeCreatureDef;

    // Inicia cooldown imediatamente (local)
    this.basicAttackCooldown = this.basicAttackCooldownTime;

    // Em modo multiplayer, envia intent ao servidor
    if (this.mpClient) {
      // Enviar creatureId da criatura ativa para o servidor
      const creatureId = def?.id;
      this.mpClient.sendAttack(targetX, targetY, creatureId, "basic");
      
      // Usar o visual da criatura ativa para predição local
      const basic = def?.basicAttack;
      const theme = this.activeCreatureTheme;
      
      // Verificar se é ataque melee ou ranged
      if (basic && !basic.isProjectile) {
        // Ataque melee: criar visual de arco
        const attackAngle = Phaser.Math.Angle.Between(
          this.player.x,
          this.player.y,
          targetX,
          targetY
        );
        this.createMeleeSwingVisual(attackAngle, basic.range, theme);
      } else {
        // Ataque ranged: criar projétil visual com cores da criatura
        const angle = Phaser.Math.Angle.Between(
          this.player.x,
          this.player.y,
          targetX,
          targetY
        );

        const projectileColor = theme?.attackColor ?? 0xf97316;
        const projectileRadius = theme?.projectileRadius ?? 4;
        const speed = COMBAT_CONFIG.projectileSpeed;
        
        const sprite = this.add.circle(
          this.player.x,
          this.player.y,
          projectileRadius,
          projectileColor
        );
        sprite.setStrokeStyle(1, theme?.strokeColor ?? 0xea580c, 0.8);
        this.physics.add.existing(sprite);
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        body.setAllowGravity(false);

        // Partícula de disparo para feedback visual
        this.createMuzzleFlash(this.player.x, this.player.y, angle, theme);

        // Lifetime baseado no alcance da criatura
        const lifetime = basic?.range && basic.range > 0
          ? basic.range / COMBAT_CONFIG.projectileSpeed
          : COMBAT_CONFIG.projectileLifetime;

        // FASE 4: Usar ProjectileManager ao invés de this.projectiles
        this.projectileManager.addProjectile({
          sprite,
          lifetime
        });
      }
      
      this.telemetry.projectilesFired += 1;
      this.state = "combat";
      
      return;
    }

    // Comportamento single-player (original)
    // Se por algum motivo não houver criatura ativa, mantém o comportamento antigo
    if (!def) {
      const angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        targetX,
        targetY
      );

      const speed = COMBAT_CONFIG.projectileSpeed;
      const sprite = this.add.circle(this.player.x, this.player.y, 4, 0xf97316);
      this.physics.add.existing(sprite);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      body.setAllowGravity(false);

      // FASE 4: Usar ProjectileManager ao invés de this.projectiles
      this.projectileManager.addProjectile({
        sprite,
        lifetime: COMBAT_CONFIG.projectileLifetime
      });
      this.basicAttackCooldown = this.basicAttackCooldownTime;
      this.telemetry.projectilesFired += 1;
      this.state = "combat";
      return;
    }

    const basic = def.basicAttack;

    // Ataques corpo a corpo: área curta ao redor do jogador, sem projétil
    if (!basic.isProjectile) {
      const radius = basic.range;
      let hits = 0;
      const theme = this.activeCreatureTheme;

      // Visual da área de ataque melee (arco na direção do cursor)
      const attackAngle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        targetX,
        targetY
      );
      this.createMeleeSwingVisual(attackAngle, radius, theme);

      // FASE 4A: Usa getAllCreatures() ao invés de wildCreatures
      const creaturesInRange = this.getAllCreatures();
      const creaturesToRemove: string[] = [];
      
      for (const wc of creaturesInRange) {
        const dx = wc.sprite.x - this.player.x;
        const dy = wc.sprite.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        
        // Verifica se está no arco de ataque (90° na direção do cursor)
        const angleToCreature = Math.atan2(dy, dx);
        const angleDiff = Phaser.Math.Angle.Wrap(angleToCreature - attackAngle);
        const inArc = Math.abs(angleDiff) <= Math.PI / 4; // 45° para cada lado
        
        if (dist <= radius && inArc) {
          // Atualiza HP no worldState
          const newHp = wc.currentHp - basic.damage;
          this.worldState.updateCreature(wc.id, { currentHp: newHp });
          wc.currentHp = newHp; // Atualiza também o sprite local
          
          this.telemetry.damageDealt += basic.damage;
          this.telemetry.combatEncounters += 1;
          hits++;

          // Efeito de impacto visual no inimigo atingido
          this.createHitImpactEffect(wc.sprite.x, wc.sprite.y, theme);

          const ratio = Math.max(0, wc.currentHp / wc.maxHp);
          const originalColor = wc.sprite.fillColor;
          
          // Flash de hit na criatura
          wc.sprite.setFillStyle(theme?.hitFlashColor ?? 0xffffff);
          this.time.delayedCall(80, () => {
            if (wc.currentHp > 0) {
              wc.sprite.setFillStyle(
                ratio > 0.5 ? originalColor : ratio > 0.25 ? 0xfacc15 : 0xef4444
              );
            }
          });

          // Pequeno knockback
          if (dist > 0) {
            const knockbackDist = 12;
            const nx = dx / dist;
            const ny = dy / dist;
            wc.sprite.x += nx * knockbackDist;
            wc.sprite.y += ny * knockbackDist;
            
            // Atualiza posição no worldState
            this.worldState.updateCreature(wc.id, { x: wc.sprite.x, y: wc.sprite.y });
          }

          if (wc.currentHp <= 0) {
            this.resourcesCollected += 1;
            this.creaturesDefeatedCount += 1;
            this.createDeathEffect(wc.sprite.x, wc.sprite.y, theme);
            creaturesToRemove.push(wc.id);
          }
        }
      }

      // Remove criaturas mortas do worldState
      for (const creatureId of creaturesToRemove) {
        this.removeCreature(creatureId);
      }
      
      // FASE 6: wildCreatures removido - removeCreature já atualiza worldState

      if (hits > 0) {
        this.state = "combat";
      }

      this.telemetry.projectilesFired += 1; // ainda contamos como "ataque básico"
      return;
    }

    // Ataques à distância: projétil com alcance baseado no range da criatura
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      targetX,
      targetY
    );

    const theme = this.activeCreatureTheme;
    const projectileColor = theme?.attackColor ?? 0xf97316;
    const projectileRadius = theme?.projectileRadius ?? 4;

    const speed = COMBAT_CONFIG.projectileSpeed;
    const sprite = this.add.circle(
      this.player.x,
      this.player.y,
      projectileRadius,
      projectileColor
    );
    sprite.setStrokeStyle(1, theme?.strokeColor ?? 0xea580c, 0.8);
    this.physics.add.existing(sprite);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    body.setAllowGravity(false);

    // Partícula de disparo para feedback visual
    this.createMuzzleFlash(this.player.x, this.player.y, angle, theme);

    // Lifetime aproximado em função do alcance declarado do ataque básico
    const lifetime =
      basic.range > 0
        ? basic.range / COMBAT_CONFIG.projectileSpeed
        : COMBAT_CONFIG.projectileLifetime;

    (sprite as any).basicDamage = basic.damage;

    // FASE 4: Usar ProjectileManager ao invés de this.projectiles
    this.projectileManager.addProjectile({
      sprite,
      lifetime
    });
    this.telemetry.projectilesFired += 1;

    this.state = "combat";
  }

  /**
   * Cria um visual de arco para ataques melee, mostrando a área de impacto.
   */
  private createMeleeSwingVisual(
    angle: number,
    radius: number,
    theme: CreatureTheme | null
  ) {
    const color = theme?.attackColor ?? 0x4ade80;
    const startAngle = angle - Math.PI / 4;
    const endAngle = angle + Math.PI / 4;

    // Desenha um arco que representa a área de ataque
    const graphics = this.add.graphics();
    graphics.lineStyle(3, color, 0.8);
    graphics.beginPath();
    graphics.arc(
      this.player.x,
      this.player.y,
      radius,
      startAngle,
      endAngle,
      false
    );
    graphics.strokePath();

    // Preenche o arco com cor semi-transparente
    graphics.fillStyle(color, 0.25);
    graphics.beginPath();
    graphics.moveTo(this.player.x, this.player.y);
    graphics.arc(
      this.player.x,
      this.player.y,
      radius,
      startAngle,
      endAngle,
      false
    );
    graphics.closePath();
    graphics.fillPath();

    // Fade out rápido
    this.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 150,
      onComplete: () => graphics.destroy()
    });
  }

  /**
   * Cria um efeito visual de impacto quando um ataque acerta.
   */
  private createHitImpactEffect(
    x: number,
    y: number,
    theme: CreatureTheme | null
  ) {
    const color = theme?.particleColor ?? 0xffffff;
    
    // Círculo de impacto que expande
    const impact = this.add.circle(x, y, 4, color, 0.8);
    this.tweens.add({
      targets: impact,
      radius: 18,
      alpha: 0,
      duration: 150,
      onComplete: () => impact.destroy()
    });

    // Pequenas partículas que espalham
    for (let i = 0; i < 4; i++) {
      const particleAngle = (Math.PI * 2 * i) / 4 + Math.random() * 0.5;
      const particle = this.add.circle(x, y, 2, color, 1);
      const distance = 15 + Math.random() * 10;

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(particleAngle) * distance,
        y: y + Math.sin(particleAngle) * distance,
        alpha: 0,
        duration: 200,
        onComplete: () => particle.destroy()
      });
    }
  }

  /**
   * Cria um efeito de morte quando uma criatura é derrotada.
   */
  private createDeathEffect(x: number, y: number, theme: CreatureTheme | null) {
    const color = theme?.attackColor ?? 0xef4444;

    // Explosão de partículas
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const particle = this.add.circle(x, y, 3, color, 1);
      const distance = 25 + Math.random() * 15;

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: 350,
        onComplete: () => particle.destroy()
      });
    }

    // Anel de expansão
    const ring = this.add.circle(x, y, 5, 0x000000, 0);
    ring.setStrokeStyle(2, color, 1);
    this.tweens.add({
      targets: ring,
      radius: 30,
      alpha: 0,
      duration: 300,
      onComplete: () => ring.destroy()
    });
  }

  /**
   * Cria um flash de disparo quando um projétil é lançado.
   */
  private createMuzzleFlash(
    x: number,
    y: number,
    angle: number,
    theme: CreatureTheme | null
  ) {
    const color = theme?.particleColor ?? 0xfbbf24;

    // Flash na posição do jogador
    const flash = this.add.circle(x, y, 8, color, 0.6);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 100,
      onComplete: () => flash.destroy()
    });

    // Partícula que sai na direção do tiro
    const offsetX = Math.cos(angle) * 20;
    const offsetY = Math.sin(angle) * 20;
    const spark = this.add.circle(x + offsetX * 0.5, y + offsetY * 0.5, 3, color, 1);
    this.tweens.add({
      targets: spark,
      x: x + offsetX,
      y: y + offsetY,
      alpha: 0,
      duration: 150,
      onComplete: () => spark.destroy()
    });
  }


  /**
   * Pyrognat – Nevoeiro Incendiário:
   * Cria uma área de fogo no ponto do cursor que causa dano periódico
   * em criaturas selvagens que passarem dentro da zona.
   */
  private castPyrognatFireFog() {
    const pointer = this.input.activePointer;
    // Atualiza coordenadas do mundo baseado na posição atual do mouse
    pointer.updateWorldPoint(this.cameras.main);
    const x = pointer.worldX;
    const y = pointer.worldY;
    const theme = getCreatureTheme("pyrognat");

    const radius = 70;
    const duration = 4; // segundos

    const circle = this.add.circle(x, y, radius, theme.primaryColor, 0.25);
    circle.setStrokeStyle(2, theme.attackColor, 0.9);

    this.skillZones.push({
      sprite: circle,
      kind: "fire_fog",
      remaining: duration,
      tickTimer: 0
    });

    // FASE 4: Usar FeedbackManager
    this.feedbackManager.createFloatingText(x, y - radius - 10, "Nevoeiro Incendiário!", theme.attackColor);
  }

  /**
   * Aquaryl – Maré Curativa:
   * Cura parte do HP da criatura ativa e cria um pequeno efeito visual
   * de água ao redor do jogador.
   */
  private castAquarylHealWave() {
    const theme = getCreatureTheme("aquaryl");
    const healAmount = Math.max(15, this.activeCreatureMaxHp * 0.25);
    this.activeCreatureHp = Math.min(
      this.activeCreatureMaxHp,
      this.activeCreatureHp + healAmount
    );

    // Círculo principal de cura
    const circle = this.add.circle(
      this.player.x,
      this.player.y,
      0,
      theme.primaryColor,
      0.4
    );

    this.tweens.add({
      targets: circle,
      radius: 60,
      alpha: 0,
      duration: 500,
      onComplete: () => circle.destroy()
    });

    // Partículas de água subindo
    for (let i = 0; i < 6; i++) {
      const offsetX = Phaser.Math.Between(-25, 25);
      const particle = this.add.circle(
        this.player.x + offsetX,
        this.player.y + 20,
        4,
        theme.particleColor,
        0.8
      );
      this.tweens.add({
        targets: particle,
        y: this.player.y - 40,
        alpha: 0,
        duration: 600,
        delay: i * 50,
        onComplete: () => particle.destroy()
      });
    }

    this.feedbackManager.createFloatingText(
      this.player.x,
      this.player.y - 30,
      `+${Math.floor(healAmount)} HP`,
      theme.primaryColor
    );
  }

  /**
   * Voltiger – Surto Elétrico:
   * Explosão ao redor do jogador que causa dano moderado e empurra
   * criaturas próximas para longe.
   */
  private castVoltigerElectricSurge() {
    const theme = getCreatureTheme("voltiger");
    const radius = 90;
    const pushDistance = 40;
    const damage = 18;

    // Círculo de explosão elétrica
    const circle = this.add.circle(
      this.player.x,
      this.player.y,
      0,
      theme.primaryColor,
      0.35
    );
    this.tweens.add({
      targets: circle,
      radius,
      alpha: 0,
      duration: 350,
      onComplete: () => circle.destroy()
    });

    // Raios elétricos irradiando do centro
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const lightning = this.add.graphics();
      lightning.lineStyle(2, theme.attackColor, 0.9);
      lightning.beginPath();
      lightning.moveTo(this.player.x, this.player.y);
      
      // Linha zigzag para simular raio
      let px = this.player.x;
      let py = this.player.y;
      const segments = 4;
      for (let s = 1; s <= segments; s++) {
        const progress = s / segments;
        const targetX = this.player.x + Math.cos(angle) * radius * progress;
        const targetY = this.player.y + Math.sin(angle) * radius * progress;
        const jitterX = (Math.random() - 0.5) * 15;
        const jitterY = (Math.random() - 0.5) * 15;
        px = targetX + (s < segments ? jitterX : 0);
        py = targetY + (s < segments ? jitterY : 0);
        lightning.lineTo(px, py);
      }
      lightning.strokePath();

      this.tweens.add({
        targets: lightning,
        alpha: 0,
        duration: 250,
        onComplete: () => lightning.destroy()
      });
    }

    // FASE 4A: Usa getAllCreatures()
    const creaturesInRange = this.getAllCreatures();
    const creaturesToRemove: string[] = [];
    
    for (const wc of creaturesInRange) {
      const dx = wc.sprite.x - this.player.x;
      const dy = wc.sprite.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;

        wc.sprite.x += nx * pushDistance;
        wc.sprite.y += ny * pushDistance;

        const newHp = wc.currentHp - damage;
        wc.currentHp = newHp;
        this.worldState.updateCreature(wc.id, { 
          currentHp: newHp,
          x: wc.sprite.x,
          y: wc.sprite.y
        });
        this.telemetry.damageDealt += damage;

        // Flash elétrico no inimigo
        const originalColor = wc.sprite.fillColor;
        wc.sprite.setFillStyle(theme.hitFlashColor);
        this.createHitImpactEffect(wc.sprite.x, wc.sprite.y, theme);
        
        this.time.delayedCall(100, () => {
          if (wc.currentHp > 0) {
            const ratio = Math.max(0, wc.currentHp / wc.maxHp);
            wc.sprite.setFillStyle(ratio > 0.5 ? originalColor : 0xfacc15);
          }
        });
        
        // Marca para remoção se morreu
        if (wc.currentHp <= 0) {
          creaturesToRemove.push(wc.id);
        }
      }
    }

    // Remove criaturas derrotadas do worldState
    for (const creatureId of creaturesToRemove) {
      const sprite = this.getCreatureSprite(creatureId);
      if (sprite) {
        this.createDeathEffect(sprite.sprite.x, sprite.sprite.y, theme);
        this.resourcesCollected += 1;
        this.creaturesDefeatedCount += 1;
      }
      this.removeCreature(creatureId);
    }

    // FASE 6: wildCreatures removido - removeCreature já destrói sprites e cria efeitos

    this.feedbackManager.createFloatingText(
      this.player.x,
      this.player.y - 40,
      "Surto Elétrico!",
      theme.primaryColor
    );
  }

  /**
   * Verdant – Raízes Prendentes:
   * Cria uma área de raízes no ponto do cursor que prende e causa dano
   * em criaturas selvagens que passarem dentro.
   */
  private castVerdantRootTrap() {
    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    const x = pointer.worldX;
    const y = pointer.worldY;
    const theme = getCreatureTheme("verdant");

    const radius = 60;
    const duration = 3.5; // segundos
    const damagePerTick = 8;
    const slowAmount = 0.5; // 50% de slow

    // Círculo verde de raízes
    const circle = this.add.circle(x, y, radius, theme.primaryColor, 0.3);
    circle.setStrokeStyle(3, theme.attackColor, 0.9);

    // Adiciona pequenas "raízes" espalhadas na área
    const rootLines: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.3;
      const root = this.add.graphics();
      root.lineStyle(2, theme.attackColor, 0.7);
      root.beginPath();
      root.moveTo(x, y);
      const endX = x + Math.cos(angle) * (radius * 0.8 + Math.random() * 10);
      const endY = y + Math.sin(angle) * (radius * 0.8 + Math.random() * 10);
      
      // Linha curva para parecer raiz
      const midX = (x + endX) / 2 + (Math.random() - 0.5) * 20;
      const midY = (y + endY) / 2 + (Math.random() - 0.5) * 20;
      root.lineTo(midX, midY);
      root.lineTo(endX, endY);
      root.strokePath();
      rootLines.push(root);
    }

    // Sistema de zona de skill com tipo expandido
    const rootZone = {
      sprite: circle,
      kind: "fire_fog" as const, // Reutiliza o sistema de zonas
      remaining: duration,
      tickTimer: 0,
      customData: {
        damagePerTick,
        slowAmount,
        rootLines,
        x,
        y,
        radius
      }
    };

    this.skillZones.push(rootZone);

    // Timer para destruir as raízes visuais junto com a zona
    this.time.delayedCall(duration * 1000, () => {
      rootLines.forEach(r => r.destroy());
    });

    // FASE 4: Usar FeedbackManager
    this.feedbackManager.createFloatingText(x, y - radius - 10, "Raízes Prendentes!", theme.primaryColor);
  }


  private updateSkillZones(dt: number) {
    if (this.skillZones.length === 0) return;

    const remainingZones: SkillZone[] = [];

    for (const zone of this.skillZones) {
      zone.remaining -= dt;
      zone.tickTimer -= dt;

      if (zone.remaining <= 0) {
        zone.sprite.destroy();
        continue;
      }

      if (zone.kind === "fire_fog" && zone.tickTimer <= 0) {
        zone.tickTimer = 0.5; // aplica dano a cada 0.5s

        const bounds = zone.sprite.getBounds();
        const centerX = bounds.centerX;
        const centerY = bounds.centerY;
        const radius = zone.sprite.radius ?? 70;
        const damagePerTick = 8;

        // FASE 4A: Usa getAllCreatures()
        const creaturesInRange = this.getAllCreatures();
        
        for (const wc of creaturesInRange) {
          const dx = wc.sprite.x - centerX;
          const dy = wc.sprite.y - centerY;
          const dist = Math.hypot(dx, dy);
          if (dist <= radius) {
            const newHp = wc.currentHp - damagePerTick;
            wc.currentHp = newHp;
            this.worldState.updateCreature(wc.id, { currentHp: newHp });
            this.telemetry.damageDealt += damagePerTick;

            const ratio = Math.max(0, wc.currentHp / wc.maxHp);
            wc.sprite.setFillStyle(ratio > 0.5 ? 0xf97373 : 0xfacc15);
          }
        }

        // FASE 6: Criaturas derrotadas pelo nevoeiro já foram removidas via removeCreature()
      }

      remainingZones.push(zone);
    }

    this.skillZones = remainingZones;
  }

  // ============================================================================
  // SISTEMA DE IA DE INIMIGOS
  // ============================================================================

  /**
   * Atualiza a IA de todos os inimigos.
   * 
   * Arquitetura multiplayer-first: IA é sempre processada no servidor.
   * Cliente apenas atualiza visuais baseado no estado recebido.
   */
  private updateEnemyAI(dt: number) {
    if (this.state === "extracted" || this.state === "failed") return;
    
    // IA é processada no servidor e recebida via creaturesUpdate
    // Cliente apenas atualiza visuais (indicadores de ataque, aggro, etc)
    const creaturesInRange = this.getAllCreatures();
    for (const wc of creaturesInRange) {
      this.updateCreatureVisuals(wc);
    }
  }

  /**
   * Comportamento de IA para inimigos melee.
   * - Persegue o jogador quando detectado
   * - Ataca corpo a corpo quando em alcance
   * - Patrulha levemente quando ocioso
   */
  private updateMeleeAI(
    wc: RemoteCreatureSprite,
    config: EnemyBehaviorConfig,
    dt: number,
    distToPlayer: number,
    dx: number,
    dy: number
  ) {
    // Estado de ataque (windup)
    if (wc.aiState === "attacking") {
      wc.windupTimer -= dt;
      if (wc.windupTimer <= 0) {
        // Executa o ataque melee
        if (distToPlayer <= config.attackRange * 1.5) {
          this.dealDamageToPlayer(config.attackDamage);
          this.createMeleeAttackVisualEnemy(wc.sprite.x, wc.sprite.y, dx, dy);
        }
        wc.attackCooldownRemaining = config.attackCooldown;
        wc.aiState = "chasing";
      }
      return;
    }

    // Detecta jogador
    if (distToPlayer <= config.detectionRange) {
      // Está em alcance de ataque?
      if (distToPlayer <= config.attackRange && wc.attackCooldownRemaining <= 0) {
        wc.aiState = "attacking";
        wc.windupTimer = config.attackWindup;
        return;
      }

      // Persegue o jogador
      wc.aiState = "chasing";
      const speed = config.moveSpeed;
      const normalizedDx = dx / distToPlayer;
      const normalizedDy = dy / distToPlayer;
      wc.sprite.x += normalizedDx * speed * dt;
      wc.sprite.y += normalizedDy * speed * dt;
    } else {
      // Patrulha em torno do ponto de origem
      wc.aiState = "idle";
      wc.patrolTimer += dt;

      const patrolRadius = 30;
      const patrolSpeed = 0.5;
      const offsetX = Math.sin(wc.patrolTimer * patrolSpeed) * patrolRadius;
      const offsetY = Math.cos(wc.patrolTimer * patrolSpeed * 0.7) * patrolRadius;

      const targetX = wc.patrolOrigin.x + offsetX;
      const targetY = wc.patrolOrigin.y + offsetY;
      const toTargetX = targetX - wc.sprite.x;
      const toTargetY = targetY - wc.sprite.y;
      const distToTarget = Math.hypot(toTargetX, toTargetY);

      if (distToTarget > 2) {
        const patrolMoveSpeed = config.moveSpeed * 0.3;
        wc.sprite.x += (toTargetX / distToTarget) * patrolMoveSpeed * dt;
        wc.sprite.y += (toTargetY / distToTarget) * patrolMoveSpeed * dt;
      }
    }
  }

  /**
   * Comportamento de IA para inimigos ranged.
   * - Mantém distância do jogador (kiteia)
   * - Atira projéteis quando em alcance de ataque
   * - Recua se o jogador chegar muito perto
   */
  private updateRangedAI(
    wc: RemoteCreatureSprite,
    config: EnemyBehaviorConfig,
    dt: number,
    distToPlayer: number,
    dx: number,
    dy: number
  ) {
    const preferredDist = config.preferredDistance ?? 120;

    // Estado de ataque (windup)
    if (wc.aiState === "attacking") {
      wc.windupTimer -= dt;
      if (wc.windupTimer <= 0) {
        this.fireEnemyProjectile(wc, config, dx, dy, distToPlayer);
        wc.attackCooldownRemaining = config.attackCooldown;
        wc.aiState = distToPlayer < preferredDist ? "retreating" : "chasing";
      }
      return;
    }

    // Detecta jogador
    if (distToPlayer <= config.detectionRange) {
      // Se jogador está muito perto, recua
      if (distToPlayer < preferredDist * 0.7) {
        wc.aiState = "retreating";
        const speed = config.moveSpeed;
        const normalizedDx = dx / distToPlayer;
        const normalizedDy = dy / distToPlayer;
        wc.sprite.x -= normalizedDx * speed * dt;
        wc.sprite.y -= normalizedDy * speed * dt;

        // Tenta atirar enquanto recua
        if (distToPlayer <= config.attackRange && wc.attackCooldownRemaining <= 0) {
          wc.aiState = "attacking";
          wc.windupTimer = config.attackWindup;
        }
        return;
      }

      // Está em alcance de ataque?
      if (distToPlayer <= config.attackRange && wc.attackCooldownRemaining <= 0) {
        wc.aiState = "attacking";
        wc.windupTimer = config.attackWindup;
        return;
      }

      // Se está muito longe, aproxima-se
      if (distToPlayer > preferredDist * 1.2) {
        wc.aiState = "chasing";
        const speed = config.moveSpeed * 0.7;
        const normalizedDx = dx / distToPlayer;
        const normalizedDy = dy / distToPlayer;
        wc.sprite.x += normalizedDx * speed * dt;
        wc.sprite.y += normalizedDy * speed * dt;
      } else {
        // Circula levemente
        wc.aiState = "chasing";
        wc.patrolTimer += dt;
        const strafeSpeed = 25;
        const strafeOffset = Math.sin(wc.patrolTimer * 2) * strafeSpeed * dt;
        const perpX = -dy / distToPlayer;
        const perpY = dx / distToPlayer;
        wc.sprite.x += perpX * strafeOffset;
        wc.sprite.y += perpY * strafeOffset;
      }
    } else {
      // Patrulha
      wc.aiState = "idle";
      wc.patrolTimer += dt;

      const patrolRadius = 40;
      const patrolSpeed = 0.4;
      const offsetX = Math.sin(wc.patrolTimer * patrolSpeed) * patrolRadius;
      const offsetY = Math.cos(wc.patrolTimer * patrolSpeed * 0.6) * patrolRadius;

      const targetX = wc.patrolOrigin.x + offsetX;
      const targetY = wc.patrolOrigin.y + offsetY;
      const toTargetX = targetX - wc.sprite.x;
      const toTargetY = targetY - wc.sprite.y;
      const distToTarget = Math.hypot(toTargetX, toTargetY);

      if (distToTarget > 2) {
        const patrolMoveSpeed = config.moveSpeed * 0.25;
        wc.sprite.x += (toTargetX / distToTarget) * patrolMoveSpeed * dt;
        wc.sprite.y += (toTargetY / distToTarget) * patrolMoveSpeed * dt;
      }
    }
  }

  /**
   * Dispara um projétil de um inimigo ranged em direção ao jogador.
   */
  private fireEnemyProjectile(
    wc: RemoteCreatureSprite,
    config: EnemyBehaviorConfig,
    dx: number,
    dy: number,
    dist: number
  ) {
    const speed = config.projectileSpeed ?? 200;

    const normalizedDx = dx / dist;
    const normalizedDy = dy / dist;

    const sprite = this.add.circle(
      wc.sprite.x,
      wc.sprite.y,
      ENEMY_VISUAL_CONFIG.enemyProjectileRadius,
      ENEMY_VISUAL_CONFIG.enemyProjectileColor
    );
    sprite.setStrokeStyle(1, 0xffffff, 0.5);

    // FASE 4: Usar ProjectileManager ao invés de this.enemyProjectiles
    this.projectileManager.addEnemyProjectile({
      sprite,
      lifetime: ENEMY_VISUAL_CONFIG.enemyProjectileLifetime,
      damage: config.attackDamage,
      velocityX: normalizedDx * speed,
      velocityY: normalizedDy * speed
    });
  }

  /**
   * Cria um efeito visual para ataque melee de inimigo.
   */
  private createMeleeAttackVisualEnemy(x: number, y: number, dx: number, dy: number) {
    const dist = Math.hypot(dx, dy);
    const normalizedDx = dist > 0 ? dx / dist : 0;
    const normalizedDy = dist > 0 ? dy / dist : 1;

    const attackX = x + normalizedDx * 20;
    const attackY = y + normalizedDy * 20;

    const arc = this.add.circle(attackX, attackY, 25, 0xef4444, 0.4);
    arc.setStrokeStyle(2, 0xfca5a5, 0.8);

    this.tweens.add({
      targets: arc,
      radius: 35,
      alpha: 0,
      duration: 200,
      onComplete: () => arc.destroy()
    });
  }

  /**
   * Aplica dano ao jogador (usada por ataques de inimigos).
   */
  private dealDamageToPlayer(damage: number) {
    if (this.state === "extracted" || this.state === "failed") return;

    this.activeCreatureHp = Math.max(0, this.activeCreatureHp - damage);
    this.damageTakenRecently += damage;
    this.damageTakenDecayTimer = 0.5;
    this.telemetry.damageTaken += damage;
    
    // Sinaliza para o sistema de barras de HP que o jogador tomou dano
    this.playerTookDamageThisFrame = true;

    // FASE 4: Usar FeedbackManager
    this.feedbackManager.createFloatingText(
      this.player.x,
      this.player.y - 30,
      `-${damage}`,
      0xef4444
    );

    const originalTint = this.player.tintTopLeft;
    this.player.setTint(0xef4444);
    this.time.delayedCall(100, () => {
      this.player.setTint(originalTint);
    });

    if (this.activeCreatureHp <= 0) {
      this.handlePlayerDeathByEnemy();
    }
  }

  /**
   * Processa a morte do jogador por dano de inimigo.
   */
  private handlePlayerDeathByEnemy() {
    if (this.state === "failed") return;

    console.log("[Expedition] 💀 JOGADOR MORREU! Expedição falhou.");
    this.state = "failed";
    if (!this.telemetry.extractionFailed) {
      this.telemetry.extractionFailed = true;
      // Usar tempo do servidor se disponível, senão usar tempo local
      const finalTime = this.lastMatchState?.elapsedSeconds ?? this.expeditionTime;
      this.telemetry.timeSpent = finalTime;

      // Servidor já salva recompensas automaticamente quando extração completa
      // Não é mais necessário sync manual do cliente

      const timeMinutes = finalTime / 60;
      this.telemetry.resourcesPerMinute =
        this.telemetry.resourcesCollected / Math.max(0.1, timeMinutes);
      this.telemetry.creaturesPerMinute =
        this.telemetry.creaturesCaptured / Math.max(0.1, timeMinutes);
      this.telemetry.averageCaptureChance =
        this.telemetry.captureAttempts > 0
          ? this.telemetry.totalCaptureChanceSum / this.telemetry.captureAttempts
          : 0;

      console.log("[TELEMETRIA] Expedição falhou - morte em combate (IA)");
      console.table({
        "Tempo Total (s)": Math.floor(this.telemetry.timeSpent),
        "Recursos Coletados": this.telemetry.resourcesCollected,
        "Dano Recebido": this.telemetry.damageTaken.toFixed(1),
        Status: "FALHA (MORTE EM COMBATE)"
      });
      
      // Mesmo em falha, criaturas ganham XP (sem bônus de extração)
      this.processCreatureXp(false);
    }
  }

  /**
   * FASE 7: Atualiza visuais de feedback da IA.
   * Agora usa RemoteCreatureSprite (interface unificada).
   * 
   * CORREÇÃO MULTIPLAYER: Agora detecta quando windupTimer termina e reproduz animação de ataque.
   */
  private updateCreatureVisuals(wc: RemoteCreatureSprite) {
    // Atualiza posição do indicador de aggro
    if (wc.aggroIndicator) {
      wc.aggroIndicator.setPosition(wc.sprite.x, wc.sprite.y);

      if (wc.aiState === "chasing" || wc.aiState === "attacking" || wc.aiState === "retreating") {
        wc.aggroIndicator.setAlpha(ENEMY_VISUAL_CONFIG.aggroIndicatorAlpha);
        if (wc.aiState === "attacking") {
          const pulse = 0.3 + Math.sin(this.expeditionTime * 15) * 0.15;
          wc.aggroIndicator.setAlpha(pulse);
        }
      } else {
        wc.aggroIndicator.setAlpha(0);
      }
    }

    // Tell de ataque (flash branco antes do golpe)
    if (wc.aiState === "attacking" && wc.windupTimer > 0) {
      if (!wc.attackTellIndicator) {
        wc.attackTellIndicator = this.add.circle(
          wc.sprite.x,
          wc.sprite.y,
          wc.sprite.radius + 4,
          ENEMY_VISUAL_CONFIG.attackTellColor,
          ENEMY_VISUAL_CONFIG.attackTellAlpha
        );
        wc.attackTellIndicator.setDepth(-1);
      }
      wc.attackTellIndicator.setPosition(wc.sprite.x, wc.sprite.y);
      wc.attackTellIndicator.setVisible(true);
      const flashIntensity = Math.sin(this.expeditionTime * 25) * 0.3 + 0.5;
      wc.attackTellIndicator.setAlpha(flashIntensity);
    } else if (wc.attackTellIndicator) {
      wc.attackTellIndicator.setVisible(false);
    }
    
    // CORREÇÃO MULTIPLAYER: Detecta execução de ataque melee em multiplayer
    // Quando windupTimer termina (< 0.05s) e estava attacking, mostra animação
    if (wc.aiState === "attacking" && wc.windupTimer <= 0.05 && wc.behaviorType === "melee") {
      // Calcula direção do ataque (em direção ao jogador)
      const dx = this.player.x - wc.sprite.x;
      const dy = this.player.y - wc.sprite.y;
      
      // Só cria animação se não criamos recentemente (evita spam)
      const now = this.expeditionTime;
      const lastAttackTime = (wc as any).lastMeleeAnimTime ?? 0;
      
      if (now - lastAttackTime > 0.5) { // Cooldown de 500ms entre animações
        this.createMeleeAttackVisualEnemy(wc.sprite.x, wc.sprite.y, dx, dy);
        (wc as any).lastMeleeAnimTime = now;
      }
    }
  }

  /**
   * FASE 7: Destrói uma criatura e limpa recursos visuais.
   * Agora usa RemoteCreatureSprite (interface unificada).
   */
  private destroyWildCreature(wc: RemoteCreatureSprite) {
    if (wc.aggroIndicator) {
      wc.aggroIndicator.destroy();
    }
    if (wc.attackTellIndicator) {
      wc.attackTellIndicator.destroy();
    }
    wc.sprite.destroy();
  }

  /**
   * Atualiza projéteis disparados por inimigos.
   */

  /**
   * Atualiza o anel visual de perigo ao redor do jogador.
   * Ele segue a posição do player e pulsa em estados de maior risco:
   * - Em combate
   * - Com pouco tempo de expedição restante
   * - Com HP baixo ou dano recente
   */
  private updateDangerRing(timeRatio: number) {
    if (!this.dangerRing || !this.player) return;

    // Garante que o anel acompanhe o player
    this.dangerRing.setPosition(this.player.x, this.player.y);

    const hpRatio =
      this.activeCreatureMaxHp > 0
        ? this.activeCreatureHp / this.activeCreatureMaxHp
        : 1;

    const inCombat = this.state === "combat";
    const lowTime = timeRatio <= 0.2;
    const lowHp = hpRatio <= this.dangerLowHpThreshold;
    const tookRecentDamage = this.damageTakenRecently > 0;

    const inDanger = inCombat || lowTime || lowHp || tookRecentDamage;

    if (!inDanger) {
      this.dangerRing.setVisible(false);
      return;
    }

    // Exibe anel com leve pulsar para reforçar estado crítico
    this.dangerRing.setVisible(true);

    const pulse = 0.9 + Math.sin(this.expeditionTime * 6) * 0.1;
    this.dangerRing.setScale(pulse);

    // Mais opaco quando tempo está crítico ou HP muito baixo
    let baseAlpha = 0.25;
    if (lowTime || lowHp) {
      baseAlpha = 0.4;
    }
    if (tookRecentDamage && !lowHp && !lowTime) {
      baseAlpha = 0.32;
    }
    this.dangerRing.setAlpha(baseAlpha + 0.1 * Math.sin(this.expeditionTime * 6));
  }

  /**
   * Sincroniza renderização de jogadores remotos com snapshots do servidor.
   * 
   * FASE 4C: Agora usa worldState para gerenciar estado de jogadores.
   * 
   * Para cada jogador remoto no snapshot:
   * - Cria novo sprite se não existir (diferente do jogador local)
   * - Atualiza posição alvo para interpolação suave
   * - Atualiza HP e estado visual
   * - Descarta updates antigos usando timestamp
   * 
   * Remove sprites de jogadores que saíram/desconectaram.
   */
  private syncRemotePlayers(players: RemotePlayer[]) {
    console.log(`[MP:Sync] Sincronizando ${players.length} jogadores do servidor`);
    const seen = new Set<string>();
    
    for (const p of players) {
      // Filtra o jogador local para evitar duplicação
      if (this.clientId && p.id === this.clientId) {
        continue;
      }
      
      seen.add(p.id);
      
      const updateTimestamp = p.lastUpdate ?? Date.now();
      const existingPlayer = this.worldState.getPlayer(p.id);
      
      // Cria novo jogador remoto se não existir
      if (!existingPlayer) {
        const playerState: PlayerState = {
          id: p.id,
          name: p.name,
          x: p.x,
          y: p.y,
          hp: p.hp ?? 100,
          maxHp: p.maxHp ?? 100,
          lastUpdate: updateTimestamp,
          color: 0x00ffff, // Ciano para jogadores remotos
          radius: 12,
          actionType: "idle",
          actionTimer: 0,
          isVisible: true
        };
        this.worldState.addPlayer(playerState);
        // FASE 4: Usar SpriteManager
        this.spriteManager.createPlayerSprite(playerState);
      } else {
        // Descarta updates antigos
        if (updateTimestamp < existingPlayer.lastUpdate) {
          continue;
        }
        
        // Atualiza estado no worldState
        this.worldState.updatePlayer(p.id, {
          x: p.x,
          y: p.y,
          name: p.name,
          hp: p.hp ?? existingPlayer.hp,
          maxHp: p.maxHp ?? existingPlayer.maxHp,
          lastUpdate: updateTimestamp
        });
        
        // Atualiza sprite
        const updatedPlayer = this.worldState.getPlayer(p.id)!;
        this.updatePlayerSprite(updatedPlayer);
      }
    }

    // Remove jogadores que saíram da sala
    for (const playerId of this.worldState.players.keys()) {
      // Não remove o jogador local
      if (this.clientId && playerId === this.clientId) {
        continue;
      }
      
      if (!seen.has(playerId)) {
        console.log(`[MP:Sync] Removendo jogador que saiu: ${playerId.slice(0, 8)}...`);
        this.removePlayer(playerId);
      }
    }
  }

  /**
   * Processa atualização de movimento de um jogador específico.
   * Mais eficiente que atualizar todos os jogadores a cada mensagem.
   * Usa timestamp para descartar updates antigos.
   * 
   * FASE 4C: Agora usa worldState para gerenciar estado de jogadores.
   */
  private handlePlayerMove(move: { playerId: string; x: number; y: number; timestamp: number }) {
    // Ignorar movimento do próprio jogador
    if (this.clientId && move.playerId === this.clientId) {
      return;
    }

    const player = this.worldState.getPlayer(move.playerId);
    if (player) {
      // Descartar updates antigos
      if (move.timestamp < player.lastUpdate) {
        console.log(`[MP:Move] Descartando update antigo para ${move.playerId.slice(0, 8)}...`);
        return;
      }
      
      // Debug: Log de movimento recebido (a cada ~5%)
      if (Math.random() < 0.05) {
        const sprite = this.getPlayerSprite(move.playerId);
        if (sprite) {
          const distToTarget = Math.hypot(move.x - sprite.currentX, move.y - sprite.currentY);
          console.log(
            `[MP:Move] ${move.playerId.slice(0, 8)}... | ` +
            `Servidor: (${move.x.toFixed(0)}, ${move.y.toFixed(0)}) | ` +
            `Cliente: (${sprite.currentX.toFixed(0)}, ${sprite.currentY.toFixed(0)}) | ` +
            `Diff: ${distToTarget.toFixed(0)}px`
          );
        }
      }
      
      // FASE 4C: Atualiza posição no worldState
      this.worldState.updatePlayer(move.playerId, {
        x: move.x,
        y: move.y,
        lastUpdate: move.timestamp
      });
      
      // Atualiza sprite
      const updatedPlayer = this.worldState.getPlayer(move.playerId)!;
      this.updatePlayerSprite(updatedPlayer);
    } else {
      console.log(`[MP:Move] Jogador ${move.playerId.slice(0, 8)}... não encontrado no worldState`);
    }
    // Se o jogador ainda não existe, será criado no próximo state update
  }

  /**
   * FASE 4C: Método legado removido - agora usa createPlayerSprite() 
   * que trabalha com PlayerState do worldState.
   */

  /**
   * FASE 4C: Método legado removido - agora usa destroyPlayerSprite()
   * que trabalha com PlayerState do worldState.
   */

  /**
   * FASE 5: Métodos legados removidos.
   * Agora usamos:
   * - createCreatureSprite() do worldState (Fase 4A)
   * - createResourceSprite() do worldState (Fase 4B)
   */

  /**
   * Atualiza renderização de todos os jogadores remotos.
   * 
   * FASE 4C: Método legado substituído por updatePlayerSprites() que trabalha
   * com PlayerState do worldState. Este método agora apenas redireciona.
   * 
   * Responsabilidades:
   * - Interpolação suave de posição entre snapshots
   * - Atualização de barras de HP
   * - Visibilidade baseada em distância (otimização de performance)
   * - Animação de indicadores de ação
   */
  private updateRemotePlayers(dt: number): void {
    // FASE 4C: Agora usa o método unificado updatePlayerSprites()
    this.updatePlayerSprites(dt);
  }

  /**
   * FASE 4C: Método legado - mantido apenas para referência.
   * A funcionalidade foi movida para updatePlayerSprites() que trabalha com worldState.
   */
  private updateRemotePlayersLegacy(dt: number): void {
    if (!this.player) return;

    const interpolationSpeed = 8; // Velocidade de interpolação (pixels por segundo, multiplicador)
    const remoteRenderDistance = this.remotePlayerRenderDistance;

    for (const remotePlayer of this.playerSprites.values()) {
      // Interpolação suave de posição
      const dx = remotePlayer.targetX - remotePlayer.currentX;
      const dy = remotePlayer.targetY - remotePlayer.currentY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0.5) {
        // Move em direção ao alvo com velocidade suave
        const moveSpeed = interpolationSpeed * dt;
        const moveRatio = Math.min(1, moveSpeed / Math.max(distance, 0.1));
        
        remotePlayer.currentX += dx * moveRatio;
        remotePlayer.currentY += dy * moveRatio;
      } else {
        // Snap ao alvo quando muito próximo
        remotePlayer.currentX = remotePlayer.targetX;
        remotePlayer.currentY = remotePlayer.targetY;
      }

      // Calcula distância do jogador local para renderização
      const distFromPlayer = Math.sqrt(
        Math.pow(remotePlayer.currentX - this.player.x, 2) +
        Math.pow(remotePlayer.currentY - this.player.y, 2)
      );

      const shouldRender = distFromPlayer <= remoteRenderDistance;

      // Atualiza visibilidade baseada em distância
      remotePlayer.sprite.setVisible(shouldRender);
      remotePlayer.nameText.setVisible(shouldRender);
      remotePlayer.hpBar.setVisible(shouldRender);
      remotePlayer.hpBarBg.setVisible(shouldRender);

      if (!shouldRender) {
        continue; // Pula atualizações de posição para jogadores fora de alcance
      }

      // Atualiza posição visual
      remotePlayer.sprite.setPosition(remotePlayer.currentX, remotePlayer.currentY);
      remotePlayer.nameText.setPosition(remotePlayer.currentX, remotePlayer.currentY - 20);
      remotePlayer.hpBarBg.setPosition(remotePlayer.currentX, remotePlayer.currentY - 32);
      remotePlayer.hpBar.setPosition(remotePlayer.currentX - 12, remotePlayer.currentY - 32);
      remotePlayer.hpBarText.setPosition(remotePlayer.currentX, remotePlayer.currentY - 32);

      // Atualiza barra de HP
      const hpRatio = Math.max(0, Math.min(1, remotePlayer.currentHp / remotePlayer.maxHp));
      remotePlayer.hpBar.setScale(hpRatio, 1);

      // Muda cor da barra de HP conforme a saúde
      if (hpRatio > 0.5) {
        remotePlayer.hpBar.setFillStyle(0x10b981); // Verde
        remotePlayer.hpBarText.setColor("#10b981");
      } else if (hpRatio > 0.25) {
        remotePlayer.hpBar.setFillStyle(0xfacc15); // Amarelo
        remotePlayer.hpBarText.setColor("#fbbf24");
      } else {
        remotePlayer.hpBar.setFillStyle(0xef4444); // Vermelho
        remotePlayer.hpBarText.setColor("#ef4444");
      }

      // Atualiza texto de HP
      const hpPercent = Math.round(hpRatio * 100);
      remotePlayer.hpBarText.setText(`${hpPercent}%`);

      // Atualiza indicador de ação (ataque, extração, etc)
      if (remotePlayer.actionIndicator) {
        if (remotePlayer.actionType && remotePlayer.actionTimer > 0) {
          remotePlayer.actionIndicator.setVisible(true);
          remotePlayer.actionIndicator.setPosition(
            remotePlayer.currentX,
            remotePlayer.currentY - 18
          );

          // Anima o indicador com pulse
          const pulse = 1 + Math.sin(this.expeditionTime * 6) * 0.3;
          remotePlayer.actionIndicator.setScale(pulse);

          // Muda cor conforme a ação
          if (remotePlayer.actionType === "attacking") {
            remotePlayer.actionIndicator.setFillStyle(0xef4444); // Vermelho para ataque
          } else if (remotePlayer.actionType === "extracting") {
            remotePlayer.actionIndicator.setFillStyle(0x3b82f6); // Azul para extração
          }

          remotePlayer.actionTimer -= dt;
        } else {
          remotePlayer.actionIndicator.setVisible(false);
          remotePlayer.actionType = null;
        }
      }
    }
  }

  /**
   * FASE 5: Método legado substituído por updateCreatureSprites().
   * Agora todas as criaturas (locais e remotas) são gerenciadas pelo worldState.
   */
  private updateServerCreatures(dt: number): void {
    // Redireciona para método unificado (Fase 4A)
    // updateCreatureSprites já é chamado no update() principal
    // Este método é mantido apenas para compatibilidade
  }

  /**
   * FASE 5: Método legado substituído por updateResourceSprites().
   * Agora todos os recursos (locais e remotos) são gerenciados pelo worldState.
   */
  private updateServerResources(dt: number): void {
    // Redireciona para método unificado (Fase 4B)
    // updateResourceSprites já é chamado no update() principal
    // Este método é mantido apenas para compatibilidade
  }

  private handleInteractions(dt: number) {
    const pointerRect = new Phaser.Geom.Rectangle(
      this.player.x - 8,
      this.player.y - 8,
      16,
      16
    );

    // FASE 4B: Coleta de recursos usando worldState
    const resourcesToRemove: string[] = [];
    
    // Verificar se spriteManager está inicializado
    if (!this.spriteManager) {
      return;
    }
    
    const allResources = this.getAllResources();
    
    // Debug: verificar se há recursos e se mpClient está disponível
    if (allResources.length > 0 && Math.random() < 0.01) {
      console.log(`[Resource] handleInteractions: ${allResources.length} recursos disponíveis, mpClient: ${this.mpClient ? 'OK' : 'NULL'}, player: (${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)})`);
    }
    
    for (const resourceSprite of allResources) {
      const dx = resourceSprite.sprite.x - this.player.x;
      const dy = resourceSprite.sprite.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      
      // Raio de coleta (aproximadamente 16px)
      if (dist <= 20) {
        const resourceItemId = resourceSprite.resourceType;
        const resourceId = resourceSprite.id;

        // Debug: log quando detecta recurso próximo
        console.log(`[Resource] Recurso próximo detectado! ID: ${resourceId}, dist: ${dist.toFixed(1)}, mpClient: ${this.mpClient ? 'OK' : 'NULL'}, já enviado: ${this.resourceIntentsSent.has(resourceId)}`);

        // Envia intent de coleta ao servidor (server-authoritative)
        // Evita enviar múltiplos intents para o mesmo recurso
        if (this.mpClient && !this.resourceIntentsSent.has(resourceId)) {
          this.resourceIntentsSent.add(resourceId);
          this.mpClient.sendResourceInteract(resourceId);
          console.log(`[Resource] ✅ Intent de coleta enviado ao servidor: ${resourceId}`);
        } else if (!this.mpClient) {
          console.warn(`[Resource] ⚠️ mpClient não disponível para enviar intent de coleta: ${resourceId}`);
        } else if (this.resourceIntentsSent.has(resourceId)) {
          console.log(`[Resource] ⏭️ Intent já enviado anteriormente para recurso: ${resourceId}`);
        }

        // NOTA: Telemetria será atualizada quando o servidor confirmar a coleta
        // via resources_update (quando o recurso desaparecer do servidor)
        // Isso garante que apenas recursos realmente coletados sejam contados
        
        this.feedbackManager.createCollectionFeedback(
          resourceSprite.sprite.x,
          resourceSprite.sprite.y,
          resourceItemId
        );
        
        resourcesToRemove.push(resourceSprite.id);
      }
    }
    
    // Remove recursos coletados do worldState
    for (const resourceId of resourcesToRemove) {
      this.removeResource(resourceId);
    }
    
    // LEGADO: Mantém coleta antiga temporariamente
    this.children.each((child) => {
      const anyChild = child as any;
      if (
        anyChild.kind === "resource" &&
        typeof (child as any).getBounds === "function"
      ) {
        const bounds = (child as unknown as Phaser.GameObjects.Components.GetBounds)
          .getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(pointerRect, bounds)) {
          const resourceItemId: string =
            anyChild.resourceItemId ?? "resource-ferro-cristalino";

          // Envia intent de coleta ao servidor (server-authoritative)
          // Nota: Este código legado usa child.resourceItemId, mas o ID do recurso
          // não está disponível aqui. Este código legado deve ser removido após
          // validação completa da migração para o novo sistema.
          if (this.mpClient) {
            // Tentar encontrar o ID do recurso no worldState pela posição
            const allResources = this.worldState.getAllResources();
            const resource = allResources.find(r => {
              const dx = r.x - bounds.centerX;
              const dy = r.y - bounds.centerY;
              return Math.hypot(dx, dy) < 10; // Tolerância de 10px
            });
            if (resource) {
              this.mpClient.sendResourceInteract(resource.id);
              console.log(`[Resource] Enviando intent de coleta ao servidor (legado): ${resource.id}`);
            } else {
              console.warn(`[Resource] Não foi possível encontrar ID do recurso na posição (${bounds.centerX}, ${bounds.centerY})`);
            }
          }

          // NOTA: Telemetria será atualizada quando o servidor confirmar a coleta
          // via resources_update (quando o recurso desaparecer do servidor)
          // Isso garante que apenas recursos realmente coletados sejam contados

          // Feedback visual: partículas e texto flutuante
          // FASE 4: Usar FeedbackManager
          this.feedbackManager.createCollectionFeedback(
            bounds.centerX,
            bounds.centerY,
            resourceItemId
          );
          
          // Log de coleta
          console.log("[TELEMETRIA] Recurso coletado", {
            total: this.telemetry.resourcesCollected,
            time: Math.floor(this.expeditionTime)
          });
          
          child.destroy();
        }
      }
    });

    // Dano de contato: criaturas aplicam dano por segundo quando colidem com o jogador
    this.applyContactDamage(dt);

    // Lógica de extração: precisa estar na zona e segurar E parado
    const inExtractionZone = Phaser.Geom.Rectangle.Contains(
      this.extractionZone.getBounds(),
      this.player.x,
      this.player.y
    );

    // FASE 4: Lógica de extração usando ExtractionSystem
    this.extractionSystem.handleExtraction(
      inExtractionZone,
      this.extractKey.isDown,
      this.player.x,
      this.player.y
    );

    if (Phaser.Input.Keyboard.JustDown(this.captureKey)) {
      this.tryCaptureNearbyCreature();
    }
  }

  /**
   * Aplica dano de contato baseado no tier da criatura.
   * Aproxima o jogador e as criaturas como círculos com raio simples
   * (não usamos física Arcade aqui para manter o protótipo leve).
   */
  private applyContactDamage(dt: number) {
    if (this.state === "extracted" || this.state === "failed") return;

    const playerRadius = 18;
    let damageThisFrame = 0;

    // FASE 4A: Usa getAllCreatures()
    const creaturesInRange = this.getAllCreatures();
    
    for (const wc of creaturesInRange) {
      const dx = wc.sprite.x - this.player.x;
      const dy = wc.sprite.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      const creatureRadius = (wc.sprite as Phaser.GameObjects.Arc).radius ?? 11;
      if (dist <= playerRadius + creatureRadius) {
        const tierConfig = THREAT_TIERS[wc.tier];
        const dps = tierConfig.contactDamagePerSecond;
        const tickSeconds = COMBAT_CONFIG.contactDamageTickSeconds;
        damageThisFrame += dps * (dt / tickSeconds) * tickSeconds;
      }
    }

    // Aplica multiplicador de defesa (Sinergia Elemental)
    damageThisFrame *= this.getDefenseMultiplier();

    if (
      damageThisFrame > 0 &&
      (this.state === "exploring" ||
        this.state === "combat" ||
        this.state === "capturing" ||
        this.state === "extracting")
    ) {
      this.activeCreatureHp = Math.max(
        0,
        this.activeCreatureHp - damageThisFrame
      );
      this.damageTakenRecently += damageThisFrame;
      this.damageTakenDecayTimer = 0.5; // meio segundo de "perigo recente"
      this.telemetry.damageTaken += damageThisFrame;
      this.playerTookDamageThisFrame = true; // Sinaliza para o sistema de barras de HP

      if (this.activeCreatureHp <= 0) {
        // Morte do jogador = falha imediata da expedição
        this.state = "failed";
        if (!this.telemetry.extractionFailed) {
          this.telemetry.extractionFailed = true;
          // Usar tempo do servidor se disponível, senão usar tempo local
          const finalTime = this.lastMatchState?.elapsedSeconds ?? this.expeditionTime;
          this.telemetry.timeSpent = finalTime;

          // Calcula métricas finais
          const timeMinutes = finalTime / 60;
          this.telemetry.resourcesPerMinute =
            this.telemetry.resourcesCollected / Math.max(0.1, timeMinutes);
          this.telemetry.creaturesPerMinute =
            this.telemetry.creaturesCaptured / Math.max(0.1, timeMinutes);
          this.telemetry.averageCaptureChance =
            this.telemetry.captureAttempts > 0
              ? this.telemetry.totalCaptureChanceSum /
                this.telemetry.captureAttempts
              : 0;

          // Log estruturado de morte em combate
          const telemetryData = {
            "Tempo Total (s)": Math.floor(this.telemetry.timeSpent),
            "Tempo Total (min)": (
              this.telemetry.timeSpent / 60
            ).toFixed(2),
            "Recursos Coletados": this.telemetry.resourcesCollected,
            "Recursos/min": this.telemetry.resourcesPerMinute.toFixed(2),
            "Criaturas Encontradas": this.telemetry.creaturesEncountered,
            "Tentativas de Captura": this.telemetry.captureAttempts,
            "Capturas Bem-sucedidas": this.telemetry.creaturesCaptured,
            "Taxa de Sucesso (%)":
              this.telemetry.captureAttempts > 0
                ? (
                    (this.telemetry.creaturesCaptured /
                      this.telemetry.captureAttempts) *
                    100
                  ).toFixed(1)
                : "0.0",
            "Chance Média de Captura (%)": (
              this.telemetry.averageCaptureChance * 100
            ).toFixed(1),
            "Encontros de Combate": this.telemetry.combatEncounters,
            "Dano Causado": this.telemetry.damageDealt,
            "Dano Recebido": this.telemetry.damageTaken.toFixed(1),
            "Projéteis Disparados": this.telemetry.projectilesFired,
            "Status": "FALHA (MORTE EM COMBATE)"
          };

          console.log("[TELEMETRIA] Expedição falhou - morte em combate");
          console.table(telemetryData);
          
          // Mesmo em falha, criaturas ganham XP (sem bônus de extração)
          this.processCreatureXp(false);
        }
      }
    }

    // Decaimento do indicador de dano recente
    if (this.damageTakenDecayTimer > 0) {
      this.damageTakenDecayTimer = Math.max(
        0,
        this.damageTakenDecayTimer - dt
      );
      if (this.damageTakenDecayTimer === 0) {
        this.damageTakenRecently = 0;
      }
    }

    // Visual do anel de perigo agora é centralizado em updateDangerRing()
  }

  /**
   * Dispara uma pokébola na direção do mouse.
   * A pokébola viaja como projétil e tenta capturar ao colidir.
   */
  private throwPokeball() {
    // Seleciona automaticamente a melhor pokébola disponível do inventário de expedição
    const captureToolsPriority: ("poke-ball-ultra" | "poke-ball-precisa" | "poke-ball-basic")[] = [
      "poke-ball-ultra",
      "poke-ball-precisa",
      "poke-ball-basic"
    ];

    const chosenBall = captureToolsPriority.find(
      (id) => (this.expeditionInventory.get(id) ?? 0) > 0
    );

    if (!chosenBall) {
      // FASE 4: Usar FeedbackManager
      this.feedbackManager.createFloatingText(
        this.player.x,
        this.player.y - 30,
        "Sem Pokébolas!",
        0xef4444
      );
      return;
    }

    // Consome a pokébola do inventário de expedição (otimista)
    // Em caso de falha crítica no servidor, podemos reverter no futuro
    const currentQuantity = this.expeditionInventory.get(chosenBall) ?? 0;
    if (currentQuantity <= 0) {
      return;
    }
    this.expeditionInventory.set(chosenBall, currentQuantity - 1);

    // Calcula direção para o mouse
    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    const dx = pointer.worldX - this.player.x;
    const dy = pointer.worldY - this.player.y;
    const len = Math.hypot(dx, dy) || 1;
    
    const speed = 450; // Velocidade da pokébola
    const velocityX = (dx / len) * speed;
    const velocityY = (dy / len) * speed;

    // Cor da pokébola baseada no tipo
    const ballColors: Record<string, number> = {
      "poke-ball-basic": 0xef4444,    // Vermelho
      "poke-ball-precisa": 0x3b82f6,   // Azul
      "poke-ball-ultra": 0xfbbf24      // Dourado
    };

    // Cria o sprite da pokébola
    const sprite = this.add.circle(
      this.player.x, 
      this.player.y, 
      8, 
      ballColors[chosenBall] ?? 0xef4444, 
      1
    );
    sprite.setStrokeStyle(2, 0xffffff);

    // FASE 4: Usar ProjectileManager ao invés de this.pokeballProjectiles
    this.projectileManager.addPokeballProjectile({
      sprite,
      velocityX,
      velocityY,
      lifetime: 2, // 2 segundos de vida
      ballType: chosenBall
    });

    // Feedback visual ao lançar
    // FASE 4: Usar FeedbackManager
    this.feedbackManager.createFloatingText(
      this.player.x,
      this.player.y - 30,
      "🎯 Lançando...",
      0x3b82f6
    );

    // Registra tentativa
    this.telemetry.captureAttempts += 1;
  }

  /**
   * Atualiza os projéteis de pokébola e verifica colisões.
   */

  /**
   * FASE 7: Calcula a chance de captura.
   * Agora usa apenas RemoteCreatureSprite (interface unificada).
   */
  private calculateCatchRate(
    creature: RemoteCreatureSprite,
    ballType: "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra"
  ): number {
    // Fatores base
    const baseRate = CAPTURE_CONFIG.baseChance; // 0.25 base
    
    // Bônus por HP baixo (quanto menor o HP, maior a chance)
    const hpRatio = creature.currentHp / creature.maxHp;
    const hpBonus = (1 - hpRatio) * CAPTURE_CONFIG.hpBonusMultiplier;
    
    // Penalidade por nível/tier alto (criaturas mais fortes são mais difíceis)
    const tierPenalty: Record<string, number> = {
      common: 0,
      uncommon: 0.05,
      rare: 0.15,
      boss: 0.35
    };
    const penalty = tierPenalty[creature.tier] ?? 0;
    
    // Modificador da pokébola
    const ballMods = CAPTURE_BALL_MODIFIERS[ballType] ?? CAPTURE_BALL_MODIFIERS["poke-ball-basic"];
    
    // Calcula chance final
    const rawChance = (baseRate + hpBonus - penalty) * ballMods.multiplier + ballMods.flatBonus;
    
    return Math.max(0.05, Math.min(CAPTURE_CONFIG.maxChance, rawChance)); // Mínimo 5%, máximo do config
  }


  // Alias para compatibilidade com tecla Q
  private tryCaptureNearbyCreature() {
    this.throwPokeball();
  }

  private createCollectionFeedback(x: number, y: number, itemId: string) {
    // Obtém cores do sistema de identidade visual
    const item = getItemById(itemId);
    const pickupColors = getResourcePickupColors(
      itemId,
      item?.tier ?? "Básico"
    );

    // Partículas simples (círculos pequenos) com cor do item
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5;
      const particle = this.add.circle(x, y, 3, pickupColors.color, 1);
      const distance = 20;
      const duration = 400;
      
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: duration,
        onComplete: () => particle.destroy()
      });
    }
    
    // Texto flutuante com nome do recurso coletado, usando cor do item
    const label = item?.name ?? "+1 Recurso";
    this.feedbackManager.createFloatingText(x, y - 15, `+1 ${label}`, pickupColors.color);
  }

  private createCaptureSuccessFeedback(x: number, y: number) {
    // Círculo expansivo
    const circle = this.add.circle(x, y, 0, 0x10b981, 0.5);
    this.tweens.add({
      targets: circle,
      radius: 40,
      alpha: 0,
      duration: 500,
      onComplete: () => circle.destroy()
    });
    
    // Partículas verdes
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const particle = this.add.circle(x, y, 4, 0x10b981, 1);
      const distance = 30;
      
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 400,
        onComplete: () => particle.destroy()
      });
    }
  }

  private createCaptureFailFeedback(x: number, y: number) {
    // Círculo vermelho pulsante
    const circle = this.add.circle(x, y, 15, 0xef4444, 0.6);
    this.tweens.add({
      targets: circle,
      radius: 25,
      alpha: 0,
      duration: 300,
      onComplete: () => circle.destroy()
    });
  }

  private createExtractionSuccessFeedback() {
    const { width, height } = this.scale;
    
    // Círculo grande no centro (fixo na tela)
    const circle = this.add.circle(width / 2, height / 2, 0, 0x3b82f6, 0.3)
      .setScrollFactor(0)
      .setDepth(1000);
    this.tweens.add({
      targets: circle,
      radius: Math.max(width, height),
      alpha: 0,
      duration: 1000,
      onComplete: () => circle.destroy()
    });
    
    // Texto de sucesso (fixo na tela)
    const successText = this.add.text(width / 2, height / 2, "EXTRAÇÃO CONCLUÍDA!", {
      fontSize: "32px",
      color: "#3b82f6",
      stroke: "#ffffff",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setScrollFactor(0).setDepth(1001);
    
    this.tweens.add({
      targets: successText,
      alpha: 1,
      scale: 1.2,
      duration: 500,
      yoyo: true,
      repeat: 1
    });
  }

  // ============================================================================
  // SISTEMA DE PROGRESSÃO - XP DE EXPEDIÇÃO
  // ============================================================================

  /**
   * Processa e distribui XP para todas as criaturas da equipe após a expedição.
   * @param extractionSuccess Se a extração foi bem-sucedida (bônus de XP)
   */
  private processCreatureXp(extractionSuccess: boolean) {
    // Evita processar XP múltiplas vezes
    if (this.xpProcessed) return;
    this.xpProcessed = true;

    const params: ExpeditionXpParams = {
      durationSeconds: this.expeditionTime,
      extractionSuccess,
      creaturesDefeated: this.creaturesDefeatedCount,
      resourcesCollected: this.telemetry.resourcesCollected,
      teamCreatureIds: this.activeTeamIds,
      activeCreatureId: this.activeCreatureInstanceId,
      activeTimeByCreature: this.activeTimeByCreature,
    };

    const results = LocalPlayerState.processExpeditionXp(params);

    // Log de XP ganho
    console.log("[PROGRESSÃO] XP distribuído às criaturas:");
    const progress = LocalPlayerState.getProgress();
    for (const [creatureId, result] of results.entries()) {
      const creature = progress.creatures.find((c) => c.instanceId === creatureId);
      const def = creature ? getCreatureById(creature.definitionId) : null;
      const name = def?.name ?? "Criatura";
      
      console.log(`  ${name}: +${result.xpGained} XP${result.leveledUp ? ` (LEVEL UP! ${result.oldLevel} → ${result.newLevel})` : ""}`);
    }

    // Exibe feedback visual de XP ganho
    this.showXpGainedFeedback(results, extractionSuccess);
  }

  /**
   * Exibe feedback visual do XP ganho pelas criaturas.
   */
  private showXpGainedFeedback(
    results: Map<string, { leveledUp: boolean; oldLevel: number; newLevel: number; xpGained: number }>,
    extractionSuccess: boolean
  ) {
    const { width, height } = this.scale;
    const progress = LocalPlayerState.getProgress();

    // Painel de XP (fixo na tela)
    const panelY = extractionSuccess ? height / 2 + 80 : height / 2;
    const panelBg = this.add.rectangle(width / 2, panelY, 300, 120, 0x020617, 0.9)
      .setStrokeStyle(2, 0x3b82f6, 1)
      .setDepth(1001)
      .setScrollFactor(0);

    const title = this.add.text(width / 2, panelY - 45, "⭐ XP GANHO ⭐", {
      fontSize: "16px",
      color: "#fbbf24",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);

    let yOffset = panelY - 20;
    const textElements: Phaser.GameObjects.Text[] = [title];

    for (const [creatureId, result] of results.entries()) {
      const creature = progress.creatures.find((c) => c.instanceId === creatureId);
      const def = creature ? getCreatureById(creature.definitionId) : null;
      const name = def?.name ?? "Criatura";
      const rank = creature?.rank ?? 1;
      const rankStr = getRankDisplay(rank);

      let line = `${rankStr} ${name}: +${formatXp(result.xpGained)} XP`;
      let color = "#e5e7eb";

      if (result.leveledUp) {
        line += ` 🎉 Lv.${result.newLevel}!`;
        color = "#22c55e";
      }

      const text = this.add.text(width / 2, yOffset, line, {
        fontSize: "14px",
        color
      }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);

      textElements.push(text);
      yOffset += 22;
    }

    // Fade out após alguns segundos
    this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: [panelBg, ...textElements],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          panelBg.destroy();
          textElements.forEach((t) => t.destroy());
        }
      });
    });
  }


  // ============================================================================
  // MECÂNICAS AVANÇADAS DE GAMEPLAY
  // ============================================================================

  /**
   * Atualiza o tier de "Carga Valiosa" (Greed Risk) baseado nos recursos coletados.
   * Quanto mais recursos carrega, maior o bônus de velocidade mas também
   * maior o perigo (criaturas detectam o jogador de mais longe).
   */
  private updateGreedTier() {
    const totalResources = this.resourcesCollected;
    const previousTier = this.greedTier;

    if (totalResources >= GREED_RISK_CONFIG.tier2Threshold) {
      this.greedTier = 2;
    } else if (totalResources >= GREED_RISK_CONFIG.tier1Threshold) {
      this.greedTier = 1;
    } else {
      this.greedTier = 0;
    }

    // Feedback quando muda de tier
    if (this.greedTier !== previousTier && this.greedTier > 0) {
      const tierMessages = {
        1: "Carga Valiosa! +5% Velocidade, mas você brilha...",
        2: "Muito Carregado! +10% Velocidade, CUIDADO!"
      };
      const tierColors = {
        1: GREED_RISK_CONFIG.tier1GlowColor,
        2: GREED_RISK_CONFIG.tier2GlowColor
      };
      this.feedbackManager.createFloatingText(
        this.player.x,
        this.player.y - 50,
        tierMessages[this.greedTier as 1 | 2],
        tierColors[this.greedTier as 1 | 2]
      );
      console.log("[MECÂNICA] Greed Tier atualizado:", this.greedTier);
    }

    // Atualiza velocidade baseada no tier
    this.updateSpeedWithModifiers();
  }

  /**
   * Verifica se o recurso coletado ativa uma sinergia elemental com a criatura ativa.
   * Se houver sinergia, aplica um buff temporário.
   */
  private checkElementalSynergy(resourceItemId: string) {
    if (!this.activeCreatureDef) return;

    const creatureType = this.activeCreatureDef.primaryType;
    const synergiesForType = ELEMENTAL_SYNERGIES[creatureType];
    if (!synergiesForType) return;

    const synergy = synergiesForType[resourceItemId];
    if (!synergy) return;

    // Aplica ou renova o buff
    this.activeSynergyBuffs.set(synergy.type, {
      value: synergy.value,
      remaining: synergy.durationSeconds
    });

    // Feedback visual
    this.feedbackManager.createFloatingText(
      this.player.x,
      this.player.y - 70,
      synergy.feedbackMessage,
      synergy.feedbackColor
    );

    // Efeito visual de partículas coloridas
    this.createSynergyEffect(synergy.feedbackColor);

    console.log("[MECÂNICA] Sinergia Elemental ativada:", {
      type: synergy.type,
      value: synergy.value,
      duration: synergy.durationSeconds
    });

    // Atualiza velocidade caso seja buff de speed
    if (synergy.type === "speed") {
      this.updateSpeedWithModifiers();
    }
  }

  /**
   * Cria um efeito visual de partículas ao redor do jogador para sinergia elemental.
   */
  private createSynergyEffect(color: number) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const startRadius = 20;
      const particle = this.add.circle(
        this.player.x + Math.cos(angle) * startRadius,
        this.player.y + Math.sin(angle) * startRadius,
        4,
        color,
        0.8
      );

      this.tweens.add({
        targets: particle,
        x: this.player.x + Math.cos(angle) * 50,
        y: this.player.y + Math.sin(angle) * 50,
        alpha: 0,
        scale: 0.3,
        duration: 600,
        onComplete: () => particle.destroy()
      });
    }
  }

  /**
   * Atualiza a velocidade do jogador considerando todos os modificadores ativos:
   * - Velocidade base da criatura
   * - Bônus de Carga Valiosa (Greed Risk)
   * - Buff de sinergia elemental de velocidade
   */
  private updateSpeedWithModifiers() {
    let speedMultiplier = 1.0;

    // Bônus de Carga Valiosa
    if (this.greedTier === 1) {
      speedMultiplier *= GREED_RISK_CONFIG.tier1SpeedBonus;
    } else if (this.greedTier === 2) {
      speedMultiplier *= GREED_RISK_CONFIG.tier2SpeedBonus;
    }

    // Buff de sinergia elemental de velocidade
    const speedBuff = this.activeSynergyBuffs.get("speed");
    if (speedBuff && speedBuff.remaining > 0) {
      speedMultiplier *= (1 + speedBuff.value);
    }

    this.speed = Math.round(this.baseSpeed * speedMultiplier);
  }

  /**
   * Atualiza todas as mecânicas avançadas a cada frame.
   * Chamado no loop principal de update().
   */
  private updateAdvancedMechanics(dt: number) {
    // Atualiza visual do anel de Carga Valiosa
    this.updateGreedGlowRing();

    // Atualiza buffs de sinergia elemental
    this.updateSynergyBuffs(dt);
  }

  /**
   * Atualiza o anel visual de Carga Valiosa (Greed Risk).
   */
  private updateGreedGlowRing() {
    if (!this.greedGlowRing) return;

    if (this.greedTier === 0) {
      this.greedGlowRing.setVisible(false);
      return;
    }

    this.greedGlowRing.setVisible(true);
    this.greedGlowRing.setPosition(this.player.x, this.player.y);

    // Cor e intensidade baseadas no tier
    const color = this.greedTier === 2
      ? GREED_RISK_CONFIG.tier2GlowColor
      : GREED_RISK_CONFIG.tier1GlowColor;
    
    // Pulso visual para chamar atenção
    const pulse = Math.sin(this.expeditionTime * 4) * 0.1;
    const alpha = GREED_RISK_CONFIG.glowAlpha + pulse;
    const scale = 1 + (this.greedTier === 2 ? 0.15 : 0) + Math.sin(this.expeditionTime * 3) * 0.05;

    this.greedGlowRing.setFillStyle(color, alpha);
    this.greedGlowRing.setScale(scale);
  }

  /**
   * Atualiza os buffs de sinergia elemental, decrementando seu tempo restante
   * e aplicando efeitos contínuos (como regeneração de HP).
   */
  private updateSynergyBuffs(dt: number) {
    for (const [type, buff] of this.activeSynergyBuffs.entries()) {
      buff.remaining -= dt;

      // Efeito contínuo: regeneração de HP (buff de heal)
      if (type === "heal" && buff.remaining > 0) {
        const healPerSecond = buff.value;
        this.activeCreatureHp = Math.min(
          this.activeCreatureMaxHp,
          this.activeCreatureHp + healPerSecond * dt
        );
      }

      // Remove buffs expirados
      if (buff.remaining <= 0) {
        this.activeSynergyBuffs.delete(type);
        
        // Recalcula velocidade se era buff de speed
        if (type === "speed") {
          this.updateSpeedWithModifiers();
        }
        
        console.log("[MECÂNICA] Buff expirado:", type);
      }
    }
  }

  /**
   * Retorna o multiplicador de dano atual considerando buffs ativos.
   */
  private getDamageMultiplier(): number {
    const damageBuff = this.activeSynergyBuffs.get("damage");
    if (damageBuff && damageBuff.remaining > 0) {
      return 1 + damageBuff.value;
    }
    return 1.0;
  }

  /**
   * Retorna o multiplicador de defesa atual considerando buffs ativos.
   * Usado para reduzir dano recebido.
   */
  private getDefenseMultiplier(): number {
    const defenseBuff = this.activeSynergyBuffs.get("defense");
    if (defenseBuff && defenseBuff.remaining > 0) {
      return 1 - defenseBuff.value; // valor é a redução de dano
    }
    return 1.0;
  }

  /**
   * Retorna o multiplicador de detecção de inimigos baseado no tier de Carga Valiosa.
   * Quanto maior o tier, mais longe os inimigos detectam o jogador.
   */
  private getGreedDetectionMultiplier(): number {
    if (this.greedTier === 2) {
      return GREED_RISK_CONFIG.tier2DetectionMultiplier;
    } else if (this.greedTier === 1) {
      return GREED_RISK_CONFIG.tier1DetectionMultiplier;
    }
    return 1.0;
  }

  private updateHud() {
    const timeLeft = Math.max(
      0,
      Math.floor(this.expeditionDuration - this.expeditionTime)
    );

    let status = "";
    let statusColor = "#e5e7eb";
    switch (this.state) {
      case "exploring":
        status = "Explorando";
        statusColor = "#10b981";
        break;
      case "combat":
        status = "Em combate";
        statusColor = "#ef4444";
        break;
      case "capturing":
        status = "Tentando captura...";
        statusColor = "#facc15";
        break;
      case "extracting":
        status = "Extraindo...";
        statusColor = "#3b82f6";
        break;
      case "extracted":
        status = "Extração bem-sucedida!";
        statusColor = "#10b981";
        break;
      case "failed":
        status = "Falha na expedição (tempo esgotado)";
        statusColor = "#ef4444";
        break;
    }

    const extractionPct =
      this.state === "extracting"
        ? Math.min(
            100,
            Math.floor((this.extractionProgress / this.extractionRequired) * 100)
          )
        : 0;

    // Usar inventário de expedição ao invés de inventário permanente
    const basicBalls = this.expeditionInventory.get("poke-ball-basic") ?? 0;
    const preciseBalls = this.expeditionInventory.get("poke-ball-precisa") ?? 0;
    const ultraBalls = this.expeditionInventory.get("poke-ball-ultra") ?? 0;

    // Coletar outros itens do inventário de expedição (poções, consumíveis, etc.)
    const otherItems: string[] = [];
    for (const [itemId, quantity] of this.expeditionInventory.entries()) {
      // Pular pokébolas (já mostradas separadamente)
      if (itemId.startsWith("poke-ball-")) continue;
      if (quantity <= 0) continue;
      
      const itemDef = getItemById(itemId);
      if (itemDef) {
        otherItems.push(`${itemDef.name}: x${quantity}`);
      } else {
        // Fallback: usar itemId se não encontrar definição
        otherItems.push(`${itemId}: x${quantity}`);
      }
    }
    const otherItemsLine = otherItems.length > 0 
      ? otherItems.join(" | ")
      : "";

    const skillCooldownSeconds = Math.ceil(this.specialSkillCooldown);
    const skillStatus =
      this.activeSpecialSkillKind == null
        ? "Indisponível"
        : this.specialSkillCooldown <= 0
          ? "Pronta"
          : `Recarga: ${skillCooldownSeconds}s`;

    const hpRatio =
      this.activeCreatureMaxHp > 0
        ? this.activeCreatureHp / this.activeCreatureMaxHp
        : 1;
    const lowHp = hpRatio <= this.dangerLowHpThreshold;
    const tookRecentDamage = this.damageTakenRecently > 0;

    const dangerMessages: string[] = [];
    if (lowHp && this.state !== "failed") {
      dangerMessages.push("HP CRÍTICO! Procure extrair ou evitar combate.");
    }
    if (tookRecentDamage && !lowHp && this.state !== "failed") {
      dangerMessages.push("Você está sob fogo inimigo – recalcule sua rota.");
    }

    // Resumo compacto de recursos desta expedição, por tipo
    const expeditionResourceSummary: string[] = [];
    for (const [itemId, qty] of this.expeditionResources.entries()) {
      if (qty <= 0) continue;
      const itemDef = getItemById(itemId);
      if (!itemDef) continue;
      expeditionResourceSummary.push(`${itemDef.name}: x${qty}`);
    }
    const resourcesLine =
      expeditionResourceSummary.length > 0
        ? expeditionResourceSummary.join(" | ")
        : "Nenhum recurso coletado ainda";

    // HUD compacto - apenas informações essenciais
    const extractionStatus = this.state === "extracting"
      ? `Extraindo: ${extractionPct}%`
      : this.state === "extracted"
        ? "✓ EXTRAÍDO"
        : "";

    const hudLines = [
      `${status} | ⏱ ${timeLeft}s | 🎯 ${this.creaturesCaptured} capturas`,
      `Pokébolas: ${basicBalls}/${preciseBalls}/${ultraBalls}`,
      ...(otherItemsLine ? [`Itens: ${otherItemsLine.length > 50 ? otherItemsLine.slice(0, 47) + "..." : otherItemsLine}`] : []),
      `Recursos: ${resourcesLine.length > 40 ? resourcesLine.slice(0, 37) + "..." : resourcesLine}`,
      extractionStatus,
      ...dangerMessages.slice(0, 2) // Limita mensagens de perigo
    ].filter(line => line !== "");

    // Adiciona mensagem de retorno se a expedição terminou
    if (this.state === "extracted" || this.state === "failed") {
      const returnTime = Math.max(0, this.endSceneDelay - this.endSceneTimer);
      hudLines.push(`Retornando em ${Math.ceil(returnTime)}s...`);
    }

    this.hudText.setText(hudLines.join("\n"));
    
    // Atualiza cor do texto baseado no estado
    if (this.state === "failed" || this.state === "extracted") {
      this.hudText.setColor(statusColor);
    } else {
      this.hudText.setColor("#e5e7eb");
    }
  }

  private updateDebugPanel() {
    if (!this.debugPanelVisible) return;

    const timeMinutes = this.expeditionTime / 60;
    const currentResourcesPerMin = timeMinutes > 0 
      ? (this.telemetry.resourcesCollected / timeMinutes).toFixed(2)
      : "0.00";
    const currentCreaturesPerMin = timeMinutes > 0
      ? (this.telemetry.creaturesCaptured / timeMinutes).toFixed(2)
      : "0.00";
    const avgCaptureChance = this.telemetry.captureAttempts > 0
      ? ((this.telemetry.totalCaptureChanceSum / this.telemetry.captureAttempts) * 100).toFixed(1)
      : "0.0";
    const captureSuccessRate = this.telemetry.captureAttempts > 0
      ? ((this.telemetry.captureSuccesses / this.telemetry.captureAttempts) * 100).toFixed(1)
      : "0.0";

    // Informações de multiplayer
    const mpInfo = [
      "",
      "=== MULTIPLAYER ===",
      `Modo: ONLINE`,
      `ClientID: ${this.clientId?.slice(0, 8) ?? "N/A"}...`,
      `Players: ${this.playerSprites.size} remotos`,
      `Criaturas (WS): ${this.worldState.creatures.size}`,
      `Recursos (WS): ${this.worldState.resources.size}`,
    ];
    
    // Informações de interpolação (amostragem)
    const interpolationInfo: string[] = [];
    if (this.creatureSprites.size > 0) {
      const firstCreature = this.creatureSprites.values().next().value;
      if (firstCreature) {
        const distToTarget = Math.hypot(
          firstCreature.targetX - firstCreature.currentX,
          firstCreature.targetY - firstCreature.currentY
        );
        interpolationInfo.push(
          "",
          "=== INTERPOLAÇÃO ===",
          `Criatura #1: diff=${distToTarget.toFixed(0)}px`,
          `  current: (${firstCreature.currentX.toFixed(0)}, ${firstCreature.currentY.toFixed(0)})`,
          `  target:  (${firstCreature.targetX.toFixed(0)}, ${firstCreature.targetY.toFixed(0)})`,
          `  state:   ${firstCreature.aiState}`
        );
      }
    }

    this.debugPanelText.setText(
      [
        "=== PAINEL DE DEBUG (F1 para ocultar) ===",
        `Tempo: ${Math.floor(this.expeditionTime)}s / ${this.expeditionDuration}s`,
        `Recursos: ${this.telemetry.resourcesCollected} (${currentResourcesPerMin}/min)`,
        `Criaturas: ${this.telemetry.creaturesCaptured}/${this.telemetry.creaturesEncountered}`,
        `Capturas: ${this.telemetry.captureSuccesses}/${this.telemetry.captureAttempts} (${captureSuccessRate}%)`,
        `Chance Média: ${avgCaptureChance}%`,
        `Combate: ${this.telemetry.combatEncounters} encontros`,
        `Dano: ${this.telemetry.damageDealt} causado`,
        `Projéteis: ${this.telemetry.projectilesFired}`,
        `Status: ${this.state.toUpperCase()}`,
        ...mpInfo,
        ...interpolationInfo
      ].join("\n")
    );
  }

  // ============================================================================
  // HANDLERS MULTIPLAYER - INTENTS E RESULTADOS
  // ============================================================================

  /**
   * Cria um efeito visual imediato de ataque para predição local.
   * Será corrigido/sobrescrito pelo resultado real do servidor.
   */
  private createImmediateAttackPrediction(targetX: number, targetY: number, def: CreatureDefinition | null) {
    if (!def) return;

    const basic = def.basicAttack;
    const theme = this.activeCreatureTheme;

    // Ataques melee: mostra arco visual
    if (!basic.isProjectile) {
      const attackAngle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        targetX,
        targetY
      );
      this.createMeleeSwingVisual(attackAngle, basic.range, theme);
      this.state = "combat";
      return;
    }

    // Ataques à distância: cria projétil
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      targetX,
      targetY
    );

    const projectileColor = theme?.attackColor ?? 0xf97316;
    const projectileRadius = theme?.projectileRadius ?? 4;
    const speed = COMBAT_CONFIG.projectileSpeed;

    const sprite = this.add.circle(
      this.player.x,
      this.player.y,
      projectileRadius,
      projectileColor
    );
    sprite.setStrokeStyle(1, theme?.strokeColor ?? 0xea580c, 0.8);
    this.physics.add.existing(sprite);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    body.setAllowGravity(false);

    // Partícula de disparo
    this.createMuzzleFlash(this.player.x, this.player.y, angle, theme);

    const lifetime =
      basic.range > 0
        ? basic.range / COMBAT_CONFIG.projectileSpeed
        : COMBAT_CONFIG.projectileLifetime;

    // FASE 4: Usar ProjectileManager ao invés de this.projectiles
    this.projectileManager.addProjectile({
      sprite,
      lifetime
    });

    this.state = "combat";
  }

  /**
   * Handler para resultado de ataque recebido do servidor.
   * Sincroniza HP real das criaturas E JOGADORES e aplica correções visuais.
   */
  private handleAttackResult(result: AttackResult) {
    console.log("[MP] Resultado de ataque recebido", result);

    if (!result.targetId) {
      return;
    }

    // Verificar se o alvo é o jogador local
    const isLocalPlayer = result.targetId === this.mpClient?.getClientId();
    
    if (isLocalPlayer) {
      // Atualizar HP do jogador local
      if (result.targetHp !== undefined) {
        this.activeCreatureHp = Math.max(0, result.targetHp);
        this.damageTakenRecently += result.damage;
        this.damageTakenDecayTimer = 0.5;
        this.telemetry.damageTaken += result.damage;
        
        // Sinaliza para o sistema de barras de HP que o jogador tomou dano
        this.playerTookDamageThisFrame = true;
        
        // Efeito visual de dano no jogador
        const originalTint = this.player.tintTopLeft;
        this.player.setTint(0xef4444);
        this.time.delayedCall(100, () => {
          this.player.setTint(originalTint);
        });
        
        // Feedback de dano
        // FASE 4: Usar FeedbackManager
        this.feedbackManager.createFloatingText(
          this.player.x,
          this.player.y - 30,
          `-${result.damage} HP`,
          0xef4444
        );
        
        // CORREÇÃO MULTIPLAYER: Aplicar knockback quando atacado por criatura
        if (result.attackerId && result.attackerId.startsWith("wild-")) {
          const creature = this.getCreatureSprite(result.attackerId);
          if (creature) {
            // Calcular direção do knockback (do atacante para o jogador)
            const dx = this.player.x - creature.sprite.x;
            const dy = this.player.y - creature.sprite.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist > 0) {
              const knockbackDist = 20; // Distância do knockback
              const nx = dx / dist;
              const ny = dy / dist;
              
              // Aplicar knockback ao jogador
              this.player.x += nx * knockbackDist;
              this.player.y += ny * knockbackDist;
              
              // Enviar nova posição ao servidor
              this.mpClient?.sendPosition(this.player.x, this.player.y);
            }
          }
        }
        
        // Verificar morte
        if (result.targetDestroyed || this.activeCreatureHp <= 0) {
          // A morte será tratada pelo evento player_death separado
          console.log("[MP] Jogador local morreu por ataque");
        }
      }
      
      this.state = "combat";
      return;
    }
    
    // Se não é o jogador local, tentar encontrar a criatura alvo
    // FASE 5: Usa getCreatureSprite() unificado (worldState)
    const creature = this.getCreatureSprite(result.targetId);
    
    if (creature) {
      const newHp = Math.max(0, result.targetHp ?? creature.currentHp - result.damage);
      creature.currentHp = newHp;
      this.worldState.updateCreature(result.targetId, { currentHp: newHp });

      // Efeito visual de hit
      this.createHitImpactEffect(
        creature.sprite.x,
        creature.sprite.y,
        this.activeCreatureTheme
      );

      // Feedback de dano
      // FASE 4: Usar FeedbackManager
        this.feedbackManager.createFloatingText(
          creature.sprite.x,
          creature.sprite.y - 20,
          `-${result.damage} HP${result.isCritical ? " CRIT!" : ""}`,
          result.isCritical ? 0xfbbf24 : 0xef4444
        );

      // Se a criatura foi destruída
      if (result.targetDestroyed || creature.currentHp <= 0) {
        this.createDeathEffect(creature.sprite.x, creature.sprite.y, this.activeCreatureTheme);
        this.removeCreature(result.targetId);
        
        // FASE 6: wildCreatures removido - removeCreature já atualiza worldState
      }
    }

    this.state = "combat";
  }

  /**
   * Handler para resultado de captura recebido do servidor.
   */
  private handleCaptureResult(result: CaptureResult) {
    console.log("[MP] Resultado de captura recebido", result);
    console.log("[MP] ClientId local:", this.clientId, "PlayerId da captura:", result.playerId);

    // ✅ BUG FIX: Verificar se a captura é do jogador local
    // Apenas atualizar contador e feedback se for a captura deste jogador
    const isLocalPlayerCapture = this.clientId && result.playerId === this.clientId;
    
    if (!isLocalPlayerCapture) {
      console.log("[MP] Captura de outro jogador, ignorando atualização de contador local");
      // Ainda mostra feedback visual para outras capturas (opcional)
      // Mas não atualiza contador local
      return;
    }

    // ✅ BUG FIX: Tentar obter posição da criatura, ou usar posição armazenada
    let feedbackX: number;
    let feedbackY: number;
    
    const creature = this.getCreatureSprite(result.targetId);
    
    if (creature) {
      // Criatura ainda existe - usar posição atual
      feedbackX = creature.sprite.x;
      feedbackY = creature.sprite.y;
      console.log(`[MP] ✅ Criatura encontrada: ${result.targetId} em (${feedbackX.toFixed(0)}, ${feedbackY.toFixed(0)})`);
    } else {
      // Criatura já foi removida - usar posição armazenada
      const storedPosition = this.captureAttemptPositions.get(result.targetId);
      if (storedPosition) {
        feedbackX = storedPosition.x;
        feedbackY = storedPosition.y;
        console.log(`[MP] ⚠️ Criatura não encontrada, usando posição armazenada: ${result.targetId} em (${feedbackX.toFixed(0)}, ${feedbackY.toFixed(0)})`);
        // Limpar posição armazenada após usar
        this.captureAttemptPositions.delete(result.targetId);
      } else {
        // Fallback: usar posição do jogador
        feedbackX = this.player.x;
        feedbackY = this.player.y;
        console.log(`[MP] ⚠️ Criatura não encontrada e sem posição armazenada, usando posição do jogador: (${feedbackX.toFixed(0)}, ${feedbackY.toFixed(0)})`);
      }
    }

    // Incrementa contador de criaturas encontradas (igual ao single player)
    this.telemetry.creaturesEncountered += 1;
    
    // Registra chance de captura para cálculo de média (se fornecido pelo servidor)
    if (result.captureChance !== undefined) {
      this.telemetry.totalCaptureChanceSum += result.captureChance;
    }

    // Log de tentativa de captura (similar ao single player)
    console.log("[CAPTURA MP] Resultado", {
      targetId: result.targetId,
      chance: result.captureChance ? (result.captureChance * 100).toFixed(1) + "%" : "N/A",
      roll: result.roll ? (result.roll * 100).toFixed(1) + "%" : "N/A",
      success: result.success,
      failReason: result.failReason
    });

    if (result.success) {
      // ✅ BUG FIX: Atualizar contador de capturas
      this.creaturesCaptured += 1;
      this.telemetry.creaturesCaptured += 1;
      this.telemetry.captureSuccesses += 1; // Incrementa sucessos (igual ao single player)
      
      console.log(`[MP] ✅ Contador de capturas atualizado: ${this.creaturesCaptured} capturas`);
      console.log(`[MP] ✅ Exibindo feedback de captura em (${feedbackX.toFixed(0)}, ${feedbackY.toFixed(0)})`);

      // Feedback visual de sucesso
      // FASE 4: Usar FeedbackManager
      this.feedbackManager.createCaptureSuccessFeedback(feedbackX, feedbackY);
      
      // ✅ BUG FIX: Exibir mensagem imediatamente (sem delay)
      // A mensagem deve aparecer antes da criatura ser removida
      this.feedbackManager.createEnhancedFloatingText(
        feedbackX,
        feedbackY - 50, // Offset maior para aparecer acima da criatura
        "✅ CAPTURADO!",
        0x10b981,
        28, // Tamanho maior para sucesso
        2000 // Duração maior (2 segundos) para garantir visibilidade
      );

      // FASE 5: Remove criatura do worldState (unificado)
      // Delay maior para garantir que a mensagem seja visível antes de remover a criatura
      this.time.delayedCall(1000, () => {
        console.log(`[MP] Removendo criatura ${result.targetId} após captura`);
        this.removeCreature(result.targetId);
        // Limpar posição armazenada após remover criatura
        this.captureAttemptPositions.delete(result.targetId);
      });

      // Adiciona criatura capturada (se incluído no resultado)
      if (result.capturedCreature) {
        LocalPlayerState.addCreature(result.capturedCreature.speciesId);
      }
    } else {
      this.telemetry.captureFailures += 1;

      // Feedback visual de falha
      // FASE 4: Usar FeedbackManager
      this.feedbackManager.createEnhancedFloatingText(
        feedbackX,
        feedbackY - 20,
        `❌ Escapou! ${result.failReason || ""}`,
        0xef4444,
        20 // Tamanho médio para falha
      );
      
      // IMPORTANTE: A criatura fica agressiva após falha na captura (igual ao single player)
      if (creature) {
        creature.aiState = "chasing";
        this.worldState.updateCreature(result.targetId, { aiState: "chasing" });
      }
    }
  }

  /**
   * Handler para atualização de recursos coletados.
   * Sincroniza recursos recebidos do servidor com a renderização local.
   * Remove recursos coletados e cria novos sprites conforme necessário.
   */
  /**
   * Handler para atualização de recursos.
   * Sincroniza recursos recebidos do servidor com a renderização local.
   * Remove recursos coletados e cria novos sprites conforme necessário.
   * 
   * FASE 5: Agora usa worldState como fonte única de verdade.
   */
  private handleResourcesUpdate(resources: RemoteResource[]) {
    console.log("[MP] Recursos atualizados:", resources.length, "recursos no servidor");

    const seen = new Set<string>();
    
    for (const remoteResource of resources) {
      seen.add(remoteResource.id);
      
      const existingResource = this.worldState.getResource(remoteResource.id);
      
      // Se recurso já existe no worldState, apenas atualiza
      if (existingResource) {
        this.worldState.updateResource(remoteResource.id, {
          x: remoteResource.x,
          y: remoteResource.y,
          quantity: remoteResource.quantity ?? remoteResource.amount ?? existingResource.quantity
        });
        
        // Atualiza sprite
        this.updateResourceSprite(remoteResource.id);
      } else {
        // Determina tipo e visuais do recurso
        const resourceType = remoteResource.resourceType ?? remoteResource.type ?? "generic";
        
        // Fallback para cor baseada no tipo (se servidor não enviar)
        let defaultColor = 0xfbbf24; // Amarelo padrão
        if (resourceType.includes("cristal") || resourceType.includes("crystal")) {
          defaultColor = 0x06b6d4; // Ciano
        } else if (resourceType.includes("ferro") || resourceType.includes("iron")) {
          defaultColor = 0x9ca3af; // Cinza
        } else if (resourceType.includes("energia") || resourceType.includes("energy")) {
          defaultColor = 0x8b5cf6; // Roxo
        }
        
        const isRare = remoteResource.isRare ?? false;
        const size = remoteResource.size ?? (isRare ? 14 : 10);
        const resourceColor = remoteResource.color ?? defaultColor;
        const borderColor = remoteResource.borderColor ?? 0x92400e;
        const borderWidth = remoteResource.borderWidth ?? (isRare ? 2 : 1);
        
        // Cria novo recurso no worldState
        const resourceState: ResourceState = {
          id: remoteResource.id,
          type: resourceType,
          resourceType,
          x: remoteResource.x,
          y: remoteResource.y,
          amount: remoteResource.amount ?? remoteResource.quantity ?? 1,
          quantity: remoteResource.quantity ?? remoteResource.amount ?? 1,
          isRare,
          size,
          color: resourceColor,
          borderColor,
          borderWidth
        };
        
        this.worldState.addResource(resourceState);
        // FASE 4: Usar SpriteManager
        this.spriteManager.createResourceSprite(resourceState);
      }
    }

    // Remove recursos que foram coletados (não aparecem mais no servidor)
    // Atualiza telemetria quando recursos são realmente coletados (confirmados pelo servidor)
    for (const resourceId of this.worldState.resources.keys()) {
      if (!seen.has(resourceId)) {
        // Recurso foi coletado - atualizar telemetria
        const resource = this.worldState.getResource(resourceId);
        if (resource && resource.resourceType) {
          this.resourcesCollected += 1;
          this.telemetry.resourcesCollected += 1;
          const current = this.expeditionResources.get(resource.resourceType) ?? 0;
          this.expeditionResources.set(resource.resourceType, current + (resource.quantity ?? 1));
          
          console.log("[TELEMETRIA] Recurso coletado confirmado pelo servidor", {
            resourceId: resourceId.slice(0, 8),
            resourceType: resource.resourceType,
            quantity: resource.quantity ?? 1,
            total: this.telemetry.resourcesCollected,
            time: Math.floor(this.expeditionTime)
          });
        }
        
        this.removeResource(resourceId);
      }
    }
  }

  /**
   * Handler para atualização de criaturas selvagens.
   * Sincroniza criaturas recebidas do servidor com a renderização local.
   * Remove criaturas mortas/capturadas e cria novos sprites conforme necessário.
   * 
   * FASE 5: Agora usa worldState como fonte única de verdade.
   */
  private handleCreaturesUpdate(creatures: RemoteCreature[]) {
    // Log detalhado de criaturas (a cada ~10 updates)
    if (Math.random() < 0.1) {
      console.log(`[MP:Creatures] Update: ${creatures.length} criaturas do servidor`);
      // Log das 3 primeiras criaturas com detalhes
      for (let i = 0; i < Math.min(3, creatures.length); i++) {
        const c = creatures[i];
        const sprite = this.getCreatureSprite(c.id);
        if (sprite) {
          const distToTarget = Math.hypot(c.x - sprite.currentX, c.y - sprite.currentY);
          console.log(
            `[MP:Creatures]   ${c.id} (${c.behaviorType ?? "?"}) | ` +
            `Servidor: (${c.x.toFixed(0)}, ${c.y.toFixed(0)}) | ` +
            `Cliente: (${sprite.currentX.toFixed(0)}, ${sprite.currentY.toFixed(0)}) | ` +
            `Diff: ${distToTarget.toFixed(0)}px | ` +
            `HP: ${c.currentHp}/${c.maxHp} | ` +
            `State: ${c.aiState ?? "?"}`
          );
        }
      }
    }

    const seen = new Set<string>();
    
    for (const remoteCreature of creatures) {
      // Validação: ignorar criaturas mortas (HP <= 0)
      if (remoteCreature.currentHp <= 0) {
        console.warn(`[DEBUG:Creatures] Servidor enviou criatura morta: ${remoteCreature.id.slice(0, 8)}... (HP: ${remoteCreature.currentHp}) - Ignorando`);
        continue;
      }
      
      seen.add(remoteCreature.id);
      
      const existingCreature = this.worldState.getCreature(remoteCreature.id);
      
      // Se criatura já existe no worldState, apenas atualiza
      if (existingCreature) {
        // ✅ BUG #2 FIX: Verifica se HP mudou antes de atualizar (para logs de debug)
        const hpChanged = existingCreature.currentHp !== remoteCreature.currentHp || 
                         existingCreature.maxHp !== remoteCreature.maxHp;
        
        this.worldState.updateCreature(remoteCreature.id, {
          x: remoteCreature.x,
          y: remoteCreature.y,
          currentHp: remoteCreature.currentHp,
          maxHp: remoteCreature.maxHp,
          aiState: (remoteCreature.aiState as any) ?? existingCreature.aiState,
          behaviorType: (remoteCreature.behaviorType as any) ?? existingCreature.behaviorType
        });
        
        // ✅ BUG #2 FIX: Log de debug quando HP muda (apenas a cada 10 updates)
        if (hpChanged && Math.random() < 0.1) {
          console.log(
            `[ExpeditionScene] HP sincronizado do servidor: ${remoteCreature.id.slice(0, 8)}... ` +
            `HP: ${remoteCreature.currentHp}/${remoteCreature.maxHp} ` +
            `(antes: ${existingCreature.currentHp}/${existingCreature.maxHp})`
          );
        }
        
        // Atualiza sprite (define targetX/targetY para interpolação e HP)
        this.updateCreatureSprite(remoteCreature.id);
      } else {
        // Cria nova criatura no worldState
        const tier = (remoteCreature.tier as ThreatTier) ?? "comum";
        const behaviorType = (remoteCreature.behaviorType as EnemyBehaviorType) ?? "melee";
        
        const creatureState: CreatureState = {
          id: remoteCreature.id,
          speciesId: remoteCreature.speciesId ?? remoteCreature.creatureType ?? "unknown",
          creatureType: remoteCreature.creatureType ?? "neutral",
          x: remoteCreature.x,
          y: remoteCreature.y,
          currentHp: remoteCreature.currentHp,
          maxHp: remoteCreature.maxHp,
          tier,
          behaviorType,
          aiState: (remoteCreature.aiState as EnemyAIState) ?? "idle",
          aiConfig: ENEMY_AI_CONFIG[tier][behaviorType],
          attackCooldownRemaining: remoteCreature.attackCooldownRemaining ?? 0,
          windupTimer: remoteCreature.windupTimer ?? 0,
          stunTimer: remoteCreature.stunTimer ?? 0,
          patrolOrigin: { 
            x: remoteCreature.patrolOriginX ?? remoteCreature.x, 
            y: remoteCreature.patrolOriginY ?? remoteCreature.y 
          },
          patrolTimer: remoteCreature.patrolTimer ?? 0
        };
        
        this.worldState.addCreature(creatureState);
        // FASE 4: Usar SpriteManager
        this.spriteManager.createCreatureSprite(creatureState);
      }
    }

    // Remove criaturas que morreram/foram capturadas (não aparecem mais no servidor)
    for (const creatureId of this.worldState.creatures.keys()) {
      if (!seen.has(creatureId)) {
        console.log(`[DEBUG:Creatures] Criatura removida do servidor: ${creatureId.slice(0, 8)}... - Limpando`);
        this.removeCreature(creatureId);
      }
    }
    
    // Validação adicional: verifica sprites órfãos (sprites que existem mas não estão no worldState)
    for (const [spriteId, sprite] of this.creatureSprites) {
      if (!this.worldState.getCreature(spriteId)) {
        console.warn(`[DEBUG:Creatures] Sprite órfão encontrado durante sync: ${spriteId.slice(0, 8)}... - Removendo`);
        this.destroyCreatureSprite(spriteId);
      }
    }
  }

  /**
   * Handler para atualização de projéteis remotos.
   * Sincroniza projéteis de outros jogadores e IA do servidor.
   * FASE 4: Usa ProjectileManager como fonte de verdade.
   */
  private handleProjectilesUpdate(projectiles: import("../services/multiplayerClient").RemoteProjectile[]) {
    const seen = new Set<string>();
    
    for (const proj of projectiles) {
      // Ignorar projéteis do jogador local (já são renderizados localmente)
      if (proj.ownerId === this.clientId) continue;
      
      seen.add(proj.id);
      
      // FASE 4: Usar ProjectileManager ao invés de this.remoteProjectiles
      const existing = this.projectileManager.getRemoteProjectile(proj.id);
      
      if (existing) {
        // Atualiza posição e velocidade
        existing.sprite.setPosition(proj.x, proj.y);
        existing.velocityX = proj.velocityX;
        existing.velocityY = proj.velocityY;
        existing.lifetime = proj.lifetime;
      } else {
        // Cria novo projétil remoto
        const color = proj.isPlayerProjectile ? 0xf97316 : 0xff4444; // Laranja para jogador, vermelho para IA
        const radius = proj.isPlayerProjectile ? 4 : 5;
        
        const sprite = this.add.circle(proj.x, proj.y, radius, color);
        sprite.setStrokeStyle(1, proj.isPlayerProjectile ? 0xea580c : 0xcc0000, 0.8);
        sprite.setDepth(100); // Acima de outras entidades
        
        // Se é projétil de inimigo, criar efeito de disparo na origem
        if (!proj.isPlayerProjectile) {
          // Tentar encontrar a criatura que disparou para criar efeito visual
          const creatureSprite = this.getCreatureSprite(proj.ownerId);
          if (creatureSprite) {
            // Efeito de "muzzle flash" na criatura que atacou
            const angle = Math.atan2(proj.velocityY, proj.velocityX);
            
            // Criar efeito visual simples de ataque
            const flash = this.add.circle(
              creatureSprite.sprite.x, 
              creatureSprite.sprite.y, 
              8, 
              0xff8888, 
              0.6
            );
            this.tweens.add({
              targets: flash,
              alpha: 0,
              scale: 1.5,
              duration: 100,
              onComplete: () => flash.destroy()
            });
          }
        }
        
        // FASE 4: Usar ProjectileManager ao invés de this.remoteProjectiles
        this.projectileManager.addRemoteProjectile({
          id: proj.id,
          sprite,
          ownerId: proj.ownerId,
          isPlayerProjectile: proj.isPlayerProjectile,
          velocityX: proj.velocityX,
          velocityY: proj.velocityY,
          lifetime: proj.lifetime
        });
      }
    }
    
    // Remove projéteis que não existem mais no servidor
    // FASE 4: ProjectileManager gerencia isso no updateRemoteProjectiles()
    // Mas precisamos verificar manualmente para remover os que não estão mais na lista do servidor
    const allRemoteProjectiles = this.projectileManager.getAllRemoteProjectiles();
    for (const proj of allRemoteProjectiles) {
      if (!seen.has(proj.id)) {
        this.projectileManager.removeRemoteProjectile(proj.id);
      }
    }
  }

  /**
   * Handler para atualização de skill zones.
   * Sincroniza skill zones recebidas do servidor com a renderização local.
   */
  private handleSkillZonesUpdate(skillZones: import("../services/multiplayerClient").RemoteSkillZone[]) {
    const seen = new Set<string>();
    
    for (const zone of skillZones) {
      seen.add(zone.id);
      
      const existing = this.remoteSkillZones.get(zone.id);
      
      if (existing) {
        // Zona já existe - atualizar propriedades se necessário
        // (por enquanto zonas são estáticas, mas podemos atualizar alpha baseado em lifetime)
        const lifetimeRatio = Math.max(0, Math.min(1, zone.lifetime / 4)); // Assumindo 4s máximo
        existing.setAlpha(0.25 * lifetimeRatio + 0.1); // Fade out gradual
      } else {
        // Criar nova skill zone
        const { color, strokeColor } = this.getSkillZoneColors(zone.skillType);
        
        const circle = this.add.circle(zone.x, zone.y, zone.radius, color, 0.25);
        circle.setStrokeStyle(2, strokeColor, 0.9);
        circle.setDepth(50); // Abaixo de jogadores/criaturas mas acima do chão
        
        this.remoteSkillZones.set(zone.id, circle);
        
        // Efeito de criação (expansão)
        circle.setScale(0.1);
        this.tweens.add({
          targets: circle,
          scale: 1,
          duration: 200,
          ease: "Back.easeOut"
        });
      }
    }
    
    // Remove zones que não existem mais no servidor
    for (const [id, circle] of this.remoteSkillZones) {
      if (!seen.has(id)) {
        // Efeito de desaparecimento
        this.tweens.add({
          targets: circle,
          alpha: 0,
          scale: 1.2,
          duration: 150,
          onComplete: () => circle.destroy()
        });
        this.remoteSkillZones.delete(id);
      }
    }
  }

  /**
   * Retorna cores para renderização de skill zones baseado no tipo.
   */
  private getSkillZoneColors(skillType: "fire_fog" | "root_trap" | "electric_surge"): { color: number; strokeColor: number } {
    switch (skillType) {
      case "fire_fog":
        return { color: 0xf97316, strokeColor: 0xea580c }; // Laranja
      case "root_trap":
        return { color: 0x22c55e, strokeColor: 0x16a34a }; // Verde
      case "electric_surge":
        return { color: 0xfbbf24, strokeColor: 0xf59e0b }; // Amarelo
      default:
        return { color: 0x6366f1, strokeColor: 0x4f46e5 }; // Roxo default
    }
  }

  /**
   * Atualiza posições de projéteis remotos (interpolação baseada em velocidade).
   */

  /**
   * NOTA: Sync de fim de expedição removido.
   * O servidor já salva automaticamente recompensas quando extração completa.
   * Não é mais necessário sync manual do cliente.
   */

  /**
   * Handler para atualizações de estado de extração.
   */
  private handleExtractionState(state: ExtractionState) {
    // FASE 4: Usar ExtractionSystem
    this.state = this.extractionSystem.handleExtractionState({
      playerId: state.playerId,
      pointId: state.pointId,
      progress: state.progress,
      status: state.status === "in_progress" ? "extracting" : 
              state.status === "completed" ? "completed" : "cancelled"
    });
    
    // Processa recompensas se extração completou
    if (state.status === "completed" && state.rewards) {
      // Atualizar telemetria de sucesso
      if (!this.telemetry.extractionSuccess) {
        this.telemetry.extractionSuccess = true;
        // Usar tempo do servidor se disponível, senão usar tempo local
        const finalTime = this.lastMatchState?.elapsedSeconds ?? this.expeditionTime;
        this.telemetry.timeSpent = finalTime;
        
        // Calcula métricas finais
        const timeMinutes = finalTime / 60;
        this.telemetry.resourcesPerMinute = this.telemetry.resourcesCollected / Math.max(0.1, timeMinutes);
        this.telemetry.creaturesPerMinute = this.telemetry.creaturesCaptured / Math.max(0.1, timeMinutes);
        this.telemetry.averageCaptureChance = this.telemetry.captureAttempts > 0
          ? this.telemetry.totalCaptureChanceSum / this.telemetry.captureAttempts
          : 0;
        
        console.log("[TELEMETRIA] Extração bem-sucedida", {
          "Tempo Total (s)": Math.floor(this.telemetry.timeSpent),
          "Recursos Coletados": this.telemetry.resourcesCollected,
          "Criaturas Capturadas": this.telemetry.creaturesCaptured,
          "Tentativas de Captura": this.telemetry.captureAttempts,
          "Taxa de Sucesso (%)": this.telemetry.captureAttempts > 0
            ? ((this.telemetry.creaturesCaptured / this.telemetry.captureAttempts) * 100).toFixed(1)
            : "0.0"
        });
      }
      
      // Adicionar recursos coletados
      for (const [itemId, qty] of Object.entries(state.rewards.resources ?? {})) {
        if (qty > 0) {
          LocalPlayerState.addItem(itemId, qty);
          console.log(`[Extraction] Recurso adicionado: ${itemId} x${qty}`);
        }
      }
      
      // Retornar itens não usados ao inventário permanente
      if (state.rewards.unusedItems) {
        for (const [itemId, qty] of Object.entries(state.rewards.unusedItems)) {
          if (qty > 0) {
            LocalPlayerState.addItem(itemId, qty);
            console.log(`[Extraction] Item não usado retornado: ${itemId} x${qty}`);
          }
        }
      }
      
      const creaturesCaptured = state.rewards.creaturesCaptured || 0;
      const savedToCloud = state.rewards.savedToCloud ?? false;
      const unusedItemsCount = Object.keys(state.rewards.unusedItems ?? {}).length;
      
      console.log(`[Extraction] ✅ Extração completada!`);
      console.log(`[Extraction] - Recursos: ${Object.keys(state.rewards.resources ?? {}).length} tipos`);
      console.log(`[Extraction] - Criaturas capturadas: ${creaturesCaptured}`);
      console.log(`[Extraction] - Itens não usados retornados: ${unusedItemsCount} tipos`);
      console.log(`[Extraction] - Salvo no Firebase: ${savedToCloud ? 'Sim' : 'Não'}`);
      
      // IMPORTANTE: Criaturas são salvas diretamente no Firebase pelo servidor
      // O cliente deve confiar no onSnapshot para receber as atualizações
      // Forçar uma pequena espera para garantir que o Firebase processou a atualização
      if (savedToCloud && creaturesCaptured > 0) {
        console.log(`[Extraction] ⏳ Aguardando sincronização do Firebase para ${creaturesCaptured} criaturas...`);
        // O onSnapshot do Firebase Client deve disparar automaticamente
        // Mas podemos verificar se há uma forma de forçar refresh se necessário
        setTimeout(() => {
          const currentCreatures = LocalPlayerState.getProgress().creatures.length;
          console.log(`[Extraction] 📊 Criaturas no inventário após sincronização: ${currentCreatures}`);
        }, 2000);
      }
      
      // Feedback visual
      this.createExtractionSuccessFeedback();
      
      // NOTA: XP agora é calculado e salvo no servidor
      // O cliente apenas mostra feedback visual (se necessário)
      // O XP será sincronizado via Firebase onSnapshot
    }
  }

  /**
   * Handler para eventos de partida.
   */
  private handleMatchEvent(event: MatchEvent) {
    console.log("[MP] Evento de partida:", event.event);

    switch (event.event) {
      case "started":
        // FASE 4: Usar FeedbackManager
        this.feedbackManager.createFloatingText(
          this.scale.width / 2,
          this.scale.height / 2 - 100,
          "PARTIDA INICIADA!",
          0x3b82f6
        );
        break;

      case "almost_finished":
        // FASE 4: Usar FeedbackManager
        this.feedbackManager.createFloatingText(
          this.scale.width / 2,
          this.scale.height / 2 - 100,
          `RESTAM ${event.timeLeft}s!`,
          0xfbbf24
        );
        break;

      case "finished":
        // FASE 4: Usar FeedbackManager
        this.feedbackManager.createFloatingText(
          this.scale.width / 2,
          this.scale.height / 2,
          "TEMPO ESGOTADO!",
          0xef4444
        );
        // Força falha se ainda não extraiu
        // IMPORTANTE: Verificar se o estado é "extracted" ANTES de marcar como falha
        // Isso evita marcar como falha quando a extração foi completada mas o match_event chegou antes
        if (this.state !== "extracted") {
          this.state = "failed";
          
          // Registrar telemetria de falha por tempo (se ainda não registrou)
          if (!this.telemetry.extractionFailed && !this.telemetry.extractionSuccess) {
            this.telemetry.extractionFailed = true;
            // Usar tempo do servidor se disponível, senão usar tempo local
            this.telemetry.timeSpent = this.lastMatchState?.elapsedSeconds ?? this.expeditionTime;

            const timeMinutes = this.expeditionTime / 60;
            this.telemetry.resourcesPerMinute =
              this.telemetry.resourcesCollected / Math.max(0.1, timeMinutes);
            this.telemetry.creaturesPerMinute =
              this.telemetry.creaturesCaptured / Math.max(0.1, timeMinutes);
            this.telemetry.averageCaptureChance =
              this.telemetry.captureAttempts > 0
                ? this.telemetry.totalCaptureChanceSum / this.telemetry.captureAttempts
                : 0;

            console.log("[TELEMETRIA] Expedição falhou - tempo esgotado (multiplayer)");
            console.table({
              "Tempo Total (s)": Math.floor(this.telemetry.timeSpent),
              "Recursos Coletados": this.telemetry.resourcesCollected,
              "Criaturas Capturadas": this.telemetry.creaturesCaptured,
              Status: "FALHA (TEMPO ESGOTADO)"
            });
            
            // Mesmo em falha, criaturas ganham XP (sem bônus de extração)
            this.processCreatureXp(false);
          }
        }
        break;
    }
  }

  /**
   * Handler para morte de jogador.
   */
  private handlePlayerDeath(death: PlayerDeath) {
    console.log("[MP] Jogador morreu:", death);

    // Verificar se é o jogador local que morreu
    const isLocalPlayer = death.playerId === this.mpClient?.getClientId();
    
    if (isLocalPlayer) {
      // Processar morte do jogador local (igual ao single player)
      if (this.state === "failed") return; // Já processado
      
      this.state = "failed";
      this.activeCreatureHp = 0;
      
      // Registrar telemetria de falha
      if (!this.telemetry.extractionFailed) {
        this.telemetry.extractionFailed = true;
        // Usar tempo do servidor se disponível, senão usar tempo local
        this.telemetry.timeSpent = this.lastMatchState?.elapsedSeconds ?? this.expeditionTime;

        const timeMinutes = this.expeditionTime / 60;
        this.telemetry.resourcesPerMinute =
          this.telemetry.resourcesCollected / Math.max(0.1, timeMinutes);
        this.telemetry.creaturesPerMinute =
          this.telemetry.creaturesCaptured / Math.max(0.1, timeMinutes);
        this.telemetry.averageCaptureChance =
          this.telemetry.captureAttempts > 0
            ? this.telemetry.totalCaptureChanceSum / this.telemetry.captureAttempts
            : 0;

        console.log("[TELEMETRIA] Expedição falhou - morte em combate (multiplayer)");
        console.table({
          "Tempo Total (s)": Math.floor(this.telemetry.timeSpent),
          "Recursos Coletados": this.telemetry.resourcesCollected,
          "Dano Recebido": this.telemetry.damageTaken.toFixed(1),
          "Morto Por": death.killedBy || "desconhecido",
          Status: "FALHA (MORTE EM COMBATE)"
        });
        
        // Mesmo em falha, criaturas ganham XP (sem bônus de extração)
        this.processCreatureXp(false);
      }
      
      // Feedback visual
      this.feedbackManager.createFloatingText(
        this.scale.width / 2,
        this.scale.height / 2,
        `💀 VOCÊ MORREU`,
        0xef4444
      );
    } else {
      // Outro jogador morreu - apenas feedback visual
      this.feedbackManager.createFloatingText(
        this.scale.width / 2,
        this.scale.height / 2,
        `${death.playerId.slice(0, 8)}... foi eliminado`,
        0xfacc15
      );
    }

    // Desabilita controles
    this.input.keyboard?.disableGlobalCapture();
  }

  /**
   * Cleanup ao sair da cena (retornar para base, etc).
   * Desconecta multiplayer e limpa referências.
   * 
   * FASE 4C: Atualizado para usar worldState e playerSprites.
   */
  shutdown(): void {
    // Desconecta do servidor multiplayer se conectado
    if (this.mpClient) {
      this.mpClient.disconnect();
      this.mpClient = null;
    }

    // FASE 4C: Limpa sprites de jogadores
    for (const playerId of this.playerSprites.keys()) {
      this.destroyPlayerSprite(playerId);
    }
    this.playerSprites.clear();
    
    // Limpa projéteis remotos
    // FASE 4: ProjectileManager gerencia a limpeza de projéteis remotos
    // Não precisa limpar manualmente aqui, o ProjectileManager.clear() já faz isso
    
    // FASE 5: Limpa worldState (unificado)
    if (this.worldState) {
      this.worldState.players.clear();
      this.worldState.creatures.clear();
      this.worldState.resources.clear();
    }
  }
}

