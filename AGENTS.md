# Agent notes (this fork)

XRSPS is a TypeScript OSRS server (`server/`) plus a React/WebGL client (`client/`) that both load the real OSRS cache. Human docs live in `docs/`. A file-to-task map is in `docs/agent-index.md`.

Do **not** start `yarn start`, `yarn server`, `yarn client`, or the Cursor IDE browser unless the user asks. They run the process themselves and play in an external browser.

## Where new code goes

| Change | Put it here |
| --- | --- |
| How *this* server plays (XP, loot, tutorial, skills, quests) | `server/gamemodes/{id}/` — usually extend `VanillaGamemode` |
| Tools that should work on any gamemode | `server/extrascripts/{id}/` exporting `register` |
| Tick, pathing, persistence, packet routing, sync | `server/src/` — do not add gamemode-specific content here |
| Opcodes, shared types, varp IDs used by client and server | `client/common/` |
| Custom item defs (IDs **50000+**) | `client/custom/items/` + register from gamemode/extrascript |
| Cache loaders, CS2 VM, models (Jagex ports) | `client/rs/` — mechanical ports only |
| React chrome | `client/components/` only |

Do not invent JSON WebSocket APIs for UI. Drive existing widgets with **varps/varbits** when OSRS already does.

## Verified facts (do not “simplify” these)

- **Tick:** default `tickMs` is 600 (`server/src/config/index.ts`, `TICK_MS` override). Phase order is `TickPhaseOrchestrator`, not a 4-step sketch.
- **Gamemode selection:** `GAMEMODE` env → `server/config.json` → code fallback `"vanilla"`. This repo’s committed config currently uses `leagues-v`.
- **Discovery:** gamemode = `server/gamemodes/{id}/index.ts` exporting `createGamemode()`. Extrascript = `server/extrascripts/{id}/index.ts` exporting `register`.
- **Load order:** `bootstrapScripts` runs `gamemode.registerHandlers` then extrascrpts, **then** `gamemode.initialize()`. `leagues-v` snapshots custom content in `initialize()`.
- **Handler stacks:** newest registration wins (`ScriptRegistry`). Extrascripts shadow gamemode handlers unless they wrap the previous one.
- **Wire format:** binary WebSocket frames. `GAMEMODE_DATA` may contain deflated JSON inside the envelope.
- **Custom content to the client:** only if the gamemode implements `getContentDataPacket()`. `leagues-v` does; `vanilla` does not.
- **Persistence:** `PersistenceProvider`; default SQLite `game.sqlite` under `server/data/gamemodes/{id}/`. Autosave default 120s.
- **Cache:** `server/target.txt`; files in `server/caches/` (gitignored). Collision data in `server/cache/collision/`.
- **Shared compile paths:** server `tsconfig.json` includes `client/rs` and `client/common`.

## Copy these, not Leagues V internals

| Task | Canonical example |
| --- | --- |
| Extrascript | `server/extrascripts/item-spawner/` |
| Skill registration | `server/gamemodes/vanilla/skills/` (`skills/index.ts` + one skill folder) |
| Small quest | `server/gamemodes/vanilla/quests/definitions/cooksAssistant/` |
| Client opcodes | `client/common/network/ClientPacketId.ts` |
| Server opcodes | `client/common/packets/ServerPacketId.ts` |
| Routing after decode | `server/src/network/MessageRouter.ts` + `MessageHandlers.ts` |
| Gamemode class | `server/gamemodes/vanilla/index.ts` or `leagues-v/index.ts` (extend vanilla) |

## Verify

- `yarn --cwd server typecheck` uses `tsconfig.quests.json`: `server/src`, listed vanilla **quest** files, plus imported `client/rs` and `client/common`. It does **not** typecheck most of `gamemodes/vanilla/skills`, `leagues-v`, or `extrascripts`.
- `yarn --cwd client typecheck` covers the client app (not `client/scripts`).
- `yarn --cwd server test` runs **only** `authentication.test.ts` and `friends-chat.test.ts`. Other files under `server/tests/` are run individually: `yarn --cwd server tsx tests/<file>.test.ts`.
- `yarn --cwd client test` runs the client test list in `client/package.json`.

Do not parse or rewrite files under `server/caches/`. Do not restyle `client/rs/**`.
