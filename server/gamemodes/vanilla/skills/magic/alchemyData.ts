// Low / High Level Alchemy. Spell object IDs 9110 / 9111 from vanilla spells.ts.
// Cast on a tradeable inventory item: consume it, grant coins from item value,
// nature+fire runes, Magic XP. Untradeables and coins cannot be alchemised.

export const LOW_ALCHEMY_SPELL_ID = 9110;
export const HIGH_ALCHEMY_SPELL_ID = 9111;

export const NATURE_RUNE_ID = 561;
export const FIRE_RUNE_ID = 554;
export const COINS_ITEM_ID = 995;

export const LOW_ALCHEMY_ANIMATION_ID = 712;
export const HIGH_ALCHEMY_ANIMATION_ID = 713;
export const LOW_ALCHEMY_SPOT_ANIM_ID = 112;
export const HIGH_ALCHEMY_SPOT_ANIM_ID = 113;
export const LOW_ALCHEMY_SOUND_ID = 98;
export const HIGH_ALCHEMY_SOUND_ID = 97;

export const LOW_ALCHEMY_DELAY_TICKS = 3;
export const HIGH_ALCHEMY_DELAY_TICKS = 5;
export const LOW_ALCHEMY_MAGIC_LEVEL = 21;
export const HIGH_ALCHEMY_MAGIC_LEVEL = 55;
export const LOW_ALCHEMY_MAGIC_XP = 31;
export const HIGH_ALCHEMY_MAGIC_XP = 65;

/** OSRS: high alch is 60% of shop value; low alch is 40%. */
export const HIGH_ALCH_VALUE_RATIO = 0.6;
export const LOW_ALCH_VALUE_RATIO = 0.4;

export interface AlchemyRuneCost {
    runeId: number;
    quantity: number;
}

export interface AlchemySpell {
    spellId: number;
    name: string;
    level: number;
    xp: number;
    high: boolean;
    runeCosts: readonly AlchemyRuneCost[];
    castSpotAnim: number;
    castSoundId: number;
    animation: number;
    delayTicks: number;
}

export type AlchemyItemDef = {
    tradeable?: boolean;
    value?: number;
    highAlch?: number;
    lowAlch?: number;
};

export const LOW_ALCHEMY_SPELL: AlchemySpell = {
    spellId: LOW_ALCHEMY_SPELL_ID,
    name: "Low Level Alchemy",
    level: LOW_ALCHEMY_MAGIC_LEVEL,
    xp: LOW_ALCHEMY_MAGIC_XP,
    high: false,
    runeCosts: [
        { runeId: FIRE_RUNE_ID, quantity: 3 },
        { runeId: NATURE_RUNE_ID, quantity: 1 },
    ],
    castSpotAnim: LOW_ALCHEMY_SPOT_ANIM_ID,
    castSoundId: LOW_ALCHEMY_SOUND_ID,
    animation: LOW_ALCHEMY_ANIMATION_ID,
    delayTicks: LOW_ALCHEMY_DELAY_TICKS,
};

export const HIGH_ALCHEMY_SPELL: AlchemySpell = {
    spellId: HIGH_ALCHEMY_SPELL_ID,
    name: "High Level Alchemy",
    level: HIGH_ALCHEMY_MAGIC_LEVEL,
    xp: HIGH_ALCHEMY_MAGIC_XP,
    high: true,
    runeCosts: [
        { runeId: FIRE_RUNE_ID, quantity: 5 },
        { runeId: NATURE_RUNE_ID, quantity: 1 },
    ],
    castSpotAnim: HIGH_ALCHEMY_SPOT_ANIM_ID,
    castSoundId: HIGH_ALCHEMY_SOUND_ID,
    animation: HIGH_ALCHEMY_ANIMATION_ID,
    delayTicks: HIGH_ALCHEMY_DELAY_TICKS,
};

const SPELLS_BY_ID = new Map<number, AlchemySpell>([
    [LOW_ALCHEMY_SPELL_ID, LOW_ALCHEMY_SPELL],
    [HIGH_ALCHEMY_SPELL_ID, HIGH_ALCHEMY_SPELL],
]);

export function getAlchemySpell(spellId: number): AlchemySpell | undefined {
    return SPELLS_BY_ID.get(spellId);
}

export function isAlchemySpell(spellId: number): boolean {
    return SPELLS_BY_ID.has(spellId);
}

export function getAlchemySpellIds(): readonly number[] {
    return [LOW_ALCHEMY_SPELL_ID, HIGH_ALCHEMY_SPELL_ID];
}

export function isCoinsItem(itemId: number): boolean {
    return itemId === COINS_ITEM_ID;
}

/** OSRS forbids alching untradeables. Missing defs are treated as invalid. */
export function canAlchemiseItem(
    itemId: number,
    def: AlchemyItemDef | undefined,
): { ok: true } | { ok: false; reason: "alch_coins" | "alch_invalid_item" } {
    if (!(itemId > 0)) return { ok: false, reason: "alch_invalid_item" };
    if (isCoinsItem(itemId)) return { ok: false, reason: "alch_coins" };
    if (!def || def.tradeable !== true) return { ok: false, reason: "alch_invalid_item" };
    return { ok: true };
}

/**
 * Coins granted for one item. Prefer the def's highAlch/lowAlch when present;
 * otherwise 60%/40% of shop `value` (OSRS).
 */
export function getAlchCoins(def: AlchemyItemDef, high: boolean): number {
    const explicit = high ? def.highAlch : def.lowAlch;
    if (typeof explicit === "number" && Number.isFinite(explicit)) {
        return Math.max(0, Math.floor(explicit));
    }
    const value = Math.max(0, def.value ?? 0);
    return Math.floor(value * (high ? HIGH_ALCH_VALUE_RATIO : LOW_ALCH_VALUE_RATIO));
}
