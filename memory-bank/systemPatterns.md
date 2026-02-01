# PokéExtract: Wild Expedition – System Patterns

## Arquitetura de Alto Nível (Multiplayer-First)

### Princípios Fundamentais
- **Server-Authoritative**: Servidor valida e processa todas as ações
- **Multiplayer-First**: Sempre conecta ao servidor, sem modo offline
- **Fonte Única de Verdade**: Servidor inicializa e gerencia todo o estado do mundo
- **Cliente Leve**: Cliente apenas renderiza e envia intents, não processa lógica de jogo

### Componentes
- **Frontend (Browser)**:
  - Phaser 3 para renderização 2D
  - Cliente WebSocket para comunicação em tempo real
  - Interpolação de movimento suave
  - Predição visual local para responsividade
  
- **Backend (Node.js)**:
  - Servidor WebSocket dedicado
  - Game Loop a 20 ticks/s
  - Validação server-side de todas as ações
  - Gerenciamento de salas (até 12 jogadores por sala)
  - Inicialização completa do mundo (spawns, recursos, criaturas)
  
- **Persistência (Firebase)**:
  - Firestore para dados de jogadores e expedições
  - Server-authoritative (apenas servidor escreve)
  - Cliente apenas lê seus próprios dados

## Padrões de Jogo
- **Sala de Partida**:
  - Cada partida é uma sala com:
    - Estado do mapa (recursos, criaturas, pontos de extração).
    - Lista de jogadores conectados.
    - Timer de partida.
- **Entidades Principais**:
  - Player (posição, vida, inventário temporário, criaturas na expedição).
  - Creature (stats, tipo, ataques, estado atual).
  - Resource Node (tipo de recurso, quantidade, respawn).
  - Extraction Point (estado: fechado/abrindo/aberto, fila de jogadores extraindo).

## Comunicação em Tempo Real

### Cliente → Servidor (Intents)
- **Movimento**: `move` (x, y) - validação de velocidade no servidor
- **Ataque**: `attack` (targetX, targetY) - validação de cooldown e criação de projétil
- **Captura**: `capture` (creatureId, ballType) - cálculo de chance no servidor
- **Extração**: `extraction` (pointId, action) - validação de posição e progresso
- **Habilidades**: `skill` (skillType, targetX, targetY) - criação de skill zones

### Servidor → Cliente (Updates)
- **Estado Completo**: `state` (players, world, match) - snapshot inicial
- **Criaturas**: `creaturesUpdate` (10Hz) - posições, HP, estados de IA
- **Recursos**: `resourcesUpdate` (10Hz) - posições, quantidades
- **Projéteis**: `projectilesUpdate` (20Hz) - posições, velocidades
- **Skill Zones**: `skillZonesUpdate` (20Hz) - posições, timers
- **Resultados**: `attackResult`, `captureResult`, `extractionState` - confirmações de ações

