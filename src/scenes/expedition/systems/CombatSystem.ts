import Phaser from "phaser";
import { COMBAT_CONFIG } from "../../../game/constants";
import { getEffectiveStats } from "../../../game/creatureProgression";
import { PlayerState as LocalPlayerState } from "../../../game/playerState";
import type { CreatureDefinition } from "../../../game/types";
import type { CreatureTheme } from "../../../game/creatureThemes";
import type { MultiplayerClient } from "../../../services/multiplayerClient";
import type { RemoteCreatureSprite } from "../types/ExpeditionTypes";
import type { ProjectileManager } from "../managers/ProjectileManager";
import type { ExpeditionTelemetry, ExpeditionState } from "../types/ExpeditionTypes";

/**
 * Gerencia ataques básicos do jogador.
 * Apenas visual - toda lógica é processada no servidor.
 */
export class CombatSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private activeCreatureDef: CreatureDefinition | null = null;
  private activeCreatureTheme: CreatureTheme | null = null;
  private activeCreatureInstanceId: string | null = null;
  private basicAttackCooldown = 0;
  private basicAttackCooldownTime = 0.8;
  private basicAttackWindup = 0;
  private pendingAttack: { targetX: number; targetY: number } | null = null;
  private mpClient: MultiplayerClient | null = null;
  private projectileManager: ProjectileManager;
  private getAllCreatures: () => RemoteCreatureSprite[];
  private telemetry: ExpeditionTelemetry;
  private createHitImpactEffect: (x: number, y: number, theme: CreatureTheme | null) => void;
  private createDeathEffect: (x: number, y: number, theme: CreatureTheme | null) => void;
  private createMuzzleFlash: (x: number, y: number, angle: number, theme: CreatureTheme | null) => void;

  constructor(
    scene: Phaser.Scene,
    player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    projectileManager: ProjectileManager,
    getAllCreatures: () => RemoteCreatureSprite[],
    telemetry: ExpeditionTelemetry,
    createHitImpactEffect: (x: number, y: number, theme: CreatureTheme | null) => void,
    createDeathEffect: (x: number, y: number, theme: CreatureTheme | null) => void,
    createMuzzleFlash: (x: number, y: number, angle: number, theme: CreatureTheme | null) => void
  ) {
    this.scene = scene;
    this.player = player;
    this.projectileManager = projectileManager;
    this.getAllCreatures = getAllCreatures;
    this.telemetry = telemetry;
    this.createHitImpactEffect = createHitImpactEffect;
    this.createDeathEffect = createDeathEffect;
    this.createMuzzleFlash = createMuzzleFlash;
  }

  /**
   * Tenta executar um ataque básico.
   */
  tryBasicAttack(targetX: number, targetY: number): boolean {
    if (this.basicAttackCooldown > 0) return false;
    if (this.basicAttackWindup > 0) return false; // Já está em windup
    
    const def = this.activeCreatureDef;
    if (!def) return false;

    // Obter stats efetivos para usar valores de windup
    const progress = LocalPlayerState.getProgress();
    const owned = this.activeCreatureInstanceId 
      ? progress.creatures.find((c) => c.instanceId === this.activeCreatureInstanceId)
      : null;
    const effectiveStats = owned ? getEffectiveStats(owned) : null;
    const windupTime = effectiveStats?.attackWindup ?? def.basicAttack.attackWindup ?? 0.4;

    // ✅ WINDUP SINCRONIZADO: Em multiplayer, iniciar windup e aguardar resposta do servidor
    // O servidor também processa windup, então ambos devem estar sincronizados
    if (this.mpClient) {
      const creatureId = def.id;
      const creatureLevel = owned?.level ?? 1;
      const creatureRank = owned?.rank ?? 1;
      
      // Enviar intent ao servidor (servidor iniciará windup)
      this.mpClient.sendAttack(targetX, targetY, creatureId, "basic", creatureLevel, creatureRank);
      
      // ✅ Iniciar windup local (sincronizado com servidor)
      if (windupTime > 0) {
        this.basicAttackWindup = windupTime;
        this.pendingAttack = { targetX, targetY };
        // Não criar projétil ainda - aguardar windup terminar
      } else {
        // Se não há windup, criar projétil imediatamente (predição local)
        this.executeBasicAttack(targetX, targetY);
      }
      
      return true;
    }
    
    // Comportamento single-player: windup bloqueia o ataque
    if (windupTime > 0) {
      this.basicAttackWindup = windupTime;
      this.pendingAttack = { targetX, targetY };
      return true;
    }

    // Se não há windup, executar ataque imediatamente
    this.executeBasicAttack(targetX, targetY);
    return true;
  }

  /**
   * Executa o ataque básico (chamado após windup ou imediatamente se windup = 0).
   */
  private executeBasicAttack(targetX: number, targetY: number): void {
    const def = this.activeCreatureDef;
    if (!def) return;

    // Inicia cooldown imediatamente (local)
    this.basicAttackCooldown = this.basicAttackCooldownTime;

    // Em modo multiplayer, apenas criar visual de predição local
    if (this.mpClient) {
      const basic = def.basicAttack;
      const theme = this.activeCreatureTheme;
      
      const progress = LocalPlayerState.getProgress();
      const owned = this.activeCreatureInstanceId 
        ? progress.creatures.find((c) => c.instanceId === this.activeCreatureInstanceId)
        : null;
      const effectiveStats = owned ? getEffectiveStats(owned) : null;
      const attackRange = effectiveStats?.attackRange ?? basic.range ?? 200;
      const projectileSpeed = effectiveStats?.projectileSpeed ?? COMBAT_CONFIG.projectileSpeed;
      
      // Verificar se é ataque melee ou ranged
      if (!basic.isProjectile) {
        // Ataque melee: criar visual de arco
        const attackAngle = Phaser.Math.Angle.Between(
          this.player.x,
          this.player.y,
          targetX,
          targetY
        );
        this.createMeleeSwingVisual(attackAngle, attackRange, theme);
      } else {
        // Ataque ranged: criar projétil visual
        const angle = Phaser.Math.Angle.Between(
          this.player.x,
          this.player.y,
          targetX,
          targetY
        );

        const projectileColor = theme?.attackColor ?? 0xf97316;
        const projectileRadius = theme?.projectileRadius ?? 4;
        const speed = projectileSpeed;
        
        // ✅ Calcular velocidade em pixels por segundo (igual ao servidor)
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;
        
        const sprite = this.scene.add.circle(
          this.player.x,
          this.player.y,
          projectileRadius,
          projectileColor
        );
        sprite.setStrokeStyle(1, theme?.strokeColor ?? 0xea580c, 0.8);
        // ✅ NÃO usar physics body - atualizar manualmente para sincronização
        // this.scene.physics.add.existing(sprite);
        // const body = sprite.body as Phaser.Physics.Arcade.Body;
        // body.setVelocity(velocityX, velocityY);
        // body.setAllowGravity(false);

        this.createMuzzleFlash(this.player.x, this.player.y, angle, theme);

        const lifetime = attackRange > 0
          ? attackRange / speed
          : COMBAT_CONFIG.projectileLifetime;

        this.projectileManager.addProjectile({
          sprite,
          lifetime,
          velocityX, // ✅ Armazenar velocidade para atualização manual
          velocityY
        });
      }
      
      this.telemetry.projectilesFired += 1;
      return;
    }

    // Comportamento single-player (fallback)
    const basic = def.basicAttack;
    const progress = LocalPlayerState.getProgress();
    const owned = this.activeCreatureInstanceId 
      ? progress.creatures.find((c) => c.instanceId === this.activeCreatureInstanceId)
      : null;
    const effectiveStats = owned ? getEffectiveStats(owned) : null;
    const attackRange = effectiveStats?.attackRange ?? basic.range;
    const projectileSpeed = effectiveStats?.projectileSpeed ?? COMBAT_CONFIG.projectileSpeed;

    if (!basic.isProjectile) {
      // Ataque melee
      const radius = attackRange;
      const theme = this.activeCreatureTheme;
      const attackAngle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        targetX,
        targetY
      );
      this.createMeleeSwingVisual(attackAngle, radius, theme);
      this.telemetry.projectilesFired += 1;
    } else {
      // Ataque ranged
      const angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        targetX,
        targetY
      );

      const theme = this.activeCreatureTheme;
      const projectileColor = theme?.attackColor ?? 0xf97316;
      const projectileRadius = theme?.projectileRadius ?? 4;
      const speed = projectileSpeed;
      
      // ✅ Calcular velocidade em pixels por segundo (igual ao servidor)
      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;
      
      const sprite = this.scene.add.circle(
        this.player.x,
        this.player.y,
        projectileRadius,
        projectileColor
      );
      sprite.setStrokeStyle(1, theme?.strokeColor ?? 0xea580c, 0.8);
      // ✅ NÃO usar physics body - atualizar manualmente para sincronização
      // this.scene.physics.add.existing(sprite);
      // const body = sprite.body as Phaser.Physics.Arcade.Body;
      // body.setVelocity(velocityX, velocityY);
      // body.setAllowGravity(false);

      this.createMuzzleFlash(this.player.x, this.player.y, angle, theme);

      const lifetime = attackRange > 0
        ? attackRange / speed
        : COMBAT_CONFIG.projectileLifetime;

      this.projectileManager.addProjectile({
        sprite,
        lifetime,
        velocityX, // ✅ Armazenar velocidade para atualização manual
        velocityY
      });
      this.telemetry.projectilesFired += 1;
    }
  }

  /**
   * Cria um visual de arco para ataques melee.
   */
  private createMeleeSwingVisual(
    angle: number,
    radius: number,
    theme: CreatureTheme | null
  ): void {
    const color = theme?.attackColor ?? 0x4ade80;
    const startAngle = angle - Math.PI / 4;
    const endAngle = angle + Math.PI / 4;

    const graphics = this.scene.add.graphics();
    graphics.lineStyle(3, color, 0.8);
    graphics.beginPath();
    graphics.arc(
      this.player.x,
      this.player.y,
      radius,
      startAngle,
      endAngle,
      false
    );
    graphics.strokePath();

    graphics.fillStyle(color, 0.25);
    graphics.beginPath();
    graphics.moveTo(this.player.x, this.player.y);
    graphics.arc(
      this.player.x,
      this.player.y,
      radius,
      startAngle,
      endAngle,
      false
    );
    graphics.closePath();
    graphics.fillPath();

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 150,
      onComplete: () => graphics.destroy()
    });
  }

  /**
   * Atualiza cooldowns e windup.
   */
  update(dt: number): void {
    if (this.basicAttackCooldown > 0) {
      this.basicAttackCooldown = Math.max(0, this.basicAttackCooldown - dt);
    }
    
    if (this.basicAttackWindup > 0) {
      this.basicAttackWindup = Math.max(0, this.basicAttackWindup - dt);
      
      // ✅ Executar ataque após windup terminar
      if (this.basicAttackWindup <= 0 && this.pendingAttack) {
        const { targetX, targetY } = this.pendingAttack;
        this.pendingAttack = null;
        
        // Em multiplayer, o servidor já processou o ataque após windup
        // Mas criamos o projétil visual localmente para predição
        if (this.mpClient) {
          this.executeBasicAttack(targetX, targetY);
        } else {
          // Single-player: executar ataque após windup
          this.executeBasicAttack(targetX, targetY);
        }
      }
    }
  }
  
  /**
   * ✅ Verifica se o jogador está em windup (bloqueia movimento).
   */
  isInWindup(): boolean {
    return this.basicAttackWindup > 0;
  }
  
  /**
   * ✅ Retorna o tempo restante de windup (para efeito visual).
   */
  getWindupTime(): number {
    return this.basicAttackWindup;
  }
  
  /**
   * ✅ Verifica se o jogador está em windup de skill (bloqueia movimento).
   */
  isInSkillWindup(skillSystem: { isInSkillWindup: () => boolean } | null): boolean {
    return skillSystem?.isInSkillWindup() ?? false;
  }
  
  /**
   * ✅ Retorna o tempo restante de windup de skill (para efeito visual).
   */
  getSkillWindupTime(skillSystem: { getSkillWindupTime: () => number } | null): number {
    return skillSystem?.getSkillWindupTime() ?? 0;
  }

  // Setters
  setActiveCreature(def: CreatureDefinition | null, theme: CreatureTheme | null, instanceId: string | null): void {
    this.activeCreatureDef = def;
    this.activeCreatureTheme = theme;
    this.activeCreatureInstanceId = instanceId;
  }

  setCooldownTime(time: number): void {
    this.basicAttackCooldownTime = time;
  }

  setMpClient(mpClient: MultiplayerClient | null): void {
    this.mpClient = mpClient;
  }

  get cooldown(): number {
    return this.basicAttackCooldown;
  }

  get isOnCooldown(): boolean {
    return this.basicAttackCooldown > 0;
  }

  /**
   * Processa input de combate (ataque, skill, cura).
   */
  handleCombatInput(
    attackKey: Phaser.Input.Keyboard.Key,
    skillKey: Phaser.Input.Keyboard.Key,
    healKey: Phaser.Input.Keyboard.Key,
    playerX: number,
    playerY: number,
    tryUseSkill: (x: number, y: number) => void,
    tryUsePotion: (x: number, y: number) => void,
    isLoadingVisible: () => boolean
  ): void {
    if (Phaser.Input.Keyboard.JustDown(attackKey)) {
      const pointer = this.scene.input.activePointer;
      pointer.updateWorldPoint(this.scene.cameras.main);
      if (!isLoadingVisible()) {
        this.tryBasicAttack(pointer.worldX, pointer.worldY);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(skillKey)) {
      const pointer = this.scene.input.activePointer;
      pointer.updateWorldPoint(this.scene.cameras.main);
      tryUseSkill(pointer.worldX, pointer.worldY);
    }

    if (Phaser.Input.Keyboard.JustDown(healKey)) {
      tryUsePotion(playerX, playerY);
    }
  }
}
