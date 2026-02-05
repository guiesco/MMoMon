import Phaser from "phaser";
import { COMBAT_CONFIG, ENEMY_VISUAL_CONFIG } from "../../../game/constants";
import type { 
  Projectile, 
  EnemyProjectile, 
  PokeballProjectile, 
  RemoteProjectileSprite 
} from "../types/ExpeditionTypes";
import type { RemoteCreatureSprite } from "../types/ExpeditionTypes";
import type { MultiplayerClient, RemoteProjectile } from "../../../services/multiplayerClient";
import { getCreatureTheme } from "../../../game/creatureThemes";

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
  private sendCaptureAttempt: (creatureId: string, ballType: string) => void;
  // ✅ Rastrear projéteis locais recentes para remoção quando servidor confirmar hit
  private recentLocalProjectiles: Projectile[] = [];
  private readonly MAX_RECENT_PROJECTILES = 5; // Manter apenas os 5 mais recentes

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
    this.sendCaptureAttempt = dependencies.sendCaptureAttempt;
  }

  /**
   * Adiciona um projétil do jogador.
   */
  addProjectile(projectile: Projectile): void {
    this.projectiles.push(projectile);
    // ✅ Rastrear projéteis locais recentes para remoção quando servidor confirmar
    this.recentLocalProjectiles.push(projectile);
    // Manter apenas os mais recentes
    if (this.recentLocalProjectiles.length > this.MAX_RECENT_PROJECTILES) {
      this.recentLocalProjectiles.shift();
    }
  }
  
  /**
   * ✅ Remove projétil local quando servidor confirma hit.
   * Procura o projétil mais próximo do alvo e o remove.
   */
  removeLocalProjectileForHit(targetId: string, targetX: number, targetY: number): boolean {
    // Procurar projétil local que está mais próximo do alvo
    let closestProjectile: Projectile | null = null;
    let closestDistance = Infinity;
    
    for (const proj of this.recentLocalProjectiles) {
      if (!proj.sprite || !proj.sprite.active) continue;
      
      const dx = proj.sprite.x - targetX;
      const dy = proj.sprite.y - targetY;
      const dist = Math.hypot(dx, dy);
      
      // Considerar projéteis que estão próximos do alvo (dentro de 100 pixels)
      if (dist < closestDistance && dist < 100) {
        closestDistance = dist;
        closestProjectile = proj;
      }
    }
    
    if (closestProjectile) {
      // Remover do array de projéteis ativos
      const index = this.projectiles.indexOf(closestProjectile);
      if (index !== -1) {
        this.projectiles.splice(index, 1);
      }
      
      // Remover do array de recentes
      const recentIndex = this.recentLocalProjectiles.indexOf(closestProjectile);
      if (recentIndex !== -1) {
        this.recentLocalProjectiles.splice(recentIndex, 1);
      }
      
      // Destruir sprite
      if (closestProjectile.sprite) {
        closestProjectile.sprite.destroy();
      }
      
      return true;
    }
    
    return false;
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
   * ✅ Em modo multiplayer, não processa colisões localmente (servidor é autoritativo).
   * ✅ Atualiza posição manualmente para sincronização com servidor.
   */
  updateProjectiles(dt: number, state: string): string {
    const remaining: Projectile[] = [];

    for (const proj of this.projectiles) {
      proj.lifetime -= dt;
      if (proj.lifetime <= 0) {
        proj.sprite.destroy();
        // Remover de recentes também
        const recentIndex = this.recentLocalProjectiles.indexOf(proj);
        if (recentIndex !== -1) {
          this.recentLocalProjectiles.splice(recentIndex, 1);
        }
        continue;
      }

      // ✅ Atualizar posição manualmente usando velocidade (igual ao servidor)
      if (proj.velocityX !== undefined && proj.velocityY !== undefined) {
        proj.sprite.x += proj.velocityX * dt;
        proj.sprite.y += proj.velocityY * dt;
      }

      // ✅ Em modo multiplayer, não processar colisões localmente
      // O servidor é autoritativo e enviará attackResult quando houver hit
      if (this.mpClient) {
        remaining.push(proj);
        continue;
      }

      // Comportamento single-player (fallback)
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
        // Remover de recentes também
        const recentIndex = this.recentLocalProjectiles.indexOf(proj);
        if (recentIndex !== -1) {
          this.recentLocalProjectiles.splice(recentIndex, 1);
        }
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

  /**
   * Handler para atualização de projéteis remotos.
   * Sincroniza projéteis de outros jogadores e IA do servidor.
   */
  handleProjectilesUpdate(projectiles: RemoteProjectile[], clientId: string | null, getCreatureSprite: (id: string) => RemoteCreatureSprite | undefined): void {
    const seen = new Set<string>();
    
    for (const proj of projectiles) {
      // Ignorar projéteis do jogador local (já são renderizados localmente)
      if (proj.ownerId === clientId) continue;
      
      seen.add(proj.id);
      
      const existing = this.getRemoteProjectile(proj.id);
      
      if (existing) {
        // Atualiza posição e velocidade
        existing.sprite.setPosition(proj.x, proj.y);
        existing.velocityX = proj.velocityX;
        existing.velocityY = proj.velocityY;
        existing.lifetime = proj.lifetime;
      } else {
        // Cria novo projétil remoto com cor baseada na criatura
        let color = 0xf97316; // Default laranja para jogador
        let strokeColor = 0xea580c;
        let radius = 4;
        
        if (!proj.isPlayerProjectile) {
          // Projétil de criatura: usar cor baseada na espécie da criatura
          const creatureSprite = getCreatureSprite(proj.ownerId);
          if (creatureSprite) {
            const creatureType = creatureSprite.speciesId ?? creatureSprite.creatureType ?? "";
            const theme = getCreatureTheme(creatureType);
            color = theme.attackColor;
            strokeColor = theme.primaryColor;
            radius = theme.projectileRadius || 5;
          } else {
            // Fallback: vermelho padrão se criatura não encontrada
            color = 0xff4444;
            strokeColor = 0xcc0000;
            radius = 5;
          }
        }
        
        const sprite = this.scene.add.circle(proj.x, proj.y, radius, color);
        sprite.setStrokeStyle(1, strokeColor, 0.8);
        sprite.setDepth(100); // Acima de outras entidades
        
        // Se é projétil de inimigo, criar efeito de disparo na origem
        if (!proj.isPlayerProjectile) {
          // Tentar encontrar a criatura que disparou para criar efeito visual
          const creatureSprite = getCreatureSprite(proj.ownerId);
          if (creatureSprite) {
            const creatureType = creatureSprite.speciesId ?? creatureSprite.creatureType ?? "";
            const theme = getCreatureTheme(creatureType);
            
            // Efeito de "muzzle flash" na criatura que atacou com cor do tema
            const flash = this.scene.add.circle(
              creatureSprite.sprite.x, 
              creatureSprite.sprite.y, 
              8, 
              theme.particleColor, 
              0.6
            );
            this.scene.tweens.add({
              targets: flash,
              alpha: 0,
              scale: 1.5,
              duration: 100,
              onComplete: () => flash.destroy()
            });
          }
        }
        
        this.addRemoteProjectile({
          id: proj.id,
          sprite,
          ownerId: proj.ownerId,
          isPlayerProjectile: proj.isPlayerProjectile,
          velocityX: proj.velocityX,
          velocityY: proj.velocityY,
          lifetime: proj.lifetime
        });
      }
    }
    
    // Remove projéteis que não existem mais no servidor
    const allRemoteProjectiles = this.getAllRemoteProjectiles();
    for (const proj of allRemoteProjectiles) {
      if (!seen.has(proj.id)) {
        this.removeRemoteProjectile(proj.id);
      }
    }
  }
}
