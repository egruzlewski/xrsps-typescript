import fs from "fs";
import path from "path";

import { logger } from "../../utils/logger";
import { resolveDropTable } from "./helpers";
import { MANUAL_NPC_DROP_OVERRIDES } from "./manualTables";
import type { NpcDropTable, NpcDropTableDefinition } from "./types";

export type NpcDropRegistryCounts = {
    imported: number;
    manual: number;
    total: number;
};

export type NpcDropRegistryOptions = {
    filePath?: string;
};

type NpcDropsFile = {
    npcs?: Record<string, NpcDropTableDefinition>;
};

function resolveNpcDropsPath(explicit?: string): string | undefined {
    if (explicit) return explicit;
    const candidates = [
        path.resolve(__dirname, "../../../data/npc-drops.json"),
        path.resolve("data/npc-drops.json"),
        path.resolve("server/data/npc-drops.json"),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
}

function loadImportedTables(filePath: string | undefined): Map<number, NpcDropTable> {
    const imported = new Map<number, NpcDropTable>();
    const resolved = resolveNpcDropsPath(filePath);
    if (!resolved || !fs.existsSync(resolved)) {
        logger.error(`[drops] npc-drops.json not found${resolved ? ` (${resolved})` : ""}`);
        return imported;
    }
    try {
        const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as NpcDropsFile;
        for (const [npcIdStr, def] of Object.entries(raw.npcs ?? {})) {
            const npcTypeId = parseInt(npcIdStr, 10);
            if (!Number.isFinite(npcTypeId) || npcTypeId <= 0) continue;
            const table = resolveDropTable(def);
            if (!table) continue;
            imported.set(npcTypeId, table);
        }
    } catch (error) {
        logger.error("[drops] failed to load npc-drops.json", error);
        imported.clear();
    }
    return imported;
}

export class NpcDropRegistry {
    private readonly byNpcTypeId = new Map<number, NpcDropTable>();
    private readonly counts: NpcDropRegistryCounts;

    constructor(options?: NpcDropRegistryOptions) {
        const imported = loadImportedTables(options?.filePath);
        for (const [npcTypeId, table] of imported) {
            this.byNpcTypeId.set(npcTypeId, table);
        }
        let manual = 0;
        for (const override of MANUAL_NPC_DROP_OVERRIDES) {
            const table = resolveDropTable(override.table);
            if (!table) continue;
            for (const npcTypeId of override.npcTypeIds) {
                this.byNpcTypeId.set(npcTypeId, table);
                manual++;
            }
        }
        this.counts = {
            imported: imported.size,
            manual,
            total: this.byNpcTypeId.size,
        };
    }

    get(npcTypeId: number): NpcDropTable | undefined {
        return this.byNpcTypeId.get(npcTypeId);
    }

    getLoadedCounts(): NpcDropRegistryCounts {
        return this.counts;
    }
}
