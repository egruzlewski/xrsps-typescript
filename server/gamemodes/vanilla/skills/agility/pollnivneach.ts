/**
 * Pollnivneach rooftop course (level 70; current OSRS XP, 890/lap).
 * Fail-proof (OSRS can fail the market stall until 85; not ported — match Seers / Falador).
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 * Desert hard extra drying-line XP is not wired (no per-player diary-complete gameplay API).
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const CLIMB_ANIM = 828; // human_climb
const JUMP_ANIM = 769; // stepping-stone hop (stall / gap / trees / drying line)
const GRAB_ANIM = 1120; // hanging grab (banner)
const MONKEYBARS_ANIM = 744; // human_monkeybars

const STALL_MOVE_TICKS = 5;
const BANNER_MOVE_TICKS = 5;
const GAP_MOVE_TICKS = 3;
const TREE1_MOVE_TICKS = 5;
const MONKEYBARS_MOVE_TICKS = 8;
const TREE2_MOVE_TICKS = 4;

const COURSE_LEVEL = 70;
const LAST_STAGE = 8;

/** playerId → next expected stage (0 = basket). */
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
        "You need an Agility level of 70 to attempt this.",
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
            "You have completed the Pollnivneach rooftop course.",
        );
    }
}

function climbBasket(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 2, 1, CLIMB_ANIM, 0);
    award(event, 10, 0, "You climb on the basket...");
}

function jumpMarketStall(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 3, tile.y + 3, 1, JUMP_ANIM, STALL_MOVE_TICKS);
    award(event, 45, 1, "You jump onto the market stall.");
}

function grabBanner(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 4, tile.y - 1, 1, GRAB_ANIM, BANNER_MOVE_TICKS);
    award(event, 65, 2, "You grab the banner.");
}

function leapGap(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 3, tile.y, 1, JUMP_ANIM, GAP_MOVE_TICKS);
    award(event, 35, 3, "You leap across the gap.");
}

function jumpToTree(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 1, tile.y + 5, 1, JUMP_ANIM, TREE1_MOVE_TICKS);
    award(event, 75, 4, "You jump to the tree.");
}

function climbRoughWall(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 1, 2, CLIMB_ANIM, 0);
    award(event, 5, 5, "You climb the wall...");
}

function crossMonkeybars(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 6, 2, MONKEYBARS_ANIM, MONKEYBARS_MOVE_TICKS);
    award(event, 55, 6, "You swing across the monkey bars.");
}

function jumpOnTree(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 4, 2, JUMP_ANIM, TREE2_MOVE_TICKS);
    award(event, 60, 7, "You jump onto the tree.");
}

function jumpDryingLine(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 2, 0, JUMP_ANIM, 0);
    award(event, 540, 8, "You jump to the drying line.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [14935],
        actions: ["climb-on", "climb on", "climb", undefined],
        run: climbBasket,
    },
    {
        locIds: [14936],
        actions: ["jump-on", "jump on", "jump", undefined],
        run: jumpMarketStall,
    },
    {
        locIds: [14937],
        actions: ["grab", undefined],
        run: grabBanner,
    },
    {
        locIds: [14938],
        actions: ["leap", "jump", undefined],
        run: leapGap,
    },
    {
        locIds: [14939],
        actions: ["jump-to", "jump to", "jump", undefined],
        run: jumpToTree,
    },
    {
        locIds: [14940],
        actions: ["climb", undefined],
        run: climbRoughWall,
    },
    {
        locIds: [14941],
        actions: ["cross", undefined],
        run: crossMonkeybars,
    },
    {
        locIds: [14944],
        actions: ["jump-on", "jump on", "jump", undefined],
        run: jumpOnTree,
    },
    {
        locIds: [14945],
        actions: ["jump-to", "jump to", "jump", undefined],
        run: jumpDryingLine,
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
export function resetPollnivneachCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getPollnivneachCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}