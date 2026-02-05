/**
 * Mapeamento de criaturas para seus tipos elementais.
 * 
 * Este arquivo é compartilhado entre cliente e servidor.
 * Qualquer alteração aqui deve ser refletida em ambos os lados.
 * 
 * IMPORTANTE: Este mapeamento deve estar sincronizado com as definições
 * de criaturas em src/game/creatures.ts
 */

import type { ElementType } from "./types";
import { TYPE_EFFECTIVENESS } from "./typeEffectiveness";

/**
 * Mapeamento de ID de criatura para seus tipos elementais.
 * 
 * Cada criatura pode ter um tipo primário e opcionalmente um tipo secundário.
 */
export const CREATURE_TYPES: Record<string, { primaryType: ElementType; secondaryType?: ElementType }> = {
  pyrognat: { primaryType: "Fogo", secondaryType: "Voador" },
  aquaryl: { primaryType: "Água" },
  verdant: { primaryType: "Planta" },
  voltiger: { primaryType: "Elétrico", secondaryType: "Lutador" }
};

/**
 * Calcula o multiplicador de dano baseado em vantagens/desvantagens de tipos.
 * 
 * @param attackerType - ID da criatura atacante (ex: "pyrognat")
 * @param defenderType - ID da criatura defensor (ex: "aquaryl")
 * @returns Multiplicador de dano (1.0 = neutro, 2.0 = super efetivo, 0.5 = não muito efetivo, 0 = imune)
 * 
 * @example
 * ```ts
 * const multiplier = calculateTypeEffectiveness("pyrognat", "aquaryl");
 * // Retorna 0.5 (Fogo não é muito efetivo contra Água)
 * ```
 */
export function calculateTypeEffectiveness(attackerType: string, defenderType: string): number {
  const attackerTypes = CREATURE_TYPES[attackerType];
  const defenderTypes = CREATURE_TYPES[defenderType];
  
  if (!attackerTypes || !defenderTypes) {
    // Se não encontrou tipos, retorna neutro (1.0)
    return 1.0;
  }
  
  let multiplier = 1.0;
  
  // Verificar tipo primário do atacante vs tipos do defensor
  const primaryEffectiveness = TYPE_EFFECTIVENESS[attackerTypes.primaryType];
  if (primaryEffectiveness) {
    // Verificar contra tipo primário do defensor
    if (primaryEffectiveness[defenderTypes.primaryType] !== undefined) {
      multiplier *= primaryEffectiveness[defenderTypes.primaryType]!;
    }
    // Verificar contra tipo secundário do defensor (se existir)
    if (defenderTypes.secondaryType && primaryEffectiveness[defenderTypes.secondaryType] !== undefined) {
      multiplier *= primaryEffectiveness[defenderTypes.secondaryType]!;
    }
  }
  
  // Verificar tipo secundário do atacante vs tipos do defensor (se existir)
  if (attackerTypes.secondaryType) {
    const secondaryEffectiveness = TYPE_EFFECTIVENESS[attackerTypes.secondaryType];
    if (secondaryEffectiveness) {
      // Verificar contra tipo primário do defensor
      if (secondaryEffectiveness[defenderTypes.primaryType] !== undefined) {
        multiplier *= secondaryEffectiveness[defenderTypes.primaryType]!;
      }
      // Verificar contra tipo secundário do defensor (se existir)
      if (defenderTypes.secondaryType && secondaryEffectiveness[defenderTypes.secondaryType] !== undefined) {
        multiplier *= secondaryEffectiveness[defenderTypes.secondaryType]!;
      }
    }
  }
  
  return multiplier;
}
