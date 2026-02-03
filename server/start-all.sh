#!/bin/bash

# Script para iniciar tanto o servidor quanto o tunnel
# 
# Este script inicia o servidor em background e depois inicia o tunnel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Função para limpar processos ao sair
cleanup() {
    echo ""
    echo "🛑 Parando processos..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
        echo "✅ Servidor parado"
    fi
    if [ ! -z "$TUNNEL_PID" ]; then
        kill $TUNNEL_PID 2>/dev/null || true
        echo "✅ Tunnel parado"
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "🚀 Iniciando servidor e tunnel..."
echo ""

# Iniciar servidor em background
echo "📦 Iniciando servidor..."
./start-server.sh &
SERVER_PID=$!

# Aguardar servidor iniciar
echo "⏳ Aguardando servidor iniciar..."
sleep 3

# Verificar se o servidor está rodando
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Servidor não iniciou corretamente"
    exit 1
fi

echo "✅ Servidor iniciado (PID: $SERVER_PID)"
echo ""

# Iniciar tunnel
echo "🚇 Iniciando Cloudflare Tunnel..."
./start-tunnel.sh &
TUNNEL_PID=$!

echo "✅ Tunnel iniciado (PID: $TUNNEL_PID)"
echo ""
echo "🎮 Servidor e tunnel rodando!"
echo "📝 Pressione Ctrl+C para parar ambos"
echo ""

# Aguardar indefinidamente
wait
