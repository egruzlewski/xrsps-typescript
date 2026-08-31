/**
 * Falador rooftop course (level 50; current OSRS XP, 586/lap).
 * Fail-proof (OSRS can fail hand holds until 66; not ported — match Canifis / Varrock).
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (tightrope)
const CLIMB_ANIM = 828; // human_climb
const JUMP_ANIM = 769; // stepping-stone hop (gaps / ledges / edge)
const HANDHOLDS_ANIM = 1120; // hanging hand holds

const TIGHTROPE1_MOVE_TICKS = 7;
const HANDHOLDS_MOVE_TICKS = 12;
const GAP1_MOVE_TICKS = 4;
const GAP2_MOVE_TICKS = 3;
const TIGHTROPE2_MOVE_TICKS = 11;
const TIGHTROPE3_MOVE_TICKS = 5;
const GAP3_MOVE_TICKS = 4;
const LEDGE1_MOVE_TICKS = 5;
const LEDGE2_MOVE_TICKS = 3;
const LEDGE3_MOVE_TICKS = 2;
const LEDGE4_MOVE_TICKS = 5;

const COURSE_LEVEL = 50;
const LAST_STAGE = 12;

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
        "You need an Agility level of 50 to attempt this.",
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
            "You have completed the Falador rooftop course.",
        );
    }
}

function climbRoughWall(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 1, 3, CLIMB_ANIM, 0);
    award(event, 11, 0, "You climb the wall...");
}

function crossTightrope1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 7, tile.y + 1, 3, LOG_WALK_ANIM, TIGHTROPE1_MOVE_TICKS);
    award(event, 22, 1, "You carefully cross the tightrope.");
}

function crossHandHolds(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 7, 3, HANDHOLDS_ANIM, HANDHOLDS_MOVE_TICKS);
    award(event, 61, 2, "You climb across the hand holds.");
}

function leapGap1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 2, 3, JUMP_ANIM, GAP1_MOVE_TICKS);
    award(event, 27, 3, "You jump across the gap.");
}

function leapGap2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 3, tile.y, 3, JUMP_ANIM, GAP2_MOVE_TICKS);
    award(event, 26, 4, "You jump across the gap.");
}

function crossTightrope2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 6, tile.y - 7, 3, LOG_WALK_ANIM, TIGHTROPE2_MOVE_TICKS);
    award(event, 61, 5, "You carefully cross the tightrope.");
}

function crossTightrope3(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 6, tile.y, 3, LOG_WALK_ANIM, TIGHTROPE3_MOVE_TICKS);
    award(event, 53, 6, "You carefully cross the tightrope.");
}

function leapGap3(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 3, 3, JUMP_ANIM, GAP3_MOVE_TICKS);
    award(event, 30, 7, "You jump across the gap.");
}

function jumpLedge1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 1, tile.y, 3, JUMP_ANIM, LEDGE1_MOVE_TICKS);
    award(event, 14, 8, "You jump across the ledge.");
}

function jumpLedge2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 1, 3, JUMP_ANIM, LEDGE2_MOVE_TICKS);
    award(event, 13, 9, "You jump across the ledge.");
}

function jumpLedge3(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 1, 3, JUMP_ANIM, LEDGE3_MOVE_TICKS);
    award(event, 13, 10, "You jump across the ledge.");
}

function jumpLedge4(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 1, tile.y, 3, JUMP_ANIM, LEDGE4_MOVE_TICKS);
    award(event, 14, 11, "You jump across the ledge.");
}

function jumpOffEdge(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 4, tile.y, 0, JUMP_ANIM, 0);
    award(event, 241, 12, "You jump off the edge.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [14898],
        actions: ["climb", undefined],
        run: climbRoughWall,
    },
    {
        locIds: [14899],
        actions: ["cross", undefined],
        run: crossTightrope1,
    },
    {
        locIds: [14901],
        actions: ["cross", undefined],
        run: crossHandHolds,
    },
    {
        locIds: [14903],
        actions: ["jump", undefined],
        run: leapGap1,
    },
    {
        locIds: [14904],
        actions: ["jump", undefined],
        run: leapGap2,
    },
    {
        locIds: [14905],
        actions: ["cross", undefined],
        run: crossTightrope2,
    },
    {
        locIds: [14911],
        actions: ["cross", undefined],
        run: crossTightrope3,
    },
    {
        locIds: [14919],
        actions: ["jump", undefined],
        run: leapGap3,
    },
    {
        locIds: [14920],
        actions: ["jump", undefined],
        run: jumpLedge1,
    },
    {
        locIds: [14921],
        actions: ["jump", undefined],
        run: jumpLedge2,
    },
    {
        locIds: [14922],
        actions: ["jump", undefined],
        run: jumpLedge3,
    },
    {
        locIds: [14924],
        actions: ["jump", undefined],
        run: jumpLedge4,
    },
    {
        locIds: [14925],
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
export function resetFaladorCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getFaladorCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
