/**
 * Sistema de Type Effectiveness (Vantagens e Desvantagens de Tipos)
 * 
 * Este arquivo é compartilhado entre cliente e servidor.
 * Qualquer alteração aqui deve ser refletida em ambos os lados.
 * 
 * Matriz de multiplicadores de dano:
 * - 2.0 = Super efetivo (dano dobrado)
 * - 1.0 = Neutro (dano normal)
 * - 0.5 = Não muito efetivo (dano reduzido pela metade)
 * - 0 = Imune (sem dano)
 */

import type { ElementType } from "./types";

/**
 * Matriz de vantagens e desvantagens de tipos.
 * 
 * Formato: { TipoAtacante: { TipoDefensor: multiplicador } }
 * 
 * Exemplo: Fogo é super efetivo (2x) contra Planta, mas não muito efetivo (0.5x) contra Água.
 */
export const TYPE_EFFECTIVENESS: Record<ElementType, Partial<Record<ElementType, number>>> = {
  Fogo: { Planta: 2, Água: 0.5, Terrestre: 0.5 },
  Água: { Fogo: 2, Planta: 0.5, Elétrico: 0.5 },
  Planta: { Água: 2, Fogo: 0.5, Voador: 0.5 },
  Elétrico: { Água: 2, Terrestre: 0.5, Planta: 0.5 },
  Psíquico: { Lutador: 2 },
  Terrestre: { Elétrico: 2, Voador: 0 },
  Voador: { Planta: 2, Elétrico: 0.5 },
  Lutador: { Psíquico: 0.5 }
};
