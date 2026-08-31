import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnLocEvent,
    ItemOnLocHandler,
    LocInteractionEvent,
    LocInteractionHandler,
    ScriptActionHandler,
    ScriptActionHandlerContext,
    ScriptServices,
} from "../src/game/scripts/types";
import type { IResourceNodeTracker, TrackedNode } from "../src/game/systems/ResourceNodeTypes";
import { register } from "../gamemodes/vanilla/skills/mining";
import {
    DENSE_ESSENCE_BLOCK,
    DENSE_RUNESTONE_CHISEL,
    DENSE_RUNESTONE_LOCS,
    denseRunestonePersistChance,
    getMiningRockById,
} from "../gamemodes/vanilla/skills/mining/miningData";

const locActions = new Map<string, LocInteractionHandler>();
const locHandlers = new Map<string, LocInteractionHandler>();
const itemOnLocHandlers = new Map<string, ItemOnLocHandler>();
const actionHandlers = new Map<string, ScriptActionHandler>();

const registry = {
    registerLocAction: (action: string, handler: LocInteractionHandler) => {
        locActions.set(action, handler);
        return { unregister() {} };
    },
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerItemOnLoc: (itemId: number, locId: number, handler: ItemOnLocHandler) => {
        itemOnLocHandlers.set(`${itemId}:${locId}`, handler);
        return { unregister() {} };
    },
    registerActionHandler: (kind: string, handler: ScriptActionHandler) => {
        actionHandlers.set(kind, handler);
        return { unregister() {} };
    },
} as unknown as IScriptRegistry;

type MiningNodeData = { locId: number; depletedLocId?: number; rockId: string };

let miningTracker: IResourceNodeTracker<MiningNodeData> | undefined;
let expireCallback:
    | ((
          node: TrackedNode<MiningNodeData>,
          gatheringSvc: {
              emitLocChange: (
                  oldId: number,
                  newId: number,
                  tile: { x: number; y: number },
                  level: number,
              ) => void;
          },
      ) => void)
    | undefined;

const locChanges: Array<{
    oldId: number;
    newId: number;
    tile: { x: number; y: number };
    level: number;
}> = [];

const gathering = {
    registerTracker: (
        name: string,
        tracker: IResourceNodeTracker<MiningNodeData>,
        onExpire: NonNullable<typeof expireCallback>,
    ) => {
        assert.equal(name, "mining");
        miningTracker = tracker;
        expireCallback = onExpire;
    },
    getTracker: () => miningTracker,
};

register(registry, {
    gathering,
    data: {
        getLocTypeLoader: () => undefined,
        getObjType: () => ({ name: "Dense essence block" }),
    },
} as unknown as ScriptServices);

const dense = getMiningRockById("dense");
assert.ok(dense);
assert.equal(dense.level, 38);
assert.equal(dense.xp, 12);
assert.equal(dense.craftingLevel, 38);
assert.equal(dense.craftingXp, 8);
assert.equal(dense.oreItemId, DENSE_ESSENCE_BLOCK);
assert.equal(dense.swingTicks, 9);
assert.deepEqual(
    DENSE_RUNESTONE_LOCS.map((entry) => entry.locId),
    [8975, 8977, 8979],
);
assert.equal(DENSE_RUNESTONE_LOCS[0]?.depletedLocId, 8976);
assert(locActions.has("chip"));
assert(locHandlers.has("8975:chip"));
assert(itemOnLocHandlers.has(`1265:8975`));
assert(actionHandlers.has("skill.mine"));
assert(miningTracker, "mining tracker should register with gathering");
assert(denseRunestonePersistChance(38) > 0.8);
assert(denseRunestonePersistChance(99) > denseRunestonePersistChance(38));

const BRONZE_PICKAXE = 1265;

function makeSession(opts: {
    mining: number;
    crafting: number;
    items?: number[];
    adjacent?: boolean;
    inventoryFull?: boolean;
}) {
    const xp: Array<{ skillId: number; amount: number }> = [];
    const added: Array<{ itemId: number; quantity: number }> = [];
    const messages: string[] = [];
    let pending: { kind: string; data: unknown } | undefined;
    const carried = opts.items ?? [BRONZE_PICKAXE, DENSE_RUNESTONE_CHISEL];

    const player = { id: 4 } as PlayerState;
    const services = {
        gathering,
        data: {
            getObjType: () => ({ name: "Dense essence block" }),
        },
        skills: {
            getSkill: (_p: PlayerState, skillId: number) => {
                if (skillId === SkillId.Crafting) return { baseLevel: opts.crafting, boost: 0 };
                return { baseLevel: opts.mining, boost: 0 };
            },
            addSkillXp: (_p: PlayerState, skillId: number, amount: number) => {
                xp.push({ skillId, amount });
            },
        },
        inventory: {
            collectCarriedItemIds: () => carried,
            playerHasItem: (_p: PlayerState, itemId: number) => carried.includes(itemId),
            hasInventorySlot: () => !opts.inventoryFull,
            addItemToInventory: (_p: PlayerState, itemId: number, quantity: number) => {
                added.push({ itemId, quantity });
                return { slot: 0, added: quantity };
            },
        },
        equipment: {
            getEquippedItem: () => 0,
        },
        location: {
            isAdjacentToLoc: () => opts.adjacent !== false,
            faceTile: () => undefined,
            emitLocChange: (
                oldId: number,
                newId: number,
                tile: { x: number; y: number },
                level: number,
            ) => {
                locChanges.push({ oldId, newId, tile, level });
            },
        },
        animation: {
            playPlayerSeq: () => undefined,
        },
        combat: {
            requestAction: (_p: PlayerState, request: { kind: string; data: unknown }) => {
                pending = request;
                return { ok: true };
            },
            scheduleAction: (_playerId: number, request: { kind: string; data: unknown }) => {
                pending = request;
                return { ok: true };
            },
        },
        messaging: {
            sendGameMessage: (_p: PlayerState, text: string) => messages.push(text),
        },
    } as unknown as ScriptServices;

    const runChip = (locId = 8975, tile = { x: 1762, y: 3856 }) => {
        locHandlers.get(`${locId}:chip`)!({
            player,
            locId,
            tile,
            level: 0,
            action: "chip",
            tick: 10,
            services,
        } as LocInteractionEvent);
    };

    const runPickaxeOnLoc = (locId = 8975, tile = { x: 1762, y: 3856 }) => {
        itemOnLocHandlers.get(`${BRONZE_PICKAXE}:${locId}`)!({
            player,
            source: { slot: 0, itemId: BRONZE_PICKAXE },
            target: { locId, tile, level: 0 },
            tick: 10,
            services,
        } as ItemOnLocEvent);
    };

    const runPending = (tick = 10) => {
        assert(pending, "expected a queued mine action");
        const execute = actionHandlers.get(pending.kind);
        assert(execute, `expected action handler for ${pending.kind}`);
        return execute({
            player,
            data: pending.data,
            tick,
            services,
        } as ScriptActionHandlerContext);
    };

    return { player, xp, added, messages, runChip, runPickaxeOnLoc, runPending };
}

function effectText(result: { effects?: Array<{ type: string; message?: string }> }): string[] {
    return (result.effects ?? [])
        .filter((effect) => effect.type === "message" && typeof effect.message === "string")
        .map((effect) => effect.message as string);
}

function mineOnce(session: ReturnType<typeof makeSession>) {
    session.runChip();
    session.runPending();
    return session.runPending(19);
}

const originalRandom = Math.random;
function withRandom(value: number, fn: () => void): void {
    Math.random = () => value;
    try {
        fn();
    } finally {
        Math.random = originalRandom;
    }
}

const lowMining = makeSession({ mining: 37, crafting: 99 });
assert(effectText(mineOnce(lowMining)).some((m) => /Mining level 38/.test(m)));
assert.equal(lowMining.xp.length, 0);

const lowCrafting = makeSession({ mining: 99, crafting: 37 });
assert(effectText(mineOnce(lowCrafting)).some((m) => /Crafting level 38/.test(m)));
assert.equal(lowCrafting.xp.length, 0);

const noChisel = makeSession({ mining: 38, crafting: 38, items: [BRONZE_PICKAXE] });
assert(effectText(mineOnce(noChisel)).some((m) => /chisel/.test(m)));
assert.equal(noChisel.xp.length, 0);

locChanges.length = 0;
withRandom(0, () => {
    const persist = makeSession({ mining: 38, crafting: 38 });
    mineOnce(persist);
    assert.deepEqual(persist.added, [{ itemId: DENSE_ESSENCE_BLOCK, quantity: 1 }]);
    assert.deepEqual(persist.xp, [
        { skillId: SkillId.Mining, amount: 12 },
        { skillId: SkillId.Crafting, amount: 8 },
    ]);
    assert.equal(locChanges.length, 0);
    assert.equal(miningTracker?.has("0:1762:3856"), false);
});

locChanges.length = 0;
withRandom(0.99, () => {
    const deplete = makeSession({ mining: 38, crafting: 38 });
    mineOnce(deplete);
    assert.deepEqual(deplete.added, [{ itemId: DENSE_ESSENCE_BLOCK, quantity: 1 }]);
    assert.deepEqual(locChanges[0], {
        oldId: 8975,
        newId: 8976,
        tile: { x: 1762, y: 3856 },
        level: 0,
    });
    assert(miningTracker?.has("0:1762:3856"));
    const depleted = makeSession({ mining: 38, crafting: 38 });
    assert(effectText(mineOnce(depleted)).some((m) => /depleted/.test(m)));
    assert.equal(depleted.xp.length, 0);
});

locChanges.length = 0;
miningTracker?.processExpired(100, (node) => {
    expireCallback?.(node, {
        emitLocChange: (oldId, newId, tile, level) => {
            locChanges.push({ oldId, newId, tile, level });
        },
    });
});
assert.deepEqual(locChanges[0], {
    oldId: 8976,
    newId: 8975,
    tile: { x: 1762, y: 3856 },
    level: 0,
});

withRandom(0, () => {
    const pickaxeUse = makeSession({ mining: 38, crafting: 38 });
    pickaxeUse.runPickaxeOnLoc(8977, { x: 1762, y: 3844 });
    pickaxeUse.runPending();
    pickaxeUse.runPending(19);
    assert.deepEqual(pickaxeUse.added, [{ itemId: DENSE_ESSENCE_BLOCK, quantity: 1 }]);
});

console.log("mining-dense-essence.test.ts: all assertions passed");
