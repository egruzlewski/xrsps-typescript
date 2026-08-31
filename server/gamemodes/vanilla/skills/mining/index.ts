import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    ScriptActionHandlerContext,
    ScriptServices,
} from "../../../../src/game/scripts/types";
import { ResourceNodeTracker, buildTileKey } from "../../systems/ResourceNodeTracker";
import {
    SKILL_ERROR_SOUND,
    buildMessageEffect,
    describeItem,
    failGatheringPrecheck,
} from "../gatheringPrecheck";
import {
    type PickaxeDefinition,
    DENSE_RUNESTONE_CHISEL,
    DENSE_RUNESTONE_LOCS,
    PICKAXES,
    buildMiningLocMap,
    denseRunestonePersists,
    getMiningRockById,
    getMiningRockFromMap,
    selectPickaxeByLevel,
} from "./miningData";

const MINING_ACTIONS = ["mine", "mine rocks", "chip"];
const failMiningPrecheck = failGatheringPrecheck;
// Trailblazer / Echo pickaxe only (league tutor tool set). Do NOT include
// Infernal/Dragon ornament kits — those were incorrectly bank-routing ore.
const ECHO_PICKAXE_ITEM_IDS = [25112];

interface MiningActionData {
    rockLocId: number;
    rockId?: string;
    depletedLocId?: number;
    tile: { x: number; y: number };
    level: number;
    started: boolean;
    echoMinedCount: number;
}

function rollMiningSuccess(level: number, rockLevel: number, pickaxe: PickaxeDefinition): boolean {
    const effective = Math.max(1, level);
    const difficulty = Math.max(1, rockLevel);
    const ratio = effective / difficulty;
    const baseChance = Math.min(0.85, Math.max(0.05, ratio * 0.3));
    return Math.random() < baseChance * pickaxe.accuracy;
}

function executeMineAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as MiningActionData;

    const locId = data.rockLocId;
    const rockId = data.rockId;
    const rock =
        (rockId ? getMiningRockById(rockId) : undefined) ?? services.getMiningRock?.(locId);

    if (!rock) {
        return failMiningPrecheck(player, services, "You can't mine that rock.");
    }

    const tile = { x: data.tile.x, y: data.tile.y };
    const plane = data.level;
    const actionDepletedLocId = data.depletedLocId;
    const nodeKey = buildTileKey(tile, plane);

    if (services.gathering?.getTracker("mining")?.has(nodeKey)) {
        return failMiningPrecheck(player, services, "The rock is depleted of ore.");
    }

    if (!services.location.isAdjacentToLoc(player, locId, tile, plane)) {
        return failMiningPrecheck(player, services, "You stop mining the rock.");
    }

    const skill = services.skills.getSkill(player, SkillId.Mining);
    const effectiveLevel = Math.max(1, (skill?.baseLevel ?? 1) + (skill?.boost ?? 0));

    if (effectiveLevel < rock.level) {
        return failMiningPrecheck(
            player,
            services,
            `You need Mining level ${rock.level} to mine this rock.`,
        );
    }

    const carriedIds = services.inventory.collectCarriedItemIds(player) ?? [];
    const equippedWeaponId = services.equipment.getEquippedItem(player, 3) ?? 0;
    const pickaxe = selectPickaxeByLevel(carriedIds, effectiveLevel, equippedWeaponId);
    if (!pickaxe) {
        return failMiningPrecheck(
            player,
            services,
            "You need a pickaxe that you have the Mining level to use.",
        );
    }
    const isDense = rock.id === "dense";
    if (isDense) {
        const crafting = services.skills.getSkill(player, SkillId.Crafting);
        const craftingLevel = Math.max(1, (crafting?.baseLevel ?? 1) + (crafting?.boost ?? 0));
        const craftingReq = rock.craftingLevel ?? 38;
        if (craftingLevel < craftingReq) {
            return failMiningPrecheck(
                player,
                services,
                `You need Crafting level ${craftingReq} to mine this rock.`,
            );
        }
        const hasChisel =
            carriedIds.includes(DENSE_RUNESTONE_CHISEL) ||
            services.inventory.playerHasItem(player, DENSE_RUNESTONE_CHISEL);
        if (rock.requireChisel && !hasChisel) {
            return failMiningPrecheck(player, services, "You need a chisel to chip this rock.");
        }
    }
    const hasEchoPickaxePerk = !isDense && ECHO_PICKAXE_ITEM_IDS.includes(pickaxe.itemId);

    if (!hasEchoPickaxePerk && !services.inventory.hasInventorySlot(player)) {
        return failMiningPrecheck(
            player,
            services,
            "Your inventory is too full to hold any more ore.",
        );
    }

    const swingTicks = isDense ? rock.swingTicks : Math.max(rock.swingTicks, pickaxe.swingTicks);
    const effects: ActionEffect[] = [];

    if (!data.started) {
        effects.push(buildMessageEffect(player, "You swing your pickaxe at the rock."));
        services.location.faceTile(player, tile);
        services.animation.playPlayerSeq(player, pickaxe.animation);
        const initialSchedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.mine",
                data: {
                    rockId: rock.id,
                    rockLocId: locId,
                    depletedLocId: actionDepletedLocId,
                    tile: { x: tile.x, y: tile.y },
                    level: plane,
                    started: true,
                    echoMinedCount: data.echoMinedCount,
                },
                delayTicks: swingTicks,
                cooldownTicks: swingTicks,
                groups: ["skill.mine"],
            },
            tick,
        );
        if (!initialSchedule?.ok) {
            effects.push(buildMessageEffect(player, "You stop mining the rock."));
        }
        return { ok: true, cooldownTicks: 0, groups: ["skill.mine"], effects };
    }

    services.location.faceTile(player, tile);
    services.animation.playPlayerSeq(player, pickaxe.animation);

    let inventorySnapshot = false;
    let bankSnapshot = false;
    const echoMinedCount = data.echoMinedCount;
    let nextEchoMinedCount = echoMinedCount;

    let success = rock.alwaysSucceed || rollMiningSuccess(effectiveLevel, rock.level, pickaxe);
    if (!success && hasEchoPickaxePerk && Math.random() < 0.5) {
        success = true;
    }

    if (success) {
        if (hasEchoPickaxePerk) {
            const banked = services.banking?.addItemToBank?.(player, rock.oreItemId, 1);
            if (!banked) {
                return failMiningPrecheck(
                    player,
                    services,
                    "Your bank is too full to hold any more ore.",
                );
            }
            bankSnapshot = true;
        } else {
            const result = services.inventory.addItemToInventory(player, rock.oreItemId, 1);
            if (result.added <= 0) {
                return failMiningPrecheck(
                    player,
                    services,
                    "Your inventory is too full to hold any more ore.",
                );
            }
            inventorySnapshot = true;
        }

        const oreName = describeItem(services, rock.oreItemId);
        effects.push(buildMessageEffect(player, `You manage to mine some ${oreName}.`));
        if (hasEchoPickaxePerk) {
            const capitalizedOreName = oreName.charAt(0).toUpperCase() + oreName.slice(1);
            effects.push(
                buildMessageEffect(
                    player,
                    `1x ${capitalizedOreName} were sent straight to your bank.`,
                ),
            );
        }
        services.skills.addSkillXp(player, SkillId.Mining, rock.xp);
        if (isDense && (rock.craftingXp ?? 0) > 0) {
            services.skills.addSkillXp(player, SkillId.Crafting, rock.craftingXp ?? 0);
        }

        if (locId > 0) {
            nextEchoMinedCount = hasEchoPickaxePerk ? echoMinedCount + 1 : 0;
            let canDeplete = !hasEchoPickaxePerk || nextEchoMinedCount >= 4;
            if (canDeplete && isDense) {
                canDeplete = !denseRunestonePersists(effectiveLevel);
            }
            if (canDeplete) {
                const depletedLocId =
                    typeof actionDepletedLocId === "number" && actionDepletedLocId > 0
                        ? actionDepletedLocId
                        : undefined;

                services.gathering
                    ?.getTracker<any>("mining")
                    ?.addWithRandomDuration(nodeKey, tile, plane, tick, rock.respawnTicks, {
                        locId,
                        depletedLocId,
                        rockId: rock.id,
                    });

                if (depletedLocId !== undefined) {
                    services.location.emitLocChange(locId, depletedLocId, tile, plane);
                }
                effects.push(buildMessageEffect(player, "The rock is depleted of its ore."));
                services.stopGatheringInteraction?.(player);
            }
        }
    }

    if (inventorySnapshot) {
        effects.push({ type: "inventorySnapshot", playerId: player.id });
    }
    if (bankSnapshot) {
        services.banking?.queueBankSnapshot?.(player);
    }

    let continueMining = !services.gathering?.getTracker("mining")?.has(nodeKey);
    if (continueMining) {
        if (!hasEchoPickaxePerk && !services.inventory.hasInventorySlot(player)) {
            continueMining = false;
            effects.push(
                buildMessageEffect(player, "Your inventory is too full to hold any more ore."),
            );
        } else if (!services.location.isAdjacentToLoc(player, locId, tile, plane)) {
            continueMining = false;
        }
    }

    if (continueMining) {
        const reschedule = services.combat.scheduleAction(
            player.id,
            {
                kind: "skill.mine",
                data: {
                    rockId: rock.id,
                    rockLocId: locId,
                    depletedLocId: actionDepletedLocId,
                    tile: { x: tile.x, y: tile.y },
                    level: plane,
                    started: true,
                    echoMinedCount: nextEchoMinedCount,
                },
                delayTicks: swingTicks,
                cooldownTicks: swingTicks,
                groups: ["skill.mine"],
            },
            tick,
        );
        if (!reschedule?.ok) {
            effects.push(buildMessageEffect(player, "You stop mining the rock."));
        }
    }

    return { ok: true, cooldownTicks: swingTicks, groups: ["skill.mine"], effects };
}

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.mine", executeMineAction);

    const miningTracker = new ResourceNodeTracker<{
        locId: number;
        depletedLocId?: number;
        rockId: string;
    }>();
    services.gathering?.registerTracker("mining", miningTracker, (node, gatheringSvc) => {
        if (node.data.depletedLocId && node.data.locId > 0) {
            gatheringSvc.emitLocChange(
                node.data.depletedLocId,
                node.data.locId,
                node.tile,
                node.level,
            );
        }
    });

    const locTypeLoader = services.data.getLocTypeLoader();
    const miningLocMap = buildMiningLocMap(locTypeLoader);
    services.getMiningRock = (locId) => getMiningRockFromMap(locId, miningLocMap);

    if (!services.getMiningRock) {
        console.log("[script:mining] rock lookup unavailable; module disabled");
        return;
    }
    const requestMine = (
        player: PlayerState,
        actionServices: ScriptServices,
        locId: number,
        tile: { x: number; y: number },
        level: number,
        tick: number,
    ) => {
        const rock = services.getMiningRock?.(locId);
        if (!rock) return;
        const result = actionServices.combat.requestAction(
            player,
            {
                kind: "skill.mine",
                data: {
                    rockId: rock.id,
                    rockLocId: locId,
                    depletedLocId: rock.depletedLocId,
                    tile: { x: tile.x, y: tile.y },
                    level,
                    started: false,
                    echoMinedCount: 0,
                },
                delayTicks: 0,
                cooldownTicks: 0,
                groups: ["skill.mine"],
            },
            tick,
        );
        if (!result.ok) {
            actionServices.messaging.sendGameMessage(
                player,
                "You're too busy to do that right now.",
            );
        }
    };

    for (const action of MINING_ACTIONS) {
        registry.registerLocAction(action, (event) => {
            requestMine(
                event.player,
                event.services,
                event.locId,
                event.tile,
                event.level,
                event.tick,
            );
        });
    }

    for (const { locId } of DENSE_RUNESTONE_LOCS) {
        const chip = (event: {
            player: PlayerState;
            services: ScriptServices;
            locId: number;
            tile: { x: number; y: number };
            level: number;
            tick: number;
        }) =>
            requestMine(
                event.player,
                event.services,
                event.locId,
                event.tile,
                event.level,
                event.tick,
            );
        registry.registerLocInteraction(locId, (event) => chip(event), "chip");
        registry.registerLocInteraction(locId, (event) => chip(event), undefined);
        for (const pickaxe of PICKAXES) {
            registry.registerItemOnLoc(pickaxe.itemId, locId, (event) => {
                requestMine(
                    event.player,
                    event.services,
                    event.target.locId,
                    event.target.tile,
                    event.target.level,
                    event.tick,
                );
            });
        }
    }
}
