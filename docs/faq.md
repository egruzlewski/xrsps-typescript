# FAQ

## General

### Is there a hosted version I can play?

No. XRSPS is a self-hosted project — you clone the repo and run it locally. See the [Setup Guide](/setup) to get started.

### What cache version is supported?

Check `server/target.txt` for the current cache target. The cache is downloaded automatically from the OpenRS2 Archive.

### Where can I see what's being worked on?

The project roadmap and task tracking is on [Trello](https://trello.com/b/UjMvJYrl/xrsps).

### Can I contribute?

Yes. Fork the repo, make your changes, and open a pull request. Join the [Discord](https://discord.gg/3dzttF2q73) if you have questions.

## Gamemodes

### Should I extend BaseGamemode or VanillaGamemode?

Extend **VanillaGamemode** unless you're building something radically different (e.g. a minigame-only server). Vanilla gives you banking, shops, combat, all skills, and all UI widgets out of the box. Override what you need, inherit what you don't.

### How do I switch which gamemode the server runs?

Set the `GAMEMODE` environment variable or `"gamemode"` in `server/config.json`. Resolution is `process.env.GAMEMODE`, then `config.json`, then the code fallback `"vanilla"` (`server/src/config/index.ts`). The committed `server/config.json` in this repo currently selects `vanilla`.

### Can I use vanilla's combat system without extending VanillaGamemode?

Yes. Import the provider create functions directly from `server/gamemodes/vanilla/combat/` and register them in your `initialize()`. See [Reuse vanilla providers from BaseGamemode](gamemodes.md#customizing-a-provider).

### Where does gamemode-specific player data get stored?

Each gamemode gets its own directory under `server/data/gamemodes/{id}/`. Player state, account credentials, and durable trade recovery data are stored in `game.sqlite` in that directory. Legacy `player-state.json` and `accounts.json` files are imported automatically and left in place as backups.

## Extrascripts

### What's the difference between a gamemode and an extrascript?

A gamemode defines server identity — XP rates, drop tables, tutorials, progression. An extrascript is a universal module that works on any server — debug tools, admin commands, content that isn't gamemode-specific. See [Gamemodes vs Extrascripts](extrascripts.md#gamemodes-vs-extrascripts).

## Custom Content

### How do I add a custom item?

Use `CustomItemBuilder` and `CustomItemRegistry`. Custom items use IDs 50000+ and can clone properties from existing cache items. See [Custom Content](extrascripts.md#custom-content).

### Do custom items work on any gamemode?

On the **server**, yes: `CustomItemRegistry` is process-wide. On the **client**, only if the running gamemode sends them through `getContentDataPacket()`. `leagues-v` does; `vanilla` currently does not.

### How does custom content reach the client?

Via optional `getContentDataPacket()` on `GamemodeDefinition`. The engine sends that packet during login (`LoginHandshakeService`). The client unpacks it in `GamemodeContentStore`. See [Architecture — Custom Content](ARCHITECTURE.md#custom-content).

## Development

### How do varps and varbits work?

Varps are player variables. Varbits are bit-packed sub-variables within a varp. The server sets them, sends delta packets, and client-side CS2 scripts react to update widgets. This is the same system OSRS uses — no custom UI packets needed. See [Architecture](ARCHITECTURE.md#varps-and-varbits).
