import type { 
  RemoteCreature, 
  RemoteResource, 
  AttackResult, 
  CaptureResult,
  ExtractionState,
  MatchEvent,
  PlayerDeath,
  RemotePlayer,
  RemoteProjectile
} from "../../../services/multiplayerClient";
import type { GameWorldState } from "../../../game/worldState";
import type { RemoteCreatureSprite, RemoteResourceSprite } from "../types/ExpeditionTypes";
import type { SpriteManager } from "../managers/SpriteManager";
import type { ExpeditionTelemetry, ExpeditionState } from "../types/ExpeditionTypes";
import { ENEMY_AI_CONFIG } from "../../../game/constants";
import type { ThreatTier, EnemyBehaviorType, EnemyAIState } from "../../../game/constants";

/**
 * Handlers para eventos multiplayer.
 * Centraliza toda a lógica de sincronização com o servidor.
 */
export class MultiplayerHandlers {
  private worldState: GameWorldState;
  private spriteManager: SpriteManager;
  private telemetry: ExpeditionTelemetry;
  private creatureSprites: Map<string, RemoteCreatureSprite>;
  private resourceSprites: Map<string, RemoteResourceSprite>;

  constructor(
    worldState: GameWorldState,
    spriteManager: SpriteManager,
    telemetry: ExpeditionTelemetry,
    creatureSprites: Map<string, RemoteCreatureSprite>,
    resourceSprites: Map<string, RemoteResourceSprite>
  ) {
    this.worldState = worldState;
    this.spriteManager = spriteManager;
    this.telemetry = telemetry;
    this.creatureSprites = creatureSprites;
    this.resourceSprites = resourceSprites;
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
          behaviorType: (remoteCreature.behaviorType as any) ?? existingCreature.behaviorType
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
          aiConfig: ENEMY_AI_CONFIG[tier][behaviorType],
          attackCooldownRemaining: remoteCreature.attackCooldownRemaining ?? 0,
          windupTimer: remoteCreature.windupTimer ?? 0,
          stunTimer: remoteCreature.stunTimer ?? 0,
          patrolOrigin: { 
            x: remoteCreature.patrolOriginX ?? remoteCreature.x, 
            y: remoteCreature.patrolOriginY ?? remoteCreature.y 
          },
          patrolTimer: remoteCreature.patrolTimer ?? 0,
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
   * Handler para resultado de ataque.
   */
  handleAttackResult(result: AttackResult): void {
    // Atualizar telemetria se houver dano aplicado
    if (result.targetId && result.damage > 0) {
      this.telemetry.damageDealt += result.damage;
      this.telemetry.combatEncounters += 1;
    }
  }

  /**
   * Handler para resultado de captura.
   */
  handleCaptureResult(result: CaptureResult): void {
    if (result.success) {
      this.telemetry.creaturesCaptured += 1;
      this.telemetry.captureSuccesses += 1;
      if (result.creatureId) {
        this.worldState.removeCreature(result.creatureId);
        this.spriteManager.destroyCreatureSprite(result.creatureId);
      }
    } else {
      this.telemetry.captureFailures += 1;
    }
  }

  /**
   * Handler para estado de extração.
   */
  handleExtractionState(state: ExtractionState): ExtractionState {
    // Retorna o novo estado para ser aplicado pela cena
    if (state.status === "in_progress") {
      return "extracting";
    } else if (state.status === "completed") {
      this.telemetry.extractionSuccess = true;
      return "extracted";
    } else {
      return "exploring";
    }
  }

  /**
   * Handler para eventos de partida.
   */
  handleMatchEvent(event: MatchEvent): void {
    // Log de eventos de partida
    console.log("[MP] Evento de partida:", event.event);
  }

  /**
   * Handler para morte de jogador.
   */
  handlePlayerDeath(death: PlayerDeath): void {
    // Log de morte
    console.log("[MP] Jogador morreu:", death.playerId);
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
   * Handler para atualização de projéteis remotos.
   */
  handleProjectilesUpdate(projectiles: RemoteProjectile[]): void {
    // Implementação será delegada ao ProjectileManager
    // Por enquanto apenas log
    if (projectiles.length > 0) {
      console.log(`[MP] ${projectiles.length} projéteis remotos recebidos`);
    }
  }

  /**
   * Handler para atualização de zonas de skill.
   */
  handleSkillZonesUpdate(zones: any[]): void {
    // Implementação será delegada ao SkillZoneManager
    if (zones.length > 0) {
      console.log(`[MP] ${zones.length} zonas de skill recebidas`);
    }
  }
}
