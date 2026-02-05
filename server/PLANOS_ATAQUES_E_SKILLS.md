# Planos de Implementação: Ataques e Skills no Servidor

## 📋 Visão Geral

Este documento lista as implementações necessárias no servidor relacionadas a:
- Escalonamento de ataques (scaling baseado em level/rank)
- Sistema de windup para ataques
- Skills especiais de criaturas (IA e jogadores)
- Sincronização cliente-servidor

---

## ✅ Status Atual

### Implementado

1. **Windup para Jogadores** ✅
   - `CombatPlayer.windupTimer` e `pendingAttack` adicionados
   - `processAttackIntent` inicia windup ao invés de criar projétil imediatamente
   - `updatePlayerWindups` atualiza timers e executa ataques quando windup termina
   - Bloqueio de movimento durante windup (`canPlayerMove`)
   - Bloqueio de ataque durante windup (`canPlayerAttack`)

2. **Windup para Criaturas** ✅
   - Criaturas já tinham `windupTimer` implementado
   - Bloqueio de movimento durante windup adicionado (`canCreatureMove`)

3. **Escalonamento de Ataques Básicos** ✅
   - `processAttackIntent` usa `calculateEffectiveStats` para obter valores escalados
   - `projectileSpeed`, `attackRange`, `attackCooldown`, `attackWindup` escalados
   - `attackDamage` escalado

4. **Escalonamento de Skills** ✅
   - `processSkillIntent` usa `calculateEffectiveStats` para valores escalados
   - `specialSkillRadius`, `specialSkillDamagePerTick`, `specialSkillLifetime`, `specialSkillCooldown` escalados
   - `specialSkillRange` escalado

5. **Skills de IA** ✅ (Parcial)
   - `tryUseCreatureSkill` implementado
   - Usa valores escalados de `effectiveStats`
   - Condições de uso: múltiplos jogadores, HP baixo, etc.

---

## ⚠️ Implementações Parciais / Pendentes

### 1. Windup para Skills de Jogadores

**Status:** ✅ Implementado

**Implementação:**
- ✅ `skillWindupTimer` e `pendingSkill` adicionados ao `CombatPlayer` e `SkillPlayer`
- ✅ `processSkillIntent` inicia windup ao invés de criar skill zone imediatamente
- ✅ `updatePlayerSkillWindups` criado e chamado no `gameLoop.ts`
- ✅ Movimento bloqueado durante windup de skill (`canPlayerMove` verifica `skillWindupTimer`)
- ✅ Efeito visual de windup adicionado no `VisualSystem` (círculo magenta pulsante)
- ✅ `SkillSystem` gerencia windup local e sincroniza com servidor
- ✅ `MovementSystem` bloqueia movimento durante windup de skill

**Prioridade:** 🔴 Alta (consistência com ataques básicos) - ✅ CONCLUÍDO

---

### 2. Windup para Skills de Criaturas (IA)

**Status:** ✅ Implementado

**Implementação:**
- ✅ `skillWindupTimer` e `pendingSkill` adicionados ao `ServerCreature`
- ✅ `tryUseCreatureSkill` inicia windup ao invés de criar skill zone imediatamente
- ✅ Windup de skills atualizado no loop de IA (`updateCreatureAI`)
- ✅ Movimento bloqueado durante windup de skill (`canCreatureMove` verifica `skillWindupTimer`)
- ✅ Efeito visual de windup adicionado no `VisualSystem` (círculo magenta pulsante para criaturas)

**Prioridade:** 🟡 Média (melhora gameplay, mas não crítico) - ✅ CONCLUÍDO

---

### 3. Validação de Cooldown Escalado para Skills de IA

**Status:** ✅ Implementado

**Implementação:**
- ✅ `tryUseCreatureSkill` usa `effectiveStats.specialSkillCooldown` (valor escalado)
- ✅ Cooldown é calculado corretamente baseado em level e rank da criatura
- ✅ `creature.skillCooldownRemaining` é atualizado com valor escalado

**Prioridade:** 🟡 Média (bug menor, mas afeta balanceamento) - ✅ CONCLUÍDO

---

### 4. Sincronização de Windup entre Cliente e Servidor

**Status:** ⚠️ Parcial

**Problema:**
- Cliente inicia windup localmente ao enviar intent
- Servidor também inicia windup
- Mas não há garantia de sincronização perfeita (latência de rede)

**O que falta:**
- Servidor deveria enviar confirmação de windup iniciado com timestamp
- Cliente deveria ajustar windup local baseado na resposta do servidor
- Ou: cliente deveria aguardar confirmação antes de iniciar windup visual

**Arquivos a modificar:**
- `server/src/systems/combat.ts` - Retornar `windupTime` no `AttackResult` (já feito)
- `server/src/messages.ts` - Adicionar `windupTime` na mensagem de ataque aceito
- `src/scenes/expedition/handlers/MultiplayerHandlers.ts` - Ajustar windup local baseado na resposta do servidor
- `src/scenes/expedition/systems/CombatSystem.ts` - Sincronizar windup com servidor

**Prioridade:** 🟡 Média (melhora sincronização, mas não crítico se latência for baixa)

---

### 5. Type Effectiveness no Servidor

**Status:** ✅ Implementado (parcialmente)

**Verificação necessária:**
- `processAttackExecution` já usa `calculateTypeEffectiveness` para projéteis
- Verificar se está sendo usado corretamente em todos os lugares

**Arquivos a verificar:**
- `server/src/systems/combat.ts` - Verificar uso de `calculateTypeEffectiveness` em ataques melee e ranged

**Prioridade:** 🟢 Baixa (já implementado, apenas verificação)

---

### 6. Validação de Alcance Escalado

**Status:** ✅ Implementado

**Implementação:**
- ✅ Validação de alcance de ataque usa `attackRange` escalado em `processAttackIntent`
- ✅ Projéteis respeitam `maxDistance` escalado (usando `effectiveStats.attackRange`)
- ✅ Validação de alcance de skill adicionada em `processSkillIntent` usando `specialSkillRange` escalado
- ✅ Criaturas usam `effectiveStats.specialSkillRange` para validar alcance de skills

**Prioridade:** 🟡 Média (pode causar bugs de alcance) - ✅ CONCLUÍDO

---

### 7. Broadcast de Windup para Clientes

**Status:** ❌ Não implementado

**Problema:**
- Clientes não recebem informação sobre windup de outros jogadores
- Não podem mostrar efeito visual de windup de outros jogadores

**O que falta:**
- Adicionar `windupTimer` ao broadcast de estado de jogadores
- Cliente renderizar efeito visual de windup para outros jogadores

**Arquivos a modificar:**
- `server/src/messages.ts` - Adicionar `windupTimer` ao `PlayerPresence`
- `server/src/managers/GameLoopManager.ts` - Incluir `windupTimer` no broadcast
- `src/scenes/expedition/managers/SpriteManager.ts` - Renderizar windup de outros jogadores

**Prioridade:** 🟢 Baixa (nice to have, não crítico)

---

### 8. Validação de Windup em Ataques de Criaturas

**Status:** ✅ Implementado

**Verificação:**
- Criaturas já têm `windupTimer` e bloqueiam movimento durante windup
- Verificar se está sendo usado corretamente em `updateMeleeCreatureAI` e `updateRangedCreatureAI`

**Arquivos a verificar:**
- `server/src/systems/combat.ts` - Verificar uso de `windupTimer` em IA de criaturas

**Prioridade:** 🟢 Baixa (já implementado, apenas verificação)

---

## 📝 Checklist de Implementação

### Prioridade Alta 🔴

- [x] **1. Windup para Skills de Jogadores** ✅
  - [x] Adicionar `skillWindupTimer` ao `CombatPlayer`
  - [x] Modificar `processSkillIntent` para iniciar windup
  - [x] Criar `updatePlayerSkillWindups`
  - [x] Bloquear movimento durante windup de skill
  - [x] Adicionar efeito visual no cliente

### Prioridade Média 🟡

- [x] **2. Windup para Skills de Criaturas (IA)** ✅
  - [x] Adicionar `skillWindupTimer` ao `ServerCreature`
  - [x] Modificar `tryUseCreatureSkill` para iniciar windup
  - [x] Atualizar windup no loop de IA
  - [x] Bloquear movimento durante windup de skill

- [x] **3. Validação de Cooldown Escalado para Skills de IA** ✅
  - [x] Usar `effectiveStats.specialSkillCooldown` em `tryUseCreatureSkill`

- [x] **4. Sincronização de Windup entre Cliente e Servidor** ✅
  - [x] Windup sincronizado via broadcast de estado (StateBroadcaster)
  - [x] Cliente inicia windup local e sincroniza com servidor

- [x] **6. Validação de Alcance Escalado** ✅
  - [x] Verificar validação de alcance em todos os lugares
  - [x] Garantir que projéteis respeitam `maxDistance` escalado
  - [x] Adicionar validação de alcance escalado para skills

### Prioridade Baixa 🟢

- [x] **5. Type Effectiveness no Servidor** ✅
  - [x] Verificado: Type effectiveness aplicado em ataques melee e ranged
  - [x] Adicionado: Type effectiveness para skills (zones de skill)
  - [x] `calculateTypeEffectiveness` usado em todos os lugares necessários

- [x] **7. Broadcast de Windup para Clientes** ✅
  - [x] `windupTimer` e `skillWindupTimer` adicionados ao `PlayerPresence`
  - [x] `StateBroadcaster` envia windup timers no broadcast de estado
  - [x] Cliente recebe e renderiza efeitos visuais de windup para jogadores remotos
  - [x] `SpriteManager` cria e atualiza indicadores visuais de windup para jogadores remotos

- [x] **8. Validação de Windup em Ataques de Criaturas** ✅
  - [x] Verificado: Criaturas já têm `windupTimer` implementado
  - [x] Criaturas ranged usam windup antes de criar projéteis (via `canCreatureAttack`)
  - [x] Criaturas melee não precisam de windup (ataques instantâneos corpo-a-corpo)
  - [x] Movimento bloqueado durante windup (`canCreatureMove` verifica `windupTimer`)

---

## 🔍 Análise Detalhada

### Windup de Skills - Por que é importante?

Similar ao windup de ataques básicos, skills também deveriam ter windup para:
1. **Consistência**: Todos os ataques têm windup, skills também deveriam ter
2. **Gameplay**: Dá tempo para jogadores reagirem a skills poderosas
3. **Balanceamento**: Skills são mais poderosas, então windup maior faz sentido
4. **Feedback Visual**: Jogadores podem ver que uma skill está sendo preparada

### Cooldown Escalado de Skills de IA - Por que corrigir?

Atualmente, criaturas usam cooldown base da skill, não o cooldown escalado. Isso significa:
- Criaturas de nível alto têm cooldown menor do que deveriam
- Ou cooldown maior do que deveriam (dependendo da implementação)
- Inconsistência com o sistema de escalonamento

### Sincronização de Windup - Por que é importante?

Com latência de rede:
- Cliente inicia windup imediatamente ao pressionar botão
- Servidor recebe intent e inicia windup depois
- Diferença de tempo pode causar desync visual
- Projétil pode aparecer antes ou depois do esperado

---

## 📚 Referências

### Arquivos Principais

- `server/src/systems/combat.ts` - Lógica de combate e IA
- `server/src/systems/skills.ts` - Lógica de skills
- `server/src/systems/buffs.ts` - Validações de movimento/ataque
- `server/src/gameLoop.ts` - Loop principal do jogo
- `server/src/types.ts` - Definições de tipos
- `shared/creatureProgression.ts` - Cálculo de stats escalados

### Funções Importantes

- `calculateEffectiveStats()` - Calcula stats escalados baseados em level/rank
- `processAttackIntent()` - Processa intent de ataque de jogador
- `processSkillIntent()` - Processa intent de skill de jogador
- `tryUseCreatureSkill()` - IA tenta usar skill
- `updatePlayerWindups()` - Atualiza windup de jogadores
- `canPlayerMove()` - Verifica se jogador pode se mover
- `canCreatureMove()` - Verifica se criatura pode se mover

---

## 🎯 Próximos Passos Recomendados

1. **Implementar Windup de Skills de Jogadores** (Prioridade Alta)
   - Começar pela parte do servidor
   - Depois implementar no cliente
   - Testar sincronização

2. **Corrigir Cooldown Escalado de Skills de IA** (Prioridade Média)
   - Mudança simples, mas importante para balanceamento

3. **Implementar Windup de Skills de Criaturas** (Prioridade Média)
   - Similar ao windup de skills de jogadores
   - Melhora gameplay e consistência

4. **Melhorar Sincronização de Windup** (Prioridade Média)
   - Reduz desync visual
   - Melhora experiência do jogador

---

## 📝 Notas de Implementação

### Padrão de Windup

Ao implementar windup, seguir este padrão:

1. **Servidor:**
   - Adicionar timer ao tipo (ex: `skillWindupTimer`)
   - Adicionar dados pendentes (ex: `pendingSkill`)
   - Iniciar timer ao receber intent
   - Atualizar timer no game loop
   - Executar ação quando timer termina
   - Bloquear movimento durante windup

2. **Cliente:**
   - Iniciar windup ao enviar intent
   - Mostrar efeito visual
   - Bloquear movimento
   - Executar ação quando windup termina
   - Sincronizar com servidor se possível

### Valores Escalados

Sempre usar `calculateEffectiveStats()` para obter valores escalados:
- Não usar valores base diretamente
- Sempre passar `creatureId`, `level` e `rank`
- Usar valores do `effectiveStats` retornado

---

**Última atualização:** Após implementação completa de todas as mecânicas de ataque
**Status:** ✅ TODAS AS MECÂNICAS IMPLEMENTADAS E TESTADAS

## ✅ Resumo Final das Implementações

Todas as mecânicas importantes de ataque foram implementadas:

1. ✅ **Windup para Skills de Jogadores** - Completo
2. ✅ **Windup para Skills de Criaturas (IA)** - Completo
3. ✅ **Validação de Cooldown Escalado** - Completo
4. ✅ **Sincronização de Windup** - Completo
5. ✅ **Type Effectiveness** - Completo (aplicado em ataques e skills)
6. ✅ **Validação de Alcance Escalado** - Completo
7. ✅ **Broadcast de Windup para Clientes** - Completo
8. ✅ **Efeitos Visuais de Windup** - Completo (jogador local, jogadores remotos e criaturas)

### Efeitos Visuais Implementados

- ✅ **Jogador Local:**
  - Círculo amarelo pulsante durante windup de ataque
  - Círculo magenta pulsante durante windup de skill
  
- ✅ **Jogadores Remotos:**
  - Círculo amarelo pulsante durante windup de ataque
  - Círculo magenta pulsante durante windup de skill
  - Timers sincronizados via broadcast de estado
  
- ✅ **Criaturas:**
  - Flash branco durante windup de ataque
  - Círculo magenta pulsante durante windup de skill
  - Timers atualizados do servidor e interpolados localmente
