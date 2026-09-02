import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    LocInteractionHandler,
    LocSpellResult,
    ScriptActionHandler,
    ScriptActionHandlerContext,
    ScriptInventoryEntry,
    ScriptServices,
    WidgetActionHandler,
} from "../src/game/scripts/types";
import { register as registerMagic } from "../gamemodes/vanilla/skills/magic";
import { beginChargeOrbCast } from "../gamemodes/vanilla/skills/magic/chargeOrb";
import {
    AIR_ORB_ITEM_ID,
    AIR_RUNE_ID,
    CHARGE_AIR_ORB_SPELL_ID,
    CHARGE_EARTH_ORB_SPELL_ID,
    CHARGE_FIRE_ORB_SPELL_ID,
    CHARGE_ORB_ANIMATION_ID,
    CHARGE_WATER_ORB_SPELL_ID,
    COSMIC_RUNE_ID,
    EARTH_ORB_ITEM_ID,
    EARTH_RUNE_ID,
    FIRE_ORB_ITEM_ID,
    FIRE_RUNE_ID,
    OBELISK_OF_AIR_LOC_ID,
    OBELISK_OF_EARTH_LOC_ID,
    OBELISK_OF_FIRE_LOC_ID,
    OBELISK_OF_WATER_LOC_ID,
    UNPOWERED_ORB_ITEM_ID,
    WATER_ORB_ITEM_ID,
    WATER_RUNE_ID,
    getChargeOrbRecipeByLocId,
    getChargeOrbRecipeBySpellId,
} from "../gamemodes/vanilla/skills/magic/chargeOrbData";

const water = getChargeOrbRecipeBySpellId(CHARGE_WATER_ORB_SPELL_ID);
assert(water);
assert.equal(water.locId, OBELISK_OF_WATER_LOC_ID);
assert.equal(water.chargedOrbItemId, WATER_ORB_ITEM_ID);
assert.equal(water.level, 56);
assert.equal(water.xp, 66);
assert.equal(water.elementalRuneId, WATER_RUNE_ID);

const earth = getChargeOrbRecipeByLocId(OBELISK_OF_EARTH_LOC_ID);
assert(earth);
assert.equal(earth.spellId, CHARGE_EARTH_ORB_SPELL_ID);
assert.equal(earth.chargedOrbItemId, EARTH_ORB_ITEM_ID);
assert.equal(earth.level, 60);
assert.equal(earth.xp, 70);

const fire = getChargeOrbRecipeBySpellId(CHARGE_FIRE_ORB_SPELL_ID);
assert(fire);
assert.equal(fire.locId, OBELISK_OF_FIRE_LOC_ID);
assert.equal(fire.chargedOrbItemId, FIRE_ORB_ITEM_ID);
assert.equal(fire.level, 63);
assert.equal(fire.xp, 73);

const air = getChargeOrbRecipeBySpellId(CHARGE_AIR_ORB_SPELL_ID);
assert(air);
assert.equal(air.locId, OBELISK_OF_AIR_LOC_ID);
assert.equal(air.chargedOrbItemId, AIR_ORB_ITEM_ID);
assert.equal(air.level, 66);
assert.equal(air.xp, 76);

const locHandlers = new Map<string, LocInteractionHandler>();
const actionHandlers = new Map<string, ScriptActionHandler>();
const widgetHandlers: WidgetActionHandler[] = [];

const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerActionHandler: (kind: string, handler: ScriptActionHandler) => {
        actionHandlers.set(kind, handler);
        return { unregister() {} };
    },
    registerWidgetAction: ({ handler }: { handler: WidgetActionHandler }) => {
        widgetHandlers.push(handler);
        return { unregister() {} };
    },
    registerSpellOnItem: () => ({ unregister() {} }),
    registerSpellOnGroundItem: () => ({ unregister() {} }),
} as unknown as IScriptRegistry;

type Slot = ScriptInventoryEntry;

const slots: Slot[] = [];
const messages: string[] = [];
const xp: number[] = [];
const seqs: number[] = [];
const spots: number[] = [];
const actions: Array<{ kind: string; data?: unknown }> = [];
const player = { id: 11, tileX: 2844, tileY: 3422, level: 0 } as PlayerState;
let magicLvl = 99;

function resetState(
    level: number,
    items: Array<{ itemId: number; quantity: number }>,
    tile?: { x: number; y: number; level?: number },
): void {
    magicLvl = level;
    player.tileX = tile?.x ?? 2844;
    player.tileY = tile?.y ?? 3422;
    player.level = tile?.level ?? 0;
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

function castOnLoc(locId: number, spellId: number, tile: { x: number; y: number }) {
    const handler = locHandlers.get(`${locId}:spell`);
    assert(handler, `expected loc spell handler for ${locId}`);
    const spellResult: LocSpellResult = { outcome: "failure", reason: "invalid_target" };
    handler({
        player,
        locId,
        tile,
        level: player.level,
        action: "spell",
        spellId,
        spellResult,
        tick: 4,
        services,
    } as LocInteractionEvent);
    return spellResult;
}

function waterKit(): Array<{ itemId: number; quantity: number }> {
    return [
        { itemId: UNPOWERED_ORB_ITEM_ID, quantity: 1 },
        { itemId: COSMIC_RUNE_ID, quantity: 3 },
        { itemId: WATER_RUNE_ID, quantity: 30 },
    ];
}

registerMagic(registry, services);

assert(locHandlers.has(`${OBELISK_OF_WATER_LOC_ID}:spell`));
assert(locHandlers.has(`${OBELISK_OF_EARTH_LOC_ID}:spell`));
assert(locHandlers.has(`${OBELISK_OF_FIRE_LOC_ID}:spell`));
assert(locHandlers.has(`${OBELISK_OF_AIR_LOC_ID}:spell`));
assert(actionHandlers.has("skill.charge_orb"));
assert.ok(widgetHandlers.length >= 1);

resetState(99, waterKit(), { x: 2844, y: 3422 });
const waterCast = castOnLoc(OBELISK_OF_WATER_LOC_ID, CHARGE_WATER_ORB_SPELL_ID, {
    x: 2844,
    y: 3422,
});
assert.equal(waterCast.outcome, "success");
assert.equal(actions[0]?.kind, "skill.charge_orb");
const waterResult = runAction("skill.charge_orb", { recipeId: "charge_water_orb", count: 1 });
assert.equal(waterResult.ok, true);
assert.equal(countItem(WATER_ORB_ITEM_ID), 1);
assert.equal(countItem(UNPOWERED_ORB_ITEM_ID), 0);
assert.equal(countItem(COSMIC_RUNE_ID), 0);
assert.equal(countItem(WATER_RUNE_ID), 0);
assert.deepEqual(xp, [66]);
assert.equal(seqs[0], CHARGE_ORB_ANIMATION_ID);
const waterMessage = waterResult.effects?.find((effect) => effect.type === "message");
assert(waterMessage && "message" in waterMessage);
assert.match(waterMessage.message, /charge the orb/i);

resetState(99, waterKit(), { x: 2844, y: 3422 });
const wrongObelisk = castOnLoc(OBELISK_OF_EARTH_LOC_ID, CHARGE_WATER_ORB_SPELL_ID, {
    x: 3086,
    y: 9932,
});
assert.equal(wrongObelisk.outcome, "failure");
assert.equal(wrongObelisk.reason, "charge_orb_wrong_obelisk");
assert.match(messages[0] ?? "", /correct element/i);
assert.equal(actions.length, 0);
assert.equal(countItem(UNPOWERED_ORB_ITEM_ID), 1);

resetState(99, [
    { itemId: COSMIC_RUNE_ID, quantity: 3 },
    { itemId: WATER_RUNE_ID, quantity: 30 },
], { x: 2844, y: 3422 });
const missingOrb = castOnLoc(OBELISK_OF_WATER_LOC_ID, CHARGE_WATER_ORB_SPELL_ID, {
    x: 2844,
    y: 3422,
});
assert.equal(missingOrb.outcome, "failure");
assert.equal(missingOrb.reason, "charge_orb_missing_orb");
assert.match(messages[0] ?? "", /unpowered orb/i);

resetState(1, waterKit(), { x: 2844, y: 3422 });
const lowLevel = castOnLoc(OBELISK_OF_WATER_LOC_ID, CHARGE_WATER_ORB_SPELL_ID, {
    x: 2844,
    y: 3422,
});
assert.equal(lowLevel.outcome, "failure");
assert.equal(lowLevel.reason, "level_requirement");
assert.match(messages[0] ?? "", /Magic level of 56/);

resetState(99, [
    { itemId: UNPOWERED_ORB_ITEM_ID, quantity: 1 },
    { itemId: COSMIC_RUNE_ID, quantity: 1 },
    { itemId: WATER_RUNE_ID, quantity: 30 },
], { x: 2844, y: 3422 });
const missingRunes = castOnLoc(OBELISK_OF_WATER_LOC_ID, CHARGE_WATER_ORB_SPELL_ID, {
    x: 2844,
    y: 3422,
});
assert.equal(missingRunes.outcome, "failure");
assert.equal(missingRunes.reason, "out_of_runes");

resetState(99, waterKit(), { x: 2800, y: 3400 });
const tooFar = castOnLoc(OBELISK_OF_WATER_LOC_ID, CHARGE_WATER_ORB_SPELL_ID, {
    x: 2844,
    y: 3422,
});
assert.equal(tooFar.outcome, "failure");
assert.equal(tooFar.reason, "out_of_range");

resetState(
    60,
    [
        { itemId: UNPOWERED_ORB_ITEM_ID, quantity: 1 },
        { itemId: COSMIC_RUNE_ID, quantity: 3 },
        { itemId: EARTH_RUNE_ID, quantity: 30 },
    ],
    { x: 3086, y: 9932 },
);
castOnLoc(OBELISK_OF_EARTH_LOC_ID, CHARGE_EARTH_ORB_SPELL_ID, { x: 3086, y: 9932 });
runAction("skill.charge_orb", { recipeId: "charge_earth_orb", count: 1 });
assert.equal(countItem(EARTH_ORB_ITEM_ID), 1);
assert.deepEqual(xp, [70]);

resetState(
    63,
    [
        { itemId: UNPOWERED_ORB_ITEM_ID, quantity: 1 },
        { itemId: COSMIC_RUNE_ID, quantity: 3 },
        { itemId: FIRE_RUNE_ID, quantity: 30 },
    ],
    { x: 2819, y: 9828 },
);
castOnLoc(OBELISK_OF_FIRE_LOC_ID, CHARGE_FIRE_ORB_SPELL_ID, { x: 2819, y: 9828 });
runAction("skill.charge_orb", { recipeId: "charge_fire_orb", count: 1 });
assert.equal(countItem(FIRE_ORB_ITEM_ID), 1);
assert.deepEqual(xp, [73]);

resetState(
    66,
    [
        { itemId: UNPOWERED_ORB_ITEM_ID, quantity: 1 },
        { itemId: COSMIC_RUNE_ID, quantity: 3 },
        { itemId: AIR_RUNE_ID, quantity: 30 },
    ],
    { x: 3088, y: 3568 },
);
castOnLoc(OBELISK_OF_AIR_LOC_ID, CHARGE_AIR_ORB_SPELL_ID, { x: 3088, y: 3568 });
runAction("skill.charge_orb", { recipeId: "charge_air_orb", count: 1 });
assert.equal(countItem(AIR_ORB_ITEM_ID), 1);
assert.deepEqual(xp, [76]);

resetState(99, waterKit(), { x: 2844, y: 3422 });
const areaCast = beginChargeOrbCast(player, services, CHARGE_WATER_ORB_SPELL_ID, {}, 4);
assert.equal(areaCast.ok, true);
runAction("skill.charge_orb", { recipeId: "charge_water_orb", count: 1 });
assert.equal(countItem(WATER_ORB_ITEM_ID), 1);
assert.deepEqual(xp, [66]);

resetState(99, waterKit(), { x: 3200, y: 3200 });
const awayFromObelisk = beginChargeOrbCast(player, services, CHARGE_WATER_ORB_SPELL_ID, {}, 4);
assert.equal(awayFromObelisk.ok, false);
assert.equal(awayFromObelisk.silent, true);
assert.equal(actions.length, 0);
assert.equal(countItem(UNPOWERED_ORB_ITEM_ID), 1);

resetState(
    99,
    [
        { itemId: UNPOWERED_ORB_ITEM_ID, quantity: 2 },
        { itemId: COSMIC_RUNE_ID, quantity: 6 },
        { itemId: WATER_RUNE_ID, quantity: 60 },
    ],
    { x: 2844, y: 3422 },
);
castOnLoc(OBELISK_OF_WATER_LOC_ID, CHARGE_WATER_ORB_SPELL_ID, { x: 2844, y: 3422 });
runAction("skill.charge_orb", { recipeId: "charge_water_orb", count: 2 });
assert.equal(countItem(WATER_ORB_ITEM_ID), 1);
assert.equal(countItem(UNPOWERED_ORB_ITEM_ID), 1);
assert.equal(actions.some((action) => action.kind === "skill.charge_orb"), true);

console.log("magic-charge-orb.test.ts: all assertions passed");
