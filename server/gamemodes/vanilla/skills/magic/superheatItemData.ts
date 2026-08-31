// Superheat Item. Spell object ID 9075 from vanilla spells.ts (cache spell item).
// Smelts using the same SMELTING_RECIPES as a furnace: coal on steel/mithril/addy/rune,
// bronze needs copper+tin, iron is 100% (no furnace fail). Cast on the primary ore, not coal.

import {
    SMELTING_RECIPES,
    type SmeltingRecipe,
    getSmeltingRecipeById,
} from "../smithing/smithingData";

export const SUPERHEAT_ITEM_SPELL_ID = 9075;

export const NATURE_RUNE_ID = 561;
export const FIRE_RUNE_ID = 554;
export const COAL_ITEM_ID = 453;

export const SUPERHEAT_ITEM_ANIMATION_ID = 725;
export const SUPERHEAT_ITEM_SPOT_ANIM_ID = 148;
export const SUPERHEAT_ITEM_SOUND_ID = 190;
export const SUPERHEAT_ITEM_DELAY_TICKS = 3;
export const SUPERHEAT_ITEM_MAGIC_LEVEL = 43;
export const SUPERHEAT_ITEM_MAGIC_XP = 53;

export interface SuperheatRuneCost {
    runeId: number;
    quantity: number;
}

export interface SuperheatItemSpell {
    spellId: number;
    name: string;
    level: number;
    xp: number;
    runeCosts: readonly SuperheatRuneCost[];
    castSpotAnim: number;
    castSoundId: number;
    animation: number;
    delayTicks: number;
}

export const SUPERHEAT_ITEM_SPELL: SuperheatItemSpell = {
    spellId: SUPERHEAT_ITEM_SPELL_ID,
    name: "Superheat Item",
    level: SUPERHEAT_ITEM_MAGIC_LEVEL,
    xp: SUPERHEAT_ITEM_MAGIC_XP,
    runeCosts: [
        { runeId: FIRE_RUNE_ID, quantity: 4 },
        { runeId: NATURE_RUNE_ID, quantity: 1 },
    ],
    castSpotAnim: SUPERHEAT_ITEM_SPOT_ANIM_ID,
    castSoundId: SUPERHEAT_ITEM_SOUND_ID,
    animation: SUPERHEAT_ITEM_ANIMATION_ID,
    delayTicks: SUPERHEAT_ITEM_DELAY_TICKS,
};

export function getSuperheatItemSpell(spellId: number): SuperheatItemSpell | undefined {
    return spellId === SUPERHEAT_ITEM_SPELL_ID ? SUPERHEAT_ITEM_SPELL : undefined;
}

export function isSuperheatItemSpell(spellId: number): boolean {
    return spellId === SUPERHEAT_ITEM_SPELL_ID;
}

function countItem(
    entries: Array<{ itemId: number; quantity: number }>,
    itemId: number,
): number {
    let total = 0;
    for (const entry of entries) {
        if (entry.itemId === itemId) total += Math.max(0, entry.quantity);
    }
    return total;
}

export function coalQuantity(recipe: SmeltingRecipe): number {
    return recipe.inputs.find((input) => input.itemId === COAL_ITEM_ID)?.quantity ?? 0;
}

export function isSuperheatOre(itemId: number): boolean {
    if (!(itemId > 0) || itemId === COAL_ITEM_ID) return false;
    return SMELTING_RECIPES.some((recipe) =>
        recipe.inputs.some((input) => input.itemId === itemId),
    );
}

export function recipeHasAllInputs(
    recipe: SmeltingRecipe,
    inventory: Array<{ itemId: number; quantity: number }>,
): boolean {
    for (const input of recipe.inputs) {
        if (countItem(inventory, input.itemId) < input.quantity) return false;
    }
    return true;
}

export function recipeMissingCoal(
    recipe: SmeltingRecipe,
    inventory: Array<{ itemId: number; quantity: number }>,
): boolean {
    const needed = coalQuantity(recipe);
    if (needed <= 0) return false;
    return countItem(inventory, COAL_ITEM_ID) < needed;
}

/**
 * Pick the furnace recipe Superheat should attempt for the clicked ore.
 * Iron ore with at least 2 coal always selects steel (OSRS); otherwise iron.
 * Mithril/adamant/rune still return their coal recipe when coal is short so the
 * handler can emit a missing-coal message.
 */
export function getSuperheatRecipeForOre(
    oreItemId: number,
    inventory: Array<{ itemId: number; quantity: number }>,
): SmeltingRecipe | undefined {
    if (!isSuperheatOre(oreItemId)) return undefined;
    const matches = SMELTING_RECIPES.filter((recipe) =>
        recipe.inputs.some((input) => input.itemId === oreItemId),
    );
    if (matches.length === 0) return undefined;

    const ranked = [...matches].sort((a, b) => coalQuantity(b) - coalQuantity(a));
    const coalCount = countItem(inventory, COAL_ITEM_ID);
    for (const recipe of ranked) {
        const needed = coalQuantity(recipe);
        if (needed === 0 || coalCount >= needed) return recipe;
    }
    return ranked[ranked.length - 1] ?? matches[0];
}

export function getSuperheatRecipeById(id: string): SmeltingRecipe | undefined {
    return getSmeltingRecipeById(id);
}
