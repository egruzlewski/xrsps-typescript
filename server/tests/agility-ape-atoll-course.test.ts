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
    getApeAtollCourseStage,
    register,
    resetApeAtollCourseProgress,
} from "../gamemodes/vanilla/skills/agility/apeAtoll";

resetApeAtollCourseProgress();

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

const SMALL_NINJA_GREEGREE = 4024;
const MEDIUM_NINJA_GREEGREE = 4025;
const KRUK_GREEGREE = 19525;
const GORILLA_GREEGREE = 4026;

function makeSession(
    playerId: number,
    tileX: number,
    tileY: number,
    level: number,
    agilityLevel = 48,
    opts: { boost?: number; weaponId?: number } = {},
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
        equipment: {
            getEquippedItem: () => opts.weaponId ?? SMALL_NINJA_GREEGREE,
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

const tooLow = makeSession(9, 2755, 2742, 0, 47);
tooLow.run(15412, { x: 2754, y: 2742 }, 0, "jump-to");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 48/i.test(m)));
assert.equal(getApeAtollCourseStage(9), 0);

const boosted = makeSession(10, 2755, 2742, 0, 47, { boost: 5 });
boosted.run(15412, { x: 2754, y: 2742 }, 0, "jump-to");
assert.equal(boosted.teleports.length, 0);
assert.equal(boosted.xp.length, 0);
assert(boosted.messages.some((m) => /Agility boost won't help you here/i.test(m)));
assert.equal(getApeAtollCourseStage(10), 0);

const human = makeSession(11, 2755, 2742, 0, 48, { weaponId: 0 });
human.run(15412, { x: 2754, y: 2742 }, 0, "jump-to");
assert.equal(human.teleports.length, 0);
assert.equal(human.xp.length, 0);
assert(human.messages.some((m) => /not monkey enough/i.test(m)));
assert.equal(getApeAtollCourseStage(11), 0);

const gorilla = makeSession(12, 2755, 2742, 0, 48, { weaponId: GORILLA_GREEGREE });
gorilla.run(15412, { x: 2754, y: 2742 }, 0, "jump-to");
assert.equal(gorilla.teleports.length, 0);
assert.equal(gorilla.xp.length, 0);
assert(gorilla.messages.some((m) => /stealthiest and most agile monkey/i.test(m)));
assert.equal(getApeAtollCourseStage(12), 0);

const stone = makeSession(1, 2755, 2742, 0);
stone.run(15412, { x: 2754, y: 2742 }, 0, "jump-to");
assert.deepEqual(stone.teleports[0], { x: 2753, y: 2742, level: 0 });
assert.equal(stone.forced.length, 1);
assert.deepEqual(stone.xp, [40]);
assert.equal(getApeAtollCourseStage(1), 1);
assert(stone.messages.some((m) => /stepping stone/i.test(m)));

const tree = makeSession(1, 2753, 2742, 0);
tree.run(15414, { x: 2753, y: 2741 }, 0, "climb");
assert.deepEqual(tree.teleports[0], { x: 2752, y: 2741, level: 0 });
assert.equal(tree.forced.length, 0, "same-plane tree climb has no forced movement");
assert.deepEqual(tree.xp, [40]);
assert.equal(getApeAtollCourseStage(1), 2);

const bars = makeSession(1, 2752, 2741, 0);
bars.run(15417, { x: 2751, y: 2742 }, 0, "swing-across");
assert.deepEqual(bars.teleports[0], { x: 2747, y: 2741, level: 0 });
assert.equal(bars.forced.length, 1);
assert.deepEqual(bars.xp, [40]);
assert.equal(getApeAtollCourseStage(1), 3);

const skulls = makeSession(1, 2747, 2741, 0);
skulls.run(15483, { x: 2747, y: 2741 }, 0, "climb-up");
assert.deepEqual(skulls.teleports[0], { x: 2742, y: 2741, level: 0 });
assert.equal(skulls.forced.length, 1);
assert.deepEqual(skulls.xp, [60]);
assert.equal(getApeAtollCourseStage(1), 4);

const rope = makeSession(1, 2752, 2731, 0);
rope.run(15487, { x: 2752, y: 2731 }, 0, "swing");
assert.deepEqual(rope.teleports[0], { x: 2756, y: 2731, level: 0 });
assert.equal(rope.forced.length, 1);
assert.deepEqual(rope.xp, [100]);
assert.equal(getApeAtollCourseStage(1), 5);

const vine = makeSession(1, 2764, 2738, 0);
vine.run(16062, { x: 2764, y: 2741 }, 0, "climb-down");
assert.deepEqual(vine.teleports[0], { x: 2770, y: 2747, level: 0 });
assert.equal(vine.forced.length, 0, "same-plane vine climb-down has no forced movement");
assert.deepEqual(vine.xp, [300], "final vine awards 0 obstacle XP plus 300 lap bonus");
assert(vine.messages.some((m) => /completed the Ape Atoll agility course/i.test(m)));
assert.equal(getApeAtollCourseStage(1), 0);

resetApeAtollCourseProgress(2);
const skipToEnd = makeSession(2, 2764, 2738, 0);
skipToEnd.run(16062, { x: 2764, y: 2741 }, 0, "climb-down");
assert.deepEqual(skipToEnd.xp, [], "final vine without a lap awards no obstacle XP");
assert.equal(
    skipToEnd.messages.some((m) => /completed the Ape Atoll agility course/i.test(m)),
    false,
);

const mediumNinja = makeSession(3, 2755, 2742, 0, 48, { weaponId: MEDIUM_NINJA_GREEGREE });
mediumNinja.run(15412, { x: 2754, y: 2742 }, 0, "jump-to");
assert.deepEqual(mediumNinja.xp, [40]);

const kruk = makeSession(4, 2755, 2742, 0, 48, { weaponId: KRUK_GREEGREE });
kruk.run(15412, { x: 2754, y: 2742 }, 0);
assert.deepEqual(kruk.teleports[0], { x: 2753, y: 2742, level: 0 });
assert.deepEqual(kruk.xp, [40]);

const jumpAlias = makeSession(5, 2755, 2742, 0);
jumpAlias.run(15412, { x: 2754, y: 2742 }, 0, "jump");
assert.deepEqual(jumpAlias.xp, [40]);

assert(locHandlers.has("15418:swing-across"), "extra monkeybar loc 15418");
assert(locHandlers.has("16066:climb-down"), "extra vine loc 16066");

console.log("agility-ape-atoll-course.test.ts: all assertions passed");
