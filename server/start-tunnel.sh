#!/bin/bash

# Script para iniciar o Cloudflare Tunnel
# 
# Pré-requisitos:
# 1. cloudflared instalado
# 2. Tunnel criado e configurado
# 3. Arquivo cloudflare-config.yml configurado

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Verificar se cloudflared está instalado
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared não está instalado"
    echo "📦 Instale com: brew install cloudflared (macOS) ou visite https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    exit 1
fi

# Verificar se o arquivo de configuração existe
if [ ! -f "cloudflare-config.yml" ]; then
    echo "❌ Arquivo cloudflare-config.yml não encontrado"
    echo "📝 Copie cloudflare-config.yml.example para cloudflare-config.yml e configure"
    exit 1
fi

# Verificar se o servidor está rodando
if ! lsof -Pi :3003 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Servidor WebSocket não está rodando na porta 3003"
    echo "💡 Inicie o servidor primeiro com: npm start"
    echo ""
    read -p "Deseja continuar mesmo assim? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

if ! lsof -Pi :3004 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "⚠️  Servidor HTTP não está rodando na porta 3004"
    echo "💡 Inicie o servidor primeiro com: npm start"
    echo ""
    read -p "Deseja continuar mesmo assim? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "🚇 Iniciando Cloudflare Tunnel..."
echo "📋 Configuração: cloudflare-config.yml"
echo ""

# Ler o nome do tunnel do arquivo de configuração
TUNNEL_NAME=$(grep -E "^tunnel:" cloudflare-config.yml | head -1 | awk '{print $2}' | tr -d '\r')

if [ -z "$TUNNEL_NAME" ]; then
    echo "⚠️  Não foi possível detectar o nome do tunnel do arquivo de configuração"
    echo "💡 Usando modo automático..."
    cloudflared tunnel --config cloudflare-config.yml run
else
    echo "🔗 Tunnel: $TUNNEL_NAME"
    cloudflared tunnel --config cloudflare-config.yml run "$TUNNEL_NAME"
fi
