/**
 * Configuração visual e de identidade para cada criatura.
 * Delega ao shared/creatures (CreatureRegistry): tema vem da classe da criatura.
 */

import { getCreatureById } from "../../shared/creatures";
import type { CreatureTheme } from "../../shared/creatures";

export type { CreatureTheme } from "../../shared/creatures";

const DEFAULT_THEME: CreatureTheme = {
  primaryColor: 0x94a3b8,
  strokeColor: 0x64748b,
  attackColor: 0xcbd5e1,
  particleColor: 0xe2e8f0,
  hitFlashColor: 0xffffff,
  projectileRadius: 4,
  meleeArcWidth: 0,
  typeLabel: "Normal"
};

/**
 * Retorna o tema visual de uma criatura pelo ID.
 * Fonte de verdade: CreatureRegistry.get(id).theme. Fallback: tema neutro.
 */
export function getCreatureTheme(creatureId: string): CreatureTheme {
  const creature = getCreatureById(creatureId);
  return creature?.theme ?? DEFAULT_THEME;
}

/**
 * Gera uma cor interpolada para efeitos de fade/transição.
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
