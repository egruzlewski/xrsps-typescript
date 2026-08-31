/**
 * Ardougne rooftop course (level 90; current OSRS XP, 889/lap).
 * Fail-proof (OSRS can fail gap 1 and gap 2 until 95; not ported — match Pollnivneach / Seers).
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 * Ardougne elite extra mark rate is not wired (no mark-spawn API).
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (plank / steep roof)
const CLIMB_ANIM = 828; // human_climb
const JUMP_ANIM = 769; // stepping-stone hop (gaps)

const GAP1_MOVE_TICKS = 5;
const PLANK_MOVE_TICKS = 8;
const GAP2_MOVE_TICKS = 4;
const GAP3_MOVE_TICKS = 4;
const ROOF_MOVE_TICKS = 4;

const COURSE_LEVEL = 90;
const LAST_STAGE = 6;

/** playerId → next expected stage (0 = wooden beams). */
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
        "You need an Agility level of 90 to attempt this.",
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
            "You have completed the Ardougne rooftop course.",
        );
    }
}

function climbWoodenBeams(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 2, 3, CLIMB_ANIM, 0);
    award(event, 43, 0, "You climb the wooden beams...");
}

function leapGap1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 8, 3, JUMP_ANIM, GAP1_MOVE_TICKS);
    award(event, 65, 1, "You jump across the gap.");
}

function walkPlank(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 8, tile.y, 3, LOG_WALK_ANIM, PLANK_MOVE_TICKS);
    award(event, 50, 2, "You walk on the plank.");
}

function leapGap2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 7, 3, JUMP_ANIM, GAP2_MOVE_TICKS);
    award(event, 21, 3, "You jump across the gap.");
}

function leapGap3(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 1, tile.y - 6, 3, JUMP_ANIM, GAP3_MOVE_TICKS);
    award(event, 28, 4, "You jump across the gap.");
}

function balanceSteepRoof(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 2, tile.y - 3, 3, LOG_WALK_ANIM, ROOF_MOVE_TICKS);
    award(event, 57, 5, "You balance across the roof.");
}

function leapGap4(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 12, tile.y + 1, 0, JUMP_ANIM, 0);
    award(event, 625, 6, "You jump across the gap.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [15608],
        actions: ["climb-up", "climb up", "climb", undefined],
        run: climbWoodenBeams,
    },
    {
        locIds: [15609],
        actions: ["jump", undefined],
        run: leapGap1,
    },
    {
        locIds: [26635],
        actions: ["walk-on", "walk on", "walk", undefined],
        run: walkPlank,
    },
    {
        locIds: [15610],
        actions: ["jump", undefined],
        run: leapGap2,
    },
    {
        locIds: [15611],
        actions: ["jump", undefined],
        run: leapGap3,
    },
    {
        locIds: [28912],
        actions: ["balance-across", "balance across", "balance", undefined],
        run: balanceSteepRoof,
    },
    {
        locIds: [15612],
        actions: ["jump", undefined],
        run: leapGap4,
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
export function resetArdougneCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getArdougneCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
