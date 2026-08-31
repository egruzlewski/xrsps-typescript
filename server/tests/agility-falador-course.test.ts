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
    getFaladorCourseStage,
    register,
    resetFaladorCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetFaladorCourseProgress();

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

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 50) {
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

const tooLow = makeSession(9, 3036, 3341, 0, 49);
tooLow.run(14898, { x: 3036, y: 3341 }, 0, "climb");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 50/i.test(m)));
assert.equal(getFaladorCourseStage(9), 0);

const wall = makeSession(1, 3036, 3341, 0);
wall.run(14898, { x: 3036, y: 3341 }, 0, "climb");
assert.deepEqual(wall.teleports[0], { x: 3036, y: 3342, level: 3 });
assert.equal(wall.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(wall.xp, [11]);
assert.equal(getFaladorCourseStage(1), 1);
assert(wall.messages.some((m) => /climb the wall/i.test(m)));

const rope1 = makeSession(1, 3039, 3343, 3);
rope1.run(14899, { x: 3040, y: 3343 }, 3, "cross");
assert.deepEqual(rope1.teleports[0], { x: 3047, y: 3344, level: 3 });
assert.equal(rope1.forced.length, 1);
assert.deepEqual(rope1.xp, [22]);
assert.equal(getFaladorCourseStage(1), 2);

const holds = makeSession(1, 3050, 3349, 3);
holds.run(14901, { x: 3050, y: 3350 }, 3, "cross");
assert.deepEqual(holds.teleports[0], { x: 3050, y: 3357, level: 3 });
assert.equal(holds.forced.length, 1);
assert.deepEqual(holds.xp, [61]);
assert.equal(getFaladorCourseStage(1), 3);

const gap1 = makeSession(1, 3048, 3358, 3);
gap1.run(14903, { x: 3048, y: 3359 }, 3, "jump");
assert.deepEqual(gap1.teleports[0], { x: 3048, y: 3361, level: 3 });
assert.equal(gap1.forced.length, 1);
assert.deepEqual(gap1.xp, [27]);
assert.equal(getFaladorCourseStage(1), 4);

const gap2 = makeSession(1, 3045, 3361, 3);
gap2.run(14904, { x: 3044, y: 3361 }, 3, "jump");
assert.deepEqual(gap2.teleports[0], { x: 3041, y: 3361, level: 3 });
assert.equal(gap2.forced.length, 1);
assert.deepEqual(gap2.xp, [26]);
assert.equal(getFaladorCourseStage(1), 5);

const rope2 = makeSession(1, 3035, 3362, 3);
rope2.run(14905, { x: 3034, y: 3361 }, 3, "cross");
assert.deepEqual(rope2.teleports[0], { x: 3028, y: 3354, level: 3 });
assert.equal(rope2.forced.length, 1);
assert.deepEqual(rope2.xp, [61]);
assert.equal(getFaladorCourseStage(1), 6);

const rope3 = makeSession(1, 3027, 3353, 3);
rope3.run(14911, { x: 3026, y: 3353 }, 3, "cross");
assert.deepEqual(rope3.teleports[0], { x: 3020, y: 3353, level: 3 });
assert.equal(rope3.forced.length, 1);
assert.deepEqual(rope3.xp, [53]);
assert.equal(getFaladorCourseStage(1), 7);

const gap3 = makeSession(1, 3016, 3352, 3);
gap3.run(14919, { x: 3016, y: 3352 }, 3, "jump");
assert.deepEqual(gap3.teleports[0], { x: 3016, y: 3349, level: 3 });
assert.equal(gap3.forced.length, 1);
assert.deepEqual(gap3.xp, [30]);
assert.equal(getFaladorCourseStage(1), 8);

const ledge1 = makeSession(1, 3017, 3345, 3);
ledge1.run(14920, { x: 3015, y: 3345 }, 3, "jump");
assert.deepEqual(ledge1.teleports[0], { x: 3014, y: 3345, level: 3 });
assert.equal(ledge1.forced.length, 1);
assert.deepEqual(ledge1.xp, [14]);
assert.equal(getFaladorCourseStage(1), 9);

const ledge2 = makeSession(1, 3011, 3344, 3);
ledge2.run(14921, { x: 3011, y: 3343 }, 3, "jump");
assert.deepEqual(ledge2.teleports[0], { x: 3011, y: 3342, level: 3 });
assert.equal(ledge2.forced.length, 1);
assert.deepEqual(ledge2.xp, [13]);
assert.equal(getFaladorCourseStage(1), 10);

const ledge3 = makeSession(1, 3012, 3335, 3);
ledge3.run(14922, { x: 3012, y: 3334 }, 3, "jump");
assert.deepEqual(ledge3.teleports[0], { x: 3012, y: 3333, level: 3 });
assert.equal(ledge3.forced.length, 1);
assert.deepEqual(ledge3.xp, [13]);
assert.equal(getFaladorCourseStage(1), 11);

const ledge4 = makeSession(1, 3017, 3332, 3);
ledge4.run(14924, { x: 3018, y: 3332 }, 3, "jump");
assert.deepEqual(ledge4.teleports[0], { x: 3019, y: 3332, level: 3 });
assert.equal(ledge4.forced.length, 1);
assert.deepEqual(ledge4.xp, [14]);
assert.equal(getFaladorCourseStage(1), 12);

const edge = makeSession(1, 3024, 3332, 3);
edge.run(14925, { x: 3025, y: 3332 }, 3, "jump");
assert.deepEqual(edge.teleports[0], { x: 3029, y: 3332, level: 0 });
assert.equal(edge.forced.length, 0, "plane-change jump-off has no forced movement");
assert.deepEqual(edge.xp, [241]);
assert(edge.messages.some((m) => /completed the Falador rooftop course/i.test(m)));
assert.equal(getFaladorCourseStage(1), 0);

resetFaladorCourseProgress(2);
const skipToEnd = makeSession(2, 3024, 3332, 3);
skipToEnd.run(14925, { x: 3025, y: 3332 }, 3, "jump");
assert.deepEqual(skipToEnd.xp, [241], "final edge without a lap awards obstacle XP only");
assert.equal(
    skipToEnd.messages.some((m) => /completed the Falador rooftop course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 3036, 3341, 0);
defaultAction.run(14898, { x: 3036, y: 3341 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 3036, y: 3342, level: 3 });
assert.deepEqual(defaultAction.xp, [11]);

console.log("agility-falador-course.test.ts: all assertions passed");
