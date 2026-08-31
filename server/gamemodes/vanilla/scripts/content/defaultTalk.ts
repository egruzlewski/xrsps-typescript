import { type IScriptRegistry, type ScriptServices } from "../../../../src/game/scripts/types";
import { sayNpc, sayPlayer } from "../../npcs/dialogue";
import { startNpcConversation } from "../../npcs/helpers";

/**
 * Catch-all Talk-to for NPCs that have no dedicated script.
 * Specific `registerNpcScript` / `registerTalkTo` handlers win because
 * ScriptRuntime looks up per-NPC handlers before `registerNpcAction`.
 */
export function registerDefaultTalkHandlers(
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registry.registerNpcAction("talk-to", (event) => {
        services.system.logger.info?.(
            `[script:default-talk] fallback dialog npc=${event.npc?.id} type=${event.npc?.typeId}`,
        );

        const started = startNpcConversation(event, [sayPlayer("Hello."), sayNpc("Hello.")]);
        if (!started) {
            event.services.messaging.sendGameMessage(event.player, "Nothing interesting happens.");
        }
    });
}
