# Agent index

Routing table for this repository. Operating rules are in **`AGENTS.md` at the repo root** (not a VitePress page). Human guides: [Setup](/setup), [Architecture](/ARCHITECTURE), [Server status](/server-status), [Client status](/client-status), [Gamemodes](/gamemodes), [Extrascripts](/extrascripts), [FAQ](/faq).

| If you are doing… | Read | Then open |
| --- | --- | --- |
| First orientation | this page + `AGENTS.md` | `docs/ARCHITECTURE.md` layout table |
| What is implemented on the server | [Server status](/server-status) | `server/src/`, `server/gamemodes/vanilla/` |
| What is implemented on the client | [Client status](/client-status) | `client/game/`, `client/network/`, `client/widgets/`, `client/render/` |
| Local run / cache / ports | [Setup](/setup) | `server/src/config/index.ts`, `server/target.txt`, `server/config.json` |
| Tick order, packets, varps, persistence | [Architecture](/ARCHITECTURE) | `server/src/game/tick/TickPhaseOrchestrator.ts`, `client/common/network/ClientPacketId.ts`, `client/common/packets/ServerPacketId.ts`, `server/src/network/MessageRouter.ts`, `server/src/game/state/PersistenceProvider.ts` |
| New or changed game rules | [Gamemodes](/gamemodes) | `server/src/game/gamemodes/GamemodeDefinition.ts`, `server/gamemodes/vanilla/index.ts` |
| Commands / debug / universal modules | [Extrascripts](/extrascripts) | `server/extrascripts/item-spawner/index.ts`, `server/src/game/scripts/bootstrap.ts` |
| Script handler API | — | `server/src/game/scripts/types.ts` (`IScriptRegistry`, `ScriptServices`) |
| Custom items (50000+) | [Architecture — Custom Content](/ARCHITECTURE#custom-content) | `client/custom/items/`, `server/src/custom/items/`, `server/gamemodes/leagues-v/LeagueContentProvider.ts` |
| Shared constants | — | `client/common/` |
| Jagex cache / CS2 / models | — | `client/rs/` (port; do not restyle) |
| Client shell / input / sync | [Architecture — client conventions](/ARCHITECTURE#client-code-conventions) | `client/game/`, `client/network/`, `client/widgets/`, `client/render/` |
| React-only UI | — | `client/components/` |

## Easy to get wrong

- Tick order is `TickPhaseOrchestrator`, not a generic “actions, then NPCs, then packets” list.
- Code fallback gamemode is `vanilla`; this repo’s `server/config.json` currently sets `vanilla`.
- `yarn --cwd server test` is not the full `server/tests/` tree.
- Custom items are not delivered to vanilla clients unless that gamemode implements `getContentDataPacket()`.
