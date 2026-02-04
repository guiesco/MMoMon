import { WebSocketServer, WebSocket } from "ws";
import { GameLoop, MatchState, AnyIntent } from "./gameLoop";
import {
  MATCH_DURATION_SECONDS,
  EXPEDITION_DURATION_SECONDS,
  MAX_PLAYERS_PER_ROOM,
  DEBUG_GAME_LOOP,
  getMapSpawnConfig
} from "./constants";
import type { WorldState, ServerCreature } from "./types";
import { 
  createEmptyWorldState
} from "./types";
import { initializeWorldSpawns } from "./systems/spawns";
import {
  createAttackResultMessage,
  createPlayerDeathMessage,
  createPlayerMoveMessage,
  createCaptureResultMessage,
  createCreaturesUpdateMessage,
  createResourcesUpdateMessage,
  createProjectilesUpdateMessage,
  createSkillZonesUpdateMessage,
  createExtractionStateMessage,
  createMatchEventMessage,
  type AttackResultMessage,
  type PlayerDeathMessage,
  type PlayerMoveMessage,
  type OutgoingMessage
} from "./messages";
import { 
  type PlayerExpeditionInventory,
  createExpeditionInventory
} from "./systems/capture";
import {
  processExtractionIntent,
  allPlayersExtractedOrDead,
  initializePlayerExtractionData
} from "./systems/extraction";
import { initializeFirebase, isFirebaseAvailable } from "./firebase";
import { saveExpeditionRewards, getUser } from "./firestoreOperations";
import type { SaveExpeditionData } from "./firebaseTypes";

// FASE 4: Imports dos módulos modulares
import { StateBroadcaster } from "./broadcast/StateBroadcaster";
import { RoomManager } from "./room/RoomManager";
import { JoinHandler } from "./handlers/JoinHandler";
import { MessageRouter } from "./connection/MessageRouter";
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
 * Processa o sistema de extração para uma sala.
 * FASE 4: Movido para ExtractionHandler
 * @deprecated Use processExtractionSystem de handlers/ExtractionHandler
 */
async function processExtractionSystem(room: Room, deltaMs: number): Promise<void> {
  // Esta função foi movida para handlers/ExtractionHandler.ts
  // Mantida apenas para compatibilidade durante migração
  const { processExtractionSystem: handler } = await import("./handlers/ExtractionHandler");
  return handler(room, deltaMs);
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
 * Cria e configura o game loop para uma sala.
 * FASE 4: Movido para GameLoopManager
 * @deprecated Use createGameLoop de managers/GameLoopManager
 */
function createGameLoop(room: Room): GameLoop {
  const { createGameLoop: managerCreate } = require("./managers/GameLoopManager");
  return managerCreate(room);
}

/**
 * Handler para quando uma partida termina.
 * FASE 4: Movido para GameLoopManager
 * @deprecated Esta função foi movida para managers/GameLoopManager
 */
function handleMatchFinished(room: Room): void {
  // Esta função foi movida para managers/GameLoopManager.ts
  // Mantida apenas para compatibilidade durante migração
  if (DEBUG_GAME_LOOP) {
    console.log(`[Room:${room.id}] Partida finalizada. Jogadores: ${room.players.size}`);
  }
}

/**
 * Obtém ou cria uma sala.
 * FASE 4: Delegar para RoomManager
 */
function getOrCreateRoom(id: string): Room {
  return roomManager.getOrCreateRoom(id);
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
 * Remove uma sala do servidor completamente.
 * @deprecated Use cleanupRoom() ao invés desta função.
 */
function removeRoom(roomId: string): void {
  cleanupRoom(roomId);
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
      let room = existingRoom ?? getOrCreateRoom(msg.roomId);

      // Registrar cliente na sala ANTES de chamar JoinHandler
      // (JoinHandler precisa do clientId registrado)
      clientToRoom.set(clientId, room.id);
      currentRoom = room;

      // Usar JoinHandler para processar join (recupera time E mochila do Firebase)
      const result = await JoinHandler.handle(
        ws,
        clientId,
        msg,
        room,
        (room) => {
          // Callback para iniciar game loop quando necessário
          if (room.players.size === 1 || !room.gameLoop?.isRunning()) {
            startRoomGameLoop(room);
          }
        }
      );

      if (!result.success) {
        // Se join falhou, remover cliente da sala
        clientToRoom.delete(clientId);
        if (result.error === "room_full") {
          ws.send(JSON.stringify({ type: "error", reason: "room_full" }));
        } else if (result.error === "user_not_found") {
          ws.send(JSON.stringify({ type: "error", reason: "user_not_found" }));
        }
        return;
      }

      // Registrar jogador no sistema de combate do game loop (se já existe)
      const player = room.players.get(clientId);
      if (player && room.gameLoop) {
        room.gameLoop.registerPlayer(
          clientId,
          player.x,
          player.y,
          100, // HP inicial
          100  // HP máximo
        );
      }

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
        const roomId = currentRoom.id; // Capturar roomId para uso no timeout
        if (DEBUG_GAME_LOOP) {
          console.log(`[Server] Sala ${roomId} vazia, iniciando timer de cleanup (30s)`);
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
const HTTP_PORT = Number(process.env.HTTP_PORT ?? 3004);
startHttpServer(HTTP_PORT);

console.log('\n=== Servidor WebSocket ===');
console.log(`PokéExtract WebSocket server listening on ws://localhost:${PORT}`);
console.log(`Debug mode: ${DEBUG_GAME_LOOP ? "ENABLED" : "disabled"}`);
console.log(`Tick rate: 20 ticks/second, State broadcast: every 3 ticks`);

