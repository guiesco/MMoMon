import { WebSocket } from "ws";
import type { Room, JoinMessage, PlayerPresence } from "../types/ServerTypes";
import { createExpeditionInventory } from "../systems/capture";
import { initializePlayerExtractionData } from "../systems/extraction";
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
    let userData: any = null; // Armazena userData para reutilizar
    
    if (!msg.userId) {
      console.log(`[Firebase] ⚠️  Jogador ${msg.name} (${clientId}) entrou sem userId`);
      // Permitir conexão sem userId (modo offline/local)
    } else if (!isFirebaseAvailable()) {
      console.log(`[Firebase] ⚠️  Firebase não está disponível`);
      // Permitir conexão mesmo sem Firebase (modo offline)
    } else {
      console.log(`[Firebase] 🔍 Buscando dados do usuário ${msg.userId}...`);
      
      userData = await getUser(msg.userId);
      
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
    
    // Preparar inventário de expedição com itens selecionados
    let expeditionInventory = createExpeditionInventory();
    
    // Se o jogador enviou itens selecionados, usar eles
    if (msg.selectedItems && Object.keys(msg.selectedItems).length > 0) {
      console.log(`[JoinHandler] Jogador ${msg.name} selecionou ${Object.keys(msg.selectedItems).length} tipos de itens para expedição`);
      
      // Inicializa o inventário de expedição com os itens selecionados
      // Filtra apenas pokébolas (outros itens podem ser adicionados depois)
      const pokeballTypes: Array<"poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra"> = [
        "poke-ball-basic",
        "poke-ball-precisa",
        "poke-ball-ultra"
      ];
      
      const initialPokeballs: Partial<Record<"poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra", number>> = {};
      
      for (const [itemId, quantity] of Object.entries(msg.selectedItems)) {
        if (pokeballTypes.includes(itemId as any) && quantity > 0) {
          initialPokeballs[itemId as "poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra"] = quantity;
          console.log(`[JoinHandler] Adicionando ${quantity}x ${itemId} ao inventário de expedição`);
        }
      }
      
      // Cria inventário com as pokébolas selecionadas
      expeditionInventory = createExpeditionInventory(initialPokeballs);
      
      console.log(`[JoinHandler] Inventário de expedição inicializado com:`);
      expeditionInventory.pokeballs.forEach((qty, ballType) => {
        console.log(`[JoinHandler] - ${ballType}: ${qty}`);
      });
    } else if (userData?.preparedExpeditionInventory && Object.keys(userData.preparedExpeditionInventory).length > 0) {
      // Se não enviou itens selecionados, tentar buscar da mochila salva no Firebase
      console.log(`[JoinHandler] Buscando itens da mochila salva no Firebase...`);
      
      const pokeballTypes: Array<"poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra"> = [
        "poke-ball-basic",
        "poke-ball-precisa",
        "poke-ball-ultra"
      ];
      
      const initialPokeballs: Partial<Record<"poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra", number>> = {};
      
      for (const ballType of pokeballTypes) {
        const quantity = userData.preparedExpeditionInventory[ballType] as number | undefined;
        if (quantity && quantity > 0) {
          initialPokeballs[ballType] = quantity;
          console.log(`[JoinHandler] Usando ${quantity}x ${ballType} da mochila salva`);
        }
      }
      
      if (Object.keys(initialPokeballs).length > 0) {
        expeditionInventory = createExpeditionInventory(initialPokeballs);
        console.log(`[JoinHandler] Inventário de expedição inicializado com itens da mochila`);
      } else {
        console.log(`[JoinHandler] Mochila vazia - jogador entrará sem itens`);
      }
    } else {
      // Mochila vazia ou não existe - jogador entra sem itens
      console.log(`[JoinHandler] Mochila vazia ou não configurada - jogador entrará sem itens`);
    }
    
    // Criar jogador
    const newPlayer: PlayerPresence = {
      id: clientId,
      name: msg.name,
      userId: msg.userId,
      x: Math.random() * 800 + 80,
      y: Math.random() * 400 + 80,
      activeCreatureId,
      expeditionInventory,
      extractionProgress: 0,
      extractedAt: null,
      resourcesCollected: new Map(),
      creaturesCaptured: 0,
      itemsConsumed: new Map(),
      joinedAt: Date.now(),
      roomId: room.id
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
        100,
        newPlayer.joinedAt // ✅ SPRINT 1: Passar timestamp de join para proteção de spawn
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
