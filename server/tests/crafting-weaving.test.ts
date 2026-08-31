import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
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
    BALL_OF_WOOL_ITEM_ID,
    BASKET_ITEM_ID,
    BOLT_OF_LINEN_ITEM_ID,
    DRIFT_NET_ITEM_ID,
    EMPTY_SACK_ITEM_ID,
    JUTE_FIBRE_ITEM_ID,
    LINEN_YARN_ITEM_ID,
    STRIP_OF_CLOTH_ITEM_ID,
    WEAVING_ANIMATION_ID,
    WILLOW_BRANCH_ITEM_ID,
    getWeavingRecipeById,
    getWeavingRecipesByInputItemId,
} from "../gamemodes/vanilla/skills/crafting/weavingData";

const FALADOR_LOOM_LOC = 8717;
const IORWERTH_LOOM_LOC = 787;
const FOSSIL_LOOM_LOC = 30936;
const NOT_CRAFT_LOC = 12;

const cloth = getWeavingRecipeById("weave_strip_of_cloth");
assert(cloth);
assert.equal(cloth.inputItemId, BALL_OF_WOOL_ITEM_ID);
assert.equal(cloth.productItemId, STRIP_OF_CLOTH_ITEM_ID);
assert.equal(cloth.inputQuantity, 4);
assert.equal(cloth.level, 10);
assert.equal(cloth.xp, 12);
assert.equal(cloth.animation, WEAVING_ANIMATION_ID);

const sack = getWeavingRecipeById("weave_empty_sack");
assert(sack);
assert.equal(sack.inputItemId, JUTE_FIBRE_ITEM_ID);
assert.equal(sack.productItemId, EMPTY_SACK_ITEM_ID);
assert.equal(sack.inputQuantity, 4);
assert.equal(sack.level, 21);
assert.equal(sack.xp, 38);

const net = getWeavingRecipeById("weave_drift_net");
assert(net);
assert.equal(net.inputItemId, JUTE_FIBRE_ITEM_ID);
assert.equal(net.productItemId, DRIFT_NET_ITEM_ID);
assert.equal(net.inputQuantity, 2);
assert.equal(net.level, 26);
assert.equal(net.xp, 55);

const basket = getWeavingRecipeById("weave_basket");
assert(basket);
assert.equal(basket.inputItemId, WILLOW_BRANCH_ITEM_ID);
assert.equal(basket.productItemId, BASKET_ITEM_ID);
assert.equal(basket.inputQuantity, 6);
assert.equal(basket.level, 36);
assert.equal(basket.xp, 56);

const linen = getWeavingRecipeById("weave_bolt_of_linen");
assert(linen);
assert.equal(linen.inputItemId, LINEN_YARN_ITEM_ID);
assert.equal(linen.productItemId, BOLT_OF_LINEN_ITEM_ID);
assert.equal(linen.inputQuantity, 2);
assert.equal(linen.level, 12);
assert.equal(linen.xp, 20);

const juteRecipes = getWeavingRecipesByInputItemId(JUTE_FIBRE_ITEM_ID);
assert.equal(juteRecipes.length, 2);
assert(juteRecipes.some((recipe) => recipe.id === "weave_empty_sack"));
assert(juteRecipes.some((recipe) => recipe.id === "weave_drift_net"));

const itemOnLoc = new Map<string, ItemOnLocHandler>();
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
    registerItemOnItem: () => ({ unregister() {} }),
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
const player = { id: 7 } as PlayerState;
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
            if (
                locId === FALADOR_LOOM_LOC ||
                locId === IORWERTH_LOOM_LOC ||
                locId === FOSSIL_LOOM_LOC
            ) {
                return { name: "Loom", ops: ["weave"] };
            }
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
        target: { locId, tile: { x: 3039, y: 3286 }, level: 0 },
        tick: 1,
        services,
    } as ItemOnLocEvent);
}

function clickLoc(locId: number, action = "") {
    const handler = locHandlers.get(`${locId}:${action}`);
    assert(handler, `expected loc handler for ${locId}:${action}`);
    handler({
        player,
        locId,
        tile: { x: 3039, y: 3286 },
        level: 0,
        action: action || undefined,
        tick: 1,
        services,
    } as LocInteractionEvent);
}

registerCrafting(registry, services);

assert(itemOnLoc.has(`${BALL_OF_WOOL_ITEM_ID}:-1`), "wool should register on any loom");
assert(itemOnLoc.has(`${JUTE_FIBRE_ITEM_ID}:-1`), "jute should register on any loom");
assert(itemOnLoc.has(`${WILLOW_BRANCH_ITEM_ID}:-1`), "willow branches should register on any loom");
assert(actionHandlers.has("skill.weave"));
assert(locHandlers.has(`${FALADOR_LOOM_LOC}:weave`));
assert(locHandlers.has(`${IORWERTH_LOOM_LOC}:weave`));
assert(locHandlers.has(`${FOSSIL_LOOM_LOC}:weave`));

resetState(99, [{ itemId: BALL_OF_WOOL_ITEM_ID, quantity: 4 }]);
useOnLoc(BALL_OF_WOOL_ITEM_ID, NOT_CRAFT_LOC);
assert.equal(skillMultis.length, 0);

resetState(1, [{ itemId: BALL_OF_WOOL_ITEM_ID, quantity: 8 }]);
useOnLoc(BALL_OF_WOOL_ITEM_ID, FALADOR_LOOM_LOC);
assert.equal(skillMultis.length, 0);
assert.match(messages[0] ?? "", /Crafting level 10/);

resetState(10, [{ itemId: BALL_OF_WOOL_ITEM_ID, quantity: 8 }]);
useOnLoc(BALL_OF_WOOL_ITEM_ID, FALADOR_LOOM_LOC);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === STRIP_OF_CLOTH_ITEM_ID));
assert(!skillMultis[0].products.some((product) => product.itemId === EMPTY_SACK_ITEM_ID));
assert.equal(skillMultis[0].products[0]?.maxQuantity, 2);
skillMultis[0].onSelect?.(0, 1);
assert.equal(actions[0]?.kind, "skill.weave");

resetState(99, [{ itemId: JUTE_FIBRE_ITEM_ID, quantity: 4 }]);
useOnLoc(JUTE_FIBRE_ITEM_ID, FALADOR_LOOM_LOC);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === EMPTY_SACK_ITEM_ID));
assert(skillMultis[0].products.some((product) => product.itemId === DRIFT_NET_ITEM_ID));
assert(!skillMultis[0].products.some((product) => product.itemId === STRIP_OF_CLOTH_ITEM_ID));

resetState(99, [
    { itemId: BALL_OF_WOOL_ITEM_ID, quantity: 4 },
    { itemId: WILLOW_BRANCH_ITEM_ID, quantity: 6 },
]);
clickLoc(FALADOR_LOOM_LOC, "weave");
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === STRIP_OF_CLOTH_ITEM_ID));
assert(skillMultis[0].products.some((product) => product.itemId === BASKET_ITEM_ID));

resetState(99, [{ itemId: BALL_OF_WOOL_ITEM_ID, quantity: 8 }]);
const clothResult = runAction("skill.weave", { recipeId: "weave_strip_of_cloth", count: 2 });
assert.equal(clothResult.ok, true);
assert.equal(count(STRIP_OF_CLOTH_ITEM_ID), 1);
assert.equal(count(BALL_OF_WOOL_ITEM_ID), 4);
assert.deepEqual(xp, [12]);
assert.deepEqual(seqs, [WEAVING_ANIMATION_ID]);
assert.equal(actions[0]?.kind, "skill.weave");
assert.equal((actions[0]?.data as { count?: number })?.count, 1);

resetState(99, [{ itemId: JUTE_FIBRE_ITEM_ID, quantity: 4 }]);
runAction("skill.weave", { recipeId: "weave_empty_sack", count: 1 });
assert.equal(count(EMPTY_SACK_ITEM_ID), 1);
assert.equal(count(JUTE_FIBRE_ITEM_ID), 0);
assert.deepEqual(xp, [38]);

resetState(99, [{ itemId: JUTE_FIBRE_ITEM_ID, quantity: 2 }]);
runAction("skill.weave", { recipeId: "weave_drift_net", count: 1 });
assert.equal(count(DRIFT_NET_ITEM_ID), 1);
assert.equal(count(JUTE_FIBRE_ITEM_ID), 0);
assert.deepEqual(xp, [55]);

resetState(99, [{ itemId: WILLOW_BRANCH_ITEM_ID, quantity: 6 }]);
runAction("skill.weave", { recipeId: "weave_basket", count: 1 });
assert.equal(count(BASKET_ITEM_ID), 1);
assert.equal(count(WILLOW_BRANCH_ITEM_ID), 0);
assert.deepEqual(xp, [56]);

resetState(99, [{ itemId: LINEN_YARN_ITEM_ID, quantity: 2 }]);
runAction("skill.weave", { recipeId: "weave_bolt_of_linen", count: 1 });
assert.equal(count(BOLT_OF_LINEN_ITEM_ID), 1);
assert.equal(count(LINEN_YARN_ITEM_ID), 0);
assert.deepEqual(xp, [20]);

resetState(99, [{ itemId: JUTE_FIBRE_ITEM_ID, quantity: 1 }]);
const shortJute = runAction("skill.weave", { recipeId: "weave_empty_sack", count: 1 });
assert.equal(count(EMPTY_SACK_ITEM_ID), 0);
assert.equal(count(JUTE_FIBRE_ITEM_ID), 1);
assert.equal(xp.length, 0);
const shortMessage =
    (shortJute.effects as Array<{ message?: string }> | undefined)?.find((effect) => effect.message)
        ?.message ?? "";
assert.match(shortMessage, /jute fibre/);

console.log("crafting-weaving.test.ts: all assertions passed");
