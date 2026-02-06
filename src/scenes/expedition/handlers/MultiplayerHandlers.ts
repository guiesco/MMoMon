import type { 
  RemoteCreature, 
  RemoteResource, 
  AttackResult, 
  CaptureResult,
  ExtractionState,
  MatchEvent,
  PlayerDeath,
  RemotePlayer,
  MultiplayerClient
} from "../../../services/multiplayerClient";
import type { GameWorldState } from "../../../game/worldState";
import type { ExpeditionState } from "../types/ExpeditionTypes";
import type { SpriteManager } from "../managers/SpriteManager";
import type { ProjectileManager } from "../managers/ProjectileManager";
import type { ExpeditionTelemetry } from "../types/ExpeditionTypes";
import type { TeamSystem } from "../systems/TeamSystem";
import type { FeedbackManager } from "../ui/FeedbackManager";
import type { CaptureSystem } from "../systems/CaptureSystem";
import type { ExtractionSystem } from "../systems/ExtractionSystem";
import type { ProgressionSystem } from "../systems/ProgressionSystem";
import type { VisualSystem } from "../systems/VisualSystem";
import { PlayerState as LocalPlayerState } from "../../../game/playerState";
import type { ThreatTier, EnemyBehaviorType, EnemyAIState } from "../../../game/constants";

/**
 * Handlers para eventos multiplayer.
 * Centraliza toda a lógica de sincronização com o servidor.
 */
export class MultiplayerHandlers {
  private worldState: GameWorldState;
  private spriteManager: SpriteManager;
  private telemetry: ExpeditionTelemetry;
  private mpClient: MultiplayerClient | null = null;
  private clientId: string | null = null;
  private teamSystem: TeamSystem | null = null;
  private feedbackManager: FeedbackManager | null = null;
  private captureSystem: CaptureSystem | null = null;
  private extractionSystem: ExtractionSystem | null = null;
  private progressionSystem: ProgressionSystem | null = null;
  private visualSystem: VisualSystem | null = null;
  private projectileManager: ProjectileManager | null = null;
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private scene: Phaser.Scene | null = null;
  
  // Callbacks para atualizar estado da cena
  private setState: ((state: ExpeditionState) => void) | null = null;
  private getState: (() => ExpeditionState) | null = null;
  private setEndSceneTimer: ((timer: number) => void) | null = null;
  private getExpeditionTime: (() => number) | null = null;
  private getLastMatchState: (() => any) | null = null;
  private setDamageTakenRecently: ((damage: number) => void) | null = null;
  private setDamageTakenDecayTimer: ((timer: number) => void) | null = null;
  private setPlayerTookDamageThisFrame: ((value: boolean) => void) | null = null;
  private setCreaturesCaptured: ((count: number) => void) | null = null;
  private getCreaturesCaptured: (() => number) | null = null;
  private disableControls: (() => void) | null = null;

  constructor(
    worldState: GameWorldState,
    spriteManager: SpriteManager,
    telemetry: ExpeditionTelemetry
  ) {
    this.worldState = worldState;
    this.spriteManager = spriteManager;
    this.telemetry = telemetry;
  }

  /**
   * Configura dependências adicionais necessárias para os handlers completos.
   */
  setDependencies(config: {
    mpClient?: MultiplayerClient | null;
    clientId?: string | null;
    teamSystem?: TeamSystem | null;
    feedbackManager?: FeedbackManager | null;
    captureSystem?: CaptureSystem | null;
    extractionSystem?: ExtractionSystem | null;
    progressionSystem?: ProgressionSystem | null;
    visualSystem?: VisualSystem | null;
    projectileManager?: ProjectileManager | null;
    player?: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null;
    scene?: Phaser.Scene | null;
    setState?: (state: ExpeditionState) => void;
    getState?: () => ExpeditionState;
    setEndSceneTimer?: (timer: number) => void;
    getExpeditionTime?: () => number;
    getLastMatchState?: () => any;
    setDamageTakenRecently?: (damage: number) => void;
    setDamageTakenDecayTimer?: (timer: number) => void;
    setPlayerTookDamageThisFrame?: (value: boolean) => void;
    setCreaturesCaptured?: (count: number) => void;
    getCreaturesCaptured?: () => number;
    disableControls?: () => void;
  }): void {
    if (config.mpClient !== undefined) this.mpClient = config.mpClient;
    if (config.clientId !== undefined) this.clientId = config.clientId;
    if (config.teamSystem !== undefined) this.teamSystem = config.teamSystem;
    if (config.feedbackManager !== undefined) this.feedbackManager = config.feedbackManager;
    if (config.captureSystem !== undefined) this.captureSystem = config.captureSystem;
    if (config.extractionSystem !== undefined) this.extractionSystem = config.extractionSystem;
    if (config.progressionSystem !== undefined) this.progressionSystem = config.progressionSystem;
    if (config.visualSystem !== undefined) this.visualSystem = config.visualSystem;
    if (config.projectileManager !== undefined) this.projectileManager = config.projectileManager;
    if (config.player !== undefined) this.player = config.player;
    if (config.scene !== undefined) this.scene = config.scene;
    if (config.setState !== undefined) this.setState = config.setState;
    if (config.getState !== undefined) this.getState = config.getState;
    if (config.setEndSceneTimer !== undefined) this.setEndSceneTimer = config.setEndSceneTimer;
    if (config.getExpeditionTime !== undefined) this.getExpeditionTime = config.getExpeditionTime;
    if (config.getLastMatchState !== undefined) this.getLastMatchState = config.getLastMatchState;
    if (config.setDamageTakenRecently !== undefined) this.setDamageTakenRecently = config.setDamageTakenRecently;
    if (config.setDamageTakenDecayTimer !== undefined) this.setDamageTakenDecayTimer = config.setDamageTakenDecayTimer;
    if (config.setPlayerTookDamageThisFrame !== undefined) this.setPlayerTookDamageThisFrame = config.setPlayerTookDamageThisFrame;
    if (config.setCreaturesCaptured !== undefined) this.setCreaturesCaptured = config.setCreaturesCaptured;
    if (config.getCreaturesCaptured !== undefined) this.getCreaturesCaptured = config.getCreaturesCaptured;
    if (config.disableControls !== undefined) this.disableControls = config.disableControls;
  }

  /**
   * Handler para atualização de criaturas.
   */
  handleCreaturesUpdate(creatures: RemoteCreature[]): void {
    const seen = new Set<string>();
    
    for (const remoteCreature of creatures) {
      if (remoteCreature.currentHp <= 0) {
        console.warn(`[DEBUG:Creatures] Servidor enviou criatura morta: ${remoteCreature.id.slice(0, 8)}... - Ignorando`);
        continue;
      }
      
      seen.add(remoteCreature.id);
      const existingCreature = this.worldState.getCreature(remoteCreature.id);
      
      if (existingCreature) {
        this.worldState.updateCreature(remoteCreature.id, {
          x: remoteCreature.x,
          y: remoteCreature.y,
          currentHp: remoteCreature.currentHp,
          maxHp: remoteCreature.maxHp,
          aiState: (remoteCreature.aiState as any) ?? existingCreature.aiState,
          behaviorType: (remoteCreature.behaviorType as any) ?? existingCreature.behaviorType,
          level: remoteCreature.level,
          windupTimer: remoteCreature.windupTimer ?? 0,
          skillWindupTimer: (remoteCreature as any).skillWindupTimer ?? 0
        });
        this.spriteManager.updateCreatureSprite(remoteCreature.id);
      } else {
        const tier = (remoteCreature.tier as ThreatTier) ?? "comum";
        const behaviorType = (remoteCreature.behaviorType as EnemyBehaviorType) ?? "melee";
        
        const creatureState = {
          id: remoteCreature.id,
          speciesId: remoteCreature.speciesId ?? remoteCreature.creatureType ?? "unknown",
          creatureType: remoteCreature.creatureType ?? "neutral",
          x: remoteCreature.x,
          y: remoteCreature.y,
          currentHp: remoteCreature.currentHp,
          maxHp: remoteCreature.maxHp,
          tier,
          behaviorType,
          aiState: (remoteCreature.aiState as EnemyAIState) ?? "idle",
          // ✅ aiConfig agora vem do servidor via effectiveStats
          // Por enquanto, criar um aiConfig básico para compatibilidade visual
          aiConfig: {
            behaviorType,
            moveSpeed: 100,
            detectionRange: 180,
            attackRange: 100,
            attackCooldown: 2.0,
            attackDamage: 10,
            attackWindup: 0.4,
            preferredDistance: behaviorType === "ranged" ? 120 : 30,
            projectileSpeed: behaviorType === "ranged" ? 200 : 0,
            stunDuration: 0.15,
            aggroIndicatorColor: tier === "elite" ? 0xdc2626 : tier === "perigosa" ? 0xf97316 : 0xf97373
          },
          attackCooldownRemaining: remoteCreature.attackCooldownRemaining ?? 0,
          windupTimer: remoteCreature.windupTimer ?? 0,
          skillWindupTimer: (remoteCreature as any).skillWindupTimer ?? 0, // ✅ Windup de skill de criaturas
          stunTimer: remoteCreature.stunTimer ?? 0,
          patrolOrigin: { 
            x: remoteCreature.patrolOriginX ?? remoteCreature.x, 
            y: remoteCreature.patrolOriginY ?? remoteCreature.y 
          },
          patrolTimer: remoteCreature.patrolTimer ?? 0,
          level: remoteCreature.level,
          state: "alive" as const
        };
        
        this.worldState.addCreature(creatureState);
        this.spriteManager.createCreatureSprite(creatureState);
      }
    }

    // Remove criaturas que não aparecem mais no servidor
    for (const creatureId of this.worldState.creatures.keys()) {
      if (!seen.has(creatureId)) {
        this.worldState.removeCreature(creatureId);
        this.spriteManager.destroyCreatureSprite(creatureId);
      }
    }
  }

  /**
   * Handler para atualização de recursos.
   */
  handleResourcesUpdate(resources: RemoteResource[]): void {
    const seen = new Set<string>();
    
    for (const remoteResource of resources) {
      seen.add(remoteResource.id);
      const existingResource = this.worldState.getResource(remoteResource.id);
      
      if (existingResource) {
        this.worldState.updateResource(remoteResource.id, {
          x: remoteResource.x,
          y: remoteResource.y,
          quantity: remoteResource.quantity ?? remoteResource.amount ?? existingResource.quantity
        });
        this.spriteManager.updateResourceSprite(remoteResource.id);
      } else {
        const resourceType = remoteResource.resourceType ?? remoteResource.type ?? "generic";
        let defaultColor = 0xfbbf24;
        if (resourceType.includes("cristal") || resourceType.includes("crystal")) {
          defaultColor = 0x06b6d4;
        } else if (resourceType.includes("ferro") || resourceType.includes("iron")) {
          defaultColor = 0x9ca3af;
        } else if (resourceType.includes("energia") || resourceType.includes("energy")) {
          defaultColor = 0x8b5cf6;
        }
        
        const isRare = remoteResource.isRare ?? false;
        const resourceState = {
          id: remoteResource.id,
          type: resourceType,
          resourceType,
          x: remoteResource.x,
          y: remoteResource.y,
          amount: remoteResource.amount ?? remoteResource.quantity ?? 1,
          quantity: remoteResource.quantity ?? remoteResource.amount ?? 1,
          isRare,
          size: remoteResource.size ?? (isRare ? 14 : 10),
          color: remoteResource.color ?? defaultColor,
          borderColor: remoteResource.borderColor ?? 0x92400e,
          borderWidth: remoteResource.borderWidth ?? (isRare ? 2 : 1)
        };
        
        this.worldState.addResource(resourceState);
        this.spriteManager.createResourceSprite(resourceState);
      }
    }

    // Remove recursos coletados
    // Verifica tanto recursos no worldState quanto sprites existentes
    const allResourceIds = new Set([
      ...this.worldState.resources.keys(),
      ...Array.from(this.spriteManager.getAllResources().map(r => r.id))
    ]);
    
    for (const resourceId of allResourceIds) {
      if (!seen.has(resourceId)) {
        console.log(`[MultiplayerHandlers] Removendo recurso coletado: ${resourceId} (não está mais no servidor)`);
        // Remove do worldState se ainda estiver lá
        if (this.worldState.resources.has(resourceId)) {
          this.worldState.removeResource(resourceId);
        }
        // Sempre tenta destruir o sprite (pode já ter sido removido do worldState mas sprite ainda visível)
        this.spriteManager.destroyResourceSprite(resourceId);
      }
    }
  }

  /**
   * Handler completo para resultado de ataque recebido do servidor.
   * Sincroniza HP real das criaturas E JOGADORES e aplica correções visuais.
   */
  handleAttackResult(result: AttackResult): void {
    console.log("[MP] Resultado de ataque recebido", result);

    if (!result.targetId) {
      return;
    }

    // Atualizar telemetria
    if (result.damage > 0) {
      this.telemetry.damageDealt += result.damage;
      this.telemetry.combatEncounters += 1;
    }

    // Verificar se o alvo é o jogador local
    const isLocalPlayer = result.targetId === this.mpClient?.getClientId();
    
    if (isLocalPlayer && this.player && this.teamSystem && this.feedbackManager && this.scene) {
      const currentState = this.getState?.() ?? "exploring";
      
      // Não processar dano se já está morto/falhou
      if (currentState === "failed") {
        console.log("[MP] Ignorando dano - jogador já está morto");
        return;
      }
      
      // Atualizar HP do jogador local
      if (result.targetHp !== undefined) {
        this.teamSystem.updateActiveCreatureHp(Math.max(0, result.targetHp));
        this.telemetry.damageTaken += result.damage;
        
        if (this.setDamageTakenRecently) {
          this.setDamageTakenRecently(result.damage);
        }
        if (this.setDamageTakenDecayTimer) {
          this.setDamageTakenDecayTimer(0.5);
        }
        if (this.setPlayerTookDamageThisFrame) {
          this.setPlayerTookDamageThisFrame(true);
        }
        
        // Efeito visual de dano no jogador
        const originalTint = this.player.tintTopLeft;
        this.player.setTint(0xef4444);
        this.scene.time.delayedCall(100, () => {
          this.player?.setTint(originalTint);
        });
        
        // Feedback de dano
        this.feedbackManager.createFloatingText(
          this.player.x,
          this.player.y - 30,
          `-${result.damage} HP`,
          0xef4444
        );
        
        // CORREÇÃO MULTIPLAYER: Aplicar knockback quando atacado por criatura
        if (result.attackerId && result.attackerId.startsWith("wild-")) {
          const creature = this.spriteManager.getCreatureSprite(result.attackerId);
          if (creature) {
            // Calcular direção do knockback (do atacante para o jogador)
            const dx = this.player.x - creature.sprite.x;
            const dy = this.player.y - creature.sprite.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist > 0) {
              const knockbackDist = 20; // Distância do knockback
              const nx = dx / dist;
              const ny = dy / dist;
              
              // Aplicar knockback ao jogador
              this.player.x += nx * knockbackDist;
              this.player.y += ny * knockbackDist;
              
              // Enviar nova posição ao servidor
              this.mpClient?.sendPosition(this.player.x, this.player.y);
            }
          }
        }
        
        // Verificar morte imediatamente - não esperar pelo evento separado
        if (result.targetDestroyed || this.teamSystem.activeHp <= 0) {
          console.log("[MP] Jogador local morreu por ataque - mudando estado imediatamente");
          if (this.setState) {
            this.setState("failed");
          }
          if (this.setEndSceneTimer) {
            this.setEndSceneTimer(0);
          }
          
          // Registrar telemetria de falha se ainda não foi registrada
          if (!this.telemetry.extractionFailed) {
            this.telemetry.extractionFailed = true;
            const finalTime = this.getLastMatchState?.()?.elapsedSeconds ?? this.getExpeditionTime?.() ?? 0;
            this.telemetry.timeSpent = finalTime;
            
            const timeMinutes = finalTime / 60;
            this.telemetry.resourcesPerMinute =
              this.telemetry.resourcesCollected / Math.max(0.1, timeMinutes);
            this.telemetry.creaturesPerMinute =
              (this.getCreaturesCaptured?.() ?? 0) / Math.max(0.1, timeMinutes);
            this.telemetry.averageCaptureChance =
              this.telemetry.captureAttempts > 0
                ? this.telemetry.totalCaptureChanceSum / this.telemetry.captureAttempts
                : 0;
            
            console.log("[TELEMETRIA] Expedição falhou - morte em combate (multiplayer)");
            console.table({
              "Tempo Total (s)": Math.floor(this.telemetry.timeSpent),
              "Recursos Coletados": this.telemetry.resourcesCollected,
              "Dano Recebido": this.telemetry.damageTaken.toFixed(1),
              "Morto Por": result.attackerId || "desconhecido",
              Status: "FALHA (MORTE EM COMBATE)"
            });
            
            // Mesmo em falha, criaturas ganham XP (sem bônus de extração)
            if (this.progressionSystem) {
              this.progressionSystem.processCreatureXp(false);
            }
          }
          
          // Feedback visual
          if (this.scene) {
            this.feedbackManager.createFloatingText(
              this.scene.scale.width / 2,
              this.scene.scale.height / 2,
              `💀 VOCÊ MORREU`,
              0xef4444
            );
          }
          
          // Desabilita controles
          if (this.disableControls) {
            this.disableControls();
          }
        }
      }
      
      // Só mudar para combat se não estiver morto
      if (this.setState) {
        this.setState("combat");
      }
      return;
    }
    
    // Se não é o jogador local, tentar encontrar a criatura alvo
    const creature = this.spriteManager.getCreatureSprite(result.targetId);
    
    if (creature && this.teamSystem && this.feedbackManager && this.visualSystem) {
      // ✅ CORREÇÃO DESYNC: Se o atacante é o jogador local, remover projétil local
      const isLocalPlayerAttack = result.attackerId === this.mpClient?.getClientId();
      if (isLocalPlayerAttack && this.projectileManager) {
        const removed = this.projectileManager.removeLocalProjectileForHit(
          result.targetId!,
          creature.sprite.x,
          creature.sprite.y
        );
        if (removed) {
          console.log(`[MP] ✅ Projétil local removido para hit confirmado pelo servidor em ${result.targetId}`);
        }
      }
      
      const newHp = Math.max(0, result.targetHp ?? creature.currentHp - result.damage);
      creature.currentHp = newHp;
      this.worldState.updateCreature(result.targetId, { currentHp: newHp });

      // Efeito visual de hit
      this.visualSystem.createHitImpactEffect(
        creature.sprite.x,
        creature.sprite.y,
        this.teamSystem.activeTheme
      );

      // Feedback de dano
      this.feedbackManager.createFloatingText(
        creature.sprite.x,
        creature.sprite.y - 20,
        `-${result.damage} HP${result.isCritical ? " CRIT!" : ""}`,
        result.isCritical ? 0xfbbf24 : 0xef4444
      );

      // Se a criatura foi destruída
      if (result.targetDestroyed || creature.currentHp <= 0) {
        this.visualSystem.createDeathEffect(creature.sprite.x, creature.sprite.y, this.teamSystem.activeTheme);
        this.worldState.removeCreature(result.targetId);
        this.spriteManager.destroyCreatureSprite(result.targetId);
      }
    }

    if (this.setState) {
      this.setState("combat");
    }
  }

  /**
   * Handler completo para resultado de captura recebido do servidor.
   */
  handleCaptureResult(result: CaptureResult): void {
    console.log("[MP] Resultado de captura recebido", result);
    console.log("[MP] ClientId local:", this.clientId, "PlayerId da captura:", result.playerId);

    // ✅ BUG FIX: Verificar se a captura é do jogador local
    const isLocalPlayerCapture = this.clientId && result.playerId === this.clientId;
    
    if (!isLocalPlayerCapture) {
      console.log("[MP] Captura de outro jogador, ignorando atualização de contador local");
      return;
    }

    // ✅ BUG FIX: Tentar obter posição da criatura, ou usar posição armazenada
    let feedbackX: number;
    let feedbackY: number;
    
    const creature = this.spriteManager.getCreatureSprite(result.targetId);
    
    if (creature) {
      // Criatura ainda existe - usar posição atual
      feedbackX = creature.sprite.x;
      feedbackY = creature.sprite.y;
      console.log(`[MP] ✅ Criatura encontrada: ${result.targetId} em (${feedbackX.toFixed(0)}, ${feedbackY.toFixed(0)})`);
    } else if (this.captureSystem) {
      // Criatura já foi removida - usar posição armazenada
      const storedPosition = this.captureSystem.getCaptureAttemptPosition(result.targetId);
      if (storedPosition) {
        feedbackX = storedPosition.x;
        feedbackY = storedPosition.y;
        console.log(`[MP] ⚠️ Criatura não encontrada, usando posição armazenada: ${result.targetId} em (${feedbackX.toFixed(0)}, ${feedbackY.toFixed(0)})`);
        this.captureSystem.clearCaptureAttemptPosition(result.targetId);
      } else if (this.player) {
        // Fallback: usar posição do jogador
        feedbackX = this.player.x;
        feedbackY = this.player.y;
        console.log(`[MP] ⚠️ Criatura não encontrada e sem posição armazenada, usando posição do jogador: (${feedbackX.toFixed(0)}, ${feedbackY.toFixed(0)})`);
      } else {
        return; // Não há posição disponível
      }
    } else {
      return; // Não há captureSystem disponível
    }

    // Incrementa contador de criaturas encontradas
    this.telemetry.creaturesEncountered += 1;
    
    // Registra chance de captura para cálculo de média
    if (result.captureChance !== undefined) {
      this.telemetry.totalCaptureChanceSum += result.captureChance;
    }

    // Log de tentativa de captura
    console.log("[CAPTURA MP] Resultado", {
      targetId: result.targetId,
      chance: result.captureChance ? (result.captureChance * 100).toFixed(1) + "%" : "N/A",
      roll: result.roll ? (result.roll * 100).toFixed(1) + "%" : "N/A",
      success: result.success,
      failReason: result.failReason
    });

    if (!this.feedbackManager || !this.scene) return;

    if (result.success) {
      // ✅ BUG FIX: Atualizar contador de capturas
      const currentCount = this.getCreaturesCaptured?.() ?? 0;
      if (this.setCreaturesCaptured) {
        this.setCreaturesCaptured(currentCount + 1);
      }
      this.telemetry.creaturesCaptured += 1;
      this.telemetry.captureSuccesses += 1;
      
      console.log(`[MP] ✅ Contador de capturas atualizado: ${currentCount + 1} capturas`);
      console.log(`[MP] ✅ Exibindo feedback de captura em (${feedbackX.toFixed(0)}, ${feedbackY.toFixed(0)})`);

      // Feedback visual de sucesso
      this.feedbackManager.createCaptureSuccessFeedback(feedbackX, feedbackY);
      
      // ✅ BUG FIX: Exibir mensagem imediatamente
      this.feedbackManager.createEnhancedFloatingText(
        feedbackX,
        feedbackY - 50,
        "✅ CAPTURADO!",
        0x10b981,
        28,
        2000
      );

      // Remove criatura do worldState após delay
      this.scene.time.delayedCall(1000, () => {
        console.log(`[MP] Removendo criatura ${result.targetId} após captura`);
        this.worldState.removeCreature(result.targetId);
        this.spriteManager.destroyCreatureSprite(result.targetId);
        if (this.captureSystem) {
          this.captureSystem.clearCaptureAttemptPosition(result.targetId);
        }
      });

      // Adiciona criatura capturada (se incluído no resultado)
      if (result.capturedCreature) {
        LocalPlayerState.addCreature(result.capturedCreature.speciesId);
      }
    } else {
      this.telemetry.captureFailures += 1;

      // Feedback visual de falha
      this.feedbackManager.createEnhancedFloatingText(
        feedbackX,
        feedbackY - 20,
        `❌ Escapou! ${result.failReason || ""}`,
        0xef4444,
        20
      );
      
      // IMPORTANTE: A criatura fica agressiva após falha na captura
      if (creature) {
        creature.aiState = "chasing";
        this.worldState.updateCreature(result.targetId, { aiState: "chasing" });
      }
    }
  }

  /**
   * Handler completo para estado de extração.
   */
  handleExtractionState(state: ExtractionState): ExpeditionState {
    if (!this.extractionSystem || !this.feedbackManager || !this.scene) {
      return "exploring";
    }

    // Atualizar estado através do ExtractionSystem
    const newState = this.extractionSystem.handleExtractionState({
      playerId: state.playerId,
      pointId: state.pointId,
      progress: state.progress,
      status: state.status === "in_progress" ? "extracting" : 
              state.status === "completed" ? "completed" : "cancelled"
    });
    
    if (this.setState) {
      this.setState(newState);
    }
    
    // Processa recompensas se extração completou
    if (state.status === "completed" && state.rewards) {
      // Atualizar telemetria de sucesso
      if (!this.telemetry.extractionSuccess) {
        this.telemetry.extractionSuccess = true;
        const finalTime = this.getLastMatchState?.()?.elapsedSeconds ?? this.getExpeditionTime?.() ?? 0;
        this.telemetry.timeSpent = finalTime;
        
        // Calcula métricas finais
        const timeMinutes = finalTime / 60;
        this.telemetry.resourcesPerMinute = this.telemetry.resourcesCollected / Math.max(0.1, timeMinutes);
        this.telemetry.creaturesPerMinute = (this.getCreaturesCaptured?.() ?? 0) / Math.max(0.1, timeMinutes);
        this.telemetry.averageCaptureChance = this.telemetry.captureAttempts > 0
          ? this.telemetry.totalCaptureChanceSum / this.telemetry.captureAttempts
          : 0;
        
        console.log("[TELEMETRIA] Extração bem-sucedida", {
          "Tempo Total (s)": Math.floor(this.telemetry.timeSpent),
          "Recursos Coletados": this.telemetry.resourcesCollected,
          "Criaturas Capturadas": this.getCreaturesCaptured?.() ?? 0,
          "Tentativas de Captura": this.telemetry.captureAttempts,
          "Taxa de Sucesso (%)": this.telemetry.captureAttempts > 0
            ? ((this.getCreaturesCaptured?.() ?? 0) / this.telemetry.captureAttempts * 100).toFixed(1)
            : "0.0"
        });
      }
      
      // Adicionar recursos coletados
      for (const [itemId, qty] of Object.entries(state.rewards.resources ?? {})) {
        if (qty > 0) {
          LocalPlayerState.addItem(itemId, qty);
          console.log(`[Extraction] Recurso adicionado: ${itemId} x${qty}`);
        }
      }
      
      // Retornar itens não usados ao inventário permanente
      if (state.rewards.unusedItems) {
        for (const [itemId, qty] of Object.entries(state.rewards.unusedItems)) {
          if (qty > 0) {
            LocalPlayerState.addItem(itemId, qty);
            console.log(`[Extraction] Item não usado retornado: ${itemId} x${qty}`);
          }
        }
      }
      
      const creaturesCaptured = state.rewards.creaturesCaptured || 0;
      const savedToCloud = state.rewards.savedToCloud ?? false;
      const unusedItemsCount = Object.keys(state.rewards.unusedItems ?? {}).length;
      
      console.log(`[Extraction] ✅ Extração completada!`);
      console.log(`[Extraction] - Recursos: ${Object.keys(state.rewards.resources ?? {}).length} tipos`);
      console.log(`[Extraction] - Criaturas capturadas: ${creaturesCaptured}`);
      console.log(`[Extraction] - Itens não usados retornados: ${unusedItemsCount} tipos`);
      console.log(`[Extraction] - Salvo no Firebase: ${savedToCloud ? 'Sim' : 'Não'}`);
      
      // IMPORTANTE: Criaturas são salvas diretamente no Firebase pelo servidor
      if (savedToCloud && creaturesCaptured > 0) {
        console.log(`[Extraction] ⏳ Aguardando sincronização do Firebase para ${creaturesCaptured} criaturas...`);
        setTimeout(() => {
          const currentCreatures = LocalPlayerState.getProgress().creatures.length;
          console.log(`[Extraction] 📊 Criaturas no inventário após sincronização: ${currentCreatures}`);
        }, 2000);
      }
      
      // Feedback visual
      this.feedbackManager.createExtractionSuccessFeedback();
    }
    
    return newState;
  }

  /**
   * Handler completo para eventos de partida.
   */
  handleMatchEvent(event: MatchEvent): void {
    console.log("[MP] Evento de partida:", event.event);

    if (!this.feedbackManager || !this.scene) return;

    switch (event.event) {
      case "started":
        this.feedbackManager.createFloatingText(
          this.scene.scale.width / 2,
          this.scene.scale.height / 2 - 100,
          "PARTIDA INICIADA!",
          0x3b82f6
        );
        break;

      case "almost_finished":
        this.feedbackManager.createFloatingText(
          this.scene.scale.width / 2,
          this.scene.scale.height / 2 - 100,
          `RESTAM ${event.timeLeft}s!`,
          0xfbbf24
        );
        break;

      case "finished":
        this.feedbackManager.createFloatingText(
          this.scene.scale.width / 2,
          this.scene.scale.height / 2,
          "TEMPO ESGOTADO!",
          0xef4444
        );
        
        // Força falha se ainda não extraiu
        const currentState = this.getState?.() ?? "exploring";
        if (currentState !== "extracted" && this.setState) {
          this.setState("failed");
          
          // Registrar telemetria de falha por tempo
          if (!this.telemetry.extractionFailed && !this.telemetry.extractionSuccess) {
            this.telemetry.extractionFailed = true;
            const finalTime = this.getLastMatchState?.()?.elapsedSeconds ?? this.getExpeditionTime?.() ?? 0;
            this.telemetry.timeSpent = finalTime;

            const timeMinutes = finalTime / 60;
            this.telemetry.resourcesPerMinute =
              this.telemetry.resourcesCollected / Math.max(0.1, timeMinutes);
            this.telemetry.creaturesPerMinute =
              (this.getCreaturesCaptured?.() ?? 0) / Math.max(0.1, timeMinutes);
            this.telemetry.averageCaptureChance =
              this.telemetry.captureAttempts > 0
                ? this.telemetry.totalCaptureChanceSum / this.telemetry.captureAttempts
                : 0;

            console.log("[TELEMETRIA] Expedição falhou - tempo esgotado (multiplayer)");
            console.table({
              "Tempo Total (s)": Math.floor(this.telemetry.timeSpent),
              "Recursos Coletados": this.telemetry.resourcesCollected,
              "Criaturas Capturadas": this.getCreaturesCaptured?.() ?? 0,
              Status: "FALHA (TEMPO ESGOTADO)"
            });
            
            // Mesmo em falha, criaturas ganham XP (sem bônus de extração)
            if (this.progressionSystem) {
              this.progressionSystem.processCreatureXp(false);
            }
          }
        }
        break;
    }
  }

  /**
   * Handler completo para morte de jogador.
   */
  handlePlayerDeath(death: PlayerDeath): void {
    console.log("[MP] Jogador morreu:", death);

    if (!this.feedbackManager || !this.scene) return;

    // Verificar se é o jogador local que morreu
    const isLocalPlayer = death.playerId === this.mpClient?.getClientId();
    
    if (isLocalPlayer && this.teamSystem) {
      // Processar morte do jogador local
      const currentState = this.getState?.() ?? "exploring";
      if (currentState === "failed") return; // Já processado
      
      if (this.setState) {
        this.setState("failed");
      }
      this.teamSystem.updateActiveCreatureHp(0);
      if (this.setEndSceneTimer) {
        this.setEndSceneTimer(0);
      }
      
      // Registrar telemetria de falha
      if (!this.telemetry.extractionFailed) {
        this.telemetry.extractionFailed = true;
        const finalTime = this.getLastMatchState?.()?.elapsedSeconds ?? this.getExpeditionTime?.() ?? 0;
        this.telemetry.timeSpent = finalTime;

        const timeMinutes = finalTime / 60;
        this.telemetry.resourcesPerMinute =
          this.telemetry.resourcesCollected / Math.max(0.1, timeMinutes);
        this.telemetry.creaturesPerMinute =
          (this.getCreaturesCaptured?.() ?? 0) / Math.max(0.1, timeMinutes);
        this.telemetry.averageCaptureChance =
          this.telemetry.captureAttempts > 0
            ? this.telemetry.totalCaptureChanceSum / this.telemetry.captureAttempts
            : 0;

        console.log("[TELEMETRIA] Expedição falhou - morte em combate (multiplayer)");
        console.table({
          "Tempo Total (s)": Math.floor(this.telemetry.timeSpent),
          "Recursos Coletados": this.telemetry.resourcesCollected,
          "Dano Recebido": this.telemetry.damageTaken.toFixed(1),
          "Morto Por": death.killedBy || "desconhecido",
          Status: "FALHA (MORTE EM COMBATE)"
        });
        
        // Mesmo em falha, criaturas ganham XP (sem bônus de extração)
        if (this.progressionSystem) {
          this.progressionSystem.processCreatureXp(false);
        }
      }
      
      // Feedback visual
      this.feedbackManager.createFloatingText(
        this.scene.scale.width / 2,
        this.scene.scale.height / 2,
        `💀 VOCÊ MORREU`,
        0xef4444
      );
    } else {
      // Outro jogador morreu - apenas feedback visual
      this.feedbackManager.createFloatingText(
        this.scene.scale.width / 2,
        this.scene.scale.height / 2,
        `${death.playerId.slice(0, 8)}... foi eliminado`,
        0xfacc15
      );
    }

    // Desabilita controles
    if (this.disableControls) {
      this.disableControls();
    }
  }

  /**
   * Handler para movimento de jogador remoto.
   */
  handlePlayerMove(move: { playerId: string; x: number; y: number; timestamp?: number }): void {
    const player = this.worldState.getPlayer(move.playerId);
    if (player) {
      // Atualiza o estado do jogador no worldState
      this.worldState.updatePlayer(move.playerId, {
        x: move.x,
        y: move.y,
        lastUpdate: move.timestamp ?? Date.now()
      });
      
      // Obtém o estado atualizado e atualiza o sprite
      const updatedPlayer = this.worldState.getPlayer(move.playerId);
      if (updatedPlayer) {
        this.spriteManager.updatePlayerSprite(updatedPlayer);
      }
    }
  }

  /**
   * Sincroniza renderização de jogadores remotos com snapshots do servidor.
   * 
   * Para cada jogador remoto no snapshot:
   * - Cria novo sprite se não existir (diferente do jogador local)
   * - Atualiza posição alvo para interpolação suave
   * - Atualiza HP e estado visual
   * - Descarta updates antigos usando timestamp
   * 
   * Remove sprites de jogadores que saíram/desconectaram.
   */
  syncRemotePlayers(players: RemotePlayer[], clientId: string | null): void {
    console.log(`[MP:Sync] Sincronizando ${players.length} jogadores do servidor`);
    const seen = new Set<string>();
    
    for (const p of players) {
      // Filtra o jogador local para evitar duplicação
      if (clientId && p.id === clientId) {
        continue;
      }
      
      seen.add(p.id);
      
      const updateTimestamp = p.lastUpdate ?? Date.now();
      const existingPlayer = this.worldState.getPlayer(p.id);
      
      // Cria novo jogador remoto se não existir
      if (!existingPlayer) {
        const playerState: import("../../../game/worldState").PlayerState = {
          id: p.id,
          name: p.name,
          x: p.x,
          y: p.y,
          hp: p.hp ?? 100,
          maxHp: p.maxHp ?? 100,
          lastUpdate: updateTimestamp,
          color: 0x00ffff, // Ciano para jogadores remotos
          radius: 12,
          actionType: "idle",
          actionTimer: 0,
          isVisible: true
        };
        this.worldState.addPlayer(playerState);
        // Usar SpriteManager
        this.spriteManager.createPlayerSprite(playerState);
      } else {
        // Descarta updates antigos
        if (updateTimestamp < existingPlayer.lastUpdate) {
          continue;
        }
        
        // Atualiza estado no worldState
        this.worldState.updatePlayer(p.id, {
          x: p.x,
          y: p.y,
          name: p.name,
          hp: p.hp ?? existingPlayer.hp,
          maxHp: p.maxHp ?? existingPlayer.maxHp,
          lastUpdate: updateTimestamp
        });
        
        // Atualiza sprite
        const updatedPlayer = this.worldState.getPlayer(p.id)!;
        this.spriteManager.updatePlayerSprite(updatedPlayer);
      }
    }

    // Remove jogadores que saíram da sala
    for (const playerId of this.worldState.players.keys()) {
      // Não remove o jogador local
      if (clientId && playerId === clientId) {
        continue;
      }
      
      if (!seen.has(playerId)) {
        console.log(`[MP:Sync] Removendo jogador que saiu: ${playerId.slice(0, 8)}...`);
        this.worldState.removePlayer(playerId);
        this.spriteManager.destroyPlayerSprite(playerId);
      }
    }
  }
}
