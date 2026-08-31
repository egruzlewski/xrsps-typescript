import assert from "node:assert/strict";

import { EquipmentSlot } from "../../client/rs/config/player/Equipment";
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
import { GOLDSMITH_GAUNTLETS_ITEM_ID } from "../gamemodes/vanilla/skills/smithing/smithingBonuses";
import { beginSuperheatItemCast } from "../gamemodes/vanilla/skills/magic/superheatItem";
import {
    COAL_ITEM_ID,
    FIRE_RUNE_ID,
    NATURE_RUNE_ID,
    SUPERHEAT_ITEM_ANIMATION_ID,
    SUPERHEAT_ITEM_MAGIC_XP,
    SUPERHEAT_ITEM_SPELL_ID,
    getSuperheatItemSpell,
    getSuperheatRecipeForOre,
    isSuperheatOre,
} from "../gamemodes/vanilla/skills/magic/superheatItemData";

const COPPER_ORE_ID = 436;
const TIN_ORE_ID = 438;
const IRON_ORE_ID = 440;
const SILVER_ORE_ID = 442;
const GOLD_ORE_ID = 444;
const MITHRIL_ORE_ID = 447;
const BRONZE_BAR_ID = 2349;
const IRON_BAR_ID = 2351;
const STEEL_BAR_ID = 2353;
const SILVER_BAR_ID = 2355;
const GOLD_BAR_ID = 2357;
const MITHRIL_BAR_ID = 2359;

const spell = getSuperheatItemSpell(SUPERHEAT_ITEM_SPELL_ID);
assert(spell);
assert.equal(spell.level, 43);
assert.equal(spell.xp, 53);
assert.equal(isSuperheatOre(IRON_ORE_ID), true);
assert.equal(isSuperheatOre(COAL_ITEM_ID), false);
assert.equal(isSuperheatOre(IRON_BAR_ID), false);

assert.equal(getSuperheatRecipeForOre(IRON_ORE_ID, [{ itemId: IRON_ORE_ID, quantity: 1 }])?.id, "smelt_iron_bar");
assert.equal(
    getSuperheatRecipeForOre(IRON_ORE_ID, [
        { itemId: IRON_ORE_ID, quantity: 1 },
        { itemId: COAL_ITEM_ID, quantity: 2 },
    ])?.id,
    "smelt_steel_bar",
);
assert.equal(
    getSuperheatRecipeForOre(MITHRIL_ORE_ID, [{ itemId: MITHRIL_ORE_ID, quantity: 1 }])?.id,
    "smelt_mithril_bar",
);
assert.equal(getSuperheatRecipeForOre(COAL_ITEM_ID, [{ itemId: COAL_ITEM_ID, quantity: 8 }]), undefined);

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
const xp: Array<{ skillId: number; amount: number }> = [];
const seqs: number[] = [];
const spots: number[] = [];
const actions: Array<{ kind: string; data?: unknown }> = [];
const player = { id: 12, tileX: 3222, tileY: 3218, level: 0 } as PlayerState;
let magicLvl = 99;
let smithingLvl = 99;
let equip: number[] = [];

function resetState(
    magic: number,
    smithing: number,
    items: Array<{ itemId: number; quantity: number }>,
    worn: number[] = [],
): void {
    magicLvl = magic;
    smithingLvl = smithing;
    equip = worn.slice();
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
        getSkill: (_p: PlayerState, skillId: number) => ({
            baseLevel: skillId === SkillId.Smithing ? smithingLvl : magicLvl,
            boost: 0,
        }),
        addSkillXp: (_p: PlayerState, skillId: number, amount: number) => {
            xp.push({ skillId, amount });
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
    equipment: { getEquipArray: () => equip },
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

function superheatKit(
    extras: Array<{ itemId: number; quantity: number }>,
): Array<{ itemId: number; quantity: number }> {
    return [
        ...extras,
        { itemId: FIRE_RUNE_ID, quantity: 4 },
        { itemId: NATURE_RUNE_ID, quantity: 1 },
    ];
}

registerMagic(registry, services);

assert(invSpellHandlers.has(SUPERHEAT_ITEM_SPELL_ID));
assert(actionHandlers.has("skill.superheat_item"));

resetState(99, 99, superheatKit([{ itemId: IRON_ORE_ID, quantity: 1 }]));
const ironCast = castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, IRON_ORE_ID);
assert.equal(ironCast.outcome, "success");
assert.equal(actions[0]?.kind, "skill.superheat_item");
const ironResult = runAction("skill.superheat_item", {
    recipeId: "smelt_iron_bar",
    oreItemId: IRON_ORE_ID,
    preferredSlot: 0,
});
assert.equal(ironResult.ok, true);
assert.equal(countItem(IRON_BAR_ID), 1);
assert.equal(countItem(IRON_ORE_ID), 0);
assert.equal(countItem(FIRE_RUNE_ID), 0);
assert.equal(countItem(NATURE_RUNE_ID), 0);
assert.deepEqual(xp, [
    { skillId: SkillId.Magic, amount: SUPERHEAT_ITEM_MAGIC_XP },
    { skillId: SkillId.Smithing, amount: 13 },
]);
assert.equal(seqs[0], SUPERHEAT_ITEM_ANIMATION_ID);
const ironMessage = ironResult.effects?.find((effect) => effect.type === "message");
assert(ironMessage && "message" in ironMessage);
assert.match(ironMessage.message, /iron bar/i);

resetState(
    99,
    99,
    superheatKit([
        { itemId: IRON_ORE_ID, quantity: 1 },
        { itemId: COAL_ITEM_ID, quantity: 2 },
    ]),
);
castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, IRON_ORE_ID);
runAction("skill.superheat_item", {
    recipeId: "smelt_steel_bar",
    oreItemId: IRON_ORE_ID,
    preferredSlot: 0,
});
assert.equal(countItem(STEEL_BAR_ID), 1);
assert.equal(countItem(IRON_ORE_ID), 0);
assert.equal(countItem(COAL_ITEM_ID), 0);
assert.deepEqual(xp, [
    { skillId: SkillId.Magic, amount: SUPERHEAT_ITEM_MAGIC_XP },
    { skillId: SkillId.Smithing, amount: 18 },
]);

resetState(
    99,
    20,
    superheatKit([
        { itemId: IRON_ORE_ID, quantity: 1 },
        { itemId: COAL_ITEM_ID, quantity: 2 },
    ]),
);
const steelLowSmith = castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, IRON_ORE_ID);
assert.equal(steelLowSmith.outcome, "failure");
assert.equal(steelLowSmith.reason, "smelt_level");
assert.match(messages[0] ?? "", /Smithing level of 30/);
assert.equal(countItem(IRON_ORE_ID), 1);
assert.equal(countItem(COAL_ITEM_ID), 2);

resetState(
    99,
    99,
    superheatKit([
        { itemId: MITHRIL_ORE_ID, quantity: 1 },
        { itemId: COAL_ITEM_ID, quantity: 3 },
    ]),
);
const mithrilShortCoal = castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, MITHRIL_ORE_ID);
assert.equal(mithrilShortCoal.outcome, "failure");
assert.equal(mithrilShortCoal.reason, "missing_coal");
assert.match(messages[0] ?? "", /more coal/i);
assert.equal(countItem(MITHRIL_ORE_ID), 1);

resetState(
    99,
    99,
    superheatKit([
        { itemId: MITHRIL_ORE_ID, quantity: 1 },
        { itemId: COAL_ITEM_ID, quantity: 4 },
    ]),
);
castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, MITHRIL_ORE_ID);
runAction("skill.superheat_item", {
    recipeId: "smelt_mithril_bar",
    oreItemId: MITHRIL_ORE_ID,
    preferredSlot: 0,
});
assert.equal(countItem(MITHRIL_BAR_ID), 1);
assert.equal(countItem(COAL_ITEM_ID), 0);
assert.deepEqual(xp, [
    { skillId: SkillId.Magic, amount: SUPERHEAT_ITEM_MAGIC_XP },
    { skillId: SkillId.Smithing, amount: 30 },
]);

resetState(
    99,
    99,
    superheatKit([
        { itemId: COPPER_ORE_ID, quantity: 1 },
        { itemId: TIN_ORE_ID, quantity: 1 },
    ]),
);
castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, COPPER_ORE_ID);
runAction("skill.superheat_item", {
    recipeId: "smelt_bronze_bar",
    oreItemId: COPPER_ORE_ID,
    preferredSlot: 0,
});
assert.equal(countItem(BRONZE_BAR_ID), 1);
assert.equal(countItem(COPPER_ORE_ID), 0);
assert.equal(countItem(TIN_ORE_ID), 0);
assert.deepEqual(xp, [
    { skillId: SkillId.Magic, amount: SUPERHEAT_ITEM_MAGIC_XP },
    { skillId: SkillId.Smithing, amount: 6 },
]);

resetState(99, 99, superheatKit([{ itemId: COPPER_ORE_ID, quantity: 1 }]));
const bronzeMissingTin = castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, COPPER_ORE_ID);
assert.equal(bronzeMissingTin.outcome, "failure");
assert.equal(bronzeMissingTin.reason, "missing_ore");

resetState(99, 99, superheatKit([{ itemId: SILVER_ORE_ID, quantity: 1 }]));
castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, SILVER_ORE_ID);
runAction("skill.superheat_item", {
    recipeId: "smelt_silver_bar",
    oreItemId: SILVER_ORE_ID,
    preferredSlot: 0,
});
assert.equal(countItem(SILVER_BAR_ID), 1);
assert.deepEqual(xp, [
    { skillId: SkillId.Magic, amount: SUPERHEAT_ITEM_MAGIC_XP },
    { skillId: SkillId.Smithing, amount: 14 },
]);

resetState(99, 99, superheatKit([{ itemId: GOLD_ORE_ID, quantity: 1 }]));
castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, GOLD_ORE_ID);
runAction("skill.superheat_item", {
    recipeId: "smelt_gold_bar",
    oreItemId: GOLD_ORE_ID,
    preferredSlot: 0,
});
assert.equal(countItem(GOLD_BAR_ID), 1);
assert.deepEqual(xp, [
    { skillId: SkillId.Magic, amount: SUPERHEAT_ITEM_MAGIC_XP },
    { skillId: SkillId.Smithing, amount: 22 },
]);

const gauntlets = Array.from({ length: 12 }, () => -1);
gauntlets[EquipmentSlot.GLOVES] = GOLDSMITH_GAUNTLETS_ITEM_ID;
resetState(99, 99, superheatKit([{ itemId: GOLD_ORE_ID, quantity: 1 }]), gauntlets);
castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, GOLD_ORE_ID);
runAction("skill.superheat_item", {
    recipeId: "smelt_gold_bar",
    oreItemId: GOLD_ORE_ID,
    preferredSlot: 0,
});
assert.equal(countItem(GOLD_BAR_ID), 1);
assert.deepEqual(xp, [
    { skillId: SkillId.Magic, amount: SUPERHEAT_ITEM_MAGIC_XP },
    { skillId: SkillId.Smithing, amount: 55 },
]);

resetState(99, 99, superheatKit([{ itemId: COAL_ITEM_ID, quantity: 8 }]));
const coalCast = castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, COAL_ITEM_ID);
assert.equal(coalCast.outcome, "failure");
assert.equal(coalCast.reason, "superheat_invalid_item");
assert.match(messages[0] ?? "", /cast superheat item on ore/i);
assert.equal(actions.length, 0);

resetState(99, 99, superheatKit([{ itemId: 1511, quantity: 1 }]));
const logsCast = castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, 1511);
assert.equal(logsCast.outcome, "failure");
assert.equal(logsCast.reason, "superheat_invalid_item");

resetState(42, 99, superheatKit([{ itemId: IRON_ORE_ID, quantity: 1 }]));
const lowMagic = castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, IRON_ORE_ID);
assert.equal(lowMagic.outcome, "failure");
assert.equal(lowMagic.reason, "level_requirement");
assert.match(messages[0] ?? "", /Magic level of 43/);

resetState(99, 14, superheatKit([{ itemId: IRON_ORE_ID, quantity: 1 }]));
const lowSmith = castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, IRON_ORE_ID);
assert.equal(lowSmith.outcome, "failure");
assert.equal(lowSmith.reason, "smelt_level");

resetState(99, 99, [{ itemId: IRON_ORE_ID, quantity: 1 }, { itemId: NATURE_RUNE_ID, quantity: 1 }]);
const missingFire = castOnItem(SUPERHEAT_ITEM_SPELL_ID, 0, IRON_ORE_ID);
assert.equal(missingFire.outcome, "failure");
assert.equal(missingFire.reason, "out_of_runes");

resetState(99, 99, superheatKit([]));
const missingOre = beginSuperheatItemCast(
    player,
    services,
    SUPERHEAT_ITEM_SPELL_ID,
    { slot: 0, itemId: IRON_ORE_ID },
    4,
);
assert.equal(missingOre.ok, false);
assert.equal(missingOre.reason, "missing_ore");

console.log("magic-superheat-item.test.ts: all assertions passed");
