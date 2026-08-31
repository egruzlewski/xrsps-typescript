# Server implementation status

Code-read snapshot of **2026-08-31**. This is an audit of what exists in the tree, not a playtest report and not an OSRS-parity claim.

**In scope:** [`server/src/`](../server/src/) (engine) and [`server/gamemodes/vanilla/`](../server/gamemodes/vanilla/) (vanilla content).

**Out of scope:** [`server/gamemodes/leagues-v/`](../server/gamemodes/leagues-v/) internals, the client, and in-game verification. Extrascripts: only [`server/extrascripts/item-spawner/`](../server/extrascripts/item-spawner/) is discovered by [`ExtrascriptLoader`](../server/src/game/scripts/ExtrascriptLoader.ts).

Architecture (how the pieces fit) lives in [Architecture](/ARCHITECTURE). This page answers “what is wired, what is thin, what is missing.”

## Legend

| Status | Meaning |
| --- | --- |
| **Wired** | Used on a real tick, login, or packet path. Core loops exist. |
| **Partial** | Wired, but TODOs, missing content, or thin coverage vs a full OSRS system. |
| **Scaffold** | Types, hooks, or registries exist with little or no gameplay content (or empty mechanic bodies). |
| **Missing** | Expected OSRS system with no dedicated module. |
| **Unverified** | Code is present and large; tests or comments are too thin to claim more than “present.” |

Each section lists a **path**, **what is wired**, **gaps**, **tests**, and a **next step** only when the gap is obvious from code.

---

## Executive gap list

Start here if you want a development path. Ordered roughly by “missing entire systems” then “wired but incomplete.”

### Missing (no vanilla/engine skill or game system)

- **Construction, Slayer, Hunter, Farming** skill gameplay — `SkillId` exists in [`client/rs/skill/skills.ts`](../client/rs/skill/skills.ts); no folders under [`server/gamemodes/vanilla/skills/`](../server/gamemodes/vanilla/skills/). Skill-guide UI still lists them.
- **Grand Exchange, clue scrolls, Pest Control, Duel Arena, POH building, clans / friends list (private chat), GE-style economy.** Friends Chat (clan-chat-style channel) *does* exist; a traditional friends/ignore *list UI* is not a separate world system beyond Friends Chat persistence.
- **Vanilla custom content packet** — `leagues-v` implements `getContentDataPacket()`; vanilla does not. Custom items 50000+ will not reach a vanilla client unless that hook is added.
- **Members-world / PvP-world / Duel Arena detection** — explicit TODOs in shops and multi-combat.

### Scaffold or hollow mechanics

- **Boss scripts** — [`BossScriptFramework`](../server/src/game/combat/BossScriptFramework.ts) plus Giant Mole, Dagannoth Kings, Graardor, Zulrah in [`BossCombatScript.ts`](../server/gamemodes/vanilla/combat/BossCombatScript.ts). Giant Mole `dig_escape` teleports the mole to a random lair chamber (player stays put). Zulrah snakeling `execute` spawns melee/mage snakelings (2045/2046) on shrine tiles (player stays put). Zulrah venom-cloud `execute` is still an empty comment.
- **Achievement diary journal UI** — widget opens and can show static/varbit-driven text; no diary *task engine* that completes tasks from gameplay.
- **Custom widgets** — [`CustomWidgetRegistry`](../server/src/game/scripts/CustomWidgetRegistry.ts) can serialize groups; vanilla does not deliver them to the client.

### Partial (high-leverage)

- **Agility** — full Gnome Stronghold (110.5/lap), Barbarian Outpost (153.3 Agility + 41.3 Strength/lap), Wilderness (571.4/lap, dispenser tickets), Draynor Village rooftop (120/lap), Al Kharid rooftop (216/lap), Varrock rooftop (270/lap), Canifis rooftop (240/lap; Marks of Grace not spawned), Falador rooftop (586/lap; Marks of Grace not spawned), and Seers' Village rooftop (570/lap; Marks of Grace not spawned). Other rooftops and courses still missing.
- **Runecraft** — F2P plus members ruins altars (Air–Body, Cosmic, Chaos, Nature, Law, Death, Blood, Wrath), walk-up Astral (Lunar Diplomacy is not registered, so no quest lock), walk-up Kourend Blood and Arceuus Soul (dark essence fragments; dense mine / Dark Altar / chisel skipped), combination runes (Mist–Lava; 50% bind per essence, 100% with a worn binding necklace 5521 that spends 1 of 16 charges per craft), tiara imbuing at those ruins altars, Abyss inner-ring entry (wilderness Mage of Zamorak teleport plus Air–Blood rifts; no Wrath rift), and essence pouches (small–giant plus colossal; fill/empty/check rune or pure essence; degrade on fill via equipment charges; Dark Mage 2583 repairs). Outer obstacles / skulling skipped.
- **Crafting** — flax, shearing, spinning, jewellery (gold/silver + gems including onyx/zenyte and opal/jade/topaz), gem cutting (opal/jade/topaz crush chance), leather/dragonhide/snakeskin armour, pottery, glassblowing, battlestaves (charged orb + staff), weaving (loom: cloth/sack/basket/drift net/fabric bolts).
- **Sailing** — engine world-views + Pandemonium content, not a full skill.
- **World content** — hubs listed under vanilla scripts, not the whole map. Unscripted locs/NPCs fall through to default talk / nothing interesting.
- **Quests** — 64 registered. Ten of those are compressed “preservation remainder” implementations, not full-folder ports. Many later F2P/P2P quests are absent entirely.
- **PvP / wilderness** — PvP hit path and wilderness helpers exist; PvP *world type* and Duel Arena are TODO.
- **Degradation** — crystal-bow (and related) charge logic; modern crystal bow varbit ID is a TODO (`4212` placeholder).
- **Shops** — `isMembersWorld = false` hardcoded TODO.
- **OSRS opcode `OPNPC5` (id 50)** — decoded as NPC option 5 (same 3-byte layout as this client's legacy `OPNPC1` alias for option 5). See protocol section.

### Skills with dedicated modules (still not full OSRS)

Mining, woodcutting, fishing, firemaking, smithing, cooking/tanning/bolt enchant, fletching, herblore, thieving (pickpocket + picklock + stalls + chests), prayer (bones/ashes + altars), consumables: **Partial** — data-driven for a subset of recipes/locs, not every OSRS node.

---

## Engine (`server/src`)

### Boot, config, cache

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`server/src/index.ts`](../server/src/index.ts), [`server/src/config/`](../server/src/config/), [`server/src/world/CacheEnv.ts`](../server/src/world/CacheEnv.ts), [`server/src/paths.ts`](../server/src/paths.ts) |
| **Wired** | Cache from `caches/`, precomputed collision, `PathService`, gamemode from `GAMEMODE` / `config.json`, NPC spawn file, `WSServer`. Viewport enum 1745 with hardcoded fallback if missing. |
| **Gaps** | None obvious in boot itself. Cache files are gitignored; collision must be built (`yarn --cwd server build-collision`). |
| **Tests** | Indirect (`authentication`, `instance-parity`, `collision-encoder`). |
| **Next step** | — |

### Tick loop

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`TickPhaseOrchestrator.ts`](../server/src/game/tick/TickPhaseOrchestrator.ts), [`ticker.ts`](../server/src/game/ticker.ts), [`TickPhaseService.ts`](../server/src/game/services/TickPhaseService.ts), [`TickFrameService.ts`](../server/src/game/services/TickFrameService.ts) |
| **Wired** | `client_input` drain, then `broadcast` → `pre_movement` → `movement` → `music` → `scripts` → `actions` → `combat` → `death` → `post_scripts` → `post_effects` → `orphaned_players` → `scheduled_scripts` → `broadcast_phase`. Autosave after the tick. Per-stage error logging; restore drained buffers if `broadcast_phase` fails. `TICK_PROFILE=1` for timing. |
| **Gaps** | Not a 4-step sketch; do not “simplify” this list. |
| **Tests** | [`tick-action-phase.test.ts`](../server/tests/tick-action-phase.test.ts), [`consumable-action-phase.test.ts`](../server/tests/consumable-action-phase.test.ts) |
| **Next step** | — |

### Networking (WebSocket, auth, login)

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`wsServer.ts`](../server/src/network/wsServer.ts), [`AuthenticationService.ts`](../server/src/network/AuthenticationService.ts), [`LoginHandshakeService.ts`](../server/src/network/LoginHandshakeService.ts), [`AccountStore.ts`](../server/src/network/AccountStore.ts), [`PlayerPermission.ts`](../server/src/network/PlayerPermission.ts) |
| **Wired** | Binary WebSocket, login rate limits, account create/claim flags, admin/mod/dev username env lists, handshake including appearance set, gamemode content packet *if* the gamemode implements it. |
| **Gaps** | Vanilla does not send custom content. Dual protocol (see below). |
| **Tests** | [`authentication.test.ts`](../server/tests/authentication.test.ts), [`login-reservation.test.ts`](../server/tests/login-reservation.test.ts) |
| **Next step** | Vanilla `getContentDataPacket()` only if custom items/widgets must reach the client. |

### Dual client protocol

Two opcode spaces are decoded on the server:

1. **OSRS-style (low opcodes)** — [`client/common/network/ClientPacketId.ts`](../client/common/network/ClientPacketId.ts) → [`PacketHandler.ts`](../server/src/network/packet/PacketHandler.ts): walk, OPNPC/OPLOC/OPOBJ, IF_BUTTON*, examine, appearance, etc.
2. **High-level (180+ / 200+)** — [`client/common/packets/ClientPacketId.ts`](../client/common/packets/ClientPacketId.ts) → [`ClientBinaryDecoder.ts`](../server/src/network/packet/ClientBinaryDecoder.ts): hello, login, walk, widgets, trade, chat, friends chat, varp transmit, debug, etc.

Both feed [`MessageRouter`](../server/src/network/MessageRouter.ts) via [`registerAllHandlers`](../server/src/network/handlers/index.ts). Extra routed types still include `smithing_make` / `smithing_mode` / `bank_deposit_item` / `debug`.

**Protocol gaps (from code, not playtest):**

| Opcode / name | Notes |
| --- | --- |
| `OPNPC5` = 50 | Decoded as `npc_op` option 5. This client still *sends* option 5 as `OPNPC1` (57) from menu/`sendNpcOption`; both opcodes share `writeByteAdd` + `writeShortLE`. |
| Unrecognized OSRS opcodes | `decodePacket` returns `{ type: "unknown" }`. |

Everything else in the OSRS `ClientPacketId` enum appears in the `PacketHandler` switch (including IF_BUTTON 1–10, SUB, TRIGGEROPLOCAL, all listed OP* and examine packets). High-level types in `ClientBinaryDecoder` are registered (unused `MAP_EDIT` = 195 was removed; nothing sent it).

Server→client opcodes: [`ServerPacketId.ts`](../client/common/packets/ServerPacketId.ts) + [`ServerBinaryEncoder.ts`](../server/src/network/packet/ServerBinaryEncoder.ts). [`messages.ts`](../server/src/network/messages.ts) throws if a message type has no binary encoder.

| | |
| --- | --- |
| **Status** | Partial (coverage of defined opcodes is high) |
| **Tests** | Handler-specific tests (trade, friends chat, inventory); [`opnpc5-decode.test.ts`](../server/tests/opnpc5-decode.test.ts) for opcode 50 / legacy 57; [`map-edit-opcode.test.ts`](../server/tests/map-edit-opcode.test.ts) confirms unused 195 stays dropped. |
| **Next step** | Client still emits 57 for NPC option 5 (server accepts both). |

### Broadcast and actor sync

| | |
| --- | --- |
| **Status** | Wired / Unverified for full OSRS player-info masks |
| **Path** | [`network/broadcast/`](../server/src/network/broadcast/), [`PlayerSyncSession.ts`](../server/src/network/PlayerSyncSession.ts), [`NpcSyncSession.ts`](../server/src/network/NpcSyncSession.ts), [`NpcSyncManager.ts`](../server/src/network/managers/NpcSyncManager.ts), [`encoding/`](../server/src/network/encoding/) |
| **Wired** | Tick broadcast of inventory, skills, combat, vars, widgets, actor sync, world-entity info. |
| **Gaps** | Mask completeness vs live OSRS is not asserted in tests. |
| **Tests** | Indirect combat/instance tests. |

### World: collision, doors, instances, locs

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`world/`](../server/src/world/) — `MapCollisionService`, doors (`DoorStateManager`, catalog JSON), `InstanceManager`, `InstancedAreaManager`, loc lookup/transforms, collision overlays |
| **Wired** | Precomputed collision, dynamic door collision, instanced areas, sailing world-view collision hooks in `PathService`. |
| **Gaps** | World *content* (which doors/locs have scripts) is vanilla-side. |
| **Tests** | [`collision-encoder.test.ts`](../server/tests/collision-encoder.test.ts), [`instance-parity.test.ts`](../server/tests/instance-parity.test.ts), [`temporary-location.test.ts`](../server/tests/temporary-location.test.ts) |

### Pathfinding

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`pathfinding/PathService.ts`](../server/src/pathfinding/PathService.ts), [`pathfinding/legacy/`](../server/src/pathfinding/legacy/) |
| **Wired** | RS-style `Pathfinder`, route strategies (exact, adjacent, LoS range), overlay and world-view collision. |
| **Gaps** | Graph size / step cap (default 128) may truncate long paths; not classified as incomplete. |
| **Tests** | Used by instance/combat tests. |

### NPCs

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`npc.ts`](../server/src/game/npc.ts), [`npcManager.ts`](../server/src/game/npcManager.ts), [`combat/NpcAggression.ts`](../server/src/game/combat/NpcAggression.ts) |
| **Wired** | Spawns from [`server/data/npc-spawns.json`](../server/data/npc-spawns.json) unless the gamemode disables them. Wander, combat, aggression, poison/venom on NPC state, boss script attach via `createBossScript`. |
| **Gaps** | Aggression/combat stats depend on generated data (`build-npc-aggression`). Unscripted NPCs use default talk. |
| **Tests** | [`scoped-npc.test.ts`](../server/tests/scoped-npc.test.ts), [`npc-pre-death-script.test.ts`](../server/tests/npc-pre-death-script.test.ts) |

### Ground items

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`GroundItemManager.ts`](../server/src/game/items/GroundItemManager.ts), vanilla [`groundItemSpawns.ts`](../server/gamemodes/vanilla/data/groundItemSpawns.ts) |
| **Wired** | Private/public timings, wilderness consumable despawn, max stacks per tile, static spawns. |
| **Gaps** | — |
| **Tests** | [`ground-item-script.test.ts`](../server/tests/ground-item-script.test.ts) |

### Player model and persistence

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`player.ts`](../server/src/game/player.ts), [`PlayerManager.ts`](../server/src/game/PlayerManager.ts), [`state/`](../server/src/game/state/) — `PersistenceProvider`, `PlayerPersistence` (SQLite), `PlayerStateSerializer`, skills/bank/inventory/varps/combat/run/special/prayer/collection log/followers |
| **Wired** | Login/logout save, autosave (~120s), orphan expiration. Bank placeholders/fillers. Gamemode `serializePlayerState`. Password hashes and trade escrow in the same SQLite file under `server/data/gamemodes/{id}/`. |
| **Gaps** | Only SQLite is implemented; interface allows other backends. |
| **Tests** | Persistence is covered indirectly (auth, trade dupe safety). No dedicated serializer round-trip suite found. |
| **Next step** | Serializer tests if save bugs appear. |

### Actions, interactions, scripts

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`game/actions/`](../server/src/game/actions/), [`game/interactions/`](../server/src/game/interactions/), [`game/scripts/`](../server/src/game/scripts/) — `ScriptRegistry`, `ScriptRuntime`, `bootstrap.ts`, `ZoneTriggerService`, `serviceInterfaces.ts` |
| **Wired** | Action scheduler + combat/spell/inventory/widget-dialog handlers. NPC/loc/item/item-on-\*/ground/zone/button/command/client-message registration. Newest handler wins. Zone enter/leave. Script services facade for gamemodes. |
| **Gaps** | Unscripted loc click → “Nothing interesting happens.” Remaining item-on-\* work is per-item content, not the dispatcher. |
| **Tests** | [`script-registry-handler-stacks.test.ts`](../server/tests/script-registry-handler-stacks.test.ts), [`zone-trigger-script.test.ts`](../server/tests/zone-trigger-script.test.ts), [`item-on-npc-script.test.ts`](../server/tests/item-on-npc-script.test.ts), [`item-on-player-script.test.ts`](../server/tests/item-on-player-script.test.ts), [`item-on-target-default.test.ts`](../server/tests/item-on-target-default.test.ts), [`default-npc-talk.test.ts`](../server/tests/default-npc-talk.test.ts), [`default-loc-click.test.ts`](../server/tests/default-loc-click.test.ts) |

### Combat (engine)

| | |
| --- | --- |
| **Status** | Partial (engine is large and used; world/PvP-type and bosses incomplete) |
| **Path** | [`game/combat/`](../server/src/game/combat/) — tick engine, formulas, ammo, dragonfire, multi-combat, damage tracker, specials (~80 plugin files), `PvpCombatHandler`, `CombatActionHandler` |
| **Wired** | Melee/ranged/magic vs NPC and player, autocast, specials, poison/venom utilities, wilderness/multi helpers, loot eligibility via `DamageTracker`. Combat XP. Equipment bonus *provider* (vanilla fills slayer-helm style bonuses even without a Slayer skill). |
| **Gaps** | `MultiCombatZones`: TODO PvP world and Duel Arena. `PoisonVenomSystem.processTick` is an empty compatibility stub (real ticks on actor state). `DegradationSystem` crystal varbit TODO. Boss scripts still scaffold for Zulrah venom clouds (Mole dig and Zulrah snakelings are wired). |
| **Tests** | Many `combat-*.test.ts`, weapon specials, dragonfire, engagement, farcast, granite maul, ballista, claws, etc. [`giant-mole-dig.test.ts`](../server/tests/giant-mole-dig.test.ts), [`zulrah-snakeling.test.ts`](../server/tests/zulrah-snakeling.test.ts). |
| **Next step** | PvP world flag if you need it; fill remaining boss `execute` bodies (Zulrah venom cloud) or delete unused registrations. |

### Spells

| | |
| --- | --- |
| **Status** | Partial / Unverified vs full spellbook |
| **Path** | [`game/spells/`](../server/src/game/spells/), vanilla [`data/spells.ts`](../server/gamemodes/vanilla/data/spells.ts), [`spellHandlers.ts`](../server/src/network/handlers/spellHandlers.ts) |
| **Wired** | Cast on NPC/player/loc/obj/item packets, rune validation, autocast slot resolver (including Ancient). |
| **Gaps** | Not every OSRS spell/effect is guaranteed; no inventory of “all spells implemented.” |
| **Tests** | [`ancient-autocast-slot.test.ts`](../server/tests/ancient-autocast-slot.test.ts), combat magic tests |

### Prayer (engine)

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`game/prayer/`](../server/src/game/prayer/), vanilla prayer skill + [`prayerWidgets.ts`](../server/gamemodes/vanilla/widgets/prayerWidgets.ts) |
| **Wired** | Overhead types, drain, Protect Item interaction with death snapshots. |
| **Gaps** | Full prayer-book edge cases unverified. |
| **Tests** | [`prayer-overhead-regression.test.ts`](../server/tests/prayer-overhead-regression.test.ts) |

### Death

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`game/death/`](../server/src/game/death/) — `PlayerDeathService`, `ItemProtectionCalculator`, `DeathHookRegistry` |
| **Wired** | Queued death → animation → drops → respawn, skull/prayer snapshot, wilderness checks, untradeable→coins in PvP comments. |
| **Gaps** | Full OSRS death (hardcore, instanced, clue keep) not enumerated here. |
| **Tests** | No dedicated `death-*.test.ts` in the server test list. |

### Drops

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`game/drops/`](../server/src/game/drops/) — `NpcDropRegistry` from `npc-drops.json` + manual overrides, `DropRollService` |
| **Wired** | Imported tables; vanilla `NPC_LOOT_CONFIGS` for distribution. Build script `build-npc-drops`. |
| **Gaps** | Missing JSON at boot logs an error and yields empty imported tables. |
| **Tests** | [`npc-drop-registry.test.ts`](../server/tests/npc-drop-registry.test.ts) |

### Followers / companions

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`game/followers/`](../server/src/game/followers/), vanilla [`scripts/items/followers.ts`](../server/gamemodes/vanilla/scripts/items/followers.ts), [`CompanionHitHandler.ts`](../server/src/game/actions/handlers/CompanionHitHandler.ts) |
| **Wired** | Combat companion definitions, follow/attack, persist state. |
| **Gaps** | Not a full pet/POH/familiar system. |
| **Tests** | None named for followers. |

### Movement, equipment, inventory, trade

| System | Status | Path | Notes | Tests |
| --- | --- | --- | --- | --- |
| Movement queue / processor | Wired | [`game/movement/`](../server/src/game/movement/), [`MovementService.ts`](../server/src/game/services/MovementService.ts) | Walk packets, forced movement, run energy state | — |
| Equipment | Wired | [`EquipmentHandler.ts`](../server/src/game/systems/EquipmentHandler.ts), [`EquipmentService.ts`](../server/src/game/services/EquipmentService.ts), vanilla `equipment/` | Equip/unequip, stats UI hooks | — |
| Inventory | Wired | [`InventoryService.ts`](../server/src/game/services/InventoryService.ts), [`InventoryActionHandler.ts`](../server/src/game/actions/handlers/InventoryActionHandler.ts) | Moves, use, use-on; unhandled use-on → “Nothing interesting happens.” | [`inventory-service.test.ts`](../server/tests/inventory-service.test.ts), [`inventory-move-immediate.test.ts`](../server/tests/inventory-move-immediate.test.ts), [`item-on-target-default.test.ts`](../server/tests/item-on-target-default.test.ts) |
| Trade | Wired | [`TradeManager.ts`](../server/src/game/trade/TradeManager.ts) | Two-screen trade, escrow/refund in SQLite | [`trade-dupe-safety.test.ts`](../server/tests/trade-dupe-safety.test.ts), [`trade-inventory-*.test.ts`](../server/tests/) |
| Gathering manager | Wired | [`GatheringSystemManager.ts`](../server/src/game/systems/GatheringSystemManager.ts) | Used by WC/mining depletion | — |
| Projectiles | Wired | [`ProjectileSystem.ts`](../server/src/game/systems/ProjectileSystem.ts) | Combat/spell projectiles | — |
| Status effects | Wired | [`StatusEffectSystem.ts`](../server/src/game/systems/StatusEffectSystem.ts) | NPC/player status ticks | [`combat-stat-drains.test.ts`](../server/tests/combat-stat-drains.test.ts) |
| Timers / queues | Wired | [`game/model/timer/`](../server/src/game/model/timer/), [`game/model/queue/`](../server/src/game/model/queue/) | Strong/weak queues, lock state | — |

### Widgets and varps (engine)

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`widgets/`](../server/src/widgets/) — `WidgetManager`, `InterfaceService`, viewport desktop/mobile, dialog hooks, collection-log hooks, minimap orbs, world map interfaces |
| **Wired** | Open/close/sub, CS2 invoke, varp/varbit deltas ([`VarpSyncService`](../server/src/game/services/VarpSyncService.ts), [`VariableService`](../server/src/game/services/VariableService.ts)). Display-mode enum mapping. |
| **Gaps** | Feature completeness is gamemode widget handlers. |
| **Tests** | [`trade-inventory-widget.test.ts`](../server/tests/trade-inventory-widget.test.ts) |

### Sailing (engine)

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`game/sailing/`](../server/src/game/sailing/) — instance, world view, instance manager; [`WorldEntityService.ts`](../server/src/game/services/WorldEntityService.ts) |
| **Wired** | Nested world views / boats as world entities, restore hooks from vanilla. |
| **Gaps** | Not the full Sailing skill. Content is [`skills/sailing/pandemonium.ts`](../server/gamemodes/vanilla/skills/sailing/pandemonium.ts). |
| **Tests** | None named sailing. |

### Audio / music

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`audio/`](../server/src/audio/) — region, unlock, catalog, NPC sound lookup; [`SoundManager.ts`](../server/src/network/managers/SoundManager.ts); vanilla [`musicWidgets.ts`](../server/gamemodes/vanilla/widgets/musicWidgets.ts) |
| **Wired** | Music phase on tick; unlock service; widget handlers. |
| **Gaps** | Unlock completeness vs OSRS music list unverified. |
| **Tests** | None named music. |

### Friends Chat

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`FriendsChatService.ts`](../server/src/game/services/FriendsChatService.ts), chat handler |
| **Wired** | Join/setup/ranks/kick, SQLite-backed settings, widget ops, chat type 9. |
| **Gaps** | Not the full OSRS friends/ignore/private-message matrix. |
| **Tests** | [`friends-chat.test.ts`](../server/tests/friends-chat.test.ts) (in `yarn --cwd server test`) |

### Collection log (engine)

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`collectionlog.ts`](../server/src/game/collectionlog.ts), [`CollectionLogService.ts`](../server/src/game/services/CollectionLogService.ts) |
| **Wired** | Transmit inventory 620, category varps, JSON from `client/common/collectionlog`. |
| **Gaps** | Populating *all* log slots depends on drop/kill hooks actually calling into it. |
| **Tests** | None named collection-log. |

### Custom items (engine)

| | |
| --- | --- |
| **Status** | Scaffold for vanilla clients |
| **Path** | [`custom/items/`](../server/src/custom/items/), [`client/custom/items/`](../client/custom/items/) |
| **Wired** | Server merge into `ItemDefinition`. Process-wide registry. |
| **Gaps** | Client only applies after `getContentDataPacket()`. Vanilla does not implement it. |
| **Tests** | — |

### Events, providers, gamemode core

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`GameEventBus`](../server/src/game/events/), [`ProviderRegistry`](../server/src/game/providers/ProviderRegistry.ts), [`BaseGamemode`](../server/src/game/gamemodes/BaseGamemode.ts), [`GamemodeRegistry`](../server/src/game/gamemodes/GamemodeRegistry.ts), [`ServerServices`](../server/src/game/ServerServices.ts) |
| **Wired** | Login/logout/XP events; combat/skill/spell providers swapped by vanilla; `createGamemode(id)`. |
| **Gaps** | Event coverage is whatever publishers emit. |

### Chat commands (engine + vanilla)

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`ChatCommands.ts`](../server/src/network/commands/ChatCommands.ts), vanilla [`scripts/commands.ts`](../server/gamemodes/vanilla/scripts/commands.ts) |
| **Wired** | Permission-gated commands; quest `resetquests` / `completequests`. |
| **Gaps** | Admin surface, not a content system. |

---

## Vanilla gamemode

[`VanillaGamemode`](../server/gamemodes/vanilla/index.ts) extends `BaseGamemode`: banking, shops, combat providers, skills, widgets, area scripts, quests. It does **not** implement `getContentDataPacket()`.

### Skills vs `SkillId`

Combat skills (Attack, Strength, Defence, Hitpoints, Ranged, Magic) are **engine combat**, not `skills/` folders. Charge Orb, Enchant Jewellery, and Superheat Item are the Magic exceptions: [`skills/magic/`](../server/gamemodes/vanilla/skills/magic/).

| Skill | Status | Path | What exists | Next step |
| --- | --- | --- | --- | --- |
| Attack / Strength / Defence / Hitpoints / Ranged / Magic | Wired | combat engine + [`skills/magic/`](../server/gamemodes/vanilla/skills/magic/) | XP, styles, regen/boosts; Charge Water/Earth/Fire/Air Orb at obelisks 2151/2150/2153/2152 (unpowered 567 → 571/575/569/573); Enchant Lvl-1–7 jewellery (sapphire–onyx + zenyte; strung amulets); Superheat Item (spell 9075; 4 fire + 1 nature; Magic 53 XP + Smithing bar XP from furnace recipes; iron 100%; iron+2 coal → steel). [`magic-charge-orb.test.ts`](../server/tests/magic-charge-orb.test.ts), [`magic-enchant-jewellery.test.ts`](../server/tests/magic-enchant-jewellery.test.ts), [`magic-superheat-item.test.ts`](../server/tests/magic-superheat-item.test.ts) | Bones to bananas; silver jewellery (opal/jade/topaz) still thin |
| Prayer | Partial | [`skills/prayer/`](../server/gamemodes/vanilla/skills/prayer/) | Bones/ashes, altars, prayer book widgets | Remaining bones/gilded/etc. as needed |
| Cooking | Partial | [`skills/production/cooking.ts`](../server/gamemodes/vanilla/skills/production/cooking.ts) | Recipe table + loc interactions | Expand recipes |
| Woodcutting | Partial | [`skills/woodcutting/`](../server/gamemodes/vanilla/skills/woodcutting/) | Loc map, hatchets, depletion | Missing tree types |
| Fletching | Partial | [`skills/fletching/`](../server/gamemodes/vanilla/skills/fletching/) | Logs + stringing + combine recipes | [`fletching-handler-registration.test.ts`](../server/tests/fletching-handler-registration.test.ts) |
| Fishing | Partial | [`skills/fishing/`](../server/gamemodes/vanilla/skills/fishing/) | Spots/methods/tools, minnows, echo harpoon IDs | Missing spots |
| Firemaking | Partial | [`skills/firemaking/`](../server/gamemodes/vanilla/skills/firemaking/) | Tinderbox + log defs, ash | — |
| Crafting | Partial | [`skills/crafting/`](../server/gamemodes/vanilla/skills/crafting/) | flax, shearing, spinning, jewellery (gold/silver + gems including onyx/zenyte and opal/jade/topaz), gem cutting (opal/jade/topaz crush chance), leather/dragonhide/snakeskin armour, pottery, glassblowing, battlestaves (charged orb + staff), weaving (loom: cloth/sack/basket/drift net/fabric bolts). [`crafting-jewellery-leather.test.ts`](../server/tests/crafting-jewellery-leather.test.ts), [`crafting-pottery-glassblowing.test.ts`](../server/tests/crafting-pottery-glassblowing.test.ts), [`crafting-battlestaves.test.ts`](../server/tests/crafting-battlestaves.test.ts), [`crafting-weaving.test.ts`](../server/tests/crafting-weaving.test.ts) | Exotic leftovers (unholy symbols, conducting rods) |
| Smithing | Partial | smelt + smith UI/modals | Data-driven bars/items | Remaining recipes |
| Mining | Partial | [`skills/mining/`](../server/gamemodes/vanilla/skills/mining/) | Rock loc map, pickaxes | Missing rocks |
| Herblore | Partial | clean / unf / finish / stamina | Data lists in `herblore/index.ts` | Missing potions |
| Agility | Partial | [`skills/agility/`](../server/gamemodes/vanilla/skills/agility/) | Gnome Stronghold (110.5/lap), Barbarian Outpost (153.3 Agility + 41.3 Strength/lap), Wilderness (571.4/lap; in-order rocks bonus; dispenser Tag/Redeem tickets), Draynor Village rooftop (120/lap; in-order completion), Al Kharid rooftop (216/lap; level 20; in-order completion), Varrock rooftop (270/lap; level 30; in-order completion; Marks of Grace not spawned — no mark-spawn infrastructure), Canifis rooftop (240/lap; level 40; in-order completion; Marks of Grace not spawned — no mark-spawn infrastructure), Falador rooftop (586/lap; level 50; in-order completion; Marks of Grace not spawned — no mark-spawn infrastructure), and Seers' Village rooftop (570/lap; level 60; in-order completion; Marks of Grace not spawned — no mark-spawn infrastructure; Kandarin hard extra edge XP not wired). Fail-proof. [`agility-gnome-course.test.ts`](../server/tests/agility-gnome-course.test.ts), [`agility-barbarian-course.test.ts`](../server/tests/agility-barbarian-course.test.ts), [`agility-wilderness-course.test.ts`](../server/tests/agility-wilderness-course.test.ts), [`agility-draynor-course.test.ts`](../server/tests/agility-draynor-course.test.ts), [`agility-alkharid-course.test.ts`](../server/tests/agility-alkharid-course.test.ts), [`agility-varrock-course.test.ts`](../server/tests/agility-varrock-course.test.ts), [`agility-canifis-course.test.ts`](../server/tests/agility-canifis-course.test.ts), [`agility-falador-course.test.ts`](../server/tests/agility-falador-course.test.ts), [`agility-seers-course.test.ts`](../server/tests/agility-seers-course.test.ts) | Remaining rooftops (Pollnivneach onward), other courses |
| Thieving | Partial | pickpocket + picklock + stalls + chests | NPC pickpocket tables, HAM trapdoor picklock, market stalls (veg through gem, plus tea/wine/fish/crafting, seed, fruit, Ape Atoll food/general/magic/scimitar), chests (Ardougne 10/nature/50-coin + castle, Yanille blood, steel arrowtips, Dorgesh-Kaan average/rich, Rogues' Castle, Lizardman Temple stone, rusty/tarnished/reinforced pirate, underwater loot/XP hooks, Varlamore valuables loot/XP hooks). [`thieving-stalls.test.ts`](../server/tests/thieving-stalls.test.ts), [`thieving-chests.test.ts`](../server/tests/thieving-chests.test.ts) | Guard LOS catch; underwater oxygen/chest rotation; Varlamore house keys, occupancy varbits, flashing-arrow bonus |
| Runecraft | Partial | [`skills/runecrafting/`](../server/gamemodes/vanilla/skills/runecrafting/) | F2P Air–Body plus members ruins altars (Cosmic, Chaos, Nature, Law, Death, Blood, Wrath; tiara/talisman enter, craft, portal exit). Walk-up Astral on Lunar Isle (loc 34771; pure essence; 2× at 82; no ruins/portal; Lunar Diplomacy not registered so craft is not quest-locked). Walk-up Kourend Blood (loc 27978; 23.8 XP; 77) and Arceuus Soul (loc 27980; 29.7 XP; 90) bind dark essence fragments (7938); no ruins/portal; no extra runes from level. Dense runestone mining, Dark Altar conversion, and chiseling blocks into fragments are not implemented — craft works if the player already has fragments. Combination runes (Mist–Lava: opposing talisman/tiara + elemental runes + pure essence at the matching altar; 50% bind per essence with no XP on fails, 100% with a worn binding necklace 5521 that spends one of 16 charges per craft). Tiara imbuing (blank tiara + talisman) at ruins altars. Abyss inner ring: wilderness Mage of Zamorak (spawn 3228, visibles 2580/2581) teleports to 3040,4832; inner rifts Exit-through to matching ruins altars Air–Blood (verified cache loc IDs; no Wrath rift; soul rift 25377 and Kourend-blood option skipped). Essence pouches (small 5509, medium 5510/5511, large 5512/5513, giant 5514/5515, colossal 26784/26786): Fill/Empty/Check plus essence-on-pouch; rune or pure essence; RC level 1/25/50/75/25; colossal capacity 8–40 by level; one degrade step on fill stored in `equipment` charges (small never degrades); Dark Mage 2583 Talk-to/Repairs restores charges and inventory degraded ids (bank graphics skipped). Outer-ring obstacles, skulling/prayer drain, pouch decay-to-dust, RC-cape fill immunity, daeyalt/guardian essence, colossal stitching, and Abyssal Sire are not implemented. [`runecrafting-f2p-altars.test.ts`](../server/tests/runecrafting-f2p-altars.test.ts), [`runecrafting-members-altars.test.ts`](../server/tests/runecrafting-members-altars.test.ts), [`runecrafting-astral-altar.test.ts`](../server/tests/runecrafting-astral-altar.test.ts), [`runecrafting-kourend-altars.test.ts`](../server/tests/runecrafting-kourend-altars.test.ts), [`runecrafting-combination-runes.test.ts`](../server/tests/runecrafting-combination-runes.test.ts), [`runecrafting-tiara-imbue.test.ts`](../server/tests/runecrafting-tiara-imbue.test.ts), [`runecrafting-abyss.test.ts`](../server/tests/runecrafting-abyss.test.ts), [`runecrafting-pouches.test.ts`](../server/tests/runecrafting-pouches.test.ts) | Dense mine / Dark Altar / chisel; Abyss outer obstacles / skulling; Lunar Diplomacy quest lock; Magic Imbue (Lunar spell not in-repo; OSRS skips the opposing talisman, does not guarantee binds) |
| Sailing | Partial | Pandemonium + engine instances | Restore on login | Rest of skill |
| Consumables | Partial | large food/potion tables | Eat/drink actions | Remaining items |
| Tanning / bolt enchant | Partial | production module | — | — |
| **Slayer** | **Missing** | — | Helmet bonuses exist in combat without tasks | Task system |
| **Hunter** | **Missing** | — | — | — |
| **Farming** | **Missing** | — | — | — |
| **Construction** | **Missing** | — | POH *pools* exist as loc drinks, not house building | — |

Skill-guide widget still opens Construction/Slayer/Hunter/Farming pages ([`skillGuideWidgets.ts`](../server/gamemodes/vanilla/widgets/skillGuideWidgets.ts)).

### Banking

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`vanilla/banking/`](../server/gamemodes/vanilla/banking/) |
| **Wired** | NPC/loc “bank”/“collect”, tabs, placeholders, deposit inventory/equipment/item packets, widget ops. |
| **Gaps** | Collect/GE-style returns only as far as this bank “collect” mode — not the Grand Exchange. |
| **Tests** | None dedicated (inventory/bank overlap in persistence). |

### Shops

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`vanilla/shops/`](../server/gamemodes/vanilla/shops/), `build-shops` script |
| **Wired** | `ShopManager` + `ShopService`, widgets, NPC interactions, Zaff. |
| **Gaps** | `isMembersWorld = false` TODO in [`shopInteractions.ts`](../server/gamemodes/vanilla/shops/shopInteractions.ts). Stock completeness depends on generated shop data. |
| **Tests** | None named shops. |

### Equipment / combat providers (vanilla)

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`vanilla/combat/`](../server/gamemodes/vanilla/combat/), [`vanilla/equipment/`](../server/gamemodes/vanilla/equipment/), [`vanilla/data/weapons.ts`](../server/gamemodes/vanilla/data/weapons.ts) |
| **Wired** | Special attack registry (large weapon map), visuals, style sequences, equipment bonuses (void, salve, slayer helms, dragon hunter, etc.), ammo/runes/spells/projectiles, rock knocker utility spec, skill configuration. |
| **Gaps** | Some weapon rows are placeholders (e.g. Ghrazi “no special”). Special plugins in engine vs registry must stay in sync. |
| **Tests** | Weapon-specific combat tests. |

### Widgets (vanilla)

Registered from `VanillaGamemode`: account summary, collection log, combat, diary journal, emotes, minimap, music, prayer, quest journal/list, settings, skill guide, spellbook, plus bank/shop/equipment hooks and smithing/widget open-close.

| Widget area | Status | Notes |
| --- | --- | --- |
| Emotes (216) | Wired | Perform/loop, skillcape |
| Prayer / combat / spellbook | Wired | Drive existing OSRS widgets via varps |
| Quest list/journal | Wired | Built from registered quests |
| Diary journal (259/741) | Scaffold | UI + varbit counts; no task completion engine |
| Settings / minimap / music | Partial | Handlers exist; full option parity unverified |
| Account summary | Partial | Widget + time helpers |

### World / area scripts

Judged as **hub coverage**, not every OSRS loc.

Registered from vanilla `index.ts`: Lumbridge, Varrock, Falador, Draynor, Port Sarim, Taverley, Wilderness, Wizard Tower, Al Kharid border, wilderness access, boats, doors, key doors, climbing, POH pools, Bob, Romeo helper, packs, toxic blowpipe, webweaver, follower items, demo interactions, default talk, level-up.

| | |
| --- | --- |
| **Status** | Partial |
| **Gaps** | Most of the map has cache locs/NPCs without scripts → default talk / nothing interesting. |
| **Tests** | Quest tests that hit specific locs; [`ground-item-script.test.ts`](../server/tests/ground-item-script.test.ts) |

### NPCs (vanilla)

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`vanilla/npcs/`](../server/gamemodes/vanilla/npcs/) |
| **Wired** | Dialogue registration entry; quests and shops register many NPCs. Unscripted Talk-to opens a generic “Hello.” chatbox ([`defaultTalk.ts`](../server/gamemodes/vanilla/scripts/content/defaultTalk.ts)); Man/Woman use [`generic/person.ts`](../server/gamemodes/vanilla/npcs/generic/person.ts). |
| **Gaps** | Most named NPCs still lack dedicated lines. |
| **Tests** | [`default-npc-talk.test.ts`](../server/tests/default-npc-talk.test.ts) |

---

## Quests

[`quests/index.ts`](../server/gamemodes/vanilla/quests/index.ts) registers **64** definitions (`all-quests-registration.test.ts` asserts length and unique keys/varps). Shared runtime: [`QuestService.ts`](../server/gamemodes/vanilla/quests/QuestService.ts), dialogue helper, journal widgets.

**Status overall: Partial.** Early/mid F2P plus a slice of P2P; remainder of the OSRS quest list is **Missing**. Ten registered quests are **compressed** linear ports in [`preservationRemainder`](../server/gamemodes/vanilla/quests/definitions/preservationRemainder/index.ts), not full interaction folders.

### Folder quests (full definition directories)

| Quest | Status | Dedicated test |
| --- | --- | --- |
| Black Knights' Fortress | Partial | `black-knights-fortress-quest.test.ts` |
| Biohazard | Partial | `biohazard-quest.test.ts` |
| Big Chompy Bird Hunting | Partial | — |
| Clock Tower | Partial | `clock-tower-quest.test.ts` |
| Cook's Assistant | Partial | `cooks-assistant-quest.test.ts` |
| Death Plateau | Partial | — |
| Demon Slayer | Partial | `demon-slayer-quest.test.ts` |
| Desert Treasure I | Partial | `desert-treasure-quests.test.ts` |
| The Dig Site | Partial | — |
| Doric's Quest | Partial | `dorics-quest-parity.test.ts` |
| Dragon Slayer I | Partial | — |
| Druidic Ritual | Partial | `first-batch-quests.test.ts` |
| Dwarf Cannon | Partial | `dwarf-cannon-quest.test.ts` |
| Elemental Workshop I | Partial | `elemental-workshop-i-quest.test.ts` |
| Ernest the Chicken | Partial | `foundation-quests-pirate-vampyre-ernest.test.ts` |
| Family Crest | Partial | `family-crest-quest.test.ts` |
| Fight Arena | Partial | `fight-arena-quest.test.ts` |
| Fishing Contest | Partial | `fishing-contest-gertrudes-cat.test.ts` |
| Gertrude's Cat | Partial | `fishing-contest-gertrudes-cat.test.ts` |
| The Grand Tree | Partial | — |
| Goblin Diplomacy | Partial | `first-batch-quests.test.ts` |
| Hazeel Cult | Partial | `hazeel-cult-quest.test.ts` |
| Holy Grail | Partial | `holy-grail-quest.test.ts` |
| Heroes' Quest | Partial | — |
| Imp Catcher | Partial | `imp-catcher-quest.test.ts` |
| Jungle Potion | Partial | `jungle-potion-quest.test.ts` |
| The Knight's Sword | Partial | `knights-sword-quest.test.ts` |
| Lost City | Partial | `lost-city-quest.test.ts` |
| Merlin's Crystal | Partial | `merlins-crystal-quest.test.ts` |
| Monk's Friend | Partial | `first-batch-quests.test.ts` |
| Murder Mystery | Partial | `murder-mystery-quest.test.ts` |
| Nature Spirit | Partial | `nature-spirit-quest.test.ts` |
| Observatory Quest | Partial | `observatory-quest.test.ts` |
| Pirate's Treasure | Partial | `foundation-quests-pirate-vampyre-ernest.test.ts` |
| Plague City | Partial | `plague-city-quest.test.ts` |
| Priest in Peril | Partial | — |
| Prince Ali Rescue | Partial | `prince-ali-rescue-quest.test.ts` |
| The Restless Ghost | Partial | `restless-ghost-quest.test.ts` |
| Romeo & Juliet | Partial | `romeo-and-juliet-quest.test.ts` |
| Rune Mysteries | Partial | `rune-mysteries-quest.test.ts` |
| Scorpion Catcher | Partial | `scorpion-catcher-quest.test.ts` |
| Sea Slug | Partial | `sea-slug-quest.test.ts` |
| Sheep Herder | Partial | `sheep-herder-quest.test.ts` |
| Sheep Shearer | Partial | `sheep-shearer-quest.test.ts`, `sheep-shearer-parity.test.ts` |
| Shield of Arrav | Partial | `shield-of-arrav-quest.test.ts` |
| Temple of Ikov | Partial | — |
| The Tourist Trap | Partial | — |
| Troll Stronghold | Partial | — |
| Tree Gnome Village | Partial | `tree-gnome-village-quest.test.ts` |
| Tribal Totem | Partial | `tribal-totem-quest.test.ts` |
| Vampyre Slayer | Partial | `foundation-quests-pirate-vampyre-ernest.test.ts` |
| Waterfall Quest | Partial | — |
| Witch's House | Partial | `witchs-house-quest.test.ts` |
| Witch's Potion | Partial | `witchs-potion-quest.test.ts` |

None of these are marked **Wired** as “OSRS complete”; they are implemented enough to register, journal, and (usually) test handlers. Rows with no dedicated test are **Unverified** relative to the others.

Infrastructure tests: `quest-completion-safety`, `quest-registry-validation`, `quest-runtime-infrastructure`, `all-quests-registration`, `modern-preservation-cache-ids`.

### Preservation remainder (linear / compressed)

| Quest | Status | Tests |
| --- | --- | --- |
| Eadgar's Ruse | Scaffold/Partial | `preservation-remainder-quests.test.ts` |
| Horror from the Deep | Partial (more custom combat hooks than the others) | same |
| Watchtower | Scaffold/Partial | same |
| Shades of Mort'ton | Scaffold/Partial | same |
| Underground Pass | Scaffold/Partial | same |
| Regicide | Scaffold/Partial | same |
| The Fremennik Trials | Scaffold/Partial | same |
| Shilo Village | Partial (pre-death NPC transitions) | same |
| Tai Bwo Wannai Trio | Partial (item combines) | same |
| Legend's Quest | Scaffold/Partial | same |

**Next step:** treat remainder quests as placeholders until a full-folder port; prefer new work on **Missing** later quests only after deciding whether remainder should be rewritten.

---

## Explicit TODOs / stubs (non-exhaustive)

| Location | Note |
| --- | --- |
| [`MultiCombatZones.ts`](../server/src/game/combat/MultiCombatZones.ts) | PvP world; Duel Arena |
| [`shopInteractions.ts`](../server/gamemodes/vanilla/shops/shopInteractions.ts) | Members world |
| [`DegradationSystem.ts`](../server/src/game/combat/DegradationSystem.ts) | Crystal bow charge varbit |
| [`thieving/pickpocket.ts`](../server/gamemodes/vanilla/skills/thieving/pickpocket.ts) | Verify cave goblin wire item ID |
| [`PoisonVenomSystem.ts`](../server/src/game/combat/PoisonVenomSystem.ts) | `processTick` stub |
| [`BossCombatScript.ts`](../server/gamemodes/vanilla/combat/BossCombatScript.ts) | Zulrah venom-cloud `execute` still empty (Mole dig and Zulrah snakelings are wired) |
| [`agility/index.ts`](../server/gamemodes/vanilla/skills/agility/index.ts) | Remaining rooftops (Pollnivneach onward) and other agility courses |
| [`weapons.ts`](../server/gamemodes/vanilla/data/weapons.ts) | Some specs placeholders |

---

## Missing OSRS systems (no module)

These are not incomplete folders; they are absent as gameplay:

- Grand Exchange
- Clue scrolls / treasure trails
- Duel Arena / staked duels
- Pest Control and other minigames (no dedicated `minigames/` tree)
- Player-owned house *building* (pools only)
- Slayer assignments
- Hunter, Farming, Construction training
- Private friends list / PM as a full social graph (Friends Chat exists)
- Achievement diary *tasks*
- Most quests after the 64 registered
- Most world regions outside the listed hubs

---

## Test coverage map

`yarn --cwd server test` runs **only**:

- `server/tests/authentication.test.ts`
- `server/tests/friends-chat.test.ts`

Everything else under [`server/tests/`](../server/tests/) is opt-in: `yarn --cwd server tsx tests/<file>.test.ts`.

`yarn --cwd server typecheck` uses `tsconfig.quests.json`: it typechecks `server/src`, listed vanilla **quest** files, and imported `client/rs` / `client/common`. It does **not** typecheck most of `gamemodes/vanilla/skills`, `leagues-v`, or extrascripts.

There are ~90 individual test files: heavy on quests and combat specials; light on death, shops, banking, music, sailing, collection log, and persistence round-trips.

---

## Suggested development order (from this audit)

1. Decide whether **remainder quests** stay compressed or get full ports.
2. Fill **skill holes you care about first** (Slayer/Hunter/Farming/Construction are absent).
3. **World scripts** for hubs you actually play (default talk is the symptom of missing loc/NPC handlers).
4. **Boss scripts**: implement or unregister Zulrah empty venom-cloud mechanic (Mole dig and Zulrah snakelings are wired).
5. **Protocol**: opcode 50 / `OPNPC5` is decoded; unused `MAP_EDIT` (195) was removed.
6. **Vanilla `getContentDataPacket()`** only if custom items must show on vanilla.
7. Expand `yarn --cwd server test` or CI to the quest/combat files you rely on.

Client status: [docs/client-status.md](/client-status).
