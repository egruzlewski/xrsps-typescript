/**
 * Zulrah phase onEnter changes NPC type id (range 2042 / mage 2043 / melee 2044)
 * and snaps so NPC sync re-adds the entity with the new visual type.
 *
 * Run with: npx tsx tests/zulrah-phase-transform.test.ts
 */
import assert from "node:assert/strict";

import {
    ZULRAH_MAGE_ID,
    ZULRAH_MELEE_ID,
    ZULRAH_NPC_ID,
    ZULRAH_RANGE_ID,
    createBossScript,
} from "../gamemodes/vanilla/combat/BossCombatScript";
import { NpcState } from "../src/game/npc";

function createZulrah(id: number, x: number, y: number, maxHitpoints = 500): NpcState {
    return new NpcState(id, ZULRAH_NPC_ID, 4, -1, -1, 32, { x, y, level: 0 }, {
        maxHitpoints,
        name: "Zulrah",
        worldViewId: 7,
        ownerPlayerId: 42,
    });
}

const npc = createZulrah(1, 2268, 3074);
assert.equal(npc.typeId, ZULRAH_RANGE_ID);
assert.equal(npc.spawnTypeId, ZULRAH_RANGE_ID);

npc.setTransformation(ZULRAH_RANGE_ID);
assert.equal(npc.wasTeleported(), false, "same-form transmog does not snap");

npc.setTransformation(ZULRAH_MAGE_ID);
assert.equal(npc.typeId, ZULRAH_MAGE_ID);
assert.ok(npc.wasTeleported(), "form change sets the NPC sync snap flag");
npc.clearTeleportFlag();

npc.resetToSpawn();
assert.equal(npc.typeId, ZULRAH_RANGE_ID, "respawn restores the spawn form");
assert.equal(npc.tileX, npc.spawnX);
npc.clearTeleportFlag();

const script = createBossScript(npc);
assert.ok(script, "Zulrah NPC 2042 must have a registered boss script");
assert.equal(script.getCurrentPhase()?.name, "Green");
assert.equal(npc.typeId, ZULRAH_RANGE_ID);

script.tick(1);
assert.equal(script.getCurrentPhase()?.name, "Green");
assert.equal(npc.typeId, ZULRAH_RANGE_ID);
assert.equal(npc.wasTeleported(), false, "idle tick does not transmog");

npc.applyDamage(125);
assert.equal(npc.getHitpoints(), 375);
script.tick(2);
assert.equal(script.getCurrentPhase()?.name, "Blue");
assert.equal(npc.typeId, ZULRAH_MAGE_ID);
assert.ok(npc.wasTeleported(), "Blue onEnter snaps the mage visual");
assert.equal(npc.tileX, 2268, "form change does not move Zulrah");
assert.equal(npc.tileY, 3074);
npc.clearTeleportFlag();

npc.applyDamage(125);
assert.equal(npc.getHitpoints(), 250);
script.tick(3);
assert.equal(script.getCurrentPhase()?.name, "Red");
assert.equal(npc.typeId, ZULRAH_MELEE_ID);
assert.ok(npc.wasTeleported(), "Red onEnter snaps the melee visual");
npc.clearTeleportFlag();

npc.applyDamage(125);
assert.equal(npc.getHitpoints(), 125);
script.tick(4);
assert.equal(script.getCurrentPhase()?.name, "Green Final");
assert.equal(npc.typeId, ZULRAH_RANGE_ID);
assert.ok(npc.wasTeleported(), "Green Final onEnter snaps back to ranged");

const mageNpc = createZulrah(2, 2268, 3074);
mageNpc.setTransformation(ZULRAH_MAGE_ID);
mageNpc.clearTeleportFlag();
const mageScript = createBossScript(mageNpc);
assert.ok(mageScript, "boss script still resolves after transmog to 2043");
assert.equal(mageNpc.typeId, ZULRAH_MAGE_ID);

console.log("zulrah-phase-transform.test.ts: all assertions passed");
