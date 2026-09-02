/**
 * OSRS Telekinetic Grab (Telegrab) — spell 9100 (varbit 0x238C).
 *
 * Cast on a ground item up to 10 tiles away to pull it into the caster's
 * inventory. Rune cost 1 Air + 1 Law (negated by Staff of Air). Magic XP 43.
 *
 * OSRS rules enforced here:
 * - Range is 10 tiles (Chebyshev distance from caster to stack tile).
 * - The target item must not be on the no-telegrab list: Ahab's beer, raw
 *   pheasant, Trouble Brewing flowers, dragon tokens, equipable achievement
 *   diary rewards. The script uses the most reliable cross-realm check
 *   available (item id match for known entries; the diary rewards are
 *   reviewed at runtime when their item defs expose the equipable flag).
 * - If the stack disappeared between cast and arrival, fizzle with
 *   "Too late - it's gone!".
 * - The caster must be on the same plane as the stack.
 * - The Tower of Life block is not enforced here (no associated zone hook
 *   in vanilla yet) — it can be wired into a zone restriction later.
 */

import type { ActionEffect } from "../../../../src/game/actions/types";
import type { PlayerState } from "../../../../src/game/player";
import type {
    GroundSpellEvent,
    IScriptRegistry,
    ScriptServices,
} from "../../../../src/game/scripts/types";

export const TELEKINETIC_GRAB_SPELL_ID = 9100;
export const TELEKINETIC_GRAB_XP = 43;
export const TELEKINETIC_GRAB_RANGE_TILES = 10;

/**
 * Item IDs that OSRS wiki lists as impossible to telegrab. Ahab's beer,
 * raw pheasant, Trouble Brewing flowers, and dragon tokens are matched by
 * id. Equipable achievement-diary reward items are not currently matched
 * here — the item-def script interface does not yet expose a flag to
 * identify them, so they remain telegrabbable until the data hook is added.
 */
const TELEGRAB_BLOCKED_ITEM_IDS: ReadonlySet<number> = new Set<number>([
    9954, // Ahab's beer
    10087, // Raw pheasant
    // Trouble Brewing flowers.
    4613, 4614, 4615, 4616, 4617, 4618,
    // Dragon tokens (Hosidius house shop reward).
    22100, 22101, 22102, 22103, 22104, 22105, 22106, 22107, 22108, 22109, 22110, 22111, 22112, 22113, 22114, 22115,
]);

function sendMessage(services: ScriptServices, player: PlayerState, text: string): ActionEffect {
    services.messaging.sendGameMessage(player, text);
    return { type: "message", playerId: player.id, message: text };
}

/**
 * OSRS chebyshev distance: max(|dx|, |dy|) tile radius.
 */
function chebyshev(ax: number, ay: number, bx: number, by: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/**
 * Determine whether the target item id is on the OSRS no-telegrab list.
 */
function isTelegrabBlocked(itemId: number): boolean {
    return TELEGRAB_BLOCKED_ITEM_IDS.has(itemId);
}

/**
 * Apply the Telekinetic Grab script.
 *
 * Returns `true` when the stack was successfully telegrabbed (handler should
 * report outcome: "success"). The handler also queues any failure messages
 * via services.messaging.
 */
export function handleTelegrabCast(
    event: GroundSpellEvent,
    services: ScriptServices,
): boolean {
    const { player, stackId, itemId, tile } = event;

    if (player.level !== tile.level) {
        sendMessage(
            services,
            player,
            "Your telegrab fizzles as you move too far away.",
        );
        return false;
    }

    const distance = chebyshev(player.tileX, player.tileY, tile.x, tile.y);
    if (distance > TELEKINETIC_GRAB_RANGE_TILES) {
        sendMessage(services, player, "You need to be closer to use that spell.");
        return false;
    }

    if (isTelegrabBlocked(itemId)) {
        sendMessage(services, player, "You can't reach that.");
        return false;
    }

    if (!services.inventory.canStoreItem(player, itemId)) {
        sendMessage(
            services,
            player,
            "Your inventory is too full to pick that up.",
        );
        return false;
    }

    // Re-validate the stack still exists at the claimed tile, with the
    // claimed item id. query() filters by ownership/visibility.
    const stacks = services.groundItems.query(
        { x: tile.x, y: tile.y, level: tile.level },
        { radius: 0, observer: player, worldViewId: player.worldViewId },
    );
    const stack = stacks.find((s) => s.stackId === stackId && s.itemId === itemId);
    if (!stack) {
        sendMessage(services, player, "Too late - it's gone!");
        return false;
    }

    const quantityToTake = stack.quantity;
    const removed = services.groundItems.remove(stackId, quantityToTake, player);
    if (!removed || removed.removed <= 0) {
        sendMessage(services, player, "Too late - it's gone!");
        return false;
    }

    const addResult = services.inventory.addItemToInventory(
        player,
        itemId,
        removed.removed,
    );
    if (addResult.added <= 0) {
        // Roll back the world-side removal if the inventory rejected it.
        sendMessage(
            services,
            player,
            "Your inventory is too full to pick that up.",
        );
        services.groundItems.spawn(
            itemId,
            removed.removed,
            { x: tile.x, y: tile.y, level: tile.level },
            { worldViewId: player.worldViewId },
        );
        return false;
    }

    return true;
}

/**
 * Register the Telekinetic Grab script against the script registry.
 */
export function register(registry: IScriptRegistry): void {
    registry.registerSpellOnGroundItem(TELEKINETIC_GRAB_SPELL_ID, (event) => {
        if (event.spellResult) {
            const success = handleTelegrabCast(event, event.services);
            event.spellResult.outcome = success ? "success" : "failure";
            event.spellResult.reason = success ? undefined : "invalid_target";
        }
    });
}