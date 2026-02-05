import Phaser from "phaser";
import type { MultiplayerClient } from "../../../services/multiplayerClient";
import type { ExtractionSystem } from "./ExtractionSystem";
import type { CaptureSystem } from "./CaptureSystem";
import type { FeedbackManager } from "../ui/FeedbackManager";
import type { RemoteResourceSprite } from "../types/ExpeditionTypes";
import type { SpriteManager } from "../managers/SpriteManager";
import type { GameWorldState } from "../../../game/worldState";

/**
 * Gerencia interações do jogador (coleta de recursos, extração, captura).
 */
export class InteractionSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private extractionZone: Phaser.GameObjects.Rectangle;
  private extractKey: Phaser.Input.Keyboard.Key;
  private captureKey: Phaser.Input.Keyboard.Key;
  private mpClient: MultiplayerClient | null;
  private extractionSystem: ExtractionSystem;
  private captureSystem: CaptureSystem;
  private feedbackManager: FeedbackManager;
  private spriteManager: SpriteManager;
  private worldState: GameWorldState;
  private resourceIntentsSent: Set<string> = new Set();

  constructor(
    scene: Phaser.Scene,
    player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    extractionZone: Phaser.GameObjects.Rectangle,
    extractKey: Phaser.Input.Keyboard.Key,
    captureKey: Phaser.Input.Keyboard.Key,
    mpClient: MultiplayerClient | null,
    extractionSystem: ExtractionSystem,
    captureSystem: CaptureSystem,
    feedbackManager: FeedbackManager,
    spriteManager: SpriteManager,
    worldState: GameWorldState
  ) {
    this.scene = scene;
    this.player = player;
    this.extractionZone = extractionZone;
    this.extractKey = extractKey;
    this.captureKey = captureKey;
    this.mpClient = mpClient;
    this.extractionSystem = extractionSystem;
    this.captureSystem = captureSystem;
    this.feedbackManager = feedbackManager;
    this.spriteManager = spriteManager;
    this.worldState = worldState;
  }

  /**
   * Processa todas as interações do jogador.
   */
  handleInteractions(dt: number): void {
    const pointerRect = new Phaser.Geom.Rectangle(
      this.player.x - 8,
      this.player.y - 8,
      16,
      16
    );

    // Coleta de recursos usando worldState
    const resourcesToRemove: string[] = [];
    
    if (!this.spriteManager) {
      return;
    }
    
    const allResources = this.spriteManager.getAllResources();
    
    // Debug: verificar se há recursos e se mpClient está disponível
    if (allResources.length > 0 && Math.random() < 0.01) {
      console.log(`[Resource] handleInteractions: ${allResources.length} recursos disponíveis, mpClient: ${this.mpClient ? 'OK' : 'NULL'}, player: (${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)})`);
    }
    
    for (const resourceSprite of allResources) {
      const dx = resourceSprite.sprite.x - this.player.x;
      const dy = resourceSprite.sprite.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      
      // Raio de coleta (aproximadamente 16px)
      if (dist <= 20) {
        const resourceItemId = resourceSprite.resourceType;
        const resourceId = resourceSprite.id;

        // Debug: log quando detecta recurso próximo
        console.log(`[Resource] Recurso próximo detectado! ID: ${resourceId}, dist: ${dist.toFixed(1)}, mpClient: ${this.mpClient ? 'OK' : 'NULL'}, já enviado: ${this.resourceIntentsSent.has(resourceId)}`);

        // Envia intent de coleta ao servidor (server-authoritative)
        // Evita enviar múltiplos intents para o mesmo recurso
        if (this.mpClient && !this.resourceIntentsSent.has(resourceId)) {
          this.resourceIntentsSent.add(resourceId);
          this.mpClient.sendResourceInteract(resourceId);
          console.log(`[Resource] ✅ Intent de coleta enviado ao servidor: ${resourceId}`);
        } else if (!this.mpClient) {
          console.warn(`[Resource] ⚠️ mpClient não disponível para enviar intent de coleta: ${resourceId}`);
        } else if (this.resourceIntentsSent.has(resourceId)) {
          console.log(`[Resource] ⏭️ Intent já enviado anteriormente para recurso: ${resourceId}`);
        }

        // NOTA: Telemetria será atualizada quando o servidor confirmar a coleta
        // via resources_update (quando o recurso desaparecer do servidor)
        // Isso garante que apenas recursos realmente coletados sejam contados
        
        this.feedbackManager.createCollectionFeedback(
          resourceSprite.sprite.x,
          resourceSprite.sprite.y,
          resourceItemId
        );
        
        resourcesToRemove.push(resourceSprite.id);
      }
    }
    
    // Remove recursos coletados do worldState
    for (const resourceId of resourcesToRemove) {
      this.removeResource(resourceId);
    }

    // Lógica de extração: precisa estar na zona e segurar E parado
    const inExtractionZone = Phaser.Geom.Rectangle.Contains(
      this.extractionZone.getBounds(),
      this.player.x,
      this.player.y
    );

    // Lógica de extração usando ExtractionSystem
    this.extractionSystem.handleExtraction(
      inExtractionZone,
      this.extractKey.isDown,
      this.player.x,
      this.player.y
    );

    if (Phaser.Input.Keyboard.JustDown(this.captureKey)) {
      const pointer = this.scene.input.activePointer;
      pointer.updateWorldPoint(this.scene.cameras.main);
      this.captureSystem.throwPokeball(pointer.worldX, pointer.worldY);
    }
  }

  /**
   * Remove recurso do worldState e destrói seu sprite.
   */
  private removeResource(resourceId: string): void {
    console.log(`[Resource] Removendo recurso: ${resourceId}`);
    // Remove do set de intents enviados quando o recurso é removido
    this.resourceIntentsSent.delete(resourceId);
    this.worldState.removeResource(resourceId);
    this.spriteManager.destroyResourceSprite(resourceId);
    console.log(`[Resource] Recurso removido: ${resourceId}`);
  }

  /**
   * Atualiza a referência do cliente multiplayer.
   */
  setMpClient(mpClient: MultiplayerClient | null): void {
    this.mpClient = mpClient;
  }
}
