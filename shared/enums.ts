/**
 * Enums e tipos compartilhados entre cliente e servidor.
 * 
 * Este arquivo contém tipos que devem ser idênticos em ambos os lados.
 */

/**
 * Tier de ameaça de uma criatura.
 * Define dificuldade, HP base, e recompensas.
 * 
 * - "comum": Criaturas fáceis, HP baixo, recompensas básicas
 * - "perigosa": Criaturas médias, HP moderado, melhores drops
 * - "elite": Criaturas difíceis, HP alto, recompensas raras
 */
export type ThreatTier = "comum" | "perigosa" | "elite";

/**
 * Tipo de comportamento de IA de uma criatura.
 * 
 * - "melee": Ataca corpo-a-corpo, persegue o jogador
 * - "ranged": Ataca à distância, mantém distância do jogador
 */
export type EnemyBehaviorType = "melee" | "ranged";

/**
 * Estados possíveis da IA de um inimigo.
 * 
 * - "idle": parado ou patrulhando levemente
 * - "chasing": perseguindo o jogador
 * - "attacking": executando ataque (com "tell" visual)
 * - "retreating": recuando do jogador (ranged quando muito perto)
 * - "stunned": atordoado após receber dano
 */
export type EnemyAIState = "idle" | "chasing" | "attacking" | "retreating" | "stunned";
