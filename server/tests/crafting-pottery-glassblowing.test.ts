import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    ItemOnItemHandler,
    ItemOnLocEvent,
    ItemOnLocHandler,
    LocInteractionEvent,
    LocInteractionHandler,
    ScriptActionHandler,
    ScriptActionHandlerContext,
    ScriptInventoryEntry,
    ScriptServices,
    ScriptSkillMultiRequest,
} from "../src/game/scripts/types";
import { register as registerCrafting } from "../gamemodes/vanilla/skills/crafting";
import {
    BUCKET_OF_SAND_ITEM_ID,
    EMPTY_BUCKET_ITEM_ID,
    GLASSBLOWING_PIPE_ITEM_ID,
    MOLTEN_GLASS_ITEM_ID,
    MOLTEN_GLASS_XP,
    SODA_ASH_ITEM_ID,
    getGlassblowRecipeById,
} from "../gamemodes/vanilla/skills/crafting/glassblowingData";
import {
    SOFT_CLAY_ITEM_ID,
    getPotteryFireRecipeById,
    getPotteryShapeRecipeById,
} from "../gamemodes/vanilla/skills/crafting/potteryData";

const UNFIRED_POT = 1787;
const POT = 1931;
const UNFIRED_BOWL = 1791;
const BOWL = 1923;
const UNFIRED_CUP = 28193;
const BEER_GLASS = 1919;
const VIAL = 229;
const POTTER_WHEEL_LOC = 14887;
const POTTERY_OVEN_LOC = 11601;
const FURNACE_LOC = 24009;
const NOT_CRAFT_LOC = 12;

const shapePot = getPotteryShapeRecipeById("shape_pot");
assert(shapePot);
assert.equal(shapePot.unfiredItemId, UNFIRED_POT);
assert.equal(shapePot.level, 1);
assert.equal(shapePot.xp, 6.3);

const shapeCup = getPotteryShapeRecipeById("shape_cup");
assert(shapeCup);
assert.equal(shapeCup.unfiredQuantity, 4);
assert.equal(shapeCup.unfiredItemId, UNFIRED_CUP);
assert.equal(shapeCup.xp, 8.5);

const firePot = getPotteryFireRecipeById("fire_pot");
assert(firePot);
assert.equal(firePot.productItemId, POT);
assert.equal(firePot.xp, 6.3);

const fireBowl = getPotteryFireRecipeById("fire_bowl");
assert(fireBowl);
assert.equal(fireBowl.unfiredItemId, UNFIRED_BOWL);
assert.equal(fireBowl.productItemId, BOWL);
assert.equal(fireBowl.xp, 15);

const beerGlass = getGlassblowRecipeById("blow_beer_glass");
assert(beerGlass);
assert.equal(beerGlass.productItemId, BEER_GLASS);
assert.equal(beerGlass.level, 1);
assert.equal(beerGlass.xp, 17.5);

const vial = getGlassblowRecipeById("blow_vial");
assert(vial);
assert.equal(vial.productItemId, VIAL);
assert.equal(vial.level, 33);
assert.equal(vial.xp, 35);

const itemOnLoc = new Map<string, ItemOnLocHandler>();
const itemOnItem = new Map<string, ItemOnItemHandler>();
const locHandlers = new Map<string, LocInteractionHandler>();
const actionHandlers = new Map<string, ScriptActionHandler>();

const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? ""}`, handler);
        return { unregister() {} };
    },
    registerItemOnLoc: (itemId: number, locId: number, handler: ItemOnLocHandler) => {
        itemOnLoc.set(`${itemId}:${locId}`, handler);
        return { unregister() {} };
    },
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
const player = { id: 5 } as PlayerState;
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
        getLocDefinition: (locId: number) => {
            if (locId === POTTER_WHEEL_LOC) return { name: "Potter's Wheel", ops: ["form"] };
            if (locId === POTTERY_OVEN_LOC) return { name: "Pottery Oven", ops: ["fire"] };
            if (locId === FURNACE_LOC) return { name: "Furnace", ops: ["smelt"] };
            return { name: "Table", ops: ["search"] };
        },
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

function useOnLoc(itemId: number, locId: number, slot = 0) {
    const handler = itemOnLoc.get(`${itemId}:-1`) ?? itemOnLoc.get(`${itemId}:${locId}`);
    assert(handler, `expected item-on-loc handler for ${itemId}`);
    handler({
        player,
        source: { slot, itemId },
        target: { locId, tile: { x: 3087, y: 3409 }, level: 0 },
        tick: 1,
        services,
    } as ItemOnLocEvent);
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

function clickLoc(locId: number, action = "") {
    const handler = locHandlers.get(`${locId}:${action}`);
    assert(handler, `expected loc handler for ${locId}:${action}`);
    handler({
        player,
        locId,
        tile: { x: 3087, y: 3409 },
        level: 0,
        action: action || undefined,
        tick: 1,
        services,
    } as LocInteractionEvent);
}

registerCrafting(registry, services);

assert(itemOnLoc.has(`${SOFT_CLAY_ITEM_ID}:-1`), "soft clay should register on any potter's wheel");
assert(itemOnLoc.has(`${UNFIRED_POT}:-1`), "unfired pot should register on any pottery oven");
assert(itemOnLoc.has(`${BUCKET_OF_SAND_ITEM_ID}:-1`), "sand should register on any furnace");
assert(itemOnLoc.has(`${SODA_ASH_ITEM_ID}:-1`), "soda ash should register on any furnace");
assert(itemOnItem.has(`${GLASSBLOWING_PIPE_ITEM_ID}:${MOLTEN_GLASS_ITEM_ID}`));
assert(actionHandlers.has("skill.pottery_shape"));
assert(actionHandlers.has("skill.pottery_fire"));
assert(actionHandlers.has("skill.molten_glass"));
assert(actionHandlers.has("skill.glassblow"));
assert(locHandlers.has(`${POTTER_WHEEL_LOC}:form`));
assert(locHandlers.has(`${POTTERY_OVEN_LOC}:fire`));

resetState(99, [{ itemId: SOFT_CLAY_ITEM_ID, quantity: 2 }]);
useOnLoc(SOFT_CLAY_ITEM_ID, NOT_CRAFT_LOC);
assert.equal(skillMultis.length, 0);

resetState(1, [{ itemId: SOFT_CLAY_ITEM_ID, quantity: 2 }]);
useOnLoc(SOFT_CLAY_ITEM_ID, POTTER_WHEEL_LOC);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === UNFIRED_POT));
assert(!skillMultis[0].products.some((product) => product.itemId === UNFIRED_BOWL));
skillMultis[0].onSelect?.(0, 1);
assert.equal(actions[0]?.kind, "skill.pottery_shape");

resetState(99, [{ itemId: SOFT_CLAY_ITEM_ID, quantity: 3 }]);
clickLoc(POTTER_WHEEL_LOC, "form");
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === UNFIRED_POT));
assert(skillMultis[0].products.some((product) => product.itemId === UNFIRED_BOWL));

resetState(99, [{ itemId: SOFT_CLAY_ITEM_ID, quantity: 2 }]);
const shapeResult = runAction("skill.pottery_shape", { recipeId: "shape_pot", count: 2 });
assert.equal(shapeResult.ok, true);
assert.equal(count(UNFIRED_POT), 1);
assert.equal(count(SOFT_CLAY_ITEM_ID), 1);
assert.deepEqual(xp, [6.3]);
assert.equal(actions[0]?.kind, "skill.pottery_shape");
assert.equal((actions[0]?.data as { count?: number })?.count, 1);

resetState(99, [{ itemId: SOFT_CLAY_ITEM_ID, quantity: 1 }]);
runAction("skill.pottery_shape", { recipeId: "shape_cup", count: 1 });
assert.equal(count(UNFIRED_CUP), 4);
assert.equal(count(SOFT_CLAY_ITEM_ID), 0);
assert.deepEqual(xp, [8.5]);

resetState(99, [{ itemId: UNFIRED_POT, quantity: 1 }]);
useOnLoc(UNFIRED_POT, FURNACE_LOC);
assert.equal(skillMultis.length, 0);

resetState(99, [{ itemId: UNFIRED_POT, quantity: 2 }]);
useOnLoc(UNFIRED_POT, POTTERY_OVEN_LOC);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === POT));
skillMultis[0].onSelect?.(0, 1);
assert.equal(actions[0]?.kind, "skill.pottery_fire");

resetState(99, [{ itemId: UNFIRED_POT, quantity: 2 }]);
runAction("skill.pottery_fire", { recipeId: "fire_pot", count: 2 });
assert.equal(count(POT), 1);
assert.equal(count(UNFIRED_POT), 1);
assert.deepEqual(xp, [6.3]);

resetState(99, [{ itemId: UNFIRED_BOWL, quantity: 1 }]);
clickLoc(POTTERY_OVEN_LOC, "fire");
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === BOWL));
runAction("skill.pottery_fire", { recipeId: "fire_bowl", count: 1 });
assert.equal(count(BOWL), 1);
assert.equal(count(UNFIRED_BOWL), 0);
assert.deepEqual(xp, [15]);

resetState(99, [{ itemId: BUCKET_OF_SAND_ITEM_ID, quantity: 1 }]);
useOnLoc(BUCKET_OF_SAND_ITEM_ID, FURNACE_LOC);
assert.equal(skillMultis.length, 0);
assert.match(messages[0] ?? "", /soda ash/i);

resetState(99, [
    { itemId: BUCKET_OF_SAND_ITEM_ID, quantity: 1 },
    { itemId: SODA_ASH_ITEM_ID, quantity: 1 },
]);
useOnLoc(BUCKET_OF_SAND_ITEM_ID, POTTERY_OVEN_LOC);
assert.equal(skillMultis.length, 0);

resetState(99, [
    { itemId: BUCKET_OF_SAND_ITEM_ID, quantity: 2 },
    { itemId: SODA_ASH_ITEM_ID, quantity: 2 },
]);
useOnLoc(SODA_ASH_ITEM_ID, FURNACE_LOC);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === MOLTEN_GLASS_ITEM_ID));
skillMultis[0].onSelect?.(0, 1);
assert.equal(actions[0]?.kind, "skill.molten_glass");

resetState(99, [
    { itemId: BUCKET_OF_SAND_ITEM_ID, quantity: 2 },
    { itemId: SODA_ASH_ITEM_ID, quantity: 2 },
]);
runAction("skill.molten_glass", { count: 2 });
assert.equal(count(MOLTEN_GLASS_ITEM_ID), 1);
assert.equal(count(EMPTY_BUCKET_ITEM_ID), 1);
assert.equal(count(BUCKET_OF_SAND_ITEM_ID), 1);
assert.equal(count(SODA_ASH_ITEM_ID), 1);
assert.deepEqual(xp, [MOLTEN_GLASS_XP]);

resetState(1, [
    { itemId: GLASSBLOWING_PIPE_ITEM_ID, quantity: 1 },
    { itemId: MOLTEN_GLASS_ITEM_ID, quantity: 2 },
]);
useOnItem(GLASSBLOWING_PIPE_ITEM_ID, MOLTEN_GLASS_ITEM_ID);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === BEER_GLASS));
assert(!skillMultis[0].products.some((product) => product.itemId === VIAL));
skillMultis[0].onSelect?.(0, 1);
assert.equal(actions[0]?.kind, "skill.glassblow");

resetState(99, [
    { itemId: GLASSBLOWING_PIPE_ITEM_ID, quantity: 1 },
    { itemId: MOLTEN_GLASS_ITEM_ID, quantity: 2 },
]);
useOnItem(MOLTEN_GLASS_ITEM_ID, GLASSBLOWING_PIPE_ITEM_ID);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === VIAL));

resetState(99, [
    { itemId: GLASSBLOWING_PIPE_ITEM_ID, quantity: 1 },
    { itemId: MOLTEN_GLASS_ITEM_ID, quantity: 2 },
]);
runAction("skill.glassblow", { recipeId: "blow_beer_glass", count: 2 });
assert.equal(count(BEER_GLASS), 1);
assert.equal(count(MOLTEN_GLASS_ITEM_ID), 1);
assert.equal(count(GLASSBLOWING_PIPE_ITEM_ID), 1);
assert.deepEqual(xp, [17.5]);

resetState(99, [
    { itemId: GLASSBLOWING_PIPE_ITEM_ID, quantity: 1 },
    { itemId: MOLTEN_GLASS_ITEM_ID, quantity: 1 },
]);
runAction("skill.glassblow", { recipeId: "blow_vial", count: 1 });
assert.equal(count(VIAL), 1);
assert.equal(count(MOLTEN_GLASS_ITEM_ID), 0);
assert.equal(count(GLASSBLOWING_PIPE_ITEM_ID), 1);
assert.deepEqual(xp, [35]);

console.log("crafting-pottery-glassblowing.test.ts: all assertions passed");
