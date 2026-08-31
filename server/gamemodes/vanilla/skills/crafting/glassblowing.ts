import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import type { PlayerState } from "../../../../src/game/player";
import {
    ANY_LOC_ID,
    type IScriptRegistry,
    type ItemOnItemEvent,
    type ItemOnLocEvent,
    type ScriptActionHandlerContext,
    type ScriptInventoryEntry,
    type ScriptServices,
} from "../../../../src/game/scripts/types";
import { isFurnaceLoc } from "./jewelleryData";
import {
    BUCKET_OF_SAND_ITEM_ID,
    EMPTY_BUCKET_ITEM_ID,
    GLASSBLOW_RECIPES,
    GLASSBLOWING_PIPE_ITEM_ID,
    GLASSBLOWING_SOUND_ID,
    MOLTEN_GLASS_ANIMATION_ID,
    MOLTEN_GLASS_DELAY_TICKS,
    MOLTEN_GLASS_ITEM_ID,
    MOLTEN_GLASS_LEVEL,
    MOLTEN_GLASS_XP,
    SODA_ASH_ITEM_ID,
    getGlassblowRecipeById,
} from "./glassblowingData";

const MAX_BATCH = 28;
const MOLTEN_GROUP = "skill.molten_glass";
const BLOW_GROUP = "skill.glassblow";

type InventoryEntry = ScriptInventoryEntry;

type MoltenActionData = {
    count: number;
};

type BlowActionData = {
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

function computeMoltenBatch(entries: InventoryEntry[]): number {
    return Math.max(
        0,
        Math.min(
            MAX_BATCH,
            countItem(entries, BUCKET_OF_SAND_ITEM_ID),
            countItem(entries, SODA_ASH_ITEM_ID),
        ),
    );
}

function computeBlowBatch(entries: InventoryEntry[]): number {
    if (countItem(entries, GLASSBLOWING_PIPE_ITEM_ID) <= 0) return 0;
    return Math.max(0, Math.min(MAX_BATCH, countItem(entries, MOLTEN_GLASS_ITEM_ID)));
}

function enqueueRecipeAction(
    services: ScriptServices,
    player: PlayerState,
    kind: string,
    group: string,
    data: Record<string, unknown>,
    delayTicks: number,
    tick?: number,
): boolean {
    const delay = Math.max(1, delayTicks);
    const currentTick = Number.isFinite(tick) ? (tick as number) : services.system.getCurrentTick();
    const result = services.combat.requestAction(
        player,
        {
            kind,
            data,
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

function executeMoltenGlassAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as MoltenActionData;

    const skill = services.skills.getSkill(player, SkillId.Crafting);
    if ((skill?.baseLevel ?? 1) < MOLTEN_GLASS_LEVEL) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need Crafting level ${MOLTEN_GLASS_LEVEL} to make molten glass.`,
                ),
            ],
        };
    }

    const sandSlot = consumeOne(services, player, BUCKET_OF_SAND_ITEM_ID);
    if (sandSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need a bucket of sand to make molten glass.")],
        };
    }

    const ashSlot = consumeOne(services, player, SODA_ASH_ITEM_ID);
    if (ashSlot === undefined) {
        restoreSlot(services, player, sandSlot, BUCKET_OF_SAND_ITEM_ID);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need soda ash to make molten glass.")],
        };
    }

    if (!placeProduct(services, player, sandSlot, MOLTEN_GLASS_ITEM_ID)) {
        restoreSlot(services, player, sandSlot, BUCKET_OF_SAND_ITEM_ID);
        restoreSlot(services, player, ashSlot, SODA_ASH_ITEM_ID);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more inventory space to make glass.")],
        };
    }

    if (!placeProduct(services, player, ashSlot, EMPTY_BUCKET_ITEM_ID)) {
        consumeOne(services, player, MOLTEN_GLASS_ITEM_ID);
        restoreSlot(services, player, sandSlot, BUCKET_OF_SAND_ITEM_ID);
        restoreSlot(services, player, ashSlot, SODA_ASH_ITEM_ID);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more inventory space to make glass.")],
        };
    }

    services.animation.playPlayerSeq(player, MOLTEN_GLASS_ANIMATION_ID);
    services.skills.addSkillXp(player, SkillId.Crafting, MOLTEN_GLASS_XP);
    services.system.eventBus?.emit("item:craft", {
        playerId: player.id,
        itemId: MOLTEN_GLASS_ITEM_ID,
        count: 1,
    });

    const effects: ActionEffect[] = [
        { type: "inventorySnapshot", playerId: player.id },
        buildMessageEffect(player, "You heat the sand and soda ash into molten glass."),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.molten_glass",
                data: { count: remaining },
                delayTicks: MOLTEN_GLASS_DELAY_TICKS,
                cooldownTicks: MOLTEN_GLASS_DELAY_TICKS,
                groups: [MOLTEN_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop making glass because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: MOLTEN_GLASS_DELAY_TICKS,
        groups: [MOLTEN_GROUP],
        effects,
    };
}

function executeGlassblowAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as BlowActionData;
    const recipe = getGlassblowRecipeById(data.recipeId);
    if (!recipe) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't blow that.")] };
    }

    const skill = services.skills.getSkill(player, SkillId.Crafting);
    if ((skill?.baseLevel ?? 1) < recipe.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need Crafting level ${recipe.level} to blow a ${recipe.name}.`,
                ),
            ],
        };
    }

    if (!services.inventory.playerHasItem(player, GLASSBLOWING_PIPE_ITEM_ID)) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need a glassblowing pipe to blow glass.")],
        };
    }

    const glassSlot = consumeOne(services, player, MOLTEN_GLASS_ITEM_ID);
    if (glassSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more molten glass to keep blowing.")],
        };
    }

    if (!placeProduct(services, player, glassSlot, recipe.productItemId)) {
        restoreSlot(services, player, glassSlot, MOLTEN_GLASS_ITEM_ID);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more inventory space to keep blowing.")],
        };
    }
    services.animation.playPlayerSeq(player, recipe.animation);
    services.sound.sendSound(player, GLASSBLOWING_SOUND_ID);
    services.skills.addSkillXp(player, SkillId.Crafting, recipe.xp);
    services.system.eventBus?.emit("item:craft", {
        playerId: player.id,
        itemId: recipe.productItemId,
        count: 1,
    });

    const effects: ActionEffect[] = [
        { type: "inventorySnapshot", playerId: player.id },
        buildMessageEffect(player, `You blow the molten glass into a ${recipe.name}.`),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.glassblow",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [BLOW_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop blowing glass because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: recipe.delayTicks,
        groups: [BLOW_GROUP],
        effects,
    };
}

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.molten_glass", executeMoltenGlassAction);
    registry.registerActionHandler("skill.glassblow", executeGlassblowAction);

    const openMoltenMenu = (player: PlayerState, tick: number | undefined) => {
        const inventory = services.inventory.getInventoryItems(player);
        const hasSand = countItem(inventory, BUCKET_OF_SAND_ITEM_ID) > 0;
        const hasAsh = countItem(inventory, SODA_ASH_ITEM_ID) > 0;
        if (!hasSand || !hasAsh) {
            services.messaging.sendGameMessage(
                player,
                "You need a bucket of sand and soda ash to make molten glass.",
            );
            return;
        }

        const level = services.skills.getSkill(player, SkillId.Crafting)?.baseLevel ?? 1;
        if (level < MOLTEN_GLASS_LEVEL) {
            services.messaging.sendGameMessage(
                player,
                `You need Crafting level ${MOLTEN_GLASS_LEVEL} to make molten glass.`,
            );
            return;
        }

        const batch = computeMoltenBatch(inventory);
        services.dialog.openSkillMulti(player, {
            id: `molten_glass_skillmulti_${player.id}`,
            title: "How many would you like to make?",
            products: [
                { itemId: MOLTEN_GLASS_ITEM_ID, label: "molten glass", maxQuantity: batch },
            ],
            maxQuantity: batch,
            defaultQuantity: 1,
            onSelect: (_index, quantity) => {
                const desired = Math.max(1, Math.min(batch, quantity | 0));
                const ok = enqueueRecipeAction(
                    services,
                    player,
                    "skill.molten_glass",
                    MOLTEN_GROUP,
                    { count: desired },
                    MOLTEN_GLASS_DELAY_TICKS,
                    tick,
                );
                if (!ok) {
                    services.messaging.sendGameMessage(
                        player,
                        "You're too busy to make glass right now.",
                    );
                }
            },
        });
    };

    const handleFurnaceUse = (event: ItemOnLocEvent) => {
        const locDef = services.data.getLocDefinition(event.target.locId);
        if (!isFurnaceLoc(locDef)) return;
        openMoltenMenu(event.player, event.tick);
    };

    registry.registerItemOnLoc(BUCKET_OF_SAND_ITEM_ID, ANY_LOC_ID, handleFurnaceUse);
    registry.registerItemOnLoc(SODA_ASH_ITEM_ID, ANY_LOC_ID, handleFurnaceUse);

    const handlePipeOnGlass = (event: ItemOnItemEvent) => {
        const otherId =
            event.source.itemId === GLASSBLOWING_PIPE_ITEM_ID
                ? event.target.itemId
                : event.source.itemId;
        if (otherId !== MOLTEN_GLASS_ITEM_ID) return;

        const inventory = services.inventory.getInventoryItems(event.player);
        const batch = computeBlowBatch(inventory);
        if (batch <= 0) {
            services.messaging.sendGameMessage(
                event.player,
                "You need a glassblowing pipe and molten glass.",
            );
            return;
        }

        const level = services.skills.getSkill(event.player, SkillId.Crafting)?.baseLevel ?? 1;
        const choices = GLASSBLOW_RECIPES.map((recipe) => ({
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
                event.player,
                `You need Crafting level ${lowest.recipe.level} to blow a ${lowest.recipe.name}.`,
            );
            return;
        }

        services.dialog.openSkillMulti(event.player, {
            id: `glassblow_skillmulti_${event.player.id}`,
            title: "How many would you like to blow?",
            products: craftable.map((choice) => ({
                itemId: choice.recipe.productItemId,
                label: choice.recipe.name,
                maxQuantity: choice.batch,
            })),
            maxQuantity: batch,
            defaultQuantity: 1,
            onSelect: (index, quantity) => {
                const selected = craftable[index];
                if (!selected) {
                    services.messaging.sendGameMessage(
                        event.player,
                        "You decide not to blow anything.",
                    );
                    return;
                }
                const desired = Math.max(1, Math.min(selected.batch, quantity | 0));
                const ok = enqueueRecipeAction(
                    services,
                    event.player,
                    "skill.glassblow",
                    BLOW_GROUP,
                    { recipeId: selected.recipe.id, count: desired },
                    selected.recipe.delayTicks,
                    event.tick,
                );
                if (!ok) {
                    services.messaging.sendGameMessage(
                        event.player,
                        "You're too busy to blow glass right now.",
                    );
                }
            },
        });
    };

    registry.registerItemOnItem(GLASSBLOWING_PIPE_ITEM_ID, MOLTEN_GLASS_ITEM_ID, handlePipeOnGlass);
}
