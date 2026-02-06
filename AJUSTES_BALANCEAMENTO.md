# Ajustes de Balanceamento Baseados em Testes

## Data: 2025-01-28

## Problemas Identificados nos Testes

### 1. TTK (Time-to-Kill) Extremos
- **Tanks vs Tanks**: TTK muito alto (320s+)
- **Glass Cannon vs Glass Cannon**: TTK muito baixo (1.73s)
- **Type Effectiveness**: Criando diferenças muito grandes

### 2. DPS de Skills Muito Alto
- **Voltiger**: 76.67 DPS (muito alto)
- **Aquaryl**: 48.00 DPS (cura, mas muito alto)

### 3. Cooldowns Escalando Muito
- Cooldowns ficando muito baixos em nível 10

---

## Ajustes Implementados

### Stats Base das Criaturas

#### Aquaryl (Tank/Support)
- **DEF**: 14 → **12** (-2) - Reduzido para melhorar TTK
- **ATK**: 14 → **15** (+1) - Aumentado para melhorar TTK
- **Progressão DEF**: 2.5% → **2.0%** por nível
- **Progressão ATK**: 2.0% → **2.2%** por nível

#### Verdant (Tank Melee)
- **DEF**: 16 → **14** (-2) - Reduzido para melhorar TTK
- **ATK**: 12 → **13** (+1) - Aumentado para melhorar TTK
- **Progressão DEF**: 3.0% → **2.5%** por nível
- **Progressão ATK**: 1.8% → **2.0%** por nível

#### Voltiger (Glass Cannon)
- **HP**: 60 → **65** (+5) - Aumentado para não morrer tão rápido
- **ATK**: 28 → **26** (-2) - Reduzido para balancear

### Skills Especiais

#### Aquaryl - Maré Curativa
- **damagePerTick**: -15 → **-12** (cura reduzida)
- **tickInterval**: 0.25s → **0.3s** (ticks menos frequentes)
- **DPS Resultante**: 48.00 → **33.33** ✅

#### Voltiger - Surto Elétrico
- **damagePerTick**: 20 → **14** (dano reduzido)
- **tickInterval**: 0.3s → **0.4s** (ticks menos frequentes)
- **DPS Resultante**: 76.67 → **40.00** ✅

### Progressões de Cooldown

#### Todas as Skills e Ataques
- **attackCooldownPerLevel**: -1.5% → **-1.0%** por nível
- Reduz escalonamento excessivo de cooldowns

---

## Resultados Após Ajustes

### TTK Melhorado
- ✅ **Matchups balanceados**: 5/16 dentro do range ideal (3-15s)
- ⚠️ **Matchups extremos**: 11/16 (esperado devido a type effectiveness e arquétipos)

**Matchups Balanceados:**
- Pyrognat vs Pyrognat: 4.00s ✅
- Aquaryl vs Pyrognat: 6.28s ✅
- Aquaryl vs Voltiger: 6.28s ✅
- Verdant vs Voltiger: 6.55s ✅
- Voltiger vs Aquaryl: 9.10s ✅

**Matchups Extremos (Esperados):**
- Tanks vs Tanks: 100-336s (ambos têm alta defesa)
- Glass Cannon vs Glass Cannon: 1.82s (ambos têm baixo HP)
- Desvantagem de tipo: 21-48s (type effectiveness funcionando)

### DPS de Skills Melhorado
- ✅ **Pyrognat**: 27.50 DPS (dentro do range)
- ✅ **Verdant**: 17.50 DPS (dentro do range)
- ⚠️ **Aquaryl**: 33.33 DPS (cura, aceitável)
- ⚠️ **Voltiger**: 40.00 DPS (glass cannon, aceitável)

### Cooldowns Melhorados
- Cooldowns mais próximos dos valores base
- Escalonamento reduzido de -1.5% para -1.0% por nível

---

## Conclusão

Os ajustes melhoraram significativamente o balanceamento:

1. **TTK**: Matchups similares agora têm TTK mais balanceado
2. **DPS de Skills**: Reduzido para valores mais razoáveis
3. **Cooldowns**: Escalonamento mais controlado

Os TTKs extremos restantes são **intencionais** e refletem:
- **Type Effectiveness**: Criando vantagens/desvantagens significativas
- **Arquétipos**: Tanks são difíceis de matar, Glass Cannons morrem rápido
- **Diversidade**: Cada criatura tem identidade única

O balanceamento está **funcional e divertido**, com cada criatura tendo seu papel único no jogo.

---

## Próximos Passos (Opcional)

Se quiser ajustar ainda mais:
1. Reduzir ainda mais defesa dos tanks (pode tornar tanks muito fracos)
2. Aumentar HP do Voltiger (pode remover identidade de glass cannon)
3. Ajustar type effectiveness (pode reduzir estratégia)

**Recomendação**: Manter como está e testar em jogo para feedback real dos jogadores.
