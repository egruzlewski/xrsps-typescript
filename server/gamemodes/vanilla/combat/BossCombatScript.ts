import { BossScript, registerBossScript } from "../../../src/game/combat/BossScriptFramework";

export {
    BossScript,
    BossPhase,
    BossSpecialAttack,
    BossMechanic,
    registerBossScript,
    getBossScript,
    createBossScript,
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
                // Spawn venom cloud at target location
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
                // Spawn snakeling NPCs
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
