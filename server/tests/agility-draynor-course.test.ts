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
    getDraynorCourseStage,
    register,
    resetDraynorCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetDraynorCourseProgress();

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

function makeSession(playerId: number, tileX: number, tileY: number, level: number) {
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
            getSkill: () => ({ baseLevel: 1, boost: 0 }),
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

const wall = makeSession(1, 3103, 3280, 0);
wall.run(11404, { x: 3103, y: 3279 }, 0, "climb");
assert.deepEqual(wall.teleports[0], { x: 3105, y: 3279, level: 3 });
assert.equal(wall.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(wall.xp, [5]);
assert.equal(getDraynorCourseStage(1), 1);
assert(wall.messages.some((m) => /climb the wall/i.test(m)));

const rope1 = makeSession(1, 3102, 3279, 3);
rope1.run(11405, { x: 3098, y: 3277 }, 3, "cross");
assert.deepEqual(rope1.teleports[0], { x: 3090, y: 3276, level: 3 });
assert.equal(rope1.forced.length, 1);
assert.deepEqual(rope1.xp, [8]);
assert.equal(getDraynorCourseStage(1), 2);

const rope2 = makeSession(1, 3090, 3276, 3);
rope2.run(11406, { x: 3092, y: 3276 }, 3, "cross");
assert.deepEqual(rope2.teleports[0], { x: 3092, y: 3266, level: 3 });
assert.equal(rope2.forced.length, 1);
assert.deepEqual(rope2.xp, [7]);
assert.equal(getDraynorCourseStage(1), 3);

const narrow = makeSession(1, 3092, 3266, 3);
narrow.run(11430, { x: 3088, y: 3263 }, 3, "balance");
assert.deepEqual(narrow.teleports[0], { x: 3088, y: 3258, level: 3 });
assert.deepEqual(narrow.xp, [7]);
assert.equal(getDraynorCourseStage(1), 4);

const jumpUp = makeSession(1, 3088, 3258, 3);
jumpUp.run(11630, { x: 3088, y: 3256 }, 3, "jump-up");
assert.deepEqual(jumpUp.teleports[0], { x: 3088, y: 3255, level: 3 });
assert.deepEqual(jumpUp.xp, [10]);
assert.equal(getDraynorCourseStage(1), 5);

const gap = makeSession(1, 3088, 3255, 3);
gap.run(11631, { x: 3095, y: 3255 }, 3, "jump");
assert.deepEqual(gap.teleports[0], { x: 3096, y: 3256, level: 3 });
assert.deepEqual(gap.xp, [4]);
assert.equal(getDraynorCourseStage(1), 6);

const crate = makeSession(1, 3096, 3256, 3);
crate.run(11632, { x: 3102, y: 3261 }, 3, "climb-down");
assert.deepEqual(crate.teleports[0], { x: 3103, y: 3261, level: 0 });
assert.equal(crate.forced.length, 0, "plane-change climb-down has no forced movement");
assert.deepEqual(crate.xp, [79]);
assert(crate.messages.some((m) => /completed the Draynor Village rooftop course/i.test(m)));
assert.equal(getDraynorCourseStage(1), 0);

resetDraynorCourseProgress(2);
const skipToCrate = makeSession(2, 3102, 3261, 3);
skipToCrate.run(11632, { x: 3102, y: 3261 }, 3, "climb-down");
assert.deepEqual(skipToCrate.xp, [79], "crate without a lap awards obstacle XP only");
assert.equal(
    skipToCrate.messages.some((m) => /completed the Draynor Village rooftop course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 3103, 3280, 0);
defaultAction.run(11404, { x: 3103, y: 3279 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 3105, y: 3279, level: 3 });
assert.deepEqual(defaultAction.xp, [5]);

console.log("agility-draynor-course.test.ts: all assertions passed");
