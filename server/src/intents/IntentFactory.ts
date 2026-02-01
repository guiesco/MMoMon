import type { AnyIntent } from "../gameLoop";
import type { 
  MoveMessage, 
  AttackMessage, 
  SkillMessage, 
  CaptureMessage, 
  ResourceInteractMessage,
  ExtractionMessage
} from "../types/ServerTypes";

/**
 * Factory para criar intents a partir de mensagens recebidas.
 */
export class IntentFactory {
  /**
   * Converte mensagem de movimento em intent.
   */
  static createMoveIntent(playerId: string, msg: MoveMessage): AnyIntent {
    return {
      playerId,
      type: "move",
      timestamp: Date.now(),
      data: { x: msg.x, y: msg.y }
    };
  }

  /**
   * Converte mensagem de ataque em intent.
   */
  static createAttackIntent(playerId: string, msg: AttackMessage): AnyIntent {
    return {
      playerId,
      type: "attack",
      timestamp: Date.now(),
      data: {
        targetX: msg.targetX,
        targetY: msg.targetY,
        creatureId: msg.creatureId,
        attackType: msg.attackType ?? "basic"
      }
    };
  }

  /**
   * Converte mensagem de skill em intent.
   */
  static createSkillIntent(playerId: string, msg: SkillMessage): AnyIntent {
    return {
      playerId,
      type: "skill",
      timestamp: Date.now(),
      data: {
        skillType: msg.skillType,
        targetX: msg.targetX,
        targetY: msg.targetY,
        creatureId: msg.creatureId
      }
    };
  }

  /**
   * Converte mensagem de captura em intent.
   */
  static createCaptureIntent(playerId: string, msg: CaptureMessage): AnyIntent {
    return {
      playerId,
      type: "capture",
      timestamp: Date.now(),
      data: {
        targetId: msg.targetId,
        ballType: msg.ballType
      }
    };
  }

  /**
   * Converte mensagem de recurso em intent.
   */
  static createResourceIntent(playerId: string, msg: ResourceInteractMessage): AnyIntent {
    return {
      playerId,
      type: "resource",
      timestamp: Date.now(),
      data: {
        resourceId: msg.resourceId
      }
    };
  }

  /**
   * Converte mensagem de extração em intent.
   */
  static createExtractionIntent(playerId: string, msg: ExtractionMessage): AnyIntent {
    return {
      playerId,
      type: "extraction",
      timestamp: Date.now(),
      data: { pointId: msg.pointId, action: msg.action }
    };
  }
}

// Exportar funções individuais para compatibilidade
export function createMoveIntent(playerId: string, msg: MoveMessage): AnyIntent {
  return IntentFactory.createMoveIntent(playerId, msg);
}

export function createAttackIntent(playerId: string, msg: AttackMessage): AnyIntent {
  return IntentFactory.createAttackIntent(playerId, msg);
}

export function createSkillIntent(playerId: string, msg: SkillMessage): AnyIntent {
  return IntentFactory.createSkillIntent(playerId, msg);
}

export function createCaptureIntent(playerId: string, msg: CaptureMessage): AnyIntent {
  return IntentFactory.createCaptureIntent(playerId, msg);
}

export function createResourceIntent(playerId: string, msg: ResourceInteractMessage): AnyIntent {
  return IntentFactory.createResourceIntent(playerId, msg);
}

export function createExtractionIntent(playerId: string, msg: ExtractionMessage): AnyIntent {
  return IntentFactory.createExtractionIntent(playerId, msg);
}
