# Servidor MMoMon

Servidor Node.js para o jogo MMoMon, rodando localmente e exposto via Cloudflare Tunnel.

## 🚀 Início Rápido

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Firebase

Coloque o arquivo `firebase-service-account.json` na pasta `server/`.

📖 **Guia completo**: Consulte o README principal em `../README.md`

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env`:

```bash
PORT=3003
HTTP_PORT=3004
CLIENT_URL=https://seu-usuario.github.io/MMoMon
ALLOWED_ORIGINS=https://seu-usuario.github.io/MMoMon,http://localhost:5173
```

### 4. Build e Iniciar

```bash
npm run build
npm start
```

## 📡 Portas

- **3003**: WebSocket (multiplayer)
- **3004**: HTTP (API REST)

## 🌐 Expor Publicamente

Para produção, use **Fly.io** (recomendado) ou **Cloudflare Tunnel** (desenvolvimento).

**Fly.io** (Produção):
```bash
flyctl launch
flyctl deploy
```

**Cloudflare Tunnel** (Desenvolvimento):
1. Instale: `brew install cloudflared`
2. Configure: `cloudflare-config.yml`
3. Execute: `./start-all.sh`

## 📜 Scripts Disponíveis

- `npm run dev` - Inicia em modo desenvolvimento (com hot reload)
- `npm run build` - Compila TypeScript para JavaScript
- `npm start` - Inicia o servidor em produção
- `npm run typecheck` - Verifica tipos sem compilar

### Scripts Shell

- `./start-server.sh` - Inicia apenas o servidor
- `./start-tunnel.sh` - Inicia apenas o Cloudflare Tunnel
- `./start-all.sh` - Inicia servidor e tunnel juntos

## 🔧 Estrutura do Projeto

```
server/
├── src/
│   ├── index.ts              # Ponto de entrada (WebSocket)
│   ├── httpServer.ts         # Servidor HTTP (API REST)
│   ├── firebase.ts           # Configuração do Firebase
│   ├── gameLoop.ts           # Loop principal do jogo
│   ├── systems/              # Sistemas do jogo (combate, captura, etc)
│   ├── handlers/             # Handlers de eventos
│   ├── managers/             # Gerenciadores (rooms, game loop)
│   └── ...
├── dist/                     # Código compilado (gerado)
├── cloudflare-config.yml     # Configuração do Cloudflare Tunnel
└── package.json
```

## 🐛 Troubleshooting

### Porta já em uso

```bash
# Verificar o que está usando a porta
lsof -i :3003
lsof -i :3004

# Matar o processo se necessário
kill -9 <PID>
```

### Firebase não funciona

1. Verifique se `firebase-service-account.json` existe
2. Verifique os logs do servidor
3. Consulte o README principal em `../README.md`

### CORS errors

1. Verifique se `CLIENT_URL` está correto no `.env`
2. Verifique se a origem está em `ALLOWED_ORIGINS`
3. Reinicie o servidor após alterar variáveis

## 📚 Documentação Adicional

- [README Principal](../README.md) - Setup completo e configuração
- [Arquitetura](../ARCHITECTURE.md) - Arquitetura do sistema

## 🔐 Segurança

- **NUNCA** commite `firebase-service-account.json`
- **NUNCA** commite `.env`
- Mantenha as credenciais seguras
- Configure CORS adequadamente

## 📝 Notas

- O servidor roda localmente na sua máquina
- Cloudflare Tunnel expõe o servidor publicamente sem expor seu IP
- O servidor funciona sem Firebase, mas dados não serão persistidos
- Para desenvolvimento, adicione `http://localhost:5173` em `ALLOWED_ORIGINS`
