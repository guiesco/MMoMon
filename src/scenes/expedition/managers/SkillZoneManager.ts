import Phaser from "phaser";
import type { SkillZone } from "../types/ExpeditionTypes";
import type { RemoteCreatureSprite } from "../types/ExpeditionTypes";
import type { RemoteSkillZone } from "../../../services/multiplayerClient";

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

  /**
   * Handler para atualização de skill zones.
   * Sincroniza skill zones recebidas do servidor com a renderização local.
   */
  handleSkillZonesUpdate(skillZones: RemoteSkillZone[]): void {
    const seen = new Set<string>();
    
    for (const zone of skillZones) {
      seen.add(zone.id);
      
      const existing = this.remoteSkillZones.get(zone.id);
      
      if (existing) {
        // Zona já existe - atualizar propriedades se necessário
        // (por enquanto zonas são estáticas, mas podemos atualizar alpha baseado em lifetime)
        const lifetimeRatio = Math.max(0, Math.min(1, zone.lifetime / 4)); // Assumindo 4s máximo
        existing.setAlpha(0.25 * lifetimeRatio + 0.1); // Fade out gradual
        
        // ✅ Atualizar posição da borda vermelha se existir
        if ((existing as any).dangerStroke) {
          (existing as any).dangerStroke.setPosition(zone.x, zone.y);
          (existing as any).dangerStroke.setAlpha(0.8 * lifetimeRatio + 0.2);
        }
      } else {
        // Criar nova skill zone
        const { color, strokeColor } = this.getSkillZoneColors(zone.skillType);
        
        const circle = this.scene.add.circle(zone.x, zone.y, zone.radius, color, 0.25);
        circle.setStrokeStyle(2, strokeColor, 0.9);
        circle.setDepth(50); // Abaixo de jogadores/criaturas mas acima do chão
        
        // ✅ Verificar se é skill zone hostil (criada por criatura inimiga)
        const isHostile = zone.ownerId.startsWith("wild-");
        if (isHostile) {
          // Adicionar borda vermelha extra para skill zones hostis
          const dangerStroke = this.scene.add.circle(zone.x, zone.y, zone.radius, 0x000000, 0); // Transparente
          dangerStroke.setStrokeStyle(4, 0xff0000, 0.8); // Borda vermelha grossa
          dangerStroke.setDepth(51); // Acima da skill zone normal
          // Armazenar referência para poder atualizar/remover depois
          (circle as any).dangerStroke = dangerStroke;
        }
        
        this.remoteSkillZones.set(zone.id, circle);
        
        // Efeito de criação (expansão)
        circle.setScale(0.1);
        this.scene.tweens.add({
          targets: circle,
          scale: 1,
          duration: 200,
          ease: "Back.easeOut"
        });
        
        // Efeito de criação para borda vermelha se existir
        if ((circle as any).dangerStroke) {
          (circle as any).dangerStroke.setScale(0.1);
          this.scene.tweens.add({
            targets: (circle as any).dangerStroke,
            scale: 1,
            duration: 200,
            ease: "Back.easeOut"
          });
        }
      }
    }
    
    // Remove zones que não existem mais no servidor
    for (const [id, circle] of this.remoteSkillZones) {
      if (!seen.has(id)) {
        // Efeito de desaparecimento
        this.scene.tweens.add({
          targets: circle,
          alpha: 0,
          scale: 1.2,
          duration: 150,
          onComplete: () => {
            circle.destroy();
            // ✅ Destruir borda vermelha se existir
            if ((circle as any).dangerStroke) {
              (circle as any).dangerStroke.destroy();
            }
          }
        });
        this.remoteSkillZones.delete(id);
      }
    }
  }

  /**
   * Retorna cores para renderização de skill zones baseado no tipo.
   */
  private getSkillZoneColors(skillType: "fire_fog" | "root_trap" | "electric_surge"): { color: number; strokeColor: number } {
    switch (skillType) {
      case "fire_fog":
        return { color: 0xf97316, strokeColor: 0xea580c }; // Laranja
      case "root_trap":
        return { color: 0x22c55e, strokeColor: 0x16a34a }; // Verde
      case "electric_surge":
        return { color: 0xfbbf24, strokeColor: 0xf59e0b }; // Amarelo
      default:
        return { color: 0x6366f1, strokeColor: 0x4f46e5 }; // Roxo default
    }
  }
}
