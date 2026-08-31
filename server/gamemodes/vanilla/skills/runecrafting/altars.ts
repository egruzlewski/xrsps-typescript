/**
 * F2P runic altars (Air through Body). Loc IDs and XP from OSRS wiki.
 * Multiplier: 1 + floor(level / multiplierDiv) runes per essence.
 */

export interface RuneAltarDef {
    id: string;
    name: string;
    level: number;
    xpPerEssence: number;
    multiplierDiv: number;
    runeId: number;
    talismanId: number;
    tiaraId: number;
    ruinsLocIds: readonly number[];
    altarLocId: number;
    portalLocId: number;
    altarEnter: { x: number; y: number; level: number };
    ruinsExit: { x: number; y: number; level: number };
}

export const RUNE_ESSENCE = 1436;
export const PURE_ESSENCE = 7936;

export const F2P_ALTARS: readonly RuneAltarDef[] = [
    {
        id: "air",
        name: "Air",
        level: 1,
        xpPerEssence: 5,
        multiplierDiv: 11,
        runeId: 556,
        talismanId: 1438,
        tiaraId: 5527,
        ruinsLocIds: [28914, 29090],
        altarLocId: 34760,
        portalLocId: 34748,
        altarEnter: { x: 2841, y: 4830, level: 0 },
        ruinsExit: { x: 2983, y: 3288, level: 0 },
    },
    {
        id: "mind",
        name: "Mind",
        level: 2,
        xpPerEssence: 5.5,
        multiplierDiv: 14,
        runeId: 558,
        talismanId: 1448,
        tiaraId: 5529,
        ruinsLocIds: [29094, 29095],
        altarLocId: 34761,
        portalLocId: 34749,
        altarEnter: { x: 2793, y: 4828, level: 0 },
        ruinsExit: { x: 2982, y: 3514, level: 0 },
    },
    {
        id: "water",
        name: "Water",
        level: 5,
        xpPerEssence: 6,
        multiplierDiv: 19,
        runeId: 555,
        talismanId: 1444,
        tiaraId: 5531,
        ruinsLocIds: [29096, 29097],
        altarLocId: 34762,
        portalLocId: 34750,
        altarEnter: { x: 2726, y: 4833, level: 0 },
        ruinsExit: { x: 3185, y: 3165, level: 0 },
    },
    {
        id: "earth",
        name: "Earth",
        level: 9,
        xpPerEssence: 6.5,
        multiplierDiv: 26,
        runeId: 557,
        talismanId: 1440,
        tiaraId: 5535,
        ruinsLocIds: [29098, 29099],
        altarLocId: 34763,
        portalLocId: 34751,
        altarEnter: { x: 2655, y: 4830, level: 0 },
        ruinsExit: { x: 3306, y: 3474, level: 0 },
    },
    {
        id: "fire",
        name: "Fire",
        level: 14,
        xpPerEssence: 7,
        multiplierDiv: 35,
        runeId: 554,
        talismanId: 1442,
        tiaraId: 5537,
        ruinsLocIds: [30371, 30372],
        altarLocId: 34764,
        portalLocId: 34752,
        altarEnter: { x: 2576, y: 4848, level: 0 },
        ruinsExit: { x: 3313, y: 3255, level: 0 },
    },
    {
        id: "body",
        name: "Body",
        level: 20,
        xpPerEssence: 7.5,
        multiplierDiv: 46,
        runeId: 559,
        talismanId: 1446,
        tiaraId: 5533,
        ruinsLocIds: [30373, 31584],
        altarLocId: 34765,
        portalLocId: 34753,
        altarEnter: { x: 2521, y: 4835, level: 0 },
        ruinsExit: { x: 3053, y: 3445, level: 0 },
    },
];
