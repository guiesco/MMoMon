/**
 * Definições de Ataques e Habilidades Especiais
 * 
 * Este arquivo é compartilhado entre cliente e servidor.
 * Define todos os ataques básicos e habilidades especiais disponíveis no jogo.
 * 
 * IMPORTANTE: Qualquer mudança aqui deve ser refletida em ambos os lados.
 */

// ============================================================================
// TIPOS
// ============================================================================

/**
 * Ataque básico de uma criatura.
 * Inclui todos os atributos relacionados ao ataque, incluindo valores de IA.
 */
export interface BasicAttack {
  name: string;
  description: string;
  range: number; // Alcance base do ataque (escala com nível e rank)
  damage: number;
  cooldown: number; // Cooldown base do ataque (escala com nível e rank)
  isProjectile: boolean;
  // Valores de IA relacionados ao ataque (escalam com nível e rank)
  attackWindup: number; // Tempo de preparação antes do ataque (escala com nível e rank)
  stunDuration: number; // Duração do stun causado (escala com nível e rank)
  projectileSpeed: number; // Velocidade do projétil (escala com nível e rank)
  // Progressões individuais por nível (valores percentuais)
  /** % de alcance de ataque adicional por nível */
  attackRangePerLevel: number;
  /** % de redução de cooldown de ataque por nível (valores negativos = cooldown reduz) */
  attackCooldownPerLevel: number;
  /** % de redução de windup de ataque por nível (valores negativos = windup reduz) */
  attackWindupPerLevel: number;
  /** % de aumento de duração de stun por nível */
  stunDurationPerLevel: number;
  /** % de aumento de velocidade de projétil por nível */
  projectileSpeedPerLevel: number;
}

/**
 * Habilidade especial de uma criatura.
 * Similar a BasicAttack, mas com atributos adicionais para habilidades especiais.
 */
export interface SpecialSkill {
  name: string;
  description: string;
  // Atributos de ataque básicos (escalam com nível e rank)
  range: number; // Alcance base da habilidade (escala com nível e rank)
  damage: number; // Dano base (escala com nível e rank)
  cooldown: number; // Cooldown base da habilidade (escala com nível e rank)
  // Valores de IA relacionados à habilidade
  attackWindup: number; // Tempo de preparação antes da habilidade (escala com nível e rank)
  stunDuration: number; // Duração do stun causado (escala com nível e rank)
  // Atributos específicos de habilidades especiais
  /** Raio da zona de efeito (em pixels) - pode escalar com nível */
  radius: number;
  /** Dano por tick (pode escalar com nível) */
  damagePerTick: number;
  /** Intervalo entre ticks de dano (em segundos) */
  tickInterval: number;
  /** Tempo de vida total da zona (em segundos) - pode escalar com nível */
  lifetime: number;
  /** Modificador de velocidade (opcional, 0.0 a 1.0) */
  slowModifier?: number;
  /** Duração do slow aplicado (em segundos, opcional) */
  slowDuration?: number;
  /** Duração do freeze aplicado (em segundos, opcional) */
  freezeDuration?: number;
  /** Distância de knockback aplicado (em pixels, opcional) */
  knockbackDistance?: number;
  /** Se a habilidade é um projétil ou área no chão */
  isProjectile: boolean;
  /** Velocidade do projétil (se isProjectile = true) */
  projectileSpeed: number;
  // Progressões individuais por nível (valores percentuais)
  /** % de alcance adicional por nível */
  attackRangePerLevel: number;
  /** % de redução de cooldown por nível (valores negativos = cooldown reduz) */
  attackCooldownPerLevel: number;
  /** % de redução de windup por nível (valores negativos = windup reduz) */
  attackWindupPerLevel: number;
  /** % de aumento de duração de stun por nível */
  stunDurationPerLevel: number;
  /** % de aumento de raio por nível */
  radiusPerLevel: number;
  /** % de aumento de dano por tick por nível */
  damagePerTickPerLevel: number;
  /** % de aumento de tempo de vida por nível */
  lifetimePerLevel: number;
  /** % de aumento de dano base por nível */
  damagePerLevel: number;
}

// ============================================================================
// DEFINIÇÕES DE ATAQUES
// ============================================================================

/**
 * Chama Rápida - Ataque básico do Pyrognat
 */
export const ATTACK_CHAMA_RAPIDA: BasicAttack = {
  name: "Chama Rápida",
  description: "Projétil de fogo de curto alcance.",
  range: 220,
  damage: 20,
  cooldown: 2.5,
  isProjectile: true,
  attackWindup: 0.5,
  stunDuration: 0.2,
  projectileSpeed: 200,
  attackRangePerLevel: 0.002, // +0.2% por nível
  attackCooldownPerLevel: -0.01, // -1% por nível (cooldown reduz)
  attackWindupPerLevel: -0.005, // -0.5% por nível (windup reduz)
  stunDurationPerLevel: 0.01, // +1% por nível (stun mais longo)
  projectileSpeedPerLevel: 0.003 // +0.3% por nível
};

/**
 * Jato d'Água - Ataque básico do Aquaryl
 */
export const ATTACK_JATO_AGUA: BasicAttack = {
  name: "Jato d'Água",
  description: "Projétil de água de médio alcance.",
  range: 260,
  damage: 18,
  cooldown: 2.5,
  isProjectile: true,
  attackWindup: 0.5,
  stunDuration: 0.2,
  projectileSpeed: 220,
  attackRangePerLevel: 0.002, // +0.2% por nível
  attackCooldownPerLevel: -0.01, // -1% por nível (cooldown reduz)
  attackWindupPerLevel: -0.005, // -0.5% por nível (windup reduz)
  stunDurationPerLevel: 0.01, // +1% por nível (stun mais longo)
  projectileSpeedPerLevel: 0.003 // +0.3% por nível
};

/**
 * Chicote de Vinha - Ataque básico do Verdant
 */
export const ATTACK_CHICOTE_VINHA: BasicAttack = {
  name: "Chicote de Vinha",
  description: "Ataque melee curto, rápido.",
  range: 80,
  damage: 16,
  cooldown: 2.0,
  isProjectile: false,
  attackWindup: 0.4,
  stunDuration: 0.15,
  projectileSpeed: 0,
  attackRangePerLevel: 0.002, // +0.2% por nível
  attackCooldownPerLevel: -0.01, // -1% por nível (cooldown reduz)
  attackWindupPerLevel: -0.005, // -0.5% por nível (windup reduz)
  stunDurationPerLevel: 0.01, // +1% por nível (stun mais longo)
  projectileSpeedPerLevel: 0.003 // +0.3% por nível
};

/**
 * Raio Cortante - Ataque básico do Voltiger
 */
export const ATTACK_RAIO_CORTANTE: BasicAttack = {
  name: "Raio Cortante",
  description: "Dispara um raio elétrico de alto dano em linha reta.",
  range: 280,
  damage: 24,
  cooldown: 2.0,
  isProjectile: true,
  attackWindup: 0.45,
  stunDuration: 0.15,
  projectileSpeed: 300,
  attackRangePerLevel: 0.002, // +0.2% por nível
  attackCooldownPerLevel: -0.01, // -1% por nível (cooldown reduz)
  attackWindupPerLevel: -0.005, // -0.5% por nível (windup reduz)
  stunDurationPerLevel: 0.01, // +1% por nível (stun mais longo)
  projectileSpeedPerLevel: 0.003 // +0.3% por nível
};

// ============================================================================
// DEFINIÇÕES DE HABILIDADES ESPECIAIS
// ============================================================================

/**
 * Nevoeiro Incendiário - Habilidade especial do Pyrognat
 */
export const SKILL_NEVOEIRO_INCENDIARIO: SpecialSkill = {
  name: "Nevoeiro Incendiário",
  description: "Área no chão que causa dano por segundo e reduz velocidade de inimigos.",
  range: 300, // Alcance para lançar a habilidade
  damage: 0, // Dano não aplicado diretamente, mas por tick
  cooldown: 12,
  attackWindup: 0.6,
  stunDuration: 0,
  radius: 70,
  damagePerTick: 8,
  tickInterval: 0.5,
  lifetime: 4,
  slowModifier: 0.7, // 30% mais lento
  slowDuration: 0.8, // Duração do slow em segundos
  isProjectile: false,
  projectileSpeed: 0,
  attackRangePerLevel: 0.002, // +0.2% por nível
  attackCooldownPerLevel: -0.01, // -1% por nível (cooldown reduz)
  attackWindupPerLevel: -0.005, // -0.5% por nível (windup reduz)
  stunDurationPerLevel: 0,
  radiusPerLevel: 0.003, // +0.3% por nível
  damagePerTickPerLevel: 0.015, // +1.5% por nível
  lifetimePerLevel: 0.01, // +1% por nível
  damagePerLevel: 0.015 // +1.5% por nível
};

/**
 * Maré Curativa - Habilidade especial do Aquaryl
 */
export const SKILL_MARE_CURATIVA: SpecialSkill = {
  name: "Maré Curativa",
  description: "Área que regenera um pouco de HP do usuário.",
  range: 250,
  damage: 0, // Habilidade de cura, não causa dano
  cooldown: 14,
  attackWindup: 0.5,
  stunDuration: 0,
  radius: 80,
  damagePerTick: -12, // Negativo = cura
  tickInterval: 0.3,
  lifetime: 2,
  isProjectile: false,
  projectileSpeed: 0,
  attackRangePerLevel: 0.002,
  attackCooldownPerLevel: -0.01,
  attackWindupPerLevel: -0.005,
  stunDurationPerLevel: 0,
  radiusPerLevel: 0.003,
  damagePerTickPerLevel: -0.02, // Cura mais por nível (valores negativos)
  lifetimePerLevel: 0.01,
  damagePerLevel: 0 // Cura não tem dano base para escalar
};

/**
 * Raízes Prendentes - Habilidade especial do Verdant
 */
export const SKILL_RAIZES_PRENDENTES: SpecialSkill = {
  name: "Raízes Prendentes",
  description: "Enraíza inimigos em pequena área por pouco tempo.",
  range: 280,
  damage: 0,
  cooldown: 13,
  attackWindup: 0.55,
  stunDuration: 0,
  radius: 60,
  damagePerTick: 5,
  tickInterval: 0.5,
  lifetime: 5,
  slowModifier: 0.3, // 70% mais lento (quase imobilizado)
  freezeDuration: 1.0, // Duração do freeze em segundos
  isProjectile: false,
  projectileSpeed: 0,
  attackRangePerLevel: 0.002,
  attackCooldownPerLevel: -0.01,
  attackWindupPerLevel: -0.005,
  stunDurationPerLevel: 0,
  radiusPerLevel: 0.003,
  damagePerTickPerLevel: 0.015,
  lifetimePerLevel: 0.01,
  damagePerLevel: 0.015
};

/**
 * Surto Elétrico - Habilidade especial do Voltiger
 */
export const SKILL_SURTO_ELETRICO: SpecialSkill = {
  name: "Surto Elétrico",
  description: "Explosão curta ao redor do usuário que empurra inimigos próximos.",
  range: 90, // Alcance curto (ao redor do usuário)
  damage: 15,
  cooldown: 11,
  attackWindup: 0.4,
  stunDuration: 0.2,
  radius: 90,
  damagePerTick: 15,
  tickInterval: 0.4,
  lifetime: 3,
  knockbackDistance: 30, // Distância de knockback em pixels
  isProjectile: false,
  projectileSpeed: 0,
  attackRangePerLevel: 0.002,
  attackCooldownPerLevel: -0.01,
  attackWindupPerLevel: -0.005,
  stunDurationPerLevel: 0.01,
  radiusPerLevel: 0.003,
  damagePerTickPerLevel: 0.015,
  lifetimePerLevel: 0.01,
  damagePerLevel: 0.015
};

// ============================================================================
// MAPA DE ATAQUES POR ID DE CRIATURA
// ============================================================================

/**
 * Mapa que associa IDs de criaturas aos seus ataques básicos.
 */
export const CREATURE_ATTACKS: Record<string, BasicAttack> = {
  pyrognat: ATTACK_CHAMA_RAPIDA,
  aquaryl: ATTACK_JATO_AGUA,
  verdant: ATTACK_CHICOTE_VINHA,
  voltiger: ATTACK_RAIO_CORTANTE
};

/**
 * Mapa que associa IDs de criaturas às suas habilidades especiais.
 */
export const CREATURE_SPECIAL_SKILLS: Record<string, SpecialSkill> = {
  pyrognat: SKILL_NEVOEIRO_INCENDIARIO,
  aquaryl: SKILL_MARE_CURATIVA,
  verdant: SKILL_RAIZES_PRENDENTES,
  voltiger: SKILL_SURTO_ELETRICO
};

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Obtém o ataque básico de uma criatura por ID.
 */
export function getAttackByCreatureId(creatureId: string): BasicAttack | undefined {
  return CREATURE_ATTACKS[creatureId];
}

/**
 * Obtém a habilidade especial de uma criatura por ID.
 */
export function getSpecialSkillByCreatureId(creatureId: string): SpecialSkill | undefined {
  return CREATURE_SPECIAL_SKILLS[creatureId];
}

/**
 * Mapa que associa tipos de skill (skillType) às suas definições.
 * Útil para obter configurações de efeitos programaticamente.
 */
export const SKILL_TYPE_TO_DEFINITION: Record<string, SpecialSkill> = {
  fire_fog: SKILL_NEVOEIRO_INCENDIARIO,
  root_trap: SKILL_RAIZES_PRENDENTES,
  electric_surge: SKILL_SURTO_ELETRICO,
  heal_wave: SKILL_MARE_CURATIVA
};

/**
 * Obtém a definição de uma skill especial por tipo (skillType).
 */
export function getSpecialSkillByType(skillType: string): SpecialSkill | undefined {
  return SKILL_TYPE_TO_DEFINITION[skillType];
}
