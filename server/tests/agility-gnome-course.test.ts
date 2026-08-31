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
    getGnomeCourseStage,
    register,
    resetGnomeCourseProgress,
} from "../gamemodes/vanilla/skills/agility";

resetGnomeCourseProgress();

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

const log = makeSession(1, 2474, 3436, 0);
log.run(23145, { x: 2474, y: 3435 }, 0, "walk-across");
assert.deepEqual(log.teleports[0], { x: 2474, y: 3429, level: 0 });
assert.equal(log.forced.length, 1);
assert.equal(log.xp[0], 10);
assert.equal(getGnomeCourseStage(1), 1);
assert(log.messages[0]?.includes("slippery log"));

const net = makeSession(1, 2474, 3429, 0);
net.run(23134, { x: 2474, y: 3426 }, 0, "climb-over");
assert.deepEqual(net.teleports[0], { x: 2473, y: 3424, level: 1 });
assert.equal(net.forced.length, 0);
assert.equal(net.xp[0], 10);
assert.equal(getGnomeCourseStage(1), 2);

const treeUp = makeSession(1, 2473, 3424, 1);
treeUp.run(23559, { x: 2473, y: 3422 }, 1, "climb");
assert.deepEqual(treeUp.teleports[0], { x: 2473, y: 3420, level: 2 });
assert.equal(treeUp.xp[0], 6.5);
assert.equal(getGnomeCourseStage(1), 3);

const rope = makeSession(1, 2477, 3420, 2);
rope.run(23557, { x: 2478, y: 3420 }, 2, "walk-on");
assert.deepEqual(rope.teleports[0], { x: 2483, y: 3420, level: 2 });
assert.equal(rope.forced.length, 1);
assert.equal(rope.xp[0], 10);
assert.equal(getGnomeCourseStage(1), 4);

const treeDown = makeSession(1, 2483, 3420, 2);
treeDown.run(23560, { x: 2486, y: 3419 }, 2, "climb-down");
assert.deepEqual(treeDown.teleports[0], { x: 2487, y: 3420, level: 0 });
assert.equal(treeDown.xp[0], 6.5);
assert.equal(getGnomeCourseStage(1), 5);

const net2 = makeSession(1, 2487, 3420, 0);
net2.run(23135, { x: 2485, y: 3426 }, 0, "climb-over");
assert.deepEqual(net2.teleports[0], { x: 2483, y: 3427, level: 0 });
assert.equal(net2.xp[0], 10);
assert.equal(getGnomeCourseStage(1), 6);

const pipe = makeSession(1, 2484, 3430, 0);
pipe.run(23138, { x: 2484, y: 3431 }, 0, "squeeze-through");
assert.deepEqual(pipe.teleports[0], { x: 2484, y: 3437, level: 0 });
assert.deepEqual(pipe.xp, [7.5, 50]);
assert(pipe.messages.some((m) => /completed the Gnome Stronghold agility course/i.test(m)));
assert.equal(getGnomeCourseStage(1), 0);

resetGnomeCourseProgress(2);
const skipToPipe = makeSession(2, 2484, 3430, 0);
skipToPipe.run(23138, { x: 2484, y: 3431 }, 0, "squeeze-through");
assert.deepEqual(skipToPipe.xp, [7.5], "pipe without a lap awards obstacle XP only");
assert.equal(
    skipToPipe.messages.some((m) => /completed the Gnome Stronghold agility course/i.test(m)),
    false,
);

const eastPipe = makeSession(3, 2487, 3430, 0);
eastPipe.run(23139, { x: 2487, y: 3431 }, 0);
assert.deepEqual(eastPipe.teleports[0], { x: 2487, y: 3437, level: 0 });

console.log("agility-gnome-course.test.ts: all assertions passed");
