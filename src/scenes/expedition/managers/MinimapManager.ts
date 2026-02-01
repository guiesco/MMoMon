import Phaser from "phaser";
import type { MapConfig } from "../../../game/maps";

/**
 * Gerencia o minimapa da expedição.
 * Mostra posição do jogador e ponto de extração.
 */
export class MinimapManager {
  private scene: Phaser.Scene;
  private minimapContainer!: Phaser.GameObjects.Container;
  private minimapPlayerDot!: Phaser.GameObjects.Arc;
  private minimapExtractionDot!: Phaser.GameObjects.Arc;
  private minimapBg!: Phaser.GameObjects.Rectangle;
  private minimapBorder!: Phaser.GameObjects.Rectangle;
  private readonly minimapWidth = 140;
  private readonly minimapHeight = 100;
  private mapConfig!: MapConfig;
  private extractionX: number = 0;
  private extractionY: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Cria o minimapa no canto inferior direito da tela.
   */
  create(
    viewportWidth: number,
    viewportHeight: number,
    worldWidth: number,
    worldHeight: number,
    extractionX: number,
    extractionY: number,
    mapConfig: MapConfig
  ): void {
    this.mapConfig = mapConfig;
    this.extractionX = extractionX;
    this.extractionY = extractionY;

    const padding = 12;
    const minimapX = viewportWidth - this.minimapWidth - padding;
    const minimapY = viewportHeight - this.minimapHeight - padding;

    // Fundo do minimapa com transparência
    this.minimapBg = this.scene.add
      .rectangle(minimapX, minimapY, this.minimapWidth, this.minimapHeight, 0x0f172a, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Borda do minimapa
    this.minimapBorder = this.scene.add
      .rectangle(minimapX, minimapY, this.minimapWidth, this.minimapHeight, 0x000000, 0)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x334155, 1)
      .setScrollFactor(0)
      .setDepth(101);

    // Label do minimapa
    this.scene.add
      .text(minimapX + this.minimapWidth / 2, minimapY - 6, "MAPA", {
        fontSize: "10px",
        color: "#64748b"
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(101);

    // Calcula posição da extração no minimapa
    const extractionMinimapX = minimapX + (extractionX / worldWidth) * this.minimapWidth;
    const extractionMinimapY = minimapY + (extractionY / worldHeight) * this.minimapHeight;

    // Ponto de extração (azul) - área destacada
    this.minimapExtractionDot = this.scene.add
      .circle(extractionMinimapX, extractionMinimapY, 8, 0x3b82f6, 0.7)
      .setScrollFactor(0)
      .setDepth(102);
    
    // Adiciona animação pulsante na extração
    this.scene.tweens.add({
      targets: this.minimapExtractionDot,
      scale: { from: 1, to: 1.3 },
      alpha: { from: 0.7, to: 0.4 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    // Label da extração no minimapa
    this.scene.add
      .text(extractionMinimapX, extractionMinimapY - 12, "EXT", {
        fontSize: "8px",
        color: "#60a5fa"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);

    // Ponto do jogador (verde) - será atualizado no update
    this.minimapPlayerDot = this.scene.add
      .circle(minimapX + this.minimapWidth / 2, minimapY + this.minimapHeight / 2, 4, 0x4ade80, 1)
      .setScrollFactor(0)
      .setDepth(103);
  }

  /**
   * Atualiza a posição do jogador no minimapa.
   */
  update(playerX: number, playerY: number): void {
    if (!this.minimapPlayerDot || !this.minimapBg) return;

    const worldWidth = this.mapConfig.world.worldWidth;
    const worldHeight = this.mapConfig.world.worldHeight;
    
    const minimapX = this.minimapBg.x;
    const minimapY = this.minimapBg.y;

    // Calcula posição do jogador no minimapa
    const playerMinimapX = minimapX + (playerX / worldWidth) * this.minimapWidth;
    const playerMinimapY = minimapY + (playerY / worldHeight) * this.minimapHeight;

    // Garante que o ponto do jogador fique dentro dos limites do minimapa
    const clampedX = Phaser.Math.Clamp(playerMinimapX, minimapX + 4, minimapX + this.minimapWidth - 4);
    const clampedY = Phaser.Math.Clamp(playerMinimapY, minimapY + 4, minimapY + this.minimapHeight - 4);

    this.minimapPlayerDot.setPosition(clampedX, clampedY);
  }

  /**
   * Destrói o minimapa.
   */
  destroy(): void {
    if (this.minimapPlayerDot) this.minimapPlayerDot.destroy();
    if (this.minimapExtractionDot) this.minimapExtractionDot.destroy();
    if (this.minimapBg) this.minimapBg.destroy();
    if (this.minimapBorder) this.minimapBorder.destroy();
    if (this.minimapContainer) this.minimapContainer.destroy();
  }
}
