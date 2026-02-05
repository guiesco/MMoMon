import Phaser from "phaser";
import type { MultiplayerClient } from "../../../services/multiplayerClient";
import type { ProjectileManager } from "../managers/ProjectileManager";
import type { FeedbackManager } from "../ui/FeedbackManager";
import type { ExpeditionTelemetry } from "../types/ExpeditionTypes";

/**
 * Gerencia o sistema de captura de criaturas.
 * Apenas visual - toda lógica é processada no servidor.
 */
export class CaptureSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private expeditionInventory: Map<string, number>;
  private mpClient: MultiplayerClient | null;
  private projectileManager: ProjectileManager;
  private feedbackManager: FeedbackManager;
  private telemetry: ExpeditionTelemetry;
  private captureAttemptPositions: Map<string, { x: number; y: number }>;

  constructor(
    scene: Phaser.Scene,
    player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    expeditionInventory: Map<string, number>,
    mpClient: MultiplayerClient | null,
    projectileManager: ProjectileManager,
    feedbackManager: FeedbackManager,
    telemetry: ExpeditionTelemetry
  ) {
    this.scene = scene;
    this.player = player;
    this.expeditionInventory = expeditionInventory;
    this.mpClient = mpClient;
    this.projectileManager = projectileManager;
    this.feedbackManager = feedbackManager;
    this.telemetry = telemetry;
    this.captureAttemptPositions = new Map();
  }

  /**
   * Lança uma pokébola na direção do mouse.
   * Apenas cria o visual - o servidor processa a captura.
   */
  throwPokeball(targetX: number, targetY: number): void {
    // Seleciona automaticamente a melhor pokébola disponível
    const captureToolsPriority: ("poke-ball-ultra" | "poke-ball-precisa" | "poke-ball-basic")[] = [
      "poke-ball-ultra",
      "poke-ball-precisa",
      "poke-ball-basic"
    ];

    const chosenBall = captureToolsPriority.find(
      (id) => (this.expeditionInventory.get(id) ?? 0) > 0
    );

    if (!chosenBall) {
      this.feedbackManager.createFloatingText(
        this.player.x,
        this.player.y - 30,
        "Sem Pokébolas!",
        0xef4444
      );
      return;
    }

    // Consome a pokébola do inventário de expedição (otimista)
    const currentQuantity = this.expeditionInventory.get(chosenBall) ?? 0;
    if (currentQuantity <= 0) {
      return;
    }
    this.expeditionInventory.set(chosenBall, currentQuantity - 1);

    // Calcula direção para o alvo
    const dx = targetX - this.player.x;
    const dy = targetY - this.player.y;
    const len = Math.hypot(dx, dy) || 1;
    
    const speed = 450; // Velocidade da pokébola
    const velocityX = (dx / len) * speed;
    const velocityY = (dy / len) * speed;

    // Cor da pokébola baseada no tipo
    const ballColors: Record<string, number> = {
      "poke-ball-basic": 0xef4444,    // Vermelho
      "poke-ball-precisa": 0x3b82f6,   // Azul
      "poke-ball-ultra": 0xfbbf24      // Dourado
    };

    // Cria o sprite da pokébola
    const sprite = this.scene.add.circle(
      this.player.x, 
      this.player.y, 
      8, 
      ballColors[chosenBall] ?? 0xef4444, 
      1
    );
    sprite.setStrokeStyle(2, 0xffffff);

    // Usar ProjectileManager
    this.projectileManager.addPokeballProjectile({
      sprite,
      velocityX,
      velocityY,
      lifetime: 2, // 2 segundos de vida
      ballType: chosenBall
    });

    // Feedback visual ao lançar
    this.feedbackManager.createFloatingText(
      this.player.x,
      this.player.y - 30,
      "🎯 Lançando...",
      0x3b82f6
    );

    // Registra tentativa
    this.telemetry.captureAttempts += 1;
  }

  /**
   * Armazena posição de criatura antes de enviar tentativa de captura.
   * Usado como fallback quando recebemos o resultado e a criatura já foi removida.
   */
  storeCaptureAttemptPosition(creatureId: string, x: number, y: number): void {
    this.captureAttemptPositions.set(creatureId, { x, y });
  }

  /**
   * Obtém posição armazenada de tentativa de captura.
   */
  getCaptureAttemptPosition(creatureId: string): { x: number; y: number } | undefined {
    return this.captureAttemptPositions.get(creatureId);
  }

  /**
   * Remove posição armazenada após uso.
   */
  clearCaptureAttemptPosition(creatureId: string): void {
    this.captureAttemptPositions.delete(creatureId);
  }

  /**
   * Atualiza a referência do cliente multiplayer.
   */
  setMpClient(mpClient: MultiplayerClient | null): void {
    this.mpClient = mpClient;
  }
}
