import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ActionEffect, ActionExecutionResult } from "../../../../src/game/actions/types";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    InvSpellEvent,
    ScriptActionHandlerContext,
    ScriptInventoryEntry,
    ScriptServices,
    WidgetActionEvent,
} from "../../../../src/game/scripts/types";
import { getSpellDataProvider } from "../../../../src/game/spells/SpellDataProvider";
import {
    type BonesToBananasSpell,
    BANANA_ITEM_ID,
    BONES_TO_BANANAS_SPELL_ID,
    countConvertibleBones,
    getBonesToBananasSpell,
    isConvertibleBone,
} from "./bonesToBananasData";

const BONES_TO_BANANAS_GROUP = "skill.bones_to_bananas";
const SPELLBOOK_GROUP_ID = 218;

type InventoryEntry = ScriptInventoryEntry;

export type BonesToBananasCastResult = {
    ok: boolean;
    reason?: string;
    silent?: boolean;
};

function buildMessageEffect(player: PlayerState, message: string): ActionEffect {
    return { type: "message", playerId: player.id, message };
}

function countItem(entries: InventoryEntry[], itemId: number): number {
    let total = 0;
    for (const entry of entries) {
        if (entry.itemId === itemId) total += Math.max(0, entry.quantity);
    }
    return total;
}

function magicLevel(player: PlayerState, services: ScriptServices): number {
    const skill = services.skills.getSkill(player, SkillId.Magic);
    return Math.max(1, (skill?.baseLevel ?? 1) + (skill?.boost ?? 0));
}

function consumeQuantity(
    services: ScriptServices,
    player: PlayerState,
    itemId: number,
    quantity: number,
): boolean {
    if (!(itemId > 0) || !(quantity > 0)) return true;
    let remaining = quantity;
    const inventory = services.inventory.getInventoryItems(player);
    for (const entry of inventory) {
        if (remaining <= 0) break;
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const take = Math.min(remaining, entry.quantity);
        const nextQty = entry.quantity - take;
        if (nextQty > 0) {
            services.inventory.setInventorySlot(player, entry.slot, itemId, nextQty);
        } else {
            services.inventory.setInventorySlot(player, entry.slot, -1, 0);
        }
        remaining -= take;
    }
    return remaining <= 0;
}

function restoreQuantity(
    services: ScriptServices,
    player: PlayerState,
    itemId: number,
    quantity: number,
): void {
    if (!(itemId > 0) || !(quantity > 0)) return;
    services.inventory.addItemToInventory(player, itemId, quantity);
}

function validateRunes(
    services: ScriptServices,
    player: PlayerState,
    spell: BonesToBananasSpell,
): {
    canCast: boolean;
    runesConsumed: Array<{ runeId: number; quantity: number }>;
} {
    const costs = [...spell.runeCosts];
    const inventory = services.inventory.getInventoryItems(player).map((entry) => ({
        itemId: entry.itemId,
        quantity: entry.quantity,
    }));
    const equipped = (services.equipment?.getEquipArray?.(player) ?? []).filter((id) => id > 0);
    const result = services.combat.validateRunes?.(costs, inventory, equipped);
    if (result) {
        return {
            canCast: result.canCast === true,
            runesConsumed: Array.isArray(result.runesConsumed) ? result.runesConsumed : [],
        };
    }
    for (const cost of costs) {
        if (countItem(services.inventory.getInventoryItems(player), cost.runeId) < cost.quantity) {
            return { canCast: false, runesConsumed: [] };
        }
    }
    return { canCast: true, runesConsumed: costs };
}

function convertBones(
    services: ScriptServices,
    player: PlayerState,
    productItemId: number,
): number {
    const inventory = services.inventory.getInventoryItems(player);
    let converted = 0;
    for (const entry of inventory) {
        if (!isConvertibleBone(entry.itemId) || entry.quantity <= 0) continue;
        const qty = entry.quantity;
        services.inventory.setInventorySlot(player, entry.slot, productItemId, qty);
        converted += qty;
    }
    return converted;
}

function failureMessage(reason: string, spell?: BonesToBananasSpell): string | undefined {
    switch (reason) {
        case "bones_to_bananas_no_bones":
            return "You have no bones to convert.";
        case "level_requirement":
            return `You need a Magic level of ${spell?.level ?? 1} to cast this spell.`;
        case "out_of_runes":
            return "You do not have enough runes to cast this spell.";
        default:
            return undefined;
    }
}

function sendFailure(
    services: ScriptServices,
    player: PlayerState,
    reason: string,
    spell?: BonesToBananasSpell,
): BonesToBananasCastResult {
    const text = failureMessage(reason, spell);
    if (text) services.messaging.sendGameMessage(player, text);
    return { ok: false, reason };
}

function enqueueBonesToBananas(
    services: ScriptServices,
    player: PlayerState,
    spell: BonesToBananasSpell,
    tick?: number,
): boolean {
    const delay = Math.max(1, spell.delayTicks);
    const currentTick = Number.isFinite(tick) ? (tick as number) : services.system.getCurrentTick();
    const requestAction = services.combat.requestAction;
    if (!requestAction) return false;
    const result = requestAction(
        player,
        {
            kind: BONES_TO_BANANAS_GROUP,
            data: {},
            delayTicks: delay,
            cooldownTicks: delay,
            groups: [BONES_TO_BANANAS_GROUP],
        },
        currentTick,
    );
    return result.ok;
}

export function beginBonesToBananasCast(
    player: PlayerState,
    services: ScriptServices,
    spellId: number,
    tick?: number,
): BonesToBananasCastResult {
    const spell = getBonesToBananasSpell(spellId);
    if (!spell) return { ok: false, reason: "invalid_spell", silent: true };

    if (magicLevel(player, services) < spell.level) {
        return sendFailure(services, player, "level_requirement", spell);
    }

    const inventory = services.inventory.getInventoryItems(player);
    if (countConvertibleBones(inventory) < 1) {
        return sendFailure(services, player, "bones_to_bananas_no_bones", spell);
    }

    const runes = validateRunes(services, player, spell);
    if (!runes.canCast) {
        return sendFailure(services, player, "out_of_runes", spell);
    }

    if (!enqueueBonesToBananas(services, player, spell, tick)) {
        services.messaging.sendGameMessage(player, "You can't cast that yet.");
        return { ok: false, reason: "cooldown" };
    }
    return { ok: true };
}

function handleInvSpell(event: InvSpellEvent): void {
    const result = beginBonesToBananasCast(event.player, event.services, event.spellId, event.tick);
    if (!event.spellResult) return;
    event.spellResult.outcome = result.ok ? "success" : "failure";
    event.spellResult.reason = result.ok ? undefined : result.reason;
}

function handleSpellbookClick(event: WidgetActionEvent): void {
    if (event.groupId !== SPELLBOOK_GROUP_ID) return;
    if ((event.opId ?? 1) !== 1) return;

    const provider = getSpellDataProvider();
    if (!provider) return;
    const spellData = provider.getSpellDataByWidget(SPELLBOOK_GROUP_ID, event.childId);
    if (!spellData) return;
    if (!getBonesToBananasSpell(spellData.id)) return;

    beginBonesToBananasCast(event.player, event.services, spellData.id, event.tick);
}

function executeBonesToBananasAction(ctx: ScriptActionHandlerContext): ActionExecutionResult {
    const { player, services } = ctx;
    const spell = getBonesToBananasSpell(BONES_TO_BANANAS_SPELL_ID);
    if (!spell) {
        return { ok: true, effects: [buildMessageEffect(player, "You can't convert those.")] };
    }

    if (magicLevel(player, services) < spell.level) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(
                    player,
                    `You need a Magic level of ${spell.level} to cast this spell.`,
                ),
            ],
        };
    }

    const inventory = services.inventory.getInventoryItems(player);
    if (countConvertibleBones(inventory) < 1) {
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You have no bones to convert.")],
        };
    }

    const runes = validateRunes(services, player, spell);
    if (!runes.canCast) {
        return {
            ok: true,
            effects: [
                buildMessageEffect(player, "You do not have enough runes to cast this spell."),
            ],
        };
    }

    const consumedRunes: Array<{ runeId: number; quantity: number }> = [];
    for (const rune of runes.runesConsumed) {
        if (!consumeQuantity(services, player, rune.runeId, rune.quantity)) {
            for (const done of consumedRunes) {
                restoreQuantity(services, player, done.runeId, done.quantity);
            }
            return {
                ok: true,
                effects: [
                    buildMessageEffect(player, "You do not have enough runes to cast this spell."),
                ],
            };
        }
        consumedRunes.push(rune);
    }

    const converted = convertBones(services, player, BANANA_ITEM_ID);
    if (converted < 1) {
        for (const done of consumedRunes) {
            restoreQuantity(services, player, done.runeId, done.quantity);
        }
        return {
            ok: true,
            effects: [buildMessageEffect(player, "You have no bones to convert.")],
        };
    }

    services.animation.playPlayerSeq(player, spell.animation);
    services.animation.broadcastPlayerSpot?.(player, spell.castSpotAnim, 100, 0);
    services.sound.playAreaSound?.({
        soundId: spell.castSoundId,
        tile: { x: player.tileX ?? 0, y: player.tileY ?? 0 },
        level: player.level ?? 0,
        radius: 5,
    });
    services.skills.addSkillXp(player, SkillId.Magic, spell.xp);

    return {
        ok: true,
        cooldownTicks: spell.delayTicks,
        groups: [BONES_TO_BANANAS_GROUP],
        effects: [
            { type: "inventorySnapshot", playerId: player.id },
            buildMessageEffect(player, "You convert the bones into bananas."),
        ],
    };
}

export function register(registry: IScriptRegistry, _services: ScriptServices): void {
    registry.registerActionHandler(BONES_TO_BANANAS_GROUP, executeBonesToBananasAction);
    registry.registerSpellOnItem(BONES_TO_BANANAS_SPELL_ID, handleInvSpell);
    registry.registerWidgetAction({
        handler: handleSpellbookClick,
    });
}
