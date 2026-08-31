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
    getPollnivneachCourseStage,
    register,
    resetPollnivneachCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetPollnivneachCourseProgress();

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

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 70) {
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

const tooLow = makeSession(9, 3351, 2962, 0, 69);
tooLow.run(14935, { x: 3351, y: 2962 }, 0, "climb-on");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 70/i.test(m)));
assert.equal(getPollnivneachCourseStage(9), 0);

const basket = makeSession(1, 3351, 2962, 0);
basket.run(14935, { x: 3351, y: 2962 }, 0, "climb-on");
assert.deepEqual(basket.teleports[0], { x: 3351, y: 2964, level: 1 });
assert.equal(basket.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(basket.xp, [10]);
assert.equal(getPollnivneachCourseStage(1), 1);
assert(basket.messages.some((m) => /climb on the basket/i.test(m)));

const stall = makeSession(1, 3350, 2968, 1);
stall.run(14936, { x: 3349, y: 2970 }, 1, "jump-on");
assert.deepEqual(stall.teleports[0], { x: 3352, y: 2973, level: 1 });
assert.equal(stall.forced.length, 1);
assert.deepEqual(stall.xp, [45]);
assert.equal(getPollnivneachCourseStage(1), 2);

const banner = makeSession(1, 3355, 2976, 1);
banner.run(14937, { x: 3356, y: 2978 }, 1, "grab");
assert.deepEqual(banner.teleports[0], { x: 3360, y: 2977, level: 1 });
assert.equal(banner.forced.length, 1);
assert.deepEqual(banner.xp, [65]);
assert.equal(getPollnivneachCourseStage(1), 3);

const gap = makeSession(1, 3362, 2977, 1);
gap.run(14938, { x: 3363, y: 2976 }, 1, "leap");
assert.deepEqual(gap.teleports[0], { x: 3366, y: 2976, level: 1 });
assert.equal(gap.forced.length, 1);
assert.deepEqual(gap.xp, [35]);
assert.equal(getPollnivneachCourseStage(1), 4);

const tree1 = makeSession(1, 3368, 2976, 1);
tree1.run(14939, { x: 3367, y: 2977 }, 1, "jump-to");
assert.deepEqual(tree1.teleports[0], { x: 3368, y: 2982, level: 1 });
assert.equal(tree1.forced.length, 1);
assert.deepEqual(tree1.xp, [75]);
assert.equal(getPollnivneachCourseStage(1), 5);

const wall = makeSession(1, 3365, 2982, 1);
wall.run(14940, { x: 3365, y: 2982 }, 1, "climb");
assert.deepEqual(wall.teleports[0], { x: 3365, y: 2983, level: 2 });
assert.equal(wall.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(wall.xp, [5]);
assert.equal(getPollnivneachCourseStage(1), 6);

const bars = makeSession(1, 3358, 2984, 2);
bars.run(14941, { x: 3358, y: 2985 }, 2, "cross");
assert.deepEqual(bars.teleports[0], { x: 3358, y: 2991, level: 2 });
assert.equal(bars.forced.length, 1);
assert.deepEqual(bars.xp, [55]);
assert.equal(getPollnivneachCourseStage(1), 7);

const tree2 = makeSession(1, 3359, 2995, 2);
tree2.run(14944, { x: 3359, y: 2996 }, 2, "jump-on");
assert.deepEqual(tree2.teleports[0], { x: 3359, y: 3000, level: 2 });
assert.equal(tree2.forced.length, 1);
assert.deepEqual(tree2.xp, [60]);
assert.equal(getPollnivneachCourseStage(1), 8);

const line = makeSession(1, 3362, 3002, 2);
line.run(14945, { x: 3363, y: 3000 }, 2, "jump-to");
assert.deepEqual(line.teleports[0], { x: 3363, y: 2998, level: 0 });
assert.equal(line.forced.length, 0, "plane-change jump-off has no forced movement");
assert.deepEqual(line.xp, [540]);
assert(line.messages.some((m) => /completed the Pollnivneach rooftop course/i.test(m)));
assert.equal(getPollnivneachCourseStage(1), 0);

resetPollnivneachCourseProgress(2);
const skipToEnd = makeSession(2, 3362, 3002, 2);
skipToEnd.run(14945, { x: 3363, y: 3000 }, 2, "jump-to");
assert.deepEqual(skipToEnd.xp, [540], "final drying line without a lap awards obstacle XP only");
assert.equal(
    skipToEnd.messages.some((m) => /completed the Pollnivneach rooftop course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 3351, 2962, 0);
defaultAction.run(14935, { x: 3351, y: 2962 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 3351, y: 2964, level: 1 });
assert.deepEqual(defaultAction.xp, [10]);

const climbOn = makeSession(4, 3351, 2962, 0);
climbOn.run(14935, { x: 3351, y: 2962 }, 0, "climb");
assert.deepEqual(climbOn.teleports[0], { x: 3351, y: 2964, level: 1 });
assert.deepEqual(climbOn.xp, [10]);

console.log("agility-pollnivneach-course.test.ts: all assertions passed");