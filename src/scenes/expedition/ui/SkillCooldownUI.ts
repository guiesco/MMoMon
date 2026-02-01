import Phaser from "phaser";

/**
 * Gerencia a UI de cooldown de habilidades especiais.
 */
export class SkillCooldownUI {
  private scene: Phaser.Scene;
  private skillCooldownBarBg!: Phaser.GameObjects.Rectangle;
  private skillCooldownBarFill!: Phaser.GameObjects.Rectangle;
  private skillCooldownText!: Phaser.GameObjects.Text;
  private viewportWidth: number;
  private viewportHeight: number;

  constructor(scene: Phaser.Scene, viewportWidth: number, viewportHeight: number) {
    this.scene = scene;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  /**
   * Cria a barra de cooldown da skill.
   */
  create(): void {
    const skillBarX = this.viewportWidth - 160;
    const skillBarY = this.viewportHeight - 130;
    const skillBarWidth = 140;
    const skillBarHeight = 20;

    this.skillCooldownBarBg = this.scene.add
      .rectangle(skillBarX, skillBarY, skillBarWidth, skillBarHeight, 0x1f2937, 0.85)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x374151, 1)
      .setScrollFactor(0)
      .setDepth(100);

    this.skillCooldownBarFill = this.scene.add
      .rectangle(skillBarX + 2, skillBarY, 0, skillBarHeight - 4, 0x8b5cf6, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101);

    this.skillCooldownText = this.scene.add
      .text(skillBarX + skillBarWidth / 2, skillBarY, "F: Skill", {
        fontSize: "11px",
        color: "#e5e7eb",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(102);
  }

  /**
   * Atualiza a barra de cooldown.
   */
  update(
    specialSkillCooldown: number,
    specialSkillCooldownTime: number,
    activeSpecialSkillKind: string | null,
    activeSpecialSkillName: string
  ): void {
    if (!this.skillCooldownBarFill || !this.skillCooldownText) return;

    const maxWidth = 136; // skillBarWidth - 4

    if (specialSkillCooldownTime <= 0 || !activeSpecialSkillKind) {
      // Sem skill disponível
      this.skillCooldownBarFill.setSize(0, 16);
      this.skillCooldownText.setText("Sem skill");
      this.skillCooldownText.setColor("#6b7280");
      return;
    }

    if (specialSkillCooldown <= 0) {
      // Skill pronta
      this.skillCooldownBarFill.setSize(maxWidth, 16);
      this.skillCooldownBarFill.setFillStyle(0x22c55e); // Verde
      this.skillCooldownText.setText(`F: ${activeSpecialSkillName}`);
      this.skillCooldownText.setColor("#ffffff");
    } else {
      // Em cooldown
      const ratio = 1 - (specialSkillCooldown / specialSkillCooldownTime);
      const fillWidth = maxWidth * ratio;
      this.skillCooldownBarFill.setSize(fillWidth, 16);
      this.skillCooldownBarFill.setFillStyle(0x8b5cf6); // Roxo
      const seconds = Math.ceil(specialSkillCooldown);
      this.skillCooldownText.setText(`${activeSpecialSkillName} (${seconds}s)`);
      this.skillCooldownText.setColor("#d1d5db");
    }
  }
}
