## Plano de Multiplayer – PokéExtract: Wild Expedition

### Visão Geral

- **Objetivo**: Evoluir o protótipo single-player atual para um modelo **server-authoritative** com salas de até 12 jogadores, mantendo o cliente leve e focado em input/renderização.
- **Estado atual**:
  - Cliente Phaser em `ExpeditionScene` concentra a maior parte da lógica de jogo.
  - Servidor WebSocket (`server/src/index.ts`) sincroniza apenas presença/posição.
  - Cliente WebSocket (`src/services/multiplayerClient.ts`) já encapsula a comunicação básica.

---

### Divisão de Responsabilidades

#### Cliente (browser)

- **Responsabilidades principais**:
  - Captura de input do jogador (movimento, ataque, captura, extração).
  - Renderização de:
    - Mapa/topologia local (por enquanto, decorativo).
    - Jogador local e jogadores remotos.
    - Feedbacks visuais (partículas, textos flutuantes, HUD, etc.).
  - Predição leve/local (MVP: quase inexistente; apenas simulação imediata para “sensação” responsiva).
  - Envio de **intents** para o servidor via WebSocket:
    - Movimento desejado.
    - Início de ataque.
    - Tentativa de captura.
    - Tentativa de extração.
  - Aplicar snapshots de estado vindos do servidor:
    - Posições de jogadores.
    - Timer de partida (quando for a fonte de verdade).
    - No futuro: criaturas, recursos, estado de pontos de extração.

- **O que hoje ainda é client-only (com TODOs marcados na `ExpeditionScene`) e deve migrar**:
  - **Spawns**:
    - Criação de recursos (`spawnResourcesAndCreatures` – recursos amarelos).
    - Criação de criaturas selvagens (`WildCreature`).
  - **Dano e combate**:
    - Simulação de projéteis (`Projectile`) e colisões.
    - Cálculo de dano e redução de HP (`currentHp`, `maxHp` em `WildCreature`).
  - **Captura**:
    - Cálculo de chance de captura (baseChance + bonus por HP baixo).
    - Sucesso/falha de captura e remoção de criaturas.
  - **Recursos & coleta**:
    - Coleta automática ao colidir com recursos.
    - Contagem de `resourcesCollected`.
  - **Extração**:
    - Verificação de presença na zona de extração.
    - Timer de “segurar E” e conclusão de extração.
    - Persistência de itens no `PlayerState`.
  - **Timer de expedição**:
    - Contagem regressiva local (`expeditionTime`, `expeditionDuration`) e definição de falha por tempo.
  - **Telemetria**:
    - Apenas logs em console; ainda não enviada ao backend.

#### Servidor (Node.js, WebSocket)

- **Responsabilidades alvo (parcialmente implementadas hoje)**:
  - Gerenciar **salas de partida** (`Room` em `server/src/index.ts`):
    - Lista de jogadores conectados.
    - Presença (join/leave).
    - Posição dos jogadores.
  - Controlar **timer de partida**:
    - `startedAt` e `durationSeconds` já presentes no modelo de sala.
    - Cálculo de `elapsedSeconds` e `timeLeft` enviado aos clientes.
  - Broadcast periódico/reativo de snapshots de estado:
    - Hoje: apenas `players` + dados básicos de match.
    - Futuro: estado completo de mundo (criaturas, recursos, extração, etc.).
  - Rejeitar/validar intents inválidas (limite de sala, etc.).

- **Responsabilidades futuras planeadas**:
  - Definir o **layout do mapa** e seeds para geração de spawns.
  - Controlar **estado de criaturas**:
    - HP, spawns, respawns, drops.
  - Validar e aplicar **ataques e dano**.
  - Controlar **captura**:
    - Chances, sucesso/falha e criação de instâncias de criaturas.
  - Controlar **extração**:
    - Condições para iniciar/continuar/cancelar extração.
    - Conclusão de extração e cálculo de recompensas.
  - Persistir resultados e telemetria em banco de dados.

---

### Formato Básico de Mensagens WebSocket (JSON)

> Nota: Estes formatos descrevem o **contrato planejado**. O código atual implementa apenas um subconjunto (join, move, ping, state) e está anotado com TODOs para facilitar a migração.

#### Mensagens Cliente → Servidor

- **Join na sala**

```json
{
  "type": "join",
  "roomId": "floresta-celestial",
  "name": "JogadorX"
}
```

- **Movimento (já implementado)**

```json
{
  "type": "move",
  "x": 123.4,
  "y": 567.8
}
```

- **Ataque básico (planejado)**

```json
{
  "type": "attack_basic",
  "targetX": 100.0,
  "targetY": 200.0
}
```

- **Tentativa de captura (planejado)**

```json
{
  "type": "capture_attempt",
  "targetId": "wild-3"
}
```

- **Interação com recurso (planejado)**

```json
{
  "type": "resource_interact",
  "resourceId": "res-42"
}
```

- **Início/continuação de extração (planejado)**

```json
{
  "type": "extraction_request",
  "pointId": "extract-1",
  "action": "start" // ou "cancel"
}
```

- **Ping (já implementado, útil para healthcheck/latência)**

```json
{
  "type": "ping"
}
```

---

#### Mensagens Servidor → Cliente

- **Snapshot de estado (parcialmente implementado)**

```json
{
  "type": "state",
  "players": [
    {
      "id": "c1",
      "name": "Jogador1",
      "x": 120.5,
      "y": 340.8
    }
  ],
  "match": {
    "elapsedSeconds": 42,
    "timeLeft": 138,
    "durationSeconds": 180
  }
  /*
   * TODO(futuro):
   * "world": {
   *   "creatures": [...],
   *   "resources": [...],
   *   "extractionPoints": [...]
   * }
   */
}
```

- **Atualização de criaturas (planejado – pode vir junto no `state` ou em eventos separados)**

```json
{
  "type": "creatures_update",
  "creatures": [
    {
      "id": "wild-1",
      "x": 300,
      "y": 200,
      "currentHp": 42,
      "maxHp": 60,
      "state": "idle"
    }
  ]
}
```

- **Resultado de ataque (planejado)**

```json
{
  "type": "attack_result",
  "attackerId": "c1",
  "targetId": "wild-3",
  "damage": 18,
  "targetHp": 24
}
```

- **Resultado de captura (planejado)**

```json
{
  "type": "capture_result",
  "targetId": "wild-3",
  "success": true,
  "rewardCreatureInstanceId": "inst-abc123"
}
```

- **Estado/resultado de extração (planejado)**

```json
{
  "type": "extraction_state",
  "pointId": "extract-1",
  "status": "completed",
  "playerId": "c1",
  "rewards": {
    "resources": {
      "resource-ferro-cristalino": 5
    },
    "creaturesCaptured": 2
  }
}
```

- **Eventos de partida (planejado)**

```json
{
  "type": "match_event",
  "event": "finished", // ex: "started" | "almost_finished" | "finished"
  "timeLeft": 0
}
```

- **Erro genérico (já usado para sala cheia)**

```json
{
  "type": "error",
  "reason": "room_full"
}
```

---

### Próximos Passos Técnicos

1. **Servidor**
   - Formalizar o tipo de mensagem `IncomingMessage` para incluir intents de ataque, captura, extração e interação com recursos.
   - Introduzir uma estrutura de `WorldState` dentro de `Room` (criaturas, recursos, pontos de extração).
   - Criar loop de simulação da sala (tick de jogo) que:
     - Processa intents em fila.
     - Atualiza estado de mundo.
     - Emite snapshots `state` em intervalos fixos.

2. **Cliente**
   - Isolar melhor o **estado de mundo** na `ExpeditionScene` em estruturas que espelhem o futuro `WorldState` do servidor.
   - Substituir gradualmente:
     - Cálculo local de dano e captura por eventos vindos do servidor.
     - Spawns locais por spawns definidos no snapshot do servidor.
     - Timer local por `match.timeLeft`.
   - Evitar que código de cena construa JSON bruto; usar sempre o `MultiplayerClient` como adapter.

3. **Infra/telemetria**
   - Definir endpoint ou mensagem final de “resultado de expedição” para persistir:
     - Recursos coletados.
     - Criaturas capturadas.
     - Tempo de missão.
     - Estatísticas de tentativas de captura.

Este documento deve ser mantido atualizado conforme o contrato e as regras de jogo forem evoluindo.

