import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import { LockState } from "../../../../src/game/model/LockState";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    ScriptActionHandlerContext,
    ScriptServices,
} from "../../../../src/game/scripts/types";
import { ResourceNodeTracker, buildTileKey } from "../../systems/ResourceNodeTracker";

// ---------------------------------------------------------------------------
// Stall thieving
//
// Object-based steal-from locs. Loc/item IDs and XP are OSRS wiki object/item
// IDs (current live values). Success uses the same interpolated chance curve as
// picklock; failure stuns like pickpocket. Depleted stalls hide via loc-change
// to 0 (flax/mining ResourceNodeTracker pattern) until they respawn.
// ---------------------------------------------------------------------------

const ALWAYS = 256;

interface StallLoot {
    itemId: number;
    minAmount: number;
    maxAmount: number;
    weight: number;
}

function loot(itemId: number, amount: number | [number, number], weight: number): StallLoot {
    const [minAmount, maxAmount] = Array.isArray(amount) ? amount : [amount, amount];
    return { itemId, minAmount, maxAmount, weight };
}

export interface StallDef {
    id: string;
    displayName: string;
    locIds: number[];
    reqLevel: number;
    xp: number;
    lootTable: StallLoot[];
    /** Restock delay in ticks (wiki seconds / 0.6). */
    respawnTicks: number;
    minDamage: number;
    maxDamage: number;
    stunTicks: number;
}

const Items = {
    POTATO: 1942,
    CABBAGE: 1965,
    ONION: 1957,
    TOMATO: 1982,
    GARLIC: 1550,
    BREAD: 2309,
    CAKE: 1891,
    CHOCOLATE_SLICE: 1901,
    CUP_OF_TEA: 1978,
    CHISEL: 1755,
    RING_MOULD: 1592,
    NECKLACE_MOULD: 1597,
    AMULET_MOULD: 1595,
    BRACELET_MOULD: 11065,
    GOLD_BAR: 2357,
    SILK: 950,
    BOTTLE_OF_WINE: 7919,
    GRAPES: 1987,
    JUG: 1935,
    JUG_OF_WATER: 1937,
    JUG_OF_WINE: 1993,
    GREY_WOLF_FUR: 958,
    RAW_SALMON: 331,
    RAW_TUNA: 359,
    RAW_LOBSTER: 377,
    SILVER_ORE: 442,
    SILVER_BAR: 2355,
    TIARA: 5525,
    SPICE: 2007,
    UNCUT_SAPPHIRE: 1623,
    UNCUT_EMERALD: 1621,
    UNCUT_RUBY: 1619,
    UNCUT_DIAMOND: 1617,
    HAMMERSTONE_SEED: 5307,
    POTATO_SEED: 5318,
    MARIGOLD_SEED: 5096,
    BARLEY_SEED: 5305,
    ONION_SEED: 5319,
    ASGARNIAN_SEED: 5308,
    CABBAGE_SEED: 5324,
    YANILLIAN_SEED: 5309,
    ROSEMARY_SEED: 5097,
    NASTURTIUM_SEED: 5098,
    TOMATO_SEED: 5322,
    JUTE_SEED: 5306,
    SWEETCORN_SEED: 5320,
    KRANDORIAN_SEED: 5310,
    STRAWBERRY_SEED: 5323,
    WILDBLOOD_SEED: 5311,
    WATERMELON_SEED: 5321,
    COOKING_APPLE: 1955,
    BANANA: 1963,
    JANGERBERRIES: 247,
    LEMON: 2102,
    REDBERRIES: 1951,
    PINEAPPLE: 2114,
    LIME: 2120,
    STRAWBERRY: 5504,
    STRANGE_FRUIT: 464,
    GOLOVANOVA_FRUIT_TOP: 19653,
    PAPAYA_FRUIT: 5972,
    HAMMER: 2347,
    POT: 1931,
    TINDERBOX: 590,
    AIR_RUNE: 556,
    EARTH_RUNE: 557,
    FIRE_RUNE: 554,
    LAW_RUNE: 563,
    NATURE_RUNE: 561,
    IRON_SCIMITAR: 1323,
    STEEL_SCIMITAR: 1325,
    MITHRIL_SCIMITAR: 1329,
    ADAMANT_SCIMITAR: 1331,
};

export const STALLS: StallDef[] = [
    {
        // Veg stall (Miscellania / Etceteria) — wiki object IDs 4706, 4708
        id: "veg",
        displayName: "veg stall",
        locIds: [4706, 4708],
        reqLevel: 2,
        xp: 10,
        lootTable: [
            loot(Items.POTATO, 1, 3),
            loot(Items.CABBAGE, 1, 2),
            loot(Items.ONION, 1, 2),
            loot(Items.TOMATO, 1, 2),
            loot(Items.GARLIC, 1, 1),
        ],
        respawnTicks: 2,
        minDamage: 1,
        maxDamage: 1,
        stunTicks: 8,
    },
    {
        // Tea stall (Varrock) — wiki object ID 635
        id: "tea",
        displayName: "tea stall",
        locIds: [635],
        reqLevel: 5,
        xp: 16,
        lootTable: [loot(Items.CUP_OF_TEA, 1, ALWAYS)],
        respawnTicks: 4,
        minDamage: 1,
        maxDamage: 1,
        stunTicks: 8,
    },
    {
        // Baker's stall (Ardougne 11730, Keldagrim 6163, Hosidius 6945)
        id: "baker",
        displayName: "baker's stall",
        locIds: [11730, 6163, 6945],
        reqLevel: 5,
        xp: 16,
        lootTable: [
            loot(Items.CAKE, 1, 13),
            loot(Items.BREAD, 1, 5),
            loot(Items.CHOCOLATE_SLICE, 1, 2),
        ],
        respawnTicks: 4,
        minDamage: 1,
        maxDamage: 1,
        stunTicks: 8,
    },
    {
        // Crafting stall (Ape Atoll) — wiki object ID 4874
        id: "crafting",
        displayName: "crafting stall",
        locIds: [4874],
        reqLevel: 5,
        xp: 20,
        lootTable: [
            loot(Items.AMULET_MOULD, 1, 12),
            loot(Items.BRACELET_MOULD, 1, 12),
            loot(Items.NECKLACE_MOULD, 1, 11),
            loot(Items.RING_MOULD, 1, 11),
            loot(Items.CHISEL, 1, 6),
            loot(Items.GOLD_BAR, 1, 2),
        ],
        respawnTicks: 8,
        minDamage: 1,
        maxDamage: 1,
        stunTicks: 8,
    },
    {
        // Food stall (Ape Atoll) — wiki object ID 4875
        id: "food",
        displayName: "food stall",
        locIds: [4875],
        reqLevel: 5,
        xp: 16,
        lootTable: [loot(Items.BANANA, 1, ALWAYS)],
        respawnTicks: 6,
        minDamage: 1,
        maxDamage: 1,
        stunTicks: 8,
    },
    {
        // General stall (Ape Atoll) — wiki object ID 4876
        id: "general",
        displayName: "general stall",
        locIds: [4876],
        reqLevel: 5,
        xp: 25,
        lootTable: [
            loot(Items.HAMMER, 1, 1),
            loot(Items.POT, 1, 1),
            loot(Items.TINDERBOX, 1, 1),
        ],
        respawnTicks: 8,
        minDamage: 1,
        maxDamage: 1,
        stunTicks: 8,
    },
    {
        // Silk stall (Ardougne) — wiki object ID 11729
        id: "silk",
        displayName: "silk stall",
        locIds: [11729],
        reqLevel: 20,
        xp: 24,
        lootTable: [loot(Items.SILK, 1, ALWAYS)],
        respawnTicks: 8,
        minDamage: 1,
        maxDamage: 1,
        stunTicks: 8,
    },
    {
        // Wine stall (Draynor) — wiki object ID 14011
        id: "wine",
        displayName: "wine stall",
        locIds: [14011],
        reqLevel: 22,
        xp: 27,
        lootTable: [
            loot(Items.JUG, 1, 39),
            loot(Items.JUG_OF_WATER, 1, 20),
            loot(Items.GRAPES, 1, 17),
            loot(Items.JUG_OF_WINE, 1, 13),
            loot(Items.BOTTLE_OF_WINE, 1, 11),
        ],
        respawnTicks: 8,
        minDamage: 1,
        maxDamage: 1,
        stunTicks: 8,
    },
    {
        // Fruit stall (Hosidius / Kourend Castle) — wiki object ID 28823 (27537 is empty)
        id: "fruit",
        displayName: "fruit stall",
        locIds: [28823],
        reqLevel: 25,
        xp: 28.5,
        lootTable: [
            loot(Items.COOKING_APPLE, 1, 40),
            loot(Items.BANANA, 1, 20),
            loot(Items.JANGERBERRIES, 1, 5),
            loot(Items.LEMON, 1, 5),
            loot(Items.REDBERRIES, 1, 5),
            loot(Items.PINEAPPLE, 1, 5),
            loot(Items.LIME, 1, 5),
            loot(Items.STRAWBERRY, 1, 7),
            loot(Items.STRANGE_FRUIT, 1, 5),
            loot(Items.GOLOVANOVA_FRUIT_TOP, 1, 2),
            loot(Items.PAPAYA_FRUIT, 1, 1),
        ],
        respawnTicks: 4,
        minDamage: 1,
        maxDamage: 1,
        stunTicks: 8,
    },
    {
        // Seed stall (Draynor) — wiki object ID 7053
        id: "seed",
        displayName: "seed stall",
        locIds: [7053],
        reqLevel: 27,
        xp: 10,
        lootTable: [
            loot(Items.HAMMERSTONE_SEED, 1, 120),
            loot(Items.POTATO_SEED, 1, 119),
            loot(Items.MARIGOLD_SEED, 1, 119),
            loot(Items.BARLEY_SEED, 1, 118),
            loot(Items.ONION_SEED, 1, 89),
            loot(Items.ASGARNIAN_SEED, 1, 83),
            loot(Items.CABBAGE_SEED, 1, 71),
            loot(Items.YANILLIAN_SEED, 1, 47),
            loot(Items.ROSEMARY_SEED, 1, 36),
            loot(Items.NASTURTIUM_SEED, 1, 35),
            loot(Items.TOMATO_SEED, 1, 35),
            loot(Items.JUTE_SEED, 1, 35),
            loot(Items.SWEETCORN_SEED, 1, 30),
            loot(Items.KRANDORIAN_SEED, 1, 24),
            loot(Items.STRAWBERRY_SEED, 1, 18),
            loot(Items.WILDBLOOD_SEED, 1, 12),
            loot(Items.WATERMELON_SEED, 1, 9),
        ],
        respawnTicks: 5,
        minDamage: 1,
        maxDamage: 1,
        stunTicks: 8,
    },
    {
        // Fur stall (Ardougne 11732, Rellekka 4278)
        id: "fur",
        displayName: "fur stall",
        locIds: [11732, 4278],
        reqLevel: 35,
        xp: 45,
        lootTable: [loot(Items.GREY_WOLF_FUR, 1, ALWAYS)],
        respawnTicks: 12,
        minDamage: 2,
        maxDamage: 2,
        stunTicks: 8,
    },
    {
        // Fish stall (Rellekka 4277, Miscellania 4705/4707, Warrens 31712)
        id: "fish",
        displayName: "fish stall",
        locIds: [4277, 4705, 4707, 31712],
        reqLevel: 42,
        xp: 42,
        lootTable: [
            loot(Items.RAW_SALMON, 1, 14),
            loot(Items.RAW_TUNA, 1, 5),
            loot(Items.RAW_LOBSTER, 1, 1),
        ],
        respawnTicks: 12,
        minDamage: 2,
        maxDamage: 2,
        stunTicks: 8,
    },
    {
        // Silver stall (Ardougne 11734, Keldagrim 6164)
        id: "silver",
        displayName: "silver stall",
        locIds: [11734, 6164],
        reqLevel: 50,
        xp: 205,
        lootTable: [
            loot(Items.SILVER_ORE, 1, 16),
            loot(Items.SILVER_BAR, 1, 3),
            loot(Items.TIARA, 1, 1),
        ],
        respawnTicks: 32,
        minDamage: 3,
        maxDamage: 3,
        stunTicks: 8,
    },
    {
        // Spice stall (Ardougne) — wiki object ID 11733
        id: "spice",
        displayName: "spice stall",
        locIds: [11733],
        reqLevel: 65,
        xp: 92,
        lootTable: [loot(Items.SPICE, 1, ALWAYS)],
        respawnTicks: 10,
        minDamage: 3,
        maxDamage: 3,
        stunTicks: 8,
    },
    {
        // Magic stall (Ape Atoll) — wiki object ID 4877
        id: "magic",
        displayName: "magic stall",
        locIds: [4877],
        reqLevel: 65,
        xp: 90,
        lootTable: [
            loot(Items.AIR_RUNE, 1, 6),
            loot(Items.EARTH_RUNE, 1, 6),
            loot(Items.FIRE_RUNE, 1, 6),
            loot(Items.LAW_RUNE, 1, 1),
            loot(Items.NATURE_RUNE, 1, 1),
        ],
        respawnTicks: 12,
        minDamage: 3,
        maxDamage: 3,
        stunTicks: 8,
    },
    {
        // Scimitar stall (Ape Atoll) — wiki object ID 4878
        id: "scimitar",
        displayName: "scimitar stall",
        locIds: [4878],
        reqLevel: 65,
        xp: 210,
        lootTable: [
            loot(Items.IRON_SCIMITAR, 1, 23),
            loot(Items.STEEL_SCIMITAR, 1, 13),
            loot(Items.MITHRIL_SCIMITAR, 1, 3),
            loot(Items.ADAMANT_SCIMITAR, 1, 1),
        ],
        respawnTicks: 32,
        minDamage: 3,
        maxDamage: 3,
        stunTicks: 8,
    },
    {
        // Gem stall (Ardougne 11731, Keldagrim 6162)
        id: "gem",
        displayName: "gem stall",
        locIds: [11731, 6162],
        reqLevel: 75,
        xp: 408,
        lootTable: [
            loot(Items.UNCUT_SAPPHIRE, 1, 105),
            loot(Items.UNCUT_EMERALD, 1, 17),
            loot(Items.UNCUT_RUBY, 1, 5),
            loot(Items.UNCUT_DIAMOND, 1, 1),
        ],
        respawnTicks: 100,
        minDamage: 3,
        maxDamage: 3,
        stunTicks: 8,
    },
];

const stallByLocId = new Map<number, StallDef>();
for (const def of STALLS) {
    for (const locId of def.locIds) {
        stallByLocId.set(locId, def);
    }
}

export function getStallByLocId(locId: number): StallDef | undefined {
    return stallByLocId.get(locId);
}

export { Items as StallItems };

const STALL_ACTIONS = ["steal-from", "steal from"];
const STALL_TRACKER = "thieving-stalls";
const STALL_ANIM = 832; // table-pickup (GroundItemHandler GROUND_ITEM_PICKUP_TABLE_SEQ)
const STALL_STUN_ANIM = 424;
const STALL_STUN_GFX = 245;
const STALL_STUN_GFX_HEIGHT = 124;
const STALL_SUCCESS_SOUND = 2581;
const STALL_STUN_SOUND = 2727;
const STALL_DAMAGE_SOUND = 519;
const STALL_HIT_STYLE = 16;
const EMPTY_STALL_LOC_ID = 0;

interface StallActionData {
    locId: number;
    stallId: string;
    displayName: string;
    reqLevel: number;
    xp: number;
    lootTable: StallLoot[];
    respawnTicks: number;
    minDamage: number;
    maxDamage: number;
    stunTicks: number;
    tile: { x: number; y: number };
    level: number;
    /** 0 = attempt, 1 = resolve */
    phase: number;
}

function buildMessageEffect(player: PlayerState, message: string): ActionEffect {
    return { type: "message", playerId: player.id, message };
}

function rollStallSuccess(playerLevel: number, reqLevel: number): boolean {
    const minChance = 50;
    const maxChance = 95;
    const range = 99 - reqLevel || 1;
    const chance = minChance + ((maxChance - minChance) * (playerLevel - reqLevel)) / range;
    const clamped = Math.min(maxChance, Math.max(minChance, chance));
    return Math.random() * 100 < clamped;
}

function rollStallLoot(lootTable: StallLoot[]): { itemId: number; quantity: number } | undefined {
    if (lootTable.length === 0) return undefined;
    let totalWeight = 0;
    for (const entry of lootTable) totalWeight += entry.weight;
    if (totalWeight <= 0) return undefined;

    let roll = Math.random() * totalWeight;
    for (const entry of lootTable) {
        roll -= entry.weight;
        if (roll <= 0) {
            const quantity =
                entry.minAmount === entry.maxAmount
                    ? entry.minAmount
                    : entry.minAmount +
                      Math.floor(Math.random() * (entry.maxAmount - entry.minAmount + 1));
            return { itemId: entry.itemId, quantity };
        }
    }

    const fallback = lootTable[0];
    return { itemId: fallback.itemId, quantity: fallback.minAmount };
}

function scheduleStall(
    services: ScriptServices,
    playerId: number,
    data: StallActionData,
    tick: number,
): void {
    services.combat.scheduleAction(
        playerId,
        {
            kind: "skill.steal-stall",
            data,
            delayTicks: 1,
            cooldownTicks: 1,
            groups: ["skill.steal-stall"],
        },
        tick,
    );
}

function executeStallAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as StallActionData;
    const effects: ActionEffect[] = [];
    const tile = { x: data.tile.x, y: data.tile.y };
    const plane = data.level;
    const nodeKey = buildTileKey(tile, plane);
    const tracker = services.gathering?.getTracker<{ locId: number }>(STALL_TRACKER);

    if (data.phase === 0) {
        const thievingSkill = services.skills.getSkill(player, SkillId.Thieving);
        const thievingLevel = Math.max(
            1,
            (thievingSkill?.baseLevel ?? 1) + (thievingSkill?.boost ?? 0),
        );

        if (thievingLevel < data.reqLevel) {
            effects.push(
                buildMessageEffect(
                    player,
                    `You need a Thieving level of ${data.reqLevel} to steal from this stall.`,
                ),
            );
            return { ok: true, effects };
        }

        if (services.combat.isPlayerStunned(player)) {
            effects.push(buildMessageEffect(player, "You're stunned!"));
            return { ok: true, effects };
        }

        if (services.combat.isPlayerInCombat(player)) {
            effects.push(buildMessageEffect(player, "You can't do that during combat."));
            return { ok: true, effects };
        }

        if (tracker?.has(nodeKey)) {
            effects.push(buildMessageEffect(player, "The stall has been cleared out."));
            return { ok: true, effects };
        }

        if (!services.inventory.hasInventorySlot(player)) {
            effects.push(
                buildMessageEffect(player, "You don't have enough inventory space to do that."),
            );
            return { ok: true, effects };
        }

        if (!services.location.isAdjacentToLoc(player, data.locId, tile, plane)) {
            effects.push(buildMessageEffect(player, "You can't reach that."));
            return { ok: true, effects };
        }

        services.location.faceTile(player, tile);
        services.animation.playPlayerSeq(player, STALL_ANIM);
        player.lock = LockState.FULL_WITH_ITEM_INTERACTION;
        scheduleStall(services, player.id, { ...data, phase: 1 }, tick);
        return { ok: true, cooldownTicks: 1, effects };
    }

    if (data.phase === 1) {
        const thievingSkill = services.skills.getSkill(player, SkillId.Thieving);
        const thievingLevel = Math.max(
            1,
            (thievingSkill?.baseLevel ?? 1) + (thievingSkill?.boost ?? 0),
        );

        if (tracker?.has(nodeKey)) {
            player.lock = LockState.NONE;
            effects.push(buildMessageEffect(player, "The stall has been cleared out."));
            return { ok: true, effects };
        }

        const success = rollStallSuccess(thievingLevel, data.reqLevel);
        if (success) {
            player.lock = LockState.NONE;
            services.sound.sendSound(player, STALL_SUCCESS_SOUND);

            const reward = rollStallLoot(data.lootTable);
            if (reward) {
                services.inventory.addItemToInventory(player, reward.itemId, reward.quantity);
                effects.push({ type: "inventorySnapshot", playerId: player.id });
            }

            services.skills.addSkillXp(player, SkillId.Thieving, data.xp);
            effects.push(buildMessageEffect(player, `You steal from the ${data.displayName}.`));

            tracker?.addWithRandomDuration(
                nodeKey,
                tile,
                plane,
                tick,
                { min: data.respawnTicks, max: data.respawnTicks },
                { locId: data.locId },
            );
            services.location.emitLocChange(data.locId, EMPTY_STALL_LOC_ID, tile, plane);
            return { ok: true, effects };
        }

        const damage =
            data.minDamage === data.maxDamage
                ? data.minDamage
                : data.minDamage +
                  Math.floor(Math.random() * (data.maxDamage - data.minDamage + 1));

        services.animation.playPlayerSeq(player, STALL_STUN_ANIM);
        services.animation.broadcastPlayerSpot(player, STALL_STUN_GFX, STALL_STUN_GFX_HEIGHT);
        services.sound.sendSound(player, STALL_STUN_SOUND);
        services.sound.sendSound(player, STALL_DAMAGE_SOUND);

        const hitsplat = services.combat.applyPlayerHitsplat(
            player,
            STALL_HIT_STYLE,
            damage,
            tick,
        );
        if (hitsplat) {
            effects.push({
                type: "hitsplat",
                playerId: player.id,
                targetType: "player",
                targetId: player.id,
                damage: hitsplat.amount,
                style: hitsplat.style,
                hpCurrent: hitsplat.hpCurrent,
                hpMax: hitsplat.hpMax,
                tick,
                skipAutoSound: true,
            });
        }

        effects.push(buildMessageEffect(player, `You fail to steal from the ${data.displayName}.`));
        effects.push(buildMessageEffect(player, "You've been stunned!"));
        player.lock = LockState.NONE;
        services.combat.stunPlayer(player, data.stunTicks);
    }

    return { ok: true, effects };
}

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.steal-stall", executeStallAction);

    const stallTracker = new ResourceNodeTracker<{ locId: number }>();
    services.gathering?.registerTracker(STALL_TRACKER, stallTracker, (node, gatheringSvc) => {
        gatheringSvc.emitLocChange(EMPTY_STALL_LOC_ID, node.data.locId, node.tile, node.level);
    });

    const stealHandler = (event: LocInteractionEvent) => {
        const def = stallByLocId.get(event.locId);
        if (!def) return;

        const actionData: StallActionData = {
            locId: event.locId,
            stallId: def.id,
            displayName: def.displayName,
            reqLevel: def.reqLevel,
            xp: def.xp,
            lootTable: def.lootTable,
            respawnTicks: def.respawnTicks,
            minDamage: def.minDamage,
            maxDamage: def.maxDamage,
            stunTicks: def.stunTicks,
            tile: { x: event.tile.x, y: event.tile.y },
            level: event.level,
            phase: 0,
        };

        const result = event.services.combat.requestAction(
            event.player,
            {
                kind: "skill.steal-stall",
                data: actionData,
                delayTicks: 0,
                cooldownTicks: 0,
                groups: ["skill.steal-stall"],
                rejectIfGroupPending: true,
            },
            event.tick,
        );
        if (!result.ok) {
            event.services.messaging.sendGameMessage(
                event.player,
                "You're too busy to do that right now.",
            );
        }
    };

    for (const def of STALLS) {
        for (const locId of def.locIds) {
            for (const action of STALL_ACTIONS) {
                registry.registerLocInteraction(locId, stealHandler, action);
            }
        }
    }
}
