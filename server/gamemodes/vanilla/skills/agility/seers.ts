/**
 * Seers' Village rooftop course (level 60; current OSRS XP, 570/lap).
 * Fail-proof (OSRS can fail gap 1 and tightrope until 79; not ported — match Falador / Canifis).
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 * Kandarin hard extra edge XP is not wired (no per-player diary-complete gameplay API).
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (tightrope)
const CLIMB_ANIM = 828; // human_climb
const JUMP_ANIM = 769; // stepping-stone hop (gaps / edge)

const TIGHTROPE_MOVE_TICKS = 10;

const COURSE_LEVEL = 60;
const LAST_STAGE = 5;

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
        "You need an Agility level of 60 to attempt this.",
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
            "You have completed the Seers' Village rooftop course.",
        );
    }
}

function climbWall(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 2, 3, CLIMB_ANIM, 0);
    award(event, 45, 0, "You climb the wall...");
}

function leapGap1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 7, tile.y + 2, 2, JUMP_ANIM, 0);
    award(event, 20, 1, "You jump across the gap.");
}

function crossTightrope(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 9, 2, LOG_WALK_ANIM, TIGHTROPE_MOVE_TICKS);
    award(event, 20, 2, "You carefully cross the tightrope.");
}

function leapGap2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 4, 3, JUMP_ANIM, 0);
    award(event, 35, 3, "You jump across the gap.");
}

function leapGap3(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 2, tile.y - 4, 2, JUMP_ANIM, 0);
    award(event, 15, 4, "You jump across the gap.");
}

function jumpOffEdge(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 1, tile.y + 3, 0, JUMP_ANIM, 0);
    award(event, 435, 5, "You jump off the edge.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [14927],
        actions: ["climb", "climb-up", "climb up", undefined],
        run: climbWall,
    },
    {
        locIds: [14928],
        actions: ["jump", undefined],
        run: leapGap1,
    },
    {
        locIds: [14932],
        actions: ["cross", undefined],
        run: crossTightrope,
    },
    {
        locIds: [14929],
        actions: ["jump", undefined],
        run: leapGap2,
    },
    {
        locIds: [14930],
        actions: ["jump", undefined],
        run: leapGap3,
    },
    {
        locIds: [14931],
        actions: ["jump", undefined],
        run: jumpOffEdge,
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
export function resetSeersCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getSeersCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}