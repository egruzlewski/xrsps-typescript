/**
 * Hallowed Sepulchre (Darkmeyer). Scoped to floor obstacles that award Agility XP:
 * platforms/gaps, mid-floor stairs (25), end-of-floor stairs, Magical Obelisk exit,
 * and treasure-path bridges. Current OSRS XP; fail-proof.
 * Floors 1–5: 52 / 62 / 72 / 77 / 87 (boostable; 12 Aug 2026 floor 4/5 drop).
 * Floor completion: 500 / 850 / 1425 / 2625 / 5850 (obelisk on floor 5).
 * Skipped: timer / sealed stairs, loot coffers, Grand Hallowed Coffin, dark/light
 * trap puzzles, hallowed marks shop, Sins of the Father lock, construction/build
 * on bridges, first-crossing-only bridge cap, Activate run-energy restore.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

const JUMP_ANIM = 769; // stepping-stone hop (platform / gap)
const CLIMB_ANIM = 828; // human_climb (stairs)
const BRIDGE_ANIM = 762; // human_walk_logbalance (bridge)

const PLATFORM_MOVE_TICKS = 3;
const STEPPING_MOVE_TICKS = 2;
const BRIDGE_MOVE_TICKS = 4;

const PLATFORM_SPAN = 7;
const FLOOR3_PLATFORM_SPAN = 10;
const STEPPING_SPAN = 2;
const FLOOR5_PLATFORM_SPAN = 3;
const STAIR_SPAN = 2;
const BRIDGE_SPAN = 4;

const FLOOR_LEVEL = [0, 52, 62, 72, 77, 87] as const;
const FLOOR_XP = [0, 500, 850, 1425, 2625, 5850] as const;
const BRIDGE_XP = [0, 50, 50, 75, 75, 80] as const;
const MID_STAIR_XP = 25;
const PLATFORM_XP = 50;
const STEPPING_XP = 10;
const FLOOR5_PLATFORM_XP = 100;

const LOBBY = { x: 2400, y: 5986, level: 0 } as const;
const FLOOR_START = [
    LOBBY,
    { x: 2272, y: 5984, level: 0 },
    { x: 2528, y: 5984, level: 0 },
    { x: 2400, y: 5856, level: 0 },
    { x: 2527, y: 5855, level: 0 },
    { x: 2272, y: 5862, level: 0 },
] as const;

/** playerId → current floor 1–5 while inside. */
const playerFloor = new Map<number, number>();

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

function currentFloor(player: PlayerState): number {
    return playerFloor.get(player.id) ?? 1;
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

function enterLobbyStairs(event: LocInteractionEvent): void {
    if (!requireLevel(event, FLOOR_LEVEL[1])) {
        return;
    }
    const dest = FLOOR_START[1];
    playMove(event, dest.x, dest.y, dest.level, CLIMB_ANIM, 0);
    playerFloor.set(event.player.id, 1);
    awardXp(event, 0, "You climb down the stairs...");
}

function climbMidStairs(event: LocInteractionEvent): void {
    if (!requireLevel(event, FLOOR_LEVEL[1])) {
        return;
    }
    const dest = destPast(event.player, event.tile, STAIR_SPAN);
    const destLevel = Math.max(0, event.player.level - 1);
    playMove(event, dest.x, dest.y, destLevel, CLIMB_ANIM, 0);
    awardXp(event, MID_STAIR_XP, "You climb down the stairs...");
}

function completeFloor(event: LocInteractionEvent, floor: number, nextFloor: boolean): void {
    const xp = FLOOR_XP[floor] ?? 0;
    awardXp(
        event,
        xp,
        nextFloor
            ? "You climb down the stairs to the next floor..."
            : "You step into the magical obelisk...",
    );
    if (xp > 0) {
        event.services.messaging.sendGameMessage(
            event.player,
            `You have completed floor ${floor} of the Hallowed Sepulchre.`,
        );
    }
}

function climbEndStairs(event: LocInteractionEvent, fromFloor?: number): void {
    const floor = fromFloor ?? currentFloor(event.player);
    if (floor < 1 || floor > 4) {
        return;
    }
    const next = floor + 1;
    if (!requireLevel(event, FLOOR_LEVEL[next])) {
        return;
    }
    const dest = FLOOR_START[next];
    playMove(event, dest.x, dest.y, dest.level, CLIMB_ANIM, 0);
    completeFloor(event, floor, true);
    playerFloor.set(event.player.id, next);
}

function exitObelisk(event: LocInteractionEvent): void {
    if (!requireLevel(event, FLOOR_LEVEL[1])) {
        return;
    }
    const action = event.action?.toLowerCase();
    if (action === "activate") {
        event.services.messaging.sendGameMessage(
            event.player,
            "The obelisk hums, but nothing else happens.",
        );
        return;
    }
    const floor = currentFloor(event.player);
    playMove(event, LOBBY.x, LOBBY.y, LOBBY.level, CLIMB_ANIM, 0);
    completeFloor(event, floor, false);
    playerFloor.delete(event.player.id);
}

function jumpPlatform(event: LocInteractionEvent, span: number, xp: number): void {
    if (!requireLevel(event, FLOOR_LEVEL[1])) {
        return;
    }
    const dest = destPast(event.player, event.tile, span);
    playMove(event, dest.x, dest.y, event.player.level, JUMP_ANIM, PLATFORM_MOVE_TICKS);
    awardXp(event, xp, "You jump across the gap.");
}

function jumpSteppingStone(event: LocInteractionEvent): void {
    if (!requireLevel(event, FLOOR_LEVEL[2])) {
        return;
    }
    const dest = destPast(event.player, event.tile, STEPPING_SPAN);
    playMove(event, dest.x, dest.y, event.player.level, JUMP_ANIM, STEPPING_MOVE_TICKS);
    awardXp(event, STEPPING_XP, "You hop across the platforms.");
}

function jumpFloor5Platform(event: LocInteractionEvent): void {
    if (!requireLevel(event, FLOOR_LEVEL[5])) {
        return;
    }
    const dest = destPast(event.player, event.tile, FLOOR5_PLATFORM_SPAN);
    playMove(event, dest.x, dest.y, event.player.level, JUMP_ANIM, PLATFORM_MOVE_TICKS);
    awardXp(event, FLOOR5_PLATFORM_XP, "You jump across the gap.");
}

function crossBridge(event: LocInteractionEvent): void {
    if (!requireLevel(event, FLOOR_LEVEL[1])) {
        return;
    }
    const dest = destPast(event.player, event.tile, BRIDGE_SPAN);
    playMove(event, dest.x, dest.y, event.player.level, BRIDGE_ANIM, BRIDGE_MOVE_TICKS);
    const floor = currentFloor(event.player);
    awardXp(event, BRIDGE_XP[floor] ?? 50, "You cross the bridge.");
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [38452],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: enterLobbyStairs,
    },
    {
        locIds: [
            38463, 38464, 38466, 38467, 38468, 38474, 38462, 38465, 38469, 38471, 38472, 38473,
            38475, 38476,
        ],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: climbMidStairs,
    },
    {
        locIds: [38453],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: (event) => climbEndStairs(event),
    },
    {
        locIds: [39622],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: (event) => climbEndStairs(event, 1),
    },
    {
        locIds: [39623],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: (event) => climbEndStairs(event, 2),
    },
    {
        locIds: [39624],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: (event) => climbEndStairs(event, 3),
    },
    {
        locIds: [39625],
        actions: ["climb-down", "climb down", "climb", undefined],
        run: (event) => climbEndStairs(event, 4),
    },
    {
        locIds: [38451],
        actions: ["exit", "quick-exit", "quick exit", "activate", undefined],
        run: exitObelisk,
    },
    {
        locIds: [38455, 38456, 38457, 38458],
        actions: ["jump", undefined],
        run: (event) => jumpPlatform(event, PLATFORM_SPAN, PLATFORM_XP),
    },
    {
        locIds: [38459],
        actions: ["jump", undefined],
        run: (event) => jumpPlatform(event, FLOOR3_PLATFORM_SPAN, PLATFORM_XP),
    },
    {
        locIds: [38470],
        actions: ["jump", undefined],
        run: jumpSteppingStone,
    },
    {
        locIds: [38477],
        actions: ["jump", undefined],
        run: jumpFloor5Platform,
    },
    {
        locIds: [38806, 38807, 38808, 38809, 38810, 38811],
        actions: ["cross", "walk-across", "walk across", "build", undefined],
        run: crossBridge,
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

/** Test helper: clear floor tracking for one player or all players. */
export function resetSepulchreProgress(playerId?: number): void {
    if (playerId === undefined) {
        playerFloor.clear();
        return;
    }
    playerFloor.delete(playerId);
}

export function getSepulchreFloor(playerId: number): number {
    return playerFloor.get(playerId) ?? 0;
}
