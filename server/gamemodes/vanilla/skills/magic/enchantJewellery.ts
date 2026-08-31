import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    InvSpellEvent,
    ScriptActionHandlerContext,
    ScriptInventoryEntry,
    ScriptServices,
} from "../../../../src/game/scripts/types";
import {
    type EnchantJewelleryRecipe,
    type EnchantJewellerySpell,
    getEnchantJewelleryRecipe,
    getEnchantJewelleryRecipeById,
    getEnchantJewellerySpell,
    getEnchantJewellerySpellIds,
} from "./enchantJewelleryData";

const ENCHANT_JEWELLERY_GROUP = "skill.enchant_jewellery";
const MAX_BATCH = 28;

type InventoryEntry = ScriptInventoryEntry;

type EnchantJewelleryActionData = {
    recipeId: string;
    count: number;
    preferredSlot?: number;
};

export type EnchantJewelleryCastOpts = {
    slot?: number;
    itemId?: number;
};

export type EnchantJewelleryCastResult = {
    ok: boolean;
    reason?: string;
    silent?: boolean;
};

function buildMessageEffect(player: PlayerState, message: string): ActionEffect {
    return { type: "message", playerId: player.id, message };
}

function countItem(entries: InventoryEntry[], itemId: number): number {
    let total = 0;
    for (const entry of entries) {
        if (entry.itemId === itemId) total += Math.max(0, entry.quantity);
    }
    return total;
}

function magicLevel(player: PlayerState, services: ScriptServices): number {
    const skill = services.skills.getSkill(player, SkillId.Magic);
    return Math.max(1, (skill?.baseLevel ?? 1) + (skill?.boost ?? 0));
}

function consumeQuantity(
    services: ScriptServices,
    player: PlayerState,
    itemId: number,
    quantity: number,
): boolean {
    if (!(itemId > 0) || !(quantity > 0)) return true;
    let remaining = quantity;
    const inventory = services.inventory.getInventoryItems(player);
    for (const entry of inventory) {
        if (remaining <= 0) break;
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const take = Math.min(remaining, entry.quantity);
        const nextQty = entry.quantity - take;
        if (nextQty > 0) {
            services.inventory.setInventorySlot(player, entry.slot, itemId, nextQty);
        } else {
            services.inventory.setInventorySlot(player, entry.slot, -1, 0);
        }
        remaining -= take;
    }
    return remaining <= 0;
}

function restoreQuantity(
    services: ScriptServices,
    player: PlayerState,
    itemId: number,
    quantity: number,
): void {
    if (!(itemId > 0) || !(quantity > 0)) return;
    services.inventory.addItemToInventory(player, itemId, quantity);
}

function consumeOneAt(
    services: ScriptServices,
    player: PlayerState,
    itemId: number,
    preferredSlot?: number,
): number | undefined {
    if (preferredSlot !== undefined) {
        const entry = slotEntry(services, player, preferredSlot);
        if (entry && entry.itemId === itemId && entry.quantity > 0) {
            if (!services.inventory.consumeItem(player, preferredSlot)) return undefined;
            return preferredSlot;
        }
    }
    const slot = services.inventory.findInventorySlotWithItem(player, itemId);
    if (slot === undefined || !services.inventory.consumeItem(player, slot)) return undefined;
    return slot;
}

function slotEntry(
    services: ScriptServices,
    player: PlayerState,
    slot: number,
): ScriptInventoryEntry | undefined {
    const entries = services.inventory.getInventoryItems(player);
    return entries.find((entry) => entry.slot === slot) ?? entries[slot];
}

function placeProduct(
    services: ScriptServices,
    player: PlayerState,
    preferredSlot: number,
    itemId: number,
): boolean {
    const entry = slotEntry(services, player, preferredSlot);
    if (!entry || entry.itemId <= 0 || entry.quantity <= 0) {
        services.inventory.setInventorySlot(player, preferredSlot, itemId, 1);
        return true;
    }
    if (entry.itemId === itemId) {
        services.inventory.setInventorySlot(player, preferredSlot, itemId, entry.quantity + 1);
        return true;
    }
    return services.inventory.addItemToInventory(player, itemId, 1).added > 0;
}

function validateRunes(
    services: ScriptServices,
    player: PlayerState,
    spell: EnchantJewellerySpell,
): {
    canCast: boolean;
    runesConsumed: Array<{ runeId: number; quantity: number }>;
} {
    const costs = [...spell.runeCosts];
    const inventory = services.inventory.getInventoryItems(player).map((entry) => ({
        itemId: entry.itemId,
        quantity: entry.quantity,
    }));
    const equipped = (services.equipment?.getEquipArray?.(player) ?? []).filter((id) => id > 0);
    const result = services.combat.validateRunes?.(costs, inventory, equipped);
    if (result) {
        return {
            canCast: result.canCast === true,
            runesConsumed: Array.isArray(result.runesConsumed) ? result.runesConsumed : [],
        };
    }
    for (const cost of costs) {
        if (countItem(services.inventory.getInventoryItems(player), cost.runeId) < cost.quantity) {
            return { canCast: false, runesConsumed: [] };
        }
    }
    return { canCast: true, runesConsumed: costs };
}

function failureMessage(reason: string, spell?: EnchantJewellerySpell): string | undefined {
    switch (reason) {
        case "enchant_invalid_item":
            return "This spell cannot be used on this item.";
        case "level_requirement":
            return `You need a Magic level of ${spell?.level ?? 1} to cast this spell.`;
        case "out_of_runes":
            return "You do not have enough runes to cast this spell.";
        default:
            return undefined;
    }
}

function sendFailure(
    services: ScriptServices,
    player: PlayerState,
    reason: string,
    spell?: EnchantJewellerySpell,
): EnchantJewelleryCastResult {
    const text = failureMessage(reason, spell);
    if (text) services.messaging.sendGameMessage(player, text);
    return { ok: false, reason };
}

function enqueueEnchant(
    services: ScriptServices,
    player: PlayerState,
    recipe: EnchantJewelleryRecipe,
    spell: EnchantJewellerySpell,
    count: number,
    preferredSlot: number | undefined,
    tick?: number,
): boolean {
    const delay = Math.max(1, spell.delayTicks);
    const currentTick = Number.isFinite(tick) ? (tick as number) : services.system.getCurrentTick();
    const requestAction = services.combat.requestAction;
    if (!requestAction) return false;
    const result = requestAction(
        player,
        {
            kind: "skill.enchant_jewellery",
            data: {
                recipeId: recipe.id,
                count: Math.max(1, count),
                preferredSlot,
            } satisfies EnchantJewelleryActionData,
            delayTicks: delay,
            cooldownTicks: delay,
            groups: [ENCHANT_JEWELLERY_GROUP],
        },
        currentTick,
    );
    return result.ok;
}

export function beginEnchantJewelleryCast(
    player: PlayerState,
    services: ScriptServices,
    spellId: number,
    opts: EnchantJewelleryCastOpts = {},
    tick?: number,
): EnchantJewelleryCastResult {
    const spell = getEnchantJewellerySpell(spellId);
    if (!spell) return { ok: false, reason: "invalid_spell", silent: true };

    const itemId = opts.itemId;
    if (!(typeof itemId === "number") || !(itemId > 0)) {
        return sendFailure(services, player, "enchant_invalid_item", spell);
    }

    const recipe = getEnchantJewelleryRecipe(spellId, itemId);
    if (!recipe) {
        return sendFailure(services, player, "enchant_invalid_item", spell);
    }

    if (magicLevel(player, services) < spell.level) {
        return sendFailure(services, player, "level_requirement", spell);
    }

    const inventory = services.inventory.getInventoryItems(player);
    if (countItem(inventory, recipe.sourceItemId) < 1) {
        return sendFailure(services, player, "enchant_invalid_item", spell);
    }

    const runes = validateRunes(services, player, spell);
    if (!runes.canCast) {
        return sendFailure(services, player, "out_of_runes", spell);
    }

    const jewelleryCount = countItem(inventory, recipe.sourceItemId);
    if (
        !enqueueEnchant(
            services,
            player,
            recipe,
            spell,
            Math.min(MAX_BATCH, jewelleryCount),
            opts.slot,
            tick,
        )
    ) {
        services.messaging.sendGameMessage(player, "You can't cast that yet.");
        return { ok: false, reason: "cooldown" };
    }
    return { ok: true };
}

function handleInvSpell(event: InvSpellEvent): void {
    const result = beginEnchantJewelleryCast(
        event.player,
        event.services,
        event.spellId,
        { slot: event.slot, itemId: event.itemId },
        event.tick,
    );
    if (!event.spellResult) return;
    event.spellResult.outcome = result.ok ? "success" : "failure";
    event.spellResult.reason = result.ok ? undefined : result.reason;
}

function executeEnchantJewelleryAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as EnchantJewelleryActionData;
    const recipe = getEnchantJewelleryRecipeById(data.recipeId);
    const spell = recipe ? getEnchantJewellerySpell(recipe.spellId) : undefined;
    if (!recipe || !spell) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't enchant that.")] };
    }

    if (magicLevel(player, services) < spell.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need a Magic level of ${spell.level} to cast this spell.`,
                ),
            ],
        };
    }

    const runes = validateRunes(services, player, spell);
    if (!runes.canCast) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(player, "You do not have enough runes to cast this spell."),
            ],
        };
    }

    const sourceSlot = consumeOneAt(services, player, recipe.sourceItemId, data.preferredSlot);
    if (sourceSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "This spell cannot be used on this item.")],
        };
    }

    const consumed: Array<{ runeId: number; quantity: number }> = [];
    for (const rune of runes.runesConsumed) {
        if (!consumeQuantity(services, player, rune.runeId, rune.quantity)) {
            restoreQuantity(services, player, recipe.sourceItemId, 1);
            for (const done of consumed) {
                restoreQuantity(services, player, done.runeId, done.quantity);
            }
            return {
                ok: true,
                effects: [
                    buildMessageEffect(player, "You do not have enough runes to cast this spell."),
                ],
            };
        }
        consumed.push(rune);
    }

    if (!placeProduct(services, player, sourceSlot, recipe.productItemId)) {
        restoreQuantity(services, player, recipe.sourceItemId, 1);
        for (const done of consumed) {
            restoreQuantity(services, player, done.runeId, done.quantity);
        }
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You don't have enough inventory space.")],
        };
    }

    services.animation.playPlayerSeq(player, spell.animation);
    services.animation.broadcastPlayerSpot?.(player, spell.castSpotAnim, 100, 0);
    services.sound.playAreaSound?.({
        soundId: spell.castSoundId,
        tile: { x: player.tileX ?? 0, y: player.tileY ?? 0 },
        level: player.level ?? 0,
        radius: 5,
    });
    services.skills.addSkillXp(player, SkillId.Magic, spell.xp);

    const effects: ActionEffect[] = [
        { type: "inventorySnapshot", playerId: player.id },
        buildMessageEffect(player, `You enchant the ${recipe.name}.`),
    ];

    const remainingJewellery = countItem(
        services.inventory.getInventoryItems(player),
        recipe.sourceItemId,
    );
    const remaining = Math.min(
        MAX_BATCH,
        remainingJewellery,
        Math.max(0, Math.max(1, data.count) - 1),
    );
    const moreRunes = remaining > 0 ? validateRunes(services, player, spell) : { canCast: false };
    if (remaining > 0 && moreRunes.canCast) {
        const reschedule = services.combat.scheduleAction?.(
            player.id,
            {
                kind: "skill.enchant_jewellery",
                data: {
                    recipeId: recipe.id,
                    count: remaining,
                } satisfies EnchantJewelleryActionData,
                delayTicks: spell.delayTicks,
                cooldownTicks: spell.delayTicks,
                groups: [ENCHANT_JEWELLERY_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop enchanting because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: spell.delayTicks,
        groups: [ENCHANT_JEWELLERY_GROUP],
        effects,
    };
}

export function register(registry: IScriptRegistry, _services: ScriptServices): void {
    registry.registerActionHandler("skill.enchant_jewellery", executeEnchantJewelleryAction);
    for (const spellId of getEnchantJewellerySpellIds()) {
        registry.registerSpellOnItem(spellId, handleInvSpell);
    }
}
