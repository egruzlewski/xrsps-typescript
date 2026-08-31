// Enchant Lvl-1–7 Jewellery. Spell object IDs from the OSRS cache spell items
// (`_07_ENCHANT_AMULET_LVL1` … `_93_ENCHANT_AMULET_LVL7`). Gold jewellery only
// (sapphire through onyx, plus zenyte as Lvl-7). Strung amulets, not (u).

export const COSMIC_RUNE_ID = 564;
export const WATER_RUNE_ID = 555;
export const AIR_RUNE_ID = 556;
export const FIRE_RUNE_ID = 554;
export const EARTH_RUNE_ID = 557;
export const BLOOD_RUNE_ID = 565;
export const SOUL_RUNE_ID = 566;

export const ENCHANT_LVL1_SPELL_ID = 3276;
export const ENCHANT_LVL2_SPELL_ID = 3287;
export const ENCHANT_LVL3_SPELL_ID = 3298;
export const ENCHANT_LVL4_SPELL_ID = 3305;
export const ENCHANT_LVL5_SPELL_ID = 3318;
export const ENCHANT_LVL6_SPELL_ID = 6567;
export const ENCHANT_LVL7_SPELL_ID = 19475;

export const ENCHANT_JEWELLERY_ANIMATION_ID = 719;
export const ENCHANT_JEWELLERY_DELAY_TICKS = 3;
export const ENCHANT_JEWELLERY_SOUND_ID = 136;

export interface EnchantJewelleryRuneCost {
    runeId: number;
    quantity: number;
}

export interface EnchantJewellerySpell {
    spellId: number;
    name: string;
    level: number;
    xp: number;
    runeCosts: readonly EnchantJewelleryRuneCost[];
    castSpotAnim: number;
    castSoundId: number;
    animation: number;
    delayTicks: number;
}

export interface EnchantJewelleryRecipe {
    id: string;
    name: string;
    spellId: number;
    sourceItemId: number;
    productItemId: number;
}

export const ENCHANT_JEWELLERY_SPELLS: readonly EnchantJewellerySpell[] = [
    {
        spellId: ENCHANT_LVL1_SPELL_ID,
        name: "Lvl-1 Enchant",
        level: 7,
        xp: 17.5,
        runeCosts: [
            { runeId: COSMIC_RUNE_ID, quantity: 1 },
            { runeId: WATER_RUNE_ID, quantity: 1 },
        ],
        castSpotAnim: 114,
        castSoundId: ENCHANT_JEWELLERY_SOUND_ID,
        animation: ENCHANT_JEWELLERY_ANIMATION_ID,
        delayTicks: ENCHANT_JEWELLERY_DELAY_TICKS,
    },
    {
        spellId: ENCHANT_LVL2_SPELL_ID,
        name: "Lvl-2 Enchant",
        level: 27,
        xp: 37,
        runeCosts: [
            { runeId: COSMIC_RUNE_ID, quantity: 1 },
            { runeId: AIR_RUNE_ID, quantity: 3 },
        ],
        castSpotAnim: 115,
        castSoundId: ENCHANT_JEWELLERY_SOUND_ID,
        animation: ENCHANT_JEWELLERY_ANIMATION_ID,
        delayTicks: ENCHANT_JEWELLERY_DELAY_TICKS,
    },
    {
        spellId: ENCHANT_LVL3_SPELL_ID,
        name: "Lvl-3 Enchant",
        level: 49,
        xp: 59,
        runeCosts: [
            { runeId: COSMIC_RUNE_ID, quantity: 1 },
            { runeId: FIRE_RUNE_ID, quantity: 5 },
        ],
        castSpotAnim: 116,
        castSoundId: ENCHANT_JEWELLERY_SOUND_ID,
        animation: ENCHANT_JEWELLERY_ANIMATION_ID,
        delayTicks: ENCHANT_JEWELLERY_DELAY_TICKS,
    },
    {
        spellId: ENCHANT_LVL4_SPELL_ID,
        name: "Lvl-4 Enchant",
        level: 57,
        xp: 67,
        runeCosts: [
            { runeId: COSMIC_RUNE_ID, quantity: 1 },
            { runeId: EARTH_RUNE_ID, quantity: 10 },
        ],
        castSpotAnim: 117,
        castSoundId: ENCHANT_JEWELLERY_SOUND_ID,
        animation: ENCHANT_JEWELLERY_ANIMATION_ID,
        delayTicks: ENCHANT_JEWELLERY_DELAY_TICKS,
    },
    {
        spellId: ENCHANT_LVL5_SPELL_ID,
        name: "Lvl-5 Enchant",
        level: 68,
        xp: 78,
        runeCosts: [
            { runeId: COSMIC_RUNE_ID, quantity: 1 },
            { runeId: EARTH_RUNE_ID, quantity: 15 },
            { runeId: WATER_RUNE_ID, quantity: 15 },
        ],
        castSpotAnim: 118,
        castSoundId: ENCHANT_JEWELLERY_SOUND_ID,
        animation: ENCHANT_JEWELLERY_ANIMATION_ID,
        delayTicks: ENCHANT_JEWELLERY_DELAY_TICKS,
    },
    {
        spellId: ENCHANT_LVL6_SPELL_ID,
        name: "Lvl-6 Enchant",
        level: 87,
        xp: 97,
        runeCosts: [
            { runeId: COSMIC_RUNE_ID, quantity: 1 },
            { runeId: EARTH_RUNE_ID, quantity: 20 },
            { runeId: FIRE_RUNE_ID, quantity: 20 },
        ],
        castSpotAnim: 119,
        castSoundId: ENCHANT_JEWELLERY_SOUND_ID,
        animation: ENCHANT_JEWELLERY_ANIMATION_ID,
        delayTicks: ENCHANT_JEWELLERY_DELAY_TICKS,
    },
    {
        spellId: ENCHANT_LVL7_SPELL_ID,
        name: "Lvl-7 Enchant",
        level: 93,
        xp: 110,
        runeCosts: [
            { runeId: COSMIC_RUNE_ID, quantity: 1 },
            { runeId: SOUL_RUNE_ID, quantity: 20 },
            { runeId: BLOOD_RUNE_ID, quantity: 20 },
        ],
        castSpotAnim: 1873,
        castSoundId: ENCHANT_JEWELLERY_SOUND_ID,
        animation: ENCHANT_JEWELLERY_ANIMATION_ID,
        delayTicks: ENCHANT_JEWELLERY_DELAY_TICKS,
    },
];

const SPELL_BY_ID = new Map(ENCHANT_JEWELLERY_SPELLS.map((spell) => [spell.spellId, spell]));

function recipesFor(
    spellId: number,
    rows: Array<[id: string, name: string, sourceItemId: number, productItemId: number]>,
): EnchantJewelleryRecipe[] {
    return rows.map(([id, name, sourceItemId, productItemId]) => ({
        id,
        name,
        spellId,
        sourceItemId,
        productItemId,
    }));
}

export const ENCHANT_JEWELLERY_RECIPES: readonly EnchantJewelleryRecipe[] = [
    ...recipesFor(ENCHANT_LVL1_SPELL_ID, [
        ["sapphire_ring", "sapphire ring", 1637, 2550],
        ["sapphire_necklace", "sapphire necklace", 1656, 3853],
        ["sapphire_bracelet", "sapphire bracelet", 11072, 11074],
        ["sapphire_amulet", "sapphire amulet", 1694, 1727],
    ]),
    ...recipesFor(ENCHANT_LVL2_SPELL_ID, [
        ["emerald_ring", "emerald ring", 1639, 2552],
        ["emerald_necklace", "emerald necklace", 1658, 5521],
        ["emerald_bracelet", "emerald bracelet", 11076, 11079],
        ["emerald_amulet", "emerald amulet", 1696, 1729],
    ]),
    ...recipesFor(ENCHANT_LVL3_SPELL_ID, [
        ["ruby_ring", "ruby ring", 1641, 2568],
        ["ruby_necklace", "ruby necklace", 1660, 11194],
        ["ruby_bracelet", "ruby bracelet", 11085, 11088],
        ["ruby_amulet", "ruby amulet", 1698, 1725],
    ]),
    ...recipesFor(ENCHANT_LVL4_SPELL_ID, [
        ["diamond_ring", "diamond ring", 1643, 2570],
        ["diamond_necklace", "diamond necklace", 1662, 11090],
        ["diamond_bracelet", "diamond bracelet", 11092, 11095],
        ["diamond_amulet", "diamond amulet", 1700, 1731],
    ]),
    ...recipesFor(ENCHANT_LVL5_SPELL_ID, [
        ["dragonstone_ring", "dragonstone ring", 1645, 2572],
        ["dragonstone_necklace", "dragonstone necklace", 1664, 11113],
        ["dragonstone_bracelet", "dragonstone bracelet", 11115, 11126],
        ["dragonstone_amulet", "dragonstone amulet", 1702, 1704],
    ]),
    ...recipesFor(ENCHANT_LVL6_SPELL_ID, [
        ["onyx_ring", "onyx ring", 6575, 6583],
        ["onyx_necklace", "onyx necklace", 6577, 11128],
        ["onyx_bracelet", "onyx bracelet", 11130, 11133],
        ["onyx_amulet", "onyx amulet", 6581, 6585],
    ]),
    ...recipesFor(ENCHANT_LVL7_SPELL_ID, [
        ["zenyte_ring", "zenyte ring", 19538, 19550],
        ["zenyte_necklace", "zenyte necklace", 19535, 19547],
        ["zenyte_bracelet", "zenyte bracelet", 19532, 19544],
        ["zenyte_amulet", "zenyte amulet", 19541, 19553],
    ]),
];

const RECIPE_BY_ID = new Map(ENCHANT_JEWELLERY_RECIPES.map((recipe) => [recipe.id, recipe]));
const RECIPE_BY_SPELL_AND_ITEM = new Map(
    ENCHANT_JEWELLERY_RECIPES.map((recipe) => [`${recipe.spellId}:${recipe.sourceItemId}`, recipe]),
);

export function getEnchantJewellerySpell(spellId: number): EnchantJewellerySpell | undefined {
    return SPELL_BY_ID.get(spellId);
}

export function isEnchantJewellerySpell(spellId: number): boolean {
    return SPELL_BY_ID.has(spellId);
}

export function getEnchantJewelleryRecipeById(id: string): EnchantJewelleryRecipe | undefined {
    return RECIPE_BY_ID.get(id);
}

export function getEnchantJewelleryRecipe(
    spellId: number,
    sourceItemId: number,
): EnchantJewelleryRecipe | undefined {
    return RECIPE_BY_SPELL_AND_ITEM.get(`${spellId}:${sourceItemId}`);
}

export function getEnchantJewellerySpellIds(): number[] {
    return ENCHANT_JEWELLERY_SPELLS.map((spell) => spell.spellId);
}
