# Variáveis de Ambiente

## Cliente (Frontend)

Crie um arquivo `.env` na raiz do projeto com:

```env
# URL do servidor WebSocket (Fly.io)
# Exemplo: wss://mmomon-server.fly.dev:443
VITE_WS_URL=wss://YOUR_APP_NAME.fly.dev:443

# URL do servidor HTTP (Fly.io)
# Exemplo: https://mmomon-server.fly.dev
VITE_SERVER_URL=https://YOUR_APP_NAME.fly.dev

# Firebase Client SDK Credentials
# Obtenha essas credenciais no Firebase Console > Project Settings > General > Your apps > Web app
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Para produção (GitHub Pages)**: Configure todas essas variáveis como secrets no GitHub Actions (Settings > Secrets and variables > Actions):
- `VITE_WS_URL`
- `VITE_SERVER_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Servidor (Backend)

Crie um arquivo `.env` na pasta `server/` com:

```env
# Porta do servidor WebSocket
PORT=3003

# Porta do servidor HTTP
HTTP_PORT=3004

# URL do cliente (para CORS)
# Exemplo: https://YOUR_USERNAME.github.io/MMoMon
CLIENT_URL=https://YOUR_USERNAME.github.io/MMoMon

# Origens permitidas adicionais (separadas por vírgula)
# Exemplo: https://meusite.com,https://www.meusite.com
ALLOWED_ORIGINS=
```

**Para produção (Fly.io)**: Configure essas variáveis usando `flyctl secrets set`:

```bash
flyctl secrets set CLIENT_URL=https://YOUR_USERNAME.github.io/MMoMon
flyctl secrets set ALLOWED_ORIGINS=https://meusite.com
```

## Firebase

O servidor precisa do arquivo `firebase-service-account.json` na pasta `server/`.

**Para produção (Fly.io)**: 
- Opção 1: Incluir no Dockerfile (menos seguro)
- Opção 2: Usar secrets do Fly.io (recomendado)

Veja o arquivo `DEPLOY.md` para instruções detalhadas.
