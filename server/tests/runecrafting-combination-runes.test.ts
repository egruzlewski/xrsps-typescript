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
import {
    allCombinationBindings,
    BINDING_NECKLACE_CHARGES,
    BINDING_NECKLACE_ID,
    COMBINATION_RUNES,
    countCombinationSuccesses,
    nextBindingNecklaceCharges,
    wearsBindingNecklace,
} from "../gamemodes/vanilla/skills/runecrafting/combination";
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

assert.equal(COMBINATION_RUNES.length, 6);
const bindings = allCombinationBindings();
assert.equal(bindings.length, 12);
for (const binding of bindings) {
    assert(itemOnLocHandlers.has(`${binding.opposing.talismanId}:${binding.altar.altarLocId}`));
    assert(itemOnLocHandlers.has(`${binding.opposing.tiaraId}:${binding.altar.altarLocId}`));
    assert(itemOnLocHandlers.has(`${binding.opposing.runeId}:${binding.altar.altarLocId}`));
}

type Counts = Map<number, number>;

function makePlayer(opts: {
    level: number;
    head?: number;
    neck?: number;
    items?: Record<number, number>;
    charges?: Record<number, number>;
}) {
    const counts: Counts = new Map(
        Object.entries(opts.items ?? {}).map(([id, qty]) => [Number(id), qty]),
    );
    const chargeMap = new Map(
        Object.entries(opts.charges ?? {}).map(([id, qty]) => [Number(id), qty]),
    );
    const messages: string[] = [];
    const xp: number[] = [];
    const snapshots: number[] = [];
    const appearanceSnapshots: number[] = [];
    const equip = new Array<number>(12).fill(0);
    if (opts.head) equip[EquipmentSlot.HEAD] = opts.head;
    if (opts.neck) equip[EquipmentSlot.AMULET] = opts.neck;
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
        equipment: {
            getCharges: (itemId: number) => chargeMap.get(itemId) ?? 0,
            setCharges: (itemId: number, charges: number) => {
                if (charges <= 0) chargeMap.delete(itemId);
                else chargeMap.set(itemId, charges);
            },
        },
        markEquipmentDirty() {},
        markAppearanceDirty() {},
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
            getEquipArray: () => equip,
        },
        appearance: {
            queueAppearanceSnapshot: () => {
                appearanceSnapshots.push(1);
            },
            refreshAppearanceKits: () => {},
            savePlayerSnapshot: () => {},
            logoutPlayer: () => {},
        },
        inventory: {
            snapshotInventory: () => {
                snapshots.push(1);
            },
        },
    } as unknown as ScriptServices;

    return { player, services, messages, xp, snapshots, counts, equip, chargeMap, appearanceSnapshots };
}

function useOnAltar(
    itemId: number,
    altar: (typeof F2P_ALTARS)[number],
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
const water = F2P_ALTARS[2];
const earth = F2P_ALTARS[3];
const fire = F2P_ALTARS[4];

assert.equal(countCombinationSuccesses(4, true), 4);
assert.equal(countCombinationSuccesses(4, false, () => 0), 4);
assert.equal(countCombinationSuccesses(4, false, () => 0.5), 0);
assert.equal(countCombinationSuccesses(4, false, () => 0.49), 4);
assert.deepEqual(countCombinationSuccesses(4, false, (() => {
    const rolls = [0, 0.9, 0, 0.9];
    let i = 0;
    return () => rolls[i++]!;
})()), 2);
assert.equal(wearsBindingNecklace([0, 0, BINDING_NECKLACE_ID]), true);
assert.equal(wearsBindingNecklace([0, 0, 0]), false);
assert.deepEqual(nextBindingNecklaceCharges(0), { remaining: 15, disintegrated: false });
assert.deepEqual(nextBindingNecklaceCharges(BINDING_NECKLACE_CHARGES), {
    remaining: 15,
    disintegrated: false,
});
assert.deepEqual(nextBindingNecklaceCharges(1), { remaining: 0, disintegrated: true });

const originalRandom = Math.random;
function withRandom(value: number | number[], fn: () => void): void {
    const rolls = Array.isArray(value) ? value : [value];
    let i = 0;
    Math.random = () => rolls[Math.min(i++, rolls.length - 1)]!;
    try {
        fn();
    } finally {
        Math.random = originalRandom;
    }
}

const mist = COMBINATION_RUNES[0];
const dust = COMBINATION_RUNES[1];
const mud = COMBINATION_RUNES[2];
const smoke = COMBINATION_RUNES[3];
const steam = COMBINATION_RUNES[4];
const lava = COMBINATION_RUNES[5];

const lowLevel = makePlayer({
    level: 5,
    items: {
        [PURE_ESSENCE]: 4,
        [water.runeId]: 4,
        [water.talismanId]: 1,
    },
});
useOnAltar(water.talismanId, air, lowLevel);
assert.equal(lowLevel.counts.get(PURE_ESSENCE), 4);
assert.equal(lowLevel.xp.length, 0);
assert(lowLevel.messages[0]?.includes("level of at least 6"));

const runeEssRejected = makePlayer({
    level: 6,
    items: {
        [RUNE_ESSENCE]: 8,
        [water.runeId]: 8,
        [water.talismanId]: 1,
    },
});
useOnAltar(water.talismanId, air, runeEssRejected);
assert.equal(runeEssRejected.counts.get(RUNE_ESSENCE), 8);
assert.equal(runeEssRejected.xp.length, 0);
assert(runeEssRejected.messages[0]?.includes("pure essence"));

const missingRunes = makePlayer({
    level: 6,
    items: { [PURE_ESSENCE]: 4, [water.talismanId]: 1 },
});
useOnAltar(water.talismanId, air, missingRunes);
assert.equal(missingRunes.counts.get(PURE_ESSENCE), 4);
assert(missingRunes.messages[0]?.includes("Water Runes"));

const missingCatalyst = makePlayer({
    level: 6,
    items: { [PURE_ESSENCE]: 4, [water.runeId]: 4 },
});
useOnAltar(water.runeId, air, missingCatalyst);
assert.equal(missingCatalyst.counts.get(PURE_ESSENCE), 4);
assert(missingCatalyst.messages[0]?.includes("Water Talisman"));

Math.random = () => 0;

const mistAtAir = makePlayer({
    level: 6,
    items: {
        [PURE_ESSENCE]: 10,
        [water.runeId]: 10,
        [water.talismanId]: 1,
    },
});
useOnAltar(water.talismanId, air, mistAtAir);
assert.equal(mistAtAir.counts.get(PURE_ESSENCE) ?? 0, 0);
assert.equal(mistAtAir.counts.get(water.runeId) ?? 0, 0);
assert.equal(mistAtAir.counts.get(water.talismanId) ?? 0, 0);
assert.equal(mistAtAir.counts.get(mist.runeId), 10);
assert.deepEqual(mistAtAir.xp, [80]);
assert.equal(mistAtAir.snapshots.length, 1);

const mistAtWater = makePlayer({
    level: 6,
    items: {
        [PURE_ESSENCE]: 10,
        [air.runeId]: 10,
        [air.talismanId]: 1,
    },
});
useOnAltar(air.runeId, water, mistAtWater);
assert.equal(mistAtWater.counts.get(mist.runeId), 10);
assert.deepEqual(mistAtWater.xp, [85], "mist at water altar is 8.5 xp each");
assert.equal(mistAtWater.counts.get(air.talismanId) ?? 0, 0);

const leftoverEss = makePlayer({
    level: 10,
    items: {
        [PURE_ESSENCE]: 10,
        [earth.runeId]: 3,
        [earth.talismanId]: 1,
    },
});
useOnAltar(earth.talismanId, air, leftoverEss);
assert.equal(leftoverEss.counts.get(dust.runeId), 3);
assert.equal(leftoverEss.counts.get(PURE_ESSENCE), 7);
assert.deepEqual(leftoverEss.xp, [3 * 8.3]);

const tiaraCatalyst = makePlayer({
    level: 13,
    items: {
        [PURE_ESSENCE]: 2,
        [earth.runeId]: 2,
        [earth.tiaraId]: 1,
    },
});
useOnAltar(earth.tiaraId, water, tiaraCatalyst);
assert.equal(tiaraCatalyst.counts.get(mud.runeId), 2);
assert.equal(tiaraCatalyst.counts.get(earth.tiaraId) ?? 0, 0);
assert.deepEqual(tiaraCatalyst.xp, [2 * 9.3]);

const smokeAtAir = makePlayer({
    level: 15,
    items: {
        [PURE_ESSENCE]: 4,
        [fire.runeId]: 4,
        [fire.talismanId]: 1,
    },
});
useOnAltar(fire.talismanId, air, smokeAtAir);
assert.equal(smokeAtAir.counts.get(smoke.runeId), 4);
assert.deepEqual(smokeAtAir.xp, [34]);

const steamAtFire = makePlayer({
    level: 19,
    items: {
        [PURE_ESSENCE]: 2,
        [water.runeId]: 2,
        [water.talismanId]: 1,
    },
});
useOnAltar(water.talismanId, fire, steamAtFire);
assert.equal(steamAtFire.counts.get(steam.runeId), 2);
assert.deepEqual(steamAtFire.xp, [20], "steam at fire altar is 10 xp each");

const lavaAtEarth = makePlayer({
    level: 23,
    items: {
        [PURE_ESSENCE]: 2,
        [fire.runeId]: 2,
        [fire.talismanId]: 1,
    },
});
useOnAltar(fire.talismanId, earth, lavaAtEarth);
assert.equal(lavaAtEarth.counts.get(lava.runeId), 2);
assert.deepEqual(lavaAtEarth.xp, [20]);

const lavaAtFire = makePlayer({
    level: 23,
    items: {
        [PURE_ESSENCE]: 2,
        [earth.runeId]: 2,
        [earth.talismanId]: 1,
    },
});
useOnAltar(earth.runeId, fire, lavaAtFire);
assert.equal(lavaAtFire.counts.get(lava.runeId), 2);
assert.deepEqual(lavaAtFire.xp, [21], "lava at fire altar is 10.5 xp each");

const clickStillAir = makePlayer({
    level: 6,
    items: {
        [PURE_ESSENCE]: 5,
        [water.runeId]: 5,
        [water.talismanId]: 1,
    },
});
locHandlers.get(`${air.altarLocId}:craft-rune`)!({
    player: clickStillAir.player,
    locId: air.altarLocId,
    tile: { x: air.altarEnter.x, y: air.altarEnter.y },
    level: 0,
    tick: 1,
    services: clickStillAir.services,
} as LocInteractionEvent);
assert.equal(clickStillAir.counts.get(air.runeId), 5, "clicking the altar still crafts air runes");
assert.equal(clickStillAir.counts.get(mist.runeId) ?? 0, 0);
assert.equal(clickStillAir.counts.get(water.runeId), 5);
assert.equal(clickStillAir.counts.get(water.talismanId), 1);
assert.deepEqual(clickStillAir.xp, [25]);

Math.random = originalRandom;

withRandom(0.5, () => {
    const allFail = makePlayer({
        level: 6,
        items: {
            [PURE_ESSENCE]: 10,
            [water.runeId]: 10,
            [water.talismanId]: 1,
        },
    });
    useOnAltar(water.talismanId, air, allFail);
    assert.equal(allFail.counts.get(PURE_ESSENCE) ?? 0, 0);
    assert.equal(allFail.counts.get(water.runeId) ?? 0, 0);
    assert.equal(allFail.counts.get(water.talismanId) ?? 0, 0);
    assert.equal(allFail.counts.get(mist.runeId) ?? 0, 0);
    assert.equal(allFail.xp.length, 0);
    assert.equal(allFail.snapshots.length, 1);
});

withRandom([0, 0.9, 0, 0.9], () => {
    const mixed = makePlayer({
        level: 6,
        items: {
            [PURE_ESSENCE]: 4,
            [water.runeId]: 4,
            [water.talismanId]: 1,
        },
    });
    useOnAltar(water.talismanId, air, mixed);
    assert.equal(mixed.counts.get(mist.runeId), 2);
    assert.deepEqual(mixed.xp, [16]);
});

withRandom(0.9, () => {
    const necklace = makePlayer({
        level: 6,
        neck: BINDING_NECKLACE_ID,
        items: {
            [PURE_ESSENCE]: 10,
            [water.runeId]: 10,
            [water.talismanId]: 1,
        },
    });
    useOnAltar(water.talismanId, air, necklace);
    assert.equal(necklace.counts.get(mist.runeId), 10);
    assert.deepEqual(necklace.xp, [80]);
    assert.equal(necklace.chargeMap.get(BINDING_NECKLACE_ID), 15);
    assert.equal(necklace.equip[EquipmentSlot.AMULET], BINDING_NECKLACE_ID);
    assert(necklace.messages.some((m) => m.includes("15 charges left")));
});

withRandom(0.9, () => {
    const twoCrafts = makePlayer({
        level: 6,
        neck: BINDING_NECKLACE_ID,
        items: {
            [PURE_ESSENCE]: 2,
            [water.runeId]: 2,
            [water.talismanId]: 2,
        },
    });
    useOnAltar(water.talismanId, air, twoCrafts);
    twoCrafts.counts.set(PURE_ESSENCE, 2);
    twoCrafts.counts.set(water.runeId, 2);
    useOnAltar(water.talismanId, air, twoCrafts);
    assert.equal(twoCrafts.counts.get(mist.runeId), 4);
    assert.equal(twoCrafts.chargeMap.get(BINDING_NECKLACE_ID), 14, "one charge per craft, not per rune");
});

withRandom(0.9, () => {
    const lastCharge = makePlayer({
        level: 6,
        neck: BINDING_NECKLACE_ID,
        charges: { [BINDING_NECKLACE_ID]: 1 },
        items: {
            [PURE_ESSENCE]: 2,
            [water.runeId]: 2,
            [water.talismanId]: 1,
        },
    });
    useOnAltar(water.talismanId, air, lastCharge);
    assert.equal(lastCharge.counts.get(mist.runeId), 2);
    assert.equal(lastCharge.chargeMap.get(BINDING_NECKLACE_ID), undefined);
    assert.equal(lastCharge.equip[EquipmentSlot.AMULET], -1);
    assert.equal(lastCharge.appearanceSnapshots.length, 1);
    assert(lastCharge.messages.some((m) => m.includes("has disintegrated")));
});

withRandom(0.5, () => {
    const invNecklace = makePlayer({
        level: 6,
        items: {
            [PURE_ESSENCE]: 4,
            [water.runeId]: 4,
            [water.talismanId]: 1,
            [BINDING_NECKLACE_ID]: 1,
        },
    });
    useOnAltar(water.talismanId, air, invNecklace);
    assert.equal(invNecklace.counts.get(mist.runeId) ?? 0, 0, "unworn necklace does not guarantee binds");
    assert.equal(invNecklace.counts.get(BINDING_NECKLACE_ID), 1);
    assert.equal(invNecklace.chargeMap.size, 0);
});

console.log("runecrafting-combination-runes.test.ts: all assertions passed");
