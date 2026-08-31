/**
 * Barbarian Outpost agility course (LostCity barbarian_course.rs2, current OSRS XP).
 * Fail-proof; lap bonus only if obstacles are completed in order.
 * Entrance pipe is a 35 Agility shortcut, not part of the lap.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance
const CLIMB_ANIM = 828; // human_climb
const PIPE_CRAWL_ANIM = 844; // human_pipecrawling
const ROPESWING_ANIM = 751; // human_ropeswing
const LEDGE_ANIM = 756; // human_walk_sidestep
const WALL_ANIM = 839; // human_walk_crumbledwall

const ROPESWING_MOVE_TICKS = 5;
const LOG_MOVE_TICKS = 10;
const LEDGE_MOVE_TICKS = 4;
const WALL_MOVE_TICKS = 2;
const PIPE_MOVE_TICKS = 4;

const PIPE_LEVEL = 35;
const LAST_STAGE = 7;
const LAP_AGILITY_XP = 46.3;
const LAP_STRENGTH_XP = 41.3;

const WALL_STAGE_BY_X: Record<number, number> = {
    2536: 5,
    2539: 6,
    2542: 7,
};

/** playerId → next expected stage (0 = ropeswing). */
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
    stage: number | null,
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
    const lapComplete = stage === null ? false : completeObstacle(player, stage);
    if (endMessage) {
        services.messaging.sendGameMessage(player, endMessage);
    }
    if (lapComplete) {
        services.skills.addSkillXp(player, SkillId.Agility, LAP_AGILITY_XP);
        services.skills.addSkillXp(player, SkillId.Strength, LAP_STRENGTH_XP);
        services.messaging.sendGameMessage(
            player,
            "You have completed the Barbarian Outpost agility course.",
        );
    }
}

function swingRope(event: LocInteractionEvent): void {
    const { player, tile } = event;
    if (player.tileY <= tile.y) {
        event.services.messaging.sendGameMessage(player, "You cannot do that from here.");
        return;
    }
    playMove(event, tile.x, tile.y - 1, 0, ROPESWING_ANIM, ROPESWING_MOVE_TICKS);
    award(event, 22, 0, undefined, "You skillfully swing across.");
}

function crossLog(event: LocInteractionEvent): void {
    const { player, tile } = event;
    const goingWest = player.tileX > tile.x;
    const destX = goingWest ? tile.x - 9 : tile.x + 1;
    playMove(event, destX, tile.y, 0, LOG_WALK_ANIM, LOG_MOVE_TICKS);
    award(
        event,
        13.7,
        1,
        "You walk carefully across the slippery log...",
        "...You make it safely to the other side.",
    );
}

function climbNet(event: LocInteractionEvent): void {
    const { player, tile } = event;
    if (player.tileX <= tile.x) {
        return;
    }
    playMove(event, tile.x - 1, tile.y + 1, 1, CLIMB_ANIM, 0);
    award(event, 8.2, 2, "You climb the netting...");
}

function crossLedge(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x - 3, tile.y - 1, 1, LEDGE_ANIM, LEDGE_MOVE_TICKS);
    award(
        event,
        22,
        3,
        "You put your foot on the ledge and try to edge across...",
        "You skillfully edge across the gap.",
    );
}

function climbLadder(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x, tile.y + 1, 0, CLIMB_ANIM, 0);
    award(event, 0, 4, "You climb down the ladder...");
}

function climbWall(event: LocInteractionEvent): void {
    const { player, tile } = event;
    const stage = WALL_STAGE_BY_X[tile.x];
    if (stage === undefined || tile.y !== 3553) {
        return;
    }
    if (player.tileX > tile.x) {
        event.services.messaging.sendGameMessage(player, "You cannot climb that from this side.");
        return;
    }
    playMove(event, tile.x + 1, tile.y, 0, WALL_ANIM, WALL_MOVE_TICKS);
    award(event, 13.7, stage, "You climb the low wall...");
}

function squeezePipe(event: LocInteractionEvent): void {
    const { player, tile } = event;
    const entering = player.tileY > tile.y;
    if (entering && agilityLevel(event) < PIPE_LEVEL) {
        event.services.messaging.sendGameMessage(
            player,
            "You need an Agility level of 35 to squeeze through the pipe.",
        );
        return;
    }
    const destY = entering ? tile.y - 1 : tile.y + 2;
    playMove(event, tile.x, destY, 0, PIPE_CRAWL_ANIM, PIPE_MOVE_TICKS);
    award(event, 10, null, "You squeeze into the pipe...");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [23131],
        actions: ["swing-on", "swing on", "swing", undefined],
        run: swingRope,
    },
    {
        locIds: [23144],
        actions: ["walk-across", "walk across", "cross", undefined],
        run: crossLog,
    },
    {
        locIds: [20211],
        actions: ["climb-over", "climb over", "climb", undefined],
        run: climbNet,
    },
    {
        locIds: [23547],
        actions: ["walk-across", "walk across", "walk-on", "walk on", undefined],
        run: crossLedge,
    },
    {
        locIds: [16682],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: climbLadder,
    },
    {
        locIds: [1948],
        actions: ["climb-over", "climb over", "climb", undefined],
        run: climbWall,
    },
    {
        locIds: [20210],
        actions: ["squeeze-through", "squeeze through", "squeeze", undefined],
        run: squeezePipe,
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
export function resetBarbarianCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getBarbarianCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
