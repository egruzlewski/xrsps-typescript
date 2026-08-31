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
import { beginBonesToBananasCast } from "../gamemodes/vanilla/skills/magic/bonesToBananas";
import {
    BANANA_ITEM_ID,
    BONES_TO_BANANAS_ANIMATION_ID,
    BONES_TO_BANANAS_MAGIC_XP,
    BONES_TO_BANANAS_SPELL_ID,
    EARTH_RUNE_ID,
    NATURE_RUNE_ID,
    WATER_RUNE_ID,
    countConvertibleBones,
    getBonesToBananasSpell,
    isConvertibleBone,
} from "../gamemodes/vanilla/skills/magic/bonesToBananasData";

const BONES_ID = 526;
const BURNT_BONES_ID = 528;
const BIG_BONES_ID = 532;
const DRAGON_BONES_ID = 536;
const LONG_BONE_ID = 10976;
const MONKEY_BONES_ID = 3179;

const spell = getBonesToBananasSpell(BONES_TO_BANANAS_SPELL_ID);
assert(spell);
assert.equal(spell.level, 15);
assert.equal(spell.xp, 25);
assert.equal(spell.productItemId, BANANA_ITEM_ID);
assert.equal(isConvertibleBone(BONES_ID), true);
assert.equal(isConvertibleBone(BURNT_BONES_ID), true);
assert.equal(isConvertibleBone(BIG_BONES_ID), true);
assert.equal(isConvertibleBone(MONKEY_BONES_ID), true);
assert.equal(isConvertibleBone(DRAGON_BONES_ID), false);
assert.equal(isConvertibleBone(LONG_BONE_ID), false);
assert.equal(
    countConvertibleBones([
        { itemId: BONES_ID, quantity: 1 },
        { itemId: DRAGON_BONES_ID, quantity: 1 },
        { itemId: BIG_BONES_ID, quantity: 1 },
    ]),
    2,
);

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

function runeKit(bones: Array<{ itemId: number; quantity: number }>): Array<{
    itemId: number;
    quantity: number;
}> {
    return [
        ...bones,
        { itemId: NATURE_RUNE_ID, quantity: 1 },
        { itemId: WATER_RUNE_ID, quantity: 2 },
        { itemId: EARTH_RUNE_ID, quantity: 2 },
    ];
}

registerMagic(registry, services);

assert(invSpellHandlers.has(BONES_TO_BANANAS_SPELL_ID));
assert(actionHandlers.has("skill.bones_to_bananas"));

resetState(99, runeKit([{ itemId: BONES_ID, quantity: 1 }]));
const bananaCast = castOnItem(BONES_TO_BANANAS_SPELL_ID, 0, BONES_ID);
assert.equal(bananaCast.outcome, "success");
assert.equal(actions[0]?.kind, "skill.bones_to_bananas");
const bananaResult = runAction("skill.bones_to_bananas", {});
assert.equal(bananaResult.ok, true);
assert.equal(countItem(BANANA_ITEM_ID), 1);
assert.equal(countItem(BONES_ID), 0);
assert.equal(countItem(NATURE_RUNE_ID), 0);
assert.equal(countItem(WATER_RUNE_ID), 0);
assert.equal(countItem(EARTH_RUNE_ID), 0);
assert.deepEqual(xp, [BONES_TO_BANANAS_MAGIC_XP]);
assert.equal(seqs[0], BONES_TO_BANANAS_ANIMATION_ID);
const bananaMessage = bananaResult.effects?.find((effect) => effect.type === "message");
assert(bananaMessage && "message" in bananaMessage);
assert.match(bananaMessage.message, /convert the bones into bananas/i);

resetState(
    99,
    runeKit([
        { itemId: BONES_ID, quantity: 1 },
        { itemId: BIG_BONES_ID, quantity: 1 },
        { itemId: BURNT_BONES_ID, quantity: 1 },
    ]),
);
castOnItem(BONES_TO_BANANAS_SPELL_ID, 0, BONES_ID);
runAction("skill.bones_to_bananas", {});
assert.equal(countItem(BANANA_ITEM_ID), 3);
assert.equal(countItem(BONES_ID), 0);
assert.equal(countItem(BIG_BONES_ID), 0);
assert.equal(countItem(BURNT_BONES_ID), 0);
assert.deepEqual(xp, [25]);

resetState(
    99,
    runeKit([
        { itemId: BONES_ID, quantity: 1 },
        { itemId: DRAGON_BONES_ID, quantity: 1 },
        { itemId: LONG_BONE_ID, quantity: 1 },
    ]),
);
castOnItem(BONES_TO_BANANAS_SPELL_ID, 0, BONES_ID);
runAction("skill.bones_to_bananas", {});
assert.equal(countItem(BANANA_ITEM_ID), 1);
assert.equal(countItem(DRAGON_BONES_ID), 1);
assert.equal(countItem(LONG_BONE_ID), 1);

resetState(14, runeKit([{ itemId: BONES_ID, quantity: 1 }]));
const lowLevel = castOnItem(BONES_TO_BANANAS_SPELL_ID, 0, BONES_ID);
assert.equal(lowLevel.outcome, "failure");
assert.equal(lowLevel.reason, "level_requirement");
assert.match(messages[0] ?? "", /Magic level of 15/);
assert.equal(actions.length, 0);
assert.equal(countItem(BONES_ID), 1);

resetState(99, [
    { itemId: BONES_ID, quantity: 1 },
    { itemId: NATURE_RUNE_ID, quantity: 1 },
    { itemId: WATER_RUNE_ID, quantity: 1 },
]);
const missingRunes = castOnItem(BONES_TO_BANANAS_SPELL_ID, 0, BONES_ID);
assert.equal(missingRunes.outcome, "failure");
assert.equal(missingRunes.reason, "out_of_runes");
assert.equal(countItem(BONES_ID), 1);

resetState(99, [
    { itemId: NATURE_RUNE_ID, quantity: 1 },
    { itemId: WATER_RUNE_ID, quantity: 2 },
    { itemId: EARTH_RUNE_ID, quantity: 2 },
]);
const noBones = beginBonesToBananasCast(player, services, BONES_TO_BANANAS_SPELL_ID, 4);
assert.equal(noBones.ok, false);
assert.equal(noBones.reason, "bones_to_bananas_no_bones");
assert.match(messages[0] ?? "", /no bones to convert/i);

resetState(99, runeKit([{ itemId: DRAGON_BONES_ID, quantity: 1 }]));
const dragonOnly = castOnItem(BONES_TO_BANANAS_SPELL_ID, 0, DRAGON_BONES_ID);
assert.equal(dragonOnly.outcome, "failure");
assert.equal(dragonOnly.reason, "bones_to_bananas_no_bones");
assert.equal(countItem(DRAGON_BONES_ID), 1);
assert.equal(countItem(BANANA_ITEM_ID), 0);

resetState(99, runeKit([{ itemId: MONKEY_BONES_ID, quantity: 1 }]));
castOnItem(BONES_TO_BANANAS_SPELL_ID, 0, MONKEY_BONES_ID);
runAction("skill.bones_to_bananas", {});
assert.equal(countItem(BANANA_ITEM_ID), 1);
assert.equal(countItem(MONKEY_BONES_ID), 0);

console.log("magic-bones-to-bananas.test.ts: all assertions passed");
