/**
 * Essence pouches: fill / empty / check with rune or pure essence.
 * Capacity and Runecraft level gates match OSRS wiki. Contents and a
 * single degrade step live in player.equipment charges (same persistence
 * as the binding necklace). OSRS degrades on fill, not empty.
 *
 * Skipped: further decay-to-dust, RC-cape / max-cape fill immunity,
 * daeyalt / guardian essence, colossal stitching (abyssal needle).
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../src/game/scripts/types";
import { PURE_ESSENCE, RUNE_ESSENCE } from "./altars";

export const SMALL_POUCH = 5509;
export const MEDIUM_POUCH = 5510;
export const MEDIUM_POUCH_DEGRADED = 5511;
export const LARGE_POUCH = 5512;
export const LARGE_POUCH_DEGRADED = 5513;
export const GIANT_POUCH = 5514;
export const GIANT_POUCH_DEGRADED = 5515;
/** Cache / OSRS ids (26784 healthy, 26786 degraded). */
export const COLOSSAL_POUCH = 26784;
export const COLOSSAL_POUCH_DEGRADED = 26786;

/** Inner-ring Dark Mage at 3039,4834 (npc-spawns.json). Talk-to / Repairs. */
export const DARK_MAGE_NPC_ID = 2583;

const COUNT_MASK = 0x3f;
const TYPE_SHIFT = 6;
const TYPE_MASK = 0x3;
const DEGRADED_BIT = 1 << 8;
const USES_SHIFT = 9;

export const ESSENCE_TYPE_NONE = 0;
export const ESSENCE_TYPE_RUNE = 1;
export const ESSENCE_TYPE_PURE = 2;

export interface EssencePouchDef {
    id: string;
    name: string;
    itemId: number;
    degradedItemId?: number;
    level: number;
    capacity: number;
    degradedCapacity?: number;
    /** Full fills until the first degrade. Omitted = never degrades. */
    usesUntilDegrade?: number;
    /** Capacity and uses scale with Runecraft level (colossal). */
    scaled?: boolean;
}

export interface PouchChargeState {
    count: number;
    essenceType: number;
    usesRemaining: number;
    degraded: boolean;
}

export const ESSENCE_POUCHES: readonly EssencePouchDef[] = [
    {
        id: "small",
        name: "small",
        itemId: SMALL_POUCH,
        level: 1,
        capacity: 3,
    },
    {
        id: "medium",
        name: "medium",
        itemId: MEDIUM_POUCH,
        degradedItemId: MEDIUM_POUCH_DEGRADED,
        level: 25,
        capacity: 6,
        degradedCapacity: 3,
        usesUntilDegrade: 45,
    },
    {
        id: "large",
        name: "large",
        itemId: LARGE_POUCH,
        degradedItemId: LARGE_POUCH_DEGRADED,
        level: 50,
        capacity: 9,
        degradedCapacity: 7,
        usesUntilDegrade: 29,
    },
    {
        id: "giant",
        name: "giant",
        itemId: GIANT_POUCH,
        degradedItemId: GIANT_POUCH_DEGRADED,
        level: 75,
        capacity: 12,
        degradedCapacity: 9,
        usesUntilDegrade: 11,
    },
    {
        id: "colossal",
        name: "colossal",
        itemId: COLOSSAL_POUCH,
        degradedItemId: COLOSSAL_POUCH_DEGRADED,
        level: 25,
        capacity: 40,
        degradedCapacity: 35,
        usesUntilDegrade: 8,
        scaled: true,
    },
];

const pouchByItemId = new Map<number, EssencePouchDef>();
for (const def of ESSENCE_POUCHES) {
    pouchByItemId.set(def.itemId, def);
    if (def.degradedItemId != null) pouchByItemId.set(def.degradedItemId, def);
}

export function pouchDefForItem(itemId: number): EssencePouchDef | undefined {
    return pouchByItemId.get(itemId);
}

export function colossalCapacityForLevel(level: number): number {
    if (level >= 85) return 40;
    if (level >= 75) return 27;
    if (level >= 50) return 16;
    return 8;
}

export function colossalUsesForLevel(level: number): number {
    if (level >= 85) return 8;
    if (level >= 75) return 11;
    if (level >= 50) return 20;
    return 40;
}

export function pouchMaxUses(def: EssencePouchDef, level: number): number {
    if (def.usesUntilDegrade == null) return 0;
    if (def.scaled) return colossalUsesForLevel(level);
    return def.usesUntilDegrade;
}

export function pouchCapacity(def: EssencePouchDef, level: number, degraded: boolean): number {
    const healthy = def.scaled ? colossalCapacityForLevel(level) : def.capacity;
    if (!degraded) return healthy;
    if (def.scaled) return Math.max(1, healthy - 5);
    return def.degradedCapacity ?? healthy;
}

export function packPouchCharges(state: PouchChargeState): number {
    const count = Math.max(0, Math.min(COUNT_MASK, state.count | 0));
    const type = (state.essenceType | 0) & TYPE_MASK;
    const uses = Math.max(0, state.usesRemaining | 0);
    const degraded = state.degraded ? DEGRADED_BIT : 0;
    return (uses << USES_SHIFT) | degraded | (type << TYPE_SHIFT) | count;
}

export function unpackPouchCharges(packed: number, maxUses: number): PouchChargeState {
    if (!Number.isFinite(packed) || packed <= 0) {
        return {
            count: 0,
            essenceType: ESSENCE_TYPE_NONE,
            usesRemaining: maxUses,
            degraded: false,
        };
    }
    return {
        count: packed & COUNT_MASK,
        essenceType: (packed >> TYPE_SHIFT) & TYPE_MASK,
        usesRemaining: packed >> USES_SHIFT,
        degraded: (packed & DEGRADED_BIT) !== 0,
    };
}

export function readPouchState(
    player: PlayerState,
    def: EssencePouchDef,
    level: number,
): PouchChargeState {
    return unpackPouchCharges(player.equipment.getCharges(def.itemId), pouchMaxUses(def, level));
}

export function writePouchState(
    player: PlayerState,
    def: EssencePouchDef,
    level: number,
    state: PouchChargeState,
): void {
    const maxUses = pouchMaxUses(def, level);
    const isDefault =
        state.count <= 0 &&
        !state.degraded &&
        (maxUses <= 0 || state.usesRemaining >= maxUses);
    player.equipment.setCharges(def.itemId, isDefault ? 0 : packPouchCharges(state));
}

function rcLevel(player: PlayerState, services: ScriptServices): number {
    return services.skills.getSkill(player, SkillId.Runecraft)?.baseLevel ?? 1;
}

function essenceIdForType(type: number): number {
    return type === ESSENCE_TYPE_PURE ? PURE_ESSENCE : RUNE_ESSENCE;
}

function chooseFillType(player: PlayerState, currentType: number): number {
    if (currentType === ESSENCE_TYPE_RUNE || currentType === ESSENCE_TYPE_PURE) {
        const wanted = essenceIdForType(currentType);
        if (player.items.getItemCount(wanted) > 0) return currentType;
        const other = currentType === ESSENCE_TYPE_RUNE ? ESSENCE_TYPE_PURE : ESSENCE_TYPE_RUNE;
        if (player.items.getItemCount(essenceIdForType(other)) > 0) return other;
        return ESSENCE_TYPE_NONE;
    }
    if (player.items.getItemCount(RUNE_ESSENCE) > 0) return ESSENCE_TYPE_RUNE;
    if (player.items.getItemCount(PURE_ESSENCE) > 0) return ESSENCE_TYPE_PURE;
    return ESSENCE_TYPE_NONE;
}

function swapPouchItem(
    player: PlayerState,
    services: ScriptServices,
    slot: number,
    nextItemId: number,
): void {
    services.inventory.setInventorySlot(player, slot, nextItemId, 1);
}

function restoreDegradedInventory(player: PlayerState, services: ScriptServices): void {
    const items = services.inventory.getInventoryItems?.(player);
    if (!Array.isArray(items)) return;
    for (const entry of items) {
        if (entry.quantity <= 0) continue;
        const def = pouchDefForItem(entry.itemId);
        if (!def || def.degradedItemId == null) continue;
        if (entry.itemId === def.degradedItemId) {
            swapPouchItem(player, services, entry.slot, def.itemId);
        }
    }
}

export function pouchesNeedingRepair(player: PlayerState, level: number): EssencePouchDef[] {
    const needing: EssencePouchDef[] = [];
    for (const def of ESSENCE_POUCHES) {
        if (def.usesUntilDegrade == null) continue;
        const state = readPouchState(player, def, level);
        const maxUses = pouchMaxUses(def, level);
        if (state.degraded || (maxUses > 0 && state.usesRemaining < maxUses)) {
            needing.push(def);
        }
    }
    return needing;
}

export function repairEssencePouches(player: PlayerState, level: number): number {
    const needing = pouchesNeedingRepair(player, level);
    for (const def of needing) {
        const state = readPouchState(player, def, level);
        writePouchState(player, def, level, {
            count: state.count,
            essenceType: state.count > 0 ? state.essenceType : ESSENCE_TYPE_NONE,
            usesRemaining: pouchMaxUses(def, level),
            degraded: false,
        });
    }
    return needing.length;
}

function fillPouch(
    def: EssencePouchDef,
    pouchItemId: number,
    slot: number,
    player: PlayerState,
    services: ScriptServices,
): void {
    const level = rcLevel(player, services);
    if (level < def.level) {
        services.messaging.sendGameMessage(
            player,
            `You need a Runecrafting level of at least ${def.level} to use this pouch.`,
        );
        return;
    }

    const state = readPouchState(player, def, level);
    const degraded = state.degraded || pouchItemId === def.degradedItemId;
    const capacity = pouchCapacity(def, level, degraded);
    if (state.count >= capacity) {
        services.messaging.sendGameMessage(player, "The pouch is already full.");
        return;
    }

    const fillType = chooseFillType(player, state.essenceType);
    if (fillType === ESSENCE_TYPE_NONE) {
        services.messaging.sendGameMessage(player, "You do not have any essence to fill the pouch.");
        return;
    }
    if (
        state.count > 0 &&
        state.essenceType !== ESSENCE_TYPE_NONE &&
        state.essenceType !== fillType
    ) {
        services.messaging.sendGameMessage(
            player,
            "You cannot add a different type of essence to this pouch.",
        );
        return;
    }

    const essenceId = essenceIdForType(fillType);
    const available = player.items.getItemCount(essenceId);
    const toAdd = Math.min(capacity - state.count, available);
    if (toAdd <= 0) {
        services.messaging.sendGameMessage(player, "You do not have any essence to fill the pouch.");
        return;
    }

    player.items.removeItem(essenceId, toAdd, { assureFullRemoval: true });
    state.count += toAdd;
    state.essenceType = fillType;
    state.degraded = degraded;

    const maxUses = pouchMaxUses(def, level);
    let decayed = false;
    if (maxUses > 0 && !state.degraded) {
        state.usesRemaining = Math.max(0, state.usesRemaining - 1);
        if (state.usesRemaining <= 0) {
            state.degraded = true;
            decayed = true;
            const nextCap = pouchCapacity(def, level, true);
            if (state.count > nextCap) state.count = nextCap;
            if (def.degradedItemId != null && slot >= 0) {
                swapPouchItem(player, services, slot, def.degradedItemId);
            }
        }
    }

    writePouchState(player, def, level, state);
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(player, "You fill the pouch with essence.");
    if (decayed) {
        services.messaging.sendGameMessage(player, "Your pouch has decayed through use.");
    }
}

function emptyPouch(
    def: EssencePouchDef,
    player: PlayerState,
    services: ScriptServices,
): void {
    const level = rcLevel(player, services);
    if (level < def.level) {
        services.messaging.sendGameMessage(
            player,
            `You need a Runecrafting level of at least ${def.level} to use this pouch.`,
        );
        return;
    }

    const state = readPouchState(player, def, level);
    if (state.count <= 0 || state.essenceType === ESSENCE_TYPE_NONE) {
        services.messaging.sendGameMessage(player, "There is no essence in this pouch.");
        return;
    }

    const free = player.items.getFreeSlotCount();
    if (free < state.count) {
        services.messaging.sendGameMessage(
            player,
            "You do not have enough space in your inventory to empty the pouch.",
        );
        return;
    }

    const essenceId = essenceIdForType(state.essenceType);
    const added = player.items.addItem(essenceId, state.count, { assureFullInsertion: true });
    if (added.completed < state.count) {
        services.messaging.sendGameMessage(
            player,
            "You do not have enough space in your inventory to empty the pouch.",
        );
        return;
    }

    state.count = 0;
    state.essenceType = ESSENCE_TYPE_NONE;
    writePouchState(player, def, level, state);
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(player, "You empty the pouch.");
}

function checkPouch(def: EssencePouchDef, player: PlayerState, services: ScriptServices): void {
    const level = rcLevel(player, services);
    const state = readPouchState(player, def, level);
    if (state.count <= 0) {
        services.messaging.sendGameMessage(player, "There is no essence in this pouch.");
        return;
    }
    const verb = state.count === 1 ? "is" : "are";
    const noun = state.count === 1 ? "essence" : "essences";
    services.messaging.sendGameMessage(
        player,
        `There ${verb} ${state.count} ${noun} in this pouch.`,
    );
}

function onDarkMage(event: NpcInteractionEvent): void {
    const { player, services } = event;
    const level = rcLevel(player, services);
    const repaired = repairEssencePouches(player, level);
    if (repaired <= 0) {
        services.messaging.sendGameMessage(
            player,
            "You don't seem to have any pouches in need of repair. Leave me alone!",
        );
        return;
    }
    restoreDegradedInventory(player, services);
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(
        player,
        "There, I have repaired your pouches. Now leave me alone. I'm concentrating!",
    );
}

export function registerPouches(registry: IScriptRegistry): void {
    for (const def of ESSENCE_POUCHES) {
        const ids = def.degradedItemId != null ? [def.itemId, def.degradedItemId] : [def.itemId];
        for (const itemId of ids) {
            registry.registerItemAction(
                itemId,
                (event) =>
                    fillPouch(
                        def,
                        event.source.itemId,
                        event.source.slot,
                        event.player,
                        event.services,
                    ),
                "fill",
            );
            registry.registerItemAction(
                itemId,
                (event) => emptyPouch(def, event.player, event.services),
                "empty",
            );
            registry.registerItemAction(
                itemId,
                (event) => checkPouch(def, event.player, event.services),
                "check",
            );
            const useEssence = (event: ItemOnItemEvent) => {
                const pouch =
                    pouchDefForItem(event.source.itemId) === def ? event.source : event.target;
                fillPouch(def, pouch.itemId, pouch.slot, event.player, event.services);
            };
            registry.registerItemOnItem(RUNE_ESSENCE, itemId, useEssence);
            registry.registerItemOnItem(PURE_ESSENCE, itemId, useEssence);
        }
    }

    registry.registerNpcInteraction(DARK_MAGE_NPC_ID, onDarkMage, "repairs");
    registry.registerNpcInteraction(DARK_MAGE_NPC_ID, onDarkMage, "talk-to");
}
