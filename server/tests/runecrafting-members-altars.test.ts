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
    MEMBERS_ALTARS,
    PURE_ESSENCE,
    RUNE_ESSENCE,
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

assert.equal(MEMBERS_ALTARS.length, 7);
for (const altar of MEMBERS_ALTARS) {
    assert(locHandlers.has(`${altar.ruinsLocIds[0]}:enter`));
    assert(locHandlers.has(`${altar.altarLocId}:craft-rune`));
    assert(locHandlers.has(`${altar.portalLocId}:use`));
    assert(itemOnLocHandlers.has(`${altar.talismanId}:${altar.ruinsLocIds[0]}`));
    assert(itemOnLocHandlers.has(`${PURE_ESSENCE}:${altar.altarLocId}`));
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

function craft(altar: (typeof MEMBERS_ALTARS)[number], player: ReturnType<typeof makePlayer>) {
    locHandlers.get(`${altar.altarLocId}:craft-rune`)!({
        player: player.player,
        locId: altar.altarLocId,
        tile: { x: altar.altarEnter.x, y: altar.altarEnter.y },
        level: 0,
        tick: 1,
        services: player.services,
    } as LocInteractionEvent);
}

const cosmic = MEMBERS_ALTARS[0];
const chaos = MEMBERS_ALTARS[1];
const nature = MEMBERS_ALTARS[2];
const law = MEMBERS_ALTARS[3];
const death = MEMBERS_ALTARS[4];
const blood = MEMBERS_ALTARS[5];
const wrath = MEMBERS_ALTARS[6];

const clickTiara = makePlayer({ level: 27, head: cosmic.tiaraId });
locHandlers.get(`${cosmic.ruinsLocIds[0]}:enter`)!({
    player: clickTiara.player,
    locId: cosmic.ruinsLocIds[0],
    tile: { x: 2407, y: 4376 },
    level: 0,
    tick: 1,
    services: clickTiara.services,
} as LocInteractionEvent);
assert.deepEqual(clickTiara.teleports[0], cosmic.altarEnter);

const talisman = makePlayer({ level: 44 });
itemOnLocHandlers.get(`${nature.talismanId}:${nature.ruinsLocIds[0]}`)!({
    player: talisman.player,
    source: { slot: 0, itemId: nature.talismanId },
    target: {
        locId: nature.ruinsLocIds[0],
        tile: { x: 2868, y: 3018 },
        level: 0,
    },
    tick: 1,
    services: talisman.services,
} as ItemOnLocEvent);
assert.deepEqual(talisman.teleports[0], nature.altarEnter);

const runeEssRejected = makePlayer({ level: 27, items: { [RUNE_ESSENCE]: 10 } });
craft(cosmic, runeEssRejected);
assert.equal(runeEssRejected.counts.get(RUNE_ESSENCE), 10);
assert.equal(runeEssRejected.xp.length, 0);
assert(runeEssRejected.messages[0]?.includes("pure essence"));

const lowLevel = makePlayer({ level: 26, items: { [PURE_ESSENCE]: 5 } });
craft(cosmic, lowLevel);
assert.equal(lowLevel.counts.get(PURE_ESSENCE), 5);
assert.equal(lowLevel.xp.length, 0);
assert(lowLevel.messages[0]?.includes("level of at least 27"));

const craftCosmic = makePlayer({ level: 27, items: { [PURE_ESSENCE]: 10 } });
craft(cosmic, craftCosmic);
assert.equal(craftCosmic.counts.get(PURE_ESSENCE) ?? 0, 0);
assert.equal(craftCosmic.counts.get(cosmic.runeId), 10);
assert.deepEqual(craftCosmic.xp, [80]);
assert.equal(craftCosmic.snapshots.length, 1);

const craftCosmic2x = makePlayer({ level: 59, items: { [PURE_ESSENCE]: 4 } });
craft(cosmic, craftCosmic2x);
assert.equal(craftCosmic2x.counts.get(cosmic.runeId), 8);

const craftChaos = makePlayer({ level: 35, items: { [PURE_ESSENCE]: 2 } });
craft(chaos, craftChaos);
assert.equal(craftChaos.counts.get(chaos.runeId), 2);
assert.deepEqual(craftChaos.xp, [17]);

const craftNature2x = makePlayer({ level: 91, items: { [PURE_ESSENCE]: 3 } });
craft(nature, craftNature2x);
assert.equal(craftNature2x.counts.get(nature.runeId), 6);
assert.deepEqual(craftNature2x.xp, [27]);

const craftLaw = makePlayer({ level: 54, items: { [PURE_ESSENCE]: 2 } });
craft(law, craftLaw);
assert.equal(craftLaw.counts.get(law.runeId), 2);
assert.deepEqual(craftLaw.xp, [19]);

const craftDeath2x = makePlayer({ level: 99, items: { [PURE_ESSENCE]: 2 } });
craft(death, craftDeath2x);
assert.equal(craftDeath2x.counts.get(death.runeId), 4);
assert.deepEqual(craftDeath2x.xp, [20]);

const craftBlood = makePlayer({ level: 99, items: { [PURE_ESSENCE]: 4 } });
craft(blood, craftBlood);
assert.equal(craftBlood.counts.get(blood.runeId), 4, "blood never multiplies from level");
assert.deepEqual(craftBlood.xp, [42]);

const craftWrath = makePlayer({ level: 95, items: { [PURE_ESSENCE]: 3 } });
craft(wrath, craftWrath);
assert.equal(craftWrath.counts.get(wrath.runeId), 3);
assert.deepEqual(craftWrath.xp, [24]);

const leave = makePlayer({ level: 95 });
locHandlers.get(`${wrath.portalLocId}:use`)!({
    player: leave.player,
    locId: wrath.portalLocId,
    tile: { x: wrath.altarEnter.x, y: wrath.altarEnter.y },
    level: 0,
    tick: 1,
    services: leave.services,
} as LocInteractionEvent);
assert.deepEqual(leave.teleports[0], wrath.ruinsExit);

console.log("runecrafting-members-altars.test.ts: all assertions passed");
