import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import type { PlayerState } from "../../../../src/game/player";
import {
    ANY_LOC_ID,
    type IScriptRegistry,
    type ItemOnLocEvent,
    type LocInteractionEvent,
    type ScriptActionHandlerContext,
    type ScriptInventoryEntry,
    type ScriptServices,
} from "../../../../src/game/scripts/types";
import {
    type PotteryFireRecipe,
    POTTERY_FIRE_RECIPES,
    POTTERY_SHAPE_RECIPES,
    POTTER_WHEEL_LOC_IDS,
    POTTERY_OVEN_LOC_IDS,
    SOFT_CLAY_ITEM_ID,
    UNFIRED_POTTERY_ITEM_IDS,
    getPotteryFireRecipeById,
    getPotteryFireRecipeByUnfiredId,
    getPotteryShapeRecipeById,
    isPotterWheelLoc,
    isPotteryOvenLoc,
} from "./potteryData";

const MAX_BATCH = 28;
const SHAPE_GROUP = "skill.pottery_shape";
const FIRE_GROUP = "skill.pottery_fire";
const WHEEL_ACTIONS = ["form", "form-pottery", "use"];
const OVEN_ACTIONS = ["fire", "use"];

type InventoryEntry = ScriptInventoryEntry;

type ShapeActionData = {
    recipeId: string;
    count: number;
};

type FireActionData = {
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

function computeShapeBatch(entries: InventoryEntry[]): number {
    return Math.max(0, Math.min(MAX_BATCH, countItem(entries, SOFT_CLAY_ITEM_ID)));
}

function computeFireBatch(entries: InventoryEntry[], recipe: PotteryFireRecipe): number {
    return Math.max(0, Math.min(MAX_BATCH, countItem(entries, recipe.unfiredItemId)));
}

function enqueueRecipeAction(
    services: ScriptServices,
    player: PlayerState,
    kind: string,
    group: string,
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
            kind,
            data: { recipeId, count: Math.max(1, desiredCount) },
            delayTicks: delay,
            cooldownTicks: delay,
            groups: [group],
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

function placeProducts(
    services: ScriptServices,
    player: PlayerState,
    preferredSlot: number,
    itemId: number,
    quantity: number,
): number {
    let placed = 0;
    for (let i = 0; i < quantity; i++) {
        const ok =
            i === 0
                ? placeProduct(services, player, preferredSlot, itemId)
                : services.inventory.addItemToInventory(player, itemId, 1).added > 0;
        if (!ok) return placed;
        placed += 1;
    }
    return placed;
}

function consumePlaced(
    services: ScriptServices,
    player: PlayerState,
    itemId: number,
    quantity: number,
): void {
    for (let i = 0; i < quantity; i++) {
        consumeOne(services, player, itemId);
    }
}

function executeShapeAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as ShapeActionData;
    const recipe = getPotteryShapeRecipeById(data.recipeId);
    if (!recipe) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't shape that.")] };
    }

    const skill = services.skills.getSkill(player, SkillId.Crafting);
    if ((skill?.baseLevel ?? 1) < recipe.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need Crafting level ${recipe.level} to shape ${recipe.name}.`,
                ),
            ],
        };
    }

    const claySlot = consumeOne(services, player, SOFT_CLAY_ITEM_ID);
    if (claySlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more soft clay to keep shaping.")],
        };
    }

    const wanted = Math.max(1, recipe.unfiredQuantity);
    const placed = placeProducts(services, player, claySlot, recipe.unfiredItemId, wanted);
    if (placed < wanted) {
        consumePlaced(services, player, recipe.unfiredItemId, placed);
        restoreSlot(services, player, claySlot, SOFT_CLAY_ITEM_ID);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more inventory space to keep shaping.")],
        };
    }
    services.animation.playPlayerSeq(player, recipe.animation);
    services.skills.addSkillXp(player, SkillId.Crafting, recipe.xp);
    services.system.eventBus?.emit("item:craft", {
        playerId: player.id,
        itemId: recipe.unfiredItemId,
        count: wanted,
    });

    const effects: ActionEffect[] = [
        { type: "inventorySnapshot", playerId: player.id },
        buildMessageEffect(player, `You shape the soft clay into ${recipe.name}.`),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.pottery_shape",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [SHAPE_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop shaping because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: recipe.delayTicks,
        groups: [SHAPE_GROUP],
        effects,
    };
}

function executeFireAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as FireActionData;
    const recipe = getPotteryFireRecipeById(data.recipeId);
    if (!recipe) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't fire that.")] };
    }

    const unfiredSlot = consumeOne(services, player, recipe.unfiredItemId);
    if (unfiredSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more unfired pottery to keep firing.")],
        };
    }

    if (!placeProduct(services, player, unfiredSlot, recipe.productItemId)) {
        restoreSlot(services, player, unfiredSlot, recipe.unfiredItemId);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more inventory space to keep firing.")],
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
        buildMessageEffect(player, `You fire the clay into a ${recipe.name}.`),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.pottery_fire",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [FIRE_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop firing because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: recipe.delayTicks,
        groups: [FIRE_GROUP],
        effects,
    };
}

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.pottery_shape", executeShapeAction);
    registry.registerActionHandler("skill.pottery_fire", executeFireAction);

    const openShapeMenu = (player: PlayerState, tick: number | undefined) => {
        const inventory = services.inventory.getInventoryItems(player);
        const batch = computeShapeBatch(inventory);
        if (batch <= 0) {
            services.messaging.sendGameMessage(
                player,
                "You need soft clay to shape pottery.",
            );
            return;
        }

        const level = services.skills.getSkill(player, SkillId.Crafting)?.baseLevel ?? 1;
        const choices = POTTERY_SHAPE_RECIPES.map((recipe) => ({
            recipe,
            batch,
            levelMet: level >= recipe.level,
        })).filter((choice) => choice.batch > 0);

        const craftable = choices.filter((choice) => choice.levelMet);
        if (craftable.length === 0) {
            const lowest = choices.reduce((prev, curr) =>
                curr.recipe.level < prev.recipe.level ? curr : prev,
            );
            services.messaging.sendGameMessage(
                player,
                `You need Crafting level ${lowest.recipe.level} to shape ${lowest.recipe.name}.`,
            );
            return;
        }

        services.dialog.openSkillMulti(player, {
            id: `pottery_shape_skillmulti_${player.id}`,
            title: "How many would you like to shape?",
            products: craftable.map((choice) => ({
                itemId: choice.recipe.unfiredItemId,
                label: choice.recipe.name,
                maxQuantity: choice.batch,
            })),
            maxQuantity: batch,
            defaultQuantity: 1,
            onSelect: (index, quantity) => {
                const selected = craftable[index];
                if (!selected) {
                    services.messaging.sendGameMessage(player, "You decide not to shape anything.");
                    return;
                }
                const desired = Math.max(1, Math.min(selected.batch, quantity | 0));
                const ok = enqueueRecipeAction(
                    services,
                    player,
                    "skill.pottery_shape",
                    SHAPE_GROUP,
                    selected.recipe.id,
                    desired,
                    selected.recipe.delayTicks,
                    tick,
                );
                if (!ok) {
                    services.messaging.sendGameMessage(
                        player,
                        "You're too busy to shape anything right now.",
                    );
                }
            },
        });
    };

    const openFireMenu = (
        player: PlayerState,
        tick: number | undefined,
        filter: (recipe: PotteryFireRecipe) => boolean,
    ) => {
        const inventory = services.inventory.getInventoryItems(player);
        const choices = POTTERY_FIRE_RECIPES.filter(filter)
            .map((recipe) => ({ recipe, batch: computeFireBatch(inventory, recipe) }))
            .filter((choice) => choice.batch > 0);

        if (choices.length === 0) {
            services.messaging.sendGameMessage(
                player,
                "You need unfired pottery to use the oven.",
            );
            return;
        }

        const maxQuantity = Math.max(...choices.map((choice) => choice.batch));
        services.dialog.openSkillMulti(player, {
            id: `pottery_fire_skillmulti_${player.id}`,
            title: "How many would you like to fire?",
            products: choices.map((choice) => ({
                itemId: choice.recipe.productItemId,
                label: choice.recipe.name,
                maxQuantity: choice.batch,
            })),
            maxQuantity,
            defaultQuantity: 1,
            onSelect: (index, quantity) => {
                const selected = choices[index];
                if (!selected) {
                    services.messaging.sendGameMessage(player, "You decide not to fire anything.");
                    return;
                }
                const desired = Math.max(1, Math.min(selected.batch, quantity | 0));
                const ok = enqueueRecipeAction(
                    services,
                    player,
                    "skill.pottery_fire",
                    FIRE_GROUP,
                    selected.recipe.id,
                    desired,
                    selected.recipe.delayTicks,
                    tick,
                );
                if (!ok) {
                    services.messaging.sendGameMessage(
                        player,
                        "You're too busy to fire anything right now.",
                    );
                }
            },
        });
    };

    const handleWheel = (player: PlayerState, locId: number, tick: number | undefined) => {
        const locDef = services.data.getLocDefinition(locId);
        if (!isPotterWheelLoc(locId, locDef)) return;
        openShapeMenu(player, tick);
    };

    const handleOven = (
        player: PlayerState,
        locId: number,
        tick: number | undefined,
        usedItemId?: number,
    ) => {
        const locDef = services.data.getLocDefinition(locId);
        if (!isPotteryOvenLoc(locId, locDef)) return;
        if (usedItemId !== undefined) {
            if (!getPotteryFireRecipeByUnfiredId(usedItemId)) return;
            openFireMenu(player, tick, (row) => row.unfiredItemId === usedItemId);
            return;
        }
        openFireMenu(player, tick, () => true);
    };

    const wheelLocHandler = (event: LocInteractionEvent) => {
        handleWheel(event.player, event.locId, event.tick);
    };

    const ovenLocHandler = (event: LocInteractionEvent) => {
        handleOven(event.player, event.locId, event.tick);
    };

    for (const locId of POTTER_WHEEL_LOC_IDS) {
        for (const action of WHEEL_ACTIONS) {
            registry.registerLocInteraction(locId, wheelLocHandler, action);
        }
        registry.registerLocInteraction(locId, wheelLocHandler);
        registry.registerItemOnLoc(SOFT_CLAY_ITEM_ID, locId, (event: ItemOnLocEvent) => {
            handleWheel(event.player, event.target.locId, event.tick);
        });
    }
    registry.registerItemOnLoc(SOFT_CLAY_ITEM_ID, ANY_LOC_ID, (event: ItemOnLocEvent) => {
        handleWheel(event.player, event.target.locId, event.tick);
    });

    for (const locId of POTTERY_OVEN_LOC_IDS) {
        for (const action of OVEN_ACTIONS) {
            registry.registerLocInteraction(locId, ovenLocHandler, action);
        }
        registry.registerLocInteraction(locId, ovenLocHandler);
        for (const itemId of UNFIRED_POTTERY_ITEM_IDS) {
            registry.registerItemOnLoc(itemId, locId, (event: ItemOnLocEvent) => {
                handleOven(event.player, event.target.locId, event.tick, event.source.itemId);
            });
        }
    }
    for (const itemId of UNFIRED_POTTERY_ITEM_IDS) {
        registry.registerItemOnLoc(itemId, ANY_LOC_ID, (event: ItemOnLocEvent) => {
            handleOven(event.player, event.target.locId, event.tick, event.source.itemId);
        });
    }
}

