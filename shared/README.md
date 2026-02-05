# Diretório Compartilhado (Shared)

Este diretório contém código compartilhado entre o cliente (`src/`) e o servidor (`server/src/`).

## Objetivo

Manter constantes, tipos e funções sincronizadas entre cliente e servidor para evitar inconsistências e bugs.

## Estrutura

- `types.ts` - Tipos TypeScript compartilhados (ex: `ElementType`)
- `enums.ts` - Enums e tipos compartilhados (ex: `ThreatTier`, `EnemyBehaviorType`, `EnemyAIState`)
- `typeEffectiveness.ts` - Matriz de vantagens/desvantagens de tipos
- `creatureTypes.ts` - Mapeamento de criaturas para tipos elementais e função de cálculo
- `threatTiers.ts` - Configurações de tiers de ameaça
- `enemyAI.ts` - Configurações de IA de inimigos (interface EnemyBehaviorConfig)
- `expedition.ts` - Constantes de expedição (duração, extração, etc)

## Como Usar

### No Cliente (`src/`)

```typescript
import { TYPE_EFFECTIVENESS } from "../../shared/typeEffectiveness";
import { calculateTypeEffectiveness } from "../../shared/creatureTypes";
import type { ElementType } from "../../shared/types";
```

### No Servidor (`server/src/`)

```typescript
import { TYPE_EFFECTIVENESS } from "../../shared/typeEffectiveness";
import { calculateTypeEffectiveness } from "../../shared/creatureTypes";
import type { ElementType } from "../../shared/types";
```

## Regras Importantes

1. **Nunca duplicar código**: Se algo precisa ser igual em cliente e servidor, coloque aqui
2. **Sempre importar do shared**: Não recriar constantes em outros lugares
3. **Testar em ambos os lados**: Mudanças aqui afetam cliente e servidor
4. **Documentar mudanças**: Adicione comentários explicando o que mudou e por quê

## Adicionando Novos Arquivos Compartilhados

1. Crie o arquivo em `shared/`
2. Exporte as constantes/tipos/funções necessárias
3. Atualize este README
4. Atualize os imports no cliente e servidor

## Exemplos de Uso

### Type Effectiveness

```typescript
import { calculateTypeEffectiveness } from "../../shared/creatureTypes";

const damage = baseDamage * calculateTypeEffectiveness("pyrognat", "aquaryl");
// Fogo vs Água = 0.5x (não muito efetivo)
```

### Tipos Elementais

```typescript
import type { ElementType } from "../../shared/types";

const type: ElementType = "Fogo";
```
