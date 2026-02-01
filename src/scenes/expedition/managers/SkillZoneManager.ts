import Phaser from "phaser";
import type { SkillZone } from "../types/ExpeditionTypes";
import type { RemoteCreatureSprite } from "../types/ExpeditionTypes";

/**
 * Gerencia zonas de habilidades especiais (ex: nevoeiro incendiário).
 */
export class SkillZoneManager {
  private scene: Phaser.Scene;
  private skillZones: SkillZone[] = [];
  private remoteSkillZones: Map<string, Phaser.GameObjects.Arc> = new Map();
  private getAllCreatures: () => RemoteCreatureSprite[];
  private updateCreatureHp: (id: string, hp: number) => void;
  private worldState: any;
  private telemetry: any;

  constructor(
    scene: Phaser.Scene,
    dependencies: {
      getAllCreatures: () => RemoteCreatureSprite[];
      updateCreatureHp: (id: string, hp: number) => void;
      worldState: any;
      telemetry: any;
    }
  ) {
    this.scene = scene;
    this.getAllCreatures = dependencies.getAllCreatures;
    this.updateCreatureHp = dependencies.updateCreatureHp;
    this.worldState = dependencies.worldState;
    this.telemetry = dependencies.telemetry;
  }

  /**
   * Adiciona uma zona de habilidade local.
   */
  addSkillZone(zone: SkillZone): void {
    this.skillZones.push(zone);
  }

  /**
   * Adiciona ou atualiza uma zona de habilidade remota.
   */
  addRemoteSkillZone(id: string, sprite: Phaser.GameObjects.Arc): void {
    // Remove anterior se existir
    const existing = this.remoteSkillZones.get(id);
    if (existing) {
      existing.destroy();
    }
    this.remoteSkillZones.set(id, sprite);
  }

  /**
   * Remove uma zona de habilidade remota.
   */
  removeRemoteSkillZone(id: string): void {
    const zone = this.remoteSkillZones.get(id);
    if (zone) {
      zone.destroy();
      this.remoteSkillZones.delete(id);
    }
  }

  /**
   * Atualiza todas as zonas de habilidade.
   */
  update(dt: number): void {
    if (this.skillZones.length === 0) return;

    const remainingZones: SkillZone[] = [];

    for (const zone of this.skillZones) {
      zone.remaining -= dt;
      zone.tickTimer -= dt;

      if (zone.remaining <= 0) {
        zone.sprite.destroy();
        continue;
      }

      if (zone.kind === "fire_fog" && zone.tickTimer <= 0) {
        zone.tickTimer = 0.5; // aplica dano a cada 0.5s

        const bounds = zone.sprite.getBounds();
        const centerX = bounds.centerX;
        const centerY = bounds.centerY;
        const radius = zone.sprite.radius ?? 70;
        const damagePerTick = 8;

        const creaturesInRange = this.getAllCreatures();
        
        for (const wc of creaturesInRange) {
          const dx = wc.sprite.x - centerX;
          const dy = wc.sprite.y - centerY;
          const dist = Math.hypot(dx, dy);
          if (dist <= radius) {
            const newHp = wc.currentHp - damagePerTick;
            wc.currentHp = newHp;
            this.updateCreatureHp(wc.id, newHp);
            this.telemetry.damageDealt += damagePerTick;

            const ratio = Math.max(0, wc.currentHp / wc.maxHp);
            wc.sprite.setFillStyle(ratio > 0.5 ? 0xf97373 : 0xfacc15);
          }
        }
      }

      remainingZones.push(zone);
    }

    this.skillZones = remainingZones;
  }

  /**
   * Limpa todas as zonas de habilidade.
   */
  clear(): void {
    for (const zone of this.skillZones) {
      zone.sprite.destroy();
    }
    for (const zone of this.remoteSkillZones.values()) {
      zone.destroy();
    }
    this.skillZones = [];
    this.remoteSkillZones.clear();
  }

  /**
   * Obtém todas as zonas locais.
   */
  getAllZones(): SkillZone[] {
    return [...this.skillZones];
  }
}
