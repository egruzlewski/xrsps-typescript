import assert from "node:assert/strict";

import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    ItemOnItemHandler,
    ItemOnLocHandler,
    LocInteractionHandler,
    NpcInteractionEvent,
    NpcInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import { PURE_ESSENCE, RUNE_ESSENCE } from "../gamemodes/vanilla/skills/runecrafting/altars";
import { register } from "../gamemodes/vanilla/skills/runecrafting";
import {
    COLOSSAL_POUCH,
    DARK_MAGE_NPC_ID,
    ESSENCE_POUCHES,
    ESSENCE_TYPE_RUNE,
    GIANT_POUCH,
    LARGE_POUCH,
    MEDIUM_POUCH,
    MEDIUM_POUCH_DEGRADED,
    SMALL_POUCH,
    colossalCapacityForLevel,
    colossalUsesForLevel,
    packPouchCharges,
    pouchCapacity,
    pouchDefForItem,
} from "../gamemodes/vanilla/skills/runecrafting/pouches";

const locHandlers = new Map<string, LocInteractionHandler>();
const itemOnLocHandlers = new Map<string, ItemOnLocHandler>();
const itemActions = new Map<string, ItemOnItemHandler>();
const itemOnItemHandlers = new Map<string, ItemOnItemHandler>();
const npcHandlers = new Map<string, NpcInteractionHandler>();

const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerItemOnLoc: (itemId: number, locId: number, handler: ItemOnLocHandler) => {
        itemOnLocHandlers.set(`${itemId}:${locId}`, handler);
        return { unregister() {} };
    },
    registerItemAction: (itemId: number, handler: ItemOnItemHandler, option?: string) => {
        itemActions.set(`${itemId}:${option ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerItemOnItem: (
        sourceItemId: number,
        targetItemId: number,
        handler: ItemOnItemHandler,
    ) => {
        itemOnItemHandlers.set(`${sourceItemId}:${targetItemId}`, handler);
        return { unregister() {} };
    },
    registerNpcInteraction: (
        npcId: number,
        handler: NpcInteractionHandler,
        option?: string,
    ) => {
        npcHandlers.set(`${npcId}:${option ?? "*"}`, handler);
        return { unregister() {} };
    },
} as unknown as IScriptRegistry;

register(registry);

assert.equal(ESSENCE_POUCHES.length, 5);
assert.equal(pouchDefForItem(SMALL_POUCH)?.capacity, 3);
assert.equal(pouchCapacity(pouchDefForItem(MEDIUM_POUCH)!, 25, false), 6);
assert.equal(pouchCapacity(pouchDefForItem(MEDIUM_POUCH)!, 25, true), 3);
assert.equal(pouchCapacity(pouchDefForItem(LARGE_POUCH)!, 50, true), 7);
assert.equal(pouchCapacity(pouchDefForItem(GIANT_POUCH)!, 75, true), 9);
assert.equal(colossalCapacityForLevel(25), 8);
assert.equal(colossalCapacityForLevel(50), 16);
assert.equal(colossalCapacityForLevel(75), 27);
assert.equal(colossalCapacityForLevel(85), 40);
assert.equal(colossalUsesForLevel(85), 8);
assert.equal(colossalUsesForLevel(25), 40);

for (const def of ESSENCE_POUCHES) {
    assert(itemActions.has(`${def.itemId}:fill`));
    assert(itemActions.has(`${def.itemId}:empty`));
    assert(itemActions.has(`${def.itemId}:check`));
    assert(itemOnItemHandlers.has(`${RUNE_ESSENCE}:${def.itemId}`));
    assert(itemOnItemHandlers.has(`${PURE_ESSENCE}:${def.itemId}`));
    if (def.degradedItemId != null) {
        assert(itemActions.has(`${def.degradedItemId}:fill`));
        assert(itemOnItemHandlers.has(`${RUNE_ESSENCE}:${def.degradedItemId}`));
    }
}
assert(npcHandlers.has(`${DARK_MAGE_NPC_ID}:repairs`));
assert(npcHandlers.has(`${DARK_MAGE_NPC_ID}:talk-to`));

type Counts = Map<number, number>;

function makePlayer(opts: {
    level: number;
    items?: Record<number, number>;
    charges?: Record<number, number>;
    freeSlots?: number;
    inventory?: Array<{ slot: number; itemId: number; quantity: number }>;
}) {
    const counts: Counts = new Map(
        Object.entries(opts.items ?? {}).map(([id, qty]) => [Number(id), qty]),
    );
    const chargeMap = new Map(
        Object.entries(opts.charges ?? {}).map(([id, qty]) => [Number(id), qty]),
    );
    const messages: string[] = [];
    const snapshots: number[] = [];
    const slotSwaps: Array<{ slot: number; itemId: number }> = [];
    const inventory = opts.inventory ?? [];
    const player = {
        id: 9,
        items: {
            getItemCount: (itemId: number) => counts.get(itemId) ?? 0,
            removeItem: (itemId: number, amount: number) => {
                counts.set(itemId, Math.max(0, (counts.get(itemId) ?? 0) - amount));
            },
            addItem: (itemId: number, amount: number) => {
                counts.set(itemId, (counts.get(itemId) ?? 0) + amount);
                return { requested: amount, completed: amount, slots: [] };
            },
            getFreeSlotCount: () => opts.freeSlots ?? 28,
        },
        equipment: {
            getCharges: (itemId: number) => chargeMap.get(itemId) ?? 0,
            setCharges: (itemId: number, charges: number) => {
                if (charges <= 0) chargeMap.delete(itemId);
                else chargeMap.set(itemId, charges);
            },
        },
    } as unknown as PlayerState;

    const services = {
        messaging: {
            sendGameMessage: (_p: PlayerState, text: string) => messages.push(text),
        },
        skills: {
            getSkill: () => ({ baseLevel: opts.level, boost: 99 }),
        },
        inventory: {
            snapshotInventory: () => {
                snapshots.push(1);
            },
            setInventorySlot: (_p: PlayerState, slot: number, itemId: number) => {
                slotSwaps.push({ slot, itemId });
                const entry = inventory.find((row) => row.slot === slot);
                if (entry) entry.itemId = itemId;
            },
            getInventoryItems: () => inventory,
        },
    } as unknown as ScriptServices;

    return { player, services, messages, snapshots, counts, chargeMap, slotSwaps, inventory };
}

function act(itemId: number, option: string, session: ReturnType<typeof makePlayer>, slot = 0) {
    itemActions.get(`${itemId}:${option}`)!({
        player: session.player,
        source: { slot, itemId },
        target: { slot: -1, itemId: -1 },
        option,
        tick: 1,
        services: session.services,
    } as ItemOnItemEvent);
}

const tooLow = makePlayer({ level: 1, items: { [RUNE_ESSENCE]: 6 } });
act(MEDIUM_POUCH, "fill", tooLow);
assert.equal(tooLow.messages[0], "You need a Runecrafting level of at least 25 to use this pouch.");
assert.equal(tooLow.counts.get(RUNE_ESSENCE), 6);

const fillSmall = makePlayer({ level: 1, items: { [RUNE_ESSENCE]: 10 } });
act(SMALL_POUCH, "fill", fillSmall);
assert.equal(fillSmall.counts.get(RUNE_ESSENCE), 7);
assert.equal(fillSmall.messages[0], "You fill the pouch with essence.");
act(SMALL_POUCH, "check", fillSmall);
assert.equal(fillSmall.messages[1], "There are 3 essences in this pouch.");
act(SMALL_POUCH, "fill", fillSmall);
assert.equal(fillSmall.messages[2], "The pouch is already full.");
assert.equal(fillSmall.counts.get(RUNE_ESSENCE), 7);

const emptySmall = makePlayer({
    level: 1,
    items: { [RUNE_ESSENCE]: 0 },
    charges: {
        [SMALL_POUCH]: packPouchCharges({
            count: 3,
            essenceType: ESSENCE_TYPE_RUNE,
            usesRemaining: 0,
            degraded: false,
        }),
    },
    freeSlots: 3,
});
act(SMALL_POUCH, "empty", emptySmall);
assert.equal(emptySmall.counts.get(RUNE_ESSENCE), 3);
assert.equal(emptySmall.messages[0], "You empty the pouch.");
assert.equal(emptySmall.chargeMap.get(SMALL_POUCH), undefined);

const noSpace = makePlayer({
    level: 1,
    charges: {
        [SMALL_POUCH]: packPouchCharges({
            count: 3,
            essenceType: ESSENCE_TYPE_RUNE,
            usesRemaining: 0,
            degraded: false,
        }),
    },
    freeSlots: 1,
});
act(SMALL_POUCH, "empty", noSpace);
assert.equal(
    noSpace.messages[0],
    "You do not have enough space in your inventory to empty the pouch.",
);

const noEssence = makePlayer({ level: 1 });
act(SMALL_POUCH, "fill", noEssence);
assert.equal(noEssence.messages[0], "You do not have any essence to fill the pouch.");

const mix = makePlayer({
    level: 1,
    items: { [PURE_ESSENCE]: 3 },
    charges: {
        [SMALL_POUCH]: packPouchCharges({
            count: 1,
            essenceType: ESSENCE_TYPE_RUNE,
            usesRemaining: 0,
            degraded: false,
        }),
    },
});
act(SMALL_POUCH, "fill", mix);
assert.equal(mix.messages[0], "You cannot add a different type of essence to this pouch.");
assert.equal(mix.counts.get(PURE_ESSENCE), 3);

const pureFill = makePlayer({ level: 1, items: { [PURE_ESSENCE]: 2 } });
act(SMALL_POUCH, "fill", pureFill);
assert.equal(pureFill.counts.get(PURE_ESSENCE), 0);
act(SMALL_POUCH, "empty", pureFill);
assert.equal(pureFill.counts.get(PURE_ESSENCE), 2);

const useOnPouch = makePlayer({ level: 25, items: { [RUNE_ESSENCE]: 8 } });
itemOnItemHandlers.get(`${RUNE_ESSENCE}:${MEDIUM_POUCH}`)!({
    player: useOnPouch.player,
    source: { slot: 1, itemId: RUNE_ESSENCE },
    target: { slot: 0, itemId: MEDIUM_POUCH },
    tick: 1,
    services: useOnPouch.services,
} as ItemOnItemEvent);
assert.equal(useOnPouch.counts.get(RUNE_ESSENCE), 2);

const degrade = makePlayer({
    level: 25,
    items: { [RUNE_ESSENCE]: 6 },
    charges: {
        [MEDIUM_POUCH]: packPouchCharges({
            count: 0,
            essenceType: 0,
            usesRemaining: 1,
            degraded: false,
        }),
    },
});
act(MEDIUM_POUCH, "fill", degrade, 4);
assert.equal(degrade.messages[0], "You fill the pouch with essence.");
assert.equal(degrade.messages[1], "Your pouch has decayed through use.");
assert.deepEqual(degrade.slotSwaps[0], { slot: 4, itemId: MEDIUM_POUCH_DEGRADED });
const degradedPacked = degrade.chargeMap.get(MEDIUM_POUCH)!;
assert.ok(degradedPacked > 0);

const alreadyDegraded = makePlayer({
    level: 25,
    items: { [RUNE_ESSENCE]: 6 },
    charges: {
        [MEDIUM_POUCH]: packPouchCharges({
            count: 0,
            essenceType: 0,
            usesRemaining: 0,
            degraded: true,
        }),
    },
});
act(MEDIUM_POUCH_DEGRADED, "fill", alreadyDegraded);
assert.equal(alreadyDegraded.counts.get(RUNE_ESSENCE), 3);
assert.equal(alreadyDegraded.messages.length, 1);
assert(!alreadyDegraded.messages.includes("Your pouch has decayed through use."));

const colossalLow = makePlayer({ level: 24, items: { [PURE_ESSENCE]: 8 } });
act(COLOSSAL_POUCH, "fill", colossalLow);
assert.equal(
    colossalLow.messages[0],
    "You need a Runecrafting level of at least 25 to use this pouch.",
);

const colossalFill = makePlayer({ level: 25, items: { [PURE_ESSENCE]: 20 } });
act(COLOSSAL_POUCH, "fill", colossalFill);
assert.equal(colossalFill.counts.get(PURE_ESSENCE), 12);

const colossalHigh = makePlayer({ level: 85, items: { [PURE_ESSENCE]: 40 } });
act(COLOSSAL_POUCH, "fill", colossalHigh);
assert.equal(colossalHigh.counts.get(PURE_ESSENCE), 0);

const mageNone = makePlayer({ level: 50 });
npcHandlers.get(`${DARK_MAGE_NPC_ID}:repairs`)!({
    player: mageNone.player,
    npc: { id: 1, typeId: DARK_MAGE_NPC_ID, name: "Dark Mage" } as never,
    option: "repairs",
    tick: 1,
    services: mageNone.services,
} as NpcInteractionEvent);
assert.equal(
    mageNone.messages[0],
    "You don't seem to have any pouches in need of repair. Leave me alone!",
);

const mageRepair = makePlayer({
    level: 25,
    items: { [RUNE_ESSENCE]: 10 },
    charges: {
        [MEDIUM_POUCH]: packPouchCharges({
            count: 2,
            essenceType: ESSENCE_TYPE_RUNE,
            usesRemaining: 0,
            degraded: true,
        }),
    },
    inventory: [{ slot: 3, itemId: MEDIUM_POUCH_DEGRADED, quantity: 1 }],
});
npcHandlers.get(`${DARK_MAGE_NPC_ID}:talk-to`)!({
    player: mageRepair.player,
    npc: { id: 2, typeId: DARK_MAGE_NPC_ID, name: "Dark Mage" } as never,
    option: "talk-to",
    tick: 1,
    services: mageRepair.services,
} as NpcInteractionEvent);
assert.equal(
    mageRepair.messages[0],
    "There, I have repaired your pouches. Now leave me alone. I'm concentrating!",
);
assert.deepEqual(mageRepair.slotSwaps[0], { slot: 3, itemId: MEDIUM_POUCH });
act(MEDIUM_POUCH, "fill", mageRepair);
assert.equal(mageRepair.counts.get(RUNE_ESSENCE), 6);

console.log("runecrafting-pouches.test.ts: all assertions passed");
