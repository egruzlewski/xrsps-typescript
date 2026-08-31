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
    getSepulchreFloor,
    register,
    resetSepulchreProgress,
} from "../gamemodes/vanilla/skills/agility/sepulchre";

resetSepulchreProgress();

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
    agilityLevel = 52,
    opts: { boost?: number } = {},
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
                    return { baseLevel: agilityLevel, boost: opts.boost ?? 0 };
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

const tooLow = makeSession(1, 2400, 5986, 0, 51);
tooLow.run(38452, { x: 2400, y: 5985 }, 0, "climb-down");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 52/i.test(m)));
assert.equal(getSepulchreFloor(1), 0);

const enter = makeSession(2, 2400, 5986, 0, 52);
enter.run(38452, { x: 2400, y: 5985 }, 0, "climb-down");
assert.deepEqual(enter.teleports[0], { x: 2272, y: 5984, level: 0 });
assert.equal(enter.xp.length, 0, "lobby stairs award no XP");
assert.equal(getSepulchreFloor(2), 1);
assert(enter.messages.some((m) => /climb down the stairs/i.test(m)));

const mid = makeSession(2, 2285, 5985, 1, 52);
mid.run(38463, { x: 2285, y: 5983 }, 1, "climb-down");
assert.deepEqual(mid.teleports[0], { x: 2285, y: 5981, level: 0 });
assert.equal(mid.forced.length, 0, "mid stairs drop a plane");
assert.deepEqual(mid.xp, [25]);
assert.equal(getSepulchreFloor(2), 1);

const gap = makeSession(2, 2264, 5984, 0, 52);
gap.run(38456, { x: 2265, y: 5984 }, 0, "jump");
assert.deepEqual(gap.teleports[0], { x: 2272, y: 5984, level: 0 });
assert.deepEqual(gap.xp, [50]);
assert.equal(gap.forced.length, 1);
assert.equal(gap.seqs[0], 769);

const tooLowF2 = makeSession(2, 2272, 5984, 0, 52);
tooLowF2.run(38453, { x: 2272, y: 5982 }, 0, "climb-down");
assert.equal(tooLowF2.teleports.length, 0);
assert.equal(tooLowF2.xp.length, 0);
assert(tooLowF2.messages.some((m) => /Agility level of 62/i.test(m)));
assert.equal(getSepulchreFloor(2), 1);

const end1 = makeSession(2, 2272, 5984, 0, 62);
end1.run(38453, { x: 2272, y: 5982 }, 0, "climb-down");
assert.deepEqual(end1.teleports[0], { x: 2528, y: 5984, level: 0 });
assert.deepEqual(end1.xp, [500]);
assert(end1.messages.some((m) => /completed floor 1 of the Hallowed Sepulchre/i.test(m)));
assert.equal(getSepulchreFloor(2), 2);

const step = makeSession(2, 2518, 6000, 1, 62);
step.run(38470, { x: 2518, y: 6001 }, 1, "jump");
assert.deepEqual(step.teleports[0], { x: 2518, y: 6003, level: 1 });
assert.deepEqual(step.xp, [10]);

const f3plat = makeSession(3, 2394, 5856, 0, 72);
f3plat.run(38459, { x: 2395, y: 5856 }, 0, "jump");
assert.deepEqual(f3plat.teleports[0], { x: 2405, y: 5856, level: 0 });
assert.deepEqual(f3plat.xp, [50]);

resetSepulchreProgress(4);
const namedF1 = makeSession(4, 2272, 5984, 0, 62);
namedF1.run(39622, { x: 2269, y: 5983 }, 0, "climb-down");
assert.deepEqual(namedF1.xp, [500]);
assert.equal(getSepulchreFloor(4), 2);

resetSepulchreProgress(5);
const namedF3 = makeSession(5, 2400, 5856, 0, 76);
namedF3.run(39624, { x: 2399, y: 5858 }, 0, "climb-down");
assert.equal(namedF3.teleports.length, 0);
assert(namedF3.messages.some((m) => /Agility level of 77/i.test(m)));

const boostF4 = makeSession(5, 2400, 5856, 0, 72, { boost: 5 });
boostF4.run(39624, { x: 2399, y: 5858 }, 0, "climb-down");
assert.deepEqual(boostF4.xp, [1425]);
assert.equal(getSepulchreFloor(5), 4);
assert.deepEqual(boostF4.teleports[0], { x: 2527, y: 5855, level: 0 });

const namedF4 = makeSession(5, 2527, 5855, 0, 87);
namedF4.run(39625, { x: 2527, y: 5855 }, 0, "climb-down");
assert.deepEqual(namedF4.xp, [2625]);
assert.equal(getSepulchreFloor(5), 5);
assert.deepEqual(namedF4.teleports[0], { x: 2272, y: 5862, level: 0 });

const f5plat = makeSession(5, 2272, 5861, 0, 87);
f5plat.run(38477, { x: 2272, y: 5862 }, 0, "jump");
assert.deepEqual(f5plat.teleports[0], { x: 2272, y: 5865, level: 0 });
assert.deepEqual(f5plat.xp, [100]);

const activate = makeSession(5, 2272, 5858, 0, 87);
activate.run(38451, { x: 2272, y: 5846 }, 0, "activate");
assert.equal(activate.teleports.length, 0);
assert.equal(activate.xp.length, 0);
assert(activate.messages.some((m) => /obelisk hums/i.test(m)));
assert.equal(getSepulchreFloor(5), 5);

const exit5 = makeSession(5, 2272, 5858, 0, 87);
exit5.run(38451, { x: 2272, y: 5846 }, 0, "exit");
assert.deepEqual(exit5.teleports[0], { x: 2400, y: 5986, level: 0 });
assert.deepEqual(exit5.xp, [5850]);
assert(exit5.messages.some((m) => /completed floor 5 of the Hallowed Sepulchre/i.test(m)));
assert.equal(getSepulchreFloor(5), 0);

resetSepulchreProgress(6);
const enterBridge = makeSession(6, 2400, 5986, 0, 52);
enterBridge.run(38452, { x: 2400, y: 5985 }, 0, "climb-down");
const broken = makeSession(6, 2260, 5990, 0, 52);
broken.run(38806, { x: 2260, y: 5992 }, 0, "build");
assert.deepEqual(broken.teleports[0], { x: 2260, y: 5996, level: 0 });
assert.deepEqual(broken.xp, [50], "fail-proof: broken bridge still crosses for floor 1 XP");

resetSepulchreProgress(7);
const f5bridge = makeSession(7, 2270, 5860, 0, 87);
f5bridge.run(39625, { x: 2527, y: 5855 }, 0, "climb-down");
assert.equal(getSepulchreFloor(7), 5);
const bridge5 = makeSession(7, 2270, 5860, 0, 87);
bridge5.run(38808, { x: 2274, y: 5860 }, 0, "cross");
assert.deepEqual(bridge5.xp, [80]);

const climbAlias = makeSession(8, 2400, 5986, 0, 52);
climbAlias.run(38452, { x: 2400, y: 5985 }, 0);
assert.equal(getSepulchreFloor(8), 1);

assert(locHandlers.has("38452:climb-down"), "lobby start stairs");
assert(locHandlers.has("38453:climb-down"), "end-of-floor stairs");
assert(locHandlers.has("38451:exit"), "magical obelisk exit");
assert(locHandlers.has("38456:jump"), "east platform");
assert(locHandlers.has("38470:jump"), "floor 2 stepping stones");
assert(locHandlers.has("38808:cross"), "repaired bridge");
assert(locHandlers.has("38462:climb-down"), "floor 1 north-path drop");

assert.equal(500 + 850 + 1425 + 2625 + 5850, 11250, "floor completion XP sums to 11,250");

console.log("agility-sepulchre-course.test.ts: all assertions passed");
