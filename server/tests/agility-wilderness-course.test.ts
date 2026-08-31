import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    LocInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import {
    getWildernessCourseStage,
    hasPendingWildernessTicket,
    register,
    resetWildernessCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetWildernessCourseProgress();

const locHandlers = new Map<string, LocInteractionHandler>();
const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
} as unknown as IScriptRegistry;

register(registry);

function handler(locId: number, action?: string): LocInteractionHandler {
    const found = locHandlers.get(`${locId}:${action ?? "*"}`);
    assert(found, `expected loc handler for ${locId} action=${action}`);
    return found;
}

type Teleport = { x: number; y: number; level: number };
type Forced = { startTile: { x: number; y: number }; endTile: { x: number; y: number }; endTick: number };
type XpGain = { skillId: number; amount: number };

const TICKET_ITEM_ID = 29460;

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 52) {
    const messages: string[] = [];
    const xp: XpGain[] = [];
    const teleports: Teleport[] = [];
    const forced: Forced[] = [];
    const seqs: number[] = [];
    const givenItems: Array<{ itemId: number; qty: number }> = [];
    let ticketCount = 0;
    let inventoryFull = false;
    let runEnergy = 0;
    const player = {
        id: playerId,
        tileX,
        tileY,
        level,
        clearPendingSeqs: () => undefined,
        energy: {
            setRunEnergyUnits: (units: number) => {
                runEnergy = units;
            },
        },
        items: {
            getItemCount: (itemId: number) => (itemId === TICKET_ITEM_ID ? ticketCount : 0),
            removeItem: (itemId: number, amount: number) => {
                if (itemId !== TICKET_ITEM_ID || ticketCount < amount) {
                    return { completed: 0 };
                }
                ticketCount -= amount;
                return { completed: amount };
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
                xp.push({ skillId, amount });
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
                if (itemId === TICKET_ITEM_ID) {
                    ticketCount += qty;
                }
                return { slot: 0, added: qty };
            },
            snapshotInventory: () => undefined,
        },
    } as unknown as ScriptServices;

    const run = (locId: number, tile: { x: number; y: number }, locLevel: number, action?: string) => {
        const event = {
            player,
            locId,
            tile,
            level: locLevel,
            action,
            tick: 100,
            services,
        } as LocInteractionEvent;
        handler(locId, action)(event);
    };

    return {
        player,
        messages,
        xp,
        teleports,
        forced,
        seqs,
        givenItems,
        get ticketCount() {
            return ticketCount;
        },
        set ticketCount(value: number) {
            ticketCount = value;
        },
        set inventoryFull(value: boolean) {
            inventoryFull = value;
        },
        get runEnergy() {
            return runEnergy;
        },
        run,
    };
}

const pipe = makeSession(1, 3004, 3937, 0);
pipe.run(23137, { x: 3004, y: 3938 }, 0, "squeeze-through");
assert.deepEqual(pipe.teleports[0], { x: 3004, y: 3950, level: 0 });
assert.equal(pipe.forced.length, 1);
assert.deepEqual(pipe.xp, [{ skillId: SkillId.Agility, amount: 12.5 }]);
assert.equal(getWildernessCourseStage(1), 1);
assert(pipe.messages.some((m) => /squeeze into the pipe/i.test(m)));

const rope = makeSession(1, 3005, 3952, 0);
rope.run(23132, { x: 3005, y: 3952 }, 0, "swing-on");
assert.deepEqual(rope.teleports[0], { x: 3005, y: 3958, level: 0 });
assert.equal(rope.forced.length, 1);
assert.deepEqual(rope.xp, [{ skillId: SkillId.Agility, amount: 20 }]);
assert.equal(getWildernessCourseStage(1), 2);
assert(rope.messages.some((m) => /skillfully swing across/i.test(m)));

const stones = makeSession(1, 3002, 3960, 0);
stones.run(23556, { x: 3001, y: 3960 }, 0, "cross");
assert.deepEqual(stones.teleports[0], { x: 2996, y: 3960, level: 0 });
assert.deepEqual(stones.xp, [{ skillId: SkillId.Agility, amount: 20 }]);
assert.equal(getWildernessCourseStage(1), 3);

const log = makeSession(1, 3002, 3945, 0);
log.run(23542, { x: 3001, y: 3945 }, 0, "walk-across");
assert.deepEqual(log.teleports[0], { x: 2994, y: 3945, level: 0 });
assert.deepEqual(log.xp, [{ skillId: SkillId.Agility, amount: 20 }]);
assert.equal(getWildernessCourseStage(1), 4);

const rocks = makeSession(1, 2994, 3937, 0);
rocks.run(23640, { x: 2994, y: 3936 }, 0, "climb");
assert.deepEqual(rocks.teleports[0], { x: 2994, y: 3933, level: 0 });
assert.deepEqual(rocks.xp, [{ skillId: SkillId.Agility, amount: 498.9 }]);
assert(rocks.messages.some((m) => /completed the Wilderness agility course/i.test(m)));
assert.equal(getWildernessCourseStage(1), 0);
assert.equal(hasPendingWildernessTicket(1), true);

rocks.run(53224, { x: 3005, y: 3936 }, 0, "tag");
assert.deepEqual(rocks.givenItems, [{ itemId: TICKET_ITEM_ID, qty: 1 }]);
assert.equal(rocks.runEnergy, 10000);
assert.equal(hasPendingWildernessTicket(1), false);
assert(rocks.messages.some((m) => /Wilderness agility ticket/i.test(m)));

resetWildernessCourseProgress(2);
const skipToRocks = makeSession(2, 2994, 3937, 0);
skipToRocks.run(23640, { x: 2994, y: 3936 }, 0, "climb");
assert.deepEqual(skipToRocks.xp, [], "rocks without a lap award no XP");
assert.equal(
    skipToRocks.messages.some((m) => /completed the Wilderness agility course/i.test(m)),
    false,
);
assert.equal(hasPendingWildernessTicket(2), false);

const pipeLow = makeSession(3, 3004, 3937, 0, 48);
pipeLow.run(23137, { x: 3004, y: 3938 }, 0, "squeeze-through");
assert.equal(pipeLow.teleports.length, 0);
assert(pipeLow.messages.some((m) => /Agility level of 49/i.test(m)));

const pipeFromNorth = makeSession(4, 3004, 3950, 0);
pipeFromNorth.run(23137, { x: 3004, y: 3938 }, 0, "squeeze-through");
assert.equal(pipeFromNorth.teleports.length, 0);
assert(pipeFromNorth.messages.some((m) => /can't enter the pipe from this side/i.test(m)));

const ropeFromNorth = makeSession(5, 3005, 3958, 0);
ropeFromNorth.run(23132, { x: 3005, y: 3952 }, 0, "swing-on");
assert.equal(ropeFromNorth.teleports.length, 0);
assert(ropeFromNorth.messages.some((m) => /cannot do that from here/i.test(m)));

const tagNoLap = makeSession(6, 3005, 3936, 0);
tagNoLap.run(53224, { x: 3005, y: 3936 }, 0, "tag");
assert.deepEqual(tagNoLap.givenItems, []);
assert.equal(tagNoLap.runEnergy, 10000);
assert(tagNoLap.messages.some((m) => /restores your run energy/i.test(m)));

const redeemNone = makeSession(7, 3005, 3936, 0);
redeemNone.run(53224, { x: 3005, y: 3936 }, 0, "redeem");
assert.deepEqual(redeemNone.xp, []);
assert(redeemNone.messages.some((m) => /don't have any Wilderness agility tickets/i.test(m)));

const redeemOne = makeSession(8, 3005, 3936, 0);
redeemOne.ticketCount = 1;
redeemOne.run(53224, { x: 3005, y: 3936 }, 0, "redeem");
assert.deepEqual(redeemOne.xp, [{ skillId: SkillId.Agility, amount: 200 }]);
assert.equal(redeemOne.ticketCount, 0);

const redeemEleven = makeSession(9, 3005, 3936, 0);
redeemEleven.ticketCount = 11;
redeemEleven.run(53224, { x: 3005, y: 3936 }, 0, "redeem");
assert.deepEqual(redeemEleven.xp, [{ skillId: SkillId.Agility, amount: 2310 }]);

const redeemHundredOne = makeSession(10, 3005, 3936, 0);
redeemHundredOne.ticketCount = 101;
redeemHundredOne.run(53224, { x: 3005, y: 3936 }, 0, "redeem");
assert.deepEqual(redeemHundredOne.xp, [{ skillId: SkillId.Agility, amount: 23230 }]);

console.log("agility-wilderness-course.test.ts: all assertions passed");
