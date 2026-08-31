import assert from "node:assert/strict";

import type { NpcState } from "../src/game/npc";
import type { PlayerState } from "../src/game/player";
import type {
    IScriptRegistry,
    ItemOnLocHandler,
    LocInteractionEvent,
    LocInteractionHandler,
    NpcInteractionEvent,
    NpcInteractionHandler,
    ScriptServices,
} from "../src/game/scripts/types";
import { ALL_ALTARS } from "../gamemodes/vanilla/skills/runecrafting/altars";
import {
    ABYSS_BLOCKAGE_LOC_ID,
    ABYSS_OBSTACLES,
    ABYSS_RIFTS,
    INNER_ABYSS,
    WILDERNESS_MAGE_NPC_IDS,
} from "../gamemodes/vanilla/skills/runecrafting/abyss";
import { register } from "../gamemodes/vanilla/skills/runecrafting";

const locHandlers = new Map<string, LocInteractionHandler>();
const npcHandlers = new Map<string, NpcInteractionHandler>();
const registry = {
    registerLocInteraction: (locId: number, handler: LocInteractionHandler, action?: string) => {
        locHandlers.set(`${locId}:${action ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerItemOnLoc: (_itemId: number, _locId: number, _handler: ItemOnLocHandler) => {
        return { unregister() {} };
    },
    registerNpcInteraction: (
        npcId: number,
        handler: NpcInteractionHandler,
        option?: string,
    ) => {
        npcHandlers.set(`${npcId}:${option ?? "*"}`, handler);
        return { unregister() {} };
    },
    registerItemAction: () => ({ unregister() {} }),
    registerItemOnItem: () => ({ unregister() {} }),
} as unknown as IScriptRegistry;

register(registry);

const altarById = new Map(ALL_ALTARS.map((altar) => [altar.id, altar]));

assert.equal(ABYSS_RIFTS.length, 12);
assert(!ABYSS_RIFTS.some((rift) => rift.altarId === "wrath"));
assert(!ABYSS_RIFTS.some((rift) => rift.altarId === "soul"));
assert(!ABYSS_RIFTS.some((rift) => rift.altarId === "astral"));

for (const rift of ABYSS_RIFTS) {
    const altar = altarById.get(rift.altarId);
    assert.ok(altar, `missing ruins altar ${rift.altarId}`);
    for (const locId of rift.locIds) {
        assert(locHandlers.has(`${locId}:exit-through`));
        assert(locHandlers.has(`${locId}:*`));
    }
}

function makePlayer(opts?: { skillLevel?: number }) {
    const messages: string[] = [];
    const teleports: Array<{ x: number; y: number; level: number }> = [];
    const player = { id: 9 } as unknown as PlayerState;
    const services = {
        messaging: {
            sendGameMessage: (_p: PlayerState, text: string) => messages.push(text),
        },
        movement: {
            teleportPlayer: (_p: PlayerState, x: number, y: number, level: number) => {
                teleports.push({ x, y, level });
            },
        },
        skills: {
            getSkill: () => ({ baseLevel: opts?.skillLevel ?? 1, boost: 0 }),
        },
    } as unknown as ScriptServices;
    return { player, services, messages, teleports };
}

for (const rift of ABYSS_RIFTS) {
    const altar = altarById.get(rift.altarId)!;
    const locId = rift.locIds[0];
    const click = makePlayer();
    locHandlers.get(`${locId}:exit-through`)!({
        player: click.player,
        locId,
        tile: { x: 3040, y: 4832 },
        level: 0,
        action: "exit-through",
        tick: 1,
        services: click.services,
    } as LocInteractionEvent);
    assert.deepEqual(click.teleports[0], altar.altarEnter);
    assert.equal(click.messages[0], "You step through the rift...");
}

const blood = ABYSS_RIFTS.find((rift) => rift.altarId === "blood");
assert.ok(blood);
assert.deepEqual([...blood.locIds], [43824, 43825]);
const bloodAltar = altarById.get("blood")!;
const secondBlood = makePlayer();
locHandlers.get(`${blood.locIds[1]}:exit-through`)!({
    player: secondBlood.player,
    locId: blood.locIds[1],
    tile: { x: 3027, y: 4834 },
    level: 0,
    action: "exit-through",
    tick: 1,
    services: secondBlood.services,
} as LocInteractionEvent);
assert.deepEqual(secondBlood.teleports[0], bloodAltar.altarEnter);

assert(!locHandlers.has("25377:exit-through"), "soul rift must stay unregistered");
assert(!locHandlers.has("34772:exit-through"), "wrath altar loc is not an abyss rift");

for (const npcId of WILDERNESS_MAGE_NPC_IDS) {
    assert(npcHandlers.has(`${npcId}:teleport`));
    assert(npcHandlers.has(`${npcId}:talk-to`));
}

const mage = makePlayer();
npcHandlers.get(`${WILDERNESS_MAGE_NPC_IDS[1]}:teleport`)!({
    player: mage.player,
    npc: { id: 1, typeId: 2581, name: "Mage of Zamorak" } as NpcState,
    option: "teleport",
    tick: 1,
    services: mage.services,
} as NpcInteractionEvent);
assert.deepEqual(mage.teleports[0], INNER_ABYSS);
assert.equal(mage.messages[0], "The Mage of Zamorak weaves a spell around you...");

const talk = makePlayer();
npcHandlers.get(`${WILDERNESS_MAGE_NPC_IDS[0]}:talk-to`)!({
    player: talk.player,
    npc: { id: 2, typeId: 3228, name: "Mage of Zamorak" } as NpcState,
    option: "talk-to",
    tick: 1,
    services: talk.services,
} as NpcInteractionEvent);
assert.deepEqual(talk.teleports[0], INNER_ABYSS);

assert.equal(ABYSS_OBSTACLES.length, 6);
assert(!ABYSS_OBSTACLES.some((obstacle) => obstacle.locIds.includes(ABYSS_BLOCKAGE_LOC_ID)));
assert(!locHandlers.has(`${ABYSS_BLOCKAGE_LOC_ID}:*`));
assert(!locHandlers.has("25423:mine"), "partly mined rock has no cache op");
assert(!locHandlers.has("25426:chop"), "partly chopped tendrils have no cache op");

for (const obstacle of ABYSS_OBSTACLES) {
    for (const locId of obstacle.locIds) {
        assert(locHandlers.has(`${locId}:${obstacle.action}`));
        assert(locHandlers.has(`${locId}:*`));
    }
}

for (const obstacle of ABYSS_OBSTACLES) {
    const locId = obstacle.locIds[0];
    const click = makePlayer({ skillLevel: 1 });
    locHandlers.get(`${locId}:${obstacle.action}`)!({
        player: click.player,
        locId,
        tile: { x: 3038, y: 4853 },
        level: 0,
        action: obstacle.action,
        tick: 1,
        services: click.services,
    } as LocInteractionEvent);
    assert.deepEqual(click.teleports[0], INNER_ABYSS);
    assert.equal(click.messages[0], obstacle.passMessage);
}

const rock = ABYSS_OBSTACLES.find((obstacle) => obstacle.id === "rock")!;
const tooLow = makePlayer({ skillLevel: 0 });
locHandlers.get(`${rock.locIds[0]}:mine`)!({
    player: tooLow.player,
    locId: rock.locIds[0],
    tile: { x: 3041, y: 4811 },
    level: 0,
    action: "mine",
    tick: 1,
    services: tooLow.services,
} as LocInteractionEvent);
assert.equal(tooLow.teleports.length, 0);
assert.equal(tooLow.messages[0], "You need a Mining level of at least 1 to pass.");

const passage = ABYSS_OBSTACLES.find((obstacle) => obstacle.id === "passage")!;
const noSkill = makePlayer({ skillLevel: 0 });
locHandlers.get(`${passage.locIds[0]}:go-through`)!({
    player: noSkill.player,
    locId: passage.locIds[0],
    tile: { x: 3041, y: 4811 },
    level: 0,
    action: "go-through",
    tick: 1,
    services: noSkill.services,
} as LocInteractionEvent);
assert.deepEqual(noSkill.teleports[0], INNER_ABYSS);

console.log("runecrafting-abyss.test.ts: all assertions passed");
