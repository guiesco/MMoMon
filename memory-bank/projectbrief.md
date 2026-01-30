# PokéExtract: Wild Expedition – Project Brief

## Visão Geral
- **Título**: PokéExtract: Wild Expedition  
- **Descrição**: Jogo multiplayer de extração em browser onde jogadores exploram mapas top-down, capturam criaturas, coletam recursos e enfrentam outros jogadores em combate de ação em tempo real. O foco é o risco x recompensa: só leva progresso quem extrai com sucesso.
- **Plataforma alvo**: Browser (HTML5 + WebSockets)  
- **Arquitetura multiplayer**: Servidor dedicado com salas de até 12 jogadores.

## Core Loop
1. Entrar em expedições (sala/partida)
2. Explorar o mapa
3. Encontrar criaturas e materiais
4. Capturar/Coletar
5. Enfrentar outros jogadores (PvP sempre ligado)
6. Chegar em pontos de extração e extrair
7. Usar recursos/criaturas extraídos para melhorar base e equipamentos

## Escopo do MVP
- 1 mapa de expedição funcional (versão reduzida de “Floresta Celestial”).
- Partidas com até 8–12 jogadores.
- Movimentação e combate simples em tempo real (básico + 1 habilidade).
- Sistema básico de criaturas (alguns tipos, poucos stats chave).
- Captura simplificada com 1–2 tipos de pokébolas.
- Coleta de 2–3 tipos de recursos.
- 1 ciclo de extração funcional (entrar → jogar → extrair → voltar para base).
- Base persistente mínima: lista de criaturas, alguns recursos, e crafting simples de pokébolas.

## Fora de Escopo (por enquanto)
- Todos os mapas completos (Cavernas Cristalinas, Ruínas Antigas, Pântano Sombrio).
- Sistema completo de guildas, mercado avançado, sistema de apostas de criaturas raras.
- Árvore de progressão profunda de base e todas as tiers de itens.
- Sistema de evolução complexo com múltiplas condições especiais de mapa (ficará para pós-MVP).

