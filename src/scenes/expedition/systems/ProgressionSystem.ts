import Phaser from "phaser";
import { PlayerState as LocalPlayerState } from "../../../game/playerState";
import { getCreatureById } from "../../../../shared/creatures";
import type { ExpeditionXpParams } from "../../../game/creatureProgression";
import { formatXp, getRankDisplay } from "../../../game/creatureProgression";
import type { ExpeditionTelemetry } from "../types/ExpeditionTypes";
import type { FeedbackManager } from "../ui/FeedbackManager";

/**
 * Gerencia progressão de XP e leveling das criaturas.
 */
export class ProgressionSystem {
  private scene: Phaser.Scene;
  private telemetry: ExpeditionTelemetry;
  private feedbackManager: FeedbackManager;
  private xpProcessed = false;
  private activeTimeByCreature: Map<string, number> = new Map();
  private defeatedCreatureLevels: number[] = [];
  private expeditionTime = 0;
  private activeTeamIds: string[] = [];
  private activeCreatureInstanceId: string | null = null;

  constructor(
    scene: Phaser.Scene,
    telemetry: ExpeditionTelemetry,
    feedbackManager: FeedbackManager
  ) {
    this.scene = scene;
    this.telemetry = telemetry;
    this.feedbackManager = feedbackManager;
  }

  /**
   * Registra tempo ativo de uma criatura.
   */
  trackActiveCreatureTime(instanceId: string | null, dt: number): void {
    if (instanceId) {
      const current = this.activeTimeByCreature.get(instanceId) ?? 0;
      this.activeTimeByCreature.set(instanceId, current + dt);
    }
  }

  /**
   * Registra uma criatura derrotada pelo nível dela (quanto mais alto, mais XP na expedição).
   */
  recordCreatureDefeated(level: number): void {
    this.defeatedCreatureLevels.push(Math.max(1, level));
  }

  /**
   * Processa e distribui XP para todas as criaturas da equipe após a expedição.
   */
  processCreatureXp(extractionSuccess: boolean): void {
    // Evita processar XP múltiplas vezes
    if (this.xpProcessed) return;
    this.xpProcessed = true;

    const params: ExpeditionXpParams = {
      durationSeconds: this.expeditionTime,
      extractionSuccess,
      creaturesDefeated: this.defeatedCreatureLevels.length,
      defeatedCreatureLevels: this.defeatedCreatureLevels.length > 0 ? this.defeatedCreatureLevels : undefined,
      resourcesCollected: this.telemetry.resourcesCollected,
      teamCreatureIds: this.activeTeamIds,
      activeCreatureId: this.activeCreatureInstanceId,
      activeTimeByCreature: this.activeTimeByCreature,
    };

    const results = LocalPlayerState.processExpeditionXp(params);

    // Log de XP ganho
    console.log("[ProgressionSystem] XP distribuído às criaturas:");
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
  ): void {
    const { width, height } = this.scene.scale;
    const progress = LocalPlayerState.getProgress();

    // Importar funções necessárias

    // Painel de XP (fixo na tela)
    const panelY = extractionSuccess ? height / 2 + 80 : height / 2;
    const panelBg = this.scene.add.rectangle(width / 2, panelY, 300, 120, 0x020617, 0.9)
      .setStrokeStyle(2, 0x3b82f6, 1)
      .setDepth(1001)
      .setScrollFactor(0);

    const title = this.scene.add.text(width / 2, panelY - 45, "⭐ XP GANHO ⭐", {
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

      const text = this.scene.add.text(width / 2, yOffset, line, {
        fontSize: "14px",
        color
      }).setOrigin(0.5).setDepth(1002).setScrollFactor(0);

      textElements.push(text);
      yOffset += 22;
    }

    // Fade out após alguns segundos
    this.scene.time.delayedCall(2500, () => {
      this.scene.tweens.add({
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

  /**
   * Atualiza referências necessárias.
   */
  updateReferences(
    expeditionTime: number,
    activeTeamIds: string[],
    activeCreatureInstanceId: string | null
  ): void {
    this.expeditionTime = expeditionTime;
    this.activeTeamIds = activeTeamIds;
    this.activeCreatureInstanceId = activeCreatureInstanceId;
  }
}
