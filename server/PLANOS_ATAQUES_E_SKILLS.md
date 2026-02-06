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

**Status:** ❌ Não implementado

**Problema:**
- Skills de jogadores não têm windup
- Deveriam ter delay antes de criar skill zone (similar a ataques básicos)

**O que falta:**
- Adicionar `skillWindupTimer` ao `CombatPlayer`
- Modificar `processSkillIntent` para iniciar windup ao invés de criar skill zone imediatamente
- Criar `updatePlayerSkillWindups` similar a `updatePlayerWindups`
- Bloquear movimento durante windup de skill
- Adicionar efeito visual no cliente

**Arquivos a modificar:**
- `server/src/types.ts` - Adicionar `skillWindupTimer` e `pendingSkill` ao `CombatPlayer`
- `server/src/systems/skills.ts` - Modificar `processSkillIntent` para iniciar windup
- `server/src/systems/skills.ts` - Criar `updatePlayerSkillWindups`
- `server/src/gameLoop.ts` - Chamar `updatePlayerSkillWindups` no `updateWorld`
- `server/src/systems/buffs.ts` - Verificar `skillWindupTimer` em `canPlayerMove`
- `src/scenes/expedition/systems/SkillSystem.ts` - Adicionar windup visual
- `src/scenes/expedition/systems/MovementSystem.ts` - Já bloqueia (usa `isInWindup` do CombatSystem, precisa verificar skills também)

**Prioridade:** 🔴 Alta (consistência com ataques básicos)

---

### 2. Windup para Skills de Criaturas (IA)

**Status:** ❌ Não implementado

**Problema:**
- Criaturas não têm windup para skills
- Skills são criadas imediatamente quando condições são atendidas

**O que falta:**
- Adicionar `skillWindupTimer` ao `ServerCreature`
- Modificar `tryUseCreatureSkill` para iniciar windup ao invés de criar skill zone imediatamente
- Atualizar windup de skills no loop de IA
- Bloquear movimento durante windup de skill

**Arquivos a modificar:**
- `server/src/types.ts` - Adicionar `skillWindupTimer` e `pendingSkill` ao `ServerCreature`
- `server/src/systems/combat.ts` - Modificar `tryUseCreatureSkill` para iniciar windup
- `server/src/systems/combat.ts` - Atualizar `skillWindupTimer` no loop de IA
- `server/src/systems/buffs.ts` - Verificar `skillWindupTimer` em `canCreatureMove`
- `src/scenes/expedition/systems/VisualSystem.ts` - Adicionar efeito visual de windup de skill para criaturas

**Prioridade:** 🟡 Média (melhora gameplay, mas não crítico)

---

### 3. Validação de Cooldown Escalado para Skills de IA

**Status:** ⚠️ Parcial

**Problema:**
- `tryUseCreatureSkill` verifica cooldown usando `specialSkill.cooldown` (valor base)
- Deveria usar `effectiveStats.specialSkillCooldown` (valor escalado)

**O que falta:**
- Modificar verificação de cooldown em `tryUseCreatureSkill` para usar valor escalado
- Garantir que `creature.skillCooldownRemaining` seja atualizado com valor escalado

**Arquivos a modificar:**
- `server/src/systems/combat.ts` - Linha ~1156: usar `effectiveStats.specialSkillCooldown` ao invés de `specialSkill.cooldown`

**Prioridade:** 🟡 Média (bug menor, mas afeta balanceamento)

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

**Status:** ⚠️ Parcial

**Problema:**
- Alcance de ataque é validado usando `attackRange` escalado
- Mas validação pode não estar em todos os lugares necessários

**O que falta:**
- Verificar se validação de alcance está usando valores escalados em todos os lugares
- Garantir que projéteis param quando atingem `attackRange` escalado

**Arquivos a verificar:**
- `server/src/systems/combat.ts` - Verificar validação de alcance em `processAttackIntent`
- `server/src/systems/combat.ts` - Verificar se projéteis respeitam `maxDistance` escalado

**Prioridade:** 🟡 Média (pode causar bugs de alcance)

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

- [ ] **1. Windup para Skills de Jogadores**
  - [ ] Adicionar `skillWindupTimer` ao `CombatPlayer`
  - [ ] Modificar `processSkillIntent` para iniciar windup
  - [ ] Criar `updatePlayerSkillWindups`
  - [ ] Bloquear movimento durante windup de skill
  - [ ] Adicionar efeito visual no cliente

### Prioridade Média 🟡

- [ ] **2. Windup para Skills de Criaturas (IA)**
  - [ ] Adicionar `skillWindupTimer` ao `ServerCreature`
  - [ ] Modificar `tryUseCreatureSkill` para iniciar windup
  - [ ] Atualizar windup no loop de IA
  - [ ] Bloquear movimento durante windup de skill

- [ ] **3. Validação de Cooldown Escalado para Skills de IA**
  - [ ] Usar `effectiveStats.specialSkillCooldown` em `tryUseCreatureSkill`

- [ ] **4. Sincronização de Windup entre Cliente e Servidor**
  - [ ] Enviar confirmação de windup com timestamp
  - [ ] Ajustar windup local baseado na resposta

- [ ] **6. Validação de Alcance Escalado**
  - [ ] Verificar validação de alcance em todos os lugares
  - [ ] Garantir que projéteis respeitam `maxDistance` escalado

### Prioridade Baixa 🟢

- [ ] **5. Type Effectiveness no Servidor** (verificação)
- [ ] **7. Broadcast de Windup para Clientes**
- [ ] **8. Validação de Windup em Ataques de Criaturas** (verificação)

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

**Última atualização:** Após implementação de windup de ataques básicos
**Próxima revisão:** Após implementação de windup de skills
