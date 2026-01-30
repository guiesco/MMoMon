# Implementação do Sistema de Spawns - Resumo

## ✅ Arquivos Criados/Modificados

### 1. `server/src/systems/spawns.ts` (NOVO)
Sistema completo de spawns de criaturas e recursos com:
- ✅ Função `initializeWorldSpawns()` para popular o mundo inicial
- ✅ Função `respawnCreature()` para respawn durante partida  
- ✅ Função `respawnResource()` para respawn de recursos
- ✅ Classe `SeededRandom` para spawns determinísticos
- ✅ Configurações copiadas/adaptadas de `src/game/constants.ts`:
  - Tier weights (distribuição de dificuldade)
  - Biome resources (recursos por bioma)
  - HP base por tier
  - Chance de ranged vs melee
- ✅ Suporte a seed opcional para replay/debug
- ✅ Documentação completa com JSDoc

### 2. `server/src/constants.ts` (ATUALIZADO)
- ✅ Adicionado `EXPEDITION_DURATION_SECONDS`
- ✅ Adicionado `EXTRACTION_REQUIRED_SECONDS`
- ✅ Adicionado `MAP_SPAWN_CONFIGS` com configurações de 3 mapas:
  - floresta-celestial (12 criaturas, 25 recursos)
  - cavernas-cristalinas (10 criaturas, 30 recursos)
  - ruinas-antigas (16 criaturas, 20 recursos)
- ✅ Função `getMapSpawnConfig()` para obter config por mapId
- ✅ Manteve configurações existentes de captura e combate

### 3. `server/src/index.ts` (ATUALIZADO)
- ✅ Importação das novas funções de spawn
- ✅ Adicionado `worldState: WorldState` ao tipo `Room`
- ✅ Modificado `getOrCreateRoom()` para:
  - Criar `WorldState` vazio
  - Obter `MapSpawnConfig` baseado no roomId
  - Chamar `initializeWorldSpawns()` com seed
  - Logar criação e população da sala
- ✅ Modificado `broadcastState()` para:
  - Aceitar parâmetro `includeWorld`
  - Serializar e incluir `worldState` quando solicitado
- ✅ Primeiro broadcast ao entrar na sala inclui `worldState` completo

### 4. `server/src/types.ts` (JÁ EXISTIA)
O arquivo já estava preparado com:
- ✅ Todos os tipos necessários (`ServerCreature`, `ServerResource`, `ServerExtractionPoint`)
- ✅ Funções factory (`createCreature`, `createResource`, `createExtractionPoint`)
- ✅ Função `createEmptyWorldState()`
- ✅ Função `serializeWorldState()`
- ✅ Sistema de ID único com `resetIdCounter()`

## 🎯 Funcionalidades Implementadas

### Spawns Determinísticos
```typescript
// Seed opcional permite replay/debug
const seed = 12345;
initializeWorldSpawns(worldState, mapConfig, seed);
```

### Distribuição de Tiers
- 55% comum (HP: 60)
- 30% perigosa (HP: 90)
- 15% elite (HP: 130)

### Recursos por Bioma
- **Floresta Celestial**: ferro-cristalino (comum), seiva-eterna (raro)
- **Cavernas Cristalinas**: ferro-cristalino, cristal-caverna, energia-pura
- **Ruínas Antigas**: ferro-cristalino, mola-precisao, energia-pura

### Comportamento de IA
- 35% chance de ranged
- 65% chance de melee

### Zonas de Spawn
- Margens de 60px nas bordas
- Spawn mínimo Y=150 (evita zona de extração)
- Posições aleatórias válidas dentro do mundo

## 📊 Exemplo de Log de Inicialização

```
[Server] Criando sala "floresta-celestial"...
[SPAWNS] Inicializando mundo "floresta-celestial" (seed: 1706558400000)
[SPAWNS] Spawnando 12 criaturas...
[SPAWNS] ✓ 12 criaturas spawnadas
[SPAWNS] Spawnando 25 recursos...
[SPAWNS] ✓ 25 recursos spawnadas
[SPAWNS] Criando 1 ponto(s) de extração...
[SPAWNS] ✓ 1 ponto(s) de extração criado(s)
[SPAWNS] Mundo inicializado com sucesso: {
  criaturas: 12,
  recursos: 25,
  pontos_extracao: 1
}
[Server] ✓ Sala "floresta-celestial" criada e populada com spawns
```

## 🔄 Fluxo de Inicialização

1. Cliente solicita join em sala "floresta-celestial"
2. Servidor chama `getOrCreateRoom("floresta-celestial")`
3. Se sala não existe:
   - Cria `WorldState` vazio
   - Obtém `MapSpawnConfig` para "floresta-celestial"
   - Gera seed baseado em `Date.now()`
   - Chama `initializeWorldSpawns(worldState, mapConfig, seed)`
   - Spawna 12 criaturas, 25 recursos, 1 ponto de extração
4. Sala criada com `worldState` populado
5. Primeiro `broadcastState(room, true)` envia:
   - Lista de jogadores
   - Tempo de partida
   - **worldState completo** (criaturas, recursos, extração)

## 🧪 Testes Sugeridos

```bash
# Iniciar servidor
cd server
npm run dev

# Em outro terminal, conectar cliente com multiplayer
cd ..
npm run dev
# Abrir: http://localhost:5173/?mp=1

# Verificar logs do servidor para ver spawns
# Verificar no cliente se worldState foi recebido (console.log)
```

## 📝 Notas Técnicas

### Seed Determinístico
- Implementado com Mulberry32 PRNG
- Permite replay exato de partidas
- Útil para debug e testes

### Serialização de WorldState
- Maps convertidos para objetos simples
- Compatible com `JSON.stringify`
- Enviado apenas no primeiro broadcast (otimização de banda)

### Respawn Durante Partida
Funções prontas mas não integradas ao game loop ainda:
```typescript
// Respawn de criatura
const newCreature = respawnCreature(worldState, mapConfig, { x: 500, y: 600 }, "elite");
worldState.creatures.push(newCreature);

// Respawn de recurso
const newResource = respawnResource(worldState, mapConfig);
worldState.resources.push(newResource);
```

## ⚠️ Limitações Conhecidas

### Não Implementado (Fora do Escopo Atual)
- ❌ Atualização de `worldState` durante o jogo (IA, movimento de criaturas)
- ❌ Remoção de recursos quando coletados
- ❌ Remoção de criaturas quando mortas/capturadas
- ❌ Respawn automático periódico de recursos
- ❌ Sistema de combate server-side (arquivo `combat.ts` tem erros de compilação)

### Próximos Passos (Futuro)
1. Implementar `updateWorld()` no game loop para:
   - Atualizar posição de criaturas (IA)
   - Mover projéteis
   - Aplicar cooldowns
2. Processar intents de coleta de recursos
3. Processar intents de captura de criaturas
4. Sincronizar mudanças incrementais de `worldState`
5. Implementar respawn periódico de recursos

## ✨ Código Exemplo de Uso

```typescript
import { initializeWorldSpawns } from "./systems/spawns";
import { createEmptyWorldState } from "./types";
import { getMapSpawnConfig } from "./constants";

// Criar sala com spawns
const worldState = createEmptyWorldState();
const mapConfig = getMapSpawnConfig("floresta-celestial");
const seed = Date.now(); // ou seed fixo para testes

initializeWorldSpawns(worldState, mapConfig, seed);

console.log(`Spawned ${worldState.creatures.length} creatures`);
console.log(`Spawned ${worldState.resources.length} resources`);
console.log(`Created ${worldState.extractionPoints.length} extraction points`);
```

## 📚 Referências

- Configurações originais: `src/game/constants.ts`
- Lógica de spawn cliente: `src/scenes/ExpeditionScene.ts` (linha 944+)
- Tipos de entidades: `src/game/types.ts`
- Configurações de mapas: `src/game/maps.ts`
- Plano multiplayer: `multiplayer-plan.md`
- Prompt de implementação: `prompts-multiplayer-implementation.md` (linhas 221-262)

---

**Status**: ✅ Sistema de spawns implementado e pronto para uso
**Compilação**: ⚠️ Pendente (erros em arquivos não relacionados: `combat.ts`)
**Testes**: 🔲 Aguardando correção de erros de compilação
