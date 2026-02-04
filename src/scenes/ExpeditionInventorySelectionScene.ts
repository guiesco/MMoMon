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
import { saveBackpackToServer } from "../services/firebaseSync";
import { isFirebaseClientAvailable } from "../services/firebaseClient";

interface DisplayInventoryEntry {
  itemId: string;
  name: string;
  tier: ItemTier;
  kind: ItemKind;
  quantity: number; // Quantidade no armazem
  preparedQuantity: number; // Quantidade na mochila
  description: string;
  category: ItemCategory;
  source: "permanent" | "prepared" | "both"; // De qual inventário vem
}

/**
 * Cena para preparar inventário antes de iniciar expedição.
 * Funciona como o gerenciamento de inventário, permitindo transferir itens entre armazem e mochila.
 * Ao confirmar, inicia a expedição com os itens na mochila.
 */
export class ExpeditionInventorySelectionScene extends Phaser.Scene {
  private entryIndex = 0;
  private entryTexts: Phaser.GameObjects.Text[] = [];
  private entryBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private categoryHeaders: Phaser.GameObjects.Text[] = [];
  private categorySymbols: Phaser.GameObjects.Text[] = [];
  private arrowIndicators: Phaser.GameObjects.Text[] = [];
  private emptyMessageText: Phaser.GameObjects.Text | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private entries: DisplayInventoryEntry[] = [];

  constructor() {
    super("ExpeditionInventorySelectionScene");
  }

  create() {
    // Limpa estado visual
    this.clearAllVisuals();

    const { width, height } = this.scale;
    const progress = PlayerState.getProgress();
    const preparedInventory = PlayerState.getPreparedExpeditionInventory();

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

    const totalItens = progress.inventory.reduce(
      (acc, e) => acc + e.quantity,
      0
    );
    const totalPrepared = preparedInventory.reduce(
      (acc, e) => acc + e.quantity,
      0
    );

    this.add
      .text(
        width / 2,
        72,
        `Armazem: ${totalItens} itens  |  Mochila: ${totalPrepared} itens  |  ` +
        "↑/↓: navegar  |  ←/→: transferir  |  ENTER: iniciar expedição  |  ESC: cancelar",
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

    this.entryIndex = 0;
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
    this.input.keyboard?.on("keydown-ENTER", () => this.confirmAndStart());
    this.input.keyboard?.on("keydown-ESC", async () => {
      // Salva mochila na Firebase antes de sair
      const preparedInventory = PlayerState.getPreparedExpeditionInventory();
      if (isFirebaseClientAvailable()) {
        try {
          await saveBackpackToServer(preparedInventory);
          console.log('[ExpeditionInventorySelectionScene] ✅ Mochila salva na Firebase');
        } catch (error) {
          console.error('[ExpeditionInventorySelectionScene] Erro ao salvar mochila:', error);
        }
      }
      this.scene.start("BaseHubScene");
    });
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

    // Adiciona itens do armazem
    for (const entry of permanent) {
      const def = getItemById(entry.itemId);
      if (!def) continue;

      // Filtra apenas itens úteis para expedição
      const isExpeditionItem = 
        entry.itemId.startsWith("poke-ball-") ||
        entry.itemId.startsWith("potion-") ||
        def.kind === "consumable" ||
        def.kind === "capture_tool";
      
      if (!isExpeditionItem) continue;

      const visuals = getItemVisuals(def.kind, def.tier, entry.itemId);
      const preparedQty = prepared.find(e => e.itemId === entry.itemId)?.quantity ?? 0;

      itemMap.set(entry.itemId, {
        itemId: entry.itemId,
        name: def.name,
        tier: def.tier,
        kind: def.kind,
        quantity: entry.quantity ?? 0,
        preparedQuantity: preparedQty,
        description: def.description,
        category: this.getCategoryKey(def.kind, entry.itemId),
        source: preparedQty > 0 ? "both" : "permanent"
      });
    }

    // Adiciona itens da mochila que não estão no armazem
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
          preparedQuantity: entry.quantity ?? 0,
          description: def.description,
          category: this.getCategoryKey(def.kind, entry.itemId),
          source: "prepared"
        });
      } else {
        // Atualiza a quantidade preparada se o item já existe no map
        const existing = itemMap.get(entry.itemId);
        if (existing) {
          existing.preparedQuantity = entry.quantity ?? 0;
          existing.source = existing.quantity > 0 ? "both" : "prepared";
        }
      }
    }

    const entries = Array.from(itemMap.values());

    // Ordena por categoria, tier e nome
    return entries.sort((a, b) => {
      const orderCategory = (c: ItemCategory) => {
        if (c === "capture") return 0;
        if (c === "consumable") return 1;
        return 2;
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

    // Garante que entryIndex está dentro dos limites válidos
    if (this.entries.length > 0) {
      this.entryIndex = Math.max(0, Math.min(this.entryIndex, this.entries.length - 1));
    }

    if (this.entries.length === 0) {
      this.emptyMessageText = this.add
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
      
      // Garante que as quantidades existem
      const quantity = entry.quantity ?? 0;
      const preparedQuantity = entry.preparedQuantity ?? 0;
      
      // Monta texto mostrando quantidades em ambos os inventários
      let quantityText = "";
      if (quantity > 0 && preparedQuantity > 0) {
        quantityText = `x${quantity} (Armazem) + x${preparedQuantity} (Mochila)`;
      } else if (quantity > 0) {
        quantityText = `x${quantity} (Armazem)`;
      } else if (preparedQuantity > 0) {
        quantityText = `x${preparedQuantity} (Mochila)`;
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
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          if (this.entryIndex !== idx) {
            this.entryIndex = idx;
            this.renderEntries();
          }
        })
        .on("pointerdown", () => {
          this.entryIndex = idx;
          this.renderEntries();
        });

      this.entryTexts.push(text);

      // Indicador de direção de transferência (também clicável)
      if (isSelected) {
        const entryQuantity = entry.quantity ?? 0;
        const arrowColor = entryQuantity > 0 ? "#3b82f6" : "#ef4444";
        const arrowText = entryQuantity > 0 ? "→" : "←";
        const arrow = this.add
          .text(width - 120, y, arrowText, {
            fontSize: "18px",
            color: arrowColor
          })
          .setOrigin(0.5, 0.5)
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => {
            const direction = entryQuantity > 0 ? 1 : -1;
            this.transferItem(direction);
          });
        this.arrowIndicators.push(arrow);
      }

      y += 26;
    });
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
    
    // Garante que entryIndex está dentro dos limites válidos
    this.entryIndex = Math.max(0, Math.min(this.entryIndex, this.entries.length - 1));
    
    this.entryIndex =
      (this.entryIndex + delta + this.entries.length) % this.entries.length;
    
    // Verifica se a entrada atual é válida
    const currentEntry = this.entries[this.entryIndex];
    if (!currentEntry) {
      // Se a entrada não é válida, ajusta o índice
      this.entryIndex = Math.max(0, this.entries.length - 1);
    }
    
    // Limpa mensagem de status ao navegar
    this.statusText.setText("");
    
    // Re-renderiza para atualizar setas
    this.renderEntries();
  }

  private transferItem(direction: number) {
    if (this.entries.length === 0) return;
    const entry = this.entries[this.entryIndex];
    
    // Verifica se a entrada é válida
    if (!entry) {
      this.statusText.setText("Erro: entrada inválida.");
      this.statusText.setColor("#ef4444");
      return;
    }
    
    // Garante que as propriedades existem
    const quantity = entry.quantity ?? 0;
    const preparedQuantity = entry.preparedQuantity ?? 0;
    
    // direction > 0: transferir para preparado (→)
    // direction < 0: retornar ao permanente (←)
    const toPrepared = direction > 0;
    
    // Verifica se pode transferir
    if (toPrepared && quantity === 0) {
      this.statusText.setText("Não há itens no armazem para transferir.");
      this.statusText.setColor("#ef4444");
      return;
    }
    
    if (!toPrepared && preparedQuantity === 0) {
      this.statusText.setText("Não há itens na mochila para retornar.");
      this.statusText.setColor("#ef4444");
      return;
    }

    // Preserva o itemId selecionado para manter a seleção após reconstruir
    const selectedItemId = entry.itemId;
    
    // Transfere 1 unidade
    const success = PlayerState.transferItem(entry.itemId, 1, toPrepared);
    
    if (success) {
      const action = toPrepared ? "transferido para mochila" : "retornado ao armazem";
      this.statusText.setText(`1x ${entry.name} ${action}.`);
      this.statusText.setColor("#22c55e");
      
      // Reconstrói as entradas e re-renderiza
      const progress = PlayerState.getProgress();
      const preparedInventory = PlayerState.getPreparedExpeditionInventory();
      this.entries = this.buildCombinedEntries(progress.inventory, preparedInventory);
      
      // Encontra o índice do item selecionado na nova lista
      const newIndex = this.entries.findIndex(e => e.itemId === selectedItemId);
      if (newIndex >= 0) {
        this.entryIndex = newIndex;
      } else {
        // Se o item não existe mais, ajusta o índice para não ultrapassar os limites
        this.entryIndex = Math.min(this.entryIndex, Math.max(0, this.entries.length - 1));
      }
      
      this.renderEntries();
    } else {
      this.statusText.setText(`Não foi possível transferir ${entry.name}.`);
      this.statusText.setColor("#ef4444");
    }
  }

  private async confirmAndStart() {
    // Salva mochila na Firebase antes de iniciar
    const preparedInventory = PlayerState.getPreparedExpeditionInventory();
    if (isFirebaseClientAvailable()) {
      try {
        await saveBackpackToServer(preparedInventory);
        console.log('[ExpeditionInventorySelectionScene] ✅ Mochila salva na Firebase');
      } catch (error) {
        console.error('[ExpeditionInventorySelectionScene] Erro ao salvar mochila:', error);
        // Continua mesmo se falhar - o servidor pode usar os itens selecionados diretamente
      }
    }
    
    // Prepara o objeto com os itens da mochila para a expedição
    const selectedItemsData: Record<string, number> = {};
    for (const entry of preparedInventory) {
      if (entry.quantity > 0) {
        selectedItemsData[entry.itemId] = entry.quantity;
      }
    }

    // Inicia a expedição passando os itens da mochila
    this.scene.start("ExpeditionScene", { selectedItems: selectedItemsData });
  }
}
