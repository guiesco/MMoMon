# 🔧 Configuração de Variáveis de Ambiente

## Para Desenvolvimento Local

Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
# URL do servidor WebSocket (Fly.io)
VITE_WS_URL=wss://mmomon-server.fly.dev:443

# URL do servidor HTTP (Fly.io)
VITE_SERVER_URL=https://mmomon-server.fly.dev

# Firebase Client SDK Credentials
VITE_FIREBASE_API_KEY=AIzaSyCjcYbMaF9PmLh-KmdLn_vScX1pKSpU_-g
VITE_FIREBASE_AUTH_DOMAIN=studio-5526457853-5d7ff.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=studio-5526457853-5d7ff
VITE_FIREBASE_STORAGE_BUCKET=studio-5526457853-5d7ff.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=151660580885
VITE_FIREBASE_APP_ID=1:151660580885:web:4e45cd1801d5ffe3a6fe1c
```

⚠️ **Importante**: O arquivo `.env` está no `.gitignore` e não será commitado.

## Para Produção (GitHub Pages)

Siga o guia em `UPDATE_GITHUB_SECRETS.md` para atualizar os secrets no GitHub.

## Criar o arquivo .env

No terminal, na raiz do projeto:

```bash
cat > .env << 'EOF'
# URL do servidor WebSocket (Fly.io)
VITE_WS_URL=wss://mmomon-server.fly.dev:443

# URL do servidor HTTP (Fly.io)
VITE_SERVER_URL=https://mmomon-server.fly.dev

# Firebase Client SDK Credentials
VITE_FIREBASE_API_KEY=AIzaSyCjcYbMaF9PmLh-KmdLn_vScX1pKSpU_-g
VITE_FIREBASE_AUTH_DOMAIN=studio-5526457853-5d7ff.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=studio-5526457853-5d7ff
VITE_FIREBASE_STORAGE_BUCKET=studio-5526457853-5d7ff.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=151660580885
VITE_FIREBASE_APP_ID=1:151660580885:web:4e45cd1801d5ffe3a6fe1c
EOF
```

Ou crie manualmente o arquivo `.env` na raiz do projeto e cole o conteúdo acima.
