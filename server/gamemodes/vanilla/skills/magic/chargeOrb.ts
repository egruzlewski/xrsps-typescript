import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    ScriptActionHandlerContext,
    ScriptInventoryEntry,
    ScriptServices,
    WidgetActionEvent,
} from "../../../../src/game/scripts/types";
import { getSpellDataProvider } from "../../../../src/game/spells/SpellDataProvider";
import {
    CHARGE_ORB_ADJACENCY,
    CHARGE_ORB_DELAY_TICKS,
    CHARGE_ORB_RECIPES,
    type ChargeOrbRecipe,
    COSMIC_RUNE_ID,
    UNPOWERED_ORB_ITEM_ID,
    getChargeOrbRecipeByLocId,
    getChargeOrbRecipeBySpellId,
    isChargeOrbObeliskLoc,
    isPlayerInChargeOrbArea,
} from "./chargeOrbData";

const CHARGE_ORB_GROUP = "skill.charge_orb";
const SPELLBOOK_GROUP_ID = 218;
const MAX_BATCH = 28;

const CHARGE_ORB_RECIPES_BY_ID = new Map(CHARGE_ORB_RECIPES.map((recipe) => [recipe.id, recipe]));

type InventoryEntry = ScriptInventoryEntry;

type ChargeOrbActionData = {
    recipeId: string;
    count: number;
};

export type ChargeOrbCastOpts = {
    locId?: number;
    tile?: { x: number; y: number };
    level?: number;
};

export type ChargeOrbCastResult = {
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

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function isAdjacentToLoc(
    player: PlayerState,
    tile: { x: number; y: number },
    level: number,
): boolean {
    if ((player.level ?? 0) !== level) return false;
    return chebyshev(player.tileX, player.tileY, tile.x, tile.y) <= CHARGE_ORB_ADJACENCY;
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

function consumeOne(
    services: ScriptServices,
    player: PlayerState,
    itemId: number,
): number | undefined {
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

function runeCostsFor(recipe: ChargeOrbRecipe): Array<{ runeId: number; quantity: number }> {
    return [
        { runeId: COSMIC_RUNE_ID, quantity: recipe.cosmicRuneQty },
        { runeId: recipe.elementalRuneId, quantity: recipe.elementalRuneQty },
    ];
}

function validateRunes(
    services: ScriptServices,
    player: PlayerState,
    recipe: ChargeOrbRecipe,
): {
    canCast: boolean;
    runesConsumed: Array<{ runeId: number; quantity: number }>;
} {
    const costs = runeCostsFor(recipe);
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

function failureMessage(reason: string, recipe?: ChargeOrbRecipe): string | undefined {
    switch (reason) {
        case "charge_orb_wrong_obelisk":
            return "You can only charge this orb at the Obelisk of the correct element.";
        case "charge_orb_missing_orb":
            return "You need an unpowered orb to cast this spell.";
        case "level_requirement":
            return `You need a Magic level of ${recipe?.level ?? 1} to cast this spell.`;
        case "out_of_runes":
            return "You do not have enough runes to cast this spell.";
        case "out_of_range":
            return "You need to be closer to use that spell.";
        default:
            return undefined;
    }
}

function sendFailure(
    services: ScriptServices,
    player: PlayerState,
    reason: string,
    recipe?: ChargeOrbRecipe,
): ChargeOrbCastResult {
    const text = failureMessage(reason, recipe);
    if (text) services.messaging.sendGameMessage(player, text);
    return { ok: false, reason };
}

function resolveLocation(
    player: PlayerState,
    recipe: ChargeOrbRecipe,
    opts: ChargeOrbCastOpts,
): ChargeOrbCastResult {
    if (opts.locId !== undefined) {
        if (isChargeOrbObeliskLoc(opts.locId) && opts.locId !== recipe.locId) {
            return { ok: false, reason: "charge_orb_wrong_obelisk" };
        }
        if (opts.locId !== recipe.locId) {
            return { ok: false, reason: "invalid_target", silent: true };
        }
        const tile = opts.tile;
        const level = opts.level ?? player.level ?? 0;
        if (tile && !isAdjacentToLoc(player, tile, level)) {
            return { ok: false, reason: "out_of_range" };
        }
        return { ok: true };
    }
    if (isPlayerInChargeOrbArea(player.tileX ?? 0, player.tileY ?? 0, player.level ?? 0, recipe)) {
        return { ok: true };
    }
    return { ok: false, reason: "charge_orb_wrong_obelisk", silent: true };
}

function enqueueChargeOrb(
    services: ScriptServices,
    player: PlayerState,
    recipe: ChargeOrbRecipe,
    count: number,
    tick?: number,
): boolean {
    const delay = Math.max(1, recipe.delayTicks ?? CHARGE_ORB_DELAY_TICKS);
    const currentTick = Number.isFinite(tick) ? (tick as number) : services.system.getCurrentTick();
    const requestAction = services.combat.requestAction;
    if (!requestAction) return false;
    const result = requestAction(
        player,
        {
            kind: "skill.charge_orb",
            data: { recipeId: recipe.id, count: Math.max(1, count) } satisfies ChargeOrbActionData,
            delayTicks: delay,
            cooldownTicks: delay,
            groups: [CHARGE_ORB_GROUP],
        },
        currentTick,
    );
    return result.ok;
}

export function beginChargeOrbCast(
    player: PlayerState,
    services: ScriptServices,
    spellId: number,
    opts: ChargeOrbCastOpts = {},
    tick?: number,
): ChargeOrbCastResult {
    const recipe = getChargeOrbRecipeBySpellId(spellId);
    if (!recipe) return { ok: false, reason: "invalid_spell", silent: true };

    const location = resolveLocation(player, recipe, opts);
    if (!location.ok) {
        if (location.silent) return location;
        return sendFailure(services, player, location.reason ?? "invalid_target", recipe);
    }

    if (magicLevel(player, services) < recipe.level) {
        return sendFailure(services, player, "level_requirement", recipe);
    }

    const inventory = services.inventory.getInventoryItems(player);
    if (countItem(inventory, UNPOWERED_ORB_ITEM_ID) < 1) {
        return sendFailure(services, player, "charge_orb_missing_orb", recipe);
    }

    const runes = validateRunes(services, player, recipe);
    if (!runes.canCast) {
        return sendFailure(services, player, "out_of_runes", recipe);
    }

    const orbCount = countItem(inventory, UNPOWERED_ORB_ITEM_ID);
    if (!enqueueChargeOrb(services, player, recipe, Math.min(MAX_BATCH, orbCount), tick)) {
        services.messaging.sendGameMessage(player, "You can't cast that yet.");
        return { ok: false, reason: "cooldown" };
    }
    return { ok: true };
}

function applySpellResult(event: LocInteractionEvent, result: ChargeOrbCastResult): void {
    if (!event.spellResult) return;
    event.spellResult.outcome = result.ok ? "success" : "failure";
    event.spellResult.reason = result.ok ? undefined : result.reason;
}

function handleObeliskSpell(event: LocInteractionEvent): void {
    const locRecipe = getChargeOrbRecipeByLocId(event.locId);
    if (!locRecipe) return;

    const spellId = event.spellId;
    if (typeof spellId !== "number" || !(spellId > 0)) {
        const result = sendFailure(
            event.services,
            event.player,
            "charge_orb_wrong_obelisk",
            locRecipe,
        );
        applySpellResult(event, result);
        return;
    }

    const result = beginChargeOrbCast(
        event.player,
        event.services,
        spellId,
        { locId: event.locId, tile: event.tile, level: event.level },
        event.tick,
    );
    applySpellResult(event, result);
}

function handleSpellbookClick(event: WidgetActionEvent): void {
    if (event.groupId !== SPELLBOOK_GROUP_ID) return;
    if ((event.opId ?? 1) !== 1) return;

    const provider = getSpellDataProvider();
    if (!provider) return;
    const spellData = provider.getSpellDataByWidget(SPELLBOOK_GROUP_ID, event.childId);
    if (!spellData) return;
    if (!getChargeOrbRecipeBySpellId(spellData.id)) return;

    beginChargeOrbCast(event.player, event.services, spellData.id, {}, event.tick);
}

function executeChargeOrbAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as ChargeOrbActionData;
    const recipe = CHARGE_ORB_RECIPES_BY_ID.get(data.recipeId);
    if (!recipe) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't charge that.")] };
    }

    if (magicLevel(player, services) < recipe.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need a Magic level of ${recipe.level} to cast this spell.`,
                ),
            ],
        };
    }

    const runes = validateRunes(services, player, recipe);
    if (!runes.canCast) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(player, "You do not have enough runes to cast this spell."),
            ],
        };
    }

    const orbSlot = consumeOne(services, player, UNPOWERED_ORB_ITEM_ID);
    if (orbSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need an unpowered orb to cast this spell.")],
        };
    }

    const consumed: Array<{ runeId: number; quantity: number }> = [];
    for (const rune of runes.runesConsumed) {
        if (!consumeQuantity(services, player, rune.runeId, rune.quantity)) {
            restoreQuantity(services, player, UNPOWERED_ORB_ITEM_ID, 1);
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

    if (!placeProduct(services, player, orbSlot, recipe.chargedOrbItemId)) {
        restoreQuantity(services, player, UNPOWERED_ORB_ITEM_ID, 1);
        for (const done of consumed) {
            restoreQuantity(services, player, done.runeId, done.quantity);
        }
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You don't have enough inventory space.")],
        };
    }

    services.animation.playPlayerSeq(player, recipe.animation);
    services.animation.broadcastPlayerSpot?.(player, recipe.castSpotAnim, 100, 0);
    services.sound.playAreaSound?.({
        soundId: recipe.castSoundId,
        tile: { x: player.tileX ?? 0, y: player.tileY ?? 0 },
        level: player.level ?? 0,
        radius: 5,
    });
    services.skills.addSkillXp(player, SkillId.Magic, recipe.xp);

    const effects: ActionEffect[] = [
        { type: "inventorySnapshot", playerId: player.id },
        buildMessageEffect(player, "You charge the orb."),
    ];

    const remainingOrbs = countItem(
        services.inventory.getInventoryItems(player),
        UNPOWERED_ORB_ITEM_ID,
    );
    const remaining = Math.min(MAX_BATCH, remainingOrbs, Math.max(0, Math.max(1, data.count) - 1));
    const moreRunes = remaining > 0 ? validateRunes(services, player, recipe) : { canCast: false };
    if (remaining > 0 && moreRunes.canCast) {
        const reschedule = services.combat.scheduleAction?.(
            player.id,
            {
                kind: "skill.charge_orb",
                data: { recipeId: recipe.id, count: remaining } satisfies ChargeOrbActionData,
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [CHARGE_ORB_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop charging because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: recipe.delayTicks,
        groups: [CHARGE_ORB_GROUP],
        effects,
    };
}

export function register(registry: IScriptRegistry, _services: ScriptServices): void {
    registry.registerActionHandler("skill.charge_orb", executeChargeOrbAction);

    for (const recipe of CHARGE_ORB_RECIPES) {
        registry.registerLocInteraction(recipe.locId, handleObeliskSpell, "spell");
    }

    registry.registerWidgetAction({
        handler: handleSpellbookClick,
    });
}
