import type { Room, ClientId } from "../types/ServerTypes";
import type { AnyIntent } from "../gameLoop";

/**
 * Valida e enfileira intents no game loop da sala.
 */
export class IntentValidator {
  /**
   * Enfileira um intent no game loop da sala.
   */
  static queueIntent(room: Room, playerId: ClientId, intent: AnyIntent): void {
    if (room.gameLoop && room.matchState === "in_progress") {
      room.gameLoop.queueIntent(intent);
    }
  }

  /**
   * Valida se um intent pode ser processado.
   */
  static validateIntent(room: Room, playerId: ClientId, intent: AnyIntent): boolean {
    // Verificar se jogador existe na sala
    if (!room.players.has(playerId)) {
      return false;
    }

    // Verificar se partida está em progresso
    if (room.matchState !== "in_progress") {
      return false;
    }

    // Verificar se game loop está rodando
    if (!room.gameLoop?.isRunning()) {
      return false;
    }

    return true;
  }
}

// Exportar função para compatibilidade
export function queueIntent(room: Room, playerId: ClientId, intent: AnyIntent): void {
  IntentValidator.queueIntent(room, playerId, intent);
}
