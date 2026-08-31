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
    getVarrockCourseStage,
    register,
    resetVarrockCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetVarrockCourseProgress();

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

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 30) {
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

const tooLow = makeSession(9, 3221, 3414, 0, 29);
tooLow.run(14412, { x: 3221, y: 3414 }, 0, "climb");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 30/i.test(m)));
assert.equal(getVarrockCourseStage(9), 0);

const wall = makeSession(1, 3221, 3414, 0);
wall.run(14412, { x: 3221, y: 3414 }, 0, "climb");
assert.deepEqual(wall.teleports[0], { x: 3219, y: 3414, level: 3 });
assert.equal(wall.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(wall.xp, [13.5]);
assert.equal(getVarrockCourseStage(1), 1);
assert(wall.messages.some((m) => /climb the wall/i.test(m)));

const clothes = makeSession(1, 3214, 3414, 3);
clothes.run(14413, { x: 3214, y: 3414 }, 3, "cross");
assert.deepEqual(clothes.teleports[0], { x: 3208, y: 3414, level: 3 });
assert.equal(clothes.forced.length, 1);
assert.deepEqual(clothes.xp, [23]);
assert.equal(getVarrockCourseStage(1), 2);

const gap1 = makeSession(1, 3201, 3416, 3);
gap1.run(14414, { x: 3201, y: 3416 }, 3, "leap");
assert.deepEqual(gap1.teleports[0], { x: 3197, y: 3416, level: 1 });
assert.equal(gap1.forced.length, 0, "plane-change gap has no forced movement");
assert.deepEqual(gap1.xp, [19]);
assert.equal(getVarrockCourseStage(1), 3);

const balance = makeSession(1, 3194, 3416, 1);
balance.run(14832, { x: 3194, y: 3416 }, 1, "balance");
assert.deepEqual(balance.teleports[0], { x: 3192, y: 3406, level: 3 });
assert.equal(balance.forced.length, 0, "plane-change wall has no forced movement");
assert.deepEqual(balance.xp, [28]);
assert.equal(getVarrockCourseStage(1), 4);

const gap2 = makeSession(1, 3192, 3402, 3);
gap2.run(14833, { x: 3192, y: 3402 }, 3, "leap");
assert.deepEqual(gap2.teleports[0], { x: 3192, y: 3398, level: 3 });
assert.equal(gap2.forced.length, 1);
assert.deepEqual(gap2.xp, [10]);
assert.equal(getVarrockCourseStage(1), 5);

const gap3 = makeSession(1, 3208, 3397, 3);
gap3.run(14834, { x: 3208, y: 3397 }, 3, "leap");
assert.deepEqual(gap3.teleports[0], { x: 3218, y: 3399, level: 3 });
assert.equal(gap3.forced.length, 1);
assert.deepEqual(gap3.xp, [24.5]);
assert.equal(getVarrockCourseStage(1), 6);

const gap4 = makeSession(1, 3231, 3402, 3);
gap4.run(14835, { x: 3231, y: 3402 }, 3, "leap");
assert.deepEqual(gap4.teleports[0], { x: 3236, y: 3403, level: 3 });
assert.equal(gap4.forced.length, 1);
assert.deepEqual(gap4.xp, [4.5]);
assert.equal(getVarrockCourseStage(1), 7);

const ledge = makeSession(1, 3236, 3408, 3);
ledge.run(14836, { x: 3236, y: 3408 }, 3, "hurdle");
assert.deepEqual(ledge.teleports[0], { x: 3236, y: 3410, level: 3 });
assert.equal(ledge.forced.length, 1);
assert.deepEqual(ledge.xp, [3.5]);
assert.equal(getVarrockCourseStage(1), 8);

const edge = makeSession(1, 3236, 3415, 3);
edge.run(14841, { x: 3236, y: 3415 }, 3, "jump-off");
assert.deepEqual(edge.teleports[0], { x: 3236, y: 3417, level: 0 });
assert.equal(edge.forced.length, 0, "plane-change jump-off has no forced movement");
assert.deepEqual(edge.xp, [143.7]);
assert(edge.messages.some((m) => /completed the Varrock rooftop course/i.test(m)));
assert.equal(getVarrockCourseStage(1), 0);

resetVarrockCourseProgress(2);
const skipToEdge = makeSession(2, 3236, 3415, 3);
skipToEdge.run(14841, { x: 3236, y: 3415 }, 3, "jump-off");
assert.deepEqual(skipToEdge.xp, [143.7], "edge without a lap awards obstacle XP only");
assert.equal(
    skipToEdge.messages.some((m) => /completed the Varrock rooftop course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 3221, 3414, 0);
defaultAction.run(14412, { x: 3221, y: 3414 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 3219, y: 3414, level: 3 });
assert.deepEqual(defaultAction.xp, [13.5]);

console.log("agility-varrock-course.test.ts: all assertions passed");
