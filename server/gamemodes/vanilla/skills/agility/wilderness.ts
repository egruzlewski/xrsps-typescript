/**
 * Wilderness agility course (LostCity wilderness_course.rs2 dest tiles, current OSRS XP).
 * Fail-proof (fail damage/dungeon drops exist in OSRS; not ported — match gnome/barbarian).
 * Rocks award 498.9 only if obstacles were completed in order (571.4/lap).
 * Dispenser Tag/Redeem (ticket XP) is wired; Pay/loot is not (clue scrolls missing).
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import { RUN_ENERGY_MAX } from "../../../../src/game/actor";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance
const CLIMB_ANIM = 737; // human_climbing
const PIPE_CRAWL_ANIM = 844; // human_pipecrawling
const ROPESWING_ANIM = 751; // human_ropeswing
const STONE_JUMP_ANIM = 769; // stepping-stone hop

const PIPE_MOVE_TICKS = 7;
const ROPESWING_MOVE_TICKS = 5;
const STONE_MOVE_TICKS = 6;
const LOG_MOVE_TICKS = 8;
const ROCKS_MOVE_TICKS = 3;

const PIPE_LEVEL = 49;
const LAST_STAGE = 4;
const LAP_AGILITY_XP = 498.9;
const PIPE_NORTH_MIN_Y = 3939;
const PIPE_DEST_Y = 3950;

const DISPENSER_LOC_ID = 53224;
const TICKET_ITEM_ID = 29460;

/** playerId → next expected stage (0 = pipe). */
const courseProgress = new Map<number, number>();
/** Lap finished but dispenser not tagged yet. */
const pendingTickets = new Set<number>();

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

function completeObstacle(player: PlayerState, stage: number): boolean {
    const expected = courseProgress.get(player.id) ?? 0;
    if (stage === LAST_STAGE) {
        courseProgress.delete(player.id);
        return expected === LAST_STAGE;
    }
    if (expected === stage) {
        courseProgress.set(player.id, stage + 1);
    } else if (stage === 0) {
        courseProgress.set(player.id, 1);
    } else {
        courseProgress.delete(player.id);
    }
    return false;
}

function award(
    event: LocInteractionEvent,
    xp: number,
    stage: number,
    startMessage?: string,
    endMessage?: string,
): boolean {
    const { player, services } = event;
    if (startMessage) {
        services.messaging.sendGameMessage(player, startMessage);
    }
    if (xp > 0) {
        services.skills.addSkillXp(player, SkillId.Agility, xp);
    }
    const lapComplete = completeObstacle(player, stage);
    if (endMessage) {
        services.messaging.sendGameMessage(player, endMessage);
    }
    if (lapComplete) {
        services.skills.addSkillXp(player, SkillId.Agility, LAP_AGILITY_XP);
        pendingTickets.add(player.id);
        services.messaging.sendGameMessage(
            player,
            "You have completed the Wilderness agility course.",
        );
    }
    return lapComplete;
}

function squeezePipe(event: LocInteractionEvent): void {
    const { player, tile, services } = event;
    if (player.tileY >= PIPE_NORTH_MIN_Y) {
        services.messaging.sendGameMessage(player, "You can't enter the pipe from this side.");
        return;
    }
    if (agilityLevel(event) < PIPE_LEVEL) {
        services.messaging.sendGameMessage(
            player,
            "You need an Agility level of 49 to squeeze through the pipe.",
        );
        return;
    }
    pendingTickets.delete(player.id);
    playMove(event, tile.x, PIPE_DEST_Y, 0, PIPE_CRAWL_ANIM, PIPE_MOVE_TICKS);
    award(event, 12.5, 0, "You squeeze into the pipe...");
}

function swingRope(event: LocInteractionEvent): void {
    const { player, tile, services } = event;
    const startY = tile.y + 1;
    if (player.tileY > startY) {
        services.messaging.sendGameMessage(player, "You cannot do that from here.");
        return;
    }
    playMove(event, tile.x, startY + 5, 0, ROPESWING_ANIM, ROPESWING_MOVE_TICKS);
    award(event, 20, 1, undefined, "You skillfully swing across.");
}

function crossStones(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x - 5, tile.y, 0, STONE_JUMP_ANIM, STONE_MOVE_TICKS);
    award(
        event,
        20,
        2,
        "You carefully start crossing the stepping stones...",
        "...You safely cross to the other side.",
    );
}

function crossLog(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x - 7, tile.y, 0, LOG_WALK_ANIM, LOG_MOVE_TICKS);
    award(
        event,
        20,
        3,
        "You walk carefully across the slippery log...",
        "You skillfully edge across the gap.",
    );
}

function climbRocks(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x, tile.y - 3, 0, CLIMB_ANIM, ROCKS_MOVE_TICKS);
    award(event, 0, 4);
}

function ticketXpPerTicket(count: number): number {
    if (count >= 101) return 230;
    if (count >= 51) return 220;
    if (count >= 11) return 210;
    return 200;
}

function tagDispenser(event: LocInteractionEvent): void {
    const { player, services } = event;
    player.energy?.setRunEnergyUnits(RUN_ENERGY_MAX);
    if (!pendingTickets.has(player.id)) {
        services.messaging.sendGameMessage(player, "The dispenser restores your run energy.");
        return;
    }
    pendingTickets.delete(player.id);
    const result = services.inventory.addItemToInventory(player, TICKET_ITEM_ID, 1);
    if (result.added !== 1) {
        pendingTickets.add(player.id);
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return;
    }
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(
        player,
        "You receive a Wilderness agility ticket. The dispenser restores your run energy.",
    );
}

function redeemTickets(event: LocInteractionEvent): void {
    const { player, services } = event;
    const count = player.items?.getItemCount(TICKET_ITEM_ID) ?? 0;
    if (count <= 0) {
        services.messaging.sendGameMessage(
            player,
            "You don't have any Wilderness agility tickets to redeem.",
        );
        return;
    }
    const removed = player.items.removeItem(TICKET_ITEM_ID, count, { assureFullRemoval: true });
    if (removed.completed !== count) {
        services.messaging.sendGameMessage(
            player,
            "You don't have any Wilderness agility tickets to redeem.",
        );
        return;
    }
    services.inventory.snapshotInventory(player);
    const xp = count * ticketXpPerTicket(count);
    services.skills.addSkillXp(player, SkillId.Agility, xp);
    services.messaging.sendGameMessage(
        player,
        `You redeem ${count} Wilderness agility ticket${count === 1 ? "" : "s"} for ${xp} Agility experience.`,
    );
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [23137],
        actions: ["squeeze-through", "squeeze through", "squeeze", undefined],
        run: squeezePipe,
    },
    {
        locIds: [23132],
        actions: ["swing-on", "swing on", "swing", undefined],
        run: swingRope,
    },
    {
        locIds: [23556],
        actions: ["cross", "jump-from", "jump from", undefined],
        run: crossStones,
    },
    {
        locIds: [23542],
        actions: ["walk-across", "walk across", "cross", undefined],
        run: crossLog,
    },
    {
        locIds: [23640],
        actions: ["climb", undefined],
        run: climbRocks,
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
    for (const action of ["tag", undefined] as Array<string | undefined>) {
        registry.registerLocInteraction(DISPENSER_LOC_ID, tagDispenser, action);
    }
    registry.registerLocInteraction(DISPENSER_LOC_ID, redeemTickets, "redeem");
}

/** Test helper: clear lap tracking for one player or all players. */
export function resetWildernessCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        pendingTickets.clear();
        return;
    }
    courseProgress.delete(playerId);
    pendingTickets.delete(playerId);
}

export function getWildernessCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}

export function hasPendingWildernessTicket(playerId: number): boolean {
    return pendingTickets.has(playerId);
}
