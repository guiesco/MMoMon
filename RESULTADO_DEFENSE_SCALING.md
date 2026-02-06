# Resultado da Otimização de DEFENSE_SCALING_FACTOR

## Data: 2025-01-28

## Método de Teste

Criado script `scripts/testDefenseScaling.ts` que testa diferentes valores de `DEFENSE_SCALING_FACTOR` e avalia:
- Número de matchups balanceados (TTK entre 3-15s)
- Número de matchups extremos (TTK < 3s ou > 30s)
- TTK médio
- Desvio padrão do TTK
- Score combinado

## Resultados dos Testes

### Valores Testados (0.15 a 0.40)

| Fator | Balanceados | Extremos | Avg TTK | StdDev | Score |
|-------|-------------|----------|---------|--------|-------|
| **0.19** | **7** | **7** | **23.85s** | **41.45s** | **22.6** ⭐ |
| 0.20 | 7 | 7 | 25.50s | 43.08s | 22.1 |
| 0.21 | 7 | 7 | 26.08s | 43.00s | 22.1 |
| 0.22 | 6 | 7 | 26.59s | 43.16s | 12.1 |
| 0.18 | 6 | 8 | 23.11s | 41.44s | 7.6 |
| 0.25 | 6 | 8 | 28.04s | 43.44s | 7.0 |
| **0.40** (atual) | **5** | **8** | **56.57s** | **96.33s** | **-18.9** |

## Valor Ótimo Encontrado

**DEFENSE_SCALING_FACTOR = 0.19**

### Comparação: 0.19 vs 0.40 (atual)

| Métrica | 0.19 (ótimo) | 0.40 (atual) | Melhoria |
|---------|--------------|--------------|----------|
| Matchups Balanceados | 7/16 | 5/16 | +40% |
| Matchups Extremos | 7/16 | 8/16 | -12.5% |
| TTK Médio | 23.85s | 56.57s | -58% |
| Desvio Padrão | 41.45s | 96.33s | -57% |
| Score | 22.6 | -18.9 | +220% |

## TTK por Matchup (DEFENSE_SCALING_FACTOR = 0.19)

### Matchups Balanceados (7/16) ✅
- Pyrognat vs Verdant: 10.01s
- Aquaryl vs Pyrognat: 4.19s
- Aquaryl vs Voltiger: 4.19s
- Verdant vs Pyrognat: 9.83s
- Verdant vs Voltiger: 3.28s
- Voltiger vs Aquaryl: 5.46s
- Voltiger vs Verdant: 12.74s

### Matchups Extremos (7/16) ⚠️
- Pyrognat vs Pyrognat: 2.00s (glass cannon vs glass cannon)
- Pyrognat vs Voltiger: 2.00s (glass cannon vs glass cannon)
- Voltiger vs Pyrognat: 1.82s (glass cannon vs glass cannon)
- Voltiger vs Voltiger: 1.82s (glass cannon vs glass cannon)
- Aquaryl vs Aquaryl: 43.95s (tank vs tank)
- Aquaryl vs Verdant: 169.53s (tank vs tank)
- Verdant vs Verdant: 67.16s (tank vs tank)

### Matchups Intermediários (2/16)
- Pyrognat vs Aquaryl: 24.02s (desvantagem de tipo)
- Verdant vs Aquaryl: 19.66s (tank vs tank, mas com type effectiveness)

## Impacto da Mudança

### Melhorias
1. **+40% mais matchups balanceados** (5 → 7)
2. **TTK médio reduzido em 58%** (56.57s → 23.85s)
3. **Desvio padrão reduzido em 57%** (96.33s → 41.45s)
4. **Menos matchups extremos** (8 → 7)

### Considerações
- Matchups extremos restantes são **intencionais**:
  - Glass cannons matam rápido (identidade do arquétipo)
  - Tanks são difíceis de matar (identidade do arquétipo)
  - Type effectiveness cria vantagens/desvantagens significativas

## Implementação

### Arquivo Modificado
- `server/src/systems/combat.ts`: `DEFENSE_SCALING_FACTOR = 0.4` → `0.19`
- `scripts/testCombat.ts`: Atualizado para usar o novo valor nos testes

### Validação
- ✅ Todos os testes de combate passaram
- ✅ TTK melhorado significativamente
- ✅ Balanceamento mantém identidade dos arquétipos

## Conclusão

O valor **0.19** é significativamente melhor que o atual **0.40**, proporcionando:
- Mais matchups balanceados
- TTK médio mais razoável
- Menos variação extrema
- Mantém a identidade única de cada criatura

**Recomendação**: Manter `DEFENSE_SCALING_FACTOR = 0.19` e testar em jogo para validação final.
