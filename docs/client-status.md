# Client implementation status

Code-read snapshot of **2026-08-31**. Audit of what exists in the tree, not a playtest report and not an OSRS-parity claim. Same legend as [Server status](/server-status).

**In scope:** [`client/game/`](../client/game/), [`client/network/`](../client/network/), [`client/widgets/`](../client/widgets/), [`client/render/`](../client/render/), [`client/ui/`](../client/ui/), [`client/components/`](../client/components/), [`client/common/`](../client/common/), [`client/custom/`](../client/custom/). [`client/rs/`](../client/rs/) is summarized as a Jagex port (do not restyle it); only gaps that affect this client are listed.

**Out of scope:** server gameplay, `client/scripts/` cache exporters except as tooling notes.

Architecture (how pieces fit) lives in [Architecture](/ARCHITECTURE). This page answers “what is wired, what is thin, what is missing.”

## Legend

| Status | Meaning |
| --- | --- |
| **Wired** | Used on a real login, packet, input, or render path. Core loops exist. |
| **Partial** | Wired, but TODOs, stubs, or thin coverage vs a full OSRS client. |
| **Scaffold** | Types, hooks, or CS2 ops exist with little or no real data. |
| **Missing** | Expected OSRS client system with no dedicated module. |
| **Unverified** | Code is present and large; tests are too thin to claim more than “present.” |

Each section lists **path**, **what is wired**, **gaps**, **tests**, and a **next step** only when the gap is obvious from code.

---

## Executive gap list

### Missing (no dedicated client system)

- **Grand Exchange / trading post UI data** — CS2 [`MarketOps.ts`](../client/rs/cs2/handlers/MarketOps.ts) always returns empty/stable offers. No GE packet handlers.
- **Official world-list CS2** — [`WorldListOps.ts`](../client/rs/cs2/handlers/WorldListOps.ts) pushes zeros. Login uses a **custom** world/server list in [`LoginRenderer`](../client/game/login/LoginRenderer.ts), not the cache world-list protocol.
- **Standalone `HITSPLAT` opcode (82)** — enumerated in [`ServerPacketId`](../client/common/packets/ServerPacketId.ts) but **not decoded** in [`ServerBinaryDecoder.ts`](../client/network/packet/ServerBinaryDecoder.ts). Hitsplats actually arrive via `PLAYER_SYNC` / `NPC_INFO` update blocks.
- **`DEBUG` opcode 250** — same: not in the decoder. Debug JSON uses `DEBUG_PACKET` (86).
- **`MAP_EDIT` (client opcode 195)** — in the high-level packet enum; no encoder in [`ClientBinaryEncoder.ts`](../client/network/packet/ClientBinaryEncoder.ts). Matches the unused server handler.
- **React game chrome** — inventory, minimap, orbs, and menus are **not** React. Comment in [`GameContainer.tsx`](../client/game/GameContainer.tsx): legacy CSS menu / React minimap removed. HUD is WebGL widgets + overlays.

### Scaffold or hollow

- **CS2 clan ops** — [`ClanOps.ts`](../client/rs/cs2/handlers/ClanOps.ts) implements many opcodes against `ctx.clanSettings` / `ctx.clanChannel`, which stay empty without clan packets.
- **CS2 friends *list* sorting** — several `FRIEND_SORT_*` handlers are no-ops. Add/remove/rank go through Friends Chat actions when wired.
- **Custom widgets without `GAMEMODE_DATA`** — [`CustomWidgetGroups.ts`](../client/widgets/custom/CustomWidgetGroups.ts) loads smithing bar modal locally; other groups only if login sends `GAMEMODE_DATA`. Vanilla server does not. [`CustomObjTypeLoader`](../client/custom/items/CustomObjTypeLoader.ts) wraps obj types, but registry is empty until that packet.
- **Procedural texture `RasterizerOperation`** — comment “TODO: actually render” in `client/rs`.

### Partial (high-leverage)

- **[`OsrsClient.ts`](../client/game/OsrsClient.ts)** — ~7.5k-line orchestrator. Wired as the game loop host; internals **Unverified** as a whole. Architecture prefers thin orchestrators; this file is the exception.
- **CS2 VM** — large opcode map ([`handlers/index.ts`](../client/rs/cs2/handlers/index.ts)). Widget/var/config/math/string/db/world-map ops look used; market/world-list/clan are stubs or empty-context.
- **Cache type opcodes** — loaders **throw** on unknown def opcodes (`ObjType`, `NpcType`, `LocType`, `SeqType`, `VarBitType`, floor types). Fine until a newer cache revision hits an unimplemented opcode.
- **`LocType` TODO** — “Breaks bank booth collision?”
- **Mobile** — touch adapter, Safari landscape lock, mobile chat keyboard, login world-select mobile path. Full tablet/desktop parity **Unverified**.
- **Sidebar plugins** — notes, tile markers, ground-item overlay, interact highlight, plugin hub. RuneLite-inspired extras, not OSRS.
- **NPC option 5** — client sends **`OPNPC1` (57)** for op 5 ([`interact.ts`](../client/network/serverConnection/outgoing/interact.ts)), not enum `OPNPC5` (50). Aligns with the server decoder. Opcode 50 is unused by this client.

### Dual protocol (same as server)

1. OSRS-style clicks: [`client/common/network/ClientPacketId.ts`](../client/common/network/ClientPacketId.ts) via `createPacket` / `queuePacket`.
2. High-level messages 180+/200+: [`client/common/packets/ClientPacketId.ts`](../client/common/packets/ClientPacketId.ts) via [`ClientBinaryEncoder`](../client/network/packet/ClientBinaryEncoder.ts) / `send({ type })`.

---

## Shell and boot

### React app entry

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`client/index.tsx`](../client/index.tsx), [`OsrsClientApp.tsx`](../client/game/OsrsClientApp.tsx), [`GameContainer.tsx`](../client/game/GameContainer.tsx) |
| **Wired** | CRA/craco, `BrowserRouter`, wasm gzip/bzip init, optional service worker, `OsrsClientApp` loads cache then constructs `OsrsClient` + `GameContainer`. Loading bar, render-stats overlay, RuneLite-style [`SidebarShell`](../client/game/sidebar/SidebarShell.tsx). |
| **Gaps** | Almost no React routes/pages. Three HUD components only ([`components/`](../client/components/)). |
| **Tests** | None for App. |
| **Next step** | Keep game UI in widgets/`rs`, not new React screens. |

### Client preferences / viewport

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`preferences/ClientPreferences.ts`](../client/game/preferences/ClientPreferences.ts), [`useViewportCssVars.ts`](../client/game/useViewportCssVars.ts), [`useSafariLandscapeLock.ts`](../client/game/useSafariLandscapeLock.ts) |
| **Wired** | Local storage prefs, CSS vars for HUD, iOS landscape lock. |
| **Gaps** | — |
| **Tests** | — |

### Login and cache download

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`game/login/`](../client/game/login/), [`Caches`](../client/game/) via `loadCacheFilesAuto`, [`rs/cache/CacheFiles.ts`](../client/rs/cache/CacheFiles.ts), [`common/utils/CacheManifest.ts`](../client/common/utils/CacheManifest.ts), [`StorageUtil.ts`](../client/common/utils/StorageUtil.ts) |
| **Wired** | Title/login screens (GL), credentials, world/server list overlay, loading bars, IndexedDB + Cache Storage with IDB fallback, persistent-storage budget, JS5/HTTP range streaming ([`rs/cache/js5/`](../client/rs/cache/js5/)). |
| **Gaps** | World picker is custom, not CS2 `WORLDLIST_*`. |
| **Tests** | [`cache-streaming.test.ts`](../client/tests/cache-streaming.test.ts) |

---

## Networking

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`network/ServerConnection.ts`](../client/network/ServerConnection.ts), [`serverConnection/`](../client/network/serverConnection/), [`packet/ServerBinaryDecoder.ts`](../client/network/packet/ServerBinaryDecoder.ts), [`packet/ClientBinaryEncoder.ts`](../client/network/packet/ClientBinaryEncoder.ts), [`combat/CombatStateStore.ts`](../client/network/combat/CombatStateStore.ts) |
| **Wired** | Binary WebSocket, login/handshake/tick, player/NPC sync, inventories, bank, skills, vars, widgets, chat, Friends Chat, shops, trade, smithing, collection log, notifications, `GAMEMODE_DATA`, rebuild region/normal/world-entity, locs, camera control, sound/jingle/song, projectiles, combat state, destination, path response. Dispatch: [`handlers/dispatch.ts`](../client/network/serverConnection/handlers/dispatch.ts). |
| **Gaps** | Opcodes **82 (`HITSPLAT`)** and **250 (`DEBUG`)** not decoded (hitsplats via sync; debug via 86). No GE packets. |
| **Tests** | Indirect (`enter-to-type-chat`, camera). No opcode-matrix test. |
| **Next step** | Drop unused `HITSPLAT`/`DEBUG`/`MAP_EDIT` enums or implement them on both ends. |

Outgoing OSRS ops: loc/npc/player/obj/IF_BUTTON*/examine/walk/appearance from menu/input. NPC op 5 uses opcode **57**, not **50**.

---

## Game domains (`client/game`)

### Orchestrator and state machine

| | |
| --- | --- |
| **Status** | Wired / Unverified |
| **Path** | [`OsrsClient.ts`](../client/game/OsrsClient.ts), [`state/GameStateMachine.ts`](../client/game/state/GameStateMachine.ts), [`ClientState.ts`](../client/game/ClientState.ts) |
| **Wired** | Subscribes to server packets, drives widgets/CS2/camera/sync/hitsplat flush, login vs in-game. `ClientState` holds base coords, destination, mouse-cross, instance flags. |
| **Gaps** | File size vs stated convention. Hard to audit every branch. |
| **Tests** | Lifecycle via renderer test, not OsrsClient unit tests. |

### Sync (player / NPC)

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`game/sync/`](../client/game/sync/) — `PlayerSyncManager`, `PlayerUpdateDecoder`, `NpcUpdateDecoder`, `AppearanceDecoder`, Huffman |
| **Wired** | Appearance, movement, hitsplats, health bars, spot anims, overhead chat, forced movement. |
| **Gaps** | Mask completeness vs live OSRS **Unverified**. |
| **Tests** | [`npc-instance-flush-controller.test.ts`](../client/tests/npc-instance-flush-controller.test.ts), [`direction-orientation.test.ts`](../client/tests/direction-orientation.test.ts) |

### ECS / animation / movement

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`ecs/PlayerEcs.ts`](../client/game/ecs/PlayerEcs.ts), [`ecs/NpcEcs.ts`](../client/game/ecs/NpcEcs.ts), [`movement/`](../client/game/movement/), [`actor/ActorAnimation.ts`](../client/game/actor/ActorAnimation.ts), [`PlayerAnimController`](../client/game/PlayerAnimController.ts) |
| **Wired** | Interpolated walk/run, seq blending, local 32×32 route finder [`OsrsRouteFinder32`](../client/game/movement/OsrsRouteFinder32.ts) (client reconstructs short paths; server pathfinder is authoritative). |
| **Gaps** | Route finder max 50 points vs server 25 — documented in-file. |
| **Tests** | direction-orientation |

### Camera

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`Camera.ts`](../client/game/Camera.ts), render `camera*.ts` |
| **Wired** | Pitch/yaw/zoom, orbit, roof hiding, `CAMERA_CONTROL` packet. |
| **Tests** | [`camera-controls.test.ts`](../client/tests/camera-controls.test.ts) |

### Widgets input / actions (game layer)

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`game/widgets/`](../client/game/widgets/) — input (click/drag/scroll/hold/keyboard), `WidgetActionRouter`, trade/item-spawner, `SpellSelectionController`, `PlayerDesignController`, `NotificationDisplay` |
| **Wired** | IF_BUTTON* and drag, inventory use-on, trade qty, player design (group 679) local then `APPEARANCE_SET`, item spawner search UI, spell targeting packets. |
| **Gaps** | Item spawner is debug/extrascript UI, not OSRS. |
| **Tests** | [`widget-root-onload-race.test.ts`](../client/tests/widget-root-onload-race.test.ts); [`widget-loader.test.ts`](../client/tests/widget-loader.test.ts) exists but is **not** in `yarn --cwd client test`. |

### Chat

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`EnterToTypeChat.ts`](../client/game/chat/EnterToTypeChat.ts), [`MobileChatKeyboard.ts`](../client/game/chat/MobileChatKeyboard.ts), CS2 `ChatOps` / `ChatHistory` |
| **Wired** | Enter-to-type (desktop), mobile keyboard, channel prefixes, Friends Chat snapshot apply. |
| **Tests** | [`enter-to-type-chat.test.ts`](../client/tests/enter-to-type-chat.test.ts), [`chat-channel-prefix.test.ts`](../client/tests/chat-channel-prefix.test.ts) |

### Combat options / prayer (client)

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`CombatOptionsController.ts`](../client/game/combat/CombatOptionsController.ts) |
| **Wired** | Attack style, run, special bar, prayer varbits/head icons, auto-retaliate local state. Server is source of truth for drain/combat. |
| **Gaps** | — |

### World map

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`game/worldMap/`](../client/game/worldMap/), [`rs/map/`](../client/rs/map/), widget world-map draw |
| **Wired** | Archive renderer, drag/click, icons, `WORLD_MAP_CLICK` packet. |
| **Gaps** | Full map feature parity **Unverified**. |
| **Tests** | — |

### World views / sailing presentation

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`worldview/`](../client/game/worldview/), [`render/WorldEntityAnimator.ts`](../client/render/WorldEntityAnimator.ts), `REBUILD_WORLDENTITY` / `WORLDENTITY_INFO` |
| **Wired** | Nested world entities for boats/instances. |
| **Gaps** | Depends on server sailing; client is the renderer. |
| **Tests** | — |

### Scene / roofs / collision (client)

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`scene/`](../client/game/scene/), [`roof/RoofVisibility.ts`](../client/game/roof/RoofVisibility.ts), [`collision/CollisionFlags.ts`](../client/game/collision/CollisionFlags.ts), [`MapManager.ts`](../client/game/MapManager.ts) |
| **Wired** | Scene rebuild from region packets, raycast/pick, roof varbit, local collision for click pathing. |
| **Gaps** | LocType bank-booth collision TODO in `rs`. |

### Audio

| | |
| --- | --- |
| **Status** | Partial |
| **Path** | [`game/audio/`](../client/game/audio/) — `MusicSystem`, `SoundEffectSystem`, Vorbis WASM, MIDI synth, varp volume |
| **Wired** | Area music, jingles, SFX, fade params from `PLAY_SONG`. |
| **Gaps** | Browser autoplay / AudioContext resume required. Completeness vs OSRS track set **Unverified**. |
| **Tests** | — |

### Menu / interaction

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`menu/WorldMenuBuilder.ts`](../client/game/menu/WorldMenuBuilder.ts), [`ui/menu/`](../client/ui/menu/), render `interact/` |
| **Wired** | Right-click / tap menus for loc/npc/player/obj/ground, choose-option GL, highlight plugins. |
| **Gaps** | — |

### Plugins (sidebar)

| | |
| --- | --- |
| **Status** | Partial (optional extras) |
| **Path** | [`game/plugins/`](../client/game/plugins/) |
| **Wired** | Notes, tile markers, ground items overlay, interact highlight, plugin hub shell. Persistence in local storage. |
| **Gaps** | Not OSRS; hub is a catalog UI, not a plugin marketplace. |

### Misc game

| System | Status | Path |
| --- | --- | --- |
| Destination / mouse cross | Wired | [`DestinationMarker.ts`](../client/game/DestinationMarker.ts), [`MouseCross.ts`](../client/game/MouseCross.ts) |
| Highlights | Wired | [`highlights/TileHighlightManager.ts`](../client/game/highlights/TileHighlightManager.ts) |
| Varc persistence | Wired | [`vars/VarcPersistence.ts`](../client/game/vars/VarcPersistence.ts) |
| Render workers | Wired | [`worker/`](../client/game/worker/) |
| Debug overlay / Leva | Partial | [`DebugControls`](../client/game/DebugControls.ts) — dev-only |

---

## Widgets (`client/widgets`)

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`WidgetManager.ts`](../client/widgets/WidgetManager.ts), [`WidgetLoader.ts`](../client/widgets/WidgetLoader.ts), [`layout/WidgetLayout.ts`](../client/widgets/layout/WidgetLayout.ts), [`gl/`](../client/widgets/gl/) (tree draw, minimap, click registry, scrollbars, world-map labels), [`cs1/runCs1.ts`](../client/widgets/cs1/runCs1.ts) |
| **Wired** | Cache widget groups, IF1/IF3 layout, GL HUD, CS1 scripts, custom smithing modal + gamemode dynamic groups. |
| **Gaps** | Custom groups besides smithing need `GAMEMODE_DATA`. |
| **Tests** | widget-root-onload-race; widget-loader not in default `yarn test`. |

Game UI is **cache widgets + CS2**, matching the server varp model. Do not invent JSON widget APIs.

---

## Render (`client/render`)

| | |
| --- | --- |
| **Status** | Wired / Unverified |
| **Path** | [`WebGLOsrsRenderer.ts`](../client/render/WebGLOsrsRenderer.ts), [`render/render/`](../client/render/render/) (frame, terrain, locs, npcs, players, overlays, streaming, quality, shaders) |
| **Wired** | PicoGL WebGL scene, map squares, models, water, FXAA, chatheads, minimap, overlay manager (hitsplats, health bars, overhead, ground items, widgets). |
| **Gaps** | Split into many `*2.ts`/`*3.ts` shards; treat as one renderer. Visual parity **Unverified**. |
| **Tests** | [`renderer-lifecycle.test.ts`](../client/tests/renderer-lifecycle.test.ts) |

Overlays live under [`ui/devoverlay/`](../client/ui/devoverlay/) despite the name: hitsplats, health bars, overhead text/prayer, widgets, ground items, path, markers — used in production frames, not only “dev.”

---

## `client/rs` (Jagex port)

| | |
| --- | --- |
| **Status** | Wired (port) / Partial (some ops) |
| **Path** | cache store/js5, config type loaders, models/seq/skeletal, scene, CS2 VM, sprites, textures (incl. procedural), audio vorbis/MIDI, inventory, map, skills enum, prayer defs |
| **Wired** | Same cache revision as the server. CS2 runs widget onLoad/onClick. |
| **Gaps** | Unknown config opcodes **throw**. Market/world-list CS2 stubs. Procedural rasterizer TODO. LocType bank booth comment. |
| **Tests** | None targeting `rs/**` in `yarn --cwd client test`. |
| **Next step** | Do not restyle. Fix opcodes only when a cache bump fails load. |

---

## Shared / custom

| System | Status | Path | Notes |
| --- | --- | --- | --- |
| `client/common` | Wired | packets, vars, Friends Chat types, collection log JSON, quest list types, spells payload | Shared with server compile |
| Custom items | Scaffold on vanilla | [`custom/items/`](../client/custom/items/) | Loader wraps cache; empty until `GAMEMODE_DATA` |
| Gamemode content store | Partial | [`GamemodeContentStore.ts`](../client/common/gamemode/GamemodeContentStore.ts) | League datasets + loc/terrain overrides + dynamic widgets; no-op if packet never sent |
| Collection log JSON | Wired as data | [`common/collectionlog/`](../client/common/collectionlog/) | UI is CS2 + server snapshot |

---

## Input

| | |
| --- | --- |
| **Status** | Wired |
| **Path** | [`game/input/TouchInputAdapter.ts`](../client/game/input/TouchInputAdapter.ts), widget input modules, login mouse/keyboard, render `controls.ts` |
| **Wired** | Mouse, wheel, keys (including enter-to-type vs WASD camera), touch, modifier flags for ctrl-click. |
| **Gaps** | Gamepad **Missing**. |
| **Tests** | camera-controls, enter-to-type-chat |

---

## Explicit protocol / stub table

| Item | Notes |
| --- | --- |
| `ServerPacketId.HITSPLAT` (82) | Not decoded; hitsplats in sync blocks |
| `ServerPacketId.DEBUG` (250) | Not decoded; use 86 |
| `ClientPacketId.OPNPC5` (50) | Never sent; op 5 uses 57 |
| `ClientPacketId.MAP_EDIT` (195) | No encoder |
| CS2 `STOCKMARKET_*` / `TRADINGPOST_*` | Empty offers |
| CS2 `WORLDLIST_*` | Zeros; custom login list instead |
| `LocType` bank booth | TODO comment |
| `RasterizerOperation` | TODO actually render |

---

## Test coverage map

`yarn --cwd client test` runs **only**:

- `direction-orientation.test.ts`
- `npc-instance-flush-controller.test.ts`
- `cache-streaming.test.ts`
- `enter-to-type-chat.test.ts`
- `chat-channel-prefix.test.ts`
- `camera-controls.test.ts`
- `renderer-lifecycle.test.ts`
- `widget-root-onload-race.test.ts`

**Not** in that list: `widget-loader.test.ts`.

`yarn --cwd client typecheck` covers the client app, **not** `client/scripts/`.

There is no client test for packet decode completeness, CS2 opcode coverage, or login.

---

## Suggested development order (client)

1. Treat **vanilla missing `GAMEMODE_DATA`** as a server issue; client already applies the packet.
2. Clean **dead opcodes** (`HITSPLAT` 82, `DEBUG` 250, `MAP_EDIT` 195, unused `OPNPC5` 50) or implement both sides together.
3. Do not build a React HUD; extend **widgets + CS2**.
4. GE / official world list / clans need **server packets first**; CS2 stubs will stay empty until then.
5. Shrink or split **`OsrsClient.ts`** only when touching that area (convention, not a blocker).
6. Add `widget-loader.test.ts` to `yarn test` if you rely on it.

Server status: [docs/server-status.md](/server-status).
