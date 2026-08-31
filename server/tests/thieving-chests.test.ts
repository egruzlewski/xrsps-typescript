import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import { LockState } from "../src/game/model/LockState";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnLocEvent,
    LocInteractionEvent,
    LocInteractionHandler,
    ScriptActionHandler,
    ScriptActionHandlerContext,
    ScriptServices,
} from "../src/game/scripts/types";
import type { IResourceNodeTracker } from "../src/game/systems/ResourceNodeTypes";
import {
    CHESTS,
    ChestItems,
    LOCKPICK_ITEM_ID,
    computeChestTrapDamage,
    getChestByLocId,
    register,
} from "../gamemodes/vanilla/skills/thieving/chests";

const locHandlers = new Map<string, LocInteractionHandler>();
const itemOnLocHandlers = new Map<string, (event: ItemOnLocEvent) => void>();
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
    registerItemOnLoc: (
        sourceItemId: number,
        locId: number,
        handler: (event: ItemOnLocEvent) => void,
    ) => {
        itemOnLocHandlers.set(`${sourceItemId}:${locId}`, handler);
        return { unregister() {} };
    },
} as unknown as IScriptRegistry;

let chestTracker: IResourceNodeTracker<{ locId: number }> | undefined;

const gathering = {
    registerTracker: (name: string, tracker: IResourceNodeTracker<{ locId: number }>) => {
        assert.equal(name, "thieving-chests");
        chestTracker = tracker;
    },
    getTracker: () => chestTracker,
};

register(registry, { gathering } as unknown as ScriptServices);

assert.equal(CHESTS.length, 8);
assert.equal(getChestByLocId(11735)?.id, "coins-10");
assert.equal(getChestByLocId(11736)?.reqLevel, 28);
assert.equal(getChestByLocId(11737)?.xp, 125);
assert.equal(getChestByLocId(11742)?.requiresLockpick, true);
assert.equal(getChestByLocId(22697)?.id, "dorgesh-average");
assert.equal(getChestByLocId(11738)?.xp, 250);
assert.equal(getChestByLocId(11739)?.reqLevel, 72);
assert.equal(getChestByLocId(22681)?.xp, 650);
assert(locHandlers.has("11736:search for traps"));
assert(locHandlers.has("11736:open"));
assert(locHandlers.has("22697:pick-lock"));
assert(actionHandlers.has("skill.steal-chest"));
assert(itemOnLocHandlers.has(`${LOCKPICK_ITEM_ID}:11742`));
assert(chestTracker, "chest tracker should register with gathering");

assert.equal(computeChestTrapDamage({ kind: "percent", numerator: 12, plus: 3 }, 50), 9);
assert.equal(computeChestTrapDamage({ kind: "chaos-druid" }, 99), 22);

function handler(locId: number, action: string): LocInteractionHandler {
    const found = locHandlers.get(`${locId}:${action}`);
    assert(found, `expected loc handler for ${locId} action=${action}`);
    return found;
}

function makeSession(opts: {
    level: number;
    hp?: number;
    stunned?: boolean;
    inCombat?: boolean;
    inventoryFull?: boolean;
    adjacent?: boolean;
    hasLockpick?: boolean;
}) {
    const xp: number[] = [];
    const added: Array<{ itemId: number; quantity: number }> = [];
    const seqs: number[] = [];
    const sounds: number[] = [];
    const hitsplats: number[] = [];
    const teleports: Array<{ x: number; y: number; level: number }> = [];
    let pending: { kind: string; data: unknown } | undefined;

    const player = {
        id: 7,
        lock: LockState.NONE,
        tileX: 2673,
        tileY: 3307,
        level: 0,
        skillSystem: {
            getHitpointsCurrent: () => opts.hp ?? 50,
        },
    } as unknown as PlayerState;

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
            playerHasItem: (_p: PlayerState, itemId: number) =>
                !!opts.hasLockpick && itemId === LOCKPICK_ITEM_ID,
            addItemToInventory: (_p: PlayerState, itemId: number, quantity: number) => {
                added.push({ itemId, quantity });
                return { slot: 0, added: quantity };
            },
        },
        location: {
            isAdjacentToLoc: () => opts.adjacent !== false,
            faceTile: () => undefined,
        },
        animation: {
            playPlayerSeq: (_p: PlayerState, seqId: number) => {
                seqs.push(seqId);
            },
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
                return { amount: damage, style: 16, hpCurrent: (opts.hp ?? 50) - damage, hpMax: 50 };
            },
        },
        movement: {
            teleportPlayer: (
                _p: PlayerState,
                x: number,
                y: number,
                level: number,
            ) => {
                teleports.push({ x, y, level });
            },
        },
        messaging: {
            sendGameMessage: () => undefined,
        },
    } as unknown as ScriptServices;

    const runLoc = (
        locId: number,
        action: string,
        tile = { x: 2673, y: 3307 },
    ) => {
        handler(locId, action)({
            player,
            locId,
            tile,
            level: 0,
            action,
            tick: 80,
            services,
        } as LocInteractionEvent);
    };

    const runPending = (tick = 80) => {
        assert(pending, "expected a queued chest action");
        const execute = actionHandlers.get(pending.kind);
        assert(execute, `expected action handler for ${pending.kind}`);
        return execute({
            player,
            data: pending.data,
            tick,
            services,
        } as ScriptActionHandlerContext);
    };

    return { player, xp, added, seqs, sounds, hitsplats, teleports, runLoc, runPending };
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

const nature = getChestByLocId(11736)!;
const low = makeSession({ level: 1 });
low.runLoc(11736, "search for traps");
const lowOut = low.runPending();
assert(lowOut.effects?.some((e) => e.type === "message" && /level of 28/.test(e.message)));
assert.equal(low.xp.length, 0);

const stunned = makeSession({ level: 99, stunned: true });
stunned.runLoc(11736, "search for traps");
const stunnedOut = stunned.runPending();
assert(stunnedOut.effects?.some((e) => e.type === "message" && e.message === "You're stunned!"));

const full = makeSession({ level: 99, inventoryFull: true });
full.runLoc(11736, "search for traps");
const fullOut = full.runPending();
assert(fullOut.effects?.some((e) => e.type === "message" && /inventory space/.test(e.message)));

const noPick = makeSession({ level: 99, hasLockpick: false });
noPick.runLoc(11742, "search for traps");
const noPickOut = noPick.runPending();
assert(noPickOut.effects?.some((e) => e.type === "message" && /lockpick/.test(e.message)));
assert.equal(noPick.xp.length, 0);

const locked = makeSession({ level: 99, hasLockpick: true });
locked.runLoc(22697, "open");
const lockedOut = locked.runPending();
assert(lockedOut.effects?.some((e) => e.type === "message" && e.message === "The chest is locked."));
assert.equal(locked.hitsplats.length, 0);

withRandom(0, () => {
    const trap = makeSession({ level: 99, hp: 50 });
    trap.runLoc(11736, "open");
    trap.runPending();
    const trapOut = trap.runPending(81);
    assert.equal(trap.xp.length, 0);
    assert.equal(trap.added.length, 0);
    assert.deepEqual(trap.hitsplats, [9]);
    assert(trap.seqs.includes(537));
    assert(
        trapOut.effects?.some(
            (e) => e.type === "message" && e.message === "You have activated a trap on the chest.",
        ),
    );
});

withRandom(0, () => {
    const ok = makeSession({ level: 99 });
    ok.runLoc(11736, "search for traps");
    ok.runPending();
    const resolved = ok.runPending(81);
    assert.deepEqual(ok.xp, [nature.xp]);
    assert.deepEqual(ok.added, [
        { itemId: ChestItems.NATURE_RUNE, quantity: 1 },
        { itemId: ChestItems.COINS, quantity: 3 },
    ]);
    assert(ok.seqs.includes(536));
    assert.equal(ok.player.lock, LockState.NONE);
    assert(
        resolved.effects?.some(
            (e) => e.type === "message" && e.message === "You find some treasure in the chest!",
        ),
    );
    assert(chestTracker?.has("0:2673:3307"));
});

const empty = makeSession({ level: 99 });
empty.runLoc(11736, "search for traps");
const emptyOut = empty.runPending();
assert(emptyOut.effects?.some((e) => e.type === "message" && e.message === "The chest is empty."));

chestTracker?.processExpired(81 + nature.respawnTicks, () => undefined);
assert.equal(chestTracker?.has("0:2673:3307"), false);

withRandom(0, () => {
    const coins = makeSession({ level: 13 });
    coins.runLoc(11735, "search for traps", { x: 2673, y: 3308 });
    coins.runPending();
    coins.runPending(81);
    assert.deepEqual(coins.added, [{ itemId: ChestItems.COINS, quantity: 10 }]);
    assert.deepEqual(coins.xp, [7.8]);
});

withRandom(0, () => {
    const steel = makeSession({ level: 47, hasLockpick: true });
    steel.runLoc(11742, "search for traps", { x: 2639, y: 3424 });
    steel.runPending();
    steel.runPending(81);
    assert.deepEqual(steel.added, [
        { itemId: ChestItems.STEEL_ARROWTIPS, quantity: 5 },
        { itemId: ChestItems.COINS, quantity: 20 },
    ]);
    assert.deepEqual(steel.xp, [150]);
});

withRandom(0.999, () => {
    const fail = makeSession({ level: 52, hasLockpick: true });
    fail.runLoc(22697, "pick-lock", { x: 2695, y: 5304 });
    fail.runPending();
    const failOut = fail.runPending(81);
    assert.equal(fail.xp.length, 0);
    assert.equal(fail.added.length, 0);
    assert(failOut.effects?.some((e) => e.type === "message" && /fail to pick/.test(e.message)));
});

withRandom(0, () => {
    const dorg = makeSession({ level: 52, hasLockpick: true });
    dorg.runLoc(22697, "pick-lock", { x: 2695, y: 5304 });
    dorg.runPending();
    dorg.runPending(81);
    assert.deepEqual(dorg.xp, [200]);
    assert.equal(dorg.added.length, 1);
    assert.equal(dorg.added[0].itemId, ChestItems.COINS);
    assert(dorg.added[0].quantity >= 1 && dorg.added[0].quantity <= 250);
});

withRandom(0, () => {
    const castle = makeSession({ level: 72 });
    castle.runLoc(11739, "search for traps", { x: 2588, y: 3291 });
    castle.runPending();
    castle.runPending(81);
    assert.deepEqual(castle.xp, [500]);
    assert.deepEqual(castle.added, [
        { itemId: ChestItems.COINS, quantity: 1000 },
        { itemId: ChestItems.RAW_SHARK, quantity: 1 },
        { itemId: ChestItems.ADAMANTITE_ORE, quantity: 1 },
        { itemId: ChestItems.UNCUT_SAPPHIRE, quantity: 1 },
    ]);
    assert.deepEqual(castle.teleports, [{ x: 2696, y: 3284, level: 0 }]);
});

withRandom(0, () => {
    const blood = makeSession({ level: 59 });
    blood.runLoc(11738, "search for traps", { x: 2586, y: 9734 });
    blood.runPending();
    blood.runPending(81);
    assert.deepEqual(blood.added, [
        { itemId: ChestItems.BLOOD_RUNE, quantity: 2 },
        { itemId: ChestItems.COINS, quantity: 500 },
    ]);
    assert.deepEqual(blood.teleports, [{ x: 2584, y: 3337, level: 0 }]);
});

const rich = getChestByLocId(22681)!;
assert.equal(rich.lootTable.length, 15);
assert.equal(rich.respawnTicks, 500);

console.log("thieving-chests.test.ts: all assertions passed");
