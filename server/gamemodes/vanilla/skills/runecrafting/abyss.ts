/**
 * Abyss inner-ring entry: wilderness Mage of Zamorak teleport, plus rift locs
 * that send the player to the matching ruins inner altars.
 *
 * Outer-ring obstacles click through to the inner ring after a skill-level
 * check (wiki level 1; always succeed). Loc IDs verified against cache
 * osrs-237 (names + ops) and OSRS wiki. Blockage 25383 has no op.
 *
 * Wrath has no Abyss rift. Soul rift 25377 exists but stays locked (dark-essence
 * unlock skipped). Blood "Exit-through (Kourend)" skipped.
 *
 * Wilderness spawn 3228 is a varp-492 transform into 2580 (Talk-to/Trade) or
 * 2581 (Talk-to/Trade/Teleport). Handlers bind the spawn id and both visibles.
 *
 * Skipped: skulling / prayer drain, fail chance, tools, 25 XP, loc transforms,
 * random obstacle layouts.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../src/game/scripts/types";
import { ALL_ALTARS, type RuneAltarDef } from "./altars";

/** Inner-ring centre from the OSRS wiki Abyss map (X=3040, Y=4832). */
export const INNER_ABYSS = { x: 3040, y: 4832, level: 0 } as const;

/**
 * Wilderness Mage of Zamorak: spawn 3228 at (3106, 3558), cache-visible
 * 2580 / 2581. 2581 is the only Mage of Zamorak with a Teleport op.
 */
export const WILDERNESS_MAGE_NPC_IDS = [3228, 2580, 2581] as const;

export interface AbyssRiftDef {
    altarId: string;
    locIds: readonly number[];
}

/** Rift loc → ruins altar id. Air–Blood; no Wrath rift in cache/wiki. */
export const ABYSS_RIFTS: readonly AbyssRiftDef[] = [
    { altarId: "air", locIds: [25378] },
    { altarId: "mind", locIds: [25379] },
    { altarId: "water", locIds: [25376] },
    { altarId: "earth", locIds: [24972] },
    { altarId: "fire", locIds: [24971] },
    { altarId: "body", locIds: [24973] },
    { altarId: "cosmic", locIds: [24974] },
    { altarId: "chaos", locIds: [24976] },
    { altarId: "nature", locIds: [24975] },
    { altarId: "law", locIds: [25034] },
    { altarId: "death", locIds: [25035] },
    { altarId: "blood", locIds: [43824, 43825] },
];

export interface AbyssObstacleDef {
    id: string;
    locIds: readonly number[];
    action: string;
    skillId?: SkillId;
    skillName?: string;
    level: number;
    passMessage: string;
}

/**
 * Clickable complete locs only. Partial/broken variants and the blockage
 * have no cache ops. Passage has no skill gate and cannot fail.
 */
export const ABYSS_OBSTACLES: readonly AbyssObstacleDef[] = [
    {
        id: "rock",
        locIds: [25422],
        action: "mine",
        skillId: SkillId.Mining,
        skillName: "Mining",
        level: 1,
        passMessage: "You mine through the rock...",
    },
    {
        id: "tendrils",
        locIds: [25425],
        action: "chop",
        skillId: SkillId.Woodcutting,
        skillName: "Woodcutting",
        level: 1,
        passMessage: "You chop through the tendrils...",
    },
    {
        id: "boil",
        locIds: [25590],
        action: "burn-down",
        skillId: SkillId.Firemaking,
        skillName: "Firemaking",
        level: 1,
        passMessage: "You burn through the boil...",
    },
    {
        id: "eyes",
        locIds: [26146],
        action: "distract",
        skillId: SkillId.Thieving,
        skillName: "Thieving",
        level: 1,
        passMessage: "You distract the eyes...",
    },
    {
        id: "gap",
        locIds: [25428],
        action: "squeeze-through",
        skillId: SkillId.Agility,
        skillName: "Agility",
        level: 1,
        passMessage: "You squeeze through the gap...",
    },
    {
        id: "passage",
        locIds: [25381],
        action: "go-through",
        level: 0,
        passMessage: "You step through the passage...",
    },
];

/** Impassable outer-ring loc; no handler. */
export const ABYSS_BLOCKAGE_LOC_ID = 25383;

const altarById = new Map<string, RuneAltarDef>(ALL_ALTARS.map((altar) => [altar.id, altar]));

export function teleportToInnerAbyss(player: PlayerState, services: ScriptServices): void {
    services.messaging.sendGameMessage(
        player,
        "The Mage of Zamorak weaves a spell around you...",
    );
    services.movement.teleportPlayer(
        player,
        INNER_ABYSS.x,
        INNER_ABYSS.y,
        INNER_ABYSS.level,
        true,
    );
}

function exitThroughRift(altar: RuneAltarDef, event: LocInteractionEvent): void {
    const { player, services } = event;
    services.messaging.sendGameMessage(player, "You step through the rift...");
    services.movement.teleportPlayer(
        player,
        altar.altarEnter.x,
        altar.altarEnter.y,
        altar.altarEnter.level,
        true,
    );
}

function tryPassObstacle(obstacle: AbyssObstacleDef, event: LocInteractionEvent): void {
    const { player, services } = event;
    if (obstacle.skillId != null) {
        const level = services.skills.getSkill(player, obstacle.skillId)?.baseLevel ?? 1;
        if (level < obstacle.level) {
            services.messaging.sendGameMessage(
                player,
                `You need a ${obstacle.skillName} level of at least ${obstacle.level} to pass.`,
            );
            return;
        }
    }
    services.messaging.sendGameMessage(player, obstacle.passMessage);
    services.movement.teleportPlayer(
        player,
        INNER_ABYSS.x,
        INNER_ABYSS.y,
        INNER_ABYSS.level,
        true,
    );
}

function onMageInteract(event: NpcInteractionEvent): void {
    teleportToInnerAbyss(event.player, event.services);
}

export function registerAbyss(registry: IScriptRegistry): void {
    for (const rift of ABYSS_RIFTS) {
        const altar = altarById.get(rift.altarId);
        if (!altar) continue;
        const enter = (event: LocInteractionEvent) => exitThroughRift(altar, event);
        for (const locId of rift.locIds) {
            registry.registerLocInteraction(locId, enter, "exit-through");
            registry.registerLocInteraction(locId, enter, undefined);
        }
    }

    for (const obstacle of ABYSS_OBSTACLES) {
        const pass = (event: LocInteractionEvent) => tryPassObstacle(obstacle, event);
        for (const locId of obstacle.locIds) {
            registry.registerLocInteraction(locId, pass, obstacle.action);
            registry.registerLocInteraction(locId, pass, undefined);
        }
    }

    for (const npcId of WILDERNESS_MAGE_NPC_IDS) {
        registry.registerNpcInteraction(npcId, onMageInteract, "teleport");
        registry.registerNpcInteraction(npcId, onMageInteract, "talk-to");
        registry.registerNpcInteraction(npcId, onMageInteract, undefined);
    }
}
