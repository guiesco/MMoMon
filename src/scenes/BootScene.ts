import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2 - 20, "PokéExtract: Wild Expedition", {
        fontSize: "26px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height / 2 + 24,
        "Pressione qualquer tecla para continuar",
        {
          fontSize: "16px",
          color: "#9ca3af"
        }
      )
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown", () => {
      this.scene.start("AuthScene");
    });
  }
}

