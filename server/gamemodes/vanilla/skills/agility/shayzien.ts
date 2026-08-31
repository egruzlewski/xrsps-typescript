/**
 * Shayzien Agility Course (Kourend). Basic: level 1, 153.5/lap. Advanced: level 45, 507.5/lap.
 * Fail-proof (OSRS advanced can fail until ~64; not ported). Shared start then basic or advanced branch.
 * Advanced beams need a crossbow (weapon) and mith grapple 9419 (ammo); grapple never breaks here.
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 * Soldier lap-stats NPC and Kourend & Kebos Diary lap task are not wired.
 */
import { EquipmentSlot } from "../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (tightrope)
const CLIMB_ANIM = 828; // human_climb (ladder / bar)
const MONKEYBARS_ANIM = 744; // human_monkeybars
const JUMP_ANIM = 769; // stepping-stone hop (gap / edges)
const ZIP_ANIM = 751; // human_ropeswing (zipline / grapple swing)

const MONKEYBARS_MOVE_TICKS = 10;
const TIGHTROPE_MOVE_TICKS = 8;
const BAR_MOVE_TICKS = 4;
const BEAM_MOVE_TICKS = 4;
const EDGE_MOVE_TICKS = 4;

const ADVANCED_LEVEL = 45;
const BASIC_LAST_STAGE = 6;
const ADVANCED_LAST_STAGE = 7;

const MITH_GRAPPLE_ID = 9419;

/** Any crossbow except love crossbow / ballistae (wiki: any crossbow works). */
const CROSSBOW_IDS = new Set([
    837, 9174, 9176, 9177, 9179, 9181, 9183, 9185, 21902, 11785, 26374, 4734, 4934, 8880, 10156,
    21012,
]);

/** playerId → next expected stage (0 = ladder). */
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

function requireAdvancedLevel(event: LocInteractionEvent): boolean {
    if (agilityLevel(event) >= ADVANCED_LEVEL) {
        return true;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        "You need an Agility level of 45 to attempt this.",
    );
    return false;
}

function equipped(event: LocInteractionEvent, slot: number): number {
    return event.services.equipment?.getEquippedItem?.(event.player, slot) ?? 0;
}

function requireGrappleKit(event: LocInteractionEvent): boolean {
    const weapon = equipped(event, EquipmentSlot.WEAPON);
    const ammo = equipped(event, EquipmentSlot.AMMO);
    if (CROSSBOW_IDS.has(weapon) && ammo === MITH_GRAPPLE_ID) {
        return true;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        "You need a crossbow and a mithril grapple equipped to attempt this.",
    );
    return false;
}

function completeObstacle(player: PlayerState, stage: number, lastStage: number): boolean {
    const expected = courseProgress.get(player.id) ?? 0;
    if (stage === lastStage) {
        const inOrder = expected === lastStage;
        courseProgress.delete(player.id);
        advancedLap.delete(player.id);
        return inOrder;
    }
    if (expected === stage) {
        courseProgress.set(player.id, stage + 1);
    } else if (stage === 0) {
        courseProgress.set(player.id, 1);
        advancedLap.set(player.id, false);
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
    lastStage: number,
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
    const lapComplete = completeObstacle(player, stage, lastStage);
    if (lapComplete) {
        services.messaging.sendGameMessage(
            player,
            wasAdvanced
                ? "You have completed the Shayzien advanced agility course."
                : "You have completed the Shayzien basic agility course.",
        );
    }
}

function markBranch(player: PlayerState, advanced: boolean): void {
    if ((courseProgress.get(player.id) ?? 0) === 3) {
        advancedLap.set(player.id, advanced);
    }
}

function climbLadder(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x - 2, tile.y + 2, 3, CLIMB_ANIM, 0);
    award(event, 5.5, 0, BASIC_LAST_STAGE, "You climb the ladder...");
}

function climbMonkeybars(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x - 16, tile.y, 2, MONKEYBARS_ANIM, MONKEYBARS_MOVE_TICKS);
    award(event, 8, 1, BASIC_LAST_STAGE, "You swing across the monkey bars.");
}

function crossTightrope1(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x - 13, tile.y, 2, LOG_WALK_ANIM, TIGHTROPE_MOVE_TICKS);
    award(event, 9, 2, BASIC_LAST_STAGE, "You carefully cross the tightrope.");
}

function climbBar(event: LocInteractionEvent): void {
    const { player, tile } = event;
    markBranch(player, false);
    playMove(event, tile.x + 2, tile.y + 4, 3, CLIMB_ANIM, BAR_MOVE_TICKS);
    award(event, 7, 3, BASIC_LAST_STAGE, "You climb the bar...");
}

function crossTightrope2(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x + 16, tile.y, 2, LOG_WALK_ANIM, TIGHTROPE_MOVE_TICKS);
    award(event, 9, 4, BASIC_LAST_STAGE, "You carefully cross the tightrope.");
}

function crossTightrope3(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x + 13, tile.y - 3, 2, LOG_WALK_ANIM, TIGHTROPE_MOVE_TICKS);
    award(event, 9, 5, BASIC_LAST_STAGE, "You carefully cross the tightrope.");
}

function jumpGap(event: LocInteractionEvent): void {
    const { tile } = event;
    playMove(event, tile.x, tile.y - 10, 0, JUMP_ANIM, 0);
    award(event, 106, 6, BASIC_LAST_STAGE, "You jump down the gap.");
}

function grappleBeam1(event: LocInteractionEvent): void {
    if (!requireAdvancedLevel(event) || !requireGrappleKit(event)) {
        return;
    }
    const { player, tile } = event;
    markBranch(player, true);
    playMove(event, tile.x - 2, tile.y - 3, 2, ZIP_ANIM, BEAM_MOVE_TICKS);
    award(event, 23, 3, ADVANCED_LAST_STAGE, "You fire a grapple at the beam...");
}

function jumpEdge1(event: LocInteractionEvent): void {
    if (!requireAdvancedLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y - 7, 2, JUMP_ANIM, EDGE_MOVE_TICKS);
    award(event, 18, 4, ADVANCED_LAST_STAGE, "You jump the edge.");
}

function jumpEdge2(event: LocInteractionEvent): void {
    if (!requireAdvancedLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 2, tile.y - 8, 2, JUMP_ANIM, EDGE_MOVE_TICKS);
    award(event, 21, 5, ADVANCED_LAST_STAGE, "You jump the edge.");
}

function grappleBeam2(event: LocInteractionEvent): void {
    if (!requireAdvancedLevel(event) || !requireGrappleKit(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 10, tile.y + 2, 2, ZIP_ANIM, BEAM_MOVE_TICKS);
    award(event, 23, 6, ADVANCED_LAST_STAGE, "You fire a grapple at the beam...");
}

function slideZipline(event: LocInteractionEvent): void {
    if (!requireAdvancedLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y, 0, ZIP_ANIM, 0);
    award(event, 400, 7, ADVANCED_LAST_STAGE, "You slide down the zipline.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [42209],
        actions: ["climb", undefined],
        run: climbLadder,
    },
    {
        locIds: [42210, 42211],
        actions: ["climb", undefined],
        run: climbMonkeybars,
    },
    {
        locIds: [42212],
        actions: ["cross", undefined],
        run: crossTightrope1,
    },
    {
        locIds: [42213],
        actions: ["climb", undefined],
        run: climbBar,
    },
    {
        locIds: [42214],
        actions: ["cross", undefined],
        run: crossTightrope2,
    },
    {
        locIds: [42215],
        actions: ["cross", undefined],
        run: crossTightrope3,
    },
    {
        locIds: [42216],
        actions: ["jump", undefined],
        run: jumpGap,
    },
    {
        locIds: [42217],
        actions: ["grapple", undefined],
        run: grappleBeam1,
    },
    {
        locIds: [42218],
        actions: ["jump", undefined],
        run: jumpEdge1,
    },
    {
        locIds: [42219],
        actions: ["jump", undefined],
        run: jumpEdge2,
    },
    {
        locIds: [42220],
        actions: ["grapple", undefined],
        run: grappleBeam2,
    },
    {
        locIds: [42221],
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
export function resetShayzienCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        advancedLap.clear();
        return;
    }
    courseProgress.delete(playerId);
    advancedLap.delete(playerId);
}

export function getShayzienCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}

export function isShayzienAdvancedLap(playerId: number): boolean {
    return advancedLap.get(playerId) === true;
}
