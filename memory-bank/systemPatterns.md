# PokéExtract: Wild Expedition – System Patterns

## Arquitetura de Alto Nível (MVP)
- **Frontend (Browser)**:
  - Aplicação SPA com canvas (provavelmente React + TypeScript + engine 2D simples).
  - Render de mapa top-down, criaturas e jogadores.
  - Cliente WebSocket para sincronização de estado de partida.
- **Backend**:
  - Servidor dedicado em Node.js (ou similar) com WebSockets.
  - Sala de partida até 12 jogadores.
  - Autoridade de jogo no servidor (server-authoritative) para evitar trapaças.
  - Serviços de persistência para progresso (base, criaturas, itens).
- **Banco de Dados**:
  - Armazenar contas, criaturas, recursos, upgrades de base.

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
- **Cliente → Servidor**:
  - Input de movimento (WASD), ações (ataque básico, habilidade, captura).
  - Requests de interação (coletar recurso, iniciar extração).
- **Servidor → Cliente**:
  - Atualizações de estado (posições, HP, spawns, morte, extrações).
  - Eventos importantes (início de extração, fim de partida, recompensas).

