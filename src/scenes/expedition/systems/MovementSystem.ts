import Phaser from "phaser";
import type { ExpeditionState } from "../types/ExpeditionTypes";
import type { MultiplayerClient } from "../../../services/multiplayerClient";

/**
 * Gerencia o movimento do jogador.
 */
export class MovementSystem {
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private speed: number;
  private state: ExpeditionState;
  private mpClient: MultiplayerClient | null;
  private combatSystem: { 
    isInWindup: () => boolean;
    isInSkillWindup: (skillSystem: any) => boolean;
  } | null = null; // ✅ Referência para verificar windup
  private skillSystem: { isInSkillWindup: () => boolean } | null = null; // ✅ Referência para skill system

  constructor(
    player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasdKeys: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key },
    speed: number,
    initialState: ExpeditionState,
    mpClient: MultiplayerClient | null
  ) {
    this.player = player;
    this.cursors = cursors;
    this.wasdKeys = wasdKeys;
    this.speed = speed;
    this.state = initialState;
    this.mpClient = mpClient;
  }
  
  /**
   * ✅ Define referência ao CombatSystem para verificar windup.
   */
  setCombatSystem(combatSystem: { 
    isInWindup: () => boolean;
    isInSkillWindup: (skillSystem: any) => boolean;
  } | null): void {
    this.combatSystem = combatSystem;
  }
  
  /**
   * ✅ Define referência ao SkillSystem para verificar windup de skill.
   */
  setSkillSystem(skillSystem: { isInSkillWindup: () => boolean } | null): void {
    this.skillSystem = skillSystem;
  }

  /**
   * Atualiza o movimento do jogador.
   */
  update(dt: number, state: ExpeditionState): void {
    this.state = state;

    // Bloqueia movimento após término da expedição
    if (this.state === "extracted" || this.state === "failed") {
      this.player.setVelocity(0, 0);
      return;
    }

    // ✅ Bloquear movimento durante windup de ataque
    if (this.combatSystem?.isInWindup()) {
      this.player.setVelocity(0, 0);
      return;
    }
    
    // ✅ Bloquear movimento durante windup de skill
    if (this.combatSystem?.isInSkillWindup(this.skillSystem)) {
      this.player.setVelocity(0, 0);
      return;
    }

    let vx = 0;
    let vy = 0;

    // Suporte a Setas e WASD
    if (this.cursors.left?.isDown || this.wasdKeys.A.isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.wasdKeys.D.isDown) vx += 1;
    if (this.cursors.up?.isDown || this.wasdKeys.W.isDown) vy -= 1;
    if (this.cursors.down?.isDown || this.wasdKeys.S.isDown) vy += 1;

    const len = Math.hypot(vx, vy) || 1;
    vx = (vx / len) * this.speed;
    vy = (vy / len) * this.speed;

    this.player.setVelocity(vx, vy);

    // Envia posição para o servidor apenas quando há input de movimento
    // Isso evita sobrecarregar o servidor com mensagens quando o jogador está parado
    if (this.mpClient && (vx !== 0 || vy !== 0)) {
      this.mpClient.sendPosition(this.player.x, this.player.y);
    }
  }

  /**
   * Atualiza a velocidade base do jogador.
   */
  setSpeed(speed: number): void {
    this.speed = speed;
  }

  /**
   * Atualiza a referência do cliente multiplayer.
   * Deve ser chamado após a conexão ser estabelecida.
   */
  setMpClient(mpClient: MultiplayerClient | null): void {
    this.mpClient = mpClient;
  }
}
