import Phaser from "phaser";
import { PlayerState as LocalPlayerState } from "../../../game/playerState";
import { getItemById } from "../../../game/items";
import type { ExpeditionState } from "../types/ExpeditionTypes";

/**
 * Gerencia o HUD principal da expedição.
 * Exibe informações sobre tempo, recursos, criaturas capturadas, etc.
 */
export class HUDManager {
  private scene: Phaser.Scene;
  private hudText!: Phaser.GameObjects.Text;
  private timeWarningIndicator!: Phaser.GameObjects.Rectangle;
  private viewportWidth: number;
  private viewportHeight: number;

  constructor(scene: Phaser.Scene, viewportWidth: number, viewportHeight: number) {
    this.scene = scene;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  /**
   * Cria o HUD principal.
   */
  create(): void {
    const hudBg = this.scene.add
      .rectangle(12, 12, 280, 90, 0x020617, 0.8)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x1f2937, 0.9)
      .setScrollFactor(0)
      .setDepth(100);

    this.hudText = this.scene.add.text(hudBg.x + 10, hudBg.y + 8, "", {
      fontSize: "12px",
      color: "#e5e7eb",
      lineSpacing: 3
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(101);

    // Painel de instruções no canto inferior esquerdo (pequeno, semi-transparente)
    const controlsY = this.viewportHeight - 80;
    this.scene.add
      .rectangle(12, controlsY, 260, 68, 0x020617, 0.6)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x1f2937, 0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.scene.add.text(22, controlsY + 8, 
      "WASD/Setas: mover | ESPAÇO: atacar | H: poção\nQ: capturar | F: habilidade | E: extrair\n1-2-3: trocar criatura | F1: debug", 
      {
        fontSize: "10px",
        color: "#9ca3af",
        lineSpacing: 4
      }
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(101);

    // Indicador de tempo restante (barra no topo, como "timeline" da expedição)
    this.timeWarningIndicator = this.scene.add.rectangle(
      this.viewportWidth / 2,
      8,
      this.viewportWidth,
      4,
      0x10b981,
      1
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
  }

  /**
   * Atualiza o HUD com informações atuais.
   */
  update(
    state: ExpeditionState,
    expeditionTime: number,
    expeditionDuration: number,
    creaturesCaptured: number,
    expeditionResources: Map<string, number>,
    extractionProgress: number,
    extractionRequired: number,
    endSceneTimer: number,
    endSceneDelay: number,
    dangerLowHpThreshold: number,
    activeCreatureHp: number,
    activeCreatureMaxHp: number,
    damageTakenRecently: number,
    expeditionInventory?: Map<string, number> // Inventário de expedição atual (opcional)
  ): void {
    const timeLeft = Math.max(0, Math.floor(expeditionDuration - expeditionTime));

    let status = "";
    let statusColor = "#e5e7eb";
    switch (state) {
      case "exploring":
        status = "Explorando";
        statusColor = "#10b981";
        break;
      case "combat":
        status = "Em combate";
        statusColor = "#ef4444";
        break;
      case "capturing":
        status = "Tentando captura...";
        statusColor = "#facc15";
        break;
      case "extracting":
        status = "Extraindo...";
        statusColor = "#3b82f6";
        break;
      case "extracted":
        status = "Extração bem-sucedida!";
        statusColor = "#10b981";
        break;
      case "failed":
        status = "Falha na expedição (tempo esgotado)";
        statusColor = "#ef4444";
        break;
    }

    const extractionPct =
      state === "extracting"
        ? Math.min(100, Math.floor((extractionProgress / extractionRequired) * 100))
        : 0;

    // Usar inventário de expedição se fornecido, senão usar preparedExpeditionInventory
    let basicBalls = 0;
    let preciseBalls = 0;
    let ultraBalls = 0;
    let otherItems: string[] = [];
    
    if (expeditionInventory) {
      // Usar inventário de expedição atual (atualizado durante a expedição)
      basicBalls = expeditionInventory.get("poke-ball-basic") ?? 0;
      preciseBalls = expeditionInventory.get("poke-ball-precisa") ?? 0;
      ultraBalls = expeditionInventory.get("poke-ball-ultra") ?? 0;
      
      // Coletar outros itens do inventário de expedição (poções, consumíveis, etc.)
      for (const [itemId, quantity] of expeditionInventory.entries()) {
        // Pular pokébolas (já mostradas separadamente)
        if (itemId.startsWith("poke-ball-")) continue;
        if (quantity <= 0) continue;
        
        const itemDef = getItemById(itemId);
        if (itemDef) {
          otherItems.push(`${itemDef.name}: x${quantity}`);
        } else {
          // Fallback: usar itemId se não encontrar definição
          otherItems.push(`${itemId}: x${quantity}`);
        }
      }
    } else {
      // Fallback: usar preparedExpeditionInventory (estático)
      const progress = LocalPlayerState.getProgress();
      const preparedInventory = progress.preparedExpeditionInventory || [];
      basicBalls = preparedInventory.find((e) => e.itemId === "poke-ball-basic")?.quantity ?? 0;
      preciseBalls = preparedInventory.find((e) => e.itemId === "poke-ball-precisa")?.quantity ?? 0;
      ultraBalls = preparedInventory.find((e) => e.itemId === "poke-ball-ultra")?.quantity ?? 0;
      
      // Coletar outros itens do preparedExpeditionInventory
      for (const entry of preparedInventory) {
        if (entry.itemId.startsWith("poke-ball-")) continue;
        if (entry.quantity <= 0) continue;
        
        const itemDef = getItemById(entry.itemId);
        if (itemDef) {
          otherItems.push(`${itemDef.name}: x${entry.quantity}`);
        } else {
          otherItems.push(`${entry.itemId}: x${entry.quantity}`);
        }
      }
    }
    
    const otherItemsLine = otherItems.length > 0 
      ? otherItems.join(" | ")
      : "";

    const hpRatio =
      activeCreatureMaxHp > 0 ? activeCreatureHp / activeCreatureMaxHp : 1;
    const lowHp = hpRatio <= dangerLowHpThreshold;
    const tookRecentDamage = damageTakenRecently > 0;

    const dangerMessages: string[] = [];
    if (lowHp && state !== "failed") {
      dangerMessages.push("HP CRÍTICO! Procure extrair ou evitar combate.");
    }
    if (tookRecentDamage && !lowHp && state !== "failed") {
      dangerMessages.push("Você está sob fogo inimigo – recalcule sua rota.");
    }

    // Resumo compacto de recursos coletados durante a expedição (da mochila)
    // Usar expeditionInventory se fornecido, senão usar expeditionResources como fallback
    const expeditionResourceSummary: string[] = [];
    const resourcesToShow = expeditionInventory || new Map<string, number>();
    
    for (const [itemId, qty] of resourcesToShow.entries()) {
      // Pular pokébolas e outros itens que não são recursos
      if (itemId.startsWith("poke-ball-")) continue;
      if (itemId.startsWith("potion-")) continue;
      if (qty <= 0) continue;
      
      // Verificar se é um recurso (começa com "resource-")
      if (itemId.startsWith("resource-")) {
        const itemDef = getItemById(itemId);
        if (itemDef) {
          expeditionResourceSummary.push(`${itemDef.name}: x${qty}`);
        } else {
          expeditionResourceSummary.push(`${itemId}: x${qty}`);
        }
      }
    }
    
    // Se não houver recursos na mochila, usar expeditionResources como fallback
    if (expeditionResourceSummary.length === 0) {
      for (const [itemId, qty] of expeditionResources.entries()) {
        if (qty <= 0) continue;
        const itemDef = getItemById(itemId);
        if (itemDef) {
          expeditionResourceSummary.push(`${itemDef.name}: x${qty}`);
        }
      }
    }
    
    const resourcesLine =
      expeditionResourceSummary.length > 0
        ? expeditionResourceSummary.join(" | ")
        : "Nenhum recurso coletado ainda";

    // HUD compacto - apenas informações essenciais
    const extractionStatus = state === "extracting"
      ? `Extraindo: ${extractionPct}%`
      : state === "extracted"
        ? "✓ EXTRAÍDO"
        : "";

    const hudLines = [
      `${status} | ⏱ ${timeLeft}s | 🎯 ${creaturesCaptured} capturas`,
      `Pokébolas: ${basicBalls}/${preciseBalls}/${ultraBalls}`,
      ...(otherItemsLine ? [`Itens: ${otherItemsLine.length > 50 ? otherItemsLine.slice(0, 47) + "..." : otherItemsLine}`] : []),
      `Recursos: ${resourcesLine.length > 40 ? resourcesLine.slice(0, 37) + "..." : resourcesLine}`,
      extractionStatus,
      ...dangerMessages.slice(0, 2) // Limita mensagens de perigo
    ].filter(line => line !== "");

    // Adiciona mensagem de retorno se a expedição terminou
    if (state === "extracted" || state === "failed") {
      const returnTime = Math.max(0, endSceneDelay - endSceneTimer);
      hudLines.push(`Retornando em ${Math.ceil(returnTime)}s...`);
    }

    this.hudText.setText(hudLines.join("\n"));
    
    // Atualiza cor do texto baseado no estado
    if (state === "failed" || state === "extracted") {
      this.hudText.setColor(statusColor);
    } else {
      this.hudText.setColor("#e5e7eb");
    }

    // Atualiza indicador de tempo (barra no topo)
    this.updateTimeWarningIndicator(expeditionTime, expeditionDuration);
  }

  /**
   * Atualiza o indicador de tempo restante (barra no topo).
   */
  private updateTimeWarningIndicator(expeditionTime: number, expeditionDuration: number): void {
    if (!this.timeWarningIndicator) return;

    const timeRatio = expeditionTime / expeditionDuration;
    const remainingRatio = 1 - timeRatio;
    const currentWidth = this.viewportWidth * remainingRatio;

    this.timeWarningIndicator.setSize(currentWidth, 4);

    // Muda cor baseado no tempo restante
    if (timeRatio >= 0.9) {
      this.timeWarningIndicator.setFillStyle(0xef4444); // Vermelho (crítico)
    } else if (timeRatio >= 0.7) {
      this.timeWarningIndicator.setFillStyle(0xf59e0b); // Laranja (atenção)
    } else {
      this.timeWarningIndicator.setFillStyle(0x10b981); // Verde (normal)
    }
  }
}
