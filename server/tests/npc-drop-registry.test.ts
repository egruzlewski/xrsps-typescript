/**
 * NPC drop registry: ID lookup, missing IDs, manual overlays.
 *
 * Run with: npx tsx tests/npc-drop-registry.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { NpcDropRegistry } from "../src/game/drops/NpcDropRegistry";

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "xrsps-drops-"));
const fixturePath = path.join(fixtureDir, "npc-drops.json");
fs.writeFileSync(
    fixturePath,
    JSON.stringify({
        npcs: {
            "900001": {
                always: [{ itemId: 526, quantity: "1", rarity: 1 }],
            },
            "100": {
                always: [{ itemId: 995, quantity: "999", rarity: 1 }],
            },
        },
    }),
);

const registry = new NpcDropRegistry({ filePath: fixturePath });

const imported = registry.get(900001);
assert.ok(imported, "expected drop table for fixture NPC 900001");
assert.equal(imported.always[0]?.itemId, 526);

assert.equal(registry.get(9999999), undefined);

const goblin = registry.get(100);
assert.ok(goblin, "expected manual overlay for goblin NPC 100");
assert.equal(goblin.always[0]?.itemId, 526);
assert.ok(
    !goblin.always.some((entry) => entry.itemId === 995 && entry.quantity.min === 999),
    "fixture table for NPC 100 must not replace the manual goblin overlay",
);

const counts = registry.getLoadedCounts();
assert.equal(counts.imported, 2);
assert.ok(counts.manual > 0);
assert.ok(counts.total >= counts.manual);

fs.rmSync(fixtureDir, { recursive: true, force: true });

console.log("npc-drop-registry tests passed");
