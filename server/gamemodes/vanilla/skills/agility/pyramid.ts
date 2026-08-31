/**
 * Agility Pyramid (Jaleustrophos; not a rooftop). Level 30; current OSRS XP.
 * Fail-proof (OSRS fails drop a floor and deal damage — no fail-to-lower-level API).
 * Wired: rolling/tilting blocks (12), ledges (52), climbing rocks (0 + pyramid top 6970).
 * Doorway awards lap bonus 300+8×base Agility (capped 1,000) and returns to the base.
 * Simon Templeton (5786) buys pyramid tops for 10,000 coins (`addItemToInventory`).
 * Skipped: stairs / low walls / planks / gaps / sliding pyramid-block NPCs, desert heat,
 * fail damage, Desert Diary extra coins, noted artefact sales.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnNpcEvent,
    LocInteractionEvent,
    NpcInteractionEvent,
} from "../../../../src/game/scripts/types";

const CLIMB_ANIM = 828; // human_climb
const LEDGE_ANIM = 756; // human_walk_sidestep
const ROLL_ANIM = 769; // stepping-stone hop (thrown off the tilting block)

const ROLL_SPAN = 2;
const LEDGE_SPAN = 5;
const ROCKS_SPAN = 2;
const ROLL_MOVE_TICKS = 3;
const LEDGE_MOVE_TICKS = 4;
const ROCKS_MOVE_TICKS = 2;

const COURSE_LEVEL = 30;
const COINS_ITEM_ID = 995;
const PYRAMID_TOP_ITEM_ID = 6970;
const PYRAMID_TOP_COINS = 10_000;
const SIMON_NPC_ID = 5786;
const DOORWAY_LOC_IDS = [10855, 10856];
const PYRAMID_BASE = { x: 3364, y: 2830, level: 0 } as const;

/** playerId → already claimed the pyramid top this climb (resets on doorway). */
const collectedTops = new Set<number>();

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

function agilityBaseLevel(event: LocInteractionEvent): number {
    const skill = event.services.skills.getSkill(event.player, SkillId.Agility);
    return Math.max(1, skill?.baseLevel ?? 1);
}

function requireCourseLevel(event: LocInteractionEvent): boolean {
    if (agilityLevel(event) >= COURSE_LEVEL) {
        return true;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        "You need an Agility level of 30 to attempt this.",
    );
    return false;
}

function lapBonusXp(event: LocInteractionEvent): number {
    return Math.min(1000, 300 + agilityBaseLevel(event) * 8);
}

function awardXp(event: LocInteractionEvent, xp: number, startMessage?: string): void {
    const { player, services } = event;
    if (startMessage) {
        services.messaging.sendGameMessage(player, startMessage);
    }
    if (xp > 0) {
        services.skills.addSkillXp(player, SkillId.Agility, xp);
    }
}

function rollBlock(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const dest = destPast(event.player, event.tile, ROLL_SPAN);
    playMove(event, dest.x, dest.y, event.player.level, ROLL_ANIM, ROLL_MOVE_TICKS);
    awardXp(event, 12, "You step onto the rolling block...");
}

function crossLedge(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const dest = destPast(event.player, event.tile, LEDGE_SPAN);
    playMove(event, dest.x, dest.y, event.player.level, LEDGE_ANIM, LEDGE_MOVE_TICKS);
    awardXp(event, 52, "You put your foot on the ledge and try to edge across...");
}

function climbRocks(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { player, services } = event;
    const dest = destPast(player, event.tile, ROCKS_SPAN);
    playMove(event, dest.x, dest.y, player.level, CLIMB_ANIM, ROCKS_MOVE_TICKS);

    if (collectedTops.has(player.id)) {
        services.messaging.sendGameMessage(player, "You find nothing at the top of the pyramid.");
        return;
    }

    const result = services.inventory.addItemToInventory(player, PYRAMID_TOP_ITEM_ID, 1);
    if (result.added !== 1) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return;
    }
    collectedTops.add(player.id);
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(player, "You take the pyramid top from the monument.");
}

function enterDoorway(event: LocInteractionEvent): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    const { player, services } = event;
    collectedTops.delete(player.id);
    playMove(event, PYRAMID_BASE.x, PYRAMID_BASE.y, PYRAMID_BASE.level, CLIMB_ANIM, 0);
    const bonus = lapBonusXp(event);
    services.skills.addSkillXp(player, SkillId.Agility, bonus);
    services.messaging.sendGameMessage(player, "You have completed the Agility Pyramid.");
}

function pyramidTopCount(player: PlayerState): number {
    return player.items?.getItemCount(PYRAMID_TOP_ITEM_ID) ?? 0;
}

function sellPyramidTopsToSimon(player: PlayerState, services: LocInteractionEvent["services"]): void {
    const count = pyramidTopCount(player);
    if (count <= 0) {
        services.messaging.sendGameMessage(
            player,
            "Simon Templeton will buy pyramid tops for 10,000 coins each.",
        );
        return;
    }
    const removed = player.items.removeItem(PYRAMID_TOP_ITEM_ID, count, { assureFullRemoval: true });
    if (removed.completed !== count) {
        services.messaging.sendGameMessage(
            player,
            "Simon Templeton will buy pyramid tops for 10,000 coins each.",
        );
        return;
    }
    const coins = count * PYRAMID_TOP_COINS;
    const result = services.inventory.addItemToInventory(player, COINS_ITEM_ID, coins);
    if (result.added !== coins) {
        player.items.addItem(PYRAMID_TOP_ITEM_ID, count, { assureFullInsertion: true });
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return;
    }
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(
        player,
        `Simon Templeton buys ${count} pyramid top${count === 1 ? "" : "s"} for ${coins.toLocaleString("en-US")} coins.`,
    );
}

function talkToSimon(event: NpcInteractionEvent): void {
    sellPyramidTopsToSimon(event.player, event.services);
}

function useTopOnSimon(event: ItemOnNpcEvent): void {
    sellPyramidTopsToSimon(event.player, event.services);
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [10875, 10876, 10877, 10878, 10879],
        actions: ["climb-on", "climb on", "cross", "walk-across", "walk across", undefined],
        run: rollBlock,
    },
    {
        locIds: [10860, 10886, 10888],
        actions: ["cross", "walk-across", "walk across", undefined],
        run: crossLedge,
    },
    {
        locIds: [10851, 10852],
        actions: ["climb", undefined],
        run: climbRocks,
    },
    {
        locIds: DOORWAY_LOC_IDS,
        actions: ["enter", "climb-down", "climb down", undefined],
        run: enterDoorway,
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
    registry.registerNpcInteraction?.(SIMON_NPC_ID, talkToSimon, "talk-to");
    registry.registerNpcInteraction?.(SIMON_NPC_ID, talkToSimon, "talk to");
    registry.registerNpcInteraction?.(SIMON_NPC_ID, talkToSimon, undefined);
    registry.registerItemOnNpc?.(PYRAMID_TOP_ITEM_ID, SIMON_NPC_ID, useTopOnSimon);
}

/** Test helper: clear pyramid-top claim tracking for one player or all players. */
export function resetPyramidCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        collectedTops.clear();
        return;
    }
    collectedTops.delete(playerId);
}

export function hasCollectedPyramidTop(playerId: number): boolean {
    return collectedTops.has(playerId);
}
