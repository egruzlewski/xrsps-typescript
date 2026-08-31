import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnNpcEvent,
    ItemOnNpcHandler,
    LocInteractionEvent,
    LocInteractionHandler,
    NpcInteractionEvent,
    NpcInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import {
    getWerewolfCourseStage,
    register,
    resetWerewolfCourseProgress,
} from "../gamemodes/vanilla/skills/agility/werewolf";

resetWerewolfCourseProgress();

const locHandlers = new Map<string, LocInteractionHandler>();
const npcHandlers = new Map<string, NpcInteractionHandler>();
const itemOnNpcHandlers = new Map<string, ItemOnNpcHandler>();
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
} as unknown as IScriptRegistry;

register(registry);

function locHandler(locId: number, action?: string): LocInteractionHandler {
    const found = locHandlers.get(`${locId}:${action ?? "*"}`);
    assert(found, `expected loc handler for ${locId} action=${action}`);
    return found;
}

type Teleport = { x: number; y: number; level: number };
type Forced = { startTile: { x: number; y: number }; endTile: { x: number; y: number }; endTick: number };

const STICK_ITEM_ID = 4179;
const TRAINER_NPC_ID = 5927;

function makeSession(playerId: number, tileX: number, tileY: number, level: number, agilityLevel = 60) {
    const messages: string[] = [];
    const xp: number[] = [];
    const teleports: Teleport[] = [];
    const forced: Forced[] = [];
    const seqs: number[] = [];
    const givenItems: Array<{ itemId: number; qty: number }> = [];
    let stickCount = 0;
    let inventoryFull = false;
    const player = {
        id: playerId,
        tileX,
        tileY,
        level,
        clearPendingSeqs: () => undefined,
        items: {
            getItemCount: (itemId: number) => (itemId === STICK_ITEM_ID ? stickCount : 0),
            removeItem: (itemId: number, amount: number) => {
                if (itemId !== STICK_ITEM_ID || stickCount < amount) {
                    return { completed: 0 };
                }
                stickCount -= amount;
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
        inventory: {
            addItemToInventory: (_p: PlayerState, itemId: number, qty: number) => {
                if (inventoryFull) {
                    return { slot: -1, added: 0 };
                }
                givenItems.push({ itemId, qty });
                if (itemId === STICK_ITEM_ID) {
                    stickCount += qty;
                }
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
        const found = npcHandlers.get(`${TRAINER_NPC_ID}:${action ?? "*"}`);
        assert(found, `expected trainer handler action=${action}`);
        found({ player, npc: { id: TRAINER_NPC_ID }, option: action, services } as unknown as NpcInteractionEvent);
    };

    const runItemOnTrainer = () => {
        const found = itemOnNpcHandlers.get(`${STICK_ITEM_ID}:${TRAINER_NPC_ID}`);
        assert(found, "expected stick-on-trainer handler");
        found({
            player,
            source: { slot: 0, itemId: STICK_ITEM_ID },
            target: { id: TRAINER_NPC_ID },
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
        get stickCount() {
            return stickCount;
        },
        set stickCount(value: number) {
            stickCount = value;
        },
        set inventoryFull(value: boolean) {
            inventoryFull = value;
        },
        runLoc,
        runNpc,
        runItemOnTrainer,
    };
}

const tooLow = makeSession(9, 3540, 9876, 0, 59);
tooLow.runLoc(11643, { x: 3540, y: 9878 }, 0, "jump-to");
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.xp.length, 0);
assert(tooLow.messages.some((m) => /Agility level of 60/i.test(m)));
assert.equal(getWerewolfCourseStage(9), 0);

const stone = makeSession(1, 3540, 9876, 0);
stone.runLoc(11643, { x: 3540, y: 9878 }, 0, "jump-to");
assert.deepEqual(stone.teleports[0], { x: 3540, y: 9878, level: 0 });
assert.equal(stone.forced.length, 1);
assert.deepEqual(stone.xp, [50]);
assert.equal(getWerewolfCourseStage(1), 1);
assert(stone.messages.some((m) => /stepping stone/i.test(m)));

stone.runLoc(11643, { x: 3540, y: 9881 }, 0, "jump-to");
assert.deepEqual(stone.xp, [50], "further stepping stones do not re-award the 50 XP");
assert.equal(getWerewolfCourseStage(1), 1);
assert.deepEqual(stone.teleports[1], { x: 3540, y: 9881, level: 0 });

const hurdle = makeSession(1, 3539, 9891, 0);
hurdle.runLoc(11638, { x: 3539, y: 9893 }, 0, "jump");
assert.deepEqual(hurdle.teleports[0], { x: 3539, y: 9895, level: 0 });
assert.equal(hurdle.forced.length, 1);
assert.deepEqual(hurdle.xp, [60]);
assert.equal(getWerewolfCourseStage(1), 2);

hurdle.runLoc(11639, { x: 3539, y: 9896 }, 0, "jump");
assert.deepEqual(hurdle.xp, [60], "further hurdles do not re-award the 60 XP");
assert.equal(getWerewolfCourseStage(1), 2);
assert.deepEqual(hurdle.teleports[1], { x: 3539, y: 9898, level: 0 });

const pipe = makeSession(1, 3538, 9903, 0);
pipe.runLoc(11657, { x: 3538, y: 9905 }, 0, "squeeze-through");
assert.deepEqual(pipe.teleports[0], { x: 3538, y: 9908, level: 0 });
assert.equal(pipe.forced.length, 1);
assert.deepEqual(pipe.xp, [15]);
assert.equal(getWerewolfCourseStage(1), 3);
assert.equal(pipe.stickCount, 1);
assert(pipe.givenItems.some((g) => g.itemId === STICK_ITEM_ID && g.qty === 1));
assert(pipe.messages.some((m) => /pick up the stick/i.test(m)));

pipe.runLoc(11657, { x: 3538, y: 9908 }, 0, "squeeze-through");
assert.deepEqual(pipe.xp, [15], "further pipes do not re-award the 15 XP");
assert.equal(pipe.stickCount, 1, "a second pipe does not grant another stick");
assert.equal(getWerewolfCourseStage(1), 3);

const slope = makeSession(1, 3534, 9910, 0);
slope.runLoc(11641, { x: 3532, y: 9910 }, 0, "climb-up");
assert.deepEqual(slope.teleports[0], { x: 3530, y: 9910, level: 0 });
assert.equal(slope.forced.length, 1);
assert.deepEqual(slope.xp, [25]);
assert.equal(getWerewolfCourseStage(1), 4);

const zip = makeSession(1, 3528, 9910, 0);
zip.stickCount = 1;
zip.runLoc(11644, { x: 3528, y: 9911 }, 0, "teeth-grip");
assert.deepEqual(zip.teleports[0], { x: 3530, y: 9867, level: 0 });
assert.equal(zip.forced.length, 1);
assert.deepEqual(zip.xp, [200]);
assert(zip.messages.some((m) => /completed the Werewolf Agility course/i.test(m)));
assert.equal(getWerewolfCourseStage(1), 0);

zip.runNpc("give-stick");
assert.deepEqual(zip.xp, [200, 380]);
assert.equal(zip.stickCount, 0);
assert(zip.messages.some((m) => /give the stick to the Agility Trainer/i.test(m)));

resetWerewolfCourseProgress(2);
const skipToEnd = makeSession(2, 3528, 9910, 0);
skipToEnd.runLoc(11646, { x: 3528, y: 9911 }, 0, "teeth-grip");
assert.deepEqual(skipToEnd.xp, [200], "final zip line without a lap awards obstacle XP only");
assert.equal(
    skipToEnd.messages.some((m) => /completed the Werewolf Agility course/i.test(m)),
    false,
);

const defaultAction = makeSession(3, 3540, 9876, 0);
defaultAction.runLoc(11643, { x: 3540, y: 9878 }, 0);
assert.deepEqual(defaultAction.teleports[0], { x: 3540, y: 9878, level: 0 });
assert.deepEqual(defaultAction.xp, [50]);
assert.equal(getWerewolfCourseStage(3), 1);

const jumpToAlias = makeSession(4, 3540, 9876, 0);
jumpToAlias.runLoc(11643, { x: 3540, y: 9878 }, 0, "jump to");
assert.deepEqual(jumpToAlias.xp, [50]);

const noStick = makeSession(5, 3530, 9865, 0);
noStick.runNpc("give-stick");
assert.equal(noStick.xp.length, 0);
assert(noStick.messages.some((m) => /don't have a stick/i.test(m)));

const itemOnNpc = makeSession(6, 3530, 9865, 0);
itemOnNpc.stickCount = 1;
itemOnNpc.runItemOnTrainer();
assert.deepEqual(itemOnNpc.xp, [380]);
assert.equal(itemOnNpc.stickCount, 0);

resetWerewolfCourseProgress(7);
const fullInv = makeSession(7, 3538, 9903, 0);
fullInv.runLoc(11643, { x: 3540, y: 9878 }, 0, "jump-to");
fullInv.runLoc(11638, { x: 3539, y: 9893 }, 0, "jump");
fullInv.inventoryFull = true;
fullInv.runLoc(11657, { x: 3538, y: 9905 }, 0, "squeeze-through");
assert.deepEqual(fullInv.xp, [50, 60, 15]);
assert.equal(fullInv.stickCount, 0);
assert(fullInv.messages.some((m) => /free inventory space/i.test(m)));

console.log("agility-werewolf-course.test.ts: all assertions passed");
