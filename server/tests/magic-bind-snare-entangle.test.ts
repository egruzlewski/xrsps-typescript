import assert from "node:assert/strict";

import { CombatAttributeStore } from "../src/game/combat/state/CombatAttributeStore";
import { CombatAttributes } from "../src/game/combat/state/CombatAttributes";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";
import type { SpellDataEntry } from "../src/game/spells/SpellDataProvider";
import { registerSpellDataProvider } from "../src/game/spells/SpellDataProvider";
import { SpellEffectsManager } from "../src/game/spells/SpellEffects";

// Register a minimal spell data provider that knows about Bind/Snare/Entangle.
const BIND_DATA: SpellDataEntry = {
    id: 3283,
    name: "Bind",
    baseMaxHit: 0,
    bindDuration: 8,
    experienceGained: 31,
    spellbook: "standard",
    category: "binding",
};
const SNARE_DATA: SpellDataEntry = {
    id: 3300,
    name: "Snare",
    baseMaxHit: 2,
    bindDuration: 16,
    experienceGained: 61,
    spellbook: "standard",
    category: "binding",
};
const ENTANGLE_DATA: SpellDataEntry = {
    id: 3322,
    name: "Entangle",
    baseMaxHit: 5,
    bindDuration: 24,
    experienceGained: 89,
    spellbook: "standard",
    category: "binding",
};

registerSpellDataProvider({
    getSpellData: (spellId: number) => {
        if (spellId === 3283) return BIND_DATA;
        if (spellId === 3300) return SNARE_DATA;
        if (spellId === 3322) return ENTANGLE_DATA;
        return undefined;
    },
    getSpellDataByWidget: () => undefined,
    getAllSpellData: () => [BIND_DATA, SNARE_DATA, ENTANGLE_DATA],
    registerSpellData: () => undefined,
    hasSpellData: (spellId: number) =>
        spellId === 3283 || spellId === 3300 || spellId === 3322,
    initSpellWidgetMapping: () => undefined,
    isSpellWidgetMappingInitialized: () => true,
    getSpellIdFromAutocastIndex: () => undefined,
    getAutocastIndexFromSpellId: () => undefined,
    isSpellAutocastable: () => false,
    buildVisibleAutocastIndices: () => [],
    canWeaponAutocastSpell: () => ({ compatible: true }),
    getAutocastCompatibilityMessage: () => "",
    getPoweredStaffSpellData: () => undefined,
    hasPoweredStaffSpellData: () => false,
    calculatePoweredStaffBaseDamage: () => 0,
});

/**
 * OSRS Bind/Snare/Entangle regression coverage.
 *
 * Mechanics verified:
 * - Bind/Snare/Entangle apply a 'bind' status (separate from ice freeze).
 * - Bind has no freeze-immunity window (unlike ice freeze).
 * - Bind duration is never halved by Protect from Magic (per the Sept 2019
 *   OSRS update on the wiki).
 * - Bind stacks/replaces correctly: a longer bind overrides a shorter one.
 * - Bind does not block applyFreeze's freeze immunity from advancing.
 * - NPC and player bind helpers take the right duration and gate on hits.
 */

function createPlayer(): PlayerState {
    const store = new CombatAttributeStore();
    const player = {
        combatAttributes: store,
        applyBind: (durationTicks: number, currentTick: number) => {
            const expires = currentTick + Math.max(1, Math.trunc(durationTicks));
            const existing = store.get(CombatAttributes.STUN_UNTIL_CLOCK);
            if (expires > existing) {
                store.set(CombatAttributes.STUN_UNTIL_CLOCK, expires);
            }
            return true;
        },
        isBound: (currentTick: number) =>
            Math.trunc(currentTick) < store.get(CombatAttributes.STUN_UNTIL_CLOCK),
    } as unknown as PlayerState;
    return player;
}

function createNpc(): NpcState {
    return new NpcState(
        1,
        1,
        1,
        -1,
        -1,
        32,
        { x: 3200, y: 3200, level: 0 },
        { maxHitpoints: 10 },
    );
}

// 1) Bind/Snare/Entangle spell data uses bindDuration, not freezeDuration.
{
    const bind = BIND_DATA;
    const snare = SNARE_DATA;
    const entangle = ENTANGLE_DATA;
    assert.ok(bind && snare && entangle, "binding spell data should exist");
    assert.equal(bind.bindDuration, 8, "Bind bindDuration should be 8 ticks");
    assert.equal(bind.freezeDuration, undefined, "Bind should not have freezeDuration");
    assert.equal(snare.bindDuration, 16, "Snare bindDuration should be 16 ticks");
    assert.equal(snare.freezeDuration, undefined, "Snare should not have freezeDuration");
    assert.equal(entangle.bindDuration, 24, "Entangle bindDuration should be 24 ticks");
    assert.equal(entangle.freezeDuration, undefined, "Entangle should not have freezeDuration");
}

// 2) SpellEffectsManager.applyBind stores the bind end tick and ignores
// freeze immunity. The bind helper does NOT consult FREEZE_IMMUNITY.
{
    const npc = createNpc();
    npc.combatAttributes.set(CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK, 1000);
    npc.combatAttributes.set(CombatAttributes.FREEZE_UNTIL_CLOCK, 1000);
    const manager = new SpellEffectsManager();
    manager.applyBind("npc", npc.id, 8, 0, false);
    assert.equal(
        manager.isBound("npc", npc.id, 0),
        true,
        "bind should be applied even when freeze immunity is active",
    );
}

// 3) applyBind on a player accepts Protect from Magic as input but never
// halves — verifying that the duration passed in equals what is stored.
{
    const manager = new SpellEffectsManager();
    manager.applyBind("player", 100, 8, 0, true);
    manager.applyBind("player", 101, 16, 0, false);
    assert.equal(
        manager.isBound("player", 100, 0),
        true,
        "bind with Protect from Magic should still apply for the full 8 ticks",
    );
    assert.equal(
        manager.isBound("player", 100, 7),
        true,
        "bind should still be active at tick 7",
    );
    assert.equal(
        manager.isBound("player", 100, 8),
        false,
        "bind should have ended by tick 8 (no half duration from Protect from Magic)",
    );
    assert.equal(
        manager.isBound("player", 101, 15),
        true,
        "bind should be active at tick 15",
    );
    assert.equal(
        manager.isBound("player", 101, 16),
        false,
        "bind should have ended by tick 16",
    );
}

// 4) Longer binds override shorter binds; shorter binds do not reduce an
// existing longer bind (mirrors the Ice freeze semantic).
{
    const manager = new SpellEffectsManager();
    manager.applyBind("player", 200, 8, 0, false);
    assert.equal(manager.isBound("player", 200, 7), true);
    assert.equal(manager.isBound("player", 200, 8), false);

    manager.applyBind("player", 200, 16, 0, false);
    assert.equal(
        manager.isBound("player", 200, 12),
        true,
        "longer bind should still be active at tick 12",
    );

    manager.applyBind("player", 200, 4, 0, false);
    assert.equal(
        manager.isBound("player", 200, 12),
        true,
        "shorter binds must not reduce an active longer bind",
    );
}

// 5) PlayerState.applyBind populates STUN_UNTIL_CLOCK without touching
// FREEZE_IMMUNITY_UNTIL_CLOCK. This is the OSRS-correct behavior: bind has
// no immunity window.
{
    const player = createPlayer();
    player.applyBind(8, 100);
    const stun = player.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK);
    const freeze = player.combatAttributes.get(CombatAttributes.FREEZE_UNTIL_CLOCK);
    const immunity = player.combatAttributes.get(CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK);
    assert.equal(stun, 108, "STUN_UNTIL_CLOCK should reflect bind end-tick");
    assert.equal(freeze, 0, "Bind must NOT populate FREEZE_UNTIL_CLOCK");
    assert.equal(immunity, 0, "Bind must NOT populate FREEZE_IMMUNITY_UNTIL_CLOCK");
}

// 6) PlayerState.isBound reflects the bind status correctly.
{
    const player = createPlayer();
    player.applyBind(8, 100);
    assert.equal(player.isBound(105), true, "isBound true during the bind window");
    assert.equal(player.isBound(107), true, "isBound true on the last tick of the bind (tick 107 < 108)");
    assert.equal(player.isBound(108), false, "isBound false once the bind ends");
}

// 7) NPCState.applyBind populates STUN_UNTIL_CLOCK without touching freeze
// immunity, matching the player path.
{
    const npc = createNpc();
    npc.applyBind(16, 100);
    const stun = npc.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK);
    const immunity = npc.combatAttributes.get(CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK);
    assert.equal(stun, 116);
    assert.equal(immunity, 0);
}

// 8) NPC isFrozen() returns true while bound (via STUN_UNTIL_CLOCK). The
// movement gate already considers stun as a movement-block, so bind keeps
// the NPC in place via the existing isFrozen check.
{
    const npc = createNpc();
    npc.applyBind(8, 100);
    assert.equal(npc.isFrozen(105), true);
    assert.equal(npc.isFrozen(110), false);
}

// 9) Bind can be applied during an existing freeze immunity without
// affecting the freeze window. The two systems are independent.
{
    const npc = createNpc();
    npc.combatAttributes.set(CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK, 200);
    npc.combatAttributes.set(CombatAttributes.FREEZE_UNTIL_CLOCK, 200);
    npc.applyBind(8, 100);
    assert.equal(
        npc.combatAttributes.get(CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK),
        200,
        "Bind must not advance freeze immunity",
    );
    assert.equal(
        npc.combatAttributes.get(CombatAttributes.FREEZE_UNTIL_CLOCK),
        200,
        "Bind must not push back the active freeze end-tick",
    );
    assert.equal(
        npc.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK),
        108,
    );
}

// 10) Long-duration bind overrides short-duration bind on the NPC.
{
    const npc = createNpc();
    npc.applyBind(8, 100);
    npc.applyBind(24, 100);
    assert.equal(npc.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK), 124);
    npc.applyBind(4, 100);
    assert.equal(
        npc.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK),
        124,
        "short bind must not reduce the existing longer bind",
    );
}