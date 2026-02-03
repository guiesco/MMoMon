import Phaser from "phaser";
import { PlayerState } from "../game/playerState";
import { getCreatureById } from "../game/creatures";
import { getItemById } from "../game/items";
import { getMapConfig, getNextMapId } from "../game/maps";
import {
  getEffectiveStats,
  getLevelProgress,
  getXpRequiredForLevel,
  getRankDisplay,
  getRankColorHex,
  RANK_CONFIG,
} from "../game/creatureProgression";
import type { CreatureRank, ItemKind } from "../game/types";
import { getItemVisuals, TIER_VISUALS, hexToCSS } from "../game/itemVisuals";
import { syncPlayerStateToServer } from "../services/firebaseSync";
import { isFirebaseClientAvailable, getUserId } from "../services/firebaseClient";
import { LoadingOverlay } from "./expedition/ui/LoadingOverlay";

export class BaseHubScene extends Phaser.Scene {
  private menuIndex = 0;
  private options = [
    "Iniciar Expedição Solo",
    "Gerenciar Equipe",
    "Evoluir Criaturas",
    "Abrir Inventário",
    "Abrir Crafting",
    "Sair (placeholder)"
  ];
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private mapLabelText!: Phaser.GameObjects.Text;
  private loadingOverlay!: LoadingOverlay;

  constructor() {
    super("BaseHubScene");
  }

  async create() {
    // Garante estado limpo ao voltar de outras cenas
    this.menuIndex = 0;
    this.optionTexts.forEach((t) => t.destroy());
    this.optionTexts = [];

    // Inicializar loading overlay
    this.loadingOverlay = new LoadingOverlay(this);

    // Sincronizar com Firebase ao entrar na base
    if (isFirebaseClientAvailable() && getUserId()) {
      this.loadingOverlay.show("Sincronizando dados...");
      
      try {
        await syncPlayerStateToServer();
        console.log('[BaseHubScene] ✅ Dados sincronizados ao entrar na base');
      } catch (error) {
        console.error('[BaseHubScene] ❌ Erro ao sincronizar:', error);
        // Continuar mesmo se sync falhar
      } finally {
        this.loadingOverlay.hide();
      }
    }

    // Cura todas as criaturas ao voltar para a base
    PlayerState.healAllCreatures();

    const { width, height } = this.scale;
    const progress = PlayerState.getProgress();

    // Fundo sutil para separar da expedição
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x020617, 1)
      .setOrigin(0.5);

    const headerBg = this.add
      .rectangle(width / 2, 40, width - 80, 52, 0x020b1b, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x1f2937, 1);

    this.add
      .text(width / 2, headerBg.y, "Ilha do Treinador – Base", {
        fontSize: "24px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);

    this.add
      .text(
        32,
        84,
        `Treinador: ${progress.displayName ?? "Convidado"}\nEquipe ativa: ${
          progress.activeTeamIds.length
        }/${progress.teamSlots} | Criaturas: ${progress.creatures.length}`,
        {
          fontSize: "14px",
          color: "#e5e7eb"
        }
      );

    // Mapa/bioma selecionado
    const selectedMap = PlayerState.getSelectedMapId();
    const mapConfig = getMapConfig(selectedMap);

    this.mapLabelText = this.add
      .text(
        width - 32,
        84,
        `Mapa atual: ${mapConfig.name}\n(${mapConfig.riskLevel} risco, recompensas ${mapConfig.rewardProfile.toLowerCase()})\n[M] Alterar mapa`,
        {
          fontSize: "13px",
          color: "#a5b4fc",
          align: "right"
        }
      )
      .setOrigin(1, 0);

    // Mostrar criaturas da equipe com informações de progressão
    const teamCreatures = progress.activeTeamIds
      .map((id) => progress.creatures.find((c) => c.instanceId === id))
      .filter(Boolean);

    let y = 140;
    this.add
      .text(32, y, "Equipe Ativa:", {
        fontSize: "16px",
        color: "#fbbf24"
      })
      .setOrigin(0, 0.5);
    y += 24;

    for (const owned of teamCreatures) {
      const creatureDef = owned ? getCreatureById(owned.definitionId) : null;
      if (!owned || !creatureDef) continue;

      const effectiveStats = getEffectiveStats(owned);
      const rank: CreatureRank = owned.rank ?? 1;
      const rankStr = getRankDisplay(rank);
      const rankColor = getRankColorHex(rank);
      const levelProgress = getLevelProgress(owned);
      const xpForNext = getXpRequiredForLevel(owned.level + 1);

      // Nome com rank
      this.add
        .text(
          48,
          y,
          `${rankStr} ${owned.nickname ?? creatureDef.name}`,
          {
            fontSize: "14px",
            color: rankColor
          }
        )
        .setOrigin(0, 0.5);

      // Nível e XP
      this.add
        .text(
          200,
          y,
          `Lv.${owned.level}`,
          {
            fontSize: "14px",
            color: "#22c55e"
          }
        )
        .setOrigin(0, 0.5);

      // Barra de XP
      const xpBarWidth = 80;
      const xpBarHeight = 8;
      const xpBarX = 250;

      this.add.rectangle(xpBarX, y, xpBarWidth, xpBarHeight, 0x1e293b, 1)
        .setOrigin(0, 0.5);
      this.add.rectangle(xpBarX, y, xpBarWidth * levelProgress, xpBarHeight, 0x3b82f6, 1)
        .setOrigin(0, 0.5);

      this.add
        .text(
          xpBarX + xpBarWidth + 8,
          y,
          `${owned.experience}/${xpForNext}`,
          {
            fontSize: "11px",
            color: "#94a3b8"
          }
        )
        .setOrigin(0, 0.5);

      // Stats efetivos
      this.add
        .text(
          420,
          y,
          `HP ${effectiveStats.hp} | ATK ${effectiveStats.attackDamage} | DEF ${effectiveStats.defense}`,
          {
            fontSize: "12px",
            color: "#94a3b8"
          }
        )
        .setOrigin(0, 0.5);

      y += 24;
    }

    // Inventário resumido – organizado por categoria para não poluir a tela
    y += 12;
    this.add
      .text(32, y, "Inventário:", {
        fontSize: "16px",
        color: "#fbbf24"
      })
      .setOrigin(0, 0.5);
    y += 24;

    const resourceEntries: { entry: { itemId: string; quantity: number }; item: ReturnType<typeof getItemById> }[] = [];
    const otherEntries: { entry: { itemId: string; quantity: number }; item: ReturnType<typeof getItemById> }[] = [];
    for (const entry of progress.inventory) {
      const item = getItemById(entry.itemId);
      if (!item) continue;
      if (entry.itemId.startsWith("resource-")) {
        resourceEntries.push({ entry, item });
      } else {
        otherEntries.push({ entry, item });
      }
    }

    if (resourceEntries.length > 0) {
      this.add
        .text(48, y, "◆ Recursos:", {
          fontSize: "14px",
          color: "#f59e0b"
        })
        .setOrigin(0, 0.5);
      y += 20;
      for (const { entry, item } of resourceEntries) {
        if (!item) continue;
        const visuals = getItemVisuals(item.kind, item.tier, entry.itemId);
        const tierConfig = TIER_VISUALS[item.tier];
        this.add
          .text(64, y, `${item.name}: x${entry.quantity}`, {
            fontSize: "14px",
            color: tierConfig.tierTextColor
          })
          .setOrigin(0, 0.5);
        y += 18;
      }
      y += 8;
    }

    if (otherEntries.length > 0) {
      this.add
        .text(48, y, "◉ Itens & Utilidades:", {
          fontSize: "14px",
          color: "#ef4444"
        })
        .setOrigin(0, 0.5);
      y += 20;
      for (const { entry, item } of otherEntries) {
        if (!item) continue;
        const visuals = getItemVisuals(item.kind, item.tier, entry.itemId);
        const tierConfig = TIER_VISUALS[item.tier];
        this.add
          .text(64, y, `${item.name} [${item.tier}]: x${entry.quantity}`, {
            fontSize: "14px",
            color: tierConfig.tierTextColor
          })
          .setOrigin(0, 0.5);
        y += 18;
      }
    }

    // Menu central com destaque visual
    const menuBg = this.add
      .rectangle(width / 2, height - 130, width - 80, 140, 0x020b1b, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x1f2937, 1);

    this.add
      .text(
        menuBg.x,
        menuBg.y - 56,
        "Escolha o próximo passo:",
        {
          fontSize: "16px",
          color: "#9ca3af"
        }
      )
      .setOrigin(0.5);

    const startY = menuBg.y - 22;
    this.options.forEach((opt, idx) => {
      const t = this.add
        .text(width / 2, startY + idx * 24, opt, {
          fontSize: "16px",
          color: idx === this.menuIndex ? "#22c55e" : "#9ca3af"
        })
        .setOrigin(0.5);
      this.optionTexts.push(t);
    });

    this.input.keyboard?.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.confirmSelection());
    this.input.keyboard?.on("keydown-M", () => this.cycleMap());
    this.input.keyboard?.on("keydown-I", () => this.scene.start("InventoryScene"));
    this.input.keyboard?.on("keydown-E", () => this.scene.start("TeamManagementScene"));
    this.input.keyboard?.on("keydown-U", () => this.scene.start("CreatureUpgradeScene"));
  }

  private moveSelection(delta: number) {
    this.menuIndex =
      (this.menuIndex + delta + this.options.length) % this.options.length;
    this.optionTexts.forEach((t, idx) => {
      t.setColor(idx === this.menuIndex ? "#22c55e" : "#9ca3af");
    });
  }

  private confirmSelection() {
    const selected = this.options[this.menuIndex];
    if (selected === "Iniciar Expedição Solo") {
      // Abre a cena de seleção de inventário antes de iniciar a expedição
      this.scene.start("ExpeditionInventorySelectionScene");
    } else if (selected === "Gerenciar Equipe") {
      this.scene.start("TeamManagementScene");
    } else if (selected === "Evoluir Criaturas") {
      this.scene.start("CreatureUpgradeScene");
    } else if (selected === "Abrir Inventário") {
      this.scene.start("InventoryScene");
    } else if (selected === "Abrir Crafting") {
      this.scene.start("CraftingScene");
    }
  }

  private cycleMap() {
    const current = PlayerState.getSelectedMapId();
    const next = getNextMapId(current);
    PlayerState.setSelectedMapId(next);

    const cfg = getMapConfig(next);
    this.mapLabelText.setText(
      `Mapa atual: ${cfg.name}\n(${cfg.riskLevel} risco, recompensas ${cfg.rewardProfile.toLowerCase()})\n[M] Alterar mapa`
    );
  }
}
