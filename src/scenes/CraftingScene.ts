import Phaser from "phaser";
import { PlayerState } from "../game/playerState";
import { CRAFTING_RECIPES, getItemById } from "../game/items";
import type { ItemKind, ItemTier } from "../game/types";
import {
  getItemVisuals,
  CATEGORY_VISUALS,
  TIER_VISUALS,
  hexToCSS,
  type ItemCategory
} from "../game/itemVisuals";
import { craftItemOnServer, craftItemsBatch } from "../services/firebaseSync";

export class CraftingScene extends Phaser.Scene {
  private recipeIndex = 0;
  private recipeTexts: Phaser.GameObjects.Text[] = [];
  private recipeBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private statusText!: Phaser.GameObjects.Text;
  
  // Modal de confirmação
  private modalContainer!: Phaser.GameObjects.Container;
  private modalQuantity: number = 1;
  private isModalOpen: boolean = false;
  private modalTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("CraftingScene");
  }

  create(data?: { preserveIndex?: number }) {
    // Preserva índice se veio de um restart após craft
    const preservedIndex = data?.preserveIndex ?? 0;
    this.recipeIndex = Math.min(preservedIndex, CRAFTING_RECIPES.length - 1);
    
    // Garante estado visual limpo sempre que a cena é (re)criada
    this.recipeTexts.forEach((t) => t.destroy());
    this.recipeTexts = [];
    this.recipeBackgrounds.forEach((bg) => bg.destroy());
    this.recipeBackgrounds = [];

    const { width, height } = this.scale;
    const progress = PlayerState.getProgress();

    // Fundo sutil para tela de laboratório
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x020617, 1)
      .setOrigin(0.5);

    const headerBg = this.add
      .rectangle(width / 2, 40, width - 80, 52, 0x020b1b, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x1f2937, 1);

    this.add
      .text(width / 2, headerBg.y, "Laboratório de Craft", {
        fontSize: "24px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        72,
        "Use ↑/↓ para navegar, ENTER para craftar, ESC para voltar à base.",
        {
          fontSize: "14px",
          color: "#9ca3af"
        }
      )
      .setOrigin(0.5);

    let y = 110;
    CRAFTING_RECIPES.forEach((recipe, idx) => {
      const resultItem = getItemById(recipe.resultItemId);
      const itemTier = resultItem?.tier ?? "Básico";
      const itemKind = resultItem?.kind ?? "consumable";
      
      // Verifica se este item está selecionado
      const isSelected = idx === this.recipeIndex;
      
      // Obtém configuração visual do resultado
      const tierConfig = TIER_VISUALS[itemTier];
      const categoryConfig = CATEGORY_VISUALS[this.getCategoryKey(itemKind, recipe.resultItemId)];

      // Calcula altura do bloco de receita (nome + ingredientes)
      const blockHeight = 26 + (recipe.ingredients.length * 20) + 8;
      
      // Fundo colorido por tier do resultado (mais destacado se selecionado)
      const bgAlpha = isSelected ? 0.15 : 0.06;
      const bg = this.add
        .rectangle(40, y + blockHeight / 2 - 13, width - 130, blockHeight, tierConfig.borderColor, bgAlpha)
        .setOrigin(0, 0.5)
        .setStrokeStyle(tierConfig.borderWidth, tierConfig.borderColor, isSelected ? 0.6 : 0.35);
      this.recipeBackgrounds.push(bg);

      // Indicador de categoria do resultado
      this.add
        .text(45, y, categoryConfig.symbol, {
          fontSize: "14px",
          color: hexToCSS(categoryConfig.primaryColor)
        })
        .setOrigin(0, 0.5);

      // Nome do resultado com cor de tier
      const nameColor = isSelected ? "#22c55e" : tierConfig.tierTextColor;
      
      const text = this.add
        .text(
          65,
          y,
          `${resultItem?.name ?? recipe.resultItemId} [${itemTier}] (${recipe.timeSeconds}s)`,
          {
            fontSize: "16px",
            color: nameColor
          }
        )
        .setOrigin(0, 0.5);
      this.recipeTexts.push(text);

      y += 24;
      
      // Lista de ingredientes com cores de categoria/tier
      recipe.ingredients.forEach((ing) => {
        const item = getItemById(ing.itemId);
        const owned =
          progress.inventory.find((e) => e.itemId === ing.itemId)?.quantity ?? 0;
        const hasEnough = owned >= ing.quantity;
        
        // Cores do ingrediente
        const ingTier = item?.tier ?? "Básico";
        const ingKind = item?.kind ?? "consumable";
        const ingCategory = this.getCategoryKey(ingKind, ing.itemId);
        const ingCategoryConfig = CATEGORY_VISUALS[ingCategory];
        const ingTierConfig = TIER_VISUALS[ingTier];
        
        // Cor base do ingrediente (com indicação de suficiência)
        const ingColor = hasEnough ? ingTierConfig.tierTextColor : "#ef4444";
        const quantityColor = hasEnough ? "#6b7280" : "#ef4444";
        
        // Símbolo de categoria do ingrediente
        this.add
          .text(70, y, ingCategoryConfig.symbol, {
            fontSize: "11px",
            color: hexToCSS(ingCategoryConfig.primaryColor)
          })
          .setOrigin(0, 0.5);
        
        this.add
          .text(
            85,
            y,
            `${item?.name ?? ing.itemId}: ${ing.quantity}`,
            {
              fontSize: "13px",
              color: ingColor
            }
          )
          .setOrigin(0, 0.5);
        
        // Quantidade possuída (à direita)
        this.add
          .text(
            width - 180,
            y,
            `(você tem ${owned})`,
            {
              fontSize: "12px",
              color: quantityColor
            }
          )
          .setOrigin(0, 0.5);
        
        y += 20;
      });

      y += 12;
    });

    // Legenda de cores
    this.renderColorLegend(width - 120, 110);

    this.statusText = this.add
      .text(40, height - 60, "", {
        fontSize: "14px",
        color: "#e5e7eb"
      })
      .setOrigin(0, 0.5);

    // Inicializar modal (invisível inicialmente)
    this.modalContainer = this.add.container(0, 0).setVisible(false);
    this.isModalOpen = false;
    this.modalQuantity = 1;

    this.input.keyboard?.on("keydown-UP", () => {
      if (this.isModalOpen) {
        this.adjustModalQuantity(1);
      } else {
        this.moveSelection(-1);
      }
    });
    this.input.keyboard?.on("keydown-DOWN", () => {
      if (this.isModalOpen) {
        this.adjustModalQuantity(-1);
      } else {
        this.moveSelection(1);
      }
    });
    this.input.keyboard?.on("keydown-LEFT", () => {
      if (this.isModalOpen) {
        this.adjustModalQuantity(-10);
      }
    });
    this.input.keyboard?.on("keydown-RIGHT", () => {
      if (this.isModalOpen) {
        this.adjustModalQuantity(10);
      }
    });
    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.isModalOpen) {
        this.confirmCraft();
      } else {
        this.showCraftModal();
      }
    });
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.isModalOpen) {
        this.closeCraftModal();
      } else {
        // Sync será feito automaticamente ao entrar na BaseHubScene
        this.scene.start("BaseHubScene");
      }
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

  private renderColorLegend(x: number, y: number) {
    // Legenda de tiers
    this.add.text(x, y, "Raridade:", {
      fontSize: "11px",
      color: "#6b7280"
    });
    y += 16;

    const tiers: ItemTier[] = ["Básico", "Avançado", "Épico", "Lendário"];
    for (const tier of tiers) {
      const config = TIER_VISUALS[tier];
      this.add
        .rectangle(x + 3, y, 8, 8, config.borderColor, 0.8)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, config.borderColor, 1);
      this.add.text(x + 15, y, tier, {
        fontSize: "10px",
        color: config.tierTextColor
      });
      y += 12;
    }
  }

  private moveSelection(delta: number) {
    this.recipeIndex =
      (this.recipeIndex + delta + CRAFTING_RECIPES.length) %
      CRAFTING_RECIPES.length;
    
    // Atualiza cores dos textos de receita
    this.recipeTexts.forEach((t, idx) => {
      const recipe = CRAFTING_RECIPES[idx];
      const resultItem = getItemById(recipe.resultItemId);
      const itemTier = resultItem?.tier ?? "Básico";
      const tierConfig = TIER_VISUALS[itemTier];
      
      t.setColor(idx === this.recipeIndex ? "#22c55e" : tierConfig.tierTextColor);
    });

    // Atualiza destaque do fundo
    this.recipeBackgrounds.forEach((bg, idx) => {
      const recipe = CRAFTING_RECIPES[idx];
      const resultItem = getItemById(recipe.resultItemId);
      const itemTier = resultItem?.tier ?? "Básico";
      const tierConfig = TIER_VISUALS[itemTier];
      
      const isSelected = idx === this.recipeIndex;
      const alpha = isSelected ? 0.15 : 0.06;
      bg.setFillStyle(tierConfig.borderColor, alpha);
      bg.setStrokeStyle(tierConfig.borderWidth, tierConfig.borderColor, isSelected ? 0.6 : 0.35);
    });
  }



  private showCraftModal() {
    const recipe = CRAFTING_RECIPES[this.recipeIndex];
    const progress = PlayerState.getProgress();

    // Verificar se possui ingredientes para pelo menos 1 craft
    for (const ing of recipe.ingredients) {
      const owned =
        progress.inventory.find((e) => e.itemId === ing.itemId)?.quantity ?? 0;
      if (owned < ing.quantity) {
        this.statusText.setText("Faltam materiais para craftar essa receita.");
        return;
      }
    }

    this.isModalOpen = true;
    this.modalQuantity = 1;
    this.renderCraftModal();
  }

  private closeCraftModal() {
    this.isModalOpen = false;
    this.modalContainer.setVisible(false);
    this.modalTexts.forEach(t => t.destroy());
    this.modalTexts = [];
  }

  private adjustModalQuantity(delta: number) {
    const recipe = CRAFTING_RECIPES[this.recipeIndex];
    const progress = PlayerState.getProgress();
    
    // Calcular quantidade máxima possível
    let maxQuantity = Infinity;
    for (const ing of recipe.ingredients) {
      const owned =
        progress.inventory.find((e) => e.itemId === ing.itemId)?.quantity ?? 0;
      const possibleQuantity = Math.floor(owned / ing.quantity);
      maxQuantity = Math.min(maxQuantity, possibleQuantity);
    }

    // Limitar upgrade de slot a 1
    if (recipe.id === "recipe-upgrade-team-slot") {
      maxQuantity = 1;
    }

    const newQuantity = Math.max(1, Math.min(maxQuantity, this.modalQuantity + delta));
    if (newQuantity !== this.modalQuantity) {
      this.modalQuantity = newQuantity;
      this.renderCraftModal();
    }
  }

  private renderCraftModal() {
    // Limpar textos anteriores
    this.modalTexts.forEach(t => t.destroy());
    this.modalTexts = [];
    this.modalContainer.removeAll(true);

    const { width, height } = this.scale;
    const recipe = CRAFTING_RECIPES[this.recipeIndex];
    const progress = PlayerState.getProgress();
    const resultItem = getItemById(recipe.resultItemId);
    const itemKind = resultItem?.kind ?? "consumable";
    const categoryConfig = CATEGORY_VISUALS[this.getCategoryKey(itemKind, recipe.resultItemId)];

    // Fundo escuro semi-transparente
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.modalContainer.add(bg);

    // Container do modal
    const modalWidth = 500;
    const modalHeight = 400;
    const modalBg = this.add.rectangle(
      width / 2,
      height / 2,
      modalWidth,
      modalHeight,
      0x0f172a,
      0.95
    ).setStrokeStyle(2, 0x1e293b, 1);
    this.modalContainer.add(modalBg);

    let y = height / 2 - modalHeight / 2 + 30;

    // Título
    const title = this.add.text(width / 2, y, `Craftar: ${resultItem?.name ?? recipe.resultItemId}`, {
      fontSize: "20px",
      color: "#fbbf24",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.modalContainer.add(title);
    this.modalTexts.push(title);
    y += 40;

    // Quantidade
    const quantityText = this.add.text(width / 2, y, `Quantidade: ${this.modalQuantity}`, {
      fontSize: "18px",
      color: "#22c55e"
    }).setOrigin(0.5);
    this.modalContainer.add(quantityText);
    this.modalTexts.push(quantityText);
    y += 30;

    // Instruções
    const instructions = this.add.text(
      width / 2,
      y,
      "↑/↓: +1/-1  |  ←/→: +10/-10",
      {
        fontSize: "12px",
        color: "#94a3b8"
      }
    ).setOrigin(0.5);
    this.modalContainer.add(instructions);
    this.modalTexts.push(instructions);
    y += 40;

    // Separador
    const separator = this.add.text(width / 2, y, "─────────────────────────", {
      fontSize: "14px",
      color: "#475569"
    }).setOrigin(0.5);
    this.modalContainer.add(separator);
    this.modalTexts.push(separator);
    y += 30;

    // Ingredientes
    const ingredientsTitle = this.add.text(width / 2 - 200, y, "Ingredientes:", {
      fontSize: "16px",
      color: "#e5e7eb",
      fontStyle: "bold"
    }).setOrigin(0, 0.5);
    this.modalContainer.add(ingredientsTitle);
    this.modalTexts.push(ingredientsTitle);
    y += 25;

    for (const ing of recipe.ingredients) {
      const item = getItemById(ing.itemId);
      const owned =
        progress.inventory.find((e) => e.itemId === ing.itemId)?.quantity ?? 0;
      const needed = ing.quantity * this.modalQuantity;
      const remaining = owned - needed;
      const hasEnough = owned >= needed;

      const ingText = this.add.text(
        width / 2 - 180,
        y,
        `${item?.name ?? ing.itemId}:`,
        {
          fontSize: "14px",
          color: "#e5e7eb"
        }
      ).setOrigin(0, 0.5);
      this.modalContainer.add(ingText);
      this.modalTexts.push(ingText);

      const quantityInfo = this.add.text(
        width / 2 + 100,
        y,
        `${owned} → ${remaining >= 0 ? remaining : `-${Math.abs(remaining)}`} (${needed > 0 ? '-' : '+'}${needed})`,
        {
          fontSize: "14px",
          color: hasEnough ? "#22c55e" : "#ef4444"
        }
      ).setOrigin(0.5, 0.5);
      this.modalContainer.add(quantityInfo);
      this.modalTexts.push(quantityInfo);

      y += 22;
    }

    y += 20;

    // Separador
    const separator2 = this.add.text(width / 2, y, "─────────────────────────", {
      fontSize: "14px",
      color: "#475569"
    }).setOrigin(0.5);
    this.modalContainer.add(separator2);
    this.modalTexts.push(separator2);
    y += 30;

    // Resultado
    const resultTitle = this.add.text(width / 2 - 200, y, "Resultado:", {
      fontSize: "16px",
      color: "#e5e7eb",
      fontStyle: "bold"
    }).setOrigin(0, 0.5);
    this.modalContainer.add(resultTitle);
    this.modalTexts.push(resultTitle);
    y += 25;

    const currentResult = progress.inventory.find((e) => e.itemId === recipe.resultItemId)?.quantity ?? 0;
    const newResult = currentResult + (this.modalQuantity * 1); // resultQuantity sempre 1 por craft

    const resultText = this.add.text(
      width / 2 - 180,
      y,
      `${categoryConfig.symbol} ${resultItem?.name ?? recipe.resultItemId}:`,
      {
        fontSize: "14px",
        color: "#e5e7eb"
      }
    ).setOrigin(0, 0.5);
    this.modalContainer.add(resultText);
    this.modalTexts.push(resultText);

    const resultQuantityInfo = this.add.text(
      width / 2 + 100,
      y,
      `${currentResult} → ${newResult} (+${this.modalQuantity})`,
      {
        fontSize: "14px",
        color: "#22c55e"
      }
    ).setOrigin(0.5, 0.5);
    this.modalContainer.add(resultQuantityInfo);
    this.modalTexts.push(resultQuantityInfo);

    y += 40;

    // Botões
    const confirmText = this.add.text(
      width / 2 - 80,
      y,
      "[ENTER] Confirmar",
      {
        fontSize: "14px",
        color: "#22c55e",
        backgroundColor: "#064e3b",
        padding: { x: 10, y: 5 }
      }
    ).setOrigin(0.5);
    this.modalContainer.add(confirmText);
    this.modalTexts.push(confirmText);

    const cancelText = this.add.text(
      width / 2 + 80,
      y,
      "[ESC] Cancelar",
      {
        fontSize: "14px",
        color: "#ef4444",
        backgroundColor: "#7f1d1d",
        padding: { x: 10, y: 5 }
      }
    ).setOrigin(0.5);
    this.modalContainer.add(cancelText);
    this.modalTexts.push(cancelText);

    this.modalContainer.setVisible(true);
  }

  private async confirmCraft() {
    if (this.modalQuantity <= 0) return;

    const recipe = CRAFTING_RECIPES[this.recipeIndex];
    const progress = PlayerState.getProgress();

    // Validar novamente antes de executar
    for (const ing of recipe.ingredients) {
      const owned =
        progress.inventory.find((e) => e.itemId === ing.itemId)?.quantity ?? 0;
      const needed = ing.quantity * this.modalQuantity;
      if (owned < needed) {
        this.statusText.setText(
          `Faltam materiais. Necessário: ${needed} ${ing.itemId}, possui: ${owned}`
        );
        this.closeCraftModal();
        return;
      }
    }

    this.closeCraftModal();

    // Se quantidade é 1, usar função simples
    if (this.modalQuantity === 1) {
      await this.executeSingleCraft();
    } else {
      // Se quantidade > 1, usar batch
      await this.executeBatchCraft(this.modalQuantity);
    }
  }

  private async executeSingleCraft() {
    const recipe = CRAFTING_RECIPES[this.recipeIndex];
    const ingredients = recipe.ingredients.map(ing => ({
      itemId: ing.itemId,
      quantity: ing.quantity
    }));

    let teamSlotsIncrease: number | undefined;
    if (recipe.id === "recipe-upgrade-team-slot") {
      teamSlotsIncrease = 1;
    }

    this.statusText.setText("Executando crafting...");
    
    const result = await craftItemOnServer(
      recipe.id,
      ingredients,
      recipe.resultItemId,
      1,
      teamSlotsIncrease
    );

    if (!result.success) {
      this.statusText.setText(result.error || "Erro ao executar crafting.");
      return;
    }

    const item = getItemById(recipe.resultItemId);
    const itemKind = item?.kind ?? "consumable";
    const categoryConfig = CATEGORY_VISUALS[this.getCategoryKey(itemKind, recipe.resultItemId)];
    
    if (recipe.id === "recipe-upgrade-team-slot") {
      this.statusText.setText(
        "★ Upgrade aplicado: +1 slot de criatura na equipe da expedição!"
      );
    } else {
      this.statusText.setText(
        `${categoryConfig.symbol} Você craftou: ${item?.name ?? recipe.resultItemId}!`
      );
    }

    const currentIndex = this.recipeIndex;
    this.time.delayedCall(300, () => this.scene.restart({ preserveIndex: currentIndex }));
  }

  private async executeBatchCraft(quantity: number) {
    const recipe = CRAFTING_RECIPES[this.recipeIndex];
    const progress = PlayerState.getProgress();

    // Validar novamente
    for (const ing of recipe.ingredients) {
      const owned =
        progress.inventory.find((e) => e.itemId === ing.itemId)?.quantity ?? 0;
      const needed = ing.quantity * quantity;
      if (owned < needed) {
        this.statusText.setText(
          `Faltam materiais para craftar ${quantity}x. Necessário: ${needed} ${ing.itemId}, possui: ${owned}`
        );
        return;
      }
    }

    // Preparar crafts para batch
    const crafts = [];
    for (let i = 0; i < quantity; i++) {
      const ingredients = recipe.ingredients.map(ing => ({
        itemId: ing.itemId,
        quantity: ing.quantity
      }));

      let teamSlotsIncrease: number | undefined;
      if (recipe.id === "recipe-upgrade-team-slot") {
        if (i === 0) {
          teamSlotsIncrease = 1;
        } else {
          break; // Upgrade só pode ser feito uma vez
        }
      }

      crafts.push({
        recipeId: recipe.id,
        ingredients,
        resultItemId: recipe.resultItemId,
        resultQuantity: 1,
        teamSlotsIncrease
      });
    }

    this.statusText.setText(`Executando ${crafts.length}x crafting...`);
    
    const result = await craftItemsBatch(crafts);

    if (!result.success) {
      this.statusText.setText(result.error || "Erro ao executar batch crafting.");
      return;
    }

    const item = getItemById(recipe.resultItemId);
    const itemKind = item?.kind ?? "consumable";
    const categoryConfig = CATEGORY_VISUALS[this.getCategoryKey(itemKind, recipe.resultItemId)];
    
    if (recipe.id === "recipe-upgrade-team-slot") {
      this.statusText.setText(
        "★ Upgrade aplicado: +1 slot de criatura na equipe da expedição!"
      );
    } else {
      this.statusText.setText(
        `${categoryConfig.symbol} Você craftou ${crafts.length}x: ${item?.name ?? recipe.resultItemId}!`
      );
    }

    const currentIndex = this.recipeIndex;
    this.time.delayedCall(300, () => this.scene.restart({ preserveIndex: currentIndex }));
  }
}
