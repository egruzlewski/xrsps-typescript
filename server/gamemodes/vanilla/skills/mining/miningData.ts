export type Vec2 = { x: number; y: number };

interface LocTypeData {
    name?: string;
    actions?: (string | null)[];
    models?: number[][];
    recolorTo?: number[];
}

export interface LocTypeLoader {
    getCount?: () => number;
    load?: (id: number) => LocTypeData | undefined;
}

export interface PickaxeDefinition {
    itemId: number;
    level: number;
    animation: number;
    accuracy: number;
    swingTicks: number;
    ignoreLevelRequirement?: boolean;
}

export const PICKAXES: PickaxeDefinition[] = [
    { itemId: 13243, level: 61, animation: 642, accuracy: 16, swingTicks: 3 }, // Infernal
    {
        itemId: 25112,
        level: 71,
        animation: 8787,
        accuracy: 16,
        swingTicks: 3,
        ignoreLevelRequirement: true,
    }, // Echo/Trailblazer (crystal-tier, no req)
    { itemId: 23680, level: 71, animation: 642, accuracy: 16, swingTicks: 3 }, // Crystal
    { itemId: 20014, level: 65, animation: 642, accuracy: 15, swingTicks: 3 }, // 3rd age
    { itemId: 23677, level: 61, animation: 642, accuracy: 15, swingTicks: 3 }, // Dragon (or)
    { itemId: 25376, level: 61, animation: 642, accuracy: 15, swingTicks: 3 }, // Dragon (or kit)
    { itemId: 11920, level: 61, animation: 642, accuracy: 15, swingTicks: 3 }, // Dragon
    { itemId: 23276, level: 61, animation: 624, accuracy: 14, swingTicks: 3 }, // Gilded (rune stats)
    { itemId: 12797, level: 61, animation: 642, accuracy: 15, swingTicks: 3 }, // Dragon (+kit)
    { itemId: 25063, level: 61, animation: 642, accuracy: 15, swingTicks: 3 }, // Infernal (or)
    { itemId: 30345, level: 61, animation: 642, accuracy: 16, swingTicks: 3 }, // Infernal (or v2)
    { itemId: 30351, level: 61, animation: 642, accuracy: 15, swingTicks: 3 }, // Dragon (or v2)
    { itemId: 1275, level: 41, animation: 624, accuracy: 13, swingTicks: 3 }, // Rune
    { itemId: 11719, level: 41, animation: 624, accuracy: 13, swingTicks: 3 }, // Rune (NZ)
    { itemId: 1271, level: 31, animation: 628, accuracy: 11, swingTicks: 4 }, // Adamant
    { itemId: 1273, level: 21, animation: 629, accuracy: 9, swingTicks: 5 }, // Mithril
    { itemId: 1269, level: 6, animation: 627, accuracy: 7, swingTicks: 6 }, // Steel
    { itemId: 1267, level: 1, animation: 626, accuracy: 5, swingTicks: 7 }, // Iron
    { itemId: 12297, level: 11, animation: 626, accuracy: 6, swingTicks: 5 }, // Black
    { itemId: 1265, level: 1, animation: 625, accuracy: 3, swingTicks: 8 }, // Bronze
].sort((a, b) => b.level - a.level);

export interface MiningRockDefinition {
    id: string;
    name: string;
    level: number;
    xp: number;
    oreItemId: number;
    depletedLocId?: number;
    respawnTicks: { min: number; max: number };
    swingTicks: number;
    /** Extra Crafting gate used by dense runestone (OSRS 38). */
    craftingLevel?: number;
    craftingXp?: number;
    requireChisel?: boolean;
    /** Dense runestone always yields a block; pickaxe only supplies the animation. */
    alwaysSucceed?: boolean;
}

/** Unstackable block from Arceuus dense runestone (OSRS 13445). */
export const DENSE_ESSENCE_BLOCK = 13445;
/** Inventory chisel required to chip dense runestone (OSRS 1755). */
export const DENSE_RUNESTONE_CHISEL = 1755;

/**
 * Wiki scenery ids: Chip on dense runestone, Check on depleted.
 * 8975↔8976, 8977↔8978, 8979↔8980.
 */
export const DENSE_RUNESTONE_LOCS: readonly { locId: number; depletedLocId: number }[] = [
    { locId: 8975, depletedLocId: 8976 },
    { locId: 8977, depletedLocId: 8978 },
    { locId: 8979, depletedLocId: 8980 },
];

/** OSRS persist roll: low 210 / high 230 over 256 at levels 1–99. */
export function denseRunestonePersistChance(level: number): number {
    const lv = Math.max(1, Math.min(99, Math.floor(level)));
    return (210 * (99 - lv) + 230 * (lv - 1)) / 98 / 256;
}

export function denseRunestonePersists(level: number, roll: number = Math.random()): boolean {
    return roll < denseRunestonePersistChance(level);
}

const ROCK_DEFINITIONS: MiningRockDefinition[] = [
    {
        id: "clay",
        name: "Clay rocks",
        level: 1,
        xp: 5,
        oreItemId: 434,
        // LostCity mine.dbrow rock_respawnrate
        respawnTicks: { min: 6, max: 6 },
        swingTicks: 3,
    },
    {
        id: "copper",
        name: "Copper rocks",
        level: 1,
        xp: 17.5,
        oreItemId: 436,
        respawnTicks: { min: 10, max: 10 },
        swingTicks: 3,
    },
    {
        id: "tin",
        name: "Tin rocks",
        level: 1,
        xp: 17.5,
        oreItemId: 438,
        respawnTicks: { min: 10, max: 10 },
        swingTicks: 3,
    },
    {
        id: "iron",
        name: "Iron rocks",
        level: 15,
        xp: 35,
        oreItemId: 440,
        respawnTicks: { min: 20, max: 20 },
        swingTicks: 3,
    },
    {
        id: "blurite",
        name: "Blurite rocks",
        level: 10,
        xp: 17.5,
        oreItemId: 668,
        respawnTicks: { min: 80, max: 80 },
        swingTicks: 3,
    },
    {
        id: "silver",
        name: "Silver rocks",
        level: 20,
        xp: 40,
        oreItemId: 442,
        respawnTicks: { min: 200, max: 200 },
        swingTicks: 4,
    },
    {
        id: "coal",
        name: "Coal rocks",
        level: 30,
        xp: 50,
        oreItemId: 453,
        respawnTicks: { min: 100, max: 100 },
        swingTicks: 4,
    },
    {
        id: "gold",
        name: "Gold rocks",
        level: 40,
        xp: 65,
        oreItemId: 444,
        respawnTicks: { min: 200, max: 200 },
        swingTicks: 4,
    },
    {
        id: "mithril",
        name: "Mithril rocks",
        level: 55,
        xp: 80,
        oreItemId: 447,
        respawnTicks: { min: 400, max: 400 },
        swingTicks: 5,
    },
    {
        id: "adamantite",
        name: "Adamantite rocks",
        level: 70,
        xp: 95,
        oreItemId: 449,
        respawnTicks: { min: 800, max: 800 },
        swingTicks: 6,
    },
    {
        id: "runite",
        name: "Runite rocks",
        level: 85,
        xp: 125,
        oreItemId: 451,
        respawnTicks: { min: 2400, max: 2400 },
        swingTicks: 8,
    },
    {
        id: "amethyst",
        name: "Amethyst crystals",
        level: 92,
        xp: 240,
        oreItemId: 21347,
        depletedLocId: 11389,
        // Post-LostCity ore — keep soft OSRS-ish range
        respawnTicks: { min: 110, max: 150 },
        swingTicks: 6,
    },
    {
        id: "dense",
        name: "Dense runestone",
        level: 38,
        xp: 12,
        craftingLevel: 38,
        craftingXp: 8,
        oreItemId: DENSE_ESSENCE_BLOCK,
        requireChisel: true,
        alwaysSucceed: true,
        // Wiki gathering time is 9 ticks; pickaxe tier does not speed this up.
        respawnTicks: { min: 20, max: 20 },
        swingTicks: 9,
    },
];

const ROCK_BY_ID = new Map<string, MiningRockDefinition>(
    ROCK_DEFINITIONS.map((rock) => [rock.id, rock]),
);

const ROCK_NAME_ALIASES: Record<string, string> = {
    "clay rocks": "clay",
    "copper rocks": "copper",
    "copper ore rocks": "copper",
    "tin rocks": "tin",
    "tin ore rocks": "tin",
    "iron rocks": "iron",
    "iron ore rocks": "iron",
    "blurite rocks": "blurite",
    "silver rocks": "silver",
    "silver ore rocks": "silver",
    "coal rocks": "coal",
    "gold rocks": "gold",
    "gold ore rocks": "gold",
    "mithril rocks": "mithril",
    "mithril ore rocks": "mithril",
    "adamantite rocks": "adamantite",
    "adamant rocks": "adamantite",
    "Adamantite rocks": "adamantite",
    "runite rocks": "runite",
    "runite ore rocks": "runite",
    "amethyst crystals": "amethyst",
    "amethyst rocks": "amethyst",
    "dense runestone": "dense",
};

export function getMiningRockById(id: string): MiningRockDefinition | undefined {
    return ROCK_BY_ID.get(id);
}

export function resolveMiningRockByName(name?: string): MiningRockDefinition | undefined {
    if (!name) return undefined;
    const normalized = name.trim().toLowerCase();
    const alias = ROCK_NAME_ALIASES[normalized];
    if (!alias) return undefined;
    return ROCK_BY_ID.get(alias);
}

export interface MiningLocMapping {
    rockId: string;
    depletedLocId?: number;
}

export interface MiningLocMap {
    map: Map<number, MiningLocMapping>;
}

export function applyDenseRunestoneLocs(map: Map<number, MiningLocMapping>): void {
    for (const { locId, depletedLocId } of DENSE_RUNESTONE_LOCS) {
        map.set(locId, { rockId: "dense", depletedLocId });
    }
}

function hasMineAction(loc: LocTypeData | undefined): boolean {
    const actions = loc?.actions;
    if (!Array.isArray(actions)) return false;
    return actions.some((action) => action && action.trim().toLowerCase() === "mine");
}

function getPrimaryModelId(loc: LocTypeData | undefined): number | undefined {
    const models = loc?.models;
    if (!Array.isArray(models) || models.length === 0) return undefined;
    const primary = models[0];
    if (!Array.isArray(primary) || primary.length === 0) return undefined;
    const modelId = primary[0];
    if (!Number.isFinite(modelId) || modelId <= 0) return undefined;
    return modelId;
}

function hasRecolor(loc: LocTypeData | undefined): boolean {
    const recolorTo = loc?.recolorTo;
    return Array.isArray(recolorTo) && recolorTo.length > 0;
}

function isDepletedRockCandidate(loc: LocTypeData | undefined): boolean {
    const name = loc?.name?.trim().toLowerCase() ?? "";
    if (name !== "rocks") return false;
    if (!hasMineAction(loc)) return false;
    if (hasRecolor(loc)) return false;
    return (getPrimaryModelId(loc) ?? 0) > 0;
}

function findNearestDepletedLocId(
    sourceLocId: number,
    modelId: number,
    candidatesByModel: Map<number, number[]>,
): number | undefined {
    const candidates = candidatesByModel.get(modelId);
    if (!candidates || candidates.length === 0) return undefined;

    let nearest: number | undefined;
    let bestDistance = Number.MAX_SAFE_INTEGER;
    for (const candidate of candidates) {
        const distance = Math.abs(candidate - sourceLocId);
        if (distance < bestDistance) {
            bestDistance = distance;
            nearest = candidate;
        }
    }
    return nearest;
}

export function buildMiningLocMap(loader?: LocTypeLoader): MiningLocMap {
    const map = new Map<number, MiningLocMapping>();
    applyDenseRunestoneLocs(map);
    if (!loader?.getCount || !loader.load) {
        return { map };
    }
    const total = loader.getCount();
    if (!Number.isFinite(total) || total <= 0) {
        return { map };
    }

    const depletedCandidatesByModel = new Map<number, number[]>();

    for (let id = 0; id < total; id++) {
        let loc: LocTypeData | undefined;
        try {
            loc = loader.load(id);
        } catch {
            continue;
        }
        if (!isDepletedRockCandidate(loc)) continue;
        const modelId = getPrimaryModelId(loc);
        if (!(modelId && modelId > 0)) continue;
        const list = depletedCandidatesByModel.get(modelId) ?? [];
        list.push(id);
        depletedCandidatesByModel.set(modelId, list);
    }

    for (let id = 0; id < total; id++) {
        let loc: LocTypeData | undefined;
        try {
            loc = loader.load(id);
        } catch {
            continue;
        }
        if (!hasMineAction(loc)) continue;
        const name = loc?.name as string | undefined;
        const rock = resolveMiningRockByName(name);
        if (!rock) continue;
        let depletedLocId =
            rock.depletedLocId && rock.depletedLocId > 0 ? rock.depletedLocId : undefined;
        if (!depletedLocId) {
            const modelId = getPrimaryModelId(loc);
            if (modelId && modelId > 0) {
                depletedLocId = findNearestDepletedLocId(id, modelId, depletedCandidatesByModel);
            }
        }

        map.set(id, {
            rockId: rock.id,
            depletedLocId: depletedLocId && depletedLocId > 0 ? depletedLocId : undefined,
        });
    }
    applyDenseRunestoneLocs(map);
    return { map };
}

export function selectPickaxeByLevel(
    availableIds: number[],
    level: number,
    preferredItemId?: number,
): PickaxeDefinition | undefined {
    const cache = new Set(availableIds.map((id) => id));
    // Prefer the wielded pickaxe when it is usable — avoids silently using a
    // stronger skilling tool left in the inventory (e.g. Echo while wielding rune).
    if (preferredItemId && preferredItemId > 0 && cache.has(preferredItemId)) {
        const preferred = PICKAXES.find((pick) => pick.itemId === preferredItemId);
        if (preferred && (level >= preferred.level || preferred.ignoreLevelRequirement)) {
            return preferred;
        }
    }
    for (const pick of PICKAXES) {
        if (!cache.has(pick.itemId)) continue;
        if (level >= pick.level || pick.ignoreLevelRequirement) return pick;
    }
    return undefined;
}

export function getMiningRockFromMap(
    locId: number,
    map: MiningLocMap,
): MiningRockDefinition | undefined {
    const mapping = map.map.get(locId);
    if (!mapping) return undefined;
    const rock = ROCK_BY_ID.get(mapping.rockId);
    if (!rock) return undefined;
    const depletedLocId = mapping.depletedLocId ?? -1;
    if (depletedLocId > 0 && rock.depletedLocId !== depletedLocId) {
        return { ...rock, depletedLocId };
    }
    return rock;
}

export function buildMiningTileKey(tile: Vec2, level: number): string {
    return `${level}:${tile.x}:${tile.y}`;
}

export type { MiningRockDefinition as MiningRock };
