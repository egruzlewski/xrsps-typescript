# Extrascripts

Extrascripts are **optional content modules** that work independently of which gamemode is running. They're for universal functionality — things like debug tools, admin commands, or content that should exist on any server regardless of gamemode.

Extrascripts live in `server/extrascripts/{id}/` and export a `register` function.

## Creating an Extrascript

### 1. Create the directory

```
server/extrascripts/my-script/
  index.ts
```

### 2. Export a register function

```typescript
// server/extrascripts/my-script/index.ts
import type { IScriptRegistry, ScriptServices } from "../../src/game/scripts/types";

export function register(registry: IScriptRegistry, services: ScriptServices): void {
    registry.registerCommand("hello", (event) => {
        services.messaging.sendGameMessage(event.player, "Hello from my extrascript!");
    });
}
```

That's it. Drop a folder in `server/extrascripts/` with an `index.ts` exporting `register`, and it loads automatically at startup. No configuration needed.

## What extrascripts can do

Extrascripts have access to the same `IScriptRegistry` and `ScriptServices` as gamemodes. They can register:

- **Commands** — `::mycommand` chat commands
- **NPC interactions** — talk-to, attack, pickpocket, etc.
- **Loc interactions** — object click handlers
- **Item actions** — inventory item options, item-on-item, item-on-loc
- **Widget buttons** — UI button click handlers
- **Region events** — enter/leave region triggers
- **Tick handlers** — per-tick logic

## Load Order

1. Gamemode calls `registerHandlers()` first
2. All extrascripts call `register()` after

`ScriptRegistry` keeps a **stack per key**; `find*` returns the **newest** registration. Extrascripts therefore **shadow** a gamemode handler for the same NPC/loc/item/widget key unless the extrascrpt wraps the previous handler (see `server/tests/script-registry-handler-stacks.test.ts`). Both handlers do not run automatically.

## Hot Reload

Extrascripts support hot-reload during development. Set `SCRIPT_HOT_RELOAD=1`; `bootstrapScripts` watches `server/extrascripts/` recursively. **Gamemodes are not hot-reloaded.**

Custom items/widgets registered in an extrascrpt reach the **client** only if the active gamemode implements `getContentDataPacket()` and includes the registries. Today **`leagues-v` does** (`LeagueContentProvider.build()` runs in `initialize()`, after extrascrpt `register()`). **`vanilla` does not** send `GAMEMODE_DATA`.

## Gamemodes vs Extrascripts

| Use case                                                 | System                        |
| -------------------------------------------------------- | ----------------------------- |
| Server-specific rules (XP rates, tutorials, progression) | [Gamemode](gamemodes.md)      |
| Universal tools (debug commands, admin utilities)        | Extrascript                   |
| Content that only matters for one server type            | Gamemode `registerHandlers()` |
| Content that should work on any server                   | Extrascript                   |

**Rule of thumb:** if it makes sense on every server, it's an extrascript. If it defines or changes how the server plays, it's a gamemode.

## Custom Content

Both gamemodes and extrascripts can define **custom items** and **custom widgets** using the built-in registries. The server resolves them immediately. The client receives them only if the active gamemode implements `getContentDataPacket()` and includes the registries in that packet.

### Custom Items

Use `CustomItemBuilder` and `CustomItemRegistry` to define items that don't exist in the OSRS cache. Custom items use IDs starting at **50000+** to avoid conflicts.

```typescript
import { CustomItemBuilder } from "../../../client/custom/items/CustomItemBuilder";
import { CustomItemRegistry } from "../../../client/custom/items/CustomItemRegistry";

CustomItemRegistry.register(
    CustomItemBuilder.create(50100)
        .basedOn(3834) // clone properties from an existing cache item
        .name("My Custom Item")
        .inventoryActions("Activate", null, null, null, "Drop")
        .build(),
    "my-source-id",
);
```

The client resolves custom items via `CustomObjTypeLoader` **after** the gamemode content packet has registered them. Without that packet, they exist only on the server.

### Custom Widgets

Use `CustomWidgetRegistry` to define widget groups that don't exist in the cache:

```typescript
import { CustomWidgetRegistry } from "../../src/game/scripts/CustomWidgetRegistry";

const widgetGroup = buildMyWidgetGroup(); // your widget definition
CustomWidgetRegistry.register(widgetGroup);
```

Custom widgets are included in the client payload only when the gamemode’s `getContentDataPacket()` serializes `CustomWidgetRegistry` (`leagues-v` does this).

### Content Data Packet

Gamemodes can send arbitrary data to the client by implementing `getContentDataPacket()`. This is how custom items, widgets, and gamemode-specific data (like league tasks) reach the client. The core engine handles packet delivery at login — gamemodes just build the payload.

## Bundled Extrascripts

| Extrascript    | Description                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item-spawner` | Admin debug tool — custom widget for searching and spawning items. Uses `CustomItemBuilder` and `CustomWidgetRegistry` for custom UI. Command: `::itemspawner` |

## Skill Implementations

Skills are owned by the vanilla gamemode and registered via its `registerHandlers()` call. Gamemodes that extend vanilla (such as Leagues V) inherit all skill handlers through `super.registerHandlers()`.

Skills register their own action handlers via `registerActionHandler`, making them fully self-contained — the engine has no hardcoded knowledge of any skill's logic.

```
server/gamemodes/vanilla/skills/
├── index.ts                 # Aggregates sub-module register calls
├── consumables/             # Food eating, potion drinking
├── crafting/                # Flax picking, spinning wheel
├── firemaking/              # Fire lighting
├── fishing/                 # Fishing spots, minnow exchange
├── fletching/               # Log cutting, bow stringing, arrow/bolt combining
├── herblore/                # Herb cleaning, potions, stamina
├── mining/                  # Rock mining
├── prayer/                  # Bone burying, ash scattering, altar offering
├── production/              # Cooking, tanning, bolt enchanting
├── sailing/                 # Sailing, pandemonium
├── smithing/                # Smithing, smelting
├── thieving/                # NPC pickpocketing, lock picking
└── woodcutting/             # Tree chopping
```
