import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import { LockState } from "../../../../src/game/model/LockState";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    ScriptActionHandlerContext,
    ScriptServices,
} from "../../../../src/game/scripts/types";
import { ResourceNodeTracker, buildTileKey } from "../../systems/ResourceNodeTracker";
import {
    CHESTS,
    LOCKPICK_ITEM_ID,
    computeChestTrapDamage,
    getChestByLocId,
    resolveLootAmount,
    rollChestTableLoot,
    type ChestDef,
    type ChestLoot,
} from "./chestData";

export {
    CHESTS,
    ChestItems,
    LOCKPICK_ITEM_ID,
    computeChestTrapDamage,
    getChestByLocId,
} from "./chestData";

const CHEST_TRACKER = "thieving-chests";
const CHEST_FAIL_ANIM = 537; // human_lockedchest
const CHEST_SUCCESS_ANIM = 536; // human_openchest
const CHEST_SOUND = 2402;
const CHEST_DAMAGE_SOUND = 519;
const CHEST_HIT_STYLE = 16;

type ChestMode = "open" | "search" | "pick-lock";

interface ChestActionData {
    locId: number;
    chestId: string;
    reqLevel: number;
    xp: number;
    alwaysLoot: ChestLoot[];
    lootTable: ChestLoot[];
    respawnTicks: number;
    requiresLockpick: boolean;
    hasTrap: boolean;
    trap?: ChestDef["trap"];
    teleport?: { x: number; y: number; level: number };
    mode: ChestMode;
    tile: { x: number; y: number };
    level: number;
    phase: number;
}

function buildMessageEffect(player: PlayerState, message: string): ActionEffect {
    return { type: "message", playerId: player.id, message };
}

function currentHp(player: PlayerState): number {
    const hp = player.skillSystem?.getHitpointsCurrent?.();
    if (typeof hp === "number" && Number.isFinite(hp) && hp > 0) return hp;
    return 10;
}

function thievingLevel(player: PlayerState, services: ScriptServices): number {
    const skill = services.skills.getSkill(player, SkillId.Thieving);
    return Math.max(1, (skill?.baseLevel ?? 1) + (skill?.boost ?? 0));
}

function rollPicklockSuccess(playerLevel: number, reqLevel: number): boolean {
    const minChance = 50;
    const maxChance = 95;
    const range = 99 - reqLevel || 1;
    const chance = minChance + ((maxChance - minChance) * (playerLevel - reqLevel)) / range;
    const clamped = Math.min(maxChance, Math.max(minChance, chance));
    return Math.random() * 100 < clamped;
}

function scheduleChest(
    services: ScriptServices,
    playerId: number,
    data: ChestActionData,
    tick: number,
): void {
    services.combat.scheduleAction(
        playerId,
        {
            kind: "skill.steal-chest",
            data,
            delayTicks: 1,
            cooldownTicks: 1,
            groups: ["skill.steal-chest"],
        },
        tick,
    );
}

function applyTrap(
    player: PlayerState,
    services: ScriptServices,
    data: ChestActionData,
    tick: number,
    effects: ActionEffect[],
): void {
    const trap = data.trap;
    const damage = trap ? computeChestTrapDamage(trap, currentHp(player)) : 1;
    services.animation.playPlayerSeq(player, CHEST_FAIL_ANIM);
    services.sound.sendSound(player, CHEST_DAMAGE_SOUND);
    const hitsplat = services.combat.applyPlayerHitsplat(player, CHEST_HIT_STYLE, damage, tick);
    if (hitsplat) {
        effects.push({
            type: "hitsplat",
            playerId: player.id,
            targetType: "player",
            targetId: player.id,
            damage: hitsplat.amount,
            style: hitsplat.style,
            hpCurrent: hitsplat.hpCurrent,
            hpMax: hitsplat.hpMax,
            tick,
            skipAutoSound: true,
        });
    }
    effects.push(buildMessageEffect(player, "You have activated a trap on the chest."));
}

function giveChestLoot(
    player: PlayerState,
    services: ScriptServices,
    data: ChestActionData,
    effects: ActionEffect[],
): void {
    const drops = data.alwaysLoot.map(resolveLootAmount);
    const rolled = rollChestTableLoot(data.lootTable);
    if (rolled) drops.push(rolled);
    for (const drop of drops) {
        services.inventory.addItemToInventory(player, drop.itemId, drop.quantity);
    }
    if (drops.length > 0) {
        effects.push({ type: "inventorySnapshot", playerId: player.id });
    }
}

function executeChestAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, tick, services } = ctx;
    const data = ctx.data as ChestActionData;
    const effects: ActionEffect[] = [];
    const tile = { x: data.tile.x, y: data.tile.y };
    const plane = data.level;
    const nodeKey = buildTileKey(tile, plane);
    const tracker = services.gathering?.getTracker<{ locId: number }>(CHEST_TRACKER);
    const stealing = data.mode !== "open";

    if (data.phase === 0) {
        if (services.combat.isPlayerStunned(player)) {
            effects.push(buildMessageEffect(player, "You're stunned!"));
            return { ok: true, effects };
        }
        if (services.combat.isPlayerInCombat(player)) {
            effects.push(buildMessageEffect(player, "You can't do that during combat."));
            return { ok: true, effects };
        }
        if (!services.location.isAdjacentToLoc(player, data.locId, tile, plane)) {
            effects.push(buildMessageEffect(player, "You can't reach that."));
            return { ok: true, effects };
        }
        if (tracker?.has(nodeKey)) {
            effects.push(buildMessageEffect(player, "The chest is empty."));
            return { ok: true, effects };
        }
        if (!stealing) {
            if (!data.hasTrap) {
                effects.push(buildMessageEffect(player, "The chest is locked."));
                return { ok: true, effects };
            }
        } else {
            if (thievingLevel(player, services) < data.reqLevel) {
                effects.push(
                    buildMessageEffect(
                        player,
                        `You need a Thieving level of ${data.reqLevel} to loot this chest.`,
                    ),
                );
                return { ok: true, effects };
            }
            if (data.requiresLockpick && !services.inventory.playerHasItem(player, LOCKPICK_ITEM_ID)) {
                effects.push(buildMessageEffect(player, "You need a lockpick to pick this lock."));
                return { ok: true, effects };
            }
            if (!services.inventory.hasInventorySlot(player)) {
                effects.push(
                    buildMessageEffect(player, "You don't have enough inventory space to do that."),
                );
                return { ok: true, effects };
            }
        }

        services.location.faceTile(player, tile);
        services.animation.playPlayerSeq(
            player,
            stealing ? CHEST_SUCCESS_ANIM : CHEST_FAIL_ANIM,
        );
        services.sound.sendSound(player, CHEST_SOUND);
        if (stealing) {
            effects.push(
                buildMessageEffect(
                    player,
                    data.mode === "pick-lock"
                        ? "You attempt to pick the lock."
                        : "You search the chest for traps.",
                ),
            );
        }
        player.lock = LockState.FULL_WITH_ITEM_INTERACTION;
        scheduleChest(services, player.id, { ...data, phase: 1 }, tick);
        return { ok: true, cooldownTicks: 1, effects };
    }

    if (data.phase === 1) {
        player.lock = LockState.NONE;
        if (tracker?.has(nodeKey)) {
            effects.push(buildMessageEffect(player, "The chest is empty."));
            return { ok: true, effects };
        }
        if (!stealing) {
            applyTrap(player, services, data, tick, effects);
            return { ok: true, effects };
        }
        if (data.mode === "pick-lock") {
            const success = rollPicklockSuccess(thievingLevel(player, services), data.reqLevel);
            if (!success) {
                services.animation.playPlayerSeq(player, CHEST_FAIL_ANIM);
                effects.push(buildMessageEffect(player, "You fail to pick the lock."));
                return { ok: true, effects };
            }
            effects.push(buildMessageEffect(player, "You pick the lock on the chest."));
        }

        giveChestLoot(player, services, data, effects);
        services.skills.addSkillXp(player, SkillId.Thieving, data.xp);
        effects.push(buildMessageEffect(player, "You find some treasure in the chest!"));
        tracker?.addWithRandomDuration(
            nodeKey,
            tile,
            plane,
            tick,
            { min: data.respawnTicks, max: data.respawnTicks },
            { locId: data.locId },
        );
        if (data.teleport) {
            services.movement.teleportPlayer(
                player,
                data.teleport.x,
                data.teleport.y,
                data.teleport.level,
            );
            effects.push(buildMessageEffect(player, "A magical trap teleports you away!"));
        }
    }

    return { ok: true, effects };
}

function chestDataFromDef(
    def: ChestDef,
    locId: number,
    tile: { x: number; y: number },
    level: number,
    mode: ChestMode,
): ChestActionData {
    return {
        locId,
        chestId: def.id,
        reqLevel: def.reqLevel,
        xp: def.xp,
        alwaysLoot: def.alwaysLoot,
        lootTable: def.lootTable,
        respawnTicks: def.respawnTicks,
        requiresLockpick: def.requiresLockpick,
        hasTrap: def.hasTrap,
        trap: def.trap,
        teleport: def.teleport,
        mode,
        tile: { x: tile.x, y: tile.y },
        level,
        phase: 0,
    };
}

function requestChest(
    event: LocInteractionEvent,
    def: ChestDef,
    mode: ChestMode,
): void {
    const result = event.services.combat.requestAction(
        event.player,
        {
            kind: "skill.steal-chest",
            data: chestDataFromDef(def, event.locId, event.tile, event.level, mode),
            delayTicks: 0,
            cooldownTicks: 0,
            groups: ["skill.steal-chest"],
            rejectIfGroupPending: true,
        },
        event.tick,
    );
    if (!result.ok) {
        event.services.messaging.sendGameMessage(
            event.player,
            "You're too busy to do that right now.",
        );
    }
}

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerActionHandler("skill.steal-chest", executeChestAction);

    const chestTracker = new ResourceNodeTracker<{ locId: number }>();
    services.gathering?.registerTracker(CHEST_TRACKER, chestTracker, () => undefined);

    for (const def of CHESTS) {
        const openHandler = (event: LocInteractionEvent) => requestChest(event, def, "open");
        const stealMode: ChestMode = def.hasTrap ? "search" : "pick-lock";
        const stealHandler = (event: LocInteractionEvent) => requestChest(event, def, stealMode);

        for (const locId of def.locIds) {
            registry.registerLocInteraction(locId, openHandler, "open");
            for (const action of def.stealActions) {
                registry.registerLocInteraction(locId, stealHandler, action);
            }
            if (def.requiresLockpick) {
                registry.registerItemOnLoc(LOCKPICK_ITEM_ID, locId, (event) => {
                    requestChest(
                        {
                            player: event.player,
                            locId: event.target.locId,
                            tile: event.target.tile,
                            level: event.target.level,
                            action: stealMode,
                            tick: event.tick,
                            services: event.services,
                        } as LocInteractionEvent,
                        def,
                        stealMode,
                    );
                });
            }
        }
    }
}
