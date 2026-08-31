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
    getAlKharidCourseStage,
    register,
    resetAlKharidCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetAlKharidCourseProgress();

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

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 20) {
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

const tooLow = makeSession(9, 3273, 3195, 0, 19);
tooLow.run(11633, { x: 3273, y: 3195 }, 0, "climb");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 20/i.test(m)));
assert.equal(getAlKharidCourseStage(9), 0);

const wall = makeSession(1, 3273, 3195, 0);
wall.run(11633, { x: 3273, y: 3195 }, 0, "climb");
assert.deepEqual(wall.teleports[0], { x: 3273, y: 3192, level: 3 });
assert.equal(wall.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(wall.xp, [12]);
assert.equal(getAlKharidCourseStage(1), 1);
assert(wall.messages.some((m) => /climb the wall/i.test(m)));

const rope1 = makeSession(1, 3272, 3182, 3);
rope1.run(14398, { x: 3272, y: 3181 }, 3, "cross");
assert.deepEqual(rope1.teleports[0], { x: 3272, y: 3172, level: 3 });
assert.equal(rope1.forced.length, 1);
assert.deepEqual(rope1.xp, [36]);
assert.equal(getAlKharidCourseStage(1), 2);

const cable = makeSession(1, 3268, 3166, 3);
cable.run(14402, { x: 3269, y: 3166 }, 3, "swing-across");
assert.deepEqual(cable.teleports[0], { x: 3284, y: 3166, level: 3 });
assert.equal(cable.forced.length, 1);
assert.deepEqual(cable.xp, [48]);
assert.equal(getAlKharidCourseStage(1), 3);

const zip = makeSession(1, 3301, 3163, 3);
zip.run(14403, { x: 3302, y: 3163 }, 3, "teeth-grip");
assert.deepEqual(zip.teleports[0], { x: 3315, y: 3163, level: 1 });
assert.equal(zip.forced.length, 0, "plane-change zip has no forced movement");
assert.deepEqual(zip.xp, [48]);
assert.equal(getAlKharidCourseStage(1), 4);

const tree = makeSession(1, 3318, 3165, 1);
tree.run(14404, { x: 3318, y: 3166 }, 1, "swing-across");
assert.deepEqual(tree.teleports[0], { x: 3317, y: 3174, level: 2 });
assert.equal(tree.forced.length, 0, "plane-change tree swing has no forced movement");
assert.deepEqual(tree.xp, [12]);
assert.equal(getAlKharidCourseStage(1), 5);

const beams = makeSession(1, 3316, 3179, 2);
beams.run(11634, { x: 3316, y: 3179 }, 2, "climb");
assert.deepEqual(beams.teleports[0], { x: 3316, y: 3180, level: 3 });
assert.equal(beams.forced.length, 0, "plane-change beams climb has no forced movement");
assert.deepEqual(beams.xp, [6]);
assert.equal(getAlKharidCourseStage(1), 6);

const rope2 = makeSession(1, 3314, 3186, 3);
rope2.run(14409, { x: 3313, y: 3186 }, 3, "cross");
assert.deepEqual(rope2.teleports[0], { x: 3302, y: 3187, level: 3 });
assert.equal(rope2.forced.length, 1);
assert.deepEqual(rope2.xp, [18]);
assert.equal(getAlKharidCourseStage(1), 7);

const gap = makeSession(1, 3300, 3192, 3);
gap.run(14399, { x: 3300, y: 3193 }, 3, "jump");
assert.deepEqual(gap.teleports[0], { x: 3299, y: 3194, level: 0 });
assert.equal(gap.forced.length, 0, "plane-change gap jump has no forced movement");
assert.deepEqual(gap.xp, [36]);
assert(gap.messages.some((m) => /completed the Al Kharid rooftop course/i.test(m)));
assert.equal(getAlKharidCourseStage(1), 0);

resetAlKharidCourseProgress(2);
const skipToGap = makeSession(2, 3300, 3192, 3);
skipToGap.run(14399, { x: 3300, y: 3193 }, 3, "jump");
assert.deepEqual(skipToGap.xp, [36], "gap without a lap awards obstacle XP only");
assert.equal(
    skipToGap.messages.some((m) => /completed the Al Kharid rooftop course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 3273, 3195, 0);
defaultAction.run(11633, { x: 3273, y: 3195 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 3273, y: 3192, level: 3 });
assert.deepEqual(defaultAction.xp, [12]);

console.log("agility-alkharid-course.test.ts: all assertions passed");
