import Phaser from "phaser";
import { PlayerState as LocalPlayerState } from "../game/playerState";
import { getCreatureById } from "../../shared/creatures";
import { type CreatureTheme } from "../game/creatureThemes";
import { getUserId } from "../services/firebaseClient";
import {
  getEffectiveStats,
} from "../game/creatureProgression";
import {
  AttackResult,
  CaptureResult,
  ExtractionState,
  MatchEvent,
  MultiplayerClient,
  type MatchState,
  type PlayerDeath
} from "../services/multiplayerClient";
import {
  EXPEDITION_DURATION_SECONDS,
} from "../game/constants";
import { type MapConfig } from "../game/maps";
import { HPBarManager } from "../game/hpBars";
import { 
  type GameWorldState, 
  RemoteWorldState,
} from "../game/worldState";

import type { 
  ExpeditionState, 
  ExpeditionTelemetry,
  RemoteCreatureSprite,
  RemoteResourceSprite,
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
import { ExtractionSystem } from "./expedition/systems/ExtractionSystem";
import { MovementSystem } from "./expedition/systems/MovementSystem";
import { SkillSystem } from "./expedition/systems/SkillSystem";
import { CaptureSystem } from "./expedition/systems/CaptureSystem";
import { TeamSystem } from "./expedition/systems/TeamSystem";
import { ItemSystem } from "./expedition/systems/ItemSystem";
import { ProgressionSystem } from "./expedition/systems/ProgressionSystem";
import { CombatSystem } from "./expedition/systems/CombatSystem";
import { VisualSystem } from "./expedition/systems/VisualSystem";
import { InteractionSystem } from "./expedition/systems/InteractionSystem";
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

  private extractionZone!: Phaser.GameObjects.Rectangle;
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

  private dangerRing!: Phaser.GameObjects.Arc;
  private mapConfig!: MapConfig;

  /**
   * Estado unificado do mundo (multiplayer-first).
   * Gerencia criaturas, recursos, jogadores e pontos de extração.
   * Sempre usa RemoteWorldState - o servidor é a fonte de verdade.
   */
  private worldState!: GameWorldState;

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


  // Controle de dano recebido do jogador
  private damageTakenRecently = 0;
  private damageTakenDecayTimer = 0;
  private readonly dangerLowHpThreshold = 0.3; // 30% do HP

  // ============================================================================
  // MECÂNICAS AVANÇADAS
  // ============================================================================


  private mpClient: MultiplayerClient | null = null;
  private clientId: string | null = null; // ID do cliente local para filtrar da lista de remotos
  

  
  private teamSwitchKeys: Phaser.Input.Keyboard.Key[] = [];
  
  // ============================================================================
  // SISTEMA DE PROGRESSÃO DE CRIATURAS
  // ============================================================================
  
  
  
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
  private extractionSystem!: ExtractionSystem;
  private movementSystem!: MovementSystem;
  private skillSystem!: SkillSystem;
  private captureSystem!: CaptureSystem;
  private teamSystem!: TeamSystem;
  private itemSystem!: ItemSystem;
  private progressionSystem!: ProgressionSystem;
  private combatSystem!: CombatSystem;
  private visualSystem!: VisualSystem;
  private interactionSystem!: InteractionSystem;
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
    this.resourcesCollected = 0;
    this.creaturesCaptured = 0;
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

    // ============================================================================
    // ============================================================================
    this.sceneInitializer = new SceneInitializer(this, this.worldState);
    this.mapConfig = this.sceneInitializer.initializeMapConfig();
    this.sceneInitializer.initializeExpeditionSettings();
    this.expeditionDuration = this.sceneInitializer.getExpeditionDuration();

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
      this.telemetry
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
    // Verifica query param para debug
    const debugUrlParams = new URLSearchParams(window.location.search);
    if (debugUrlParams.get("debug") === "1") {
      this.debugPanel.toggle();
    }

    // Configura a câmera para seguir o jogador com zoom
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(this.mapConfig.world.cameraZoom);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    this.hudManager.create();

    this.skillCooldownUI.create();

    this.extractionUI.create();
    
    this.debugPanel.create();
    
    this.minimapManager = new MinimapManager(this);
    this.minimapManager.create(viewportWidth, viewportHeight, worldWidth, worldHeight, zoneX, zoneY, this.mapConfig);

    // Inicializa telemetria
    this.telemetry.expeditionStartTime = Date.now();

    // Inicializa criaturas da equipe usando TeamSystem
    const progress = LocalPlayerState.getProgress();
    const activeTeamIds = progress.activeTeamIds.slice(0, progress.teamSlots).slice(0, 3);
    
    // Inicializar TeamSystem
    this.teamSystem = new TeamSystem();
    this.teamSystem.initialize(activeTeamIds);
    this.teamSystem.setUpdatePlayerVisual(() => this.visualSystem.updatePlayerVisual(this.teamSystem.activeTheme));
    
    // Inicializar ProgressionSystem
    this.progressionSystem = new ProgressionSystem(this, this.telemetry, this.feedbackManager);
    this.progressionSystem.updateReferences(
      this.expeditionTime,
      activeTeamIds,
      this.teamSystem.activeInstanceId
    );
    
    // Inicializar VisualSystem
    this.visualSystem = new VisualSystem(this, this.player);
    this.visualSystem.setDangerRing(this.dangerRing);
    // ✅ Conectar skillSystem ao visualSystem (será feito depois que skillSystem for criado)
    
    // Arquitetura multiplayer-first: servidor sempre inicializa o mundo
    // Não faz spawn local - aguarda sincronização do servidor
    
    // Inicializa sistema de barras de HP (após criaturas da equipe serem configuradas)
    this.initializeHPBars(progress);
    
    // ============================================================================
    // ============================================================================
    
    // MovementSystem (precisa do player e controles)
    this.movementSystem = new MovementSystem(
      this.player,
      this.cursors,
      this.wasdKeys,
      this.teamSystem.moveSpeed,
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
        this.teamSystem.updateActiveCreatureHp(
          Math.min(
            this.teamSystem.activeMaxHp,
            this.teamSystem.activeHp + amount
          )
        );
      },
      activeCreatureHp: this.teamSystem.activeHp,
      activeCreatureMaxHp: this.teamSystem.activeMaxHp,
      getActiveCreatureInstanceId: () => this.teamSystem.activeInstanceId,
      player: this.player,
      getAllCreatures: () => this.spriteManager.getAllCreatures(),
      createHitImpactEffect: (x, y, theme) => this.visualSystem.createHitImpactEffect(x, y, theme),
      createDeathEffect: (x, y, theme) => this.visualSystem.createDeathEffect(x, y, theme),
      createHealFeedback: (x, y) => this.feedbackManager.createHealFeedback(x, y)
    });
    
    // Conectar TeamSystem com SkillSystem
    this.teamSystem.setSkillSystem(this.skillSystem);
    
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
      dealDamageToPlayer: () => {
        // Dano é processado no servidor - este callback não é mais usado
        // Mantido apenas para compatibilidade com ProjectileManager
      },
      createDeathEffect: (x, y, theme) => this.visualSystem.createDeathEffect(x, y, theme),
      createEnhancedFloatingText: (x, y, text, color, fontSize) => 
        this.feedbackManager.createEnhancedFloatingText(x, y, text, color, fontSize),
      sendCaptureAttempt: (creatureId: string, ballType: string) => {
        if (this.mpClient) {
          // ✅ BUG FIX: Armazenar posição da criatura antes de enviar tentativa
          const creature = this.spriteManager.getCreatureSprite(creatureId);
          if (creature) {
            this.captureSystem.storeCaptureAttemptPosition(
              creatureId,
              creature.sprite.x,
              creature.sprite.y
            );
            console.log(`[MP] 💾 Armazenando posição de captura para ${creatureId}: (${creature.sprite.x.toFixed(0)}, ${creature.sprite.y.toFixed(0)})`);
          }
          this.mpClient.sendCaptureAttempt(creatureId, ballType as "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra");
        }
      }
    });
    
    // Inicializar CaptureSystem
    this.captureSystem = new CaptureSystem(
      this,
      this.player,
      this.expeditionInventory,
      this.mpClient,
      this.projectileManager,
      this.feedbackManager,
      this.telemetry
    );
    
    // Inicializar ItemSystem
    this.itemSystem = new ItemSystem(
      this.feedbackManager,
      (amount) => {
        this.teamSystem.updateActiveCreatureHp(
          Math.min(
            this.teamSystem.activeMaxHp,
            this.teamSystem.activeHp + amount
          )
        );
      },
      this.teamSystem.activeHp,
      this.teamSystem.activeMaxHp
    );
    this.itemSystem.setUpdateCreatureHp((instanceId, hp) => {
      // Atualizar HP diretamente no TeamSystem
      // O TeamSystem gerencia o HP das criaturas durante a expedição
      // O HP será salvo no final da expedição
      this.teamSystem.updateCreatureHp(instanceId, hp);
    });
    this.itemSystem.setActiveCreatureInstanceId(this.teamSystem.activeInstanceId);
    
    // Inicializar CombatSystem
    this.combatSystem = new CombatSystem(
      this,
      this.player,
      this.projectileManager,
      () => this.spriteManager.getAllCreatures(),
      this.telemetry,
      (x, y, theme) => this.visualSystem.createHitImpactEffect(x, y, theme),
      (x, y, theme) => this.visualSystem.createDeathEffect(x, y, theme),
      (x, y, angle, theme) => this.visualSystem.createMuzzleFlash(x, y, angle, theme)
    );
    this.combatSystem.setActiveCreature(
      this.teamSystem.activeDef,
      this.teamSystem.activeTheme,
      this.teamSystem.activeInstanceId
    );
    this.combatSystem.setCooldownTime(this.teamSystem.attackCooldownTime);
    
    // ✅ Conectar MovementSystem ao CombatSystem para bloquear movimento durante windup
    this.movementSystem.setCombatSystem(this.combatSystem);
    this.movementSystem.setSkillSystem(this.skillSystem); // ✅ Conectar skillSystem para bloquear movimento durante windup de skill
    
    // Inicializar InteractionSystem
    this.interactionSystem = new InteractionSystem(
      this,
      this.player,
      this.extractionZone,
      this.extractKey,
      this.captureKey,
      this.mpClient,
      this.extractionSystem,
      this.captureSystem,
      this.feedbackManager,
      this.spriteManager,
      this.worldState
    );
    
    // Configurar MultiplayerHandlers com todas as dependências
    this.multiplayerHandlers.setDependencies({
      mpClient: this.mpClient,
      clientId: this.clientId,
      teamSystem: this.teamSystem,
      feedbackManager: this.feedbackManager,
      captureSystem: this.captureSystem,
      extractionSystem: this.extractionSystem,
      progressionSystem: this.progressionSystem,
      visualSystem: this.visualSystem,
      projectileManager: this.projectileManager,
      player: this.player,
      scene: this,
      setState: (state) => { this.state = state; },
      getState: () => this.state,
      setEndSceneTimer: (timer) => { this.endSceneTimer = timer; },
      getExpeditionTime: () => this.expeditionTime,
      getLastMatchState: () => this.lastMatchState,
      setDamageTakenRecently: (damage) => { this.damageTakenRecently += damage; },
      setDamageTakenDecayTimer: (timer) => { this.damageTakenDecayTimer = timer; },
      setPlayerTookDamageThisFrame: (value) => { this.playerTookDamageThisFrame = value; },
      setCreaturesCaptured: (count) => { this.creaturesCaptured = count; },
      getCreaturesCaptured: () => this.creaturesCaptured,
      disableControls: () => { this.input.keyboard?.disableGlobalCapture(); }
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
        this.combatSystem.tryBasicAttack(pointer.worldX, pointer.worldY);
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
        if (this.combatSystem) {
          this.combatSystem.setMpClient(this.mpClient);
        }
        if (this.captureSystem) {
          this.captureSystem.setMpClient(this.mpClient);
        }
        if (this.teamSystem) {
          this.teamSystem.setMpClient(this.mpClient);
        }
        if (this.interactionSystem) {
          this.interactionSystem.setMpClient(this.mpClient);
        }
        // Atualizar MultiplayerHandlers com clientId e mpClient
        this.multiplayerHandlers.setDependencies({
          mpClient: this.mpClient,
          clientId: this.clientId,
          projectileManager: this.projectileManager
        });
        
        // Usar posição inicial fornecida pelo servidor
        if (data.initialPosition) {
          this.player.setPosition(data.initialPosition.x, data.initialPosition.y);
          console.log("[MP] Posição inicial do servidor:", data.initialPosition);
        }
        
        // Enviar dados do time ao servidor
        const teamIds = this.teamSystem.teamIds;
        const teamData = teamIds.map(instanceId => {
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
          this.mpClient.sendTeamData(teamData, this.teamSystem.activeInstanceId);
          console.log("[MP] Dados do time enviados:", teamData);
        }
      });
      
      // Sincroniza jogadores remotos quando recebe atualizações de estado
      this.mpClient.on("state", (players, match, world) => {
        this.multiplayerHandlers.syncRemotePlayers(players, this.clientId);

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
      
      // attackResult processado via MultiplayerHandlers
      this.mpClient.on("attackResult", (result) => {
        this.multiplayerHandlers.handleAttackResult(result);
      });
      this.mpClient.on("captureResult", (result) => {
        console.log("[MP] 🎯 Evento captureResult recebido no handler:", result);
        this.multiplayerHandlers.handleCaptureResult(result);
      });
      this.mpClient.on("creaturesUpdate", (creatures) => this.multiplayerHandlers.handleCreaturesUpdate(creatures));
      this.mpClient.on("resourcesUpdate", (resources) => this.multiplayerHandlers.handleResourcesUpdate(resources));
      this.mpClient.on("projectilesUpdate", (projectiles) => {
        // Processar atualização via ProjectileManager
        this.projectileManager.handleProjectilesUpdate(
          projectiles,
          this.clientId,
          (id) => this.spriteManager.getCreatureSprite(id)
        );
      });
      this.mpClient.on("skillZonesUpdate", (skillZones) => {
        // Processar atualização via SkillZoneManager
        this.skillZoneManager.handleSkillZonesUpdate(skillZones);
      });
      this.mpClient.on("extractionState", (state) => {
        // Processar via MultiplayerHandlers (inclui atualização de estado e recompensas)
        this.multiplayerHandlers.handleExtractionState(state);
      });
      this.mpClient.on("matchEvent", (event) => {
        this.multiplayerHandlers.handleMatchEvent(event);
      });
      this.mpClient.on("playerDeath", (death) => {
        this.multiplayerHandlers.handlePlayerDeath(death);
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
   * Obtém todas as criaturas do worldState.
   * Usa SpriteManager como fonte de verdade.
   */
    /**
   * Inicializa o sistema de barras de HP.
   * Cria a barra principal do jogador e barras para cada criatura da equipe.
   */
  private initializeHPBars(
    progress: ReturnType<typeof LocalPlayerState.getProgress>
  ) {
    this.hpBarManager = new HPBarManager(this);

    // Posição do HUD de barras de HP (abaixo do HUD de texto compacto)
    const hudX = 22;
    const hudY = 115; // Abaixo do HUD compacto (altura 90 + margem)

    // Cria barra de HP do jogador/criatura ativa
    this.hpBarManager.createPlayerBar(hudX, hudY, this.teamSystem.activeDef);
    
    // Conectar TeamSystem com HPBarManager
    this.teamSystem.setHpBarManager(this.hpBarManager);

    // Cria barras para cada criatura da equipe (até 3)
    const allyBarStartY = hudY + 40;
    const allyBarSpacing = 35;
    const teamIds = this.teamSystem.teamIds;

    for (let i = 0; i < teamIds.length; i++) {
      const instanceId = teamIds[i];
      const owned = progress.creatures.find((c) => c.instanceId === instanceId);
      const def = owned ? getCreatureById(owned.definitionId) ?? null : null;
      const isActive = i === this.teamSystem.activeIndex;

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
      this.teamSystem.activeHp,
      this.teamSystem.activeMaxHp,
      this.teamSystem.activeDef,
      this.playerTookDamageThisFrame
    );

    // Reset flag de dano após atualização
    this.playerTookDamageThisFrame = false;

    // Atualiza barras das criaturas aliadas
    const teamIds = this.teamSystem.teamIds;
    for (let i = 0; i < teamIds.length; i++) {
      const instanceId = teamIds[i];
      const owned = progress.creatures.find((c) => c.instanceId === instanceId);
      const def = owned ? getCreatureById(owned.definitionId) ?? null : null;
      const isActive = i === this.teamSystem.activeIndex;

      // HP da criatura: usa TeamSystem
      const hp = this.teamSystem.getCreatureHp(instanceId);
      const maxHp = this.teamSystem.getCreatureMaxHp(instanceId);

      this.hpBarManager.updateAllyBar(instanceId, hp, maxHp, isActive);
    }

    // Atualiza barras de inimigos próximos
    const enemyData = this.spriteManager.getAllCreatures().map((wc) => ({
      id: wc.id,
      x: wc.sprite.x,
      y: wc.sprite.y,
      currentHp: wc.currentHp,
      maxHp: wc.maxHp,
      inCombat: this.state === "combat"
    }));

    this.hpBarManager.updateEnemyBars(enemyData, this.player.x, this.player.y);
  }

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
        // Resetar timer de redirecionamento para garantir contagem correta
        this.endSceneTimer = 0;
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
        // Limpar sprites de jogadores via SpriteManager
        const playerIds = this.spriteManager?.getAllPlayerIds() ?? [];
        for (const playerId of playerIds) {
          this.spriteManager?.destroyPlayerSprite(playerId);
        }
        
        // Limpa o sistema de barras de HP antes de trocar de cena
        if (this.hpBarManager) {
          this.hpBarManager.destroy();
        }
        this.scene.start("BaseHubScene");
      }
      return;
    }
    
    // Atualiza cooldowns de ataque básico e habilidade especial
    this.combatSystem.update(dt);

    // Atualiza indicador visual de tempo restante
    const timeRatio = Math.max(
      0,
      1 - this.expeditionTime / this.expeditionDuration
    );

    // Processar troca de criaturas
    this.teamSystem.handleCreatureSwitching(
      this.teamSwitchKeys,
      (index, label) => {
        this.feedbackManager.createFloatingText(
          this.player.x,
          this.player.y - 40,
          `Criatura ativa: ${label}`,
          0x22c55e
        );
        // Atualizar sistemas dependentes
        this.movementSystem.setSpeed(this.teamSystem.moveSpeed);
        this.combatSystem.setActiveCreature(
          this.teamSystem.activeDef,
          this.teamSystem.activeTheme,
          this.teamSystem.activeInstanceId
        );
        this.combatSystem.setCooldownTime(this.teamSystem.attackCooldownTime);
        this.itemSystem.updateActiveCreatureHp(
          this.teamSystem.activeHp,
          this.teamSystem.activeMaxHp
        );
        this.itemSystem.setActiveCreatureInstanceId(this.teamSystem.activeInstanceId);
      }
    );
    
    // Bloquear movimento durante loading
    if (!this.loadingOverlay.visible) {
      this.movementSystem.update(dt, this.state);
      this.combatSystem.handleCombatInput(
        this.attackKey,
        this.skillKey,
        this.healKey,
        this.player.x,
        this.player.y,
        (x, y) => this.skillSystem.tryUseSpecialSkill(x, y),
        (x, y) => this.itemSystem.tryUsePotion(x, y),
        () => this.loadingOverlay.visible
      );
      this.interactionSystem.handleInteractions(dt);
    } else {
      // Garantir que o jogador não se move durante loading
      if (this.player) {
        this.player.setVelocity(0, 0);
      }
    }
    
    this.state = this.projectileManager.update(dt, this.state) as ExpeditionState;
    
    this.skillZoneManager.update(dt);
    
    // Atualizar referências do VisualSystem para cálculo de perigo
    this.visualSystem.updateDangerReferences(
      this.teamSystem.activeHp,
      this.teamSystem.activeMaxHp,
      this.teamSystem.activeTheme,
      this.damageTakenRecently,
      this.damageTakenDecayTimer
    );
    
    // ✅ Atualizar efeito visual de windup do jogador
    this.visualSystem.updatePlayerWindupVisual();
    // Atualizar decay do dano recebido
    if (this.damageTakenDecayTimer > 0) {
      this.damageTakenDecayTimer -= dt;
      if (this.damageTakenDecayTimer <= 0) {
        this.damageTakenRecently = 0;
      }
    }
    this.visualSystem.updateDangerRing(timeRatio, this.state);
    this.updateEnemyAI(dt);
    
    // Atualiza VisualSystem com tempo da expedição
    this.visualSystem.updateExpeditionTime(this.expeditionTime);

    // Toggle do painel de debug (F1) - gerenciado pelo DebugPanel
    const f1Key = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
    if (Phaser.Input.Keyboard.JustDown(f1Key)) {
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
      this.teamSystem.activeHp,
      this.teamSystem.activeMaxHp,
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
    this.spriteManager.updateCreatureSprites(dt, this.player.x, this.player.y);
    this.spriteManager.updateResourceSprites(dt);
    this.spriteManager.updatePlayerSprites(dt, this.player.x, this.player.y);
    
    // Atualiza barras de HP (jogador, aliados e inimigos)
    this.updateHPBars();
    
    this.minimapManager.update(this.player.x, this.player.y);
    
    // Registra tempo ativo da criatura atual
    this.progressionSystem.trackActiveCreatureTime(this.teamSystem.activeInstanceId, dt);
    
    // Atualizar SkillSystem cooldown
    this.skillSystem.update(dt);
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
    // Cliente apenas atualiza visuais usando VisualSystem
    const creaturesInRange = this.spriteManager.getAllCreatures();
    this.visualSystem.updateCreatureVisuals(creaturesInRange);
  }

  // ============================================================================
  // SISTEMA DE PROGRESSÃO - XP DE EXPEDIÇÃO
  // ============================================================================

  /**
   * Processa e distribui XP para todas as criaturas da equipe após a expedição.
   * @param extractionSuccess Se a extração foi bem-sucedida (bônus de XP)
   */
  private processCreatureXp(extractionSuccess: boolean) {
    this.progressionSystem.updateReferences(
      this.expeditionTime,
      this.teamSystem.teamIds,
      this.teamSystem.activeInstanceId
    );
    this.progressionSystem.processCreatureXp(extractionSuccess);
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

    // FASE 4C: Limpa sprites de jogadores via SpriteManager
    const playerIds = this.spriteManager?.getAllPlayerIds() ?? [];
    for (const playerId of playerIds) {
      this.spriteManager?.destroyPlayerSprite(playerId);
    }
    
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
