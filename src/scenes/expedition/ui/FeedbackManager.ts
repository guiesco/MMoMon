import Phaser from "phaser";
import { getItemById } from "../../../game/items";
import { getResourcePickupColors } from "../../../game/itemVisuals";

/**
 * Gerencia feedback visual durante a expedição.
 * Responsável por criar textos flutuantes, efeitos de coleta, captura, etc.
 */
export class FeedbackManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Cria texto flutuante simples.
   */
  createFloatingText(x: number, y: number, text: string, color: number): void {
    const textObj = this.scene.add.text(x, y, text, {
      fontSize: "16px",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#000000",
      strokeThickness: 2
    }).setOrigin(0.5);
    
    this.scene.tweens.add({
      targets: textObj,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      onComplete: () => textObj.destroy()
    });
  }

  /**
   * Versão melhorada de createFloatingText com tamanho e duração customizáveis.
   */
  createEnhancedFloatingText(
    x: number, 
    y: number, 
    text: string, 
    color: number, 
    fontSize: number = 20,
    duration: number = 1500
  ): void {
    const textObj = this.scene.add.text(x, y, text, {
      fontSize: `${fontSize}px`,
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#000000",
      strokeThickness: 3,
      fontStyle: "bold"
    }).setOrigin(0.5);
    
    // Animação com bounce
    this.scene.tweens.add({
      targets: textObj,
      y: y - 60,
      alpha: 0,
      scale: 1.2,
      duration: duration,
      ease: "Back.easeOut",
      onComplete: () => textObj.destroy()
    });
  }

  /**
   * Cria feedback visual de coleta de recurso.
   */
  createCollectionFeedback(x: number, y: number, itemId: string): void {
    // Obtém cores do sistema de identidade visual
    const item = getItemById(itemId);
    const pickupColors = getResourcePickupColors(
      itemId,
      item?.tier ?? "Básico"
    );

    // Partículas simples (círculos pequenos) com cor do item
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5;
      const particle = this.scene.add.circle(x, y, 3, pickupColors.color, 1);
      const distance = 20;
      const duration = 400;
      
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: duration,
        onComplete: () => particle.destroy()
      });
    }
    
    // Texto flutuante com nome do recurso coletado, usando cor do item
    const label = item?.name ?? "+1 Recurso";
    this.createFloatingText(x, y - 15, `+1 ${label}`, pickupColors.color);
  }

  /**
   * Cria feedback visual de captura bem-sucedida.
   */
  createCaptureSuccessFeedback(x: number, y: number): void {
    // Círculo expansivo
    const circle = this.scene.add.circle(x, y, 0, 0x10b981, 0.5);
    this.scene.tweens.add({
      targets: circle,
      radius: 40,
      alpha: 0,
      duration: 500,
      onComplete: () => circle.destroy()
    });
    
    // Partículas verdes
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const particle = this.scene.add.circle(x, y, 4, 0x10b981, 1);
      const distance = 30;
      
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 400,
        onComplete: () => particle.destroy()
      });
    }
  }

  /**
   * Cria feedback visual de captura falhada.
   */
  createCaptureFailFeedback(x: number, y: number): void {
    // Círculo vermelho pulsante
    const circle = this.scene.add.circle(x, y, 15, 0xef4444, 0.6);
    this.scene.tweens.add({
      targets: circle,
      radius: 25,
      alpha: 0,
      duration: 300,
      onComplete: () => circle.destroy()
    });
  }

  /**
   * Cria feedback visual de extração bem-sucedida.
   */
  createExtractionSuccessFeedback(): void {
    const { width, height } = this.scene.scale;
    
    // Círculo grande no centro (fixo na tela)
    const circle = this.scene.add.circle(width / 2, height / 2, 0, 0x3b82f6, 0.3)
      .setScrollFactor(0)
      .setDepth(1000);
    this.scene.tweens.add({
      targets: circle,
      radius: Math.max(width, height),
      alpha: 0,
      duration: 1000,
      onComplete: () => circle.destroy()
    });
    
    // Texto de sucesso (fixo na tela)
    const successText = this.scene.add.text(width / 2, height / 2, "EXTRAÇÃO CONCLUÍDA!", {
      fontSize: "32px",
      color: "#3b82f6",
      stroke: "#ffffff",
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setScrollFactor(0).setDepth(1001);
    
    this.scene.tweens.add({
      targets: successText,
      alpha: 1,
      scale: 1.2,
      duration: 500,
      yoyo: true,
      repeat: 1
    });
  }

  /**
   * Cria feedback visual de cura.
   */
  createHealFeedback(x: number, y: number): void {
    // Partículas verdes subindo
    for (let i = 0; i < 8; i++) {
      const offsetX = (Math.random() - 0.5) * 30;
      const particle = this.scene.add.circle(x + offsetX, y, 4, 0x22c55e, 0.8);
      
      this.scene.tweens.add({
        targets: particle,
        y: y - 40 - Math.random() * 20,
        alpha: 0,
        scale: 0.5,
        duration: 600 + Math.random() * 200,
        onComplete: () => particle.destroy()
      });
    }

    // Círculo de cura expansivo
    const circle = this.scene.add.circle(x, y, 0, 0x22c55e, 0.3);
    this.scene.tweens.add({
      targets: circle,
      radius: 30,
      alpha: 0,
      duration: 400,
      onComplete: () => circle.destroy()
    });
  }
}
