import assert from "node:assert/strict";
import type { WebSocket } from "ws";

import {
    LocInteractionHandler,
    type LocInteractionSystemBridge,
} from "../src/game/interactions/LocInteractionHandler";
import type { PlayerRepository } from "../src/game/interactions/PlayerInteractionSystem";
import type { PendingLocInteraction } from "../src/game/interactions/types";
import type { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import type { ScriptServices } from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";
import type { PathService } from "../src/pathfinding/PathService";
import type { DoorStateManager } from "../src/world/DoorStateManager";

const NOTHING_INTERESTING = "Nothing interesting happens.";

const locInfo: PendingLocInteraction = {
    id: 1234,
    tile: { x: 3222, y: 3222 },
    action: "search",
};

function createPlayer(): PlayerState {
    return {
        id: 7,
        tileX: 3221,
        tileY: 3222,
        clearPath: () => undefined,
        clearWalkDestination: () => undefined,
        faceTile: () => undefined,
    } as unknown as PlayerState;
}

function createHandler(opts: {
    runtime?: ScriptRuntime;
    queueLoc?: () => boolean;
    runLocNow?: () => boolean;
    toggleDoor?: DoorStateManager["toggleDoor"];
}): {
    handler: LocInteractionHandler;
    player: PlayerState;
    messages: string[];
    locChanges: number[];
} {
    const player = createPlayer();
    const messages: string[] = [];
    const locChanges: number[] = [];
    const scriptRuntime =
        opts.runtime ??
        ({
            queueLocInteraction: opts.queueLoc ?? (() => false),
            runLocInteractionNow: opts.runLocNow ?? (() => false),
        } as unknown as ScriptRuntime);
    const handler = new LocInteractionHandler(
        { get: () => player } as unknown as PlayerRepository,
        {} as PathService,
        undefined,
        opts.toggleDoor
            ? ({
                  toggleDoor: opts.toggleDoor,
                  isDoorAction: () => false,
              } as unknown as DoorStateManager)
            : undefined,
        scriptRuntime,
        new Map<WebSocket, PendingLocInteraction>(),
        {
            onGameMessage: (_player, text) => {
                messages.push(text);
            },
            onLocChange: (oldId) => {
                locChanges.push(oldId);
            },
        },
        {} as LocInteractionSystemBridge,
    );
    return { handler, player, messages, locChanges };
}

function runClick(
    handler: LocInteractionHandler,
    player: PlayerState,
    info: PendingLocInteraction = locInfo,
    tick = 40,
    immediate = false,
): boolean {
    return handler.executeLocInteraction(player, info, 0, info.tile, 1, 1, tick, immediate);
}

{
    const { handler, player, messages } = createHandler({});
    assert.equal(runClick(handler, player), true);
    assert.deepEqual(messages, [NOTHING_INTERESTING]);
}

{
    const { handler, player, messages } = createHandler({
        runLocNow: () => false,
    });
    assert.equal(runClick(handler, player, locInfo, 40, true), true);
    assert.deepEqual(messages, [NOTHING_INTERESTING]);
}

{
    let queuedLocId: number | undefined;
    const { handler, player, messages } = createHandler({
        queueLoc: () => {
            queuedLocId = locInfo.id;
            return true;
        },
    });
    assert.equal(runClick(handler, player), true);
    assert.equal(queuedLocId, locInfo.id);
    assert.deepEqual(messages, [], "scripted loc click must not send the default message");
}

{
    const { handler, player, messages, locChanges } = createHandler({
        toggleDoor: () => ({
            success: true,
            newLocId: 5678,
            soundId: 60,
        }),
    });
    assert.equal(runClick(handler, player), true);
    assert.deepEqual(locChanges, [locInfo.id]);
    assert.deepEqual(messages, [], "successful door toggle must not send the default message");
}

{
    const registry = new ScriptRegistry();
    const scheduler = new ScriptScheduler();
    const runtime = new ScriptRuntime({
        registry,
        scheduler,
        services: {} as ScriptServices,
        logger: {
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            debug: () => undefined,
        },
    });
    const { handler, player, messages } = createHandler({ runtime });

    const crate: PendingLocInteraction = {
        id: 999001,
        tile: locInfo.tile,
        action: "search",
    };
    assert.equal(runClick(handler, player, crate, 10), true);
    assert.deepEqual(messages, [NOTHING_INTERESTING]);

    let specificCalls = 0;
    runtime.registerHandlers("specific-crate", (scripts) => {
        scripts.registerLocScript({
            locId: crate.id,
            action: "search",
            handler: () => {
                specificCalls += 1;
            },
        });
    });

    messages.length = 0;
    assert.equal(runClick(handler, player, { ...crate, action: "Search" }, 11), true);
    scheduler.process(11);
    assert.equal(specificCalls, 1);
    assert.deepEqual(messages, [], "per-loc Search must shadow the unscripted default");

    let actionCalls = 0;
    runtime.registerHandlers("generic-open", (scripts) => {
        scripts.registerLocAction("open", () => {
            actionCalls += 1;
        });
    });
    messages.length = 0;
    assert.equal(
        runClick(handler, player, { id: 999002, tile: locInfo.tile, action: "Open" }, 12),
        true,
    );
    scheduler.process(12);
    assert.equal(actionCalls, 1, "registerLocAction must still win for matching options");
    assert.deepEqual(messages, [], "loc-action handlers must not send the default message");
}

console.log("default-loc-click.test.ts: all assertions passed");
