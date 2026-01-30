# PokéExtract: Wild Expedition – Tech Context

## Stack Proposto (sujeito a alinhamento)
- **Frontend**:
  - TypeScript
  - React (ou outra SPA leve) + engine/renderizador 2D (ex: PixiJS ou Phaser) para top-down.
  - WebSockets nativos ou via biblioteca (ex: socket.io client).
- **Backend**:
  - Node.js + TypeScript.
  - WebSocket server (ex: ws ou socket.io server).
  - Framework HTTP leve (Express ou similar) apenas para auth/básico.
- **Banco de Dados**:
  - Postgres ou outro relacional para persistência de progresso.
  - Para MVP local: SQLite/Prisma pode ser suficiente.

## Requisitos Técnicos
- **Gráficos**:
  - Pixel art 2D top-down, com possibilidade de parallax no futuro.
  - Para MVP, placeholders simples e foco na jogabilidade.
- **Networking**:
  - Comunicação via WebSockets.
  - Interpolação e previsão no cliente em iterações futuras (para MVP, foco em um loop simples e estável).
- **Performance**:
  - Alvo de 60 FPS em máquinas básicas.
  - Limitar número de entidades simultâneas e efeitos.

