# Dockerfile para o servidor do jogo
FROM node:20-alpine

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY tsconfig.json ./

# Instalar todas as dependências (incluindo dev para build)
RUN npm ci

# Copiar código fonte
COPY src ./src

# Build do TypeScript
RUN npm run build

# Expor portas
# 3003: WebSocket
# 3004: HTTP
EXPOSE 3003 3004

# Variáveis de ambiente padrão
ENV PORT=3003
ENV HTTP_PORT=3004
ENV NODE_ENV=production

# Comando para iniciar o servidor
CMD ["node", "dist/index.js"]
