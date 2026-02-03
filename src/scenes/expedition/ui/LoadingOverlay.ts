import Phaser from "phaser";

/**
 * Componente reutilizável para exibir telas de loading durante operações assíncronas.
 * Usado para requisições Firebase, conexões de servidor, etc.
 */
export class LoadingOverlay {
  private scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.Rectangle | null = null;
  private spinner: Phaser.GameObjects.Container | null = null;
  private text: Phaser.GameObjects.Text | null = null;
  private isVisible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Exibe overlay de loading com mensagem personalizada.
   * @param message Mensagem a ser exibida (padrão: "Carregando...")
   */
  show(message: string = "Carregando..."): void {
    if (this.isVisible) {
      // Se já está visível, apenas atualiza a mensagem
      if (this.text) {
        this.text.setText(message);
      }
      return;
    }

    const { width, height } = this.scene.scale;

    // Overlay escuro semi-transparente
    this.overlay = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10000)
      .setInteractive();

    // Container para spinner
    this.spinner = this.scene.add.container(width / 2, height / 2 - 30);
    this.spinner.setScrollFactor(0);
    this.spinner.setDepth(10001);

    // Criar spinner animado (círculo rotacionando)
    const spinnerCircle = this.scene.add.circle(0, 0, 20, 0x3b82f6, 1);
    spinnerCircle.setStrokeStyle(3, 0x60a5fa, 1);
    
    // Adicionar círculo menor para efeito de rotação
    const spinnerDot = this.scene.add.circle(15, 0, 4, 0xffffff, 1);
    
    this.spinner.add([spinnerCircle, spinnerDot]);

    // Animação de rotação
    this.scene.tweens.add({
      targets: this.spinner,
      angle: 360,
      duration: 1000,
      repeat: -1,
      ease: "Linear"
    });

    // Texto de mensagem
    this.text = this.scene.add
      .text(width / 2, height / 2 + 30, message, {
        fontSize: "18px",
        color: "#e5e7eb",
        align: "center"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10001);

    this.isVisible = true;
  }

  /**
   * Atualiza a mensagem do loading sem recriar o overlay.
   */
  updateMessage(message: string): void {
    if (this.text) {
      this.text.setText(message);
    }
  }

  /**
   * Remove overlay de loading.
   */
  hide(): void {
    if (!this.isVisible) return;

    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }

    if (this.spinner) {
      // Parar animação antes de destruir
      this.scene.tweens.killTweensOf(this.spinner);
      this.spinner.destroy();
      this.spinner = null;
    }

    if (this.text) {
      this.text.destroy();
      this.text = null;
    }

    this.isVisible = false;
  }

  /**
   * Verifica se o overlay está visível.
   */
  get visible(): boolean {
    return this.isVisible;
  }
}
