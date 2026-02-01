import { WebSocket } from "ws";
import type { Room, JoinMessage, PlayerPresence } from "../types/ServerTypes";
import { createExpeditionInventory, initializePlayerExtractionData } from "../systems/extraction";
import { getUser } from "../firestoreOperations";
import { isFirebaseAvailable } from "../firebase";
import { StateBroadcaster } from "../broadcast/StateBroadcaster";

/**
 * Handler para mensagem de join (entrar em uma sala).
 */
export class JoinHandler {
  /**
   * Processa mensagem de join.
   */
  static async handle(
    ws: WebSocket,
    clientId: string,
    msg: JoinMessage,
    room: Room,
    onGameLoopStart: (room: Room) => void
  ): Promise<{ success: boolean; error?: string }> {
    // Verificar se sala está cheia
    if (room.clients.size >= 4) { // MAX_PLAYERS_PER_ROOM
      return { success: false, error: "room_full" };
    }

    room.clients.set(clientId, ws);
    
    // Recuperar time do Firebase se userId fornecido
    let activeCreatureId: string | undefined;
    
    if (!msg.userId) {
      console.log(`[Firebase] ⚠️  Jogador ${msg.name} (${clientId}) entrou sem userId`);
      // Permitir conexão sem userId (modo offline/local)
    } else if (!isFirebaseAvailable()) {
      console.log(`[Firebase] ⚠️  Firebase não está disponível`);
      // Permitir conexão mesmo sem Firebase (modo offline)
    } else {
      console.log(`[Firebase] 🔍 Buscando dados do usuário ${msg.userId}...`);
      
      const userData = await getUser(msg.userId);
      
      if (!userData) {
        console.log(`[Firebase] ❌ Usuário ${msg.userId} não encontrado no Firebase - conexão bloqueada`);
        return { 
          success: false, 
          error: "user_not_found" 
        };
      }
      
      // Usuário existe - carregar time ativo
      if (userData.activeTeam?.creatureIds && userData.activeTeam.creatureIds.length > 0) {
        activeCreatureId = userData.activeTeam.creatureIds[0];
        console.log(`[Firebase] ✅ Time recuperado: ${userData.activeTeam.creatureIds.length} criaturas`);
      }
    }
    
    // Criar jogador
    const newPlayer: PlayerPresence = {
      id: clientId,
      name: msg.name,
      userId: msg.userId,
      x: Math.random() * 800 + 80,
      y: Math.random() * 400 + 80,
      activeCreatureId,
      expeditionInventory: createExpeditionInventory(),
      extractionProgress: 0,
      extractedAt: null,
      resourcesCollected: new Map(),
      creaturesCaptured: 0,
      itemsConsumed: new Map()
    };
    
    initializePlayerExtractionData(newPlayer);
    room.players.set(clientId, newPlayer);

    // Iniciar game loop se for o primeiro jogador
    if (room.players.size === 1 || !room.gameLoop?.isRunning()) {
      onGameLoopStart(room);
    }

    // Registrar jogador no game loop
    if (room.gameLoop) {
      room.gameLoop.registerPlayer(
        clientId,
        newPlayer.x,
        newPlayer.y,
        100,
        100
      );
    }

    // Enviar confirmação
    ws.send(JSON.stringify({
      type: "joined",
      clientId,
      roomId: room.id,
      matchState: room.matchState,
      initialPosition: {
        x: newPlayer.x,
        y: newPlayer.y
      }
    }));

    // Broadcast inicial com worldState
    StateBroadcaster.broadcastState(room, true);
    
    console.log(`[Server] Jogador ${msg.name} (${clientId}) entrou na sala ${room.id}`);
    return { success: true };
  }
}
