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
    SNAKESKIN_ITEM_ID,
    THREAD_ITEM_ID,
    getLeatherRecipeById,
    getLeatherRecipesForHide,
} from "../gamemodes/vanilla/skills/crafting/leatherData";
import { getTanningRecipeById } from "../gamemodes/vanilla/skills/production/tanningData";

const GOLD_RING = 1635;
const SAPPHIRE = 1607;
const SAPPHIRE_RING = 1637;
const UNCUT_SAPPHIRE = 1623;
const GOLD_AMULET_U = 1673;
const GOLD_AMULET = 1692;
const LEATHER_GLOVES = 1059;
const GREEN_D_LEATHER = 1745;
const GREEN_DHIDE_BODY = 1135;
const SNAKE_HIDE = 6287;
const SWAMP_SNAKE_HIDE = 7801;
const SNAKESKIN_BOOTS = 6328;
const SNAKESKIN_VAMBRACES = 6330;
const SNAKESKIN_BANDANA = 6326;
const SNAKESKIN_CHAPS = 6324;
const SNAKESKIN_BODY = 6322;
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

const snakeskinPieces = [
    { id: "snakeskin_boots", product: SNAKESKIN_BOOTS, hides: 6, level: 45, xp: 30 },
    { id: "snakeskin_vambraces", product: SNAKESKIN_VAMBRACES, hides: 8, level: 47, xp: 35 },
    { id: "snakeskin_bandana", product: SNAKESKIN_BANDANA, hides: 5, level: 48, xp: 45 },
    { id: "snakeskin_chaps", product: SNAKESKIN_CHAPS, hides: 12, level: 51, xp: 50 },
    { id: "snakeskin_body", product: SNAKESKIN_BODY, hides: 15, level: 53, xp: 55 },
] as const;
for (const piece of snakeskinPieces) {
    const recipe = getLeatherRecipeById(piece.id);
    assert(recipe, `expected leather recipe ${piece.id}`);
    assert.equal(recipe.hideItemId, SNAKESKIN_ITEM_ID);
    assert.equal(recipe.productItemId, piece.product);
    assert.equal(recipe.hideQuantity, piece.hides);
    assert.equal(recipe.level, piece.level);
    assert.equal(recipe.xp, piece.xp);
}
assert.equal(getLeatherRecipesForHide(SNAKESKIN_ITEM_ID).length, 5);

const tanSnakeskin = getTanningRecipeById("tan_snakeskin");
assert(tanSnakeskin);
assert.equal(tanSnakeskin.inputItemId, SNAKE_HIDE);
assert.equal(tanSnakeskin.outputItemId, SNAKESKIN_ITEM_ID);

const tanSwampSnakeskin = getTanningRecipeById("tan_swamp_snakeskin");
assert(tanSwampSnakeskin);
assert.equal(tanSwampSnakeskin.inputItemId, SWAMP_SNAKE_HIDE);
assert.equal(tanSwampSnakeskin.outputItemId, SNAKESKIN_ITEM_ID);

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
assert(itemOnItem.has(`${NEEDLE_ITEM_ID}:${SNAKESKIN_ITEM_ID}`));
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

resetState(99, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: THREAD_ITEM_ID, quantity: 1 },
    { itemId: SNAKESKIN_ITEM_ID, quantity: 15 },
]);
useOnItem(NEEDLE_ITEM_ID, SNAKESKIN_ITEM_ID);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === SNAKESKIN_BOOTS));
assert(skillMultis[0].products.some((product) => product.itemId === SNAKESKIN_VAMBRACES));
assert(skillMultis[0].products.some((product) => product.itemId === SNAKESKIN_BANDANA));
assert(skillMultis[0].products.some((product) => product.itemId === SNAKESKIN_CHAPS));
assert(skillMultis[0].products.some((product) => product.itemId === SNAKESKIN_BODY));
skillMultis[0].onSelect?.(0, 1);
assert.equal(actions[0]?.kind, "skill.leather");

resetState(45, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: THREAD_ITEM_ID, quantity: 1 },
    { itemId: SNAKESKIN_ITEM_ID, quantity: 15 },
]);
useOnItem(NEEDLE_ITEM_ID, SNAKESKIN_ITEM_ID);
assert.equal(skillMultis.length, 1);
assert.equal(skillMultis[0].products.length, 1);
assert.equal(skillMultis[0].products[0]?.itemId, SNAKESKIN_BOOTS);

resetState(44, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: THREAD_ITEM_ID, quantity: 1 },
    { itemId: SNAKESKIN_ITEM_ID, quantity: 15 },
]);
useOnItem(NEEDLE_ITEM_ID, SNAKESKIN_ITEM_ID);
assert.equal(skillMultis.length, 0);
assert.match(messages[0] ?? "", /Crafting level 45/);

resetState(99, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: THREAD_ITEM_ID, quantity: 1 },
    { itemId: SNAKESKIN_ITEM_ID, quantity: 6 },
]);
runAction("skill.leather", { recipeId: "snakeskin_boots", count: 1, craftsDone: 0 });
assert.equal(count(SNAKESKIN_BOOTS), 1);
assert.equal(count(SNAKESKIN_ITEM_ID), 0);
assert.equal(count(THREAD_ITEM_ID), 0);
assert.equal(count(NEEDLE_ITEM_ID), 1);
assert.deepEqual(xp, [30]);

resetState(99, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: THREAD_ITEM_ID, quantity: 1 },
    { itemId: SNAKESKIN_ITEM_ID, quantity: 15 },
]);
runAction("skill.leather", { recipeId: "snakeskin_body", count: 1, craftsDone: 0 });
assert.equal(count(SNAKESKIN_BODY), 1);
assert.equal(count(SNAKESKIN_ITEM_ID), 0);
assert.deepEqual(xp, [55]);

resetState(99, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: THREAD_ITEM_ID, quantity: 1 },
    { itemId: SNAKESKIN_ITEM_ID, quantity: 8 },
]);
runAction("skill.leather", { recipeId: "snakeskin_vambraces", count: 1, craftsDone: 0 });
assert.equal(count(SNAKESKIN_VAMBRACES), 1);
assert.equal(count(SNAKESKIN_ITEM_ID), 0);
assert.deepEqual(xp, [35]);

resetState(99, [
    { itemId: NEEDLE_ITEM_ID, quantity: 1 },
    { itemId: THREAD_ITEM_ID, quantity: 1 },
    { itemId: SNAKESKIN_ITEM_ID, quantity: 14 },
]);
runAction("skill.leather", { recipeId: "snakeskin_body", count: 1, craftsDone: 0 });
assert.equal(count(SNAKESKIN_BODY), 0);
assert.equal(count(SNAKESKIN_ITEM_ID), 14);
assert.equal(count(THREAD_ITEM_ID), 1);
assert.equal(xp.length, 0);

console.log("crafting-jewellery-leather.test.ts: all assertions passed");
