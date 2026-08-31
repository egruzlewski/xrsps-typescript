/**
 * Dark Altar conversion (dense blocks → dark blocks) and chiseling dark
 * essence blocks into fragments used at Kourend Blood / Arceuus Soul.
 *
 * Skipped: prayer drain per block, auto-chisel tick cadence, trophy-head
 * sacrifice, reanimation, Arceuus spellbook via Tyss.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnItemEvent,
    ItemOnLocEvent,
    LocInteractionEvent,
    ScriptServices,
} from "../../../../src/game/scripts/types";
import {
    DARK_ALTAR_LOC_ID,
    DARK_ESSENCE_BLOCK,
    DARK_ESSENCE_FRAGMENTS,
    DENSE_ESSENCE_BLOCK,
} from "./altars";

export const DARK_ESSENCE_CHISEL = 1755;
export const DARK_ALTAR_XP_PER_BLOCK = 2.5;
export const DARK_ESSENCE_CHISEL_XP = 8;
export const DARK_ESSENCE_CHISEL_LEVEL = 38;
export const DARK_ESSENCE_FRAGMENTS_PER_BLOCK = 4;
export const DARK_ESSENCE_FRAGMENT_CAP = 108;

function craftingLevel(player: PlayerState, services: ScriptServices): number {
    const skill = services.skills.getSkill(player, SkillId.Crafting);
    return Math.max(1, (skill?.baseLevel ?? 1) + (skill?.boost ?? 0));
}

function drainPrayer(player: PlayerState, amount: number): void {
    const system = (
        player as PlayerState & {
            skillSystem?: {
                getSkill?: (skillId: number) => { baseLevel: number; boost: number };
                adjustSkillBoost?: (skillId: number, delta: number) => void;
            };
        }
    ).skillSystem;
    if (!system?.getSkill || !system.adjustSkillBoost || amount <= 0) return;
    const skill = system.getSkill(SkillId.Prayer);
    const current = Math.max(0, (skill?.baseLevel ?? 0) + (skill?.boost ?? 0));
    const drain = Math.min(current, amount);
    if (drain > 0) system.adjustSkillBoost(SkillId.Prayer, -drain);
}

function convertDenseAtAltar(player: PlayerState, services: ScriptServices): void {
    const count = player.items.getItemCount(DENSE_ESSENCE_BLOCK);
    if (count <= 0) {
        services.messaging.sendGameMessage(player, "You have no dense essence to infuse.");
        return;
    }

    player.items.removeItem(DENSE_ESSENCE_BLOCK, count, { assureFullRemoval: true });
    player.items.addItem(DARK_ESSENCE_BLOCK, count);
    drainPrayer(player, count);
    services.inventory.snapshotInventory(player);
    services.skills.addSkillXp(player, SkillId.Runecraft, count * DARK_ALTAR_XP_PER_BLOCK);
    services.messaging.sendGameMessage(
        player,
        "The Dark Altar infuses the essence with dark power.",
    );
}

function chiselDarkBlocks(player: PlayerState, services: ScriptServices): void {
    const level = craftingLevel(player, services);
    if (level < DARK_ESSENCE_CHISEL_LEVEL) {
        services.messaging.sendGameMessage(
            player,
            `You need a Crafting level of at least ${DARK_ESSENCE_CHISEL_LEVEL} to chip dark essence.`,
        );
        return;
    }

    const blocks = player.items.getItemCount(DARK_ESSENCE_BLOCK);
    if (blocks <= 0) {
        services.messaging.sendGameMessage(player, "You need a dark essence block to chip.");
        return;
    }

    const held = player.items.getItemCount(DARK_ESSENCE_FRAGMENTS);
    const space = Math.max(0, DARK_ESSENCE_FRAGMENT_CAP - held);
    const convert = Math.min(blocks, Math.floor(space / DARK_ESSENCE_FRAGMENTS_PER_BLOCK));
    if (convert <= 0) {
        services.messaging.sendGameMessage(
            player,
            "You can't carry any more dark essence fragments.",
        );
        return;
    }

    player.items.removeItem(DARK_ESSENCE_BLOCK, convert, { assureFullRemoval: true });
    player.items.addItem(DARK_ESSENCE_FRAGMENTS, convert * DARK_ESSENCE_FRAGMENTS_PER_BLOCK);
    services.inventory.snapshotInventory(player);
    services.skills.addSkillXp(player, SkillId.Crafting, convert * DARK_ESSENCE_CHISEL_XP);
    services.messaging.sendGameMessage(player, "You chip the dark essence into fragments.");
}

export function registerDarkEssence(registry: IScriptRegistry): void {
    const venerate = (event: LocInteractionEvent) =>
        convertDenseAtAltar(event.player, event.services);
    registry.registerLocInteraction(DARK_ALTAR_LOC_ID, venerate, "venerate");
    registry.registerLocInteraction(DARK_ALTAR_LOC_ID, venerate, undefined);
    registry.registerItemOnLoc(DENSE_ESSENCE_BLOCK, DARK_ALTAR_LOC_ID, (event: ItemOnLocEvent) =>
        convertDenseAtAltar(event.player, event.services),
    );

    const chip = (event: ItemOnItemEvent) => chiselDarkBlocks(event.player, event.services);
    registry.registerItemOnItem(DARK_ESSENCE_CHISEL, DARK_ESSENCE_BLOCK, chip);
}
