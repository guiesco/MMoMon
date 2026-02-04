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
    
    // Preparar inventário de expedição - SEMPRE usar apenas a mochila (preparedExpeditionInventory)
    // Nunca buscar do armazém (inventory.items), mesmo que a mochila esteja vazia
    // Nunca usar selectedItems da mensagem - sempre usar apenas preparedExpeditionInventory do Firebase
    let expeditionInventory: ReturnType<typeof createExpeditionInventory>;
    
    // Sempre usar a mochila salva no Firebase, mesmo que esteja vazia
    if (userData?.preparedExpeditionInventory !== undefined) {
      console.log(`[JoinHandler] 📦 Recuperando mochila do Firebase para jogador ${msg.name}...`);
      
      const backpack = userData.preparedExpeditionInventory;
      const initialPokeballs: Partial<Record<"poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra", number>> = {};
      
      // Recuperar TODAS as pokébolas da mochila (não apenas tipos específicos)
      // O preparedExpeditionInventory pode conter qualquer item, mas apenas pokébolas são usadas na expedição
      const pokeballTypes: Array<"poke-ball-basic" | "poke-ball-precisa" | "poke-ball-ultra"> = [
        "poke-ball-basic",
        "poke-ball-precisa",
        "poke-ball-ultra"
      ];
      
      for (const ballType of pokeballTypes) {
        const quantity = backpack[ballType] as number | undefined;
        if (quantity !== undefined && quantity > 0) {
          initialPokeballs[ballType] = quantity;
          console.log(`[JoinHandler] ✅ Recuperado ${quantity}x ${ballType} da mochila`);
        }
      }
      
      // Verificar se há outros itens na mochila (para log, mesmo que não sejam usados na expedição)
      const otherItems = Object.keys(backpack).filter(itemId => !pokeballTypes.includes(itemId as any));
      if (otherItems.length > 0) {
        console.log(`[JoinHandler] ℹ️  Mochila contém ${otherItems.length} outros tipos de itens (não usados na expedição): ${otherItems.join(', ')}`);
      }
      
      // IMPORTANTE: Sempre criar inventário com os valores da mochila (mesmo que vazio)
      // Se não houver pokébolas na mochila, criar inventário vazio (não usar valores padrão)
      expeditionInventory = createExpeditionInventory(initialPokeballs);
      
      if (Object.keys(initialPokeballs).length > 0) {
        console.log(`[JoinHandler] ✅ Inventário de expedição inicializado com ${Object.keys(initialPokeballs).length} tipos de pokébolas da mochila`);
        expeditionInventory.pokeballs.forEach((qty, ballType) => {
          if (qty > 0) {
            console.log(`[JoinHandler]   - ${ballType}: ${qty}`);
          }
        });
      } else {
        console.log(`[JoinHandler] ⚠️  Mochila vazia ou sem pokébolas - jogador entrará sem itens na expedição`);
      }
    } else {
      // Mochila não existe no Firebase - jogador entra sem itens (inventário vazio)
      console.log(`[JoinHandler] ⚠️  Mochila não encontrada no Firebase - jogador entrará sem itens`);
      expeditionInventory = createExpeditionInventory({}); // Criar inventário vazio, não usar valores padrão
    }
    
    // IMPORTANTE: Ignorar selectedItems da mensagem - sempre usar apenas preparedExpeditionInventory do Firebase
    if (msg.selectedItems && Object.keys(msg.selectedItems).length > 0) {
      console.log(`[JoinHandler] ⚠️  Mensagem contém selectedItems, mas será ignorado - usando apenas mochila do Firebase`);
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
