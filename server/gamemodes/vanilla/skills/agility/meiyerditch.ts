/**
 * Meiyerditch wall-and-floor agility (Darkness of Hallowvale / Myreque rooftops).
 * Level 25 unboostable; 5 XP per floor jump (current OSRS). Fail-proof.
 * The full sickle-logo labyrinth is huge — this wires the repeated floor-jump
 * training sequence (Jump-to floorboards + Walk-across floors), not every
 * one-off quest shelf, washing line, tunnel, or hideout shortcut.
 * Darkness of Hallowvale access lock is not wired (quest is not registered).
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const JUMP_ANIM = 769; // stepping-stone hop (floorboards)
const WALK_ANIM = 762; // human_walk_logbalance (walk-across floor)

const JUMP_MOVE_TICKS = 2;
const FLOOR_SPAN = 2;
const FLOOR_MOVE_TICKS = 3;

const COURSE_LEVEL = 25;
const JUMP_XP = 5;

/** Jump-to floorboards used for the back-and-forth training loop. */
const FLOORBOARD_IDS = [
    18070, 18071, 18072, 18073, 18089, 18090, 18093, 18094, 18097, 18098, 18109, 18110, 18111,
    18112, 18113, 18114, 18117, 18118,
];

/** Walk-across collapsed floors on the same rooftop path. */
const FLOOR_IDS = [18076, 18077, 18081, 18082, 18103, 18104];

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

function destPast(
    player: PlayerState,
    tile: { x: number; y: number },
    span: number,
): { x: number; y: number } {
    let dx = Math.sign(tile.x - player.tileX);
    let dy = Math.sign(tile.y - player.tileY);
    if (Math.abs(tile.x - player.tileX) >= Math.abs(tile.y - player.tileY)) {
        dy = 0;
        if (dx === 0) dx = 1;
    } else {
        dx = 0;
        if (dy === 0) dy = 1;
    }
    return { x: tile.x + dx * span, y: tile.y + dy * span };
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
        "You need an Agility level of 25 to attempt this.",
    );
    return false;
}

function award(event: LocInteractionEvent, startMessage: string): void {
    const { player, services } = event;
    services.messaging.sendGameMessage(player, startMessage);
    services.skills.addSkillXp(player, SkillId.Agility, JUMP_XP);
}

function jumpFloorboards(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile, player } = event;
    playMove(event, tile.x, tile.y, player.level, JUMP_ANIM, JUMP_MOVE_TICKS);
    award(event, "You jump to the floorboards.");
}

function walkAcrossFloor(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const dest = destPast(event.player, event.tile, FLOOR_SPAN);
    playMove(event, dest.x, dest.y, event.player.level, WALK_ANIM, FLOOR_MOVE_TICKS);
    award(event, "You walk across the floor.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: FLOORBOARD_IDS,
        actions: ["jump-to", "jump to", "jump", undefined],
        run: jumpFloorboards,
    },
    {
        locIds: FLOOR_IDS,
        actions: ["walk-across", "walk across", "walk", undefined],
        run: walkAcrossFloor,
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
