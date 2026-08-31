/**
 * Prifddinas Agility Course (level 75; current OSRS XP, 1285.2/lap).
 * Fail-proof (OSRS can fail tightropes / chimney until 91; not ported — match Pollnivneach / Seers).
 * Marks of Grace are not spawned (course does not drop them). Crystal shards and portal
 * shortcuts are not wired (no player-specific loc-spawn / portal API).
 * Song of the Elves access lock is not wired (quest is not registered).
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (tightrope / rope bridge)
const CLIMB_ANIM = 828; // human_climb (ladders / dark holes)
const JUMP_ANIM = 769; // stepping-stone hop (chimney / roof edge)

const TIGHTROPE1_MOVE_TICKS = 12;
const CHIMNEY_MOVE_TICKS = 5;
const ROPE_BRIDGE1_MOVE_TICKS = 8;
const TIGHTROPE2_MOVE_TICKS = 10;
const ROPE_BRIDGE2_MOVE_TICKS = 8;
const TIGHTROPE3_MOVE_TICKS = 10;

const COURSE_LEVEL = 75;
const LAST_STAGE = 11;

/** playerId → next expected stage (0 = start ladder). */
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
        "You need an Agility level of 75 to attempt this.",
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
            "You have completed the Prifddinas Agility Course.",
        );
    }
}

function climbStartLadder(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 2, 2, CLIMB_ANIM, 0);
    award(event, 11.5, 0, "You climb the ladder...");
}

function crossTightrope1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 15, tile.y + 2, 2, LOG_WALK_ANIM, TIGHTROPE1_MOVE_TICKS);
    award(event, 30.7, 1, "You carefully cross the tightrope.");
}

function jumpChimney(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 4, tile.y + 8, 2, JUMP_ANIM, CHIMNEY_MOVE_TICKS);
    award(event, 28.1, 2, "You jump across the chimney.");
}

function jumpRoofEdge(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 2, 0, JUMP_ANIM, 0);
    award(event, 23, 3, "You jump off the roof edge.");
}

function enterDarkHole1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 25, tile.y + 27, 0, CLIMB_ANIM, 0);
    award(event, 11.5, 4, "You squeeze into the dark hole...");
}

function climbTreeLadder(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 6, tile.y - 3, 2, CLIMB_ANIM, 0);
    award(event, 0, 5, "You climb the ladder...");
}

function crossRopeBridge1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 11, tile.y, 2, LOG_WALK_ANIM, ROPE_BRIDGE1_MOVE_TICKS);
    award(event, 25.6, 6, "You cross the rope bridge.");
}

function crossTightrope2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 7, tile.y + 9, 2, LOG_WALK_ANIM, TIGHTROPE2_MOVE_TICKS);
    award(event, 30.7, 7, "You carefully cross the tightrope.");
}

function crossRopeBridge2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 3, tile.y + 10, 2, LOG_WALK_ANIM, ROPE_BRIDGE2_MOVE_TICKS);
    award(event, 25.6, 8, "You cross the rope bridge.");
}

function crossTightrope3(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 10, tile.y + 9, 2, LOG_WALK_ANIM, TIGHTROPE3_MOVE_TICKS);
    award(event, 30.7, 9, "You carefully cross the tightrope.");
}

function crossTightrope4(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 5, tile.y + 14, 0, LOG_WALK_ANIM, 0);
    award(event, 30.7, 10, "You carefully cross the tightrope.");
}

function enterDarkHoleEnd(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 29, tile.y - 77, 0, CLIMB_ANIM, 0);
    award(event, 1037.1, 11, "You squeeze into the dark hole...");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [36221],
        actions: ["climb", "climb-up", "climb up", undefined],
        run: climbStartLadder,
    },
    {
        locIds: [36225],
        actions: ["cross", undefined],
        run: crossTightrope1,
    },
    {
        locIds: [36227],
        actions: ["jump", undefined],
        run: jumpChimney,
    },
    {
        locIds: [36228],
        actions: ["jump", undefined],
        run: jumpRoofEdge,
    },
    {
        locIds: [36229],
        actions: ["enter", undefined],
        run: enterDarkHole1,
    },
    {
        locIds: [36231],
        actions: ["climb", "climb-up", "climb up", undefined],
        run: climbTreeLadder,
    },
    {
        locIds: [36233],
        actions: ["cross", undefined],
        run: crossRopeBridge1,
    },
    {
        locIds: [36234],
        actions: ["cross", undefined],
        run: crossTightrope2,
    },
    {
        locIds: [36235],
        actions: ["cross", undefined],
        run: crossRopeBridge2,
    },
    {
        locIds: [36236],
        actions: ["cross", undefined],
        run: crossTightrope3,
    },
    {
        locIds: [36237],
        actions: ["cross", undefined],
        run: crossTightrope4,
    },
    {
        locIds: [36238],
        actions: ["enter", undefined],
        run: enterDarkHoleEnd,
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
export function resetPrifddinasCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getPrifddinasCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
