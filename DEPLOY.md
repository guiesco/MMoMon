# Guia de Deploy

Este guia explica como fazer deploy do jogo MMoMon no GitHub Pages (cliente) e Fly.io (servidor).

## 📋 Pré-requisitos

1. **GitHub**: Conta no GitHub com repositório configurado
2. **Fly.io**: Conta no [Fly.io](https://fly.io) e CLI instalada
3. **Firebase**: Projeto Firebase configurado (já configurado)

## 🚀 Deploy do Servidor (Fly.io)

### 1. Instalar Fly.io CLI

```bash
# macOS
curl -L https://fly.io/install.sh | sh

# Ou via Homebrew
brew install flyctl
```

### 2. Fazer login no Fly.io

```bash
flyctl auth login
```

### 3. Configurar o app no Fly.io

```bash
cd server
flyctl launch
```

Durante o setup:
- **App name**: Escolha um nome único (ex: `mmomon-server`)
- **Region**: Escolha a região mais próxima (ex: `gru` para São Paulo)
- **Postgres/Redis**: Não é necessário, pressione Enter
- **Deploy now**: Não, vamos configurar primeiro

### 4. Configurar variáveis de ambiente

Edite o arquivo `server/fly.toml` e ajuste:
- `app`: Nome do seu app
- `primary_region`: Região escolhida

Configure as variáveis de ambiente no Fly.io:

```bash
# URL do cliente (GitHub Pages)
flyctl secrets set CLIENT_URL=https://guiesco.github.io/MMoMon

# Origens permitidas adicionais (se necessário)
flyctl secrets set ALLOWED_ORIGINS=https://meusite.com
```

### 5. Configurar Firebase Service Account

O servidor precisa das credenciais do Firebase. O código já está configurado para ler de um secret do Fly.io (recomendado) ou de um arquivo local (desenvolvimento).

**Configurar secret no Fly.io (Recomendado para produção):**

```bash
# Converter o JSON para base64
cat firebase-service-account.json | base64 | pbcopy

# Configurar como secret no Fly.io
flyctl secrets set FIREBASE_SERVICE_ACCOUNT="<cole o base64 aqui>"
```

O código automaticamente:
1. Primeiro tenta ler do secret `FIREBASE_SERVICE_ACCOUNT` (produção)
2. Se não encontrar, tenta ler do arquivo `firebase-service-account.json` (desenvolvimento)

⚠️ **Atenção**: Não commite o arquivo `firebase-service-account.json` no Git!

### 6. Fazer deploy

```bash
flyctl deploy
```

### 7. Verificar o deploy

```bash
# Ver logs
flyctl logs

# Verificar health check
flyctl status
curl https://YOUR_APP_NAME.fly.dev/health
```

### 8. Obter URLs do servidor

Após o deploy, você terá:
- **HTTP**: `https://YOUR_APP_NAME.fly.dev` (porta 3004)
- **WebSocket**: `wss://YOUR_APP_NAME.fly.dev:443` (porta 3003, exposta como 443)

⚠️ **Importante sobre WebSocket no Fly.io**: 
- O Fly.io expõe o serviço TCP na porta 443 (HTTPS/WSS)
- O cliente deve conectar em `wss://YOUR_APP_NAME.fly.dev:443` para WebSocket
- Ou você pode configurar um proxy reverso para usar o mesmo domínio

**Alternativa**: Para simplificar, você pode fazer o servidor escutar HTTP e WebSocket na mesma porta (3004) e usar upgrade de protocolo. Isso requer mudanças no código do servidor.

## 🌐 Deploy do Cliente (GitHub Pages)

### 1. Habilitar GitHub Pages

1. Vá em **Settings** > **Pages** no seu repositório
2. **Source**: Selecione **GitHub Actions**

### 2. Configurar Secrets do GitHub

Vá em **Settings** > **Secrets and variables** > **Actions** e adicione:

**URLs do Servidor:**
- `VITE_WS_URL`: URL do WebSocket (ex: `wss://mmomon-server.fly.dev:443`)
- `VITE_SERVER_URL`: URL do servidor HTTP (ex: `https://mmomon-server.fly.dev`)

**Firebase Client SDK (obtenha no Firebase Console > Project Settings > General > Your apps > Web app):**
- `VITE_FIREBASE_API_KEY`: API Key do Firebase
- `VITE_FIREBASE_AUTH_DOMAIN`: Auth Domain (ex: `your-project.firebaseapp.com`)
- `VITE_FIREBASE_PROJECT_ID`: Project ID
- `VITE_FIREBASE_STORAGE_BUCKET`: Storage Bucket (ex: `your-project.appspot.com`)
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Messaging Sender ID
- `VITE_FIREBASE_APP_ID`: App ID

### 3. Ajustar base path (se necessário)

Se seu repositório não se chama `MMoMon`, edite `vite.config.mts`:

```typescript
base: process.env.GITHUB_PAGES ? "/SEU_REPO_NAME/" : "/",
```

### 4. Fazer commit e push

O workflow do GitHub Actions irá:
1. Buildar o projeto automaticamente
2. Fazer deploy no GitHub Pages

```bash
git add .
git commit -m "Configurar deploy"
git push origin main
```

### 5. Verificar o deploy

Após alguns minutos, acesse:
- `https://YOUR_USERNAME.github.io/MMoMon`

## 🔧 Configuração Pós-Deploy

### Atualizar CORS no servidor

Após fazer deploy do cliente, atualize o CORS no servidor:

```bash
flyctl secrets set CLIENT_URL=https://YOUR_USERNAME.github.io/MMoMon
flyctl deploy
```

### Verificar conexões

1. Abra o jogo no GitHub Pages
2. Abra o console do navegador (F12)
3. Verifique se não há erros de CORS ou conexão
4. Teste uma expedição multiplayer

## 🐛 Troubleshooting

### Erro de CORS

Se houver erros de CORS:
1. Verifique se `CLIENT_URL` está configurado corretamente no Fly.io
2. Verifique se a URL do cliente no GitHub Pages está correta
3. Adicione URLs adicionais em `ALLOWED_ORIGINS` se necessário

### WebSocket não conecta

1. Verifique se o servidor está rodando: `flyctl status`
2. Verifique os logs: `flyctl logs`
3. Teste a conexão WebSocket manualmente
4. Verifique se a URL está usando `wss://` (não `ws://`)

### Build falha no GitHub Actions

1. Verifique se os secrets estão configurados
2. Verifique os logs do workflow no GitHub
3. Teste o build localmente: `npm run build`

### Firebase não funciona

1. Verifique se `firebase-service-account.json` está configurado no Fly.io
2. Verifique os logs do servidor para erros do Firebase
3. Verifique as permissões do service account no Firebase Console

## 📝 Checklist de Deploy

- [ ] Servidor deployado no Fly.io
- [ ] Health check do servidor funcionando
- [ ] Firebase configurado no servidor
- [ ] CORS configurado com URL do cliente
- [ ] Secrets do GitHub configurados (VITE_WS_URL, VITE_SERVER_URL)
- [ ] GitHub Pages habilitado
- [ ] Workflow do GitHub Actions executado com sucesso
- [ ] Cliente acessível no GitHub Pages
- [ ] Conexão WebSocket funcionando
- [ ] Teste de expedição multiplayer funcionando

## 🔄 Atualizações Futuras

Para atualizar o servidor:
```bash
cd server
flyctl deploy
```

Para atualizar o cliente:
```bash
git push origin main
# O GitHub Actions fará o deploy automaticamente
```
