/**
 * Al Kharid rooftop course (level 20; current OSRS XP, 216/lap).
 * Fail-proof (OSRS can fail tightrope 1 and zip line; not ported — match Draynor).
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (tightrope)
const CLIMB_ANIM = 828; // human_climb
const SWING_ANIM = 751; // human_ropeswing (cable / tropical tree / zip)
const JUMP_ANIM = 769; // stepping-stone hop (gap)

const TIGHTROPE1_MOVE_TICKS = 12;
const CABLE_MOVE_TICKS = 5;
const TIGHTROPE2_MOVE_TICKS = 15;

const COURSE_LEVEL = 20;
const LAST_STAGE = 7;

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
        "You need an Agility level of 20 to attempt this.",
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
            "You have completed the Al Kharid rooftop course.",
        );
    }
}

function climbRoughWall(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 3, 3, CLIMB_ANIM, 0);
    award(event, 12, 0, "You climb the wall...");
}

function crossTightrope1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 9, 3, LOG_WALK_ANIM, TIGHTROPE1_MOVE_TICKS);
    award(event, 36, 1, "You carefully cross the tightrope.");
}

function swingCable(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 15, tile.y, 3, SWING_ANIM, CABLE_MOVE_TICKS);
    award(event, 48, 2, "You swing across the cable.");
}

function teethGripZip(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 13, tile.y, 1, SWING_ANIM, 0);
    award(event, 48, 3, "You hang onto the zip line...");
}

function swingTropicalTree(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 1, tile.y + 8, 2, SWING_ANIM, 0);
    award(event, 12, 4, "You swing across the tropical tree.");
}

function climbRoofBeams(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 1, 3, CLIMB_ANIM, 0);
    award(event, 6, 5, "You climb the roof top beams...");
}

function crossTightrope2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 11, tile.y + 1, 3, LOG_WALK_ANIM, TIGHTROPE2_MOVE_TICKS);
    award(event, 18, 6, "You carefully cross the tightrope.");
}

function jumpGap(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 1, tile.y + 1, 0, JUMP_ANIM, 0);
    award(event, 36, 7, "You jump across the gap.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [11633],
        actions: ["climb", undefined],
        run: climbRoughWall,
    },
    {
        locIds: [14398],
        actions: ["cross", undefined],
        run: crossTightrope1,
    },
    {
        locIds: [14402],
        actions: ["swing-across", "swing across", "swing", undefined],
        run: swingCable,
    },
    {
        locIds: [14403],
        actions: ["teeth-grip", "teeth grip", "grip", undefined],
        run: teethGripZip,
    },
    {
        locIds: [14404],
        actions: ["swing-across", "swing across", "swing", undefined],
        run: swingTropicalTree,
    },
    {
        locIds: [11634],
        actions: ["climb", undefined],
        run: climbRoofBeams,
    },
    {
        locIds: [14409],
        actions: ["cross", undefined],
        run: crossTightrope2,
    },
    {
        locIds: [14399],
        actions: ["jump", undefined],
        run: jumpGap,
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
export function resetAlKharidCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getAlKharidCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
