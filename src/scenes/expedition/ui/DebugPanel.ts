import Phaser from "phaser";
import type { ExpeditionTelemetry, ExpeditionState } from "../types/ExpeditionTypes";
import type { GameWorldState } from "../../../game/worldState";
import type { RemoteCreatureSprite } from "../types/ExpeditionTypes";

/**
 * Gerencia o painel de debug da expedição.
 */
export class DebugPanel {
  private scene: Phaser.Scene;
  private debugPanelText!: Phaser.GameObjects.Text;
  private debugPanelVisible = false;
  private viewportHeight: number;

  constructor(scene: Phaser.Scene, viewportHeight: number) {
    this.scene = scene;
    this.viewportHeight = viewportHeight;
  }

  /**
   * Cria o painel de debug (inicialmente invisível).
   */
  create(): void {
    this.debugPanelText = this.scene.add.text(12, this.viewportHeight - 200, "", {
      fontSize: "12px",
      color: "#10b981",
      backgroundColor: "#000000",
      padding: { x: 8, y: 4 }
    }).setOrigin(0, 1).setVisible(this.debugPanelVisible).setDepth(1000).setScrollFactor(0);
  }

  /**
   * Alterna a visibilidade do painel de debug.
   */
  toggle(): void {
    this.debugPanelVisible = !this.debugPanelVisible;
    if (this.debugPanelText) {
      this.debugPanelText.setVisible(this.debugPanelVisible);
    }
  }

  /**
   * Atualiza o conteúdo do painel de debug.
   */
  update(
    expeditionTime: number,
    expeditionDuration: number,
    telemetry: ExpeditionTelemetry,
    state: ExpeditionState,
    clientId: string | null,
    playerSpritesSize: number,
    worldState: GameWorldState,
    creatureSprites: Map<string, RemoteCreatureSprite>
  ): void {
    if (!this.debugPanelVisible) return;

    const timeMinutes = expeditionTime / 60;
    const currentResourcesPerMin = timeMinutes > 0 
      ? (telemetry.resourcesCollected / timeMinutes).toFixed(2)
      : "0.00";
    const currentCreaturesPerMin = timeMinutes > 0
      ? (telemetry.creaturesCaptured / timeMinutes).toFixed(2)
      : "0.00";
    const avgCaptureChance = telemetry.captureAttempts > 0
      ? ((telemetry.totalCaptureChanceSum / telemetry.captureAttempts) * 100).toFixed(1)
      : "0.0";
    const captureSuccessRate = telemetry.captureAttempts > 0
      ? ((telemetry.captureSuccesses / telemetry.captureAttempts) * 100).toFixed(1)
      : "0.0";

    // Informações de multiplayer
    const mpInfo = [
      "",
      "=== MULTIPLAYER ===",
      `Modo: ONLINE`,
      `ClientID: ${clientId?.slice(0, 8) ?? "N/A"}...`,
      `Players: ${playerSpritesSize} remotos`,
      `Criaturas (WS): ${worldState.creatures.size}`,
      `Recursos (WS): ${worldState.resources.size}`,
    ];
    
    // Informações de interpolação (amostragem)
    const interpolationInfo: string[] = [];
    if (creatureSprites.size > 0) {
      const firstCreature = creatureSprites.values().next().value;
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
        `Tempo: ${Math.floor(expeditionTime)}s / ${expeditionDuration}s`,
        `Recursos: ${telemetry.resourcesCollected} (${currentResourcesPerMin}/min)`,
        `Criaturas: ${telemetry.creaturesCaptured}/${telemetry.creaturesEncountered}`,
        `Capturas: ${telemetry.captureSuccesses}/${telemetry.captureAttempts} (${captureSuccessRate}%)`,
        `Chance Média: ${avgCaptureChance}%`,
        `Combate: ${telemetry.combatEncounters} encontros`,
        `Dano: ${telemetry.damageDealt} causado`,
        `Projéteis: ${telemetry.projectilesFired}`,
        `Status: ${state.toUpperCase()}`,
        ...mpInfo,
        ...interpolationInfo
      ].join("\n")
    );
  }
}
