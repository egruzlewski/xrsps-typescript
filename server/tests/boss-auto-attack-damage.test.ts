/**
 * Scripted boss auto-attacks apply CombatEffectApplicator hitsplats so player HP drops.
 *
 * Run with: npx tsx tests/boss-auto-attack-damage.test.ts
 */
import assert from "node:assert/strict";

import {
    createBossScript,
    type BossHitsplat,
} from "../gamemodes/vanilla/combat/BossCombatScript";
import { HITMARK_DAMAGE } from "../src/game/combat/HitEffects";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";

const DAGANNOTH_REX_ID = 2265;
const GENERAL_GRAARDOR_ID = 2215;
const REX_MELEE_ANIM = 2853;

const TEST_GAMEMODE = {
    id: "boss-auto-attack-damage-test",
    name: "Boss auto-attack damage test",
    initializePlayer: () => undefined,
    canInteract: () => true,
} as GamemodeDefinition;

registerSkillConfiguration({
    computeCombatLevel: () => 3,
    skillRestoreIntervalTicks: 100,
    skillBoostDecayIntervalTicks: 100,
    hitpointRegenIntervalTicks: 100,
    hitpointOverhealDecayIntervalTicks: 100,
    preserveDecayMultiplier: 1.5,
});

function createBossNpc(id: number, typeId: number): NpcState {
    return new NpcState(id, typeId, 3, -1, -1, 32, { x: 3200, y: 3200, level: 0 }, {
        maxHitpoints: 200,
        name: "Boss",
    });
}

function createPlayer(id: number): PlayerState {
    return new PlayerState(id, 3201, 3200, 0, TEST_GAMEMODE);
}

const rex = createBossNpc(1, DAGANNOTH_REX_ID);
const rexScript = createBossScript(rex);
assert.ok(rexScript, "Dagannoth Rex NPC 2265 must have a registered boss script");

const player = createPlayer(10);
const hpBefore = player.skillSystem.getHitpointsCurrent();
assert.ok(hpBefore > 0);

const hitsplats: BossHitsplat[] = [];
rexScript.setEnqueueHitsplat((hit) => {
    hitsplats.push(hit);
});
rexScript.onAttacked(player, 5);
assert.equal(rexScript.getCombatTarget(), player);

rexScript.tick(4);

const hpAfter = player.skillSystem.getHitpointsCurrent();
assert.ok(hpAfter < hpBefore, "Rex melee auto-attack should reduce player HP");
assert.equal(hitsplats.length, 1);
assert.equal(hitsplats[0].targetType, "player");
assert.equal(hitsplats[0].targetId, player.id);
assert.equal(hitsplats[0].damage, hpBefore - hpAfter);
assert.equal(hitsplats[0].style, HITMARK_DAMAGE);
assert.equal(hitsplats[0].hpCurrent, hpAfter);
assert.ok(rex.hasPendingSeq(), "auto-attack animation should be queued");
assert.equal(rex.popPendingSeq()?.seqId, REX_MELEE_ANIM);

const graardor = createBossNpc(2, GENERAL_GRAARDOR_ID);
const graardorScript = createBossScript(graardor);
assert.ok(graardorScript, "General Graardor NPC 2215 must have a registered boss script");
const graardorPlayer = createPlayer(11);
const graardorHpBefore = graardorPlayer.skillSystem.getHitpointsCurrent();
graardorScript.onAttacked(graardorPlayer, 1);
graardorScript.tick(6);
assert.ok(
    graardorPlayer.skillSystem.getHitpointsCurrent() < graardorHpBefore,
    "Graardor auto-attack (including aoeRadius ranged) should still hit the combat target",
);

const lethalRex = createBossNpc(3, DAGANNOTH_REX_ID);
const lethalScript = createBossScript(lethalRex);
assert.ok(lethalScript);
const lethalPlayer = createPlayer(12);
lethalPlayer.skillSystem.setHitpointsCurrent(1);
let died = false;
lethalPlayer.status.onDeath = () => {
    died = true;
};
lethalScript.onAttacked(lethalPlayer, 1);
lethalScript.tick(4);
assert.equal(lethalPlayer.skillSystem.getHitpointsCurrent(), 0);
assert.equal(died, true, "lethal auto-attack should fire the player death callback");
assert.equal(lethalScript.getCombatTarget(), null, "boss drops a dead combat target");

console.log("boss-auto-attack-damage.test.ts: all assertions passed");
