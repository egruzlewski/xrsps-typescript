import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnLocEvent,
    ItemOnLocHandler,
    ItemOnNpcEvent,
    ItemOnNpcHandler,
    LocInteractionEvent,
    LocInteractionHandler,
    NpcInteractionEvent,
    NpcInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import {
    getDorgeshKaanCourseStage,
    register,
    resetDorgeshKaanCourseProgress,
    setDorgeshKaanRequestedParts,
} from "../gamemodes/vanilla/skills/agility/dorgeshKaan";

resetDorgeshKaanCourseProgress();

const locHandlers = new Map<string, LocInteractionHandler>();
const npcHandlers = new Map<string, NpcInteractionHandler>();
const itemOnNpcHandlers = new Map<string, ItemOnNpcHandler>();
const itemOnLocHandlers = new Map<string, ItemOnLocHandler>();
const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerNpcInteraction: (npcId: number, handler: NpcInteractionHandler, action?: string) => {
        npcHandlers.set(`${npcId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerItemOnNpc: (itemId: number, npcId: number, handler: ItemOnNpcHandler) => {
        itemOnNpcHandlers.set(`${itemId}:${npcId}`, handler);
        return { unregister() {} };
    },
    registerItemOnLoc: (itemId: number, locId: number, handler: ItemOnLocHandler) => {
        itemOnLocHandlers.set(`${itemId}:${locId}`, handler);
        return { unregister() {} };
    },
} as unknown as IScriptRegistry;

register(registry);

function locHandler(locId: number, action?: string): LocInteractionHandler {
    const found = locHandlers.get(`${locId}:${action ?? "*"}`);
    assert(found, `expected loc handler for ${locId} action=${action}`);
    return found;
}

type Teleport = { x: number; y: number; level: number };
type Forced = { startTile: { x: number; y: number }; endTile: { x: number; y: number }; endTick: number };
type XpGain = { skillId: number; amount: number };

const TURGALL_NPC_ID = 2295;
const SPANNER_ITEM_ID = 10975;
const POWERBOX_ID = 10993;
const CAPACITOR_ID = 10989;
const BRONZE_CROSSBOW = 9174;
const MITH_GRAPPLE = 9419;
const LIGHT_BALLISTA = 19478;

function makeSession(
    playerId: number,
    tileX: number,
    tileY: number,
    level: number,
    agilityLevel = 70,
    opts: {
        strengthLevel?: number;
        rangedLevel?: number;
        weaponId?: number;
        ammoId?: number;
    } = {},
) {
    const messages: string[] = [];
    const xp: XpGain[] = [];
    const teleports: Teleport[] = [];
    const forced: Forced[] = [];
    const seqs: number[] = [];
    const givenItems: Array<{ itemId: number; qty: number }> = [];
    const counts = new Map<number, number>();
    let inventoryFull = false;
    const player = {
        id: playerId,
        tileX,
        tileY,
        level,
        clearPendingSeqs: () => undefined,
        items: {
            getItemCount: (itemId: number) => counts.get(itemId) ?? 0,
            removeItem: (itemId: number, amount: number) => {
                const have = counts.get(itemId) ?? 0;
                if (have < amount) {
                    return { completed: 0 };
                }
                counts.set(itemId, have - amount);
                return { completed: amount };
            },
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
                xp.push({ skillId, amount });
            },
            getSkill: (_p: PlayerState, skillId: number) => {
                if (skillId === SkillId.Agility) {
                    return { baseLevel: agilityLevel, boost: 0 };
                }
                if (skillId === SkillId.Strength) {
                    return { baseLevel: opts.strengthLevel ?? agilityLevel, boost: 0 };
                }
                if (skillId === SkillId.Ranged) {
                    return { baseLevel: opts.rangedLevel ?? agilityLevel, boost: 0 };
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
        inventory: {
            addItemToInventory: (_p: PlayerState, itemId: number, qty: number) => {
                if (inventoryFull) {
                    return { slot: -1, added: 0 };
                }
                givenItems.push({ itemId, qty });
                counts.set(itemId, (counts.get(itemId) ?? 0) + qty);
                return { slot: 0, added: qty };
            },
            snapshotInventory: () => undefined,
        },
    } as unknown as ScriptServices;

    const runLoc = (locId: number, tile: { x: number; y: number }, locLevel: number, action?: string) => {
        const event = {
            player,
            locId,
            tile,
            level: locLevel,
            action,
            tick: 100,
            services,
        } as LocInteractionEvent;
        locHandler(locId, action)(event);
    };

    const runNpc = (action?: string) => {
        const found = npcHandlers.get(`${TURGALL_NPC_ID}:${action ?? "*"}`);
        assert(found, `expected Turgall handler action=${action}`);
        found({ player, npc: { id: TURGALL_NPC_ID }, option: action, services } as unknown as NpcInteractionEvent);
    };

    const runItemOnLoc = (itemId: number, locId: number) => {
        const found = itemOnLocHandlers.get(`${itemId}:${locId}`);
        assert(found, `expected item-on-loc ${itemId} → ${locId}`);
        found({
            player,
            source: { slot: 0, itemId },
            target: { locId, tile: { x: 2702, y: 5190 }, level: 2 },
            services,
        } as unknown as ItemOnLocEvent);
    };

    const runItemOnTurgall = (itemId: number) => {
        const found = itemOnNpcHandlers.get(`${itemId}:${TURGALL_NPC_ID}`);
        assert(found, `expected item-on-turgall ${itemId}`);
        found({
            player,
            source: { slot: 0, itemId },
            target: { id: TURGALL_NPC_ID },
            services,
        } as unknown as ItemOnNpcEvent);
    };

    return {
        player,
        messages,
        xp,
        teleports,
        forced,
        seqs,
        givenItems,
        counts,
        get inventoryFull() {
            return inventoryFull;
        },
        set inventoryFull(value: boolean) {
            inventoryFull = value;
        },
        runLoc,
        runNpc,
        runItemOnLoc,
        runItemOnTurgall,
    };
}

const tooLow = makeSession(9, 2721, 5238, 3, 69);
tooLow.runLoc(22569, { x: 2721, y: 5240 }, 3, "walk-across");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 70/i.test(m)));
assert.equal(getDorgeshKaanCourseStage(9), 0);

const cable = makeSession(1, 2721, 5238, 3);
cable.runLoc(22569, { x: 2721, y: 5240 }, 3, "walk-across");
assert.deepEqual(cable.teleports[0], { x: 2721, y: 5248, level: 3 });
assert.equal(cable.forced.length, 1);
assert.deepEqual(cable.xp, [{ skillId: SkillId.Agility, amount: 25 }]);
assert(cable.messages.some((m) => /walk carefully across the cable/i.test(m)));

const swing = makeSession(1, 2729, 5226, 3);
swing.runLoc(22572, { x: 2729, y: 5228 }, 3, "swing");
assert.deepEqual(swing.teleports[0], { x: 2729, y: 5234, level: 3 });
assert.deepEqual(swing.xp, [{ skillId: SkillId.Agility, amount: 22 }]);

const ladder = makeSession(1, 2715, 5192, 3);
ladder.runLoc(22564, { x: 2717, y: 5192 }, 3, "swing-across");
assert.deepEqual(ladder.teleports[0], { x: 2725, y: 5192, level: 3 });
assert.deepEqual(ladder.xp, [{ skillId: SkillId.Agility, amount: 25 }]);

const wall = makeSession(1, 2721, 5212, 3);
wall.runLoc(22552, { x: 2721, y: 5214 }, 3, "squeeze-past");
assert.deepEqual(wall.teleports[0], { x: 2721, y: 5216, level: 3 });
assert.deepEqual(wall.xp, [{ skillId: SkillId.Agility, amount: 7.5 }]);

const tunnel = makeSession(1, 2721, 5204, 3);
tunnel.runLoc(22557, { x: 2721, y: 5206 }, 3, "squeeze-through");
assert.deepEqual(tunnel.teleports[0], { x: 2721, y: 5209, level: 3 });
assert.deepEqual(tunnel.xp, [{ skillId: SkillId.Agility, amount: 7.5 }]);

const noKit = makeSession(2, 2710, 5240, 3, 70);
noKit.runLoc(22664, { x: 2710, y: 5242 }, 3, "grapple");
assert.equal(noKit.teleports.length, 0);
assert.equal(noKit.xp.length, 0);
assert(noKit.messages.some((m) => /crossbow and a mithril grapple/i.test(m)));

const lowRange = makeSession(2, 2710, 5240, 3, 70, {
    rangedLevel: 69,
    strengthLevel: 70,
    weaponId: BRONZE_CROSSBOW,
    ammoId: MITH_GRAPPLE,
});
lowRange.runLoc(22664, { x: 2710, y: 5242 }, 3, "grapple");
assert.equal(lowRange.teleports.length, 0);
assert(lowRange.messages.some((m) => /Agility, Strength and Ranged levels of 70/i.test(m)));

const ballista = makeSession(2, 2710, 5240, 3, 70, {
    weaponId: LIGHT_BALLISTA,
    ammoId: MITH_GRAPPLE,
});
ballista.runLoc(22664, { x: 2710, y: 5242 }, 3, "grapple");
assert.equal(ballista.teleports.length, 0);

const pylon = makeSession(2, 2710, 5240, 3, 70, {
    weaponId: BRONZE_CROSSBOW,
    ammoId: MITH_GRAPPLE,
});
pylon.runLoc(22664, { x: 2710, y: 5242 }, 3, "grapple");
assert.deepEqual(pylon.teleports[0], { x: 2710, y: 5252, level: 3 });
assert.deepEqual(pylon.xp, [
    { skillId: SkillId.Agility, amount: 18 },
    { skillId: SkillId.Strength, amount: 18 },
    { skillId: SkillId.Ranged, amount: 18 },
]);

const turgall = makeSession(3, 2741, 5241, 2);
turgall.runNpc("talk-to");
assert.equal(turgall.counts.get(SPANNER_ITEM_ID), 1);
assert(turgall.messages.some((m) => /gives you a spanner/i.test(m)));
assert(turgall.messages.some((m) => /powerbox or a capacitor/i.test(m)));
assert.equal(getDorgeshKaanCourseStage(3), 1);

turgall.runNpc("talk-to");
assert.equal(turgall.counts.get(SPANNER_ITEM_ID), 1, "a second talk does not grant another spanner");

const fullInv = makeSession(4, 2741, 5241, 2);
fullInv.inventoryFull = true;
fullInv.runNpc("talk-to");
assert.equal(fullInv.counts.get(SPANNER_ITEM_ID) ?? 0, 0);
assert(fullInv.messages.some((m) => /free inventory space/i.test(m)));

resetDorgeshKaanCourseProgress(5);
const agilityLap = makeSession(5, 2721, 5238, 3);
agilityLap.runNpc("talk-to");
agilityLap.runLoc(22569, { x: 2721, y: 5240 }, 3, "walk-across");
agilityLap.runItemOnLoc(SPANNER_ITEM_ID, 22635);
assert.equal(agilityLap.counts.get(POWERBOX_ID), 1);
assert.equal(getDorgeshKaanCourseStage(5), 2);
assert(agilityLap.messages.some((m) => /disassemble a powerbox/i.test(m)));

agilityLap.runLoc(22569, { x: 2721, y: 5240 }, 3, "walk-across");
assert.deepEqual(
    agilityLap.xp.filter((g) => g.skillId === SkillId.Agility).map((g) => g.amount),
    [25, 25],
    "return cable still awards 25 XP",
);
agilityLap.runNpc("talk-to");
assert.equal(agilityLap.counts.get(POWERBOX_ID), 0);
assert.deepEqual(
    agilityLap.xp.filter((g) => g.amount === 2432),
    [{ skillId: SkillId.Agility, amount: 2432 }],
);
assert(agilityLap.messages.some((m) => /completed the Dorgesh-Kaan Agility course/i.test(m)));
assert.equal(getDorgeshKaanCourseStage(5), 0);

resetDorgeshKaanCourseProgress(6);
const grappleLap = makeSession(6, 2710, 5240, 3, 70, {
    weaponId: BRONZE_CROSSBOW,
    ammoId: MITH_GRAPPLE,
});
grappleLap.runNpc("talk-to");
grappleLap.runLoc(22664, { x: 2710, y: 5242 }, 3, "grapple");
grappleLap.runItemOnLoc(SPANNER_ITEM_ID, 22634);
assert.equal(grappleLap.counts.get(CAPACITOR_ID), 1);
grappleLap.runLoc(22664, { x: 2710, y: 5242 }, 3, "grapple");
grappleLap.runItemOnTurgall(CAPACITOR_ID);
assert.equal(grappleLap.counts.get(CAPACITOR_ID), 0);
assert.deepEqual(
    grappleLap.xp.filter((g) => g.amount === 1142),
    [{ skillId: SkillId.Ranged, amount: 1142 }],
);
assert(grappleLap.messages.some((m) => /completed the Dorgesh-Kaan Agility course/i.test(m)));

resetDorgeshKaanCourseProgress(7);
const mixedLap = makeSession(7, 2721, 5238, 3, 70, {
    weaponId: BRONZE_CROSSBOW,
    ammoId: MITH_GRAPPLE,
});
mixedLap.runNpc("talk-to");
mixedLap.runLoc(22569, { x: 2721, y: 5240 }, 3, "walk-across");
mixedLap.runItemOnLoc(SPANNER_ITEM_ID, 22634);
assert.equal(mixedLap.counts.get(CAPACITOR_ID), 1);
mixedLap.runLoc(22664, { x: 2710, y: 5242 }, 3, "grapple");
mixedLap.runNpc("talk-to");
assert.deepEqual(
    mixedLap.xp.filter((g) => g.amount === 1216 || g.amount === 571),
    [
        { skillId: SkillId.Agility, amount: 1216 },
        { skillId: SkillId.Ranged, amount: 571 },
    ],
);

resetDorgeshKaanCourseProgress(8);
const heavyPylon = makeSession(8, 2710, 5240, 3, 70, {
    weaponId: BRONZE_CROSSBOW,
    ammoId: MITH_GRAPPLE,
});
heavyPylon.runNpc("talk-to");
heavyPylon.runLoc(22569, { x: 2721, y: 5240 }, 3, "walk-across");
heavyPylon.runItemOnLoc(SPANNER_ITEM_ID, 22635);
heavyPylon.runLoc(22664, { x: 2710, y: 5242 }, 3, "grapple");
assert.equal(heavyPylon.teleports.length, 1, "heavy part blocks the pylon (fail-proof, no fall)");
assert(heavyPylon.messages.some((m) => /heavy part across the pylons/i.test(m)));

resetDorgeshKaanCourseProgress(10);
const delicateTunnel = makeSession(10, 2721, 5204, 3, 70, {
    weaponId: BRONZE_CROSSBOW,
    ammoId: MITH_GRAPPLE,
});
delicateTunnel.runNpc("talk-to");
delicateTunnel.runLoc(22664, { x: 2710, y: 5242 }, 3, "grapple");
delicateTunnel.runItemOnLoc(SPANNER_ITEM_ID, 22634);
delicateTunnel.runLoc(22557, { x: 2721, y: 5206 }, 3, "squeeze-through");
assert.equal(delicateTunnel.teleports.length, 1, "delicate part is blocked on the agility tunnel");
assert(delicateTunnel.messages.some((m) => /delicate part would be crushed/i.test(m)));

resetDorgeshKaanCourseProgress(11);
const skipDelivery = makeSession(11, 2741, 5241, 2);
skipDelivery.runNpc("talk-to");
skipDelivery.runItemOnLoc(SPANNER_ITEM_ID, 22635);
skipDelivery.runNpc("talk-to");
assert.equal(
    skipDelivery.messages.some((m) => /completed the Dorgesh-Kaan Agility course/i.test(m)),
    false,
    "delivery without both routes is not a lap",
);
assert.equal(skipDelivery.counts.get(POWERBOX_ID), 1);

const defaultAction = makeSession(12, 2721, 5238, 3);
defaultAction.runLoc(22569, { x: 2721, y: 5240 }, 3);
assert.deepEqual(defaultAction.xp, [{ skillId: SkillId.Agility, amount: 25 }]);

const walkAcrossAlias = makeSession(13, 2721, 5238, 3);
walkAcrossAlias.runLoc(22569, { x: 2721, y: 5240 }, 3, "walk across");
assert.deepEqual(walkAcrossAlias.xp, [{ skillId: SkillId.Agility, amount: 25 }]);

resetDorgeshKaanCourseProgress(14);
setDorgeshKaanRequestedParts(14, 10991, 10985);
const otherParts = makeSession(14, 2721, 5238, 3);
otherParts.runNpc("talk-to");
assert(otherParts.messages.some((m) => /lever or a fuse/i.test(m)));
otherParts.runLoc(22569, { x: 2721, y: 5240 }, 3, "walk-across");
otherParts.runItemOnLoc(SPANNER_ITEM_ID, 22635);
assert.equal(otherParts.counts.get(10991), 1);
assert.equal(otherParts.counts.get(POWERBOX_ID) ?? 0, 0);

console.log("agility-dorgesh-kaan-course.test.ts: all assertions passed");
