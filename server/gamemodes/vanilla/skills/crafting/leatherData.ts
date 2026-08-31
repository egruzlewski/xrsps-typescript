// Hide IDs match tanning outputs; armour IDs match pickpocket/ground-item/quest constants.

export const NEEDLE_ITEM_ID = 1733;
export const THREAD_ITEM_ID = 1734;
export const LEATHER_ITEM_ID = 1741;
export const HARD_LEATHER_ITEM_ID = 1743;
export const GREEN_D_LEATHER_ITEM_ID = 1745;
export const BLUE_D_LEATHER_ITEM_ID = 2505;
export const RED_D_LEATHER_ITEM_ID = 2507;
export const BLACK_D_LEATHER_ITEM_ID = 2509;
export const SNAKESKIN_ITEM_ID = 6289;

export const LEATHER_CRAFT_ANIMATION_ID = 1249; // same leatherwork anim as tanning
export const LEATHER_DELAY_TICKS = 3;
export const THREAD_USES_PER_SPOOL = 5;

export interface LeatherRecipe {
    id: string;
    name: string;
    hideItemId: number;
    hideQuantity: number;
    productItemId: number;
    level: number;
    xp: number;
    animation: number;
    delayTicks: number;
}

type LeatherSeed = {
    id: string;
    name: string;
    hideItemId: number;
    hideQuantity?: number;
    productItemId: number;
    level: number;
    xp: number;
};

const RECIPE_SEEDS: LeatherSeed[] = [
    {
        id: "leather_gloves",
        name: "leather gloves",
        hideItemId: LEATHER_ITEM_ID,
        productItemId: 1059,
        level: 1,
        xp: 13.8,
    },
    {
        id: "leather_boots",
        name: "leather boots",
        hideItemId: LEATHER_ITEM_ID,
        productItemId: 1061,
        level: 7,
        xp: 16.25,
    },
    {
        id: "leather_cowl",
        name: "leather cowl",
        hideItemId: LEATHER_ITEM_ID,
        productItemId: 1167,
        level: 9,
        xp: 18.5,
    },
    {
        id: "leather_vambraces",
        name: "leather vambraces",
        hideItemId: LEATHER_ITEM_ID,
        productItemId: 1063,
        level: 11,
        xp: 22,
    },
    {
        id: "leather_body",
        name: "leather body",
        hideItemId: LEATHER_ITEM_ID,
        productItemId: 1129,
        level: 14,
        xp: 25,
    },
    {
        id: "leather_chaps",
        name: "leather chaps",
        hideItemId: LEATHER_ITEM_ID,
        productItemId: 1095,
        level: 18,
        xp: 27,
    },
    {
        id: "coif",
        name: "coif",
        hideItemId: LEATHER_ITEM_ID,
        productItemId: 1169,
        level: 38,
        xp: 37,
    },
    {
        id: "hardleather_body",
        name: "hardleather body",
        hideItemId: HARD_LEATHER_ITEM_ID,
        productItemId: 1131,
        level: 28,
        xp: 35,
    },
    {
        id: "snakeskin_boots",
        name: "snakeskin boots",
        hideItemId: SNAKESKIN_ITEM_ID,
        hideQuantity: 6,
        productItemId: 6328,
        level: 45,
        xp: 30,
    },
    {
        id: "snakeskin_vambraces",
        name: "snakeskin vambraces",
        hideItemId: SNAKESKIN_ITEM_ID,
        hideQuantity: 8,
        productItemId: 6330,
        level: 47,
        xp: 35,
    },
    {
        id: "snakeskin_bandana",
        name: "snakeskin bandana",
        hideItemId: SNAKESKIN_ITEM_ID,
        hideQuantity: 5,
        productItemId: 6326,
        level: 48,
        xp: 45,
    },
    {
        id: "snakeskin_chaps",
        name: "snakeskin chaps",
        hideItemId: SNAKESKIN_ITEM_ID,
        hideQuantity: 12,
        productItemId: 6324,
        level: 51,
        xp: 50,
    },
    {
        id: "snakeskin_body",
        name: "snakeskin body",
        hideItemId: SNAKESKIN_ITEM_ID,
        hideQuantity: 15,
        productItemId: 6322,
        level: 53,
        xp: 55,
    },
    {
        id: "green_dhide_vamb",
        name: "green d'hide vambraces",
        hideItemId: GREEN_D_LEATHER_ITEM_ID,
        productItemId: 1065,
        level: 57,
        xp: 62,
    },
    {
        id: "green_dhide_chaps",
        name: "green d'hide chaps",
        hideItemId: GREEN_D_LEATHER_ITEM_ID,
        hideQuantity: 2,
        productItemId: 1099,
        level: 60,
        xp: 124,
    },
    {
        id: "green_dhide_body",
        name: "green d'hide body",
        hideItemId: GREEN_D_LEATHER_ITEM_ID,
        hideQuantity: 3,
        productItemId: 1135,
        level: 63,
        xp: 186,
    },
    {
        id: "blue_dhide_vamb",
        name: "blue d'hide vambraces",
        hideItemId: BLUE_D_LEATHER_ITEM_ID,
        productItemId: 2487,
        level: 66,
        xp: 70,
    },
    {
        id: "blue_dhide_chaps",
        name: "blue d'hide chaps",
        hideItemId: BLUE_D_LEATHER_ITEM_ID,
        hideQuantity: 2,
        productItemId: 2493,
        level: 68,
        xp: 140,
    },
    {
        id: "blue_dhide_body",
        name: "blue d'hide body",
        hideItemId: BLUE_D_LEATHER_ITEM_ID,
        hideQuantity: 3,
        productItemId: 2499,
        level: 71,
        xp: 210,
    },
    {
        id: "red_dhide_vamb",
        name: "red d'hide vambraces",
        hideItemId: RED_D_LEATHER_ITEM_ID,
        productItemId: 2489,
        level: 73,
        xp: 78,
    },
    {
        id: "red_dhide_chaps",
        name: "red d'hide chaps",
        hideItemId: RED_D_LEATHER_ITEM_ID,
        hideQuantity: 2,
        productItemId: 2495,
        level: 75,
        xp: 156,
    },
    {
        id: "red_dhide_body",
        name: "red d'hide body",
        hideItemId: RED_D_LEATHER_ITEM_ID,
        hideQuantity: 3,
        productItemId: 2501,
        level: 77,
        xp: 234,
    },
    {
        id: "black_dhide_vamb",
        name: "black d'hide vambraces",
        hideItemId: BLACK_D_LEATHER_ITEM_ID,
        productItemId: 2491,
        level: 79,
        xp: 86,
    },
    {
        id: "black_dhide_chaps",
        name: "black d'hide chaps",
        hideItemId: BLACK_D_LEATHER_ITEM_ID,
        hideQuantity: 2,
        productItemId: 2497,
        level: 82,
        xp: 172,
    },
    {
        id: "black_dhide_body",
        name: "black d'hide body",
        hideItemId: BLACK_D_LEATHER_ITEM_ID,
        hideQuantity: 3,
        productItemId: 2503,
        level: 84,
        xp: 258,
    },
];

export const LEATHER_RECIPES: LeatherRecipe[] = RECIPE_SEEDS.map((seed) => ({
    ...seed,
    hideQuantity: Math.max(1, seed.hideQuantity ?? 1),
    animation: LEATHER_CRAFT_ANIMATION_ID,
    delayTicks: LEATHER_DELAY_TICKS,
}));

const RECIPE_BY_ID = new Map(LEATHER_RECIPES.map((recipe) => [recipe.id, recipe]));
const RECIPES_BY_HIDE = new Map<number, LeatherRecipe[]>();
for (const recipe of LEATHER_RECIPES) {
    const list = RECIPES_BY_HIDE.get(recipe.hideItemId) ?? [];
    list.push(recipe);
    RECIPES_BY_HIDE.set(recipe.hideItemId, list);
}

export function getLeatherRecipeById(id: string): LeatherRecipe | undefined {
    return RECIPE_BY_ID.get(id);
}

export function getLeatherRecipesForHide(hideItemId: number): LeatherRecipe[] {
    return RECIPES_BY_HIDE.get(hideItemId) ?? [];
}

export const LEATHER_HIDE_ITEM_IDS = Array.from(RECIPES_BY_HIDE.keys());
