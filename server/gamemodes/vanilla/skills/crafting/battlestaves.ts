import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    ScriptActionHandlerContext,
    ScriptInventoryEntry,
    ScriptServices,
} from "../../../../src/game/scripts/types";
import {
    BATTLESTAFF_ITEM_ID,
    type BattlestaffRecipe,
    CHARGED_ORB_ITEM_IDS,
    UNPOWERED_ORB_ITEM_ID,
    getBattlestaffRecipeById,
    getBattlestaffRecipeByOrbId,
} from "./battlestavesData";

const MAX_BATCH = 28;
const BATTLESTAFF_GROUP = "skill.battlestaff";

type InventoryEntry = ScriptInventoryEntry;

type BattlestaffActionData = {
    recipeId: string;
    count: number;
};

const countItem = (entries: InventoryEntry[], itemId: number): number => {
    let total = 0;
    for (const entry of entries) {
        if (entry.itemId === itemId) total += Math.max(0, entry.quantity);
    }
    return total;
};

function buildMessageEffect(player: PlayerState, message: string): ActionEffect {
    return { type: "message", playerId: player.id, message };
}

function computeBattlestaffBatch(entries: InventoryEntry[], recipe: BattlestaffRecipe): number {
    return Math.max(
        0,
        Math.min(
            MAX_BATCH,
            countItem(entries, BATTLESTAFF_ITEM_ID),
            countItem(entries, recipe.orbItemId),
        ),
    );
}

function enqueueRecipeAction(
    services: ScriptServices,
    player: PlayerState,
    recipeId: string,
    desiredCount: number,
    delayTicks: number,
    tick?: number,
): boolean {
    const delay = Math.max(1, delayTicks);
    const currentTick = Number.isFinite(tick) ? (tick as number) : services.system.getCurrentTick();
    const result = services.combat.requestAction(
        player,
        {
            kind: "skill.battlestaff",
            data: { recipeId, count: Math.max(1, desiredCount) },
            delayTicks: delay,
            cooldownTicks: delay,
            groups: [BATTLESTAFF_GROUP],
        },
        currentTick,
    );
    return result.ok;
}

function restoreSlot(
    services: ScriptServices,
    player: PlayerState,
    slot: number,
    itemId: number,
): void {
    const entry = services.inventory.getInventoryItems(player)[slot];
    if (!entry || entry.itemId <= 0 || entry.quantity <= 0) {
        services.inventory.setInventorySlot(player, slot, itemId, 1);
        return;
    }
    if (entry.itemId === itemId) {
        services.inventory.setInventorySlot(player, slot, itemId, entry.quantity + 1);
    }
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
    return services.inventory.addItemToInventory(player, itemId, 1).added > 0;
}

function executeBattlestaffAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as BattlestaffActionData;
    const recipe = getBattlestaffRecipeById(data.recipeId);
    if (!recipe) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't attach that.")] };
    }

    const skill = services.skills.getSkill(player, SkillId.Crafting);
    if ((skill?.baseLevel ?? 1) < recipe.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need Crafting level ${recipe.level} to make a ${recipe.name}.`,
                ),
            ],
        };
    }

    const staffSlot = consumeOne(services, player, BATTLESTAFF_ITEM_ID);
    if (staffSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need a battlestaff to attach that orb.")],
        };
    }

    const orbSlot = consumeOne(services, player, recipe.orbItemId);
    if (orbSlot === undefined) {
        restoreSlot(services, player, staffSlot, BATTLESTAFF_ITEM_ID);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need a charged orb to make that.")],
        };
    }

    if (!placeProduct(services, player, staffSlot, recipe.productItemId)) {
        restoreSlot(services, player, staffSlot, BATTLESTAFF_ITEM_ID);
        restoreSlot(services, player, orbSlot, recipe.orbItemId);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more inventory space to keep crafting.")],
        };
    }
    services.animation.playPlayerSeq(player, recipe.animation);
    services.skills.addSkillXp(player, SkillId.Crafting, recipe.xp);
    services.system.eventBus?.emit("item:craft", {
        playerId: player.id,
        itemId: recipe.productItemId,
        count: 1,
    });

    const effects: ActionEffect[] = [
        { type: "inventorySnapshot", playerId: player.id },
        buildMessageEffect(player, `You attach the orb to the battlestaff.`),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.battlestaff",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [BATTLESTAFF_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop crafting because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: recipe.delayTicks,
        groups: [BATTLESTAFF_GROUP],
        effects,
    };
}

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.battlestaff", executeBattlestaffAction);

    const handleUnpoweredOrb = (event: ItemOnItemEvent) => {
        const otherId =
            event.source.itemId === UNPOWERED_ORB_ITEM_ID
                ? event.target.itemId
                : event.source.itemId;
        if (otherId !== BATTLESTAFF_ITEM_ID) return;
        services.messaging.sendGameMessage(
            event.player,
            "You need to charge this orb at an elemental obelisk first.",
        );
    };

    registry.registerItemOnItem(UNPOWERED_ORB_ITEM_ID, BATTLESTAFF_ITEM_ID, handleUnpoweredOrb);

    const handleChargedOrb = (event: ItemOnItemEvent) => {
        const otherId =
            event.source.itemId === BATTLESTAFF_ITEM_ID ? event.target.itemId : event.source.itemId;
        const recipe = getBattlestaffRecipeByOrbId(otherId);
        if (!recipe) return;

        const inventory = services.inventory.getInventoryItems(event.player);
        const batch = computeBattlestaffBatch(inventory, recipe);
        if (batch <= 0) {
            services.messaging.sendGameMessage(
                event.player,
                "You need a battlestaff and a charged orb to attach that.",
            );
            return;
        }

        const level = services.skills.getSkill(event.player, SkillId.Crafting)?.baseLevel ?? 1;
        if (level < recipe.level) {
            services.messaging.sendGameMessage(
                event.player,
                `You need Crafting level ${recipe.level} to make a ${recipe.name}.`,
            );
            return;
        }

        services.dialog.openSkillMulti(event.player, {
            id: `battlestaff_skillmulti_${event.player.id}`,
            title: "How many would you like to make?",
            products: [{ itemId: recipe.productItemId, label: recipe.name, maxQuantity: batch }],
            maxQuantity: batch,
            defaultQuantity: 1,
            onSelect: (_index, quantity) => {
                const desired = Math.max(1, Math.min(batch, quantity | 0));
                const ok = enqueueRecipeAction(
                    services,
                    event.player,
                    recipe.id,
                    desired,
                    recipe.delayTicks,
                    event.tick,
                );
                if (!ok) {
                    services.messaging.sendGameMessage(
                        event.player,
                        "You're too busy to craft anything right now.",
                    );
                }
            },
        });
    };

    for (const orbId of CHARGED_ORB_ITEM_IDS) {
        registry.registerItemOnItem(orbId, BATTLESTAFF_ITEM_ID, handleChargedOrb);
    }
}
