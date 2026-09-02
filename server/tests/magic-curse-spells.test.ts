import assert from "node:assert/strict";

import { SkillId, getXpForLevel } from "../../client/rs/skill/skills";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import type { NpcCombatStat, NpcState } from "../src/game/npc";
import type { PlayerState } from "../src/game/player";
import { PlayerSkillSystem } from "../src/game/state/PlayerSkillSystem";
import { PlayerStatusState } from "../src/game/state/PlayerStatusState";
import type { SpellDataEntry } from "../src/game/spells/SpellDataProvider";
import {
    TOME_OF_WATER_ITEM_ID,
    applyCurseSpellDrain,
    hasTomeOfWaterEquipped,
} from "../src/game/spells/CurseSpellEffects";

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});

/**
 * Test coverage for the OSRS curse spells:
 *  - Confuse   (1158 / id 3274)   -5% Attack
 *  - Weaken    (1159 / id 3278)   -5% Strength
 *  - Curse     (1161 / id 3282)   -5% Defence
 *  - Vulnerability (1542 / id 3324) -10% Defence (15% with Tome of Water)
 *  - Enfeeble  (1543 / id 3325)   -10% Strength
 *  - Stun      (1562 / id 3326)   -10% Attack
 *
 * OSRS rules verified here:
 *  - Drain applies only on a successful hit (caller-side gate).
 *  - Drain only fires when the target's stat is at base (no stack).
 *  - Vulnerability gets +5% (to 15%) with a Tome of Water equipped.
 */

const CONFUSE: SpellDataEntry = {
    id: 3274,
    name: "Confuse",
    baseMaxHit: 0,
    statDebuff: { stat: "attack", percent: 5 },
};

const WEAKEN: SpellDataEntry = {
    id: 3278,
    name: "Weaken",
    baseMaxHit: 0,
    statDebuff: { stat: "strength", percent: 5 },
};

const CURSE: SpellDataEntry = {
    id: 3282,
    name: "Curse",
    baseMaxHit: 0,
    statDebuff: { stat: "defence", percent: 5 },
};

const VULN: SpellDataEntry = {
    id: 3324,
    name: "Vulnerability",
    baseMaxHit: 0,
    statDebuff: { stat: "defence", percent: 10 },
};

const ENFEEBLE: SpellDataEntry = {
    id: 3325,
    name: "Enfeeble",
    baseMaxHit: 0,
    statDebuff: { stat: "strength", percent: 10 },
};

const STUN: SpellDataEntry = {
    id: 3326,
    name: "Stun",
    baseMaxHit: 0,
    statDebuff: { stat: "attack", percent: 10 },
};

function createPlayer(level: number): PlayerState {
    const skillSystem = new PlayerSkillSystem(
        new PlayerStatusState(),
        () => false,
        () => undefined,
    );
    skillSystem.setSkillXp(SkillId.Defence, xpForLevel(level));
    skillSystem.setSkillXp(SkillId.Attack, xpForLevel(level));
    skillSystem.setSkillXp(SkillId.Strength, xpForLevel(level));
    skillSystem.setSkillXp(SkillId.Hitpoints, xpForLevel(10));
    return { skillSystem, appearance: { equip: [] } } as unknown as PlayerState;
}

function xpForLevel(level: number): number {
    return getXpForLevel(level);
}

function createNpc(levels: Partial<Record<NpcCombatStat, number>>): NpcState {
    const base: Record<NpcCombatStat, number> = {
        attack: 100,
        strength: 100,
        defence: 100,
        magic: 100,
        ranged: 100,
        ...levels,
    };
    const combat = {
        attackLevel: base.attack,
        strengthLevel: base.strength,
        defenceLevel: base.defence,
        magicLevel: base.magic,
        rangedLevel: base.ranged,
    };
    const fieldFor: Record<NpcCombatStat, keyof typeof combat> = {
        attack: "attackLevel",
        strength: "strengthLevel",
        defence: "defenceLevel",
        magic: "magicLevel",
        ranged: "rangedLevel",
    };
    return {
        combat,
        baseCombatLevels: base,
        getCombatStat: (stat: NpcCombatStat) => combat[fieldFor[stat]],
        isCombatStatReduced: (stat: NpcCombatStat) =>
            Math.floor(combat[fieldFor[stat]]) < Math.floor(base[stat]),
        drainCombatStat: (stat: NpcCombatStat, amount: number) => {
            const field = fieldFor[stat];
            const current = Math.max(0, Math.floor(combat[field]));
            const next = Math.max(0, current - amount);
            combat[field] = next;
            return current - next;
        },
    } as unknown as NpcState;
}

function getPlayerStat(player: PlayerState, id: SkillId): number {
    const skill = player.skillSystem.getSkill(id);
    return Math.max(1, skill.baseLevel + skill.boost);
}

// ----------------------------------------------------------------------------
// Test cases
// ----------------------------------------------------------------------------

// 1) hasTomeOfWaterEquipped matches the helper's expected item id.
assert.equal(hasTomeOfWaterEquipped([]), false);
assert.equal(hasTomeOfWaterEquipped([-1, -1, 25576]), true);
assert.equal(hasTomeOfWaterEquipped([25575, -1, 25576]), true);
assert.equal(hasTomeOfWaterEquipped(undefined), false);
assert.equal(hasTomeOfWaterEquipped([25575]), false);

// 2) Player drain: Confuse drops Attack by 5% on first hit.
{
    const target = createPlayer(100);
    const r = applyCurseSpellDrain({
        spellData: CONFUSE,
        targetPlayer: target,
    });
    assert.equal(r.applied, true);
    assert.equal(r.drained, true);
    assert.equal(r.alreadyDrained, false);
    // 100 -> floor(100 * 0.05) = 5 -> 95
    assert.equal(getPlayerStat(target, SkillId.Attack), 95);
    assert.equal(r.newStat, 95);
}

// 3) Player drain: no-stack guard fires when stat already lowered.
{
    const target = createPlayer(100);
    // First cast drains Attack to 95.
    applyCurseSpellDrain({ spellData: CONFUSE, targetPlayer: target });
    // Second cast should be a no-op because stat is already lowered.
    const r = applyCurseSpellDrain({ spellData: CONFUSE, targetPlayer: target });
    assert.equal(r.applied, true);
    assert.equal(r.drained, false);
    assert.equal(r.alreadyDrained, true);
    assert.equal(getPlayerStat(target, SkillId.Attack), 95);
}

// 4) Vulnerability gets the Tome of Water bonus (+5% to 15%).
{
    const target = createPlayer(100);
    const attacker = { appearance: { equip: [TOME_OF_WATER_ITEM_ID] } } as PlayerState;
    const r = applyCurseSpellDrain({
        spellData: VULN,
        attacker,
        targetPlayer: target,
    });
    assert.equal(r.drained, true);
    // 100 * 0.15 = 15 -> 85
    assert.equal(getPlayerStat(target, SkillId.Defence), 85);
}

// 5) Vulnerability without Tome of Water drops 10%.
{
    const target = createPlayer(100);
    const r = applyCurseSpellDrain({ spellData: VULN, targetPlayer: target });
    assert.equal(r.drained, true);
    // 100 * 0.10 = 10 -> 90
    assert.equal(getPlayerStat(target, SkillId.Defence), 90);
}

// 6) Enfeeble drops Strength by 10%.
{
    const target = createPlayer(100);
    const r = applyCurseSpellDrain({ spellData: ENFEEBLE, targetPlayer: target });
    assert.equal(r.drained, true);
    assert.equal(getPlayerStat(target, SkillId.Strength), 90);
}

// 7) Weaken drops Strength by 5%.
{
    const target = createPlayer(100);
    const r = applyCurseSpellDrain({ spellData: WEAKEN, targetPlayer: target });
    assert.equal(r.drained, true);
    assert.equal(getPlayerStat(target, SkillId.Strength), 95);
}

// 8) Curse drops Defence by 5%.
{
    const target = createPlayer(100);
    const r = applyCurseSpellDrain({ spellData: CURSE, targetPlayer: target });
    assert.equal(r.drained, true);
    assert.equal(getPlayerStat(target, SkillId.Defence), 95);
}

// 9) Stun drops Attack by 10%.
{
    const target = createPlayer(100);
    const r = applyCurseSpellDrain({ spellData: STUN, targetPlayer: target });
    assert.equal(r.drained, true);
    assert.equal(getPlayerStat(target, SkillId.Attack), 90);
}

// 10) NPC drain: Vulnerability drops NPC defence by 10%.
{
    const npc = createNpc({ defence: 100 });
    const r = applyCurseSpellDrain({ spellData: VULN, targetNpc: npc });
    assert.equal(r.applied, true);
    assert.equal(r.drained, true);
    assert.equal(npc.getCombatStat("defence"), 90);
}

// 11) NPC drain: no-stack guard fires for NPCs.
{
    const npc = createNpc({ defence: 100 });
    applyCurseSpellDrain({ spellData: VULN, targetNpc: npc });
    const r = applyCurseSpellDrain({ spellData: VULN, targetNpc: npc });
    assert.equal(r.drained, false);
    assert.equal(r.alreadyDrained, true);
    assert.equal(npc.getCombatStat("defence"), 90);
}

// 12) NPC drain: Enfeeble drops NPC strength by 10%.
{
    const npc = createNpc({ strength: 80 });
    const r = applyCurseSpellDrain({ spellData: ENFEEBLE, targetNpc: npc });
    assert.equal(r.drained, true);
    assert.equal(npc.getCombatStat("strength"), 72);
}

// 13) Floor() rounds toward zero: defence 99 with 5% drain = 4 -> 95.
{
    const npc = createNpc({ defence: 99 });
    const r = applyCurseSpellDrain({ spellData: CURSE, targetNpc: npc });
    assert.equal(r.drained, true);
    // floor(99 * 0.05) = 4 -> 95
    assert.equal(npc.getCombatStat("defence"), 95);
}

// 14) Stat never drops below 1 (OSRS floors stats at 1).
{
    const npc = createNpc({ defence: 5 });
    const r = applyCurseSpellDrain({ spellData: CURSE, targetNpc: npc });
    assert.equal(r.drained, true);
    // floor(5 * 0.05) = 0 -> drop max(1, 0) = 1 -> 4
    assert.equal(npc.getCombatStat("defence"), 4);
}

// 15) Spells without statDebuff short-circuit cleanly.
{
    const noDebuff: SpellDataEntry = { id: 3273, name: "Wind Strike", baseMaxHit: 8 };
    const r = applyCurseSpellDrain({ spellData: noDebuff, targetPlayer: createPlayer(50) });
    assert.equal(r.applied, false);
    assert.equal(r.drained, false);
}

// 16) No target supplied is a no-op.
{
    const r = applyCurseSpellDrain({ spellData: VULN });
    assert.equal(r.applied, false);
    assert.equal(r.drained, false);
}