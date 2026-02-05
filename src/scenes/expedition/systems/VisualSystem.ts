import { ENEMY_VISUAL_CONFIG } from "../../../game/constants";
import type { RemoteCreatureSprite } from "../types/ExpeditionTypes";
import type { CreatureTheme } from "../../../game/creatureThemes";

/**
 * Gerencia visuais de feedback de criaturas (aggro, attack tells, etc).
 * Apenas visual - IA é processada no servidor.
 */
export class VisualSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private expeditionTime = 0;
  private dangerRing: Phaser.GameObjects.Arc | null = null;
  private dangerLowHpThreshold = 0.3; // 30% do HP
  private damageTakenRecently = 0;
  private damageTakenDecayTimer = 0;
  private activeHp = 0;
  private activeMaxHp = 0;
  private activeTheme: CreatureTheme | null = null;
  private windupIndicator: Phaser.GameObjects.Arc | null = null; // ✅ Indicador visual de windup de ataque
  private skillWindupIndicator: Phaser.GameObjects.Arc | null = null; // ✅ Indicador visual de windup de skill
  private combatSystem: { 
    isInWindup: () => boolean; 
    getWindupTime: () => number;
    isInSkillWindup: (skillSystem: any) => boolean;
    getSkillWindupTime: (skillSystem: any) => number;
  } | null = null; // ✅ Referência para verificar windup
  private skillSystem: { isInSkillWindup: () => boolean; getSkillWindupTime: () => number } | null = null; // ✅ Referência para skill system

  constructor(
    scene: Phaser.Scene,
    player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  ) {
    this.scene = scene;
    this.player = player;
  }

  /**
   * Configura o anel de perigo.
   */
  setDangerRing(ring: Phaser.GameObjects.Arc): void {
    this.dangerRing = ring;
  }

  /**
   * Atualiza referências para cálculo de perigo.
   */
  updateDangerReferences(
    activeHp: number,
    activeMaxHp: number,
    activeTheme: CreatureTheme | null,
    damageTakenRecently: number,
    damageTakenDecayTimer: number
  ): void {
    this.activeHp = activeHp;
    this.activeMaxHp = activeMaxHp;
    this.activeTheme = activeTheme;
    this.damageTakenRecently = damageTakenRecently;
    this.damageTakenDecayTimer = damageTakenDecayTimer;
  }
  
  /**
   * ✅ Define referência ao CombatSystem para verificar windup.
   */
  setCombatSystem(combatSystem: { 
    isInWindup: () => boolean; 
    getWindupTime: () => number;
    isInSkillWindup: (skillSystem: any) => boolean;
    getSkillWindupTime: (skillSystem: any) => number;
  } | null): void {
    this.combatSystem = combatSystem;
  }
  
  /**
   * ✅ Define referência ao SkillSystem para verificar windup de skill.
   */
  setSkillSystem(skillSystem: { isInSkillWindup: () => boolean; getSkillWindupTime: () => number } | null): void {
    this.skillSystem = skillSystem;
  }
  
  /**
   * ✅ Atualiza o indicador visual de windup do jogador (ataque e skill).
   */
  updatePlayerWindupVisual(): void {
    if (!this.combatSystem || !this.player) return;
    
    // Windup de ataque
    const isInWindup = this.combatSystem.isInWindup();
    const windupProgress = this.combatSystem.getWindupTime();
    
    if (isInWindup && windupProgress > 0) {
      // Criar ou atualizar indicador de windup de ataque
      if (!this.windupIndicator) {
        this.windupIndicator = this.scene.add.circle(
          this.player.x,
          this.player.y,
          this.player.body.radius + 8,
          0xffff00, // Amarelo para indicar preparação
          0.3
        );
        this.windupIndicator.setStrokeStyle(2, 0xffd700, 0.8);
        this.windupIndicator.setDepth(-1);
      }
      
      // Atualizar posição e animação
      this.windupIndicator.setPosition(this.player.x, this.player.y);
      this.windupIndicator.setVisible(true);
      
      // Pulsar durante windup
      const pulse = 0.5 + Math.sin(this.expeditionTime * 20) * 0.3;
      this.windupIndicator.setAlpha(pulse);
      
      // Mostrar progresso do windup (círculo que preenche)
      const maxWindup = 0.4; // Valor máximo de windup (ajustar conforme necessário)
      const progress = 1 - (windupProgress / maxWindup);
      const scale = 0.8 + progress * 0.4;
      this.windupIndicator.setScale(scale);
    } else {
      // Esconder indicador quando não está em windup
      if (this.windupIndicator) {
        this.windupIndicator.setVisible(false);
      }
    }
    
    // ✅ Windup de skill
    const isInSkillWindup = this.combatSystem.isInSkillWindup(this.skillSystem);
    const skillWindupProgress = this.combatSystem.getSkillWindupTime(this.skillSystem);
    
    if (isInSkillWindup && skillWindupProgress > 0) {
      // Criar ou atualizar indicador de windup de skill
      if (!this.skillWindupIndicator) {
        this.skillWindupIndicator = this.scene.add.circle(
          this.player.x,
          this.player.y,
          this.player.body.radius + 12,
          0xff00ff, // Magenta para indicar preparação de skill
          0.4
        );
        this.skillWindupIndicator.setStrokeStyle(3, 0xff00ff, 0.9);
        this.skillWindupIndicator.setDepth(-1);
      }
      
      // Atualizar posição e animação
      this.skillWindupIndicator.setPosition(this.player.x, this.player.y);
      this.skillWindupIndicator.setVisible(true);
      
      // Pulsar durante windup de skill (mais intenso)
      const pulse = 0.4 + Math.sin(this.expeditionTime * 25) * 0.4;
      this.skillWindupIndicator.setAlpha(pulse);
      
      // Mostrar progresso do windup
      const maxSkillWindup = 0.5;
      const progress = 1 - (skillWindupProgress / maxSkillWindup);
      const scale = 0.7 + progress * 0.5;
      this.skillWindupIndicator.setScale(scale);
    } else {
      // Esconder indicador quando não está em windup de skill
      if (this.skillWindupIndicator) {
        this.skillWindupIndicator.setVisible(false);
      }
    }
  }

  /**
   * Atualiza visuais de feedback da IA para todas as criaturas.
   */
  updateCreatureVisuals(creatures: RemoteCreatureSprite[]): void {
    for (const wc of creatures) {
      this.updateSingleCreatureVisual(wc);
    }
  }

  /**
   * Atualiza visuais de feedback de uma criatura específica.
   */
  private updateSingleCreatureVisual(wc: RemoteCreatureSprite): void {
    // Atualiza posição do indicador de aggro
    if (wc.aggroIndicator) {
      wc.aggroIndicator.setPosition(wc.sprite.x, wc.sprite.y);

      if (wc.aiState === "chasing" || wc.aiState === "attacking" || wc.aiState === "retreating") {
        wc.aggroIndicator.setAlpha(ENEMY_VISUAL_CONFIG.aggroIndicatorAlpha);
        if (wc.aiState === "attacking") {
          const pulse = 0.3 + Math.sin(this.expeditionTime * 15) * 0.15;
          wc.aggroIndicator.setAlpha(pulse);
        }
      } else {
        wc.aggroIndicator.setAlpha(0);
      }
    }

    // ✅ Tell de ataque (flash branco antes do golpe)
    // Verificar windupTimer diretamente do sprite (atualizado do servidor)
    const windupTimer = wc.windupTimer ?? 0;
    if (wc.aiState === "attacking" && windupTimer > 0) {
      if (!wc.attackTellIndicator) {
        wc.attackTellIndicator = this.scene.add.circle(
          wc.sprite.x,
          wc.sprite.y,
          wc.sprite.radius + 4,
          ENEMY_VISUAL_CONFIG.attackTellColor,
          ENEMY_VISUAL_CONFIG.attackTellAlpha
        );
        if (wc.attackTellIndicator) {
          wc.attackTellIndicator.setDepth(-1);
        }
      }
      if (wc.attackTellIndicator) {
        wc.attackTellIndicator.setPosition(wc.sprite.x, wc.sprite.y);
        wc.attackTellIndicator.setVisible(true);
        const flashIntensity = Math.sin(this.expeditionTime * 25) * 0.3 + 0.5;
        wc.attackTellIndicator.setAlpha(flashIntensity);
      }
    } else if (wc.attackTellIndicator) {
      wc.attackTellIndicator.setVisible(false);
    }
    
    // ✅ Tell de skill (flash colorido antes da skill)
    // Verificar skillWindupTimer diretamente do sprite (atualizado do servidor)
    const skillWindupTimer = wc.skillWindupTimer ?? 0;
    if (skillWindupTimer > 0) {
      if (!wc.skillTellIndicator) {
        wc.skillTellIndicator = this.scene.add.circle(
          wc.sprite.x,
          wc.sprite.y,
          wc.sprite.radius + 8,
          0xff00ff, // Magenta para skill
          0.5
        );
        if (wc.skillTellIndicator) {
          wc.skillTellIndicator.setStrokeStyle(3, 0xff00ff, 0.9);
          wc.skillTellIndicator.setDepth(-1);
        }
      }
      if (wc.skillTellIndicator) {
        wc.skillTellIndicator.setPosition(wc.sprite.x, wc.sprite.y);
        wc.skillTellIndicator.setVisible(true);
        const flashIntensity = 0.3 + Math.sin(this.expeditionTime * 30) * 0.5;
        wc.skillTellIndicator.setAlpha(flashIntensity);
        
        // Pulsar mais intenso para skills
        const pulse = 0.8 + Math.sin(this.expeditionTime * 30) * 0.3;
        wc.skillTellIndicator.setScale(pulse);
      }
    } else if (wc.skillTellIndicator) {
      wc.skillTellIndicator.setVisible(false);
    }
    
    // ✅ Detecta execução de ataque melee em multiplayer
    if (wc.aiState === "attacking" && windupTimer <= 0.05 && wc.behaviorType === "melee") {
      const dx = this.player.x - wc.sprite.x;
      const dy = this.player.y - wc.sprite.y;
      
      const now = this.expeditionTime;
      const lastAttackTime = (wc as any).lastMeleeAnimTime ?? 0;
      
      if (now - lastAttackTime > 0.5) { // Cooldown de 500ms entre animações
        this.createMeleeAttackVisualEnemy(wc.sprite.x, wc.sprite.y, dx, dy);
        (wc as any).lastMeleeAnimTime = now;
      }
    }
  }

  /**
   * Cria um efeito visual para ataque melee de inimigo.
   */
  private createMeleeAttackVisualEnemy(x: number, y: number, dx: number, dy: number): void {
    const dist = Math.hypot(dx, dy);
    const normalizedDx = dist > 0 ? dx / dist : 0;
    const normalizedDy = dist > 0 ? dy / dist : 1;

    const attackX = x + normalizedDx * 20;
    const attackY = y + normalizedDy * 20;

    const arc = this.scene.add.circle(attackX, attackY, 25, 0xef4444, 0.4);
    arc.setStrokeStyle(2, 0xfca5a5, 0.8);

    this.scene.tweens.add({
      targets: arc,
      radius: 35,
      alpha: 0,
      duration: 200,
      onComplete: () => arc.destroy()
    });
  }

  /**
   * Atualiza o tempo da expedição (usado para animações).
   */
  updateExpeditionTime(time: number): void {
    this.expeditionTime = time;
  }

  /**
   * Atualiza o anel visual de perigo ao redor do jogador.
   * Ele segue a posição do player e pulsa em estados de maior risco.
   */
  updateDangerRing(timeRatio: number, state: string): void {
    if (!this.dangerRing || !this.player) return;

    // Garante que o anel acompanhe o player
    this.dangerRing.setPosition(this.player.x, this.player.y);

    const hpRatio =
      this.activeMaxHp > 0
        ? this.activeHp / this.activeMaxHp
        : 1;

    const inCombat = state === "combat";
    const lowTime = timeRatio <= 0.2;
    const lowHp = hpRatio <= this.dangerLowHpThreshold;
    const tookRecentDamage = this.damageTakenRecently > 0;

    const inDanger = inCombat || lowTime || lowHp || tookRecentDamage;

    if (!inDanger) {
      this.dangerRing.setVisible(false);
      return;
    }

    // Exibe anel com leve pulsar para reforçar estado crítico
    this.dangerRing.setVisible(true);

    const pulse = 0.9 + Math.sin(this.expeditionTime * 6) * 0.1;
    this.dangerRing.setScale(pulse);

    // Mais opaco quando tempo está crítico ou HP muito baixo
    let baseAlpha = 0.25;
    if (lowTime || lowHp) {
      baseAlpha = 0.4;
    }
    if (tookRecentDamage && !lowHp && !lowTime) {
      baseAlpha = 0.32;
    }
    this.dangerRing.setAlpha(baseAlpha + 0.1 * Math.sin(this.expeditionTime * 6));
  }

  /**
   * Atualiza a aparência visual do player para refletir a criatura ativa.
   * Muda a cor do círculo do jogador de acordo com o tema da criatura.
   */
  updatePlayerVisual(theme: CreatureTheme | null): void {
    if (!theme || !this.player) return;
    
    // Recria a textura do círculo do player com a cor da criatura ativa
    const g = this.scene.add.graphics();
    g.fillStyle(theme.primaryColor, 1);
    g.fillCircle(16, 16, 16);
    g.lineStyle(2, theme.strokeColor, 1);
    g.strokeCircle(16, 16, 15);
    g.generateTexture("playerCircle", 32, 32);
    g.destroy();
    this.player.setTexture("playerCircle");
  }

  /**
   * Cria um efeito visual de impacto quando um ataque acerta.
   */
  createHitImpactEffect(
    x: number,
    y: number,
    theme: CreatureTheme | null
  ): void {
    const color = theme?.particleColor ?? 0xffffff;
    
    // Círculo de impacto que expande
    const impact = this.scene.add.circle(x, y, 4, color, 0.8);
    this.scene.tweens.add({
      targets: impact,
      radius: 18,
      alpha: 0,
      duration: 150,
      onComplete: () => impact.destroy()
    });

    // Pequenas partículas que espalham
    for (let i = 0; i < 4; i++) {
      const particleAngle = (Math.PI * 2 * i) / 4 + Math.random() * 0.5;
      const particle = this.scene.add.circle(x, y, 2, color, 1);
      const distance = 15 + Math.random() * 10;

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(particleAngle) * distance,
        y: y + Math.sin(particleAngle) * distance,
        alpha: 0,
        duration: 200,
        onComplete: () => particle.destroy()
      });
    }
  }

  /**
   * Cria um efeito de morte quando uma criatura é derrotada.
   */
  createDeathEffect(x: number, y: number, theme: CreatureTheme | null): void {
    const color = theme?.attackColor ?? 0xef4444;

    // Explosão de partículas
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const particle = this.scene.add.circle(x, y, 3, color, 1);
      const distance = 25 + Math.random() * 15;

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: 350,
        onComplete: () => particle.destroy()
      });
    }

    // Anel de expansão
    const ring = this.scene.add.circle(x, y, 5, 0x000000, 0);
    ring.setStrokeStyle(2, color, 1);
    this.scene.tweens.add({
      targets: ring,
      radius: 30,
      alpha: 0,
      duration: 300,
      onComplete: () => ring.destroy()
    });
  }

  /**
   * Cria um flash de disparo quando um projétil é lançado.
   */
  createMuzzleFlash(
    x: number,
    y: number,
    angle: number,
    theme: CreatureTheme | null
  ): void {
    const color = theme?.particleColor ?? 0xfbbf24;

    // Flash na posição do jogador
    const flash = this.scene.add.circle(x, y, 8, color, 0.6);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 100,
      onComplete: () => flash.destroy()
    });

    // Partícula que sai na direção do tiro
    const offsetX = Math.cos(angle) * 20;
    const offsetY = Math.sin(angle) * 20;
    const spark = this.scene.add.circle(x + offsetX * 0.5, y + offsetY * 0.5, 3, color, 1);
    this.scene.tweens.add({
      targets: spark,
      x: x + offsetX,
      y: y + offsetY,
      alpha: 0,
      duration: 150,
      onComplete: () => spark.destroy()
    });
  }
}
