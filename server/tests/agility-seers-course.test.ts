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
    getSeersCourseStage,
    register,
    resetSeersCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetSeersCourseProgress();

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

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 60) {
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

const tooLow = makeSession(9, 2729, 3489, 0, 59);
tooLow.run(14927, { x: 2729, y: 3489 }, 0, "climb");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 60/i.test(m)));
assert.equal(getSeersCourseStage(9), 0);

const wall = makeSession(1, 2729, 3489, 0);
wall.run(14927, { x: 2729, y: 3489 }, 0, "climb");
assert.deepEqual(wall.teleports[0], { x: 2729, y: 3491, level: 3 });
assert.equal(wall.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(wall.xp, [45]);
assert.equal(getSeersCourseStage(1), 1);
assert(wall.messages.some((m) => /climb the wall/i.test(m)));

const gap1 = makeSession(1, 2721, 3494, 3);
gap1.run(14928, { x: 2720, y: 3492 }, 3, "jump");
assert.deepEqual(gap1.teleports[0], { x: 2713, y: 3494, level: 2 });
assert.equal(gap1.forced.length, 0, "plane-change gap has no forced movement");
assert.deepEqual(gap1.xp, [20]);
assert.equal(getSeersCourseStage(1), 2);

const rope = makeSession(1, 2710, 3490, 2);
rope.run(14932, { x: 2710, y: 3489 }, 2, "cross");
assert.deepEqual(rope.teleports[0], { x: 2710, y: 3480, level: 2 });
assert.equal(rope.forced.length, 1);
assert.deepEqual(rope.xp, [20]);
assert.equal(getSeersCourseStage(1), 3);

const gap2 = makeSession(1, 2710, 3477, 2);
gap2.run(14929, { x: 2710, y: 3476 }, 2, "jump");
assert.deepEqual(gap2.teleports[0], { x: 2710, y: 3472, level: 3 });
assert.equal(gap2.forced.length, 0, "plane-change gap has no forced movement");
assert.deepEqual(gap2.xp, [35]);
assert.equal(getSeersCourseStage(1), 4);

const gap3 = makeSession(1, 2702, 3470, 3);
gap3.run(14930, { x: 2700, y: 3469 }, 3, "jump");
assert.deepEqual(gap3.teleports[0], { x: 2702, y: 3465, level: 2 });
assert.equal(gap3.forced.length, 0, "plane-change gap has no forced movement");
assert.deepEqual(gap3.xp, [15]);
assert.equal(getSeersCourseStage(1), 5);

const edge = makeSession(1, 2702, 3464, 2);
edge.run(14931, { x: 2703, y: 3461 }, 2, "jump");
assert.deepEqual(edge.teleports[0], { x: 2704, y: 3464, level: 0 });
assert.equal(edge.forced.length, 0, "plane-change jump-off has no forced movement");
assert.deepEqual(edge.xp, [435]);
assert(edge.messages.some((m) => /completed the Seers' Village rooftop course/i.test(m)));
assert.equal(getSeersCourseStage(1), 0);

resetSeersCourseProgress(2);
const skipToEnd = makeSession(2, 2702, 3464, 2);
skipToEnd.run(14931, { x: 2703, y: 3461 }, 2, "jump");
assert.deepEqual(skipToEnd.xp, [435], "final edge without a lap awards obstacle XP only");
assert.equal(
    skipToEnd.messages.some((m) => /completed the Seers' Village rooftop course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 2729, 3489, 0);
defaultAction.run(14927, { x: 2729, y: 3489 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 2729, y: 3491, level: 3 });
assert.deepEqual(defaultAction.xp, [45]);

const climbUp = makeSession(4, 2729, 3489, 0);
climbUp.run(14927, { x: 2729, y: 3489 }, 0, "climb-up");
assert.deepEqual(climbUp.teleports[0], { x: 2729, y: 3491, level: 3 });
assert.deepEqual(climbUp.xp, [45]);

console.log("agility-seers-course.test.ts: all assertions passed");