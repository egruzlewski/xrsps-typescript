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
    hasTaggedBrimhavenDispenser,
    register,
    resetBrimhavenArenaProgress,
} from "../gamemodes/vanilla/skills/agility";

resetBrimhavenArenaProgress();

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

const TICKET_ITEM_ID = 29480;

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 40) {
    const messages: string[] = [];
    const xp: XpGain[] = [];
    const teleports: Teleport[] = [];
    const forced: Forced[] = [];
    const seqs: number[] = [];
    const givenItems: Array<{ itemId: number; qty: number }> = [];
    let ticketCount = 0;
    let inventoryFull = false;
    const player = {
        id: playerId,
        tileX,
        tileY,
        level,
        clearPendingSeqs: () => undefined,
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
        run,
    };
}

resetBrimhavenArenaProgress();

const pillars = makeSession(1, 2761, 9548, 3);
pillars.run(3578, { x: 2761, y: 9549 }, 3, "jump-on");
assert.deepEqual(pillars.teleports[0], { x: 2761, y: 9555, level: 3 });
assert.equal(pillars.forced.length, 1);
assert.deepEqual(pillars.xp, [{ skillId: SkillId.Agility, amount: 18 }]);
assert(pillars.messages.some((m) => /jump across the pillars/i.test(m)));
assert.equal(hasTaggedBrimhavenDispenser(1), false);

pillars.run(3608, { x: 2761, y: 9546 }, 3, "tag");
assert.deepEqual(pillars.givenItems, [{ itemId: TICKET_ITEM_ID, qty: 1 }]);
assert.deepEqual(pillars.xp[1], { skillId: SkillId.Agility, amount: 120 });
assert.equal(hasTaggedBrimhavenDispenser(1), true);
assert(pillars.messages.some((m) => /received an Agility Arena Ticket/i.test(m)));

pillars.run(3608, { x: 2761, y: 9546 }, 3, "tag");
assert.equal(pillars.givenItems.length, 1, "second tag without an obstacle awards no ticket");
assert(pillars.messages.some((m) => /wait till the arrow moves again/i.test(m)));

const rope = makeSession(1, 2766, 9569, 3);
rope.run(3566, { x: 2766, y: 9569 }, 3, "swing-on");
assert.deepEqual(rope.teleports[0], { x: 2766, y: 9574, level: 3 });
assert.deepEqual(rope.xp, [{ skillId: SkillId.Agility, amount: 20 }]);
assert.equal(hasTaggedBrimhavenDispenser(1), false);
assert(rope.messages.some((m) => /skillfully swing across/i.test(m)));

rope.run(3581, { x: 2772, y: 9568 }, 3, "tag");
assert.deepEqual(rope.givenItems, [{ itemId: TICKET_ITEM_ID, qty: 1 }]);
assert.equal(hasTaggedBrimhavenDispenser(1), true);

const wall = makeSession(2, 2777, 9589, 3);
wall.run(3565, { x: 2777, y: 9590 }, 3, "climb-over");
assert.deepEqual(wall.teleports[0], { x: 2777, y: 9592, level: 3 });
assert.deepEqual(wall.xp, [{ skillId: SkillId.Agility, amount: 8 }]);

const plank = makeSession(3, 2764, 9557, 3);
plank.run(3570, { x: 2765, y: 9557 }, 3, "walk-on");
assert.deepEqual(plank.teleports[0], { x: 2771, y: 9557, level: 3 });
assert.deepEqual(plank.xp, [{ skillId: SkillId.Agility, amount: 6 }]);

const balance = makeSession(4, 2783, 9588, 3);
balance.run(3551, { x: 2783, y: 9587 }, 3, "walk-on");
assert.deepEqual(balance.teleports[0], { x: 2783, y: 9581, level: 3 });
assert.deepEqual(balance.xp, [{ skillId: SkillId.Agility, amount: 10 }]);

const log = makeSession(5, 2767, 9578, 3);
log.run(3553, { x: 2767, y: 9579 }, 3, "walk-on");
assert.deepEqual(log.teleports[0], { x: 2767, y: 9585, level: 3 });
assert.deepEqual(log.xp, [{ skillId: SkillId.Agility, amount: 12 }]);

const ledge = makeSession(6, 2764, 9590, 3);
ledge.run(3559, { x: 2765, y: 9590 }, 3, "walk-across");
assert.deepEqual(ledge.teleports[0], { x: 2771, y: 9590, level: 3 });
assert.deepEqual(ledge.xp, [{ skillId: SkillId.Agility, amount: 16 }]);

const bars = makeSession(7, 2771, 9577, 3);
bars.run(3563, { x: 2771, y: 9576 }, 3, "swing-across");
assert.deepEqual(bars.teleports[0], { x: 2771, y: 9569, level: 3 });
assert.deepEqual(bars.xp, [{ skillId: SkillId.Agility, amount: 14 }]);

const holdsLow = makeSession(8, 2792, 9591, 3, 19);
holdsLow.run(3583, { x: 2792, y: 9592 }, 3, "climb-across");
assert.equal(holdsLow.teleports.length, 0);
assert.deepEqual(holdsLow.xp, []);
assert(holdsLow.messages.some((m) => /agility level of at least 20/i.test(m)));

const holds = makeSession(9, 2792, 9591, 3, 20);
holds.run(3583, { x: 2792, y: 9592 }, 3, "climb-across");
assert.deepEqual(holds.teleports[0], { x: 2792, y: 9599, level: 3 });
assert.deepEqual(holds.xp, [{ skillId: SkillId.Agility, amount: 22 }]);

resetBrimhavenArenaProgress(10);
const tagFirst = makeSession(10, 2761, 9546, 3, 99);
tagFirst.run(3608, { x: 2761, y: 9546 }, 3, "tag");
assert.deepEqual(tagFirst.givenItems, [{ itemId: TICKET_ITEM_ID, qty: 1 }]);
assert.deepEqual(tagFirst.xp, [{ skillId: SkillId.Agility, amount: 270 }]);

const tagFull = makeSession(11, 2761, 9546, 3);
tagFull.inventoryFull = true;
tagFull.run(3608, { x: 2761, y: 9546 }, 3, "tag");
assert.deepEqual(tagFull.givenItems, []);
assert.equal(hasTaggedBrimhavenDispenser(11), false);
assert(tagFull.messages.some((m) => /free inventory space/i.test(m)));

const redeemNone = makeSession(12, 2761, 9546, 3);
redeemNone.run(3608, { x: 2761, y: 9546 }, 3, "redeem");
assert.deepEqual(redeemNone.xp, []);
assert(redeemNone.messages.some((m) => /don't have any Agility Arena tickets/i.test(m)));

const redeemOne = makeSession(13, 2761, 9546, 3);
redeemOne.ticketCount = 1;
redeemOne.run(3608, { x: 2761, y: 9546 }, 3, "redeem");
assert.deepEqual(redeemOne.xp, [{ skillId: SkillId.Agility, amount: 345 }]);
assert.equal(redeemOne.ticketCount, 0);

const redeemTen = makeSession(14, 2761, 9546, 3);
redeemTen.ticketCount = 10;
redeemTen.run(3608, { x: 2761, y: 9546 }, 3, "redeem");
assert.deepEqual(redeemTen.xp, [{ skillId: SkillId.Agility, amount: 3450 }]);
assert.equal(redeemTen.ticketCount, 0);

console.log("agility-brimhaven-arena.test.ts: all assertions passed");
