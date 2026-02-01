import { WebSocket } from "ws";
import type { Room } from "../types/ServerTypes";
import { createEmptyWorldState } from "../types";
import { initializeWorldSpawns } from "../systems/spawns";
import { MATCH_DURATION_SECONDS, MAX_PLAYERS_PER_ROOM, getMapSpawnConfig, DEBUG_GAME_LOOP } from "../constants";
import { createGameLoop } from "../managers/GameLoopManager";

/**
 * Gerencia criação, busca e limpeza de salas.
 */
export class RoomManager {
  private rooms: Map<string, Room>;

  constructor(rooms: Map<string, Room>) {
    this.rooms = rooms;
  }

  /**
   * Obtém ou cria uma sala.
   */
  getOrCreateRoom(roomId: string): Room {
    let room = this.rooms.get(roomId);

    if (!room) {
      // Criar nova sala
      const mapConfig = getMapSpawnConfig(roomId);
      const worldState = createEmptyWorldState();
      
      // Inicializar spawns do mundo
      initializeWorldSpawns(worldState, mapConfig);

      room = {
        id: roomId,
        clients: new Map(),
        players: new Map(),
        startedAt: Date.now(),
        durationSeconds: MATCH_DURATION_SECONDS,
        gameLoop: null,
        matchState: "waiting",
        worldState,
        activeExtractions: new Map(),
        lastExtractionBroadcast: new Map(),
        emptyRoomTimer: null
      };

      this.rooms.set(roomId, room);
    }

    return room;
  }

  /**
   * Obtém uma sala existente.
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Limpa uma sala completamente.
   */
  cleanupRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Parar game loop se estiver rodando
    if (room.gameLoop?.isRunning()) {
      room.gameLoop.stop();
    }

    // Desconectar todos os clientes
    for (const ws of room.clients.values()) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }

    // Limpar timer de cleanup
    if (room.emptyRoomTimer) {
      clearTimeout(room.emptyRoomTimer);
    }

    // Remover sala
    this.rooms.delete(roomId);
  }

  /**
   * Verifica se uma sala está cheia.
   */
  isRoomFull(room: Room): boolean {
    return room.clients.size >= MAX_PLAYERS_PER_ROOM;
  }

  /**
   * Verifica se uma sala está vazia.
   */
  isRoomEmpty(room: Room): boolean {
    return room.clients.size === 0;
  }

  /**
   * Inicia o game loop de uma sala se ainda não estiver rodando.
   */
  startRoomGameLoop(room: Room): void {
    if (!room.gameLoop) {
      room.gameLoop = createGameLoop(room);
      
      // Adicionar criaturas do worldState ao combatState do game loop
      for (const creature of room.worldState.creatures) {
        room.gameLoop.addCreature(creature);
      }
      
      // Adicionar recursos do worldState ao combatState do game loop
      for (const resource of room.worldState.resources) {
        room.gameLoop.addResource(resource);
      }
      
      if (DEBUG_GAME_LOOP) {
        console.log(
          `[Room:${room.id}] ${room.worldState.creatures.length} criaturas e ` +
          `${room.worldState.resources.length} recursos adicionados ao combatState`
        );
      }
    }

    if (!room.gameLoop.isRunning() && room.matchState !== "finished") {
      room.startedAt = Date.now();
      room.gameLoop.start();

      if (DEBUG_GAME_LOOP) {
        console.log(`[Room:${room.id}] Game loop iniciado`);
      }
    }
  }

  /**
   * Para o game loop de uma sala quando fica vazia.
   */
  stopRoomGameLoop(room: Room): void {
    if (room.gameLoop) {
      room.gameLoop.stop();
      room.gameLoop = null;

      if (DEBUG_GAME_LOOP) {
        console.log(`[Room:${room.id}] Game loop parado (sala vazia)`);
      }
    }
  }
}
