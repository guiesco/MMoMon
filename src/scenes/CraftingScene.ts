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

export class CraftingScene extends Phaser.Scene {
  private recipeIndex = 0;
  private recipeTexts: Phaser.GameObjects.Text[] = [];
  private recipeBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private statusText!: Phaser.GameObjects.Text;

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

    this.input.keyboard?.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.tryCraft());
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

  private tryCraft() {
    const recipe = CRAFTING_RECIPES[this.recipeIndex];
    const progress = PlayerState.getProgress();

    // Verificar se possui todos ingredientes
    for (const ing of recipe.ingredients) {
      const owned =
        progress.inventory.find((e) => e.itemId === ing.itemId)?.quantity ?? 0;
      if (owned < ing.quantity) {
        this.statusText.setText("Faltam materiais para craftar essa receita.");
        return;
      }
    }

    // Consumir ingredientes
    for (const ing of recipe.ingredients) {
      PlayerState.consumeItem(ing.itemId, ing.quantity);
    }

    // Alguns crafts aplicam upgrades diretos de base em vez de gerar item utilizável
    if (recipe.id === "recipe-upgrade-team-slot") {
      PlayerState.increaseTeamSlots(1);
      this.statusText.setText(
        "★ Upgrade aplicado: +1 slot de criatura na equipe da expedição!"
      );
      // Recarrega a cena para atualizar visualmente slots/e inventário, preservando índice
      const currentIndex = this.recipeIndex;
      this.time.delayedCall(300, () => this.scene.restart({ preserveIndex: currentIndex }));
      return;
    }

    // Adicionar item final ao inventário
    PlayerState.addItem(recipe.resultItemId, 1);
    const item = getItemById(recipe.resultItemId);
    const itemKind = item?.kind ?? "consumable";
    const categoryConfig = CATEGORY_VISUALS[this.getCategoryKey(itemKind, recipe.resultItemId)];
    
    this.statusText.setText(
      `${categoryConfig.symbol} Você craftou: ${item?.name ?? recipe.resultItemId}!`
    );

    // Recarrega a cena após breve delay para atualizar quantidades e cores, preservando índice
    const currentIndex = this.recipeIndex;
    this.time.delayedCall(300, () => this.scene.restart({ preserveIndex: currentIndex }));
  }
}
