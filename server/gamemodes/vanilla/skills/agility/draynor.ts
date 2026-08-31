/**
 * Draynor Village rooftop course (first F2P rooftop; current OSRS XP, 120/lap).
 * Fail-proof (OSRS also fail-proof since May 2024). Level 1 — no requirement check.
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (tightrope)
const CLIMB_ANIM = 828; // human_climb
const LEDGE_ANIM = 756; // human_walk_sidestep (narrow wall)
const JUMP_ANIM = 769; // stepping-stone hop (gap)

const TIGHTROPE_MOVE_TICKS = 8;
const NARROW_WALL_MOVE_TICKS = 4;
const WALL_JUMP_MOVE_TICKS = 2;
const GAP_MOVE_TICKS = 3;

const LAST_STAGE = 6;

/** playerId → next expected stage (0 = rough wall). */
const courseProgress = new Map<number, number>();

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
): void {
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
        services.messaging.sendGameMessage(
            player,
            "You have completed the Draynor Village rooftop course.",
        );
    }
}

function climbRoughWall(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x + 2, tile.y, 3, CLIMB_ANIM, 0);
    award(event, 5, 0, "You climb the wall...");
}

function crossTightrope1(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x - 8, tile.y - 1, 3, LOG_WALK_ANIM, TIGHTROPE_MOVE_TICKS);
    award(event, 8, 1, "You carefully cross the tightrope.");
}

function crossTightrope2(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x, tile.y - 10, 3, LOG_WALK_ANIM, TIGHTROPE_MOVE_TICKS);
    award(event, 7, 2, "You carefully cross the tightrope.");
}

function balanceNarrowWall(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x, tile.y - 5, 3, LEDGE_ANIM, NARROW_WALL_MOVE_TICKS);
    award(
        event,
        7,
        3,
        "You put your foot on the ledge and try to edge across...",
        "You skillfully edge across the gap.",
    );
}

function jumpUpWall(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x, tile.y - 1, 3, CLIMB_ANIM, WALL_JUMP_MOVE_TICKS);
    award(event, 10, 4, "You jump up onto the wall...");
}

function jumpGap(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x + 1, tile.y + 1, 3, JUMP_ANIM, GAP_MOVE_TICKS);
    award(event, 4, 5, "You jump across the gap.");
}

function climbDownCrate(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x + 1, tile.y, 0, CLIMB_ANIM, 0);
    award(event, 79, 6, "You climb down the crate...");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [11404],
        actions: ["climb", undefined],
        run: climbRoughWall,
    },
    {
        locIds: [11405],
        actions: ["cross", undefined],
        run: crossTightrope1,
    },
    {
        locIds: [11406],
        actions: ["cross", undefined],
        run: crossTightrope2,
    },
    {
        locIds: [11430],
        actions: ["balance", "walk-across", "walk across", undefined],
        run: balanceNarrowWall,
    },
    {
        locIds: [11630],
        actions: ["jump-up", "jump up", "jump", undefined],
        run: jumpUpWall,
    },
    {
        locIds: [11631],
        actions: ["jump", undefined],
        run: jumpGap,
    },
    {
        locIds: [11632],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: climbDownCrate,
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
}

/** Test helper: clear lap tracking for one player or all players. */
export function resetDraynorCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getDraynorCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
