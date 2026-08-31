/**
 * Runic altars. Loc IDs and XP from OSRS wiki.
 * Multiplier: 1 + floor(level / multiplierDiv) runes per essence.
 * Members altars require pure essence (`pureEssenceOnly`).
 */

/** Fields needed to bind essence into runes at an altar loc. */
export interface RuneCraftDef {
    id: string;
    name: string;
    level: number;
    xpPerEssence: number;
    multiplierDiv: number;
    runeId: number;
    altarLocId: number;
    /** When true, rune essence cannot be bound (OSRS members altars). */
    pureEssenceOnly?: boolean;
    /** When set, bind this item instead of rune/pure essence. */
    essenceItemId?: number;
}

export interface RuneAltarDef extends RuneCraftDef {
    talismanId: number;
    tiaraId: number;
    /** Runecraft XP for binding a blank tiara with this altar's talisman. */
    tiaraXp: number;
    ruinsLocIds: readonly number[];
    portalLocId: number;
    altarEnter: { x: number; y: number; level: number };
    ruinsExit: { x: number; y: number; level: number };
}

export const RUNE_ESSENCE = 1436;
export const PURE_ESSENCE = 7936;
export const BLANK_TIARA = 5525;
/** Stackable fragments used at Kourend Blood and Arceuus Soul (OSRS 7938). */
export const DARK_ESSENCE_FRAGMENTS = 7938;

export const F2P_ALTARS: readonly RuneAltarDef[] = [
    {
        id: "air",
        name: "Air",
        level: 1,
        xpPerEssence: 5,
        multiplierDiv: 11,
        runeId: 556,
        talismanId: 1438,
        tiaraId: 5527,
        tiaraXp: 25,
        ruinsLocIds: [28914, 29090],
        altarLocId: 34760,
        portalLocId: 34748,
        altarEnter: { x: 2841, y: 4830, level: 0 },
        ruinsExit: { x: 2983, y: 3288, level: 0 },
    },
    {
        id: "mind",
        name: "Mind",
        level: 2,
        xpPerEssence: 5.5,
        multiplierDiv: 14,
        runeId: 558,
        talismanId: 1448,
        tiaraId: 5529,
        tiaraXp: 27.5,
        ruinsLocIds: [29094, 29095],
        altarLocId: 34761,
        portalLocId: 34749,
        altarEnter: { x: 2793, y: 4828, level: 0 },
        ruinsExit: { x: 2982, y: 3514, level: 0 },
    },
    {
        id: "water",
        name: "Water",
        level: 5,
        xpPerEssence: 6,
        multiplierDiv: 19,
        runeId: 555,
        talismanId: 1444,
        tiaraId: 5531,
        tiaraXp: 30,
        ruinsLocIds: [29096, 29097],
        altarLocId: 34762,
        portalLocId: 34750,
        altarEnter: { x: 2726, y: 4833, level: 0 },
        ruinsExit: { x: 3185, y: 3165, level: 0 },
    },
    {
        id: "earth",
        name: "Earth",
        level: 9,
        xpPerEssence: 6.5,
        multiplierDiv: 26,
        runeId: 557,
        talismanId: 1440,
        tiaraId: 5535,
        tiaraXp: 32.5,
        ruinsLocIds: [29098, 29099],
        altarLocId: 34763,
        portalLocId: 34751,
        altarEnter: { x: 2655, y: 4830, level: 0 },
        ruinsExit: { x: 3306, y: 3474, level: 0 },
    },
    {
        id: "fire",
        name: "Fire",
        level: 14,
        xpPerEssence: 7,
        multiplierDiv: 35,
        runeId: 554,
        talismanId: 1442,
        tiaraId: 5537,
        tiaraXp: 35,
        ruinsLocIds: [30371, 30372],
        altarLocId: 34764,
        portalLocId: 34752,
        altarEnter: { x: 2576, y: 4848, level: 0 },
        ruinsExit: { x: 3313, y: 3255, level: 0 },
    },
    {
        id: "body",
        name: "Body",
        level: 20,
        xpPerEssence: 7.5,
        multiplierDiv: 46,
        runeId: 559,
        talismanId: 1446,
        tiaraId: 5533,
        tiaraXp: 37.5,
        ruinsLocIds: [30373, 31584],
        altarLocId: 34765,
        portalLocId: 34753,
        altarEnter: { x: 2521, y: 4835, level: 0 },
        ruinsExit: { x: 3053, y: 3445, level: 0 },
    },
];

/** Members ruins altars (talisman/tiara enter). True Blood is Meiyerditch, not Kourend. */
export const MEMBERS_ALTARS: readonly RuneAltarDef[] = [
    {
        id: "cosmic",
        name: "Cosmic",
        level: 27,
        xpPerEssence: 8,
        multiplierDiv: 59,
        runeId: 564,
        talismanId: 1454,
        tiaraId: 5539,
        tiaraXp: 40,
        ruinsLocIds: [31607, 31725],
        altarLocId: 34766,
        portalLocId: 34754,
        altarEnter: { x: 2141, y: 4832, level: 0 },
        ruinsExit: { x: 2408, y: 4377, level: 0 },
        pureEssenceOnly: true,
    },
    {
        id: "chaos",
        name: "Chaos",
        level: 35,
        xpPerEssence: 8.5,
        multiplierDiv: 74,
        runeId: 562,
        talismanId: 1452,
        tiaraId: 5543,
        tiaraXp: 42.5,
        ruinsLocIds: [34742, 34743],
        altarLocId: 34769,
        portalLocId: 34757,
        altarEnter: { x: 2270, y: 4841, level: 0 },
        ruinsExit: { x: 3060, y: 3591, level: 0 },
        pureEssenceOnly: true,
    },
    {
        id: "nature",
        name: "Nature",
        level: 44,
        xpPerEssence: 9,
        multiplierDiv: 91,
        runeId: 561,
        talismanId: 1462,
        tiaraId: 5541,
        tiaraXp: 45,
        ruinsLocIds: [32491, 32492],
        altarLocId: 34768,
        portalLocId: 34756,
        altarEnter: { x: 2399, y: 4840, level: 0 },
        ruinsExit: { x: 2869, y: 3019, level: 0 },
        pureEssenceOnly: true,
    },
    {
        id: "law",
        name: "Law",
        level: 54,
        xpPerEssence: 9.5,
        multiplierDiv: 95,
        runeId: 563,
        talismanId: 1458,
        tiaraId: 5545,
        tiaraXp: 47.5,
        ruinsLocIds: [32489, 32490],
        altarLocId: 34767,
        portalLocId: 34755,
        altarEnter: { x: 2463, y: 4831, level: 0 },
        ruinsExit: { x: 2858, y: 3381, level: 0 },
        pureEssenceOnly: true,
    },
    {
        id: "death",
        name: "Death",
        level: 65,
        xpPerEssence: 10,
        multiplierDiv: 99,
        runeId: 560,
        talismanId: 1456,
        tiaraId: 5547,
        tiaraXp: 50,
        ruinsLocIds: [34744, 34745],
        altarLocId: 34770,
        portalLocId: 34758,
        altarEnter: { x: 2204, y: 4835, level: 0 },
        ruinsExit: { x: 1860, y: 4639, level: 0 },
        pureEssenceOnly: true,
    },
    {
        id: "blood",
        name: "Blood",
        level: 77,
        xpPerEssence: 10.5,
        // No extra runes from level (unlike Cosmic–Death).
        multiplierDiv: 100,
        runeId: 565,
        talismanId: 1450,
        tiaraId: 5549,
        tiaraXp: 52.5,
        ruinsLocIds: [43477],
        altarLocId: 43479,
        portalLocId: 43478,
        altarEnter: { x: 3231, y: 4831, level: 0 },
        ruinsExit: { x: 3561, y: 9781, level: 0 },
        pureEssenceOnly: true,
    },
    {
        id: "wrath",
        name: "Wrath",
        level: 95,
        xpPerEssence: 8,
        multiplierDiv: 100,
        runeId: 21880,
        talismanId: 22118,
        tiaraId: 22121,
        tiaraXp: 52.5,
        ruinsLocIds: [34746, 34717],
        altarLocId: 34772,
        portalLocId: 34759,
        altarEnter: { x: 2334, y: 4833, level: 0 },
        ruinsExit: { x: 2446, y: 2825, level: 0 },
        pureEssenceOnly: true,
    },
];

/**
 * Walk-up surface altars: no ruins, talisman, tiara, or portal.
 * OSRS Astral also requires Lunar Diplomacy; that quest is not registered here,
 * so craft is not quest-locked.
 * Kourend Blood / Arceuus Soul bind dark essence fragments. Dense runestone
 * mining, Dark Altar conversion, and chiseling blocks into fragments are not
 * implemented; craft still works if the player already has fragments (7938).
 */
export const WALKUP_ALTARS: readonly RuneCraftDef[] = [
    {
        id: "astral",
        name: "Astral",
        level: 40,
        xpPerEssence: 8.7,
        multiplierDiv: 82,
        runeId: 9075,
        altarLocId: 34771,
        pureEssenceOnly: true,
    },
    {
        id: "kourend-blood",
        name: "Blood",
        level: 77,
        xpPerEssence: 23.8,
        multiplierDiv: 100,
        runeId: 565,
        altarLocId: 27978,
        essenceItemId: DARK_ESSENCE_FRAGMENTS,
    },
    {
        id: "soul",
        name: "Soul",
        level: 90,
        xpPerEssence: 29.7,
        multiplierDiv: 100,
        runeId: 566,
        altarLocId: 27980,
        essenceItemId: DARK_ESSENCE_FRAGMENTS,
    },
];

export const ALL_ALTARS: readonly RuneAltarDef[] = [...F2P_ALTARS, ...MEMBERS_ALTARS];
export const ALL_CRAFT_ALTARS: readonly RuneCraftDef[] = [...ALL_ALTARS, ...WALKUP_ALTARS];
