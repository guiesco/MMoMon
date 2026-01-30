import type { CreatureDefinition, ElementType } from "./types";

// Matriz simples de vantagens de tipo (multiplicador de dano)
export const typeEffectiveness: Record<ElementType, Partial<Record<ElementType, number>>> = {
  Fogo: { Planta: 2, Água: 0.5, Terrestre: 0.5 },
  Água: { Fogo: 2, Planta: 0.5, Elétrico: 0.5 },
  Planta: { Água: 2, Fogo: 0.5, Voador: 0.5 },
  Elétrico: { Água: 2, Terrestre: 0.5, Planta: 0.5 },
  Psíquico: { Lutador: 2 },
  Terrestre: { Elétrico: 2, Voador: 0 },
  Voador: { Planta: 2, Elétrico: 0.5 },
  Lutador: { Psíquico: 0.5 }
};

export const CREATURES: CreatureDefinition[] = [
  {
    id: "pyrognat",
    name: "Pyrognat",
    primaryType: "Fogo",
    secondaryType: "Voador",
    stats: {
      hp: 80,
      moveSpeed: 260,
      defense: 8,
      attackDamage: 20,
      skillCooldown: 12
    },
    basicAttack: {
      name: "Chama Rápida",
      description: "Projétil de fogo de curto alcance.",
      range: 220,
      damage: 20,
      cooldown: 0.8,
      isProjectile: true
    },
    specialSkill: {
      name: "Nevoeiro Incendiário",
      description:
        "Área no chão que causa dano por segundo e reduz velocidade de inimigos.",
      cooldown: 12
    },
    evolutionChain: ["Pyrognat", "Pyrodactyl", "Solaraptor"]
  },
  {
    id: "aquaryl",
    name: "Aquaryl",
    primaryType: "Água",
    stats: {
      hp: 90,
      moveSpeed: 240,
      defense: 10,
      attackDamage: 16,
      skillCooldown: 10
    },
    basicAttack: {
      name: "Jato d'Água",
      description: "Projétil de água de médio alcance.",
      range: 260,
      damage: 18,
      cooldown: 0.9,
      isProjectile: true
    },
    specialSkill: {
      name: "Maré Curativa",
      description: "Área que regenera um pouco de HP do usuário.",
      cooldown: 14
    }
  },
  {
    id: "verdant",
    name: "Verdant",
    primaryType: "Planta",
    stats: {
      hp: 100,
      moveSpeed: 220,
      defense: 12,
      attackDamage: 14,
      skillCooldown: 11
    },
    basicAttack: {
      name: "Chicote de Vinha",
      description: "Ataque melee curto, rápido.",
      range: 80,
      damage: 16,
      cooldown: 0.7,
      isProjectile: false
    },
    specialSkill: {
      name: "Raízes Prendentes",
      description: "Enraíza inimigos em pequena área por pouco tempo.",
      cooldown: 13
    }
  },
  {
    id: "voltiger",
    name: "Voltiger",
    primaryType: "Elétrico",
    secondaryType: "Lutador",
    stats: {
      hp: 70,
      moveSpeed: 280,
      defense: 6,
      attackDamage: 22,
      skillCooldown: 9
    },
    basicAttack: {
      name: "Raio Cortante",
      description: "Dispara um raio elétrico de alto dano em linha reta.",
      range: 280,
      damage: 24,
      cooldown: 1,
      isProjectile: true
    },
    specialSkill: {
      name: "Surto Elétrico",
      description:
        "Explosão curta ao redor do usuário que empurra inimigos próximos.",
      cooldown: 11
    }
  }
];

export function getCreatureById(id: string): CreatureDefinition | undefined {
  return CREATURES.find((c) => c.id === id);
}

