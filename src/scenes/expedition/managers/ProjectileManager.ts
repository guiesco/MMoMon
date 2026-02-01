import Phaser from "phaser";
import { COMBAT_CONFIG, ENEMY_VISUAL_CONFIG } from "../../../game/constants";
import type { 
  Projectile, 
  EnemyProjectile, 
  PokeballProjectile, 
  RemoteProjectileSprite 
} from "../types/ExpeditionTypes";
import type { RemoteCreatureSprite } from "../types/ExpeditionTypes";
import type { MultiplayerClient } from "../../../services/multiplayerClient";

/**
 * Gerencia todos os projéteis da expedição.
 * Inclui projéteis do jogador, inimigos, pokébolas e projéteis remotos.
 */
export class ProjectileManager {
  private scene: Phaser.Scene;
  private projectiles: Projectile[] = [];
  private enemyProjectiles: EnemyProjectile[] = [];
  private pokeballProjectiles: PokeballProjectile[] = [];
  private remoteProjectiles: Map<string, RemoteProjectileSprite> = new Map();
  private getAllCreatures: () => RemoteCreatureSprite[];
  private removeCreature: (id: string) => void;
  private updateCreatureHp: (id: string, hp: number) => void;
  private worldState: any;
  private telemetry: any;
  private mpClient: MultiplayerClient | null;
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private dealDamageToPlayer: (damage: number) => void;
  private createDeathEffect: (x: number, y: number, theme: any) => void;
  private createEnhancedFloatingText: (x: number, y: number, text: string, color: number, fontSize?: number) => void;
  private attemptCapture: (creature: RemoteCreatureSprite, ballType: string) => void;
  private sendCaptureAttempt: (creatureId: string, ballType: string) => void;

  constructor(
    scene: Phaser.Scene,
    player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    dependencies: {
      getAllCreatures: () => RemoteCreatureSprite[];
      removeCreature: (id: string) => void;
      updateCreatureHp: (id: string, hp: number) => void;
      worldState: any;
      telemetry: any;
      mpClient: MultiplayerClient | null;
      dealDamageToPlayer: (damage: number) => void;
      createDeathEffect: (x: number, y: number, theme: any) => void;
      createEnhancedFloatingText: (x: number, y: number, text: string, color: number, fontSize?: number) => void;
      attemptCapture: (creature: RemoteCreatureSprite, ballType: string) => void;
      sendCaptureAttempt: (creatureId: string, ballType: string) => void;
    }
  ) {
    this.scene = scene;
    this.player = player;
    this.getAllCreatures = dependencies.getAllCreatures;
    this.removeCreature = dependencies.removeCreature;
    this.updateCreatureHp = dependencies.updateCreatureHp;
    this.worldState = dependencies.worldState;
    this.telemetry = dependencies.telemetry;
    this.mpClient = dependencies.mpClient;
    this.dealDamageToPlayer = dependencies.dealDamageToPlayer;
    this.createDeathEffect = dependencies.createDeathEffect;
    this.createEnhancedFloatingText = dependencies.createEnhancedFloatingText;
    this.attemptCapture = dependencies.attemptCapture;
    this.sendCaptureAttempt = dependencies.sendCaptureAttempt;
  }

  /**
   * Adiciona um projétil do jogador.
   */
  addProjectile(projectile: Projectile): void {
    this.projectiles.push(projectile);
  }

  /**
   * Adiciona um projétil de inimigo.
   */
  addEnemyProjectile(projectile: EnemyProjectile): void {
    this.enemyProjectiles.push(projectile);
  }

  /**
   * Adiciona um projétil de pokébola.
   */
  addPokeballProjectile(projectile: PokeballProjectile): void {
    this.pokeballProjectiles.push(projectile);
  }

  /**
   * Adiciona ou atualiza um projétil remoto.
   */
  addRemoteProjectile(projectile: RemoteProjectileSprite): void {
    this.remoteProjectiles.set(projectile.id, projectile);
  }

  /**
   * Remove um projétil remoto.
   */
  removeRemoteProjectile(id: string): void {
    const proj = this.remoteProjectiles.get(id);
    if (proj) {
      proj.sprite.destroy();
      this.remoteProjectiles.delete(id);
    }
  }

  /**
   * Obtém um projétil remoto por ID.
   */
  getRemoteProjectile(id: string): RemoteProjectileSprite | undefined {
    return this.remoteProjectiles.get(id);
  }

  /**
   * Obtém todos os projéteis remotos.
   */
  getAllRemoteProjectiles(): RemoteProjectileSprite[] {
    return Array.from(this.remoteProjectiles.values());
  }

  /**
   * Atualiza todos os projéteis do jogador.
   */
  updateProjectiles(dt: number, state: string): string {
    const remaining: Projectile[] = [];

    for (const proj of this.projectiles) {
      proj.lifetime -= dt;
      if (proj.lifetime <= 0) {
        proj.sprite.destroy();
        continue;
      }

      const projBounds = proj.sprite.getBounds();
      let hit = false;
      
      const creaturesInRange = this.getAllCreatures();
      const creaturesToRemove: string[] = [];
      
      for (const wc of creaturesInRange) {
        const wBounds = wc.sprite.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(projBounds, wBounds)) {
          hit = true;
          const damage = (proj.sprite as any).basicDamage ?? COMBAT_CONFIG.projectileDamage;
          
          const newHp = wc.currentHp - damage;
          wc.currentHp = newHp;
          this.updateCreatureHp(wc.id, newHp);
          
          this.telemetry.damageDealt += damage;
          this.telemetry.combatEncounters += 1;

          // Atualiza cor do sprite baseado no HP
          const ratio = Math.max(0, wc.currentHp / wc.maxHp);
          if (ratio > 0.5) {
            wc.sprite.setFillStyle(wc.sprite.fillColor);
          } else if (ratio > 0.25) {
            wc.sprite.setFillStyle(0xfacc15);
          } else {
            wc.sprite.setFillStyle(0xef4444);
          }

          if (wc.currentHp <= 0) {
            const projTheme = (proj.sprite as any).creatureTheme;
            if (projTheme) {
              this.createDeathEffect(wc.sprite.x, wc.sprite.y, projTheme);
            }
            creaturesToRemove.push(wc.id);
          }
          break;
        }
      }
      
      // Remove criaturas mortas
      for (const creatureId of creaturesToRemove) {
        this.removeCreature(creatureId);
      }

      if (!hit) {
        remaining.push(proj);
      } else {
        proj.sprite.destroy();
      }
    }

    this.projectiles = remaining;

    // Retorna novo estado se necessário
    if (this.getAllCreatures().length === 0 && state === "combat") {
      return "exploring";
    }
    return state;
  }

  /**
   * Atualiza projéteis de inimigos.
   */
  updateEnemyProjectiles(dt: number): void {
    const remaining: EnemyProjectile[] = [];
    const playerBounds = new Phaser.Geom.Circle(this.player.x, this.player.y, 16);

    for (const proj of this.enemyProjectiles) {
      proj.lifetime -= dt;

      if (proj.lifetime <= 0) {
        proj.sprite.destroy();
        continue;
      }

      proj.sprite.x += proj.velocityX * dt;
      proj.sprite.y += proj.velocityY * dt;

      const projBounds = new Phaser.Geom.Circle(
        proj.sprite.x,
        proj.sprite.y,
        ENEMY_VISUAL_CONFIG.enemyProjectileRadius
      );

      if (Phaser.Geom.Intersects.CircleToCircle(projBounds, playerBounds)) {
        this.dealDamageToPlayer(proj.damage);
        proj.sprite.destroy();
        continue;
      }

      remaining.push(proj);
    }

    this.enemyProjectiles = remaining;
  }

  /**
   * Atualiza projéteis de pokébola.
   */
  updatePokeballProjectiles(dt: number): void {
    const pokeballRadius = 8;
    const creatureRadius = 18;

    for (let i = this.pokeballProjectiles.length - 1; i >= 0; i--) {
      const pb = this.pokeballProjectiles[i];
      
      // Atualiza posição
      pb.sprite.x += pb.velocityX * dt;
      pb.sprite.y += pb.velocityY * dt;
      pb.lifetime -= dt;

      // Remove se expirou
      if (pb.lifetime <= 0) {
        pb.sprite.destroy();
        this.pokeballProjectiles.splice(i, 1);
        continue;
      }

      let hitCreature = false;

      // Verifica colisão com criaturas (multiplayer)
      if (this.mpClient) {
        const creaturesInRange = this.getAllCreatures();
        for (const creatureSprite of creaturesInRange) {
          const dx = pb.sprite.x - creatureSprite.sprite.x;
          const dy = pb.sprite.y - creatureSprite.sprite.y;
          const dist = Math.hypot(dx, dy);

          if (dist < pokeballRadius + creatureRadius) {
            // Feedback visual imediato
            this.createEnhancedFloatingText(
              creatureSprite.sprite.x,
              creatureSprite.sprite.y - 20,
              "⚡ Capturando...",
              0xfbbf24,
              18
            );
            
            // Efeito visual de impacto
            const impactCircle = this.scene.add.circle(
              creatureSprite.sprite.x,
              creatureSprite.sprite.y,
              creatureRadius,
              0xfbbf24,
              0.4
            );
            this.scene.tweens.add({
              targets: impactCircle,
              radius: creatureRadius + 15,
              alpha: 0,
              duration: 300,
              ease: "Cubic.easeOut",
              onComplete: () => impactCircle.destroy()
            });
            
            // Envia tentativa de captura
            this.sendCaptureAttempt(creatureSprite.id, pb.ballType);
            pb.sprite.destroy();
            this.pokeballProjectiles.splice(i, 1);
            hitCreature = true;
            break;
          }
        }
      }

      if (hitCreature) continue;

      // Verifica colisão com criaturas (single-player)
      const creaturesInRange = this.getAllCreatures();
      for (const wc of creaturesInRange) {
        const dx = pb.sprite.x - wc.sprite.x;
        const dy = pb.sprite.y - wc.sprite.y;
        const dist = Math.hypot(dx, dy);

        if (dist < pokeballRadius + creatureRadius) {
          this.attemptCapture(wc, pb.ballType);
          pb.sprite.destroy();
          this.pokeballProjectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  /**
   * Atualiza projéteis remotos (renderização apenas).
   */
  updateRemoteProjectiles(dt: number): void {
    for (const [id, proj] of this.remoteProjectiles) {
      proj.lifetime -= dt;
      
      if (proj.lifetime <= 0) {
        proj.sprite.destroy();
        this.remoteProjectiles.delete(id);
        continue;
      }

      // Atualiza posição visual
      proj.sprite.x += proj.velocityX * dt;
      proj.sprite.y += proj.velocityY * dt;
    }
  }

  /**
   * Atualiza todos os projéteis.
   */
  update(dt: number, state: string): string {
    const newState = this.updateProjectiles(dt, state);
    this.updateEnemyProjectiles(dt);
    this.updatePokeballProjectiles(dt);
    this.updateRemoteProjectiles(dt);
    return newState;
  }

  /**
   * Limpa todos os projéteis.
   */
  clear(): void {
    for (const proj of this.projectiles) {
      proj.sprite.destroy();
    }
    for (const proj of this.enemyProjectiles) {
      proj.sprite.destroy();
    }
    for (const proj of this.pokeballProjectiles) {
      proj.sprite.destroy();
    }
    for (const proj of this.remoteProjectiles.values()) {
      proj.sprite.destroy();
    }
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.pokeballProjectiles = [];
    this.remoteProjectiles.clear();
  }

  /**
   * Atualiza a referência do cliente multiplayer.
   * Deve ser chamado após a conexão ser estabelecida.
   */
  setMpClient(mpClient: MultiplayerClient | null): void {
    this.mpClient = mpClient;
  }
}
