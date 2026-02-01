import { PlayerState as LocalPlayerState } from "../../../game/playerState";
import { 
  CAPTURE_CONFIG, 
  CAPTURE_BALL_MODIFIERS, 
  CAPTURE_CREATURE_POOL 
} from "../../../game/constants";
import type { RemoteCreatureSprite, PokeballProjectile } from "../types/ExpeditionTypes";
import type { ExpeditionTelemetry } from "../types/ExpeditionTypes";

/**
 * Gerencia o sistema de captura de criaturas.
 */
export class CaptureSystem {
  private telemetry: ExpeditionTelemetry;
  private creaturesCaptured: number;
  private createCaptureSuccessFeedback: (x: number, y: number) => void;
  private createEnhancedFloatingText: (x: number, y: number, text: string, color: number, fontSize?: number) => void;
  private removeCreature: (id: string) => void;
  private updateCreatureState: (id: string, state: any) => void;
  private worldState: any;

  constructor(
    dependencies: {
      telemetry: ExpeditionTelemetry;
      creaturesCaptured: number;
      createCaptureSuccessFeedback: (x: number, y: number) => void;
      createEnhancedFloatingText: (x: number, y: number, text: string, color: number, fontSize?: number) => void;
      removeCreature: (id: string) => void;
      updateCreatureState: (id: string, state: any) => void;
      worldState: any;
    }
  ) {
    this.telemetry = dependencies.telemetry;
    this.creaturesCaptured = dependencies.creaturesCaptured;
    this.createCaptureSuccessFeedback = dependencies.createCaptureSuccessFeedback;
    this.createEnhancedFloatingText = dependencies.createEnhancedFloatingText;
    this.removeCreature = dependencies.removeCreature;
    this.updateCreatureState = dependencies.updateCreatureState;
    this.worldState = dependencies.worldState;
  }

  /**
   * Calcula a chance de captura.
   */
  calculateCatchRate(
    creature: RemoteCreatureSprite,
    ballType: "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra"
  ): number {
    // Fatores base
    const baseRate = CAPTURE_CONFIG.baseChance; // 0.25 base
    
    // Bônus por HP baixo (quanto menor o HP, maior a chance)
    const hpRatio = creature.currentHp / creature.maxHp;
    const hpBonus = (1 - hpRatio) * CAPTURE_CONFIG.hpBonusMultiplier;
    
    // Penalidade por nível/tier alto (criaturas mais fortes são mais difíceis)
    const tierPenalty: Record<string, number> = {
      common: 0,
      uncommon: 0.05,
      rare: 0.15,
      boss: 0.35
    };
    const penalty = tierPenalty[creature.tier] ?? 0;
    
    // Modificador da pokébola
    const ballMods = CAPTURE_BALL_MODIFIERS[ballType] ?? CAPTURE_BALL_MODIFIERS["poke-ball-basic"];
    
    // Calcula chance final
    const rawChance = (baseRate + hpBonus - penalty) * ballMods.multiplier + ballMods.flatBonus;
    
    return Math.max(0.05, Math.min(CAPTURE_CONFIG.maxChance, rawChance)); // Mínimo 5%, máximo do config
  }

  /**
   * Tenta capturar uma criatura.
   */
  attemptCapture(
    target: RemoteCreatureSprite,
    ballType: "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra"
  ): { success: boolean; creaturesCaptured: number } {
    this.telemetry.creaturesEncountered += 1;
    
    const chance = this.calculateCatchRate(target, ballType);
    const roll = Math.random();
    
    // Registra chance para cálculo de média
    this.telemetry.totalCaptureChanceSum += chance;

    // Log de tentativa de captura
    console.log("[CAPTURA] Tentativa", {
      tier: target.tier,
      hpRatio: (target.currentHp / target.maxHp * 100).toFixed(0) + "%",
      ball: ballType,
      chance: (chance * 100).toFixed(1) + "%",
      roll: (roll * 100).toFixed(1) + "%",
      success: roll <= chance
    });

    if (roll <= chance) {
      // Captura bem-sucedida!
      const newCreaturesCaptured = this.creaturesCaptured + 1;
      this.telemetry.creaturesCaptured += 1;
      this.telemetry.captureSuccesses += 1;
      
      // Feedback visual de sucesso
      this.createCaptureSuccessFeedback(target.sprite.x, target.sprite.y);
      this.createEnhancedFloatingText(
        target.sprite.x,
        target.sprite.y - 20,
        "✅ CAPTURADO!",
        0x10b981,
        24 // Tamanho maior para sucesso
      );
      
      // Remove a criatura do worldState e destrói sprites
      this.removeCreature(target.id);

      // Adiciona criatura ao jogador
      const chosenDefId =
        CAPTURE_CREATURE_POOL[Math.floor(Math.random() * CAPTURE_CREATURE_POOL.length)] ?? CAPTURE_CREATURE_POOL[0];
      LocalPlayerState.addCreature(chosenDefId);

      return { success: true, creaturesCaptured: newCreaturesCaptured };
    } else {
      // Falha na captura
      this.telemetry.captureFailures += 1;
      
      // Feedback visual de falha
      this.createEnhancedFloatingText(
        target.sprite.x,
        target.sprite.y - 20,
        "❌ Escapou!",
        0xef4444,
        20 // Tamanho médio para falha
      );
      
      // A criatura fica agressiva após falha na captura
      target.aiState = "chasing";
      this.updateCreatureState(target.id, { aiState: "chasing" });

      return { success: false, creaturesCaptured: this.creaturesCaptured };
    }
  }
}
