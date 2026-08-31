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
    getShayzienCourseStage,
    isShayzienAdvancedLap,
    register,
    resetShayzienCourseProgress,
} from "../gamemodes/vanilla/skills/agility/shayzien";

resetShayzienCourseProgress();

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

const BRONZE_CROSSBOW = 9174;
const MITH_GRAPPLE = 9419;
const LIGHT_BALLISTA = 19478;

function makeSession(
    playerId: number,
    tileX: number,
    tileY: number,
    level: number,
    agilityLevel = 1,
    opts: { boost?: number; weaponId?: number; ammoId?: number } = {},
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
            getEquippedItem: (_p: PlayerState, slot: number) => {
                if (slot === 3) {
                    return opts.weaponId ?? 0;
                }
                if (slot === 10) {
                    return opts.ammoId ?? 0;
                }
                return 0;
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

const kit = { weaponId: BRONZE_CROSSBOW, ammoId: MITH_GRAPPLE };

const ladder = makeSession(1, 1554, 3631, 0);
ladder.run(42209, { x: 1554, y: 3631 }, 0, "climb");
assert.deepEqual(ladder.teleports[0], { x: 1552, y: 3633, level: 3 });
assert.equal(ladder.forced.length, 0, "ladder climb is a plane change");
assert.deepEqual(ladder.xp, [5.5]);
assert.equal(getShayzienCourseStage(1), 1);
assert(ladder.messages.some((m) => /climb the ladder/i.test(m)));

const bars = makeSession(1, 1552, 3633, 3);
bars.run(42211, { x: 1552, y: 3633 }, 3, "climb");
assert.deepEqual(bars.teleports[0], { x: 1536, y: 3633, level: 2 });
assert.equal(bars.forced.length, 0, "monkeybars drop from plane 3 to 2");
assert.deepEqual(bars.xp, [8]);
assert.equal(getShayzienCourseStage(1), 2);

const rope1 = makeSession(1, 1536, 3633, 2);
rope1.run(42212, { x: 1536, y: 3633 }, 2, "cross");
assert.deepEqual(rope1.teleports[0], { x: 1523, y: 3633, level: 2 });
assert.deepEqual(rope1.xp, [9]);
assert.equal(getShayzienCourseStage(1), 3);

const bar = makeSession(1, 1523, 3633, 2);
bar.run(42213, { x: 1523, y: 3640 }, 2, "climb");
assert.deepEqual(bar.teleports[0], { x: 1525, y: 3644, level: 3 });
assert.deepEqual(bar.xp, [7]);
assert.equal(getShayzienCourseStage(1), 4);
assert.equal(isShayzienAdvancedLap(1), false);

const rope2 = makeSession(1, 1525, 3644, 3);
rope2.run(42214, { x: 1525, y: 3644 }, 3, "cross");
assert.deepEqual(rope2.teleports[0], { x: 1541, y: 3644, level: 2 });
assert.deepEqual(rope2.xp, [9]);
assert.equal(getShayzienCourseStage(1), 5);

const rope3 = makeSession(1, 1541, 3644, 2);
rope3.run(42215, { x: 1541, y: 3644 }, 2, "cross");
assert.deepEqual(rope3.teleports[0], { x: 1554, y: 3641, level: 2 });
assert.deepEqual(rope3.xp, [9]);
assert.equal(getShayzienCourseStage(1), 6);

const gap = makeSession(1, 1554, 3641, 2);
gap.run(42216, { x: 1554, y: 3641 }, 2, "jump");
assert.deepEqual(gap.teleports[0], { x: 1554, y: 3631, level: 0 });
assert.equal(gap.forced.length, 0, "gap drop is a plane change");
assert.deepEqual(gap.xp, [106]);
assert(gap.messages.some((m) => /completed the Shayzien basic agility course/i.test(m)));
assert.equal(getShayzienCourseStage(1), 0);
assert.equal(
    5.5 + 8 + 9 + 7 + 9 + 9 + 106,
    153.5,
    "basic lap sums to 153.5",
);

resetShayzienCourseProgress(2);
const skipGap = makeSession(2, 1554, 3641, 2);
skipGap.run(42216, { x: 1554, y: 3641 }, 2, "jump");
assert.deepEqual(skipGap.xp, [106], "out-of-order gap still awards obstacle XP");
assert.equal(
    skipGap.messages.some((m) => /completed the Shayzien basic agility course/i.test(m)),
    false,
);

const tooLow = makeSession(3, 1523, 3633, 2, 44, kit);
tooLow.run(42217, { x: 1512, y: 3637 }, 2, "grapple");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 45/i.test(m)));
assert.equal(getShayzienCourseStage(3), 0);

const noKit = makeSession(4, 1523, 3633, 2, 45);
noKit.run(42217, { x: 1512, y: 3637 }, 2, "grapple");
assert.equal(noKit.teleports.length, 0);
assert.equal(noKit.xp.length, 0);
assert(noKit.messages.some((m) => /crossbow and a mithril grapple/i.test(m)));

const ballista = makeSession(5, 1523, 3633, 2, 45, {
    weaponId: LIGHT_BALLISTA,
    ammoId: MITH_GRAPPLE,
});
ballista.run(42217, { x: 1512, y: 3637 }, 2, "grapple");
assert.equal(ballista.teleports.length, 0);
assert(ballista.messages.some((m) => /crossbow and a mithril grapple/i.test(m)));

resetShayzienCourseProgress(6);
const advStart = makeSession(6, 1554, 3631, 0, 45, kit);
advStart.run(42209, { x: 1554, y: 3631 }, 0, "climb");
advStart.run(42210, { x: 1552, y: 3633 }, 3, "climb");
advStart.run(42212, { x: 1536, y: 3633 }, 2, "cross");
assert.equal(getShayzienCourseStage(6), 3);

const beam1 = makeSession(6, 1523, 3633, 2, 45, kit);
beam1.run(42217, { x: 1512, y: 3637 }, 2, "grapple");
assert.deepEqual(beam1.teleports[0], { x: 1510, y: 3634, level: 2 });
assert.deepEqual(beam1.xp, [23]);
assert.equal(getShayzienCourseStage(6), 4);
assert.equal(isShayzienAdvancedLap(6), true);

const edge1 = makeSession(6, 1510, 3634, 2, 45, kit);
edge1.run(42218, { x: 1510, y: 3634 }, 2, "jump");
assert.deepEqual(edge1.teleports[0], { x: 1510, y: 3627, level: 2 });
assert.deepEqual(edge1.xp, [18]);
assert.equal(getShayzienCourseStage(6), 5);

const edge2 = makeSession(6, 1510, 3627, 2, 45, kit);
edge2.run(42219, { x: 1510, y: 3627 }, 2, "jump");
assert.deepEqual(edge2.teleports[0], { x: 1512, y: 3619, level: 2 });
assert.deepEqual(edge2.xp, [21]);
assert.equal(getShayzienCourseStage(6), 6);

const beam2 = makeSession(6, 1512, 3619, 2, 45, kit);
beam2.run(42220, { x: 1512, y: 3619 }, 2, "grapple");
assert.deepEqual(beam2.teleports[0], { x: 1522, y: 3621, level: 2 });
assert.deepEqual(beam2.xp, [23]);
assert.equal(getShayzienCourseStage(6), 7);

const zip = makeSession(6, 1522, 3621, 2, 45, kit);
zip.run(42221, { x: 1522, y: 3621 }, 2, "slide");
assert.deepEqual(zip.teleports[0], { x: 1522, y: 3621, level: 0 });
assert.deepEqual(zip.xp, [400]);
assert(zip.messages.some((m) => /completed the Shayzien advanced agility course/i.test(m)));
assert.equal(getShayzienCourseStage(6), 0);
assert.equal(
    5.5 + 8 + 9 + 23 + 18 + 21 + 23 + 400,
    507.5,
    "advanced lap sums to 507.5",
);

resetShayzienCourseProgress(7);
const skipZip = makeSession(7, 1522, 3621, 2, 45, kit);
skipZip.run(42221, { x: 1522, y: 3621 }, 2, "slide");
assert.deepEqual(skipZip.xp, [400], "out-of-order zipline still awards obstacle XP");
assert.equal(
    skipZip.messages.some((m) => /completed the Shayzien advanced agility course/i.test(m)),
    false,
);

const climbAlias = makeSession(8, 1554, 3631, 0);
climbAlias.run(42209, { x: 1554, y: 3631 }, 0);
assert.deepEqual(climbAlias.xp, [5.5]);

assert(locHandlers.has("42210:climb"), "shared monkeybar clickzone 42210");
assert(locHandlers.has("42220:grapple"), "second beam loc 42220");

console.log("agility-shayzien-course.test.ts: all assertions passed");
