/**
 * Colossal Wyrm Agility Course (Avium Savannah / Varlamore).
 * Basic: level 50, 633/lap. Advanced: level 62, 1053.6/lap.
 * Fail-proof (OSRS never fails either route).
 * Auto-crossed edges/rope XP is bundled into the preceding click.
 * Termites, blessed bone shards, Worm Tongue shop/unlock, and giant squirrel are not wired.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (tightrope)
const CLIMB_ANIM = 828; // human_climb (ladders / hanging rope)
const JUMP_ANIM = 769; // stepping-stone hop (edge)
const ZIP_ANIM = 751; // human_ropeswing (zipline)

const TIGHTROPE1_MOVE_TICKS = 16;
const BASIC_TIGHTROPE_MOVE_TICKS = 10;
const BASIC_ROPE_MOVE_TICKS = 14;
const ADV_EDGE_MOVE_TICKS = 8;

const BASIC_LEVEL = 50;
const ADVANCED_LEVEL = 62;
const LAST_STAGE = 5;

const BASIC_XP = 37.2;
const ADV_XP = 70;
const BASIC_ZIP_XP = 372.6;
const ADV_ZIP_XP = 662;

/** playerId → next expected stage (0 = start ladder). */
const courseProgress = new Map<number, number>();
/** playerId → true if the current lap took the advanced branch. */
const advancedLap = new Map<number, boolean>();

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

function requireLevel(event: LocInteractionEvent, level: number): boolean {
    if (agilityLevel(event) >= level) {
        return true;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        `You need an Agility level of ${level} to attempt this.`,
    );
    return false;
}

function completeObstacle(player: PlayerState, stage: number): boolean {
    const expected = courseProgress.get(player.id) ?? 0;
    if (stage === LAST_STAGE) {
        const inOrder = expected === LAST_STAGE;
        courseProgress.delete(player.id);
        advancedLap.delete(player.id);
        return inOrder;
    }
    if (stage === 0) {
        courseProgress.set(player.id, 1);
        advancedLap.set(player.id, false);
        return false;
    }
    if (expected === stage) {
        courseProgress.set(player.id, stage + 1);
    } else {
        courseProgress.delete(player.id);
        advancedLap.delete(player.id);
    }
    return false;
}

function award(
    event: LocInteractionEvent,
    xp: number,
    stage: number,
    startMessage?: string,
): void {
    const { player, services } = event;
    if (startMessage) {
        services.messaging.sendGameMessage(player, startMessage);
    }
    if (xp > 0) {
        services.skills.addSkillXp(player, SkillId.Agility, xp);
    }
    const wasAdvanced = advancedLap.get(player.id) === true;
    const lapComplete = completeObstacle(player, stage);
    if (lapComplete) {
        advancedLap.delete(player.id);
        services.messaging.sendGameMessage(
            player,
            wasAdvanced
                ? "You have completed the Colossal Wyrm advanced course."
                : "You have completed the Colossal Wyrm basic course.",
        );
    }
}

function climbStartLadder(event: LocInteractionEvent): void {
    if (!requireLevel(event, BASIC_LEVEL)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 2, 1, CLIMB_ANIM, 0);
    award(event, BASIC_XP, 0, "You climb the ladder...");
}

function crossTightrope1(event: LocInteractionEvent): void {
    if (!requireLevel(event, BASIC_LEVEL)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 7, tile.y - 15, 1, LOG_WALK_ANIM, TIGHTROPE1_MOVE_TICKS);
    award(event, BASIC_XP + BASIC_XP, 1, "You cross the tightrope.");
}

function crossBasicTightrope(event: LocInteractionEvent): void {
    if (!requireLevel(event, BASIC_LEVEL)) {
        return;
    }
    const { player, tile } = event;
    if ((courseProgress.get(player.id) ?? 0) === 2) {
        advancedLap.set(player.id, false);
    }
    playMove(event, tile.x - 15, tile.y, 1, LOG_WALK_ANIM, BASIC_TIGHTROPE_MOVE_TICKS);
    award(event, BASIC_XP, 2, "You cross the tightrope.");
}

function climbBasicRope(event: LocInteractionEvent): void {
    if (!requireLevel(event, BASIC_LEVEL)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 5, tile.y + 22, 1, CLIMB_ANIM, BASIC_ROPE_MOVE_TICKS);
    award(event, BASIC_XP + BASIC_XP, 3, "You climb the rope.");
}

function climbBasicLadder(event: LocInteractionEvent): void {
    if (!requireLevel(event, BASIC_LEVEL)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y + 1, 1, CLIMB_ANIM, 0);
    award(event, BASIC_XP, 4, "You climb the ladder...");
}

function climbAdvancedLadder(event: LocInteractionEvent): void {
    if (!requireLevel(event, ADVANCED_LEVEL)) {
        return;
    }
    const { player, tile } = event;
    if ((courseProgress.get(player.id) ?? 0) === 2) {
        advancedLap.set(player.id, true);
    }
    playMove(event, tile.x - 2, tile.y - 2, 2, CLIMB_ANIM, 0);
    award(event, ADV_XP, 2, "You climb the ladder...");
}

function jumpAdvancedEdge(event: LocInteractionEvent): void {
    if (!requireLevel(event, ADVANCED_LEVEL)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 13, tile.y + 1, 2, JUMP_ANIM, ADV_EDGE_MOVE_TICKS);
    award(event, ADV_XP, 3, "You jump the edge.");
}

function crossAdvancedTightrope(event: LocInteractionEvent): void {
    if (!requireLevel(event, ADVANCED_LEVEL)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 7, tile.y + 25, 1, LOG_WALK_ANIM, 0);
    award(event, ADV_XP + ADV_XP, 4, "You cross the tightrope.");
}

function slideZipline(event: LocInteractionEvent): void {
    if (!requireLevel(event, BASIC_LEVEL)) {
        return;
    }
    const { player, tile } = event;
    const advanced = advancedLap.get(player.id) === true;
    playMove(event, tile.x + 26, tile.y - 2, 0, ZIP_ANIM, 0);
    award(
        event,
        advanced ? ADV_ZIP_XP : BASIC_ZIP_XP,
        5,
        "You slide down the zipline.",
    );
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [55178],
        actions: ["climb", undefined],
        run: climbStartLadder,
    },
    {
        locIds: [55180],
        actions: ["cross", undefined],
        run: crossTightrope1,
    },
    {
        locIds: [55184],
        actions: ["cross", undefined],
        run: crossBasicTightrope,
    },
    {
        locIds: [55186],
        actions: ["climb", undefined],
        run: climbBasicRope,
    },
    {
        locIds: [55190],
        actions: ["climb", undefined],
        run: climbBasicLadder,
    },
    {
        locIds: [55191],
        actions: ["climb", undefined],
        run: climbAdvancedLadder,
    },
    {
        locIds: [55192],
        actions: ["jump", undefined],
        run: jumpAdvancedEdge,
    },
    {
        locIds: [55194],
        actions: ["cross", undefined],
        run: crossAdvancedTightrope,
    },
    {
        locIds: [55179],
        actions: ["slide", undefined],
        run: slideZipline,
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
export function resetColossalWyrmCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        advancedLap.clear();
        return;
    }
    courseProgress.delete(playerId);
    advancedLap.delete(playerId);
}

export function getColossalWyrmCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}

export function isColossalWyrmAdvancedLap(playerId: number): boolean {
    return advancedLap.get(playerId) === true;
}
