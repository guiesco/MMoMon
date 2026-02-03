# Plano de Melhorias e Correções - PokéExtract: Wild Expedition

Este documento contém o plano detalhado de implementação para todas as melhorias e correções solicitadas. Cada item está separado em uma implementação independente que pode ser executada por um agente diferente.

---

## 📋 Índice

1. [Extração Individual por Player](#1-extração-individual-por-player)
2. [Remover Range de Captura](#2-remover-range-de-captura)
3. [Corrigir Mensagem de Capturado](#3-corrigir-mensagem-de-capturado)
4. [Corrigir HP Máximo de Criaturas Upadas](#4-corrigir-hp-máximo-de-criaturas-upadas)
5. [Navegação com Mouse nos Menus](#5-navegação-com-mouse-nos-menus)
6. [Adicionar Sistema PvP](#6-adicionar-sistema-pvp)
7. [Drop de Itens ao Morrer](#7-drop-de-itens-ao-morrer)
8. [Requisições Firebase ao Abrir Inventário](#8-requisições-firebase-ao-abrir-inventário)
9. [Sync Player ao Entrar e Sair do Inventário](#9-sync-player-ao-entrar-e-sair-do-inventário)
10. [Telas de Loading para Requisições Firebase](#10-telas-de-loading-para-requisições-firebase)
11. [Tela de Loading ao Iniciar Servidor](#11-tela-de-loading-ao-iniciar-servidor)
12. [Persistência de Login e Redirecionamento Automático](#12-persistência-de-login-e-redirecionamento-automático)
13. [Logout e Limpeza de Dados Locais](#13-logout-e-limpeza-de-dados-locais)

---

## 1. Extração Individual por Player

### 📝 Descrição do Problema
Atualmente a extração está sendo considerada por mapa, mas cada player deve extrair individualmente. Isso significa que quando um jogador completa a extração, apenas ele deve receber suas recompensas, sem afetar outros jogadores.

### 🔍 Análise Técnica
O sistema de extração já está implementado de forma individual (`server/src/systems/extraction.ts`), mas pode haver confusão na lógica de recompensas ou na forma como o estado é gerenciado. Precisamos garantir que:
- Cada jogador tem seu próprio progresso de extração
- Recompensas são calculadas individualmente baseadas no inventário de cada jogador
- Um jogador extrair não afeta outros jogadores

### 📁 Arquivos Afetados
- `server/src/systems/extraction.ts` - Lógica de extração
- `server/src/handlers/ExtractionHandler.ts` - Handler de extração
- `server/src/managers/GameLoopManager.ts` - Integração no game loop
- `src/scenes/ExpeditionScene.ts` - UI de extração no cliente
- `src/scenes/expedition/ui/ExtractionUI.ts` - Componente de UI de extração

### ✅ Passos de Implementação
1. Revisar `completeExtraction()` em `extraction.ts` para garantir que calcula recompensas apenas do inventário do jogador específico
2. Verificar que `player.resourcesCollected` e `player.expeditionInventory.capturedCreatures` são mapas individuais por jogador
3. Garantir que o broadcast de extração completa envia mensagem apenas para o jogador que extraiu (ou broadcast geral mas com `playerId` específico)
4. Testar que múltiplos jogadores podem extrair simultaneamente sem interferência
5. Verificar que recursos e criaturas são salvos individualmente no Firebase

### 🤖 Prompt para o Agente

```
Implementar correção para garantir que a extração seja completamente individual por player.

CONTEXTO:
- O sistema de extração já existe em server/src/systems/extraction.ts
- Cada jogador deve extrair independentemente
- Recompensas devem ser calculadas do inventário individual de cada jogador
- Um jogador extrair não deve afetar outros jogadores

TAREFAS:
1. Revisar e corrigir completeExtraction() para garantir que usa apenas dados do jogador específico
2. Verificar que player.resourcesCollected e player.expeditionInventory são individuais
3. Garantir que broadcasts de extração são específicos por jogador
4. Testar extração simultânea de múltiplos jogadores
5. Verificar persistência individual no Firebase

ARQUIVOS PRINCIPAIS:
- server/src/systems/extraction.ts
- server/src/handlers/ExtractionHandler.ts
- server/src/managers/GameLoopManager.ts

Validar que não há compartilhamento de estado entre jogadores durante a extração.
```

---

## 2. Remover Range de Captura

### 📝 Descrição do Problema
Atualmente é necessário chegar muito perto para capturar, e se não estiver no range dá erro "out of range". Vamos desligar por enquanto o range da pokébola, deixando capturar de qualquer distância.

### 🔍 Análise Técnica
O range de captura está definido em `server/src/constants.ts` como `CAPTURE_CONFIG.maxCaptureDistance: 150`. A validação ocorre em `server/src/systems/capture.ts` na função `processCaptureIntent()` e `validateCaptureIntent()`. Precisamos:
- Remover ou aumentar significativamente o `maxCaptureDistance`
- Remover a validação de distância no código de captura
- Manter outras validações (pokébola disponível, criatura viva, etc.)

### 📁 Arquivos Afetados
- `server/src/constants.ts` - Configuração de `maxCaptureDistance`
- `server/src/systems/capture.ts` - Validação de distância em `processCaptureIntent()` e `validateCaptureIntent()`

### ✅ Passos de Implementação
1. Modificar `CAPTURE_CONFIG.maxCaptureDistance` para um valor muito alto (ex: 999999) ou adicionar flag para desabilitar
2. Comentar ou remover a validação de distância em `processCaptureIntent()` (linha ~228)
3. Comentar ou remover a validação de distância em `validateCaptureIntent()` (linha ~336)
4. Remover o `failReason: "out_of_range"` ou mantê-lo apenas para casos futuros
5. Testar captura de longa distância

### 🤖 Prompt para o Agente

```
Remover a validação de range de captura para permitir capturar criaturas de qualquer distância.

CONTEXTO:
- Range atual: 150 pixels (CAPTURE_CONFIG.maxCaptureDistance)
- Validação ocorre em server/src/systems/capture.ts
- Erro "out_of_range" aparece quando jogador está longe

TAREFAS:
1. Modificar CAPTURE_CONFIG.maxCaptureDistance para valor muito alto (999999) ou adicionar flag para desabilitar
2. Remover/comentar validação de distância em processCaptureIntent() (linha ~228)
3. Remover/comentar validação de distância em validateCaptureIntent() (linha ~336)
4. Manter outras validações (pokébola disponível, criatura viva)
5. Testar captura de longa distância

ARQUIVOS PRINCIPAIS:
- server/src/constants.ts
- server/src/systems/capture.ts

NOTA: Esta é uma mudança temporária. Manter estrutura para reativar range no futuro se necessário.
```

---

## 3. Corrigir Mensagem de Capturado

### 📝 Descrição do Problema
A mensagem de "capturado" nunca aparece, apenas "capturando...". O feedback visual de sucesso não está sendo exibido corretamente.

### 🔍 Análise Técnica
O problema pode estar em:
1. O servidor não está enviando a mensagem de sucesso corretamente
2. O cliente não está processando o resultado de captura corretamente
3. A mensagem "Capturando..." é exibida antes do resultado, mas a mensagem de sucesso não aparece

Arquivos relevantes:
- `server/src/managers/GameLoopManager.ts` - `handleCaptureResult()` envia `capture_result`
- `src/scenes/ExpeditionScene.ts` - `handleCaptureResult()` processa resultado
- `src/scenes/expedition/managers/ProjectileManager.ts` - Exibe "Capturando..." quando pokébola atinge

### 📁 Arquivos Afetados
- `src/scenes/ExpeditionScene.ts` - Handler `handleCaptureResult()`
- `src/scenes/expedition/managers/ProjectileManager.ts` - Feedback visual de captura
- `src/scenes/expedition/ui/FeedbackManager.ts` - Gerenciamento de feedback visual
- `server/src/managers/GameLoopManager.ts` - Broadcast de resultado de captura

### ✅ Passos de Implementação
1. Verificar que `handleCaptureResult()` em `ExpeditionScene.ts` está sendo chamado quando `result.success === true`
2. Garantir que a mensagem "✅ CAPTURADO!" está sendo exibida (linha ~5162)
3. Verificar timing: "Capturando..." deve aparecer primeiro, depois "CAPTURADO!" quando resultado chega
4. Adicionar delay ou garantir que mensagem de sucesso substitui/sobrescreve "Capturando..."
5. Testar fluxo completo: pokébola → "Capturando..." → resultado servidor → "CAPTURADO!"

### 🤖 Prompt para o Agente

```
Corrigir exibição da mensagem de captura bem-sucedida. Atualmente apenas "Capturando..." aparece, mas "CAPTURADO!" nunca é exibido.

CONTEXTO:
- Mensagem "Capturando..." aparece quando pokébola atinge criatura (ProjectileManager)
- Mensagem "CAPTURADO!" deveria aparecer quando servidor confirma sucesso
- Fluxo: pokébola atinge → "Capturando..." → servidor processa → "CAPTURADO!" (se sucesso)

TAREFAS:
1. Verificar handleCaptureResult() em ExpeditionScene.ts está processando result.success === true
2. Garantir que mensagem "✅ CAPTURADO!" é exibida quando result.success === true (linha ~5162)
3. Verificar timing: mensagem de sucesso deve aparecer após "Capturando..."
4. Adicionar feedback visual claro de sucesso (FeedbackManager.createCaptureSuccessFeedback)
5. Testar fluxo completo de captura bem-sucedida

ARQUIVOS PRINCIPAIS:
- src/scenes/ExpeditionScene.ts (handleCaptureResult)
- src/scenes/expedition/managers/ProjectileManager.ts (sendCaptureAttempt)
- src/scenes/expedition/ui/FeedbackManager.ts (createCaptureSuccessFeedback)

Garantir que ambas as mensagens aparecem na sequência correta.
```

---

## 4. Corrigir HP Máximo de Criaturas Upadas

### 📝 Descrição do Problema
Ao entrar no jogo e ter uma criatura upada/melhorada, o HP conta mais que o máximo (ex: 120 de 100). Ao gerenciar equipe o mesmo comportamento acontece. O problema é que `currentHp` está maior que `maxHp` após upgrades.

### 🔍 Análise Técnica
O problema está relacionado a:
1. Quando uma criatura sobe de nível, o `maxHp` aumenta, mas `currentHp` pode não ser ajustado corretamente
2. Ao carregar criaturas do estado salvo, `currentHp` pode estar desatualizado
3. `getEffectiveStats()` calcula o novo `maxHp` baseado em level/rank, mas `currentHp` não é atualizado proporcionalmente

Arquivos relevantes:
- `src/game/creatureProgression.ts` - `getEffectiveStats()` calcula stats efetivos
- `src/game/playerState.ts` - `addCreatureXp()` atualiza level e HP
- `src/scenes/ExpeditionScene.ts` - Inicialização de HP ao entrar na expedição
- `src/scenes/TeamManagementScene.ts` - Exibição de HP no gerenciamento de equipe

### 📁 Arquivos Afetados
- `src/game/creatureProgression.ts` - Cálculo de stats efetivos
- `src/game/playerState.ts` - Atualização de HP ao subir de nível
- `src/scenes/ExpeditionScene.ts` - Inicialização de `activeCreatureHp` e `activeCreatureMaxHp`
- `src/scenes/TeamManagementScene.ts` - Exibição de HP das criaturas
- `src/scenes/CreatureUpgradeScene.ts` - Exibição de HP na tela de upgrade

### ✅ Passos de Implementação
1. Em `addCreatureXp()` em `playerState.ts`, garantir que ao subir de nível, `currentHp` é ajustado proporcionalmente ao novo `maxHp`
2. Ao inicializar criatura na expedição, garantir que `activeCreatureHp` não excede `activeCreatureMaxHp`
3. Adicionar função helper para normalizar HP: `currentHp = Math.min(currentHp, maxHp)`
4. Aplicar normalização ao carregar criaturas do estado salvo
5. Garantir que exibição de HP sempre mostra valores válidos (currentHp <= maxHp)

### 🤖 Prompt para o Agente

```
Corrigir bug onde criaturas upadas/melhoradas mostram HP atual maior que HP máximo (ex: 120/100).

CONTEXTO:
- Ao subir de nível, maxHp aumenta mas currentHp pode ficar desatualizado
- Ao carregar criaturas do estado, currentHp pode estar maior que maxHp
- Problema aparece ao entrar no jogo e ao gerenciar equipe

TAREFAS:
1. Em addCreatureXp() (playerState.ts), ajustar currentHp proporcionalmente ao novo maxHp ao subir de nível
2. Adicionar normalização: currentHp = Math.min(currentHp, getEffectiveStats().hp) após level up
3. Ao inicializar criatura na expedição, garantir activeCreatureHp <= activeCreatureMaxHp
4. Criar função helper normalizeCreatureHp() que garante currentHp <= maxHp
5. Aplicar normalização ao carregar criaturas do estado salvo
6. Garantir que todas as exibições de HP validam currentHp <= maxHp

ARQUIVOS PRINCIPAIS:
- src/game/playerState.ts (addCreatureXp)
- src/game/creatureProgression.ts (getEffectiveStats)
- src/scenes/ExpeditionScene.ts (inicialização de HP)
- src/scenes/TeamManagementScene.ts (exibição de HP)

Validar que HP sempre está dentro do range válido (0 <= currentHp <= maxHp).
```

---

## 5. Navegação com Mouse nos Menus

### 📝 Descrição do Problema
Atualmente os menus só podem ser navegados com teclado (setas, Enter). Vamos permitir navegação com o mouse também.

### 🔍 Análise Técnica
Os menus principais usam Phaser e atualmente só têm handlers de teclado:
- `BaseHubScene.ts` - Menu principal (setas, Enter)
- `CraftingScene.ts` - Menu de crafting (setas, Enter)
- `InventoryScene.ts` - Menu de inventário
- `TeamManagementScene.ts` - Gerenciamento de equipe
- `CreatureUpgradeScene.ts` - Upgrade de criaturas

Precisamos adicionar:
- Detecção de hover do mouse sobre opções
- Clique do mouse para selecionar
- Feedback visual de hover

### 📁 Arquivos Afetados
- `src/scenes/BaseHubScene.ts` - Menu principal
- `src/scenes/CraftingScene.ts` - Menu de crafting
- `src/scenes/InventoryScene.ts` - Menu de inventário
- `src/scenes/TeamManagementScene.ts` - Gerenciamento de equipe
- `src/scenes/CreatureUpgradeScene.ts` - Upgrade de criaturas

### ✅ Passos de Implementação
1. Converter textos de menu em objetos interativos (Phaser GameObjects com `setInteractive()`)
2. Adicionar handlers de `pointerover` para destacar opção no hover
3. Adicionar handlers de `pointerout` para remover destaque
4. Adicionar handlers de `pointerdown` ou `pointerup` para confirmar seleção
5. Manter compatibilidade com navegação por teclado
6. Adicionar feedback visual claro (mudança de cor, escala, etc.)

### 🤖 Prompt para o Agente

```
Adicionar suporte para navegação com mouse em todos os menus do jogo.

CONTEXTO:
- Atualmente menus só funcionam com teclado (setas, Enter)
- Menus principais: BaseHubScene, CraftingScene, InventoryScene, TeamManagementScene, CreatureUpgradeScene
- Usar Phaser para detectar interações de mouse

TAREFAS:
1. Converter textos de menu em objetos interativos (setInteractive())
2. Adicionar handler pointerover para destacar opção no hover
3. Adicionar handler pointerout para remover destaque
4. Adicionar handler pointerdown/pointerup para confirmar seleção (equivalente a Enter)
5. Manter compatibilidade com navegação por teclado existente
6. Adicionar feedback visual claro (mudança de cor, escala, cursor pointer)

ARQUIVOS PRINCIPAIS:
- src/scenes/BaseHubScene.ts
- src/scenes/CraftingScene.ts
- src/scenes/InventoryScene.ts
- src/scenes/TeamManagementScene.ts
- src/scenes/CreatureUpgradeScene.ts

Garantir que mouse e teclado funcionam de forma equivalente e intuitiva.
```

---

## 6. Adicionar Sistema PvP

### 📝 Descrição do Problema
Adicionar sistema de PvP (Player vs Player) onde jogadores podem atacar uns aos outros durante a expedição.

### 🔍 Análise Técnica
O sistema de combate já existe para jogadores vs criaturas. Precisamos:
1. Permitir que projéteis de jogadores colidam com outros jogadores
2. Aplicar dano de jogador para jogador (não apenas criatura → jogador)
3. Adicionar validação para evitar friendly fire (ou permitir, dependendo do design)
4. Broadcast de dano PvP para todos os clientes
5. Sistema de morte por PvP (jogador mata outro jogador)

Arquivos relevantes:
- `server/src/systems/combat.ts` - Sistema de combate
- `server/src/gameLoop.ts` - Game loop que processa colisões
- `server/src/managers/GameLoopManager.ts` - Handlers de dano e morte

### 📁 Arquivos Afetados
- `server/src/systems/combat.ts` - Adicionar detecção de colisão projétil-jogador
- `server/src/gameLoop.ts` - Processar colisões PvP no updateWorld()
- `server/src/managers/GameLoopManager.ts` - Handler de morte por PvP
- `server/src/messages.ts` - Mensagens de dano PvP (pode reutilizar attack_result)
- `src/scenes/ExpeditionScene.ts` - Feedback visual de dano PvP recebido
- `src/scenes/expedition/managers/ProjectileManager.ts` - Renderização de projéteis PvP

### ✅ Passos de Implementação
1. Em `updateProjectiles()` em `combat.ts`, adicionar verificação de colisão entre projéteis de jogadores e outros jogadores
2. Criar função `checkProjectilePlayerCollision()` se não existir (já existe, verificar se funciona para PvP)
3. Aplicar dano usando `applyDamageToPlayer()` quando projétil de jogador atinge outro jogador
4. Garantir que projéteis não colidem com o próprio criador
5. Broadcast `attack_result` com `targetId` sendo outro jogador
6. Adicionar feedback visual no cliente quando jogador recebe dano de outro jogador
7. Testar que morte por PvP funciona corretamente

### 🤖 Prompt para o Agente

```
Implementar sistema PvP (Player vs Player) onde jogadores podem atacar uns aos outros durante expedições.

CONTEXTO:
- Sistema de combate já existe (jogador vs criaturas)
- Projéteis de jogadores devem poder colidir com outros jogadores
- Dano deve ser aplicado usando sistema existente
- Morte por PvP deve funcionar igual morte por criatura

TAREFAS:
1. Em updateProjectiles() (combat.ts), adicionar verificação de colisão projétil-jogador (PvP)
2. Garantir que projéteis não colidem com o próprio criador (attackerId !== targetId)
3. Aplicar dano usando applyDamageToPlayer() quando projétil atinge outro jogador
4. Broadcast attack_result com targetId sendo outro jogador (não criatura)
5. Adicionar feedback visual no cliente quando recebe dano de outro jogador
6. Garantir que morte por PvP chama onPlayerDeath com killedBy sendo outro playerId
7. Testar PvP: dois jogadores podem se atacar e se matar

ARQUIVOS PRINCIPAIS:
- server/src/systems/combat.ts (updateProjectiles, checkProjectilePlayerCollision)
- server/src/gameLoop.ts (processamento de colisões)
- server/src/managers/GameLoopManager.ts (handlePlayerDeath)
- src/scenes/ExpeditionScene.ts (feedback visual de dano)

NOTA: PvP deve estar sempre ativo (não há opção de desativar). Todos podem atacar todos.
```

---

## 7. Drop de Itens ao Morrer

### 📝 Descrição do Problema
Quando um player morre, ele deve deixar todos os itens que pegou na run "caírem", reespawnando os itens na posição em que ele morreu.

### 🔍 Análise Técnica
Atualmente quando um jogador morre:
- `handlePlayerDeath()` em `GameLoopManager.ts` salva itens gastos no Firebase
- Mas não há sistema de drop de itens coletados na run

Precisamos:
1. Ao morrer, coletar todos os recursos e criaturas capturadas do inventário da expedição
2. Criar resource nodes temporários na posição da morte
3. Criar "loot bags" ou itens soltos que outros jogadores podem coletar
4. Broadcast de itens dropados para todos os clientes
5. Sistema de coleta de itens dropados (similar a coletar recursos normais)

Arquivos relevantes:
- `server/src/managers/GameLoopManager.ts` - `handlePlayerDeath()`
- `server/src/systems/resources.ts` - Sistema de recursos (pode ser estendido)
- `server/src/types.ts` - Tipos de recursos e itens
- `src/scenes/ExpeditionScene.ts` - Renderização de itens dropados

### 📁 Arquivos Afetados
- `server/src/managers/GameLoopManager.ts` - Modificar `handlePlayerDeath()` para dropar itens
- `server/src/systems/resources.ts` - Adicionar função para criar recursos temporários
- `server/src/types.ts` - Adicionar tipo para "dropped items" ou "loot bags"
- `server/src/messages.ts` - Mensagem de itens dropados
- `src/scenes/ExpeditionScene.ts` - Renderização de itens dropados no chão
- `src/scenes/expedition/managers/SpriteManager.ts` - Sprites de itens dropados

### ✅ Passos de Implementação
1. Em `handlePlayerDeath()`, coletar `player.resourcesCollected` e `player.expeditionInventory.capturedCreatures`
2. Criar função `dropPlayerItems()` que cria resource nodes temporários na posição da morte
3. Para recursos: criar resource nodes normais que podem ser coletados
4. Para criaturas capturadas: criar "creature capsules" ou itens especiais que podem ser coletados
5. Adicionar itens dropados ao `room.worldState.resources` (ou criar novo sistema de dropped items)
6. Broadcast mensagem de itens dropados para todos os clientes
7. No cliente, renderizar itens dropados como sprites especiais (diferentes de recursos normais)
8. Permitir coleta de itens dropados (similar a coletar recursos)
9. Remover itens dropados após serem coletados ou após timeout (ex: 2 minutos)

### 🤖 Prompt para o Agente

```
Implementar sistema de drop de itens quando jogador morre. Todos os recursos e criaturas coletados na run devem "cair" na posição da morte.

CONTEXTO:
- Quando jogador morre, handlePlayerDeath() é chamado
- Jogador tem player.resourcesCollected (Map<string, number>) e player.expeditionInventory.capturedCreatures
- Itens devem aparecer no chão na posição (player.x, player.y) onde morreu
- Outros jogadores devem poder coletar esses itens

TAREFAS:
1. Em handlePlayerDeath() (GameLoopManager.ts), coletar todos os recursos e criaturas do inventário
2. Criar função dropPlayerItems(player, deathX, deathY) que cria itens no chão
3. Para recursos: criar resource nodes temporários na posição da morte
4. Para criaturas: criar "creature capsules" ou itens especiais coletáveis
5. Adicionar itens dropados ao worldState (pode usar sistema de recursos existente ou criar novo)
6. Broadcast mensagem de itens dropados (pode usar resources_update ou criar nova mensagem)
7. No cliente, renderizar itens dropados com visual diferente (ex: brilho, cor especial)
8. Permitir coleta de itens dropados (usar sistema de coleta de recursos existente)
9. Adicionar timeout para itens dropados (remover após 2-3 minutos se não coletados)

ARQUIVOS PRINCIPAIS:
- server/src/managers/GameLoopManager.ts (handlePlayerDeath)
- server/src/systems/resources.ts (criação de recursos)
- server/src/types.ts (tipos de itens dropados)
- src/scenes/ExpeditionScene.ts (renderização e coleta)

NOTA: Itens dropados devem ser visualmente distintos de recursos normais para indicar que são loot de jogador morto.
```

---

## 8. Requisições Firebase ao Abrir Inventário

### 📝 Descrição do Problema
Ao abrir o inventário, o jogo deve fazer uma requisição para o Firebase para buscar os dados mais atualizados do jogador, garantindo que o inventário exibido está sincronizado com o servidor.

### 🔍 Análise Técnica
Atualmente o `InventoryScene` apenas lê dados do `PlayerState` local (`PlayerState.getProgress()`). Não há sincronização com Firebase ao abrir a tela. Precisamos:
1. Ao criar a cena, fazer requisição para buscar dados atualizados do Firebase
2. Aguardar resposta antes de renderizar o inventário
3. Atualizar `PlayerState` local com dados recebidos
4. Exibir loading enquanto busca dados

Arquivos relevantes:
- `src/scenes/InventoryScene.ts` - Cena do inventário
- `src/services/firebaseClient.ts` - Cliente Firebase
- `src/game/playerState.ts` - Estado do jogador

### 📁 Arquivos Afetados
- `src/scenes/InventoryScene.ts` - Adicionar busca de dados do Firebase no `create()`
- `src/services/firebaseClient.ts` - Função para buscar dados do usuário (se não existir)
- `src/game/playerState.ts` - Método para atualizar estado com dados do Firebase

### ✅ Passos de Implementação
1. Criar função `fetchUserDataFromFirebase(userId)` em `firebaseClient.ts` se não existir
2. No `create()` de `InventoryScene`, antes de renderizar, fazer requisição ao Firebase
3. Exibir tela de loading enquanto busca dados (ver Item 10)
4. Atualizar `PlayerState` com dados recebidos do Firebase
5. Renderizar inventário após dados serem carregados
6. Tratar erros (Firebase indisponível, timeout, etc.)

### 🤖 Prompt para o Agente

```
Adicionar requisição para Firebase ao abrir inventário para garantir dados atualizados.

CONTEXTO:
- InventoryScene atualmente apenas lê PlayerState local
- Dados podem estar desatualizados se outro dispositivo fez mudanças
- Precisamos buscar dados mais recentes do Firebase ao abrir inventário

TAREFAS:
1. Criar função fetchUserDataFromFirebase(userId) em firebaseClient.ts (ou verificar se já existe)
2. No create() de InventoryScene, antes de renderizar, fazer requisição ao Firebase
3. Exibir tela de loading enquanto busca dados (usar componente de loading - ver Item 10)
4. Atualizar PlayerState com dados recebidos usando syncFromFirebase() ou método similar
5. Renderizar inventário apenas após dados serem carregados
6. Tratar erros: Firebase indisponível, timeout, usuário não encontrado
7. Se erro, usar dados locais como fallback

ARQUIVOS PRINCIPAIS:
- src/scenes/InventoryScene.ts (create method)
- src/services/firebaseClient.ts (fetchUserDataFromFirebase)
- src/game/playerState.ts (syncFromFirebase)

NOTA: Esta implementação deve trabalhar junto com Item 10 (telas de loading) para melhor UX.
```

---

## 9. Sync Player ao Entrar e Sair do Inventário

### 📝 Descrição do Problema
Ao entrar no inventário, sincronizar estado do servidor para o cliente. Ao sair do inventário, sincronizar estado do cliente para o servidor (caso tenha feito alterações como descartar itens).

### 🔍 Análise Técnica
Atualmente o `InventoryScene` não faz sync ao entrar ou sair. Outras cenas como `CraftingScene` e `TeamManagementScene` já fazem sync ao sair. Precisamos:
1. Ao entrar: buscar dados atualizados do Firebase (pode usar Item 8)
2. Ao sair: enviar estado local para servidor via `syncPlayerStateToServer()`
3. Garantir que alterações locais (ex: descartar itens) sejam persistidas

Arquivos relevantes:
- `src/scenes/InventoryScene.ts` - Cena do inventário
- `src/services/firebaseSync.ts` - `syncPlayerStateToServer()`
- `server/src/httpServer.ts` - Endpoint `/api/sync-player`

### 📁 Arquivos Afetados
- `src/scenes/InventoryScene.ts` - Adicionar sync no `create()` e no handler de ESC
- `src/services/firebaseSync.ts` - Já existe, apenas usar

### ✅ Passos de Implementação
1. No `create()` de `InventoryScene`, após carregar dados do Firebase (Item 8), garantir que PlayerState está atualizado
2. No handler de ESC (`keydown-ESC`), antes de `scene.start("BaseHubScene")`, chamar `syncPlayerStateToServer()`
3. Aguardar sync completar antes de sair (ou fazer async sem bloquear)
4. Exibir feedback visual se sync falhar
5. Garantir que alterações locais (ex: `discardOne()`) são incluídas no sync

### 🤖 Prompt para o Agente

```
Adicionar sincronização de estado ao entrar e sair do inventário.

CONTEXTO:
- InventoryScene não sincroniza com Firebase ao entrar/sair
- Outras cenas (CraftingScene, TeamManagementScene) já fazem sync ao sair
- Precisamos garantir dados atualizados ao entrar e persistir mudanças ao sair

TAREFAS:
1. No create() de InventoryScene, após buscar dados do Firebase (Item 8), garantir PlayerState atualizado
2. No handler de ESC, antes de scene.start("BaseHubScene"), chamar syncPlayerStateToServer()
3. Aguardar sync completar (pode ser async, não precisa bloquear UI)
4. Exibir feedback visual se sync falhar (usar statusText existente)
5. Garantir que alterações locais (discardOne) são incluídas no sync
6. Se sync falhar, permitir sair mesmo assim (não bloquear usuário)

ARQUIVOS PRINCIPAIS:
- src/scenes/InventoryScene.ts (create, handler de ESC)
- src/services/firebaseSync.ts (syncPlayerStateToServer)

NOTA: Sync ao sair deve ser similar ao padrão usado em CraftingScene e TeamManagementScene.
```

---

## 10. Telas de Loading para Requisições Firebase

### 📝 Descrição do Problema
Quando fazemos requisições para o Firebase (buscar dados, sincronizar estado), o jogo deve exibir uma tela ou indicador de loading para informar o usuário que uma operação está em andamento.

### 🔍 Análise Técnica
Atualmente não há feedback visual quando requisições Firebase estão em andamento. Precisamos criar:
1. Componente reutilizável de loading (spinner, texto, overlay)
2. Usar em todas as operações Firebase (buscar dados, sync, etc.)
3. Exibir mensagem apropriada para cada tipo de operação

Arquivos relevantes:
- `src/scenes/InventoryScene.ts` - Precisa de loading ao buscar dados
- `src/services/firebaseSync.ts` - Precisa de loading ao sincronizar
- `src/game/playerState.ts` - Precisa de loading ao inicializar Firebase

### 📁 Arquivos Afetados
- `src/scenes/expedition/ui/FeedbackManager.ts` - Ou criar novo componente de loading
- `src/scenes/InventoryScene.ts` - Usar loading ao buscar dados
- `src/scenes/CraftingScene.ts` - Usar loading ao sincronizar
- `src/scenes/TeamManagementScene.ts` - Usar loading ao sincronizar
- `src/scenes/CreatureUpgradeScene.ts` - Usar loading ao sincronizar
- `src/services/firebaseSync.ts` - Opcional: loading interno

### ✅ Passos de Implementação
1. Criar componente `LoadingOverlay` ou adicionar método em `FeedbackManager` para exibir loading
2. Componente deve ter: overlay escuro, spinner animado, texto de mensagem
3. Métodos: `showLoading(message: string)` e `hideLoading()`
4. Usar em `InventoryScene` ao buscar dados do Firebase
5. Usar em todas as cenas que fazem `syncPlayerStateToServer()`
6. Garantir que loading é removido mesmo em caso de erro (try/finally)

### 🤖 Prompt para o Agente

```
Criar sistema de telas de loading para operações Firebase.

CONTEXTO:
- Requisições Firebase podem demorar (rede, servidor)
- Usuário precisa feedback visual de que operação está em andamento
- Loading deve ser reutilizável em todas as cenas

TAREFAS:
1. Criar componente LoadingOverlay ou adicionar métodos em FeedbackManager:
   - showLoading(message: string): exibe overlay com spinner e mensagem
   - hideLoading(): remove overlay
2. Componente deve ter:
   - Overlay escuro semi-transparente
   - Spinner animado (Phaser tweens ou sprite animado)
   - Texto de mensagem configurável
3. Usar em InventoryScene ao buscar dados do Firebase (Item 8)
4. Usar em todas as cenas que fazem syncPlayerStateToServer():
   - CraftingScene (ao sair)
   - TeamManagementScene (ao sair)
   - CreatureUpgradeScene (ao sair)
   - InventoryScene (ao sair - Item 9)
5. Garantir que loading é sempre removido (try/finally ou .finally())
6. Mensagens apropriadas: "Carregando inventário...", "Sincronizando dados...", etc.

ARQUIVOS PRINCIPAIS:
- src/scenes/expedition/ui/FeedbackManager.ts (ou criar novo LoadingOverlay.ts)
- src/scenes/InventoryScene.ts
- src/scenes/CraftingScene.ts
- src/scenes/TeamManagementScene.ts
- src/scenes/CreatureUpgradeScene.ts

NOTA: Loading deve ser não-bloqueante (não travar UI) mas visível o suficiente para informar usuário.
```

---

## 11. Tela de Loading ao Iniciar Servidor

### 📝 Descrição do Problema
Quando o jogo inicia e tenta conectar ao servidor multiplayer, deve exibir uma tela de loading indicando que está conectando ao servidor.

### 🔍 Análise Técnica
Atualmente o jogo inicia diretamente na `BootScene` e depois vai para `AuthScene`. Quando o jogador entra em uma expedição multiplayer, a conexão com o servidor pode demorar. Precisamos:
1. Tela de loading ao iniciar conexão com servidor
2. Exibir durante handshake WebSocket
3. Mostrar mensagem apropriada ("Conectando ao servidor...", "Carregando partida...")
4. Tratar erros de conexão com mensagem apropriada

Arquivos relevantes:
- `src/scenes/ExpeditionScene.ts` - Inicia conexão multiplayer
- `src/services/multiplayerClient.ts` - Cliente WebSocket
- `src/scenes/BootScene.ts` - Cena inicial (pode adicionar loading aqui também)

### 📁 Arquivos Afetados
- `src/scenes/ExpeditionScene.ts` - Exibir loading ao conectar ao servidor
- `src/services/multiplayerClient.ts` - Emitir eventos de conexão (connecting, connected, error)
- `src/scenes/expedition/ui/FeedbackManager.ts` - Ou usar componente de loading (Item 10)

### ✅ Passos de Implementação
1. No `create()` de `ExpeditionScene`, antes de conectar ao servidor, exibir loading
2. Usar componente de loading (Item 10) ou criar específico para conexão
3. Exibir mensagem "Conectando ao servidor..."
4. Quando `multiplayerClient` emitir evento de conexão bem-sucedida, remover loading
5. Se conexão falhar, exibir mensagem de erro e opção de retry
6. Garantir que loading é removido em todos os casos (sucesso, erro, timeout)

### 🤖 Prompt para o Agente

```
Adicionar tela de loading ao iniciar conexão com servidor multiplayer.

CONTEXTO:
- ExpeditionScene inicia conexão WebSocket com servidor
- Conexão pode demorar (handshake, autenticação)
- Usuário precisa feedback visual de que está conectando

TAREFAS:
1. No create() de ExpeditionScene, antes de conectar ao servidor, exibir loading
2. Usar componente de loading (Item 10) ou criar específico para conexão
3. Exibir mensagem "Conectando ao servidor..." ou "Carregando partida..."
4. Quando multiplayerClient emitir evento "connected" ou "joined", remover loading
5. Se conexão falhar (timeout, erro), exibir mensagem de erro:
   - "Falha ao conectar ao servidor"
   - Opção de retry ou voltar ao menu
6. Garantir que loading é sempre removido (try/finally ou eventos)
7. Loading deve aparecer antes de qualquer renderização de jogo

ARQUIVOS PRINCIPAIS:
- src/scenes/ExpeditionScene.ts (create method, antes de conectar)
- src/services/multiplayerClient.ts (eventos de conexão)
- src/scenes/expedition/ui/FeedbackManager.ts (ou LoadingOverlay - Item 10)

NOTA: Loading deve ser exibido o mais cedo possível, antes mesmo de tentar conectar.
```

---

## 12. Persistência de Login e Redirecionamento Automático

### 📝 Descrição do Problema
Se o usuário já estiver logado, salvar as informações dele e, num reload da página, não voltar para a página de login, e sim para a base, pois já está logado.

### 🔍 Análise Técnica
Atualmente o `BootScene` sempre redireciona para `AuthScene`, mesmo se o usuário já estiver autenticado. O Firebase Auth mantém a sessão do usuário mesmo após reload da página (via `onAuthStateChanged`), mas o jogo não verifica isso antes de redirecionar.

Precisamos:
1. No `BootScene`, verificar se há usuário autenticado antes de redirecionar
2. Se usuário estiver autenticado, ir direto para `BaseHubScene`
3. Se não estiver autenticado, ir para `AuthScene`
4. Garantir que `PlayerState` está inicializado antes de verificar autenticação

Arquivos relevantes:
- `src/scenes/BootScene.ts` - Cena inicial que decide para onde redirecionar
- `src/services/firebaseClient.ts` - `getCurrentUser()` verifica usuário autenticado
- `src/game/playerState.ts` - Inicializa Firebase e detecta usuário autenticado

### 📁 Arquivos Afetados
- `src/scenes/BootScene.ts` - Adicionar verificação de autenticação antes de redirecionar
- `src/services/firebaseClient.ts` - Garantir que `getCurrentUser()` funciona após reload
- `src/game/playerState.ts` - Pode precisar aguardar inicialização do Firebase

### ✅ Passos de Implementação
1. No `create()` de `BootScene`, antes de redirecionar, verificar se Firebase está disponível
2. Se Firebase disponível, verificar `getCurrentUser()` para ver se há usuário autenticado
3. Se usuário autenticado, aguardar um pequeno delay para garantir que `PlayerState` inicializou
4. Redirecionar para `BaseHubScene` se autenticado, senão para `AuthScene`
5. Tratar caso onde Firebase não está disponível (modo offline) - ir para `AuthScene`
6. Adicionar loading visual durante verificação (opcional, mas melhora UX)

### 🤖 Prompt para o Agente

```
Implementar persistência de login: se usuário já estiver logado, redirecionar direto para BaseHubScene ao recarregar página.

CONTEXTO:
- BootScene atualmente sempre redireciona para AuthScene
- Firebase Auth mantém sessão do usuário após reload (onAuthStateChanged)
- Se usuário já está autenticado, não precisa fazer login novamente

TAREFAS:
1. No create() de BootScene, antes de redirecionar, verificar se há usuário autenticado
2. Usar getCurrentUser() de firebaseClient para verificar autenticação
3. Se usuário autenticado:
   - Aguardar pequeno delay (100-200ms) para garantir PlayerState inicializou
   - Redirecionar para BaseHubScene
4. Se não autenticado ou Firebase indisponível:
   - Redirecionar para AuthScene (comportamento atual)
5. Garantir que verificação não bloqueia indefinidamente (timeout de 1-2s)
6. Adicionar logs para debug: "Usuário autenticado, indo para BaseHubScene" ou "Usuário não autenticado, indo para AuthScene"

ARQUIVOS PRINCIPAIS:
- src/scenes/BootScene.ts (create method)
- src/services/firebaseClient.ts (getCurrentUser)

NOTA: Firebase Auth persiste sessão automaticamente. Apenas precisamos verificar e redirecionar corretamente.
```

---

## 13. Logout e Limpeza de Dados Locais

### 📝 Descrição do Problema
Se o usuário sair (deslogar), deve apagar todos os dados dele locais (localStorage, estado do PlayerState, etc.).

### 🔍 Análise Técnica
Atualmente não há função de logout implementada. Precisamos:
1. Criar função `signOut()` em `firebaseClient.ts` que faz logout do Firebase Auth
2. Criar função `clearLocalData()` em `playerState.ts` que limpa localStorage e estado local
3. Adicionar opção de logout na UI (provavelmente em `BaseHubScene` ou `AuthScene`)
4. Após logout, redirecionar para `AuthScene`

Arquivos relevantes:
- `src/services/firebaseClient.ts` - Adicionar função `signOut()`
- `src/game/playerState.ts` - Adicionar função para limpar dados locais
- `src/scenes/BaseHubScene.ts` - Adicionar opção de logout no menu
- `src/scenes/AuthScene.ts` - Pode adicionar botão de logout se já estiver logado

### 📁 Arquivos Afetados
- `src/services/firebaseClient.ts` - Adicionar função `signOut()` usando Firebase Auth
- `src/game/playerState.ts` - Adicionar função `clearLocalData()` que limpa localStorage e estado
- `src/scenes/BaseHubScene.ts` - Adicionar opção de logout no menu
- `src/scenes/AuthScene.ts` - Opcional: adicionar botão de logout se já logado

### ✅ Passos de Implementação
1. Em `firebaseClient.ts`, criar função `signOut()` que chama `signOut(auth)` do Firebase Auth
2. Em `playerState.ts`, criar função `clearLocalData()` que:
   - Limpa `localStorage` (remover `LOCAL_STORAGE_KEY`)
   - Reseta `this.progress` para estado padrão
   - Limpa subscriptions do Firebase
   - Reseta `useFirebase` para false
3. Criar função `logout()` que combina `signOut()` e `clearLocalData()`
4. Em `BaseHubScene`, adicionar opção "Sair/Logout" no menu
5. Ao selecionar logout, chamar função de logout e redirecionar para `AuthScene`
6. Confirmar logout com usuário (opcional, mas recomendado)
7. Garantir que após logout, reload da página vai para `AuthScene` (Item 12)

### 🤖 Prompt para o Agente

```
Implementar sistema de logout que apaga todos os dados locais do usuário.

CONTEXTO:
- Não há função de logout implementada atualmente
- Logout deve limpar: localStorage, estado do PlayerState, sessão Firebase
- Após logout, usuário deve voltar para tela de login

TAREFAS:
1. Em firebaseClient.ts, criar função signOut():
   - Importar signOut de firebase/auth
   - Chamar signOut(auth) para desautenticar
   - Limpar currentUser
   - Retornar Promise<boolean> indicando sucesso
2. Em playerState.ts, criar função clearLocalData():
   - Limpar localStorage (remover LOCAL_STORAGE_KEY)
   - Resetar this.progress para createDefaultProgress()
   - Limpar firebaseUnsubscribe e authUnsubscribe
   - Resetar useFirebase = false
3. Criar função logout() que combina signOut() + clearLocalData()
4. Em BaseHubScene, adicionar opção "Sair" ou "Logout" no menu
5. Ao selecionar logout:
   - Chamar função de logout
   - Redirecionar para AuthScene
6. Adicionar confirmação antes de logout (opcional mas recomendado)
7. Garantir que após logout, BootScene detecta que não há usuário (Item 12)

ARQUIVOS PRINCIPAIS:
- src/services/firebaseClient.ts (signOut)
- src/game/playerState.ts (clearLocalData)
- src/scenes/BaseHubScene.ts (opção de logout)

NOTA: Logout deve ser completo - limpar tudo localmente e desautenticar do Firebase.
```

---

## 📊 Resumo de Prioridades

1. **Alta Prioridade (Bugs Críticos)**
   - Item 3: Corrigir Mensagem de Capturado
   - Item 4: Corrigir HP Máximo de Criaturas Upadas
   - Item 2: Remover Range de Captura (temporário)

2. **Média Prioridade (Melhorias de UX)**
   - Item 1: Extração Individual por Player
   - Item 5: Navegação com Mouse nos Menus
   - Item 8: Requisições Firebase ao Abrir Inventário
   - Item 9: Sync Player ao Entrar e Sair do Inventário
   - Item 10: Telas de Loading para Requisições Firebase
   - Item 11: Tela de Loading ao Iniciar Servidor
   - Item 12: Persistência de Login e Redirecionamento Automático
   - Item 13: Logout e Limpeza de Dados Locais

3. **Baixa Prioridade (Novas Features)**
   - Item 6: Adicionar Sistema PvP
   - Item 7: Drop de Itens ao Morrer

---

## 🔄 Ordem Sugerida de Implementação

1. Item 2 (Remover Range) - Rápido, remove frustração ✅
2. Item 3 (Mensagem Capturado) - Corrige feedback visual ✅
3. Item 4 (HP Máximo) - Corrige bug de exibição ✅
4. Item 10 (Loading Firebase) - Base para outros itens de loading
5. Item 8 (Firebase ao Abrir Inventário) - Requer Item 10
6. Item 9 (Sync Inventário) - Requer Item 8
7. Item 11 (Loading Servidor) - Requer Item 10
8. Item 12 (Persistência de Login) - Melhora UX, evita login repetido ✅
9. Item 13 (Logout) - Requer Item 12 para funcionar corretamente
10. Item 1 (Extração Individual) - Garante funcionamento correto ✅
11. Item 5 (Mouse nos Menus) - Melhora UX
12. Item 6 (PvP) - Feature nova, requer mais testes
13. Item 7 (Drop de Itens) - Feature nova, requer mais testes

---

## ✅ Checklist de Validação

Após cada implementação, validar:
- [ ] Código compila sem erros
- [ ] Funcionalidade testada localmente
- [ ] Sem regressões em outras features
- [ ] Logs apropriados adicionados
- [ ] Comentários/documentação atualizados se necessário

---

**Última atualização:** 2024
**Versão do documento:** 1.0
