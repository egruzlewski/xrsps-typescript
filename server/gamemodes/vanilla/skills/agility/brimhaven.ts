/**
 * Brimhaven Agility Arena (current OSRS obstacle XP and ticket item).
 * Fail-proof (OSRS can fail most obstacles; not ported — match wilderness/gnome).
 * 1-minute dispenser rotation, entry fee, Karamja gloves, and voucher shop are not wired.
 * Tag awards a ticket after any obstacle (or the first tag); Redeem exchanges tickets for 345 XP each.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance
const ROPESWING_ANIM = 751; // human_ropeswing
const LEDGE_ANIM = 756; // human_walk_sidestep
const WALL_ANIM = 839; // human_walk_crumbledwall
const JUMP_ANIM = 769; // stepping-stone hop (pillars)
const MONKEYBARS_ANIM = 744; // human_monkeybars
const HANDHOLDS_ANIM = 1120; // hanging grab

const ROPESWING_MOVE_TICKS = 4;
const LOW_WALL_MOVE_TICKS = 5;
const PLANK_MOVE_TICKS = 9;
const BALANCE_ROPE_MOVE_TICKS = 9;
const LOG_MOVE_TICKS = 9;
const LEDGE_MOVE_TICKS = 9;
const MONKEYBARS_MOVE_TICKS = 13;
const PILLAR_MOVE_TICKS = 9;
const HANDHOLDS_MOVE_TICKS = 10;

const HANDHOLDS_LEVEL = 20;
const TICKET_XP_EACH = 345;
const TICKET_ITEM_ID = 29480;

const DISPENSER_LOC_IDS = [3608, 3581];

/** playerId → already tagged since last obstacle (rotation substitute). */
const taggedUntilObstacle = new Set<number>();

interface ObstacleDef {
    locIds: number[];
    actions: Array<string | undefined>;
    run: (event: LocInteractionEvent) => void;
}

function playMove(
    event: LocInteractionEvent,
    destX: number,
    destY: number,
    destLevel: number,
    anim: number,
    moveTicks: number,
): void {
    const { player, services, tick } = event;
    const startTile = { x: player.tileX, y: player.tileY };
    const startLevel = player.level;
    const endTile = { x: destX, y: destY };
    services.movement.teleportPlayer(player, destX, destY, destLevel);
    if (
        moveTicks > 0 &&
        destLevel === startLevel &&
        (destX !== startTile.x || destY !== startTile.y)
    ) {
        services.movement.queueForcedMovement(player, {
            startTile,
            endTile,
            endTick: tick + moveTicks,
        });
    }
    player.clearPendingSeqs();
    services.animation.playPlayerSeq(player, anim);
}

function agilityLevel(event: LocInteractionEvent): number {
    const skill = event.services.skills.getSkill(event.player, SkillId.Agility);
    return Math.max(1, (skill?.baseLevel ?? 1) + (skill?.boost ?? 0));
}

function axisDir(player: PlayerState, tile: { x: number; y: number }): { dx: number; dy: number } {
    const dx = tile.x - player.tileX;
    const dy = tile.y - player.tileY;
    if (dx === 0 && dy === 0) {
        return { dx: 0, dy: 1 };
    }
    if (Math.abs(dx) >= Math.abs(dy)) {
        return { dx: Math.sign(dx), dy: 0 };
    }
    return { dx: 0, dy: Math.sign(dy) };
}

function destFromPlayer(event: LocInteractionEvent, span: number): { x: number; y: number } {
    const { dx, dy } = axisDir(event.player, event.tile);
    return { x: event.player.tileX + dx * span, y: event.player.tileY + dy * span };
}

function destFromLoc(event: LocInteractionEvent, beyond: number): { x: number; y: number } {
    const { dx, dy } = axisDir(event.player, event.tile);
    return { x: event.tile.x + dx * beyond, y: event.tile.y + dy * beyond };
}

function award(event: LocInteractionEvent, xp: number, startMessage?: string, endMessage?: string): void {
    const { player, services } = event;
    if (startMessage) {
        services.messaging.sendGameMessage(player, startMessage);
    }
    if (xp > 0) {
        services.skills.addSkillXp(player, SkillId.Agility, xp);
    }
    taggedUntilObstacle.delete(player.id);
    if (endMessage) {
        services.messaging.sendGameMessage(player, endMessage);
    }
}

function cross(
    event: LocInteractionEvent,
    dest: { x: number; y: number },
    anim: number,
    moveTicks: number,
    xp: number,
    startMessage?: string,
    endMessage?: string,
): void {
    playMove(event, dest.x, dest.y, event.player.level, anim, moveTicks);
    award(event, xp, startMessage, endMessage);
}

function jumpPillars(event: LocInteractionEvent): void {
    cross(
        event,
        destFromLoc(event, 6),
        JUMP_ANIM,
        PILLAR_MOVE_TICKS,
        18,
        "You jump across the pillars.",
    );
}

function swingRope(event: LocInteractionEvent): void {
    cross(
        event,
        destFromPlayer(event, 5),
        ROPESWING_ANIM,
        ROPESWING_MOVE_TICKS,
        20,
        undefined,
        "You skillfully swing across.",
    );
}

function climbLowWall(event: LocInteractionEvent): void {
    cross(event, destFromPlayer(event, 3), WALL_ANIM, LOW_WALL_MOVE_TICKS, 8, "You climb over the wall.");
}

function walkPlank(event: LocInteractionEvent): void {
    cross(
        event,
        destFromPlayer(event, 7),
        LOG_WALK_ANIM,
        PLANK_MOVE_TICKS,
        6,
        "You walk carefully across the plank...",
        "...You make it safely to the other side.",
    );
}

function walkBalanceRope(event: LocInteractionEvent): void {
    cross(
        event,
        destFromPlayer(event, 7),
        LOG_WALK_ANIM,
        BALANCE_ROPE_MOVE_TICKS,
        10,
        "You carefully cross the balancing rope.",
    );
}

function walkLog(event: LocInteractionEvent): void {
    cross(
        event,
        destFromPlayer(event, 7),
        LOG_WALK_ANIM,
        LOG_MOVE_TICKS,
        12,
        "You walk carefully across the slippery log...",
        "You skillfully edge across the gap.",
    );
}

function walkLedge(event: LocInteractionEvent): void {
    cross(
        event,
        destFromPlayer(event, 7),
        LEDGE_ANIM,
        LEDGE_MOVE_TICKS,
        16,
        "You put your foot on the ledge and try to edge across...",
        "You skillfully edge across the gap.",
    );
}

function swingMonkeyBars(event: LocInteractionEvent): void {
    cross(
        event,
        destFromPlayer(event, 8),
        MONKEYBARS_ANIM,
        MONKEYBARS_MOVE_TICKS,
        14,
        "You swing across the monkey bars.",
    );
}

function climbHandHolds(event: LocInteractionEvent): void {
    const { player, services } = event;
    if (agilityLevel(event) < HANDHOLDS_LEVEL) {
        services.messaging.sendGameMessage(
            player,
            "You need an agility level of at least 20 to get past this obstacle!",
        );
        return;
    }
    cross(
        event,
        destFromLoc(event, 7),
        HANDHOLDS_ANIM,
        HANDHOLDS_MOVE_TICKS,
        22,
        "You climb across the hand holds.",
    );
}

function tagXpForLevel(level: number): number {
    return Math.min(300, Math.floor(level / 10) * 30);
}

function tagDispenser(event: LocInteractionEvent): void {
    const { player, services } = event;
    if (taggedUntilObstacle.has(player.id)) {
        services.messaging.sendGameMessage(
            player,
            "You can only get one ticket at a time, wait till the arrow moves again.",
        );
        return;
    }
    const result = services.inventory.addItemToInventory(player, TICKET_ITEM_ID, 1);
    if (result.added !== 1) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return;
    }
    taggedUntilObstacle.add(player.id);
    services.inventory.snapshotInventory(player);
    const xp = tagXpForLevel(agilityLevel(event));
    if (xp > 0) {
        services.skills.addSkillXp(player, SkillId.Agility, xp);
    }
    services.messaging.sendGameMessage(player, "You have received an Agility Arena Ticket.");
}

function redeemTickets(event: LocInteractionEvent): void {
    const { player, services } = event;
    const count = player.items?.getItemCount(TICKET_ITEM_ID) ?? 0;
    if (count <= 0) {
        services.messaging.sendGameMessage(
            player,
            "You don't have any Agility Arena tickets to redeem.",
        );
        return;
    }
    const removed = player.items.removeItem(TICKET_ITEM_ID, count, { assureFullRemoval: true });
    if (removed.completed !== count) {
        services.messaging.sendGameMessage(
            player,
            "You don't have any Agility Arena tickets to redeem.",
        );
        return;
    }
    services.inventory.snapshotInventory(player);
    const xp = count * TICKET_XP_EACH;
    services.skills.addSkillXp(player, SkillId.Agility, xp);
    services.messaging.sendGameMessage(
        player,
        `You redeem ${count} Agility Arena ticket${count === 1 ? "" : "s"} for ${xp} Agility experience.`,
    );
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [3578, 3579],
        actions: ["jump-on", "jump on", "jump", undefined],
        run: jumpPillars,
    },
    {
        locIds: [3566],
        actions: ["swing-on", "swing on", "swing", undefined],
        run: swingRope,
    },
    {
        locIds: [3565],
        actions: ["climb-over", "climb over", "climb", undefined],
        run: climbLowWall,
    },
    {
        locIds: [3570, 3571, 3572],
        actions: ["walk-on", "walk on", "walk", undefined],
        run: walkPlank,
    },
    {
        locIds: [3551, 3552],
        actions: ["walk-on", "walk on", "walk", undefined],
        run: walkBalanceRope,
    },
    {
        locIds: [3553, 3554],
        actions: ["walk-on", "walk on", "walk", undefined],
        run: walkLog,
    },
    {
        locIds: [3559, 3560, 3561, 3562],
        actions: ["walk-across", "walk across", "cross", undefined],
        run: walkLedge,
    },
    {
        locIds: [3563, 3564],
        actions: ["swing-across", "swing across", "swing", undefined],
        run: swingMonkeyBars,
    },
    {
        locIds: [3583, 3584],
        actions: ["climb-across", "climb across", "climb", undefined],
        run: climbHandHolds,
    },
];

export function register(registry: IScriptRegistry): void {
    for (const obstacle of OBSTACLES) {
        for (const locId of obstacle.locIds) {
            for (const action of obstacle.actions) {
                registry.registerLocInteraction(locId, obstacle.run, action);
            }
        }
    }
    for (const locId of DISPENSER_LOC_IDS) {
        for (const action of ["tag", undefined] as Array<string | undefined>) {
            registry.registerLocInteraction(locId, tagDispenser, action);
        }
        registry.registerLocInteraction(locId, redeemTickets, "redeem");
    }
}

/** Test helper: clear tag tracking for one player or all players. */
export function resetBrimhavenArenaProgress(playerId?: number): void {
    if (playerId === undefined) {
        taggedUntilObstacle.clear();
        return;
    }
    taggedUntilObstacle.delete(playerId);
}

export function hasTaggedBrimhavenDispenser(playerId: number): boolean {
    return taggedUntilObstacle.has(playerId);
}
