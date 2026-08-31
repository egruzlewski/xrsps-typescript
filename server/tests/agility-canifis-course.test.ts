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
    getCanifisCourseStage,
    register,
    resetCanifisCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetCanifisCourseProgress();

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

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 40) {
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

const tooLow = makeSession(9, 3508, 3489, 0, 39);
tooLow.run(14843, { x: 3508, y: 3489 }, 0, "climb");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 40/i.test(m)));
assert.equal(getCanifisCourseStage(9), 0);

const tree = makeSession(1, 3508, 3489, 0);
tree.run(14843, { x: 3508, y: 3489 }, 0, "climb");
assert.deepEqual(tree.teleports[0], { x: 3506, y: 3492, level: 2 });
assert.equal(tree.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(tree.xp, [10]);
assert.equal(getCanifisCourseStage(1), 1);
assert(tree.messages.some((m) => /climb the tree/i.test(m)));

const gap1 = makeSession(1, 3505, 3498, 2);
gap1.run(14844, { x: 3505, y: 3498 }, 2, "jump");
assert.deepEqual(gap1.teleports[0], { x: 3502, y: 3504, level: 2 });
assert.equal(gap1.forced.length, 1);
assert.deepEqual(gap1.xp, [8]);
assert.equal(getCanifisCourseStage(1), 2);

const gap2 = makeSession(1, 3496, 3504, 2);
gap2.run(14845, { x: 3496, y: 3504 }, 2, "jump");
assert.deepEqual(gap2.teleports[0], { x: 3492, y: 3504, level: 2 });
assert.equal(gap2.forced.length, 1);
assert.deepEqual(gap2.xp, [8]);
assert.equal(getCanifisCourseStage(1), 3);

const gap3 = makeSession(1, 3485, 3499, 2);
gap3.run(14848, { x: 3485, y: 3499 }, 2, "jump");
assert.deepEqual(gap3.teleports[0], { x: 3479, y: 3499, level: 3 });
assert.equal(gap3.forced.length, 0, "plane-change gap has no forced movement");
assert.deepEqual(gap3.xp, [10]);
assert.equal(getCanifisCourseStage(1), 4);

const gap4 = makeSession(1, 3478, 3491, 3);
gap4.run(14846, { x: 3478, y: 3491 }, 3, "jump");
assert.deepEqual(gap4.teleports[0], { x: 3478, y: 3486, level: 2 });
assert.equal(gap4.forced.length, 0, "plane-change gap has no forced movement");
assert.deepEqual(gap4.xp, [8]);
assert.equal(getCanifisCourseStage(1), 5);

const pole = makeSession(1, 3480, 3483, 2);
pole.run(14894, { x: 3480, y: 3483 }, 2, "vault");
assert.deepEqual(pole.teleports[0], { x: 3489, y: 3476, level: 3 });
assert.equal(pole.forced.length, 0, "plane-change vault has no forced movement");
assert.deepEqual(pole.xp, [10]);
assert.equal(getCanifisCourseStage(1), 6);

const gap5 = makeSession(1, 3503, 3476, 3);
gap5.run(14847, { x: 3503, y: 3476 }, 3, "jump");
assert.deepEqual(gap5.teleports[0], { x: 3510, y: 3476, level: 2 });
assert.equal(gap5.forced.length, 0, "plane-change gap has no forced movement");
assert.deepEqual(gap5.xp, [11]);
assert.equal(getCanifisCourseStage(1), 7);

const gap6 = makeSession(1, 3510, 3483, 2);
gap6.run(14897, { x: 3510, y: 3483 }, 2, "jump");
assert.deepEqual(gap6.teleports[0], { x: 3510, y: 3485, level: 0 });
assert.equal(gap6.forced.length, 0, "plane-change jump-off has no forced movement");
assert.deepEqual(gap6.xp, [175]);
assert(gap6.messages.some((m) => /completed the Canifis rooftop course/i.test(m)));
assert.equal(getCanifisCourseStage(1), 0);

resetCanifisCourseProgress(2);
const skipToEnd = makeSession(2, 3510, 3483, 2);
skipToEnd.run(14897, { x: 3510, y: 3483 }, 2, "jump");
assert.deepEqual(skipToEnd.xp, [175], "final gap without a lap awards obstacle XP only");
assert.equal(
    skipToEnd.messages.some((m) => /completed the Canifis rooftop course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 3508, 3489, 0);
defaultAction.run(14843, { x: 3508, y: 3489 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 3506, y: 3492, level: 2 });
assert.deepEqual(defaultAction.xp, [10]);

console.log("agility-canifis-course.test.ts: all assertions passed");
