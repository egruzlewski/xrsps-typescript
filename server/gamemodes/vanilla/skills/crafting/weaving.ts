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
    LOOM_LOC_IDS,
    WEAVING_INPUT_ITEM_IDS,
    WEAVING_RECIPES,
    type WeavingRecipe,
    getWeavingRecipeById,
    getWeavingRecipesByInputItemId,
    isLoomLoc,
} from "./weavingData";

const MAX_BATCH = 28;
const WEAVE_GROUP = "skill.weave";
const LOOM_ACTIONS = ["weave", "use"];

type InventoryEntry = ScriptInventoryEntry;

type WeaveActionData = {
    recipeId: string;
    count: number;
};

type CraftableChoice = {
    recipe: WeavingRecipe;
    batch: number;
    levelMet: boolean;
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

function computeWeaveBatch(entries: InventoryEntry[], recipe: WeavingRecipe): number {
    const total = countItem(entries, recipe.inputItemId);
    const perWeave = Math.max(1, recipe.inputQuantity);
    if (!(total > 0 && perWeave > 0)) return 0;
    return Math.max(0, Math.min(MAX_BATCH, Math.floor(total / perWeave)));
}

function enqueueWeaveAction(
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
            kind: "skill.weave",
            data: { recipeId, count: Math.max(1, desiredCount) },
            delayTicks: delay,
            cooldownTicks: delay,
            groups: [WEAVE_GROUP],
        },
        currentTick,
    );
    return result.ok;
}

function restoreConsumed(
    services: ScriptServices,
    player: PlayerState,
    itemId: number,
    removed: Map<number, number>,
): void {
    for (const [slot, qty] of removed) {
        const entries = services.inventory.getInventoryItems(player);
        const entry = entries.find((row) => row.slot === slot) ?? entries[slot];
        if (!entry || entry.itemId <= 0 || entry.quantity <= 0) {
            services.inventory.setInventorySlot(player, slot, itemId, qty);
            continue;
        }
        if (entry.itemId === itemId) {
            services.inventory.setInventorySlot(player, slot, itemId, entry.quantity + qty);
        }
    }
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
    quantity: number,
): boolean {
    const entry = slotEntry(services, player, preferredSlot);
    if (!entry || entry.itemId <= 0 || entry.quantity <= 0) {
        services.inventory.setInventorySlot(player, preferredSlot, itemId, quantity);
        return true;
    }
    return services.inventory.addItemToInventory(player, itemId, quantity).added > 0;
}

function executeWeaveAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as WeaveActionData;
    const recipe = getWeavingRecipeById(data.recipeId);
    if (!recipe) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't weave that.")] };
    }

    const skill = services.skills.getSkill(player, SkillId.Crafting);
    if ((skill?.baseLevel ?? 1) < recipe.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need Crafting level ${recipe.level} to weave ${recipe.name}.`,
                ),
            ],
        };
    }

    const requiredPerWeave = Math.max(1, recipe.inputQuantity);
    const removed = new Map<number, number>();
    for (let i = 0; i < requiredPerWeave; i++) {
        const slot = services.inventory.findInventorySlotWithItem(player, recipe.inputItemId);
        if (slot === undefined || !services.inventory.consumeItem(player, slot)) {
            restoreConsumed(services, player, recipe.inputItemId, removed);
            return {
                ok: true,
                effects: [
                    buildMessageEffect(
                        player,
                        `You need more ${recipe.inputName} to keep weaving.`,
                    ),
                ],
            };
        }
        removed.set(slot, (removed.get(slot) ?? 0) + 1);
    }

    const productQuantity = Math.max(1, recipe.outputQuantity);
    const firstSlot = removed.keys().next()?.value;
    const placed =
        firstSlot !== undefined
            ? placeProduct(
                  services,
                  player,
                  firstSlot,
                  recipe.productItemId,
                  productQuantity,
              )
            : services.inventory.addItemToInventory(
                  player,
                  recipe.productItemId,
                  productQuantity,
              ).added > 0;
    if (!placed) {
        restoreConsumed(services, player, recipe.inputItemId, removed);
        return {
            ok: true,
            effects: [
                buildMessageEffect(player, "You need more inventory space to keep weaving."),
            ],
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
        buildMessageEffect(player, recipe.successMessage),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.weave",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [WEAVE_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop weaving because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: recipe.delayTicks,
        groups: [WEAVE_GROUP],
        effects,
    };
}

function formatProductLabel(recipe: WeavingRecipe): string {
    if (!recipe.name) return "";
    return recipe.name.charAt(0).toUpperCase() + recipe.name.slice(1);
}

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.weave", executeWeaveAction);

    const openWeaveMenu = (
        player: PlayerState,
        tick: number | undefined,
        recipes: WeavingRecipe[],
    ) => {
        const inventory = services.inventory.getInventoryItems(player);
        const level = services.skills.getSkill(player, SkillId.Crafting)?.baseLevel ?? 1;

        const choices: CraftableChoice[] = recipes
            .map((recipe) => ({
                recipe,
                batch: computeWeaveBatch(inventory, recipe),
                levelMet: level >= recipe.level,
            }))
            .filter((choice) => choice.batch > 0);

        if (choices.length === 0) {
            services.messaging.sendGameMessage(
                player,
                "You need balls of wool, jute fibre, willow branches, or yarn to weave.",
            );
            return;
        }

        const craftable = choices.filter((choice) => choice.levelMet);
        if (craftable.length === 0) {
            const lowest = choices.reduce((prev, curr) =>
                curr.recipe.level < prev.recipe.level ? curr : prev,
            );
            services.messaging.sendGameMessage(
                player,
                `You need Crafting level ${lowest.recipe.level} to weave ${lowest.recipe.name}.`,
            );
            return;
        }

        const maxQuantity = Math.max(...craftable.map((choice) => choice.batch));
        services.dialog.openSkillMulti(player, {
            id: `weave_skillmulti_${player.id}`,
            title: "How many would you like to weave?",
            products: craftable.map((choice) => ({
                itemId: choice.recipe.productItemId,
                label: formatProductLabel(choice.recipe),
                maxQuantity: choice.batch,
            })),
            maxQuantity,
            defaultQuantity: 1,
            onSelect: (index, quantity) => {
                const selected = craftable[index];
                if (!selected) {
                    services.messaging.sendGameMessage(player, "You decide not to weave anything.");
                    return;
                }
                const desired = Math.max(1, Math.min(selected.batch, quantity | 0));
                const ok = enqueueWeaveAction(
                    services,
                    player,
                    selected.recipe.id,
                    desired,
                    selected.recipe.delayTicks,
                    tick,
                );
                if (!ok) {
                    services.messaging.sendGameMessage(
                        player,
                        "You're too busy to weave anything right now.",
                    );
                }
            },
        });
    };

    const handleLoom = (
        player: PlayerState,
        locId: number,
        tick: number | undefined,
        usedItemId?: number,
    ) => {
        const locDef = services.data.getLocDefinition(locId);
        if (!isLoomLoc(locId, locDef)) return;
        const recipes =
            usedItemId !== undefined
                ? getWeavingRecipesByInputItemId(usedItemId)
                : WEAVING_RECIPES;
        if (recipes.length === 0) return;
        openWeaveMenu(player, tick, recipes);
    };

    const locHandler = (event: LocInteractionEvent) => {
        handleLoom(event.player, event.locId, event.tick);
    };

    for (const locId of LOOM_LOC_IDS) {
        for (const action of LOOM_ACTIONS) {
            registry.registerLocInteraction(locId, locHandler, action);
        }
        registry.registerLocInteraction(locId, locHandler);
        for (const itemId of WEAVING_INPUT_ITEM_IDS) {
            registry.registerItemOnLoc(itemId, locId, (event: ItemOnLocEvent) => {
                handleLoom(event.player, event.target.locId, event.tick, event.source.itemId);
            });
        }
    }
    for (const itemId of WEAVING_INPUT_ITEM_IDS) {
        registry.registerItemOnLoc(itemId, ANY_LOC_ID, (event: ItemOnLocEvent) => {
            handleLoom(event.player, event.target.locId, event.tick, event.source.itemId);
        });
    }
}
