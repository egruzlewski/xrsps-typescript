import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    ItemOnItemHandler,
    ItemOnLocEvent,
    ItemOnLocHandler,
    LocInteractionEvent,
    LocInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import {
    DARK_ALTAR_LOC_ID,
    DARK_ESSENCE_BLOCK,
    DARK_ESSENCE_FRAGMENTS,
    DENSE_ESSENCE_BLOCK,
} from "../gamemodes/vanilla/skills/runecrafting/altars";
import {
    DARK_ALTAR_XP_PER_BLOCK,
    DARK_ESSENCE_CHISEL,
    DARK_ESSENCE_CHISEL_XP,
    DARK_ESSENCE_FRAGMENT_CAP,
    DARK_ESSENCE_FRAGMENTS_PER_BLOCK,
} from "../gamemodes/vanilla/skills/runecrafting/darkEssence";
import { register } from "../gamemodes/vanilla/skills/runecrafting";

const locHandlers = new Map<string, LocInteractionHandler>();
const itemOnLocHandlers = new Map<string, ItemOnLocHandler>();
const itemOnItemHandlers = new Map<string, ItemOnItemHandler>();

const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerItemOnLoc: (itemId: number, locId: number, handler: ItemOnLocHandler) => {
        itemOnLocHandlers.set(`${itemId}:${locId}`, handler);
        return { unregister() {} };
    },
    registerNpcInteraction: () => ({ unregister() {} }),
    registerItemAction: () => ({ unregister() {} }),
    registerItemOnItem: (
        sourceItemId: number,
        targetItemId: number,
        handler: ItemOnItemHandler,
    ) => {
        itemOnItemHandlers.set(`${sourceItemId}:${targetItemId}`, handler);
        return { unregister() {} };
    },
} as unknown as IScriptRegistry;

register(registry);

assert.equal(DARK_ALTAR_LOC_ID, 27979);
assert.equal(DENSE_ESSENCE_BLOCK, 13445);
assert.equal(DARK_ESSENCE_BLOCK, 13446);
assert.equal(DARK_ESSENCE_FRAGMENTS, 7938);
assert(locHandlers.has(`${DARK_ALTAR_LOC_ID}:venerate`));
assert(itemOnLocHandlers.has(`${DENSE_ESSENCE_BLOCK}:${DARK_ALTAR_LOC_ID}`));
assert(itemOnItemHandlers.has(`${DARK_ESSENCE_CHISEL}:${DARK_ESSENCE_BLOCK}`));

type Counts = Map<number, number>;

function makePlayer(opts: {
    crafting?: number;
    runecraft?: number;
    items?: Record<number, number>;
    prayer?: { baseLevel: number; boost: number };
}) {
    const counts: Counts = new Map(
        Object.entries(opts.items ?? {}).map(([id, qty]) => [Number(id), qty]),
    );
    const messages: string[] = [];
    const xp: Array<{ skillId: number; amount: number }> = [];
    const snapshots: number[] = [];
    const prayer = opts.prayer ?? { baseLevel: 40, boost: 0 };
    const player = {
        id: 9,
        items: {
            getItemCount: (itemId: number) => counts.get(itemId) ?? 0,
            removeItem: (itemId: number, amount: number) => {
                counts.set(itemId, Math.max(0, (counts.get(itemId) ?? 0) - amount));
            },
            addItem: (itemId: number, amount: number) => {
                counts.set(itemId, (counts.get(itemId) ?? 0) + amount);
            },
        },
        skillSystem: {
            getSkill: (skillId: number) =>
                skillId === SkillId.Prayer ? prayer : { baseLevel: 1, boost: 0 },
            adjustSkillBoost: (skillId: number, delta: number) => {
                if (skillId === SkillId.Prayer) prayer.boost += delta;
            },
        },
    } as unknown as PlayerState;

    const services = {
        messaging: {
            sendGameMessage: (_p: PlayerState, text: string) => messages.push(text),
        },
        skills: {
            getSkill: (_p: PlayerState, skillId: number) => {
                if (skillId === SkillId.Crafting) {
                    return { baseLevel: opts.crafting ?? 1, boost: 0 };
                }
                return { baseLevel: opts.runecraft ?? 1, boost: 0 };
            },
            addSkillXp: (_p: PlayerState, skillId: number, amount: number) => {
                xp.push({ skillId, amount });
            },
        },
        inventory: {
            snapshotInventory: () => {
                snapshots.push(1);
            },
        },
    } as unknown as ScriptServices;

    return { player, services, messages, xp, snapshots, counts, prayer };
}

function venerate(session: ReturnType<typeof makePlayer>) {
    locHandlers.get(`${DARK_ALTAR_LOC_ID}:venerate`)!({
        player: session.player,
        locId: DARK_ALTAR_LOC_ID,
        tile: { x: 1716, y: 3883 },
        level: 0,
        tick: 1,
        services: session.services,
    } as LocInteractionEvent);
}

function chisel(session: ReturnType<typeof makePlayer>) {
    itemOnItemHandlers.get(`${DARK_ESSENCE_CHISEL}:${DARK_ESSENCE_BLOCK}`)!({
        player: session.player,
        source: { slot: 0, itemId: DARK_ESSENCE_CHISEL },
        target: { slot: 1, itemId: DARK_ESSENCE_BLOCK },
        tick: 1,
        services: session.services,
    } as ItemOnItemEvent);
}

const emptyAltar = makePlayer({ items: {} });
venerate(emptyAltar);
assert(emptyAltar.messages[0]?.includes("no dense essence"));
assert.equal(emptyAltar.xp.length, 0);

const convert = makePlayer({
    items: { [DENSE_ESSENCE_BLOCK]: 26 },
    prayer: { baseLevel: 40, boost: 0 },
});
venerate(convert);
assert.equal(convert.counts.get(DENSE_ESSENCE_BLOCK) ?? 0, 0);
assert.equal(convert.counts.get(DARK_ESSENCE_BLOCK), 26);
assert.deepEqual(convert.xp, [{ skillId: SkillId.Runecraft, amount: 26 * DARK_ALTAR_XP_PER_BLOCK }]);
assert.equal(convert.snapshots.length, 1);
assert.equal(convert.prayer.boost, -26);

const zeroPrayer = makePlayer({
    items: { [DENSE_ESSENCE_BLOCK]: 3 },
    prayer: { baseLevel: 1, boost: -1 },
});
venerate(zeroPrayer);
assert.equal(zeroPrayer.counts.get(DARK_ESSENCE_BLOCK), 3);
assert.equal(zeroPrayer.prayer.boost, -1, "conversion still works at 0 prayer");

const useOnAltar = makePlayer({ items: { [DENSE_ESSENCE_BLOCK]: 2 } });
itemOnLocHandlers.get(`${DENSE_ESSENCE_BLOCK}:${DARK_ALTAR_LOC_ID}`)!({
    player: useOnAltar.player,
    source: { slot: 0, itemId: DENSE_ESSENCE_BLOCK },
    target: { locId: DARK_ALTAR_LOC_ID, tile: { x: 1716, y: 3883 }, level: 0 },
    tick: 1,
    services: useOnAltar.services,
} as ItemOnLocEvent);
assert.equal(useOnAltar.counts.get(DARK_ESSENCE_BLOCK), 2);

const lowCraft = makePlayer({
    crafting: 37,
    items: { [DARK_ESSENCE_BLOCK]: 2, [DARK_ESSENCE_CHISEL]: 1 },
});
chisel(lowCraft);
assert.equal(lowCraft.counts.get(DARK_ESSENCE_BLOCK), 2);
assert.equal(lowCraft.xp.length, 0);
assert(lowCraft.messages[0]?.includes("Crafting level of at least 38"));

const chip = makePlayer({
    crafting: 38,
    items: { [DARK_ESSENCE_BLOCK]: 5, [DARK_ESSENCE_CHISEL]: 1 },
});
chisel(chip);
assert.equal(chip.counts.get(DARK_ESSENCE_BLOCK) ?? 0, 0);
assert.equal(chip.counts.get(DARK_ESSENCE_FRAGMENTS), 5 * DARK_ESSENCE_FRAGMENTS_PER_BLOCK);
assert.deepEqual(chip.xp, [{ skillId: SkillId.Crafting, amount: 5 * DARK_ESSENCE_CHISEL_XP }]);

const nearCap = makePlayer({
    crafting: 99,
    items: {
        [DARK_ESSENCE_BLOCK]: 3,
        [DARK_ESSENCE_FRAGMENTS]: DARK_ESSENCE_FRAGMENT_CAP - 4,
        [DARK_ESSENCE_CHISEL]: 1,
    },
});
chisel(nearCap);
assert.equal(nearCap.counts.get(DARK_ESSENCE_BLOCK), 2, "only one block fits under the 108 cap");
assert.equal(nearCap.counts.get(DARK_ESSENCE_FRAGMENTS), DARK_ESSENCE_FRAGMENT_CAP);

const atCap = makePlayer({
    crafting: 99,
    items: {
        [DARK_ESSENCE_BLOCK]: 1,
        [DARK_ESSENCE_FRAGMENTS]: DARK_ESSENCE_FRAGMENT_CAP,
        [DARK_ESSENCE_CHISEL]: 1,
    },
});
chisel(atCap);
assert.equal(atCap.counts.get(DARK_ESSENCE_BLOCK), 1);
assert.equal(atCap.xp.length, 0);
assert(atCap.messages[0]?.includes("can't carry any more"));

console.log("runecrafting-dark-essence.test.ts: all assertions passed");
