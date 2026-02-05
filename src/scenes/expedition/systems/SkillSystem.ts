import Phaser from "phaser";
import { getCreatureTheme, type CreatureTheme } from "../../../game/creatureThemes";
import type { SpecialSkillKind, SkillZone, RemoteCreatureSprite } from "../types/ExpeditionTypes";
import type { MultiplayerClient } from "../../../services/multiplayerClient";
import { PlayerState as LocalPlayerState } from "../../../game/playerState";

/**
 * Gerencia habilidades especiais das criaturas.
 */
export class SkillSystem {
  private scene: Phaser.Scene;
  private specialSkillCooldown = 0;
  private specialSkillCooldownTime = 0;
  private activeSpecialSkillKind: SpecialSkillKind | null = null;
  private activeSpecialSkillName = "Habilidade Especial";
  private activeCreatureTheme: any = null;
  private mpClient: MultiplayerClient | null;
  private activeCreatureDef: any;
  private createFloatingText: (x: number, y: number, text: string, color: number) => void;
  private addSkillZone: (zone: SkillZone) => void;
  private healCreature: (amount: number) => void;
  private activeCreatureHp: number;
  private activeCreatureMaxHp: number;
  private getActiveCreatureInstanceId: () => string | null;
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private getAllCreatures: () => RemoteCreatureSprite[];
  private createHitImpactEffect: (x: number, y: number, theme: CreatureTheme | null) => void;
  private createDeathEffect: (x: number, y: number, theme: CreatureTheme | null) => void;
  private createHealFeedback: (x: number, y: number) => void;

  constructor(
    scene: Phaser.Scene,
    mpClient: MultiplayerClient | null,
    dependencies: {
      createFloatingText: (x: number, y: number, text: string, color: number) => void;
      addSkillZone: (zone: SkillZone) => void;
      healCreature: (amount: number) => void;
      activeCreatureHp: number;
      activeCreatureMaxHp: number;
      getActiveCreatureInstanceId: () => string | null;
      player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
      getAllCreatures: () => RemoteCreatureSprite[];
      createHitImpactEffect: (x: number, y: number, theme: CreatureTheme | null) => void;
      createDeathEffect: (x: number, y: number, theme: CreatureTheme | null) => void;
      createHealFeedback: (x: number, y: number) => void;
    }
  ) {
    this.scene = scene;
    this.mpClient = mpClient;
    this.createFloatingText = dependencies.createFloatingText;
    this.addSkillZone = dependencies.addSkillZone;
    this.healCreature = dependencies.healCreature;
    this.activeCreatureHp = dependencies.activeCreatureHp;
    this.activeCreatureMaxHp = dependencies.activeCreatureMaxHp;
    this.getActiveCreatureInstanceId = dependencies.getActiveCreatureInstanceId;
    this.player = dependencies.player;
    this.getAllCreatures = dependencies.getAllCreatures;
    this.createHitImpactEffect = dependencies.createHitImpactEffect;
    this.createDeathEffect = dependencies.createDeathEffect;
    this.createHealFeedback = dependencies.createHealFeedback;
  }

  /**
   * Atualiza o cooldown da habilidade.
   */
  update(dt: number): void {
    if (this.specialSkillCooldown > 0) {
      this.specialSkillCooldown = Math.max(0, this.specialSkillCooldown - dt);
    }
  }

  /**
   * Tenta usar a habilidade especial.
   */
  tryUseSpecialSkill(targetX: number, targetY: number): boolean {
    if (!this.activeSpecialSkillKind || this.specialSkillCooldown > 0) {
      // Feedback rápido de cooldown
      if (this.specialSkillCooldown > 0) {
        this.createFloatingText(
          this.scene.cameras.main.worldView.centerX,
          this.scene.cameras.main.worldView.centerY - 30,
          "Em recarga...",
          0xfacc15
        );
      }
      return false;
    }

    // Mapear skill kind para skill type do servidor
    let skillType: "fire_fog" | "root_trap" | "electric_surge" | "heal_wave" | null = null;
    switch (this.activeSpecialSkillKind) {
      case "pyrognat_fire_fog":
        skillType = "fire_fog";
        break;
      case "verdant_root_trap":
        skillType = "root_trap";
        break;
      case "voltiger_electric_surge":
        skillType = "electric_surge";
        break;
      case "aquaryl_heal_wave":
        skillType = "heal_wave";
        break;
    }

    // Enviar intent ao servidor
    if (this.mpClient && skillType) {
      const creatureId = this.activeCreatureDef?.id;
      // Obter level e rank da criatura ativa
      const activeCreatureInstanceId = this.getActiveCreatureInstanceId();
      const progress = LocalPlayerState.getProgress();
      const owned = activeCreatureInstanceId
        ? progress.creatures.find((c) => c.instanceId === activeCreatureInstanceId)
        : null;
      const creatureLevel = owned?.level ?? 1;
      const creatureRank = owned?.rank ?? 1;
      this.mpClient.sendSkill(skillType, targetX, targetY, creatureId, creatureLevel, creatureRank);
      
      // Feedback visual imediato (predição local)
      this.specialSkillCooldown = this.specialSkillCooldownTime;
      
      // Criar feedback visual temporário
      this.createFloatingText(
        targetX,
        targetY - 30,
        this.activeSpecialSkillName,
        this.activeCreatureTheme?.attackColor ?? 0x4ade80
      );
      return true;
    }

    // Fallback para habilidades locais (single-player)
    switch (this.activeSpecialSkillKind) {
      case "pyrognat_fire_fog":
        this.castPyrognatFireFog(targetX, targetY);
        break;
      case "aquaryl_heal_wave":
        this.castAquarylHealWave();
        break;
      case "voltiger_electric_surge":
        this.castVoltigerElectricSurge(targetX, targetY);
        break;
      case "verdant_root_trap":
        this.castVerdantRootTrap(targetX, targetY);
        break;
    }

    this.specialSkillCooldown = this.specialSkillCooldownTime;
    return true;
  }

  /**
   * Pyrognat – Nevoeiro Incendiário:
   * Cria uma área de fogo no ponto do cursor que causa dano periódico
   * em criaturas selvagens que passarem dentro da zona.
   */
  private castPyrognatFireFog(x: number, y: number): void {
    const theme = getCreatureTheme("pyrognat");
    const radius = 70;
    const duration = 4; // segundos

    const circle = this.scene.add.circle(x, y, radius, theme.primaryColor, 0.25);
    circle.setStrokeStyle(2, theme.attackColor, 0.9);

    this.addSkillZone({
      sprite: circle,
      kind: "fire_fog",
      remaining: duration,
      tickTimer: 0
    });

    this.createFloatingText(x, y - radius - 10, "Nevoeiro Incendiário!", theme.attackColor);
  }

  /**
   * Aquaryl – Maré Curativa:
   * Cura parte do HP da criatura ativa e cria um pequeno efeito visual
   * de água ao redor do jogador.
   */
  private castAquarylHealWave(): void {
    const theme = getCreatureTheme("aquaryl");
    const healAmount = Math.max(15, this.activeCreatureMaxHp * 0.25);
    this.healCreature(healAmount);

    // Usar createHealFeedback do ExpeditionScene
    this.createHealFeedback(this.player.x, this.player.y);

    // Partículas de água subindo (efeito adicional específico do Aquaryl)
    for (let i = 0; i < 6; i++) {
      const offsetX = Phaser.Math.Between(-25, 25);
      const particle = this.scene.add.circle(
        this.player.x + offsetX,
        this.player.y + 20,
        4,
        theme.particleColor,
        0.8
      );
      this.scene.tweens.add({
        targets: particle,
        y: this.player.y - 40,
        alpha: 0,
        duration: 600,
        delay: i * 50,
        onComplete: () => particle.destroy()
      });
    }

    this.createFloatingText(
      this.player.x,
      this.player.y - 30,
      `+${Math.floor(healAmount)} HP`,
      theme.primaryColor
    );
  }

  /**
   * Voltiger – Surto Elétrico:
   * Explosão ao redor do jogador que causa dano moderado e empurra
   * criaturas próximas para longe.
   */
  private castVoltigerElectricSurge(x: number, y: number): void {
    const theme = getCreatureTheme("voltiger");
    const radius = 90;
    const pushDistance = 40;
    const damage = 18;

    // Círculo de explosão elétrica
    const circle = this.scene.add.circle(
      this.player.x,
      this.player.y,
      0,
      theme.primaryColor,
      0.35
    );
    this.scene.tweens.add({
      targets: circle,
      radius,
      alpha: 0,
      duration: 350,
      onComplete: () => circle.destroy()
    });

    // Raios elétricos irradiando do centro
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const lightning = this.scene.add.graphics();
      lightning.lineStyle(2, theme.attackColor, 0.9);
      lightning.beginPath();
      lightning.moveTo(this.player.x, this.player.y);
      
      // Linha zigzag para simular raio
      let px = this.player.x;
      let py = this.player.y;
      const segments = 4;
      for (let s = 1; s <= segments; s++) {
        const progress = s / segments;
        const targetX = this.player.x + Math.cos(angle) * radius * progress;
        const targetY = this.player.y + Math.sin(angle) * radius * progress;
        const jitterX = (Math.random() - 0.5) * 15;
        const jitterY = (Math.random() - 0.5) * 15;
        px = targetX + (s < segments ? jitterX : 0);
        py = targetY + (s < segments ? jitterY : 0);
        lightning.lineTo(px, py);
      }
      lightning.strokePath();

      this.scene.tweens.add({
        targets: lightning,
        alpha: 0,
        duration: 250,
        onComplete: () => lightning.destroy()
      });
    }

    // Aplicar dano e empurrão em criaturas próximas
    const creaturesInRange = this.getAllCreatures();
    
    for (const wc of creaturesInRange) {
      const dx = wc.sprite.x - this.player.x;
      const dy = wc.sprite.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= radius && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;

        wc.sprite.x += nx * pushDistance;
        wc.sprite.y += ny * pushDistance;

        const newHp = wc.currentHp - damage;
        wc.currentHp = newHp;

        // Flash elétrico no inimigo
        const originalColor = wc.sprite.fillColor;
        wc.sprite.setFillStyle(theme.hitFlashColor);
        this.createHitImpactEffect(wc.sprite.x, wc.sprite.y, theme);
        
        this.scene.time.delayedCall(100, () => {
          if (wc.currentHp > 0) {
            const ratio = Math.max(0, wc.currentHp / wc.maxHp);
            wc.sprite.setFillStyle(ratio > 0.5 ? originalColor : 0xfacc15);
          }
        });
      }
    }

    this.createFloatingText(
      this.player.x,
      this.player.y - 40,
      "Surto Elétrico!",
      theme.primaryColor
    );
  }

  /**
   * Verdant – Raízes Prendentes:
   * Cria uma área de raízes no ponto do cursor que prende e causa dano
   * em criaturas selvagens que passarem dentro.
   */
  private castVerdantRootTrap(x: number, y: number): void {
    const theme = getCreatureTheme("verdant");
    const radius = 60;
    const duration = 3.5; // segundos

    // Círculo verde de raízes
    const circle = this.scene.add.circle(x, y, radius, theme.primaryColor, 0.3);
    circle.setStrokeStyle(3, theme.attackColor, 0.9);

    // Adiciona pequenas "raízes" espalhadas na área
    const rootLines: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.3;
      const root = this.scene.add.graphics();
      root.lineStyle(2, theme.attackColor, 0.7);
      root.beginPath();
      root.moveTo(x, y);
      const endX = x + Math.cos(angle) * (radius * 0.8 + Math.random() * 10);
      const endY = y + Math.sin(angle) * (radius * 0.8 + Math.random() * 10);
      
      // Linha curva para parecer raiz
      const midX = (x + endX) / 2 + (Math.random() - 0.5) * 20;
      const midY = (y + endY) / 2 + (Math.random() - 0.5) * 20;
      root.lineTo(midX, midY);
      root.lineTo(endX, endY);
      root.strokePath();
      rootLines.push(root);
    }

    // Sistema de zona de skill com tipo expandido
    const rootZone = {
      sprite: circle,
      kind: "fire_fog" as const, // Reutiliza o sistema de zonas
      remaining: duration,
      tickTimer: 0,
      customData: {
        rootLines,
        x,
        y,
        radius
      }
    };

    this.addSkillZone(rootZone);

    // Timer para destruir as raízes visuais junto com a zona
    this.scene.time.delayedCall(duration * 1000, () => {
      rootLines.forEach(r => r.destroy());
    });

    this.createFloatingText(x, y - radius - 10, "Raízes Prendentes!", theme.primaryColor);
  }

  /**
   * Define a habilidade especial ativa.
   */
  setActiveSkill(
    skillKind: SpecialSkillKind | null,
    skillName: string,
    cooldownTime: number,
    creatureDef: any,
    creatureTheme: any
  ): void {
    this.activeSpecialSkillKind = skillKind;
    this.activeSpecialSkillName = skillName;
    this.specialSkillCooldownTime = cooldownTime;
    this.activeCreatureDef = creatureDef;
    this.activeCreatureTheme = creatureTheme;
  }

  get cooldown(): number {
    return this.specialSkillCooldown;
  }

  get cooldownTime(): number {
    return this.specialSkillCooldownTime;
  }

  get activeSkillKind(): SpecialSkillKind | null {
    return this.activeSpecialSkillKind;
  }

  get activeSkillName(): string {
    return this.activeSpecialSkillName;
  }

  get isReady(): boolean {
    return this.specialSkillCooldown <= 0 && this.activeSpecialSkillKind !== null;
  }

  /**
   * Atualiza a referência do cliente multiplayer.
   * Deve ser chamado após a conexão ser estabelecida.
   */
  setMpClient(mpClient: MultiplayerClient | null): void {
    this.mpClient = mpClient;
  }
}
