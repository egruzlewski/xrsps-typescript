import assert from "node:assert/strict";

import { EquipmentSlot } from "../../client/rs/config/player/Equipment";
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
import { F2P_ALTARS, PURE_ESSENCE, RUNE_ESSENCE } from "../gamemodes/vanilla/skills/runecrafting/altars";
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

assert.equal(F2P_ALTARS.length, 6);
for (const altar of F2P_ALTARS) {
    assert(locHandlers.has(`${altar.ruinsLocIds[0]}:enter`));
    assert(locHandlers.has(`${altar.altarLocId}:craft-rune`));
    assert(locHandlers.has(`${altar.portalLocId}:use`));
    assert(itemOnLocHandlers.has(`${altar.talismanId}:${altar.ruinsLocIds[0]}`));
}

type Counts = Map<number, number>;

function makePlayer(opts: {
    level: number;
    head?: number;
    items?: Record<number, number>;
}) {
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
            getEquipArray: () => {
                const equip = new Array<number>(12).fill(0);
                if (opts.head) equip[EquipmentSlot.HEAD] = opts.head;
                return equip;
            },
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

const air = F2P_ALTARS[0];
const mind = F2P_ALTARS[1];
const body = F2P_ALTARS[5];

const clickNoTiara = makePlayer({ level: 1 });
locHandlers.get(`${air.ruinsLocIds[0]}:enter`)!({
    player: clickNoTiara.player,
    locId: air.ruinsLocIds[0],
    tile: { x: 2984, y: 3291 },
    level: 0,
    tick: 1,
    services: clickNoTiara.services,
} as LocInteractionEvent);
assert.equal(clickNoTiara.teleports.length, 0);
assert.equal(clickNoTiara.messages[0], "Nothing interesting happens.");

const clickTiara = makePlayer({ level: 1, head: air.tiaraId });
locHandlers.get(`${air.ruinsLocIds[0]}:enter`)!({
    player: clickTiara.player,
    locId: air.ruinsLocIds[0],
    tile: { x: 2984, y: 3291 },
    level: 0,
    tick: 1,
    services: clickTiara.services,
} as LocInteractionEvent);
assert.deepEqual(clickTiara.teleports[0], air.altarEnter);

const talisman = makePlayer({ level: 1 });
itemOnLocHandlers.get(`${mind.talismanId}:${mind.ruinsLocIds[0]}`)!({
    player: talisman.player,
    source: { slot: 0, itemId: mind.talismanId },
    target: {
        locId: mind.ruinsLocIds[0],
        tile: { x: 2981, y: 3513 },
        level: 0,
    },
    tick: 1,
    services: talisman.services,
} as ItemOnLocEvent);
assert.deepEqual(talisman.teleports[0], mind.altarEnter);

const lowLevel = makePlayer({ level: 1, items: { [RUNE_ESSENCE]: 5 } });
locHandlers.get(`${mind.altarLocId}:craft-rune`)!({
    player: lowLevel.player,
    locId: mind.altarLocId,
    tile: { x: 2785, y: 4840 },
    level: 0,
    tick: 1,
    services: lowLevel.services,
} as LocInteractionEvent);
assert.equal(lowLevel.counts.get(RUNE_ESSENCE), 5);
assert.equal(lowLevel.xp.length, 0);
assert(lowLevel.messages[0]?.includes("level of at least 2"));

const craftAir = makePlayer({ level: 1, items: { [RUNE_ESSENCE]: 10 } });
locHandlers.get(`${air.altarLocId}:craft-rune`)!({
    player: craftAir.player,
    locId: air.altarLocId,
    tile: { x: 2841, y: 4830 },
    level: 0,
    tick: 1,
    services: craftAir.services,
} as LocInteractionEvent);
assert.equal(craftAir.counts.get(RUNE_ESSENCE) ?? 0, 0);
assert.equal(craftAir.counts.get(air.runeId), 10);
assert.deepEqual(craftAir.xp, [50]);
assert.equal(craftAir.snapshots.length, 1);

const craftMindHigh = makePlayer({
    level: 28,
    items: { [PURE_ESSENCE]: 4 },
});
locHandlers.get(`${mind.altarLocId}:*`)!({
    player: craftMindHigh.player,
    locId: mind.altarLocId,
    tile: { x: 2785, y: 4840 },
    level: 0,
    tick: 1,
    services: craftMindHigh.services,
} as LocInteractionEvent);
assert.equal(craftMindHigh.counts.get(PURE_ESSENCE) ?? 0, 0);
assert.equal(craftMindHigh.counts.get(mind.runeId), 12, "mind at 28 is 3 runes per essence");
assert.deepEqual(craftMindHigh.xp, [22]);

const craftBody = makePlayer({ level: 20, items: { [RUNE_ESSENCE]: 2 } });
locHandlers.get(`${body.altarLocId}:craft-rune`)!({
    player: craftBody.player,
    locId: body.altarLocId,
    tile: { x: 2522, y: 4839 },
    level: 0,
    tick: 1,
    services: craftBody.services,
} as LocInteractionEvent);
assert.equal(craftBody.counts.get(body.runeId), 2);
assert.deepEqual(craftBody.xp, [15]);

const leave = makePlayer({ level: 14 });
locHandlers.get(`${F2P_ALTARS[4].portalLocId}:use`)!({
    player: leave.player,
    locId: F2P_ALTARS[4].portalLocId,
    tile: { x: 2574, y: 4850 },
    level: 0,
    tick: 1,
    services: leave.services,
} as LocInteractionEvent);
assert.deepEqual(leave.teleports[0], F2P_ALTARS[4].ruinsExit);

console.log("runecrafting-f2p-altars.test.ts: all assertions passed");
