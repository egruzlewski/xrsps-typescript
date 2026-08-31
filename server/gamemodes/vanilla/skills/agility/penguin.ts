/**
 * Penguin Agility Course (Iceberg / KGP HQ; level 30 boostable; current OSRS XP, 540/lap).
 * Fail-proof (OSRS can fail crushers / stones / icicles / ice even at 99; not ported).
 * Clockwork suit 10595 (wound 10596) must be in the cape slot or inventory.
 * Larry tuxedo-time / penguin transform is not wired (Cold War is not registered) —
 * inventory presence is accepted as the suit check.
 * Crushers are walk-past NPCs 856–859 (no loc); 55 XP is awarded on climbing 21120
 * out of the water, or on clicking a crusher NPC. Crusher collision is not ported.
 * Ice-slope cutscene is skipped (ice click teleports to the gate approach).
 */
import { EquipmentSlot } from "../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    NpcInteractionEvent,
} from "../../../../src/game/scripts/types";

const CLIMB_ANIM = 828; // human_climb (first stone out of the water)
const JUMP_ANIM = 769; // stepping-stone hop
const TREAD_ANIM = 762; // human_walk_logbalance (icicles / ice)

const STONE_MOVE_TICKS = 2;
const ICICLE_MOVE_TICKS = 3;
const ICE_MOVE_TICKS = 8;
const GATE_MOVE_TICKS = 2;

const COURSE_LEVEL = 30;
const LAST_STAGE = 7;
const CRUSHER_XP = 55;
const STONE_XP = 80;
const ICICLE_XP = 40;
const ICE_XP = 180;
const GATE_XP = 65;

const CLOCKWORK_SUIT_UNWOUND = 10595;
const CLOCKWORK_SUIT_WOUND = 10596;
const CLOCKWORK_SUIT_IDS = new Set([CLOCKWORK_SUIT_UNWOUND, CLOCKWORK_SUIT_WOUND]);
const CRUSHER_NPC_IDS = [856, 857, 858, 859];

const STONE_START = { x: 2630, y: 4057, level: 0 } as const;
const STONE_END = { x: 2635, y: 4065, level: 0 } as const;
const GATE_APPROACH = { x: 2653, y: 4040, level: 1 } as const;

/** playerId → next expected stage (0 = crushers / first stone). */
const courseProgress = new Map<number, number>();

interface ObstacleDef {
    locIds: number[];
    actions: Array<string | undefined>;
    run: (event: LocInteractionEvent) => void;
}

type MoveEvent = {
    player: PlayerState;
    services: LocInteractionEvent["services"];
    tick: number;
};

function playMove(
    event: MoveEvent,
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

function agilityLevel(event: MoveEvent): number {
    const skill = event.services.skills.getSkill(event.player, SkillId.Agility);
    return Math.max(1, (skill?.baseLevel ?? 1) + (skill?.boost ?? 0));
}

function requireCourseLevel(event: MoveEvent): boolean {
    if (agilityLevel(event) >= COURSE_LEVEL) {
        return true;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        "You need an Agility level of 30 to attempt this.",
    );
    return false;
}

function hasPenguinSuit(event: MoveEvent): boolean {
    const cape = event.services.equipment?.getEquippedItem?.(event.player, EquipmentSlot.CAPE) ?? 0;
    if (CLOCKWORK_SUIT_IDS.has(cape)) {
        return true;
    }
    const count = event.player.items?.getItemCount?.bind(event.player.items);
    if (!count) {
        return false;
    }
    return count(CLOCKWORK_SUIT_UNWOUND) > 0 || count(CLOCKWORK_SUIT_WOUND) > 0;
}

function requirePenguinSuit(event: MoveEvent): boolean {
    if (hasPenguinSuit(event)) {
        return true;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        "You need to be wearing a penguin suit to use this course.",
    );
    return false;
}

function canAttempt(event: MoveEvent): boolean {
    return requireCourseLevel(event) && requirePenguinSuit(event);
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

/** Same loc family clicked again after this stage already advanced — move only, no XP. */
function isRepeatOfStage(playerId: number, stage: number): boolean {
    if (stage === LAST_STAGE) {
        return false;
    }
    const expected = courseProgress.get(playerId) ?? 0;
    return expected === stage + 1;
}

function award(
    event: MoveEvent,
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
            "You have completed the Penguin Agility Course.",
        );
    }
}

function passCrushers(event: MoveEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    playMove(
        event,
        STONE_START.x,
        STONE_START.y,
        STONE_START.level,
        CLIMB_ANIM,
        STONE_MOVE_TICKS,
    );
    if (isRepeatOfStage(event.player.id, 0)) {
        event.services.messaging.sendGameMessage(
            event.player,
            "You climb onto the stepping stone.",
        );
        return;
    }
    award(event, CRUSHER_XP, 0, "You dodge the crushers and climb onto the stepping stone.");
}

function climbFirstStone(event: LocInteractionEvent): void {
    passCrushers(event);
}

function passCrusherNpc(event: NpcInteractionEvent): void {
    passCrushers(event);
}

function hopSteppingStone(event: LocInteractionEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    playMove(event, STONE_END.x, STONE_END.y, STONE_END.level, JUMP_ANIM, STONE_MOVE_TICKS);
    if (isRepeatOfStage(event.player.id, 1)) {
        event.services.messaging.sendGameMessage(
            event.player,
            "You jump to the next stepping stone.",
        );
        return;
    }
    award(event, STONE_XP, 1, "You jump across the stepping stones.");
}

function treadIcicles(event: LocInteractionEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    const dest = destPast(event.player, event.tile, 1);
    playMove(event, dest.x, dest.y, 1, TREAD_ANIM, ICICLE_MOVE_TICKS);
    const expected = courseProgress.get(event.player.id) ?? 0;
    if (expected >= 2 && expected <= 5) {
        award(event, ICICLE_XP, expected, "You tread softly under the icicles.");
        return;
    }
    if (expected > 5) {
        event.services.messaging.sendGameMessage(
            event.player,
            "You tread softly under the icicles.",
        );
        return;
    }
    award(event, ICICLE_XP, 2, "You tread softly under the icicles.");
}

function crossIce(event: LocInteractionEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    playMove(
        event,
        GATE_APPROACH.x,
        GATE_APPROACH.y,
        GATE_APPROACH.level,
        TREAD_ANIM,
        ICE_MOVE_TICKS,
    );
    if (isRepeatOfStage(event.player.id, 6)) {
        event.services.messaging.sendGameMessage(event.player, "You cross the ice.");
        return;
    }
    award(event, ICE_XP, 6, "You cross the ice.");
}

function openGate(event: LocInteractionEvent): void {
    if (!canAttempt(event)) {
        return;
    }
    const dest = destPast(event.player, event.tile, 1);
    playMove(event, dest.x, dest.y, GATE_APPROACH.level, CLIMB_ANIM, GATE_MOVE_TICKS);
    award(event, GATE_XP, 7, "You open the gate.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [21120],
        actions: ["climb", "climb-up", "climb up", undefined],
        run: climbFirstStone,
    },
    {
        locIds: [21128, 21129, 21130, 21131, 21132, 21133],
        actions: ["climb", "jump", "jump-to", "jump to", undefined],
        run: hopSteppingStone,
    },
    {
        locIds: [21134],
        actions: ["tread-softly", "tread softly", "tread", undefined],
        run: treadIcicles,
    },
    {
        locIds: [21148, 21149, 21150, 21151, 21152, 21153, 21154, 21155, 21156],
        actions: ["cross", undefined],
        run: crossIce,
    },
    {
        locIds: [21172],
        actions: ["open", undefined],
        run: openGate,
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
    // Optional: loc-only agility tests may omit registerNpcInteraction.
    for (const npcId of CRUSHER_NPC_IDS) {
        registry.registerNpcInteraction?.(npcId, passCrusherNpc, undefined);
        registry.registerNpcInteraction?.(npcId, passCrusherNpc, "pass");
    }
}

/** Test helper: clear lap tracking for one player or all players. */
export function resetPenguinCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        courseProgress.clear();
        return;
    }
    courseProgress.delete(playerId);
}

export function getPenguinCourseStage(playerId: number): number {
    return courseProgress.get(playerId) ?? 0;
}
