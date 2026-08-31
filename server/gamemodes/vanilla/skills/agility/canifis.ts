/**
 * Canifis rooftop course (level 40; current OSRS XP, 240/lap).
 * Fail-proof (OSRS can fail gap 3; not ported — match Draynor / Al Kharid / Varrock).
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const CLIMB_ANIM = 828; // human_climb
const JUMP_ANIM = 769; // stepping-stone hop (gaps)
const VAULT_ANIM = 7132; // rooftops_pole_vault

const GAP1_MOVE_TICKS = 5;
const GAP2_MOVE_TICKS = 8; // one tick slower than other same-plane gaps (OSRS)

const COURSE_LEVEL = 40;
const LAST_STAGE = 7;

/** playerId → next expected stage (0 = tall tree). */
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
        "You need an Agility level of 40 to attempt this.",
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
            "You have completed the Canifis rooftop course.",
        );
    }
}

function climbTallTree(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 2, tile.y + 3, 2, CLIMB_ANIM, 0);
    award(event, 10, 0, "You climb the tree...");
}

function leapGap1(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 3, tile.y + 6, 2, JUMP_ANIM, GAP1_MOVE_TICKS);
    award(event, 8, 1, "You jump across the gap.");
}

function leapGap2(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 4, tile.y, 2, JUMP_ANIM, GAP2_MOVE_TICKS);
    award(event, 8, 2, "You jump across the gap.");
}

function leapGap3(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 6, tile.y, 3, JUMP_ANIM, 0);
    award(event, 10, 3, "You jump across the gap.");
}

function leapGap4(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 5, 2, JUMP_ANIM, 0);
    award(event, 8, 4, "You jump across the gap.");
}

function vaultPole(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 9, tile.y - 7, 3, VAULT_ANIM, 0);
    award(event, 10, 5, "You vault across the gap.");
}

function leapGap5(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 7, tile.y, 2, JUMP_ANIM, 0);
    award(event, 11, 6, "You jump across the gap.");
}

function leapGap6(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 2, 0, JUMP_ANIM, 0);
    award(event, 175, 7, "You jump across the gap.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [14843],
        actions: ["climb", undefined],
        run: climbTallTree,
    },
    {
        locIds: [14844],
        actions: ["jump", undefined],
        run: leapGap1,
    },
    {
        locIds: [14845],
        actions: ["jump", undefined],
        run: leapGap2,
    },
    {
        locIds: [14848],
        actions: ["jump", undefined],
        run: leapGap3,
    },
    {
        locIds: [14846],
        actions: ["jump", undefined],
        run: leapGap4,
    },
    {
        locIds: [14894],
        actions: ["vault", undefined],
        run: vaultPole,
    },
    {
        locIds: [14847],
        actions: ["jump", undefined],
        run: leapGap5,
    },
    {
        locIds: [14897],
        actions: ["jump", undefined],
        run: leapGap6,
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
export function resetCanifisCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getCanifisCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
