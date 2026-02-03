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
  preparedQuantity: number; // Quantidade no inventário preparado
  description: string;
  category: ItemCategory;
  source: "permanent" | "prepared" | "both"; // De qual inventário vem
}

type InventoryViewMode = "permanent" | "prepared" | "both";

export class InventoryScene extends Phaser.Scene {
  private entryIndex = 0;
  private entryTexts: Phaser.GameObjects.Text[] = [];
  private entryBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private categoryHeaders: Phaser.GameObjects.Text[] = []; // Cabeçalhos de categoria
  private categorySymbols: Phaser.GameObjects.Text[] = []; // Símbolos de categoria
  private arrowIndicators: Phaser.GameObjects.Text[] = []; // Setas de direção
  private emptyMessageText: Phaser.GameObjects.Text | null = null; // Mensagem de inventário vazio
  private statusText!: Phaser.GameObjects.Text;
  private entries: DisplayInventoryEntry[] = [];
  private viewMode: InventoryViewMode = "both";
  private viewModeText!: Phaser.GameObjects.Text;

  constructor() {
    super("InventoryScene");
  }

  create(data?: { preserveIndex?: number }) {
    // Preserva índice se veio de um restart após ação
    const preservedIndex = data?.preserveIndex ?? 0;
    
    // Limpa estado visual sempre que a cena é recriada
    this.clearAllVisuals();

    const { width, height } = this.scale;
    const progress = PlayerState.getProgress();
    const preparedInventory = PlayerState.getPreparedExpeditionInventory();

    // Fundo da sala de inventário
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x020617, 1)
      .setOrigin(0.5);

    const headerBg = this.add
      .rectangle(width / 2, 40, width - 80, 52, 0x020b1b, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x1f2937, 1);

    this.add
      .text(width / 2, headerBg.y, "Gerenciamento de Inventário", {
        fontSize: "24px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);

    const totalItens = progress.inventory.reduce(
      (acc, e) => acc + e.quantity,
      0
    );
    const totalPrepared = preparedInventory.reduce(
      (acc, e) => acc + e.quantity,
      0
    );

    // Modo de visualização
    this.viewModeText = this.add
      .text(
        width / 2,
        72,
        `[TAB] Modo: ${this.getViewModeLabel()}  |  ` +
        `Permanente: ${totalItens} itens  |  Preparado: ${totalPrepared} itens  |  ` +
        "↑/↓: navegar  |  ←/→: transferir  |  ENTER: detalhes  |  ESC: voltar",
        {
          fontSize: "13px",
          color: "#9ca3af"
        }
      )
      .setOrigin(0.5);

    // Legenda de cores
    this.renderColorLegend(width - 200, 100);

    // Prepara entradas combinadas de ambos os inventários
    this.entries = this.buildCombinedEntries(progress.inventory, preparedInventory);

    // Define o índice preservado (limitado ao tamanho da lista atual)
    this.entryIndex = Math.min(preservedIndex, Math.max(0, this.entries.length - 1));

    this.renderEntries();

    this.statusText = this.add
      .text(40, height - 64, "", {
        fontSize: "14px",
        color: "#e5e7eb",
        wordWrap: { width: width - 80 }
      })
      .setOrigin(0, 0.5);

    this.input.keyboard?.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-LEFT", () => this.transferItem(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.transferItem(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.showDetails());
    
    // Prevenir comportamento padrão do TAB (navegação do navegador)
    // Adiciona listener no documento para capturar TAB antes do navegador
    const tabHandler = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && this.scene.isActive()) {
        event.preventDefault();
        event.stopPropagation();
        this.toggleViewMode();
      }
    };
    
    // Adiciona listener no documento
    document.addEventListener('keydown', tabHandler, true);
    
    // Remove listener quando a cena é destruída
    this.events.once('destroy', () => {
      document.removeEventListener('keydown', tabHandler, true);
    });
    
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("BaseHubScene"));
  }

  /**
   * Limpa todos os elementos visuais da cena.
   */
  private clearAllVisuals() {
    this.entryTexts.forEach((t) => t.destroy());
    this.entryTexts = [];
    this.entryBackgrounds.forEach((bg) => bg.destroy());
    this.entryBackgrounds = [];
    this.categoryHeaders.forEach((h) => h.destroy());
    this.categoryHeaders = [];
    this.categorySymbols.forEach((s) => s.destroy());
    this.categorySymbols = [];
    this.arrowIndicators.forEach((a) => a.destroy());
    this.arrowIndicators = [];
    if (this.emptyMessageText) {
      this.emptyMessageText.destroy();
      this.emptyMessageText = null;
    }
  }

  private buildCombinedEntries(
    permanent: Array<{ itemId: string; quantity: number }>,
    prepared: Array<{ itemId: string; quantity: number }>
  ): DisplayInventoryEntry[] {
    const itemMap = new Map<string, DisplayInventoryEntry>();

    // Adiciona itens do inventário permanente
    for (const entry of permanent) {
      const def = getItemById(entry.itemId);
      if (!def) continue;

      const visuals = getItemVisuals(def.kind, def.tier, entry.itemId);
      const preparedQty = prepared.find(e => e.itemId === entry.itemId)?.quantity ?? 0;

      itemMap.set(entry.itemId, {
        itemId: entry.itemId,
        name: def.name,
        tier: def.tier,
        kind: def.kind,
        quantity: entry.quantity,
        preparedQuantity: preparedQty,
        description: def.description,
        category: this.getCategoryKey(def.kind, entry.itemId),
        source: preparedQty > 0 ? "both" : "permanent"
      });
    }

    // Adiciona itens do inventário preparado que não estão no permanente
    for (const entry of prepared) {
      if (!itemMap.has(entry.itemId)) {
        const def = getItemById(entry.itemId);
        if (!def) continue;

        const visuals = getItemVisuals(def.kind, def.tier, entry.itemId);

        itemMap.set(entry.itemId, {
          itemId: entry.itemId,
          name: def.name,
          tier: def.tier,
          kind: def.kind,
          quantity: 0,
          preparedQuantity: entry.quantity,
          description: def.description,
          category: this.getCategoryKey(def.kind, entry.itemId),
          source: "prepared"
        });
      }
    }

    const entries = Array.from(itemMap.values());

    // Filtra por modo de visualização
    if (this.viewMode === "permanent") {
      return entries.filter(e => e.source === "permanent" || e.source === "both");
    } else if (this.viewMode === "prepared") {
      return entries.filter(e => e.source === "prepared" || e.source === "both");
    }

    // Ordena por categoria, tier e nome
    return entries.sort((a, b) => {
      const orderCategory = (c: ItemCategory) => {
        if (c === "capture") return 0;
        if (c === "raw_resource") return 1;
        if (c === "consumable") return 2;
        if (c === "upgrade") return 3;
        return 4;
      };
      const catCmp = orderCategory(a.category) - orderCategory(b.category);
      if (catCmp !== 0) return catCmp;
      
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
  }

  private renderEntries() {
    // Limpa todos os elementos visuais anteriores
    this.clearAllVisuals();

    const { width, height } = this.scale;
    let y = 120;

    if (this.entries.length === 0) {
      this.emptyMessageText = this.add
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
      return;
    }

    // Cabeçalhos por categoria
    let lastCategory: ItemCategory | null = null;

    this.entries.forEach((entry, idx) => {
      if (entry.category !== lastCategory) {
        if (lastCategory !== null) {
          y += 14;
        }

        const categoryConfig = CATEGORY_VISUALS[entry.category];
        const categoryLabel = `${categoryConfig.symbol} ${categoryConfig.label}`;

        const headerText = this.add
          .text(40, y, categoryLabel, {
            fontSize: "15px",
            color: categoryConfig.textColor
          })
          .setOrigin(0, 0.5);
        this.categoryHeaders.push(headerText);
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
      const symbolText = this.add
        .text(65, y, categoryConfig.symbol, {
          fontSize: "13px",
          color: hexToCSS(categoryConfig.primaryColor)
        })
        .setOrigin(0, 0.5);
      this.categorySymbols.push(symbolText);

      // Texto do item com informações de ambos os inventários
      const isSelected = idx === this.entryIndex;
      const textColor = isSelected ? "#22c55e" : tierConfig.tierTextColor;
      
      // Monta texto mostrando quantidades em ambos os inventários
      let quantityText = "";
      if (entry.quantity > 0 && entry.preparedQuantity > 0) {
        quantityText = `x${entry.quantity} (Perm.) + x${entry.preparedQuantity} (Prep.)`;
      } else if (entry.quantity > 0) {
        quantityText = `x${entry.quantity} (Perm.)`;
      } else if (entry.preparedQuantity > 0) {
        quantityText = `x${entry.preparedQuantity} (Prep.)`;
      }

      const text = this.add
        .text(
          85,
          y,
          `${entry.name} [${entry.tier}]  ${quantityText}`,
          {
            fontSize: "15px",
            color: textColor
          }
        )
        .setOrigin(0, 0.5);

      this.entryTexts.push(text);

      // Indicador de direção de transferência
      if (isSelected) {
        const arrowColor = entry.quantity > 0 ? "#3b82f6" : "#ef4444";
        const arrowText = entry.quantity > 0 ? "→" : "←";
        const arrow = this.add
          .text(width - 120, y, arrowText, {
            fontSize: "18px",
            color: arrowColor
          })
          .setOrigin(0.5, 0.5);
        this.arrowIndicators.push(arrow);
      }

      y += 26;
    });
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

  private getViewModeLabel(): string {
    switch (this.viewMode) {
      case "permanent": return "Apenas Permanente";
      case "prepared": return "Apenas Preparado";
      case "both": return "Ambos";
      default: return "Ambos";
    }
  }

  private toggleViewMode() {
    const modes: InventoryViewMode[] = ["both", "permanent", "prepared"];
    const currentIndex = modes.indexOf(this.viewMode);
    this.viewMode = modes[(currentIndex + 1) % modes.length];
    
    // Reconstrói as entradas com o novo modo
    const progress = PlayerState.getProgress();
    const preparedInventory = PlayerState.getPreparedExpeditionInventory();
    this.entries = this.buildCombinedEntries(progress.inventory, preparedInventory);
    this.entryIndex = Math.min(this.entryIndex, this.entries.length - 1);
    
    // Atualiza UI
    this.viewModeText.setText(
      `[TAB] Modo: ${this.getViewModeLabel()}  |  ` +
      `Permanente: ${progress.inventory.reduce((acc, e) => acc + e.quantity, 0)} itens  |  ` +
      `Preparado: ${preparedInventory.reduce((acc, e) => acc + e.quantity, 0)} itens  |  ` +
      "↑/↓: navegar  |  ←/→: transferir  |  ENTER: detalhes  |  ESC: voltar"
    );
    
    this.renderEntries();
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
    
    // Re-renderiza para atualizar setas
    this.renderEntries();
  }

  private transferItem(direction: number) {
    if (this.entries.length === 0) return;
    const entry = this.entries[this.entryIndex];
    
    // direction > 0: transferir para preparado (→)
    // direction < 0: retornar ao permanente (←)
    const toPrepared = direction > 0;
    
    // Verifica se pode transferir
    if (toPrepared && entry.quantity === 0) {
      this.statusText.setText("Não há itens no inventário permanente para transferir.");
      this.statusText.setColor("#ef4444");
      return;
    }
    
    if (!toPrepared && entry.preparedQuantity === 0) {
      this.statusText.setText("Não há itens no inventário preparado para retornar.");
      this.statusText.setColor("#ef4444");
      return;
    }

    // Transfere 1 unidade
    const success = PlayerState.transferItem(entry.itemId, 1, toPrepared);
    
    if (success) {
      const action = toPrepared ? "transferido para preparado" : "retornado ao permanente";
      this.statusText.setText(`1x ${entry.name} ${action}.`);
      this.statusText.setColor("#22c55e");
      
      // Reconstrói as entradas e re-renderiza
      const progress = PlayerState.getProgress();
      const preparedInventory = PlayerState.getPreparedExpeditionInventory();
      this.entries = this.buildCombinedEntries(progress.inventory, preparedInventory);
      
      // Atualiza contadores no header
      const totalItens = progress.inventory.reduce((acc, e) => acc + e.quantity, 0);
      const totalPrepared = preparedInventory.reduce((acc, e) => acc + e.quantity, 0);
      this.viewModeText.setText(
        `[TAB] Modo: ${this.getViewModeLabel()}  |  ` +
        `Permanente: ${totalItens} itens  |  Preparado: ${totalPrepared} itens  |  ` +
        "↑/↓: navegar  |  ←/→: transferir  |  ENTER: detalhes  |  ESC: voltar"
      );
      
      this.renderEntries();
    } else {
      this.statusText.setText(`Não foi possível transferir ${entry.name}.`);
      this.statusText.setColor("#ef4444");
    }
  }

  private showDetails() {
    if (this.entries.length === 0) return;
    const entry = this.entries[this.entryIndex];
    const categoryConfig = CATEGORY_VISUALS[entry.category];
    const tierConfig = TIER_VISUALS[entry.tier];
    
    let details = `${categoryConfig.symbol} ${entry.name} (${tierConfig.label}) – ${entry.description}\n`;
    details += `Permanente: x${entry.quantity}  |  Preparado: x${entry.preparedQuantity}`;
    
    this.statusText.setText(details);
    this.statusText.setColor("#e5e7eb");
  }
}
