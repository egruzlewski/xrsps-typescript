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
    type AlchemyItemDef,
    type AlchemySpell,
    COINS_ITEM_ID,
    canAlchemiseItem,
    getAlchCoins,
    getAlchemySpell,
    getAlchemySpellIds,
} from "./alchemyData";

const ALCHEMY_GROUP = "skill.alchemy";

type InventoryEntry = ScriptInventoryEntry;

type AlchemyActionData = {
    spellId: number;
    itemId: number;
    preferredSlot?: number;
};

export type AlchemyCastOpts = {
    slot?: number;
    itemId?: number;
};

export type AlchemyCastResult = {
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

function lookupItemDef(services: ScriptServices, itemId: number): AlchemyItemDef | undefined {
    return services.data?.getItemDefinition?.(itemId);
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

function validateRunes(
    services: ScriptServices,
    player: PlayerState,
    spell: AlchemySpell,
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

function failureMessage(reason: string, spell?: AlchemySpell): string | undefined {
    switch (reason) {
        case "alch_coins":
            return "Coins are already made of gold.";
        case "alch_invalid_item":
            return "You cannot alchemise this item.";
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
    spell?: AlchemySpell,
): AlchemyCastResult {
    const text = failureMessage(reason, spell);
    if (text) services.messaging.sendGameMessage(player, text);
    return { ok: false, reason };
}

function enqueueAlchemy(
    services: ScriptServices,
    player: PlayerState,
    spell: AlchemySpell,
    itemId: number,
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
            kind: ALCHEMY_GROUP,
            data: {
                spellId: spell.spellId,
                itemId,
                preferredSlot,
            } satisfies AlchemyActionData,
            delayTicks: delay,
            cooldownTicks: delay,
            groups: [ALCHEMY_GROUP],
        },
        currentTick,
    );
    return result.ok;
}

export function beginAlchemyCast(
    player: PlayerState,
    services: ScriptServices,
    spellId: number,
    opts: AlchemyCastOpts = {},
    tick?: number,
): AlchemyCastResult {
    const spell = getAlchemySpell(spellId);
    if (!spell) return { ok: false, reason: "invalid_spell", silent: true };

    const itemId = opts.itemId;
    if (!(typeof itemId === "number") || !(itemId > 0)) {
        return sendFailure(services, player, "alch_invalid_item", spell);
    }

    const allowed = canAlchemiseItem(itemId, lookupItemDef(services, itemId));
    if (!allowed.ok) {
        return sendFailure(services, player, allowed.reason, spell);
    }

    if (magicLevel(player, services) < spell.level) {
        return sendFailure(services, player, "level_requirement", spell);
    }

    const runes = validateRunes(services, player, spell);
    if (!runes.canCast) {
        return sendFailure(services, player, "out_of_runes", spell);
    }

    if (!enqueueAlchemy(services, player, spell, itemId, opts.slot, tick)) {
        services.messaging.sendGameMessage(player, "You can't cast that yet.");
        return { ok: false, reason: "cooldown" };
    }
    return { ok: true };
}

function handleInvSpell(event: InvSpellEvent): void {
    const result = beginAlchemyCast(
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

function executeAlchemyAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, services } = ctx;
    const data = ctx.data as AlchemyActionData;
    const spell = getAlchemySpell(data.spellId);
    if (!spell) {
        return { ok: true, effects: [buildMessageEffect(player, "You cannot alchemise this item.")] };
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

    const def = lookupItemDef(services, data.itemId);
    const allowed = canAlchemiseItem(data.itemId, def);
    if (!allowed.ok || !def) {
        const text = failureMessage(allowed.ok ? "alch_invalid_item" : allowed.reason, spell);
        return {
            ok: true,
            effects: [buildMessageEffect(player, text ?? "You cannot alchemise this item.")],
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

    const consumedSlot = consumeOneAt(services, player, data.itemId, data.preferredSlot);
    if (consumedSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You cannot alchemise this item.")],
        };
    }

    const consumedRunes: Array<{ runeId: number; quantity: number }> = [];
    for (const rune of runes.runesConsumed) {
        if (!consumeQuantity(services, player, rune.runeId, rune.quantity)) {
            restoreQuantity(services, player, data.itemId, 1);
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

    const coins = getAlchCoins(def, spell.high);
    if (coins > 0) {
        const added = services.inventory.addItemToInventory(player, COINS_ITEM_ID, coins);
        if (added.added < coins) {
            restoreQuantity(services, player, data.itemId, 1);
            for (const done of consumedRunes) {
                restoreQuantity(services, player, done.runeId, done.quantity);
            }
            return {
                ok: true,
                effects: [buildMessageEffect(player, "You don't have enough inventory space.")],
            };
        }
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

    return {
        ok: true,
        cooldownTicks: spell.delayTicks,
        groups: [ALCHEMY_GROUP],
        effects: [{ type: "inventorySnapshot", playerId: player.id }],
    };
}

export function register(registry: IScriptRegistry, _services: ScriptServices): void {
    registry.registerActionHandler(ALCHEMY_GROUP, executeAlchemyAction);
    for (const spellId of getAlchemySpellIds()) {
        registry.registerSpellOnItem(spellId, handleInvSpell);
    }
}
