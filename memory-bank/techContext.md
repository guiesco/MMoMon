# PokéExtract: Wild Expedition – Tech Context

## Stack Tecnológico (Atual)

### Frontend
- **TypeScript**: Tipagem estática
- **Phaser 3**: Engine de jogo 2D
- **Vite**: Build tool e dev server
- **WebSocket (ws)**: Comunicação em tempo real
- **Firebase Client SDK**: Autenticação e sincronização

### Backend
- **Node.js + TypeScript**: Runtime e tipagem
- **WebSocket (ws)**: Servidor WebSocket
- **Express**: HTTP server (para APIs)
- **Firebase Admin SDK**: Persistência e autenticação

### Persistência
- **Firebase Firestore**: Banco de dados NoSQL na nuvem
- **localStorage**: Fallback offline (apenas leitura)

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

