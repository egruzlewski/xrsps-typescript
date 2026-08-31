import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    ItemOnItemHandler,
    ItemOnLocEvent,
    ItemOnLocHandler,
    ScriptActionHandler,
    ScriptActionHandlerContext,
    ScriptInventoryEntry,
    ScriptServices,
    ScriptSkillMultiRequest,
} from "../src/game/scripts/types";
import { register as registerCrafting } from "../gamemodes/vanilla/skills/crafting";
import {
    BALL_OF_WOOL_ITEM_ID,
    CHISEL_ITEM_ID,
    GOLD_BAR_ITEM_ID,
    RING_MOULD_ITEM_ID,
    getGemCutRecipeByUncutId,
    getJewelleryRecipeById,
} from "../gamemodes/vanilla/skills/crafting/jewelleryData";
import {
    LEATHER_ITEM_ID,
    NEEDLE_ITEM_ID,
    THREAD_ITEM_ID,
    getLeatherRecipeById,
} from "../gamemodes/vanilla/skills/crafting/leatherData";

const GOLD_RING = 1635;
const SAPPHIRE = 1607;
const SAPPHIRE_RING = 1637;
const UNCUT_SAPPHIRE = 1623;
const GOLD_AMULET_U = 1673;
const GOLD_AMULET = 1692;
const LEATHER_GLOVES = 1059;
const GREEN_D_LEATHER = 1745;
const GREEN_DHIDE_BODY = 1135;
const FURNACE_LOC = 24009;
const NOT_FURNACE_LOC = 12;

const goldRing = getJewelleryRecipeById("gold_ring");
assert(goldRing);
assert.equal(goldRing.productItemId, GOLD_RING);
assert.equal(goldRing.level, 5);
assert.equal(goldRing.xp, 15);
assert.equal(goldRing.barItemId, GOLD_BAR_ITEM_ID);
assert.equal(goldRing.mouldItemId, RING_MOULD_ITEM_ID);

const sapphireRing = getJewelleryRecipeById("sapphire_ring");
assert(sapphireRing);
assert.equal(sapphireRing.productItemId, SAPPHIRE_RING);
assert.equal(sapphireRing.gemItemId, SAPPHIRE);
assert.equal(sapphireRing.level, 20);
assert.equal(sapphireRing.xp, 40);

const cutSapphire = getGemCutRecipeByUncutId(UNCUT_SAPPHIRE);
assert(cutSapphire);
assert.equal(cutSapphire.cutItemId, SAPPHIRE);
assert.equal(cutSapphire.xp, 50);

const gloves = getLeatherRecipeById("leather_gloves");
assert(gloves);
assert.equal(gloves.productItemId, LEATHER_GLOVES);
assert.equal(gloves.xp, 13.8);

const greenBody = getLeatherRecipeById("green_dhide_body");
assert(greenBody);
assert.equal(greenBody.productItemId, GREEN_DHIDE_BODY);
assert.equal(greenBody.hideQuantity, 3);
assert.equal(greenBody.xp, 186);

const itemOnLoc = new Map<string, ItemOnLocHandler>();
const itemOnItem = new Map<string, ItemOnItemHandler>();
const actionHandlers = new Map<string, ScriptActionHandler>();

const registry = {
    registerLocInteraction: () => ({ unregister() {} }),
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
const player = { id: 4 } as PlayerState;
let craftLevel = 99;

function resetState(
    level: number,
    items: Array<{ itemId: number; quantity: number }>,
): void {
    craftLevel = level;
    slots.splice(0, slots.length, ...items.map((item, index) => ({
        slot: index,
        itemId: item.itemId,
        quantity: item.quantity,
    })));
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
    const handler = itemOnLoc.get(`${itemId}:-1`);
    assert(handler, `expected item-on-loc handler for ${itemId}`);
    handler({
        player,
        source: { slot, itemId },
        target: { locId, tile: { x: 3227, y: 3254 }, level: 0 },
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

registerCrafting(registry, services);

assert(itemOnLoc.has(`${GOLD_BAR_ITEM_ID}:-1`), "gold bar should register on any furnace loc");
assert(itemOnLoc.has(`${RING_MOULD_ITEM_ID}:-1`), "ring mould should register on any furnace loc");
assert(itemOnItem.has(`${CHISEL_ITEM_ID}:${UNCUT_SAPPHIRE}`));
assert(itemOnItem.has(`${NEEDLE_ITEM_ID}:${LEATHER_ITEM_ID}`));
assert(itemOnItem.has(`${BALL_OF_WOOL_ITEM_ID}:${GOLD_AMULET_U}`));
assert(actionHandlers.has("skill.jewellery"));
assert(actionHandlers.has("skill.gem_cut"));
assert(actionHandlers.has("skill.string_amulet"));
assert(actionHandlers.has("skill.leather"));

resetState(99, [
    { itemId: GOLD_BAR_ITEM_ID, quantity: 1 },
    { itemId: RING_MOULD_ITEM_ID, quantity: 1 },
]);
useOnLoc(GOLD_BAR_ITEM_ID, NOT_FURNACE_LOC);
assert.equal(skillMultis.length, 0);

resetState(1, [
    { itemId: GOLD_BAR_ITEM_ID, quantity: 2 },
    { itemId: RING_MOULD_ITEM_ID, quantity: 1 },
]);
useOnLoc(GOLD_BAR_ITEM_ID, FURNACE_LOC);
assert.equal(skillMultis.length, 0);
assert.match(messages[0] ?? "", /Crafting level 5/);

resetState(99, [
    { itemId: GOLD_BAR_ITEM_ID, quantity: 3 },
    { itemId: RING_MOULD_ITEM_ID, quantity: 1 },
    { itemId: SAPPHIRE, quantity: 1 },
]);
useOnLoc(GOLD_BAR_ITEM_ID, FURNACE_LOC);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === GOLD_RING));
assert(skillMultis[0].products.some((product) => product.itemId === SAPPHIRE_RING));
skillMultis[0].onSelect?.(0, 1);
assert.equal(actions[0]?.kind, "skill.jewellery");

resetState(99, [
    { itemId: GOLD_BAR_ITEM_ID, quantity: 2 },
    { itemId: RING_MOULD_ITEM_ID, quantity: 1 },
]);
const goldResult = runAction("skill.jewellery", { recipeId: "gold_ring", count: 2 });
assert.equal(goldResult.ok, true);
assert.equal(count(GOLD_RING), 1);
assert.equal(count(GOLD_BAR_ITEM_ID), 1);
assert.equal(count(RING_MOULD_ITEM_ID), 1);
assert.deepEqual(xp, [15]);
assert.equal(actions[0]?.kind, "skill.jewellery");
assert.equal((actions[0]?.data as { count?: number })?.count, 1);

resetState(99, [
    { itemId: GOLD_BAR_ITEM_ID, quantity: 1 },
    { itemId: RING_MOULD_ITEM_ID, quantity: 1 },
    { itemId: SAPPHIRE, quantity: 1 },
]);
runAction("skill.jewellery", { recipeId: "sapphire_ring", count: 1 });
assert.equal(count(SAPPHIRE_RING), 1);
assert.equal(count(GOLD_BAR_ITEM_ID), 0);
assert.equal(count(SAPPHIRE), 0);
assert.equal(count(RING_MOULD_ITEM_ID), 1);
assert.deepEqual(xp, [40]);

resetState(99, [
    { itemId: CHISEL_ITEM_ID, quantity: 1 },
    { itemId: UNCUT_SAPPHIRE, quantity: 2 },
]);
useOnItem(UNCUT_SAPPHIRE, CHISEL_ITEM_ID);
assert.equal(skillMultis.length, 1);
skillMultis[0].onSelect?.(0, 1);
assert.equal(actions[0]?.kind, "skill.gem_cut");
runAction("skill.gem_cut", { recipeId: "cut_sapphire", count: 1 });
assert.equal(count(SAPPHIRE), 1);
assert.equal(count(UNCUT_SAPPHIRE), 1);
assert.equal(count(CHISEL_ITEM_ID), 1);
assert.deepEqual(xp, [50]);

resetState(99, [
    { itemId: GOLD_AMULET_U, quantity: 1 },
    { itemId: BALL_OF_WOOL_ITEM_ID, quantity: 1 },
]);
useOnItem(GOLD_AMULET_U, BALL_OF_WOOL_ITEM_ID);
assert.equal(actions[0]?.kind, "skill.string_amulet");
runAction("skill.string_amulet", { recipeId: "string_gold_amulet", count: 1 });
assert.equal(count(GOLD_AMULET), 1);
assert.equal(count(GOLD_AMULET_U), 0);
assert.equal(count(BALL_OF_WOOL_ITEM_ID), 0);
assert.deepEqual(xp, [4]);

resetState(99, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: THREAD_ITEM_ID, quantity: 2 },
    { itemId: LEATHER_ITEM_ID, quantity: 6 },
]);
useOnItem(NEEDLE_ITEM_ID, LEATHER_ITEM_ID);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === LEATHER_GLOVES));
skillMultis[0].onSelect?.(0, 1);
assert.equal(actions[0]?.kind, "skill.leather");

resetState(99, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: THREAD_ITEM_ID, quantity: 1 },
    { itemId: LEATHER_ITEM_ID, quantity: 6 },
]);
runAction("skill.leather", { recipeId: "leather_gloves", count: 5, craftsDone: 0 });
assert.equal(count(LEATHER_GLOVES), 1);
assert.equal(count(LEATHER_ITEM_ID), 5);
assert.equal(count(THREAD_ITEM_ID), 0);
assert.equal(count(NEEDLE_ITEM_ID), 1);
assert.deepEqual(xp, [13.8]);

resetState(99, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: LEATHER_ITEM_ID, quantity: 2 },
]);
runAction("skill.leather", { recipeId: "leather_gloves", count: 1, craftsDone: 1 });
assert.equal(count(LEATHER_GLOVES), 1);
assert.deepEqual(xp, [13.8]);

resetState(99, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: THREAD_ITEM_ID, quantity: 1 },
    { itemId: GREEN_D_LEATHER, quantity: 3 },
]);
runAction("skill.leather", { recipeId: "green_dhide_body", count: 1, craftsDone: 0 });
assert.equal(count(GREEN_DHIDE_BODY), 1);
assert.equal(count(GREEN_D_LEATHER), 0);
assert.deepEqual(xp, [186]);

resetState(99, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: LEATHER_ITEM_ID, quantity: 1 },
]);
useOnItem(NEEDLE_ITEM_ID, LEATHER_ITEM_ID);
assert.match(messages[0] ?? "", /thread/i);

console.log("crafting-jewellery-leather.test.ts: all assertions passed");
