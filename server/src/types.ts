/**
 * Tipos compartilhados para o estado do mundo no servidor.
 * 
 * Este arquivo define as estruturas de dados que representam todas as entidades
 * do jogo no servidor. O servidor é a fonte de verdade (server-authoritative)
 * e o cliente apenas renderiza/interpola esses dados.
 * 
 * @module server/types
 */

// ============================================================================
// Tipos base reutilizados do cliente
// ============================================================================

/**
 * Tier de ameaça de uma criatura.
 * Define dificuldade, HP base, e recompensas.
 * 
 * - "comum": Criaturas fáceis, HP baixo, recompensas básicas
 * - "perigosa": Criaturas médias, HP moderado, melhores drops
 * - "elite": Criaturas difíceis, HP alto, recompensas raras
 */
export type ThreatTier = "comum" | "perigosa" | "elite";

/**
 * Tipo de comportamento de IA de uma criatura.
 * 
 * - "melee": Ataca corpo-a-corpo, persegue o jogador
 * - "ranged": Ataca à distância, mantém distância do jogador
 */
export type EnemyBehaviorType = "melee" | "ranged";

/**
 * Estado atual da IA de uma criatura.
 * 
 * - "idle": Parado ou patrulhando passivamente
 * - "chasing": Perseguindo um alvo (jogador)
 * - "attacking": Executando um ataque (windup + ação)
 * - "retreating": Recuando para manter distância (ranged)
 * - "stunned": Atordoado temporariamente (após levar dano crítico)
 */
export type EnemyAIState = "idle" | "chasing" | "attacking" | "retreating" | "stunned";

// ============================================================================
// Entidades do Servidor
// ============================================================================

/**
 * Representa uma criatura selvagem no mundo do servidor.
 * 
 * O servidor controla spawns, HP, dano, morte e drops.
 * O cliente apenas renderiza a posição e estado visual.
 */
export interface ServerCreature {
  /** Identificador único da criatura (ex: "wild-0", "wild-1") */
  id: string;

  /** Tipo/espécie da criatura (ex: "bulbasaur", "charmander") */
  creatureType: string;

  /** Posição X no mundo */
  x: number;

  /** Posição Y no mundo */
  y: number;

  /** HP atual da criatura */
  currentHp: number;

  /** HP máximo da criatura */
  maxHp: number;

  /** Tier de ameaça (afeta dificuldade e recompensas) */
  tier: ThreatTier;

  /** Estado atual da máquina de estados de IA */
  aiState: EnemyAIState;

  /** Tipo de comportamento (melee vs ranged) */
  behaviorType: EnemyBehaviorType;

  /** Ponto de origem para patrulha (criatura retorna a este ponto quando idle) */
  patrolOrigin: { x: number; y: number };

  /** Tempo restante de cooldown de ataque (em segundos) */
  attackCooldownRemaining: number;
  
  /** FASE 4A: Timers e estados adicionais de IA */
  
  /** Tempo restante do windup de ataque (animação pré-ataque) */
  windupTimer: number;
  
  /** Tempo restante de stun (atordoamento) */
  stunTimer: number;
  
  /** Timer de patrulha (para movimento idle) */
  patrolTimer: number;
  
  /** ✅ Tempo restante de cooldown de skill especial (em segundos) */
  skillCooldownRemaining: number;
  
  /** ✅ Último tempo que a criatura usou skill (timestamp em ms) */
  lastSkillTime: number;
  
  /** ✅ Tempo restante do windup de skill (em segundos) - bloqueia movimento */
  skillWindupTimer: number;
  
  /** ✅ Dados da skill pendente durante windup */
  pendingSkill?: {
    skillType: string;
    targetX: number;
    targetY: number;
  };
  
  /** ✅ Roaming: Destino atual de patrulha (null se não está patrulhando) */
  roamingTarget?: { x: number; y: number } | null;

  /** ID do jogador que a criatura está mirando (null se idle) */
  targetPlayerId: string | null;
  
  /** Nível da criatura selvagem (baseado no tier) */
  level?: number;
  
  /** ✅ Stats calculados baseados em nível e rank (armazenados para uso na IA) */
  effectiveStats?: {
    moveSpeed: number;
    defense: number;
    attackDamage: number;
    // Valores de IA calculados baseados em tier e level
    detectionRange: number;
    attackRange: number;
    attackCooldown: number;
    attackWindup: number;
    stunDuration: number;
    preferredDistance: number;
    projectileSpeed: number;
  };
  
  /** ✅ FASE 9: Buffs e debuffs ativos na criatura */
  buffs?: Array<{
    type: 'speed' | 'slow' | 'freeze' | 'stun' | 'poison' | 'shield' | 'invulnerable' | 'regen';
    duration: number;
    value?: number;
    sourceId?: string;
    appliedAt: number;
  }>;
}

/**
 * Representa um recurso coletável no mundo do servidor.
 * 
 * Recursos são coletados automaticamente ao colidir com o jogador.
 * O servidor valida a coleta e atualiza o inventário temporário.
 */
export interface ServerResource {
  /** Identificador único do recurso (ex: "res-0", "res-1") */
  id: string;

  /** ID do item que este recurso representa (ex: "resource-ferro-cristalino") */
  resourceType: string;

  /** Posição X no mundo */
  x: number;

  /** Posição Y no mundo */
  y: number;

  /** Quantidade de itens que o recurso fornece ao ser coletado */
  quantity: number;

  /** Se este é um recurso raro (maior visibilidade, melhor drop) */
  isRare: boolean;
  
  /** FASE 4B: Propriedades visuais para renderização consistente */
  
  /** Tamanho do sprite (recursos raros são maiores) */
  size: number;
  
  /** Cor do sprite (hex) */
  color: number;
  
  /** Cor da borda (hex) */
  borderColor: number;
  
  /** Largura da borda */
  borderWidth: number;
}

/**
 * Representa um ponto de extração no mundo do servidor.
 * 
 * Jogadores devem permanecer na zona de extração por um tempo
 * para extrair com sucesso seus recursos e criaturas capturadas.
 */
export interface ServerExtractionPoint {
  /** Identificador único do ponto (ex: "extract-0") */
  id: string;

  /** Posição X do centro da zona */
  x: number;

  /** Posição Y do centro da zona */
  y: number;

  /** Raio da zona de extração */
  radius: number;

  /**
   * Mapa de progresso de extração por jogador.
   * Chave: playerId, Valor: progresso em segundos (0 a extractionRequired)
   */
  playersExtracting: Map<string, number>;

  /** Se o ponto de extração está ativo (pode ter pontos temporários) */
  isActive: boolean;
}

/**
 * Representa uma zona de skill ativa no mundo do servidor.
 * 
 * Skills como "Nevoeiro Incendiário" criam áreas persistentes que causam
 * dano por segundo em criaturas dentro da área.
 */
export interface ServerSkillZone {
  /** Identificador único da zona (ex: "skill-zone-0") */
  id: string;

  /** ID do jogador que criou a zona */
  ownerId: string;

  /** Tipo de skill */
  skillType: "fire_fog" | "root_trap" | "water_pulse" | "electric_surge";

  /** Posição X do centro da zona */
  x: number;

  /** Posição Y do centro da zona */
  y: number;

  /** Raio da zona em pixels */
  radius: number;

  /** Dano por tick */
  damagePerTick: number;

  /** Intervalo entre ticks de dano (em segundos) */
  tickInterval: number;

  /** Timer para próximo tick de dano */
  tickTimer: number;

  /** Tempo de vida restante da zona (em segundos) */
  lifetime: number;

  /** Modificador de slow (0.0 a 1.0, onde 0.5 = 50% mais lento) */
  slowModifier?: number;
  
  /** ✅ Ataque do atacante (para calcular dano com defesa) */
  attackerAttack?: number;
}

/**
 * Representa um projétil ativo no mundo do servidor.
 * 
 * Projéteis podem ser de jogadores (ataques) ou de criaturas (ataques ranged).
 * O servidor valida colisões e aplica dano.
 */
export interface ServerProjectile {
  /** Identificador único do projétil (ex: "proj-0") */
  id: string;

  /** ID do dono do projétil (playerId ou creatureId) */
  ownerId: string;

  /** Se o projétil foi disparado por um jogador (true) ou criatura (false) */
  isPlayerProjectile: boolean;
  
  /** ✅ Tipo da criatura que disparou o projétil (para type effectiveness) */
  creatureType?: string;
  
  /** ✅ Ataque do atacante (para calcular dano com defesa) */
  attackerAttack?: number;

  /** Posição X atual */
  x: number;

  /** Posição Y atual */
  y: number;

  /** Posição X inicial (para calcular distância percorrida) */
  startX: number;

  /** Posição Y inicial (para calcular distância percorrida) */
  startY: number;

  /** Velocidade X (pixels por segundo) */
  velocityX: number;

  /** Velocidade Y (pixels por segundo) */
  velocityY: number;

  /** Dano que o projétil causa ao colidir */
  damage: number;

  /** Tempo de vida restante em segundos (projétil é destruído quando <= 0) */
  lifetime: number;

  /** Distância máxima que o projétil pode percorrer (em pixels) */
  maxDistance: number;
}

// ============================================================================
// Estado do Mundo
// ============================================================================

/**
 * Estado completo do mundo de uma sala/partida.
 * 
 * Esta estrutura agrupa todas as entidades dinâmicas do jogo
 * e é enviada periodicamente aos clientes via snapshot.
 */
export interface WorldState {
  /** Lista de criaturas selvagens ativas no mapa */
  creatures: ServerCreature[];

  /** Lista de recursos disponíveis para coleta */
  resources: ServerResource[];

  /** Lista de pontos de extração */
  extractionPoints: ServerExtractionPoint[];

  /** Lista de projéteis ativos (de jogadores e criaturas) */
  projectiles: ServerProjectile[];

  /** Lista de zonas de skill ativas */
  skillZones: ServerSkillZone[];
}

// ============================================================================
// Funções Factory
// ============================================================================

/** Contador global para geração de IDs únicos */
let entityIdCounter = 0;

/**
 * Gera um ID único para uma entidade.
 * 
 * @param prefix - Prefixo do ID (ex: "wild", "res", "proj")
 * @returns ID único no formato "{prefix}-{número}"
 */
function generateId(prefix: string): string {
  return `${prefix}-${entityIdCounter++}`;
}

/**
 * Reseta o contador de IDs.
 * Útil para testes ou quando uma nova sala é criada.
 */
export function resetIdCounter(): void {
  entityIdCounter = 0;
}

/**
 * Cria uma nova criatura selvagem.
 * 
 * @param creatureType - Tipo/espécie da criatura
 * @param x - Posição X inicial
 * @param y - Posição Y inicial
 * @param tier - Tier de ameaça
 * @param behaviorType - Tipo de comportamento de IA (default: "melee")
 * @param maxHp - HP máximo (opcional, calculado por tier se não fornecido)
 * @returns Nova instância de ServerCreature
 * 
 * @example
 * ```ts
 * const creature = createCreature("bulbasaur", 100, 200, "comum");
 * ```
 */
export function createCreature(
  creatureType: string,
  x: number,
  y: number,
  tier: ThreatTier,
  behaviorType: EnemyBehaviorType = "melee",
  maxHp?: number
): ServerCreature {
  // HP base por tier (valores aproximados, podem ser ajustados)
  const hpByTier: Record<ThreatTier, number> = {
    comum: 30,
    perigosa: 60,
    elite: 120
  };

  const hp = maxHp ?? hpByTier[tier];

  // Nível baseado no tier (para exibição)
  // comum: 1-3, perigosa: 4-6, elite: 7-10
  const levelByTier: Record<ThreatTier, { min: number; max: number }> = {
    comum: { min: 1, max: 3 },
    perigosa: { min: 4, max: 6 },
    elite: { min: 7, max: 10 }
  };
  const tierLevelRange = levelByTier[tier];
  const level = Math.floor(Math.random() * (tierLevelRange.max - tierLevelRange.min + 1)) + tierLevelRange.min;

  return {
    id: generateId("wild"),
    creatureType,
    x,
    y,
    currentHp: hp,
    maxHp: hp,
    tier,
    aiState: "idle",
    behaviorType,
    patrolOrigin: { x, y },
    attackCooldownRemaining: 0,
    windupTimer: 0,
    stunTimer: 0,
    patrolTimer: 0,
    roamingTarget: null,
    targetPlayerId: null,
    level,
    skillCooldownRemaining: 0,
    lastSkillTime: 0,
    skillWindupTimer: 0 // ✅ Inicializar windup de skill
  };
}

/**
 * Cria um novo recurso coletável.
 * 
 * @param resourceType - ID do item que o recurso representa
 * @param x - Posição X
 * @param y - Posição Y
 * @param quantity - Quantidade fornecida ao coletar (default: 1)
 * @param isRare - Se é um recurso raro (default: false)
 * @returns Nova instância de ServerResource
 * 
 * @example
 * ```ts
 * const resource = createResource("resource-ferro-cristalino", 300, 400);
 * const rareResource = createResource("resource-essencia-celestial", 500, 600, 1, true);
 * ```
 */
export function createResource(
  resourceType: string,
  x: number,
  y: number,
  quantity: number = 1,
  isRare: boolean = false
): ServerResource {
  // Propriedades visuais baseadas em raridade
  const size = isRare ? 18 : 12;
  const color = isRare ? 0xffd700 : 0x4ade80; // Dourado para raro, verde para comum
  const borderColor = isRare ? 0xffaa00 : 0x22c55e;
  const borderWidth = isRare ? 3 : 2;
  
  return {
    id: generateId("res"),
    resourceType,
    x,
    y,
    quantity,
    isRare,
    size,
    color,
    borderColor,
    borderWidth
  };
}

/**
 * Cria um novo ponto de extração.
 * 
 * @param x - Posição X do centro
 * @param y - Posição Y do centro
 * @param radius - Raio da zona de extração
 * @param isActive - Se o ponto está ativo (default: true)
 * @returns Nova instância de ServerExtractionPoint
 * 
 * @example
 * ```ts
 * const extractionPoint = createExtractionPoint(800, 100, 60);
 * ```
 */
export function createExtractionPoint(
  x: number,
  y: number,
  radius: number,
  isActive: boolean = true
): ServerExtractionPoint {
  return {
    id: generateId("extract"),
    x,
    y,
    radius,
    playersExtracting: new Map(),
    isActive
  };
}

/**
 * Cria um novo projétil.
 * 
 * @param ownerId - ID do dono (jogador ou criatura)
 * @param isPlayerProjectile - Se foi disparado por um jogador
 * @param x - Posição X inicial
 * @param y - Posição Y inicial
 * @param velocityX - Velocidade X
 * @param velocityY - Velocidade Y
 * @param damage - Dano ao colidir
 * @param lifetime - Tempo de vida em segundos
 * @param maxDistance - Distância máxima em pixels (opcional, padrão: infinito)
 * @param creatureType - Tipo da criatura que disparou (opcional, para type effectiveness)
 * @param attackerAttack - Ataque do atacante (opcional, para calcular dano com defesa)
 * @returns Nova instância de ServerProjectile
 * 
 * @example
 * ```ts
 * const playerShot = createProjectile("player-1", true, 100, 200, 300, 0, 10, 2.0, 220, "pyrognat", 50);
 * const enemyShot = createProjectile("wild-5", false, 400, 300, -200, 100, 5, 1.5);
 * ```
 */
export function createProjectile(
  ownerId: string,
  isPlayerProjectile: boolean,
  x: number,
  y: number,
  velocityX: number,
  velocityY: number,
  damage: number,
  lifetime: number,
  maxDistance: number = Infinity,
  creatureType?: string,
  attackerAttack?: number
): ServerProjectile {
  return {
    id: generateId("proj"),
    ownerId,
    isPlayerProjectile,
    creatureType,
    attackerAttack,
    x,
    y,
    startX: x,
    startY: y,
    velocityX,
    velocityY,
    damage,
    lifetime,
    maxDistance
  };
}

/**
 * Cria uma nova zona de skill.
 * 
 * @param ownerId - ID do jogador que criou a zona
 * @param skillType - Tipo de skill
 * @param x - Posição X do centro
 * @param y - Posição Y do centro
 * @param radius - Raio da zona
 * @param damagePerTick - Dano por tick
 * @param tickInterval - Intervalo entre ticks
 * @param lifetime - Tempo de vida total
 * @param slowModifier - Modificador de slow (opcional)
 * @param attackerAttack - Ataque do atacante (opcional, para calcular dano com defesa)
 * @returns Nova instância de ServerSkillZone
 * 
 * @example
 * ```ts
 * const fireFog = createSkillZone("player-1", "fire_fog", 300, 200, 70, 8, 0.5, 4, undefined, 50);
 * ```
 */
export function createSkillZone(
  ownerId: string,
  skillType: "fire_fog" | "root_trap" | "water_pulse" | "electric_surge",
  x: number,
  y: number,
  radius: number,
  damagePerTick: number,
  tickInterval: number,
  lifetime: number,
  slowModifier?: number,
  attackerAttack?: number
): ServerSkillZone {
  return {
    id: generateId("skill-zone"),
    ownerId,
    skillType,
    x,
    y,
    radius,
    damagePerTick,
    tickInterval,
    tickTimer: 0, // Primeiro tick imediato
    lifetime,
    slowModifier,
    attackerAttack
  };
}

// ============================================================================
// Utilitários
// ============================================================================

/**
 * Cria um WorldState vazio.
 * Útil para inicializar uma nova sala.
 * 
 * @returns WorldState com todas as listas vazias
 */
export function createEmptyWorldState(): WorldState {
  return {
    creatures: [],
    resources: [],
    extractionPoints: [],
    projectiles: [],
    skillZones: []
  };
}

/**
 * Serializa um WorldState para envio via WebSocket.
 * Converte Maps para objetos simples para JSON.stringify funcionar.
 * 
 * @param state - WorldState a serializar
 * @returns Objeto serializável
 */
export function serializeWorldState(state: WorldState): object {
  return {
    creatures: state.creatures,
    resources: state.resources,
    extractionPoints: state.extractionPoints.map(ep => ({
      ...ep,
      // Converte Map para objeto para serialização JSON
      playersExtracting: Object.fromEntries(ep.playersExtracting)
    })),
    projectiles: state.projectiles
  };
}
