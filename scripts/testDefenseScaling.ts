/**
 * Script de Teste de DEFENSE_SCALING_FACTOR
 * 
 * Testa diferentes valores de DEFENSE_SCALING_FACTOR para encontrar
 * o melhor balanceamento de TTK entre criaturas.
 * 
 * Execute com: npx ts-node scripts/testDefenseScaling.ts
 */

import { getCreatureById } from "../shared/creatures";
import { calculateEffectiveStats } from "../shared/creatureProgression";

// ============================================================================
// Cálculo de Dano com Diferentes Fatores de Escala
// ============================================================================

function calculateDamageWithDefense(
    baseDamage: number,
    attackerAttack: number,
    defenderDefense: number,
    defenseScalingFactor: number
): number {
    const MIN_DAMAGE = 1;
    const MIN_DEFENSE = 1;
    const MIN_ATTACK = 1;

    const safeDefense = Math.max(defenderDefense, MIN_DEFENSE);
    const safeAttack = Math.max(attackerAttack, MIN_ATTACK);
    const safeBaseDamage = Math.max(baseDamage, 0);

    const defenseSquared = safeDefense * safeDefense;
    const scaledDefense = defenseSquared * defenseScalingFactor;
    const calculatedDamage = safeBaseDamage * safeAttack / scaledDefense;
    return Math.max(MIN_DAMAGE, Math.floor(calculatedDamage));
}

function calculateTypeEffectiveness(attackerId: string, defenderId: string): number {
    const attacker = getCreatureById(attackerId);
    const defender = getCreatureById(defenderId);

    if (!attacker || !defender) return 1.0;

    const attackerType = attacker.primaryType;
    const defenderType = defender.primaryType;

    const effectiveness: Record<string, Record<string, number>> = {
        "Fogo": {
            "Planta": 2.0,
            "Água": 0.5,
            "Fogo": 1.0,
            "Elétrico": 1.0
        },
        "Água": {
            "Fogo": 2.0,
            "Planta": 0.5,
            "Água": 1.0,
            "Elétrico": 1.0
        },
        "Planta": {
            "Água": 2.0,
            "Fogo": 0.5,
            "Planta": 1.0,
            "Elétrico": 1.0
        },
        "Elétrico": {
            "Água": 2.0,
            "Elétrico": 1.0,
            "Fogo": 1.0,
            "Planta": 1.0
        }
    };

    return effectiveness[attackerType]?.[defenderType] ?? 1.0;
}

function calculateTTK(
    attackerId: string,
    defenderId: string,
    level: number,
    rank: number,
    defenseScalingFactor: number
): number {
    const attackerStats = calculateEffectiveStats(
        { definitionId: attackerId, level, rank },
        getCreatureById
    );
    const defenderStats = calculateEffectiveStats(
        { definitionId: defenderId, level, rank },
        getCreatureById
    );

    const typeMultiplier = calculateTypeEffectiveness(attackerId, defenderId);
    const baseDamage = attackerStats.attackDamage * typeMultiplier;

    const damagePerAttack = calculateDamageWithDefense(
        baseDamage,
        attackerStats.attackDamage,
        defenderStats.defense,
        defenseScalingFactor
    );

    const attacksNeeded = Math.ceil(defenderStats.hp / damagePerAttack);
    return attacksNeeded * attackerStats.attackCooldown;
}

// ============================================================================
// Análise de Balanceamento
// ============================================================================

interface BalanceMetrics {
    factor: number;
    balancedMatchups: number; // TTK entre 3-15s
    extremeMatchups: number; // TTK < 3s ou > 30s
    avgTTK: number;
    stdDevTTK: number;
    score: number; // Score combinado (quanto maior, melhor)
}

function testDefenseScalingFactor(factor: number): BalanceMetrics {
    const creatures = ["pyrognat", "aquaryl", "verdant", "voltiger"];
    const level = 10;
    const rank = 1;

    const ttks: number[] = [];
    let balanced = 0;
    let extreme = 0;

    for (const attackerId of creatures) {
        for (const defenderId of creatures) {
            const ttk = calculateTTK(attackerId, defenderId, level, rank, factor);
            ttks.push(ttk);

            if (ttk >= 3 && ttk <= 15) {
                balanced++;
            } else if (ttk < 3 || ttk > 30) {
                extreme++;
            }
        }
    }

    // Calcular média e desvio padrão
    const avgTTK = ttks.reduce((a, b) => a + b, 0) / ttks.length;
    const variance = ttks.reduce((sum, ttk) => sum + Math.pow(ttk - avgTTK, 2), 0) / ttks.length;
    const stdDevTTK = Math.sqrt(variance);

    // Score: mais matchups balanceados = melhor, menos extremos = melhor
    // Penalizar desvio padrão alto (muita variação)
    // Bonus para TTK médio próximo de 8-10s (ideal)
    const ttkBonus = Math.abs(avgTTK - 9) < 5 ? 5 : 0;
    const score = balanced * 10 - extreme * 5 - stdDevTTK * 0.3 + ttkBonus;

    return {
        factor,
        balancedMatchups: balanced,
        extremeMatchups: extreme,
        avgTTK,
        stdDevTTK,
        score
    };
}

// ============================================================================
// Teste de Múltiplos Valores
// ============================================================================

function testMultipleFactors() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  TESTE DE DEFENSE_SCALING_FACTOR");
    console.log("═══════════════════════════════════════════════════════════\n");

    // Testar valores de 0.18 a 0.22 em incrementos de 0.01 (foco na faixa ótima)
    const factors: number[] = [];
    for (let i = 18; i <= 22; i += 1) {
        factors.push(i / 100);
    }

    // Também testar valores de referência
    factors.push(0.15, 0.25, 0.3, 0.4);

    const results: BalanceMetrics[] = [];

    for (const factor of factors) {
        const metrics = testDefenseScalingFactor(factor);
        results.push(metrics);
    }

    // Ordenar por score (melhor primeiro)
    results.sort((a, b) => b.score - a.score);

    console.log("Resultados (ordenados por score, melhor primeiro):\n");
    console.log("Fator | Balanceados | Extremos | Avg TTK | StdDev | Score");
    console.log("------|-------------|----------|---------|--------|------");

    for (const result of results) {
        const marker = result.factor === 0.4 ? " ← ATUAL" : "";
        console.log(
            `${result.factor.toFixed(2).padStart(5)} | ${String(result.balancedMatchups).padStart(11)} | ${String(result.extremeMatchups).padStart(8)} | ${result.avgTTK.toFixed(2).padStart(7)} | ${result.stdDevTTK.toFixed(2).padStart(6)} | ${result.score.toFixed(1).padStart(5)}${marker}`
        );
    }

    const best = results[0];
    console.log(`\n🎯 MELHOR FATOR: ${best.factor.toFixed(2)}`);
    console.log(`   - Matchups balanceados: ${best.balancedMatchups}/16`);
    console.log(`   - Matchups extremos: ${best.extremeMatchups}/16`);
    console.log(`   - TTK médio: ${best.avgTTK.toFixed(2)}s`);
    console.log(`   - Desvio padrão: ${best.stdDevTTK.toFixed(2)}s`);
    console.log(`   - Score: ${best.score.toFixed(1)}`);

    // Mostrar detalhes do melhor fator
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  DETALHES DO MELHOR FATOR");
    console.log("═══════════════════════════════════════════════════════════\n");

    const creatures = ["pyrognat", "aquaryl", "verdant", "voltiger"];
    const level = 10;
    const rank = 1;

    console.log("TTK por matchup (DEFENSE_SCALING_FACTOR = " + best.factor.toFixed(2) + "):\n");

    for (const attackerId of creatures) {
        for (const defenderId of creatures) {
            const ttk = calculateTTK(attackerId, defenderId, level, rank, best.factor);
            const status = ttk >= 3 && ttk <= 15 ? "✅" : ttk < 3 || ttk > 30 ? "⚠️ " : "  ";
            console.log(`${status} ${attackerId.padEnd(10)} vs ${defenderId.padEnd(10)}: ${ttk.toFixed(2)}s`);
        }
    }

    return best.factor;
}

// ============================================================================
// Execução
// ============================================================================

const bestFactor = testMultipleFactors();
console.log(`\n💡 RECOMENDAÇÃO: Usar DEFENSE_SCALING_FACTOR = ${bestFactor.toFixed(2)}`);
console.log(`   (Valor atual: 0.40)`);

if (Math.abs(bestFactor - 0.4) > 0.05) {
    console.log(`\n⚠️  Diferença significativa do valor atual! Considere atualizar.`);
} else {
    console.log(`\n✅ Valor atual está próximo do ótimo.`);
}

process.exit(0);
