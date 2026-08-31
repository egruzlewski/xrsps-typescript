/**
 * Ape Atoll agility course (level 48, unboostable; current OSRS XP, 580/lap).
 * Fail-proof (OSRS can fail tree / monkeybars / skull slope / rope until 75; not ported).
 * Ninja (4024/4025) or Kruk (19525) greegree must be equipped in the weapon slot.
 * Marks of Grace are not spawned: no player-specific ground-item / mark-spawn infrastructure.
 * Monkey Madness I Chapter 2 access lock is not wired (quest is not registered).
 */
import { EquipmentSlot } from "../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const CLIMB_ANIM = 828; // human_climb
const JUMP_ANIM = 769; // stepping-stone hop
const MONKEYBARS_ANIM = 744; // human_monkeybars
const ROPESWING_ANIM = 751; // human_ropeswing

const STONE_MOVE_TICKS = 3;
const MONKEYBARS_MOVE_TICKS = 8;
const SKULL_MOVE_TICKS = 5;
const ROPE_MOVE_TICKS = 5;

const COURSE_LEVEL = 48;
const LAST_STAGE = 5;
const LAP_AGILITY_XP = 300;

/** Small ninja, medium ninja, Kruk. */
const NINJA_GREEGREE_IDS = new Set([4024, 4025, 19525]);
const ANY_GREEGREE_IDS = new Set([4024, 4025, 4026, 4027, 4028, 4029, 4030, 4031, 19525]);

/** playerId → next expected stage (0 = stepping stone). */
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

function agilityBaseLevel(event: LocInteractionEvent): number {
    const skill = event.services.skills.getSkill(event.player, SkillId.Agility);
    return Math.max(1, skill?.baseLevel ?? 1);
}

function agilityBoostedLevel(event: LocInteractionEvent): number {
    const skill = event.services.skills.getSkill(event.player, SkillId.Agility);
    return Math.max(1, (skill?.baseLevel ?? 1) + (skill?.boost ?? 0));
}

function requireCourseLevel(event: LocInteractionEvent): boolean {
    if (agilityBaseLevel(event) >= COURSE_LEVEL) {
        return true;
    }
    if (agilityBoostedLevel(event) >= COURSE_LEVEL) {
        event.services.messaging.sendGameMessage(
            event.player,
            "Your Agility boost won't help you here.",
        );
        return false;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        "You need an Agility level of 48 to attempt this.",
    );
    return false;
}

function equippedWeapon(event: LocInteractionEvent): number {
    return event.services.equipment?.getEquippedItem?.(event.player, EquipmentSlot.WEAPON) ?? 0;
}

function requireNinjaGreegree(event: LocInteractionEvent): boolean {
    const weapon = equippedWeapon(event);
    if (NINJA_GREEGREE_IDS.has(weapon)) {
        return true;
    }
    if (ANY_GREEGREE_IDS.has(weapon)) {
        event.services.messaging.sendGameMessage(
            event.player,
            "Only the stealthiest and most agile monkey can use this!",
        );
        return false;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        "...you're not monkey enough to try this!",
    );
    return false;
}

function canAttempt(event: LocInteractionEvent): boolean {
    return requireCourseLevel(event) && requireNinjaGreegree(event);
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
        services.skills.addSkillXp(player, SkillId.Agility, LAP_AGILITY_XP);
        services.messaging.sendGameMessage(
            player,
            "You have completed the Ape Atoll agility course.",
        );
    }
}

function jumpSteppingStone(event: LocInteractionEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 1, tile.y, 0, JUMP_ANIM, STONE_MOVE_TICKS);
    award(event, 40, 0, "You jump to the stepping stone.");
}

function climbTropicalTree(event: LocInteractionEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 1, tile.y, 0, CLIMB_ANIM, 0);
    award(event, 40, 1, "You climb the tropical tree...");
}

function swingMonkeybars(event: LocInteractionEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 4, tile.y - 1, 0, MONKEYBARS_ANIM, MONKEYBARS_MOVE_TICKS);
    award(event, 40, 2, "You swing across the monkey bars.");
}

function climbSkullSlope(event: LocInteractionEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x - 5, tile.y, 0, CLIMB_ANIM, SKULL_MOVE_TICKS);
    award(event, 60, 3, "You climb the skull slope...");
}

function swingRope(event: LocInteractionEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 4, tile.y, 0, ROPESWING_ANIM, ROPE_MOVE_TICKS);
    award(event, 100, 4, "You swing on the rope.");
}

function climbTropicalTreeDown(event: LocInteractionEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x + 6, tile.y + 6, 0, CLIMB_ANIM, 0);
    award(event, 0, 5, "You climb down the tropical tree.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [15412],
        actions: ["jump-to", "jump to", "jump", undefined],
        run: jumpSteppingStone,
    },
    {
        locIds: [15414],
        actions: ["climb", undefined],
        run: climbTropicalTree,
    },
    {
        locIds: [15417, 15418, 15419, 16076],
        actions: ["swing-across", "swing across", "swing", undefined],
        run: swingMonkeybars,
    },
    {
        locIds: [15483],
        actions: ["climb-up", "climb up", "climb", undefined],
        run: climbSkullSlope,
    },
    {
        locIds: [15487],
        actions: ["swing", undefined],
        run: swingRope,
    },
    {
        locIds: [16062, 16066, 16067],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: climbTropicalTreeDown,
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
export function resetApeAtollCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getApeAtollCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
