import assert from "node:assert/strict";

import { SkillId } from "../../client/rs/skill/skills";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnLocEvent,
    ItemOnLocHandler,
    LocInteractionEvent,
    LocInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import {
    DARK_ESSENCE_FRAGMENTS,
    MEMBERS_ALTARS,
    PURE_ESSENCE,
    RUNE_ESSENCE,
    WALKUP_ALTARS,
} from "../gamemodes/vanilla/skills/runecrafting/altars";
import { register } from "../gamemodes/vanilla/skills/runecrafting";

const locHandlers = new Map<string, LocInteractionHandler>();
const itemOnLocHandlers = new Map<string, ItemOnLocHandler>();
const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerItemOnLoc: (itemId: number, locId: number, handler: ItemOnLocHandler) => {
        itemOnLocHandlers.set(`${itemId}:${locId}`, handler);
        return { unregister() {} };
    },
} as unknown as IScriptRegistry;

register(registry);

const kourendBlood = WALKUP_ALTARS.find((altar) => altar.id === "kourend-blood");
const soul = WALKUP_ALTARS.find((altar) => altar.id === "soul");
assert.ok(kourendBlood);
assert.ok(soul);
assert.equal(kourendBlood.altarLocId, 27978);
assert.equal(kourendBlood.runeId, 565);
assert.equal(kourendBlood.level, 77);
assert.equal(kourendBlood.xpPerEssence, 23.8);
assert.equal(kourendBlood.essenceItemId, DARK_ESSENCE_FRAGMENTS);
assert.equal(soul.altarLocId, 27980);
assert.equal(soul.runeId, 566);
assert.equal(soul.level, 90);
assert.equal(soul.xpPerEssence, 29.7);
assert.equal(soul.essenceItemId, DARK_ESSENCE_FRAGMENTS);

const trueBlood = MEMBERS_ALTARS.find((altar) => altar.id === "blood");
assert.ok(trueBlood);
assert.equal(trueBlood.altarLocId, 43479);
assert.notEqual(trueBlood.altarLocId, kourendBlood.altarLocId);

for (const altar of [kourendBlood, soul]) {
    assert(locHandlers.has(`${altar.altarLocId}:craft-rune`));
    assert(itemOnLocHandlers.has(`${DARK_ESSENCE_FRAGMENTS}:${altar.altarLocId}`));
    assert.equal(itemOnLocHandlers.has(`${PURE_ESSENCE}:${altar.altarLocId}`), false);
    assert.equal(itemOnLocHandlers.has(`${RUNE_ESSENCE}:${altar.altarLocId}`), false);
    assert.equal(locHandlers.has(`${altar.altarLocId}:enter`), false);
    assert.equal(locHandlers.has(`${altar.altarLocId}:use`), false);
}

type Counts = Map<number, number>;

function makePlayer(opts: { level: number; items?: Record<number, number> }) {
    const counts: Counts = new Map(
        Object.entries(opts.items ?? {}).map(([id, qty]) => [Number(id), qty]),
    );
    const messages: string[] = [];
    const xp: number[] = [];
    const teleports: Array<{ x: number; y: number; level: number }> = [];
    const snapshots: number[] = [];
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
    } as unknown as PlayerState;

    const services = {
        messaging: {
            sendGameMessage: (_p: PlayerState, text: string) => messages.push(text),
        },
        skills: {
            getSkill: () => ({ baseLevel: opts.level, boost: 0 }),
            addSkillXp: (_p: PlayerState, skillId: number, amount: number) => {
                assert.equal(skillId, SkillId.Runecraft);
                xp.push(amount);
            },
        },
        equipment: {
            getEquipArray: () => new Array<number>(12).fill(0),
        },
        movement: {
            teleportPlayer: (
                _p: PlayerState,
                x: number,
                y: number,
                level: number,
            ) => {
                teleports.push({ x, y, level });
            },
        },
        inventory: {
            snapshotInventory: () => {
                snapshots.push(1);
            },
        },
    } as unknown as ScriptServices;

    return { player, services, messages, xp, teleports, snapshots, counts };
}

function craft(
    altar: NonNullable<typeof kourendBlood>,
    player: ReturnType<typeof makePlayer>,
) {
    locHandlers.get(`${altar.altarLocId}:craft-rune`)!({
        player: player.player,
        locId: altar.altarLocId,
        tile: { x: 1718, y: 3883 },
        level: 0,
        tick: 1,
        services: player.services,
    } as LocInteractionEvent);
}

const runeEssRejected = makePlayer({ level: 77, items: { [RUNE_ESSENCE]: 10 } });
craft(kourendBlood, runeEssRejected);
assert.equal(runeEssRejected.counts.get(RUNE_ESSENCE), 10);
assert.equal(runeEssRejected.xp.length, 0);
assert.equal(runeEssRejected.teleports.length, 0);
assert(runeEssRejected.messages[0]?.includes("dark essence fragments"));

const pureEssRejected = makePlayer({ level: 90, items: { [PURE_ESSENCE]: 8 } });
craft(soul, pureEssRejected);
assert.equal(pureEssRejected.counts.get(PURE_ESSENCE), 8);
assert.equal(pureEssRejected.xp.length, 0);
assert(pureEssRejected.messages[0]?.includes("dark essence fragments"));

const lowBlood = makePlayer({
    level: 76,
    items: { [DARK_ESSENCE_FRAGMENTS]: 4 },
});
craft(kourendBlood, lowBlood);
assert.equal(lowBlood.counts.get(DARK_ESSENCE_FRAGMENTS), 4);
assert.equal(lowBlood.xp.length, 0);
assert(lowBlood.messages[0]?.includes("level of at least 77"));

const lowSoul = makePlayer({
    level: 89,
    items: { [DARK_ESSENCE_FRAGMENTS]: 4 },
});
craft(soul, lowSoul);
assert.equal(lowSoul.counts.get(DARK_ESSENCE_FRAGMENTS), 4);
assert.equal(lowSoul.xp.length, 0);
assert(lowSoul.messages[0]?.includes("level of at least 90"));

const craftBlood = makePlayer({
    level: 77,
    items: { [DARK_ESSENCE_FRAGMENTS]: 10 },
});
craft(kourendBlood, craftBlood);
assert.equal(craftBlood.counts.get(DARK_ESSENCE_FRAGMENTS) ?? 0, 0);
assert.equal(craftBlood.counts.get(kourendBlood.runeId), 10);
assert.deepEqual(craftBlood.xp, [10 * kourendBlood.xpPerEssence]);
assert.equal(craftBlood.snapshots.length, 1);
assert.equal(craftBlood.teleports.length, 0);

const craftBlood99 = makePlayer({
    level: 99,
    items: { [DARK_ESSENCE_FRAGMENTS]: 4 },
});
craft(kourendBlood, craftBlood99);
assert.equal(craftBlood99.counts.get(kourendBlood.runeId), 4, "kourend blood never multiplies from level");
assert.deepEqual(craftBlood99.xp, [4 * kourendBlood.xpPerEssence]);

const craftSoul = makePlayer({
    level: 90,
    items: { [DARK_ESSENCE_FRAGMENTS]: 6 },
});
craft(soul, craftSoul);
assert.equal(craftSoul.counts.get(DARK_ESSENCE_FRAGMENTS) ?? 0, 0);
assert.equal(craftSoul.counts.get(soul.runeId), 6);
assert.deepEqual(craftSoul.xp, [6 * soul.xpPerEssence]);

const craftSoul99 = makePlayer({
    level: 99,
    items: { [DARK_ESSENCE_FRAGMENTS]: 4 },
});
craft(soul, craftSoul99);
assert.equal(craftSoul99.counts.get(soul.runeId), 4, "soul never multiplies from level");
assert.deepEqual(craftSoul99.xp, [4 * soul.xpPerEssence]);

const useFragmentsOnBlood = makePlayer({
    level: 77,
    items: { [DARK_ESSENCE_FRAGMENTS]: 2 },
});
itemOnLocHandlers.get(`${DARK_ESSENCE_FRAGMENTS}:${kourendBlood.altarLocId}`)!({
    player: useFragmentsOnBlood.player,
    source: { slot: 0, itemId: DARK_ESSENCE_FRAGMENTS },
    target: {
        locId: kourendBlood.altarLocId,
        tile: { x: 1718, y: 3828 },
        level: 0,
    },
    tick: 1,
    services: useFragmentsOnBlood.services,
} as ItemOnLocEvent);
assert.equal(useFragmentsOnBlood.counts.get(kourendBlood.runeId), 2);
assert.deepEqual(useFragmentsOnBlood.xp, [2 * kourendBlood.xpPerEssence]);

const useFragmentsOnSoul = makePlayer({
    level: 90,
    items: { [DARK_ESSENCE_FRAGMENTS]: 3 },
});
itemOnLocHandlers.get(`${DARK_ESSENCE_FRAGMENTS}:${soul.altarLocId}`)!({
    player: useFragmentsOnSoul.player,
    source: { slot: 0, itemId: DARK_ESSENCE_FRAGMENTS },
    target: {
        locId: soul.altarLocId,
        tile: { x: 1815, y: 3854 },
        level: 0,
    },
    tick: 1,
    services: useFragmentsOnSoul.services,
} as ItemOnLocEvent);
assert.equal(useFragmentsOnSoul.counts.get(soul.runeId), 3);
assert.deepEqual(useFragmentsOnSoul.xp, [3 * soul.xpPerEssence]);

console.log("runecrafting-kourend-altars.test.ts: all assertions passed");
