import assert from "node:assert/strict";

import type { ServerServices } from "../src/game/ServerServices";
import type { InventoryUseOnActionData } from "../src/game/actions/actionPayloads";
import { InventoryActionHandler } from "../src/game/actions/handlers/InventoryActionHandler";
import type { NpcState } from "../src/game/npc";
import type { PlayerState } from "../src/game/player";

const NOTHING_INTERESTING = "Nothing interesting happens.";

const player = {
    id: 43,
    tileX: 100,
    tileY: 100,
    level: 0,
    worldViewId: -1,
    getPathQueue: () => [],
} as unknown as PlayerState;

const npc = { id: 77, typeId: 4626, tileX: 101, tileY: 100, size: 1 } as NpcState;
const otherPlayer = {
    id: 44,
    tileX: 101,
    tileY: 100,
    level: 0,
    worldViewId: -1,
} as PlayerState;

function runUseOn(
    data: InventoryUseOnActionData,
    extras: Partial<ServerServices> = {},
): { messages: string[]; queued: string[] } {
    const messages: string[] = [];
    const queued: string[] = [];
    const services = {
        inventoryService: {
            getInventory: () => [
                { itemId: 1927, quantity: 1 },
                { itemId: 1931, quantity: 1 },
            ],
        },
        npcManager: {
            getById: (id: number) => (id === npc.id ? npc : undefined),
        },
        players: {
            getById: (id: number) => (id === otherPlayer.id ? otherPlayer : undefined),
        },
        scriptRuntime: {
            queueItemOnItem: () => {
                queued.push("item");
                return false;
            },
            queueItemOnLoc: () => {
                queued.push("loc");
                return false;
            },
            queueItemOnNpc: () => {
                queued.push("npc");
                return false;
            },
            queueItemOnPlayer: () => {
                queued.push("player");
                return false;
            },
        },
        groundItemHandler: {
            startItemOnGroundInteraction: () => false,
        },
        messagingService: {
            queueChatMessage: (msg: { text: string }) => {
                messages.push(msg.text);
            },
        },
        ...extras,
    } as unknown as ServerServices;

    const result = new InventoryActionHandler(services).executeInventoryUseOnAction(
        player,
        data,
        101,
    );
    assert.equal(result.ok, true);
    return { messages, queued };
}

{
    const { messages, queued } = runUseOn({
        slot: 0,
        itemId: 1927,
        target: { kind: "inv", slot: 1, itemId: 1931 },
    });
    assert.deepEqual(queued, ["item"]);
    assert.deepEqual(messages, [NOTHING_INTERESTING]);
}

{
    const { messages, queued } = runUseOn({
        slot: 0,
        itemId: 1927,
        target: { kind: "npc", id: npc.id },
    });
    assert.deepEqual(queued, ["npc"]);
    assert.deepEqual(messages, [NOTHING_INTERESTING]);
}

{
    const { messages, queued } = runUseOn({
        slot: 0,
        itemId: 1927,
        target: { kind: "loc", id: 1234, tile: { x: 101, y: 100 }, plane: 0 },
    });
    assert.deepEqual(queued, ["loc"]);
    assert.deepEqual(messages, [NOTHING_INTERESTING]);
}

{
    const { messages, queued } = runUseOn({
        slot: 0,
        itemId: 1927,
        target: { kind: "player", id: otherPlayer.id },
    });
    assert.deepEqual(queued, ["player"]);
    assert.deepEqual(messages, [NOTHING_INTERESTING]);
}

{
    const { messages, queued } = runUseOn({
        slot: 0,
        itemId: 1927,
        target: { kind: "obj", id: 995, tile: { x: 101, y: 100 }, plane: 0 },
    });
    assert.deepEqual(queued, []);
    assert.deepEqual(messages, [NOTHING_INTERESTING]);
}

{
    const messages: string[] = [];
    let queuedNpcId: number | undefined;
    const services = {
        inventoryService: {
            getInventory: () => [{ itemId: 1927, quantity: 1 }],
        },
        npcManager: {
            getById: (id: number) => (id === npc.id ? npc : undefined),
        },
        scriptRuntime: {
            queueItemOnNpc: (event: { target: NpcState }) => {
                queuedNpcId = event.target.id;
                return true;
            },
        },
        messagingService: {
            queueChatMessage: (msg: { text: string }) => {
                messages.push(msg.text);
            },
        },
    } as unknown as ServerServices;

    const result = new InventoryActionHandler(services).executeInventoryUseOnAction(
        player,
        { slot: 0, itemId: 1927, target: { kind: "npc", id: npc.id } },
        101,
    );
    assert.equal(result.ok, true);
    assert.equal(queuedNpcId, npc.id);
    assert.deepEqual(messages, [], "scripted item-on-npc must not send the default message");
}

console.log("item-on-target-default.test.ts: all assertions passed");
