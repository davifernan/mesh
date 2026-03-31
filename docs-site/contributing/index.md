# Contributing to mesh

Thanks for taking the time to contribute! All types of contributions are welcome — bug reports, feature suggestions, pull requests, or just starring the repo.

## Development Setup

### Prerequisites

- **Node.js 20+** and **npm**
- A Matrix account on any homeserver (e.g. `matrix.org`)
- Optional: [Bun](https://bun.sh) for running the presence bridge locally

### 1. Clone and install

```bash
git clone https://github.com/davifernan/mesh.git
cd mesh
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The only thing you need for basic development is optional:

```env
# For the GIF picker — get a free key at developers.giphy.com
VITE_GIPHY_API_KEY=your_key_here
```

Everything else has sensible defaults. Leave them as-is.

### 3. Start the web app

```bash
npm run dev
# → http://localhost:8080
```

The app connects to whichever Matrix homeserver you log in with. `matrix.org` works out of the box.

### 4. Start the presence bridge (optional)

Only needed if you're working on voice/call features (mute/camera/deafen badges).

```bash
# Start a local LiveKit instance
docker compose --profile livekit up -d livekit

# Start the bridge
cd bridge
bun install
LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=devsecret bun run dev
# → http://localhost:3001
```

### 5. Desktop app (optional)

```bash
# While npm run dev is already running:
cd desktop
npm install
npm run dev
# → opens Electron window at localhost:8080
```

### Verify everything works

```bash
npm run typecheck   # TypeScript — zero errors expected
npm run lint        # ESLint
```

::: warning Before touching voice/call code
Read [`AGENTS.md`](https://github.com/davifernan/mesh/blob/main/AGENTS.md) first. It documents critical rules and known pitfalls for the Matrix RTC + LiveKit layer. Skipping it causes subtle bugs.
:::

## Bug Reports

Use [GitHub Issues](https://github.com/davifernan/mesh/issues). Search first to avoid duplicates. Use a clear, concise title.

## Pull Requests

- **Discuss new features first** — open an issue or [GitHub Discussion](https://github.com/davifernan/mesh/discussions) before coding
- **Keep PRs small** — smaller PRs get reviewed and merged faster
- **PR title format** — start with a verb: `Add`, `Fix`, `Change`, or `Remove`
- **We use squash merging** — your PR title becomes the final commit message

### Legal

By contributing, you confirm that you have authored 100% of the content and that it may be provided under the project's AGPL-3.0 license.

## Project Structure

```
mesh/
├── src/
│   ├── app/
│   │   ├── features/       — Major UI features (call, room-nav, settings)
│   │   ├── components/     — Shared components
│   │   ├── pages/          — Top-level page components
│   │   ├── hooks/          — React hooks
│   │   └── state/          — Jotai atoms
│   └── client/             — Matrix client initialization
├── bridge/                 — Presence bridge (Bun + Hono)
├── desktop/                — Electron wrapper
├── public/                 — Static assets
└── docs-site/              — This documentation
```
