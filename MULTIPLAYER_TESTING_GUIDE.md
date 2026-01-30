# Guia de Testes: Features Multiplayer Completas

**Data**: 29/01/2026  
**Versão**: 1.0  
**Status**: 📋 **PRONTO PARA TESTES**

## 🎯 Objetivo

Validar que todos os sistemas implementados funcionam corretamente em multiplayer, com sincronização perfeita e sem trapaças possíveis.

---

## 🚀 Configuração de Teste

### Requisitos
- 2+ clientes (navegadores diferentes ou abas)
- Servidor rodando (`npm run dev` em `server/`)
- Cliente rodando (`npm run dev` na raiz)

### Iniciar Servidor
```bash
cd server
npm run dev
```

### Iniciar Cliente
```bash
npm run dev
```

### Conectar Clientes
1. Abrir `http://localhost:5173/?mp=1` no navegador 1
2. Abrir `http://localhost:5173/?mp=1` no navegador 2
3. Entrar com nomes diferentes
4. Ambos devem entrar na mesma sala

---

## 🧪 Suíte de Testes

### ✅ Teste 1: Coleta de Recursos (Server-Authoritative)

#### Objetivo
Validar que apenas um jogador pode coletar cada recurso e que a remoção é sincronizada.

#### Passos
1. **Jogador A e B** entram na expedição
2. **Ambos** se movem em direção ao mesmo recurso
3. **Jogador A** chega primeiro e coleta
4. **Jogador B** tenta coletar o mesmo recurso

#### Resultado Esperado
- ✅ Recurso desaparece para **ambos** os jogadores após coleta
- ✅ Apenas **Jogador A** recebe o recurso no inventário
- ✅ **Jogador B** não consegue coletar (recurso já foi removido)
- ✅ Console do servidor mostra log de coleta

#### Resultado Anterior (Bug)
- ❌ Ambos coletavam o mesmo recurso
- ❌ Recurso era duplicado

#### Como Verificar
```
Console do Servidor:
[Room:xxx] Recurso coletado: jogador player-1 coletou 1x resource-ferro-cristalino (res-5)

Console do Cliente A:
Recurso coletado: +1 Ferro

Console do Cliente B:
(nada - recurso já foi removido)
```

---

### ✅ Teste 2: Dano de Contato (Server-Authoritative)

#### Objetivo
Validar que jogadores tomam dano contínuo ao tocar em criaturas.

#### Passos
1. **Jogador A** entra na expedição
2. **Jogador A** se move até encostar em uma criatura
3. **Jogador A** permanece em contato por 5 segundos
4. **Jogador B** observa o HP do **Jogador A**

#### Resultado Esperado
- ✅ **Jogador A** toma dano contínuo (visível na barra de HP)
- ✅ Dano varia por tier:
  - Comum: ~5 HP/segundo
  - Perigosa: ~12 HP/segundo
  - Elite: ~25 HP/segundo
- ✅ **Jogador B** vê a barra de HP do **Jogador A** diminuindo
- ✅ Console do servidor mostra logs de dano

#### Resultado Anterior (Bug)
- ❌ Dano de contato não existia em multiplayer
- ❌ Jogadores podiam ignorar criaturas

#### Como Verificar
```
Console do Servidor:
[Room:xxx] Dano aplicado: 5 de wild-3 em jogador player-1 (HP: 95/100)
[Room:xxx] Dano aplicado: 5 de wild-3 em jogador player-1 (HP: 90/100)
...

Console do Cliente A:
HP diminuindo continuamente
Barra de HP vermelha piscando

Console do Cliente B:
Vê barra de HP do Jogador A diminuindo
```

---

### ✅ Teste 3: Skills - Criação e Sincronização

#### Objetivo
Validar que skill zones são criadas no servidor e sincronizadas para todos os clientes.

#### Passos
1. **Jogador A** entra na expedição
2. **Jogador A** usa skill (ex: Nevoeiro de Fogo - tecla 1)
3. **Jogador B** observa

#### Resultado Esperado
- ✅ **Jogador A** vê zona de skill aparecer
- ✅ **Jogador B** vê a mesma zona de skill
- ✅ Zona persiste pelo tempo de vida (4s para fire_fog)
- ✅ Zona desaparece automaticamente após expirar
- ✅ Console do servidor mostra criação da zona

#### Resultado Anterior (Bug)
- ❌ Skill zones eram criadas apenas no cliente
- ❌ Outros jogadores não viam as skills

#### Como Verificar
```
Console do Servidor:
[Room:xxx] Skill zone criada: skill-zone-0 (fire_fog) por player-1 em (300, 200)

Console do Cliente A:
Zona de fogo aparece em (300, 200)
Partículas de fogo visíveis

Console do Cliente B:
Zona de fogo aparece em (300, 200)
Partículas de fogo visíveis
```

---

### ✅ Teste 4: Skills - Dano em Criaturas

#### Objetivo
Validar que skill zones aplicam dano periódico em criaturas dentro da zona.

#### Passos
1. **Jogador A** usa skill próximo a uma criatura
2. Criatura fica dentro da zona de skill
3. Observar HP da criatura

#### Resultado Esperado
- ✅ Criatura toma dano a cada tick (0.5s para fire_fog)
- ✅ Dano é visível na barra de HP da criatura
- ✅ Criatura morre se HP chegar a 0
- ✅ Ambos os jogadores veem o dano
- ✅ Console do servidor mostra dano aplicado

#### Como Verificar
```
Console do Servidor:
[Room:xxx] Dano aplicado: 8 de player-1 em criatura wild-5 (HP: 22/30)
[Room:xxx] Dano aplicado: 8 de player-1 em criatura wild-5 (HP: 14/30)
[Room:xxx] Dano aplicado: 8 de player-1 em criatura wild-5 (HP: 6/30 - MORTO)

Console dos Clientes:
Barra de HP da criatura diminuindo
Criatura desaparece quando HP = 0
```

---

### ✅ Teste 5: Skills - Cooldown

#### Objetivo
Validar que jogadores não podem usar skills em sequência (cooldown de 8s).

#### Passos
1. **Jogador A** usa skill
2. **Jogador A** tenta usar skill novamente imediatamente
3. **Jogador A** espera 8 segundos
4. **Jogador A** tenta usar skill novamente

#### Resultado Esperado
- ✅ Primeira skill funciona
- ✅ Segunda tentativa falha (cooldown)
- ✅ Terceira tentativa funciona (após 8s)
- ✅ Console do servidor mostra falha por cooldown

#### Como Verificar
```
Console do Servidor:
[Room:xxx] Skill zone criada: skill-zone-0 (fire_fog) por player-1
[Room:xxx] Skill falhou: jogador player-1, tipo fire_fog, razão: cooldown
(após 8s)
[Room:xxx] Skill zone criada: skill-zone-1 (fire_fog) por player-1

Console do Cliente:
Primeira skill: zona aparece
Segunda tentativa: nada acontece (cooldown)
Terceira tentativa: zona aparece novamente
```

---

### ✅ Teste 6: Múltiplos Sistemas Simultâneos

#### Objetivo
Validar que todos os sistemas funcionam simultaneamente sem conflitos.

#### Passos
1. **Jogador A** coleta recursos
2. **Jogador B** usa skill
3. **Jogador A** toma dano de contato
4. **Jogador B** ataca criatura
5. Observar sincronização

#### Resultado Esperado
- ✅ Recursos coletados desaparecem para ambos
- ✅ Skill zone visível para ambos
- ✅ Dano de contato aplicado corretamente
- ✅ Ataque de projétil funciona
- ✅ Sem lag ou dessincronia
- ✅ Console do servidor mostra todos os eventos

#### Como Verificar
```
Console do Servidor:
[Room:xxx] Recurso coletado: jogador player-1 coletou 1x resource-ferro
[Room:xxx] Skill zone criada: skill-zone-0 (fire_fog) por player-2
[Room:xxx] Dano aplicado: 5 de wild-3 em jogador player-1
[Room:xxx] Ataque de player-2 criou projétil proj-15

Console dos Clientes:
Todos os eventos visíveis simultaneamente
Sem travamentos ou dessincronia
```

---

## 📊 Checklist de Validação

### Coleta de Recursos
- [ ] Apenas um jogador coleta cada recurso
- [ ] Recurso desaparece para todos após coleta
- [ ] Inventário atualizado corretamente
- [ ] Broadcast de `resourcesUpdate` funciona

### Dano de Contato
- [ ] Dano aplicado continuamente ao tocar criatura
- [ ] Dano varia por tier (comum/perigosa/elite)
- [ ] Ambos os jogadores veem HP diminuindo
- [ ] Broadcast de dano funciona

### Skills
- [ ] Zona criada no servidor
- [ ] Zona visível para todos os jogadores
- [ ] Dano periódico aplicado em criaturas
- [ ] Cooldown de 8s funciona
- [ ] Zona expira automaticamente
- [ ] Broadcast de `skillZonesUpdate` funciona

### Sincronização Geral
- [ ] Sem lag perceptível
- [ ] Sem dessincronia entre clientes
- [ ] Todos os eventos visíveis para todos
- [ ] Console do servidor mostra todos os eventos

---

## 🐛 Problemas Conhecidos

### Se recursos não desaparecem
- Verificar se `onResourceCollected` está sendo chamado
- Verificar se `resourcesUpdate` está sendo broadcast
- Verificar console do servidor para erros

### Se dano de contato não funciona
- Verificar se `applyContactDamage` está no `updateWorld`
- Verificar se `THREAT_TIERS` está importado
- Verificar console do servidor para logs de dano

### Se skills não aparecem
- Verificar se `onSkillZoneCreated` está sendo chamado
- Verificar se `skillZonesUpdate` está sendo broadcast
- Verificar console do servidor para criação de zonas

---

## 📝 Relatório de Bugs

Se encontrar bugs, documente:

```markdown
### Bug: [Título]
**Severidade**: Alta/Média/Baixa
**Sistema**: Recursos/Dano/Skills

**Passos para Reproduzir**:
1. ...
2. ...
3. ...

**Resultado Esperado**:
...

**Resultado Atual**:
...

**Console do Servidor**:
```
...
```

**Console do Cliente**:
```
...
```

**Screenshots**:
(se aplicável)
```

---

## ✅ Critérios de Sucesso

Para considerar os testes bem-sucedidos:

1. ✅ Todos os 6 testes passam sem erros
2. ✅ Sincronização perfeita entre clientes
3. ✅ Zero trapaças possíveis
4. ✅ Console do servidor sem erros
5. ✅ Performance aceitável (sem lag)

---

## 🎉 Próximos Passos Após Testes

### Se Testes Passarem
1. Marcar Fase 10 como completa
2. Atualizar documentação
3. Preparar para deploy
4. Testar com mais jogadores (4-12)

### Se Testes Falharem
1. Documentar bugs encontrados
2. Priorizar correções
3. Implementar fixes
4. Re-testar

---

## 📚 Documentação Relacionada

- `MULTIPLAYER_COMPLETE_FEATURES_SUMMARY.md` - Resumo da implementação
- `MULTIPLAYER_CLIENT_SERVER_AUDIT.md` - Auditoria original
- `server/src/systems/resources.ts` - Sistema de recursos
- `server/src/systems/skills.ts` - Sistema de skills
- `server/src/systems/combat.ts` - Sistema de combate (com dano de contato)

---

**Boa sorte com os testes! 🚀**
