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
    getBarbarianCourseStage,
    register,
    resetBarbarianCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetBarbarianCourseProgress();

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
type XpGain = { skillId: number; amount: number };

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 35) {
    const messages: string[] = [];
    const xp: XpGain[] = [];
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
                xp.push({ skillId, amount });
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

const rope = makeSession(1, 2551, 3554, 0);
rope.run(23131, { x: 2551, y: 3550 }, 0, "swing-on");
assert.deepEqual(rope.teleports[0], { x: 2551, y: 3549, level: 0 });
assert.equal(rope.forced.length, 1);
assert.deepEqual(rope.xp, [{ skillId: SkillId.Agility, amount: 22 }]);
assert.equal(getBarbarianCourseStage(1), 1);
assert(rope.messages.some((m) => /skillfully swing across/i.test(m)));

const log = makeSession(1, 2551, 3546, 0);
log.run(23144, { x: 2550, y: 3546 }, 0, "walk-across");
assert.deepEqual(log.teleports[0], { x: 2541, y: 3546, level: 0 });
assert.equal(log.forced.length, 1);
assert.deepEqual(log.xp, [{ skillId: SkillId.Agility, amount: 13.7 }]);
assert.equal(getBarbarianCourseStage(1), 2);

const net = makeSession(1, 2539, 3545, 0);
net.run(20211, { x: 2538, y: 3545 }, 0, "climb-over");
assert.deepEqual(net.teleports[0], { x: 2537, y: 3546, level: 1 });
assert.equal(net.forced.length, 0);
assert.deepEqual(net.xp, [{ skillId: SkillId.Agility, amount: 8.2 }]);
assert.equal(getBarbarianCourseStage(1), 3);

const ledge = makeSession(1, 2536, 3547, 1);
ledge.run(23547, { x: 2535, y: 3547 }, 1, "walk-across");
assert.deepEqual(ledge.teleports[0], { x: 2532, y: 3546, level: 1 });
assert.deepEqual(ledge.xp, [{ skillId: SkillId.Agility, amount: 22 }]);
assert.equal(getBarbarianCourseStage(1), 4);

const ladder = makeSession(1, 2532, 3545, 1);
ladder.run(16682, { x: 2532, y: 3545 }, 1, "climb-down");
assert.deepEqual(ladder.teleports[0], { x: 2532, y: 3546, level: 0 });
assert.deepEqual(ladder.xp, [], "ladder awards no XP");
assert.equal(getBarbarianCourseStage(1), 5);

const wall1 = makeSession(1, 2535, 3553, 0);
wall1.run(1948, { x: 2536, y: 3553 }, 0, "climb-over");
assert.deepEqual(wall1.teleports[0], { x: 2537, y: 3553, level: 0 });
assert.deepEqual(wall1.xp, [{ skillId: SkillId.Agility, amount: 13.7 }]);
assert.equal(getBarbarianCourseStage(1), 6);

const wall2 = makeSession(1, 2538, 3553, 0);
wall2.run(1948, { x: 2539, y: 3553 }, 0, "climb-over");
assert.deepEqual(wall2.teleports[0], { x: 2540, y: 3553, level: 0 });
assert.equal(getBarbarianCourseStage(1), 7);

const wall3 = makeSession(1, 2541, 3553, 0);
wall3.run(1948, { x: 2542, y: 3553 }, 0, "climb-over");
assert.deepEqual(wall3.teleports[0], { x: 2543, y: 3553, level: 0 });
assert.deepEqual(wall3.xp, [
    { skillId: SkillId.Agility, amount: 13.7 },
    { skillId: SkillId.Agility, amount: 46.3 },
    { skillId: SkillId.Strength, amount: 41.3 },
]);
assert(wall3.messages.some((m) => /completed the Barbarian Outpost agility course/i.test(m)));
assert.equal(getBarbarianCourseStage(1), 0);

resetBarbarianCourseProgress(2);
const skipToLastWall = makeSession(2, 2541, 3553, 0);
skipToLastWall.run(1948, { x: 2542, y: 3553 }, 0, "climb-over");
assert.deepEqual(
    skipToLastWall.xp,
    [{ skillId: SkillId.Agility, amount: 13.7 }],
    "last wall without a lap awards obstacle XP only",
);
assert.equal(
    skipToLastWall.messages.some((m) => /completed the Barbarian Outpost agility course/i.test(m)),
    false,
);

const fromSouth = makeSession(3, 2551, 3549, 0);
fromSouth.run(23131, { x: 2551, y: 3550 }, 0, "swing-on");
assert.equal(fromSouth.teleports.length, 0);
assert(fromSouth.messages.some((m) => /cannot do that from here/i.test(m)));

const wallWrongSide = makeSession(4, 2538, 3553, 0);
wallWrongSide.run(1948, { x: 2536, y: 3553 }, 0, "climb-over");
assert.equal(wallWrongSide.teleports.length, 0);
assert(wallWrongSide.messages.some((m) => /cannot climb that from this side/i.test(m)));

const pipeLow = makeSession(5, 2552, 3561, 0, 1);
pipeLow.run(20210, { x: 2552, y: 3559 }, 0, "squeeze-through");
assert.equal(pipeLow.teleports.length, 0);
assert(pipeLow.messages.some((m) => /Agility level of 35/i.test(m)));

const pipeIn = makeSession(6, 2552, 3561, 0, 35);
pipeIn.run(20210, { x: 2552, y: 3559 }, 0, "squeeze-through");
assert.deepEqual(pipeIn.teleports[0], { x: 2552, y: 3558, level: 0 });
assert.deepEqual(pipeIn.xp, [{ skillId: SkillId.Agility, amount: 10 }]);
assert.equal(getBarbarianCourseStage(6), 0, "entrance pipe is not a lap obstacle");

const pipeOut = makeSession(7, 2552, 3558, 0, 1);
pipeOut.run(20210, { x: 2552, y: 3559 }, 0, "squeeze-through");
assert.deepEqual(pipeOut.teleports[0], { x: 2552, y: 3561, level: 0 });
assert.deepEqual(pipeOut.xp, [{ skillId: SkillId.Agility, amount: 10 }]);

console.log("agility-barbarian-course.test.ts: all assertions passed");
