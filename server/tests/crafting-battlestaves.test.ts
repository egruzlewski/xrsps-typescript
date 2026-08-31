import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    ItemOnItemHandler,
    ScriptActionHandler,
    ScriptActionHandlerContext,
    ScriptInventoryEntry,
    ScriptServices,
    ScriptSkillMultiRequest,
} from "../src/game/scripts/types";
import { register as registerCrafting } from "../gamemodes/vanilla/skills/crafting";
import {
    AIR_BATTLESTAFF_ITEM_ID,
    AIR_ORB_ITEM_ID,
    BATTLESTAFF_ITEM_ID,
    EARTH_BATTLESTAFF_ITEM_ID,
    EARTH_ORB_ITEM_ID,
    FIRE_BATTLESTAFF_ITEM_ID,
    FIRE_ORB_ITEM_ID,
    UNPOWERED_ORB_ITEM_ID,
    WATER_BATTLESTAFF_ITEM_ID,
    WATER_ORB_ITEM_ID,
    getBattlestaffRecipeById,
    getBattlestaffRecipeByOrbId,
} from "../gamemodes/vanilla/skills/crafting/battlestavesData";

const water = getBattlestaffRecipeById("water_battlestaff");
assert(water);
assert.equal(water.orbItemId, WATER_ORB_ITEM_ID);
assert.equal(water.productItemId, WATER_BATTLESTAFF_ITEM_ID);
assert.equal(water.level, 54);
assert.equal(water.xp, 100);

const earth = getBattlestaffRecipeByOrbId(EARTH_ORB_ITEM_ID);
assert(earth);
assert.equal(earth.productItemId, EARTH_BATTLESTAFF_ITEM_ID);
assert.equal(earth.level, 58);
assert.equal(earth.xp, 112.5);

const fire = getBattlestaffRecipeById("fire_battlestaff");
assert(fire);
assert.equal(fire.orbItemId, FIRE_ORB_ITEM_ID);
assert.equal(fire.productItemId, FIRE_BATTLESTAFF_ITEM_ID);
assert.equal(fire.level, 62);
assert.equal(fire.xp, 125);

const air = getBattlestaffRecipeById("air_battlestaff");
assert(air);
assert.equal(air.orbItemId, AIR_ORB_ITEM_ID);
assert.equal(air.productItemId, AIR_BATTLESTAFF_ITEM_ID);
assert.equal(air.level, 66);
assert.equal(air.xp, 137.5);

const itemOnItem = new Map<string, ItemOnItemHandler>();
const actionHandlers = new Map<string, ScriptActionHandler>();

const registry = {
    registerLocInteraction: () => ({ unregister() {} }),
    registerItemOnLoc: () => ({ unregister() {} }),
    registerItemOnItem: (a: number, b: number, handler: ItemOnItemHandler) => {
        itemOnItem.set(`${a}:${b}`, handler);
        itemOnItem.set(`${b}:${a}`, handler);
        return { unregister() {} };
    },
    registerItemAction: () => ({ unregister() {} }),
    registerNpcScript: () => ({ unregister() {} }),
    registerTickHandler: () => ({ unregister() {} }),
    registerActionHandler: (kind: string, handler: ScriptActionHandler) => {
        actionHandlers.set(kind, handler);
        return { unregister() {} };
    },
} as unknown as IScriptRegistry;

type Slot = ScriptInventoryEntry;

const slots: Slot[] = [];
const messages: string[] = [];
const xp: number[] = [];
const seqs: number[] = [];
const actions: Array<{ kind: string; data?: unknown }> = [];
const skillMultis: ScriptSkillMultiRequest[] = [];
const player = { id: 6 } as PlayerState;
let craftLevel = 99;

function resetState(level: number, items: Array<{ itemId: number; quantity: number }>): void {
    craftLevel = level;
    slots.splice(
        0,
        slots.length,
        ...items.map((item, index) => ({
            slot: index,
            itemId: item.itemId,
            quantity: item.quantity,
        })),
    );
    messages.length = 0;
    xp.length = 0;
    seqs.length = 0;
    actions.length = 0;
    skillMultis.length = 0;
}

const services = {
    inventory: {
        getInventoryItems: () => slots,
        findInventorySlotWithItem: (_p: PlayerState, itemId: number) =>
            slots.find((slot) => slot.itemId === itemId && slot.quantity > 0)?.slot,
        consumeItem: (_p: PlayerState, slotIndex: number) => {
            const slot = slots.find((entry) => entry.slot === slotIndex);
            if (!slot || slot.itemId <= 0 || slot.quantity <= 0) return false;
            slot.quantity -= 1;
            if (slot.quantity <= 0) {
                slot.itemId = -1;
                slot.quantity = 0;
            }
            return true;
        },
        setInventorySlot: (_p: PlayerState, slotIndex: number, itemId: number, qty: number) => {
            const slot = slots.find((entry) => entry.slot === slotIndex);
            if (!slot) {
                slots.push({ slot: slotIndex, itemId, quantity: qty });
                return;
            }
            slot.itemId = itemId;
            slot.quantity = qty;
        },
        addItemToInventory: (_p: PlayerState, itemId: number, qty: number) => {
            const existing = slots.find((slot) => slot.itemId === itemId);
            if (existing) {
                existing.quantity += qty;
                return { slot: existing.slot, added: qty };
            }
            const empty = slots.find((slot) => slot.itemId <= 0 || slot.quantity <= 0);
            if (empty) {
                empty.itemId = itemId;
                empty.quantity = qty;
                return { slot: empty.slot, added: qty };
            }
            const slot = slots.length;
            slots.push({ slot, itemId, quantity: qty });
            return { slot, added: qty };
        },
        playerHasItem: (_p: PlayerState, itemId: number) =>
            slots.some((slot) => slot.itemId === itemId && slot.quantity > 0),
        snapshotInventory: () => undefined,
        snapshotInventoryImmediate: () => undefined,
        hasInventorySlot: () => true,
        canStoreItem: () => true,
    },
    messaging: {
        sendGameMessage: (_p: PlayerState, text: string) => messages.push(text),
    },
    skills: {
        getSkill: () => ({ baseLevel: craftLevel, boost: 0 }),
        addSkillXp: (_p: PlayerState, skillId: number, amount: number) => {
            assert.equal(skillId, SkillId.Crafting);
            xp.push(amount);
        },
    },
    animation: {
        playPlayerSeq: (_p: PlayerState, seqId: number) => seqs.push(seqId),
        playLocAnimation: () => undefined,
    },
    sound: { sendSound: () => undefined, enqueueSoundBroadcast: () => undefined },
    location: { faceTile: () => undefined, emitLocChange: () => undefined },
    dialog: {
        openSkillMulti: (_p: PlayerState, request: ScriptSkillMultiRequest) => {
            skillMultis.push(request);
        },
        openDialogOptions: () => false,
        closeDialog: () => undefined,
    },
    combat: {
        requestAction: (_p: PlayerState, request: { kind: string; data?: unknown }) => {
            actions.push(request);
            return { ok: true };
        },
        scheduleAction: (_playerId: number, request: { kind: string; data?: unknown }) => {
            actions.push(request);
            return { ok: true };
        },
    },
    data: {
        getLocDefinition: () => ({ name: "Table", ops: ["search"] }),
        getLocTypeLoader: () => undefined,
    },
    system: {
        getCurrentTick: () => 10,
        eventBus: { emit: () => undefined },
        logger: { info() {}, warn() {}, error() {}, debug() {} },
    },
    gathering: { registerTracker: () => undefined },
    npc: {},
} as unknown as ScriptServices;

function count(itemId: number): number {
    return slots.reduce((sum, slot) => (slot.itemId === itemId ? sum + slot.quantity : sum), 0);
}

function runAction(kind: string, data: unknown) {
    const handler = actionHandlers.get(kind);
    assert(handler, `expected action handler for ${kind}`);
    return handler({ player, data, tick: 10, services } as ScriptActionHandlerContext);
}

function useOnItem(first: number, second: number) {
    const handler = itemOnItem.get(`${first}:${second}`);
    assert(handler, `expected item-on-item handler for ${first}+${second}`);
    handler({
        player,
        source: { slot: 0, itemId: first },
        target: { slot: 1, itemId: second },
        tick: 4,
        services,
    } as ItemOnItemEvent);
}

registerCrafting(registry, services);

assert(itemOnItem.has(`${WATER_ORB_ITEM_ID}:${BATTLESTAFF_ITEM_ID}`));
assert(itemOnItem.has(`${EARTH_ORB_ITEM_ID}:${BATTLESTAFF_ITEM_ID}`));
assert(itemOnItem.has(`${FIRE_ORB_ITEM_ID}:${BATTLESTAFF_ITEM_ID}`));
assert(itemOnItem.has(`${AIR_ORB_ITEM_ID}:${BATTLESTAFF_ITEM_ID}`));
assert(itemOnItem.has(`${UNPOWERED_ORB_ITEM_ID}:${BATTLESTAFF_ITEM_ID}`));
assert(actionHandlers.has("skill.battlestaff"));

resetState(99, [
    { itemId: UNPOWERED_ORB_ITEM_ID, quantity: 1 },
    { itemId: BATTLESTAFF_ITEM_ID, quantity: 1 },
]);
useOnItem(UNPOWERED_ORB_ITEM_ID, BATTLESTAFF_ITEM_ID);
assert.equal(skillMultis.length, 0);
assert.equal(actions.length, 0);
assert.match(messages[0] ?? "", /obelisk/i);
assert.equal(count(UNPOWERED_ORB_ITEM_ID), 1);
assert.equal(count(BATTLESTAFF_ITEM_ID), 1);

resetState(1, [
    { itemId: WATER_ORB_ITEM_ID, quantity: 1 },
    { itemId: BATTLESTAFF_ITEM_ID, quantity: 1 },
]);
useOnItem(WATER_ORB_ITEM_ID, BATTLESTAFF_ITEM_ID);
assert.equal(skillMultis.length, 0);
assert.match(messages[0] ?? "", /Crafting level 54/);

resetState(99, [
    { itemId: WATER_ORB_ITEM_ID, quantity: 3 },
    { itemId: BATTLESTAFF_ITEM_ID, quantity: 2 },
]);
useOnItem(BATTLESTAFF_ITEM_ID, WATER_ORB_ITEM_ID);
assert.equal(skillMultis.length, 1);
assert.equal(skillMultis[0].products[0]?.itemId, WATER_BATTLESTAFF_ITEM_ID);
assert.equal(skillMultis[0].maxQuantity, 2);
skillMultis[0].onSelect?.(0, 2);
assert.equal(actions[0]?.kind, "skill.battlestaff");
assert.equal((actions[0]?.data as { count?: number })?.count, 2);

resetState(99, [
    { itemId: WATER_ORB_ITEM_ID, quantity: 2 },
    { itemId: BATTLESTAFF_ITEM_ID, quantity: 2 },
]);
const waterResult = runAction("skill.battlestaff", { recipeId: "water_battlestaff", count: 2 });
assert.equal(waterResult.ok, true);
assert.equal(count(WATER_BATTLESTAFF_ITEM_ID), 1);
assert.equal(count(WATER_ORB_ITEM_ID), 1);
assert.equal(count(BATTLESTAFF_ITEM_ID), 1);
assert.deepEqual(xp, [100]);
assert.equal(actions[0]?.kind, "skill.battlestaff");
assert.equal((actions[0]?.data as { count?: number })?.count, 1);
const waterMessage = waterResult.effects?.find((effect) => effect.type === "message");
assert(waterMessage && "message" in waterMessage);
assert.match(waterMessage.message, /attach the orb/i);

resetState(99, [
    { itemId: EARTH_ORB_ITEM_ID, quantity: 1 },
    { itemId: BATTLESTAFF_ITEM_ID, quantity: 1 },
]);
runAction("skill.battlestaff", { recipeId: "earth_battlestaff", count: 1 });
assert.equal(count(EARTH_BATTLESTAFF_ITEM_ID), 1);
assert.equal(count(EARTH_ORB_ITEM_ID), 0);
assert.equal(count(BATTLESTAFF_ITEM_ID), 0);
assert.deepEqual(xp, [112.5]);

resetState(99, [
    { itemId: FIRE_ORB_ITEM_ID, quantity: 1 },
    { itemId: BATTLESTAFF_ITEM_ID, quantity: 1 },
]);
runAction("skill.battlestaff", { recipeId: "fire_battlestaff", count: 1 });
assert.equal(count(FIRE_BATTLESTAFF_ITEM_ID), 1);
assert.deepEqual(xp, [125]);

resetState(66, [
    { itemId: AIR_ORB_ITEM_ID, quantity: 1 },
    { itemId: BATTLESTAFF_ITEM_ID, quantity: 1 },
]);
useOnItem(AIR_ORB_ITEM_ID, BATTLESTAFF_ITEM_ID);
assert.equal(skillMultis.length, 1);
runAction("skill.battlestaff", { recipeId: "air_battlestaff", count: 1 });
assert.equal(count(AIR_BATTLESTAFF_ITEM_ID), 1);
assert.equal(count(AIR_ORB_ITEM_ID), 0);
assert.equal(count(BATTLESTAFF_ITEM_ID), 0);
assert.deepEqual(xp, [137.5]);

resetState(99, [{ itemId: BATTLESTAFF_ITEM_ID, quantity: 1 }]);
runAction("skill.battlestaff", { recipeId: "water_battlestaff", count: 1 });
assert.equal(count(WATER_BATTLESTAFF_ITEM_ID), 0);
assert.equal(count(BATTLESTAFF_ITEM_ID), 1);
assert.equal(xp.length, 0);

console.log("crafting-battlestaves.test.ts: all assertions passed");
