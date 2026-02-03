import Phaser from "phaser";
import { PlayerState } from "../game/playerState";
import { getItemById } from "../game/items";
import type { ItemKind, ItemTier } from "../game/types";
import {
  getItemVisuals,
  CATEGORY_VISUALS,
  TIER_VISUALS,
  hexToCSS,
  type ItemCategory
} from "../game/itemVisuals";

interface DisplayInventoryEntry {
  itemId: string;
  name: string;
  tier: ItemTier;
  kind: ItemKind;
  quantity: number;
  description: string;
  category: ItemCategory;
  selectedQuantity: number; // Quantidade selecionada para expedição
}

/**
 * Cena para selecionar itens do inventário permanente para levar na expedição.
 * Permite ao jogador escolher quantos de cada item levar antes de iniciar a expedição.
 */
export class ExpeditionInventorySelectionScene extends Phaser.Scene {
  private entryIndex = 0;
  private entryTexts: Phaser.GameObjects.Text[] = [];
  private entryBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private quantityTexts: Phaser.GameObjects.Text[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private entries: DisplayInventoryEntry[] = [];
  private selectedItems: Map<string, number> = new Map(); // itemId -> quantidade selecionada

  constructor() {
    super("ExpeditionInventorySelectionScene");
  }

  create() {
    // Limpa estado visual
    this.entryTexts.forEach((t) => t.destroy());
    this.entryTexts = [];
    this.entryBackgrounds.forEach((bg) => bg.destroy());
    this.entryBackgrounds = [];
    this.quantityTexts.forEach((t) => t.destroy());
    this.quantityTexts = [];
    this.selectedItems.clear();

    const { width, height } = this.scale;
    const progress = PlayerState.getProgress();

    // Fundo
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x020617, 1)
      .setOrigin(0.5);

    const headerBg = this.add
      .rectangle(width / 2, 40, width - 80, 52, 0x020b1b, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x1f2937, 1);

    this.add
      .text(width / 2, headerBg.y, "Preparar Inventário para Expedição", {
        fontSize: "24px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        72,
        "Selecione os itens que deseja levar na expedição\n" +
        "↑/↓: navegar  |  ←/→: ajustar quantidade  |  ENTER: confirmar e iniciar  |  ESC: cancelar",
        {
          fontSize: "14px",
          color: "#9ca3af",
          align: "center"
        }
      )
      .setOrigin(0.5);

    // Legenda de cores
    this.renderColorLegend(width - 200, 100);

    // Prepara entradas de inventário (apenas itens que podem ser levados)
    // Filtra apenas itens úteis para expedição (pokébolas, poções, etc)
    this.entries = progress.inventory
      .map((entry) => {
        const def = getItemById(entry.itemId);
        if (!def) return undefined;
        
        // Apenas itens que fazem sentido levar na expedição
        const isExpeditionItem = 
          entry.itemId.startsWith("poke-ball-") ||
          entry.itemId.startsWith("potion-") ||
          def.kind === "consumable" ||
          def.kind === "capture_tool";
        
        if (!isExpeditionItem) return undefined;
        
        const visuals = getItemVisuals(def.kind, def.tier, entry.itemId);
        
        return {
          itemId: entry.itemId,
          name: def.name,
          tier: def.tier,
          kind: def.kind,
          quantity: entry.quantity,
          description: def.description,
          category: this.getCategoryKey(def.kind, entry.itemId),
          selectedQuantity: 0 // Inicialmente nenhum selecionado
        } as DisplayInventoryEntry;
      })
      .filter((e): e is DisplayInventoryEntry => Boolean(e))
      .sort((a, b) => {
        // Ordena por categoria (captura > consumível), depois por tier e nome
        const orderCategory = (c: ItemCategory) => {
          if (c === "capture") return 0;
          if (c === "consumable") return 1;
          return 2;
        };
        const catCmp = orderCategory(a.category) - orderCategory(b.category);
        if (catCmp !== 0) return catCmp;
        
        // Ordena por tier (Lendário > Épico > Avançado > Básico)
        const orderTier = (t: ItemTier) => {
          if (t === "Lendário") return 0;
          if (t === "Épico") return 1;
          if (t === "Avançado") return 2;
          return 3;
        };
        const tierCmp = orderTier(a.tier) - orderTier(b.tier);
        if (tierCmp !== 0) return tierCmp;
        
        return a.name.localeCompare(b.name);
      });

    this.entryIndex = 0;

    let y = 120;

    if (this.entries.length === 0) {
      this.add
        .text(
          width / 2,
          y,
          "Você não possui itens que possam ser levados na expedição.\n" +
          "Adquira pokébolas ou poções primeiro.",
          {
            fontSize: "16px",
            color: "#9ca3af",
            wordWrap: { width: width - 120 },
            align: "center"
          }
        )
        .setOrigin(0.5, 0);
    } else {
      // Cabeçalhos por categoria
      let lastCategory: ItemCategory | null = null;

      this.entries.forEach((entry, idx) => {
        if (entry.category !== lastCategory) {
          if (lastCategory !== null) {
            y += 14;
          }

          const categoryConfig = CATEGORY_VISUALS[entry.category];
          const categoryLabel = `${categoryConfig.symbol} ${categoryConfig.label}`;

          this.add
            .text(40, y, categoryLabel, {
              fontSize: "15px",
              color: categoryConfig.textColor
            })
            .setOrigin(0, 0.5);
          y += 24;
          lastCategory = entry.category;
        }

        // Obtém cores para este item
        const visuals = getItemVisuals(entry.kind, entry.tier, entry.itemId);
        const tierConfig = TIER_VISUALS[entry.tier];
        const categoryConfig = CATEGORY_VISUALS[entry.category];

        // Fundo colorido por tier
        const bgWidth = width - 250;
        const bg = this.add
          .rectangle(60, y, bgWidth, 22, visuals.tier.borderColor, 0.08)
          .setOrigin(0, 0.5)
          .setStrokeStyle(tierConfig.borderWidth, tierConfig.borderColor, 0.4);
        this.entryBackgrounds.push(bg);

        // Indicador de categoria
        this.add
          .text(65, y, categoryConfig.symbol, {
            fontSize: "13px",
            color: hexToCSS(categoryConfig.primaryColor)
          })
          .setOrigin(0, 0.5);

        // Texto do item
        const isSelected = idx === this.entryIndex;
        const textColor = isSelected ? "#22c55e" : tierConfig.tierTextColor;
        
        const text = this.add
          .text(
            85,
            y,
            `${entry.name} [${entry.tier}]  (Disponível: x${entry.quantity})`,
            {
              fontSize: "15px",
              color: textColor
            }
          )
          .setOrigin(0, 0.5);

        this.entryTexts.push(text);

        // Texto de quantidade selecionada (à direita)
        const quantityText = this.add
          .text(
            width - 100,
            y,
            `Selecionado: 0`,
            {
              fontSize: "14px",
              color: isSelected ? "#22c55e" : "#6b7280"
            }
          )
          .setOrigin(1, 0.5);

        this.quantityTexts.push(quantityText);

        y += 26;
      });
    }

    // Resumo de seleção no rodapé
    const summaryBg = this.add
      .rectangle(width / 2, height - 80, width - 80, 60, 0x020b1b, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x1f2937, 1);

    this.statusText = this.add
      .text(width / 2, summaryBg.y - 10, "Nenhum item selecionado", {
        fontSize: "14px",
        color: "#9ca3af",
        align: "center"
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(
        width / 2,
        summaryBg.y + 15,
        "ENTER: Iniciar Expedição  |  ESC: Cancelar",
        {
          fontSize: "12px",
          color: "#6b7280",
          align: "center"
        }
      )
      .setOrigin(0.5, 0.5);

    this.input.keyboard?.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-LEFT", () => this.adjustQuantity(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.adjustQuantity(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.confirmAndStart());
    this.input.keyboard?.on("keydown-ESC", () => this.cancel());
  }

  private getCategoryKey(kind: ItemKind, itemId: string): ItemCategory {
    switch (kind) {
      case "capture_tool": return "capture";
      case "consumable": return "consumable";
      default: return "raw_resource";
    }
  }

  private renderColorLegend(x: number, y: number) {
    // Legenda de categorias
    this.add.text(x, y, "Categorias:", {
      fontSize: "12px",
      color: "#6b7280"
    });
    y += 18;

    const categories: ItemCategory[] = ["capture", "consumable"];
    for (const cat of categories) {
      const config = CATEGORY_VISUALS[cat];
      this.add.text(x, y, `${config.symbol} ${config.label}`, {
        fontSize: "11px",
        color: config.textColor
      });
      y += 14;
    }

    y += 10;
    
    // Legenda de raridade
    this.add.text(x, y, "Raridade:", {
      fontSize: "12px",
      color: "#6b7280"
    });
    y += 18;

    const tiers: ItemTier[] = ["Básico", "Avançado", "Épico", "Lendário"];
    for (const tier of tiers) {
      const config = TIER_VISUALS[tier];
      this.add
        .rectangle(x + 5, y, 10, 10, config.borderColor, 0.8)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, config.borderColor, 1);
      this.add.text(x + 20, y, config.label, {
        fontSize: "11px",
        color: config.tierTextColor
      });
      y += 14;
    }
  }

  private moveSelection(delta: number) {
    if (this.entries.length === 0) return;
    this.entryIndex =
      (this.entryIndex + delta + this.entries.length) % this.entries.length;
    
    // Atualiza cores dos textos
    this.entryTexts.forEach((t, idx) => {
      const entry = this.entries[idx];
      const tierConfig = TIER_VISUALS[entry.tier];
      t.setColor(idx === this.entryIndex ? "#22c55e" : tierConfig.tierTextColor);
    });

    // Atualiza cores das quantidades
    this.quantityTexts.forEach((t, idx) => {
      t.setColor(idx === this.entryIndex ? "#22c55e" : "#6b7280");
    });

    // Atualiza destaque do fundo
    this.entryBackgrounds.forEach((bg, idx) => {
      const entry = this.entries[idx];
      const tierConfig = TIER_VISUALS[entry.tier];
      const alpha = idx === this.entryIndex ? 0.2 : 0.08;
      bg.setFillStyle(tierConfig.borderColor, alpha);
    });

    this.updateSummary();
  }

  private adjustQuantity(delta: number) {
    if (this.entries.length === 0) return;
    const entry = this.entries[this.entryIndex];
    
    const newQuantity = Math.max(0, Math.min(entry.quantity, entry.selectedQuantity + delta));
    entry.selectedQuantity = newQuantity;
    
    // Atualiza o texto de quantidade
    const quantityText = this.quantityTexts[this.entryIndex];
    quantityText.setText(`Selecionado: ${newQuantity}`);
    
    // Atualiza cor baseada na quantidade
    if (newQuantity > 0) {
      quantityText.setColor(this.entryIndex === this.entryIndex ? "#22c55e" : "#10b981");
    } else {
      quantityText.setColor(this.entryIndex === this.entryIndex ? "#22c55e" : "#6b7280");
    }

    // Atualiza o mapa de seleção
    if (newQuantity > 0) {
      this.selectedItems.set(entry.itemId, newQuantity);
    } else {
      this.selectedItems.delete(entry.itemId);
    }

    this.updateSummary();
  }

  private updateSummary() {
    const totalSelected = Array.from(this.selectedItems.values()).reduce((sum, qty) => sum + qty, 0);
    const itemCount = this.selectedItems.size;
    
    if (totalSelected === 0) {
      this.statusText.setText("Nenhum item selecionado");
      this.statusText.setColor("#9ca3af");
    } else {
      this.statusText.setText(
        `${itemCount} tipo(s) de item selecionado(s) | Total: ${totalSelected} itens`
      );
      this.statusText.setColor("#22c55e");
    }
  }

  private confirmAndStart() {
    // Prepara o objeto com os itens selecionados
    const selectedItemsData: Record<string, number> = {};
    this.selectedItems.forEach((quantity, itemId) => {
      selectedItemsData[itemId] = quantity;
    });

    // Inicia a expedição passando os itens selecionados
    this.scene.start("ExpeditionScene", { selectedItems: selectedItemsData });
  }

  private cancel() {
    this.scene.start("BaseHubScene");
  }
}
