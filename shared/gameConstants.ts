/**
 * Constantes de Configuração do Jogo
 * 
 * Este arquivo é compartilhado entre cliente e servidor.
 * Agrupa valores de balanceamento e configuração usados em diferentes partes do jogo,
 * facilitando ajustes e evitando "números mágicos" espalhados pelo código.
 * 
 * IMPORTANTE: Qualquer mudança aqui deve ser refletida em ambos os lados.
 */

import type { ThreatTier } from "./enums";

// ============================================================================
// CONFIGURAÇÕES DE CRIATURAS SELVAGENS
// ============================================================================

/**
 * Configurações de criaturas selvagens no mapa.
 */
export const WILD_CREATURE_CONFIG = {
  /** Número de criaturas selvagens spawnadas no início da expedição */
  spawnCount: 6,
  /**
   * Distribuição padrão de tiers de ameaça para a "Floresta Celestial".
   * A soma não precisa ser exata (é normalizado em runtime), mas deve
   * refletir a sensação de:
   * - maioria comum
   * - alguns inimigos perigosos
   * - poucos elites raros
   */
  tierWeights: {
    comum: 0.55,
    perigosa: 0.3,
    elite: 0.15
  },
  /** Raio de captura: distância máxima do jogador para tentar capturar */
  captureRadius: 80
} as const;

// ============================================================================
// CONFIGURAÇÕES DE RECURSOS
// ============================================================================

/**
 * Configurações de recursos coletáveis no mapa.
 */
export const RESOURCE_CONFIG = {
  /** Número de recursos spawnados no início da expedição */
  spawnCount: 10,
  /** Tamanho visual do recurso (em pixels) */
  size: 14,
  /** Raio de coleta de recursos (em pixels) */
  collectionRange: 20,
  /** Chance de spawnar um recurso raro (vs comum) */
  rareChance: 0.2
} as const;

// ============================================================================
// CONFIGURAÇÕES DE BIOMAS
// ============================================================================

/**
 * Identificadores de biomas previstos para o jogo.
 * Mesmo que o MVP tenha apenas a Floresta Celestial jogável,
 * já modelamos outros biomas para o futuro.
 */
export type BiomeId =
  | "floresta-celestial"
  | "cavernas-cristalinas"
  | "ruinas-antigas"
  | "pantano-sombrio";

/**
 * Mapeamento de recursos por bioma.
 * - common: recursos que aparecem com frequência naquele bioma.
 * - rare: recursos raros específicos daquele bioma.
 */
export const BIOME_RESOURCES: Record<
  BiomeId,
  { common: string[]; rare: string[] }
> = {
  "floresta-celestial": {
    common: ["resource-ferro-cristalino"],
    rare: ["resource-seiva-eterna"]
  },
  "cavernas-cristalinas": {
    common: ["resource-ferro-cristalino"],
    rare: ["resource-cristal-caverna", "resource-energia-pura"]
  },
  "ruinas-antigas": {
    common: ["resource-ferro-cristalino", "resource-mola-precisao"],
    rare: ["resource-energia-pura"]
  },
  "pantano-sombrio": {
    common: ["resource-ferro-cristalino"],
    rare: ["resource-essencia-sombria"]
  }
} as const;

// ============================================================================
// CONFIGURAÇÕES DE COMBATE
// ============================================================================

/**
 * Configurações de combate e projéteis.
 */
export const COMBAT_CONFIG = {
  /** Velocidade de projétil de ataque básico (pixels por segundo) */
  projectileSpeed: 420,
  /** Dano base causado por projétil em criaturas selvagens */
  projectileDamage: 20,
  /** Tempo de vida do projétil antes de desaparecer (segundos) */
  projectileLifetime: 1.2,
  /**
   * Quando o jogador está em contato com uma criatura, aplicamos dano
   * de contato em ticks rápidos de 0.25s. O valor final é calculado
   * a partir do tier da criatura + este multiplicador global.
   */
  contactDamageTickSeconds: 0.25,
  /** Raio de colisão do jogador (em pixels) */
  playerCollisionRadius: 18,
  /** Raio de colisão de criatura (em pixels) */
  creatureCollisionRadius: 11
} as const;

// ============================================================================
// CONFIGURAÇÕES DE CAPTURA
// ============================================================================

/**
 * Configurações de captura de criaturas.
 */
export const CAPTURE_CONFIG = {
  /** Chance base de captura (0.0 a 1.0) */
  baseChance: 0.35,
  /** Multiplicador máximo de bônus baseado em HP baixo (quanto menor o HP, maior o bônus) */
  hpBonusMultiplier: 0.5,
  /** Chance máxima de captura (cap) */
  maxChance: 0.95,
  /** Distância máxima entre jogador e criatura para permitir captura (em pixels) */
  maxCaptureDistance: 999999999999999
} as const;

/**
 * Modificadores de captura por tipo de pokébola.
 * 
 * Cada pokébola tem um multiplicador e um bônus fixo aplicados à chance de captura.
 * - multiplier: multiplica a chance base + bônus de HP
 * - flatBonus: adiciona um valor fixo após o multiplicador
 */
export interface CaptureBallModifier {
  multiplier: number;
  flatBonus: number;
}

export const CAPTURE_BALL_MODIFIERS: Record<string, CaptureBallModifier> = {
  "poke-ball-basic": { multiplier: 1, flatBonus: 0 },
  "poke-ball-precisa": { multiplier: 1.2, flatBonus: 0.05 },
  "poke-ball-ultra": { multiplier: 1.6, flatBonus: 0.1 }
} as const;

/**
 * Penalidades de captura por tier de criatura.
 * Criaturas de tier maior são mais difíceis de capturar.
 */
export const CAPTURE_TIER_PENALTIES: Record<ThreatTier, number> = {
  comum: 0,
  perigosa: 0.05,
  elite: 0.15
} as const;

// ============================================================================
// CONFIGURAÇÕES DE EVENTOS DE EXPEDIÇÃO
// ============================================================================

/**
 * Identificadores de eventos dinâmicos de expedição.
 *
 * Eventos são pequenos modificadores temporários que aumentam a
 * tensão e o potencial de recompensa conforme o tempo passa.
 */
export type ExpeditionEventId =
  | "DANGER_SWARM"
  | "RARE_RICHES"
  | "ZONE_COLLAPSE";

export interface ExpeditionEventConfig {
  /** Momento em que o evento deve disparar (fração de 0 a 1 da duração total da expedição). */
  triggerTimeRatio: number;
  /** Duração do evento em segundos. */
  durationSeconds: number;
}

/**
 * Configuração padrão dos eventos dinâmicos de expedição.
 *
 * IMPORTANTE: estes valores são intencionalmente simples para manter o sistema leve
 * e fácil de balancear. Ajuste os tempos/durações aqui sem precisar tocar na cena.
 */
export const EXPEDITION_EVENT_CONFIG: Record<ExpeditionEventId, ExpeditionEventConfig> = {
  /**
   * AUMENTO DE PERIGO:
   * Por um curto período, mais criaturas perigosas aparecem perto do jogador,
   * aumentando risco e oportunidade de capturas/recursos de combate.
   */
  DANGER_SWARM: {
    triggerTimeRatio: 0.33,
    durationSeconds: 18
  },

  /**
   * RIQUEZAS RARAS:
   * Janela curta com mais recursos aparecendo no mapa, incentivando o jogador
   * a se arriscar em busca de loot extra antes de correr para a extração.
   */
  RARE_RICHES: {
    triggerTimeRatio: 0.6,
    durationSeconds: 14
  },

  /**
   * COLAPSO DA REGIÃO:
   * Próximo ao final da partida, o mapa começa a "colapsar", pressionando
   * o jogador a correr para a zona de extração. Visualmente forte, mas leve
   * em termos de lógica (sem simulação extra pesada).
   */
  ZONE_COLLAPSE: {
    triggerTimeRatio: 0.82,
    durationSeconds: 999 // até o fim da expedição
  }
} as const;

// ============================================================================
// MECÂNICAS AVANÇADAS DE GAMEPLAY
// ============================================================================

/**
 * Configuração da mecânica "Carga Valiosa" (Greed Risk).
 *
 * Quanto mais recursos o jogador carrega durante a expedição,
 * maior o risco (atrai inimigos) mas também ganha pequenos bônus.
 * Reforça a tensão de "quanto mais loot, mais perigoso ficar".
 */
export const GREED_RISK_CONFIG = {
  /** Quantidade de recursos para ativar o primeiro tier de carga */
  tier1Threshold: 4,
  /** Quantidade de recursos para ativar o segundo tier de carga (máximo) */
  tier2Threshold: 8,
  /** Bônus de velocidade de movimento no tier 1 (multiplicador) */
  tier1SpeedBonus: 1.05,
  /** Bônus de velocidade de movimento no tier 2 (multiplicador) */
  tier2SpeedBonus: 1.1,
  /** Raio de detecção aumentado para inimigos no tier 1 (multiplicador) */
  tier1DetectionMultiplier: 1.2,
  /** Raio de detecção aumentado para inimigos no tier 2 (multiplicador) */
  tier2DetectionMultiplier: 1.5,
  /** Cor do brilho visual no tier 1 */
  tier1GlowColor: 0xfcd34d,
  /** Cor do brilho visual no tier 2 (mais intenso) */
  tier2GlowColor: 0xf59e0b,
  /** Alpha do efeito de brilho */
  glowAlpha: 0.35
} as const;

/**
 * Tipo de sinergia elemental entre criatura e recurso.
 */
export type ElementalSynergyType = "damage" | "heal" | "defense" | "speed";

/**
 * Configuração de uma sinergia elemental.
 */
export interface ElementalSynergyConfig {
  /** Tipo de bônus concedido */
  type: ElementalSynergyType;
  /** Valor do bônus (porcentagem ou valor absoluto dependendo do tipo) */
  value: number;
  /** Duração do buff em segundos */
  durationSeconds: number;
  /** Cor do feedback visual */
  feedbackColor: number;
  /** Mensagem exibida ao jogador */
  feedbackMessage: string;
}

/**
 * Mapeamento de sinergias elementais.
 *
 * Cada tipo de criatura pode ter sinergia com certos recursos,
 * ganhando buffs temporários ao coletá-los. Isso incentiva o jogador
 * a escolher a criatura certa para o bioma e planejar sua rota de coleta.
 */
export const ELEMENTAL_SYNERGIES: Record<string, Record<string, ElementalSynergyConfig>> = {
  // Criaturas de Fogo ganham dano extra com Energia Pura
  Fogo: {
    "resource-energia-pura": {
      type: "damage",
      value: 0.2, // +20% dano
      durationSeconds: 30,
      feedbackColor: 0xf97316,
      feedbackMessage: "Chamas Intensificadas! +20% Dano"
    }
  },
  // Criaturas de Água ganham regeneração com Seiva Eterna
  Água: {
    "resource-seiva-eterna": {
      type: "heal",
      value: 2, // 2 HP por segundo
      durationSeconds: 20,
      feedbackColor: 0x38bdf8,
      feedbackMessage: "Maré Restauradora! Regenerando HP"
    }
  },
  // Criaturas de Planta ganham defesa com recursos comuns
  Planta: {
    "resource-ferro-cristalino": {
      type: "defense",
      value: 0.15, // -15% dano recebido
      durationSeconds: 25,
      feedbackColor: 0x22c55e,
      feedbackMessage: "Carapaça Natural! +15% Defesa"
    }
  },
  // Criaturas Elétricas ganham velocidade com recursos raros
  Elétrico: {
    "resource-cristal-caverna": {
      type: "speed",
      value: 0.1, // +10% velocidade
      durationSeconds: 20,
      feedbackColor: 0xfacc15,
      feedbackMessage: "Sobrecarga! +10% Velocidade"
    },
    "resource-essencia-sombria": {
      type: "speed",
      value: 0.15, // +15% velocidade
      durationSeconds: 25,
      feedbackColor: 0xfacc15,
      feedbackMessage: "Descarga Sombria! +15% Velocidade"
    }
  }
} as const;

// ============================================================================
// CONFIGURAÇÕES VISUAIS DE INIMIGOS
// ============================================================================

/**
 * Configurações visuais e de feedback para IA de inimigos.
 */
export const ENEMY_VISUAL_CONFIG = {
  /** Raio do indicador de aggro ao redor do inimigo */
  aggroIndicatorRadius: 18,
  /** Alpha do indicador de aggro */
  aggroIndicatorAlpha: 0.25,
  /** Cor do "tell" de ataque (flash antes do golpe) */
  attackTellColor: 0xffffff,
  /** Alpha do tell de ataque */
  attackTellAlpha: 0.6,
  /** Tamanho do projétil inimigo */
  enemyProjectileRadius: 5,
  /** Cor do projétil inimigo */
  enemyProjectileColor: 0xef4444,
  /** Tempo de vida do projétil inimigo (segundos) */
  enemyProjectileLifetime: 2.0,
  /** Cor do indicador de estado agressivo */
  aggroIndicatorColor: 0xff0000,
  /** Duração do tell de ataque (segundos) */
  attackTellDuration: 0.5,
  /** Velocidade do projétil inimigo (pixels por segundo) */
  enemyProjectileSpeed: 200
} as const;
