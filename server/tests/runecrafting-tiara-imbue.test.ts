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
import {
    ALL_ALTARS,
    BLANK_TIARA,
    F2P_ALTARS,
    MEMBERS_ALTARS,
    PURE_ESSENCE,
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
} as unknown as IScriptRegistry;

register(registry);

for (const altar of ALL_ALTARS) {
    assert(itemOnLocHandlers.has(`${BLANK_TIARA}:${altar.altarLocId}`));
    assert(itemOnLocHandlers.has(`${altar.talismanId}:${altar.altarLocId}`));
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
        inventory: {
            snapshotInventory: () => {
                snapshots.push(1);
            },
        },
    } as unknown as ScriptServices;

    return { player, services, messages, xp, snapshots, counts };
}

function useOnAltar(
    itemId: number,
    altar: (typeof ALL_ALTARS)[number],
    session: ReturnType<typeof makePlayer>,
) {
    itemOnLocHandlers.get(`${itemId}:${altar.altarLocId}`)!({
        player: session.player,
        source: { slot: 0, itemId },
        target: {
            locId: altar.altarLocId,
            tile: { x: altar.altarEnter.x, y: altar.altarEnter.y },
            level: 0,
        },
        tick: 1,
        services: session.services,
    } as ItemOnLocEvent);
}

const air = F2P_ALTARS[0];
const nature = MEMBERS_ALTARS[2];
const wrath = MEMBERS_ALTARS[6];

const noTiara = makePlayer({ level: 1, items: { [air.talismanId]: 1 } });
useOnAltar(air.talismanId, air, noTiara);
assert.equal(noTiara.counts.get(air.talismanId), 1);
assert.equal(noTiara.xp.length, 0);
assert.equal(noTiara.messages[0], "You need a tiara to bind.");

const noTalisman = makePlayer({ level: 1, items: { [BLANK_TIARA]: 1 } });
useOnAltar(BLANK_TIARA, air, noTalisman);
assert.equal(noTalisman.counts.get(BLANK_TIARA), 1);
assert.equal(noTalisman.xp.length, 0);
assert(noTalisman.messages[0]?.includes("Air Talisman"));

const imbueAir = makePlayer({
    level: 1,
    items: { [BLANK_TIARA]: 3, [air.talismanId]: 2 },
});
useOnAltar(air.talismanId, air, imbueAir);
assert.equal(imbueAir.counts.get(BLANK_TIARA), 2);
assert.equal(imbueAir.counts.get(air.talismanId), 1);
assert.equal(imbueAir.counts.get(air.tiaraId), 1);
assert.deepEqual(imbueAir.xp, [25]);
assert.equal(imbueAir.snapshots.length, 1);
assert.equal(imbueAir.messages[0], "You bind the power of Air into your tiara.");

const imbueViaTiara = makePlayer({
    level: 1,
    items: { [BLANK_TIARA]: 1, [air.talismanId]: 1 },
});
useOnAltar(BLANK_TIARA, air, imbueViaTiara);
assert.equal(imbueViaTiara.counts.get(BLANK_TIARA) ?? 0, 0);
assert.equal(imbueViaTiara.counts.get(air.tiaraId), 1);
assert.deepEqual(imbueViaTiara.xp, [25]);

const imbueNature = makePlayer({
    level: 1,
    items: { [BLANK_TIARA]: 1, [nature.talismanId]: 1 },
});
useOnAltar(nature.talismanId, nature, imbueNature);
assert.equal(imbueNature.counts.get(nature.tiaraId), 1);
assert.deepEqual(imbueNature.xp, [45]);

const imbueWrath = makePlayer({
    level: 1,
    items: { [BLANK_TIARA]: 1, [wrath.talismanId]: 1 },
});
useOnAltar(BLANK_TIARA, wrath, imbueWrath);
assert.equal(imbueWrath.counts.get(wrath.tiaraId), 1);
assert.deepEqual(imbueWrath.xp, [52.5]);

const clickStillCrafts = makePlayer({
    level: 1,
    items: {
        [BLANK_TIARA]: 1,
        [air.talismanId]: 1,
        [PURE_ESSENCE]: 4,
    },
});
locHandlers.get(`${air.altarLocId}:craft-rune`)!({
    player: clickStillCrafts.player,
    locId: air.altarLocId,
    tile: { x: air.altarEnter.x, y: air.altarEnter.y },
    level: 0,
    tick: 1,
    services: clickStillCrafts.services,
} as LocInteractionEvent);
assert.equal(clickStillCrafts.counts.get(air.runeId), 4);
assert.equal(clickStillCrafts.counts.get(BLANK_TIARA), 1);
assert.equal(clickStillCrafts.counts.get(air.talismanId), 1);
assert.equal(clickStillCrafts.counts.get(air.tiaraId) ?? 0, 0);
assert.deepEqual(clickStillCrafts.xp, [20]);

console.log("runecrafting-tiara-imbue.test.ts: all assertions passed");
