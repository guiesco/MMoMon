import { PlayerState as LocalPlayerState } from "../../../game/playerState";
import { getCreatureById } from "../../../../shared/creatures";
import { getSpecialSkillByCreatureId } from "../../../../shared/attacks";
import { getCreatureTheme, type CreatureTheme } from "../../../game/creatureThemes";
import { getEffectiveStats } from "../../../game/creatureProgression";
import type { CreatureDefinition } from "../../../game/types";
import type { SpecialSkillKind } from "../types/ExpeditionTypes";
import type { SkillSystem } from "./SkillSystem";
import type { HPBarManager } from "../../../game/hpBars";
import type { MultiplayerClient } from "../../../services/multiplayerClient";

/**
 * Gerencia a equipe de criaturas do jogador.
 * Controla troca de criaturas ativas e atualização de stats.
 */
export class TeamSystem {
  private activeTeamIds: string[] = [];
  private activeCreatureIndex = 0;
  private activeCreatureInstanceId: string | null = null;
  private activeCreatureDef: CreatureDefinition | null = null;
  private activeCreatureHp = 0;
  private activeCreatureMaxHp = 0;
  private creatureHpByInstance: Map<string, number> = new Map();
  private activeSpecialSkillKind: SpecialSkillKind | null = null;
  private activeSpecialSkillName = "Habilidade Especial";
  private activeCreatureTheme: CreatureTheme | null = null;
  private speed = 220;
  private basicAttackCooldownTime = 0.8;
  private specialSkillCooldownTime = 0;

  private skillSystem: SkillSystem | null = null;
  private hpBarManager: HPBarManager | null = null;
  private mpClient: MultiplayerClient | null = null;
  private updatePlayerVisual: (() => void) | null = null;

  /**
   * Inicializa a equipe com os IDs das criaturas ativas.
   */
  initialize(teamIds: string[]): void {
    this.activeTeamIds = teamIds.slice(0, 3);
    this.creatureHpByInstance = new Map();
    this.activeCreatureIndex = 0;
    this.activeCreatureInstanceId = null;
    this.activeCreatureDef = null;

    if (this.activeTeamIds.length > 0) {
      this.setActiveCreatureByIndex(0);
    } else {
      // Fallback defensivo
      this.activeCreatureMaxHp = 100;
      this.activeCreatureHp = 100;
      this.basicAttackCooldownTime = 0.8;
      this.specialSkillCooldownTime = 12;
      this.activeSpecialSkillKind = null;
      this.activeSpecialSkillName = "Habilidade Especial";
    }
  }

  /**
   * Troca para a criatura no índice especificado.
   */
  switchToCreature(index: number): boolean {
    if (index < 0 || index >= this.activeTeamIds.length) return false;
    if (index === this.activeCreatureIndex) return false;

    this.setActiveCreatureByIndex(index);
    return true;
  }

  /**
   * Atualiza a criatura ativa com base no índice da equipe.
   */
  private setActiveCreatureByIndex(index: number): void {
    const progress = LocalPlayerState.getProgress();
    if (index < 0 || index >= this.activeTeamIds.length) return;

    // Salva o HP atual da criatura que estava ativa
    if (this.activeCreatureInstanceId) {
      this.creatureHpByInstance.set(
        this.activeCreatureInstanceId,
        this.activeCreatureHp
      );
    }

    const instanceId = this.activeTeamIds[index];
    const owned = progress.creatures.find((c) => c.instanceId === instanceId);
    const def = owned ? getCreatureById(owned.definitionId) ?? null : null;
    if (!owned || !def) return;

    this.activeCreatureIndex = index;
    this.activeCreatureInstanceId = instanceId;
    this.activeCreatureDef = def;

    const storedHp = this.creatureHpByInstance.get(instanceId);
    const effectiveStats = getEffectiveStats(owned);
    this.activeCreatureMaxHp = effectiveStats.hp;
    this.activeCreatureHp = Math.min(
      effectiveStats.hp,
      storedHp ?? owned.currentHp ?? effectiveStats.hp
    );

    this.speed = effectiveStats.moveSpeed;
    this.basicAttackCooldownTime = effectiveStats.attackCooldown;
    this.specialSkillCooldownTime = effectiveStats.specialSkillCooldown;
    
    // ✅ Usar shared/attacks para obter skill consistentemente
    const specialSkill = getSpecialSkillByCreatureId(def.id);
    if (specialSkill) {
      this.activeSpecialSkillName = specialSkill.name;
    } else {
      // Fallback para def.specialSkill se getSpecialSkillByCreatureId não encontrar
      this.activeSpecialSkillName = def.specialSkill?.name ?? "Habilidade Especial";
      console.warn(`[TeamSystem] Skill não encontrada no shared para ${def.id}, usando fallback`);
    }

    // Mapeia a definição para um tipo de habilidade concreta
    let skillKind: SpecialSkillKind | null = null;
    switch (def.id) {
      case "pyrognat":
        skillKind = "pyrognat_fire_fog";
        break;
      case "aquaryl":
        skillKind = "aquaryl_heal_wave";
        break;
      case "voltiger":
        skillKind = "voltiger_electric_surge";
        break;
      case "verdant":
        skillKind = "verdant_root_trap";
        break;
      default:
        skillKind = null;
        console.warn(`[TeamSystem] Criatura ${def.id} não tem skill implementada`);
    }

    this.activeSpecialSkillKind = skillKind;

    // Atualiza o SkillSystem com a skill ativa
    const creatureTheme = getCreatureTheme(def.id);
    if (this.skillSystem) {
      this.skillSystem.setActiveSkill(
        skillKind,
        def.specialSkill.name,
        effectiveStats.specialSkillCooldown,
        def,
        creatureTheme
      );
    }

    // Aplica tema visual da criatura ativa
    this.activeCreatureTheme = creatureTheme;
    if (this.updatePlayerVisual) {
      this.updatePlayerVisual();
    }
    
    // Atualiza a cor da barra de HP
    if (this.hpBarManager) {
      this.hpBarManager.updatePlayerBarColor(def);
      
      // Atualiza estado ativo/inativo das barras aliadas
      for (let i = 0; i < this.activeTeamIds.length; i++) {
        const allyInstanceId = this.activeTeamIds[i];
        const allyOwned = progress.creatures.find((c) => c.instanceId === allyInstanceId);
        const allyDef = allyOwned ? getCreatureById(allyOwned.definitionId) ?? null : null;
        this.hpBarManager.setAllyBarActive(allyInstanceId, i === index, allyDef);
      }
    }
    
    // Notificar servidor sobre mudança de criatura ativa
    if (this.mpClient) {
      this.mpClient.sendActiveCreatureUpdate(
        instanceId,
        this.activeCreatureHp,
        this.activeCreatureMaxHp
      );
      console.log(`[TeamSystem] Criatura ativa atualizada: ${def.name} (${this.activeCreatureHp}/${this.activeCreatureMaxHp} HP)`);
    }
  }

  /**
   * Atualiza o HP da criatura ativa.
   */
  updateActiveCreatureHp(hp: number): void {
    this.activeCreatureHp = Math.max(0, Math.min(this.activeCreatureMaxHp, hp));
    if (this.activeCreatureInstanceId) {
      this.creatureHpByInstance.set(this.activeCreatureInstanceId, this.activeCreatureHp);
    }
  }

  /**
   * Atualiza o HP de uma criatura da equipe.
   */
  updateCreatureHp(instanceId: string, hp: number): void {
    const maxHp = this.getCreatureMaxHp(instanceId);
    const clampedHp = Math.max(0, Math.min(maxHp, hp));
    
    if (instanceId === this.activeCreatureInstanceId) {
      this.activeCreatureHp = clampedHp;
    }
    this.creatureHpByInstance.set(instanceId, clampedHp);
  }

  /**
   * Obtém o HP de uma criatura da equipe.
   */
  getCreatureHp(instanceId: string): number {
    if (instanceId === this.activeCreatureInstanceId) {
      return this.activeCreatureHp;
    }
    return this.creatureHpByInstance.get(instanceId) ?? this.getCreatureMaxHp(instanceId);
  }

  /**
   * Obtém o HP máximo de uma criatura da equipe.
   */
  getCreatureMaxHp(instanceId: string): number {
    const progress = LocalPlayerState.getProgress();
    const owned = progress.creatures.find((c) => c.instanceId === instanceId);
    if (!owned) return 100;
    const effectiveStats = getEffectiveStats(owned);
    return effectiveStats.hp;
  }

  // Getters
  get activeIndex(): number {
    return this.activeCreatureIndex;
  }

  get activeInstanceId(): string | null {
    return this.activeCreatureInstanceId;
  }

  get activeDef(): CreatureDefinition | null {
    return this.activeCreatureDef;
  }

  get activeHp(): number {
    return this.activeCreatureHp;
  }

  get activeMaxHp(): number {
    return this.activeCreatureMaxHp;
  }

  get activeTheme(): CreatureTheme | null {
    return this.activeCreatureTheme;
  }

  get activeSkillKind(): SpecialSkillKind | null {
    return this.activeSpecialSkillKind;
  }

  get activeSkillName(): string {
    return this.activeSpecialSkillName;
  }

  get moveSpeed(): number {
    return this.speed;
  }

  get attackCooldownTime(): number {
    return this.basicAttackCooldownTime;
  }

  get skillCooldownTime(): number {
    return this.specialSkillCooldownTime;
  }

  get teamIds(): string[] {
    return [...this.activeTeamIds];
  }

  // Setters para dependências
  setSkillSystem(skillSystem: SkillSystem | null): void {
    this.skillSystem = skillSystem;
    // ✅ Se já houver uma criatura ativa, atualizar o SkillSystem imediatamente
    if (skillSystem && this.activeCreatureDef && this.activeSpecialSkillKind !== null) {
      const progress = LocalPlayerState.getProgress();
      const owned = this.activeCreatureInstanceId
        ? progress.creatures.find((c) => c.instanceId === this.activeCreatureInstanceId)
        : null;
      const effectiveStats = owned ? getEffectiveStats(owned) : null;
      const creatureTheme = getCreatureTheme(this.activeCreatureDef.id);
      skillSystem.setActiveSkill(
        this.activeSpecialSkillKind,
        this.activeSpecialSkillName,
        effectiveStats?.specialSkillCooldown ?? this.specialSkillCooldownTime,
        this.activeCreatureDef,
        creatureTheme
      );
    }
  }

  setHpBarManager(hpBarManager: HPBarManager | null): void {
    this.hpBarManager = hpBarManager;
  }

  setMpClient(mpClient: MultiplayerClient | null): void {
    this.mpClient = mpClient;
  }

  setUpdatePlayerVisual(callback: (() => void) | null): void {
    this.updatePlayerVisual = callback;
  }

  /**
   * Processa input de troca de criaturas.
   * Retorna true se houve troca bem-sucedida.
   */
  handleCreatureSwitching(
    teamSwitchKeys: Phaser.Input.Keyboard.Key[],
    onSwitch: (index: number, label: string) => void
  ): boolean {
    const teamIds = this.activeTeamIds;
    if (teamIds.length <= 1 || teamSwitchKeys.length === 0) return false;

    for (let i = 0; i < teamSwitchKeys.length; i++) {
      const key = teamSwitchKeys[i];
      if (!key) continue;
      if (Phaser.Input.Keyboard.JustDown(key)) {
        if (i < teamIds.length && i !== this.activeCreatureIndex) {
          if (this.switchToCreature(i)) {
            const label = this.activeDef?.name ?? `Criatura ${i + 1}`;
            onSwitch(i, label);
            return true;
          }
        }
      }
    }
    return false;
  }
}
