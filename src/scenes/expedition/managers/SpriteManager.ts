import Phaser from "phaser";
import type {
  RemoteCreatureSprite,
  RemoteResourceSprite,
  RemotePlayerSprite
} from "../types/ExpeditionTypes";
import type {
  GameWorldState,
  CreatureState,
  ResourceState,
  PlayerState
} from "../../../game/worldState";
import { getCreatureById } from "../../../../shared/creatures";
import { getCreatureTheme } from "../../../game/creatureThemes";

/**
 * Gerencia sprites de criaturas, recursos e jogadores.
 * Responsável por criar, atualizar e destruir sprites visuais.
 */
export class SpriteManager {
  private scene: Phaser.Scene;
  private worldState: GameWorldState;
  private creatureSprites: Map<string, RemoteCreatureSprite> = new Map();
  private resourceSprites: Map<string, RemoteResourceSprite> = new Map();
  private playerSprites: Map<string, RemotePlayerSprite> = new Map();
  private readonly remotePlayerRenderDistance = 800;

  constructor(scene: Phaser.Scene, worldState: GameWorldState) {
    this.scene = scene;
    this.worldState = worldState;
  }

  // ============================================================================
  // CRIAÇÃO DE SPRITES
  // ============================================================================

  /**
   * Cria um sprite visual para uma criatura do worldState.
   */
  createCreatureSprite(creature: CreatureState): void {
    // Evita duplicação
    if (this.creatureSprites.has(creature.id)) {
      return;
    }

    // ✅ IA #7: Usa cor baseada na espécie da criatura ao invés do tier
    const creatureType = creature.speciesId ?? creature.creatureType ?? "";
    const theme = getCreatureTheme(creatureType);
    const creatureColor = theme.primaryColor;
    const strokeColor = theme.strokeColor;

    // Cria sprite principal com cor da espécie
    const sprite = this.scene.add.circle(creature.x, creature.y, 12, creatureColor, 1);
    sprite.setStrokeStyle(2, strokeColor, 1);
    sprite.setDepth(2);

    // ✅ BUG FIX: HPBarManager gerencia barras de HP de inimigos
    // Criamos barras de HP vazias/invisíveis aqui apenas para manter a interface
    // O HPBarManager criará e gerenciará as barras de HP reais
    const hpBarBg = this.scene.add.rectangle(creature.x, creature.y - 20, 40, 4, 0x000000, 0);
    hpBarBg.setOrigin(0.5, 0.5);
    hpBarBg.setDepth(3);
    hpBarBg.setVisible(false); // Oculto - HPBarManager gerencia a barra real

    const hpBar = this.scene.add.rectangle(creature.x, creature.y - 20, 40, 4, 0x00ff00, 0);
    hpBar.setOrigin(0, 0.5);
    hpBar.setDepth(3);
    hpBar.setVisible(false); // Oculto - HPBarManager gerencia a barra real

    const hpBarText = this.scene.add.text(creature.x, creature.y - 24, "", {
      fontSize: "10px",
      color: "#ffffff"
    });
    hpBarText.setOrigin(0.5, 1);
    hpBarText.setDepth(3);
    hpBarText.setVisible(false); // Oculto - HPBarManager gerencia a barra real

    // Cria texto de nome e nível acima da criatura
    const creatureName = getCreatureById(creature.speciesId ?? creature.creatureType ?? "")?.name ?? "Desconhecido";
    const levelText = creature.level ? ` Lv.${creature.level}` : "";
    const nameText = this.scene.add.text(creature.x, creature.y - 35, `${creatureName}${levelText}`, {
      fontSize: "11px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
      fontStyle: "bold"
    });
    nameText.setOrigin(0.5, 1);
    nameText.setDepth(4);

    // Cria indicador de aggro (inicialmente invisível)
    const aggroIndicator = this.scene.add.circle(creature.x, creature.y, 20, 0xff0000, 0);
    aggroIndicator.setDepth(1);

    // Armazena o sprite completo
    const creatureSprite: RemoteCreatureSprite = {
      id: creature.id,
      sprite,
      hpBar,
      hpBarBg,
      hpBarText,
      nameText,
      currentX: creature.x,
      currentY: creature.y,
      targetX: creature.x,
      targetY: creature.y,
      currentHp: creature.currentHp,
      maxHp: creature.maxHp,
      tier: creature.tier,
      creatureType: creature.creatureType,
      speciesId: creature.speciesId,
      level: creature.level,
      behaviorType: creature.behaviorType,
      aiState: creature.aiState,
      aiConfig: creature.aiConfig,
      attackCooldownRemaining: creature.attackCooldownRemaining,
      windupTimer: creature.windupTimer,
      skillWindupTimer: creature.skillWindupTimer, // ✅ Windup de skill
      stunTimer: creature.stunTimer,
      aggroIndicator,
      attackTellIndicator: undefined,
      skillTellIndicator: undefined, // ✅ Indicador de skill
      patrolOrigin: creature.patrolOrigin,
      patrolTimer: creature.patrolTimer,
      state: creature.state,
      skipFirstInterpolation: true,
      dashState: undefined // ✅ Inicializar dashState como undefined
    };

    this.creatureSprites.set(creature.id, creatureSprite);
  }

  /**
   * Cria um sprite visual para um recurso do worldState.
   */
  createResourceSprite(resource: ResourceState): void {
    // Evita duplicação
    if (this.resourceSprites.has(resource.id)) {
      return;
    }

    // Cria sprite losango (rectangle rotacionado 45°)
    const sprite = this.scene.add.rectangle(
      resource.x,
      resource.y,
      resource.size,
      resource.size,
      resource.color
    );
    sprite.setAngle(45);
    sprite.setStrokeStyle(resource.borderWidth, resource.borderColor, 0.95);
    sprite.setDepth(1);

    // Armazena o sprite completo
    const resourceSprite: RemoteResourceSprite = {
      id: resource.id,
      sprite,
      currentX: resource.x,
      currentY: resource.y,
      targetX: resource.x,
      targetY: resource.y,
      resourceType: resource.type,
      amount: resource.amount,
      isRare: resource.isRare,
      size: resource.size,
      color: resource.color,
      borderColor: resource.borderColor,
      borderWidth: resource.borderWidth,
      skipFirstInterpolation: true
    };

    this.resourceSprites.set(resource.id, resourceSprite);
  }

  /**
   * Cria um sprite de jogador e adiciona ao mapa de sprites.
   */
  createPlayerSprite(player: PlayerState): void {
    const sprite = this.scene.add.circle(player.x, player.y, player.radius, player.color);
    sprite.setDepth(5);

    const nameText = this.scene.add.text(player.x, player.y - player.radius - 10, player.name, {
      fontSize: "12px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 4, y: 2 }
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(5);

    const hpBarBg = this.scene.add.rectangle(player.x, player.y - player.radius - 25, 50, 5, 0x333333);
    hpBarBg.setOrigin(0.5);
    hpBarBg.setDepth(5);

    const hpBar = this.scene.add.rectangle(player.x, player.y - player.radius - 25, 50, 5, 0x00ff00);
    hpBar.setOrigin(0.5, 0.5);
    hpBar.setDepth(5);

    const hpBarText = this.scene.add.text(player.x, player.y - player.radius - 35, `${player.hp}/${player.maxHp}`, {
      fontSize: "10px",
      color: "#ffffff"
    });
    hpBarText.setOrigin(0.5);
    hpBarText.setDepth(5);

    const playerSprite: RemotePlayerSprite = {
      id: player.id,
      name: player.name,
      sprite,
      nameText,
      hpBar,
      hpBarBg,
      hpBarText,
      currentX: player.x,
      currentY: player.y,
      targetX: player.x,
      targetY: player.y,
      currentHp: player.hp,
      maxHp: player.maxHp,
      lastUpdate: player.lastUpdate,
      color: player.color,
      radius: player.radius,
      actionIndicator: null,
      actionType: player.actionType,
      actionTimer: player.actionTimer,
      isVisible: player.isVisible,
      skipFirstInterpolation: true
    };

    this.playerSprites.set(player.id, playerSprite);
  }

  // ============================================================================
  // ATUALIZAÇÃO DE SPRITES
  // ============================================================================

  /**
   * Atualiza sprite de criatura existente baseado no estado.
   */
  updateCreatureSprite(creatureId: string): void {
    const sprite = this.creatureSprites.get(creatureId);
    const state = this.worldState.getCreature(creatureId);

    if (!sprite || !state) return;

    // Atualiza posição alvo para interpolação (ANTES de detectar dash)
    const previousTargetX = sprite.targetX;
    const previousTargetY = sprite.targetY;
    sprite.targetX = state.x;
    sprite.targetY = state.y;

    // ✅ DETECÇÃO DE DASH: Verificar se criatura Pyrognat fez dash
    const isPyrognat = (state.creatureType === "pyrognat" || state.speciesId === "pyrognat");
    const previousSkillWindup = sprite.skillWindupTimer ?? 0;

    // ✅ BUG #2 FIX: Verifica se HP mudou antes de atualizar
    const hpChanged = sprite.currentHp !== state.currentHp || sprite.maxHp !== state.maxHp;

    // Atualiza HP
    sprite.currentHp = state.currentHp;
    sprite.maxHp = state.maxHp;

    // Atualiza timers de IA
    sprite.attackCooldownRemaining = state.attackCooldownRemaining;
    sprite.windupTimer = state.windupTimer;
    sprite.skillWindupTimer = (state as any).skillWindupTimer ?? 0; // ✅ Windup de skill
    sprite.stunTimer = state.stunTimer;
    sprite.aiState = state.aiState;

    // ✅ DETECÇÃO DE DASH: Se é Pyrognat e houve mudança grande de posição
    // Apenas detectar dash se não está já em dash e é Pyrognat
    if (isPyrognat && !sprite.dashState) {
      const distanceChange = Math.hypot(
        sprite.targetX - previousTargetX,
        sprite.targetY - previousTargetY
      );
      const DASH_DETECTION_THRESHOLD = 50; // Mínimo de 50px de movimento para considerar dash

      // Detectar dash: mudança grande de posição + relacionado a skill
      // Condição simplificada: se houve mudança grande E (estava em windup OU acabou de sair do windup)
      const wasInSkillWindup = previousSkillWindup > 0.01;
      const isNowOutOfWindup = (sprite.skillWindupTimer ?? 0) <= 0.01;
      const skillRelated = wasInSkillWindup || isNowOutOfWindup;

      const shouldDetectDash =
        distanceChange >= DASH_DETECTION_THRESHOLD &&
        skillRelated;

      if (shouldDetectDash) {
        // Iniciar animação de dash
        const dashDuration = 0.3; // Duração do dash em segundos (igual ao servidor)
        sprite.dashState = {
          startX: sprite.currentX || previousTargetX || sprite.targetX,
          startY: sprite.currentY || previousTargetY || sprite.targetY,
          targetX: sprite.targetX,
          targetY: sprite.targetY,
          duration: dashDuration,
          elapsed: 0,
          speedMultiplier: 3.0 // 3x mais rápido durante dash
        };

        console.log(
          `[SpriteManager] ✅ Dash detectado para ${creatureId.slice(0, 8)}... ` +
          `(${previousTargetX.toFixed(0)}, ${previousTargetY.toFixed(0)}) -> ` +
          `(${sprite.targetX.toFixed(0)}, ${sprite.targetY.toFixed(0)}) ` +
          `[distância: ${distanceChange.toFixed(0)}px, windup: ${previousSkillWindup.toFixed(2)}s -> ${(sprite.skillWindupTimer ?? 0).toFixed(2)}s]`
        );
      }
    }

    // Atualiza nome e nível se mudaram
    const levelChanged = sprite.level !== state.level;
    const speciesChanged = sprite.speciesId !== state.speciesId || sprite.creatureType !== state.creatureType;

    if (levelChanged || speciesChanged) {
      sprite.level = state.level;
      sprite.speciesId = state.speciesId;
      sprite.creatureType = state.creatureType;

      const creatureName = getCreatureById(state.speciesId ?? state.creatureType ?? "")?.name ?? "Desconhecido";
      const levelText = state.level ? ` Lv.${state.level}` : "";
      sprite.nameText.setText(`${creatureName}${levelText}`);
    }

    // ✅ BUG FIX: HPBarManager gerencia barras de HP de inimigos
    // Não atualizamos as barras aqui - elas são invisíveis
    // O HPBarManager atualiza as barras reais via updateEnemyBars()

    // ✅ BUG #2 FIX: Log de debug quando HP muda (apenas a cada 10 updates para não poluir)
    if (hpChanged && Math.random() < 0.1) {
      const hpPercent = state.maxHp > 0 ? Math.max(0, state.currentHp / state.maxHp) : 0;
      console.log(
        `[SpriteManager] HP atualizado: ${creatureId.slice(0, 8)}... ` +
        `HP: ${sprite.currentHp}/${sprite.maxHp} (${(hpPercent * 100).toFixed(1)}%)`
      );
    }
  }

  /**
   * Atualiza sprite de recurso existente baseado no estado.
   */
  updateResourceSprite(resourceId: string): void {
    const sprite = this.resourceSprites.get(resourceId);
    const state = this.worldState.getResource(resourceId);

    if (!sprite || !state) return;

    // Atualiza posição alvo para interpolação
    sprite.targetX = state.x;
    sprite.targetY = state.y;

    // Atualiza quantidade
    sprite.amount = state.amount;
  }

  /**
   * Atualiza propriedades visuais de um sprite de jogador existente.
   */
  updatePlayerSprite(player: PlayerState): void {
    const sprite = this.playerSprites.get(player.id);
    if (!sprite) return;

    // Atualiza posição alvo
    sprite.targetX = player.x;
    sprite.targetY = player.y;

    // Atualiza HP
    sprite.currentHp = player.hp;
    sprite.maxHp = player.maxHp;

    // Atualiza nome (pode ter mudado)
    sprite.name = player.name;
    sprite.nameText.setText(player.name);

    // Atualiza timestamp
    sprite.lastUpdate = player.lastUpdate;

    // Atualiza propriedades visuais
    sprite.color = player.color;
    sprite.radius = player.radius;
    sprite.sprite.setRadius(player.radius);
    sprite.sprite.setFillStyle(player.color);

    // Atualiza ação
    sprite.actionType = player.actionType;
    sprite.actionTimer = player.actionTimer;
    sprite.isVisible = player.isVisible;

    // Atualiza visibilidade
    const visible = player.isVisible;
    sprite.sprite.setVisible(visible);
    sprite.nameText.setVisible(visible);
    sprite.hpBar.setVisible(visible);
    sprite.hpBarBg.setVisible(visible);
    sprite.hpBarText.setVisible(visible);
    if (sprite.actionIndicator) {
      sprite.actionIndicator.setVisible(visible);
    }
  }

  /**
   * Atualiza posições de todos os sprites de criaturas (interpolação suave).
   */
  updateCreatureSprites(dt: number, playerX: number, playerY: number): void {
    const lerpFactor = Math.min(1, dt * 15);
    const maxSpeed = 500;

    for (const [creatureId, sprite] of this.creatureSprites) {
      try {
        const creatureState = this.worldState.getCreature(creatureId);
        if (!creatureState) {
          console.warn(`[SpriteManager] Sprite órfão detectado: ${creatureId.slice(0, 8)}... - Removendo`);
          this.destroyCreatureSprite(creatureId);
          continue;
        }

        if (creatureState.currentHp <= 0) {
          console.warn(`[SpriteManager] Criatura morta detectada: ${creatureId.slice(0, 8)}... - Removendo`);
          this.destroyCreatureSprite(creatureId);
          continue;
        }

        // Primeira interpolação: snap direto
        if (sprite.skipFirstInterpolation) {
          sprite.currentX = sprite.targetX;
          sprite.currentY = sprite.targetY;
          sprite.skipFirstInterpolation = false;
          this.updateCreatureSpritePosition(sprite);
          continue;
        }

        // ✅ ANIMAÇÃO DE DASH: Se criatura está em dash, usar interpolação rápida
        if (sprite.dashState) {
          try {
            sprite.dashState.elapsed += dt;
            const progress = Math.min(1, sprite.dashState.elapsed / sprite.dashState.duration);

            // Interpolação suave durante dash (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);

            sprite.currentX = sprite.dashState.startX +
              (sprite.dashState.targetX - sprite.dashState.startX) * easeOut;
            sprite.currentY = sprite.dashState.startY +
              (sprite.dashState.targetY - sprite.dashState.startY) * easeOut;

            // Efeito visual: aumentar escala ligeiramente durante dash
            const dashScale = 1.0 + (0.2 * (1 - progress)); // Começa 20% maior, volta ao normal
            if (sprite.sprite && sprite.sprite.setScale) {
              sprite.sprite.setScale(dashScale);
            }

            // ✅ Efeito visual de brilho laranja/vermelho durante dash (tema de fogo)
            const intensity = 1 - progress; // Mais intenso no início
            // Interpolação manual de cor: branco (0xffffff) -> laranja (0xff6b35)
            const r1 = 0xff, g1 = 0xff, b1 = 0xff; // Branco
            const r2 = 0xff, g2 = 0x6b, b2 = 0x35; // Laranja avermelhado
            const r = Math.floor(r1 + (r2 - r1) * intensity);
            const g = Math.floor(g1 + (g2 - g1) * intensity);
            const b = Math.floor(b1 + (b2 - b1) * intensity);
            const tintColor = (r << 16) | (g << 8) | b;
            if (sprite.sprite && 'setTint' in sprite.sprite) {
              (sprite.sprite as unknown as Phaser.GameObjects.Components.Tint).setTint(tintColor);
            }

            // Se dash terminou, remover estado e resetar escala/tint
            if (progress >= 1) {
              sprite.dashState = undefined;
              if (sprite.sprite) {
                if ('setScale' in sprite.sprite) (sprite.sprite as unknown as Phaser.GameObjects.Components.Transform).setScale(1.0);
                if ('clearTint' in sprite.sprite) (sprite.sprite as unknown as Phaser.GameObjects.Components.Tint).clearTint();
              }
              // Snap para posição final
              sprite.currentX = sprite.targetX;
              sprite.currentY = sprite.targetY;
            }

            this.updateCreatureSpritePosition(sprite);
            continue;
          } catch (dashError) {
            console.error(`[SpriteManager] Erro durante dash de ${creatureId.slice(0, 8)}...:`, dashError);
            // Limpar estado de dash em caso de erro
            sprite.dashState = undefined;
            if (sprite.sprite) {
              try {
                if ('setScale' in sprite.sprite) (sprite.sprite as unknown as Phaser.GameObjects.Components.Transform).setScale(1.0);
                if ('clearTint' in sprite.sprite) (sprite.sprite as unknown as Phaser.GameObjects.Components.Tint).clearTint();
              } catch (e) {
                // Ignorar erros de reset
              }
            }
            // Continuar com interpolação normal
          }
        }

        // Interpolação híbrida normal
        const dx = sprite.targetX - sprite.currentX;
        const dy = sprite.targetY - sprite.currentY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0.5) {
          let newX = sprite.currentX + dx * lerpFactor;
          let newY = sprite.currentY + dy * lerpFactor;

          const movedX = newX - sprite.currentX;
          const movedY = newY - sprite.currentY;
          const movedDist = Math.sqrt(movedX * movedX + movedY * movedY);

          const maxMove = maxSpeed * dt;
          if (movedDist > maxMove && distance > maxMove) {
            const scale = maxMove / movedDist;
            newX = sprite.currentX + movedX * scale;
            newY = sprite.currentY + movedY * scale;
          }

          sprite.currentX = newX;
          sprite.currentY = newY;
        } else {
          sprite.currentX = sprite.targetX;
          sprite.currentY = sprite.targetY;
        }

        this.updateCreatureSpritePosition(sprite);
      } catch (error) {
        console.error(`[SpriteManager] Erro ao interpolar criatura ${creatureId.slice(0, 8)}...:`, error);
        this.destroyCreatureSprite(creatureId);
      }
    }
  }

  /**
   * Atualiza posições de todos os sprites de recursos (interpolação suave).
   */
  updateResourceSprites(dt: number): void {
    const interpolationSpeed = 200;

    for (const [resourceId, sprite] of this.resourceSprites) {
      if (sprite.skipFirstInterpolation) {
        sprite.currentX = sprite.targetX;
        sprite.currentY = sprite.targetY;
        sprite.skipFirstInterpolation = false;
        sprite.sprite.setPosition(sprite.currentX, sprite.currentY);
        continue;
      }

      const dx = sprite.targetX - sprite.currentX;
      const dy = sprite.targetY - sprite.currentY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0.5) {
        const moveAmount = Math.min(interpolationSpeed * dt, distance);
        sprite.currentX += (dx / distance) * moveAmount;
        sprite.currentY += (dy / distance) * moveAmount;
      } else {
        sprite.currentX = sprite.targetX;
        sprite.currentY = sprite.targetY;
      }

      sprite.sprite.setPosition(sprite.currentX, sprite.currentY);
    }
  }

  /**
   * Atualiza posições de todos os sprites de jogadores (interpolação suave).
   */
  updatePlayerSprites(dt: number, playerX: number, playerY: number): void {
    const lerpFactor = Math.min(1, dt * 18);
    const maxSpeed = 600;

    for (const [playerId, sprite] of this.playerSprites) {
      if (sprite.skipFirstInterpolation) {
        sprite.currentX = sprite.targetX;
        sprite.currentY = sprite.targetY;
        sprite.skipFirstInterpolation = false;
        this.updatePlayerSpritePosition(sprite);
        continue;
      }

      // Culling: não renderiza jogadores muito distantes
      const distToPlayer = Math.hypot(
        sprite.targetX - playerX,
        sprite.targetY - playerY
      );
      const shouldRender = distToPlayer <= this.remotePlayerRenderDistance;
      sprite.isVisible = shouldRender;

      if (!shouldRender) {
        sprite.sprite.setVisible(false);
        sprite.nameText.setVisible(false);
        sprite.hpBar.setVisible(false);
        sprite.hpBarBg.setVisible(false);
        sprite.hpBarText.setVisible(false);
        continue;
      }

      // Interpolação
      const dx = sprite.targetX - sprite.currentX;
      const dy = sprite.targetY - sprite.currentY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0.5) {
        let newX = sprite.currentX + dx * lerpFactor;
        let newY = sprite.currentY + dy * lerpFactor;

        const movedX = newX - sprite.currentX;
        const movedY = newY - sprite.currentY;
        const movedDist = Math.sqrt(movedX * movedX + movedY * movedY);

        const maxMove = maxSpeed * dt;
        if (movedDist > maxMove && distance > maxMove) {
          const scale = maxMove / movedDist;
          newX = sprite.currentX + movedX * scale;
          newY = sprite.currentY + movedY * scale;
        }

        sprite.currentX = newX;
        sprite.currentY = newY;
      } else {
        sprite.currentX = sprite.targetX;
        sprite.currentY = sprite.targetY;
      }

      this.updatePlayerSpritePosition(sprite);
    }
  }

  // ============================================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // ============================================================================

  private updateCreatureSpritePosition(sprite: RemoteCreatureSprite): void {
    sprite.sprite.setPosition(sprite.currentX, sprite.currentY);

    // ✅ BUG FIX: Barras de HP de inimigos são gerenciadas pelo HPBarManager
    // Não precisamos atualizar posição das barras aqui (elas estão invisíveis)
    // O HPBarManager atualiza as barras reais via updateEnemyBars()

    // Atualiza posição do texto de nome e nível
    sprite.nameText.setPosition(sprite.currentX, sprite.currentY - 35);

    sprite.aggroIndicator?.setPosition(sprite.currentX, sprite.currentY);
    sprite.attackTellIndicator?.setPosition(sprite.currentX, sprite.currentY);
  }

  private updatePlayerSpritePosition(sprite: RemotePlayerSprite): void {
    sprite.sprite.setPosition(sprite.currentX, sprite.currentY);
    sprite.nameText.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 10);
    sprite.hpBar.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 25);
    sprite.hpBarBg.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 25);
    sprite.hpBarText.setPosition(sprite.currentX, sprite.currentY - sprite.radius - 35);
    if (sprite.actionIndicator) {
      sprite.actionIndicator.setPosition(sprite.currentX, sprite.currentY);
    }
  }

  // ============================================================================
  // DESTRUIÇÃO DE SPRITES
  // ============================================================================

  /**
   * Remove sprite de criatura.
   */
  destroyCreatureSprite(creatureId: string): void {
    const sprite = this.creatureSprites.get(creatureId);
    if (!sprite) return;

    sprite.sprite.destroy();
    sprite.hpBar.destroy();
    sprite.hpBarBg.destroy();
    sprite.hpBarText.destroy();
    sprite.nameText.destroy();
    sprite.aggroIndicator?.destroy();
    sprite.attackTellIndicator?.destroy();

    this.creatureSprites.delete(creatureId);
  }

  /**
   * Remove sprite de recurso.
   */
  destroyResourceSprite(resourceId: string): void {
    const sprite = this.resourceSprites.get(resourceId);
    if (!sprite) {
      console.warn(`[SpriteManager] Tentativa de destruir sprite de recurso inexistente: ${resourceId}`);
      return;
    }

    console.log(`[SpriteManager] Destruindo sprite de recurso: ${resourceId}`);
    sprite.sprite.destroy();
    this.resourceSprites.delete(resourceId);
    console.log(`[SpriteManager] Sprite de recurso destruído: ${resourceId}`);
  }

  /**
   * Remove sprite de jogador.
   */
  destroyPlayerSprite(playerId: string): void {
    const sprite = this.playerSprites.get(playerId);
    if (!sprite) return;

    sprite.sprite.destroy();
    sprite.nameText.destroy();
    sprite.hpBar.destroy();
    sprite.hpBarBg.destroy();
    sprite.hpBarText.destroy();
    if (sprite.actionIndicator) {
      sprite.actionIndicator.destroy();
    }
    this.playerSprites.delete(playerId);
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getCreatureSprite(creatureId: string): RemoteCreatureSprite | undefined {
    return this.creatureSprites.get(creatureId);
  }

  getAllCreatures(): RemoteCreatureSprite[] {
    return Array.from(this.creatureSprites.values());
  }

  getResourceSprite(resourceId: string): RemoteResourceSprite | undefined {
    return this.resourceSprites.get(resourceId);
  }

  getAllResources(): RemoteResourceSprite[] {
    return Array.from(this.resourceSprites.values());
  }

  getPlayerSprite(playerId: string): RemotePlayerSprite | undefined {
    return this.playerSprites.get(playerId);
  }

  getAllPlayers(): RemotePlayerSprite[] {
    return Array.from(this.playerSprites.values());
  }

  getAllPlayerIds(): string[] {
    return Array.from(this.playerSprites.keys());
  }

  get playerSpritesSize(): number {
    return this.playerSprites.size;
  }

  /**
   * Retorna o Map completo de creatureSprites (para debug).
   */
  get creatureSpritesMap(): Map<string, RemoteCreatureSprite> {
    return this.creatureSprites;
  }

  clear(): void {
    this.creatureSprites.clear();
    this.resourceSprites.clear();
    this.playerSprites.clear();
  }
}
