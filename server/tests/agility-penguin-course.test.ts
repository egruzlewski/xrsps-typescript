import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    LocInteractionHandler,
    NpcInteractionEvent,
    NpcInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import {
    getPenguinCourseStage,
    register,
    resetPenguinCourseProgress,
} from "../gamemodes/vanilla/skills/agility/penguin";

resetPenguinCourseProgress();

const locHandlers = new Map<string, LocInteractionHandler>();
const npcHandlers = new Map<string, NpcInteractionHandler>();
const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerNpcInteraction: (npcId: number, handler: NpcInteractionHandler, action?: string) => {
        npcHandlers.set(`${npcId}:${action ?? "*"}`, handler);
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

const CLOCKWORK_SUIT = 10595;
const CLOCKWORK_SUIT_WOUND = 10596;
const CRUSHER_NPC_ID = 856;

function makeSession(
    playerId: number,
    tileX: number,
    tileY: number,
    level: number,
    agilityLevel = 30,
    opts: { boost?: number; capeId?: number; invSuit?: number; noSuit?: boolean } = {},
) {
    const messages: string[] = [];
    const xp: number[] = [];
    const teleports: Teleport[] = [];
    const forced: Forced[] = [];
    const seqs: number[] = [];
    const capeId = opts.noSuit ? 0 : (opts.capeId ?? CLOCKWORK_SUIT);
    let suitCount = opts.invSuit ?? 0;
    const player = {
        id: playerId,
        tileX,
        tileY,
        level,
        clearPendingSeqs: () => undefined,
        items: {
            getItemCount: (itemId: number) =>
                itemId === CLOCKWORK_SUIT || itemId === CLOCKWORK_SUIT_WOUND ? suitCount : 0,
        },
    } as unknown as PlayerState;

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
        equipment: {
            getEquippedItem: () => capeId,
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

    const runNpc = (npcId: number, action?: string) => {
        const found = npcHandlers.get(`${npcId}:${action ?? "*"}`);
        assert(found, `expected crusher npc handler ${npcId} action=${action}`);
        found({
            player,
            npc: { id: npcId },
            option: action,
            tick: 100,
            services,
        } as unknown as NpcInteractionEvent);
    };

    return { player, messages, xp, teleports, forced, seqs, run, runNpc };
}

const tooLow = makeSession(9, 2630, 4056, 0, 29);
tooLow.run(21120, { x: 2630, y: 4057 }, 0, "climb");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 30/i.test(m)));
assert.equal(getPenguinCourseStage(9), 0);

const boosted = makeSession(10, 2630, 4056, 0, 29, { boost: 1 });
boosted.run(21120, { x: 2630, y: 4057 }, 0, "climb");
assert.deepEqual(boosted.xp, [55], "level 30 is boostable");
assert.equal(getPenguinCourseStage(10), 1);

const noSuit = makeSession(11, 2630, 4056, 0, 30, { noSuit: true });
noSuit.run(21120, { x: 2630, y: 4057 }, 0, "climb");
assert.equal(noSuit.teleports.length, 0);
assert.equal(noSuit.xp.length, 0);
assert(noSuit.messages.some((m) => /penguin suit/i.test(m)));
assert.equal(getPenguinCourseStage(11), 0);

const invSuit = makeSession(12, 2630, 4056, 0, 30, { noSuit: true, invSuit: 1 });
invSuit.run(21120, { x: 2630, y: 4057 }, 0, "climb");
assert.deepEqual(invSuit.xp, [55], "inventory clockwork suit is accepted (Larry transform not wired)");
assert.equal(getPenguinCourseStage(12), 1);

const woundCape = makeSession(13, 2630, 4056, 0, 30, { capeId: CLOCKWORK_SUIT_WOUND });
woundCape.run(21120, { x: 2630, y: 4057 }, 0, "climb");
assert.deepEqual(woundCape.xp, [55]);

resetPenguinCourseProgress(1);
const lap = makeSession(1, 2630, 4056, 0);
lap.run(21120, { x: 2630, y: 4057 }, 0, "climb");
assert.deepEqual(lap.teleports[0], { x: 2630, y: 4057, level: 0 });
assert.deepEqual(lap.xp, [55]);
assert.equal(getPenguinCourseStage(1), 1);
assert(lap.messages.some((m) => /crushers/i.test(m)));

lap.run(21120, { x: 2630, y: 4057 }, 0, "climb");
assert.deepEqual(lap.xp, [55], "repeat first-stone climb awards no extra XP");
assert.equal(getPenguinCourseStage(1), 1);

lap.run(21128, { x: 2631, y: 4057 }, 0, "climb");
assert.deepEqual(lap.teleports[lap.teleports.length - 1], { x: 2635, y: 4065, level: 0 });
assert.equal(lap.forced.length > 0, true);
assert.deepEqual(lap.xp, [55, 80]);
assert.equal(getPenguinCourseStage(1), 2);

lap.run(21133, { x: 2635, y: 4065 }, 0, "jump");
assert.deepEqual(lap.xp, [55, 80], "repeat stepping stones award no extra XP");
assert.equal(getPenguinCourseStage(1), 2);

const icicleTiles = [
    { x: 2644, y: 4084 },
    { x: 2652, y: 4080 },
    { x: 2658, y: 4083 },
    { x: 2662, y: 4083 },
];
for (let i = 0; i < 4; i++) {
    lap.run(21134, icicleTiles[i], 1, "tread-softly");
    assert.equal(lap.xp[lap.xp.length - 1], 40, `icicle ${i + 1} awards 40 XP`);
    assert.equal(getPenguinCourseStage(1), 3 + i);
}
assert.deepEqual(lap.xp, [55, 80, 40, 40, 40, 40]);

lap.run(21134, { x: 2662, y: 4082 }, 1, "tread-softly");
assert.deepEqual(lap.xp, [55, 80, 40, 40, 40, 40], "extra icicle click awards no XP");
assert.equal(getPenguinCourseStage(1), 6);

lap.run(21148, { x: 2665, y: 4073 }, 0, "cross");
assert.deepEqual(lap.teleports[lap.teleports.length - 1], { x: 2653, y: 4040, level: 1 });
assert.deepEqual(lap.xp, [55, 80, 40, 40, 40, 40, 180]);
assert.equal(getPenguinCourseStage(1), 7);

lap.run(21156, { x: 2665, y: 4070 }, 0, "cross");
assert.deepEqual(lap.xp, [55, 80, 40, 40, 40, 40, 180], "repeat ice awards no extra XP");
assert.equal(getPenguinCourseStage(1), 7);

lap.run(21172, { x: 2652, y: 4039 }, 1, "open");
assert.equal(lap.xp[lap.xp.length - 1], 65);
assert.deepEqual(lap.xp, [55, 80, 40, 40, 40, 40, 180, 65]);
assert.equal(
    lap.xp.reduce((a, b) => a + b, 0),
    540,
    "in-order lap totals 540 XP",
);
assert(lap.messages.some((m) => /completed the Penguin Agility Course/i.test(m)));
assert.equal(getPenguinCourseStage(1), 0);

resetPenguinCourseProgress(2);
const skipToGate = makeSession(2, 2653, 4040, 1);
skipToGate.run(21172, { x: 2652, y: 4039 }, 1, "open");
assert.deepEqual(skipToGate.xp, [65], "gate without a lap awards obstacle XP only");
assert.equal(
    skipToGate.messages.some((m) => /completed the Penguin Agility Course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 2630, 4056, 0);
defaultAction.run(21120, { x: 2630, y: 4057 }, 0);
assert.deepEqual(defaultAction.xp, [55]);

const climbUp = makeSession(4, 2630, 4056, 0);
climbUp.run(21120, { x: 2630, y: 4057 }, 0, "climb-up");
assert.deepEqual(climbUp.xp, [55]);

resetPenguinCourseProgress(5);
const crusherNpc = makeSession(5, 2631, 4053, 0);
crusherNpc.runNpc(CRUSHER_NPC_ID);
assert.deepEqual(crusherNpc.teleports[0], { x: 2630, y: 4057, level: 0 });
assert.deepEqual(crusherNpc.xp, [55]);
assert.equal(getPenguinCourseStage(5), 1);
crusherNpc.run(21120, { x: 2630, y: 4057 }, 0, "climb");
assert.deepEqual(crusherNpc.xp, [55], "first stone after crusher NPC is a repeat");
assert.equal(getPenguinCourseStage(5), 1);

console.log("agility-penguin-course.test.ts: all assertions passed");
