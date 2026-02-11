/**
 * Script de Teste de TTK (Time To Kill) com a fórmula de dano atual.
 *
 * Fórmula (mitigação percentual, estilo LoL/Dota):
 *   Dano = (Ataque + Poder do Golpe) × (C / (C + Defesa_efetiva))
 * com C = 100 e Defesa_efetiva = defesa × 10.
 *
 * Execute com: npx ts-node scripts/testDefenseScaling.ts
 */

import { getCreatureById } from "../shared/creatures";
import { calculateEffectiveStats } from "../shared/creatureProgression";

// ============================================================================
// Cálculo de Dano (espelha server/src/systems/combat.ts)
// ============================================================================

const MIN_DAMAGE = 1;
const MIN_DEFENSE = 1;
const DAMAGE_MITIGATION_C = 100;
const DEFENSE_SCALE = 10;

function calculateDamageWithDefense(
    baseDamage: number,
    attackerAttack: number,
    defenderDefense: number
): number {
    const safeDefense = Math.max(defenderDefense, MIN_DEFENSE);
    const rawDamage = Math.max(0, attackerAttack) + Math.max(0, baseDamage);
    const effectiveDefense = safeDefense * DEFENSE_SCALE;
    const mitigation = DAMAGE_MITIGATION_C / (DAMAGE_MITIGATION_C + effectiveDefense);
    const calculatedDamage = rawDamage * mitigation;
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
    rank: number
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
        defenderStats.defense
    );

    const attacksNeeded = Math.ceil(defenderStats.hp / damagePerAttack);
    return attacksNeeded * attackerStats.attackCooldown;
}

// ============================================================================
// Análise de Balanceamento
// ============================================================================

interface BalanceMetrics {
    balancedMatchups: number; // TTK entre 3-15s
    extremeMatchups: number; // TTK < 3s ou > 30s
    avgTTK: number;
    stdDevTTK: number;
}

function computeBalanceMetrics(): BalanceMetrics {
    const creatures = ["pyrognat", "aquaryl", "verdant", "voltiger"];
    const level = 10;
    const rank = 1;

    const ttks: number[] = [];
    let balanced = 0;
    let extreme = 0;

    for (const attackerId of creatures) {
        for (const defenderId of creatures) {
            const ttk = calculateTTK(attackerId, defenderId, level, rank);
            ttks.push(ttk);

            if (ttk >= 3 && ttk <= 15) {
                balanced++;
            } else if (ttk < 3 || ttk > 30) {
                extreme++;
            }
        }
    }

    const avgTTK = ttks.reduce((a, b) => a + b, 0) / ttks.length;
    const variance = ttks.reduce((sum, ttk) => sum + Math.pow(ttk - avgTTK, 2), 0) / ttks.length;
    const stdDevTTK = Math.sqrt(variance);

    return {
        balancedMatchups: balanced,
        extremeMatchups: extreme,
        avgTTK,
        stdDevTTK
    };
}

// ============================================================================
// Execução: TTK com a fórmula atual
// ============================================================================

function runTTKTest() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  TESTE DE TTK — Fórmula: (Ataque + Poder) × C/(C+Defesa)");
    console.log("═══════════════════════════════════════════════════════════\n");

    const metrics = computeBalanceMetrics();

    console.log("Métricas de balanceamento:\n");
    console.log("  Matchups balanceados (TTK 3–15s): " + metrics.balancedMatchups + "/16");
    console.log("  Matchups extremos (TTK <3s ou >30s): " + metrics.extremeMatchups + "/16");
    console.log("  TTK médio: " + metrics.avgTTK.toFixed(2) + "s");
    console.log("  Desvio padrão: " + metrics.stdDevTTK.toFixed(2) + "s");

    const creatures = ["pyrognat", "aquaryl", "verdant", "voltiger"];
    const level = 10;
    const rank = 1;

    console.log("\nTTK por matchup (level " + level + ", rank " + rank + "):\n");

    for (const attackerId of creatures) {
        for (const defenderId of creatures) {
            const ttk = calculateTTK(attackerId, defenderId, level, rank);
            const status = ttk >= 3 && ttk <= 15 ? "✅" : ttk < 3 || ttk > 30 ? "⚠️ " : "  ";
            console.log(`${status} ${attackerId.padEnd(10)} vs ${defenderId.padEnd(10)}: ${ttk.toFixed(2)}s`);
        }
    }

    if (metrics.extremeMatchups > 4) {
        console.log("\n⚠️  Muitos matchups extremos. Considere revisar stats das criaturas.");
    } else {
        console.log("\n✅ Balanceamento dentro do esperado.");
    }
}

runTTKTest();
process.exit(0);
