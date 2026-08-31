import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    InvSpellEvent,
    InvSpellHandler,
    LocSpellResult,
    ScriptActionHandler,
    ScriptActionHandlerContext,
    ScriptInventoryEntry,
    ScriptServices,
} from "../src/game/scripts/types";
import { register as registerMagic } from "../gamemodes/vanilla/skills/magic";
import { beginEnchantJewelleryCast } from "../gamemodes/vanilla/skills/magic/enchantJewellery";
import {
    AIR_RUNE_ID,
    BLOOD_RUNE_ID,
    COSMIC_RUNE_ID,
    EARTH_RUNE_ID,
    ENCHANT_JEWELLERY_ANIMATION_ID,
    ENCHANT_LVL1_SPELL_ID,
    ENCHANT_LVL2_SPELL_ID,
    ENCHANT_LVL3_SPELL_ID,
    ENCHANT_LVL4_SPELL_ID,
    ENCHANT_LVL5_SPELL_ID,
    ENCHANT_LVL6_SPELL_ID,
    ENCHANT_LVL7_SPELL_ID,
    FIRE_RUNE_ID,
    SOUL_RUNE_ID,
    WATER_RUNE_ID,
    getEnchantJewelleryRecipe,
    getEnchantJewellerySpell,
} from "../gamemodes/vanilla/skills/magic/enchantJewelleryData";

const lvl1 = getEnchantJewellerySpell(ENCHANT_LVL1_SPELL_ID);
assert(lvl1);
assert.equal(lvl1.level, 7);
assert.equal(lvl1.xp, 17.5);

const sapphireRing = getEnchantJewelleryRecipe(ENCHANT_LVL1_SPELL_ID, 1637);
assert(sapphireRing);
assert.equal(sapphireRing.productItemId, 2550);

assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL2_SPELL_ID, 1639)?.productItemId, 2552);
assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL3_SPELL_ID, 1641)?.productItemId, 2568);
assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL4_SPELL_ID, 1643)?.productItemId, 2570);
assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL5_SPELL_ID, 1702)?.productItemId, 1704);
assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL6_SPELL_ID, 6581)?.productItemId, 6585);
assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL7_SPELL_ID, 19538)?.productItemId, 19550);
assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL1_SPELL_ID, 1675), undefined);

const invSpellHandlers = new Map<number, InvSpellHandler>();
const actionHandlers = new Map<string, ScriptActionHandler>();

const registry = {
    registerActionHandler: (kind: string, handler: ScriptActionHandler) => {
        actionHandlers.set(kind, handler);
        return { unregister() {} };
    },
    registerSpellOnItem: (spellId: number, handler: InvSpellHandler) => {
        invSpellHandlers.set(spellId, handler);
        return { unregister() {} };
    },
    registerLocInteraction: () => ({ unregister() {} }),
    registerWidgetAction: () => ({ unregister() {} }),
} as unknown as IScriptRegistry;

type Slot = ScriptInventoryEntry;

const slots: Slot[] = [];
const messages: string[] = [];
const xp: number[] = [];
const seqs: number[] = [];
const spots: number[] = [];
const actions: Array<{ kind: string; data?: unknown }> = [];
const player = { id: 12, tileX: 3222, tileY: 3218, level: 0 } as PlayerState;
let magicLvl = 99;

function resetState(level: number, items: Array<{ itemId: number; quantity: number }>): void {
    magicLvl = level;
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
    spots.length = 0;
    actions.length = 0;
}

function countItem(itemId: number): number {
    return slots.reduce((sum, slot) => (slot.itemId === itemId ? sum + slot.quantity : sum), 0);
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
        getSkill: () => ({ baseLevel: magicLvl, boost: 0 }),
        addSkillXp: (_p: PlayerState, skillId: number, amount: number) => {
            assert.equal(skillId, SkillId.Magic);
            xp.push(amount);
        },
    },
    animation: {
        playPlayerSeq: (_p: PlayerState, seqId: number) => seqs.push(seqId),
        broadcastPlayerSpot: (_p: PlayerState, spotId: number) => spots.push(spotId),
        playLocAnimation: () => undefined,
    },
    sound: {
        sendSound: () => undefined,
        playAreaSound: () => undefined,
        enqueueSoundBroadcast: () => undefined,
    },
    location: { faceTile: () => undefined, emitLocChange: () => undefined },
    equipment: { getEquipArray: () => [] },
    combat: {
        requestAction: (_p: PlayerState, request: { kind: string; data?: unknown }) => {
            actions.push(request);
            return { ok: true };
        },
        scheduleAction: (_playerId: number, request: { kind: string; data?: unknown }) => {
            actions.push(request);
            return { ok: true };
        },
        validateRunes: (
            costs: Array<{ runeId: number; quantity: number }>,
            inventory: Array<{ itemId: number; quantity: number }>,
        ) => {
            const have = new Map<number, number>();
            for (const entry of inventory) {
                have.set(entry.itemId, (have.get(entry.itemId) ?? 0) + entry.quantity);
            }
            const runesConsumed: Array<{ runeId: number; quantity: number }> = [];
            for (const cost of costs) {
                if ((have.get(cost.runeId) ?? 0) < cost.quantity) {
                    return { canCast: false, runesConsumed: [] };
                }
                runesConsumed.push({ runeId: cost.runeId, quantity: cost.quantity });
            }
            return { canCast: true, runesConsumed };
        },
    },
    system: {
        getCurrentTick: () => 10,
        eventBus: { emit: () => undefined },
        logger: { info() {}, warn() {}, error() {}, debug() {} },
    },
} as unknown as ScriptServices;

function runAction(kind: string, data: unknown) {
    const handler = actionHandlers.get(kind);
    assert(handler, `expected action handler for ${kind}`);
    return handler({ player, data, tick: 10, services } as ScriptActionHandlerContext);
}

function castOnItem(spellId: number, slot: number, itemId: number) {
    const handler = invSpellHandlers.get(spellId);
    assert(handler, `expected inv spell handler for ${spellId}`);
    const spellResult: LocSpellResult = { outcome: "failure", reason: "invalid_target" };
    handler({
        player,
        spellId,
        slot,
        itemId,
        spellResult,
        tick: 4,
        services,
    } as InvSpellEvent);
    return spellResult;
}

function sapphireKit(): Array<{ itemId: number; quantity: number }> {
    return [
        { itemId: 1637, quantity: 1 },
        { itemId: COSMIC_RUNE_ID, quantity: 1 },
        { itemId: WATER_RUNE_ID, quantity: 1 },
    ];
}

registerMagic(registry, services);

assert(invSpellHandlers.has(ENCHANT_LVL1_SPELL_ID));
assert(invSpellHandlers.has(ENCHANT_LVL7_SPELL_ID));
assert(actionHandlers.has("skill.enchant_jewellery"));

resetState(99, sapphireKit());
const sapphireCast = castOnItem(ENCHANT_LVL1_SPELL_ID, 0, 1637);
assert.equal(sapphireCast.outcome, "success");
assert.equal(actions[0]?.kind, "skill.enchant_jewellery");
const sapphireResult = runAction("skill.enchant_jewellery", {
    recipeId: "sapphire_ring",
    count: 1,
    preferredSlot: 0,
});
assert.equal(sapphireResult.ok, true);
assert.equal(countItem(2550), 1);
assert.equal(countItem(1637), 0);
assert.equal(countItem(COSMIC_RUNE_ID), 0);
assert.equal(countItem(WATER_RUNE_ID), 0);
assert.deepEqual(xp, [17.5]);
assert.equal(seqs[0], ENCHANT_JEWELLERY_ANIMATION_ID);
const sapphireMessage = sapphireResult.effects?.find((effect) => effect.type === "message");
assert(sapphireMessage && "message" in sapphireMessage);
assert.match(sapphireMessage.message, /enchant the sapphire ring/i);

resetState(99, sapphireKit());
const wrongSpell = castOnItem(ENCHANT_LVL2_SPELL_ID, 0, 1637);
assert.equal(wrongSpell.outcome, "failure");
assert.equal(wrongSpell.reason, "enchant_invalid_item");
assert.match(messages[0] ?? "", /cannot be used on this item/i);
assert.equal(actions.length, 0);
assert.equal(countItem(1637), 1);

resetState(1, sapphireKit());
const lowLevel = castOnItem(ENCHANT_LVL1_SPELL_ID, 0, 1637);
assert.equal(lowLevel.outcome, "failure");
assert.equal(lowLevel.reason, "level_requirement");
assert.match(messages[0] ?? "", /Magic level of 7/);

resetState(99, [
    { itemId: 1637, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
]);
const missingRunes = castOnItem(ENCHANT_LVL1_SPELL_ID, 0, 1637);
assert.equal(missingRunes.outcome, "failure");
assert.equal(missingRunes.reason, "out_of_runes");

resetState(99, [
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: WATER_RUNE_ID, quantity: 1 },
]);
const missingJewellery = beginEnchantJewelleryCast(
    player,
    services,
    ENCHANT_LVL1_SPELL_ID,
    { slot: 0, itemId: 1637 },
    4,
);
assert.equal(missingJewellery.ok, false);
assert.equal(missingJewellery.reason, "enchant_invalid_item");

resetState(99, [
    { itemId: 1675, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: WATER_RUNE_ID, quantity: 1 },
]);
const unstrung = castOnItem(ENCHANT_LVL1_SPELL_ID, 0, 1675);
assert.equal(unstrung.outcome, "failure");
assert.equal(unstrung.reason, "enchant_invalid_item");

resetState(99, [
    { itemId: 19538, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: SOUL_RUNE_ID, quantity: 20 },
    { itemId: BLOOD_RUNE_ID, quantity: 20 },
]);
castOnItem(ENCHANT_LVL7_SPELL_ID, 0, 19538);
runAction("skill.enchant_jewellery", { recipeId: "zenyte_ring", count: 1, preferredSlot: 0 });
assert.equal(countItem(19550), 1);
assert.deepEqual(xp, [110]);

resetState(87, [
    { itemId: 6581, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: EARTH_RUNE_ID, quantity: 20 },
    { itemId: FIRE_RUNE_ID, quantity: 20 },
]);
castOnItem(ENCHANT_LVL6_SPELL_ID, 0, 6581);
runAction("skill.enchant_jewellery", { recipeId: "onyx_amulet", count: 1, preferredSlot: 0 });
assert.equal(countItem(6585), 1);
assert.deepEqual(xp, [97]);

resetState(99, [
    { itemId: 1696, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: AIR_RUNE_ID, quantity: 3 },
]);
castOnItem(ENCHANT_LVL2_SPELL_ID, 0, 1696);
runAction("skill.enchant_jewellery", { recipeId: "emerald_amulet", count: 1, preferredSlot: 0 });
assert.equal(countItem(1729), 1);

resetState(99, [
    { itemId: 1641, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: FIRE_RUNE_ID, quantity: 5 },
]);
castOnItem(ENCHANT_LVL3_SPELL_ID, 0, 1641);
runAction("skill.enchant_jewellery", { recipeId: "ruby_ring", count: 1, preferredSlot: 0 });
assert.equal(countItem(2568), 1);

resetState(99, [
    { itemId: 1662, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: EARTH_RUNE_ID, quantity: 10 },
]);
castOnItem(ENCHANT_LVL4_SPELL_ID, 0, 1662);
runAction("skill.enchant_jewellery", { recipeId: "diamond_necklace", count: 1, preferredSlot: 0 });
assert.equal(countItem(11090), 1);

resetState(99, [
    { itemId: 11115, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: EARTH_RUNE_ID, quantity: 15 },
    { itemId: WATER_RUNE_ID, quantity: 15 },
]);
castOnItem(ENCHANT_LVL5_SPELL_ID, 0, 11115);
runAction("skill.enchant_jewellery", {
    recipeId: "dragonstone_bracelet",
    count: 1,
    preferredSlot: 0,
});
assert.equal(countItem(11126), 1);

resetState(99, [
    { itemId: 1637, quantity: 2 },
    { itemId: COSMIC_RUNE_ID, quantity: 2 },
    { itemId: WATER_RUNE_ID, quantity: 2 },
]);
castOnItem(ENCHANT_LVL1_SPELL_ID, 0, 1637);
runAction("skill.enchant_jewellery", { recipeId: "sapphire_ring", count: 2, preferredSlot: 0 });
assert.equal(countItem(2550), 1);
assert.equal(countItem(1637), 1);
assert.equal(actions.some((action) => action.kind === "skill.enchant_jewellery"), true);

assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL1_SPELL_ID, 21081)?.productItemId, 21126);
assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL2_SPELL_ID, 21084)?.productItemId, 21129);
assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL3_SPELL_ID, 21087)?.productItemId, 21140);
assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL1_SPELL_ID, 21099), undefined);
assert.equal(getEnchantJewelleryRecipe(ENCHANT_LVL2_SPELL_ID, 21081), undefined);

resetState(99, [
    { itemId: 21081, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: WATER_RUNE_ID, quantity: 1 },
]);
castOnItem(ENCHANT_LVL1_SPELL_ID, 0, 21081);
runAction("skill.enchant_jewellery", { recipeId: "opal_ring", count: 1, preferredSlot: 0 });
assert.equal(countItem(21126), 1);
assert.equal(countItem(21081), 0);
assert.deepEqual(xp, [17.5]);

resetState(99, [
    { itemId: 21090, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: WATER_RUNE_ID, quantity: 1 },
]);
castOnItem(ENCHANT_LVL1_SPELL_ID, 0, 21090);
runAction("skill.enchant_jewellery", { recipeId: "opal_necklace", count: 1, preferredSlot: 0 });
assert.equal(countItem(21143), 1);

resetState(99, [
    { itemId: 21108, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: WATER_RUNE_ID, quantity: 1 },
]);
castOnItem(ENCHANT_LVL1_SPELL_ID, 0, 21108);
runAction("skill.enchant_jewellery", { recipeId: "opal_amulet", count: 1, preferredSlot: 0 });
assert.equal(countItem(21160), 1);

resetState(99, [
    { itemId: 21081, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: AIR_RUNE_ID, quantity: 3 },
]);
const opalWrongSpell = castOnItem(ENCHANT_LVL2_SPELL_ID, 0, 21081);
assert.equal(opalWrongSpell.outcome, "failure");
assert.equal(opalWrongSpell.reason, "enchant_invalid_item");
assert.equal(countItem(21081), 1);

resetState(99, [
    { itemId: 21084, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: AIR_RUNE_ID, quantity: 3 },
]);
castOnItem(ENCHANT_LVL2_SPELL_ID, 0, 21084);
runAction("skill.enchant_jewellery", { recipeId: "jade_ring", count: 1, preferredSlot: 0 });
assert.equal(countItem(21129), 1);
assert.deepEqual(xp, [37]);

resetState(99, [
    { itemId: 21111, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: AIR_RUNE_ID, quantity: 3 },
]);
castOnItem(ENCHANT_LVL2_SPELL_ID, 0, 21111);
runAction("skill.enchant_jewellery", { recipeId: "jade_amulet", count: 1, preferredSlot: 0 });
assert.equal(countItem(21163), 1);

resetState(99, [
    { itemId: 21087, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: FIRE_RUNE_ID, quantity: 5 },
]);
castOnItem(ENCHANT_LVL3_SPELL_ID, 0, 21087);
runAction("skill.enchant_jewellery", { recipeId: "topaz_ring", count: 1, preferredSlot: 0 });
assert.equal(countItem(21140), 1);
assert.deepEqual(xp, [59]);

resetState(99, [
    { itemId: 21114, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: FIRE_RUNE_ID, quantity: 5 },
]);
castOnItem(ENCHANT_LVL3_SPELL_ID, 0, 21114);
runAction("skill.enchant_jewellery", { recipeId: "topaz_amulet", count: 1, preferredSlot: 0 });
assert.equal(countItem(21166), 1);

resetState(99, [
    { itemId: 21099, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: WATER_RUNE_ID, quantity: 1 },
]);
const unstrungOpal = castOnItem(ENCHANT_LVL1_SPELL_ID, 0, 21099);
assert.equal(unstrungOpal.outcome, "failure");
assert.equal(unstrungOpal.reason, "enchant_invalid_item");

console.log("magic-enchant-jewellery.test.ts: all assertions passed");
