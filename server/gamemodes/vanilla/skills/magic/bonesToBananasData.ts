// Bones to Bananas. Spell object ID 9001 from vanilla spells.ts.
// Self-cast: converts every convertible bone in the inventory into a banana.
// OSRS allowlist after the 2013 bone expansion (not dragon/long/curved bones).
// Bones to Peaches is not stubbed in vanilla spells.ts.

export const BONES_TO_BANANAS_SPELL_ID = 9001;

export const NATURE_RUNE_ID = 561;
export const WATER_RUNE_ID = 555;
export const EARTH_RUNE_ID = 557;

export const BANANA_ITEM_ID = 1963;

export const BONES_TO_BANANAS_ANIMATION_ID = 722;
export const BONES_TO_BANANAS_SPOT_ANIM_ID = 114;
export const BONES_TO_BANANAS_SOUND_ID = 114;
export const BONES_TO_BANANAS_DELAY_TICKS = 3;
export const BONES_TO_BANANAS_MAGIC_LEVEL = 15;
export const BONES_TO_BANANAS_MAGIC_XP = 25;

/** Regular, burnt, bat, big, wolf, jogre, monkey, and bleached bones. */
export const CONVERTIBLE_BONE_IDS: readonly number[] = [
    526, // Bones
    528, // Burnt bones
    530, // Bat bones
    532, // Big bones
    2859, // Wolf bones
    3125, // Jogre bones
    3179, // Monkey bones
    3180,
    3181,
    3182,
    3183,
    3184,
    3185,
    3186,
    25422, // Bleached bones
];

export interface BonesToBananasRuneCost {
    runeId: number;
    quantity: number;
}

export interface BonesToBananasSpell {
    spellId: number;
    name: string;
    level: number;
    xp: number;
    productItemId: number;
    runeCosts: readonly BonesToBananasRuneCost[];
    castSpotAnim: number;
    castSoundId: number;
    animation: number;
    delayTicks: number;
}

export const BONES_TO_BANANAS_SPELL: BonesToBananasSpell = {
    spellId: BONES_TO_BANANAS_SPELL_ID,
    name: "Bones to Bananas",
    level: BONES_TO_BANANAS_MAGIC_LEVEL,
    xp: BONES_TO_BANANAS_MAGIC_XP,
    productItemId: BANANA_ITEM_ID,
    runeCosts: [
        { runeId: NATURE_RUNE_ID, quantity: 1 },
        { runeId: WATER_RUNE_ID, quantity: 2 },
        { runeId: EARTH_RUNE_ID, quantity: 2 },
    ],
    castSpotAnim: BONES_TO_BANANAS_SPOT_ANIM_ID,
    castSoundId: BONES_TO_BANANAS_SOUND_ID,
    animation: BONES_TO_BANANAS_ANIMATION_ID,
    delayTicks: BONES_TO_BANANAS_DELAY_TICKS,
};

const CONVERTIBLE_BONE_SET = new Set(CONVERTIBLE_BONE_IDS);

export function getBonesToBananasSpell(spellId: number): BonesToBananasSpell | undefined {
    return spellId === BONES_TO_BANANAS_SPELL_ID ? BONES_TO_BANANAS_SPELL : undefined;
}

export function isBonesToBananasSpell(spellId: number): boolean {
    return spellId === BONES_TO_BANANAS_SPELL_ID;
}

export function isConvertibleBone(itemId: number): boolean {
    return CONVERTIBLE_BONE_SET.has(itemId);
}

export function countConvertibleBones(
    entries: Array<{ itemId: number; quantity: number }>,
): number {
    let total = 0;
    for (const entry of entries) {
        if (!isConvertibleBone(entry.itemId)) continue;
        total += Math.max(0, entry.quantity);
    }
    return total;
}
