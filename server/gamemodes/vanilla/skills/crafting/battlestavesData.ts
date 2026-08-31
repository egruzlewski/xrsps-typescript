// Item IDs match OSRS cache values already used in this repo
// (Scorpion Catcher elemental battlestaves, glassblowing unpowered orb 567, Zaff 1391).
// Charging unpowered orbs is Magic (Charge Water/Earth/Fire/Air Orb at obelisks), not Crafting.

export const BATTLESTAFF_ITEM_ID = 1391;
export const UNPOWERED_ORB_ITEM_ID = 567;

export const WATER_ORB_ITEM_ID = 571;
export const EARTH_ORB_ITEM_ID = 575;
export const FIRE_ORB_ITEM_ID = 569;
export const AIR_ORB_ITEM_ID = 573;

export const WATER_BATTLESTAFF_ITEM_ID = 1395;
export const EARTH_BATTLESTAFF_ITEM_ID = 1399;
export const FIRE_BATTLESTAFF_ITEM_ID = 1393;
export const AIR_BATTLESTAFF_ITEM_ID = 1397;

export const BATTLESTAFF_ANIMATION_ID = 7531;
export const BATTLESTAFF_DELAY_TICKS = 2;

export interface BattlestaffRecipe {
    id: string;
    name: string;
    orbItemId: number;
    productItemId: number;
    level: number;
    xp: number;
    animation: number;
    delayTicks: number;
}

type RecipeSeed = {
    id: string;
    name: string;
    orbItemId: number;
    productItemId: number;
    level: number;
    xp: number;
};

const RECIPE_SEEDS: RecipeSeed[] = [
    {
        id: "water_battlestaff",
        name: "water battlestaff",
        orbItemId: WATER_ORB_ITEM_ID,
        productItemId: WATER_BATTLESTAFF_ITEM_ID,
        level: 54,
        xp: 100,
    },
    {
        id: "earth_battlestaff",
        name: "earth battlestaff",
        orbItemId: EARTH_ORB_ITEM_ID,
        productItemId: EARTH_BATTLESTAFF_ITEM_ID,
        level: 58,
        xp: 112.5,
    },
    {
        id: "fire_battlestaff",
        name: "fire battlestaff",
        orbItemId: FIRE_ORB_ITEM_ID,
        productItemId: FIRE_BATTLESTAFF_ITEM_ID,
        level: 62,
        xp: 125,
    },
    {
        id: "air_battlestaff",
        name: "air battlestaff",
        orbItemId: AIR_ORB_ITEM_ID,
        productItemId: AIR_BATTLESTAFF_ITEM_ID,
        level: 66,
        xp: 137.5,
    },
];

export const BATTLESTAFF_RECIPES: BattlestaffRecipe[] = RECIPE_SEEDS.map((seed) => ({
    ...seed,
    animation: BATTLESTAFF_ANIMATION_ID,
    delayTicks: BATTLESTAFF_DELAY_TICKS,
}));

export const CHARGED_ORB_ITEM_IDS = BATTLESTAFF_RECIPES.map((recipe) => recipe.orbItemId);

const RECIPE_BY_ID = new Map(BATTLESTAFF_RECIPES.map((recipe) => [recipe.id, recipe]));
const RECIPE_BY_ORB_ID = new Map(BATTLESTAFF_RECIPES.map((recipe) => [recipe.orbItemId, recipe]));

export function getBattlestaffRecipeById(id: string): BattlestaffRecipe | undefined {
    return RECIPE_BY_ID.get(id);
}

export function getBattlestaffRecipeByOrbId(orbItemId: number): BattlestaffRecipe | undefined {
    return RECIPE_BY_ORB_ID.get(orbItemId);
}
