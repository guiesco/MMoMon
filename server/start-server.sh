#!/bin/bash

# Script para iniciar o servidor Node.js
# 
# Pré-requisitos:
# 1. Node.js instalado
# 2. Dependências instaladas (npm install)
# 3. Build feito (npm run build)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado"
    exit 1
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Verificar se o build existe
if [ ! -d "dist" ] || [ "dist/index.js" -ot "src/index.ts" ]; then
    echo "🔨 Fazendo build do TypeScript..."
    npm run build
fi

# Verificar se o Firebase está configurado
if [ ! -f "firebase-service-account.json" ]; then
    echo "⚠️  firebase-service-account.json não encontrado"
    echo "💡 O servidor funcionará sem Firebase (dados não serão persistidos)"
fi

# Carregar variáveis de ambiente se .env existir
if [ -f ".env" ]; then
    echo "📝 Carregando variáveis de ambiente de .env"
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "🚀 Iniciando servidor..."
echo "📡 WebSocket: porta ${PORT:-3003}"
echo "🌐 HTTP: porta ${HTTP_PORT:-3004}"
echo ""

npm start
