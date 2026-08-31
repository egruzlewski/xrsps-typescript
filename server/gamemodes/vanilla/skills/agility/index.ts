/**
 * Gnome Stronghold agility course (LostCity gnome_course.rs2, soft exact-move port).
 * Fail-proof; lap bonus only if obstacles are completed in order.
 * Barbarian Outpost, Wilderness, Draynor Village rooftop, and Al Kharid rooftop
 * are registered from sibling files.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";
import { register as registerAlKharid } from "./alkharid";
import { register as registerBarbarian } from "./barbarian";
import { register as registerDraynor } from "./draynor";
import { register as registerWilderness } from "./wilderness";

const LOG_WALK_ANIM = 762; // human_walk_logbalance
const CLIMB_ANIM = 828; // human_climb
const PIPE_CRAWL_ANIM = 844; // human_pipecrawling

const LOG_SPAN_TILES = 7;
const LOG_MOVE_TICKS = 7;
const ROPE_MOVE_TICKS = 6;
const PIPE_MOVE_TICKS = 7;

const LAST_STAGE = 6;

/** playerId → next expected stage (0 = log). */
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
    services.skills.addSkillXp(player, SkillId.Agility, xp);
    const lapComplete = completeObstacle(player, stage);
    if (endMessage) {
        services.messaging.sendGameMessage(player, endMessage);
    }
    if (lapComplete) {
        services.skills.addSkillXp(player, SkillId.Agility, 50);
        services.messaging.sendGameMessage(
            player,
            "You have completed the Gnome Stronghold agility course.",
        );
    }
}

function crossGnomeLog(event: LocInteractionEvent): void {
    const { player, tile } = event;
    const goingNorth = player.tileY <= tile.y;
    const destX = tile.x;
    const destY = player.tileY + (goingNorth ? LOG_SPAN_TILES : -LOG_SPAN_TILES);
    playMove(event, destX, destY, player.level, LOG_WALK_ANIM, LOG_MOVE_TICKS);
    award(
        event,
        10,
        0,
        "You walk carefully across the slippery log...",
        "...You make it safely to the other side.",
    );
}

function climbFirstNet(event: LocInteractionEvent): void {
    playMove(event, 2473, 3424, 1, CLIMB_ANIM, 0);
    award(event, 10, 1, "You climb the netting...");
}

function climbTreeUp(event: LocInteractionEvent): void {
    playMove(event, 2473, 3420, 2, CLIMB_ANIM, 0);
    award(event, 6.5, 2, "You climb the tree...");
}

function crossRope(event: LocInteractionEvent): void {
    const goingEast = event.player.tileX < 2480;
    const destX = goingEast ? 2483 : 2477;
    playMove(event, destX, 3420, 2, LOG_WALK_ANIM, ROPE_MOVE_TICKS);
    award(event, 10, 3, "You carefully cross the tightrope.");
}

function climbTreeDown(event: LocInteractionEvent): void {
    playMove(event, 2487, 3420, 0, CLIMB_ANIM, 0);
    award(event, 6.5, 4, "You climb down the tree...");
}

function climbSecondNet(event: LocInteractionEvent): void {
    playMove(event, 2483, 3427, 0, CLIMB_ANIM, 0);
    award(event, 10, 5, "You climb the netting...");
}

function squeezePipe(event: LocInteractionEvent): void {
    const destX = event.locId === 23139 ? 2487 : 2484;
    playMove(event, destX, 3437, 0, PIPE_CRAWL_ANIM, PIPE_MOVE_TICKS);
    award(event, 7.5, 6, "You squeeze into the pipe...");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [23145],
        actions: ["walk-across", "walk across", "cross", undefined],
        run: crossGnomeLog,
    },
    {
        locIds: [23133, 23134],
        actions: ["climb-over", "climb over", "climb", undefined],
        run: climbFirstNet,
    },
    {
        locIds: [23559],
        actions: ["climb", undefined],
        run: climbTreeUp,
    },
    {
        locIds: [23557, 23558],
        actions: ["walk-on", "walk on", "walk-across", "walk across", undefined],
        run: crossRope,
    },
    {
        locIds: [23560, 23561],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: climbTreeDown,
    },
    {
        locIds: [23135],
        actions: ["climb-over", "climb over", "climb", undefined],
        run: climbSecondNet,
    },
    {
        locIds: [23138, 23139],
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
    registerBarbarian(registry);
    registerWilderness(registry);
    registerDraynor(registry);
    registerAlKharid(registry);
}

/** Test helper: clear lap tracking for one player or all players. */
export function resetGnomeCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getGnomeCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}

export {
    getBarbarianCourseStage,
    resetBarbarianCourseProgress,
} from "./barbarian";
export {
    getAlKharidCourseStage,
    resetAlKharidCourseProgress,
} from "./alkharid";
export {
    getDraynorCourseStage,
    resetDraynorCourseProgress,
} from "./draynor";
export {
    getWildernessCourseStage,
    hasPendingWildernessTicket,
    resetWildernessCourseProgress,
} from "./wilderness";
