/**
 * Builds server/data/npc-drops.json from references/monsters-complete.json
 * (osrsbox-db snapshot). Runtime never reads the dump.
 */
import fs from "fs";
import path from "path";

import { getItemDefinition } from "../src/data/items";
import type { NpcDropEntryDefinition, NpcDropTableDefinition } from "../src/game/drops/types";

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = path.resolve(ROOT, "references/monsters-complete.json");
const OUT = path.resolve(__dirname, "../data/npc-drops.json");

const EXCLUDED_NAME_PREFIXES = [
    "clue scroll",
    "reward casket",
    "jar of ",
    "pet ",
    "brimstone key",
    "key (elite)",
];

type RawMonsterDrop = {
    id?: number;
    name?: string;
    quantity?: string;
    rarity?: number;
    rolls?: number;
};

type RawMonsterEntry = {
    id?: number;
    drops?: RawMonsterDrop[];
};

function shouldSkipDrop(drop: RawMonsterDrop): boolean {
    const name = (drop.name ?? "")
        .replace(/<!--.*?-->/g, "")
        .trim()
        .toLowerCase();
    if (!name) return true;
    if (EXCLUDED_NAME_PREFIXES.some((prefix) => name.startsWith(prefix))) return true;
    const itemId = drop.id ?? -1;
    return !getItemDefinition(itemId);
}

function toEntry(drop: RawMonsterDrop): NpcDropEntryDefinition | undefined {
    if (shouldSkipDrop(drop)) return undefined;
    return {
        itemId: drop.id ?? -1,
        quantity: drop.quantity ?? "1",
        rarity: (drop.rarity ?? 0) * Math.max(1, drop.rolls ?? 1),
    };
}

function toTable(raw: RawMonsterEntry): NpcDropTableDefinition | undefined {
    const entries = (raw.drops ?? [])
        .map((drop) => toEntry(drop))
        .filter((drop): drop is NpcDropEntryDefinition => drop !== undefined);
    if (entries.length === 0) return undefined;
    const hasNumericRarity = (
        entry: NpcDropEntryDefinition,
    ): entry is NpcDropEntryDefinition & { rarity: number } => typeof entry.rarity === "number";
    const always = entries.filter((entry) => hasNumericRarity(entry) && entry.rarity >= 1);
    const main = entries.filter(
        (entry) => hasNumericRarity(entry) && entry.rarity > 0 && entry.rarity < 1,
    );
    return {
        always,
        pools: main.length
            ? [
                  {
                      kind: "weighted",
                      category: "main",
                      entries: main,
                  },
              ]
            : undefined,
    };
}

function main(): void {
    if (!fs.existsSync(SOURCE)) {
        console.error(`Missing ${SOURCE}`);
        console.error(
            "Download from https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/monsters-complete.json",
        );
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(SOURCE, "utf8")) as Record<string, RawMonsterEntry>;
    const npcs: Record<string, NpcDropTableDefinition> = {};
    let tables = 0;

    for (const [key, monster] of Object.entries(data)) {
        const npcTypeId = monster?.id ?? parseInt(key, 10);
        if (!Number.isFinite(npcTypeId) || npcTypeId <= 0) continue;
        const table = toTable(monster);
        if (!table) continue;
        npcs[String(npcTypeId)] = table;
        tables++;
    }

    const payload = {
        $comment:
            "NPC drop tables keyed by type ID. Frozen osrsbox-db snapshot; not live wiki data. Manual overlays live in server/src/game/drops/manualTables.ts.",
        npcs,
    };
    fs.writeFileSync(OUT, JSON.stringify(payload));
    console.log(`Wrote ${OUT}`);
    console.log(`NPC drop tables: ${tables}`);
}

main();
