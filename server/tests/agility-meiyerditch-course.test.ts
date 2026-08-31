import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    LocInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import { register } from "../gamemodes/vanilla/skills/agility/meiyerditch";

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

function makeSession(
    playerId: number,
    tileX: number,
    tileY: number,
    level: number,
    agilityLevel = 25,
    boost = 0,
) {
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
                    return { baseLevel: agilityLevel, boost };
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

const tooLow = makeSession(1, 3601, 3214, 1, 24);
tooLow.run(18070, { x: 3605, y: 3214 }, 1, "jump-to");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 25/i.test(m)));

const boosted = makeSession(2, 3601, 3214, 1, 24, 5);
boosted.run(18070, { x: 3605, y: 3214 }, 1, "jump-to");
assert.equal(boosted.teleports.length, 0);
assert.equal(boosted.xp.length, 0);
assert(boosted.messages.some((m) => /boost won't help/i.test(m)));

const jump = makeSession(3, 3601, 3214, 1);
jump.run(18070, { x: 3605, y: 3214 }, 1, "jump-to");
assert.deepEqual(jump.teleports[0], { x: 3605, y: 3214, level: 1 });
assert.equal(jump.forced.length, 1);
assert.deepEqual(jump.forced[0].endTile, { x: 3605, y: 3214 });
assert.deepEqual(jump.xp, [5]);
assert(jump.messages.some((m) => /jump to the floorboards/i.test(m)));
assert.equal(jump.seqs[0], 769);

jump.run(18071, { x: 3601, y: 3214 }, 1, "jump-to");
assert.deepEqual(jump.teleports[1], { x: 3601, y: 3214, level: 1 });
assert.deepEqual(jump.xp, [5, 5], "round-trip floorboards award 5 XP each");
assert.equal(jump.forced.length, 2);

const defaultAction = makeSession(4, 3601, 3214, 1);
defaultAction.run(18070, { x: 3605, y: 3214 }, 1);
assert.deepEqual(defaultAction.teleports[0], { x: 3605, y: 3214, level: 1 });
assert.deepEqual(defaultAction.xp, [5]);

const floor = makeSession(5, 3597, 3208, 1);
floor.run(18076, { x: 3599, y: 3208 }, 1, "walk-across");
assert.deepEqual(floor.teleports[0], { x: 3601, y: 3208, level: 1 });
assert.equal(floor.forced.length, 1);
assert.deepEqual(floor.xp, [5]);
assert(floor.messages.some((m) => /walk across the floor/i.test(m)));
assert.equal(floor.seqs[0], 762);

const westFloor = makeSession(6, 3603, 3208, 1);
westFloor.run(18077, { x: 3601, y: 3208 }, 1, "walk-across");
assert.deepEqual(westFloor.teleports[0], { x: 3599, y: 3208, level: 1 });
assert.deepEqual(westFloor.xp, [5]);

for (const locId of [18070, 18071, 18117, 18118, 18076, 18104]) {
    assert(locHandlers.has(`${locId}:jump-to`) || locHandlers.has(`${locId}:walk-across`));
}

console.log("agility-meiyerditch-course.test.ts: all assertions passed");
