import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnNpcEvent,
    ItemOnNpcHandler,
    LocInteractionEvent,
    LocInteractionHandler,
    NpcInteractionEvent,
    NpcInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import {
    hasCollectedPyramidTop,
    register,
    resetPyramidCourseProgress,
} from "../gamemodes/vanilla/skills/agility/pyramid";

resetPyramidCourseProgress();

const locHandlers = new Map<string, LocInteractionHandler>();
const npcHandlers = new Map<string, NpcInteractionHandler>();
const itemOnNpcHandlers = new Map<string, ItemOnNpcHandler>();
const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerNpcInteraction: (npcId: number, handler: NpcInteractionHandler, action?: string) => {
        npcHandlers.set(`${npcId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerItemOnNpc: (itemId: number, npcId: number, handler: ItemOnNpcHandler) => {
        itemOnNpcHandlers.set(`${itemId}:${npcId}`, handler);
        return { unregister() {} };
    },
} as unknown as IScriptRegistry;

register(registry);

function locHandler(locId: number, action?: string): LocInteractionHandler {
    const found = locHandlers.get(`${locId}:${action ?? "*"}`);
    assert(found, `expected loc handler for ${locId} action=${action}`);
    return found;
}

type Teleport = { x: number; y: number; level: number };
type Forced = { startTile: { x: number; y: number }; endTile: { x: number; y: number }; endTick: number };

const PYRAMID_TOP_ITEM_ID = 6970;
const COINS_ITEM_ID = 995;
const SIMON_NPC_ID = 5786;

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 30) {
    const messages: string[] = [];
    const xp: number[] = [];
    const teleports: Teleport[] = [];
    const forced: Forced[] = [];
    const seqs: number[] = [];
    const givenItems: Array<{ itemId: number; qty: number }> = [];
    let pyramidTops = 0;
    let coins = 0;
    let inventoryFull = false;
    const player = {
        id: playerId,
        tileX,
        tileY,
        level,
        clearPendingSeqs: () => undefined,
        items: {
            getItemCount: (itemId: number) => {
                if (itemId === PYRAMID_TOP_ITEM_ID) return pyramidTops;
                if (itemId === COINS_ITEM_ID) return coins;
                return 0;
            },
            removeItem: (itemId: number, amount: number) => {
                if (itemId !== PYRAMID_TOP_ITEM_ID || pyramidTops < amount) {
                    return { completed: 0 };
                }
                pyramidTops -= amount;
                return { completed: amount };
            },
            addItem: (itemId: number, amount: number) => {
                if (itemId === PYRAMID_TOP_ITEM_ID) {
                    pyramidTops += amount;
                    return { completed: amount };
                }
                if (itemId === COINS_ITEM_ID) {
                    coins += amount;
                    return { completed: amount };
                }
                return { completed: 0 };
            },
        },
    } as unknown as PlayerState;

    const services = {
        messaging: {
            sendGameMessage: (_p: PlayerState, text: string) => {
                messages.push(text);
            },
        },
        skills: {
            addSkillXp: (_p: PlayerState, skillId: number, amount: number) => {
                assert.equal(skillId, SkillId.Agility);
                xp.push(amount);
            },
            getSkill: (_p: PlayerState, skillId: number) => {
                if (skillId === SkillId.Agility) {
                    return { baseLevel: agilityLevel, boost: 0 };
                }
                return { baseLevel: 1, boost: 0 };
            },
        },
        movement: {
            teleportPlayer: (_p: PlayerState, x: number, y: number, destLevel: number) => {
                teleports.push({ x, y, level: destLevel });
                player.tileX = x;
                player.tileY = y;
                player.level = destLevel;
            },
            queueForcedMovement: (_p: PlayerState, params: Forced) => {
                forced.push(params);
            },
        },
        animation: {
            playPlayerSeq: (_p: PlayerState, seqId: number) => {
                seqs.push(seqId);
            },
        },
        inventory: {
            addItemToInventory: (_p: PlayerState, itemId: number, qty: number) => {
                if (inventoryFull) {
                    return { slot: -1, added: 0 };
                }
                givenItems.push({ itemId, qty });
                if (itemId === PYRAMID_TOP_ITEM_ID) {
                    pyramidTops += qty;
                }
                if (itemId === COINS_ITEM_ID) {
                    coins += qty;
                }
                return { slot: 0, added: qty };
            },
            snapshotInventory: () => undefined,
        },
    } as unknown as ScriptServices;

    const runLoc = (locId: number, tile: { x: number; y: number }, locLevel: number, action?: string) => {
        const event = {
            player,
            locId,
            tile,
            level: locLevel,
            action,
            tick: 100,
            services,
        } as LocInteractionEvent;
        locHandler(locId, action)(event);
    };

    const runNpc = (action?: string) => {
        const found = npcHandlers.get(`${SIMON_NPC_ID}:${action ?? "*"}`);
        assert(found, `expected Simon handler action=${action}`);
        found({ player, npc: { id: SIMON_NPC_ID }, option: action, services } as unknown as NpcInteractionEvent);
    };

    const runItemOnSimon = () => {
        const found = itemOnNpcHandlers.get(`${PYRAMID_TOP_ITEM_ID}:${SIMON_NPC_ID}`);
        assert(found, "expected pyramid-top-on-Simon handler");
        found({
            player,
            source: { slot: 0, itemId: PYRAMID_TOP_ITEM_ID },
            target: { id: SIMON_NPC_ID },
            services,
        } as unknown as ItemOnNpcEvent);
    };

    return {
        player,
        messages,
        xp,
        teleports,
        forced,
        seqs,
        givenItems,
        get pyramidTops() {
            return pyramidTops;
        },
        set pyramidTops(value: number) {
            pyramidTops = value;
        },
        get coins() {
            return coins;
        },
        set inventoryFull(value: boolean) {
            inventoryFull = value;
        },
        runLoc,
        runNpc,
        runItemOnSimon,
    };
}

const tooLow = makeSession(9, 3354, 2840, 0, 29);
tooLow.runLoc(10875, { x: 3354, y: 2841 }, 0, "cross");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 30/i.test(m)));
assert.equal(hasCollectedPyramidTop(9), false);

const roll = makeSession(1, 3354, 2840, 0);
roll.runLoc(10875, { x: 3354, y: 2841 }, 0, "cross");
assert.deepEqual(roll.teleports[0], { x: 3354, y: 2843, level: 0 });
assert.equal(roll.forced.length, 1);
assert.deepEqual(roll.xp, [12]);
assert(roll.messages.some((m) => /rolling block/i.test(m)));

const rollDefault = makeSession(2, 3354, 2840, 0);
rollDefault.runLoc(10876, { x: 3354, y: 2841 }, 0);
assert.deepEqual(rollDefault.teleports[0], { x: 3354, y: 2843, level: 0 });
assert.deepEqual(rollDefault.xp, [12]);

const ledge = makeSession(3, 3364, 2851, 0);
ledge.runLoc(10860, { x: 3366, y: 2851 }, 0, "cross");
assert.deepEqual(ledge.teleports[0], { x: 3371, y: 2851, level: 0 });
assert.equal(ledge.forced.length, 1);
assert.deepEqual(ledge.xp, [52]);
assert(ledge.messages.some((m) => /ledge/i.test(m)));

const ledgeSouth = makeSession(4, 3372, 2839, 0);
ledgeSouth.runLoc(10886, { x: 3372, y: 2837 }, 0, "cross");
assert.deepEqual(ledgeSouth.teleports[0], { x: 3372, y: 2832, level: 0 });
assert.deepEqual(ledgeSouth.xp, [52]);

const rocks = makeSession(5, 3364, 2839, 3);
rocks.runLoc(10851, { x: 3364, y: 2841 }, 3, "climb");
assert.deepEqual(rocks.teleports[0], { x: 3364, y: 2843, level: 3 });
assert.deepEqual(rocks.xp, [], "climbing rocks award no Agility XP");
assert.deepEqual(rocks.givenItems, [{ itemId: PYRAMID_TOP_ITEM_ID, qty: 1 }]);
assert.equal(rocks.pyramidTops, 1);
assert.equal(hasCollectedPyramidTop(5), true);
assert(rocks.messages.some((m) => /pyramid top/i.test(m)));

rocks.runLoc(10851, { x: 3364, y: 2841 }, 3, "climb");
assert.equal(rocks.pyramidTops, 1, "second climb before doorway does not duplicate the top");
assert(rocks.messages.some((m) => /find nothing at the top of the pyramid/i.test(m)));

const fullInv = makeSession(6, 3364, 2839, 3);
fullInv.inventoryFull = true;
fullInv.runLoc(10851, { x: 3364, y: 2841 }, 3, "climb");
assert.deepEqual(fullInv.givenItems, []);
assert.equal(hasCollectedPyramidTop(6), false);
assert(fullInv.messages.some((m) => /inventory space/i.test(m)));

const door = makeSession(5, 3044, 4694, 3, 30);
door.runLoc(10855, { x: 3045, y: 4696 }, 3, "enter");
assert.deepEqual(door.teleports[0], { x: 3364, y: 2830, level: 0 });
assert.equal(door.forced.length, 0, "doorway drop is a plane/region teleport");
assert.deepEqual(door.xp, [540], "level 30 doorway bonus is 300+8*30");
assert.equal(hasCollectedPyramidTop(5), false);
assert(door.messages.some((m) => /completed the Agility Pyramid/i.test(m)));

const doorHigh = makeSession(7, 3044, 4694, 3, 88);
doorHigh.runLoc(10855, { x: 3045, y: 4696 }, 3, "enter");
assert.deepEqual(doorHigh.xp, [1000], "doorway bonus caps at 1,000 at level 88");

const door87 = makeSession(8, 3044, 4694, 3, 87);
door87.runLoc(10856, { x: 3045, y: 4696 }, 3, "enter");
assert.deepEqual(door87.xp, [996], "level 87 doorway bonus is 300+8*87");

resetPyramidCourseProgress(5);
const rocksAgain = makeSession(5, 3364, 2839, 3);
rocksAgain.runLoc(10851, { x: 3364, y: 2841 }, 3, "climb");
assert.equal(rocksAgain.pyramidTops, 1);
assert.equal(hasCollectedPyramidTop(5), true);

rocksAgain.runNpc("talk-to");
assert.equal(rocksAgain.pyramidTops, 0);
assert.equal(rocksAgain.coins, 10_000);
assert.deepEqual(rocksAgain.givenItems, [
    { itemId: PYRAMID_TOP_ITEM_ID, qty: 1 },
    { itemId: COINS_ITEM_ID, qty: 10_000 },
]);
assert(rocksAgain.messages.some((m) => /10,000 coins/i.test(m)));

const sellNone = makeSession(10, 3344, 2828, 0);
sellNone.runNpc("talk-to");
assert.equal(sellNone.coins, 0);
assert(sellNone.messages.some((m) => /will buy pyramid tops/i.test(m)));

const sellTwo = makeSession(11, 3344, 2828, 0);
sellTwo.pyramidTops = 2;
sellTwo.runItemOnSimon();
assert.equal(sellTwo.pyramidTops, 0);
assert.equal(sellTwo.coins, 20_000);

console.log("agility-pyramid-course.test.ts: all assertions passed");
