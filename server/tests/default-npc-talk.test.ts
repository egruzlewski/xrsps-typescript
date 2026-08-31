import assert from "node:assert/strict";

import { registerDefaultTalkHandlers } from "../gamemodes/vanilla/scripts/content/defaultTalk";
import type { NpcState } from "../src/game/npc";
import type { PlayerState } from "../src/game/player";
import { ScriptRegistry } from "../src/game/scripts/ScriptRegistry";
import { ScriptRuntime } from "../src/game/scripts/ScriptRuntime";
import type { ScriptDialogRequest, ScriptServices } from "../src/game/scripts/types";
import { ScriptScheduler } from "../src/game/systems/ScriptScheduler";

const dialogs: ScriptDialogRequest[] = [];
const messages: string[] = [];

const services = {
    system: {
        logger: {
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            debug: () => undefined,
        },
    },
    dialog: {
        openDialog: (_player: PlayerState, request: ScriptDialogRequest) => {
            dialogs.push(request);
            request.onContinue?.();
        },
        closeDialog: () => undefined,
        getInterfaceService: () => undefined,
    },
    messaging: {
        sendGameMessage: (_player: PlayerState, text: string) => {
            messages.push(text);
        },
    },
} as unknown as ScriptServices;

const registry = new ScriptRegistry();
const scheduler = new ScriptScheduler();
const runtime = new ScriptRuntime({
    registry,
    scheduler,
    services,
    logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
    },
});

registerDefaultTalkHandlers(registry, services);

const unscriptedNpc = {
    id: 7,
    typeId: 9001,
    name: "Guard",
} as NpcState;
const player = { id: 1, name: "Player" } as PlayerState;

assert.equal(
    runtime.queueNpcInteraction({
        tick: 10,
        player,
        npc: unscriptedNpc,
        option: "talk-to",
    }),
    true,
);
scheduler.process(10);

assert.equal(dialogs.length, 2);
assert.equal(dialogs[0]?.kind, "player");
assert.deepEqual(dialogs[0]?.lines, ["Hello."]);
assert.equal(dialogs[1]?.kind, "npc");
assert.equal(dialogs[1]?.npcId, 9001);
assert.equal(dialogs[1]?.npcName, "Guard");
assert.deepEqual(dialogs[1]?.lines, ["Hello."]);
assert.equal(
    dialogs.some((dialog) =>
        (Array.isArray(dialog.lines) ? dialog.lines : [dialog.lines]).includes(
            "Content not implemented yet.",
        ),
    ),
    false,
);
assert.deepEqual(messages, []);

let specificCalls = 0;
runtime.registerHandlers("specific-guard", (scripts) => {
    scripts.registerNpcScript({
        npcId: 9001,
        option: "talk-to",
        handler: () => {
            specificCalls += 1;
        },
    });
});

dialogs.length = 0;
assert.equal(
    runtime.queueNpcInteraction({
        tick: 11,
        player,
        npc: unscriptedNpc,
        option: "Talk-to",
    }),
    true,
);
scheduler.process(11);
assert.equal(specificCalls, 1);
assert.equal(dialogs.length, 0, "per-NPC Talk-to must shadow the default action");

console.log("default-npc-talk.test.ts: all assertions passed");
