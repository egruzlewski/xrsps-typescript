/**
 * Combination runes (Mist–Lava). Craft by using the opposing talisman or
 * opposing elemental runes on the matching altar with pure essence.
 * XP is higher at the higher-levelled of the two altars (OSRS wiki).
 * Bind chance is 50% per essence unless a binding necklace is worn.
 */
import { EquipmentSlot } from "../../../../../client/rs/config/player/Equipment";
import { ALL_ALTARS, type RuneAltarDef } from "./altars";

/** Enchanted emerald necklace. Worn, 16 charges, one per combination craft. */
export const BINDING_NECKLACE_ID = 5521;
export const BINDING_NECKLACE_CHARGES = 16;
export const COMBINATION_BIND_SUCCESS_CHANCE = 0.5;

export interface CombinationRuneDef {
    id: string;
    name: string;
    level: number;
    runeId: number;
    /** Lower-XP altar first, higher-XP altar second. */
    altarIds: readonly [string, string];
    xpPerEssence: readonly [number, number];
}

export interface CombinationBinding {
    def: CombinationRuneDef;
    altar: RuneAltarDef;
    opposing: RuneAltarDef;
    xpPerEssence: number;
}

export const COMBINATION_RUNES: readonly CombinationRuneDef[] = [
    {
        id: "mist",
        name: "Mist",
        level: 6,
        runeId: 4695,
        altarIds: ["air", "water"],
        xpPerEssence: [8, 8.5],
    },
    {
        id: "dust",
        name: "Dust",
        level: 10,
        runeId: 4696,
        altarIds: ["air", "earth"],
        xpPerEssence: [8.3, 9],
    },
    {
        id: "mud",
        name: "Mud",
        level: 13,
        runeId: 4698,
        altarIds: ["water", "earth"],
        xpPerEssence: [9.3, 9.5],
    },
    {
        id: "smoke",
        name: "Smoke",
        level: 15,
        runeId: 4697,
        altarIds: ["air", "fire"],
        xpPerEssence: [8.5, 9.5],
    },
    {
        id: "steam",
        name: "Steam",
        level: 19,
        runeId: 4694,
        altarIds: ["water", "fire"],
        xpPerEssence: [9.3, 10],
    },
    {
        id: "lava",
        name: "Lava",
        level: 23,
        runeId: 4699,
        altarIds: ["earth", "fire"],
        xpPerEssence: [10, 10.5],
    },
];

function altarById(id: string): RuneAltarDef | undefined {
    return ALL_ALTARS.find((altar) => altar.id === id);
}

export function allCombinationBindings(): CombinationBinding[] {
    const bindings: CombinationBinding[] = [];
    for (const def of COMBINATION_RUNES) {
        const first = altarById(def.altarIds[0]);
        const second = altarById(def.altarIds[1]);
        if (!first || !second) continue;
        bindings.push({
            def,
            altar: first,
            opposing: second,
            xpPerEssence: def.xpPerEssence[0],
        });
        bindings.push({
            def,
            altar: second,
            opposing: first,
            xpPerEssence: def.xpPerEssence[1],
        });
    }
    return bindings;
}

export function combinationBindingsForAltar(altarId: string): CombinationBinding[] {
    return allCombinationBindings().filter((binding) => binding.altar.id === altarId);
}

export function wearsBindingNecklace(equip: ReadonlyArray<number> | undefined): boolean {
    if (!Array.isArray(equip) || equip.length <= EquipmentSlot.AMULET) return false;
    return equip[EquipmentSlot.AMULET] === BINDING_NECKLACE_ID;
}

/** Successful binds out of `attempts`. Failed essence still consumed, no XP. */
export function countCombinationSuccesses(
    attempts: number,
    guaranteed: boolean,
    random: () => number = Math.random,
): number {
    if (attempts <= 0) return 0;
    if (guaranteed) return attempts;
    let successes = 0;
    for (let i = 0; i < attempts; i++) {
        if (random() < COMBINATION_BIND_SUCCESS_CHANCE) successes += 1;
    }
    return successes;
}

/** Next necklace charge after one altar craft. Unset/0 starts at 16. */
export function nextBindingNecklaceCharges(currentCharges: number): {
    remaining: number;
    disintegrated: boolean;
} {
    const started = currentCharges > 0 ? currentCharges : BINDING_NECKLACE_CHARGES;
    const remaining = started - 1;
    return { remaining, disintegrated: remaining <= 0 };
}
