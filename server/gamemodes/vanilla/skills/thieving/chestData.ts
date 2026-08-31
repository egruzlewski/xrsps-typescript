// Thieving chest defs. Loc/item IDs from OSRS wiki scenery/item pages, cross-checked
// against server/data/items.json (cave goblin wire is 10981 in this dump; live wiki 11028).

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
};

export interface ChestLoot {
    itemId: number;
    minAmount: number;
    maxAmount: number;
    weight: number;
}

function loot(itemId: number, amount: number | [number, number], weight = 1): ChestLoot {
    const [minAmount, maxAmount] = Array.isArray(amount) ? amount : [amount, amount];
    return { itemId, minAmount, maxAmount, weight };
}

/** Trap damage: documented wiki formulas, or HP-scaled estimates where the wiki is silent. */
export type ChestTrap =
    | { kind: "percent"; numerator: number; plus: number }
    | { kind: "chaos-druid" };

export interface ChestDef {
    id: string;
    displayName: string;
    locIds: number[];
    reqLevel: number;
    xp: number;
    alwaysLoot: ChestLoot[];
    lootTable: ChestLoot[];
    /** Restock delay in ticks (wiki seconds / 0.6). */
    respawnTicks: number;
    requiresLockpick: boolean;
    hasTrap: boolean;
    trap?: ChestTrap;
    teleport?: { x: number; y: number; level: number };
    stealActions: string[];
}

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
        if (roll <= 0) return resolveLootAmount(entry);
    }
    return resolveLootAmount(lootTable[0]);
}

export function resolveLootAmount(entry: ChestLoot): { itemId: number; quantity: number } {
    const quantity =
        entry.minAmount === entry.maxAmount
            ? entry.minAmount
            : entry.minAmount + Math.floor(Math.random() * (entry.maxAmount - entry.minAmount + 1));
    return { itemId: entry.itemId, quantity };
}
