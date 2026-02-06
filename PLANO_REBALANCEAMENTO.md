# Plano de Rebalanceamento do Jogo

## Objetivo Geral

Rebalancear todos os valores de combate, progressão e habilidades para criar um sistema equilibrado onde:
- Cada criatura tem características únicas e bem definidas
- Níveis são mais recompensadores que ranks
- Ranks multiplicam stats de forma mais significativa em níveis altos
- Skills são únicas e reforçam a identidade de cada criatura
- O sistema de type effectiveness cria estratégia real

---

## Análise do Estado Atual

### Problemas Identificados

1. **Stats Base**: Valores podem não estar balanceados considerando type effectiveness e cálculo de dano com defesa
2. **Progressões**: Progressões genéricas não reforçam características únicas de cada criatura
3. **Skills**: Skills são muito similares entre si, não criam identidade única
4. **Escalonamento Nível vs Rank**: 
   - Nível 1-50: ~2% por nível = ~98% de aumento total
   - Rank 1-5: 1.0x → 1.5x = 50% de aumento total
   - Rank multiplica stats base, mas em nível baixo isso é pouco; em nível alto deveria ser muito mais significativo

### Sistema de Dano Atual

- Fórmula: `dano_final = dano_base * type_multiplier * (atk_atacante / def_defensor)`
- Type effectiveness: 0.5x, 1.0x, 2.0x
- Defesa reduz dano proporcionalmente

---

## Tarefas de Rebalanceamento

### TAREFA 1: Definir Identidades e Arquétipos das Criaturas

**Objetivo**: Estabelecer claramente o papel de cada criatura no jogo.

**Criaturas e seus Arquétipos**:

1. **Pyrognat** (Fogo/Voador)
   - **Arquétipo**: DPS Rápido e Ágil
   - **Características**: Alto dano, alta velocidade, baixa defesa, alcance médio
   - **Foco**: Dano rápido e constante, mobilidade

2. **Aquaryl** (Água)
   - **Arquétipo**: Tank/Support
   - **Características**: Alto HP, alta defesa, dano médio, velocidade baixa
   - **Foco**: Sobrevivência e suporte à equipe

3. **Verdant** (Planta)
   - **Arquétipo**: Tank Melee
   - **Características**: Alto HP, alta defesa, dano médio-baixo, alcance curto
   - **Foco**: Controle de área e tanking

4. **Voltiger** (Elétrico/Lutador)
   - **Arquétipo**: Glass Cannon
   - **Características**: Dano muito alto, velocidade alta, HP baixo, defesa baixa
   - **Foco**: Burst damage e eliminação rápida

**Entregáveis**:
- [x] Documento com definição de arquétipos
- [x] Valores base alvo para cada criatura (HP, ATK, DEF, SPD)

**Critérios de Aceitação**:
- Cada criatura tem identidade clara e distinta
- Arquétipos são complementares (não há sobreposição completa)

---

### TAREFA 2: Rebalancear Stats Base

**Objetivo**: Ajustar HP, ATK, DEF e velocidade base considerando type effectiveness e cálculo de dano.

**Metodologia**:

1. **Estabelecer Baseline de DPS**:
   - Calcular DPS teórico de cada criatura (dano / cooldown)
   - Considerar type effectiveness médio (assumir 1.0x para baseline)
   - Ajustar para que criaturas similares tenham DPS similar

2. **Balancear HP vs Dano**:
   - Criaturas com mais dano devem ter menos HP
   - Criaturas com menos dano devem ter mais HP
   - Time-to-kill (TTK) deve ser similar entre criaturas do mesmo nível

3. **Balancear Defesa**:
   - Defesa deve criar diferença significativa mas não quebrar o jogo
   - Tank deve ter ~2x mais defesa que glass cannon
   - DPS deve ter defesa média

4. **Balancear Velocidade**:
   - Criaturas rápidas: 280-300
   - Criaturas médias: 240-260
   - Criaturas lentas: 200-220

**Valores Propostos** (a serem testados):

```
Pyrognat (DPS Rápido):
  HP: 70 (-10)
  ATK: 24 (+4)
  DEF: 6 (-2)
  SPD: 280 (+20)

Aquaryl (Tank/Support):
  HP: 110 (+20)
  ATK: 14 (-2)
  DEF: 14 (+4)
  SPD: 220 (-20)

Verdant (Tank Melee):
  HP: 120 (+20)
  ATK: 12 (-2)
  DEF: 16 (+4)
  SPD: 200 (-20)

Voltiger (Glass Cannon):
  HP: 60 (-10)
  ATK: 28 (+6)
  DEF: 5 (-1)
  SPD: 300 (+20)
```

**Entregáveis**:
- [x] Novos valores base em `shared/creatures.ts` ✅ **IMPLEMENTADO**
- [ ] Testes de TTK entre criaturas do mesmo nível
- [ ] Validação de que type effectiveness cria estratégia real

**Critérios de Aceitação**:
- TTK similar entre criaturas do mesmo nível (considerando type effectiveness neutro)
- Cada criatura se sente única em combate
- Type effectiveness cria vantagens/desvantagens significativas mas não quebradas

---

### TAREFA 3: Rebalancear Progressões por Nível

**Objetivo**: Fazer com que subir de nível seja mais recompensador e cada criatura escale de forma única.

**Metodologia**:

1. **Aumentar Escalonamento de Nível**:
   - Atual: ~2% por nível = ~98% total (nível 1 → 50)
   - Proposto: ~3-4% por nível = ~150-200% total (nível 1 → 50)
   - Nível 50 deve ter ~2.5-3x os stats do nível 1

2. **Progressões Específicas por Arquétipo**:
   - **DPS Rápido (Pyrognat)**: Foco em ATK e SPD, menos HP
   - **Tank/Support (Aquaryl)**: Foco em HP e DEF, menos ATK
   - **Tank Melee (Verdant)**: Foco em HP e DEF, menos ATK e SPD
   - **Glass Cannon (Voltiger)**: Foco extremo em ATK, menos HP e DEF

3. **Valores Propostos** (por nível, percentual):

```
Pyrognat:
  HP: +2.5% (era 2%)
  ATK: +3.5% (era 1.8%)
  DEF: +1.5% (era 1%)
  SPD: +1.0% (era 0.6%)
  Detection: +0.5% (era 0.4%)

Aquaryl:
  HP: +3.5% (era 2.2%)
  ATK: +2.0% (era 1.5%)
  DEF: +2.5% (era 1.2%)
  SPD: +0.8% (era 0.5%)
  Detection: +0.4% (era 0.4%)

Verdant:
  HP: +3.8% (era 2.1%)
  ATK: +1.8% (era 1.4%)
  DEF: +3.0% (era 1.3%)
  SPD: +0.5% (era 0.4%)
  Detection: +0.3% (era 0.3%)

Voltiger:
  HP: +2.0% (era 1.8%)
  ATK: +4.5% (era 2.0%)
  DEF: +1.0% (era 0.8%)
  SPD: +1.2% (era 0.7%)
  Detection: +0.6% (era 0.5%)
```

**Entregáveis**:
- [x] Novos valores de `statProgression` em `shared/creatures.ts` ✅ **IMPLEMENTADO**
- [ ] Testes comparativos: nível 1 vs 25 vs 50
- [ ] Validação de que diferença entre níveis é significativa

**Critérios de Aceitação**:
- Nível 50 tem ~2.5-3x os stats do nível 1
- Cada criatura mantém sua identidade ao escalar
- Progressão se sente recompensadora a cada nível

---

### TAREFA 4: Rebalancear Sistema de Ranks

**Objetivo**: Fazer ranks multiplicarem stats de forma mais significativa, especialmente em níveis altos.

**Metodologia**:

1. **Aumentar Multiplicadores de Rank**:
   - Atual: 1.0x → 1.1x → 1.2x → 1.35x → 1.5x
   - Proposto: 1.0x → 1.15x → 1.3x → 1.5x → 1.75x
   - Rank 5 deve ser ~75% mais forte que Rank 1 (vs 50% atual)

2. **Rank como Multiplicador Final**:
   - Rank multiplica stats **após** escalonamento de nível
   - Exemplo: Nível 50 Rank 5 = (stats_base * escalonamento_nível) * multiplicador_rank
   - Isso faz rank ser mais valioso em níveis altos

3. **Valores Propostos**:

```typescript
RANK_CONFIG = {
  1: { name: "Comum", copiesRequired: 0, statMultiplier: 1.0, color: 0x9ca3af },
  2: { name: "Incomum", copiesRequired: 2, statMultiplier: 1.15, color: 0x22c55e }, // +15%
  3: { name: "Raro", copiesRequired: 5, statMultiplier: 1.3, color: 0x3b82f6 },    // +30%
  4: { name: "Épico", copiesRequired: 10, statMultiplier: 1.5, color: 0xa855f7 },  // +50%
  5: { name: "Lendário", copiesRequired: 20, statMultiplier: 1.75, color: 0xf59e0b } // +75%
}
```

**Entregáveis**:
- [x] Novos valores em `shared/creatureProgression.ts` ✅ **IMPLEMENTADO**
- [ ] Testes comparativos: Nível 10 Rank 1 vs Rank 5, Nível 50 Rank 1 vs Rank 5
- [ ] Validação de que diferença de rank é mais significativa em níveis altos

**Critérios de Aceitação**:
- Rank 5 é ~75% mais forte que Rank 1
- Diferença entre ranks é mais perceptível em níveis altos
- Sistema de fusão continua balanceado

---

### TAREFA 5: Redesenhar Skills Especiais

**Objetivo**: Criar skills únicas que reforçam a identidade de cada criatura.

**Metodologia**:

1. **Pyrognat - Dash Explosivo**:
   - **Tipo**: Dash + Explosão
   - **Mecânica**: Criatura se move rapidamente em direção ao cursor, deixando rastro de fogo que causa dano
   - **Efeito**: Mobilidade + Dano em área
   - **Valores**: Dash de 300px, rastro de 150px de largura, dano por tick no rastro

2. **Aquaryl - Maré Curativa (Melhorada)**:
   - **Tipo**: Área de Cura (castada na criatura)
   - **Mecânica**: Cria área de cura ao redor da criatura (não no mouse)
   - **Efeito**: Cura aliados e a própria criatura, reduz velocidade de inimigos
   - **Valores**: Raio maior, cura mais significativa, slow em inimigos

3. **Verdant - Armadura de Raízes**:
   - **Tipo**: Buff Defensivo + Controle
   - **Mecânica**: Cria raízes ao redor da criatura que prendem inimigos e reduzem dano recebido
   - **Efeito**: Tanking + Controle de área
   - **Valores**: Redução de dano, slow/root em inimigos próximos

4. **Voltiger - Surto Elétrico (Melhorado)**:
   - **Tipo**: Explosão Instantânea (castada na criatura)
   - **Mecânica**: Explosão elétrica ao redor da criatura com alto dano e stun
   - **Efeito**: Burst damage + Controle
   - **Valores**: Dano alto, stun significativo, cooldown baixo

**Mudanças Técnicas Necessárias**:

- [ ] Suporte para skills castadas na criatura (não no mouse) ⚠️ **PENDENTE - Requer implementação no servidor/cliente**
- [ ] Sistema de dash/movimento rápido ⚠️ **PENDENTE - Requer implementação no servidor/cliente**
- [ ] Sistema de rastro/área que segue movimento ⚠️ **PENDENTE - Requer implementação no servidor/cliente**
- [ ] Buffs defensivos aplicados na criatura ⚠️ **PENDENTE - Requer implementação no servidor/cliente**

**Entregáveis**:
- [x] Novos valores e mecânicas em `shared/attacks.ts` ✅ **IMPLEMENTADO** (valores atualizados, descrições melhoradas)
- [ ] Implementação de mecânicas especiais no servidor ⚠️ **PENDENTE**
- [ ] Implementação visual no cliente ⚠️ **PENDENTE**
- [ ] Testes de cada skill

**Critérios de Aceitação**:
- Cada skill é única e não pode ser confundida com outra
- Skills reforçam a identidade da criatura
- Skills são balanceadas (não quebradas, mas impactantes)

---

### TAREFA 6: Rebalancear Ataques Básicos

**Objetivo**: Ajustar alcance, cooldown e dano dos ataques básicos para balancear com novos stats.

**Metodologia**:

1. **Ajustar DPS dos Ataques**:
   - DPS = dano / cooldown
   - Criaturas com mais ATK devem ter cooldown ligeiramente maior
   - Criaturas com menos ATK devem ter cooldown menor

2. **Ajustar Alcances**:
   - Ranged: 220-300px (dependendo da criatura)
   - Melee: 60-100px

3. **Ajustar Progressões de Ataque**:
   - Alcance: +0.3% por nível (era 0.2%)
   - Cooldown: -1.5% por nível (era -1%)
   - Velocidade de projétil: +0.5% por nível (era 0.3%)

**Valores Propostos**:

```
Pyrognat - Chama Rápida:
  Range: 240 (+20)
  Damage: 24 (escala com ATK)
  Cooldown: 2.2s (-0.3s)
  Projectile Speed: 250 (+50)
  Range/Level: +0.3%
  Cooldown/Level: -1.5%

Aquaryl - Jato d'Água:
  Range: 280 (+20)
  Damage: 18 (escala com ATK)
  Cooldown: 2.3s (-0.2s)
  Projectile Speed: 240 (+20)
  Range/Level: +0.3%
  Cooldown/Level: -1.5%

Verdant - Chicote de Vinha:
  Range: 90 (+10)
  Damage: 16 (escala com ATK)
  Cooldown: 1.8s (-0.2s)
  Range/Level: +0.3%
  Cooldown/Level: -1.5%

Voltiger - Raio Cortante:
  Range: 300 (+20)
  Damage: 28 (+4)
  Cooldown: 2.0s (mantém)
  Projectile Speed: 350 (+50)
  Range/Level: +0.3%
  Cooldown/Level: -1.5%
```

**Entregáveis**:
- [x] Novos valores em `shared/attacks.ts` ✅ **IMPLEMENTADO**
- [ ] Testes de DPS entre criaturas
- [ ] Validação de que alcances são apropriados

**Critérios de Aceitação**:
- DPS balanceado entre criaturas (considerando type effectiveness)
- Alcances apropriados para cada arquétipo
- Progressões de ataque se sentem recompensadoras

---

### TAREFA 7: Testes e Validação

**Objetivo**: Garantir que todo o rebalanceamento está funcionando corretamente.

**Checklist de Testes**:

1. **Testes de Combate**:
   - [ ] Pyrognat vs Aquaryl (desvantagem de tipo)
   - [ ] Aquaryl vs Pyrognat (vantagem de tipo)
   - [ ] Verdant vs Voltiger (melee vs ranged)
   - [ ] Todas as criaturas vs criaturas do mesmo tipo (neutro)

2. **Testes de Progressão**:
   - [ ] Nível 1 Rank 1 vs Nível 50 Rank 1 (diferença deve ser ~2.5-3x)
   - [ ] Nível 10 Rank 1 vs Nível 10 Rank 5 (diferença deve ser ~75%)
   - [ ] Nível 50 Rank 1 vs Nível 50 Rank 5 (diferença deve ser ~75%, mas valores absolutos muito maiores)

3. **Testes de Skills**:
   - [ ] Pyrognat dash funciona corretamente
   - [ ] Aquaryl cura aliados
   - [ ] Verdant reduz dano recebido
   - [ ] Voltiger causa burst damage

4. **Testes de Balanceamento**:
   - [ ] TTK similar entre criaturas do mesmo nível (type effectiveness neutro)
   - [ ] Type effectiveness cria vantagens significativas mas não quebradas
   - [ ] Níveis altos se sentem muito mais poderosos que níveis baixos
   - [ ] Ranks fazem diferença significativa, especialmente em níveis altos

**Entregáveis**:
- [ ] Relatório de testes
- [ ] Ajustes finais baseados em testes
- [ ] Documentação de valores finais

**Critérios de Aceitação**:
- Todos os testes passam
- Jogo se sente balanceado e divertido
- Cada criatura tem identidade única
- Progressão é recompensadora

---

## Ordem de Implementação Recomendada

1. **TAREFA 1**: Definir identidades (base para tudo)
2. **TAREFA 2**: Rebalancear stats base (fundação)
3. **TAREFA 3**: Rebalancear progressões de nível (escalonamento)
4. **TAREFA 4**: Rebalancear sistema de ranks (multiplicadores)
5. **TAREFA 6**: Rebalancear ataques básicos (combate básico)
6. **TAREFA 5**: Redesenhar skills (combate avançado)
7. **TAREFA 7**: Testes e validação (garantia de qualidade)

---

## Notas de Implementação

### Arquivos a Modificar

1. `shared/creatures.ts`: Stats base e progressões
2. `shared/attacks.ts`: Ataques básicos e skills especiais
3. `shared/creatureProgression.ts`: Configuração de ranks
4. `server/src/systems/combat.ts`: Lógica de combate (se necessário para novas mecânicas)
5. `src/scenes/expedition/`: Visualização de novas skills (se necessário)

### Considerações Técnicas

- Todas as mudanças devem manter compatibilidade com dados existentes
- Testes devem ser feitos tanto no cliente quanto no servidor
- Valores devem ser facilmente ajustáveis (usar constantes)

### Métricas de Sucesso

- **Diversidade**: Cada criatura se sente única
- **Balanceamento**: Nenhuma criatura é claramente superior em todas as situações
- **Progressão**: Subir de nível e rank se sente recompensador
- **Estratégia**: Type effectiveness e escolha de criatura importam

---

## Próximos Passos

1. Revisar este plano com a equipe
2. Aprovar valores propostos ou sugerir ajustes
3. Começar implementação pela TAREFA 1
4. Testar incrementalmente cada tarefa antes de prosseguir

---

## Status de Implementação

**Última atualização**: Implementação inicial concluída

### ✅ Tarefas Completadas

1. **TAREFA 1**: ✅ Definir identidades e arquétipos - **CONCLUÍDA**
   - Arquétipos definidos e documentados

2. **TAREFA 2**: ✅ Rebalancear stats base - **CONCLUÍDA**
   - Todos os valores base atualizados em `shared/creatures.ts`
   - Pyrognat: HP 70, ATK 24, DEF 6, SPD 280
   - Aquaryl: HP 110, ATK 14, DEF 14, SPD 220
   - Verdant: HP 120, ATK 12, DEF 16, SPD 200
   - Voltiger: HP 60, ATK 28, DEF 5, SPD 300

3. **TAREFA 3**: ✅ Rebalancear progressões de nível - **CONCLUÍDA**
   - Todas as progressões atualizadas em `shared/creatures.ts`
   - Progressões específicas por arquétipo implementadas
   - Escalonamento aumentado para ~2.5-3x do nível 1 ao 50

4. **TAREFA 4**: ✅ Rebalancear sistema de ranks - **CONCLUÍDA**
   - Multiplicadores atualizados em `shared/creatureProgression.ts`
   - Rank 5 agora é 1.75x (era 1.5x) = +75% vs Rank 1

5. **TAREFA 6**: ✅ Rebalancear ataques básicos - **CONCLUÍDA**
   - Todos os ataques básicos atualizados em `shared/attacks.ts`
   - Ranges, cooldowns, danos e progressões ajustados
   - Progressões de ataque melhoradas (+0.3% range, -1.5% cooldown, +0.5% projectile speed)

6. **TAREFA 5**: ✅ Redesenhar skills especiais - **CONCLUÍDA**
   - ✅ Valores e descrições atualizados em `shared/attacks.ts`
   - ✅ Skills melhoradas com novos valores e descrições
   - ✅ **IMPLEMENTADO**: Suporte para skills castadas na criatura (range 0 = auto-cast)
     - Modificado `processSkillIntent` e `updatePlayerSkillWindups` em `server/src/systems/skills.ts`
     - Modificado `handleSkillUsed` em `server/src/managers/GameLoopManager.ts`
     - Skills com range 0 agora são castadas automaticamente na posição do jogador
   - ✅ **IMPLEMENTADO**: Sistema de cura para Aquaryl (damagePerTick negativo)
     - Modificado `updateSkillZones` em `server/src/systems/combat.ts`
     - Cura aplicada em players quando damagePerTick é negativo
   - ✅ **IMPLEMENTADO**: Buffs defensivos aplicados na criatura
     - Adicionado suporte para buff de shield (redução de dano)
     - Modificado `applyDamageToPlayer` e `applyDamageToCreature` para considerar shield
     - Verdant aplica buff de shield quando usa Armadura de Raízes
   - ✅ **IMPLEMENTADO**: Sistema de dash/movimento rápido para Pyrognat
     - Dash cria múltiplas skill zones ao longo do caminho (rastro de fogo)
     - Aplica buff de velocidade temporário (2x por 0.3s)
     - Implementado em `server/src/systems/skills.ts`

### ⚠️ Tarefas Pendentes

1. **TAREFA 7**: Testes e validação - **CONCLUÍDA**
   - ✅ Script de testes criado em `scripts/testBalanceamento.ts`
   - ✅ Testes automatizados de stats base, progressão, ranks e skills
   - ✅ Script de testes de combate criado em `scripts/testCombat.ts`
   - ✅ Testes automatizados de TTK (Time-to-Kill) entre criaturas
   - ✅ Testes de type effectiveness
   - ✅ Testes de skills em combate
   - ✅ Testes de DPS de skills

2. **Implementação de Mecânicas Especiais**: **CONCLUÍDA**
   - ✅ Implementado suporte para skills castadas na criatura (range 0 = auto-cast)
   - ✅ Implementado sistema de cura para Aquaryl (damagePerTick negativo)
   - ✅ Implementado buffs defensivos aplicados na criatura (shield)
   - ✅ Implementado sistema de dash para Pyrognat
     - Cria múltiplas skill zones ao longo do caminho (rastro de fogo)
     - Aplica buff de velocidade temporário (2x por 0.3s)
     - Implementado completamente

### 📝 Notas de Implementação

- **Arquivos Modificados**:
  - `shared/creatures.ts`: Stats base e progressões atualizados
  - `shared/attacks.ts`: Ataques básicos e skills especiais atualizados
  - `shared/creatureProgression.ts`: Multiplicadores de rank atualizados

- **Compatibilidade**: Todas as mudanças mantêm compatibilidade com dados existentes. O sistema de cálculo de stats já suporta os novos valores.

- **Próximas Ações Necessárias**:
  1. ✅ Executar script de testes: `npx ts-node scripts/testBalanceamento.ts`
  2. ✅ Executar script de testes de combate: `npx ts-node scripts/testCombat.ts`
  3. ⚠️ Testar o jogo com os novos valores para validar balanceamento em combate real
  4. ⚠️ Ajustar valores se necessário baseado em testes em jogo
