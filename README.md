# XRSPS

A community-driven project inspired by Project Zanaris.
OSRS in the browser with a React/WebGL client and TypeScript WebSocket server.

## Packages

This repository contains:

- [`client/`](client/) — `@xrsps/client` (browser app)
- [`server/`](server/) — `@xrsps/server` (game server)
- [`docs/`](docs/) — documentation site

## Quick Start

Requires **Node.js v22.16+**.

### Windows

1. Clone this repository.
2. Double-click [`tools/dev.bat`](tools/dev.bat).

The first run installs Yarn 4 via Corepack if needed, installs packages, fetches the game cache, and builds collision data (this can take several minutes). After that it starts the server and the web client together. Later launches skip setup and only start. Close the window or press Ctrl+C to stop both.

### Other platforms (or Windows from a terminal)

This repository uses Yarn `4.12.0`. If `yarn --version` is not `4.12.0`, run `corepack enable` first.

```bash
yarn install
yarn setup
yarn start
```

Start only the server with `yarn server`, or only the client with `yarn client`.

Start the documentation site (optional):

```bash
cd docs
yarn install
yarn dev
```

See [docs/setup.md](docs/setup.md) for details.

---

Fan project. Not affiliated with, endorsed by, or connected to Jagex Ltd.
Old School RuneScape and related assets/trademarks belong to their respective owners.
