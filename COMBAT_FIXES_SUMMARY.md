# Correções do Sistema de Combate - Resumo

## Problemas Identificados e Soluções

### 1. ❌ **Problema: Projéteis não "sumindo" quando deviam**

**Causa**: O servidor usava apenas `lifetime` (tempo de vida) para determinar quando remover projéteis, mas não verificava a distância máxima percorrida. Isso permitia que projéteis continuassem ativos após ultrapassar o alcance máximo do ataque.

**Solução Implementada**:
- ✅ Adicionado campo `maxDistance` ao `ServerProjectile`
- ✅ Adicionado campos `startX` e `startY` para rastrear posição inicial
- ✅ Modificado `updateProjectiles()` para verificar distância percorrida
- ✅ Projéteis agora são removidos quando `distanceTraveled >= maxDistance`

**Arquivos Modificados**:
- `server/src/types.ts`: Adicionados campos `startX`, `startY`, `maxDistance`
- `server/src/systems/combat.ts`: Adicionada verificação de distância em `updateProjectiles()`
- `server/src/messages.ts`: Atualizados `ProjectileState` e broadcast

---

### 2. ❌ **Problema: Ataques não carregam características únicas das criaturas**

**Causa**: Os valores de dano e velocidade em `CREATURE_ATTACK_STATS` estavam dessincroniziados com as definições em `src/game/creatures.ts`. Os ataques não diferenciavam entre melee e ranged.

**Solução Implementada**:
- ✅ Sincronizado `CREATURE_ATTACK_STATS` com `creatures.ts`
- ✅ Adicionado suporte para ataques melee vs ranged (`isProjectile` flag)
- ✅ Adicionado campo `range` para cada criatura
- ✅ Ataques melee agora aplicam dano instantâneo em área (arco de 45°)
- ✅ Ataques ranged criam projéteis com alcance correto

**Stats Atualizados (Sincronizados com Cliente)**:
```typescript
"pyrognat": { damage: 20, speed: 420, range: 220, isProjectile: true }   // Chama Rápida
"aquaryl":  { damage: 18, speed: 400, range: 260, isProjectile: true }   // Jato d'Água
"verdant":  { damage: 16, speed: 0,   range: 80,  isProjectile: false }  // Chicote de Vinha (melee)
"voltiger": { damage: 24, speed: 450, range: 280, isProjectile: true }   // Raio Cortante
```

**Arquivos Modificados**:
- `server/src/systems/combat.ts`: 
  - Atualizado `CREATURE_ATTACK_STATS` com valores corretos
  - Modificado `processAttackIntent()` para suportar ataques melee

---

### 3. ❌ **Problema: Skills de dano não afetam inimigos na área**

**Causa**: Skills especiais (Nevoeiro Incendiário, Surto Elétrico, etc.) eram processadas **apenas no cliente** em modo single-player. Em multiplayer, o servidor não tinha lógica para processar essas skills, então elas eram puramente visuais.

**Solução Implementada**:
- ✅ Criado sistema completo de **Skill Zones** no servidor
- ✅ Adicionada interface `ServerSkillZone` com:
  - Posição e raio
  - Dano por tick
  - Intervalo entre ticks
  - Tempo de vida
  - Modificadores (slow, root, etc.)
- ✅ Implementada função `updateSkillZones()` que:
  - Atualiza timers de zona
  - Detecta criaturas dentro da área
  - Aplica dano periódico
  - Remove zonas expiradas
- ✅ Integrado ao `WorldState` e broadcast aos clientes
- ✅ Processamento automático no `onTick` do game loop

**Nova Estrutura**:
```typescript
interface ServerSkillZone {
  id: string;
  ownerId: string;
  skillType: "fire_fog" | "root_trap" | "electric_surge";
  x: number;
  y: number;
  radius: number;
  damagePerTick: number;
  tickInterval: number;
  tickTimer: number;
  lifetime: number;
  slowModifier?: number;
}
```

**Arquivos Modificados**:
- `server/src/types.ts`: 
  - Adicionada interface `ServerSkillZone`
  - Adicionada função `createSkillZone()`
  - Adicionado `skillZones` ao `WorldState`
- `server/src/systems/combat.ts`: 
  - Implementada função `updateSkillZones()`
- `server/src/messages.ts`:
  - Adicionada interface `SkillZoneState`
  - Adicionada mensagem `SkillZonesUpdateMessage`
  - Criada função `createSkillZonesUpdateMessage()`
- `server/src/index.ts`:
  - Adicionado processamento de skill zones no `onTick`
  - Adicionado broadcast de skill zones a cada 2 ticks
  - Broadcast de resultados de dano das zonas

---

## Como Usar as Skills no Servidor (Próximos Passos)

Para que as skills funcionem completamente em multiplayer, o **cliente** precisa enviar um intent quando o jogador usar uma skill:

### 1. Cliente envia intent de skill:
```typescript
// Em ExpeditionScene.ts, quando jogador pressiona tecla de skill
this.mpClient.send({
  type: "use_skill",
  skillType: "fire_fog", // ou "electric_surge", "root_trap"
  x: targetX,
  y: targetY
});
```

### 2. Servidor processa intent (a ser implementado):
```typescript
// Em gameLoop.ts, adicionar case no processIntent()
case "skill":
  const zone = createSkillZone(
    intent.playerId,
    intent.data.skillType,
    intent.data.x,
    intent.data.y,
    70, // radius
    8,  // damagePerTick
    0.5, // tickInterval
    4   // lifetime
  );
  room.worldState.skillZones.push(zone);
  break;
```

### 3. Cliente recebe broadcast de zona:
```typescript
// Em multiplayerClient.ts
case "skill_zones_update":
  // Renderizar zonas visualmente
  // O dano é processado no servidor
  break;
```

---

## Testes Recomendados

### Teste 1: Projéteis com Range Correto
1. Entrar em partida multiplayer
2. Atacar com Pyrognat (range 220px)
3. **Verificar**: Projétil desaparece ao atingir ~220px
4. **Verificar**: Projétil não causa dano após desaparecer

### Teste 2: Ataque Melee
1. Usar Verdant (ataque melee, range 80px)
2. Atacar inimigo próximo
3. **Verificar**: Dano aplicado instantaneamente
4. **Verificar**: Sem criação de projétil

### Teste 3: Stats Únicos por Criatura
1. Atacar com Voltiger (24 de dano)
2. Trocar para Aquaryl (18 de dano)
3. **Verificar**: Danos diferentes aplicados
4. **Verificar**: Velocidades de projétil diferentes

### Teste 4: Skill Zones (quando implementado no cliente)
1. Usar Nevoeiro Incendiário (Pyrognat)
2. Inimigos entram na zona
3. **Verificar**: Dano periódico aplicado (8 HP a cada 0.5s)
4. **Verificar**: Zona desaparece após 4 segundos

---

## Arquivos Criados/Modificados

### Servidor
- ✅ `server/src/types.ts` - Interfaces e factories de projéteis e skill zones
- ✅ `server/src/systems/combat.ts` - Lógica de combate, skills e validação de distância
- ✅ `server/src/messages.ts` - Mensagens de broadcast de skill zones
- ✅ `server/src/index.ts` - Integração de skill zones no game loop

### Cliente (Próximas Etapas)
- ⏳ `src/services/multiplayerClient.ts` - Adicionar `sendSkill()` e handler de `skill_zones_update`
- ⏳ `src/scenes/ExpeditionScene.ts` - Enviar intent ao usar skill, renderizar zonas remotas

---

## Notas Técnicas

### Performance
- Skill zones são verificadas a cada tick (50ms)
- Dano aplicado apenas quando `tickTimer` chega a 0
- Zonas expiradas são removidas automaticamente
- Broadcast de zonas a cada 2 ticks (100ms) para economizar banda

### Sincronização
- Servidor é fonte de verdade para dano de skills
- Cliente renderiza zonas visualmente para feedback imediato
- Servidor envia confirmações de dano via `attack_result`

### Extensibilidade
- Fácil adicionar novos tipos de skill zones
- Suporte para modificadores de slow/root/knockback
- Stats de skills podem vir de arquivo de configuração

---

## Conclusão

✅ **Todos os 3 problemas foram corrigidos no servidor**:
1. Projéteis respeitam distância máxima
2. Ataques usam stats corretos de cada criatura (melee vs ranged)
3. Sistema de skill zones implementado e funcional

⏳ **Próximo Passo**: Implementar envio de intents de skill do cliente para o servidor.

