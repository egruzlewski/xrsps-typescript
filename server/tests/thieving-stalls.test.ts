import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { LockState } from "../src/game/model/LockState";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    LocInteractionHandler,
    ScriptActionHandler,
    ScriptActionHandlerContext,
    ScriptServices,
} from "../src/game/scripts/types";
import type { IResourceNodeTracker, TrackedNode } from "../src/game/systems/ResourceNodeTypes";
import {
    STALLS,
    StallItems,
    getStallByLocId,
    register,
} from "../gamemodes/vanilla/skills/thieving/stalls";

const locHandlers = new Map<string, LocInteractionHandler>();
const actionHandlers = new Map<string, ScriptActionHandler>();
const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerActionHandler: (kind: string, handler: ScriptActionHandler) => {
        actionHandlers.set(kind, handler);
        return { unregister() {} };
    },
} as unknown as IScriptRegistry;

const locChanges: Array<{
    oldId: number;
    newId: number;
    tile: { x: number; y: number };
    level: number;
}> = [];

let stallTracker: IResourceNodeTracker<{ locId: number }> | undefined;
let expireCallback:
    | ((
          node: TrackedNode<{ locId: number }>,
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

const gathering = {
    registerTracker: (
        name: string,
        tracker: IResourceNodeTracker<{ locId: number }>,
        onExpire: NonNullable<typeof expireCallback>,
    ) => {
        assert.equal(name, "thieving-stalls");
        stallTracker = tracker;
        expireCallback = onExpire;
    },
    getTracker: () => stallTracker,
};

register(registry, { gathering } as unknown as ScriptServices);

assert.equal(STALLS.length, 17);
assert.equal(getStallByLocId(11730)?.id, "baker");
assert.equal(getStallByLocId(635)?.id, "tea");
assert.equal(getStallByLocId(11731)?.reqLevel, 75);
assert.equal(getStallByLocId(7053)?.id, "seed");
assert.equal(getStallByLocId(28823)?.id, "fruit");
assert.equal(getStallByLocId(4875)?.id, "food");
assert.equal(getStallByLocId(4876)?.id, "general");
assert.equal(getStallByLocId(4877)?.id, "magic");
assert.equal(getStallByLocId(4878)?.id, "scimitar");
assert.equal(getStallByLocId(27537), undefined);
assert(locHandlers.has("11730:steal-from"));
assert(locHandlers.has("635:steal from"));
assert(locHandlers.has("7053:steal-from"));
assert(locHandlers.has("28823:steal-from"));
assert(locHandlers.has("4875:steal from"));
assert(actionHandlers.has("skill.steal-stall"));
assert(stallTracker, "stall tracker should register with gathering");

function handler(locId: number, action = "steal-from"): LocInteractionHandler {
    const found = locHandlers.get(`${locId}:${action}`);
    assert(found, `expected loc handler for ${locId} action=${action}`);
    return found;
}

function makeSession(opts: {
    level: number;
    stunned?: boolean;
    inCombat?: boolean;
    inventoryFull?: boolean;
    adjacent?: boolean;
}) {
    const xp: number[] = [];
    const added: Array<{ itemId: number; quantity: number }> = [];
    const seqs: number[] = [];
    const sounds: number[] = [];
    const stuns: number[] = [];
    const hitsplats: number[] = [];
    let pending: { kind: string; data: unknown } | undefined;

    const player = {
        id: 4,
        lock: LockState.NONE,
        tileX: 2662,
        tileY: 3311,
        level: 0,
    } as PlayerState;

    const services = {
        gathering,
        skills: {
            getSkill: () => ({ baseLevel: opts.level, boost: 0 }),
            addSkillXp: (_p: PlayerState, skillId: number, amount: number) => {
                assert.equal(skillId, SkillId.Thieving);
                xp.push(amount);
            },
        },
        inventory: {
            hasInventorySlot: () => !opts.inventoryFull,
            addItemToInventory: (_p: PlayerState, itemId: number, quantity: number) => {
                added.push({ itemId, quantity });
                return { slot: 0, added: quantity };
            },
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
            playPlayerSeq: (_p: PlayerState, seqId: number) => {
                seqs.push(seqId);
            },
            broadcastPlayerSpot: () => undefined,
        },
        sound: {
            sendSound: (_p: PlayerState, soundId: number) => {
                sounds.push(soundId);
            },
        },
        combat: {
            isPlayerStunned: () => !!opts.stunned,
            isPlayerInCombat: () => !!opts.inCombat,
            requestAction: (_p: PlayerState, request: { kind: string; data: unknown }) => {
                pending = request;
                return { ok: true };
            },
            scheduleAction: (_playerId: number, request: { kind: string; data: unknown }) => {
                pending = request;
                return { ok: true };
            },
            applyPlayerHitsplat: (_p: PlayerState, _style: number, damage: number) => {
                hitsplats.push(damage);
                return { amount: damage, style: 16, hpCurrent: 10 - damage, hpMax: 10 };
            },
            stunPlayer: (_p: PlayerState, ticks: number) => {
                stuns.push(ticks);
            },
        },
        messaging: {
            sendGameMessage: () => undefined,
        },
    } as unknown as ScriptServices;

    const runLoc = (locId: number, tile = { x: 2662, y: 3311 }, action = "steal-from") => {
        handler(locId, action)({
            player,
            locId,
            tile,
            level: 0,
            action,
            tick: 50,
            services,
        } as LocInteractionEvent);
    };

    const runPending = (tick = 50) => {
        assert(pending, "expected a queued stall action");
        const execute = actionHandlers.get(pending.kind);
        assert(execute, `expected action handler for ${pending.kind}`);
        return execute({
            player,
            data: pending.data,
            tick,
            services,
        } as ScriptActionHandlerContext);
    };

    return { player, xp, added, seqs, sounds, stuns, hitsplats, runLoc, runPending };
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

const baker = getStallByLocId(11730)!;
const tea = getStallByLocId(635)!;

const low = makeSession({ level: 1 });
low.runLoc(11730);
const lowOut = low.runPending();
assert(lowOut.effects?.some((e) => e.type === "message" && /level of 5/.test(e.message)));
assert.equal(low.xp.length, 0);

const stunned = makeSession({ level: 99, stunned: true });
stunned.runLoc(11730);
const stunnedOut = stunned.runPending();
assert(stunnedOut.effects?.some((e) => e.type === "message" && e.message === "You're stunned!"));
assert.equal(stunned.xp.length, 0);

const full = makeSession({ level: 99, inventoryFull: true });
full.runLoc(11730);
const fullOut = full.runPending();
assert(fullOut.effects?.some((e) => e.type === "message" && /inventory space/.test(e.message)));

const combat = makeSession({ level: 99, inCombat: true });
combat.runLoc(11730);
const combatOut = combat.runPending();
assert(combatOut.effects?.some((e) => e.type === "message" && /during combat/.test(e.message)));

locChanges.length = 0;
withRandom(0, () => {
    const ok = makeSession({ level: 99 });
    ok.runLoc(11730);
    ok.runPending();
    const resolved = ok.runPending(51);
    assert.deepEqual(ok.xp, [baker.xp]);
    assert.equal(ok.added.length, 1);
    assert(baker.lootTable.some((entry) => entry.itemId === ok.added[0].itemId));
    assert.equal(ok.added[0].quantity, 1);
    assert(ok.seqs.includes(832));
    assert(ok.sounds.includes(2581));
    assert.equal(ok.player.lock, LockState.NONE);
    assert(
        resolved.effects?.some(
            (e) => e.type === "message" && /steal from the baker's stall/.test(e.message),
        ),
    );
    assert.deepEqual(locChanges[0], {
        oldId: 11730,
        newId: 0,
        tile: { x: 2662, y: 3311 },
        level: 0,
    });
    assert(stallTracker?.has("0:2662:3311"));
});

const depleted = makeSession({ level: 99 });
depleted.runLoc(11730);
const depletedOut = depleted.runPending();
assert(depletedOut.effects?.some((e) => e.type === "message" && /cleared out/.test(e.message)));

locChanges.length = 0;
stallTracker?.processExpired(51 + baker.respawnTicks, (node) => {
    expireCallback?.(node, {
        emitLocChange: (oldId, newId, tile, level) => {
            locChanges.push({ oldId, newId, tile, level });
        },
    });
});
assert.deepEqual(locChanges[0], {
    oldId: 0,
    newId: 11730,
    tile: { x: 2662, y: 3311 },
    level: 0,
});
assert.equal(stallTracker?.has("0:2662:3311"), false);

withRandom(0.999, () => {
    const fail = makeSession({ level: 5 });
    fail.runLoc(11730);
    fail.runPending();
    const failOut = fail.runPending(51);
    assert.equal(fail.xp.length, 0);
    assert.equal(fail.added.length, 0);
    assert.deepEqual(fail.stuns, [8]);
    assert.deepEqual(fail.hitsplats, [1]);
    assert(fail.seqs.includes(424));
    assert(failOut.effects?.some((e) => e.type === "message" && /fail to steal/.test(e.message)));
    assert(
        failOut.effects?.some((e) => e.type === "message" && e.message === "You've been stunned!"),
    );
});

withRandom(0, () => {
    const silk = makeSession({ level: 20 });
    silk.runLoc(11729, { x: 2662, y: 3314 });
    silk.runPending();
    silk.runPending(51);
    assert.deepEqual(silk.added, [{ itemId: StallItems.SILK, quantity: 1 }]);
    assert.deepEqual(silk.xp, [24]);
});

withRandom(0, () => {
    const teaSession = makeSession({ level: 5 });
    teaSession.runLoc(635, { x: 3269, y: 3410 }, "steal from");
    teaSession.runPending();
    teaSession.runPending(51);
    assert.deepEqual(teaSession.added, [{ itemId: StallItems.CUP_OF_TEA, quantity: 1 }]);
    assert.deepEqual(teaSession.xp, [tea.xp]);
});

withRandom(0, () => {
    const fruit = makeSession({ level: 25 });
    fruit.runLoc(28823, { x: 1795, y: 3607 });
    fruit.runPending();
    fruit.runPending(51);
    assert.deepEqual(fruit.xp, [28.5]);
    assert.equal(fruit.added.length, 1);
    assert(getStallByLocId(28823)!.lootTable.some((entry) => entry.itemId === fruit.added[0].itemId));
});

withRandom(0, () => {
    const seed = makeSession({ level: 27 });
    seed.runLoc(7053, { x: 3075, y: 3249 });
    seed.runPending();
    seed.runPending(51);
    assert.deepEqual(seed.xp, [10]);
    assert.deepEqual(seed.added, [{ itemId: StallItems.HAMMERSTONE_SEED, quantity: 1 }]);
});

withRandom(0, () => {
    const food = makeSession({ level: 5 });
    food.runLoc(4875, { x: 2768, y: 2789 });
    food.runPending();
    food.runPending(51);
    assert.deepEqual(food.added, [{ itemId: StallItems.BANANA, quantity: 1 }]);
    assert.deepEqual(food.xp, [16]);
});

const gem = getStallByLocId(11731)!;
assert.equal(gem.xp, 408);
assert.equal(gem.respawnTicks, 100);

const seedDef = getStallByLocId(7053)!;
assert.equal(seedDef.reqLevel, 27);
assert.equal(seedDef.respawnTicks, 5);
assert.equal(seedDef.lootTable.length, 17);

const fruitDef = getStallByLocId(28823)!;
assert.equal(fruitDef.reqLevel, 25);
assert.equal(fruitDef.respawnTicks, 4);
assert.equal(fruitDef.xp, 28.5);

assert.equal(getStallByLocId(4878)?.xp, 210);
assert.equal(getStallByLocId(4877)?.xp, 90);
assert.equal(getStallByLocId(4876)?.xp, 25);
assert.deepEqual(
    gem.lootTable.map((e) => e.itemId),
    [
        StallItems.UNCUT_SAPPHIRE,
        StallItems.UNCUT_EMERALD,
        StallItems.UNCUT_RUBY,
        StallItems.UNCUT_DIAMOND,
    ],
);

console.log("thieving-stalls.test.ts: all assertions passed");
