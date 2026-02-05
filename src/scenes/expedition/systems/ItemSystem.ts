import { PlayerState as LocalPlayerState } from "../../../game/playerState";
import type { FeedbackManager } from "../ui/FeedbackManager";

/**
 * Gerencia o uso de itens durante a expedição.
 */
export class ItemSystem {
  private feedbackManager: FeedbackManager;
  private healCreature: (amount: number) => void;
  private activeCreatureHp: number;
  private activeCreatureMaxHp: number;
  private updateCreatureHp: ((instanceId: string, hp: number) => void) | null = null;
  private activeCreatureInstanceId: string | null = null;

  constructor(
    feedbackManager: FeedbackManager,
    healCreature: (amount: number) => void,
    activeCreatureHp: number,
    activeCreatureMaxHp: number
  ) {
    this.feedbackManager = feedbackManager;
    this.healCreature = healCreature;
    this.activeCreatureHp = activeCreatureHp;
    this.activeCreatureMaxHp = activeCreatureMaxHp;
  }

  /**
   * Tenta usar uma poção do inventário para curar a criatura ativa.
   */
  tryUsePotion(playerX: number, playerY: number): boolean {
    // Lista de poções em ordem de prioridade (básica primeiro)
    const potionPriority = ["potion-basic"];
    const progress = LocalPlayerState.getProgress();

    // Verifica se a criatura precisa de cura
    if (this.activeCreatureHp >= this.activeCreatureMaxHp) {
      this.feedbackManager.createFloatingText(
        playerX,
        playerY - 30,
        "HP já está cheio!",
        0x22c55e
      );
      return false;
    }

    // Encontra a primeira poção disponível
    const availablePotion = potionPriority.find(
      (potionId) => (progress.inventory.find((e) => e.itemId === potionId)?.quantity ?? 0) > 0
    );

    if (!availablePotion) {
      this.feedbackManager.createFloatingText(
        playerX,
        playerY - 30,
        "Sem poções!",
        0xef4444
      );
      return false;
    }

    // Consome a poção
    if (!LocalPlayerState.consumeItem(availablePotion, 1)) return false;

    // Calcula a cura baseada no tipo de poção
    const healAmounts: Record<string, number> = {
      "potion-basic": 30
    };
    const healAmount = healAmounts[availablePotion] ?? 25;
    
    // Aplica a cura
    const oldHp = this.activeCreatureHp;
    this.activeCreatureHp = Math.min(
      this.activeCreatureMaxHp,
      this.activeCreatureHp + healAmount
    );
    const actualHeal = this.activeCreatureHp - oldHp;

    // Atualiza o HP salvo da criatura ativa
    if (this.activeCreatureInstanceId && this.updateCreatureHp) {
      this.updateCreatureHp(this.activeCreatureInstanceId, this.activeCreatureHp);
    }

    // Feedback visual
    this.feedbackManager.createHealFeedback(playerX, playerY);
    this.feedbackManager.createFloatingText(
      playerX,
      playerY - 30,
      `+${actualHeal} HP`,
      0x22c55e
    );

    console.log("[ItemSystem] Usou", availablePotion, "| Curou", actualHeal, "HP");
    return true;
  }

  /**
   * Atualiza referências de HP da criatura ativa.
   */
  updateActiveCreatureHp(hp: number, maxHp: number): void {
    this.activeCreatureHp = hp;
    this.activeCreatureMaxHp = maxHp;
  }

  /**
   * Define callback para atualizar HP no estado persistente.
   */
  setUpdateCreatureHp(callback: (instanceId: string, hp: number) => void): void {
    this.updateCreatureHp = callback;
  }

  /**
   * Define o ID da criatura ativa.
   */
  setActiveCreatureInstanceId(instanceId: string | null): void {
    this.activeCreatureInstanceId = instanceId;
  }
}
