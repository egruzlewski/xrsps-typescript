// Item IDs match OSRS cache values already used in this repo
// (Observatory / Desert Treasure molten glass, empty bucket 1925, vial 229).

export const SODA_ASH_ITEM_ID = 1781;
export const BUCKET_OF_SAND_ITEM_ID = 1783;
export const MOLTEN_GLASS_ITEM_ID = 1775;
export const GLASSBLOWING_PIPE_ITEM_ID = 1785;
export const EMPTY_BUCKET_ITEM_ID = 1925;

export const MOLTEN_GLASS_XP = 20;
export const MOLTEN_GLASS_LEVEL = 1;
export const MOLTEN_GLASS_ANIMATION_ID = 899; // same furnace craft as jewellery/smithing
export const MOLTEN_GLASS_DELAY_TICKS = 2;
export const GLASSBLOWING_ANIMATION_ID = 884;
export const GLASSBLOWING_SOUND_ID = 2724;
export const GLASSBLOWING_DELAY_TICKS = 3;

export interface GlassblowRecipe {
    id: string;
    name: string;
    productItemId: number;
    level: number;
    xp: number;
    animation: number;
    delayTicks: number;
}

type RecipeSeed = {
    id: string;
    name: string;
    productItemId: number;
    level: number;
    xp: number;
};

const RECIPE_SEEDS: RecipeSeed[] = [
    { id: "blow_beer_glass", name: "beer glass", productItemId: 1919, level: 1, xp: 17.5 },
    { id: "blow_candle_lantern", name: "empty candle lantern", productItemId: 4527, level: 4, xp: 19 },
    { id: "blow_oil_lamp", name: "empty oil lamp", productItemId: 4525, level: 12, xp: 25 },
    { id: "blow_vial", name: "vial", productItemId: 229, level: 33, xp: 35 },
    { id: "blow_fishbowl", name: "empty fishbowl", productItemId: 6667, level: 42, xp: 42.5 },
    { id: "blow_unpowered_orb", name: "unpowered orb", productItemId: 567, level: 46, xp: 52.5 },
    { id: "blow_lantern_lens", name: "lantern lens", productItemId: 4542, level: 49, xp: 55 },
    { id: "blow_light_orb", name: "empty light orb", productItemId: 10980, level: 87, xp: 70 },
];

export const GLASSBLOW_RECIPES: GlassblowRecipe[] = RECIPE_SEEDS.map((seed) => ({
    ...seed,
    animation: GLASSBLOWING_ANIMATION_ID,
    delayTicks: GLASSBLOWING_DELAY_TICKS,
}));

const RECIPE_BY_ID = new Map(GLASSBLOW_RECIPES.map((recipe) => [recipe.id, recipe]));

export function getGlassblowRecipeById(id: string): GlassblowRecipe | undefined {
    return RECIPE_BY_ID.get(id);
}
