/**
 * F2P Runecraft loops: Air through Body.
 * Enter ruins with talisman/tiara → craft on altar → exit portal.
 */
import { EquipmentSlot } from "../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnLocEvent,
    LocInteractionEvent,
    ScriptServices,
} from "../../../../src/game/scripts/types";
import {
    F2P_ALTARS,
    PURE_ESSENCE,
    RUNE_ESSENCE,
    type RuneAltarDef,
} from "./altars";

function rcLevel(player: PlayerState, services: ScriptServices): number {
    return services.skills.getSkill(player, SkillId.Runecraft)?.baseLevel ?? 1;
}

function wearsTiara(player: PlayerState, services: ScriptServices, tiaraId: number): boolean {
    const equip = services.equipment.getEquipArray(player) ?? [];
    return (equip[EquipmentSlot.HEAD] ?? 0) === tiaraId;
}

function enterAltar(player: PlayerState, services: ScriptServices, altar: RuneAltarDef): void {
    services.messaging.sendGameMessage(
        player,
        `You hold the ${altar.name} Talisman towards the mysterious ruins.`,
    );
    services.messaging.sendGameMessage(player, "You feel a powerful force take hold of you...");
    services.movement.teleportPlayer(
        player,
        altar.altarEnter.x,
        altar.altarEnter.y,
        altar.altarEnter.level,
        true,
    );
}

function tryEnterFromClick(altar: RuneAltarDef, event: LocInteractionEvent): void {
    if (!wearsTiara(event.player, event.services, altar.tiaraId)) {
        event.services.messaging.sendGameMessage(event.player, "Nothing interesting happens.");
        return;
    }
    enterAltar(event.player, event.services, altar);
}

function tryEnterWithTalisman(altar: RuneAltarDef, event: ItemOnLocEvent): void {
    if (event.source.itemId !== altar.talismanId) {
        event.services.messaging.sendGameMessage(event.player, "Nothing interesting happens.");
        return;
    }
    enterAltar(event.player, event.services, altar);
}

function craftRunes(altar: RuneAltarDef, player: PlayerState, services: ScriptServices): void {
    const level = rcLevel(player, services);
    if (level < altar.level) {
        services.messaging.sendGameMessage(
            player,
            `You need a Runecrafting level of at least ${altar.level} to craft ${altar.name} Runes.`,
        );
        return;
    }

    const runeEss = player.items.getItemCount(RUNE_ESSENCE);
    const pureEss = player.items.getItemCount(PURE_ESSENCE);
    const totalEss = runeEss + pureEss;
    if (totalEss <= 0) {
        services.messaging.sendGameMessage(player, "You do not have any essence to bind.");
        return;
    }

    const perEss = 1 + Math.floor(level / altar.multiplierDiv);
    const craftCount = totalEss * perEss;

    if (runeEss > 0) player.items.removeItem(RUNE_ESSENCE, runeEss, { assureFullRemoval: true });
    if (pureEss > 0) player.items.removeItem(PURE_ESSENCE, pureEss, { assureFullRemoval: true });
    player.items.addItem(altar.runeId, craftCount);
    services.inventory.snapshotInventory(player);
    services.skills.addSkillXp(player, SkillId.Runecraft, totalEss * altar.xpPerEssence);
    services.messaging.sendGameMessage(
        player,
        `You bind the temple's power into ${altar.name} Runes.`,
    );
}

function exitAltar(altar: RuneAltarDef, event: LocInteractionEvent): void {
    const { player, services } = event;
    services.messaging.sendGameMessage(player, "You step through the portal...");
    services.movement.teleportPlayer(
        player,
        altar.ruinsExit.x,
        altar.ruinsExit.y,
        altar.ruinsExit.level,
        true,
    );
}

function registerAltar(registry: IScriptRegistry, altar: RuneAltarDef): void {
    for (const ruinsId of altar.ruinsLocIds) {
        registry.registerLocInteraction(
            ruinsId,
            (event) => tryEnterFromClick(altar, event),
            "enter",
        );
        registry.registerLocInteraction(
            ruinsId,
            (event) => tryEnterFromClick(altar, event),
            undefined,
        );
        registry.registerItemOnLoc(altar.talismanId, ruinsId, (event) =>
            tryEnterWithTalisman(altar, event),
        );
    }

    const craftFromLoc = (event: LocInteractionEvent) =>
        craftRunes(altar, event.player, event.services);
    const craftFromItem = (event: ItemOnLocEvent) => craftRunes(altar, event.player, event.services);

    registry.registerLocInteraction(altar.altarLocId, craftFromLoc, "craft-rune");
    registry.registerLocInteraction(altar.altarLocId, craftFromLoc, "craft rune");
    registry.registerLocInteraction(altar.altarLocId, craftFromLoc, undefined);
    registry.registerItemOnLoc(RUNE_ESSENCE, altar.altarLocId, craftFromItem);
    registry.registerItemOnLoc(PURE_ESSENCE, altar.altarLocId, craftFromItem);

    registry.registerLocInteraction(altar.portalLocId, (event) => exitAltar(altar, event), "use");
    registry.registerLocInteraction(altar.portalLocId, (event) => exitAltar(altar, event), "exit");
    registry.registerLocInteraction(altar.portalLocId, (event) => exitAltar(altar, event), undefined);
}

export function register(registry: IScriptRegistry): void {
    for (const altar of F2P_ALTARS) {
        registerAltar(registry, altar);
    }
}
