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
import {
    BALL_OF_WOOL_ITEM_ID,
    CHISEL_ITEM_ID,
    CRUSHED_GEM_ITEM_ID,
    ONYX_ITEM_ID,
    ZENYTE_FUSE_RECIPE,
    ZENYTE_SHARD_ITEM_ID,
    type AmuletStringRecipe,
    type GemCutRecipe,
    type JewelleryRecipe,
    type ZenyteFuseRecipe,
    JEWELLERY_BAR_ITEM_IDS,
    JEWELLERY_MOULD_ITEM_IDS,
    JEWELLERY_RECIPES,
    UNCUT_GEM_ITEM_IDS,
    UNSTRUNG_AMULET_ITEM_IDS,
    getAmuletStringRecipeById,
    getAmuletStringRecipeByUnstrungId,
    getGemCutRecipeById,
    getGemCutRecipeByUncutId,
    getJewelleryRecipeById,
    getZenyteFuseRecipeById,
    isFurnaceLoc,
    rollSemiPreciousCutSuccess,
} from "./jewelleryData";

const MAX_BATCH = 28;
const JEWELLERY_GROUP = "skill.jewellery";
const GEM_CUT_GROUP = "skill.gem_cut";
const STRING_GROUP = "skill.string_amulet";
const ZENYTE_FUSE_GROUP = "skill.zenyte_fuse";

type InventoryEntry = ScriptInventoryEntry;

type JewelleryActionData = {
    recipeId: string;
    count: number;
};

type GemCutActionData = {
    recipeId: string;
    count: number;
};

type StringActionData = {
    recipeId: string;
    count: number;
};

type ZenyteFuseActionData = {
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

function computeJewelleryBatch(entries: InventoryEntry[], recipe: JewelleryRecipe): number {
    const bars = countItem(entries, recipe.barItemId);
    const gems = recipe.gemItemId ? countItem(entries, recipe.gemItemId) : bars;
    const moulds = countItem(entries, recipe.mouldItemId);
    if (moulds <= 0) return 0;
    return Math.max(0, Math.min(MAX_BATCH, bars, gems));
}

function computeGemCutBatch(entries: InventoryEntry[], recipe: GemCutRecipe): number {
    const chisel = countItem(entries, CHISEL_ITEM_ID);
    if (chisel <= 0) return 0;
    return Math.max(0, Math.min(MAX_BATCH, countItem(entries, recipe.uncutItemId)));
}

function computeStringBatch(entries: InventoryEntry[], recipe: AmuletStringRecipe): number {
    return Math.max(
        0,
        Math.min(
            MAX_BATCH,
            countItem(entries, recipe.unstrungItemId),
            countItem(entries, BALL_OF_WOOL_ITEM_ID),
        ),
    );
}

function computeZenyteFuseBatch(entries: InventoryEntry[], recipe: ZenyteFuseRecipe): number {
    return Math.max(
        0,
        Math.min(
            MAX_BATCH,
            countItem(entries, recipe.shardItemId),
            countItem(entries, recipe.gemItemId),
        ),
    );
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

function executeJewelleryAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as JewelleryActionData;
    const recipe = getJewelleryRecipeById(data.recipeId);
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
                    `You need Crafting level ${recipe.level} to make a ${recipe.name}.`,
                ),
            ],
        };
    }

    if (!services.inventory.playerHasItem(player, recipe.mouldItemId)) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need a mould to craft jewellery.")],
        };
    }

    const barSlot = consumeOne(services, player, recipe.barItemId);
    if (barSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more bars to keep crafting.")],
        };
    }

    let gemSlot: number | undefined;
    if (recipe.gemItemId) {
        gemSlot = consumeOne(services, player, recipe.gemItemId);
        if (gemSlot === undefined) {
            restoreSlot(services, player, barSlot, recipe.barItemId);
            return {
                ok: true,
                effects: [buildMessageEffect(player, "You need a cut gem to make that.")],
            };
        }
    }

    if (!placeProduct(services, player, barSlot, recipe.productItemId)) {
        restoreSlot(services, player, barSlot, recipe.barItemId);
        if (gemSlot !== undefined && recipe.gemItemId) {
            restoreSlot(services, player, gemSlot, recipe.gemItemId);
        }
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
        buildMessageEffect(player, `You make a ${recipe.name}.`),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.jewellery",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [JEWELLERY_GROUP],
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
        groups: [JEWELLERY_GROUP],
        effects,
    };
}

function executeGemCutAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as GemCutActionData;
    const recipe = getGemCutRecipeById(data.recipeId);
    if (!recipe) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't cut that.")] };
    }

    const skill = services.skills.getSkill(player, SkillId.Crafting);
    if ((skill?.baseLevel ?? 1) < recipe.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need Crafting level ${recipe.level} to cut ${recipe.name}.`,
                ),
            ],
        };
    }

    if (!services.inventory.playerHasItem(player, CHISEL_ITEM_ID)) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need a chisel to cut gems.")],
        };
    }

    const gemSlot = consumeOne(services, player, recipe.uncutItemId);
    if (gemSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more uncut gems to keep cutting.")],
        };
    }

    const crush = recipe.crush;
    const crushed =
        crush !== undefined &&
        !rollSemiPreciousCutSuccess(
            Math.max(1, (skill?.baseLevel ?? 1) + (skill?.boost ?? 0)),
            crush,
        );
    const productItemId = crushed ? CRUSHED_GEM_ITEM_ID : recipe.cutItemId;
    const xp = crushed && crush ? crush.xp : recipe.xp;
    const message = crushed
        ? `You mis-hit the chisel and smash the ${recipe.name} into pieces!`
        : `You cut the ${recipe.name}.`;

    if (!placeProduct(services, player, gemSlot, productItemId)) {
        restoreSlot(services, player, gemSlot, recipe.uncutItemId);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more inventory space to keep cutting.")],
        };
    }
    services.animation.playPlayerSeq(player, recipe.animation);
    services.skills.addSkillXp(player, SkillId.Crafting, xp);
    services.system.eventBus?.emit("item:craft", {
        playerId: player.id,
        itemId: productItemId,
        count: 1,
    });

    const effects: ActionEffect[] = [
        { type: "inventorySnapshot", playerId: player.id },
        buildMessageEffect(player, message),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.gem_cut",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [GEM_CUT_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop cutting gems because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: recipe.delayTicks,
        groups: [GEM_CUT_GROUP],
        effects,
    };
}

function executeAmuletStringAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as StringActionData;
    const recipe = getAmuletStringRecipeById(data.recipeId);
    if (!recipe) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't string that.")] };
    }

    const skill = services.skills.getSkill(player, SkillId.Crafting);
    if ((skill?.baseLevel ?? 1) < recipe.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need Crafting level ${recipe.level} to string a ${recipe.name}.`,
                ),
            ],
        };
    }

    const amuletSlot = consumeOne(services, player, recipe.unstrungItemId);
    if (amuletSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need an unstrung amulet to string.")],
        };
    }

    const woolSlot = consumeOne(services, player, BALL_OF_WOOL_ITEM_ID);
    if (woolSlot === undefined) {
        restoreSlot(services, player, amuletSlot, recipe.unstrungItemId);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need a ball of wool to string that.")],
        };
    }

    if (!placeProduct(services, player, amuletSlot, recipe.productItemId)) {
        restoreSlot(services, player, amuletSlot, recipe.unstrungItemId);
        restoreSlot(services, player, woolSlot, BALL_OF_WOOL_ITEM_ID);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more inventory space to keep stringing.")],
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
        buildMessageEffect(player, `You string the ${recipe.name}.`),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.string_amulet",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [STRING_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop stringing because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: recipe.delayTicks,
        groups: [STRING_GROUP],
        effects,
    };
}

function executeZenyteFuseAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as ZenyteFuseActionData;
    const recipe = getZenyteFuseRecipeById(data.recipeId);
    if (!recipe) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't fuse that.")] };
    }

    const skill = services.skills.getSkill(player, SkillId.Crafting);
    if ((skill?.baseLevel ?? 1) < recipe.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need Crafting level ${recipe.level} to make an ${recipe.name}.`,
                ),
            ],
        };
    }

    const shardSlot = consumeOne(services, player, recipe.shardItemId);
    if (shardSlot === undefined) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need a zenyte shard to fuse that.")],
        };
    }

    const gemSlot = consumeOne(services, player, recipe.gemItemId);
    if (gemSlot === undefined) {
        restoreSlot(services, player, shardSlot, recipe.shardItemId);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need a cut onyx to fuse that.")],
        };
    }

    if (!placeProduct(services, player, shardSlot, recipe.productItemId)) {
        restoreSlot(services, player, shardSlot, recipe.shardItemId);
        restoreSlot(services, player, gemSlot, recipe.gemItemId);
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You need more inventory space to keep fusing.")],
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
        buildMessageEffect(
            player,
            "You fuse the zenyte shard and onyx together, forming an uncut zenyte.",
        ),
    ];

    const remaining = Math.max(0, Math.max(1, data.count) - 1);
    if (remaining > 0) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.zenyte_fuse",
                data: { recipeId: recipe.id, count: remaining },
                delayTicks: recipe.delayTicks,
                cooldownTicks: recipe.delayTicks,
                groups: [ZENYTE_FUSE_GROUP],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(
                buildMessageEffect(player, "You stop fusing because you're already busy."),
            );
        }
    }

    return {
        ok: true,
        cooldownTicks: recipe.delayTicks,
        groups: [ZENYTE_FUSE_GROUP],
        effects,
    };
}

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.jewellery", executeJewelleryAction);
    registry.registerActionHandler("skill.gem_cut", executeGemCutAction);
    registry.registerActionHandler("skill.string_amulet", executeAmuletStringAction);
    registry.registerActionHandler("skill.zenyte_fuse", executeZenyteFuseAction);

    const openJewelleryMenu = (
        player: PlayerState,
        tick: number | undefined,
        filter: (recipe: JewelleryRecipe) => boolean,
    ) => {
        const inventory = services.inventory.getInventoryItems(player);
        const level = services.skills.getSkill(player, SkillId.Crafting)?.baseLevel ?? 1;
        const choices = JEWELLERY_RECIPES.filter(filter)
            .map((recipe) => {
                const batch = computeJewelleryBatch(inventory, recipe);
                return { recipe, batch, levelMet: level >= recipe.level };
            })
            .filter((choice) => choice.batch > 0);

        if (choices.length === 0) {
            services.messaging.sendGameMessage(
                player,
                "You need a mould and a gold or silver bar to craft jewellery.",
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
                `You need Crafting level ${lowest.recipe.level} to make a ${lowest.recipe.name}.`,
            );
            return;
        }

        const maxQuantity = Math.max(...craftable.map((choice) => choice.batch));
        services.dialog.openSkillMulti(player, {
            id: `jewellery_skillmulti_${player.id}`,
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
                    services.messaging.sendGameMessage(player, "You decide not to craft anything.");
                    return;
                }
                const desired = Math.max(1, Math.min(selected.batch, quantity | 0));
                const ok = enqueueRecipeAction(
                    services,
                    player,
                    "skill.jewellery",
                    JEWELLERY_GROUP,
                    selected.recipe.id,
                    desired,
                    selected.recipe.delayTicks,
                    tick,
                );
                if (!ok) {
                    services.messaging.sendGameMessage(
                        player,
                        "You're too busy to craft anything right now.",
                    );
                }
            },
        });
    };

    const handleFurnaceUse = (event: ItemOnLocEvent, usedItemId: number) => {
        const locDef = services.data.getLocDefinition(event.target.locId);
        if (!isFurnaceLoc(locDef)) return;
        const isBar = (JEWELLERY_BAR_ITEM_IDS as readonly number[]).includes(usedItemId);
        const isMould = JEWELLERY_MOULD_ITEM_IDS.includes(usedItemId);
        if (!isBar && !isMould) return;
        openJewelleryMenu(event.player, event.tick, (recipe) => {
            if (isBar) return recipe.barItemId === usedItemId;
            return recipe.mouldItemId === usedItemId;
        });
    };

    for (const itemId of [...JEWELLERY_BAR_ITEM_IDS, ...JEWELLERY_MOULD_ITEM_IDS]) {
        registry.registerItemOnLoc(itemId, ANY_LOC_ID, (event) => {
            handleFurnaceUse(event, event.source.itemId);
        });
    }

    const handleGemCut = (event: ItemOnItemEvent) => {
        const otherId =
            event.source.itemId === CHISEL_ITEM_ID ? event.target.itemId : event.source.itemId;
        const recipe = getGemCutRecipeByUncutId(otherId);
        if (!recipe) return;
        const inventory = services.inventory.getInventoryItems(event.player);
        const batch = computeGemCutBatch(inventory, recipe);
        if (batch <= 0) {
            services.messaging.sendGameMessage(
                event.player,
                "You need a chisel and an uncut gem to cut that.",
            );
            return;
        }
        const level = services.skills.getSkill(event.player, SkillId.Crafting)?.baseLevel ?? 1;
        if (level < recipe.level) {
            services.messaging.sendGameMessage(
                event.player,
                `You need Crafting level ${recipe.level} to cut ${recipe.name}.`,
            );
            return;
        }
        services.dialog.openSkillMulti(event.player, {
            id: `gem_cut_skillmulti_${event.player.id}`,
            title: "How many would you like to cut?",
            products: [{ itemId: recipe.cutItemId, label: recipe.name, maxQuantity: batch }],
            maxQuantity: batch,
            defaultQuantity: 1,
            onSelect: (_index, quantity) => {
                const desired = Math.max(1, Math.min(batch, quantity | 0));
                const ok = enqueueRecipeAction(
                    services,
                    event.player,
                    "skill.gem_cut",
                    GEM_CUT_GROUP,
                    recipe.id,
                    desired,
                    recipe.delayTicks,
                    event.tick,
                );
                if (!ok) {
                    services.messaging.sendGameMessage(
                        event.player,
                        "You're too busy to cut gems right now.",
                    );
                }
            },
        });
    };

    for (const uncutId of UNCUT_GEM_ITEM_IDS) {
        registry.registerItemOnItem(CHISEL_ITEM_ID, uncutId, handleGemCut);
    }

    const handleStringAmulet = (event: ItemOnItemEvent) => {
        const otherId =
            event.source.itemId === BALL_OF_WOOL_ITEM_ID
                ? event.target.itemId
                : event.source.itemId;
        const recipe = getAmuletStringRecipeByUnstrungId(otherId);
        if (!recipe) return;
        const inventory = services.inventory.getInventoryItems(event.player);
        const batch = computeStringBatch(inventory, recipe);
        if (batch <= 0) {
            services.messaging.sendGameMessage(
                event.player,
                "You need an unstrung amulet and a ball of wool.",
            );
            return;
        }
        const level = services.skills.getSkill(event.player, SkillId.Crafting)?.baseLevel ?? 1;
        if (level < recipe.level) {
            services.messaging.sendGameMessage(
                event.player,
                `You need Crafting level ${recipe.level} to string a ${recipe.name}.`,
            );
            return;
        }
        const ok = enqueueRecipeAction(
            services,
            event.player,
            "skill.string_amulet",
            STRING_GROUP,
            recipe.id,
            batch,
            recipe.delayTicks,
            event.tick,
        );
        if (!ok) {
            services.messaging.sendGameMessage(
                event.player,
                "You're too busy to string that right now.",
            );
        }
    };

    for (const unstrungId of UNSTRUNG_AMULET_ITEM_IDS) {
        registry.registerItemOnItem(BALL_OF_WOOL_ITEM_ID, unstrungId, handleStringAmulet);
    }

    const handleZenyteFuse = (event: ItemOnItemEvent) => {
        const recipe = ZENYTE_FUSE_RECIPE;
        const otherId =
            event.source.itemId === recipe.shardItemId ? event.target.itemId : event.source.itemId;
        if (otherId !== recipe.gemItemId) return;
        const inventory = services.inventory.getInventoryItems(event.player);
        const batch = computeZenyteFuseBatch(inventory, recipe);
        if (batch <= 0) {
            services.messaging.sendGameMessage(
                event.player,
                "You need a zenyte shard and a cut onyx to fuse those.",
            );
            return;
        }
        const level = services.skills.getSkill(event.player, SkillId.Crafting)?.baseLevel ?? 1;
        if (level < recipe.level) {
            services.messaging.sendGameMessage(
                event.player,
                `You need Crafting level ${recipe.level} to make an ${recipe.name}.`,
            );
            return;
        }
        const ok = enqueueRecipeAction(
            services,
            event.player,
            "skill.zenyte_fuse",
            ZENYTE_FUSE_GROUP,
            recipe.id,
            batch,
            recipe.delayTicks,
            event.tick,
        );
        if (!ok) {
            services.messaging.sendGameMessage(
                event.player,
                "You're too busy to fuse that right now.",
            );
        }
    };

    registry.registerItemOnItem(ZENYTE_SHARD_ITEM_ID, ONYX_ITEM_ID, handleZenyteFuse);
}
