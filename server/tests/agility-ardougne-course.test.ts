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
    getArdougneCourseStage,
    register,
    resetArdougneCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetArdougneCourseProgress();

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

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 90) {
    const messages: string[] = [];
    const xp: number[] = [];
    const teleports: Teleport[] = [];
    const forced: Forced[] = [];
    const seqs: number[] = [];
    const player = {
        id: playerId,
        tileX,
        tileY,
        level,
        clearPendingSeqs: () => undefined,
    } as PlayerState;

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

    return { player, messages, xp, teleports, forced, seqs, run };
}

const tooLow = makeSession(9, 2673, 3298, 0, 89);
tooLow.run(15608, { x: 2673, y: 3298 }, 0, "climb-up");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 90/i.test(m)));
assert.equal(getArdougneCourseStage(9), 0);

const beams = makeSession(1, 2673, 3298, 0);
beams.run(15608, { x: 2673, y: 3298 }, 0, "climb-up");
assert.deepEqual(beams.teleports[0], { x: 2673, y: 3300, level: 3 });
assert.equal(beams.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(beams.xp, [43]);
assert.equal(getArdougneCourseStage(1), 1);
assert(beams.messages.some((m) => /climb the wooden beams/i.test(m)));

const gap1 = makeSession(1, 2671, 3309, 3);
gap1.run(15609, { x: 2670, y: 3310 }, 3, "jump");
assert.deepEqual(gap1.teleports[0], { x: 2670, y: 3318, level: 3 });
assert.equal(gap1.forced.length, 1);
assert.deepEqual(gap1.xp, [65]);
assert.equal(getArdougneCourseStage(1), 2);

const plank = makeSession(1, 2665, 3318, 3);
plank.run(26635, { x: 2661, y: 3318 }, 3, "walk-on");
assert.deepEqual(plank.teleports[0], { x: 2653, y: 3318, level: 3 });
assert.equal(plank.forced.length, 1);
assert.deepEqual(plank.xp, [50]);
assert.equal(getArdougneCourseStage(1), 3);

const gap2 = makeSession(1, 2653, 3318, 3);
gap2.run(15610, { x: 2653, y: 3317 }, 3, "jump");
assert.deepEqual(gap2.teleports[0], { x: 2653, y: 3310, level: 3 });
assert.equal(gap2.forced.length, 1);
assert.deepEqual(gap2.xp, [21]);
assert.equal(getArdougneCourseStage(1), 4);

const gap3 = makeSession(1, 2653, 3309, 3);
gap3.run(15611, { x: 2653, y: 3308 }, 3, "jump");
assert.deepEqual(gap3.teleports[0], { x: 2654, y: 3302, level: 3 });
assert.equal(gap3.forced.length, 1);
assert.deepEqual(gap3.xp, [28]);
assert.equal(getArdougneCourseStage(1), 5);

const roof = makeSession(1, 2654, 3301, 3);
roof.run(28912, { x: 2654, y: 3300 }, 3, "balance-across");
assert.deepEqual(roof.teleports[0], { x: 2656, y: 3297, level: 3 });
assert.equal(roof.forced.length, 1);
assert.deepEqual(roof.xp, [57]);
assert.equal(getArdougneCourseStage(1), 6);

const gap4 = makeSession(1, 2656, 3297, 3);
gap4.run(15612, { x: 2656, y: 3296 }, 3, "jump");
assert.deepEqual(gap4.teleports[0], { x: 2668, y: 3297, level: 0 });
assert.equal(gap4.forced.length, 0, "plane-change jump-off has no forced movement");
assert.deepEqual(gap4.xp, [625]);
assert(gap4.messages.some((m) => /completed the Ardougne rooftop course/i.test(m)));
assert.equal(getArdougneCourseStage(1), 0);

resetArdougneCourseProgress(2);
const skipToEnd = makeSession(2, 2656, 3297, 3);
skipToEnd.run(15612, { x: 2656, y: 3296 }, 3, "jump");
assert.deepEqual(skipToEnd.xp, [625], "final gap without a lap awards obstacle XP only");
assert.equal(
    skipToEnd.messages.some((m) => /completed the Ardougne rooftop course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 2673, 3298, 0);
defaultAction.run(15608, { x: 2673, y: 3298 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 2673, y: 3300, level: 3 });
assert.deepEqual(defaultAction.xp, [43]);

const climbUp = makeSession(4, 2673, 3298, 0);
climbUp.run(15608, { x: 2673, y: 3298 }, 0, "climb");
assert.deepEqual(climbUp.teleports[0], { x: 2673, y: 3300, level: 3 });
assert.deepEqual(climbUp.xp, [43]);

console.log("agility-ardougne-course.test.ts: all assertions passed");
