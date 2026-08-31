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
    registerNpcInteraction: () => ({ unregister() {} }),
    registerItemAction: () => ({ unregister() {} }),
    registerItemOnItem: () => ({ unregister() {} }),
} as unknown as IScriptRegistry;

register(registry);

const astral = WALKUP_ALTARS.find((altar) => altar.id === "astral");
assert.ok(astral);
assert.equal(astral.altarLocId, 34771);
assert.equal(astral.runeId, 9075);
assert(locHandlers.has(`${astral.altarLocId}:craft-rune`));
assert(itemOnLocHandlers.has(`${PURE_ESSENCE}:${astral.altarLocId}`));
assert(itemOnLocHandlers.has(`${RUNE_ESSENCE}:${astral.altarLocId}`));
assert.equal(locHandlers.has(`${astral.altarLocId}:enter`), false);
assert.equal(locHandlers.has(`${astral.altarLocId}:use`), false);

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

function craft(player: ReturnType<typeof makePlayer>) {
    locHandlers.get(`${astral.altarLocId}:craft-rune`)!({
        player: player.player,
        locId: astral.altarLocId,
        tile: { x: 2157, y: 3863 },
        level: 0,
        tick: 1,
        services: player.services,
    } as LocInteractionEvent);
}

const runeEssRejected = makePlayer({ level: 40, items: { [RUNE_ESSENCE]: 10 } });
craft(runeEssRejected);
assert.equal(runeEssRejected.counts.get(RUNE_ESSENCE), 10);
assert.equal(runeEssRejected.xp.length, 0);
assert.equal(runeEssRejected.teleports.length, 0);
assert(runeEssRejected.messages[0]?.includes("pure essence"));

const lowLevel = makePlayer({ level: 39, items: { [PURE_ESSENCE]: 5 } });
craft(lowLevel);
assert.equal(lowLevel.counts.get(PURE_ESSENCE), 5);
assert.equal(lowLevel.xp.length, 0);
assert(lowLevel.messages[0]?.includes("level of at least 40"));

const craft1x = makePlayer({ level: 40, items: { [PURE_ESSENCE]: 10 } });
craft(craft1x);
assert.equal(craft1x.counts.get(PURE_ESSENCE) ?? 0, 0);
assert.equal(craft1x.counts.get(astral.runeId), 10);
assert.deepEqual(craft1x.xp, [10 * astral.xpPerEssence]);
assert.equal(craft1x.snapshots.length, 1);
assert.equal(craft1x.teleports.length, 0);

const justBelow2x = makePlayer({ level: 81, items: { [PURE_ESSENCE]: 4 } });
craft(justBelow2x);
assert.equal(justBelow2x.counts.get(astral.runeId), 4);

const craft2x = makePlayer({ level: 82, items: { [PURE_ESSENCE]: 4 } });
craft(craft2x);
assert.equal(craft2x.counts.get(astral.runeId), 8);
assert.deepEqual(craft2x.xp, [4 * astral.xpPerEssence]);

const useEssenceOnAltar = makePlayer({ level: 40, items: { [PURE_ESSENCE]: 2 } });
itemOnLocHandlers.get(`${PURE_ESSENCE}:${astral.altarLocId}`)!({
    player: useEssenceOnAltar.player,
    source: { slot: 0, itemId: PURE_ESSENCE },
    target: {
        locId: astral.altarLocId,
        tile: { x: 2157, y: 3863 },
        level: 0,
    },
    tick: 1,
    services: useEssenceOnAltar.services,
} as ItemOnLocEvent);
assert.equal(useEssenceOnAltar.counts.get(astral.runeId), 2);
assert.deepEqual(useEssenceOnAltar.xp, [2 * astral.xpPerEssence]);

console.log("runecrafting-astral-altar.test.ts: all assertions passed");
