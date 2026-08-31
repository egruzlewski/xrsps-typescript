/**
 * Varrock rooftop course (level 30; current OSRS XP, 270/lap).
 * Fail-proof (OSRS can fail clothes line and wall; not ported — match Draynor / Al Kharid).
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (clothes line)
const CLIMB_ANIM = 828; // human_climb
const LEDGE_ANIM = 756; // human_walk_sidestep (balance wall)
const JUMP_ANIM = 769; // stepping-stone hop (gaps / ledge / edge)

const CLOTHES_LINE_MOVE_TICKS = 6;
const GAP2_MOVE_TICKS = 8;
const GAP3_MOVE_TICKS = 5;
const GAP4_MOVE_TICKS = 5;
const LEDGE_MOVE_TICKS = 3;

const COURSE_LEVEL = 30;
const LAST_STAGE = 8;

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
        "You need an Agility level of 30 to attempt this.",
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
            "You have completed the Varrock rooftop course.",
        );
    }
}

function climbRoughWall(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 2, tile.y, 3, CLIMB_ANIM, 0);
    award(event, 13.5, 0, "You climb the wall...");
}

function crossClothesLine(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 6, tile.y, 3, LOG_WALK_ANIM, CLOTHES_LINE_MOVE_TICKS);
    award(event, 23, 1, "You carefully cross the clothes line.");
}

function leapGap1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 4, tile.y, 1, JUMP_ANIM, 0);
    award(event, 19, 2, "You jump across the gap.");
}

function balanceWall(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 2, tile.y - 10, 3, LEDGE_ANIM, 0);
    award(
        event,
        28,
        3,
        "You put your foot on the ledge and try to edge across...",
        "You skillfully edge across the gap.",
    );
}

function leapGap2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 4, 3, JUMP_ANIM, GAP2_MOVE_TICKS);
    award(event, 10, 4, "You jump across the gap.");
}

function leapGap3(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    playMove(event, 3218, 3399, 3, JUMP_ANIM, GAP3_MOVE_TICKS);
    award(event, 24.5, 5, "You jump across the gap.");
}

function leapGap4(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 5, tile.y + 1, 3, JUMP_ANIM, GAP4_MOVE_TICKS);
    award(event, 4.5, 6, "You jump across the gap.");
}

function hurdleLedge(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 2, 3, JUMP_ANIM, LEDGE_MOVE_TICKS);
    award(event, 3.5, 7, "You hurdle the ledge.");
}

function jumpOffEdge(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 2, 0, JUMP_ANIM, 0);
    award(event, 143.7, 8, "You jump off the edge.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [14412],
        actions: ["climb", undefined],
        run: climbRoughWall,
    },
    {
        locIds: [14413],
        actions: ["cross", undefined],
        run: crossClothesLine,
    },
    {
        locIds: [14414],
        actions: ["leap", "jump", undefined],
        run: leapGap1,
    },
    {
        locIds: [14832],
        actions: ["balance", "walk-across", "walk across", undefined],
        run: balanceWall,
    },
    {
        locIds: [14833],
        actions: ["leap", "jump", undefined],
        run: leapGap2,
    },
    {
        locIds: [14834],
        actions: ["leap", "jump", undefined],
        run: leapGap3,
    },
    {
        locIds: [14835],
        actions: ["leap", "jump", undefined],
        run: leapGap4,
    },
    {
        locIds: [14836],
        actions: ["hurdle", undefined],
        run: hurdleLedge,
    },
    {
        locIds: [14841],
        actions: ["jump-off", "jump off", "jump", undefined],
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
export function resetVarrockCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getVarrockCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
