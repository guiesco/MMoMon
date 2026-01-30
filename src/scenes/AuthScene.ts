import Phaser from "phaser";
import { PlayerState } from "../game/playerState";
import {
  isFirebaseClientAvailable,
  signInWithEmail,
  createAccount,
  signInAnonymous,
  getCurrentUser
} from "../services/firebaseClient";

type AuthMode = "anonymous" | "login" | "register";

export class AuthScene extends Phaser.Scene {
  private nameInputElement?: HTMLInputElement;
  private emailInputElement?: HTMLInputElement;
  private passwordInputElement?: HTMLInputElement;
  private enterButtonElement?: HTMLButtonElement;
  private containerDiv?: HTMLDivElement;
  private authMode: AuthMode = "anonymous";
  private modeToggleText?: Phaser.GameObjects.Text;
  private errorText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super("AuthScene");
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 140, "PokéExtract: Wild Expedition", {
        fontSize: "26px",
        color: "#e5e7eb"
      })
      .setOrigin(0.5);

    // Texto de instrução dinâmico
    this.statusText = this.add
      .text(
        width / 2,
        height / 2 - 90,
        this.getInstructionText(),
        {
          fontSize: "16px",
          color: "#9ca3af",
          align: "center"
        }
      )
      .setOrigin(0.5);

    // Texto de erro (inicialmente oculto)
    this.errorText = this.add
      .text(
        width / 2,
        height / 2 + 120,
        "",
        {
          fontSize: "14px",
          color: "#ef4444",
          align: "center"
        }
      )
      .setOrigin(0.5);

    // Toggle de modo de autenticação
    const firebaseAvailable = isFirebaseClientAvailable();
    if (firebaseAvailable) {
      this.modeToggleText = this.add
        .text(
          width / 2,
          height / 2 + 150,
          this.getModeToggleText(),
          {
            fontSize: "14px",
            color: "#3b82f6",
            align: "center"
          }
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.toggleAuthMode());
    }

    this.createHtmlForm();
  }

  private getInstructionText(): string {
    switch (this.authMode) {
      case "anonymous":
        return "Escolha um nome de treinador para começar sua aventura.\n(Modo visitante - progresso local)";
      case "login":
        return "Entre com sua conta para sincronizar seu progresso.";
      case "register":
        return "Crie uma conta para salvar seu progresso na nuvem.";
    }
  }

  private getModeToggleText(): string {
    switch (this.authMode) {
      case "anonymous":
        return "Já tem uma conta? Clique aqui para entrar\nOu crie uma conta nova";
      case "login":
        return "Não tem conta? Clique para criar\nOu entre como visitante";
      case "register":
        return "Já tem conta? Clique para entrar\nOu entre como visitante";
    }
  }

  private toggleAuthMode(): void {
    // Ciclo: anonymous → login → register → anonymous
    switch (this.authMode) {
      case "anonymous":
        this.authMode = "login";
        break;
      case "login":
        this.authMode = "register";
        break;
      case "register":
        this.authMode = "anonymous";
        break;
    }

    // Atualizar textos
    this.statusText?.setText(this.getInstructionText());
    this.modeToggleText?.setText(this.getModeToggleText());
    this.errorText?.setText("");

    // Recriar formulário
    this.cleanupHtmlForm();
    this.createHtmlForm();
  }

  private createHtmlForm() {
    const gameContainer = document.getElementById("game-container");
    if (!gameContainer) return;

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "50%";
    container.style.left = "50%";
    container.style.transform = "translate(-50%, -50%)";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "8px";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";

    // Campos de entrada baseados no modo
    if (this.authMode === "login" || this.authMode === "register") {
      // Email
      const emailInput = document.createElement("input");
      emailInput.type = "email";
      emailInput.placeholder = "Email";
      emailInput.style.padding = "8px 12px";
      emailInput.style.borderRadius = "6px";
      emailInput.style.border = "1px solid #4b5563";
      emailInput.style.backgroundColor = "#020617";
      emailInput.style.color = "#e5e7eb";
      emailInput.style.width = "250px";
      container.appendChild(emailInput);
      this.emailInputElement = emailInput;

      // Senha
      const passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.placeholder = "Senha";
      passwordInput.style.padding = "8px 12px";
      passwordInput.style.borderRadius = "6px";
      passwordInput.style.border = "1px solid #4b5563";
      passwordInput.style.backgroundColor = "#020617";
      passwordInput.style.color = "#e5e7eb";
      passwordInput.style.width = "250px";
      container.appendChild(passwordInput);
      this.passwordInputElement = passwordInput;
    }

    // Nome do treinador (sempre visível)
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Nome do treinador";
    nameInput.maxLength = 20;
    nameInput.style.padding = "8px 12px";
    nameInput.style.borderRadius = "6px";
    nameInput.style.border = "1px solid #4b5563";
    nameInput.style.backgroundColor = "#020617";
    nameInput.style.color = "#e5e7eb";
    nameInput.style.width = "250px";
    container.appendChild(nameInput);
    this.nameInputElement = nameInput;

    // Botão
    const button = document.createElement("button");
    button.textContent = this.getButtonText();
    button.style.padding = "8px 16px";
    button.style.borderRadius = "6px";
    button.style.border = "none";
    button.style.backgroundColor = "#22c55e";
    button.style.color = "#020617";
    button.style.fontWeight = "600";
    button.style.cursor = "pointer";
    button.style.width = "250px";
    button.style.marginTop = "8px";
    container.appendChild(button);
    this.enterButtonElement = button;

    gameContainer.appendChild(container);
    this.containerDiv = container;

    const confirm = () => this.handleAuth();

    button.addEventListener("click", confirm);
    nameInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        confirm();
      }
    });

    if (this.emailInputElement) {
      this.emailInputElement.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          confirm();
        }
      });
    }

    if (this.passwordInputElement) {
      this.passwordInputElement.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          confirm();
        }
      });
    }

    // Foco inicial
    if (this.authMode === "anonymous") {
      nameInput.focus();
    } else {
      this.emailInputElement?.focus();
    }
  }

  private getButtonText(): string {
    switch (this.authMode) {
      case "anonymous":
        return "Entrar como Visitante";
      case "login":
        return "Entrar";
      case "register":
        return "Criar Conta";
    }
  }

  private async handleAuth(): Promise<void> {
    // Desabilitar botão durante processamento
    if (this.enterButtonElement) {
      this.enterButtonElement.disabled = true;
      this.enterButtonElement.textContent = "Processando...";
      this.enterButtonElement.style.backgroundColor = "#6b7280";
    }

    this.errorText?.setText("");

    try {
      const name = this.nameInputElement?.value.trim() || "Convidado";

      if (this.authMode === "anonymous") {
        // Modo visitante - login anônimo
        const user = await signInAnonymous();
        if (user) {
          console.log("[AuthScene] Login anônimo bem-sucedido");
          PlayerState.setDisplayName(name);
          this.cleanupHtmlForm();
          this.scene.start("BaseHubScene");
        } else {
          throw new Error("Falha ao fazer login anônimo");
        }
      } else if (this.authMode === "login") {
        // Login com email/senha
        const email = this.emailInputElement?.value.trim();
        const password = this.passwordInputElement?.value;

        if (!email || !password) {
          throw new Error("Email e senha são obrigatórios");
        }

        const user = await signInWithEmail(email, password);
        if (user) {
          console.log("[AuthScene] Login com email bem-sucedido");
          PlayerState.setDisplayName(name);
          this.cleanupHtmlForm();
          this.scene.start("BaseHubScene");
        } else {
          throw new Error("Email ou senha incorretos");
        }
      } else if (this.authMode === "register") {
        // Criar conta
        const email = this.emailInputElement?.value.trim();
        const password = this.passwordInputElement?.value;

        if (!email || !password) {
          throw new Error("Email e senha são obrigatórios");
        }

        if (password.length < 6) {
          throw new Error("Senha deve ter no mínimo 6 caracteres");
        }

        const user = await createAccount(email, password);
        if (user) {
          console.log("[AuthScene] Conta criada com sucesso");
          PlayerState.setDisplayName(name);
          this.cleanupHtmlForm();
          this.scene.start("BaseHubScene");
        } else {
          throw new Error("Falha ao criar conta");
        }
      }
    } catch (error: any) {
      console.error("[AuthScene] Erro na autenticação:", error);
      
      // Mostrar mensagem de erro
      let errorMessage = "Erro desconhecido";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Este email já está em uso";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Email inválido";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Senha muito fraca";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "Usuário não encontrado";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Senha incorreta";
      } else if (error.message) {
        errorMessage = error.message;
      }

      this.errorText?.setText(errorMessage);

      // Reabilitar botão
      if (this.enterButtonElement) {
        this.enterButtonElement.disabled = false;
        this.enterButtonElement.textContent = this.getButtonText();
        this.enterButtonElement.style.backgroundColor = "#22c55e";
      }
    }
  }

  private cleanupHtmlForm() {
    if (this.containerDiv && this.containerDiv.parentElement) {
      this.containerDiv.parentElement.removeChild(this.containerDiv);
    }
    this.containerDiv = undefined;
    this.nameInputElement = undefined;
    this.enterButtonElement = undefined;
  }

  shutdown() {
    this.cleanupHtmlForm();
  }
}
