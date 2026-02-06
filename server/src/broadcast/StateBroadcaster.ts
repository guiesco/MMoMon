import { WebSocket } from "ws";
import type { Room } from "../types/ServerTypes";
import { serializeWorldState } from "../types";

/**
 * Gerencia broadcast de estado da sala para todos os clientes.
 */
export class StateBroadcaster {
  /**
   * Broadcast do estado da sala para todos os clientes conectados.
   */
  static broadcastState(room: Room, includeWorld = false): void {
    const matchTime = room.gameLoop?.getMatchTime() ?? {
      elapsedSeconds: Math.floor((Date.now() - room.startedAt) / 1000),
      timeLeft: Math.max(0, room.durationSeconds - Math.floor((Date.now() - room.startedAt) / 1000)),
      durationSeconds: room.durationSeconds
    };

    // Adicionar timestamp a cada jogador para sincronização
    const now = Date.now();
    const combatState = room.gameLoop?.getCombatState();
    const playersWithTimestamp = Array.from(room.players.values()).map(p => {
      // ✅ Sincronizar windup timers do CombatPlayer para PlayerPresence
      const combatPlayer = combatState?.players.get(p.id);
      return {
        ...p,
        lastUpdate: now,
        windupTimer: combatPlayer?.windupTimer,
        skillWindupTimer: combatPlayer?.skillWindupTimer
      };
    });

    const message: Record<string, unknown> = {
      type: "state",
      players: playersWithTimestamp,
      match: {
        elapsedSeconds: matchTime.elapsedSeconds,
        timeLeft: matchTime.timeLeft,
        durationSeconds: matchTime.durationSeconds,
        state: room.matchState
      }
    };

    // Incluir worldState apenas no primeiro broadcast ou quando solicitado
    if (includeWorld) {
      message.world = serializeWorldState(room.worldState);
    }

    const payload = JSON.stringify(message);

    for (const ws of room.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Envia evento de mudança de estado de partida para todos os clientes.
   */
  static broadcastMatchEvent(room: Room, event: string, data?: Record<string, unknown>): void {
    const payload = JSON.stringify({
      type: "match_event",
      event,
      matchState: room.matchState,
      ...data
    });

    for (const ws of room.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Envia mensagem para todos os clientes da sala.
   */
  static broadcastMessage(room: Room, message: object): void {
    const payload = JSON.stringify(message);

    for (const ws of room.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Envia mensagem de extração para o jogador específico.
   * IMPORTANTE: Mensagens de extração são individuais - cada jogador só recebe suas próprias mensagens.
   */
  static broadcastExtractionMessage(
    room: Room,
    message: ReturnType<typeof import("../messages").createExtractionStateMessage>
  ): void {
    const payload = JSON.stringify(message);

    // Enviar apenas para o jogador específico que extraiu
    // Isso evita que outros jogadores processem mensagens de extração que não são deles
    const playerWs = room.clients.get(message.playerId);
    if (playerWs && playerWs.readyState === WebSocket.OPEN) {
      playerWs.send(payload);
      console.log(`[StateBroadcaster] Mensagem de extração enviada para jogador ${message.playerId}`);
    } else {
      console.warn(`[StateBroadcaster] Jogador ${message.playerId} não encontrado ou conexão fechada ao enviar mensagem de extração`);
    }
  }
}
