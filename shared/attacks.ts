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
  range: 240,
  damage: 22, // alinhado ao attackDamage do Pyrognat (fórmula ATK/(DEF*2)+1 × Poder)
  cooldown: 2.2,
  isProjectile: true,
  attackWindup: 0.5,
  stunDuration: 0.2,
  projectileSpeed: 250, // +50 (DPS Rápido: projétil mais rápido)
  attackRangePerLevel: 0.003, // +0.3% por nível (era 0.2%)
  attackCooldownPerLevel: -0.01, // -1.0% por nível (reduzido para evitar cooldowns muito baixos)
  attackWindupPerLevel: -0.005, // -0.5% por nível (mantém)
  stunDurationPerLevel: 0.01, // +1% por nível (mantém)
  projectileSpeedPerLevel: 0.005 // +0.5% por nível (era 0.3%)
};

/**
 * Jato d'Água - Ataque básico do Aquaryl
 */
export const ATTACK_JATO_AGUA: BasicAttack = {
  name: "Jato d'Água",
  description: "Projétil de água de médio alcance.",
  range: 280,
  damage: 19, // alinhado ao attackDamage do Aquaryl
  cooldown: 2.3,
  isProjectile: true,
  attackWindup: 0.5,
  stunDuration: 0.2,
  projectileSpeed: 240, // +20 (Tank/Support: velocidade média)
  attackRangePerLevel: 0.003, // +0.3% por nível (era 0.2%)
  attackCooldownPerLevel: -0.01, // -1.0% por nível (reduzido para evitar cooldowns muito baixos)
  attackWindupPerLevel: -0.005, // -0.5% por nível (mantém)
  stunDurationPerLevel: 0.01, // +1% por nível (mantém)
  projectileSpeedPerLevel: 0.005 // +0.5% por nível (era 0.3%)
};

/**
 * Chicote de Vinha - Ataque básico do Verdant
 */
export const ATTACK_CHICOTE_VINHA: BasicAttack = {
  name: "Chicote de Vinha",
  description: "Ataque melee curto, rápido.",
  range: 90,
  damage: 14, // alinhado ao attackDamage do Verdant
  cooldown: 1.8,
  isProjectile: false,
  attackWindup: 0.4,
  stunDuration: 0.15,
  projectileSpeed: 0,
  attackRangePerLevel: 0.003, // +0.3% por nível (era 0.2%)
  attackCooldownPerLevel: -0.01, // -1.0% por nível (reduzido para evitar cooldowns muito baixos)
  attackWindupPerLevel: -0.005, // -0.5% por nível (mantém)
  stunDurationPerLevel: 0.01, // +1% por nível (mantém)
  projectileSpeedPerLevel: 0.003 // mantém (não aplicável para melee)
};

/**
 * Raio Cortante - Ataque básico do Voltiger
 */
export const ATTACK_RAIO_CORTANTE: BasicAttack = {
  name: "Raio Cortante",
  description: "Dispara um raio elétrico de alto dano em linha reta.",
  range: 300,
  damage: 19, // rebalanceado para fórmula (ATK/(DEF*2)+1)×Poder — menos burst
  cooldown: 2.25, // cooldown maior para TTK 3–15s
  isProjectile: true,
  attackWindup: 0.45,
  stunDuration: 0.15,
  projectileSpeed: 350, // +50 (Glass Cannon: projétil muito rápido)
  attackRangePerLevel: 0.003, // +0.3% por nível (era 0.2%)
  attackCooldownPerLevel: -0.01, // -1.0% por nível (reduzido para evitar cooldowns muito baixos)
  attackWindupPerLevel: -0.005, // -0.5% por nível (mantém)
  stunDurationPerLevel: 0.01, // +1% por nível (mantém)
  projectileSpeedPerLevel: 0.005 // +0.5% por nível (era 0.3%)
};

// ============================================================================
// DEFINIÇÕES DE HABILIDADES ESPECIAIS
// ============================================================================

/**
 * Dash Explosivo - Habilidade especial do Pyrognat
 * NOTA: Mecânica de dash precisa ser implementada no servidor/cliente
 */
export const SKILL_NEVOEIRO_INCENDIARIO: SpecialSkill = {
  name: "Dash Explosivo",
  description: "Criatura se move rapidamente em direção ao cursor, deixando rastro de fogo que causa dano. Mobilidade + Dano em área.",
  range: 300, // Alcance do dash
  damage: 0, // Dano não aplicado diretamente, mas por tick no rastro
  cooldown: 12,
  attackWindup: 0.5, // -0.1s (dash mais rápido)
  stunDuration: 0,
  radius: 75, // +5 (rastro de 150px de largura = 75px de raio)
  damagePerTick: 10, // +2 (rastro causa mais dano)
  tickInterval: 0.4, // -0.1s (ticks mais frequentes)
  lifetime: 3, // -1s (rastro mais curto mas mais intenso)
  slowModifier: 0.7, // 30% mais lento (mantém)
  slowDuration: 0.8, // Duração do slow em segundos (mantém)
  isProjectile: false,
  projectileSpeed: 0,
  attackRangePerLevel: 0.003, // +0.3% por nível (era 0.2%)
  attackCooldownPerLevel: -0.01, // -1.0% por nível (reduzido para evitar cooldowns muito baixos)
  attackWindupPerLevel: -0.005, // -0.5% por nível (mantém)
  stunDurationPerLevel: 0,
  radiusPerLevel: 0.003, // +0.3% por nível (mantém)
  damagePerTickPerLevel: 0.02, // +2% por nível (era 1.5%)
  lifetimePerLevel: 0.01, // +1% por nível (mantém)
  damagePerLevel: 0.02 // +2% por nível (era 1.5%)
};

/**
 * Maré Curativa (Melhorada) - Habilidade especial do Aquaryl
 * NOTA: Deve ser castada na criatura (não no mouse) - precisa implementação no servidor/cliente
 */
export const SKILL_MARE_CURATIVA: SpecialSkill = {
  name: "Maré Curativa",
  description: "Cria área de cura ao redor da criatura. Cura aliados e a própria criatura, reduz velocidade de inimigos. Tank/Support.",
  range: 0, // Castada na criatura (range 0 = auto-cast)
  damage: 0, // Habilidade de cura, não causa dano
  cooldown: 12, // -2s (cooldown menor)
  attackWindup: 0.4, // -0.1s (cast mais rápido)
  stunDuration: 0,
  radius: 100, // +20 (raio maior)
  damagePerTick: -12, // -3 (cura ajustada para DPS mais balanceado)
  tickInterval: 0.3, // +0.05s (ticks menos frequentes para reduzir DPS)
  lifetime: 3, // +1s (dura mais tempo)
  slowModifier: 0.8, // 20% mais lento em inimigos (novo)
  slowDuration: 1.0, // Duração do slow em segundos (novo)
  isProjectile: false,
  projectileSpeed: 0,
  attackRangePerLevel: 0, // Não aplicável (castada na criatura)
  attackCooldownPerLevel: -0.01, // -1.0% por nível (reduzido para evitar cooldowns muito baixos)
  attackWindupPerLevel: -0.005, // -0.5% por nível (mantém)
  stunDurationPerLevel: 0,
  radiusPerLevel: 0.003, // +0.3% por nível (mantém)
  damagePerTickPerLevel: -0.025, // Cura mais por nível (era -0.02)
  lifetimePerLevel: 0.01, // +1% por nível (mantém)
  damagePerLevel: 0 // Cura não tem dano base para escalar
};

/**
 * Armadura de Raízes - Habilidade especial do Verdant
 * NOTA: Deve ser castada na criatura (não no mouse) - precisa implementação no servidor/cliente
 */
export const SKILL_RAIZES_PRENDENTES: SpecialSkill = {
  name: "Armadura de Raízes",
  description: "Cria raízes ao redor da criatura que prendem inimigos e reduzem dano recebido. Tanking + Controle de área.",
  range: 0, // Castada na criatura (range 0 = auto-cast)
  damage: 0,
  cooldown: 11, // -2s (cooldown menor)
  attackWindup: 0.5, // -0.05s (cast mais rápido)
  stunDuration: 0,
  radius: 80, // +20 (raio maior)
  damagePerTick: 6, // +1 (dano leve)
  tickInterval: 0.4, // -0.1s (ticks mais frequentes)
  lifetime: 4, // -1s (dura menos mas mais intenso)
  slowModifier: 0.2, // 80% mais lento (era 0.3) - quase imobilizado
  freezeDuration: 1.5, // +0.5s (freeze mais longo)
  isProjectile: false,
  projectileSpeed: 0,
  attackRangePerLevel: 0, // Não aplicável (castada na criatura)
  attackCooldownPerLevel: -0.01, // -1.0% por nível (reduzido para evitar cooldowns muito baixos)
  attackWindupPerLevel: -0.005, // -0.5% por nível (mantém)
  stunDurationPerLevel: 0,
  radiusPerLevel: 0.003, // +0.3% por nível (mantém)
  damagePerTickPerLevel: 0.02, // +2% por nível (era 1.5%)
  lifetimePerLevel: 0.01, // +1% por nível (mantém)
  damagePerLevel: 0.02 // +2% por nível (era 1.5%)
};

/**
 * Surto Elétrico (Melhorado) - Habilidade especial do Voltiger
 * NOTA: Deve ser castada na criatura (não no mouse) - precisa implementação no servidor/cliente
 */
export const SKILL_SURTO_ELETRICO: SpecialSkill = {
  name: "Surto Elétrico",
  description: "Explosão elétrica ao redor da criatura com alto dano e stun. Burst damage + Controle. Glass Cannon.",
  range: 0, // Castada na criatura (range 0 = auto-cast)
  damage: 20, // +5 (dano base maior)
  cooldown: 9, // -2s (cooldown menor)
  attackWindup: 0.3, // -0.1s (cast mais rápido)
  stunDuration: 0.4, // +0.2s (stun significativo)
  radius: 100, // +10 (raio maior)
  damagePerTick: 14, // -6 (dano por tick reduzido para balancear DPS)
  tickInterval: 0.4, // +0.1s (ticks menos frequentes para reduzir DPS)
  lifetime: 2, // -1s (explosão mais rápida)
  knockbackDistance: 40, // +10 (knockback maior)
  isProjectile: false,
  projectileSpeed: 0,
  attackRangePerLevel: 0, // Não aplicável (castada na criatura)
  attackCooldownPerLevel: -0.01, // -1.0% por nível (reduzido para evitar cooldowns muito baixos)
  attackWindupPerLevel: -0.005, // -0.5% por nível (mantém)
  stunDurationPerLevel: 0.015, // +1.5% por nível (era 1%)
  radiusPerLevel: 0.003, // +0.3% por nível (mantém)
  damagePerTickPerLevel: 0.02, // +2% por nível (era 1.5%)
  lifetimePerLevel: 0.01, // +1% por nível (mantém)
  damagePerLevel: 0.02 // +2% por nível (era 1.5%)
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
