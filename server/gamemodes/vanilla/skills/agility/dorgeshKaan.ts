/**
 * Dorgesh-Kaan Agility Course (level 70; current OSRS XP, 2750/lap agility-agility).
 * Fail-proof (OSRS cables/ladders can fail even at 99; not ported).
 * Turgall 2295 Talk-to grants spanner 10975 and requests one heavy + one delicate part.
 * Spanner-on-boiler 22635 / console 22634 collects the requested part; delivery bonus is
 * 2432 Agility (agility both ways), 1142 Ranged (grapple both ways), or 1216 Agility + 571 Ranged (mixed).
 * Grapple pylons need 70 Agility/Strength/Ranged, a crossbow, and mith grapple 9419 (never breaks).
 * Marks of Grace, light source, Death to the Dorgeshuun lock, and teleport-break are not wired.
 */
import { EquipmentSlot } from "../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../src/game/player";
import type {
    IScriptRegistry,
    ItemOnLocEvent,
    ItemOnNpcEvent,
    LocInteractionEvent,
    NpcInteractionEvent,
} from "../../../../src/game/scripts/types";

const LOG_WALK_ANIM = 762; // human_walk_logbalance (walk-across cable)
const ZIP_ANIM = 751; // human_ropeswing (swing cable / pylon)
const MONKEYBARS_ANIM = 744; // human_monkeybars (ladder)
const LEDGE_ANIM = 756; // human_walk_sidestep (jutting wall)
const PIPE_CRAWL_ANIM = 844; // human_pipecrawling (tunnel)

const CABLE_WALK_SPAN = 8;
const CABLE_SWING_SPAN = 6;
const LADDER_SPAN = 8;
const WALL_SPAN = 2;
const TUNNEL_SPAN = 3;
const PYLON_SPAN = 10;

const CABLE_WALK_TICKS = 8;
const CABLE_SWING_TICKS = 6;
const LADDER_TICKS = 8;
const WALL_TICKS = 2;
const TUNNEL_TICKS = 7;
const PYLON_TICKS = 8;

const COURSE_LEVEL = 70;
const TURGALL_NPC_ID = 2295;
const SPANNER_ITEM_ID = 10975;
const BOILER_LOC_ID = 22635;
const CONSOLE_LOC_ID = 22634;
const MITH_GRAPPLE_ID = 9419;

const POWERBOX_ID = 10993;
const LEVER_ID = 10991;
const COG_ID = 10983;
const CAPACITOR_ID = 10989;
const FUSE_ID = 10985;
const METER_ID = 10987;

const HEAVY_PARTS = new Set([POWERBOX_ID, LEVER_ID, COG_ID]);
const DELICATE_PARTS = new Set([CAPACITOR_ID, FUSE_ID, METER_ID]);
const ALL_PARTS = [...HEAVY_PARTS, ...DELICATE_PARTS];

const AGILITY_BOTH_BONUS = 2432;
const GRAPPLE_BOTH_RANGED_BONUS = 1142;
const MIXED_AGILITY_BONUS = 1216;
const MIXED_RANGED_BONUS = 571;
const PYLON_XP = 18;

/** Any crossbow except love crossbow / ballistae (wiki: any crossbow works). */
const CROSSBOW_IDS = new Set([
    837, 9174, 9176, 9177, 9179, 9181, 9183, 9185, 21902, 11785, 26374, 4734, 4934, 8880, 10156,
    21012,
]);

type RouteKind = "agility" | "grapple";

interface LapState {
    requestedHeavy: number;
    requestedDelicate: number;
    outbound: RouteKind | null;
    inbound: RouteKind | null;
    collected: boolean;
}

/** playerId → current lap. */
const laps = new Map<number, LapState>();

interface ObstacleDef {
    locIds: number[];
    actions: Array<string | undefined>;
    run: (event: LocInteractionEvent) => void;
}

function playMove(
    event: LocInteractionEvent,
    destX: number,
    destY: number,
    destLevel: number,
    anim: number,
    moveTicks: number,
): void {
    const { player, services, tick } = event;
    const startTile = { x: player.tileX, y: player.tileY };
    const startLevel = player.level;
    const endTile = { x: destX, y: destY };
    services.movement.teleportPlayer(player, destX, destY, destLevel);
    if (
        moveTicks > 0 &&
        destLevel === startLevel &&
        (destX !== startTile.x || destY !== startTile.y)
    ) {
        services.movement.queueForcedMovement(player, {
            startTile,
            endTile,
            endTick: tick + moveTicks,
        });
    }
    player.clearPendingSeqs();
    services.animation.playPlayerSeq(player, anim);
}

function destPast(
    player: PlayerState,
    tile: { x: number; y: number },
    span: number,
): { x: number; y: number } {
    let dx = Math.sign(tile.x - player.tileX);
    let dy = Math.sign(tile.y - player.tileY);
    if (Math.abs(tile.x - player.tileX) >= Math.abs(tile.y - player.tileY)) {
        dy = 0;
        if (dx === 0) dx = 1;
    } else {
        dx = 0;
        if (dy === 0) dy = 1;
    }
    return { x: tile.x + dx * span, y: tile.y + dy * span };
}

function boostedLevel(event: LocInteractionEvent, skillId: SkillId): number {
    const skill = event.services.skills.getSkill(event.player, skillId);
    return Math.max(1, (skill?.baseLevel ?? 1) + (skill?.boost ?? 0));
}

function requireCourseLevel(event: LocInteractionEvent): boolean {
    if (boostedLevel(event, SkillId.Agility) >= COURSE_LEVEL) {
        return true;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        "You need an Agility level of 70 to attempt this.",
    );
    return false;
}

function equipped(event: LocInteractionEvent, slot: number): number {
    return event.services.equipment?.getEquippedItem?.(event.player, slot) ?? 0;
}

function requireGrappleKit(event: LocInteractionEvent): boolean {
    if (
        boostedLevel(event, SkillId.Strength) < COURSE_LEVEL ||
        boostedLevel(event, SkillId.Ranged) < COURSE_LEVEL
    ) {
        event.services.messaging.sendGameMessage(
            event.player,
            "You need Agility, Strength and Ranged levels of 70 to attempt this.",
        );
        return false;
    }
    const weapon = equipped(event, EquipmentSlot.WEAPON);
    const ammo = equipped(event, EquipmentSlot.AMMO);
    if (CROSSBOW_IDS.has(weapon) && ammo === MITH_GRAPPLE_ID) {
        return true;
    }
    event.services.messaging.sendGameMessage(
        event.player,
        "You need a crossbow and a mithril grapple equipped to attempt this.",
    );
    return false;
}

function itemCount(player: PlayerState, itemId: number): number {
    return player.items?.getItemCount(itemId) ?? 0;
}

function carriedPart(player: PlayerState): number | undefined {
    return ALL_PARTS.find((id) => itemCount(player, id) > 0);
}

function partName(itemId: number): string {
    switch (itemId) {
        case POWERBOX_ID:
            return "powerbox";
        case LEVER_ID:
            return "lever";
        case COG_ID:
            return "cog";
        case CAPACITOR_ID:
            return "capacitor";
        case FUSE_ID:
            return "fuse";
        case METER_ID:
            return "meter";
        default:
            return "part";
    }
}

function markRoute(playerId: number, route: RouteKind): void {
    const lap = laps.get(playerId);
    if (!lap) {
        return;
    }
    if (lap.collected) {
        lap.inbound = route;
    } else if (lap.outbound === null) {
        lap.outbound = route;
    }
}

function blockedByPart(player: PlayerState, route: RouteKind): string | undefined {
    const part = carriedPart(player);
    if (part === undefined) {
        return undefined;
    }
    if (route === "grapple" && HEAVY_PARTS.has(part)) {
        return "You can't take that heavy part across the pylons.";
    }
    if (route === "agility" && DELICATE_PARTS.has(part)) {
        return "That delicate part would be crushed on this route.";
    }
    return undefined;
}

function traverse(
    event: LocInteractionEvent,
    route: RouteKind,
    span: number,
    anim: number,
    moveTicks: number,
    agilityXp: number,
    startMessage: string,
    extraXp?: Array<{ skill: SkillId; amount: number }>,
): void {
    if (!requireCourseLevel(event)) {
        return;
    }
    if (route === "grapple" && !requireGrappleKit(event)) {
        return;
    }
    const blocked = blockedByPart(event.player, route);
    if (blocked) {
        event.services.messaging.sendGameMessage(event.player, blocked);
        return;
    }
    const dest = destPast(event.player, event.tile, span);
    playMove(event, dest.x, dest.y, event.player.level, anim, moveTicks);
    event.services.messaging.sendGameMessage(event.player, startMessage);
    if (agilityXp > 0) {
        event.services.skills.addSkillXp(event.player, SkillId.Agility, agilityXp);
    }
    for (const extra of extraXp ?? []) {
        event.services.skills.addSkillXp(event.player, extra.skill, extra.amount);
    }
    markRoute(event.player.id, route);
}

function walkCable(event: LocInteractionEvent): void {
    traverse(
        event,
        "agility",
        CABLE_WALK_SPAN,
        LOG_WALK_ANIM,
        CABLE_WALK_TICKS,
        25,
        "You walk carefully across the cable...",
    );
}

function swingCable(event: LocInteractionEvent): void {
    traverse(
        event,
        "agility",
        CABLE_SWING_SPAN,
        ZIP_ANIM,
        CABLE_SWING_TICKS,
        22,
        "You swing across the hanging cable...",
    );
}

function swingLadder(event: LocInteractionEvent): void {
    traverse(
        event,
        "agility",
        LADDER_SPAN,
        MONKEYBARS_ANIM,
        LADDER_TICKS,
        25,
        "You swing across the ladder...",
    );
}

function squeezeWall(event: LocInteractionEvent): void {
    traverse(
        event,
        "agility",
        WALL_SPAN,
        LEDGE_ANIM,
        WALL_TICKS,
        7.5,
        "You squeeze past the jutting wall...",
    );
}

function squeezeTunnel(event: LocInteractionEvent): void {
    traverse(
        event,
        "agility",
        TUNNEL_SPAN,
        PIPE_CRAWL_ANIM,
        TUNNEL_TICKS,
        7.5,
        "You squeeze into the tunnel...",
    );
}

function grapplePylon(event: LocInteractionEvent): void {
    traverse(
        event,
        "grapple",
        PYLON_SPAN,
        ZIP_ANIM,
        PYLON_TICKS,
        PYLON_XP,
        "You fire a grapple at the pylon...",
        [
            { skill: SkillId.Strength, amount: PYLON_XP },
            { skill: SkillId.Ranged, amount: PYLON_XP },
        ],
    );
}

function ensureLap(playerId: number): LapState {
    let lap = laps.get(playerId);
    if (!lap) {
        lap = {
            requestedHeavy: POWERBOX_ID,
            requestedDelicate: CAPACITOR_ID,
            outbound: null,
            inbound: null,
            collected: false,
        };
        laps.set(playerId, lap);
    }
    return lap;
}

function giveSpanner(player: PlayerState, services: LocInteractionEvent["services"]): boolean {
    if (itemCount(player, SPANNER_ITEM_ID) > 0) {
        return true;
    }
    const result = services.inventory.addItemToInventory(player, SPANNER_ITEM_ID, 1);
    if (result.added !== 1) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(player, "Turgall gives you a spanner.");
    return true;
}

function givePart(
    player: PlayerState,
    services: LocInteractionEvent["services"],
    itemId: number,
): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, 1);
    if (result.added !== 1) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    services.messaging.sendGameMessage(player, `You disassemble a ${partName(itemId)}.`);
    return true;
}

function collectFromMachine(event: ItemOnLocEvent, heavy: boolean): void {
    const { player, services } = event;
    if (itemCount(player, SPANNER_ITEM_ID) <= 0) {
        services.messaging.sendGameMessage(player, "You need a spanner to disassemble that.");
        return;
    }
    const lap = laps.get(player.id);
    if (!lap) {
        services.messaging.sendGameMessage(player, "Turgall hasn't asked you to fetch a part yet.");
        return;
    }
    if (lap.collected || carriedPart(player) !== undefined) {
        services.messaging.sendGameMessage(player, "You already have a generator part.");
        return;
    }
    const itemId = heavy ? lap.requestedHeavy : lap.requestedDelicate;
    if (!givePart(player, services, itemId)) {
        return;
    }
    lap.collected = true;
}

function awardDeliveryBonus(
    player: PlayerState,
    services: LocInteractionEvent["services"],
    outbound: RouteKind,
    inbound: RouteKind,
): void {
    if (outbound === "agility" && inbound === "agility") {
        services.skills.addSkillXp(player, SkillId.Agility, AGILITY_BOTH_BONUS);
        return;
    }
    if (outbound === "grapple" && inbound === "grapple") {
        services.skills.addSkillXp(player, SkillId.Ranged, GRAPPLE_BOTH_RANGED_BONUS);
        return;
    }
    services.skills.addSkillXp(player, SkillId.Agility, MIXED_AGILITY_BONUS);
    services.skills.addSkillXp(player, SkillId.Ranged, MIXED_RANGED_BONUS);
}

function deliverPart(player: PlayerState, services: LocInteractionEvent["services"]): void {
    const lap = laps.get(player.id);
    if (!lap) {
        if (!giveSpanner(player, services)) {
            return;
        }
        ensureLap(player.id);
        services.messaging.sendGameMessage(
            player,
            "Turgall asks you to fetch a powerbox or a capacitor.",
        );
        return;
    }
    const part = [lap.requestedHeavy, lap.requestedDelicate].find((id) => itemCount(player, id) > 0);
    if (part === undefined) {
        if (!giveSpanner(player, services)) {
            return;
        }
        services.messaging.sendGameMessage(
            player,
            `Turgall asks you to fetch a ${partName(lap.requestedHeavy)} or a ${partName(lap.requestedDelicate)}.`,
        );
        return;
    }
    if (!lap.collected || lap.outbound === null || lap.inbound === null) {
        services.messaging.sendGameMessage(
            player,
            "You need to fetch a requested part across the course first.",
        );
        return;
    }
    const removed = player.items.removeItem(part, 1, { assureFullRemoval: true });
    if (removed.completed !== 1) {
        services.messaging.sendGameMessage(player, "You don't have a part to give.");
        return;
    }
    services.inventory.snapshotInventory(player);
    awardDeliveryBonus(player, services, lap.outbound, lap.inbound);
    services.messaging.sendGameMessage(player, `You give the ${partName(part)} to Turgall.`);
    services.messaging.sendGameMessage(player, "You have completed the Dorgesh-Kaan Agility course.");
    laps.delete(player.id);
}

function talkToTurgall(event: NpcInteractionEvent): void {
    deliverPart(event.player, event.services);
}

function usePartOnTurgall(event: ItemOnNpcEvent): void {
    deliverPart(event.player, event.services);
}

function useSpannerOnBoiler(event: ItemOnLocEvent): void {
    collectFromMachine(event, true);
}

function useSpannerOnConsole(event: ItemOnLocEvent): void {
    collectFromMachine(event, false);
}

const OBSTACLES: ObstacleDef[] = [
    {
        locIds: [22569],
        actions: ["walk-across", "walk across", "cross", undefined],
        run: walkCable,
    },
    {
        locIds: [22572],
        actions: ["swing", undefined],
        run: swingCable,
    },
    {
        locIds: [22564],
        actions: ["swing-across", "swing across", "swing", undefined],
        run: swingLadder,
    },
    {
        locIds: [22552],
        actions: ["squeeze-past", "squeeze past", "squeeze", undefined],
        run: squeezeWall,
    },
    {
        locIds: [22557],
        actions: ["squeeze-through", "squeeze through", "squeeze", undefined],
        run: squeezeTunnel,
    },
    {
        locIds: [22664],
        actions: ["grapple", undefined],
        run: grapplePylon,
    },
];

export function register(registry: IScriptRegistry): void {
    for (const obstacle of OBSTACLES) {
        for (const locId of obstacle.locIds) {
            for (const action of obstacle.actions) {
                registry.registerLocInteraction(locId, obstacle.run, action);
            }
        }
    }
    // Optional: other agility tests only mock registerLocInteraction.
    registry.registerNpcInteraction?.(TURGALL_NPC_ID, talkToTurgall, "talk-to");
    registry.registerNpcInteraction?.(TURGALL_NPC_ID, talkToTurgall, "talk to");
    registry.registerNpcInteraction?.(TURGALL_NPC_ID, talkToTurgall, "help");
    registry.registerNpcInteraction?.(TURGALL_NPC_ID, talkToTurgall, undefined);
    registry.registerItemOnLoc?.(SPANNER_ITEM_ID, BOILER_LOC_ID, useSpannerOnBoiler);
    registry.registerItemOnLoc?.(SPANNER_ITEM_ID, CONSOLE_LOC_ID, useSpannerOnConsole);
    for (const partId of ALL_PARTS) {
        registry.registerItemOnNpc?.(partId, TURGALL_NPC_ID, usePartOnTurgall);
    }
}

/** Test helper: clear lap tracking for one player or all players. */
export function resetDorgeshKaanCourseProgress(playerId?: number): void {
    if (playerId === undefined) {
        laps.clear();
        return;
    }
    laps.delete(playerId);
}

export function getDorgeshKaanCourseStage(playerId: number): number {
    const lap = laps.get(playerId);
    if (!lap) {
        return 0;
    }
    return lap.collected ? 2 : 1;
}

/** Test helper: assign Turgall's requested parts (defaults are powerbox + capacitor). */
export function setDorgeshKaanRequestedParts(
    playerId: number,
    requestedHeavy: number,
    requestedDelicate: number,
): void {
    const lap = ensureLap(playerId);
    lap.requestedHeavy = requestedHeavy;
    lap.requestedDelicate = requestedDelicate;
}
