import { WebSocketServer } from "ws";
import { MatchState, AnyIntent } from "./gameLoop";
import {
  MAX_PLAYERS_PER_ROOM,
  DEBUG_GAME_LOOP,
} from "./constants";
import {
  createExtractionStateMessage,
  createPlayerMoveMessage,
  type AttackResultMessage,
  type PlayerDeathMessage,
} from "./messages";
import {
  initializePlayerExtractionData,
  processExtractionIntent,
} from "./systems/extraction";
import { initializeFirebase, isFirebaseAvailable } from "./firebase";
import { getUser } from "./firestoreOperations";

// FASE 4: Imports dos módulos modulares
import { StateBroadcaster } from "./broadcast/StateBroadcaster";
import { RoomManager } from "./room/RoomManager";
import { IntentFactory } from "./intents/IntentFactory";
import { IntentValidator } from "./intents/IntentValidator";
import type {
  ClientId,
  PlayerPresence,
  Room,
  BaseMessage,
  IncomingMessage,
  JoinMessage,
  MoveMessage,
  AttackMessage,
  SkillMessage,
  CaptureMessage,
  ResourceInteractMessage,
  ExtractionMessage
} from "./types/ServerTypes";

// Re-exportar tipos para compatibilidade
export type { ClientId, PlayerPresence, Room, BaseMessage, IncomingMessage, JoinMessage };

// FASE 4: Tipos agora vêm de ServerTypes.ts (importados acima)
// Estados de partida conforme definido no gameLoop.
export { MatchState };

// Porta do servidor WebSocket.
// Pode ser sobrescrita via variável de ambiente PORT.
// Por padrão usamos 3003 para evitar conflito com outros serviços locais.
const PORT = Number(process.env.PORT ?? 3003);

const wss = new WebSocketServer({ port: PORT });
const rooms = new Map<string, Room>();

// Mapa para rastrear qual sala cada cliente está (resolver problema de currentRoom)
const clientToRoom = new Map<string, string>(); // clientId -> roomId

// FASE 4: Inicializar módulos modulares
const roomManager = new RoomManager(rooms);

/**
 * Broadcast do estado da sala para todos os clientes conectados.
 * FASE 4: Delegar para StateBroadcaster
 */
function broadcastState(room: Room, includeWorld = false): void {
  StateBroadcaster.broadcastState(room, includeWorld);
}

/**
 * Envia evento de mudança de estado de partida para todos os clientes.
 * FASE 4: Delegar para StateBroadcaster
 */
function broadcastMatchEvent(room: Room, event: string, data?: Record<string, unknown>): void {
  StateBroadcaster.broadcastMatchEvent(room, event, data);
}

/**
 * Envia mensagem para todos os clientes da sala.
 * FASE 4: Delegar para StateBroadcaster
 */
function broadcastMessage(room: Room, message: AttackResultMessage | PlayerDeathMessage | object): void {
  StateBroadcaster.broadcastMessage(room, message);
}


/**
 * Envia mensagem de extração para todos os clientes da sala.
 * FASE 4: Delegar para StateBroadcaster
 */
function broadcastExtractionMessage(
  room: Room,
  message: ReturnType<typeof createExtractionStateMessage>
): void {
  StateBroadcaster.broadcastExtractionMessage(room, message);
}

/**
 * Obtém ou cria uma sala.
 * FASE 4: Delegar para RoomManager
 */
function getOrCreateRoom(id: string, mapId?: string): Room {
  return roomManager.getOrCreateRoom(id, mapId);
}

/**
 * Inicia o game loop de uma sala se ainda não estiver rodando.
 * FASE 4: Delegar para RoomManager
 */
function startRoomGameLoop(room: Room): void {
  roomManager.startRoomGameLoop(room);
}

/**
 * Para o game loop de uma sala quando fica vazia.
 * FASE 4: Delegar para RoomManager
 */
function stopRoomGameLoop(room: Room): void {
  roomManager.stopRoomGameLoop(room);
}

/**
 * Limpa e remove uma sala do servidor completamente.
 * FASE 4: Delegar para RoomManager
 */
function cleanupRoom(roomId: string): void {
  roomManager.cleanupRoom(roomId);

  if (DEBUG_GAME_LOOP) {
    console.log(`[Server] ✓ Sala removida completamente: ${roomId}`);
  }
}

/**
 * Enfileira um intent no game loop da sala.
 * FASE 4: Delegar para IntentValidator
 */
function queueIntent(room: Room, playerId: string, intent: AnyIntent): void {
  IntentValidator.queueIntent(room, playerId, intent);
}

/**
 * Converte mensagem de movimento em intent.
 * FASE 4: Delegar para IntentFactory
 */
function createMoveIntent(playerId: string, msg: MoveMessage): AnyIntent {
  return IntentFactory.createMoveIntent(playerId, msg);
}

/**
 * Converte mensagem de ataque em intent.
 * FASE 4: Delegar para IntentFactory
 */
function createAttackIntent(playerId: string, msg: AttackMessage): AnyIntent {
  return IntentFactory.createAttackIntent(playerId, msg);
}

/**
 * Converte mensagem de skill em intent.
 * FASE 4: Delegar para IntentFactory
 */
function createSkillIntent(playerId: string, msg: SkillMessage): AnyIntent {
  return IntentFactory.createSkillIntent(playerId, msg);
}

/**
 * Mapeia tipos de pokébola do cliente para o formato do servidor.
 */
function mapBallType(clientBallType: string | undefined): string {
  const mapping: Record<string, string> = {
    "pokeball": "poke-ball-basic",
    "greatball": "poke-ball-precisa",
    "ultraball": "poke-ball-ultra",
    "masterball": "poke-ball-ultra", // masterball não existe no servidor, usa ultra
    "poke-ball-basic": "poke-ball-basic",
    "poke-ball-precisa": "poke-ball-precisa",
    "poke-ball-ultra": "poke-ball-ultra"
  };
  return mapping[clientBallType ?? "pokeball"] ?? "poke-ball-basic";
}

/**
 * Converte mensagem de captura em intent.
 * FASE 4: Delegar para IntentFactory
 */
function createCaptureIntent(playerId: string, msg: CaptureMessage): AnyIntent {
  return IntentFactory.createCaptureIntent(playerId, msg);
}

/**
 * Converte mensagem de recurso em intent.
 * FASE 4: Delegar para IntentFactory
 */
function createResourceIntent(playerId: string, msg: ResourceInteractMessage): AnyIntent {
  return IntentFactory.createResourceIntent(playerId, msg);
}

/**
 * Converte mensagem de extração em intent.
 * FASE 4: Delegar para IntentFactory
 */
function createExtractionIntent(playerId: string, msg: ExtractionMessage): AnyIntent {
  return IntentFactory.createExtractionIntent(playerId, msg);
}

wss.on("connection", (ws) => {
  const clientId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  if (DEBUG_GAME_LOOP) {
    console.log(`[Server] Cliente conectado: ${clientId}`);
  }

  ws.on("message", async (data) => {
    let msg: IncomingMessage;
    try {
      msg = JSON.parse(data.toString()) as IncomingMessage;
    } catch {
      return;
    }

    // Obter sala atual do cliente (se já fez join)
    const roomId = clientToRoom.get(clientId);
    let currentRoom: Room | null = roomId ? rooms.get(roomId) ?? null : null;

    if (msg.type === "join") {
      // Verificar se já existe uma sala com este ID
      let existingRoom = rooms.get(msg.roomId);

      // Se a partida terminou, SEMPRE criar nova sala
      if (existingRoom && existingRoom.matchState === "finished") {
        if (DEBUG_GAME_LOOP) {
          console.log(`[Server] Sala ${msg.roomId} terminou, limpando e criando nova...`);
        }
        // Limpar sala antiga completamente (desconecta clientes, para loop, etc)
        cleanupRoom(msg.roomId);
        existingRoom = undefined;
      }

      // Cancelar timer de cleanup se a sala existir e estiver vazia
      if (existingRoom?.emptyRoomTimer) {
        if (DEBUG_GAME_LOOP) {
          console.log(`[Server] Cancelando timer de cleanup da sala ${msg.roomId}`);
        }
        clearTimeout(existingRoom.emptyRoomTimer);
        existingRoom.emptyRoomTimer = null;
      }

      // Obter ou criar sala
      // Se for uma nova sala, usar selectedMapId do Firebase do primeiro jogador
      let room = existingRoom;
      if (!room) {
        // Buscar selectedMapId do Firebase se userId fornecido
        let mapIdToUse = msg.roomId; // Fallback para roomId
        if (msg.userId && isFirebaseAvailable()) {
          try {
            const userData = await getUser(msg.userId);
            if (userData?.activeTeam?.selectedMapId) {
              mapIdToUse = userData.activeTeam.selectedMapId;
              console.log(`[Server] 🗺️  Usando mapa do Firebase para ${msg.userId}: ${mapIdToUse}`);
            }
          } catch (error) {
            console.error(`[Server] ⚠️  Erro ao buscar selectedMapId do Firebase:`, error);
          }
        }
        room = getOrCreateRoom(msg.roomId, mapIdToUse);
      }

      // Verificar se sala está cheia
      if (room.clients.size >= MAX_PLAYERS_PER_ROOM) {
        ws.send(JSON.stringify({ type: "error", reason: "room_full" }));
        return;
      }

      currentRoom = room;
      room.clients.set(clientId, ws);

      // Registrar cliente na sala
      clientToRoom.set(clientId, room.id);

      // ✅ FASE 3: Recuperar time do Firebase se userId fornecido
      let activeCreatureId: string | undefined;

      // Log de início da busca de dados do Firebase
      if (!msg.userId) {
        console.log(`[Firebase] ⚠️  Jogador ${msg.name} (${clientId}) entrou sem userId - dados do Firebase não serão recuperados`);
      } else if (!isFirebaseAvailable()) {
        console.log(`[Firebase] ⚠️  Jogador ${msg.name} (${clientId}) forneceu userId ${msg.userId}, mas Firebase não está disponível`);
      } else {
        console.log(`[Firebase] 🔍 Buscando dados do usuário ${msg.userId} no Firebase...`);
        try {
          const userData = await getUser(msg.userId);
          if (userData) {
            if (userData.activeTeam?.creatureIds && userData.activeTeam.creatureIds.length > 0) {
              // Usar primeira criatura do time ativo como criatura ativa inicial
              activeCreatureId = userData.activeTeam.creatureIds[0];
              console.log(`[Firebase] ✅ Time recuperado do Firebase para ${msg.userId}: ${userData.activeTeam.creatureIds.length} criaturas (ativa: ${activeCreatureId.slice(0, 8)}...)`);
            } else {
              console.log(`[Firebase] ⚠️  Usuário ${msg.userId} encontrado, mas não possui time ativo configurado`);
            }
          } else {
            console.log(`[Firebase] ⚠️  Usuário ${msg.userId} não encontrado no Firebase`);
          }
        } catch (error) {
          console.error(`[Firebase] ❌ Erro ao recuperar time do Firebase para ${msg.userId}:`, error);
        }
      }

      // Criar jogador com dados inicializados
      const newPlayer: PlayerPresence = {
        id: clientId,
        name: msg.name,
        userId: msg.userId, // ✅ FASE 3: Armazenar userId para salvar recompensas
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

      // Inicializar dados de extração
      initializePlayerExtractionData(newPlayer);

      room.players.set(clientId, newPlayer);

      // Iniciar game loop se for o primeiro jogador (ou retomar se já existe)
      if (room.players.size === 1 || !room.gameLoop?.isRunning()) {
        startRoomGameLoop(room);
      }

      // Registrar jogador no sistema de combate do game loop
      if (room.gameLoop) {
        room.gameLoop.registerPlayer(
          clientId,
          newPlayer.x,
          newPlayer.y,
          100, // HP inicial
          100  // HP máximo
        );
      }

      // Enviar confirmação de join com ID do cliente e posição inicial
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

      // Broadcast inicial inclui worldState para sincronizar spawns
      // E notifica TODOS os jogadores (incluindo existentes) sobre o novo jogador
      broadcastState(room, true);

      console.log(`[Server] Jogador ${msg.name} (${clientId}) entrou na sala ${room.id} | Total: ${room.players.size} jogadores`);
      return;
    }

    // Se não está em uma sala e não é join, ignorar
    if (!currentRoom) {
      if (DEBUG_GAME_LOOP) {
        console.log(`[Server] ⚠️ Cliente ${clientId.slice(0, 8)}... enviou mensagem ${(msg as any).type} sem estar em uma sala`);
      }
      return;
    }

    // Debug: Log de mensagens recebidas (a cada 50 mensagens para não poluir)
    const DEBUG_MESSAGES = true;

    switch (msg.type) {
      case "move": {
        if (!currentRoom) return;
        const player = currentRoom.players.get(clientId);
        if (!player) {
          if (DEBUG_MESSAGES) {
            console.log(`[Server] ⚠️ Movimento de jogador não encontrado: ${clientId.slice(0, 8)}...`);
          }
          return;
        }

        // Log de movimento (a cada 20 movimentos)
        if (DEBUG_MESSAGES && Math.random() < 0.05) {
          console.log(`[Move] ${clientId.slice(0, 8)}... -> (${msg.x.toFixed(0)}, ${msg.y.toFixed(0)})`);
        }

        // Atualizar posição imediatamente (para broadcast)
        player.x = msg.x;
        player.y = msg.y;

        // Atualizar posição no combatState do game loop
        if (currentRoom.gameLoop) {
          currentRoom.gameLoop.updatePlayerPosition(clientId, msg.x, msg.y);
        }

        // Também enfileirar como intent para processamento do game loop
        queueIntent(currentRoom, clientId, createMoveIntent(clientId, msg));

        // Enviar mensagem específica de movimento para todos os clientes
        // Isso é mais eficiente que broadcast completo e mais responsivo
        const moveMsg = createPlayerMoveMessage(clientId, msg.x, msg.y);
        broadcastMessage(currentRoom, moveMsg);
        break;
      }

      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;

      case "team_sync": {
        if (!currentRoom) return;
        const player = currentRoom.players.get(clientId);
        if (!player) return;

        // Armazenar dados do time do jogador
        const creatures = msg.creatures as Array<{
          instanceId: string;
          definitionId: string;
          level: number;
          currentHp: number;
          maxHp: number;
          rank?: number;
        }>;

        const activeCreatureId = msg.activeCreatureInstanceId as string | null;

        // Atualizar criatura ativa do jogador
        if (activeCreatureId) {
          player.activeCreatureId = activeCreatureId;

          // Atualizar HP do jogador no sistema de combate baseado na criatura ativa
          const activeCreature = creatures.find(c => c.instanceId === activeCreatureId);
          if (activeCreature && currentRoom.gameLoop) {
            currentRoom.gameLoop.updatePlayerHp(clientId, activeCreature.currentHp, activeCreature.maxHp);
          }
        }

        console.log(`[Team Sync] Jogador ${clientId.slice(0, 8)}... sincronizou ${creatures.length} criaturas, ativa: ${activeCreatureId?.slice(0, 8) || 'nenhuma'}`);
        break;
      }

      case "active_creature_update": {
        if (!currentRoom) return;
        const player = currentRoom.players.get(clientId);
        if (!player) return;

        const instanceId = msg.instanceId as string;
        const currentHp = msg.currentHp as number;
        const maxHp = msg.maxHp as number;

        // Atualizar criatura ativa do jogador
        player.activeCreatureId = instanceId;

        // Atualizar HP do jogador no sistema de combate
        if (currentRoom.gameLoop) {
          currentRoom.gameLoop.updatePlayerHp(clientId, currentHp, maxHp);
        }

        if (DEBUG_MESSAGES && Math.random() < 0.2) {
          console.log(`[Active Creature] Jogador ${clientId.slice(0, 8)}... trocou para ${instanceId.slice(0, 8)}... (${currentHp}/${maxHp} HP)`);
        }
        break;
      }

      case "attack_basic":
        if (!currentRoom) return;
        queueIntent(currentRoom, clientId, createAttackIntent(clientId, msg));
        break;

      case "use_skill":
        if (!currentRoom) return;
        queueIntent(currentRoom, clientId, createSkillIntent(clientId, msg));
        break;

      case "capture_attempt":
        if (!currentRoom) return;
        queueIntent(currentRoom, clientId, createCaptureIntent(clientId, msg));
        break;

      case "resource_interact":
        if (!currentRoom) {
          console.warn(`[Resource] Tentativa de coleta sem sala ativa. Cliente: ${clientId.slice(0, 8)}...`);
          return;
        }
        console.log(`[Resource] Recebido intent de coleta do jogador ${clientId.slice(0, 8)}... para recurso: ${msg.resourceId}`);
        queueIntent(currentRoom, clientId, createResourceIntent(clientId, msg));
        break;

      case "extraction_request": {
        if (!currentRoom) return;
        console.log(`[Extraction] Recebido pedido de ${msg.action} para ponto ${msg.pointId} do jogador ${clientId.slice(0, 8)}...`);

        // Processar intent de extração imediatamente (não enfileirar)
        const roomForExtraction = {
          id: currentRoom.id,
          players: currentRoom.players,
          extractionPoints: currentRoom.worldState.extractionPoints,
          activeExtractions: currentRoom.activeExtractions
        };

        const success = processExtractionIntent(
          roomForExtraction,
          clientId,
          {
            playerId: clientId,
            pointId: msg.pointId,
            action: msg.action
          }
        );

        console.log(`[Extraction] Pedido processado: ${success ? 'SUCESSO' : 'FALHOU'}`);

        if (success && msg.action === "start") {
          // Enviar confirmação de início de extração
          const message = createExtractionStateMessage(
            msg.pointId,
            clientId,
            "in_progress",
            0
          );
          console.log(`[Extraction] Enviando confirmação ao cliente`);
          ws.send(JSON.stringify(message));
        }
        break;
      }
    }
  });

  ws.on("close", () => {
    if (DEBUG_GAME_LOOP) {
      console.log(`[Server] Cliente desconectado: ${clientId}`);
    }

    // Obter sala do cliente antes de desconectar
    const roomId = clientToRoom.get(clientId);
    const currentRoom = roomId ? rooms.get(roomId) ?? null : null;

    // Remover cliente do mapa
    clientToRoom.delete(clientId);

    if (!currentRoom) return;

    // Desregistrar jogador do sistema de combate
    if (currentRoom.gameLoop) {
      currentRoom.gameLoop.unregisterPlayer(clientId);
    }

    currentRoom.clients.delete(clientId);
    currentRoom.players.delete(clientId);

    console.log(`[Server] Jogador removido: ${clientId}. Jogadores restantes: ${currentRoom.players.size}`);

    // IMPORTANTE: A room só deve ser fechada quando:
    // 1. O timer da partida chegar a 0 (verificado no checkMatchEnd do gameLoop)
    // 2. OU se estiver sem nenhum player por algum tempo (30 segundos)
    // Quando um jogador extrai, apenas ele sai, os outros continuam na partida

    // Se sala ficou vazia, iniciar timer de cleanup
    if (currentRoom.clients.size === 0) {
      stopRoomGameLoop(currentRoom);

      // Remover sala imediatamente se partida já terminou
      if (currentRoom.matchState === "finished") {
        if (DEBUG_GAME_LOOP) {
          console.log(`[Server] Sala ${currentRoom.id} vazia e partida terminada, removendo imediatamente`);
        }
        cleanupRoom(currentRoom.id);
      } else {
        // Iniciar timer de 30 segundos para remover sala vazia
        // A sala só será fechada se continuar vazia por 30 segundos
        const roomId = currentRoom.id; // Capturar roomId para uso no timeout
        if (DEBUG_GAME_LOOP) {
          console.log(`[Server] Sala ${roomId} vazia, iniciando timer de cleanup (30s). A sala só será fechada se continuar vazia por 30 segundos.`);
        }
        currentRoom.emptyRoomTimer = setTimeout(() => {
          // Verificar se sala ainda existe e está vazia
          const room = rooms.get(roomId);
          if (room && room.clients.size === 0) {
            if (DEBUG_GAME_LOOP) {
              console.log(`[Server] Timer expirado, removendo sala vazia: ${roomId}`);
            }
            cleanupRoom(roomId);
          }
        }, 30000); // 30 segundos
      }
    } else {
      // Ainda há jogadores na sala, continuar normalmente
      // O game loop continua rodando até o timer chegar a 0 ou todos extraírem
      console.log(`[Server] Broadcasting state para ${currentRoom.clients.size} clientes. Jogadores na lista: ${Array.from(currentRoom.players.keys()).map(id => id.slice(0, 8)).join(', ')}`);
      broadcastState(currentRoom);
    }
  });
});

// ============================================================================
// INICIALIZAR FIREBASE
// ============================================================================
console.log('\n=== Inicializando Firebase ===');
initializeFirebase();
if (isFirebaseAvailable()) {
  console.log('✅ Firebase configurado - dados serão persistidos na nuvem');
} else {
  console.log('⚠️  Firebase não disponível - dados não serão persistidos');
  console.log('ℹ️  Para habilitar Firebase, configure firebase-service-account.json');
}
// Iniciar servidor HTTP para sincronização
import { startHttpServer } from './httpServer';
import { createExpeditionInventory } from "./systems/capture";
const HTTP_PORT = Number(process.env.HTTP_PORT ?? 3004);
startHttpServer(HTTP_PORT);

console.log('\n=== Servidor WebSocket ===');
console.log(`PokéExtract WebSocket server listening on ws://localhost:${PORT}`);
console.log(`Debug mode: ${DEBUG_GAME_LOOP ? "ENABLED" : "disabled"}`);
console.log(`Tick rate: 20 ticks/second, State broadcast: every 3 ticks`);

