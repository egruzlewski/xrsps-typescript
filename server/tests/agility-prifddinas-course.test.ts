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
    getPrifddinasCourseStage,
    register,
    resetPrifddinasCourseProgress,
} from "../gamemodes/vanilla/skills/agility/prifddinas";

resetPrifddinasCourseProgress();

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

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 75) {
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

const tooLow = makeSession(9, 3254, 6109, 0, 74);
tooLow.run(36221, { x: 3254, y: 6109 }, 0, "climb");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 75/i.test(m)));
assert.equal(getPrifddinasCourseStage(9), 0);

const ladder = makeSession(1, 3254, 6109, 0);
ladder.run(36221, { x: 3254, y: 6109 }, 0, "climb");
assert.deepEqual(ladder.teleports[0], { x: 3254, y: 6107, level: 2 });
assert.equal(ladder.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(ladder.xp, [11.5]);
assert.equal(getPrifddinasCourseStage(1), 1);
assert(ladder.messages.some((m) => /climb the ladder/i.test(m)));

const rope1 = makeSession(1, 3257, 6106, 2);
rope1.run(36225, { x: 3257, y: 6105 }, 2, "cross");
assert.deepEqual(rope1.teleports[0], { x: 3272, y: 6107, level: 2 });
assert.equal(rope1.forced.length, 1);
assert.deepEqual(rope1.xp, [30.7]);
assert.equal(getPrifddinasCourseStage(1), 2);

const chimney = makeSession(1, 3272, 6107, 2);
chimney.run(36227, { x: 3273, y: 6107 }, 2, "jump");
assert.deepEqual(chimney.teleports[0], { x: 3269, y: 6115, level: 2 });
assert.equal(chimney.forced.length, 1);
assert.deepEqual(chimney.xp, [28.1]);
assert.equal(getPrifddinasCourseStage(1), 3);

const edge = makeSession(1, 3269, 6116, 2);
edge.run(36228, { x: 3269, y: 6116 }, 2, "jump");
assert.deepEqual(edge.teleports[0], { x: 3269, y: 6118, level: 0 });
assert.equal(edge.forced.length, 0, "plane-change roof-edge jump has no forced movement");
assert.deepEqual(edge.xp, [23]);
assert.equal(getPrifddinasCourseStage(1), 4);

const hole1 = makeSession(1, 3269, 6118, 0);
hole1.run(36229, { x: 3269, y: 6118 }, 0, "enter");
assert.deepEqual(hole1.teleports[0], { x: 3294, y: 6145, level: 0 });
assert.equal(hole1.forced.length, 0, "dark-hole teleport has no forced movement");
assert.deepEqual(hole1.xp, [11.5]);
assert.equal(getPrifddinasCourseStage(1), 5);

const tree = makeSession(1, 3294, 6145, 0);
tree.run(36231, { x: 3294, y: 6145 }, 0, "climb");
assert.deepEqual(tree.teleports[0], { x: 3288, y: 6142, level: 2 });
assert.equal(tree.forced.length, 0, "plane-change climb has no forced movement");
assert.deepEqual(tree.xp, [], "tree ladder awards 0 XP");
assert.equal(getPrifddinasCourseStage(1), 6);

const bridge1 = makeSession(1, 3288, 6142, 2);
bridge1.run(36233, { x: 3288, y: 6142 }, 2, "cross");
assert.deepEqual(bridge1.teleports[0], { x: 3277, y: 6142, level: 2 });
assert.equal(bridge1.forced.length, 1);
assert.deepEqual(bridge1.xp, [25.6]);
assert.equal(getPrifddinasCourseStage(1), 7);

const rope2 = makeSession(1, 3277, 6142, 2);
rope2.run(36234, { x: 3277, y: 6142 }, 2, "cross");
assert.deepEqual(rope2.teleports[0], { x: 3270, y: 6151, level: 2 });
assert.equal(rope2.forced.length, 1);
assert.deepEqual(rope2.xp, [30.7]);
assert.equal(getPrifddinasCourseStage(1), 8);

const bridge2 = makeSession(1, 3270, 6151, 2);
bridge2.run(36235, { x: 3270, y: 6151 }, 2, "cross");
assert.deepEqual(bridge2.teleports[0], { x: 3267, y: 6161, level: 2 });
assert.equal(bridge2.forced.length, 1);
assert.deepEqual(bridge2.xp, [25.6]);
assert.equal(getPrifddinasCourseStage(1), 9);

const rope3 = makeSession(1, 3267, 6161, 2);
rope3.run(36236, { x: 3267, y: 6161 }, 2, "cross");
assert.deepEqual(rope3.teleports[0], { x: 3277, y: 6170, level: 2 });
assert.equal(rope3.forced.length, 1);
assert.deepEqual(rope3.xp, [30.7]);
assert.equal(getPrifddinasCourseStage(1), 10);

const rope4 = makeSession(1, 3277, 6170, 2);
rope4.run(36237, { x: 3277, y: 6170 }, 2, "cross");
assert.deepEqual(rope4.teleports[0], { x: 3282, y: 6184, level: 0 });
assert.equal(rope4.forced.length, 0, "plane-change tightrope has no forced movement");
assert.deepEqual(rope4.xp, [30.7]);
assert.equal(getPrifddinasCourseStage(1), 11);

const holeEnd = makeSession(1, 3282, 6184, 0);
holeEnd.run(36238, { x: 3282, y: 6184 }, 0, "enter");
assert.deepEqual(holeEnd.teleports[0], { x: 3253, y: 6107, level: 0 });
assert.equal(holeEnd.forced.length, 0, "end-hole teleport has no forced movement");
assert.deepEqual(holeEnd.xp, [1037.1]);
assert(holeEnd.messages.some((m) => /completed the Prifddinas Agility Course/i.test(m)));
assert.equal(getPrifddinasCourseStage(1), 0);

resetPrifddinasCourseProgress(2);
const skipToEnd = makeSession(2, 3282, 6184, 0);
skipToEnd.run(36238, { x: 3282, y: 6184 }, 0, "enter");
assert.deepEqual(skipToEnd.xp, [1037.1], "final dark hole without a lap awards obstacle XP only");
assert.equal(
    skipToEnd.messages.some((m) => /completed the Prifddinas Agility Course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 3254, 6109, 0);
defaultAction.run(36221, { x: 3254, y: 6109 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 3254, y: 6107, level: 2 });
assert.deepEqual(defaultAction.xp, [11.5]);

const climbUp = makeSession(4, 3254, 6109, 0);
climbUp.run(36221, { x: 3254, y: 6109 }, 0, "climb-up");
assert.deepEqual(climbUp.teleports[0], { x: 3254, y: 6107, level: 2 });
assert.deepEqual(climbUp.xp, [11.5]);

console.log("agility-prifddinas-course.test.ts: all assertions passed");
