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
import { beginAlchemyCast } from "../gamemodes/vanilla/skills/magic/alchemy";
import {
    type AlchemyItemDef,
    COINS_ITEM_ID,
    FIRE_RUNE_ID,
    HIGH_ALCHEMY_ANIMATION_ID,
    HIGH_ALCHEMY_MAGIC_XP,
    HIGH_ALCHEMY_SPELL_ID,
    LOW_ALCHEMY_ANIMATION_ID,
    LOW_ALCHEMY_MAGIC_XP,
    LOW_ALCHEMY_SPELL_ID,
    NATURE_RUNE_ID,
    canAlchemiseItem,
    getAlchCoins,
    getAlchemySpell,
} from "../gamemodes/vanilla/skills/magic/alchemyData";

const IRON_ORE_ID = 440;
const FIRE_CAPE_ID = 6570;
const VALUE_ONLY_ID = 1234;

const low = getAlchemySpell(LOW_ALCHEMY_SPELL_ID);
assert(low);
assert.equal(low.level, 21);
assert.equal(low.xp, 31);
assert.deepEqual(low.runeCosts, [
    { runeId: FIRE_RUNE_ID, quantity: 3 },
    { runeId: NATURE_RUNE_ID, quantity: 1 },
]);

const high = getAlchemySpell(HIGH_ALCHEMY_SPELL_ID);
assert(high);
assert.equal(high.level, 55);
assert.equal(high.xp, 65);
assert.deepEqual(high.runeCosts, [
    { runeId: FIRE_RUNE_ID, quantity: 5 },
    { runeId: NATURE_RUNE_ID, quantity: 1 },
]);

assert.equal(canAlchemiseItem(COINS_ITEM_ID, { tradeable: true, value: 1 }).ok, false);
assert.equal(canAlchemiseItem(FIRE_CAPE_ID, { tradeable: false }).ok, false);
assert.equal(canAlchemiseItem(IRON_ORE_ID, { tradeable: true, highAlch: 15 }).ok, true);
assert.equal(canAlchemiseItem(IRON_ORE_ID, undefined).ok, false);

assert.equal(getAlchCoins({ highAlch: 39000, lowAlch: 26000, value: 65000 }, true), 39000);
assert.equal(getAlchCoins({ highAlch: 39000, lowAlch: 26000, value: 65000 }, false), 26000);
assert.equal(getAlchCoins({ value: 1000, tradeable: true }, true), 600);
assert.equal(getAlchCoins({ value: 1000, tradeable: true }, false), 400);

const defs = new Map<number, AlchemyItemDef>([
    [IRON_ORE_ID, { tradeable: true, value: 25, highAlch: 15, lowAlch: 10 }],
    [FIRE_CAPE_ID, { tradeable: false, value: 0, highAlch: 0, lowAlch: 0 }],
    [COINS_ITEM_ID, { tradeable: true, value: 1, highAlch: 0, lowAlch: 0 }],
    [VALUE_ONLY_ID, { tradeable: true, value: 1000 }],
]);

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
    registerSpellOnGroundItem: () => ({ unregister() {} }),
    registerLocInteraction: () => ({ unregister() {} }),
    registerWidgetAction: () => ({ unregister() {} }),
} as unknown as IScriptRegistry;

type Slot = ScriptInventoryEntry;

const slots: Slot[] = [];
const messages: string[] = [];
const xp: Array<{ skillId: number; amount: number }> = [];
const seqs: number[] = [];
const spots: number[] = [];
const sounds: number[] = [];
const actions: Array<{ kind: string; data?: unknown }> = [];
const player = { id: 12, tileX: 3222, tileY: 3218, level: 0 } as PlayerState;
let magicLvl = 99;

function resetState(magic: number, items: Array<{ itemId: number; quantity: number }>): void {
    magicLvl = magic;
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
    sounds.length = 0;
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
        getSkill: () => ({
            baseLevel: magicLvl,
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
        playAreaSound: (opts: { soundId: number }) => sounds.push(opts.soundId),
        enqueueSoundBroadcast: () => undefined,
    },
    location: { faceTile: () => undefined, emitLocChange: () => undefined },
    equipment: { getEquipArray: () => [] },
    data: {
        getItemDefinition: (itemId: number) => defs.get(itemId),
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

function highAlchKit(
    extras: Array<{ itemId: number; quantity: number }>,
): Array<{ itemId: number; quantity: number }> {
    return [
        ...extras,
        { itemId: FIRE_RUNE_ID, quantity: 5 },
        { itemId: NATURE_RUNE_ID, quantity: 1 },
    ];
}

function lowAlchKit(
    extras: Array<{ itemId: number; quantity: number }>,
): Array<{ itemId: number; quantity: number }> {
    return [
        ...extras,
        { itemId: FIRE_RUNE_ID, quantity: 3 },
        { itemId: NATURE_RUNE_ID, quantity: 1 },
    ];
}

registerMagic(registry, services);

assert(invSpellHandlers.has(LOW_ALCHEMY_SPELL_ID));
assert(invSpellHandlers.has(HIGH_ALCHEMY_SPELL_ID));
assert(actionHandlers.has("skill.alchemy"));

resetState(99, highAlchKit([{ itemId: IRON_ORE_ID, quantity: 1 }]));
const highCast = castOnItem(HIGH_ALCHEMY_SPELL_ID, 0, IRON_ORE_ID);
assert.equal(highCast.outcome, "success");
assert.equal(actions[0]?.kind, "skill.alchemy");
const highResult = runAction("skill.alchemy", {
    spellId: HIGH_ALCHEMY_SPELL_ID,
    itemId: IRON_ORE_ID,
    preferredSlot: 0,
});
assert.equal(highResult.ok, true);
assert.equal(countItem(IRON_ORE_ID), 0);
assert.equal(countItem(COINS_ITEM_ID), 15);
assert.equal(countItem(FIRE_RUNE_ID), 0);
assert.equal(countItem(NATURE_RUNE_ID), 0);
assert.deepEqual(xp, [{ skillId: SkillId.Magic, amount: HIGH_ALCHEMY_MAGIC_XP }]);
assert.equal(seqs[0], HIGH_ALCHEMY_ANIMATION_ID);

resetState(99, lowAlchKit([{ itemId: IRON_ORE_ID, quantity: 2 }]));
const lowCast = castOnItem(LOW_ALCHEMY_SPELL_ID, 0, IRON_ORE_ID);
assert.equal(lowCast.outcome, "success");
runAction("skill.alchemy", {
    spellId: LOW_ALCHEMY_SPELL_ID,
    itemId: IRON_ORE_ID,
    preferredSlot: 0,
});
assert.equal(countItem(IRON_ORE_ID), 1);
assert.equal(countItem(COINS_ITEM_ID), 10);
assert.deepEqual(xp, [{ skillId: SkillId.Magic, amount: LOW_ALCHEMY_MAGIC_XP }]);
assert.equal(seqs[0], LOW_ALCHEMY_ANIMATION_ID);

resetState(99, highAlchKit([{ itemId: VALUE_ONLY_ID, quantity: 1 }]));
castOnItem(HIGH_ALCHEMY_SPELL_ID, 0, VALUE_ONLY_ID);
runAction("skill.alchemy", {
    spellId: HIGH_ALCHEMY_SPELL_ID,
    itemId: VALUE_ONLY_ID,
    preferredSlot: 0,
});
assert.equal(countItem(VALUE_ONLY_ID), 0);
assert.equal(countItem(COINS_ITEM_ID), 600);

resetState(99, lowAlchKit([{ itemId: VALUE_ONLY_ID, quantity: 1 }]));
castOnItem(LOW_ALCHEMY_SPELL_ID, 0, VALUE_ONLY_ID);
runAction("skill.alchemy", {
    spellId: LOW_ALCHEMY_SPELL_ID,
    itemId: VALUE_ONLY_ID,
    preferredSlot: 0,
});
assert.equal(countItem(COINS_ITEM_ID), 400);

resetState(99, highAlchKit([{ itemId: FIRE_CAPE_ID, quantity: 1 }]));
const untradeable = castOnItem(HIGH_ALCHEMY_SPELL_ID, 0, FIRE_CAPE_ID);
assert.equal(untradeable.outcome, "failure");
assert.equal(untradeable.reason, "alch_invalid_item");
assert.match(messages[0] ?? "", /cannot alchemise/i);
assert.equal(countItem(FIRE_CAPE_ID), 1);
assert.equal(countItem(NATURE_RUNE_ID), 1);

resetState(99, highAlchKit([{ itemId: COINS_ITEM_ID, quantity: 50 }]));
const coinsCast = castOnItem(HIGH_ALCHEMY_SPELL_ID, 0, COINS_ITEM_ID);
assert.equal(coinsCast.outcome, "failure");
assert.equal(coinsCast.reason, "alch_coins");
assert.match(messages[0] ?? "", /already made of gold/i);
assert.equal(countItem(COINS_ITEM_ID), 50);

resetState(21, highAlchKit([{ itemId: IRON_ORE_ID, quantity: 1 }]));
const lowMagic = castOnItem(HIGH_ALCHEMY_SPELL_ID, 0, IRON_ORE_ID);
assert.equal(lowMagic.outcome, "failure");
assert.equal(lowMagic.reason, "level_requirement");
assert.match(messages[0] ?? "", /Magic level of 55/);
assert.equal(countItem(IRON_ORE_ID), 1);

resetState(99, [{ itemId: IRON_ORE_ID, quantity: 1 }, { itemId: NATURE_RUNE_ID, quantity: 1 }]);
const noFire = castOnItem(HIGH_ALCHEMY_SPELL_ID, 0, IRON_ORE_ID);
assert.equal(noFire.outcome, "failure");
assert.equal(noFire.reason, "out_of_runes");
assert.match(messages[0] ?? "", /enough runes/);
assert.equal(countItem(IRON_ORE_ID), 1);

const silent = beginAlchemyCast(player, services, 9999, { itemId: IRON_ORE_ID });
assert.equal(silent.ok, false);
assert.equal(silent.reason, "invalid_spell");
assert.equal(silent.silent, true);

console.log("magic-alchemy tests passed");
