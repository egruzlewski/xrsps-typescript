/**
 * Zulrah venom-cloud execute drops a tile gfx on the combat target and applies venom.
 * The attacker is not moved (OSRS: dodge fumes in place).
 *
 * Run with: npx tsx tests/zulrah-venom-cloud.test.ts
 */
import assert from "node:assert/strict";

import {
    ZULRAH_NPC_ID,
    ZULRAH_VENOM_CLOUD_ANIM,
    ZULRAH_VENOM_CLOUD_GFX,
    ZULRAH_VENOM_STAGE,
    createBossScript,
    executeZulrahVenomCloud,
    isInZulrahShrine,
    type BossTileGraphic,
} from "../gamemodes/vanilla/combat/BossCombatScript";
import { registerSkillConfiguration } from "../src/game/combat/SkillConfigurationProvider";
import type { GamemodeDefinition } from "../src/game/gamemodes/GamemodeDefinition";
import { NpcState } from "../src/game/npc";
import { PlayerState } from "../src/game/player";

const TEST_GAMEMODE = {
    id: "zulrah-venom-cloud-test",
    name: "Zulrah venom cloud test",
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

function createZulrah(id: number, x: number, y: number): NpcState {
    return new NpcState(id, ZULRAH_NPC_ID, 4, -1, -1, 32, { x, y, level: 0 }, {
        maxHitpoints: 500,
        name: "Zulrah",
        worldViewId: 7,
        ownerPlayerId: 42,
    });
}

const npc = createZulrah(1, 2268, 3074);
const script = createBossScript(npc);
assert.ok(script, "Zulrah NPC 2042 must have a registered boss script");
assert.equal(script.getCurrentPhase()?.name, "Green");

const attacker = new PlayerState(2, 2268, 3069, 0, TEST_GAMEMODE);
assert.ok(isInZulrahShrine(attacker.tileX, attacker.tileY, attacker.level));
script.onAttacked(attacker, 5);
assert.equal(script.getCombatTarget(), attacker);

const gfx: BossTileGraphic[] = [];
script.setEnqueueSpotAnimation((anim) => {
    gfx.push(anim);
});

assert.equal(attacker.status.venomEffect, undefined);

const cloud = executeZulrahVenomCloud(script, attacker);
assert.equal(cloud.x, attacker.tileX);
assert.equal(cloud.y, attacker.tileY);
assert.equal(cloud.level, attacker.level);
assert.equal(cloud.gfxId, ZULRAH_VENOM_CLOUD_GFX);
assert.equal(cloud.venomApplied, true);
assert.ok(isInZulrahShrine(cloud.x, cloud.y, cloud.level));

assert.equal(gfx.length, 1);
assert.equal(gfx[0].spotId, ZULRAH_VENOM_CLOUD_GFX);
assert.equal(gfx[0].tile?.x, cloud.x);
assert.equal(gfx[0].tile?.y, cloud.y);
assert.equal(gfx[0].tile?.level, cloud.level);

assert.equal(attacker.status.venomEffect?.stage, ZULRAH_VENOM_STAGE);
assert.ok(npc.hasPendingSeq(), "venom cloud animation should be queued");
assert.equal(npc.popPendingSeq()?.seqId, ZULRAH_VENOM_CLOUD_ANIM);
assert.equal(npc.tileX, 2268, "Zulrah is not teleported when spawning fumes");
assert.equal(npc.tileY, 3074);
assert.equal(attacker.tileX, 2268, "attacker is not teleported with the cloud");
assert.equal(attacker.tileY, 3069);
assert.equal(script.getCombatTarget(), attacker, "venom cloud does not drop aggro");

const spawned: unknown[] = [];
script.setSpawnNpc((config) => {
    spawned.push(config);
    return new NpcState(100, config.id, 1, -1, -1, 32, {
        x: config.x,
        y: config.y,
        level: config.level,
    });
});
executeZulrahVenomCloud(script, attacker);
assert.equal(spawned.length, 0, "venom cloud does not spawn snakelings");

console.log("zulrah-venom-cloud.test.ts: all assertions passed");
