/**
 * Script de Testes de Validação do Rebalanceamento
 * 
 * Este script valida que o rebalanceamento está funcionando corretamente:
 * - Stats base estão corretos
 * - Progressões de nível estão corretas
 * - Multiplicadores de rank estão corretos
 * - Skills têm valores corretos
 * 
 * Execute com: npx ts-node scripts/testBalanceamento.ts
 */

import { getCreatureById } from "../shared/creatures";
import { calculateEffectiveStats } from "../shared/creatureProgression";
import { getSpecialSkillByCreatureId } from "../shared/attacks";
import { RANK_CONFIG } from "../shared/creatureProgression";

// ============================================================================
// Testes de Stats Base
// ============================================================================

function testBaseStats() {
    console.log("\n=== TESTE 1: Stats Base ===");

    const expectedStats = {
        pyrognat: { hp: 70, atk: 24, def: 6, spd: 280 },
        aquaryl: { hp: 110, atk: 14, def: 14, spd: 220 },
        verdant: { hp: 120, atk: 12, def: 16, spd: 200 },
        voltiger: { hp: 60, atk: 28, def: 5, spd: 300 }
    };

    let allPassed = true;

    for (const [creatureId, expected] of Object.entries(expectedStats)) {
        const creature = getCreatureById(creatureId);
        if (!creature) {
            console.error(`❌ ${creatureId}: Criatura não encontrada`);
            allPassed = false;
            continue;
        }

        const stats = creature.stats;
        const checks = [
            { name: "HP", actual: stats.hp, expected: expected.hp },
            { name: "ATK", actual: stats.attackDamage, expected: expected.atk },
            { name: "DEF", actual: stats.defense, expected: expected.def },
            { name: "SPD", actual: stats.moveSpeed, expected: expected.spd }
        ];

        for (const check of checks) {
            if (check.actual !== check.expected) {
                console.error(`❌ ${creatureId} ${check.name}: esperado ${check.expected}, obtido ${check.actual}`);
                allPassed = false;
            }
        }

        if (allPassed) {
            console.log(`✅ ${creatureId}: Stats base corretos`);
        }
    }

    return allPassed;
}

// ============================================================================
// Testes de Progressão de Nível
// ============================================================================

function testLevelProgression() {
    console.log("\n=== TESTE 2: Progressão de Nível ===");

    const creatures = ["pyrognat", "aquaryl", "verdant", "voltiger"];
    let allPassed = true;

    for (const creatureId of creatures) {
        const statsLvl1 = calculateEffectiveStats(
            { definitionId: creatureId, level: 1, rank: 1 },
            getCreatureById
        );
        const statsLvl50 = calculateEffectiveStats(
            { definitionId: creatureId, level: 50, rank: 1 },
            getCreatureById
        );

        // Verificar que nível 50 tem ~2.5-3x os stats do nível 1
        const hpRatio = statsLvl50.hp / statsLvl1.hp;
        const atkRatio = statsLvl50.attackDamage / statsLvl1.attackDamage;
        const defRatio = statsLvl50.defense / statsLvl1.defense;

        if (hpRatio < 2.0 || hpRatio > 3.5) {
            console.error(`❌ ${creatureId} HP ratio: esperado 2.0-3.5, obtido ${hpRatio.toFixed(2)}`);
            allPassed = false;
        }
        if (atkRatio < 2.0 || atkRatio > 3.5) {
            console.error(`❌ ${creatureId} ATK ratio: esperado 2.0-3.5, obtido ${atkRatio.toFixed(2)}`);
            allPassed = false;
        }
        if (defRatio < 2.0 || defRatio > 3.5) {
            console.error(`❌ ${creatureId} DEF ratio: esperado 2.0-3.5, obtido ${defRatio.toFixed(2)}`);
            allPassed = false;
        }

        if (allPassed) {
            console.log(`✅ ${creatureId}: Progressão de nível correta (Lvl 1 → 50: HP ${hpRatio.toFixed(2)}x, ATK ${atkRatio.toFixed(2)}x, DEF ${defRatio.toFixed(2)}x)`);
        }
    }

    return allPassed;
}

// ============================================================================
// Testes de Multiplicadores de Rank
// ============================================================================

function testRankMultipliers() {
    console.log("\n=== TESTE 3: Multiplicadores de Rank ===");

    const expectedMultipliers = {
        1: 1.0,
        2: 1.15,  // +15%
        3: 1.3,   // +30%
        4: 1.5,   // +50%
        5: 1.75   // +75%
    };

    let allPassed = true;

    for (const [rankStr, expected] of Object.entries(expectedMultipliers)) {
        const rank = parseInt(rankStr);
        const config = RANK_CONFIG[rank];

        if (!config) {
            console.error(`❌ Rank ${rank}: Configuração não encontrada`);
            allPassed = false;
            continue;
        }

        if (Math.abs(config.statMultiplier - expected) > 0.01) {
            console.error(`❌ Rank ${rank}: esperado ${expected}, obtido ${config.statMultiplier}`);
            allPassed = false;
        } else {
            console.log(`✅ Rank ${rank}: Multiplicador correto (${config.statMultiplier}x)`);
        }
    }

    // Verificar que Rank 5 é ~75% mais forte que Rank 1
    const rank1Multiplier = RANK_CONFIG[1].statMultiplier;
    const rank5Multiplier = RANK_CONFIG[5].statMultiplier;
    const rank5Bonus = ((rank5Multiplier / rank1Multiplier) - 1) * 100;

    if (Math.abs(rank5Bonus - 75) > 1) {
        console.error(`❌ Rank 5 bonus: esperado ~75%, obtido ${rank5Bonus.toFixed(1)}%`);
        allPassed = false;
    } else {
        console.log(`✅ Rank 5 é ${rank5Bonus.toFixed(1)}% mais forte que Rank 1`);
    }

    return allPassed;
}

// ============================================================================
// Testes de Skills
// ============================================================================

function testSkills() {
    console.log("\n=== TESTE 4: Skills Especiais ===");

    const expectedSkills = {
        pyrognat: { range: 300, cooldown: 12, radius: 75 },
        aquaryl: { range: 0, cooldown: 12, radius: 100 }, // Auto-cast
        verdant: { range: 0, cooldown: 11, radius: 80 },   // Auto-cast
        voltiger: { range: 0, cooldown: 9, radius: 100 }  // Auto-cast
    };

    let allPassed = true;

    for (const [creatureId, expected] of Object.entries(expectedSkills)) {
        const skill = getSpecialSkillByCreatureId(creatureId);
        if (!skill) {
            console.error(`❌ ${creatureId}: Skill não encontrada`);
            allPassed = false;
            continue;
        }

        const checks = [
            { name: "Range", actual: skill.range, expected: expected.range },
            { name: "Cooldown", actual: skill.cooldown, expected: expected.cooldown },
            { name: "Radius", actual: skill.radius, expected: expected.radius }
        ];

        for (const check of checks) {
            if (Math.abs(check.actual - check.expected) > 0.1) {
                console.error(`❌ ${creatureId} ${check.name}: esperado ${check.expected}, obtido ${check.actual}`);
                allPassed = false;
            }
        }

        // Verificar que Aquaryl tem damagePerTick negativo (cura)
        if (creatureId === "aquaryl" && skill.damagePerTick >= 0) {
            console.error(`❌ ${creatureId}: damagePerTick deve ser negativo (cura), obtido ${skill.damagePerTick}`);
            allPassed = false;
        }

        if (allPassed) {
            console.log(`✅ ${creatureId}: Skill correta (range=${skill.range}, cooldown=${skill.cooldown}s, radius=${skill.radius})`);
        }
    }

    return allPassed;
}

// ============================================================================
// Testes de Rank em Níveis Altos
// ============================================================================

function testRankAtHighLevels() {
    console.log("\n=== TESTE 5: Rank em Níveis Altos ===");

    const creatures = ["pyrognat", "aquaryl", "verdant", "voltiger"];
    let allPassed = true;

    for (const creatureId of creatures) {
        const statsLvl50Rank1 = calculateEffectiveStats(
            { definitionId: creatureId, level: 50, rank: 1 },
            getCreatureById
        );
        const statsLvl50Rank5 = calculateEffectiveStats(
            { definitionId: creatureId, level: 50, rank: 5 },
            getCreatureById
        );

        // Verificar que Rank 5 é ~75% mais forte que Rank 1 em nível alto
        const hpRatio = statsLvl50Rank5.hp / statsLvl50Rank1.hp;
        const atkRatio = statsLvl50Rank5.attackDamage / statsLvl50Rank1.attackDamage;
        const defRatio = statsLvl50Rank5.defense / statsLvl50Rank1.defense;

        const expectedRatio = RANK_CONFIG[5].statMultiplier / RANK_CONFIG[1].statMultiplier; // 1.75

        if (Math.abs(hpRatio - expectedRatio) > 0.01) {
            console.error(`❌ ${creatureId} HP ratio (Rank 5 vs Rank 1): esperado ${expectedRatio}, obtido ${hpRatio.toFixed(2)}`);
            allPassed = false;
        }
        if (Math.abs(atkRatio - expectedRatio) > 0.01) {
            console.error(`❌ ${creatureId} ATK ratio (Rank 5 vs Rank 1): esperado ${expectedRatio}, obtido ${atkRatio.toFixed(2)}`);
            allPassed = false;
        }
        if (Math.abs(defRatio - expectedRatio) > 0.01) {
            console.error(`❌ ${creatureId} DEF ratio (Rank 5 vs Rank 1): esperado ${expectedRatio}, obtido ${defRatio.toFixed(2)}`);
            allPassed = false;
        }

        if (allPassed) {
            console.log(`✅ ${creatureId}: Rank 5 é ${((expectedRatio - 1) * 100).toFixed(0)}% mais forte que Rank 1 em nível 50`);
        }
    }

    return allPassed;
}

// ============================================================================
// Execução dos Testes
// ============================================================================

function runAllTests() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  TESTES DE VALIDAÇÃO DO REBALANCEAMENTO");
    console.log("═══════════════════════════════════════════════════════════");

    const results = [
        { name: "Stats Base", passed: testBaseStats() },
        { name: "Progressão de Nível", passed: testLevelProgression() },
        { name: "Multiplicadores de Rank", passed: testRankMultipliers() },
        { name: "Skills Especiais", passed: testSkills() },
        { name: "Rank em Níveis Altos", passed: testRankAtHighLevels() }
    ];

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  RESULTADOS FINAIS");
    console.log("═══════════════════════════════════════════════════════════");

    let totalPassed = 0;
    for (const result of results) {
        const status = result.passed ? "✅ PASSOU" : "❌ FALHOU";
        console.log(`${status}: ${result.name}`);
        if (result.passed) totalPassed++;
    }

    console.log(`\nTotal: ${totalPassed}/${results.length} testes passaram`);

    if (totalPassed === results.length) {
        console.log("\n🎉 Todos os testes passaram! O rebalanceamento está correto.");
        process.exit(0);
    } else {
        console.log("\n⚠️  Alguns testes falharam. Revise os valores acima.");
        process.exit(1);
    }
}

// Executar testes
runAllTests();
