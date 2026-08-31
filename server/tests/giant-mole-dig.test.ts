/**
 * Giant Mole dig_escape teleports the NPC inside the Falador lair.
 * The attacker is not moved (OSRS: hunt the mole after it digs).
 *
 * Run with: npx tsx tests/giant-mole-dig.test.ts
 */
import assert from "node:assert/strict";

import {
    GIANT_MOLE_DIG_ANIM,
    GIANT_MOLE_DIG_SPOTS,
    GIANT_MOLE_NPC_ID,
    createBossScript,
    executeGiantMoleDig,
    isInGiantMoleLair,
    pickGiantMoleDigDestination,
} from "../gamemodes/vanilla/combat/BossCombatScript";
import { NpcState } from "../src/game/npc";

function createMole(id: number, x: number, y: number, maxHitpoints = 200): NpcState {
    return new NpcState(id, GIANT_MOLE_NPC_ID, 3, -1, -1, 32, { x, y, level: 0 }, {
        maxHitpoints,
        name: "Giant Mole",
    });
}

const start = GIANT_MOLE_DIG_SPOTS[0];
assert.ok(isInGiantMoleLair(start.x, start.y, start.level));

const dest = pickGiantMoleDigDestination(start.x, start.y, () => 0);
assert.ok(isInGiantMoleLair(dest.x, dest.y, dest.level));
assert.notEqual(`${dest.x},${dest.y}`, `${start.x},${start.y}`);
assert.ok(
    GIANT_MOLE_DIG_SPOTS.some((spot) => spot.x === dest.x && spot.y === dest.y),
    "dig destination should be a known lair chamber",
);

const npc = createMole(1, start.x, start.y);
const script = createBossScript(npc);
assert.ok(script, "Giant Mole NPC 5779 must have a registered boss script");
assert.deepEqual(script.getCurrentPhase()?.mechanics, ["dig_escape"]);

const attacker = new NpcState(2, 1, 1, -1, -1, 32, {
    x: start.x + 1,
    y: start.y,
    level: 0,
});
script.onAttacked(attacker, 5);
assert.equal(script.getCombatTarget(), attacker);

npc.applyDamage(110);
assert.ok(npc.getHitpoints() / npc.getMaxHitpoints() < 0.5);

const afterDig = executeGiantMoleDig(script, () => 0);
assert.equal(npc.tileX, afterDig.x);
assert.equal(npc.tileY, afterDig.y);
assert.equal(npc.level, afterDig.level);
assert.ok(npc.wasTeleported());
assert.ok(npc.hasPendingSeq(), "dig animation should be queued");
assert.equal(npc.popPendingSeq()?.seqId, GIANT_MOLE_DIG_ANIM);
assert.equal(script.getCombatTarget(), null, "mole drops aggro after digging");
assert.equal(attacker.tileX, start.x + 1, "attacker is not teleported with the mole");
assert.equal(attacker.tileY, start.y);

const second = executeGiantMoleDig(script, () => 0.99);
assert.notEqual(`${second.x},${second.y}`, `${afterDig.x},${afterDig.y}`);
assert.ok(isInGiantMoleLair(second.x, second.y, second.level));

console.log("giant-mole-dig.test.ts: all assertions passed");
