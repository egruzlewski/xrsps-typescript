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
import { getSmeltingXpWithBonuses } from "../smithing/smithingBonuses";
import type { SmeltingRecipe } from "../smithing/smithingData";
import {
    SUPERHEAT_ITEM_SPELL_ID,
    type SuperheatItemSpell,
    getSuperheatItemSpell,
    getSuperheatRecipeById,
    getSuperheatRecipeForOre,
    isSuperheatOre,
    recipeHasAllInputs,
    recipeMissingCoal,
} from "./superheatItemData";

const SUPERHEAT_ITEM_GROUP = "skill.superheat_item";

type InventoryEntry = ScriptInventoryEntry;

type SuperheatItemActionData = {
    recipeId: string;
    oreItemId: number;
    preferredSlot?: number;
};

export type SuperheatItemCastOpts = {
    slot?: number;
    itemId?: number;
};

export type SuperheatItemCastResult = {
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

function smithingLevel(player: PlayerState, services: ScriptServices): number {
    const skill = services.skills.getSkill(player, SkillId.Smithing);
    return Math.max(1, skill?.baseLevel ?? 1);
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
    spell: SuperheatItemSpell,
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

function describeBar(recipe: SmeltingRecipe): string {
    return recipe.name.toLowerCase();
}

function failureMessage(
    reason: string,
    spell?: SuperheatItemSpell,
    recipe?: SmeltingRecipe,
): string | undefined {
    switch (reason) {
        case "superheat_invalid_item":
            return "You need to cast superheat item on ore.";
        case "level_requirement":
            return `You need a Magic level of ${spell?.level ?? 1} to cast this spell.`;
        case "smelt_level":
            return `You need a Smithing level of ${recipe?.level ?? 1} to smelt this.`;
        case "missing_coal":
            return "You need more coal to smelt that.";
        case "missing_ore":
            return "You need the right ores to smelt that.";
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
    spell?: SuperheatItemSpell,
    recipe?: SmeltingRecipe,
): SuperheatItemCastResult {
    const text = failureMessage(reason, spell, recipe);
    if (text) services.messaging.sendGameMessage(player, text);
    return { ok: false, reason };
}

function enqueueSuperheat(
    services: ScriptServices,
    player: PlayerState,
    recipe: SmeltingRecipe,
    spell: SuperheatItemSpell,
    oreItemId: number,
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
            kind: SUPERHEAT_ITEM_GROUP,
            data: {
                recipeId: recipe.id,
                oreItemId,
                preferredSlot,
            } satisfies SuperheatItemActionData,
            delayTicks: delay,
            cooldownTicks: delay,
            groups: [SUPERHEAT_ITEM_GROUP],
        },
        currentTick,
    );
    return result.ok;
}

export function beginSuperheatItemCast(
    player: PlayerState,
    services: ScriptServices,
    spellId: number,
    opts: SuperheatItemCastOpts = {},
    tick?: number,
): SuperheatItemCastResult {
    const spell = getSuperheatItemSpell(spellId);
    if (!spell) return { ok: false, reason: "invalid_spell", silent: true };

    const itemId = opts.itemId;
    if (!(typeof itemId === "number") || !(itemId > 0) || !isSuperheatOre(itemId)) {
        return sendFailure(services, player, "superheat_invalid_item", spell);
    }

    if (magicLevel(player, services) < spell.level) {
        return sendFailure(services, player, "level_requirement", spell);
    }

    const inventory = services.inventory.getInventoryItems(player);
    const recipe = getSuperheatRecipeForOre(itemId, inventory);
    if (!recipe) {
        return sendFailure(services, player, "superheat_invalid_item", spell);
    }

    if (smithingLevel(player, services) < recipe.level) {
        return sendFailure(services, player, "smelt_level", spell, recipe);
    }

    if (!recipeHasAllInputs(recipe, inventory)) {
        const reason = recipeMissingCoal(recipe, inventory) ? "missing_coal" : "missing_ore";
        return sendFailure(services, player, reason, spell, recipe);
    }

    const runes = validateRunes(services, player, spell);
    if (!runes.canCast) {
        return sendFailure(services, player, "out_of_runes", spell);
    }

    if (!enqueueSuperheat(services, player, recipe, spell, itemId, opts.slot, tick)) {
        services.messaging.sendGameMessage(player, "You can't cast that yet.");
        return { ok: false, reason: "cooldown" };
    }
    return { ok: true };
}

function handleInvSpell(event: InvSpellEvent): void {
    const result = beginSuperheatItemCast(
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

function consumeRecipeInputs(
    services: ScriptServices,
    player: PlayerState,
    recipe: SmeltingRecipe,
    oreItemId: number,
    preferredSlot?: number,
): { oreSlot: number } | undefined {
    const oreSlot = consumeOneAt(services, player, oreItemId, preferredSlot);
    if (oreSlot === undefined) return undefined;

    const restored: Array<{ itemId: number; quantity: number }> = [
        { itemId: oreItemId, quantity: 1 },
    ];
    for (const input of recipe.inputs) {
        const already = input.itemId === oreItemId ? 1 : 0;
        const remaining = input.quantity - already;
        if (remaining <= 0) continue;
        if (!consumeQuantity(services, player, input.itemId, remaining)) {
            for (const done of restored) {
                restoreQuantity(services, player, done.itemId, done.quantity);
            }
            return undefined;
        }
        restored.push({ itemId: input.itemId, quantity: remaining });
    }
    return { oreSlot };
}

function restoreRecipeInputs(
    services: ScriptServices,
    player: PlayerState,
    recipe: SmeltingRecipe,
): void {
    for (const input of recipe.inputs) {
        restoreQuantity(services, player, input.itemId, input.quantity);
    }
}

function executeSuperheatItemAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, services } = ctx;
    const data = ctx.data as SuperheatItemActionData;
    const recipe = getSuperheatRecipeById(data.recipeId);
    const spell = getSuperheatItemSpell(SUPERHEAT_ITEM_SPELL_ID);
    if (!recipe || !spell) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't superheat that.")] };
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

    if (smithingLevel(player, services) < recipe.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need a Smithing level of ${recipe.level} to smelt this.`,
                ),
            ],
        };
    }

    const inventory = services.inventory.getInventoryItems(player);
    if (!recipeHasAllInputs(recipe, inventory)) {
        const message = recipeMissingCoal(recipe, inventory)
            ? "You need more coal to smelt that."
            : "You need the right ores to smelt that.";
        return { ok: true, effects: [buildMessageEffect(player, message)] };
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

    const consumedInputs = consumeRecipeInputs(
        services,
        player,
        recipe,
        data.oreItemId,
        data.preferredSlot,
    );
    if (!consumedInputs) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need the right ores to smelt that.")],
        };
    }

    const consumedRunes: Array<{ runeId: number; quantity: number }> = [];
    for (const rune of runes.runesConsumed) {
        if (!consumeQuantity(services, player, rune.runeId, rune.quantity)) {
            restoreRecipeInputs(services, player, recipe);
            for (const done of consumedRunes) {
                restoreQuantity(services, player, done.runeId, done.quantity);
            }
            return {
                ok: true,
                effects: [
                    buildMessageEffect(player, "You do not have enough runes to cast this spell."),
                ],
            };
        }
        consumedRunes.push(rune);
    }

    if (!placeProduct(services, player, consumedInputs.oreSlot, recipe.outputItemId)) {
        restoreRecipeInputs(services, player, recipe);
        for (const done of consumedRunes) {
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
    const equip = services.equipment?.getEquipArray?.(player) ?? [];
    services.skills.addSkillXp(player, SkillId.Smithing, getSmeltingXpWithBonuses(recipe, equip));
    services.system.eventBus?.emit("item:craft", {
        playerId: player.id,
        itemId: recipe.outputItemId,
        count: Math.max(1, recipe.outputQuantity),
    });

    const barName = describeBar(recipe);
    return {
        ok: true,
        cooldownTicks: spell.delayTicks,
        groups: [SUPERHEAT_ITEM_GROUP],
        effects: [
            { type: "inventorySnapshot", playerId: player.id },
            buildMessageEffect(player, `You retrieve a ${barName}.`),
        ],
    };
}

export function register(registry: IScriptRegistry, _services: ScriptServices): void {
    registry.registerActionHandler(SUPERHEAT_ITEM_GROUP, executeSuperheatItemAction);
    registry.registerSpellOnItem(SUPERHEAT_ITEM_SPELL_ID, handleInvSpell);
}
