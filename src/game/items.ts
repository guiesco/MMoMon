import type { CraftingRecipe, ItemDefinition } from "./types";

export const ITEMS: ItemDefinition[] = [
  {
    id: "poke-ball-basic",
    name: "Pokébola Básica",
    kind: "capture_tool",
    tier: "Básico",
    description: "Ferramenta básica de captura. Chance padrão."
  },
  {
    id: "poke-ball-ultra",
    name: "Ultra Bola",
    kind: "capture_tool",
    tier: "Épico",
    description: "Ferramenta avançada de captura. Grande aumento na chance."
  },
  {
    id: "poke-ball-precisa",
    name: "Bola Precisa",
    kind: "capture_tool",
    tier: "Avançado",
    description: "Pokébola ajustada para alvos já enfraquecidos. Melhor com pouco HP."
  },
  {
    id: "potion-basic",
    name: "Poção",
    kind: "consumable",
    tier: "Básico",
    description: "Restaura uma pequena quantidade de HP."
  },
  {
    id: "resource-ferro-cristalino",
    name: "Ferro Cristalino",
    kind: "raw_resource",
    tier: "Básico",
    description: "Material bruto usado em receitas de captura."
  },
  {
    id: "resource-mola-precisao",
    name: "Mola de Precisão",
    kind: "raw_resource",
    tier: "Avançado",
    description: "Componente mecânico raro para pokébolas avançadas."
  },
  {
    id: "resource-energia-pura",
    name: "Energia Pura",
    kind: "raw_resource",
    tier: "Épico",
    description: "Essência energética altamente instável."
  },
  {
    id: "resource-seiva-eterna",
    name: "Seiva Eterna",
    kind: "raw_resource",
    tier: "Avançado",
    description:
      "Recurso raro da Floresta Celestial, usado em poções e upgrades sutis."
  },
  {
    id: "resource-cristal-caverna",
    name: "Cristal de Caverna",
    kind: "raw_resource",
    tier: "Avançado",
    description:
      "Cristal refinado encontrado em cavernas, base para equipamentos resistentes."
  },
  {
    id: "resource-essencia-sombria",
    name: "Essência Sombria",
    kind: "raw_resource",
    tier: "Épico",
    description:
      "Essência concentrada de biomas pantanosos, instável mas poderosa."
  },
  {
    id: "upgrade-slot-equipe",
    name: "Plano de Expansão de Equipe",
    kind: "base_upgrade",
    tier: "Avançado",
    description:
      "Projeto que permite liberar mais um slot de criatura na equipe da expedição."
  }
];

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: "recipe-poke-ball-basic",
    resultItemId: "poke-ball-basic",
    timeSeconds: 20,
    ingredients: [
      { itemId: "resource-ferro-cristalino", quantity: 2 }
    ]
  },
  {
    id: "recipe-ultra-ball",
    resultItemId: "poke-ball-ultra",
    timeSeconds: 45,
    ingredients: [
      { itemId: "resource-ferro-cristalino", quantity: 2 },
      { itemId: "resource-mola-precisao", quantity: 1 },
      { itemId: "resource-energia-pura", quantity: 1 }
    ]
  },
  {
    id: "recipe-precise-ball",
    resultItemId: "poke-ball-precisa",
    timeSeconds: 35,
    ingredients: [
      { itemId: "resource-ferro-cristalino", quantity: 2 },
      { itemId: "resource-mola-precisao", quantity: 2 }
    ]
  },
  {
    id: "recipe-potion-basic",
    resultItemId: "potion-basic",
    timeSeconds: 25,
    ingredients: [
      { itemId: "resource-ferro-cristalino", quantity: 1 },
      { itemId: "resource-seiva-eterna", quantity: 1 }
    ]
  },
  {
    id: "recipe-upgrade-team-slot",
    resultItemId: "upgrade-slot-equipe",
    timeSeconds: 45,
    ingredients: [
      { itemId: "resource-seiva-eterna", quantity: 2 },
      { itemId: "resource-essencia-sombria", quantity: 1 }
    ]
  }
];

export function getItemById(id: string): ItemDefinition | undefined {
  return ITEMS.find((i) => i.id === id);
}

