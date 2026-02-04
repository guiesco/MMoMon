# Sprint 2: Polimento PvP - Plano de Execução

**Data**: Janeiro 2026  
**Status**: Pronto para Execução  
**Duração Estimada**: 1-2 dias

---

## 📋 Contexto do Projeto

**PokéExtract: Wild Expedition** é um jogo multiplayer de extração em browser onde jogadores exploram mapas top-down, capturam criaturas, coletam recursos e enfrentam outros jogadores em combate de ação em tempo real.

### Arquitetura
- **Server-Authoritative**: Servidor valida e processa todas as ações
- **Multiplayer-First**: Sempre conecta ao servidor, sem modo offline
- **Game Loop**: 20 ticks/s no servidor
- **Comunicação**: WebSocket em tempo real

### Status da Sprint Anterior
✅ Sprint 1 concluída:
- Sistema de combate PvP implementado
- Sistema de drop de itens funcionando
- Sistema de coleta de loot implementado
- Renderização visual de loot bags no cliente

---

## 🎯 Objetivos da Sprint

Polir e finalizar o sistema de PvP:
1. Limpeza de loot bags ao final da expedição
2. Testes e correções de bugs
3. Balanceamento de dano PvP
4. Melhorias visuais e de feedback

---

## 📁 Arquivos de Referência

### Arquivos a Ler para Contexto
1. `server/src/managers/GameLoopManager.ts` - Game loop e finalização de partida
2. `server/src/types.ts` - WorldState e ServerLootBag
3. `server/src/broadcast/StateBroadcaster.ts` - Broadcasts de estado
4. `server/src/systems/combat.ts` - Sistema de combate PvP
5. `src/scenes/ExpeditionScene.ts` - Cena de expedição
6. `server/src/constants.ts` - Constantes de dano e balanceamento

### Arquivos a Modificar
1. `server/src/managers/GameLoopManager.ts` - Limpar loot bags ao finalizar partida
2. `server/src/broadcast/StateBroadcaster.ts` - Garantir broadcast de limpeza
3. `src/scenes/ExpeditionScene.ts` - Limpar sprites de loot bags ao finalizar
4. `server/src/systems/combat.ts` - Ajustes de balanceamento (se necessário)

---

## ✅ Tarefas Detalhadas

### Fase 5: Limpeza de Loot Bags ao Final da Expedição

#### 5.1 Limpar Loot Bags ao Finalizar Partida
**Arquivo**: `server/src/managers/GameLoopManager.ts`

**O que fazer**:
- Localizar função `handleMatchEnd()` ou similar que é chamada ao finalizar partida
- Adicionar lógica para limpar todos os loot bags do `room.worldState.lootBags`
- Fazer broadcast de limpeza para todos os clientes

**Código de referência** (do plano):
```typescript
function handleMatchEnd(room: Room): void {
  // ... lógica existente (salvar recompensas, etc)
  
  // Limpar todos os loot bags
  room.worldState.lootBags.clear();
  
  // Broadcast de limpeza
  broadcastLootBagsUpdate(room);
}
```

**Nota**: Verificar se `handleMatchEnd()` já existe ou se a lógica está em outro lugar (ex: quando `matchState` muda para "ended").

#### 5.2 Garantir Broadcast de Limpeza
**Arquivo**: `server/src/broadcast/StateBroadcaster.ts`

**Verificar**:
- Função `broadcastLootBagsUpdate()` está funcionando corretamente
- Quando `lootBags` está vazio, o broadcast deve enviar array vazio `[]`
- Todos os clientes recebem a atualização

#### 5.3 Limpar Sprites no Cliente
**Arquivo**: `src/scenes/ExpeditionScene.ts`

**O que fazer**:
- Localizar onde a cena detecta fim de partida (ex: mensagem do servidor, mudança de estado)
- Adicionar lógica para destruir todos os sprites de loot bags
- Limpar o Map `lootBagSprites`

**Código sugerido**:
```typescript
private cleanupLootBags(): void {
  for (const [lootBagId, sprite] of this.lootBagSprites.entries()) {
    sprite.destroy();
  }
  this.lootBagSprites.clear();
}
```

**Chamar** quando:
- Partida termina
- Jogador sai da expedição
- Recebe update com array vazio de loot bags

---

### Testes e Correções

#### 6.1 Testes de Funcionalidade
**Checklist de testes**:

1. **Loot Bags**:
   - [ ] Loot bag é criado ao morrer
   - [ ] Loot bag contém todos os itens corretos
   - [ ] Loot bag pode ser coletado por qualquer jogador
   - [ ] Loot bag é removido após coleta
   - [ ] Loot bags são limpos ao final da partida
   - [ ] Múltiplos loot bags podem existir simultaneamente

2. **PvP**:
   - [ ] Projéteis de jogadores atingem outros jogadores
   - [ ] Auto-dano está bloqueado
   - [ ] Zonas seguras protegem jogadores
   - [ ] Proteção de spawn funciona (5 segundos)
   - [ ] Dano é aplicado corretamente
   - [ ] Jogador morre quando HP chega a 0

3. **Edge Cases**:
   - [ ] Jogador morre sem itens (loot bag vazio ou sem loot bag?)
   - [ ] Jogador morre sem criaturas no time
   - [ ] Múltiplos jogadores tentam coletar mesmo loot bag
   - [ ] Loot bag em posição inválida
   - [ ] Jogador desconecta enquanto tem loot bag no chão

#### 6.2 Correções de Bugs
**Problemas comuns a verificar**:

1. **Loot bag não aparece**:
   - Verificar se broadcast está sendo enviado
   - Verificar se cliente está recebendo mensagem
   - Verificar se sprite está sendo criado

2. **Loot bag não pode ser coletado**:
   - Verificar distância (raio 30px)
   - Verificar se jogador está morto (não pode coletar)
   - Verificar se loot bag ainda existe no servidor

3. **Itens não são transferidos**:
   - Verificar lógica de transferência em LootHandler
   - Verificar se Map está sendo atualizado corretamente
   - Verificar se broadcast de inventário está sendo enviado

4. **Loot bags não são limpos**:
   - Verificar se `handleMatchEnd()` está sendo chamado
   - Verificar se `lootBags.clear()` está sendo executado
   - Verificar se broadcast está sendo enviado

#### 6.3 Balanceamento de Dano PvP
**Arquivo**: `server/src/systems/combat.ts` ou `server/src/constants.ts`

**O que verificar**:
- Dano de projéteis de jogadores vs jogadores
- HP de jogadores
- Tempo para matar (TTK)
- Se dano está muito alto ou muito baixo

**Possíveis ajustes**:
- Multiplicador de dano PvP (ex: 0.8x dano em PvP)
- Redução de dano baseada em defesa
- Sistema de armadura/resistência

**Nota**: Balanceamento pode ser feito em sprint futura se necessário.

---

### Melhorias Visuais e de Feedback

#### 7.1 Feedback Visual de Dano PvP
**Arquivo**: `src/scenes/ExpeditionScene.ts`

**Melhorias sugeridas**:
- Mostrar número de dano quando jogador recebe dano
- Efeito visual de hit (flash, partículas)
- Indicador de quem está atacando (seta, highlight)

#### 7.2 Feedback Visual de Loot Bag
**Arquivo**: `src/scenes/ExpeditionScene.ts`

**Melhorias sugeridas**:
- Animação de criação (aparecer do chão)
- Brilho mais visível
- Indicador de quantidade de itens mais claro
- Efeito ao coletar (partículas, som)

#### 7.3 UI de Feedback
**Arquivo**: `src/scenes/ExpeditionScene.ts` ou `src/scenes/expedition/ui/FeedbackManager.ts`

**Melhorias sugeridas**:
- Mensagem quando coletar loot bag ("Você coletou X recursos, Y pokébolas, Z criaturas")
- Mensagem quando morrer ("Você foi eliminado por [nome]")
- Contador de loot bags no mapa (opcional)

---

## 🚀 Prompt de Execução

```
Implementar Sprint 2: Polimento PvP conforme o plano em PVP_AND_TEAMS_IMPLEMENTATION_PLAN.md.

CONTEXTO:
- Sprint 1 foi concluída (PvP básico funcionando)
- Sistema de loot bags está implementado
- Agora é necessário polir e finalizar

TAREFAS:

1. FASE 5: Limpeza de Loot Bags
   - Modificar handleMatchEnd() em GameLoopManager.ts para limpar loot bags
   - Garantir que broadcast de limpeza é enviado
   - Limpar sprites de loot bags no cliente quando partida termina

2. TESTES E CORREÇÕES
   - Testar todos os casos de uso
   - Corrigir bugs encontrados
   - Verificar edge cases (jogador sem itens, múltiplos coletadores, etc)

3. MELHORIAS (Opcional)
   - Adicionar feedback visual de dano PvP
   - Melhorar visual de loot bags
   - Adicionar mensagens de feedback ao usuário

VALIDAÇÕES IMPORTANTES:
- Loot bags são limpos ao final da partida
- Cliente remove sprites corretamente
- Não há memory leaks (sprites não destruídos)
- Broadcast funciona corretamente

REFERÊNCIAS:
- Ler server/src/managers/GameLoopManager.ts para entender finalização de partida
- Ler server/src/broadcast/StateBroadcaster.ts para entender broadcasts
- Seguir padrões existentes de limpeza de recursos

Ao finalizar, garantir que:
- Sistema está estável
- Não há bugs conhecidos
- Performance está adequada
- UX está clara
```

---

## ✅ Checklist de Validação

- [ ] Loot bags são limpos ao final da partida
- [ ] Broadcast de limpeza é enviado
- [ ] Cliente remove sprites corretamente
- [ ] Não há memory leaks
- [ ] Todos os casos de uso foram testados
- [ ] Bugs conhecidos foram corrigidos
- [ ] Edge cases foram tratados
- [ ] Performance está adequada
- [ ] Feedback visual está claro (opcional)

---

## 📝 Notas de Implementação

- Focar em estabilidade e correção de bugs
- Melhorias visuais são opcionais e podem ser feitas em sprint futura
- Balanceamento pode ser ajustado baseado em feedback de testes
- Documentar bugs conhecidos se houver algum que não possa ser corrigido nesta sprint
