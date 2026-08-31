import type { Actor } from "../../../src/game/actor";
import { BossScript, registerBossScript } from "../../../src/game/combat/BossScriptFramework";
import { NpcState } from "../../../src/game/npc";
import { PlayerState } from "../../../src/game/player";

export {
    BossScript,
    BossPhase,
    BossSpecialAttack,
    BossMechanic,
    registerBossScript,
    getBossScript,
    createBossScript,
    type BossTileGraphic,
} from "../../../src/game/combat/BossScriptFramework";

// ============================================
// Giant Mole dig (NPC 5779)
// ============================================
// OSRS: below 50% HP the mole can dig and teleport to another chamber in the
// Falador Park lair. The player is not teleported — they have to find it again.

export const GIANT_MOLE_NPC_ID = 5779;

/** Matches MultiCombatZones "Giant Mole Lair". */
export const GIANT_MOLE_LAIR = {
    minX: 1728,
    minY: 5120,
    maxX: 1791,
    maxY: 5247,
    level: 0,
} as const;

/** Main chambers the mole relocates between (inside GIANT_MOLE_LAIR). */
export const GIANT_MOLE_DIG_SPOTS: ReadonlyArray<{ x: number; y: number; level: number }> = [
    { x: 1736, y: 5223, level: GIANT_MOLE_LAIR.level },
    { x: 1776, y: 5230, level: GIANT_MOLE_LAIR.level },
    { x: 1760, y: 5183, level: GIANT_MOLE_LAIR.level },
    { x: 1738, y: 5191, level: GIANT_MOLE_LAIR.level },
    { x: 1769, y: 5163, level: GIANT_MOLE_LAIR.level },
    { x: 1752, y: 5236, level: GIANT_MOLE_LAIR.level },
];

/** Sequential with claw (3312) / stomp (3313). */
export const GIANT_MOLE_DIG_ANIM = 3314;

const MIN_DIG_CHEBYSHEV = 8;

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function pickFrom<T>(items: readonly T[], random: () => number): T {
    const index = Math.min(items.length - 1, Math.floor(random() * items.length));
    return items[index];
}

export function isInGiantMoleLair(x: number, y: number, level: number): boolean {
    return (
        level === GIANT_MOLE_LAIR.level &&
        x >= GIANT_MOLE_LAIR.minX &&
        x <= GIANT_MOLE_LAIR.maxX &&
        y >= GIANT_MOLE_LAIR.minY &&
        y <= GIANT_MOLE_LAIR.maxY
    );
}

export function pickGiantMoleDigDestination(
    fromX: number,
    fromY: number,
    random: () => number = Math.random,
): { x: number; y: number; level: number } {
    const far = GIANT_MOLE_DIG_SPOTS.filter(
        (spot) => chebyshev(fromX, fromY, spot.x, spot.y) >= MIN_DIG_CHEBYSHEV,
    );
    if (far.length > 0) {
        return pickFrom(far, random);
    }
    const other = GIANT_MOLE_DIG_SPOTS.filter((spot) => spot.x !== fromX || spot.y !== fromY);
    if (other.length > 0) {
        return pickFrom(other, random);
    }
    const fallbackX = GIANT_MOLE_LAIR.minX + 8;
    const fallbackY = GIANT_MOLE_LAIR.minY + 8;
    if (fallbackX !== fromX || fallbackY !== fromY) {
        return { x: fallbackX, y: fallbackY, level: GIANT_MOLE_LAIR.level };
    }
    return { x: fallbackX + 4, y: fallbackY, level: GIANT_MOLE_LAIR.level };
}

/** Teleport the mole to another lair chamber. Player stays put (OSRS). */
export function executeGiantMoleDig(
    boss: BossScript,
    random: () => number = Math.random,
): { x: number; y: number; level: number } {
    const npc = boss.getNpc();
    const dest = pickGiantMoleDigDestination(npc.tileX, npc.tileY, random);
    npc.queueOneShotSeq(GIANT_MOLE_DIG_ANIM);
    boss.teleportNpc(dest.x, dest.y, dest.level);
    return dest;
}

// ============================================
// Zulrah snakelings (NPC 2042 summons 2045 / 2046)
// ============================================
// OSRS: during later rotations Zulrah summons melee and mage snakelings onto
// the shrine. The player is not moved. Venom clouds spawn on the target tile.

export const ZULRAH_NPC_ID = 2042;
export const ZULRAH_SNAKELING_MELEE_ID = 2045;
export const ZULRAH_SNAKELING_MAGE_ID = 2046;

/** Matches MultiCombatZones "Zulrah Shrine". */
export const ZULRAH_SHRINE = {
    minX: 2256,
    minY: 3056,
    maxX: 2287,
    maxY: 3087,
    level: 0,
} as const;

/** Pillar-adjacent tiles on the shrine where snakelings emerge. */
export const ZULRAH_SNAKELING_SPAWN_SPOTS: ReadonlyArray<{ x: number; y: number; level: number }> = [
    { x: 2263, y: 3072, level: ZULRAH_SHRINE.level },
    { x: 2263, y: 3075, level: ZULRAH_SHRINE.level },
    { x: 2273, y: 3072, level: ZULRAH_SHRINE.level },
    { x: 2273, y: 3075, level: ZULRAH_SHRINE.level },
];

/** Same seq as the snakeling special (Zulrah ranged/magic attack). */
export const ZULRAH_SNAKELING_ANIM = 5069;

/** Tile gfx between Zulrah ranged (1044) and magic (1046) projectiles. */
export const ZULRAH_VENOM_CLOUD_GFX = 1045;

/** Same spit seq as ranged/magic/snakeling. */
export const ZULRAH_VENOM_CLOUD_ANIM = 5069;

/** OSRS venom starts at 6 damage. */
export const ZULRAH_VENOM_STAGE = 6;

export function isInZulrahShrine(x: number, y: number, level: number): boolean {
    return (
        level === ZULRAH_SHRINE.level &&
        x >= ZULRAH_SHRINE.minX &&
        x <= ZULRAH_SHRINE.maxX &&
        y >= ZULRAH_SHRINE.minY &&
        y <= ZULRAH_SHRINE.maxY
    );
}

export function pickZulrahSnakelingDestinations(
    occupiedX: number,
    occupiedY: number,
    random: () => number = Math.random,
): [{ x: number; y: number; level: number }, { x: number; y: number; level: number }] {
    const free = ZULRAH_SNAKELING_SPAWN_SPOTS.filter(
        (spot) => spot.x !== occupiedX || spot.y !== occupiedY,
    );
    const pool = free.length >= 2 ? free : ZULRAH_SNAKELING_SPAWN_SPOTS;
    const first = pickFrom(pool, random);
    const rest = pool.filter((spot) => spot.x !== first.x || spot.y !== first.y);
    const second = rest.length > 0 ? pickFrom(rest, random) : first;
    return [first, second];
}

export type ZulrahSnakelingSpawn = {
    typeId: number;
    x: number;
    y: number;
    level: number;
};

/** Spawn melee + mage snakelings on shrine tiles. Player stays put (OSRS). */
export function executeZulrahSnakeling(
    boss: BossScript,
    target: Actor,
    random: () => number = Math.random,
): ZulrahSnakelingSpawn[] {
    const npc = boss.getNpc();
    npc.queueOneShotSeq(ZULRAH_SNAKELING_ANIM);
    const dests = pickZulrahSnakelingDestinations(target.tileX, target.tileY, random);
    const plans: ZulrahSnakelingSpawn[] = [
        { typeId: ZULRAH_SNAKELING_MELEE_ID, ...dests[0] },
        { typeId: ZULRAH_SNAKELING_MAGE_ID, ...dests[1] },
    ];
    for (const plan of plans) {
        boss.spawnNpc({
            id: plan.typeId,
            name: "Snakeling",
            x: plan.x,
            y: plan.y,
            level: plan.level,
            wanderRadius: 5,
            worldViewId: npc.worldViewId,
            ownerPlayerId: npc.ownerPlayerId,
        });
    }
    return plans;
}

export type ZulrahVenomCloudSpawn = {
    x: number;
    y: number;
    level: number;
    gfxId: number;
    venomApplied: boolean;
};

function applyZulrahVenom(target: Actor, currentTick: number): boolean {
    if (target instanceof PlayerState) {
        target.skillSystem.inflictVenom(ZULRAH_VENOM_STAGE, currentTick);
        return true;
    }
    if (target instanceof NpcState) {
        target.inflictVenom(ZULRAH_VENOM_STAGE, currentTick);
        return true;
    }
    return false;
}

/**
 * Spawn a venom cloud on the combat target's tile (tile gfx + venom).
 * No loc object API exists; this is a temporary area effect. Player stays put.
 */
export function executeZulrahVenomCloud(boss: BossScript, target: Actor): ZulrahVenomCloudSpawn {
    const npc = boss.getNpc();
    npc.queueOneShotSeq(ZULRAH_VENOM_CLOUD_ANIM);
    const cloud: ZulrahVenomCloudSpawn = {
        x: target.tileX,
        y: target.tileY,
        level: target.level,
        gfxId: ZULRAH_VENOM_CLOUD_GFX,
        venomApplied: applyZulrahVenom(target, boss.getCurrentTick()),
    };
    boss.enqueueSpotAnimation({
        spotId: cloud.gfxId,
        tile: { x: cloud.x, y: cloud.y, level: cloud.level },
        height: 0,
    });
    return cloud;
}

// ============================================
// Boss Implementations
// ============================================

class GiantMoleScript extends BossScript {
    protected initialize(): void {
        this.addPhase({
            name: "Normal",
            attackPatterns: ["claw", "stomp"],
            mechanics: ["dig_escape"],
        });

        this.addSpecialAttack({
            name: "claw",
            cooldown: 4,
            animation: 3312,
            minDamage: 1,
            maxDamage: 21,
            style: "melee",
        });

        this.addSpecialAttack({
            name: "stomp",
            cooldown: 6,
            animation: 3313,
            minDamage: 5,
            maxDamage: 30,
            style: "melee",
            aoeRadius: 1,
        });

        this.addMechanic({
            name: "dig_escape",
            interval: 10,
            shouldActivate: (boss) => {
                const npc = boss.getNpc();
                const hpPercent = npc.getHitpoints() / npc.getMaxHitpoints();
                return hpPercent < 0.5 && Math.random() < 0.15;
            },
            tick: (boss) => {
                executeGiantMoleDig(boss);
            },
        });
    }
}

class DagannothRexScript extends BossScript {
    protected initialize(): void {
        this.addPhase({
            name: "Normal",
            attackPatterns: ["melee_attack"],
        });

        this.addSpecialAttack({
            name: "melee_attack",
            cooldown: 4,
            animation: 2853,
            minDamage: 1,
            maxDamage: 26,
            style: "melee",
        });
    }

    protected getAttackSpeed(): number {
        return 4;
    }
}

class DagannothPrimeScript extends BossScript {
    protected initialize(): void {
        this.addPhase({
            name: "Normal",
            attackPatterns: ["magic_attack"],
        });

        this.addSpecialAttack({
            name: "magic_attack",
            cooldown: 4,
            animation: 2854,
            projectile: 162,
            minDamage: 1,
            maxDamage: 50,
            style: "magic",
        });
    }
}

class DagannothSupremeScript extends BossScript {
    protected initialize(): void {
        this.addPhase({
            name: "Normal",
            attackPatterns: ["ranged_attack"],
        });

        this.addSpecialAttack({
            name: "ranged_attack",
            cooldown: 4,
            animation: 2855,
            projectile: 294,
            minDamage: 1,
            maxDamage: 30,
            style: "ranged",
        });
    }
}

class GeneralGraardorScript extends BossScript {
    protected initialize(): void {
        this.addPhase({
            name: "Normal",
            attackPatterns: ["melee_attack", "ranged_attack"],
        });

        this.addSpecialAttack({
            name: "melee_attack",
            cooldown: 6,
            animation: 7018,
            minDamage: 1,
            maxDamage: 60,
            style: "melee",
        });

        this.addSpecialAttack({
            name: "ranged_attack",
            cooldown: 6,
            animation: 7021,
            minDamage: 1,
            maxDamage: 35,
            style: "ranged",
            aoeRadius: 15,
            condition: (boss) => {
                return Math.random() < 0.33;
            },
        });
    }

    protected getAttackSpeed(): number {
        return 6;
    }
}

class ZulrahScript extends BossScript {
    protected initialize(): void {
        this.addPhase({
            name: "Green",
            attackPatterns: ["ranged_attack", "venom_cloud"],
            hpThresholdPercent: 100,
        });

        this.addPhase({
            name: "Blue",
            attackPatterns: ["magic_attack", "venom_cloud"],
            hpThresholdPercent: 75,
            onEnter: (boss) => {
                // boss.getNpc().setTransformation(2043);
            },
        });

        this.addPhase({
            name: "Red",
            attackPatterns: ["melee_attack"],
            hpThresholdPercent: 50,
            onEnter: (boss) => {
                // boss.getNpc().setTransformation(2044);
            },
        });

        this.addPhase({
            name: "Green Final",
            attackPatterns: ["ranged_attack", "venom_cloud", "snakeling"],
            hpThresholdPercent: 25,
            onEnter: (boss) => {
                // boss.getNpc().setTransformation(2042);
            },
        });

        this.addSpecialAttack({
            name: "ranged_attack",
            cooldown: 4,
            animation: 5069,
            projectile: 1044,
            minDamage: 1,
            maxDamage: 41,
            style: "ranged",
        });

        this.addSpecialAttack({
            name: "magic_attack",
            cooldown: 4,
            animation: 5069,
            projectile: 1046,
            minDamage: 1,
            maxDamage: 41,
            style: "magic",
        });

        this.addSpecialAttack({
            name: "melee_attack",
            cooldown: 3,
            animation: 5806,
            minDamage: 1,
            maxDamage: 32,
            style: "melee",
        });

        this.addSpecialAttack({
            name: "venom_cloud",
            cooldown: 12,
            animation: 5069,
            minDamage: 0,
            maxDamage: 0,
            style: "typeless",
            execute: (boss, target) => {
                executeZulrahVenomCloud(boss, target);
            },
        });

        this.addSpecialAttack({
            name: "snakeling",
            cooldown: 20,
            animation: 5069,
            minDamage: 0,
            maxDamage: 0,
            style: "typeless",
            execute: (boss, target) => {
                executeZulrahSnakeling(boss, target);
            },
        });
    }

    protected getAttackSpeed(): number {
        return 4;
    }
}

registerBossScript(5779, GiantMoleScript); // Giant Mole
registerBossScript(2265, DagannothRexScript); // Dagannoth Rex
registerBossScript(2266, DagannothPrimeScript); // Dagannoth Prime
registerBossScript(2267, DagannothSupremeScript); // Dagannoth Supreme
registerBossScript(2215, GeneralGraardorScript); // General Graardor
registerBossScript(2042, ZulrahScript); // Zulrah
