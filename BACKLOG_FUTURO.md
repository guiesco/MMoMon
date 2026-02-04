# Backlog Futuro - Melhorias e Correções

**Data de Criação**: Janeiro 2026  
**Status**: Planejado  
**Prioridade**: A definir por sprint

---

## 🐛 Bugs e Correções

### 1. Marcador de Capturas Não Atualiza Durante Expedição ✅ CONCLUÍDO
**Prioridade**: Alta  
**Categoria**: UI/UX - Sincronização
**Status**: ✅ Resolvido

**Problema**:
- Durante a expedição, mesmo quando capturamos criaturas, o marcador ao lado do tempo continua mostrando 0 capturas
- A mensagem de captura não aparece apropriadamente no cliente

**Arquivos Afetados**:
- `src/scenes/ExpeditionScene.ts` - Handler de captura e atualização de contador
- `src/scenes/expedition/handlers/MultiplayerHandlers.ts` - Correção de bug (targetId vs creatureId)
- `src/scenes/expedition/ui/HUDManager.ts` - Exibição do contador (já estava funcionando)
- `src/scenes/expedition/ui/FeedbackManager.ts` - Mensagens de feedback (já estava funcionando)

**Tarefas**:
- [x] Verificar se o servidor está enviando atualizações de capturas corretamente
- [x] Verificar se o cliente está recebendo e processando mensagens de captura
- [x] Corrigir atualização do contador de capturas no HUD
- [x] Implementar/exibir mensagem de feedback visual quando captura ocorre
- [x] Testar sincronização entre múltiplos clientes

**Implementação**:
- Adicionada verificação de `playerId` no `handleCaptureResult()` para garantir que apenas capturas do jogador local atualizem o contador
- Corrigido bug no `MultiplayerHandlers.handleCaptureResult()` que usava `result.creatureId` (inexistente) ao invés de `result.targetId`
- Adicionados logs de debug para rastrear atualizações de contador
- Feedback visual já estava implementado e funcionando corretamente
- O servidor já estava enviando mensagens de captura corretamente via `StateBroadcaster.broadcastMessage()`

**Resultado**:
- Contador de capturas agora atualiza corretamente quando o jogador captura uma criatura
- Feedback visual de captura bem-sucedida é exibido corretamente
- Mensagem "✅ CAPTURADO!" aparece acima da criatura capturada
- Contador não é atualizado para capturas de outros jogadores (comportamento correto)

---

### 2. Sincronização de HP das Criaturas ✅ CONCLUÍDO
**Prioridade**: Alta  
**Categoria**: Sincronização Server-Client  
**Status**: ✅ Resolvido

**Problema**:
- Criaturas não estão refletindo no cliente o `currentHp` que tem no Firebase
- O HP exibido no cliente difere do HP no servidor, causando inconsistências

**Arquivos Afetados**:
- `src/scenes/ExpeditionScene.ts` - Handler de atualização de criaturas e sincronização de HP
- `src/scenes/expedition/managers/SpriteManager.ts` - Atualização de barras de HP e posicionamento
- `src/game/hpBars.ts` - Barras de HP (já estava funcionando)
- `server/src/systems/combat.ts` - Sistema de combate e atualização de HP (já estava funcionando)
- `server/src/broadcast/StateBroadcaster.ts` - Broadcast de estado das criaturas (já estava funcionando)
- `src/services/multiplayerClient.ts` - Processamento de updates do servidor (já estava funcionando)

**Tarefas**:
- [x] Verificar se o servidor está enviando `currentHp` nas atualizações de estado
- [x] Verificar se o cliente está aplicando `currentHp` recebido do servidor
- [x] Garantir que barras de HP refletem o valor correto do servidor
- [x] Implementar sincronização periódica de HP (já estava implementado via creaturesUpdate)
- [x] Adicionar logs de debug para rastrear discrepâncias
- [x] Testar em diferentes cenários (combate, regeneração, etc)

**Implementação**:
- Corrigido método `updateCreatureSprite()` no `SpriteManager.ts`:
  - Agora atualiza a barra de HP usando `setSize()` ao invés de apenas `setScale()` para maior precisão
  - Atualiza posição da barra de HP corretamente quando a criatura se move
  - Adiciona logs de debug quando HP muda (10% dos updates para não poluir console)
- Corrigido método `updateCreatureSpritePosition()`:
  - Garante que a barra de HP é posicionada corretamente quando a criatura se move
  - Mantém o tamanho correto da barra baseado no HP atual
- Corrigido método `createCreatureSprite()`:
  - Cria barra de HP com tamanho correto desde o início baseado no HP inicial
  - Usa `setOrigin()` correto para alinhamento adequado
- Adicionado logs de debug no `handleCreaturesUpdate()`:
  - Log quando HP muda do servidor (10% dos updates)
  - Compara HP anterior com novo HP para rastrear mudanças

**Resultado**:
- Barras de HP agora refletem corretamente o `currentHp` do servidor
- Sincronização de HP funciona corretamente em todos os cenários (combate, regeneração, etc)
- Logs de debug ajudam a rastrear discrepâncias quando necessário
- Posicionamento da barra de HP é atualizado corretamente quando criatura se move

---

### 3. Movimento Durante Loading da Expedição ✅ CONCLUÍDO
**Prioridade**: Média  
**Categoria**: UX - Controle de Input  
**Status**: ✅ Resolvido

**Problema**:
- Quando estamos na tela de loading da expedição, ainda conseguimos movimentar o personagem
- O jogador não deveria poder se mover durante o carregamento

**Arquivos Afetados**:
- `src/scenes/ExpeditionScene.ts` - Controle de input e estado da cena
- `src/scenes/expedition/ui/LoadingOverlay.ts` - Overlay de loading (já tinha método `visible`)

**Tarefas**:
- [x] Adicionar flag de estado "loading" na ExpeditionScene (usando `loadingOverlay.visible`)
- [x] Bloquear processamento de input de movimento durante loading
- [x] Garantir que o bloqueio seja removido quando loading terminar (automático via `loadingOverlay.visible`)
- [x] Verificar se há outros inputs que também devem ser bloqueados (ataques, skills, etc)
- [x] Testar transição de loading para jogo

**Implementação**:
- Modificado `ExpeditionScene.update()` para verificar `loadingOverlay.visible` antes de processar movimento, combate e interações
- Adicionada verificação adicional em `tryBasicAttack()` para bloquear ataques durante loading
- Bloqueado handler de `pointerdown` para não processar cliques durante loading
- Velocidade do jogador é zerada quando loading está ativo para garantir que não há movimento residual

---

## 🤖 Melhorias de IA

### 4. IA - Fugir Quando com Pouca Vida
**Prioridade**: Média  
**Categoria**: Gameplay - Comportamento de Criaturas

**Descrição**:
- Implementar comportamento de fuga para criaturas selvagens quando estão com pouca vida
- Criaturas devem tentar se afastar de ameaças quando HP está baixo

**Arquivos Afetados** (estimado):
- `server/src/systems/spawns.ts` - Sistema de spawns e comportamento de criaturas
- `server/src/systems/combat.ts` - Lógica de combate e detecção de ameaças
- `server/src/types.ts` - Tipos de criaturas e estados

**Tarefas**:
- [ ] Definir threshold de HP para ativar comportamento de fuga (ex: < 30% HP)
- [ ] Implementar lógica de detecção de ameaças próximas
- [ ] Implementar movimento de fuga (direção oposta à ameaça)
- [ ] Adicionar cooldown ou condições para evitar fuga infinita
- [ ] Balancear velocidade de fuga vs velocidade normal
- [ ] Testar comportamento em diferentes situações

---

### 5. IA - Criaturas do Mesmo Tipo se Juntarem
**Prioridade**: Baixa  
**Categoria**: Gameplay - Comportamento de Criaturas

**Descrição**:
- Criaturas selvagens do mesmo tipo devem se agrupar quando próximas
- Comportamento de "pack" ou "swarm" para criar desafios mais interessantes

**Arquivos Afetados** (estimado):
- `server/src/systems/spawns.ts` - Sistema de spawns e comportamento
- `server/src/types.ts` - Tipos e estados de criaturas

**Tarefas**:
- [ ] Implementar detecção de criaturas do mesmo tipo próximas
- [ ] Implementar movimento de agrupamento (se mover em direção a outras do mesmo tipo)
- [ ] Definir raio de detecção para agrupamento
- [ ] Balancear para evitar agrupamento excessivo
- [ ] Considerar comportamento de grupo (atacar juntas, etc)
- [ ] Testar com diferentes tipos de criaturas

---

## ✨ Novas Features

### 6. Exibir Nome e Nível das Criaturas Selvagens ✅ CONCLUÍDO
**Prioridade**: Média  
**Categoria**: UI/UX - Informação Visual
**Status**: ✅ Resolvido

**Descrição**:
- Adicionar exibição de nome e nível das criaturas selvagens no cliente
- Informação deve aparecer acima ou próximo à criatura

**Arquivos Afetados**:
- `server/src/types.ts` - Adicionado campo `level` ao `ServerCreature` e geração de nível baseado no tier
- `server/src/managers/GameLoopManager.ts` - Envio de `level` nas atualizações de criaturas
- `src/scenes/expedition/types/ExpeditionTypes.ts` - Adicionado campo `nameText` ao `RemoteCreatureSprite`
- `src/scenes/expedition/managers/SpriteManager.ts` - Criação e gerenciamento do texto de nome e nível
- `src/scenes/expedition/handlers/MultiplayerHandlers.ts` - Passagem de `level` ao criar/atualizar criaturas
- `src/game/creatures.ts` - Usado para obter nome da criatura via `getCreatureById()`

**Tarefas**:
- [x] Criar componente visual de texto para nome e nível
- [x] Posicionar texto acima da criatura (ou em posição apropriada)
- [x] Garantir que servidor envia nome e nível nas atualizações
- [x] Estilizar texto (cor, tamanho, contorno para legibilidade)
- [x] Considerar mostrar apenas quando criatura está visível/em range
- [x] Testar com diferentes criaturas e níveis

**Implementação**:
- Adicionado campo `level?: number` ao `ServerCreature` no servidor
- Implementada geração de nível baseado no tier ao criar criaturas:
  - comum: nível 1-3
  - perigosa: nível 4-6
  - elite: nível 7-10
- Servidor agora envia `level` nas atualizações de criaturas via `GameLoopManager.broadcastGameStateUpdates()`
- Adicionado campo `nameText: Phaser.GameObjects.Text` ao `RemoteCreatureSprite`
- Criado texto de nome e nível no `SpriteManager.createCreatureSprite()`:
  - Posicionado acima da criatura (y - 35)
  - Estilizado com fonte branca, contorno preto (stroke) para legibilidade
  - Formato: "Nome Lv.X" (ex: "Pyrognat Lv.5")
  - Usa `getCreatureById()` para obter nome da criatura
- Texto é atualizado quando nível ou espécie mudam em `updateCreatureSprite()`
- Posição do texto é atualizada quando criatura se move em `updateCreatureSpritePosition()`
- Texto é destruído corretamente em `destroyCreatureSprite()`

**Resultado**:
- Nome e nível das criaturas selvagens são exibidos acima de cada criatura
- Texto é legível com contorno preto sobre fundo claro
- Nível é gerado automaticamente baseado no tier da criatura
- Informação é sincronizada corretamente entre servidor e cliente

---

### 7. Efeitos dos Ataques Corpo a Corpo das Criaturas
**Prioridade**: Média  
**Categoria**: Visual - Efeitos de Combate

**Descrição**:
- Adicionar efeitos visuais para ataques corpo a corpo das criaturas
- Melhorar feedback visual durante combate

**Arquivos Afetados** (estimado):
- `src/scenes/ExpeditionScene.ts` - Renderização de efeitos
- `src/scenes/expedition/managers/ProjectileManager.ts` - Gerenciamento de projéteis/efeitos
- `server/src/systems/combat.ts` - Sistema de combate (garantir que envia informações de ataques)
- `server/src/types.ts` - Tipos de ataques e efeitos

**Tarefas**:
- [ ] Definir tipos de efeitos visuais para ataques corpo a corpo
- [ ] Criar sprites/partículas para efeitos de ataque
- [ ] Implementar animação de ataque (ex: swipe, punch, etc)
- [ ] Sincronizar efeitos com momento do dano no servidor
- [ ] Adicionar feedback de direção do ataque
- [ ] Testar com diferentes tipos de criaturas

---

### 8. Efeito de Hit Tomado
**Prioridade**: Média  
**Categoria**: Visual - Feedback de Combate

**Descrição**:
- Adicionar efeito visual quando criatura ou jogador recebe dano
- Feedback imediato de impacto (flash, shake, partículas, etc)

**Arquivos Afetados** (estimado):
- `src/scenes/ExpeditionScene.ts` - Renderização de efeitos
- `src/scenes/expedition/managers/SpriteManager.ts` - Gerenciamento de sprites
- `src/scenes/expedition/ui/FeedbackManager.ts` - Gerenciamento de feedback
- `server/src/systems/combat.ts` - Sistema de combate (garantir que envia eventos de dano)

**Tarefas**:
- [ ] Definir efeitos visuais para hit recebido (flash vermelho, shake, etc)
- [ ] Implementar animação de flash/shake no sprite
- [ ] Adicionar partículas de impacto (opcional)
- [ ] Sincronizar com eventos de dano do servidor
- [ ] Garantir que efeito não sobrepõe outros efeitos importantes
- [ ] Testar com diferentes tipos de dano

---

### 9. Criaturas Selvagens Usarem Skills
**Prioridade**: Baixa  
**Categoria**: Gameplay - Sistema de Skills

**Descrição**:
- Tornar possível que criaturas selvagens usem skills durante combate
- Adicionar variedade e desafio ao combate

**Arquivos Afetados** (estimado):
- `server/src/systems/skills.ts` - Sistema de skills
- `server/src/systems/combat.ts` - Lógica de combate e decisão de usar skills
- `server/src/systems/spawns.ts` - Definição de skills para criaturas selvagens
- `server/src/types.ts` - Tipos de criaturas e skills
- `src/scenes/expedition/systems/SkillSystem.ts` - Renderização de skills no cliente

**Tarefas**:
- [ ] Definir quais skills criaturas selvagens podem usar
- [ ] Implementar lógica de decisão de quando usar skills (cooldown, condições, etc)
- [ ] Garantir que skills de criaturas são processadas no servidor
- [ ] Renderizar efeitos de skills de criaturas no cliente
- [ ] Balancear frequência e poder das skills
- [ ] Testar com diferentes tipos de criaturas e skills

---

## ⚖️ Balanceamento

### 10. Balancear Skills Existentes e Torná-las Mais Únicas
**Prioridade**: Média  
**Categoria**: Gameplay - Sistema de Skills

**Descrição**:
- Revisar e balancear todas as skills existentes
- Tornar cada skill mais única e distinta (skill corpo a corpo, skill com dash, etc)
- Garantir que cada skill tem um propósito claro e diferente das outras

**Arquivos Afetados** (estimado):
- `server/src/systems/skills.ts` - Sistema de skills
- `server/src/constants.ts` - Constantes de balanceamento
- `src/game/skills.ts` ou similar - Definições de skills no cliente
- `src/scenes/expedition/systems/SkillSystem.ts` - Sistema de skills no cliente

**Tarefas**:
- [ ] Revisar todas as skills existentes e seus valores atuais
- [ ] Identificar skills que são muito similares
- [ ] Redefinir cada skill com identidade única:
  - [ ] Skill corpo a corpo (área próxima, alto dano)
  - [ ] Skill com dash (movimento + dano)
  - [ ] Skill de projétil (longo alcance)
  - [ ] Skill de buff/debuff
  - [ ] Skill de área (AOE)
  - [ ] Outras variações
- [ ] Balancear dano, cooldown, custo de mana/energia
- [ ] Garantir que cada skill tem nicho claro
- [ ] Testar balanceamento em combate real
- [ ] Documentar propósito e uso de cada skill

---

## 📊 Priorização Sugerida

### Sprint Imediato (Alta Prioridade)
1. ~~**Bug #1**: Marcador de Capturas Não Atualiza~~ ✅ CONCLUÍDO
2. ~~**Bug #2**: Sincronização de HP das Criaturas~~ ✅ CONCLUÍDO
3. ~~**Bug #3**: Movimento Durante Loading~~ ✅ CONCLUÍDO

### Próximas Sprints (Média Prioridade)
4. ~~**Feature #6**: Nome e Nível das Criaturas~~ ✅ CONCLUÍDO
5. **Feature #7**: Efeitos de Ataques Corpo a Corpo
6. **Feature #8**: Efeito de Hit Tomado
7. **Balanceamento #10**: Balancear Skills

### Backlog (Baixa Prioridade)
8. **IA #4**: Fugir Quando com Pouca Vida
9. **IA #5**: Criaturas se Juntarem
10. **Feature #9**: Criaturas Usarem Skills

---

## 📝 Notas Gerais

- Todas as tarefas devem manter a arquitetura server-authoritative
- Mudanças no servidor devem ser validadas e sincronizadas com o cliente
- Testes devem ser realizados em ambiente multiplayer quando aplicável
- Considerar impacto de performance em todas as mudanças visuais
- Documentar mudanças significativas no código

---

## 🔄 Atualizações

- **2026-01-XX**: Documento criado com backlog inicial
- **2026-01-XX**: Bug #3 (Movimento Durante Loading) concluído - Implementado bloqueio de movimento, ataques e interações durante loading usando `loadingOverlay.visible`
- **2026-01-XX**: Bug #1 (Marcador de Capturas Não Atualiza) concluído - Adicionada verificação de `playerId` no handler de captura para garantir que apenas capturas do jogador local atualizem o contador. Corrigido bug no `MultiplayerHandlers` que usava propriedade inexistente. Feedback visual já estava funcionando corretamente.
- **2026-01-XX**: Bug #2 (Sincronização de HP das Criaturas) concluído - Corrigido método `updateCreatureSprite()` para atualizar barras de HP usando `setSize()` ao invés de apenas `setScale()`. Corrigido posicionamento da barra de HP quando criatura se move. Adicionados logs de debug para rastrear mudanças de HP. Barras de HP agora refletem corretamente o `currentHp` do servidor em todos os cenários.
- **2026-01-XX**: Feature #6 (Exibir Nome e Nível das Criaturas Selvagens) concluído - Implementada exibição de nome e nível acima de cada criatura selvagem. Servidor agora gera nível baseado no tier (comum: 1-3, perigosa: 4-6, elite: 7-10) e envia nas atualizações. Cliente exibe texto estilizado com contorno preto para legibilidade. Texto é atualizado e posicionado corretamente quando criatura se move.