import Phaser from "phaser";
import type { CreatureDefinition, ElementType } from "./types";
import { TYPE_COLORS, HP_BAR_CONFIG } from "../../shared/visualConfig";

// ✅ Re-exportar do shared para manter compatibilidade
export { TYPE_COLORS, HP_BAR_CONFIG } from "../../shared/visualConfig";

/**
 * Representa uma barra de HP individual com seus elementos gráficos.
 */
export interface HPBarElements {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  label?: Phaser.GameObjects.Text;
  glowEffect?: Phaser.GameObjects.Rectangle;
}

/**
 * Estado de uma barra de HP para detecção de mudanças
 */
interface HPBarState {
  currentHp: number;
  maxHp: number;
  lastUpdateTime: number;
  isFlashing: boolean;
  flashTween?: Phaser.Tweens.Tween;
}

/**
 * Gerenciador de barras de HP para a cena de expedição.
 * Otimizado para atualizar apenas quando há mudanças no HP.
 */
export class HPBarManager {
  private scene: Phaser.Scene;
  private playerBar: HPBarElements | null = null;
  private allyBars: Map<string, HPBarElements> = new Map();
  private enemyBars: Map<string, HPBarElements> = new Map();
  private barStates: Map<string, HPBarState> = new Map();

  // Pool de barras de inimigos para reutilização
  private enemyBarPool: HPBarElements[] = [];
  private activeEnemyBars: Map<string, HPBarElements> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Cria a barra de HP do jogador/criatura ativa no HUD fixo.
   */
  createPlayerBar(x: number, y: number, creatureDef: CreatureDefinition | null): HPBarElements {
    const config = HP_BAR_CONFIG.player;
    const typeColors = creatureDef ? TYPE_COLORS[creatureDef.primaryType as ElementType] : TYPE_COLORS.Fogo;

    const container = this.scene.add.container(x, y);
    container.setDepth(100);
    container.setScrollFactor(0); // Fixa no HUD, não move com a câmera

    // Fundo da barra
    const background = this.scene.add.rectangle(
      0, 0,
      config.width, config.height,
      config.bgColor, config.bgAlpha
    ).setOrigin(0, 0.5);

    // Borda
    const border = this.scene.add.rectangle(
      0, 0,
      config.width, config.height,
      0x000000, 0
    ).setOrigin(0, 0.5).setStrokeStyle(config.borderWidth, config.borderColor);

    // Barra de preenchimento
    const fill = this.scene.add.rectangle(
      config.borderWidth, 0,
      config.width - config.borderWidth * 2, config.height - config.borderWidth * 2,
      typeColors.primary, 1
    ).setOrigin(0, 0.5);

    // Efeito de brilho (para quando HP está baixo)
    const glowEffect = this.scene.add.rectangle(
      0, 0,
      config.width + 4, config.height + 4,
      typeColors.glow, 0
    ).setOrigin(0, 0.5);

    // Label do HP
    const label = this.scene.add.text(
      config.width + 10, 0,
      "100/100",
      {
        fontSize: "14px",
        color: "#e5e7eb",
        fontStyle: "bold"
      }
    ).setOrigin(0, 0.5);

    container.add([glowEffect, background, fill, border, label]);

    this.playerBar = { container, background, fill, border, label, glowEffect };
    this.barStates.set("player", {
      currentHp: 0,
      maxHp: 0,
      lastUpdateTime: 0,
      isFlashing: false
    });

    return this.playerBar;
  }

  /**
   * Cria barras de HP para criaturas aliadas (equipe) no HUD.
   */
  createAllyBar(
    id: string,
    x: number,
    y: number,
    creatureDef: CreatureDefinition | null,
    isActive: boolean
  ): HPBarElements {
    const config = HP_BAR_CONFIG.ally;
    const typeColors = creatureDef ? TYPE_COLORS[creatureDef.primaryType as ElementType] : TYPE_COLORS.Fogo;

    const container = this.scene.add.container(x, y);
    container.setDepth(100);
    container.setScrollFactor(0); // Fixa no HUD, não move com a câmera
    container.setAlpha(isActive ? 1 : 0.6);

    const background = this.scene.add.rectangle(
      0, 0,
      config.width, config.height,
      config.bgColor, config.bgAlpha
    ).setOrigin(0, 0.5);

    const border = this.scene.add.rectangle(
      0, 0,
      config.width, config.height,
      0x000000, 0
    ).setOrigin(0, 0.5).setStrokeStyle(config.borderWidth, isActive ? typeColors.glow : config.borderColor);

    const fill = this.scene.add.rectangle(
      config.borderWidth, 0,
      config.width - config.borderWidth * 2, config.height - config.borderWidth * 2,
      typeColors.primary, 1
    ).setOrigin(0, 0.5);

    // Nome da criatura
    const label = this.scene.add.text(
      0, -config.height - 2,
      creatureDef?.name ?? "???",
      {
        fontSize: "11px",
        color: isActive ? "#ffffff" : "#9ca3af"
      }
    ).setOrigin(0, 1);

    container.add([background, fill, border, label]);

    const barElements = { container, background, fill, border, label };
    this.allyBars.set(id, barElements);
    this.barStates.set(id, {
      currentHp: 0,
      maxHp: 0,
      lastUpdateTime: 0,
      isFlashing: false
    });

    return barElements;
  }

  /**
   * Obtém ou cria uma barra de HP para um inimigo.
   * Usa pool de objetos para evitar criações desnecessárias.
   */
  private getOrCreateEnemyBar(enemyId: string): HPBarElements {
    // Verifica se já existe uma barra ativa para este inimigo
    if (this.activeEnemyBars.has(enemyId)) {
      return this.activeEnemyBars.get(enemyId)!;
    }

    // Tenta pegar uma barra do pool
    let bar = this.enemyBarPool.pop();

    if (!bar) {
      // Cria uma nova barra se o pool está vazio
      bar = this.createEnemyBarElements();
    }

    bar.container.setVisible(true);
    this.activeEnemyBars.set(enemyId, bar);
    this.barStates.set(`enemy_${enemyId}`, {
      currentHp: 0,
      maxHp: 0,
      lastUpdateTime: 0,
      isFlashing: false
    });

    return bar;
  }

  /**
   * Cria os elementos gráficos para uma barra de inimigo.
   */
  private createEnemyBarElements(): HPBarElements {
    const config = HP_BAR_CONFIG.enemy;

    const container = this.scene.add.container(0, 0);
    container.setDepth(50);

    const background = this.scene.add.rectangle(
      0, 0,
      config.width, config.height,
      config.bgColor, config.bgAlpha
    ).setOrigin(0.5, 0.5);

    const border = this.scene.add.rectangle(
      0, 0,
      config.width, config.height,
      0x000000, 0
    ).setOrigin(0.5, 0.5).setStrokeStyle(config.borderWidth, config.borderColor);

    const fill = this.scene.add.rectangle(
      -config.width / 2 + config.borderWidth, 0,
      config.width - config.borderWidth * 2, config.height - config.borderWidth * 2,
      HP_BAR_CONFIG.stateColors.healthy, 1
    ).setOrigin(0, 0.5);

    container.add([background, fill, border]);

    return { container, background, fill, border };
  }

  /**
   * Retorna uma barra de inimigo para o pool.
   */
  private returnEnemyBarToPool(enemyId: string) {
    const bar = this.activeEnemyBars.get(enemyId);
    if (bar) {
      bar.container.setVisible(false);
      this.activeEnemyBars.delete(enemyId);
      this.enemyBarPool.push(bar);
      this.barStates.delete(`enemy_${enemyId}`);
    }
  }

  /**
   * Atualiza a barra de HP do jogador.
   * Só atualiza visualmente se houve mudança no HP.
   */
  updatePlayerBar(
    currentHp: number,
    maxHp: number,
    creatureDef: CreatureDefinition | null,
    tookDamage: boolean = false
  ) {
    if (!this.playerBar) return;

    const state = this.barStates.get("player");
    const config = HP_BAR_CONFIG.player;
    const typeColors = creatureDef ? TYPE_COLORS[creatureDef.primaryType as ElementType] : TYPE_COLORS.Fogo;

    // Verifica se houve mudança
    if (state && state.currentHp === currentHp && state.maxHp === maxHp && !tookDamage) {
      return; // Nenhuma mudança, não atualiza
    }

    const ratio = maxHp > 0 ? Math.max(0, currentHp / maxHp) : 0;
    const fillWidth = (config.width - config.borderWidth * 2) * ratio;

    // Atualiza largura da barra
    this.playerBar.fill.setSize(fillWidth, config.height - config.borderWidth * 2);

    // Determina cor baseada no estado de HP
    let fillColor = typeColors.primary;
    if (ratio <= HP_BAR_CONFIG.thresholds.low) {
      fillColor = HP_BAR_CONFIG.stateColors.low;
    } else if (ratio <= HP_BAR_CONFIG.thresholds.medium) {
      fillColor = HP_BAR_CONFIG.stateColors.medium;
    }
    this.playerBar.fill.setFillStyle(fillColor);

    // Atualiza label
    if (this.playerBar.label) {
      this.playerBar.label.setText(`${Math.floor(currentHp)}/${maxHp}`);
    }

    // Efeito de dano recente
    if (tookDamage && state && !state.isFlashing) {
      this.flashBar(this.playerBar, "player");
    }

    // Efeito de HP baixo (brilho pulsante)
    if (this.playerBar.glowEffect) {
      if (ratio <= HP_BAR_CONFIG.thresholds.low) {
        this.startLowHpGlow(this.playerBar, "player");
      } else {
        this.stopLowHpGlow(this.playerBar, "player");
      }
    }

    // Atualiza estado
    if (state) {
      state.currentHp = currentHp;
      state.maxHp = maxHp;
      state.lastUpdateTime = this.scene.time.now;
    }
  }

  /**
   * Atualiza a barra de HP de uma criatura aliada.
   */
  updateAllyBar(
    id: string,
    currentHp: number,
    maxHp: number,
    isActive: boolean
  ) {
    const bar = this.allyBars.get(id);
    if (!bar) return;

    const state = this.barStates.get(id);
    const config = HP_BAR_CONFIG.ally;

    // Verifica se houve mudança
    if (state && state.currentHp === currentHp && state.maxHp === maxHp) {
      return;
    }

    const ratio = maxHp > 0 ? Math.max(0, currentHp / maxHp) : 0;
    const fillWidth = (config.width - config.borderWidth * 2) * ratio;

    bar.fill.setSize(fillWidth, config.height - config.borderWidth * 2);
    bar.container.setAlpha(isActive ? 1 : 0.6);

    // Cor baseada no estado
    let fillColor: number = HP_BAR_CONFIG.stateColors.healthy;
    if (ratio <= HP_BAR_CONFIG.thresholds.low) {
      fillColor = HP_BAR_CONFIG.stateColors.low;
    } else if (ratio <= HP_BAR_CONFIG.thresholds.medium) {
      fillColor = HP_BAR_CONFIG.stateColors.medium;
    }
    bar.fill.setFillStyle(fillColor);

    if (state) {
      state.currentHp = currentHp;
      state.maxHp = maxHp;
      state.lastUpdateTime = this.scene.time.now;
    }
  }

  /**
   * Atualiza barras de HP dos inimigos próximos.
   * @param enemies Lista de inimigos com suas posições e HP
   * @param playerX Posição X do jogador
   * @param playerY Posição Y do jogador
   */
  updateEnemyBars(
    enemies: Array<{
      id: string;
      x: number;
      y: number;
      currentHp: number;
      maxHp: number;
      inCombat: boolean;
    }>,
    playerX: number,
    playerY: number
  ) {
    const config = HP_BAR_CONFIG.enemy;
    const activeIds = new Set<string>();

    for (const enemy of enemies) {
      const dx = enemy.x - playerX;
      const dy = enemy.y - playerY;
      const distance = Math.hypot(dx, dy);

      // Só mostra barra se estiver em combate ou próximo o suficiente
      if (!enemy.inCombat && distance > config.maxDistance) {
        continue;
      }

      // Não mostra barra se o inimigo está morto
      if (enemy.currentHp <= 0) {
        continue;
      }

      activeIds.add(enemy.id);
      const bar = this.getOrCreateEnemyBar(enemy.id);
      const state = this.barStates.get(`enemy_${enemy.id}`);

      // Posiciona a barra acima do inimigo
      bar.container.setPosition(enemy.x, enemy.y + config.offsetY);

      // Verifica se houve mudança no HP
      const hpChanged = !state || state.currentHp !== enemy.currentHp || state.maxHp !== enemy.maxHp;

      if (hpChanged) {
        const ratio = enemy.maxHp > 0 ? Math.max(0, enemy.currentHp / enemy.maxHp) : 0;
        const fillWidth = (config.width - config.borderWidth * 2) * ratio;

        bar.fill.setSize(fillWidth, config.height - config.borderWidth * 2);

        // Cor baseada no estado
        let fillColor: number = HP_BAR_CONFIG.stateColors.healthy;
        if (ratio <= HP_BAR_CONFIG.thresholds.low) {
          fillColor = HP_BAR_CONFIG.stateColors.low;
        } else if (ratio <= HP_BAR_CONFIG.thresholds.medium) {
          fillColor = HP_BAR_CONFIG.stateColors.medium;
        }
        bar.fill.setFillStyle(fillColor);

        // Efeito de flash quando leva dano
        if (state && state.currentHp > enemy.currentHp) {
          this.flashEnemyBar(bar);
        }

        if (state) {
          state.currentHp = enemy.currentHp;
          state.maxHp = enemy.maxHp;
          state.lastUpdateTime = this.scene.time.now;
        }
      }
    }

    // Retorna barras de inimigos que não estão mais visíveis para o pool
    for (const [enemyId] of this.activeEnemyBars) {
      if (!activeIds.has(enemyId)) {
        this.returnEnemyBarToPool(enemyId);
      }
    }
  }

  /**
   * Efeito de flash na barra quando toma dano.
   */
  private flashBar(bar: HPBarElements, stateKey: string) {
    const state = this.barStates.get(stateKey);
    if (!state || state.isFlashing) return;

    state.isFlashing = true;

    // Flash branco rápido
    const originalColor = bar.fill.fillColor;
    bar.fill.setFillStyle(0xffffff);

    this.scene.time.delayedCall(80, () => {
      bar.fill.setFillStyle(originalColor);
      this.scene.time.delayedCall(80, () => {
        bar.fill.setFillStyle(0xffffff);
        this.scene.time.delayedCall(80, () => {
          bar.fill.setFillStyle(originalColor);
          if (state) state.isFlashing = false;
        });
      });
    });
  }

  /**
   * Efeito de flash para barras de inimigos (mais sutil).
   */
  private flashEnemyBar(bar: HPBarElements) {
    const originalColor = bar.fill.fillColor;
    bar.fill.setFillStyle(0xffffff);

    this.scene.time.delayedCall(60, () => {
      bar.fill.setFillStyle(originalColor);
    });
  }

  /**
   * Inicia efeito de brilho pulsante quando HP está baixo.
   */
  private startLowHpGlow(bar: HPBarElements, stateKey: string) {
    if (!bar.glowEffect) return;
    
    const state = this.barStates.get(stateKey);
    if (state?.flashTween) return; // Já está pulsando

    bar.glowEffect.setAlpha(0.3);

    const tween = this.scene.tweens.add({
      targets: bar.glowEffect,
      alpha: { from: 0.3, to: 0.6 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    if (state) {
      state.flashTween = tween;
    }
  }

  /**
   * Para o efeito de brilho pulsante.
   */
  private stopLowHpGlow(bar: HPBarElements, stateKey: string) {
    if (!bar.glowEffect) return;

    const state = this.barStates.get(stateKey);
    if (state?.flashTween) {
      state.flashTween.stop();
      state.flashTween = undefined;
    }

    bar.glowEffect.setAlpha(0);
  }

  /**
   * Atualiza a cor da barra do jogador para refletir a criatura ativa.
   */
  updatePlayerBarColor(creatureDef: CreatureDefinition | null) {
    if (!this.playerBar) return;

    const typeColors = creatureDef ? TYPE_COLORS[creatureDef.primaryType as ElementType] : TYPE_COLORS.Fogo;
    
    // Força atualização na próxima chamada de updatePlayerBar
    const state = this.barStates.get("player");
    if (state) {
      state.currentHp = -1; // Força refresh
    }

    // Atualiza cor do glow
    if (this.playerBar.glowEffect) {
      this.playerBar.glowEffect.setFillStyle(typeColors.glow);
    }
  }

  /**
   * Marca uma barra de aliado como ativa ou inativa.
   */
  setAllyBarActive(id: string, isActive: boolean, creatureDef: CreatureDefinition | null) {
    const bar = this.allyBars.get(id);
    if (!bar) return;

    // Verificar se o container ainda é válido (não foi destruído)
    if (!bar.container || !bar.container.scene) return;

    const typeColors = creatureDef ? TYPE_COLORS[creatureDef.primaryType as ElementType] : TYPE_COLORS.Fogo;
    const config = HP_BAR_CONFIG.ally;

    bar.container.setAlpha(isActive ? 1 : 0.6);
    
    if (bar.border && bar.border.scene) {
      bar.border.setStrokeStyle(config.borderWidth, isActive ? typeColors.glow : config.borderColor);
    }

    if (bar.label && bar.label.scene) {
      bar.label.setColor(isActive ? "#ffffff" : "#9ca3af");
    }
  }

  /**
   * Limpa todas as barras de HP.
   */
  destroy() {
    if (this.playerBar) {
      this.playerBar.container.destroy();
      this.playerBar = null;
    }

    for (const bar of this.allyBars.values()) {
      bar.container.destroy();
    }
    this.allyBars.clear();

    for (const bar of this.activeEnemyBars.values()) {
      bar.container.destroy();
    }
    this.activeEnemyBars.clear();

    for (const bar of this.enemyBarPool) {
      bar.container.destroy();
    }
    this.enemyBarPool = [];

    this.barStates.clear();
  }
}
