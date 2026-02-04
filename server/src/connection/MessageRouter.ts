import { WebSocket } from "ws";
import type { IncomingMessage, Room, LootInteractMessage } from "../types/ServerTypes";
import { JoinHandler } from "../handlers/JoinHandler";
import { handleLootInteract } from "../handlers/LootHandler";
import { createMoveIntent, createAttackIntent, createSkillIntent, createCaptureIntent, createResourceIntent } from "../intents/IntentFactory";
import { queueIntent } from "../intents/IntentValidator";
import { createPlayerMoveMessage } from "../messages";
import { StateBroadcaster } from "../broadcast/StateBroadcaster";
import { processExtractionIntent } from "../systems/extraction";
import { createExtractionStateMessage } from "../messages";

/**
 * Roteia mensagens recebidas para handlers apropriados.
 */
export class MessageRouter {
  /**
   * Processa uma mensagem recebida.
   */
  static async handle(
    ws: WebSocket,
    clientId: string,
    msg: IncomingMessage,
    currentRoom: Room | null,
    onGameLoopStart: (room: Room) => void
  ): Promise<void> {
    // Join é tratado separadamente (pode criar/entrar em sala)
    if (msg.type === "join") {
      // JoinHandler precisa ser chamado antes de ter currentRoom
      return;
    }

    if (!currentRoom) return;

    switch (msg.type) {
      case "move": {
        const player = currentRoom.players.get(clientId);
        if (!player) return;

        player.x = msg.x;
        player.y = msg.y;

        if (currentRoom.gameLoop) {
          currentRoom.gameLoop.updatePlayerPosition(clientId, msg.x, msg.y);
        }

        queueIntent(currentRoom, clientId, createMoveIntent(clientId, msg));
        const moveMsg = createPlayerMoveMessage(clientId, msg.x, msg.y);
        StateBroadcaster.broadcastMessage(currentRoom, moveMsg);
        break;
      }

      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;

      case "team_sync": {
        const player = currentRoom.players.get(clientId);
        if (!player) return;
        
        const creatures = msg.creatures as Array<{
          instanceId: string;
          definitionId: string;
          level: number;
          currentHp: number;
          maxHp: number;
          rank?: number;
        }>;
        
        const activeCreatureId = msg.activeCreatureInstanceId as string | null;
        
        if (activeCreatureId) {
          player.activeCreatureId = activeCreatureId;
          const activeCreature = creatures.find(c => c.instanceId === activeCreatureId);
          if (activeCreature && currentRoom.gameLoop) {
            currentRoom.gameLoop.updatePlayerHp(clientId, activeCreature.currentHp, activeCreature.maxHp);
          }
        }
        break;
      }

      case "active_creature_update": {
        const player = currentRoom.players.get(clientId);
        if (!player) return;
        
        const instanceId = msg.instanceId as string;
        const currentHp = msg.currentHp as number;
        const maxHp = msg.maxHp as number;
        
        player.activeCreatureId = instanceId;
        
        if (currentRoom.gameLoop) {
          currentRoom.gameLoop.updatePlayerHp(clientId, currentHp, maxHp);
        }
        break;
      }

      case "attack_basic":
        queueIntent(currentRoom, clientId, createAttackIntent(clientId, msg));
        break;

      case "use_skill":
        queueIntent(currentRoom, clientId, createSkillIntent(clientId, msg));
        break;

      case "capture_attempt":
        queueIntent(currentRoom, clientId, createCaptureIntent(clientId, msg));
        break;

      case "resource_interact":
        console.log(`[MessageRouter] Processando resource_interact do jogador ${clientId.slice(0, 8)}... para recurso: ${msg.resourceId}`);
        queueIntent(currentRoom, clientId, createResourceIntent(clientId, msg));
        break;

      case "extraction_request": {
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

        if (success && msg.action === "start") {
          const message = createExtractionStateMessage(
            msg.pointId,
            clientId,
            "in_progress",
            0
          );
          ws.send(JSON.stringify(message));
        }
        break;
      }

      case "loot_interact": {
        // ✅ SPRINT 1: Handler de coleta de loot
        const lootResult = await handleLootInteract(
          currentRoom,
          clientId,
          msg as LootInteractMessage
        );
        if (!lootResult.success) {
          ws.send(JSON.stringify({
            type: "error",
            reason: lootResult.error || "loot_collection_failed"
          }));
        }
        break;
      }
    }
  }
}
