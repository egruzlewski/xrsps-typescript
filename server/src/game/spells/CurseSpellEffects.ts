/**
 * OSRS curse-spell (Confuse/Weaken/Curse/Vulnerability/Enfeeble/Stun) helpers.
 *
 * These spells apply a fractional stat drain to the target on landed hits.
 * OSRS rules:
 * - The drain only applies on a successful hit (a splash never drains).
 * - The drain only applies if the target's stat is currently at base level.
 *   If the stat has already been lowered (e.g. by a prior curse spell),
 *   the drain does not stack — the cast still costs runes and gives XP, but
 *   no further reduction is applied.
 * - Vulnerability deals 10% Defence reduction normally, or 15% with a Tome
 *   of Water equipped.
 *
 * @see https://oldschool.runescape.wiki/w/Curse_spells
 */

import { SkillId } from "../../../../client/rs/skill/skills";
import type { NpcCombatStat, NpcState } from "../npc";
import type { PlayerState } from "../player";
import type { SpellDataEntry } from "./SpellDataProvider";

/** Item id of the Tome of Water (Tempoross reward). */
export const TOME_OF_WATER_ITEM_ID = 25576;

export type CurseSpellStat = "attack" | "strength" | "defence";

/**
 * Map a spell-stat drain target to the player's SkillId.
 */
function playerSkillIdForStat(stat: CurseSpellStat): SkillId {
    switch (stat) {
        case "attack":
            return SkillId.Attack;
        case "strength":
            return SkillId.Strength;
        case "defence":
            return SkillId.Defence;
        default:
            return SkillId.Attack;
    }
}

/**
 * Map a spell-stat drain target to the NPC's NpcCombatStat.
 */
function npcStatForStat(stat: CurseSpellStat): NpcCombatStat {
    switch (stat) {
        case "attack":
            return "attack";
        case "strength":
            return "strength";
        case "defence":
            return "defence";
        default:
            return "attack";
    }
}

/**
 * True if the given stat is currently at its base level (i.e. not yet drained).
 * Returns true for a missing skill record, which mirrors the OSRS "fresh stat" state.
 */
function isStatAtBase(
    baseLevel: number,
    currentLevel: number,
): boolean {
    return Math.floor(currentLevel) >= Math.floor(baseLevel);
}

/**
 * True if the equipped items contain a Tome of Water (any shield slot).
 */
export function hasTomeOfWaterEquipped(equipped: number[] | undefined): boolean {
    if (!Array.isArray(equipped) || equipped.length === 0) return false;
    for (const id of equipped) {
        if (id === TOME_OF_WATER_ITEM_ID) return true;
    }
    return false;
}

export type ApplyCurseOptions = {
    spellData: SpellDataEntry;
    attacker?: PlayerState;
    /** Pass true if the spell is targeted at a non-player (NPC) instead. */
    targetNpc?: NpcState;
    /** Pass true if the spell is targeted at a player instead. */
    targetPlayer?: PlayerState;
};

export type ApplyCurseResult = {
    applied: boolean;
    /** True if the drain was applied this tick (stat not yet lowered). */
    drained: boolean;
    /** True if the drain was skipped because the stat was already lowered. */
    alreadyDrained: boolean;
    /** Resulting stat value after the drain (or current if no drain applied). */
    newStat: number;
};

/**
 * Apply a curse spell's stat-drain effect on the targeted entity.
 *
 * Returns `applied: false` when the spell data has no stat debuff, when no
 * target was supplied, or when the drain could not be applied for any reason
 * other than the no-stack guard. The drain is skipped (with `alreadyDrained:
 * true`) when the target's stat is already below its base level — this
 * matches the OSRS rule that curse spells do not stack with themselves.
 *
 * The drain is only applied on a successful hit. Callers are responsible for
 * gating `landed` before invoking this helper; the helper does not check it.
 */
export function applyCurseSpellDrain(opts: ApplyCurseOptions): ApplyCurseResult {
    const { spellData, targetNpc, targetPlayer } = opts;
    const statDebuff = spellData.statDebuff;
    if (!statDebuff) {
        return { applied: false, drained: false, alreadyDrained: false, newStat: 0 };
    }

    const stat = statDebuff.stat as CurseSpellStat;
    const basePercent = Math.max(0, statDebuff.percent);

    // Tome of Water upgrade: Vulnerability drops Defence by 15% instead of 10%
    // when the caster has a Tome of Water equipped.
    const attackerEquip =
        opts.attacker && Array.isArray(opts.attacker.appearance?.equip)
            ? opts.attacker.appearance!.equip
            : undefined;
    const tomeBonus =
        stat === "defence" &&
        spellData.name === "Vulnerability" &&
        hasTomeOfWaterEquipped(attackerEquip)
            ? 5
            : 0;
    const percent = basePercent + tomeBonus;

    if (targetNpc) {
        const npcStat = npcStatForStat(stat);
        if (targetNpc.isCombatStatReduced(npcStat)) {
            const currentLevel = targetNpc.getCombatStat(npcStat);
            return {
                applied: true,
                drained: false,
                alreadyDrained: true,
                newStat: currentLevel,
            };
        }
        const currentLevel = targetNpc.getCombatStat(npcStat);
        const drop = Math.max(1, Math.floor((currentLevel * percent) / 100));
        const next = Math.max(1, currentLevel - drop);
        targetNpc.drainCombatStat(npcStat, drop);
        return { applied: true, drained: true, alreadyDrained: false, newStat: next };
    }

    if (targetPlayer) {
        const skillId = playerSkillIdForStat(stat);
        const skill = targetPlayer.skillSystem.getSkill(skillId);
        if (!skill) {
            return { applied: false, drained: false, alreadyDrained: false, newStat: 0 };
        }
        const baseLevel = skill.baseLevel;
        const currentLevel = Math.max(1, baseLevel + skill.boost);
        if (!isStatAtBase(baseLevel, currentLevel)) {
            return {
                applied: true,
                drained: false,
                alreadyDrained: true,
                newStat: currentLevel,
            };
        }
        const drop = Math.max(1, Math.floor((currentLevel * percent) / 100));
        const newLevel = Math.max(1, currentLevel - drop);
        targetPlayer.skillSystem.setSkillBoost(skillId, newLevel);
        return { applied: true, drained: true, alreadyDrained: false, newStat: newLevel };
    }

    return { applied: false, drained: false, alreadyDrained: false, newStat: 0 };
}