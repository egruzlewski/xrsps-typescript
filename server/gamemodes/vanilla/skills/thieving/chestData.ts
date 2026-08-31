// Thieving chest defs. Loc/item IDs from OSRS wiki scenery/item pages, cross-checked
// against server/data/items.json (cave goblin wire is 10981 in this dump; live wiki 11028).
// Newer wiki IDs (valuables, sailing frags/cannonballs) are used even when absent from this dump.

import { SkillId } from "../../../../../client/rs/skill/skills";

export const LOCKPICK_ITEM_ID = 1523;

export const ChestItems = {
    COINS: 995,
    NATURE_RUNE: 561,
    STEEL_ARROWTIPS: 41,
    BLOOD_RUNE: 565,
    RAW_SHARK: 383,
    ADAMANTITE_ORE: 449,
    UNCUT_SAPPHIRE: 1623,
    UNCUT_EMERALD: 1621,
    UNCUT_RUBY: 1619,
    UNCUT_DIAMOND: 1617,
    UNCUT_OPAL: 1625,
    UNCUT_JADE: 1627,
    UNCUT_RED_TOPAZ: 1629,
    OIL_LANTERN: 4539,
    BULLSEYE_LANTERN: 4550,
    MINING_HELMET: 5014,
    CAVE_GOBLIN_WIRE: 10981,
    LIGHT_ORB: 10973,
    EMPTY_LIGHT_ORB: 10980,
    FROG_LEATHER_CHAPS: 10956,
    FROG_LEATHER_BODY: 10954,
    IRON_BAR: 2351,
    LAW_RUNE: 563,
    CHAOS_RUNE: 562,
    DEATH_RUNE: 560,
    MIND_RUNE: 558,
    RED_SPIDERS_EGGS_NOTED: 224,
    COAL_NOTED: 454,
    IRON_ORE_NOTED: 441,
    UNCUT_DIAMOND_NOTED: 1618,
    UNCUT_EMERALD_NOTED: 1622,
    UNCUT_SAPPHIRE_NOTED: 1624,
    DRAGONSTONE_NOTED: 1616,
    VILE_ASHES_NOTED: 25770,
    BLIGHTED_ANCIENT_ICE_SACK: 24607,
    BLIGHTED_MANTA_RAY_NOTED: 24590,
    BLIGHTED_ANGLERFISH_NOTED: 24593,
    PRAYER_POTION_2: 141,
    XERICIAN_FABRIC: 13383,
    LIZARDMAN_FANG: 13391,
    XERICS_TALISMAN_INERT: 13392,
    OPAL_BOLT_TIPS: 45,
    JADE_BOLT_TIPS: 9187,
    PEARL_BOLT_TIPS: 46,
    TOPAZ_BOLT_TIPS: 9188,
    SAPPHIRE_BOLT_TIPS: 9189,
    EMERALD_BOLT_TIPS: 9190,
    RUBY_BOLT_TIPS: 9191,
    DIAMOND_BOLT_TIPS: 9192,
    DRAGONSTONE_BOLT_TIPS: 9193,
    ONYX_BOLT_TIPS: 9194,
    LIMPWURT_SEED: 5100,
    STRAWBERRY_SEED: 5323,
    MARRENTILL_SEED: 5292,
    JANGERBERRY_SEED: 5104,
    TARROMIN_SEED: 5293,
    WILDBLOOD_SEED: 5311,
    WATERMELON_SEED: 5321,
    HARRALANDER_SEED: 5294,
    SNAPE_GRASS_SEED: 22879,
    RANARR_SEED: 5295,
    WHITEBERRY_SEED: 5105,
    MUSHROOM_SPORE: 5282,
    TOADFLAX_SEED: 5296,
    BELLADONNA_SEED: 5281,
    IRIT_SEED: 5297,
    POISON_IVY_SEED: 5106,
    AVANTOE_SEED: 5298,
    CACTUS_SEED: 5280,
    KWUARM_SEED: 5299,
    POTATO_CACTUS_SEED: 22873,
    SNAPDRAGON_SEED: 5300,
    CADANTINE_SEED: 5301,
    LANTADYME_SEED: 5302,
    DWARF_WEED_SEED: 5303,
    TORSTOL_SEED: 5304,
    CLUE_SCROLL_MEDIUM: 2801,
    STEEL_DAGGER: 1207,
    STEEL_SCIMITAR: 1325,
    MITHRIL_DAGGER: 1209,
    MITHRIL_SCIMITAR: 1329,
    ADAMANT_DAGGER: 1211,
    ADAMANT_SCIMITAR: 1331,
    BRONZE_CANNONBALL: 31906,
    IRON_CANNONBALL: 31908,
    STEEL_CANNONBALL: 2,
    MITHRIL_CANNONBALL: 31910,
    ADAMANT_CANNONBALL: 31912,
    SILVER_BAR: 2355,
    GOLD_BAR: 2357,
    SAPPHIRE_NECKLACE: 1656,
    EMERALD_NECKLACE: 1658,
    RUBY_NECKLACE: 1660,
    DIAMOND_NECKLACE: 1662,
    ELKHORN_FRAG: 31511,
    PILLAR_FRAG: 31513,
    UMBRAL_FRAG: 31515,
    MERMAIDS_TEAR: 21656,
    GLISTENING_TEAR: 22207,
    VALUABLES: 29332,
    BLESSED_BONE_STATUETTE_EAGLE: 29338,
    BLESSED_BONE_STATUETTE_FOX: 29340,
    BLESSED_BONE_STATUETTE_BUFFALO: 29342,
    GOLD_NECKLACE: 1654,
    GOLD_AMULET: 1692,
    GOLD_RING: 1635,
    SAPPHIRE_AMULET: 1694,
    EMERALD_AMULET: 1696,
    RUBY_AMULET: 1698,
    DIAMOND_AMULET: 1700,
    SAPPHIRE_RING: 1637,
    EMERALD_RING: 1639,
    RUBY_RING: 1641,
    DIAMOND_RING: 1643,
};

export interface ChestLoot {
    itemId: number;
    minAmount: number;
    maxAmount: number;
    weight: number;
    nested?: ChestLoot[];
}

function loot(
    itemId: number,
    amount: number | [number, number],
    weight = 1,
    nested?: ChestLoot[],
): ChestLoot {
    const [minAmount, maxAmount] = Array.isArray(amount) ? amount : [amount, amount];
    return { itemId, minAmount, maxAmount, weight, nested };
}

/** Trap damage: documented wiki formulas, or HP-scaled estimates where the wiki is silent. */
export type ChestTrap =
    | { kind: "percent"; numerator: number; plus: number }
    | { kind: "chaos-druid" };

export type ChestStealMode = "open" | "search" | "pick-lock";

export interface ChestDef {
    id: string;
    displayName: string;
    locIds: number[];
    reqLevel: number;
    xp: number;
    alwaysLoot: ChestLoot[];
    lootTable: ChestLoot[];
    /** Restock delay in ticks (wiki seconds / 0.6). 0 = instant / no deplete. */
    respawnTicks: number;
    requiresLockpick: boolean;
    hasTrap: boolean;
    trap?: ChestTrap;
    teleport?: { x: number; y: number; level: number };
    stealActions: string[];
    /** Register an Open option that springs the trap. Default true. */
    openAction?: boolean;
    stealMode?: ChestStealMode;
    /** Lockpick is not required but boosts the OSRS success curve. */
    lockpickOptional?: boolean;
    /** OSRS skilling-success low/high numerators (out of 256). */
    successLow?: number;
    successHigh?: number;
    lockpickLow?: number;
    lockpickHigh?: number;
    failMessage?: string;
    failTeleport?: { x: number; y: number; level: number };
    failTeleports?: Record<number, { x: number; y: number; level: number }>;
    /** 1-in-N chance to teleport after a failed pick. */
    failTeleportChance?: number;
    /** Wiki teleport-on-fail skilling chart (out of 256). */
    failTeleportSkilling?: { low: number; high: number };
    extraXp?: { skillId: number; xp: number }[];
    /** When false, the loc can be stolen from repeatedly. Default true if respawnTicks > 0. */
    depletes?: boolean;
}

const GEM_SUBTABLE: ChestLoot[] = [
    loot(ChestItems.UNCUT_SAPPHIRE, 1, 4),
    loot(ChestItems.UNCUT_EMERALD, 1, 3),
    loot(ChestItems.UNCUT_RUBY, 1, 2),
    loot(ChestItems.UNCUT_DIAMOND, 1, 1),
];

const SAILING_FRAG_SUBTABLE: ChestLoot[] = [
    loot(ChestItems.ELKHORN_FRAG, 1, 6),
    loot(ChestItems.PILLAR_FRAG, 1, 3),
    loot(ChestItems.UMBRAL_FRAG, 1, 1),
];

const STONE_BOLT_TIPS: ChestLoot[] = [
    loot(ChestItems.OPAL_BOLT_TIPS, [4, 12], 6),
    loot(ChestItems.JADE_BOLT_TIPS, [4, 12], 2),
    loot(ChestItems.PEARL_BOLT_TIPS, [4, 12], 6),
    loot(ChestItems.TOPAZ_BOLT_TIPS, [4, 12], 2),
    loot(ChestItems.SAPPHIRE_BOLT_TIPS, [4, 12], 2),
    loot(ChestItems.EMERALD_BOLT_TIPS, [4, 12], 3),
    loot(ChestItems.RUBY_BOLT_TIPS, [4, 12], 4),
    loot(ChestItems.DIAMOND_BOLT_TIPS, [4, 12], 6),
    loot(ChestItems.DRAGONSTONE_BOLT_TIPS, [4, 12], 4),
    loot(ChestItems.ONYX_BOLT_TIPS, [4, 12], 2),
];

const UNCOMMON_SEED_TABLE: ChestLoot[] = [
    loot(ChestItems.LIMPWURT_SEED, 1, 137),
    loot(ChestItems.STRAWBERRY_SEED, 1, 131),
    loot(ChestItems.MARRENTILL_SEED, 1, 125),
    loot(ChestItems.JANGERBERRY_SEED, 1, 92),
    loot(ChestItems.TARROMIN_SEED, 1, 85),
    loot(ChestItems.WILDBLOOD_SEED, 1, 83),
    loot(ChestItems.WATERMELON_SEED, 1, 63),
    loot(ChestItems.HARRALANDER_SEED, 1, 56),
    loot(ChestItems.SNAPE_GRASS_SEED, 1, 40),
    loot(ChestItems.RANARR_SEED, 1, 39),
    loot(ChestItems.WHITEBERRY_SEED, 1, 34),
    loot(ChestItems.MUSHROOM_SPORE, 1, 29),
    loot(ChestItems.TOADFLAX_SEED, 1, 27),
    loot(ChestItems.BELLADONNA_SEED, 1, 18),
    loot(ChestItems.IRIT_SEED, 1, 18),
    loot(ChestItems.POISON_IVY_SEED, 1, 13),
    loot(ChestItems.AVANTOE_SEED, 1, 12),
    loot(ChestItems.CACTUS_SEED, 1, 12),
    loot(ChestItems.KWUARM_SEED, 1, 9),
    loot(ChestItems.POTATO_CACTUS_SEED, 1, 8),
    loot(ChestItems.SNAPDRAGON_SEED, 1, 5),
    loot(ChestItems.CADANTINE_SEED, 1, 4),
    loot(ChestItems.LANTADYME_SEED, 1, 3),
    loot(ChestItems.DWARF_WEED_SEED, 1, 2),
    loot(ChestItems.TORSTOL_SEED, 1, 1),
];

function pirateLoot(opts: {
    dagger: number;
    scimitar: number;
    cannonA: number;
    cannonB: number;
    cannonC: number;
    associatedFrag: number;
    coins: [number, number];
    rune: number;
    necklaceA: number;
    necklaceB: number;
}): ChestLoot[] {
    return [
        loot(opts.dagger, 1, 3),
        loot(opts.scimitar, 1, 3),
        loot(opts.cannonA, [5, 10], 3),
        loot(opts.cannonB, [5, 10], 2),
        loot(opts.cannonC, [5, 10], 1),
        loot(0, 1, 8, GEM_SUBTABLE),
        loot(opts.associatedFrag, 2, 3),
        loot(0, 1, 1, SAILING_FRAG_SUBTABLE),
        loot(ChestItems.COINS, opts.coins, 20),
        loot(ChestItems.SILVER_BAR, 1, 4),
        loot(ChestItems.GOLD_BAR, 1, 4),
        loot(opts.rune, [5, 10], 3),
        loot(opts.necklaceA, 1, 2),
        loot(opts.necklaceB, 1, 2),
    ];
}

const PICKLOCK_ACTIONS = ["pick-lock", "pick lock", "picklock"];
const PIRATE_FAIL_TELEPORT_SKILLING = { low: 50, high: 20 };

export const CHESTS: ChestDef[] = [
    {
        // 10 coin chest — wiki object 11735
        id: "coins-10",
        displayName: "chest",
        locIds: [11735],
        reqLevel: 13,
        xp: 7.8,
        alwaysLoot: [loot(ChestItems.COINS, 10)],
        lootTable: [],
        respawnTicks: 6,
        requiresLockpick: false,
        hasTrap: true,
        trap: { kind: "percent", numerator: 8, plus: 1 },
        stealActions: ["search for traps", "search-for-traps"],
    },
    {
        // Nature rune chest — wiki object 11736
        id: "nature",
        displayName: "chest",
        locIds: [11736],
        reqLevel: 28,
        xp: 25,
        alwaysLoot: [loot(ChestItems.NATURE_RUNE, 1), loot(ChestItems.COINS, 3)],
        lootTable: [],
        respawnTicks: 13,
        requiresLockpick: false,
        hasTrap: true,
        trap: { kind: "percent", numerator: 12, plus: 3 },
        stealActions: ["search for traps", "search-for-traps"],
    },
    {
        // Rusty pirate chest — wiki objects 60511 (Dognose), 60512 (Vatrachos)
        id: "pirate-rusty",
        displayName: "rusty chest",
        locIds: [60511, 60512],
        reqLevel: 33,
        xp: 90,
        alwaysLoot: [],
        lootTable: pirateLoot({
            dagger: ChestItems.STEEL_DAGGER,
            scimitar: ChestItems.STEEL_SCIMITAR,
            cannonA: ChestItems.BRONZE_CANNONBALL,
            cannonB: ChestItems.IRON_CANNONBALL,
            cannonC: ChestItems.STEEL_CANNONBALL,
            associatedFrag: ChestItems.ELKHORN_FRAG,
            coins: [100, 200],
            rune: ChestItems.MIND_RUNE,
            necklaceA: ChestItems.SAPPHIRE_NECKLACE,
            necklaceB: ChestItems.EMERALD_NECKLACE,
        }),
        respawnTicks: 0,
        requiresLockpick: false,
        lockpickOptional: true,
        hasTrap: false,
        openAction: false,
        stealActions: PICKLOCK_ACTIONS,
        successLow: -5,
        successHigh: 155,
        lockpickLow: 20,
        lockpickHigh: 180,
        failTeleports: {
            60511: { x: 3054, y: 2650, level: 0 },
            60512: { x: 1884, y: 2973, level: 0 },
        },
        failTeleportSkilling: PIRATE_FAIL_TELEPORT_SKILLING,
        depletes: false,
    },
    {
        // 50 coin chest — wiki object 11737
        id: "coins-50",
        displayName: "chest",
        locIds: [11737],
        reqLevel: 43,
        xp: 125,
        alwaysLoot: [loot(ChestItems.COINS, 50)],
        lootTable: [],
        respawnTicks: 75,
        requiresLockpick: false,
        hasTrap: true,
        trap: { kind: "percent", numerator: 15, plus: 2 },
        stealActions: ["search for traps", "search-for-traps"],
    },
    {
        // Steel arrowtips chest — wiki object 11742
        id: "steel-arrowtips",
        displayName: "chest",
        locIds: [11742],
        reqLevel: 47,
        xp: 150,
        alwaysLoot: [loot(ChestItems.STEEL_ARROWTIPS, 5), loot(ChestItems.COINS, 20)],
        lootTable: [],
        respawnTicks: 125,
        requiresLockpick: true,
        hasTrap: true,
        trap: { kind: "percent", numerator: 15, plus: 2 },
        stealActions: ["search for traps", "search-for-traps"],
    },
    {
        // Varlamore stealing-valuables chest — wiki object 52008.
        // Hooks only: house keys, vacant-house varbits, flashing-arrow bonus,
        // and homeowner return are not implemented.
        id: "varlamore-valuables",
        displayName: "chest",
        locIds: [52008],
        reqLevel: 50,
        xp: 45,
        alwaysLoot: [loot(ChestItems.VALUABLES, 1)],
        lootTable: [
            loot(0, 0, 6135),
            loot(ChestItems.BLESSED_BONE_STATUETTE_EAGLE, 1, 12),
            loot(ChestItems.BLESSED_BONE_STATUETTE_FOX, 1, 12),
            loot(ChestItems.BLESSED_BONE_STATUETTE_BUFFALO, 1, 12),
            loot(ChestItems.GOLD_NECKLACE, 1, 10),
            loot(ChestItems.GOLD_AMULET, 1, 10),
            loot(ChestItems.GOLD_RING, 1, 10),
            loot(ChestItems.EMERALD_AMULET, 1, 10),
            loot(ChestItems.SAPPHIRE_AMULET, 1, 10),
            loot(ChestItems.EMERALD_NECKLACE, 1, 9),
            loot(ChestItems.SAPPHIRE_NECKLACE, 1, 9),
            loot(ChestItems.RUBY_AMULET, 1, 5),
            loot(ChestItems.RUBY_NECKLACE, 1, 5),
            loot(ChestItems.DIAMOND_AMULET, 1, 3),
            loot(ChestItems.RUBY_RING, 1, 2),
            loot(ChestItems.EMERALD_RING, 1, 2),
            loot(ChestItems.SAPPHIRE_RING, 1, 2),
            loot(ChestItems.DIAMOND_RING, 1, 1),
            loot(ChestItems.DIAMOND_NECKLACE, 1, 1),
        ],
        respawnTicks: 0,
        requiresLockpick: false,
        hasTrap: false,
        openAction: false,
        stealMode: "search",
        stealActions: ["search"],
        depletes: false,
    },
    {
        // Dorgesh-Kaan average — wiki objects 22697, 22698
        id: "dorgesh-average",
        displayName: "chest",
        locIds: [22697, 22698],
        reqLevel: 52,
        xp: 200,
        alwaysLoot: [],
        lootTable: [
            loot(ChestItems.COINS, [1, 250], 3),
            loot(ChestItems.OIL_LANTERN, 1, 1),
            loot(ChestItems.BULLSEYE_LANTERN, 1, 1),
            loot(ChestItems.MINING_HELMET, 1, 1),
            loot(ChestItems.CAVE_GOBLIN_WIRE, [1, 2], 1),
        ],
        respawnTicks: 150,
        requiresLockpick: true,
        hasTrap: false,
        stealActions: ["pick-lock", "pick lock"],
    },
    {
        // Tarnished pirate chest — wiki objects 60514 (Crown Jewel), 60515 (Shimmering Atoll)
        id: "pirate-tarnished",
        displayName: "tarnished chest",
        locIds: [60514, 60515],
        reqLevel: 54,
        xp: 122.5,
        alwaysLoot: [],
        lootTable: pirateLoot({
            dagger: ChestItems.MITHRIL_DAGGER,
            scimitar: ChestItems.MITHRIL_SCIMITAR,
            cannonA: ChestItems.IRON_CANNONBALL,
            cannonB: ChestItems.STEEL_CANNONBALL,
            cannonC: ChestItems.MITHRIL_CANNONBALL,
            associatedFrag: ChestItems.PILLAR_FRAG,
            coins: [200, 400],
            rune: ChestItems.CHAOS_RUNE,
            necklaceA: ChestItems.EMERALD_NECKLACE,
            necklaceB: ChestItems.RUBY_NECKLACE,
        }),
        respawnTicks: 0,
        requiresLockpick: false,
        lockpickOptional: true,
        hasTrap: false,
        openAction: false,
        stealActions: PICKLOCK_ACTIONS,
        successLow: -5,
        successHigh: 155,
        lockpickLow: 20,
        lockpickHigh: 180,
        failTeleports: {
            60514: { x: 1759, y: 2664, level: 0 },
            60515: { x: 1563, y: 2773, level: 0 },
        },
        failTeleportSkilling: PIRATE_FAIL_TELEPORT_SKILLING,
        depletes: false,
    },
    {
        // Chaos Druid Tower / blood rune chest — wiki object 11738 (Yanille)
        id: "blood",
        displayName: "chest",
        locIds: [11738],
        reqLevel: 59,
        xp: 250,
        alwaysLoot: [loot(ChestItems.BLOOD_RUNE, 2), loot(ChestItems.COINS, 500)],
        lootTable: [],
        respawnTicks: 225,
        requiresLockpick: false,
        hasTrap: true,
        trap: { kind: "chaos-druid" },
        teleport: { x: 2584, y: 3337, level: 0 },
        stealActions: ["search for traps", "search-for-traps"],
    },
    {
        // Lizardman Temple stone chest — wiki object 34429
        id: "stone",
        displayName: "stone chest",
        locIds: [34429],
        reqLevel: 64,
        xp: 280,
        alwaysLoot: [],
        lootTable: [
            loot(0, 1, 10, STONE_BOLT_TIPS),
            loot(0, 1, 15, UNCOMMON_SEED_TABLE),
            loot(ChestItems.COINS, [20, 260], 100),
            loot(ChestItems.XERICIAN_FABRIC, 1, 66),
            loot(ChestItems.LIZARDMAN_FANG, 1, 85),
            loot(ChestItems.UNCUT_SAPPHIRE, 1, 12),
            loot(ChestItems.UNCUT_RUBY, 1, 8),
            loot(ChestItems.CLUE_SCROLL_MEDIUM, 1, 3),
            loot(ChestItems.XERICS_TALISMAN_INERT, 1, 1),
        ],
        respawnTicks: 0,
        requiresLockpick: false,
        lockpickOptional: true,
        hasTrap: false,
        openAction: false,
        stealActions: PICKLOCK_ACTIONS,
        successLow: -56,
        successHigh: 154,
        lockpickLow: -31,
        lockpickHigh: 179,
        failTeleport: { x: 1304, y: 3663, level: 0 },
        failTeleportChance: 8,
        depletes: false,
    },
    {
        // Ardougne Castle chest — wiki object 11739
        id: "ardougne-castle",
        displayName: "chest",
        locIds: [11739],
        reqLevel: 72,
        xp: 500,
        alwaysLoot: [
            loot(ChestItems.COINS, 1000),
            loot(ChestItems.RAW_SHARK, 1),
            loot(ChestItems.ADAMANTITE_ORE, 1),
            loot(ChestItems.UNCUT_SAPPHIRE, 1),
        ],
        lootTable: [],
        respawnTicks: 833,
        requiresLockpick: false,
        hasTrap: true,
        trap: { kind: "percent", numerator: 20, plus: 5 },
        teleport: { x: 2696, y: 3284, level: 0 },
        stealActions: ["search for traps", "search-for-traps"],
    },
    {
        // Reinforced pirate chest — wiki objects 60517 (Brittle Isle), 60518 (Ynysdail)
        id: "pirate-reinforced",
        displayName: "reinforced chest",
        locIds: [60517, 60518],
        reqLevel: 76,
        xp: 182.5,
        alwaysLoot: [],
        lootTable: pirateLoot({
            dagger: ChestItems.ADAMANT_DAGGER,
            scimitar: ChestItems.ADAMANT_SCIMITAR,
            cannonA: ChestItems.STEEL_CANNONBALL,
            cannonB: ChestItems.MITHRIL_CANNONBALL,
            cannonC: ChestItems.ADAMANT_CANNONBALL,
            associatedFrag: ChestItems.UMBRAL_FRAG,
            coins: [500, 1000],
            rune: ChestItems.DEATH_RUNE,
            necklaceA: ChestItems.RUBY_NECKLACE,
            necklaceB: ChestItems.DIAMOND_NECKLACE,
        }),
        respawnTicks: 0,
        requiresLockpick: false,
        lockpickOptional: true,
        hasTrap: false,
        openAction: false,
        stealActions: PICKLOCK_ACTIONS,
        successLow: -5,
        successHigh: 155,
        lockpickLow: 20,
        lockpickHigh: 180,
        failTeleports: {
            60517: { x: 1947, y: 4073, level: 0 },
            60518: { x: 2220, y: 3477, level: 0 },
        },
        failTeleportSkilling: PIRATE_FAIL_TELEPORT_SKILLING,
        depletes: false,
    },
    {
        // Dorgesh-Kaan rich — wiki objects 22681, 22682
        id: "dorgesh-rich",
        displayName: "chest",
        locIds: [22681, 22682],
        reqLevel: 78,
        xp: 650,
        alwaysLoot: [],
        lootTable: [
            loot(ChestItems.UNCUT_SAPPHIRE, 1, 1),
            loot(ChestItems.UNCUT_EMERALD, 1, 1),
            loot(ChestItems.UNCUT_RUBY, 1, 1),
            loot(ChestItems.UNCUT_DIAMOND, 1, 1),
            loot(ChestItems.UNCUT_OPAL, 1, 1),
            loot(ChestItems.UNCUT_JADE, 1, 1),
            loot(ChestItems.UNCUT_RED_TOPAZ, 1, 1),
            loot(ChestItems.BULLSEYE_LANTERN, 1, 1),
            loot(ChestItems.MINING_HELMET, 1, 1),
            loot(ChestItems.FROG_LEATHER_CHAPS, 1, 1),
            loot(ChestItems.FROG_LEATHER_BODY, 1, 1),
            loot(ChestItems.IRON_BAR, 1, 1),
            loot(ChestItems.CAVE_GOBLIN_WIRE, [1, 2], 1),
            loot(ChestItems.LIGHT_ORB, 1, 1),
            loot(ChestItems.EMPTY_LIGHT_ORB, 1, 1),
        ],
        respawnTicks: 500,
        requiresLockpick: true,
        hasTrap: false,
        stealActions: ["pick-lock", "pick lock"],
    },
    {
        // Rogues' Castle — wiki object 26757 (closed). Hard Wilderness Diary loot
        // (all diary tiers are unlocked on login). Trap damage is an HP-scaled
        // estimate; wiki is silent on the Open-trap formula.
        id: "rogues-castle",
        displayName: "chest",
        locIds: [26757],
        reqLevel: 84,
        xp: 701.7,
        alwaysLoot: [],
        lootTable: [
            loot(ChestItems.NATURE_RUNE, 50, 11),
            loot(ChestItems.RED_SPIDERS_EGGS_NOTED, 7, 10),
            loot(ChestItems.LAW_RUNE, 50, 10),
            loot(ChestItems.COAL_NOTED, 25, 8),
            loot(ChestItems.COINS, 5625, 6),
            loot(ChestItems.VILE_ASHES_NOTED, 18, 3),
            loot(ChestItems.UNCUT_DIAMOND_NOTED, 3, 3),
            loot(ChestItems.UNCUT_DIAMOND_NOTED, 6, 2),
            loot(ChestItems.UNCUT_EMERALD_NOTED, 12, 2),
            loot(ChestItems.BLIGHTED_ANCIENT_ICE_SACK, 16, 2),
            loot(ChestItems.IRON_ORE_NOTED, 50, 1),
            loot(ChestItems.CHAOS_RUNE, 75, 1),
            loot(ChestItems.DEATH_RUNE, 62, 1),
            loot(ChestItems.BLIGHTED_MANTA_RAY_NOTED, 25, 1),
            loot(ChestItems.BLIGHTED_ANGLERFISH_NOTED, 18, 1),
            loot(ChestItems.UNCUT_SAPPHIRE_NOTED, 18, 1),
            loot(ChestItems.PRAYER_POTION_2, 1, 2),
            loot(ChestItems.DRAGONSTONE_NOTED, 2, 1),
        ],
        respawnTicks: 34,
        requiresLockpick: false,
        hasTrap: true,
        trap: { kind: "percent", numerator: 20, plus: 5 },
        stealActions: ["search for traps", "search-for-traps"],
    },
    {
        // Fossil Island underwater chest (opened) — wiki object 30971.
        // Hooks only: oxygen meter, drowning, blinking-arrow rotation, and
        // first-search-always-succeeds are not implemented.
        id: "underwater",
        displayName: "chest",
        locIds: [30971],
        reqLevel: 1,
        xp: 4.5,
        extraXp: [{ skillId: SkillId.Agility, xp: 4.5 }],
        alwaysLoot: [loot(ChestItems.MERMAIDS_TEAR, 1), loot(ChestItems.GLISTENING_TEAR, 1)],
        lootTable: [],
        respawnTicks: 0,
        requiresLockpick: false,
        hasTrap: false,
        openAction: false,
        stealMode: "search",
        stealActions: ["search"],
        successLow: 30,
        successHigh: 40,
        failMessage: "You jerk back as something nibbles your hand.",
        depletes: false,
    },
];

const chestByLocId = new Map<number, ChestDef>();
for (const def of CHESTS) {
    for (const locId of def.locIds) {
        chestByLocId.set(locId, def);
    }
}

export function getChestByLocId(locId: number): ChestDef | undefined {
    return chestByLocId.get(locId);
}

export function computeChestTrapDamage(trap: ChestTrap, currentHp: number): number {
    const hp = Math.max(1, Math.floor(currentHp));
    if (trap.kind === "chaos-druid") {
        return Math.max(1, Math.floor((9 * hp + 225) / 50));
    }
    return Math.max(1, Math.floor((hp * trap.numerator) / 100) + trap.plus);
}

/** OSRS skilling-success roll: interpolated low/high numerators out of 256. */
export function rollOsrsSkillingSuccess(level: number, low: number, high: number): boolean {
    const lvl = Math.min(99, Math.max(1, Math.floor(level)));
    const numer = Math.floor(((99 - lvl) * low + (lvl - 1) * high) / 98);
    return Math.random() * 256 < numer;
}

export function rollChestTableLoot(
    lootTable: ChestLoot[],
): { itemId: number; quantity: number } | undefined {
    if (lootTable.length === 0) return undefined;
    let totalWeight = 0;
    for (const entry of lootTable) totalWeight += entry.weight;
    if (totalWeight <= 0) return undefined;

    let roll = Math.random() * totalWeight;
    for (const entry of lootTable) {
        roll -= entry.weight;
        if (roll <= 0) return resolveLootEntry(entry);
    }
    return resolveLootEntry(lootTable[0]);
}

function resolveLootEntry(entry: ChestLoot): { itemId: number; quantity: number } | undefined {
    if (entry.nested && entry.nested.length > 0) {
        return rollChestTableLoot(entry.nested);
    }
    if (entry.itemId <= 0) return undefined;
    return resolveLootAmount(entry);
}

export function resolveLootAmount(entry: ChestLoot): { itemId: number; quantity: number } {
    const quantity =
        entry.minAmount === entry.maxAmount
            ? entry.minAmount
            : entry.minAmount + Math.floor(Math.random() * (entry.maxAmount - entry.minAmount + 1));
    return { itemId: entry.itemId, quantity };
}
