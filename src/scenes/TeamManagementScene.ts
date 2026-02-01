import Phaser from "phaser";
import { PlayerState } from "../game/playerState";
import { getCreatureById } from "../game/creatures";
import type { OwnedCreature } from "../game/types";
import { syncPlayerStateToServer } from "../services/firebaseSync";

export class TeamManagementScene extends Phaser.Scene {
  private listTexts: Phaser.GameObjects.Text[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private cursorIndex = 0;
  private tempTeamIds: string[] = [];

  constructor() {
    super("TeamManagementScene");
  }

  create() {
    const { width, height } = this.scale;
    const progress = PlayerState.getProgress();

    // Estado temporário de seleção, parte do time ativo atual
    this.tempTeamIds = [...progress.activeTeamIds];
    this.cursorIndex = 0;
    this.listTexts.forEach((t) => t.destroy());
    this.listTexts = [];

    // Fundo
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x020617, 1)
      .setOrigin(0.5);

    const headerBg = this.add
      .rectangle(width / 2, 40, width - 80, 52, 0x020b1b, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x1f2937, 1);

    this.add
      .text(width / 2, headerBg.y, "Gerenciar Equipe", {
        fontSize: "24px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        72,
        "↑/↓ para navegar, ENTER para adicionar/remover do time, ESC para voltar.",
        {
          fontSize: "14px",
          color: "#9ca3af"
        }
      )
      .setOrigin(0.5);

    const teamSlots = progress.teamSlots;

    let y = 120;
    this.add
      .text(
        40,
        y,
        `Slots de equipe: ${this.tempTeamIds.length}/${teamSlots} (máx. ${teamSlots})`,
        {
          fontSize: "16px",
          color: "#fbbf24"
        }
      )
      .setOrigin(0, 0.5)
      .setName("slots-label");

    y += 32;
    this.add
      .text(40, y, "Todas as criaturas capturadas:", {
        fontSize: "16px",
        color: "#a5b4fc"
      })
      .setOrigin(0, 0.5);

    y += 28;

    const sortedCreatures: OwnedCreature[] = [...progress.creatures].sort(
      (a, b) => a.definitionId.localeCompare(b.definitionId)
    );

    if (sortedCreatures.length === 0) {
      this.add
        .text(
          40,
          y,
          "Você ainda não capturou nenhuma criatura. Explore uma expedição para começar!",
          {
            fontSize: "14px",
            color: "#9ca3af",
            wordWrap: { width: width - 80 }
          }
        )
        .setOrigin(0, 0);
    } else {
      sortedCreatures.forEach((owned, idx) => {
        const def = getCreatureById(owned.definitionId);
        const inTeam = this.tempTeamIds.includes(owned.instanceId);

        const text = this.add
          .text(
            40,
            y + idx * 22,
            `${inTeam ? "★" : "  "} ${owned.nickname ?? def?.name ?? "Desconhecido"}  Lv.${
              owned.level
            }  HP ${owned.currentHp}/${def?.stats.hp ?? "?"}`,
            {
              fontSize: "14px",
              color: idx === this.cursorIndex ? "#22c55e" : inTeam ? "#e5e7eb" : "#9ca3af"
            }
          )
          .setOrigin(0, 0.5);

        text.setData("instanceId", owned.instanceId);
        this.listTexts.push(text);
      });
    }

    this.infoText = this.add
      .text(40, height - 64, "", {
        fontSize: "14px",
        color: "#e5e7eb",
        wordWrap: { width: width - 80 }
      })
      .setOrigin(0, 0.5);

    this.updateInfoText();

    this.input.keyboard?.on("keydown-UP", () => this.moveCursor(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveCursor(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.toggleSelection());
    this.input.keyboard?.on("keydown-SPACE", () => this.toggleSelection());
    this.input.keyboard?.on("keydown-ESC", () => this.returnToBase());
  }

  private moveCursor(delta: number) {
    if (this.listTexts.length === 0) return;
    this.cursorIndex =
      (this.cursorIndex + delta + this.listTexts.length) % this.listTexts.length;
    this.refreshListVisuals();
    this.updateInfoText();
  }

  private toggleSelection() {
    const progress = PlayerState.getProgress();
    const teamSlots = progress.teamSlots;

    if (this.listTexts.length === 0) {
      return;
    }

    const text = this.listTexts[this.cursorIndex];
    const instanceId = text.getData("instanceId") as string | undefined;
    if (!instanceId) return;

    const inTeam = this.tempTeamIds.includes(instanceId);

    if (inTeam) {
      // Remover do time
      this.tempTeamIds = this.tempTeamIds.filter((id) => id !== instanceId);
      this.infoText.setText("Criatura removida da equipe ativa.");
    } else {
      if (this.tempTeamIds.length >= teamSlots) {
        this.infoText.setText(
          "Você já está usando todos os slots de equipe. Remova alguém antes de adicionar outra criatura."
        );
        return;
      }
      this.tempTeamIds.push(instanceId);
      this.infoText.setText("Criatura adicionada à equipe ativa.");
    }

    this.applyVisualSelection();
    this.updateSlotsLabel();
  }

  private applyVisualSelection() {
    const progress = PlayerState.getProgress();
    const sortedCreatures: OwnedCreature[] = [...progress.creatures].sort(
      (a, b) => a.definitionId.localeCompare(b.definitionId)
    );

    this.listTexts.forEach((text, idx) => {
      const instanceId = text.getData("instanceId") as string | undefined;
      const inTeam = instanceId ? this.tempTeamIds.includes(instanceId) : false;
      const owned = sortedCreatures[idx];
      const def = owned ? getCreatureById(owned.definitionId) : null;

      text.setText(
        `${inTeam ? "★" : "  "} ${owned?.nickname ?? def?.name ?? "Desconhecido"}  Lv.${
          owned?.level ?? "?"
        }  HP ${owned?.currentHp ?? "?"}/${def?.stats.hp ?? "?"}`
      );
    });

    this.refreshListVisuals();
  }

  private refreshListVisuals() {
    this.listTexts.forEach((text, idx) => {
      const instanceId = text.getData("instanceId") as string | undefined;
      const inTeam = instanceId ? this.tempTeamIds.includes(instanceId) : false;
      const isCursor = idx === this.cursorIndex;

      if (isCursor) {
        text.setColor("#22c55e");
      } else if (inTeam) {
        text.setColor("#e5e7eb");
      } else {
        text.setColor("#9ca3af");
      }
    });
  }

  private updateSlotsLabel() {
    const progress = PlayerState.getProgress();
    const teamSlots = progress.teamSlots;

    const label = this.children.getByName("slots-label") as
      | Phaser.GameObjects.Text
      | null;
    if (label) {
      label.setText(
        `Slots de equipe: ${this.tempTeamIds.length}/${teamSlots} (máx. ${teamSlots})`
      );
    }
  }

  private updateInfoText() {
    const progress = PlayerState.getProgress();
    const { teamSlots } = progress;

    if (this.listTexts.length === 0) {
      this.infoText.setText(
        "Sem criaturas disponíveis. Complete uma expedição e capture criaturas para montar sua equipe."
      );
      return;
    }

    const text = this.listTexts[this.cursorIndex];
    const instanceId = text.getData("instanceId") as string | undefined;
    const owned = progress.creatures.find((c) => c.instanceId === instanceId);
    const def = owned ? getCreatureById(owned.definitionId) ?? null : null;
    const inTeam = instanceId ? this.tempTeamIds.includes(instanceId) : false;

    const lines: string[] = [];
    if (def) {
      lines.push(`${def.name} – Tipo: ${def.primaryType}${def.secondaryType ? ` / ${def.secondaryType}` : ""}`);
      lines.push(
        `HP: ${def.stats.hp} | ATQ: ${def.stats.attackDamage} | DEF: ${def.stats.defense} | Vel: ${def.stats.moveSpeed}`
      );
      lines.push(
        `Skill: ${def.specialSkill.name} (CD: ${def.specialSkill.cooldown}s)`
      );
    }

    lines.push(
      `Equipe: ${this.tempTeamIds.length}/${teamSlots} – ${
        inTeam ? "ENTER/ESPAÇO para remover" : "ENTER/ESPAÇO para adicionar"
      }`
    );
    lines.push("ESC para salvar e voltar à base.");

    this.infoText.setText(lines.join("\n"));
  }

  private async returnToBase() {
    // Persistir novo time ativo de forma validada
    PlayerState.setActiveTeam(this.tempTeamIds);
    await syncPlayerStateToServer();
    this.scene.start("BaseHubScene");
  }
}

