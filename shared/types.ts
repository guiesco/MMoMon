/**
 * Tipos compartilhados entre cliente e servidor.
 * 
 * Este arquivo contém tipos que devem ser idênticos em ambos os lados.
 * Qualquer alteração aqui deve ser refletida em ambos cliente e servidor.
 */

export type ElementType =
  | "Fogo"
  | "Água"
  | "Planta"
  | "Elétrico"
  | "Psíquico"
  | "Terrestre"
  | "Voador"
  | "Lutador";
