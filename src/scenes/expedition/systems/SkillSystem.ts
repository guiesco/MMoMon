import Phaser from "phaser";
import { getCreatureTheme } from "../../../game/creatureThemes";
import type { SpecialSkillKind, SkillZone } from "../types/ExpeditionTypes";
import type { MultiplayerClient } from "../../../services/multiplayerClient";

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

  constructor(
    scene: Phaser.Scene,
    mpClient: MultiplayerClient | null,
    dependencies: {
      createFloatingText: (x: number, y: number, text: string, color: number) => void;
      addSkillZone: (zone: SkillZone) => void;
      healCreature: (amount: number) => void;
      activeCreatureHp: number;
      activeCreatureMaxHp: number;
    }
  ) {
    this.scene = scene;
    this.mpClient = mpClient;
    this.createFloatingText = dependencies.createFloatingText;
    this.addSkillZone = dependencies.addSkillZone;
    this.healCreature = dependencies.healCreature;
    this.activeCreatureHp = dependencies.activeCreatureHp;
    this.activeCreatureMaxHp = dependencies.activeCreatureMaxHp;
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
      this.mpClient.sendSkill(skillType, targetX, targetY, creatureId);
      
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
   * Pyrognat – Nevoeiro Incendiário.
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
   * Aquaryl – Maré Curativa.
   */
  private castAquarylHealWave(): void {
    const theme = getCreatureTheme("aquaryl");
    const healAmount = Math.max(15, this.activeCreatureMaxHp * 0.25);
    this.healCreature(healAmount);

    // Efeito visual de cura
    const playerX = this.scene.cameras.main.worldView.centerX;
    const playerY = this.scene.cameras.main.worldView.centerY;
    const circle = this.scene.add.circle(playerX, playerY, 40, theme.primaryColor, 0.3);
    circle.setStrokeStyle(2, theme.attackColor, 0.8);
    
    this.scene.tweens.add({
      targets: circle,
      radius: 60,
      alpha: 0,
      duration: 600,
      onComplete: () => circle.destroy()
    });

    this.createFloatingText(playerX, playerY - 40, "Maré Curativa!", theme.attackColor);
  }

  /**
   * Voltiger – Surto Elétrico.
   */
  private castVoltigerElectricSurge(x: number, y: number): void {
    const theme = getCreatureTheme("voltiger");
    // Implementação simplificada
    this.createFloatingText(x, y - 30, "Surto Elétrico!", theme.attackColor);
  }

  /**
   * Verdant – Armadilha de Raízes.
   */
  private castVerdantRootTrap(x: number, y: number): void {
    const theme = getCreatureTheme("verdant");
    // Implementação simplificada
    this.createFloatingText(x, y - 30, "Armadilha de Raízes!", theme.attackColor);
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
