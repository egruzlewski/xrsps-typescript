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
    getRellekkaCourseStage,
    register,
    resetRellekkaCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetRellekkaCourseProgress();

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

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 80) {
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

const tooLow = makeSession(9, 2625, 3677, 0, 79);
tooLow.run(14946, { x: 2625, y: 3677 }, 0, "climb");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 80/i.test(m)));
assert.equal(getRellekkaCourseStage(9), 0);

const wall = makeSession(1, 2625, 3677, 0);
wall.run(14946, { x: 2625, y: 3677 }, 0, "climb");
assert.deepEqual(wall.teleports[0], { x: 2625, y: 3676, level: 3 });
assert.equal(wall.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(wall.xp, [20]);
assert.equal(getRellekkaCourseStage(1), 1);
assert(wall.messages.some((m) => /climb the wall/i.test(m)));

const gap1 = makeSession(1, 2622, 3672, 3);
gap1.run(14947, { x: 2621, y: 3669 }, 3, "leap");
assert.deepEqual(gap1.teleports[0], { x: 2622, y: 3668, level: 3 });
assert.equal(gap1.forced.length, 1);
assert.deepEqual(gap1.xp, [30]);
assert.equal(getRellekkaCourseStage(1), 2);

const rope1 = makeSession(1, 2622, 3658, 3);
rope1.run(14987, { x: 2623, y: 3658 }, 3, "cross");
assert.deepEqual(rope1.teleports[0], { x: 2627, y: 3654, level: 3 });
assert.equal(rope1.forced.length, 1);
assert.deepEqual(rope1.xp, [40]);
assert.equal(getRellekkaCourseStage(1), 3);

const gap2 = makeSession(1, 2629, 3655, 3);
gap2.run(14990, { x: 2629, y: 3656 }, 3, "leap");
assert.deepEqual(gap2.teleports[0], { x: 2639, y: 3653, level: 3 });
assert.equal(gap2.forced.length, 1);
assert.deepEqual(gap2.xp, [85]);
assert.equal(getRellekkaCourseStage(1), 4);

const gap3 = makeSession(1, 2642, 3653, 3);
gap3.run(14991, { x: 2643, y: 3654 }, 3, "hurdle");
assert.deepEqual(gap3.teleports[0], { x: 2643, y: 3657, level: 3 });
assert.equal(gap3.forced.length, 1);
assert.deepEqual(gap3.xp, [25]);
assert.equal(getRellekkaCourseStage(1), 5);

const rope2 = makeSession(1, 2647, 3662, 3);
rope2.run(14992, { x: 2647, y: 3663 }, 3, "cross");
assert.deepEqual(rope2.teleports[0], { x: 2655, y: 3670, level: 3 });
assert.equal(rope2.forced.length, 1);
assert.deepEqual(rope2.xp, [105]);
assert.equal(getRellekkaCourseStage(1), 6);

const fish = makeSession(1, 2655, 3674, 3);
fish.run(14994, { x: 2654, y: 3676 }, 3, "jump-in");
assert.deepEqual(fish.teleports[0], { x: 2653, y: 3676, level: 0 });
assert.equal(fish.forced.length, 0, "plane-change jump-in has no forced movement");
assert.deepEqual(fish.xp, [475]);
assert(fish.messages.some((m) => /completed the Rellekka rooftop course/i.test(m)));
assert.equal(getRellekkaCourseStage(1), 0);

resetRellekkaCourseProgress(2);
const skipToEnd = makeSession(2, 2655, 3674, 3);
skipToEnd.run(14994, { x: 2654, y: 3676 }, 3, "jump-in");
assert.deepEqual(skipToEnd.xp, [475], "final pile of fish without a lap awards obstacle XP only");
assert.equal(
    skipToEnd.messages.some((m) => /completed the Rellekka rooftop course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 2625, 3677, 0);
defaultAction.run(14946, { x: 2625, y: 3677 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 2625, y: 3676, level: 3 });
assert.deepEqual(defaultAction.xp, [20]);

const climbUp = makeSession(4, 2625, 3677, 0);
climbUp.run(14946, { x: 2625, y: 3677 }, 0, "climb-up");
assert.deepEqual(climbUp.teleports[0], { x: 2625, y: 3676, level: 3 });
assert.deepEqual(climbUp.xp, [20]);

console.log("agility-rellekka-course.test.ts: all assertions passed");
