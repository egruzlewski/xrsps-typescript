/**
 * Rellekka rooftop course (level 80; current OSRS XP, 780/lap).
 * Fail-proof (OSRS can fail the first tightrope until 85; not ported — match Pollnivneach / Seers).
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 * Fremennik hard extra pile-of-fish XP is not wired (no per-player diary-complete gameplay API).
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (tightrope)
const CLIMB_ANIM = 828; // human_climb
const JUMP_ANIM = 769; // stepping-stone hop (gaps / hurdle / pile of fish)

const GAP1_MOVE_TICKS = 4;
const TIGHTROPE1_MOVE_TICKS = 5;
const GAP2_MOVE_TICKS = 8;
const GAP3_MOVE_TICKS = 4;
const TIGHTROPE2_MOVE_TICKS = 8;

const COURSE_LEVEL = 80;
const LAST_STAGE = 6;

/** playerId → next expected stage (0 = wall). */
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

function requireCourseLevel(event: LocInteractionEvent): boolean {
    if (agilityLevel(event) >= COURSE_LEVEL) {
        return true;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        "You need an Agility level of 80 to attempt this.",
    );
    return false;
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
            "You have completed the Rellekka rooftop course.",
        );
    }
}

function climbWall(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 1, 3, CLIMB_ANIM, 0);
    award(event, 20, 0, "You climb the wall...");
}

function leapGap1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 1, tile.y - 1, 3, JUMP_ANIM, GAP1_MOVE_TICKS);
    award(event, 30, 1, "You leap across the gap.");
}

function crossTightrope1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 4, tile.y - 4, 3, LOG_WALK_ANIM, TIGHTROPE1_MOVE_TICKS);
    award(event, 40, 2, "You carefully cross the tightrope.");
}

function leapGap2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 10, tile.y - 3, 3, JUMP_ANIM, GAP2_MOVE_TICKS);
    award(event, 85, 3, "You leap across the gap.");
}

function hurdleGap3(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 3, 3, JUMP_ANIM, GAP3_MOVE_TICKS);
    award(event, 25, 4, "You hurdle across the gap.");
}

function crossTightrope2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 8, tile.y + 7, 3, LOG_WALK_ANIM, TIGHTROPE2_MOVE_TICKS);
    award(event, 105, 5, "You carefully cross the tightrope.");
}

function jumpPileOfFish(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 1, tile.y, 0, JUMP_ANIM, 0);
    award(event, 475, 6, "You jump into the pile of fish.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [14946],
        actions: ["climb", "climb-up", "climb up", undefined],
        run: climbWall,
    },
    {
        locIds: [14947],
        actions: ["leap", "jump", undefined],
        run: leapGap1,
    },
    {
        locIds: [14987],
        actions: ["cross", undefined],
        run: crossTightrope1,
    },
    {
        locIds: [14990],
        actions: ["leap", "jump", undefined],
        run: leapGap2,
    },
    {
        locIds: [14991],
        actions: ["hurdle", "jump", "leap", undefined],
        run: hurdleGap3,
    },
    {
        locIds: [14992],
        actions: ["cross", undefined],
        run: crossTightrope2,
    },
    {
        locIds: [14994],
        actions: ["jump-in", "jump in", "jump", undefined],
        run: jumpPileOfFish,
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
export function resetRellekkaCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getRellekkaCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
