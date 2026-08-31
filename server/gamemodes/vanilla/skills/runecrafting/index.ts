/**
 * Runecraft loops: F2P Air–Body plus members ruins altars, and walk-up
 * Astral, Kourend Blood, and Arceuus Soul.
 * Ruins: talisman/tiara enter → craft on altar → exit portal.
 * Walk-up: click the surface altar (no ruins/portal). Same ruins altars also
 * bind blank tiaras and combination runes (Mist–Lava).
 * Abyss: wilderness Mage of Zamorak teleports into the inner ring; rifts
 * there send the player to the matching ruins inner altars (Air–Blood).
 * Essence pouches fill / empty / check rune or pure essence; Dark Mage repairs.
 * Dense runestone mining lives in mining/; Dark Altar venerate and chisel-to-
 * fragments are registered here.
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
    ALL_ALTARS,
    BLANK_TIARA,
    PURE_ESSENCE,
    RUNE_ESSENCE,
    WALKUP_ALTARS,
    type RuneAltarDef,
    type RuneCraftDef,
} from "./altars";
import { registerAbyss } from "./abyss";
import { registerDarkEssence } from "./darkEssence";
import { registerPouches } from "./pouches";
import {
    BINDING_NECKLACE_ID,
    combinationBindingsForAltar,
    countCombinationSuccesses,
    nextBindingNecklaceCharges,
    wearsBindingNecklace,
    type CombinationBinding,
} from "./combination";

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

function craftRunes(altar: RuneCraftDef, player: PlayerState, services: ScriptServices): void {
    const level = rcLevel(player, services);
    if (level < altar.level) {
        services.messaging.sendGameMessage(
            player,
            `You need a Runecrafting level of at least ${altar.level} to craft ${altar.name} Runes.`,
        );
        return;
    }

    let totalEss: number;
    let runeEss = 0;
    let pureEss = 0;
    let specialEss = 0;

    if (altar.essenceItemId != null) {
        specialEss = player.items.getItemCount(altar.essenceItemId);
        if (specialEss <= 0) {
            if (
                player.items.getItemCount(RUNE_ESSENCE) > 0 ||
                player.items.getItemCount(PURE_ESSENCE) > 0
            ) {
                services.messaging.sendGameMessage(
                    player,
                    `You need dark essence fragments to craft ${altar.name} Runes.`,
                );
                return;
            }
            services.messaging.sendGameMessage(player, "You do not have any essence to bind.");
            return;
        }
        totalEss = specialEss;
    } else {
        runeEss = altar.pureEssenceOnly ? 0 : player.items.getItemCount(RUNE_ESSENCE);
        pureEss = player.items.getItemCount(PURE_ESSENCE);
        totalEss = runeEss + pureEss;
        if (totalEss <= 0) {
            if (altar.pureEssenceOnly && player.items.getItemCount(RUNE_ESSENCE) > 0) {
                services.messaging.sendGameMessage(
                    player,
                    `You need pure essence to craft ${altar.name} Runes.`,
                );
                return;
            }
            services.messaging.sendGameMessage(player, "You do not have any essence to bind.");
            return;
        }
    }

    const perEss = 1 + Math.floor(level / altar.multiplierDiv);
    const craftCount = totalEss * perEss;

    if (runeEss > 0) player.items.removeItem(RUNE_ESSENCE, runeEss, { assureFullRemoval: true });
    if (pureEss > 0) player.items.removeItem(PURE_ESSENCE, pureEss, { assureFullRemoval: true });
    if (specialEss > 0 && altar.essenceItemId != null) {
        player.items.removeItem(altar.essenceItemId, specialEss, { assureFullRemoval: true });
    }
    player.items.addItem(altar.runeId, craftCount);
    services.inventory.snapshotInventory(player);
    services.skills.addSkillXp(player, SkillId.Runecraft, totalEss * altar.xpPerEssence);
    services.messaging.sendGameMessage(
        player,
        `You bind the temple's power into ${altar.name} Runes.`,
    );
}

function imbueTiara(altar: RuneAltarDef, player: PlayerState, services: ScriptServices): void {
    const tiaras = player.items.getItemCount(BLANK_TIARA);
    const talismans = player.items.getItemCount(altar.talismanId);
    if (tiaras <= 0) {
        services.messaging.sendGameMessage(player, "You need a tiara to bind.");
        return;
    }
    if (talismans <= 0) {
        services.messaging.sendGameMessage(
            player,
            `You need a ${altar.name} Talisman to bind your tiara.`,
        );
        return;
    }

    player.items.removeItem(BLANK_TIARA, 1, { assureFullRemoval: true });
    player.items.removeItem(altar.talismanId, 1, { assureFullRemoval: true });
    player.items.addItem(altar.tiaraId, 1);
    services.inventory.snapshotInventory(player);
    services.skills.addSkillXp(player, SkillId.Runecraft, altar.tiaraXp);
    services.messaging.sendGameMessage(
        player,
        `You bind the power of ${altar.name} into your tiara.`,
    );
}

function craftCombination(
    binding: CombinationBinding,
    player: PlayerState,
    services: ScriptServices,
): void {
    const { def, opposing, xpPerEssence } = binding;
    const level = rcLevel(player, services);
    if (level < def.level) {
        services.messaging.sendGameMessage(
            player,
            `You need a Runecrafting level of at least ${def.level} to craft ${def.name} Runes.`,
        );
        return;
    }

    const pureEss = player.items.getItemCount(PURE_ESSENCE);
    if (pureEss <= 0) {
        if (player.items.getItemCount(RUNE_ESSENCE) > 0) {
            services.messaging.sendGameMessage(
                player,
                `You need pure essence to craft ${def.name} Runes.`,
            );
            return;
        }
        services.messaging.sendGameMessage(player, "You do not have any essence to bind.");
        return;
    }

    const opposingRunes = player.items.getItemCount(opposing.runeId);
    if (opposingRunes <= 0) {
        services.messaging.sendGameMessage(
            player,
            `You need ${opposing.name} Runes to bind ${def.name} Runes.`,
        );
        return;
    }

    const hasTalisman = player.items.getItemCount(opposing.talismanId) > 0;
    const hasTiara = player.items.getItemCount(opposing.tiaraId) > 0;
    if (!hasTalisman && !hasTiara) {
        services.messaging.sendGameMessage(
            player,
            `You need a ${opposing.name} Talisman to bind ${def.name} Runes.`,
        );
        return;
    }

    const craftCount = Math.min(pureEss, opposingRunes);
    const guaranteed = wearsBindingNecklace(services.equipment.getEquipArray(player));
    const successCount = countCombinationSuccesses(craftCount, guaranteed);

    player.items.removeItem(PURE_ESSENCE, craftCount, { assureFullRemoval: true });
    player.items.removeItem(opposing.runeId, craftCount, { assureFullRemoval: true });
    if (hasTalisman) {
        player.items.removeItem(opposing.talismanId, 1, { assureFullRemoval: true });
    } else {
        player.items.removeItem(opposing.tiaraId, 1, { assureFullRemoval: true });
    }
    if (successCount > 0) {
        player.items.addItem(def.runeId, successCount);
        services.skills.addSkillXp(player, SkillId.Runecraft, successCount * xpPerEssence);
    }
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(
        player,
        `You bind the temple's power into ${def.name} Runes.`,
    );
    if (guaranteed) {
        consumeBindingNecklaceCharge(player, services);
    }
}

function consumeBindingNecklaceCharge(player: PlayerState, services: ScriptServices): void {
    const { remaining, disintegrated } = nextBindingNecklaceCharges(
        player.equipment.getCharges(BINDING_NECKLACE_ID),
    );
    player.equipment.setCharges(BINDING_NECKLACE_ID, remaining);
    if (disintegrated) {
        const equip = services.equipment.getEquipArray(player);
        if (Array.isArray(equip) && equip[EquipmentSlot.AMULET] === BINDING_NECKLACE_ID) {
            equip[EquipmentSlot.AMULET] = -1;
        }
        player.markEquipmentDirty();
        services.appearance.queueAppearanceSnapshot(player);
        services.messaging.sendGameMessage(player, "Your Binding necklace has disintegrated.");
        return;
    }
    const unit = remaining === 1 ? "charge" : "charges";
    services.messaging.sendGameMessage(
        player,
        `You have ${remaining} ${unit} left before your Binding necklace disintegrates.`,
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

    registerCraftHandlers(registry, altar);

    const imbue = (event: ItemOnLocEvent) => imbueTiara(altar, event.player, event.services);
    registry.registerItemOnLoc(BLANK_TIARA, altar.altarLocId, imbue);
    registry.registerItemOnLoc(altar.talismanId, altar.altarLocId, imbue);

    for (const binding of combinationBindingsForAltar(altar.id)) {
        const craftCombo = (event: ItemOnLocEvent) =>
            craftCombination(binding, event.player, event.services);
        registry.registerItemOnLoc(binding.opposing.talismanId, altar.altarLocId, craftCombo);
        registry.registerItemOnLoc(binding.opposing.tiaraId, altar.altarLocId, craftCombo);
        registry.registerItemOnLoc(binding.opposing.runeId, altar.altarLocId, craftCombo);
    }

    registry.registerLocInteraction(altar.portalLocId, (event) => exitAltar(altar, event), "use");
    registry.registerLocInteraction(altar.portalLocId, (event) => exitAltar(altar, event), "exit");
    registry.registerLocInteraction(altar.portalLocId, (event) => exitAltar(altar, event), undefined);
}

function registerCraftHandlers(registry: IScriptRegistry, altar: RuneCraftDef): void {
    const craftFromLoc = (event: LocInteractionEvent) =>
        craftRunes(altar, event.player, event.services);
    const craftFromItem = (event: ItemOnLocEvent) => craftRunes(altar, event.player, event.services);

    registry.registerLocInteraction(altar.altarLocId, craftFromLoc, "craft-rune");
    registry.registerLocInteraction(altar.altarLocId, craftFromLoc, "craft rune");
    registry.registerLocInteraction(altar.altarLocId, craftFromLoc, undefined);
    if (altar.essenceItemId != null) {
        registry.registerItemOnLoc(altar.essenceItemId, altar.altarLocId, craftFromItem);
    } else {
        registry.registerItemOnLoc(RUNE_ESSENCE, altar.altarLocId, craftFromItem);
        registry.registerItemOnLoc(PURE_ESSENCE, altar.altarLocId, craftFromItem);
    }
}

export function register(registry: IScriptRegistry): void {
    for (const altar of ALL_ALTARS) {
        registerAltar(registry, altar);
    }
    for (const altar of WALKUP_ALTARS) {
        registerCraftHandlers(registry, altar);
    }
    registerAbyss(registry);
    registerPouches(registry);
    registerDarkEssence(registry);
}
