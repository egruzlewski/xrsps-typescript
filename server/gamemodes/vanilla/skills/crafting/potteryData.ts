// Item IDs match OSRS cache values already used in this repo
// (prince Ali soft clay, Dragon Slayer unfired bowl). Loc IDs from OSRS wiki / RuneLite.

export const SOFT_CLAY_ITEM_ID = 1761;
export const POTTERY_WHEEL_ANIMATION_ID = 883;
export const POTTERY_FIRE_ANIMATION_ID = 899; // same furnace craft as jewellery/smithing
export const POTTERY_DELAY_TICKS = 3;

export interface PotteryShapeRecipe {
    id: string;
    name: string;
    unfiredItemId: number;
    unfiredQuantity: number;
    level: number;
    xp: number;
    animation: number;
    delayTicks: number;
}

export interface PotteryFireRecipe {
    id: string;
    name: string;
    unfiredItemId: number;
    productItemId: number;
    xp: number;
    animation: number;
    delayTicks: number;
}

type ShapeSeed = {
    id: string;
    name: string;
    unfiredItemId: number;
    unfiredQuantity?: number;
    level: number;
    xp: number;
};

type FireSeed = {
    id: string;
    name: string;
    unfiredItemId: number;
    productItemId: number;
    xp: number;
};

const SHAPE_SEEDS: ShapeSeed[] = [
    {
        id: "shape_pot",
        name: "unfired pot",
        unfiredItemId: 1787,
        level: 1,
        xp: 6.3,
    },
    {
        id: "shape_cup",
        name: "unfired cup",
        unfiredItemId: 28193,
        unfiredQuantity: 4,
        level: 3,
        xp: 8.5,
    },
    {
        id: "shape_pie_dish",
        name: "unfired pie dish",
        unfiredItemId: 1789,
        level: 7,
        xp: 15,
    },
    {
        id: "shape_bowl",
        name: "unfired bowl",
        unfiredItemId: 1791,
        level: 8,
        xp: 18,
    },
    {
        id: "shape_plant_pot",
        name: "unfired plant pot",
        unfiredItemId: 5352,
        level: 19,
        xp: 20,
    },
    {
        id: "shape_pot_lid",
        name: "unfired pot lid",
        unfiredItemId: 4438,
        level: 25,
        xp: 20,
    },
];

const FIRE_SEEDS: FireSeed[] = [
    { id: "fire_pot", name: "pot", unfiredItemId: 1787, productItemId: 1931, xp: 6.3 },
    { id: "fire_cup", name: "empty cup", unfiredItemId: 28193, productItemId: 1980, xp: 8.5 },
    { id: "fire_pie_dish", name: "pie dish", unfiredItemId: 1789, productItemId: 2313, xp: 10 },
    { id: "fire_bowl", name: "bowl", unfiredItemId: 1791, productItemId: 1923, xp: 15 },
    { id: "fire_plant_pot", name: "empty plant pot", unfiredItemId: 5352, productItemId: 5350, xp: 17.5 },
    { id: "fire_pot_lid", name: "pot lid", unfiredItemId: 4438, productItemId: 4440, xp: 20 },
];

export const POTTERY_SHAPE_RECIPES: PotteryShapeRecipe[] = SHAPE_SEEDS.map((seed) => ({
    ...seed,
    unfiredQuantity: Math.max(1, seed.unfiredQuantity ?? 1),
    animation: POTTERY_WHEEL_ANIMATION_ID,
    delayTicks: POTTERY_DELAY_TICKS,
}));

export const POTTERY_FIRE_RECIPES: PotteryFireRecipe[] = FIRE_SEEDS.map((seed) => ({
    ...seed,
    animation: POTTERY_FIRE_ANIMATION_ID,
    delayTicks: POTTERY_DELAY_TICKS,
}));

const SHAPE_BY_ID = new Map(POTTERY_SHAPE_RECIPES.map((recipe) => [recipe.id, recipe]));
const FIRE_BY_ID = new Map(POTTERY_FIRE_RECIPES.map((recipe) => [recipe.id, recipe]));
const FIRE_BY_UNFIRED = new Map(POTTERY_FIRE_RECIPES.map((recipe) => [recipe.unfiredItemId, recipe]));

export function getPotteryShapeRecipeById(id: string): PotteryShapeRecipe | undefined {
    return SHAPE_BY_ID.get(id);
}

export function getPotteryFireRecipeById(id: string): PotteryFireRecipe | undefined {
    return FIRE_BY_ID.get(id);
}

export function getPotteryFireRecipeByUnfiredId(itemId: number): PotteryFireRecipe | undefined {
    return FIRE_BY_UNFIRED.get(itemId);
}

export const UNFIRED_POTTERY_ITEM_IDS = POTTERY_FIRE_RECIPES.map((recipe) => recipe.unfiredItemId);

export const POTTER_WHEEL_LOC_IDS = [
    4310, // VIKING_POTTERYWHEEL (Rellekka)
    14887, // Potter's Wheel (Barbarian Village, Crafting Guild, Ardougne, Exam Centre)
    20375, // Sophanem
    39395, // Darkmeyer
    40733, // Isle of Souls
    50732, // Civitas illa Fortis
] as const;

export const POTTERY_OVEN_LOC_IDS = [
    4308, // VIKING_POTTERYOVEN (Rellekka)
    11601, // FAI_BARBARIAN_POTTERY_OVEN (Barbarian Village, Ardougne, Varlamore)
    11602, // FAI_BARBARIAN_POTTERY_OVEN_GLOW
    14888, // Crafting Guild
    39396, // Darkmeyer
] as const;

const WHEEL_LOC_SET = new Set<number>(POTTER_WHEEL_LOC_IDS.map((id) => id));
const OVEN_LOC_SET = new Set<number>(POTTERY_OVEN_LOC_IDS.map((id) => id));

export function isPotterWheelLocId(locId: number): boolean {
    return WHEEL_LOC_SET.has(locId);
}

export function isPotteryOvenLocId(locId: number): boolean {
    return OVEN_LOC_SET.has(locId);
}

export function isPotterWheelLoc(
    locId: number,
    def: { name?: unknown } | undefined,
): boolean {
    if (isPotterWheelLocId(locId)) return true;
    const name = String(def?.name ?? "").toLowerCase();
    return name.includes("potter") && name.includes("wheel");
}

export function isPotteryOvenLoc(
    locId: number,
    def: { name?: unknown } | undefined,
): boolean {
    if (isPotteryOvenLocId(locId)) return true;
    const name = String(def?.name ?? "").toLowerCase();
    return name.includes("pottery") && name.includes("oven");
}
