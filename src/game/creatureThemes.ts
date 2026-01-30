/**
 * Configuração visual e de identidade para cada criatura.
 * Define cores, tamanhos de ataque e efeitos para reforçar a
 * identidade individual de cada criatura no jogo.
 */

export interface CreatureTheme {
  /** Cor principal do sprite/placeholder da criatura */
  primaryColor: number;
  /** Cor da borda/outline do sprite */
  strokeColor: number;
  /** Cor do projétil ou área de ataque */
  attackColor: number;
  /** Cor de partículas/efeitos secundários */
  particleColor: number;
  /** Cor do efeito de hit quando acerta um inimigo */
  hitFlashColor: number;
  /** Raio do projétil (se aplicável) */
  projectileRadius: number;
  /** Largura extra da hitbox melee (se aplicável) */
  meleeArcWidth: number;
  /** Descrição do tipo para exibição */
  typeLabel: string;
}

/**
 * Temas visuais por criatura.
 * Cada criatura tem uma paleta de cores distinta que reforça seu tipo elemental.
 */
export const CREATURE_THEMES: Record<string, CreatureTheme> = {
  // Pyrognat - Fogo/Voador
  // Cores quentes e intensas, laranja e vermelho
  pyrognat: {
    primaryColor: 0xf97316, // Laranja vibrante
    strokeColor: 0xea580c,   // Laranja escuro
    attackColor: 0xff6b35,   // Laranja-fogo para projétil
    particleColor: 0xfbbf24, // Amarelo-chama para partículas
    hitFlashColor: 0xfef3c7, // Flash claro alaranjado
    projectileRadius: 5,
    meleeArcWidth: 0, // Não usa melee
    typeLabel: "Fogo/Voador"
  },

  // Aquaryl - Água
  // Azuis claros e ciano, sensação de água corrente
  aquaryl: {
    primaryColor: 0x38bdf8, // Azul água
    strokeColor: 0x0ea5e9,  // Azul mais escuro
    attackColor: 0x22d3ee,  // Ciano para projétil
    particleColor: 0x67e8f9, // Ciano claro para partículas
    hitFlashColor: 0xe0f2fe, // Flash azul claro
    projectileRadius: 6,
    meleeArcWidth: 0,
    typeLabel: "Água"
  },

  // Verdant - Planta
  // Verdes vivos com toques de marrom terroso
  verdant: {
    primaryColor: 0x22c55e, // Verde vibrante
    strokeColor: 0x16a34a,  // Verde escuro
    attackColor: 0x4ade80,  // Verde claro para área melee
    particleColor: 0x86efac, // Verde folha para partículas
    hitFlashColor: 0xdcfce7, // Flash verde claro
    projectileRadius: 0,
    meleeArcWidth: 45, // Arco de ataque melee em graus
    typeLabel: "Planta"
  },

  // Voltiger - Elétrico/Lutador
  // Amarelos intensos com toques de branco/azulado
  voltiger: {
    primaryColor: 0xfacc15, // Amarelo elétrico
    strokeColor: 0xeab308,  // Amarelo escuro
    attackColor: 0xfef08a,  // Amarelo claro para raio
    particleColor: 0xfef9c3, // Branco-amarelado para faíscas
    hitFlashColor: 0xfefce8, // Flash branco-elétrico
    projectileRadius: 4,
    meleeArcWidth: 0,
    typeLabel: "Elétrico/Lutador"
  }
};

/**
 * Retorna o tema visual de uma criatura pelo ID.
 * Se a criatura não tiver tema definido, retorna um tema neutro padrão.
 */
export function getCreatureTheme(creatureId: string): CreatureTheme {
  return (
    CREATURE_THEMES[creatureId] ?? {
      // Tema neutro/genérico para criaturas sem configuração específica
      primaryColor: 0x94a3b8,
      strokeColor: 0x64748b,
      attackColor: 0xcbd5e1,
      particleColor: 0xe2e8f0,
      hitFlashColor: 0xffffff,
      projectileRadius: 4,
      meleeArcWidth: 0,
      typeLabel: "Normal"
    }
  );
}

/**
 * Gera uma cor interpolada para efeitos de fade/transição.
 * Útil para efeitos de hit que começam intensos e desvanecem.
 */
export function interpolateColor(
  color1: number,
  color2: number,
  factor: number
): number {
  const r1 = (color1 >> 16) & 0xff;
  const g1 = (color1 >> 8) & 0xff;
  const b1 = color1 & 0xff;

  const r2 = (color2 >> 16) & 0xff;
  const g2 = (color2 >> 8) & 0xff;
  const b2 = color2 & 0xff;

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return (r << 16) | (g << 8) | b;
}
