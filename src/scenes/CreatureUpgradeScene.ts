import Phaser from "phaser";
import { PlayerState } from "../game/playerState";
import { getCreatureById } from "../game/creatures";
import {
  getEffectiveStats,
  getLevelProgress,
  getXpRequiredForLevel,
  getRankDisplay,
  getRankColorHex,
  getStatBonusDescription,
  canPromoteRank,
  getFusionProgress,
  RANK_CONFIG,
} from "../game/creatureProgression";
import type { CreatureRank, OwnedCreature } from "../game/types";

/**
 * Cena de evolução/fusão de criaturas.
 * Permite ao jogador:
 * - Ver todas as suas criaturas e seus stats de progressão
 * - Fundir cópias da mesma espécie para aumentar o rank
 * - Ver os bônus de stats obtidos pelo nível e rank
 */
export class CreatureUpgradeScene extends Phaser.Scene {
  private selectedIndex = 0;
  private creatureList: OwnedCreature[] = [];
  private listTexts: Phaser.GameObjects.Text[] = [];
  private detailsContainer!: Phaser.GameObjects.Container;
  private feedbackText!: Phaser.GameObjects.Text;

  constructor() {
    super("CreatureUpgradeScene");
  }

  create() {
    const { width, height } = this.scale;
    const progress = PlayerState.getProgress();
    this.creatureList = [...progress.creatures];
    this.selectedIndex = 0;
    this.listTexts = [];

    // Fundo
    this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 1).setOrigin(0.5);

    // Header
    const headerBg = this.add
      .rectangle(width / 2, 36, width - 40, 48, 0x020b1b, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x1f2937, 1);

    this.add
      .text(width / 2, headerBg.y, "⭐ Evolução de Criaturas ⭐", {
        fontSize: "22px",
        color: "#fbbf24",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    // Instruções
    this.add
      .text(width / 2, 70, "[↑/↓] Selecionar | [ENTER] Fundir Cópias | [ESC] Voltar", {
        fontSize: "13px",
        color: "#94a3b8"
      })
      .setOrigin(0.5);

    // Painel esquerdo: lista de criaturas
    const listPanelBg = this.add
      .rectangle(160, height / 2 + 20, 280, height - 150, 0x0f172a, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x1e293b, 1);

    this.add
      .text(listPanelBg.x, 100, "Suas Criaturas:", {
        fontSize: "16px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);

    this.renderCreatureList();

    // Painel direito: detalhes da criatura selecionada
    this.detailsContainer = this.add.container(width - 220, height / 2 + 20);
    this.renderCreatureDetails();

    // Feedback de ações
    this.feedbackText = this.add
      .text(width / 2, height - 40, "", {
        fontSize: "14px",
        color: "#22c55e"
      })
      .setOrigin(0.5);

    // Input
    this.input.keyboard?.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.tryFusion());
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("BaseHubScene"));
    this.input.keyboard?.on("keydown-SPACE", () => this.tryFusion());
  }

  private renderCreatureList() {
    // Limpa textos anteriores
    this.listTexts.forEach((t) => t.destroy());
    this.listTexts = [];

    const progress = PlayerState.getProgress();
    this.creatureList = [...progress.creatures];

    const startY = 130;
    const lineHeight = 26;

    for (let i = 0; i < this.creatureList.length; i++) {
      const creature = this.creatureList[i];
      const def = getCreatureById(creature.definitionId);
      if (!def) continue;

      const rank: CreatureRank = creature.rank ?? 1;
      const rankStr = getRankDisplay(rank);
      const rankColor = getRankColorHex(rank);

      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? "► " : "  ";

      const text = this.add
        .text(
          40,
          startY + i * lineHeight,
          `${prefix}${rankStr} ${creature.nickname ?? def.name} Lv.${creature.level}`,
          {
            fontSize: "14px",
            color: isSelected ? "#22c55e" : rankColor
          }
        )
        .setOrigin(0, 0.5);

      this.listTexts.push(text);
    }

    // Mensagem se não houver criaturas
    if (this.creatureList.length === 0) {
      const noCreatures = this.add
        .text(160, 200, "Nenhuma criatura ainda!", {
          fontSize: "14px",
          color: "#94a3b8"
        })
        .setOrigin(0.5);
      this.listTexts.push(noCreatures);
    }
  }

  private renderCreatureDetails() {
    // Limpa container
    this.detailsContainer.removeAll(true);

    if (this.creatureList.length === 0) {
      const noDetails = this.add.text(0, 0, "Selecione uma criatura", {
        fontSize: "14px",
        color: "#94a3b8"
      });
      this.detailsContainer.add(noDetails);
      return;
    }

    const creature = this.creatureList[this.selectedIndex];
    if (!creature) return;

    const def = getCreatureById(creature.definitionId);
    if (!def) return;

    const rank: CreatureRank = creature.rank ?? 1;
    const rankStr = getRankDisplay(rank);
    const rankColor = getRankColorHex(rank);
    const rankConfig = RANK_CONFIG[rank];
    const effectiveStats = getEffectiveStats(creature);
    const levelProgress = getLevelProgress(creature);
    const xpForNext = getXpRequiredForLevel(creature.level + 1);
    const fusionProgress = getFusionProgress(creature);
    const copies = PlayerState.countCreatureCopies(creature.definitionId, creature.instanceId);
    const promotionInfo = canPromoteRank(creature, copies);

    let y = -180;

    // Nome e rank
    const nameText = this.add.text(0, y, `${rankStr} ${creature.nickname ?? def.name}`, {
      fontSize: "20px",
      color: rankColor,
      fontStyle: "bold"
    }).setOrigin(0.5, 0);
    this.detailsContainer.add(nameText);
    y += 30;

    // Rank atual
    const rankText = this.add.text(0, y, `Rank: ${rankConfig.name} (${rankStr})`, {
      fontSize: "14px",
      color: "#e5e7eb"
    }).setOrigin(0.5, 0);
    this.detailsContainer.add(rankText);
    y += 24;

    // Nível e XP
    const levelText = this.add.text(0, y, `Nível: ${creature.level}`, {
      fontSize: "14px",
      color: "#22c55e"
    }).setOrigin(0.5, 0);
    this.detailsContainer.add(levelText);
    y += 20;

    // Barra de XP
    const xpBarWidth = 180;
    const xpBarHeight = 12;
    const xpBarBg = this.add.rectangle(0, y + 6, xpBarWidth, xpBarHeight, 0x1e293b, 1).setOrigin(0.5);
    const xpBar = this.add.rectangle(
      -xpBarWidth / 2,
      y + 6,
      xpBarWidth * levelProgress,
      xpBarHeight,
      0x3b82f6,
      1
    ).setOrigin(0, 0.5);
    this.detailsContainer.add([xpBarBg, xpBar]);
    y += 18;

    const xpText = this.add.text(0, y, `XP: ${creature.experience}/${xpForNext}`, {
      fontSize: "12px",
      color: "#94a3b8"
    }).setOrigin(0.5, 0);
    this.detailsContainer.add(xpText);
    y += 28;

    // Stats efetivos
    const statsTitle = this.add.text(0, y, "─── Stats Efetivos ───", {
      fontSize: "13px",
      color: "#fbbf24"
    }).setOrigin(0.5, 0);
    this.detailsContainer.add(statsTitle);
    y += 22;

    const statsLines = [
      `HP: ${effectiveStats.hp}`,
      `Ataque: ${effectiveStats.attackDamage}`,
      `Defesa: ${effectiveStats.defense}`,
      `Velocidade: ${effectiveStats.moveSpeed}`
    ];

    for (const line of statsLines) {
      const stat = this.add.text(0, y, line, {
        fontSize: "13px",
        color: "#e5e7eb"
      }).setOrigin(0.5, 0);
      this.detailsContainer.add(stat);
      y += 18;
    }
    y += 12;

    // Bônus de stats
    const bonuses = getStatBonusDescription(creature);
    if (bonuses.length > 0) {
      const bonusTitle = this.add.text(0, y, "─── Bônus Atuais ───", {
        fontSize: "13px",
        color: "#a855f7"
      }).setOrigin(0.5, 0);
      this.detailsContainer.add(bonusTitle);
      y += 20;

      for (const bonus of bonuses) {
        const bonusText = this.add.text(0, y, bonus, {
          fontSize: "12px",
          color: "#c4b5fd"
        }).setOrigin(0.5, 0);
        this.detailsContainer.add(bonusText);
        y += 16;
      }
      y += 12;
    }

    // Seção de fusão
    const fusionTitle = this.add.text(0, y, "─── Fusão de Cópias ───", {
      fontSize: "13px",
      color: "#f59e0b"
    }).setOrigin(0.5, 0);
    this.detailsContainer.add(fusionTitle);
    y += 22;

    if (rank >= 5) {
      const maxRank = this.add.text(0, y, "🏆 Rank máximo alcançado!", {
        fontSize: "14px",
        color: "#f59e0b"
      }).setOrigin(0.5, 0);
      this.detailsContainer.add(maxRank);
    } else {
      // Progresso para próximo rank
      const nextRank = (rank + 1) as CreatureRank;
      const nextRankConfig = RANK_CONFIG[nextRank];

      const copiesText = this.add.text(0, y, `Cópias disponíveis: ${copies}`, {
        fontSize: "13px",
        color: "#e5e7eb"
      }).setOrigin(0.5, 0);
      this.detailsContainer.add(copiesText);
      y += 20;

      const progressText = this.add.text(
        0,
        y,
        `Progresso: ${fusionProgress.currentCopies}/${fusionProgress.requiredCopies} cópias`,
        {
          fontSize: "13px",
          color: "#94a3b8"
        }
      ).setOrigin(0.5, 0);
      this.detailsContainer.add(progressText);
      y += 18;

      // Barra de progresso de fusão
      const fusionBarWidth = 160;
      const fusionBarHeight = 10;
      const fusionBarBg = this.add.rectangle(0, y + 5, fusionBarWidth, fusionBarHeight, 0x1e293b, 1).setOrigin(0.5);
      const fusionBar = this.add.rectangle(
        -fusionBarWidth / 2,
        y + 5,
        fusionBarWidth * fusionProgress.progress,
        fusionBarHeight,
        0xf59e0b,
        1
      ).setOrigin(0, 0.5);
      this.detailsContainer.add([fusionBarBg, fusionBar]);
      y += 22;

      const nextRankText = this.add.text(
        0,
        y,
        `Próximo rank: ${nextRankConfig.name} (${getRankDisplay(nextRank)})`,
        {
          fontSize: "13px",
          color: getRankColorHex(nextRank)
        }
      ).setOrigin(0.5, 0);
      this.detailsContainer.add(nextRankText);
      y += 18;

      const multiplierText = this.add.text(
        0,
        y,
        `Multiplicador: x${nextRankConfig.statMultiplier.toFixed(2)}`,
        {
          fontSize: "12px",
          color: "#94a3b8"
        }
      ).setOrigin(0.5, 0);
      this.detailsContainer.add(multiplierText);
      y += 24;

      // Botão de fusão
      if (promotionInfo.canPromote) {
        const fusionButton = this.add.text(
          0,
          y,
          `[ENTER] Fundir ${promotionInfo.copiesNeeded} cópias`,
          {
            fontSize: "14px",
            color: "#22c55e",
            backgroundColor: "#064e3b",
            padding: { x: 12, y: 6 }
          }
        ).setOrigin(0.5, 0);
        this.detailsContainer.add(fusionButton);
      } else {
        const needMore = this.add.text(
          0,
          y,
          `Faltam ${promotionInfo.copiesNeeded} cópias`,
          {
            fontSize: "13px",
            color: "#ef4444"
          }
        ).setOrigin(0.5, 0);
        this.detailsContainer.add(needMore);
      }
    }
  }

  private moveSelection(delta: number) {
    if (this.creatureList.length === 0) return;

    this.selectedIndex =
      (this.selectedIndex + delta + this.creatureList.length) % this.creatureList.length;

    this.renderCreatureList();
    this.renderCreatureDetails();
  }

  private tryFusion() {
    if (this.creatureList.length === 0) return;

    const creature = this.creatureList[this.selectedIndex];
    if (!creature) return;

    const def = getCreatureById(creature.definitionId);
    if (!def) return;

    const result = PlayerState.promoteCreatureRank(creature.instanceId);

    if (result.success) {
      const newRankStr = result.newRank ? getRankDisplay(result.newRank) : "";
      this.showFeedback(
        `✨ ${def.name} evoluiu para ${RANK_CONFIG[result.newRank!].name} ${newRankStr}! ✨`,
        "#22c55e"
      );

      // Atualiza a UI
      const progress = PlayerState.getProgress();
      this.creatureList = [...progress.creatures];
      if (this.selectedIndex >= this.creatureList.length) {
        this.selectedIndex = Math.max(0, this.creatureList.length - 1);
      }
      this.renderCreatureList();
      this.renderCreatureDetails();
    } else {
      this.showFeedback(result.error ?? "Fusão não disponível", "#ef4444");
    }
  }

  private showFeedback(message: string, color: string) {
    this.feedbackText.setText(message).setColor(color).setAlpha(1);

    this.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      duration: 2000,
      delay: 1500
    });
  }
}
