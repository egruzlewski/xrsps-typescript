import assert from "node:assert/strict";

import { register as registerMagic } from "../gamemodes/vanilla/skills/magic";
import {
    TELEKINETIC_GRAB_RANGE_TILES,
    TELEKINETIC_GRAB_SPELL_ID,
    TELEKINETIC_GRAB_XP,
    handleTelegrabCast,
} from "../gamemodes/vanilla/skills/magic/telekineticGrab";
import type { IScriptRegistry, ScriptServices } from "../src/game/scripts/types";

type PlayerStub = {
    id: number;
    tileX: number;
    tileY: number;
    level: number;
    worldViewId: number;
};

type ScriptGroundItem = {
    stackId: number;
    itemId: number;
    quantity: number;
    tile: { x: number; y: number; level: number };
    worldViewId: number;
    ownerId?: number;
};

type GroundItemFacadeStub = {
    spawn: (
        itemId: number,
        quantity: number,
        tile: { x: number; y: number; level: number },
        options?: { worldViewId?: number },
    ) => ScriptGroundItem | undefined;
    remove: (
        stackId: number,
        quantity: number,
        requester?: PlayerStub,
    ) => { removed: number; remaining?: number } | undefined;
    query: (
        tile: { x: number; y: number; level: number },
        options?: { radius?: number; observer?: PlayerStub; worldViewId?: number },
    ) => ScriptGroundItem[];
};

type InventoryStub = {
    items: Array<{ itemId: number; quantity: number }>;
};

type InventoryFacadeStub = {
    canStoreItem: (player: PlayerStub, itemId: number) => boolean;
    addItemToInventory: (
        player: PlayerStub,
        itemId: number,
        qty: number,
    ) => { slot: number; added: number };
};

type SpellEventArgs = Parameters<ReturnType<GroundItemFacadeStub extends never ? never : GroundItemFacadeStub>>;

function makeHarness(initialInventory: InventoryStub["items"] = []) {
    const handlers = new Map<number, (event: unknown) => void>();
    const reg = {
        registerSpellOnGroundItem: (spellId: number, handler: (event: unknown) => void) => {
            handlers.set(spellId, handler);
            return { unregister() {} };
        },
    } as unknown as IScriptRegistry;

    const messages: string[] = [];
    const inventory: InventoryStub = {
        items:
            initialInventory.length > 0
                ? [...initialInventory]
                : Array.from({ length: 28 }, () => ({ itemId: -1, quantity: 0 })),
    };
    const stacks = new Map<number, ScriptGroundItem>();
    let nextStackId = 1;

    function spawnGroundItem(
        itemId: number,
        quantity: number,
        tile: { x: number; y: number; level: number },
        options?: { worldViewId?: number; ownerId?: number },
    ): ScriptGroundItem | undefined {
        if (itemId <= 0 || quantity <= 0) return undefined;
        const stack: ScriptGroundItem = {
            stackId: nextStackId++,
            itemId,
            quantity,
            tile,
            worldViewId: options?.worldViewId ?? -1,
        };
        if (options?.ownerId !== undefined) stack.ownerId = options.ownerId;
        stacks.set(stack.stackId, stack);
        return stack;
    }

    const groundItems: GroundItemFacadeStub = {
        spawn: (itemId, quantity, tile, options) =>
            spawnGroundItem(itemId, quantity, tile, options),
        remove: (stackId, quantity, requester) => {
            const stack = stacks.get(stackId);
            if (!stack) return undefined;
            if (
                stack.ownerId !== undefined &&
                stack.ownerId !== requester?.id &&
                stack.worldViewId !== -1 &&
                stack.worldViewId !== requester?.worldViewId
            ) {
                return undefined;
            }
            const take = Math.min(stack.quantity, Math.max(1, quantity));
            stack.quantity -= take;
            if (stack.quantity <= 0) stacks.delete(stackId);
            return { removed: take };
        },
        query: (tile, options) => {
            const radius = options?.radius ?? 0;
            const out: ScriptGroundItem[] = [];
            for (const stack of stacks.values()) {
                if (
                    Math.max(Math.abs(stack.tile.x - tile.x), Math.abs(stack.tile.y - tile.y)) >
                    radius
                ) {
                    continue;
                }
                if (stack.worldViewId !== -1 && options?.worldViewId !== undefined) {
                    if (stack.worldViewId !== options.worldViewId) continue;
                }
                if (
                    stack.ownerId !== undefined &&
                    options?.observer &&
                    stack.ownerId !== options.observer.id
                ) {
                    continue;
                }
                out.push(stack);
            }
            return out;
        },
    };

    const inventoryFacade: InventoryFacadeStub = {
        canStoreItem: (player, itemId) => {
            // Mimics OSRS: at least one free slot OR an existing stack of the
            // same item id with quantity below MAX_SAFE_INTEGER.
            const hasEmpty = inventory.items.some(
                (entry) => entry.itemId <= 0 || entry.quantity <= 0,
            );
            if (hasEmpty) return true;
            return inventory.items.some((entry) => entry.itemId === itemId && entry.quantity > 0);
        },
        addItemToInventory: (player, itemId, qty) => {
            // Stackable: find an existing stack.
            for (const entry of inventory.items) {
                if (entry.itemId === itemId && entry.quantity > 0) {
                    entry.quantity += qty;
                    return { slot: -1, added: qty };
                }
            }
            // Otherwise occupy the first empty slot.
            for (let i = 0; i < inventory.items.length; i++) {
                const entry = inventory.items[i];
                if (entry.itemId <= 0 || entry.quantity <= 0) {
                    entry.itemId = itemId;
                    entry.quantity = qty;
                    return { slot: i, added: qty };
                }
            }
            return { slot: -1, added: 0 };
        },
    };

    const services = {
        messaging: {
            sendGameMessage: (player: PlayerStub, text: string) => {
                messages.push(`[${player.id}] ${text}`);
            },
            queueNotification: () => undefined,
        },
        inventory: inventoryFacade,
        groundItems,
    } as unknown as ScriptServices;

    return { reg, services, messages, stacks, inventory };
}

// ----------------------------------------------------------------------------
// Test cases
// ----------------------------------------------------------------------------

// 1) Static: spell id and constants.
assert.equal(TELEKINETIC_GRAB_SPELL_ID, 9100);
assert.equal(TELEKINETIC_GRAB_XP, 43);
assert.equal(TELEKINETIC_GRAB_RANGE_TILES, 10);

// 2) Successful pickup: stack within range, no skip-list, free inventory.
{
    const h = makeHarness();
    const player: PlayerStub = {
        id: 7,
        tileX: 3200,
        tileY: 3200,
        level: 0,
        worldViewId: -1,
    };
    const stack = h.stacks; // alias for clarity
    // Pre-populate a stack via the harness's internal spawn:
    const item = h.services.groundItems.spawn(
        995, // coins
        5,
        { x: 3205, y: 3200, level: 0 },
    );
    assert.ok(item);
    const result = handleTelegrabCast(
        {
            player,
            spellId: TELEKINETIC_GRAB_SPELL_ID,
            stackId: item.stackId,
            itemId: item.itemId,
            tile: item.tile,
            tick: 0,
            services: h.services,
            spellResult: { outcome: "failure", reason: "invalid_target" },
        },
        h.services,
    );
    assert.equal(result, true);
    assert.equal(stack.size, 0, "stack should be removed from the world");
    // The default inventory stub starts empty (28 slots) — coins should be
    // present in slot 0.
    assert.equal(h.inventory.items[0].itemId, 995);
    assert.equal(h.inventory.items[0].quantity, 5);
}

// 3) Skip-list: Ahab's beer (9954) is rejected even when within range.
{
    const h = makeHarness();
    const player: PlayerStub = {
        id: 9,
        tileX: 3200,
        tileY: 3200,
        level: 0,
        worldViewId: -1,
    };
    const stack = h.services.groundItems.spawn(9954, 1, { x: 3202, y: 3202, level: 0 });
    const result = handleTelegrabCast(
        {
            player,
            spellId: TELEKINETIC_GRAB_SPELL_ID,
            stackId: stack!.stackId,
            itemId: 9954,
            tile: stack!.tile,
            tick: 0,
            services: h.services,
            spellResult: { outcome: "failure", reason: "invalid_target" },
        },
        h.services,
    );
    assert.equal(result, false);
    assert.equal(h.stacks.size, 1, "stack should remain in the world");
    assert.ok(
        h.messages.some((m) => m.includes("You can't reach that")),
        "expected 'You can't reach that' message",
    );
}

// 4) Skip-list: Trouble Brewing flower (4613) is rejected.
{
    const h = makeHarness();
    const player: PlayerStub = { id: 10, tileX: 3200, tileY: 3200, level: 0, worldViewId: -1 };
    const stack = h.services.groundItems.spawn(4613, 1, { x: 3201, y: 3200, level: 0 });
    const result = handleTelegrabCast(
        {
            player,
            spellId: TELEKINETIC_GRAB_SPELL_ID,
            stackId: stack!.stackId,
            itemId: 4613,
            tile: stack!.tile,
            tick: 0,
            services: h.services,
            spellResult: { outcome: "failure", reason: "invalid_target" },
        },
        h.services,
    );
    assert.equal(result, false);
}

// 5) Skip-list: dragon tokens (22100) are rejected.
{
    const h = makeHarness();
    const player: PlayerStub = { id: 11, tileX: 3200, tileY: 3200, level: 0, worldViewId: -1 };
    const stack = h.services.groundItems.spawn(22100, 1, { x: 3201, y: 3200, level: 0 });
    const result = handleTelegrabCast(
        {
            player,
            spellId: TELEKINETIC_GRAB_SPELL_ID,
            stackId: stack!.stackId,
            itemId: 22100,
            tile: stack!.tile,
            tick: 0,
            services: h.services,
            spellResult: { outcome: "failure", reason: "invalid_target" },
        },
        h.services,
    );
    assert.equal(result, false);
}

// 6) Out-of-range: stack is at Chebyshev distance > 10.
{
    const h = makeHarness();
    const player: PlayerStub = { id: 12, tileX: 3200, tileY: 3200, level: 0, worldViewId: -1 };
    const stack = h.services.groundItems.spawn(995, 1, { x: 3220, y: 3220, level: 0 });
    const result = handleTelegrabCast(
        {
            player,
            spellId: TELEKINETIC_GRAB_SPELL_ID,
            stackId: stack!.stackId,
            itemId: 995,
            tile: stack!.tile,
            tick: 0,
            services: h.services,
            spellResult: { outcome: "failure", reason: "invalid_target" },
        },
        h.services,
    );
    assert.equal(result, false);
    assert.equal(h.stacks.size, 1, "out-of-range stack stays in the world");
    assert.ok(
        h.messages.some((m) => m.includes("be closer")),
        "expected distance-related message",
    );
}

// 7) Fizzle on plane change: caster on plane 0, stack on plane 1.
{
    const h = makeHarness();
    const player: PlayerStub = { id: 13, tileX: 3200, tileY: 3200, level: 0, worldViewId: -1 };
    const stack = h.services.groundItems.spawn(995, 1, { x: 3201, y: 3200, level: 1 });
    const result = handleTelegrabCast(
        {
            player,
            spellId: TELEKINETIC_GRAB_SPELL_ID,
            stackId: stack!.stackId,
            itemId: 995,
            tile: stack!.tile,
            tick: 0,
            services: h.services,
            spellResult: { outcome: "failure", reason: "invalid_target" },
        },
        h.services,
    );
    assert.equal(result, false);
    assert.ok(
        h.messages.some((m) => m.includes("fizzles")),
        "expected fizzle message",
    );
}

// 8) Fizzle when stack disappears between cast and arrival.
{
    const h = makeHarness();
    const player: PlayerStub = { id: 14, tileX: 3200, tileY: 3200, level: 0, worldViewId: -1 };
    // No stack exists, but the player is targeting one.
    const result = handleTelegrabCast(
        {
            player,
            spellId: TELEKINETIC_GRAB_SPELL_ID,
            stackId: 99,
            itemId: 995,
            tile: { x: 3202, y: 3200, level: 0 },
            tick: 0,
            services: h.services,
            spellResult: { outcome: "failure", reason: "invalid_target" },
        },
        h.services,
    );
    assert.equal(result, false);
    assert.ok(
        h.messages.some((m) => m.includes("Too late")),
        "expected 'Too late' message",
    );
}

// 9) Boundary case: exactly at 10-tile range succeeds.
{
    const h = makeHarness();
    const player: PlayerStub = { id: 15, tileX: 3200, tileY: 3200, level: 0, worldViewId: -1 };
    const stack = h.services.groundItems.spawn(995, 3, { x: 3210, y: 3200, level: 0 });
    const result = handleTelegrabCast(
        {
            player,
            spellId: TELEKINETIC_GRAB_SPELL_ID,
            stackId: stack!.stackId,
            itemId: 995,
            tile: stack!.tile,
            tick: 0,
            services: h.services,
            spellResult: { outcome: "failure", reason: "invalid_target" },
        },
        h.services,
    );
    assert.equal(result, true);
    assert.equal(h.stacks.size, 0);
}

// 10) Inventory full: spawn an item into a full inventory; telegrab should
// roll back the world removal and report failure.
{
    const full = Array.from({ length: 28 }, (_, i) => ({
        itemId: 1000 + i, // unique items, no stacking
        quantity: 1,
    }));
    const h = makeHarness(full);
    const player: PlayerStub = { id: 16, tileX: 3200, tileY: 3200, level: 0, worldViewId: -1 };
    const stack = h.services.groundItems.spawn(995, 1, { x: 3201, y: 3200, level: 0 });
    const result = handleTelegrabCast(
        {
            player,
            spellId: TELEKINETIC_GRAB_SPELL_ID,
            stackId: stack!.stackId,
            itemId: 995,
            tile: stack!.tile,
            tick: 0,
            services: h.services,
            spellResult: { outcome: "failure", reason: "invalid_target" },
        },
        h.services,
    );
    assert.equal(result, false);
    assert.equal(h.stacks.size, 1, "stack should remain in the world when inventory is full");
    assert.ok(
        h.messages.some((m) => m.includes("inventory is too full")),
        "expected inventory-full message",
    );
}

// 11) Registration hooks through the magic skills register().
{
    const handlers = new Map<number, (event: unknown) => void>();
    const reg = {
        registerSpellOnGroundItem: (spellId: number, handler: (event: unknown) => void) => {
            handlers.set(spellId, handler);
            return { unregister() {} };
        },
        registerLocInteraction: () => ({ unregister() {} }),
        registerLocAction: () => ({ unregister() {} }),
        registerLocScript: () => ({ unregister() {} }),
        registerSpellOnItem: () => ({ unregister() {} }),
        registerActionHandler: () => ({ unregister() {} }),
        registerWidgetAction: () => ({ unregister() {} }),
    } as unknown as IScriptRegistry;
    const services = {
        messaging: { sendGameMessage: () => undefined, queueNotification: () => undefined },
        inventory: { canStoreItem: () => true, addItemToInventory: () => ({ slot: 0, added: 1 }) },
        groundItems: {
            spawn: () => ({ stackId: 1, itemId: 1, quantity: 1, tile: { x: 0, y: 0, level: 0 }, worldViewId: -1 }),
            remove: () => ({ removed: 1 }),
            query: () => [],
        },
    } as unknown as ScriptServices;
    registerMagic(reg, services);
    assert.ok(handlers.has(TELEKINETIC_GRAB_SPELL_ID), "Telekinetic Grab should register");
}