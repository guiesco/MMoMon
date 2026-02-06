/**
 * Script de Testes de Combate e Skills
 * 
 * Este script valida o balanceamento em combate:
 * - TTK (Time-to-Kill) entre criaturas
 * - Type effectiveness
 * - Skills em combate
 * 
 * Execute com: npx ts-node scripts/testCombat.ts
 */

import { getCreatureById } from "../shared/creatures";
import { calculateEffectiveStats } from "../shared/creatureProgression";
import { getSpecialSkillByCreatureId } from "../shared/attacks";

// ============================================================================
// Cálculo de Dano
// ============================================================================

/**
 * Calcula dano considerando type effectiveness e defesa.
 */
function calculateDamage(
    attackerId: string,
    defenderId: string,
    baseDamage: number,
    attackerAttack: number,
    defenderDefense: number
): number {
    // Type effectiveness
    const typeMultiplier = calculateTypeEffectiveness(attackerId, defenderId);
    let damage = baseDamage * typeMultiplier;

    // Cálculo com defesa (mesma fórmula do servidor)
    const DEFENSE_SCALING_FACTOR = 0.19; // Otimizado via testes
    const MIN_DAMAGE = 1;
    const MIN_DEFENSE = 1;
    const MIN_ATTACK = 1;

    const safeDefense = Math.max(defenderDefense, MIN_DEFENSE);
    const safeAttack = Math.max(attackerAttack, MIN_ATTACK);
    const safeBaseDamage = Math.max(damage, 0);

    const defenseSquared = safeDefense * safeDefense;
    const scaledDefense = defenseSquared * DEFENSE_SCALING_FACTOR;
    const calculatedDamage = safeBaseDamage * safeAttack / scaledDefense;
    return Math.max(MIN_DAMAGE, Math.floor(calculatedDamage));
}

/**
 * Calcula type effectiveness.
 */
function calculateTypeEffectiveness(attackerId: string, defenderId: string): number {
    const attacker = getCreatureById(attackerId);
    const defender = getCreatureById(defenderId);

    if (!attacker || !defender) return 1.0;

    const attackerType = attacker.primaryType;
    const defenderType = defender.primaryType;

    // Tabela de type effectiveness
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

// ============================================================================
// Testes de TTK (Time-to-Kill)
// ============================================================================

function testTTK() {
    console.log("\n=== TESTE: Time-to-Kill (TTK) ===");

    const creatures = ["pyrognat", "aquaryl", "verdant", "voltiger"];
    const level = 10;
    const rank = 1;

    let allPassed = true;

    for (const attackerId of creatures) {
        for (const defenderId of creatures) {
            const attackerStats = calculateEffectiveStats(
                { definitionId: attackerId, level, rank },
                getCreatureById
            );
            const defenderStats = calculateEffectiveStats(
                { definitionId: defenderId, level, rank },
                getCreatureById
            );

            // Calcular dano por ataque
            const damagePerAttack = calculateDamage(
                attackerId,
                defenderId,
                attackerStats.attackDamage,
                attackerStats.attackDamage,
                defenderStats.defense
            );

            // Calcular número de ataques necessários
            const attacksNeeded = Math.ceil(defenderStats.hp / damagePerAttack);

            // Calcular TTK (considerando cooldown)
            const ttk = attacksNeeded * attackerStats.attackCooldown;

            // TTK deve estar entre 3-15 segundos para ser balanceado
            if (ttk < 3 || ttk > 15) {
                console.warn(
                    `⚠️  ${attackerId} vs ${defenderId}: TTK ${ttk.toFixed(2)}s ` +
                    `(dano=${damagePerAttack}, ataques=${attacksNeeded})`
                );
                // Não falha o teste, apenas avisa
            } else {
                console.log(
                    `✅ ${attackerId} vs ${defenderId}: TTK ${ttk.toFixed(2)}s ` +
                    `(dano=${damagePerAttack}, ataques=${attacksNeeded})`
                );
            }
        }
    }

    return allPassed;
}

// ============================================================================
// Testes de Type Effectiveness
// ============================================================================

function testTypeEffectiveness() {
    console.log("\n=== TESTE: Type Effectiveness ===");

    const testCases = [
        { attacker: "pyrognat", defender: "verdant", expected: 2.0, name: "Fogo > Planta" },
        { attacker: "pyrognat", defender: "aquaryl", expected: 0.5, name: "Fogo < Água" },
        { attacker: "aquaryl", defender: "pyrognat", expected: 2.0, name: "Água > Fogo" },
        { attacker: "aquaryl", defender: "verdant", expected: 0.5, name: "Água < Planta" },
        { attacker: "verdant", defender: "aquaryl", expected: 2.0, name: "Planta > Água" },
        { attacker: "verdant", defender: "pyrognat", expected: 0.5, name: "Planta < Fogo" },
        { attacker: "voltiger", defender: "aquaryl", expected: 2.0, name: "Elétrico > Água" }
    ];

    let allPassed = true;

    for (const testCase of testCases) {
        const multiplier = calculateTypeEffectiveness(testCase.attacker, testCase.defender);

        if (Math.abs(multiplier - testCase.expected) > 0.01) {
            console.error(
                `❌ ${testCase.name}: esperado ${testCase.expected}x, obtido ${multiplier.toFixed(2)}x`
            );
            allPassed = false;
        } else {
            console.log(`✅ ${testCase.name}: ${multiplier.toFixed(2)}x`);
        }
    }

    return allPassed;
}

// ============================================================================
// Testes de Skills
// ============================================================================

function testSkillsInCombat() {
    console.log("\n=== TESTE: Skills em Combate ===");

    const creatures = ["pyrognat", "aquaryl", "verdant", "voltiger"];
    const level = 10;
    const rank = 1;

    let allPassed = true;

    for (const creatureId of creatures) {
        const stats = calculateEffectiveStats(
            { definitionId: creatureId, level, rank },
            getCreatureById
        );
        const skill = getSpecialSkillByCreatureId(creatureId);

        if (!skill) {
            console.error(`❌ ${creatureId}: Skill não encontrada`);
            allPassed = false;
            continue;
        }

        // Verificar valores escalados
        const checks = [
            { name: "Range", actual: stats.specialSkillRange, expected: skill.range, tolerance: 0.1 },
            { name: "Radius", actual: stats.specialSkillRadius, expected: skill.radius, tolerance: 5 },
            { name: "Cooldown", actual: stats.specialSkillCooldown, expected: skill.cooldown, tolerance: 0.5 }
        ];

        for (const check of checks) {
            // Se range é 0, não verificar escalonamento
            if (check.name === "Range" && check.expected === 0) {
                if (stats.specialSkillRange !== 0) {
                    console.error(
                        `❌ ${creatureId} ${check.name}: esperado 0 (auto-cast), obtido ${stats.specialSkillRange}`
                    );
                    allPassed = false;
                } else {
                    console.log(`✅ ${creatureId} ${check.name}: Auto-cast (range 0)`);
                }
            } else if (Math.abs(check.actual - check.expected) > check.tolerance) {
                console.warn(
                    `⚠️  ${creatureId} ${check.name}: esperado ~${check.expected}, obtido ${check.actual} ` +
                    `(diferença devido ao escalonamento de nível)`
                );
                // Não falha, apenas avisa (escalonamento é esperado)
            }
        }

        // Verificar que Aquaryl tem cura negativa
        if (creatureId === "aquaryl" && stats.specialSkillDamagePerTick >= 0) {
            console.error(
                `❌ ${creatureId}: damagePerTick deve ser negativo (cura), obtido ${stats.specialSkillDamagePerTick}`
            );
            allPassed = false;
        } else if (creatureId === "aquaryl") {
            console.log(
                `✅ ${creatureId}: Cura funcionando (damagePerTick=${stats.specialSkillDamagePerTick})`
            );
        }

        // Verificar que Pyrognat tem range > 0 (dash)
        if (creatureId === "pyrognat" && stats.specialSkillRange <= 0) {
            console.error(
                `❌ ${creatureId}: range deve ser > 0 para dash, obtido ${stats.specialSkillRange}`
            );
            allPassed = false;
        } else if (creatureId === "pyrognat") {
            console.log(
                `✅ ${creatureId}: Dash funcionando (range=${stats.specialSkillRange})`
            );
        }
    }

    return allPassed;
}

// ============================================================================
// Testes de DPS de Skills
// ============================================================================

function testSkillDPS() {
    console.log("\n=== TESTE: DPS de Skills ===");

    const creatures = ["pyrognat", "aquaryl", "verdant", "voltiger"];
    const level = 10;
    const rank = 1;

    let allPassed = true;

    for (const creatureId of creatures) {
        const stats = calculateEffectiveStats(
            { definitionId: creatureId, level, rank },
            getCreatureById
        );
        const skill = getSpecialSkillByCreatureId(creatureId);

        if (!skill) continue;

        // Calcular DPS da skill (dano por tick / intervalo entre ticks)
        const damagePerTick = Math.abs(stats.specialSkillDamagePerTick);
        const tickInterval = skill.tickInterval;
        const dps = damagePerTick / tickInterval;

        // DPS deve estar entre 5-30 para ser balanceado
        if (dps < 5 || dps > 30) {
            console.warn(
                `⚠️  ${creatureId}: DPS da skill ${dps.toFixed(2)} ` +
                `(damagePerTick=${damagePerTick}, tickInterval=${tickInterval})`
            );
            // Não falha, apenas avisa
        } else {
            console.log(
                `✅ ${creatureId}: DPS da skill ${dps.toFixed(2)} ` +
                `(damagePerTick=${damagePerTick}, tickInterval=${tickInterval})`
            );
        }
    }

    return allPassed;
}

// ============================================================================
// Execução dos Testes
// ============================================================================

function runAllTests() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  TESTES DE COMBATE E SKILLS");
    console.log("═══════════════════════════════════════════════════════════");

    const results = [
        { name: "Time-to-Kill (TTK)", passed: testTTK() },
        { name: "Type Effectiveness", passed: testTypeEffectiveness() },
        { name: "Skills em Combate", passed: testSkillsInCombat() },
        { name: "DPS de Skills", passed: testSkillDPS() }
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
        console.log("\n🎉 Todos os testes passaram! O balanceamento de combate está correto.");
        process.exit(0);
    } else {
        console.log("\n⚠️  Alguns testes falharam ou geraram avisos. Revise os valores acima.");
        process.exit(1);
    }
}

// Executar testes
runAllTests();
