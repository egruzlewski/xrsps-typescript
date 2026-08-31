/**
 * Zulrah snakeling execute spawns melee (2045) and mage (2046) NPCs on shrine tiles.
 * The attacker is not moved (OSRS: fight the adds in place).
 *
 * Run with: npx tsx tests/zulrah-snakeling.test.ts
 */
import assert from "node:assert/strict";

import {
    ZULRAH_NPC_ID,
    ZULRAH_SNAKELING_ANIM,
    ZULRAH_SNAKELING_MAGE_ID,
    ZULRAH_SNAKELING_MELEE_ID,
    ZULRAH_SNAKELING_SPAWN_SPOTS,
    createBossScript,
    executeZulrahSnakeling,
    isInZulrahShrine,
    pickZulrahSnakelingDestinations,
} from "../gamemodes/vanilla/combat/BossCombatScript";
import type { NpcSpawnConfig } from "../src/game/npc";
import { NpcState } from "../src/game/npc";

function createZulrah(id: number, x: number, y: number): NpcState {
    return new NpcState(id, ZULRAH_NPC_ID, 4, -1, -1, 32, { x, y, level: 0 }, {
        maxHitpoints: 500,
        name: "Zulrah",
        worldViewId: 7,
        ownerPlayerId: 42,
    });
}

const shrineSpot = ZULRAH_SNAKELING_SPAWN_SPOTS[0];
assert.ok(isInZulrahShrine(shrineSpot.x, shrineSpot.y, shrineSpot.level));

const [first, second] = pickZulrahSnakelingDestinations(shrineSpot.x, shrineSpot.y, () => 0);
assert.ok(isInZulrahShrine(first.x, first.y, first.level));
assert.ok(isInZulrahShrine(second.x, second.y, second.level));
assert.notEqual(`${first.x},${first.y}`, `${shrineSpot.x},${shrineSpot.y}`);
assert.notEqual(`${first.x},${first.y}`, `${second.x},${second.y}`);
assert.ok(
    ZULRAH_SNAKELING_SPAWN_SPOTS.some((spot) => spot.x === first.x && spot.y === first.y),
    "snakeling destination should be a known shrine tile",
);

const npc = createZulrah(1, 2268, 3074);
const script = createBossScript(npc);
assert.ok(script, "Zulrah NPC 2042 must have a registered boss script");
assert.equal(script.getCurrentPhase()?.name, "Green");

const attacker = new NpcState(2, 1, 1, -1, -1, 32, {
    x: 2268,
    y: 3069,
    level: 0,
});
script.onAttacked(attacker, 5);
assert.equal(script.getCombatTarget(), attacker);

const spawned: NpcSpawnConfig[] = [];
script.setSpawnNpc((config) => {
    spawned.push(config);
    return new NpcState(100 + spawned.length, config.id, 1, -1, -1, 32, {
        x: config.x,
        y: config.y,
        level: config.level,
    }, {
        name: config.name,
        worldViewId: config.worldViewId,
        ownerPlayerId: config.ownerPlayerId,
    });
});

const plans = executeZulrahSnakeling(script, attacker, () => 0);
assert.equal(plans.length, 2);
assert.equal(plans[0].typeId, ZULRAH_SNAKELING_MELEE_ID);
assert.equal(plans[1].typeId, ZULRAH_SNAKELING_MAGE_ID);
assert.notEqual(`${plans[0].x},${plans[0].y}`, `${plans[1].x},${plans[1].y}`);
for (const plan of plans) {
    assert.ok(isInZulrahShrine(plan.x, plan.y, plan.level));
}

assert.equal(spawned.length, 2);
assert.equal(spawned[0].id, ZULRAH_SNAKELING_MELEE_ID);
assert.equal(spawned[1].id, ZULRAH_SNAKELING_MAGE_ID);
assert.equal(spawned[0].worldViewId, 7);
assert.equal(spawned[0].ownerPlayerId, 42);
assert.equal(spawned[1].worldViewId, 7);
assert.equal(spawned[1].ownerPlayerId, 42);
assert.equal(spawned[0].x, plans[0].x);
assert.equal(spawned[1].x, plans[1].x);

assert.ok(npc.hasPendingSeq(), "snakeling summon animation should be queued");
assert.equal(npc.popPendingSeq()?.seqId, ZULRAH_SNAKELING_ANIM);
assert.equal(npc.tileX, 2268, "Zulrah is not teleported when summoning");
assert.equal(npc.tileY, 3074);
assert.equal(attacker.tileX, 2268, "attacker is not teleported with snakelings");
assert.equal(attacker.tileY, 3069);
assert.equal(script.getCombatTarget(), attacker, "snakeling spawn does not drop aggro");

console.log("zulrah-snakeling.test.ts: all assertions passed");
