# PokéExtract: Wild Expedition

Jogo multiplayer de extração em browser onde jogadores exploram mapas top-down, capturam criaturas, coletam recursos e enfrentam outros jogadores em combate de ação em tempo real.

## 🎮 Sobre o Jogo

**Core Loop:**
1. Entrar em expedições (sala/partida)
2. Explorar o mapa
3. Encontrar criaturas e materiais
4. Capturar/Coletar
5. Enfrentar outros jogadores (PvP sempre ligado)
6. Chegar em pontos de extração e extrair
7. Usar recursos/criaturas extraídos para melhorar base e equipamentos

**Arquitetura:** Multiplayer-First, Server-Authoritative

## 🚀 Como Rodar

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Setup Inicial

1. **Instalar dependências:**
```bash
npm install
cd server && npm install
```

2. **Configurar variáveis de ambiente:**

Crie um arquivo `.env` na raiz do projeto:
```env
# URL do servidor WebSocket (local)
VITE_WS_URL=ws://localhost:3003

# URL do servidor HTTP (local)
VITE_SERVER_URL=http://localhost:3004

# Firebase Client SDK (obtenha no Firebase Console)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

3. **Configurar Firebase:**

- Crie um projeto no [Firebase Console](https://console.firebase.google.com)
- Ative **Authentication > Anonymous**
- Crie um banco **Firestore Database**
- Publique as regras de `firestore.rules`
- Baixe `firebase-service-account.json` e coloque em `server/`
- Crie `src/services/firebaseConfig.ts` a partir de `src/services/firebaseConfig.example.ts`

4. **Iniciar servidor:**
```bash
cd server
npm run dev
```

5. **Iniciar cliente:**
```bash
npm run dev
```

Acesse `http://localhost:5173`

## 📁 Estrutura do Projeto

```
MMoMon/
├── src/                    # Cliente (Frontend)
│   ├── game/              # Lógica de jogo (criaturas, itens, progresso)
│   ├── scenes/            # Cenas Phaser (Expedition, Base, Crafting, etc)
│   └── services/          # Serviços (Firebase, Multiplayer)
├── server/                 # Servidor (Backend)
│   ├── src/
│   │   ├── handlers/      # Handlers de mensagens WebSocket
│   │   ├── systems/       # Sistemas de jogo (combate, captura, extração)
│   │   ├── managers/      # Gerenciadores (GameLoop, Room)
│   │   └── firestoreOperations.ts
│   └── firebase-service-account.json
└── memory-bank/           # Documentação do projeto
```

## 🎮 Comandos do Jogo

- **WASD / Setas**: Movimento
- **ESPAÇO / Clique esquerdo**: Ataque básico
- **Q**: Tentar capturar criatura próxima
- **F**: Habilidade especial
- **E**: Iniciar/segurar extração (na zona de extração)
- **ESC**: Voltar ao menu

## 🔥 Firebase

O jogo usa Firebase para persistência na nuvem:

- **Autenticação**: Anônima (pode adicionar email/senha)
- **Firestore**: Dados do jogador, inventário, criaturas, histórico de expedições
- **Arquitetura**: Server-authoritative (servidor valida e salva tudo)

**Sem Firebase**: O jogo funciona com localStorage (modo offline), mas sem sincronização na nuvem.

## 🌐 Deploy

### Servidor (Fly.io)

```bash
cd server
flyctl launch
flyctl secrets set CLIENT_URL=https://your-username.github.io/MMoMon
flyctl secrets set FIREBASE_SERVICE_ACCOUNT="$(cat firebase-service-account.json | base64)"
flyctl deploy
```

### Cliente (GitHub Pages)

1. Configure secrets no GitHub Actions:
   - `VITE_WS_URL`, `VITE_SERVER_URL`
   - Todas as variáveis `VITE_FIREBASE_*`

2. Push para `main` - deploy automático via GitHub Actions

3. Configure Firebase:
   - Adicione domínio `your-username.github.io` em **Authentication > Authorized domains**
   - Publique regras do Firestore

## 🛠️ Tecnologias

- **Frontend**: TypeScript, Phaser 3, Vite
- **Backend**: Node.js, TypeScript, WebSocket (ws), Express
- **Persistência**: Firebase Firestore, localStorage (fallback)

## 📝 Scripts

**Cliente:**
- `npm run dev` - Desenvolvimento
- `npm run build` - Build para produção

**Servidor:**
- `npm run dev` - Desenvolvimento (com hot reload)
- `npm run build` - Compilar TypeScript
- `npm start` - Produção

## 🐛 Troubleshooting

**Erro de CORS:**
- Verifique `CLIENT_URL` no servidor
- Adicione domínio em `ALLOWED_ORIGINS` se necessário

**Firebase não conecta:**
- Verifique `firebase-service-account.json` no servidor
- Verifique `firebaseConfig.ts` no cliente
- Verifique regras do Firestore publicadas

**WebSocket não conecta:**
- Verifique se servidor está rodando
- Verifique URL em `.env` (use `ws://` para local, `wss://` para produção)

## 📚 Documentação Adicional

- `memory-bank/` - Documentação detalhada do projeto
- `ARCHITECTURE.md` - Arquitetura do sistema (se existir)

---

**Status**: Em desenvolvimento ativo
**Versão**: 0.1.0
