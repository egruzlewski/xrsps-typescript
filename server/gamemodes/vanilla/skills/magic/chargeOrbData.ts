// Charge Water/Earth/Fire/Air Orb. Loc IDs and pins from OSRS wiki scenery infoboxes
// (Object IDs 2150–2153). Unpowered orb 567 → charged orbs used by battlestaff attach.

export const UNPOWERED_ORB_ITEM_ID = 567;

export const WATER_ORB_ITEM_ID = 571;
export const EARTH_ORB_ITEM_ID = 575;
export const FIRE_ORB_ITEM_ID = 569;
export const AIR_ORB_ITEM_ID = 573;

export const CHARGE_WATER_ORB_SPELL_ID = 9079;
export const CHARGE_EARTH_ORB_SPELL_ID = 9077;
export const CHARGE_FIRE_ORB_SPELL_ID = 9078;
export const CHARGE_AIR_ORB_SPELL_ID = 9076;

export const COSMIC_RUNE_ID = 564;
export const WATER_RUNE_ID = 555;
export const EARTH_RUNE_ID = 557;
export const FIRE_RUNE_ID = 554;
export const AIR_RUNE_ID = 556;

/** OSRS wiki Object IDs: Earth 2150, Water 2151, Air 2152, Fire 2153. */
export const OBELISK_OF_EARTH_LOC_ID = 2150;
export const OBELISK_OF_WATER_LOC_ID = 2151;
export const OBELISK_OF_AIR_LOC_ID = 2152;
export const OBELISK_OF_FIRE_LOC_ID = 2153;

export const CHARGE_ORB_ANIMATION_ID = 726;
export const CHARGE_ORB_DELAY_TICKS = 3;
export const CHARGE_ORB_ADJACENCY = 1;

export interface ChargeOrbArea {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    level: number;
}

export interface ChargeOrbRecipe {
    id: string;
    name: string;
    spellId: number;
    locId: number;
    elementName: string;
    chargedOrbItemId: number;
    level: number;
    xp: number;
    elementalRuneId: number;
    elementalRuneQty: number;
    cosmicRuneQty: number;
    castSpotAnim: number;
    castSoundId: number;
    animation: number;
    delayTicks: number;
    /** Wiki map pin ±4 tiles (area fallback when spellbook is clicked at the obelisk). */
    area: ChargeOrbArea;
}

const AREA_RADIUS = 4;

function areaAround(x: number, y: number, level: number): ChargeOrbArea {
    return {
        minX: x - AREA_RADIUS,
        maxX: x + AREA_RADIUS,
        minY: y - AREA_RADIUS,
        maxY: y + AREA_RADIUS,
        level,
    };
}

export const CHARGE_ORB_RECIPES: readonly ChargeOrbRecipe[] = [
    {
        id: "charge_water_orb",
        name: "Charge Water Orb",
        spellId: CHARGE_WATER_ORB_SPELL_ID,
        locId: OBELISK_OF_WATER_LOC_ID,
        elementName: "water",
        chargedOrbItemId: WATER_ORB_ITEM_ID,
        level: 56,
        xp: 66,
        elementalRuneId: WATER_RUNE_ID,
        elementalRuneQty: 30,
        cosmicRuneQty: 3,
        castSpotAnim: 149,
        castSoundId: 118,
        animation: CHARGE_ORB_ANIMATION_ID,
        delayTicks: CHARGE_ORB_DELAY_TICKS,
        // Water Obelisk Island, Catherby bay (wiki map pin 2844,3422).
        area: areaAround(2844, 3422, 0),
    },
    {
        id: "charge_earth_orb",
        name: "Charge Earth Orb",
        spellId: CHARGE_EARTH_ORB_SPELL_ID,
        locId: OBELISK_OF_EARTH_LOC_ID,
        elementName: "earth",
        chargedOrbItemId: EARTH_ORB_ITEM_ID,
        level: 60,
        xp: 70,
        elementalRuneId: EARTH_RUNE_ID,
        elementalRuneQty: 30,
        cosmicRuneQty: 3,
        castSpotAnim: 151,
        castSoundId: 115,
        animation: CHARGE_ORB_ANIMATION_ID,
        delayTicks: CHARGE_ORB_DELAY_TICKS,
        // Edgeville Dungeon wilderness section (wiki map pin 3086,9932).
        area: areaAround(3086, 9932, 0),
    },
    {
        id: "charge_fire_orb",
        name: "Charge Fire Orb",
        spellId: CHARGE_FIRE_ORB_SPELL_ID,
        locId: OBELISK_OF_FIRE_LOC_ID,
        elementName: "fire",
        chargedOrbItemId: FIRE_ORB_ITEM_ID,
        level: 63,
        xp: 73,
        elementalRuneId: FIRE_RUNE_ID,
        elementalRuneQty: 30,
        cosmicRuneQty: 3,
        castSpotAnim: 152,
        castSoundId: 117,
        animation: CHARGE_ORB_ANIMATION_ID,
        delayTicks: CHARGE_ORB_DELAY_TICKS,
        // Taverley Dungeon, west of black dragons (wiki map pin 2819,9828).
        area: areaAround(2819, 9828, 0),
    },
    {
        id: "charge_air_orb",
        name: "Charge Air Orb",
        spellId: CHARGE_AIR_ORB_SPELL_ID,
        locId: OBELISK_OF_AIR_LOC_ID,
        elementName: "air",
        chargedOrbItemId: AIR_ORB_ITEM_ID,
        level: 66,
        xp: 76,
        elementalRuneId: AIR_RUNE_ID,
        elementalRuneQty: 30,
        cosmicRuneQty: 3,
        castSpotAnim: 150,
        castSoundId: 116,
        animation: CHARGE_ORB_ANIMATION_ID,
        delayTicks: CHARGE_ORB_DELAY_TICKS,
        // Wilderness above Edgeville Dungeon (wiki map pin 3088,3568).
        area: areaAround(3088, 3568, 0),
    },
];

const RECIPE_BY_SPELL_ID = new Map(CHARGE_ORB_RECIPES.map((recipe) => [recipe.spellId, recipe]));
const RECIPE_BY_LOC_ID = new Map(CHARGE_ORB_RECIPES.map((recipe) => [recipe.locId, recipe]));

export function getChargeOrbRecipeBySpellId(spellId: number): ChargeOrbRecipe | undefined {
    return RECIPE_BY_SPELL_ID.get(spellId);
}

export function getChargeOrbRecipeByLocId(locId: number): ChargeOrbRecipe | undefined {
    return RECIPE_BY_LOC_ID.get(locId);
}

export function isChargeOrbObeliskLoc(locId: number): boolean {
    return RECIPE_BY_LOC_ID.has(locId);
}

export function isPlayerInChargeOrbArea(
    tileX: number,
    tileY: number,
    level: number,
    recipe: ChargeOrbRecipe,
): boolean {
    const area = recipe.area;
    return (
        level === area.level &&
        tileX >= area.minX &&
        tileX <= area.maxX &&
        tileY >= area.minY &&
        tileY <= area.maxY
    );
}
