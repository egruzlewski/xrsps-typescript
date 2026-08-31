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
    getColossalWyrmCourseStage,
    isColossalWyrmAdvancedLap,
    register,
    resetColossalWyrmCourseProgress,
} from "../gamemodes/vanilla/skills/agility/colossalWyrm";

resetColossalWyrmCourseProgress();

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

const tooLow = makeSession(9, 1652, 2931, 0, 49);
tooLow.run(55178, { x: 1652, y: 2931 }, 0, "climb");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 50/i.test(m)));
assert.equal(getColossalWyrmCourseStage(9), 0);

const start = makeSession(1, 1652, 2931, 0);
start.run(55178, { x: 1652, y: 2931 }, 0, "climb");
assert.deepEqual(start.teleports[0], { x: 1652, y: 2929, level: 1 });
assert.equal(start.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(start.xp, [37.2]);
assert.equal(getColossalWyrmCourseStage(1), 1);
assert(start.messages.some((m) => /climb the ladder/i.test(m)));

const rope1 = makeSession(1, 1652, 2929, 1);
rope1.run(55180, { x: 1655, y: 2925 }, 1, "cross");
assert.deepEqual(rope1.teleports[0], { x: 1648, y: 2910, level: 1 });
assert.equal(rope1.forced.length, 1);
assert.deepEqual(rope1.xp, [74.4]);
assert.equal(getColossalWyrmCourseStage(1), 2);

const basicRope2 = makeSession(1, 1648, 2910, 1);
basicRope2.run(55184, { x: 1646, y: 2910 }, 1, "cross");
assert.deepEqual(basicRope2.teleports[0], { x: 1631, y: 2910, level: 1 });
assert.equal(basicRope2.forced.length, 1);
assert.deepEqual(basicRope2.xp, [37.2]);
assert.equal(getColossalWyrmCourseStage(1), 3);
assert.equal(isColossalWyrmAdvancedLap(1), false);

const basicHang = makeSession(1, 1631, 2910, 1);
basicHang.run(55186, { x: 1631, y: 2910 }, 1, "climb");
assert.deepEqual(basicHang.teleports[0], { x: 1626, y: 2932, level: 1 });
assert.equal(basicHang.forced.length, 1);
assert.deepEqual(basicHang.xp, [74.4]);
assert.equal(getColossalWyrmCourseStage(1), 4);

const basicLadder = makeSession(1, 1626, 2932, 1);
basicLadder.run(55190, { x: 1626, y: 2932 }, 1, "climb");
assert.deepEqual(basicLadder.teleports[0], { x: 1626, y: 2933, level: 1 });
assert.equal(basicLadder.forced.length, 0);
assert.deepEqual(basicLadder.xp, [37.2]);
assert.equal(getColossalWyrmCourseStage(1), 5);

const basicZip = makeSession(1, 1626, 2933, 1);
basicZip.run(55179, { x: 1626, y: 2933 }, 1, "slide");
assert.deepEqual(basicZip.teleports[0], { x: 1652, y: 2931, level: 0 });
assert.equal(basicZip.forced.length, 0, "plane-change zipline has no forced movement");
assert.deepEqual(basicZip.xp, [372.6]);
assert(basicZip.messages.some((m) => /completed the Colossal Wyrm basic course/i.test(m)));
assert.equal(getColossalWyrmCourseStage(1), 0);
assert.equal(37.2 + 74.4 + 37.2 + 74.4 + 37.2 + 372.6, 633);

resetColossalWyrmCourseProgress(2);
const skipToEnd = makeSession(2, 1626, 2933, 1);
skipToEnd.run(55179, { x: 1626, y: 2933 }, 1, "slide");
assert.deepEqual(skipToEnd.xp, [372.6], "zipline without a lap awards basic zipline XP only");
assert.equal(
    skipToEnd.messages.some((m) => /completed the Colossal Wyrm/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 1652, 2931, 0);
defaultAction.run(55178, { x: 1652, y: 2931 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 1652, y: 2929, level: 1 });
assert.deepEqual(defaultAction.xp, [37.2]);

const blockedAdv = makeSession(4, 1648, 2910, 1, 61);
blockedAdv.run(55178, { x: 1652, y: 2931 }, 0, "climb");
blockedAdv.run(55180, { x: 1655, y: 2925 }, 1, "cross");
blockedAdv.run(55191, { x: 1648, y: 2909 }, 1, "climb");
assert.equal(blockedAdv.teleports.length, 2, "advanced ladder blocked below 62");
assert(blockedAdv.messages.some((m) => /Agility level of 62/i.test(m)));
assert.equal(getColossalWyrmCourseStage(4), 2);

resetColossalWyrmCourseProgress(5);
const adv = makeSession(5, 1652, 2931, 0, 62);
adv.run(55178, { x: 1652, y: 2931 }, 0, "climb");
adv.run(55180, { x: 1655, y: 2925 }, 1, "cross");
assert.equal(getColossalWyrmCourseStage(5), 2);

adv.run(55191, { x: 1648, y: 2909 }, 1, "climb");
assert.deepEqual(adv.teleports[2], { x: 1646, y: 2907, level: 2 });
assert.equal(isColossalWyrmAdvancedLap(5), true);
assert.equal(getColossalWyrmCourseStage(5), 3);

adv.run(55192, { x: 1646, y: 2907 }, 2, "jump");
assert.deepEqual(adv.teleports[3], { x: 1633, y: 2908, level: 2 });
assert.equal(getColossalWyrmCourseStage(5), 4);

adv.run(55194, { x: 1633, y: 2908 }, 2, "cross");
assert.deepEqual(adv.teleports[4], { x: 1626, y: 2933, level: 1 });
assert.equal(adv.forced.length, 2, "shared tightrope and advanced edge use forced movement");
assert.equal(getColossalWyrmCourseStage(5), 5);

adv.run(55179, { x: 1626, y: 2933 }, 1, "slide");
assert.deepEqual(adv.teleports[5], { x: 1652, y: 2931, level: 0 });
assert.deepEqual(adv.xp, [37.2, 74.4, 70, 70, 140, 662]);
assert.equal(adv.xp.reduce((a, b) => a + b, 0), 1053.6);
assert(adv.messages.some((m) => /completed the Colossal Wyrm advanced course/i.test(m)));
assert.equal(getColossalWyrmCourseStage(5), 0);
assert.equal(isColossalWyrmAdvancedLap(5), false);

console.log("agility-colossal-wyrm-course.test.ts: all assertions passed");
