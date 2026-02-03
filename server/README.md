# Servidor MMoMon

Servidor Node.js para o jogo MMoMon, rodando localmente e exposto via Cloudflare Tunnel.

## 🚀 Início Rápido

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Firebase

Coloque o arquivo `firebase-service-account.json` na pasta `server/`.

📖 **Guia completo**: Consulte **[../FIREBASE_SERVER_SETUP.md](../FIREBASE_SERVER_SETUP.md)**

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

## 🌐 Expor Publicamente com Cloudflare Tunnel

Para expor o servidor publicamente sem expor seu IP:

📖 **Guia completo**: Consulte **[../CLOUDFLARE_TUNNEL_SETUP.md](../CLOUDFLARE_TUNNEL_SETUP.md)**

### Resumo Rápido

1. Instalar Cloudflare Tunnel:
   ```bash
   brew install cloudflared
   ```

2. Criar tunnel:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create mmomon-server
   ```

3. Configurar:
   - Copie `cloudflare-config.yml.example` para `cloudflare-config.yml`
   - Edite com o ID do seu tunnel e subdomínios

4. Iniciar tudo:
   ```bash
   ./start-all.sh
   ```

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
3. Consulte [FIREBASE_SERVER_SETUP.md](../FIREBASE_SERVER_SETUP.md)

### CORS errors

1. Verifique se `CLIENT_URL` está correto no `.env`
2. Verifique se a origem está em `ALLOWED_ORIGINS`
3. Reinicie o servidor após alterar variáveis

## 📚 Documentação Adicional

- [Guia de Deploy](../DEPLOY.md)
- [Configuração do Cloudflare Tunnel](../CLOUDFLARE_TUNNEL_SETUP.md)
- [Configuração do Firebase](../FIREBASE_SERVER_SETUP.md)
- [Variáveis de Ambiente](../ENV_VARIABLES.md)

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
