# Plano de implementação: classes centralizadas por criatura (Opção A)

## 1. Objetivo e escopo

- **Objetivo:** Ter uma única fonte de verdade por criatura no `shared`, usando **uma classe por criatura** que agrega dados (stats, tipos, ataques, tema visual) e comportamento de skill.
- **Benefícios:** Escalabilidade (nova criatura = uma classe), eliminação de duplicação (ex.: tipos em `creatures` e `creatureTypes`), tema disponível no shared para server e client, e um único ponto de entrada: `CreatureRegistry.get("pyrognat")`.

**Restrição:** O shared não importa server nem client. “Ações” no server/client = usar dados e funções exportadas pelo shared (server chama `.executeSpecialSkill()`, client usa `.theme`).

---

## 2. Arquitetura (Opção A)

- **Uma classe por criatura** (ex.: `Pyrognat`, `Aquaryl`, `Verdant`, `Voltiger`) implementando uma interface comum.
- Cada classe contém:
  - **Dados:** id, name, primaryType, secondaryType?, stats, basicAttack, specialSkill, statProgression, evolutionChain?, **theme**.
  - **Comportamento:** `executeSpecialSkill(params)` que delega para o behavior já existente em `creatureBehaviors` (por `this.id`).
- **Registry:** `CreatureRegistry.get(id)` retorna a instância da classe (singleton por id).
- **Tipos e type effectiveness:** Derivados do registry (ou da interface da criatura), para não manter `CREATURE_TYPES` separado.

---

## 3. Estrutura de pastas proposta

```
shared/
  creatures/
    types.ts              # Interfaces: CreatureDefinition, CreatureTheme, CreatureStats, etc.
    CreatureRegistry.ts   # Registry: get(id), getAll(), getTypesMap(), calculateTypeEffectiveness()
    Pyrognat.ts           # class Pyrognat implements Creature
    Aquaryl.ts
    Verdant.ts
    Voltiger.ts
    index.ts              # Re-exporta registry, tipos e lista de criaturas
  creatureBehaviors/      # Mantido; classes de criatura delegam para getCreatureBehavior(id)
  creatureProgression.ts  # Mantido; continua recebendo getCreatureById (agora via registry)
  creatureTypes.ts       # Deprecar e derivar de CreatureRegistry (ou manter só type effectiveness)
  attacks.ts             # Manter definições de ataques/skills; classes referenciam essas constantes
  creatures.ts            # Deprecar / tornar thin wrapper que re-exporta shared/creatures/
```

Alternativa mínima (sem mover tudo para `shared/creatures/` de uma vez):

- Manter `shared/creatures.ts` por enquanto e adicionar `shared/creatureThemes.ts` (tema no shared).
- Introduzir `shared/CreatureRegistry.ts` e classes `shared/creatures/Pyrognat.ts` etc., e fazer `getCreatureById` no `creatures.ts` retornar `CreatureRegistry.get(id)` até migrar todos os consumidores.

O plano abaixo assume a **estrutura completa** (`shared/creatures/` com classes + registry). A migração pode ser feita em fases (ver secção 8).

---

## 4. Interfaces e contratos (shared/creatures/types.ts)

- **CreatureTheme** (mover do client para shared):
  - `primaryColor`, `strokeColor`, `attackColor`, `particleColor`, `hitFlashColor`, `projectileRadius`, `meleeArcWidth`, `typeLabel`.

- **CreatureStats**, **CreatureAIStats**, **CreatureStatProgression**: manter como hoje (podem vir de `creatures.ts` atual ou ser re-exportados de um único `types.ts`).

- **CreatureDefinition** (atual) + **theme: CreatureTheme** + contrato de comportamento:
  - Interface **Creature** (nome sugerido para a “classe central”):
    - `readonly id`, `name`, `primaryType`, `secondaryType?`, `stats`, `basicAttack`, `specialSkill`, `statProgression`, `evolutionChain?`, **`theme`**
    - `getTypes(): { primaryType, secondaryType? }`
    - `executeSpecialSkill(params: SkillExecutionParams): SkillExecutionRecipe` (delega para `getCreatureBehavior(this.id).executeSpecialSkill(params)`)

- **SkillExecutionParams** e **SkillExecutionRecipe**: já existem em `creatureBehaviors`; importar/re-exportar de `creatureBehaviors` em `creatures/types.ts` para evitar dependência circular (ou definir apenas a interface no creatures e implementação chama behavior).

---

## 5. Conteúdo de cada classe (ex.: Pyrognat)

Cada arquivo (ex.: `shared/creatures/Pyrognat.ts`) deve:

1. Implementar a interface **Creature**.
2. Definir todos os campos em termos das constantes já existentes em `shared/attacks.ts` e `shared/creatures.ts` (stats, basicAttack, specialSkill, statProgression).
3. Definir **theme** com os valores atuais de `src/game/creatureThemes.ts` (pyrognat: cores laranja, raio 5, etc.).
4. Implementar `executeSpecialSkill(params)` chamando `executeCreatureSpecialSkill(this.id, params)` (de `creatureBehaviors`).

Exemplo de assinatura:

```ts
// Pyrognat.ts
import type { Creature } from "./types";
import { executeCreatureSpecialSkill } from "../creatureBehaviors";
import type { SkillExecutionParams, SkillExecutionRecipe } from "../creatureBehaviors";
import { ATTACK_CHAMA_RAPIDA, SKILL_NEVOEIRO_INCENDIARIO } from "../attacks";

export class Pyrognat implements Creature {
  readonly id = "pyrognat";
  readonly name = "Pyrognat";
  readonly primaryType = "Fogo";
  readonly secondaryType = "Voador";
  readonly stats = { ... };
  readonly basicAttack = ATTACK_CHAMA_RAPIDA;
  readonly specialSkill = SKILL_NEVOEIRO_INCENDIARIO;
  readonly statProgression = { ... };
  readonly evolutionChain = ["Pyrognat", "Pyrodactyl", "Solaraptor"];
  readonly theme = {
    primaryColor: 0xf97316,
    strokeColor: 0xea580c,
    attackColor: 0xff6b35,
    particleColor: 0xfbbf24,
    hitFlashColor: 0xfef3c7,
    projectileRadius: 5,
    meleeArcWidth: 0,
    typeLabel: "Fogo/Voador"
  };

  getTypes() { return { primaryType: this.primaryType, secondaryType: this.secondaryType }; }
  executeSpecialSkill(params: SkillExecutionParams): SkillExecutionRecipe {
    return executeCreatureSpecialSkill(this.id, params);
  }
}
```

Repetir para **Aquaryl**, **Verdant**, **Voltiger** com seus dados e temas atuais.

---

## 6. CreatureRegistry (shared/creatures/CreatureRegistry.ts)

- **get(id: string): Creature | undefined**  
  Retorna a instância da classe (singleton por id), ex.: `new Pyrognat()`, `new Aquaryl()`, etc.

- **getAll(): Creature[]**  
  Lista de todas as criaturas registradas (para listagens, pools, etc.).

- **getTypesMap(): Record<string, { primaryType; secondaryType? }>**  
  Derivado das criaturas registradas (substitui `CREATURE_TYPES`).

- **calculateTypeEffectiveness(attackerType: string, defenderType: string): number**  
  Usar `getTypesMap()` e a tabela de type effectiveness existente em `shared/typeEffectiveness.ts` (mesma lógica de `creatureTypes.ts`), para não duplicar regras.

- **CAPTURE_CREATURE_POOL** / **CREATURE_TYPE_POOL**: derivados de `getAll().map(c => c.id)` ou constante baseada no registry.

Compatibilidade durante migração:

- **getCreatureById(id)** pode passar a ser `CreatureRegistry.get(id)` e retornar a mesma interface que hoje (CreatureDefinition), expondo também `.theme` e `.executeSpecialSkill` para quem quiser usar.

---

## 7. Tema no shared

- Criar **shared/creatureThemes.ts** (ou incluir em **shared/creatures/types.ts**):
  - Interface **CreatureTheme** (igual à atual do client).
  - Não é necessário manter um mapa solto por id; cada classe de criatura já tem `theme` como propriedade.

- **Client:** Trocar imports de `src/game/creatureThemes` para `shared/creatures` (ou `shared/creatureThemes` se for arquivo separado). Usar `CreatureRegistry.get(id).theme` (ou `getCreatureTheme(id)` que faz `CreatureRegistry.get(id)?.theme ?? defaultTheme`).

- **interpolateColor:** Pode permanecer no client (utilitário de renderização) ou ser movido para shared se usado em mais de um lugar.

---

## 8. Migração e ordem de implementação

### Fase 1 – Fundação (shared)

1. **shared/creatures/types.ts**
   - Definir/mover `CreatureTheme`, `CreatureStats`, `CreatureAIStats`, `CreatureStatProgression`, `CreatureDefinition`.
   - Definir interface **Creature** estendendo/agregando definition + `theme` + `getTypes()` + `executeSpecialSkill(params)`.

2. **shared/creatures/Pyrognat.ts**, **Aquaryl.ts**, **Verdant.ts**, **Voltiger.ts**
   - Implementar **Creature** com dados atuais de `creatures.ts` e temas de `creatureThemes.ts`.
   - `executeSpecialSkill` delega para `executeCreatureSpecialSkill(this.id, params)`.

3. **shared/creatures/CreatureRegistry.ts**
   - Registrar as quatro classes (Map ou objeto por id).
   - Implementar `get`, `getAll`, `getTypesMap`, `calculateTypeEffectiveness` (lógica de `creatureTypes.ts` usando `getTypesMap()`).

4. **shared/creatures/index.ts**
   - Exportar registry, tipos, e lista de criaturas.
   - Exportar `getCreatureById` como alias de `CreatureRegistry.get` (compatibilidade).

### Fase 2 – Compatibilidade e substituição de fontes

5. **shared/creatures.ts** (arquivo atual)
   - Reduzir a: re-exportar de `shared/creatures/index.ts` (getCreatureById, CREATURES, tipos, CAPTURE_CREATURE_POOL, CREATURE_TYPE_POOL, getCreatureBaseStats etc.).
   - Ou manter `CREATURES` e `getCreatureById` implementados localmente mas passando a usar o registry por baixo (ex.: `getCreatureById = (id) => CreatureRegistry.get(id)`).

6. **shared/creatureTypes.ts**
   - Manter `calculateTypeEffectiveness` re-exportando ou chamando `CreatureRegistry.calculateTypeEffectiveness`.
   - `CREATURE_TYPES` pode ser derivado de `CreatureRegistry.getTypesMap()` e re-exportado para não quebrar quem ainda importa.

7. **shared/attacks.ts**
   - Manter como está (definições de ataques/skills).
   - Opcional: `getSpecialSkillByCreatureId(id)` pode passar a ser `CreatureRegistry.get(id)?.specialSkill` no futuro.

### Fase 3 – Client: tema e definição

8. **src/game/creatureThemes.ts**
   - Substituir conteúdo por: `getCreatureTheme(id)` que retorna `CreatureRegistry.get(id)?.theme ?? defaultTheme`, e re-exportar tipo `CreatureTheme` de `shared/creatures`.
   - Manter `interpolateColor` aqui (ou mover para shared se fizer sentido).

9. **Client – imports**
   - Garantir que todos os usos de `getCreatureTheme`, `CREATURE_THEMES`, `CreatureTheme` passem a usar `shared/creatures` (registry + tipo) ou o `creatureThemes.ts` que agora só delega para o registry.

### Fase 4 – Server e behaviors

10. **Server**
    - Não é obrigatório mudar assinaturas: continuam usando `getCreatureById`, `getSpecialSkillByCreatureId`, `executeCreatureSpecialSkill(creatureId, params)`.
    - Opcional: em `skills.ts` e `combat.ts`, usar `CreatureRegistry.get(creatureId).executeSpecialSkill(params)` em vez de `executeCreatureSpecialSkill(creatureId, params)` (mesmo comportamento, API mais alinhada à “classe central”).

11. **Scripts e testes**
    - Atualizar imports se algo mudar de path (ex.: usar `shared/creatures` em vez de `shared/creatures.ts`).
    - Garantir que testes que usam `getCreatureById` ou tipos continuem passando.

### Fase 5 – Limpeza

12. Remover duplicação: `CREATURE_TYPES` apenas como re-export de `CreatureRegistry.getTypesMap()`.
13. Documentar no **shared/README.md** (ou equivalente) que a fonte de verdade por criatura é `shared/creatures/` e o registry.

---

## 9. Arquivos a alterar (referência)

| Onde                                                                                                              | O que fazer                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **shared/creatures/** (novo)                                                                                      | types.ts, CreatureRegistry.ts, Pyrognat.ts, Aquaryl.ts, Verdant.ts, Voltiger.ts, index.ts        |
| **shared/creatures.ts**                                                                                           | Virar thin wrapper / re-export do registry + compatibilidade getCreatureById, CREATURES, pools   |
| **shared/creatureTypes.ts**                                                                                       | calculateTypeEffectiveness e CREATURE_TYPES derivados do registry                                |
| **shared/attacks.ts**                                                                                             | Manter; opcionalmente getSpecialSkillByCreatureId usar registry                                  |
| **src/game/creatureThemes.ts**                                                                                    | getCreatureTheme → CreatureRegistry.get(id)?.theme ?? default; re-export CreatureTheme do shared |
| **src/** (SkillSystem, SpriteManager, TeamSystem, ProjectileManager, VisualSystem, CombatSystem, ExpeditionScene) | Imports de tema: usar shared/creatures ou creatureThemes que delega ao registry                  |
| **server/** (combat, skills, GameLoopManager, wildCreatureStats, spawns)                                          | Manter ou trocar para CreatureRegistry.get(id) onde fizer sentido                                |
| **scripts/** (testCombat, testBalanceamento, testDefenseScaling)                                                  | Imports de creatures; garantir uso do registry/getCreatureById                                   |

---

## 10. Checklist final

- [x] Interface **Creature** definida com theme, getTypes(), executeSpecialSkill().
- [x] **CreatureTheme** e dados de tema no shared (em cada classe ou em types).
- [x] Quatro classes (Pyrognat, Aquaryl, Verdant, Voltiger) implementando Creature.
- [x] **CreatureRegistry** com get, getAll, getTypesMap, calculateTypeEffectiveness.
- [x] **getCreatureById** compatível (retorna Creature / CreatureDefinition).
- [x] **CREATURE_TYPES** e **calculateTypeEffectiveness** derivados do registry (ou re-exportados).
- [x] Client usa tema via registry (getCreatureTheme → registry).
- [x] Server pode opcionalmente usar creature.executeSpecialSkill(params) (mantido executeCreatureSpecialSkill por compatibilidade).
- [x] Sem duplicação de tipos (uma única fonte: a classe/registry).
- [x] Testes e build (client + server) passando.
- [x] README ou docs do shared atualizados.

---

## 11. Riscos e atenções

- **Dependência circular:** `creatures` ↔ `creatureBehaviors` ↔ `attacks`. Evitar: creatures importa creatureBehaviors apenas para `executeCreatureSpecialSkill`; behaviors não importam creatures; attacks não importam creatures (só constantes).
- **Fallback:** Se `CreatureRegistry.get(id)` for undefined (criatura nova ainda não registrada), `getCreatureById` e `getCreatureTheme` devem ter fallback (ex.: tema neutro, ou definição padrão) para não quebrar UI ou servidor.
- **Enums:** Se hoje existem enums de creature id, podem permanecer; o registry usa strings. Não é obrigatório migrar enums para as classes neste plano.

---

_Documento gerado para guiar a implementação da Opção A (classe por criatura) com registry e tema no shared._
