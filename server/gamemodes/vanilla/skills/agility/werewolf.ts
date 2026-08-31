/**
 * Werewolf Agility Course (Canifis cave; level 60; current OSRS XP, 350/lap + 380 stick = 730).
 * Fail-proof (OSRS deathslide can fail and deal damage — not ported).
 * Stick 4179 is granted after the pipe (ground-item spawn is not wired — match Marks of Grace).
 * Agility Trainer 5927 Give-Stick / item-on-npc returns the stick for 380 XP.
 * Marks of Grace, trapdoor / ring of charos, and Creature of Fenkenstrain lock are not wired.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnNpcEvent,
    LocInteractionEvent,
    NpcInteractionEvent,
} from "../../../../src/game/scripts/types";

const JUMP_ANIM = 769; // stepping-stone hop (stones / hurdles)
const PIPE_CRAWL_ANIM = 844; // human_pipecrawling
const CLIMB_ANIM = 828; // human_climb (skull slope)
const ZIP_ANIM = 751; // human_ropeswing (teeth-grip deathslide)

const STONE_MOVE_TICKS = 2;
const HURDLE_MOVE_TICKS = 2;
const PIPE_MOVE_TICKS = 7;
const SLOPE_MOVE_TICKS = 3;
const ZIP_MOVE_TICKS = 8;

const HURDLE_SPAN = 2;
const PIPE_SPAN = 3;
const SLOPE_SPAN = 2;

const COURSE_LEVEL = 60;
const LAST_STAGE = 4;
const STICK_ITEM_ID = 4179;
const STICK_BONUS_XP = 380;
const TRAINER_NPC_ID = 5927;
const ZIP_DEST = { x: 3530, y: 9867, level: 0 } as const;

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
        "You need an Agility level of 60 to attempt this.",
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
            "You have completed the Werewolf Agility course.",
        );
    }
}

/** Same loc family clicked again after this stage already advanced — move only, no XP. */
function isRepeatOfStage(playerId: number, stage: number): boolean {
    if (stage === LAST_STAGE) {
        return false;
    }
    const expected = courseProgress.get(playerId) ?? 0;
    return expected === stage + 1;
}

function stickCount(player: PlayerState): number {
    return player.items?.getItemCount(STICK_ITEM_ID) ?? 0;
}

function giveStick(event: LocInteractionEvent): void {
    const { player, services } = event;
    if (stickCount(player) > 0) {
        return;
    }
    const result = services.inventory.addItemToInventory(player, STICK_ITEM_ID, 1);
    if (result.added !== 1) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return;
    }
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(player, "You pick up the stick.");
}

function returnStick(player: PlayerState, services: LocInteractionEvent["services"]): void {
    const count = stickCount(player);
    if (count <= 0) {
        services.messaging.sendGameMessage(player, "You don't have a stick to give.");
        return;
    }
    const removed = player.items.removeItem(STICK_ITEM_ID, count, { assureFullRemoval: true });
    if (removed.completed !== count) {
        services.messaging.sendGameMessage(player, "You don't have a stick to give.");
        return;
    }
    services.inventory.snapshotInventory(player);
    services.skills.addSkillXp(player, SkillId.Agility, STICK_BONUS_XP);
    services.messaging.sendGameMessage(
        player,
        "You give the stick to the Agility Trainer.",
    );
}

function jumpSteppingStone(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { tile } = event;
    playMove(event, tile.x, tile.y, event.player.level, JUMP_ANIM, STONE_MOVE_TICKS);
    if (isRepeatOfStage(event.player.id, 0)) {
        event.services.messaging.sendGameMessage(event.player, "You jump to the next stepping stone.");
        return;
    }
    award(event, 50, 0, "You jump to the next stepping stone.");
}

function jumpHurdle(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const dest = destPast(event.player, event.tile, HURDLE_SPAN);
    playMove(event, dest.x, dest.y, event.player.level, JUMP_ANIM, HURDLE_MOVE_TICKS);
    if (isRepeatOfStage(event.player.id, 1)) {
        event.services.messaging.sendGameMessage(event.player, "You jump the hurdle.");
        return;
    }
    award(event, 60, 1, "You jump the hurdle.");
}

function squeezePipe(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const dest = destPast(event.player, event.tile, PIPE_SPAN);
    playMove(event, dest.x, dest.y, event.player.level, PIPE_CRAWL_ANIM, PIPE_MOVE_TICKS);
    if (isRepeatOfStage(event.player.id, 2)) {
        event.services.messaging.sendGameMessage(event.player, "You squeeze into the pipe...");
        return;
    }
    award(event, 15, 2, "You squeeze into the pipe...");
    giveStick(event);
}

function climbSkullSlope(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const dest = destPast(event.player, event.tile, SLOPE_SPAN);
    playMove(event, dest.x, dest.y, event.player.level, CLIMB_ANIM, SLOPE_MOVE_TICKS);
    if (isRepeatOfStage(event.player.id, 3)) {
        event.services.messaging.sendGameMessage(event.player, "You climb the skull slope...");
        return;
    }
    award(event, 25, 3, "You climb the skull slope...");
}

function rideZipLine(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    playMove(event, ZIP_DEST.x, ZIP_DEST.y, ZIP_DEST.level, ZIP_ANIM, ZIP_MOVE_TICKS);
    award(event, 200, 4, "You take a grip of the deathslide...");
}

function giveStickToTrainer(event: NpcInteractionEvent): void {
    returnStick(event.player, event.services);
}

function useStickOnTrainer(event: ItemOnNpcEvent): void {
    returnStick(event.player, event.services);
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [11643],
        actions: ["jump-to", "jump to", "jump", undefined],
        run: jumpSteppingStone,
    },
    {
        locIds: [11638, 11639, 11640],
        actions: ["jump", undefined],
        run: jumpHurdle,
    },
    {
        locIds: [11657],
        actions: ["squeeze-through", "squeeze through", "squeeze", undefined],
        run: squeezePipe,
    },
    {
        locIds: [11641],
        actions: ["climb-up", "climb up", "climb", undefined],
        run: climbSkullSlope,
    },
    {
        locIds: [11644, 11645, 11646],
        actions: ["teeth-grip", "teeth grip", "grip", undefined],
        run: rideZipLine,
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
    // Optional: other agility tests only mock registerLocInteraction.
    registry.registerNpcInteraction?.(TRAINER_NPC_ID, giveStickToTrainer, "give-stick");
    registry.registerNpcInteraction?.(TRAINER_NPC_ID, giveStickToTrainer, "give stick");
    registry.registerNpcInteraction?.(TRAINER_NPC_ID, giveStickToTrainer, "give");
    registry.registerNpcInteraction?.(TRAINER_NPC_ID, giveStickToTrainer, undefined);
    registry.registerItemOnNpc?.(STICK_ITEM_ID, TRAINER_NPC_ID, useStickOnTrainer);
}

/** Test helper: clear lap tracking for one player or all players. */
export function resetWerewolfCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getWerewolfCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
