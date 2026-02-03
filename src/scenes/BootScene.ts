import Phaser from "phaser";
import {
  initializeFirebaseClient,
  isFirebaseClientAvailable,
  getCurrentUser,
  onAuthChange
} from "../services/firebaseClient";

export class BootScene extends Phaser.Scene {
  private authCheckTimeout?: number;

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

    // Verificar autenticação antes de redirecionar
    this.checkAuthenticationAndRedirect();
  }

  /**
   * Verifica se o usuário está autenticado e redireciona adequadamente
   */
  private checkAuthenticationAndRedirect(): void {
    // Inicializar Firebase se ainda não estiver inicializado
    if (!isFirebaseClientAvailable()) {
      const initialized = initializeFirebaseClient();
      if (!initialized) {
        console.log("[BootScene] Firebase não disponível, indo para AuthScene");
        this.setupKeyboardRedirect("AuthScene");
        return;
      }
    }

    // Verificar se já há usuário autenticado imediatamente
    const currentUser = getCurrentUser();
    if (currentUser) {
      console.log("[BootScene] ✅ Usuário autenticado, indo para BaseHubScene");
      this.redirectToBaseHub();
      return;
    }

    // Se não há usuário imediatamente, aguardar estado de autenticação com timeout
    console.log("[BootScene] ⏳ Aguardando verificação de autenticação...");
    
    let authResolved = false;

    // Timeout de 2 segundos
    this.authCheckTimeout = window.setTimeout(() => {
      if (!authResolved) {
        authResolved = true;
        this.cleanup();
        console.log("[BootScene] ⏱️  Timeout na verificação, indo para AuthScene");
        this.setupKeyboardRedirect("AuthScene");
      }
    }, 2000);

    // Escutar mudanças no estado de autenticação
    onAuthChange((user) => {
      if (authResolved) return;

      authResolved = true;
      this.cleanup();

      if (user) {
        console.log("[BootScene] ✅ Usuário autenticado, indo para BaseHubScene");
        this.redirectToBaseHub();
      } else {
        console.log("[BootScene] ⚠️  Usuário não autenticado, indo para AuthScene");
        this.setupKeyboardRedirect("AuthScene");
      }
    });
  }

  /**
   * Redireciona para BaseHubScene após pequeno delay para garantir inicialização
   */
  private redirectToBaseHub(): void {
    // Aguardar 150ms para garantir que PlayerState inicializou
    this.time.delayedCall(150, () => {
      this.scene.start("BaseHubScene");
    });
  }

  /**
   * Configura redirecionamento via teclado para a cena especificada
   */
  private setupKeyboardRedirect(sceneName: string): void {
    this.input.keyboard?.once("keydown", () => {
      this.scene.start(sceneName);
    });
  }

  /**
   * Limpa timeouts e listeners
   */
  private cleanup(): void {
    if (this.authCheckTimeout !== undefined) {
      clearTimeout(this.authCheckTimeout);
      this.authCheckTimeout = undefined;
    }
  }

  /**
   * Cleanup ao destruir a cena
   */
  destroy(): void {
    this.cleanup();
    super.destroy();
  }
}

