import Phaser from "phaser";

/**
 * Gerencia a UI de progresso de extração.
 */
export class ExtractionUI {
  private scene: Phaser.Scene;
  private extractionProgressBar!: Phaser.GameObjects.Rectangle;
  private extractionProgressBg!: Phaser.GameObjects.Rectangle;
  private viewportWidth: number;
  private viewportHeight: number;

  constructor(scene: Phaser.Scene, viewportWidth: number, viewportHeight: number) {
    this.scene = scene;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  /**
   * Cria a barra de progresso de extração (inicialmente invisível).
   */
  create(): void {
    this.extractionProgressBg = this.scene.add.rectangle(
      this.viewportWidth / 2,
      this.viewportHeight - 72,
      200,
      20,
      0x1e293b,
      0.9
    ).setOrigin(0.5).setVisible(false).setScrollFactor(0).setDepth(100);
    
    this.extractionProgressBar = this.scene.add.rectangle(
      this.viewportWidth / 2 - 100,
      this.viewportHeight - 72,
      0,
      16,
      0x3b82f6,
      1
    ).setOrigin(0, 0.5).setVisible(false).setScrollFactor(0).setDepth(101);
  }

  /**
   * Mostra a barra de progresso de extração.
   */
  show(): void {
    if (this.extractionProgressBg) this.extractionProgressBg.setVisible(true);
    if (this.extractionProgressBar) this.extractionProgressBar.setVisible(true);
  }

  /**
   * Esconde a barra de progresso de extração.
   */
  hide(): void {
    if (this.extractionProgressBg) this.extractionProgressBg.setVisible(false);
    if (this.extractionProgressBar) this.extractionProgressBar.setVisible(false);
  }

  /**
   * Atualiza o progresso da extração (0-100%).
   */
  update(progress: number, required: number): void {
    if (!this.extractionProgressBar) return;

    const progressPct = Math.min(100, Math.floor((progress / required) * 100));
    const barWidth = (196 * progressPct) / 100; // 200 - 4 (margens)

    this.extractionProgressBar.setSize(barWidth, 16);
  }
}
