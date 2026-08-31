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
    LEATHER_HIDE_ITEM_IDS,
    type LeatherRecipe,
    NEEDLE_ITEM_ID,
    THREAD_ITEM_ID,
    THREAD_USES_PER_SPOOL,
    getLeatherRecipeById,
    getLeatherRecipesForHide,
} from "./leatherData";

const MAX_BATCH = 28;
const LEATHER_GROUP = "skill.leather";

type InventoryEntry = ScriptInventoryEntry;

type LeatherActionData = {
    recipeId: string;
    count: number;
    craftsDone: number;
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

function computeLeatherBatch(entries: InventoryEntry[], recipe: LeatherRecipe): number {
    const hides = countItem(entries, recipe.hideItemId);
    const thread = countItem(entries, THREAD_ITEM_ID);
    const needle = countItem(entries, NEEDLE_ITEM_ID);
    if (needle <= 0 || thread <= 0) return 0;
    const fromHides = Math.floor(hides / Math.max(1, recipe.hideQuantity));
    const fromThread = thread * THREAD_USES_PER_SPOOL;
    return Math.max(0, Math.min(MAX_BATCH, fromHides, fromThread));
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

function executeLeatherAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as LeatherActionData;
    const recipe = getLeatherRecipeById(data.recipeId);
    if (!recipe) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't craft that.")] };
    }

    const skill = services.skills.getSkill(player, SkillId.Crafting);
    if ((skill?.baseLevel ?? 1) < recipe.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need Crafting level ${recipe.level} to make ${recipe.name}.`,
                ),
            ],
        };
    }

    if (!services.inventory.playerHasItem(player, NEEDLE_ITEM_ID)) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need a needle to craft leather.")],
        };
    }

    const craftsDone = Math.max(0, data.craftsDone ?? 0);
    const needsThread = craftsDone % THREAD_USES_PER_SPOOL === 0;
    let threadSlot: number | undefined;
    if (needsThread) {
        threadSlot = consumeOne(services, player, THREAD_ITEM_ID);
        if (threadSlot === undefined) {
            return {
                ok: true,
                effects: [buildMessageEffect(player, "You need some thread to keep crafting.")],
            };
        }
    }

    const hideSlots: number[] = [];
    const requiredHides = Math.max(1, recipe.hideQuantity);
    for (let i = 0; i < requiredHides; i++) {
        const slot = consumeOne(services, player, recipe.hideItemId);
        if (slot === undefined) {
            for (const hideSlot of hideSlots) {
                restoreSlot(services, player, hideSlot, recipe.hideItemId);
            }
            if (threadSlot !== undefined) restoreSlot(services, player, threadSlot, THREAD_ITEM_ID);
            return {
                ok: true,
                effects: [buildMessageEffect(player, "You need more leather to keep crafting.")],
            };
        }
        hideSlots.push(slot);
    }

    const productSlot = hideSlots[0];
    if (!placeProduct(services, player, productSlot, recipe.productItemId)) {
        for (const hideSlot of hideSlots) {
            restoreSlot(services, player, hideSlot, recipe.hideItemId);
        }
        if (threadSlot !== undefined) restoreSlot(services, player, threadSlot, THREAD_ITEM_ID);
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
        buildMessageEffect(player, `You make ${recipe.name}.`),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.leather",
                data: { recipeId: recipe.id, count: remaining, craftsDone: craftsDone + 1 },
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [LEATHER_GROUP],
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
        groups: [LEATHER_GROUP],
        effects,
    };
}

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.leather", executeLeatherAction);

    const handleNeedleOnHide = (event: ItemOnItemEvent) => {
        const hideId =
            event.source.itemId === NEEDLE_ITEM_ID ? event.target.itemId : event.source.itemId;
        const products = getLeatherRecipesForHide(hideId);
        if (products.length === 0) return;

        const inventory = services.inventory.getInventoryItems(event.player);
        if (countItem(inventory, NEEDLE_ITEM_ID) <= 0) {
            services.messaging.sendGameMessage(event.player, "You need a needle to craft leather.");
            return;
        }
        if (countItem(inventory, THREAD_ITEM_ID) <= 0) {
            services.messaging.sendGameMessage(
                event.player,
                "You need some thread to craft leather.",
            );
            return;
        }

        const level = services.skills.getSkill(event.player, SkillId.Crafting)?.baseLevel ?? 1;
        const choices = products
            .map((recipe) => {
                const batch = computeLeatherBatch(inventory, recipe);
                return { recipe, batch, levelMet: level >= recipe.level };
            })
            .filter((choice) => choice.batch > 0);

        if (choices.length === 0) {
            services.messaging.sendGameMessage(
                event.player,
                "You need more leather to craft that.",
            );
            return;
        }

        const craftable = choices.filter((choice) => choice.levelMet);
        if (craftable.length === 0) {
            const lowest = choices.reduce((prev, curr) =>
                curr.recipe.level < prev.recipe.level ? curr : prev,
            );
            services.messaging.sendGameMessage(
                event.player,
                `You need Crafting level ${lowest.recipe.level} to make ${lowest.recipe.name}.`,
            );
            return;
        }

        const maxQuantity = Math.max(...craftable.map((choice) => choice.batch));
        services.dialog.openSkillMulti(event.player, {
            id: `leather_skillmulti_${event.player.id}`,
            title: "How many would you like to make?",
            products: craftable.map((choice) => ({
                itemId: choice.recipe.productItemId,
                label: choice.recipe.name,
                maxQuantity: choice.batch,
            })),
            maxQuantity,
            defaultQuantity: 1,
            onSelect: (index, quantity) => {
                const selected = craftable[index];
                if (!selected) {
                    services.messaging.sendGameMessage(
                        event.player,
                        "You decide not to craft anything.",
                    );
                    return;
                }
                const desired = Math.max(1, Math.min(selected.batch, quantity | 0));
                const delay = Math.max(1, selected.recipe.delayTicks);
                const result = services.combat.requestAction(
                    event.player,
                    {
                        kind: "skill.leather",
                        data: {
                            recipeId: selected.recipe.id,
                            count: desired,
                            craftsDone: 0,
                        },
                        delayTicks: delay,
                        cooldownTicks: delay,
                        groups: [LEATHER_GROUP],
                    },
                    event.tick,
                );
                if (!result.ok) {
                    services.messaging.sendGameMessage(
                        event.player,
                        "You're too busy to craft anything right now.",
                    );
                }
            },
        });
    };

    for (const hideId of LEATHER_HIDE_ITEM_IDS) {
        registry.registerItemOnItem(NEEDLE_ITEM_ID, hideId, handleNeedleOnHide);
    }
}
