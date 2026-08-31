// Item IDs match OSRS cache values already used in this repo
// (family crest moulds/ruby, smithing bars, pickpocket gems, spinning wool).

export const GOLD_BAR_ITEM_ID = 2357;
export const SILVER_BAR_ITEM_ID = 2355;
export const BALL_OF_WOOL_ITEM_ID = 1759;
export const CHISEL_ITEM_ID = 1755;

export const RING_MOULD_ITEM_ID = 1592;
export const NECKLACE_MOULD_ITEM_ID = 1597;
export const AMULET_MOULD_ITEM_ID = 1595;
export const BRACELET_MOULD_ITEM_ID = 11065;
export const HOLY_MOULD_ITEM_ID = 1599;
export const TIARA_MOULD_ITEM_ID = 5523;
export const SICKLE_MOULD_ITEM_ID = 2976;

export const CRUSHED_GEM_ITEM_ID = 1633;
export const UNCUT_ONYX_ITEM_ID = 6571;
export const ONYX_ITEM_ID = 6573;
export const UNCUT_ZENYTE_ITEM_ID = 19496;
export const ZENYTE_ITEM_ID = 19493;
export const ZENYTE_SHARD_ITEM_ID = 19529;

export const JEWELLERY_FURNACE_ANIMATION_ID = 899; // same furnace craft as smithing
export const GEM_CUT_ANIMATION_ID = 891;
export const AMULET_STRING_ANIMATION_ID = 890;
export const JEWELLERY_DELAY_TICKS = 3;
export const GEM_CUT_DELAY_TICKS = 2;
export const AMULET_STRING_DELAY_TICKS = 2;

export type JewelleryShape = "ring" | "necklace" | "bracelet" | "amulet";

export interface JewelleryRecipe {
    id: string;
    name: string;
    barItemId: number;
    mouldItemId: number;
    gemItemId?: number;
    productItemId: number;
    level: number;
    xp: number;
    animation: number;
    delayTicks: number;
}

export interface GemCutCrush {
    /** OSRS skilling-success low numerator (level 1). */
    low: number;
    /** OSRS skilling-success high numerator (level 99). */
    high: number;
    xp: number;
}

export interface GemCutRecipe {
    id: string;
    name: string;
    uncutItemId: number;
    cutItemId: number;
    level: number;
    xp: number;
    animation: number;
    delayTicks: number;
    crush?: GemCutCrush;
}

export interface ZenyteFuseRecipe {
    id: string;
    name: string;
    shardItemId: number;
    gemItemId: number;
    productItemId: number;
    level: number;
    xp: number;
    animation: number;
    delayTicks: number;
}

export interface AmuletStringRecipe {
    id: string;
    name: string;
    unstrungItemId: number;
    productItemId: number;
    level: number;
    xp: number;
    animation: number;
    delayTicks: number;
}

type JewelleryShapeSeed = {
    shape: JewelleryShape;
    mouldItemId: number;
    noun: string;
};

const JEWELLERY_SHAPES: JewelleryShapeSeed[] = [
    { shape: "ring", mouldItemId: RING_MOULD_ITEM_ID, noun: "ring" },
    { shape: "necklace", mouldItemId: NECKLACE_MOULD_ITEM_ID, noun: "necklace" },
    { shape: "bracelet", mouldItemId: BRACELET_MOULD_ITEM_ID, noun: "bracelet" },
    { shape: "amulet", mouldItemId: AMULET_MOULD_ITEM_ID, noun: "amulet" },
];

type GemSeed = {
    key: string;
    adjective: string;
    gemItemId?: number;
    levels: Record<JewelleryShape, number>;
    xp: Record<JewelleryShape, number>;
    products: Record<JewelleryShape, number>;
};

const GOLD_GEM_SEEDS: GemSeed[] = [
    {
        key: "gold",
        adjective: "gold",
        levels: { ring: 5, necklace: 6, bracelet: 7, amulet: 8 },
        xp: { ring: 15, necklace: 20, bracelet: 25, amulet: 30 },
        products: { ring: 1635, necklace: 1654, bracelet: 11069, amulet: 1673 },
    },
    {
        key: "sapphire",
        adjective: "sapphire",
        gemItemId: 1607,
        levels: { ring: 20, necklace: 22, bracelet: 23, amulet: 24 },
        xp: { ring: 40, necklace: 55, bracelet: 60, amulet: 65 },
        products: { ring: 1637, necklace: 1656, bracelet: 11072, amulet: 1675 },
    },
    {
        key: "emerald",
        adjective: "emerald",
        gemItemId: 1605,
        levels: { ring: 27, necklace: 29, bracelet: 30, amulet: 31 },
        xp: { ring: 55, necklace: 60, bracelet: 65, amulet: 70 },
        products: { ring: 1639, necklace: 1658, bracelet: 11076, amulet: 1677 },
    },
    {
        key: "ruby",
        adjective: "ruby",
        gemItemId: 1603,
        levels: { ring: 34, necklace: 40, bracelet: 42, amulet: 50 },
        xp: { ring: 70, necklace: 75, bracelet: 80, amulet: 85 },
        products: { ring: 1641, necklace: 1660, bracelet: 11085, amulet: 1679 },
    },
    {
        key: "diamond",
        adjective: "diamond",
        gemItemId: 1601,
        levels: { ring: 43, necklace: 56, bracelet: 58, amulet: 70 },
        xp: { ring: 85, necklace: 90, bracelet: 95, amulet: 100 },
        products: { ring: 1643, necklace: 1662, bracelet: 11092, amulet: 1681 },
    },
    {
        key: "dragonstone",
        adjective: "dragonstone",
        gemItemId: 1615,
        levels: { ring: 55, necklace: 72, bracelet: 74, amulet: 80 },
        xp: { ring: 100, necklace: 105, bracelet: 110, amulet: 150 },
        products: { ring: 1645, necklace: 1664, bracelet: 11115, amulet: 1683 },
    },
    {
        key: "onyx",
        adjective: "onyx",
        gemItemId: ONYX_ITEM_ID,
        levels: { ring: 67, necklace: 82, bracelet: 84, amulet: 90 },
        xp: { ring: 115, necklace: 120, bracelet: 125, amulet: 165 },
        products: { ring: 6575, necklace: 6577, bracelet: 11130, amulet: 6579 },
    },
    {
        key: "zenyte",
        adjective: "zenyte",
        gemItemId: ZENYTE_ITEM_ID,
        levels: { ring: 89, necklace: 92, bracelet: 95, amulet: 98 },
        xp: { ring: 150, necklace: 165, bracelet: 180, amulet: 200 },
        products: { ring: 19538, necklace: 19535, bracelet: 19532, amulet: 19501 },
    },
];

/** Silver bar + cut opal/jade/red topaz (OSRS silver gem jewellery). */
const SILVER_GEM_SEEDS: GemSeed[] = [
    {
        key: "opal",
        adjective: "opal",
        gemItemId: 1609,
        levels: { ring: 1, necklace: 16, bracelet: 22, amulet: 27 },
        xp: { ring: 10, necklace: 35, bracelet: 45, amulet: 55 },
        products: { ring: 21081, necklace: 21090, bracelet: 21117, amulet: 21099 },
    },
    {
        key: "jade",
        adjective: "jade",
        gemItemId: 1611,
        levels: { ring: 13, necklace: 25, bracelet: 29, amulet: 34 },
        xp: { ring: 32, necklace: 54, bracelet: 60, amulet: 70 },
        products: { ring: 21084, necklace: 21093, bracelet: 21120, amulet: 21102 },
    },
    {
        key: "topaz",
        adjective: "topaz",
        gemItemId: 1613,
        levels: { ring: 16, necklace: 32, bracelet: 38, amulet: 45 },
        xp: { ring: 35, necklace: 70, bracelet: 75, amulet: 80 },
        products: { ring: 21087, necklace: 21096, bracelet: 21123, amulet: 21105 },
    },
];

function recipesFromGemSeeds(
    seeds: GemSeed[],
    barItemId: number,
    plainKey?: string,
): JewelleryRecipe[] {
    return seeds.flatMap((gem) =>
        JEWELLERY_SHAPES.map((shape) => ({
            id: `${gem.key}_${shape.shape}`,
            name:
                gem.key === plainKey
                    ? `${gem.adjective} ${shape.noun}`
                    : shape.shape === "amulet"
                      ? `${gem.adjective} amulet`
                      : `${gem.adjective} ${shape.noun}`,
            barItemId,
            mouldItemId: shape.mouldItemId,
            gemItemId: gem.gemItemId,
            productItemId: gem.products[shape.shape],
            level: gem.levels[shape.shape],
            xp: gem.xp[shape.shape],
            animation: JEWELLERY_FURNACE_ANIMATION_ID,
            delayTicks: JEWELLERY_DELAY_TICKS,
        })),
    );
}

const GOLD_RECIPES: JewelleryRecipe[] = recipesFromGemSeeds(
    GOLD_GEM_SEEDS,
    GOLD_BAR_ITEM_ID,
    "gold",
);

const SILVER_GEM_RECIPES: JewelleryRecipe[] = recipesFromGemSeeds(
    SILVER_GEM_SEEDS,
    SILVER_BAR_ITEM_ID,
);

const SILVER_RECIPES: JewelleryRecipe[] = [
    ...SILVER_GEM_RECIPES,
    {
        id: "unstrung_symbol",
        name: "unstrung symbol",
        barItemId: SILVER_BAR_ITEM_ID,
        mouldItemId: HOLY_MOULD_ITEM_ID,
        productItemId: 1714,
        level: 16,
        xp: 50,
        animation: JEWELLERY_FURNACE_ANIMATION_ID,
        delayTicks: JEWELLERY_DELAY_TICKS,
    },
    {
        id: "silver_sickle",
        name: "silver sickle",
        barItemId: SILVER_BAR_ITEM_ID,
        mouldItemId: SICKLE_MOULD_ITEM_ID,
        productItemId: 2961,
        level: 18,
        xp: 50,
        animation: JEWELLERY_FURNACE_ANIMATION_ID,
        delayTicks: JEWELLERY_DELAY_TICKS,
    },
    {
        id: "tiara",
        name: "tiara",
        barItemId: SILVER_BAR_ITEM_ID,
        mouldItemId: TIARA_MOULD_ITEM_ID,
        productItemId: 5525,
        level: 23,
        xp: 52.5,
        animation: JEWELLERY_FURNACE_ANIMATION_ID,
        delayTicks: JEWELLERY_DELAY_TICKS,
    },
];

export const JEWELLERY_RECIPES: JewelleryRecipe[] = [...GOLD_RECIPES, ...SILVER_RECIPES];

export const GEM_CUT_RECIPES: GemCutRecipe[] = [
    {
        id: "cut_opal",
        name: "opal",
        uncutItemId: 1625,
        cutItemId: 1609,
        level: 1,
        xp: 15,
        animation: GEM_CUT_ANIMATION_ID,
        delayTicks: GEM_CUT_DELAY_TICKS,
        crush: { low: 128, high: 250, xp: 3.8 },
    },
    {
        id: "cut_jade",
        name: "jade",
        uncutItemId: 1627,
        cutItemId: 1611,
        level: 13,
        xp: 20,
        animation: GEM_CUT_ANIMATION_ID,
        delayTicks: GEM_CUT_DELAY_TICKS,
        crush: { low: 100, high: 245, xp: 5 },
    },
    {
        id: "cut_red_topaz",
        name: "red topaz",
        uncutItemId: 1629,
        cutItemId: 1613,
        level: 16,
        xp: 25,
        animation: GEM_CUT_ANIMATION_ID,
        delayTicks: GEM_CUT_DELAY_TICKS,
        crush: { low: 90, high: 240, xp: 6.3 },
    },
    {
        id: "cut_sapphire",
        name: "sapphire",
        uncutItemId: 1623,
        cutItemId: 1607,
        level: 20,
        xp: 50,
        animation: GEM_CUT_ANIMATION_ID,
        delayTicks: GEM_CUT_DELAY_TICKS,
    },
    {
        id: "cut_emerald",
        name: "emerald",
        uncutItemId: 1621,
        cutItemId: 1605,
        level: 27,
        xp: 67.5,
        animation: GEM_CUT_ANIMATION_ID,
        delayTicks: GEM_CUT_DELAY_TICKS,
    },
    {
        id: "cut_ruby",
        name: "ruby",
        uncutItemId: 1619,
        cutItemId: 1603,
        level: 34,
        xp: 85,
        animation: GEM_CUT_ANIMATION_ID,
        delayTicks: GEM_CUT_DELAY_TICKS,
    },
    {
        id: "cut_diamond",
        name: "diamond",
        uncutItemId: 1617,
        cutItemId: 1601,
        level: 43,
        xp: 107.5,
        animation: GEM_CUT_ANIMATION_ID,
        delayTicks: GEM_CUT_DELAY_TICKS,
    },
    {
        id: "cut_dragonstone",
        name: "dragonstone",
        uncutItemId: 1631,
        cutItemId: 1615,
        level: 55,
        xp: 137.5,
        animation: GEM_CUT_ANIMATION_ID,
        delayTicks: GEM_CUT_DELAY_TICKS,
    },
    {
        id: "cut_onyx",
        name: "onyx",
        uncutItemId: UNCUT_ONYX_ITEM_ID,
        cutItemId: ONYX_ITEM_ID,
        level: 67,
        xp: 167.5,
        animation: GEM_CUT_ANIMATION_ID,
        delayTicks: GEM_CUT_DELAY_TICKS,
    },
    {
        id: "cut_zenyte",
        name: "zenyte",
        uncutItemId: UNCUT_ZENYTE_ITEM_ID,
        cutItemId: ZENYTE_ITEM_ID,
        level: 89,
        xp: 50,
        animation: GEM_CUT_ANIMATION_ID,
        delayTicks: GEM_CUT_DELAY_TICKS,
    },
];

/** OSRS: zenyte shard + cut onyx → uncut zenyte (70 Crafting, 15 XP). */
export const ZENYTE_FUSE_RECIPE: ZenyteFuseRecipe = {
    id: "fuse_uncut_zenyte",
    name: "uncut zenyte",
    shardItemId: ZENYTE_SHARD_ITEM_ID,
    gemItemId: ONYX_ITEM_ID,
    productItemId: UNCUT_ZENYTE_ITEM_ID,
    level: 70,
    xp: 15,
    animation: JEWELLERY_FURNACE_ANIMATION_ID,
    delayTicks: JEWELLERY_DELAY_TICKS,
};

export const AMULET_STRING_RECIPES: AmuletStringRecipe[] = [
    {
        id: "string_gold_amulet",
        name: "gold amulet",
        unstrungItemId: 1673,
        productItemId: 1692,
        level: 8,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
    {
        id: "string_sapphire_amulet",
        name: "sapphire amulet",
        unstrungItemId: 1675,
        productItemId: 1694,
        level: 24,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
    {
        id: "string_emerald_amulet",
        name: "emerald amulet",
        unstrungItemId: 1677,
        productItemId: 1696,
        level: 31,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
    {
        id: "string_ruby_amulet",
        name: "ruby amulet",
        unstrungItemId: 1679,
        productItemId: 1698,
        level: 50,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
    {
        id: "string_diamond_amulet",
        name: "diamond amulet",
        unstrungItemId: 1681,
        productItemId: 1700,
        level: 70,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
    {
        id: "string_dragonstone_amulet",
        name: "dragonstone amulet",
        unstrungItemId: 1683,
        productItemId: 1702,
        level: 80,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
    {
        id: "string_onyx_amulet",
        name: "onyx amulet",
        unstrungItemId: 6579,
        productItemId: 6581,
        level: 90,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
    {
        id: "string_zenyte_amulet",
        name: "zenyte amulet",
        unstrungItemId: 19501,
        productItemId: 19541,
        level: 98,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
    {
        id: "string_opal_amulet",
        name: "opal amulet",
        unstrungItemId: 21099,
        productItemId: 21108,
        level: 27,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
    {
        id: "string_jade_amulet",
        name: "jade amulet",
        unstrungItemId: 21102,
        productItemId: 21111,
        level: 34,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
    {
        id: "string_topaz_amulet",
        name: "topaz amulet",
        unstrungItemId: 21105,
        productItemId: 21114,
        level: 45,
        xp: 4,
        animation: AMULET_STRING_ANIMATION_ID,
        delayTicks: AMULET_STRING_DELAY_TICKS,
    },
];

const JEWELLERY_BY_ID = new Map(JEWELLERY_RECIPES.map((recipe) => [recipe.id, recipe]));
const GEM_CUT_BY_UNCUT = new Map(GEM_CUT_RECIPES.map((recipe) => [recipe.uncutItemId, recipe]));
const GEM_CUT_BY_ID = new Map(GEM_CUT_RECIPES.map((recipe) => [recipe.id, recipe]));
const STRING_BY_UNSTRUNG = new Map(
    AMULET_STRING_RECIPES.map((recipe) => [recipe.unstrungItemId, recipe]),
);
const STRING_BY_ID = new Map(AMULET_STRING_RECIPES.map((recipe) => [recipe.id, recipe]));

export function getJewelleryRecipeById(id: string): JewelleryRecipe | undefined {
    return JEWELLERY_BY_ID.get(id);
}

export function getGemCutRecipeByUncutId(itemId: number): GemCutRecipe | undefined {
    return GEM_CUT_BY_UNCUT.get(itemId);
}

export function getGemCutRecipeById(id: string): GemCutRecipe | undefined {
    return GEM_CUT_BY_ID.get(id);
}

export function getAmuletStringRecipeByUnstrungId(itemId: number): AmuletStringRecipe | undefined {
    return STRING_BY_UNSTRUNG.get(itemId);
}

export function getAmuletStringRecipeById(id: string): AmuletStringRecipe | undefined {
    return STRING_BY_ID.get(id);
}

export function getZenyteFuseRecipeById(id: string): ZenyteFuseRecipe | undefined {
    return id === ZENYTE_FUSE_RECIPE.id ? ZENYTE_FUSE_RECIPE : undefined;
}

/** Interpolated low/high numerators out of 256 (same curve as other OSRS skilling success). */
export function rollSemiPreciousCutSuccess(
    level: number,
    crush: GemCutCrush,
    rng: () => number = Math.random,
): boolean {
    const lvl = Math.min(99, Math.max(1, Math.floor(level)));
    const numer = Math.floor(((99 - lvl) * crush.low + (lvl - 1) * crush.high) / 98);
    return rng() * 256 < numer;
}

export const JEWELLERY_BAR_ITEM_IDS = [GOLD_BAR_ITEM_ID, SILVER_BAR_ITEM_ID] as const;

export const JEWELLERY_MOULD_ITEM_IDS = Array.from(
    new Set(JEWELLERY_RECIPES.map((recipe) => recipe.mouldItemId)),
);

export const UNCUT_GEM_ITEM_IDS = GEM_CUT_RECIPES.map((recipe) => recipe.uncutItemId);

export const UNSTRUNG_AMULET_ITEM_IDS = AMULET_STRING_RECIPES.map(
    (recipe) => recipe.unstrungItemId,
);

export function isFurnaceLoc(def: { name?: unknown; ops?: unknown } | undefined): boolean {
    if (!def) return false;
    const name = String(def.name ?? "").toLowerCase();
    if (name.includes("furnace")) return true;
    const ops = Array.isArray(def.ops) ? def.ops : [];
    return ops.some((op) => String(op ?? "").toLowerCase() === "smelt");
}
