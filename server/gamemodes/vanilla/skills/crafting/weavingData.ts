// Item IDs match OSRS cache / wiki values already used in this repo
// (Sheep Shearer ball of wool 1759, Regicide strip of cloth 3224, sack spawn 5418).
// Loc IDs from RuneLite gameval ObjectID + OSRS wiki scenery infoboxes.

export const BALL_OF_WOOL_ITEM_ID = 1759;
export const STRIP_OF_CLOTH_ITEM_ID = 3224;
export const LINEN_YARN_ITEM_ID = 31463;
export const BOLT_OF_LINEN_ITEM_ID = 31472;
export const JUTE_FIBRE_ITEM_ID = 5931;
export const EMPTY_SACK_ITEM_ID = 5418;
export const DRIFT_NET_ITEM_ID = 21652;
export const WILLOW_BRANCH_ITEM_ID = 5933;
export const BASKET_ITEM_ID = 5376;
export const HEMP_YARN_ITEM_ID = 31466;
export const BOLT_OF_CANVAS_ITEM_ID = 31475;
export const COTTON_YARN_ITEM_ID = 31469;
export const BOLT_OF_COTTON_ITEM_ID = 31478;

export const WEAVING_ANIMATION_ID = 2270; // RuneLite AnimationID.CRAFTING_LOOM
export const WEAVING_DELAY_TICKS = 3;

export interface WeavingRecipe {
    id: string;
    name: string;
    inputName: string;
    inputItemId: number;
    productItemId: number;
    inputQuantity: number;
    outputQuantity: number;
    level: number;
    xp: number;
    animation: number;
    delayTicks: number;
    successMessage: string;
}

type RecipeSeed = Omit<
    WeavingRecipe,
    "inputQuantity" | "outputQuantity" | "animation" | "delayTicks"
> & {
    inputQuantity?: number;
    outputQuantity?: number;
    animation?: number;
    delayTicks?: number;
};

const RECIPE_SEEDS: RecipeSeed[] = [
    {
        id: "weave_strip_of_cloth",
        name: "strip of cloth",
        inputName: "balls of wool",
        inputItemId: BALL_OF_WOOL_ITEM_ID,
        productItemId: STRIP_OF_CLOTH_ITEM_ID,
        inputQuantity: 4,
        level: 10,
        xp: 12,
        successMessage: "You weave the balls of wool into a strip of cloth.",
    },
    {
        id: "weave_bolt_of_linen",
        name: "bolt of linen",
        inputName: "linen yarn",
        inputItemId: LINEN_YARN_ITEM_ID,
        productItemId: BOLT_OF_LINEN_ITEM_ID,
        inputQuantity: 2,
        level: 12,
        xp: 20,
        successMessage: "You weave the linen yarn into a bolt of linen.",
    },
    {
        id: "weave_empty_sack",
        name: "empty sack",
        inputName: "jute fibre",
        inputItemId: JUTE_FIBRE_ITEM_ID,
        productItemId: EMPTY_SACK_ITEM_ID,
        inputQuantity: 4,
        level: 21,
        xp: 38,
        successMessage: "You weave the jute fibre into an empty sack.",
    },
    {
        id: "weave_drift_net",
        name: "drift net",
        inputName: "jute fibre",
        inputItemId: JUTE_FIBRE_ITEM_ID,
        productItemId: DRIFT_NET_ITEM_ID,
        inputQuantity: 2,
        level: 26,
        xp: 55,
        successMessage: "You weave the jute fibre into a drift net.",
    },
    {
        id: "weave_basket",
        name: "basket",
        inputName: "willow branches",
        inputItemId: WILLOW_BRANCH_ITEM_ID,
        productItemId: BASKET_ITEM_ID,
        inputQuantity: 6,
        level: 36,
        xp: 56,
        successMessage: "You weave the willow branches into a basket.",
    },
    {
        id: "weave_bolt_of_canvas",
        name: "bolt of canvas",
        inputName: "hemp yarn",
        inputItemId: HEMP_YARN_ITEM_ID,
        productItemId: BOLT_OF_CANVAS_ITEM_ID,
        inputQuantity: 2,
        level: 39,
        xp: 75,
        successMessage: "You weave the hemp yarn into a bolt of canvas.",
    },
    {
        id: "weave_bolt_of_cotton",
        name: "bolt of cotton",
        inputName: "cotton yarn",
        inputItemId: COTTON_YARN_ITEM_ID,
        productItemId: BOLT_OF_COTTON_ITEM_ID,
        inputQuantity: 2,
        level: 73,
        xp: 132,
        successMessage: "You weave the cotton yarn into a bolt of cotton.",
    },
];

export const WEAVING_RECIPES: WeavingRecipe[] = RECIPE_SEEDS.map((seed) => ({
    ...seed,
    inputQuantity: Math.max(1, seed.inputQuantity ?? 1),
    outputQuantity: Math.max(1, seed.outputQuantity ?? 1),
    animation: seed.animation ?? WEAVING_ANIMATION_ID,
    delayTicks: Math.max(1, seed.delayTicks ?? WEAVING_DELAY_TICKS),
}));

const RECIPE_BY_ID = new Map(WEAVING_RECIPES.map((recipe) => [recipe.id, recipe]));

export function getWeavingRecipeById(id: string): WeavingRecipe | undefined {
    return RECIPE_BY_ID.get(id);
}

export function getWeavingRecipesByInputItemId(itemId: number): WeavingRecipe[] {
    return WEAVING_RECIPES.filter((recipe) => recipe.inputItemId === itemId);
}

export const WEAVING_INPUT_ITEM_IDS = Array.from(
    new Set(WEAVING_RECIPES.map((recipe) => recipe.inputItemId)),
);

export const LOOM_LOC_IDS = [
    787, // REGICIDE_LOOM (Iorwerth Camp)
    8717, // LOOM (South Falador Farm; reused at later looms)
    30936, // Fossil Island Museum Camp (built)
    58651, // Laguna Aurorae amenity (built)
] as const;

const LOOM_LOC_SET = new Set<number>(LOOM_LOC_IDS.map((id) => id));

export function isLoomLocId(locId: number): boolean {
    return LOOM_LOC_SET.has(locId);
}

export function isLoomLoc(locId: number, def: { name?: unknown } | undefined): boolean {
    if (isLoomLocId(locId)) return true;
    const name = String(def?.name ?? "").toLowerCase();
    return name === "loom";
}
