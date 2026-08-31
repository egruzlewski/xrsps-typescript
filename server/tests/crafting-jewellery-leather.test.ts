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
    CRUSHED_GEM_ITEM_ID,
    GOLD_BAR_ITEM_ID,
    ONYX_ITEM_ID,
    RING_MOULD_ITEM_ID,
    NECKLACE_MOULD_ITEM_ID,
    BRACELET_MOULD_ITEM_ID,
    AMULET_MOULD_ITEM_ID,
    SILVER_BAR_ITEM_ID,
    UNCUT_ONYX_ITEM_ID,
    UNCUT_ZENYTE_ITEM_ID,
    ZENYTE_FUSE_RECIPE,
    ZENYTE_ITEM_ID,
    ZENYTE_SHARD_ITEM_ID,
    getAmuletStringRecipeById,
    getGemCutRecipeByUncutId,
    getJewelleryRecipeById,
    getZenyteFuseRecipeById,
    rollSemiPreciousCutSuccess,
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
const ONYX_RING = 6575;
const ONYX_AMULET_U = 6579;
const ONYX_AMULET = 6581;
const ZENYTE_RING = 19538;
const ZENYTE_BRACELET = 19532;
const ZENYTE_AMULET_U = 19501;
const ZENYTE_AMULET = 19541;
const UNCUT_OPAL = 1625;
const OPAL = 1609;
const JADE = 1611;
const RED_TOPAZ = 1613;
const OPAL_RING = 21081;
const JADE_NECKLACE = 21093;
const TOPAZ_BRACELET = 21123;
const OPAL_AMULET_U = 21099;
const OPAL_AMULET = 21108;
const JADE_AMULET_U = 21102;
const TOPAZ_AMULET_U = 21105;
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
assert.equal(cutSapphire.crush, undefined);

const onyxRing = getJewelleryRecipeById("onyx_ring");
assert(onyxRing);
assert.equal(onyxRing.productItemId, ONYX_RING);
assert.equal(onyxRing.gemItemId, ONYX_ITEM_ID);
assert.equal(onyxRing.level, 67);
assert.equal(onyxRing.xp, 115);

const onyxNecklace = getJewelleryRecipeById("onyx_necklace");
assert(onyxNecklace);
assert.equal(onyxNecklace.productItemId, 6577);
assert.equal(onyxNecklace.level, 82);
assert.equal(onyxNecklace.xp, 120);

const onyxBracelet = getJewelleryRecipeById("onyx_bracelet");
assert(onyxBracelet);
assert.equal(onyxBracelet.productItemId, 11130);
assert.equal(onyxBracelet.level, 84);
assert.equal(onyxBracelet.xp, 125);

const onyxAmulet = getJewelleryRecipeById("onyx_amulet");
assert(onyxAmulet);
assert.equal(onyxAmulet.productItemId, ONYX_AMULET_U);
assert.equal(onyxAmulet.level, 90);
assert.equal(onyxAmulet.xp, 165);

const zenyteRing = getJewelleryRecipeById("zenyte_ring");
assert(zenyteRing);
assert.equal(zenyteRing.productItemId, ZENYTE_RING);
assert.equal(zenyteRing.gemItemId, ZENYTE_ITEM_ID);
assert.equal(zenyteRing.level, 89);
assert.equal(zenyteRing.xp, 150);

const zenyteNecklace = getJewelleryRecipeById("zenyte_necklace");
assert(zenyteNecklace);
assert.equal(zenyteNecklace.productItemId, 19535);
assert.equal(zenyteNecklace.level, 92);
assert.equal(zenyteNecklace.xp, 165);

const zenyteBracelet = getJewelleryRecipeById("zenyte_bracelet");
assert(zenyteBracelet);
assert.equal(zenyteBracelet.productItemId, ZENYTE_BRACELET);
assert.equal(zenyteBracelet.level, 95);
assert.equal(zenyteBracelet.xp, 180);

const zenyteAmulet = getJewelleryRecipeById("zenyte_amulet");
assert(zenyteAmulet);
assert.equal(zenyteAmulet.productItemId, ZENYTE_AMULET_U);
assert.equal(zenyteAmulet.level, 98);
assert.equal(zenyteAmulet.xp, 200);

const silverGemPieces = [
    {
        id: "opal_ring",
        product: OPAL_RING,
        gem: OPAL,
        bar: SILVER_BAR_ITEM_ID,
        mould: RING_MOULD_ITEM_ID,
        level: 1,
        xp: 10,
    },
    {
        id: "opal_necklace",
        product: 21090,
        gem: OPAL,
        bar: SILVER_BAR_ITEM_ID,
        mould: NECKLACE_MOULD_ITEM_ID,
        level: 16,
        xp: 35,
    },
    {
        id: "opal_bracelet",
        product: 21117,
        gem: OPAL,
        bar: SILVER_BAR_ITEM_ID,
        mould: BRACELET_MOULD_ITEM_ID,
        level: 22,
        xp: 45,
    },
    {
        id: "opal_amulet",
        product: OPAL_AMULET_U,
        gem: OPAL,
        bar: SILVER_BAR_ITEM_ID,
        mould: AMULET_MOULD_ITEM_ID,
        level: 27,
        xp: 55,
    },
    {
        id: "jade_ring",
        product: 21084,
        gem: JADE,
        bar: SILVER_BAR_ITEM_ID,
        mould: RING_MOULD_ITEM_ID,
        level: 13,
        xp: 32,
    },
    {
        id: "jade_necklace",
        product: JADE_NECKLACE,
        gem: JADE,
        bar: SILVER_BAR_ITEM_ID,
        mould: NECKLACE_MOULD_ITEM_ID,
        level: 25,
        xp: 54,
    },
    {
        id: "jade_bracelet",
        product: 21120,
        gem: JADE,
        bar: SILVER_BAR_ITEM_ID,
        mould: BRACELET_MOULD_ITEM_ID,
        level: 29,
        xp: 60,
    },
    {
        id: "jade_amulet",
        product: JADE_AMULET_U,
        gem: JADE,
        bar: SILVER_BAR_ITEM_ID,
        mould: AMULET_MOULD_ITEM_ID,
        level: 34,
        xp: 70,
    },
    {
        id: "topaz_ring",
        product: 21087,
        gem: RED_TOPAZ,
        bar: SILVER_BAR_ITEM_ID,
        mould: RING_MOULD_ITEM_ID,
        level: 16,
        xp: 35,
    },
    {
        id: "topaz_necklace",
        product: 21096,
        gem: RED_TOPAZ,
        bar: SILVER_BAR_ITEM_ID,
        mould: NECKLACE_MOULD_ITEM_ID,
        level: 32,
        xp: 70,
    },
    {
        id: "topaz_bracelet",
        product: TOPAZ_BRACELET,
        gem: RED_TOPAZ,
        bar: SILVER_BAR_ITEM_ID,
        mould: BRACELET_MOULD_ITEM_ID,
        level: 38,
        xp: 75,
    },
    {
        id: "topaz_amulet",
        product: TOPAZ_AMULET_U,
        gem: RED_TOPAZ,
        bar: SILVER_BAR_ITEM_ID,
        mould: AMULET_MOULD_ITEM_ID,
        level: 45,
        xp: 80,
    },
] as const;
for (const piece of silverGemPieces) {
    const recipe = getJewelleryRecipeById(piece.id);
    assert(recipe, `expected jewellery recipe ${piece.id}`);
    assert.equal(recipe.productItemId, piece.product);
    assert.equal(recipe.gemItemId, piece.gem);
    assert.equal(recipe.barItemId, piece.bar);
    assert.equal(recipe.mouldItemId, piece.mould);
    assert.equal(recipe.level, piece.level);
    assert.equal(recipe.xp, piece.xp);
}

const stringOpal = getAmuletStringRecipeById("string_opal_amulet");
assert(stringOpal);
assert.equal(stringOpal.unstrungItemId, OPAL_AMULET_U);
assert.equal(stringOpal.productItemId, OPAL_AMULET);
assert.equal(stringOpal.level, 27);
assert.equal(stringOpal.xp, 4);

const stringJade = getAmuletStringRecipeById("string_jade_amulet");
assert(stringJade);
assert.equal(stringJade.unstrungItemId, JADE_AMULET_U);
assert.equal(stringJade.productItemId, 21111);

const stringTopaz = getAmuletStringRecipeById("string_topaz_amulet");
assert(stringTopaz);
assert.equal(stringTopaz.unstrungItemId, TOPAZ_AMULET_U);
assert.equal(stringTopaz.productItemId, 21114);

const cutOnyx = getGemCutRecipeByUncutId(UNCUT_ONYX_ITEM_ID);
assert(cutOnyx);
assert.equal(cutOnyx.cutItemId, ONYX_ITEM_ID);
assert.equal(cutOnyx.level, 67);
assert.equal(cutOnyx.xp, 167.5);

const cutZenyte = getGemCutRecipeByUncutId(UNCUT_ZENYTE_ITEM_ID);
assert(cutZenyte);
assert.equal(cutZenyte.cutItemId, ZENYTE_ITEM_ID);
assert.equal(cutZenyte.level, 89);
assert.equal(cutZenyte.xp, 50);

const cutOpal = getGemCutRecipeByUncutId(UNCUT_OPAL);
assert(cutOpal);
assert.equal(cutOpal.cutItemId, OPAL);
assert.equal(cutOpal.crush?.low, 128);
assert.equal(cutOpal.crush?.high, 250);
assert.equal(cutOpal.crush?.xp, 3.8);
assert.equal(rollSemiPreciousCutSuccess(1, cutOpal.crush!, () => 0), true);
assert.equal(rollSemiPreciousCutSuccess(1, cutOpal.crush!, () => 0.999), false);

const cutJade = getGemCutRecipeByUncutId(1627);
assert(cutJade?.crush);
assert.equal(cutJade.crush.low, 100);
assert.equal(cutJade.crush.xp, 5);
const cutTopaz = getGemCutRecipeByUncutId(1629);
assert(cutTopaz?.crush);
assert.equal(cutTopaz.crush.low, 90);
assert.equal(cutTopaz.crush.xp, 6.3);

const fuseZenyte = getZenyteFuseRecipeById(ZENYTE_FUSE_RECIPE.id);
assert(fuseZenyte);
assert.equal(fuseZenyte.shardItemId, ZENYTE_SHARD_ITEM_ID);
assert.equal(fuseZenyte.gemItemId, ONYX_ITEM_ID);
assert.equal(fuseZenyte.productItemId, UNCUT_ZENYTE_ITEM_ID);
assert.equal(fuseZenyte.level, 70);
assert.equal(fuseZenyte.xp, 15);

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
assert(itemOnLoc.has(`${SILVER_BAR_ITEM_ID}:-1`), "silver bar should register on any furnace loc");
assert(itemOnLoc.has(`${RING_MOULD_ITEM_ID}:-1`), "ring mould should register on any furnace loc");
assert(itemOnItem.has(`${CHISEL_ITEM_ID}:${UNCUT_SAPPHIRE}`));
assert(itemOnItem.has(`${CHISEL_ITEM_ID}:${UNCUT_ONYX_ITEM_ID}`));
assert(itemOnItem.has(`${CHISEL_ITEM_ID}:${UNCUT_ZENYTE_ITEM_ID}`));
assert(itemOnItem.has(`${CHISEL_ITEM_ID}:${UNCUT_OPAL}`));
assert(itemOnItem.has(`${ZENYTE_SHARD_ITEM_ID}:${ONYX_ITEM_ID}`));
assert(itemOnItem.has(`${BALL_OF_WOOL_ITEM_ID}:${ONYX_AMULET_U}`));
assert(itemOnItem.has(`${BALL_OF_WOOL_ITEM_ID}:${ZENYTE_AMULET_U}`));
assert(itemOnItem.has(`${BALL_OF_WOOL_ITEM_ID}:${OPAL_AMULET_U}`));
assert(itemOnItem.has(`${BALL_OF_WOOL_ITEM_ID}:${JADE_AMULET_U}`));
assert(itemOnItem.has(`${BALL_OF_WOOL_ITEM_ID}:${TOPAZ_AMULET_U}`));
assert(itemOnItem.has(`${NEEDLE_ITEM_ID}:${LEATHER_ITEM_ID}`));
assert(itemOnItem.has(`${NEEDLE_ITEM_ID}:${SNAKESKIN_ITEM_ID}`));
assert(itemOnItem.has(`${BALL_OF_WOOL_ITEM_ID}:${GOLD_AMULET_U}`));
assert(actionHandlers.has("skill.jewellery"));
assert(actionHandlers.has("skill.gem_cut"));
assert(actionHandlers.has("skill.string_amulet"));
assert(actionHandlers.has("skill.zenyte_fuse"));
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
    { itemId: CHISEL_ITEM_ID, quantity: 1 },
    { itemId: UNCUT_ONYX_ITEM_ID, quantity: 1 },
]);
useOnItem(UNCUT_ONYX_ITEM_ID, CHISEL_ITEM_ID);
assert.equal(skillMultis.length, 1);
skillMultis[0].onSelect?.(0, 1);
assert.equal(actions[0]?.kind, "skill.gem_cut");
runAction("skill.gem_cut", { recipeId: "cut_onyx", count: 1 });
assert.equal(count(ONYX_ITEM_ID), 1);
assert.equal(count(UNCUT_ONYX_ITEM_ID), 0);
assert.deepEqual(xp, [167.5]);

resetState(99, [
    { itemId: GOLD_BAR_ITEM_ID, quantity: 1 },
    { itemId: RING_MOULD_ITEM_ID, quantity: 1 },
    { itemId: ONYX_ITEM_ID, quantity: 1 },
]);
useOnLoc(GOLD_BAR_ITEM_ID, FURNACE_LOC);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === ONYX_RING));
runAction("skill.jewellery", { recipeId: "onyx_ring", count: 1 });
assert.equal(count(ONYX_RING), 1);
assert.equal(count(ONYX_ITEM_ID), 0);
assert.equal(count(GOLD_BAR_ITEM_ID), 0);
assert.deepEqual(xp, [115]);

resetState(99, [
    { itemId: ZENYTE_SHARD_ITEM_ID, quantity: 1 },
    { itemId: ONYX_ITEM_ID, quantity: 1 },
]);
useOnItem(ZENYTE_SHARD_ITEM_ID, ONYX_ITEM_ID);
assert.equal(actions[0]?.kind, "skill.zenyte_fuse");
runAction("skill.zenyte_fuse", { recipeId: "fuse_uncut_zenyte", count: 1 });
assert.equal(count(UNCUT_ZENYTE_ITEM_ID), 1);
assert.equal(count(ZENYTE_SHARD_ITEM_ID), 0);
assert.equal(count(ONYX_ITEM_ID), 0);
assert.deepEqual(xp, [15]);

resetState(69, [
    { itemId: ZENYTE_SHARD_ITEM_ID, quantity: 1 },
    { itemId: ONYX_ITEM_ID, quantity: 1 },
]);
useOnItem(ZENYTE_SHARD_ITEM_ID, ONYX_ITEM_ID);
assert.equal(actions.length, 0);
assert.match(messages[0] ?? "", /Crafting level 70/);

resetState(99, [
    { itemId: CHISEL_ITEM_ID, quantity: 1 },
    { itemId: UNCUT_ZENYTE_ITEM_ID, quantity: 1 },
]);
runAction("skill.gem_cut", { recipeId: "cut_zenyte", count: 1 });
assert.equal(count(ZENYTE_ITEM_ID), 1);
assert.deepEqual(xp, [50]);

resetState(99, [
    { itemId: GOLD_BAR_ITEM_ID, quantity: 1 },
    { itemId: RING_MOULD_ITEM_ID, quantity: 1 },
    { itemId: ZENYTE_ITEM_ID, quantity: 1 },
]);
runAction("skill.jewellery", { recipeId: "zenyte_ring", count: 1 });
assert.equal(count(ZENYTE_RING), 1);
assert.equal(count(ZENYTE_ITEM_ID), 0);
assert.deepEqual(xp, [150]);

resetState(99, [
    { itemId: GOLD_BAR_ITEM_ID, quantity: 1 },
    { itemId: BRACELET_MOULD_ITEM_ID, quantity: 1 },
    { itemId: ZENYTE_ITEM_ID, quantity: 1 },
]);
runAction("skill.jewellery", { recipeId: "zenyte_bracelet", count: 1 });
assert.equal(count(ZENYTE_BRACELET), 1);
assert.deepEqual(xp, [180]);

resetState(99, [
    { itemId: ONYX_AMULET_U, quantity: 1 },
    { itemId: BALL_OF_WOOL_ITEM_ID, quantity: 1 },
]);
runAction("skill.string_amulet", { recipeId: "string_onyx_amulet", count: 1 });
assert.equal(count(ONYX_AMULET), 1);
assert.deepEqual(xp, [4]);

resetState(99, [
    { itemId: ZENYTE_AMULET_U, quantity: 1 },
    { itemId: BALL_OF_WOOL_ITEM_ID, quantity: 1 },
]);
runAction("skill.string_amulet", { recipeId: "string_zenyte_amulet", count: 1 });
assert.equal(count(ZENYTE_AMULET), 1);
assert.deepEqual(xp, [4]);

resetState(1, [
    { itemId: SILVER_BAR_ITEM_ID, quantity: 1 },
    { itemId: RING_MOULD_ITEM_ID, quantity: 1 },
    { itemId: OPAL, quantity: 1 },
]);
useOnLoc(SILVER_BAR_ITEM_ID, FURNACE_LOC);
assert.equal(skillMultis.length, 1);
assert(skillMultis[0].products.some((product) => product.itemId === OPAL_RING));
assert(!skillMultis[0].products.some((product) => product.itemId === GOLD_RING));

resetState(1, [
    { itemId: SILVER_BAR_ITEM_ID, quantity: 1 },
    { itemId: NECKLACE_MOULD_ITEM_ID, quantity: 1 },
    { itemId: OPAL, quantity: 1 },
]);
useOnLoc(SILVER_BAR_ITEM_ID, FURNACE_LOC);
assert.equal(skillMultis.length, 0);
assert.match(messages[0] ?? "", /Crafting level 16/);

resetState(99, [
    { itemId: SILVER_BAR_ITEM_ID, quantity: 1 },
    { itemId: RING_MOULD_ITEM_ID, quantity: 1 },
    { itemId: OPAL, quantity: 1 },
]);
runAction("skill.jewellery", { recipeId: "opal_ring", count: 1 });
assert.equal(count(OPAL_RING), 1);
assert.equal(count(SILVER_BAR_ITEM_ID), 0);
assert.equal(count(OPAL), 0);
assert.equal(count(RING_MOULD_ITEM_ID), 1);
assert.deepEqual(xp, [10]);

resetState(99, [
    { itemId: SILVER_BAR_ITEM_ID, quantity: 1 },
    { itemId: NECKLACE_MOULD_ITEM_ID, quantity: 1 },
    { itemId: JADE, quantity: 1 },
]);
runAction("skill.jewellery", { recipeId: "jade_necklace", count: 1 });
assert.equal(count(JADE_NECKLACE), 1);
assert.deepEqual(xp, [54]);

resetState(99, [
    { itemId: SILVER_BAR_ITEM_ID, quantity: 1 },
    { itemId: BRACELET_MOULD_ITEM_ID, quantity: 1 },
    { itemId: RED_TOPAZ, quantity: 1 },
]);
runAction("skill.jewellery", { recipeId: "topaz_bracelet", count: 1 });
assert.equal(count(TOPAZ_BRACELET), 1);
assert.deepEqual(xp, [75]);

resetState(99, [
    { itemId: SILVER_BAR_ITEM_ID, quantity: 1 },
    { itemId: AMULET_MOULD_ITEM_ID, quantity: 1 },
    { itemId: OPAL, quantity: 1 },
]);
runAction("skill.jewellery", { recipeId: "opal_amulet", count: 1 });
assert.equal(count(OPAL_AMULET_U), 1);
assert.deepEqual(xp, [55]);

resetState(99, [
    { itemId: OPAL_AMULET_U, quantity: 1 },
    { itemId: BALL_OF_WOOL_ITEM_ID, quantity: 1 },
]);
useOnItem(OPAL_AMULET_U, BALL_OF_WOOL_ITEM_ID);
assert.equal(actions[0]?.kind, "skill.string_amulet");
runAction("skill.string_amulet", { recipeId: "string_opal_amulet", count: 1 });
assert.equal(count(OPAL_AMULET), 1);
assert.equal(count(OPAL_AMULET_U), 0);
assert.equal(count(BALL_OF_WOOL_ITEM_ID), 0);
assert.deepEqual(xp, [4]);

{
    const originalRandom = Math.random;
    try {
        Math.random = () => 0.999;
        resetState(1, [
            { itemId: CHISEL_ITEM_ID, quantity: 1 },
            { itemId: UNCUT_OPAL, quantity: 1 },
        ]);
        const crushResult = runAction("skill.gem_cut", { recipeId: "cut_opal", count: 1 });
        assert.equal(count(CRUSHED_GEM_ITEM_ID), 1);
        assert.equal(count(OPAL), 0);
        assert.deepEqual(xp, [3.8]);
        const crushMessage = crushResult.effects?.find((effect) => effect.type === "message");
        assert(crushMessage && crushMessage.type === "message");
        assert.match(crushMessage.message, /smash the opal/);

        Math.random = () => 0;
        resetState(1, [
            { itemId: CHISEL_ITEM_ID, quantity: 1 },
            { itemId: UNCUT_OPAL, quantity: 1 },
        ]);
        runAction("skill.gem_cut", { recipeId: "cut_opal", count: 1 });
        assert.equal(count(OPAL), 1);
        assert.equal(count(CRUSHED_GEM_ITEM_ID), 0);
        assert.deepEqual(xp, [15]);
    } finally {
        Math.random = originalRandom;
    }
}

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
