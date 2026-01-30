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
}

export class InventoryScene extends Phaser.Scene {
  private entryIndex = 0;
  private entryTexts: Phaser.GameObjects.Text[] = [];
  private entryBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private entries: DisplayInventoryEntry[] = [];

  constructor() {
    super("InventoryScene");
  }

  create(data?: { preserveIndex?: number }) {
    // Preserva índice se veio de um restart após ação
    const preservedIndex = data?.preserveIndex ?? 0;
    
    // Limpa estado visual sempre que a cena é recriada
    this.entryTexts.forEach((t) => t.destroy());
    this.entryTexts = [];
    this.entryBackgrounds.forEach((bg) => bg.destroy());
    this.entryBackgrounds = [];

    const { width, height } = this.scale;
    const progress = PlayerState.getProgress();

    // Fundo da sala de inventário
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x020617, 1)
      .setOrigin(0.5);

    const headerBg = this.add
      .rectangle(width / 2, 40, width - 80, 52, 0x020b1b, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x1f2937, 1);

    this.add
      .text(width / 2, headerBg.y, "Depósito de Inventário", {
        fontSize: "24px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);

    const totalItens = progress.inventory.reduce(
      (acc, e) => acc + e.quantity,
      0
    );

    this.add
      .text(
        width / 2,
        72,
        `Capacidade: ${totalItens}/${progress.inventoryCapacity} itens  ·  ` +
          "↑/↓ para navegar  ·  ENTER para detalhes  ·  D para descartar 1  ·  ESC para voltar",
        {
          fontSize: "14px",
          color: "#9ca3af"
        }
      )
      .setOrigin(0.5);

    // Legenda de cores
    this.renderColorLegend(width - 200, 100);

    // Prepara entradas de inventário agrupadas por tipo
    this.entries = progress.inventory
      .map((entry) => {
        const def = getItemById(entry.itemId);
        if (!def) return undefined;
        
        // Determina categoria visual
        const visuals = getItemVisuals(def.kind, def.tier, entry.itemId);
        
        return {
          itemId: entry.itemId,
          name: def.name,
          tier: def.tier,
          kind: def.kind,
          quantity: entry.quantity,
          description: def.description,
          category: this.getCategoryKey(def.kind, entry.itemId)
        } as DisplayInventoryEntry;
      })
      .filter((e): e is DisplayInventoryEntry => Boolean(e))
      .sort((a, b) => {
        // Ordena por categoria (captura > recurso > consumível > upgrade), depois por tier e nome
        const orderCategory = (c: ItemCategory) => {
          if (c === "capture") return 0;
          if (c === "raw_resource") return 1;
          if (c === "consumable") return 2;
          if (c === "upgrade") return 3;
          return 4;
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

    // Define o índice preservado (limitado ao tamanho da lista atual)
    this.entryIndex = Math.min(preservedIndex, Math.max(0, this.entries.length - 1));

    let y = 120;

    if (this.entries.length === 0) {
      this.add
        .text(
          width / 2,
          y,
          "Seu inventário está vazio. Traga recursos das expedições para começar a encher o depósito.",
          {
            fontSize: "16px",
            color: "#9ca3af",
            wordWrap: { width: width - 120 }
          }
        )
        .setOrigin(0.5, 0);
    } else {
      // Cabeçalhos por categoria
      let lastCategory: ItemCategory | null = null;

      this.entries.forEach((entry, idx) => {
        if (entry.category !== lastCategory) {
          // Espaçamento entre grupos
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

        // Fundo colorido por tier (sutil)
        const bgWidth = width - 250;
        const bg = this.add
          .rectangle(60, y, bgWidth, 22, visuals.tier.borderColor, 0.08)
          .setOrigin(0, 0.5)
          .setStrokeStyle(tierConfig.borderWidth, tierConfig.borderColor, 0.4);
        this.entryBackgrounds.push(bg);

        // Indicador de categoria (pequeno símbolo colorido)
        this.add
          .text(65, y, categoryConfig.symbol, {
            fontSize: "13px",
            color: hexToCSS(categoryConfig.primaryColor)
          })
          .setOrigin(0, 0.5);

        // Texto do item com cor baseada no tier
        const isSelected = idx === this.entryIndex;
        const textColor = isSelected ? "#22c55e" : tierConfig.tierTextColor;
        
        const text = this.add
          .text(
            85,
            y,
            `${entry.name} [${entry.tier}]  x${entry.quantity}`,
            {
              fontSize: "15px",
              color: textColor
            }
          )
          .setOrigin(0, 0.5);

        this.entryTexts.push(text);
        y += 26;
      });
    }

    this.statusText = this.add
      .text(40, height - 64, "", {
        fontSize: "14px",
        color: "#e5e7eb",
        wordWrap: { width: width - 80 }
      })
      .setOrigin(0, 0.5);

    this.input.keyboard?.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.showDetails());
    this.input.keyboard?.on("keydown-D", () => this.discardOne());
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("BaseHubScene"));
  }

  private getCategoryKey(kind: ItemKind, itemId: string): ItemCategory {
    if (itemId.startsWith("resource-")) return "raw_resource";
    switch (kind) {
      case "capture_tool": return "capture";
      case "consumable": return "consumable";
      case "base_upgrade": return "upgrade";
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

    const categories: ItemCategory[] = ["capture", "raw_resource", "consumable", "upgrade"];
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
      // Pequeno quadrado colorido
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

    // Atualiza destaque do fundo
    this.entryBackgrounds.forEach((bg, idx) => {
      const entry = this.entries[idx];
      const tierConfig = TIER_VISUALS[entry.tier];
      const alpha = idx === this.entryIndex ? 0.2 : 0.08;
      bg.setFillStyle(tierConfig.borderColor, alpha);
    });

    // Limpa mensagem de status ao navegar
    this.statusText.setText("");
  }

  private showDetails() {
    if (this.entries.length === 0) return;
    const entry = this.entries[this.entryIndex];
    const categoryConfig = CATEGORY_VISUALS[entry.category];
    const tierConfig = TIER_VISUALS[entry.tier];
    
    this.statusText.setText(
      `${categoryConfig.symbol} ${entry.name} (${tierConfig.label}) – ${entry.description} (Você possui x${entry.quantity})`
    );
  }

  private discardOne() {
    if (this.entries.length === 0) return;
    const entry = this.entries[this.entryIndex];

    const success = PlayerState.consumeItem(entry.itemId, 1);
    if (!success) {
      this.statusText.setText(
        "Não foi possível descartar esse item (quantidade insuficiente)."
      );
      return;
    }

    this.statusText.setText(`Você descartou 1x ${entry.name}.`);

    // Pequeno delay para o jogador ler a mensagem antes de atualizar a lista
    // Se o item descartado foi removido completamente, o índice pode precisar ajustar
    const currentIndex = this.entryIndex;
    this.time.delayedCall(200, () => this.scene.restart({ preserveIndex: currentIndex }));
  }
}
