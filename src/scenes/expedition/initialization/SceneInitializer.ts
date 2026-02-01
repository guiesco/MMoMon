import Phaser from "phaser";
import { PlayerState as LocalPlayerState } from "../../../game/playerState";
import { getMapConfig, normalizeMapId, type MapConfig } from "../../../game/maps";
import { EXTRACTION_REQUIRED_SECONDS } from "../../../game/constants";
import type { GameWorldState } from "../../../game/worldState";
import type { ExpeditionState, ExpeditionTelemetry } from "../types/ExpeditionTypes";

/**
 * Responsável por inicializar a cena de expedição.
 * Organiza toda a lógica de setup inicial.
 */
export class SceneInitializer {
  private scene: Phaser.Scene;
  private worldState: GameWorldState;
  private mapConfig: MapConfig | null = null;
  private expeditionDuration: number = 0;
  private extractionRequired: number = EXTRACTION_REQUIRED_SECONDS;

  constructor(scene: Phaser.Scene, worldState: GameWorldState) {
    this.scene = scene;
    this.worldState = worldState;
  }

  /**
   * Inicializa a configuração do mapa.
   */
  initializeMapConfig(): MapConfig {
    const urlParamsForMap = new URLSearchParams(window.location.search);
    const mapFromQuery = normalizeMapId(urlParamsForMap.get("map"));
    const mapId = mapFromQuery ?? LocalPlayerState.getSelectedMapId();
    this.mapConfig = getMapConfig(mapId);
    return this.mapConfig;
  }

  /**
   * Obtém a configuração do mapa.
   */
  getMapConfig(): MapConfig {
    if (!this.mapConfig) {
      throw new Error("MapConfig não foi inicializado. Chame initializeMapConfig() primeiro.");
    }
    return this.mapConfig;
  }

  /**
   * Inicializa configurações de duração e extração.
   */
  initializeExpeditionSettings(): void {
    if (!this.mapConfig) {
      throw new Error("MapConfig deve ser inicializado antes de chamar initializeExpeditionSettings()");
    }
    this.expeditionDuration = this.mapConfig.durationSeconds;
    this.extractionRequired =
      this.mapConfig.extraction.extractionRequiredSeconds ??
      EXTRACTION_REQUIRED_SECONDS;
  }

  /**
   * Obtém a duração da expedição.
   */
  getExpeditionDuration(): number {
    return this.expeditionDuration;
  }

  /**
   * Obtém o tempo necessário para extração.
   */
  getExtractionRequired(): number {
    return this.extractionRequired;
  }

  /**
   * Configura os limites físicos do mundo.
   */
  setupPhysicsBounds(worldWidth: number, worldHeight: number): void {
    this.scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);
  }

  /**
   * Cria o fundo visual do mapa.
   */
  createBackground(worldWidth: number, worldHeight: number): void {
    if (!this.mapConfig) return;

    // Fundo primário
    this.scene.add
      .rectangle(
        worldWidth / 2,
        worldHeight / 2,
        worldWidth,
        worldHeight,
        this.mapConfig.visual.backgroundPrimary
      )
      .setOrigin(0.5);

    // Fundo secundário (gradiente fake)
    this.scene.add
      .rectangle(
        worldWidth / 2,
        worldHeight / 2 + 40,
        worldWidth,
        worldHeight - 80,
        this.mapConfig.visual.backgroundSecondary,
        1
      )
      .setOrigin(0.5);
  }

  /**
   * Cria elementos de cenário (blocos decorativos).
   */
  createScenery(worldWidth: number, worldHeight: number): void {
    if (!this.mapConfig) return;

    const numSceneryBlocks = Math.floor((worldWidth * worldHeight) / 15000);
    for (let i = 0; i < numSceneryBlocks; i++) {
      const x = Phaser.Math.Between(40, worldWidth - 40);
      const y = Phaser.Math.Between(100, worldHeight - 40);
      const size = Phaser.Math.Between(16, 40);
      const color = Phaser.Math.RND.pick(this.mapConfig.visual.tileColors);
      this.scene.add.rectangle(x, y, size, size, color, 0.85);
    }
  }

  /**
   * Cria a zona de extração.
   */
  createExtractionZone(
    worldWidth: number,
    worldHeight: number
  ): { zone: Phaser.GameObjects.Rectangle; outline: Phaser.GameObjects.Rectangle; x: number; y: number } {
    if (!this.mapConfig) {
      throw new Error("MapConfig deve ser inicializado");
    }

    const zoneWidth = worldWidth * this.mapConfig.extraction.zoneWidthRatio;
    const zoneHeight = worldHeight * this.mapConfig.extraction.zoneHeightRatio;
    const zoneX = worldWidth * this.mapConfig.extraction.zoneNormalizedX;
    const zoneY = worldHeight * this.mapConfig.extraction.zoneNormalizedY;

    const zone = this.scene.add.rectangle(
      zoneX,
      zoneY,
      zoneWidth,
      zoneHeight,
      0x1d4ed8,
      0.65
    );

    const outline = this.scene.add.rectangle(
      zoneX,
      zoneY,
      zoneWidth + 6,
      zoneHeight + 6,
      0x0f172a,
      0
    ).setStrokeStyle(2, 0x60a5fa, 1);

    this.scene.add
      .text(zoneX, zoneY - 4, "ZONA DE EXTRAÇÃO", {
        fontSize: "14px",
        color: "#e5edff"
      })
      .setOrigin(0.5);

    return { zone, outline, x: zoneX, y: zoneY };
  }

  /**
   * Inicializa telemetria.
   */
  initializeTelemetry(): ExpeditionTelemetry {
    return {
      expeditionStartTime: Date.now(),
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
  }
}
