# mesh

> **Private. Decentral. Yours.**

mesh is a self-hosted Matrix client with a Discord-style interface, native LiveKit voice/video, end-to-end encryption, and screenshare — built to be hosted by anyone, owned by everyone.

**Host it. Own it.**

---

## Features

- **Matrix protocol** — Decentralized and federated messaging. Voice/video routed via LiveKit SFU.
- **Native LiveKit voice & video** — No iframe, no Element Call dependency. Direct WebRTC via LiveKit SFU.
- **End-to-end encryption** — E2EE enabled by default for messages and calls in private rooms.
- **Discord-style layout** — Spaces, channels, threads, and a familiar 3-column UI.
- **Screenshare** — With system audio, up to 4K resolution.
- **Desktop app** — Electron wrapper for Mac, Windows, and Linux.
- **PWA** — Installable as a Progressive Web App on any platform.
- **Self-hosted** — Docker-first deployment. You run your own instance.

---

## Self-Hosting

### Quick Start (Interactive Setup)

The fastest way to get mesh running — the script asks a few questions and handles everything:

```bash
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/setup.sh | sh
```

### Quick Start (Manual)

```bash
mkdir mesh && cd mesh
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/.env.example -o .env
# Edit .env with your homeserver, LiveKit credentials, etc.
docker compose up -d
```

No `git clone` needed — images are pulled from GHCR automatically.

### Local Dev (built-in LiveKit)

```bash
# Same as above, plus download the LiveKit dev config:
mkdir -p contrib/livekit
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/contrib/livekit/livekit.yaml -o contrib/livekit/livekit.yaml
docker compose --profile livekit up -d
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MESH_HOMESERVER` | Your Matrix homeserver URL | `matrix.org` |
| `MESH_LIVEKIT_URL` | LiveKit JWT service URL | _(empty)_ |
| `LIVEKIT_API_KEY` | LiveKit API key | `devkey` |
| `LIVEKIT_API_SECRET` | LiveKit API secret | `devsecret-...` |
| `MESH_VOICE_STATE_MODE` | `livekit` or `bridge` | `livekit` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel for auto-HTTPS | _(empty)_ |

See [`.env.example`](.env.example) for the full list with documentation.

### Docker Image

```bash
docker pull ghcr.io/davifernan/mesh:latest
```

### Full Deployment Guide

See [`DEPLOY.md`](DEPLOY.md) for the complete self-hosting documentation — including HTTPS setup, Cloudflare Tunnel, LiveKit webhook configuration, troubleshooting, and more.

### Deploy with AI Agent

Copy a ready-made prompt into Claude Code, Cursor, or any AI coding assistant and let it deploy mesh for you:

See [`contrib/deploy-agent-prompt.md`](contrib/deploy-agent-prompt.md)

---

## Configuration

All configuration happens through your `.env` file. The frontend `config.json` is auto-generated at container startup from environment variables — you never need to edit it directly.

For reverse proxy configs, see [`contrib/nginx/`](contrib/nginx/) and [`contrib/caddy/`](contrib/caddy/).

---

## Desktop App

Download the latest release from [GitHub Releases](https://github.com/davifernan/mesh/releases).

Supported platforms:
- macOS (Apple Silicon + Intel)
- Windows (x64)
- Linux (AppImage, deb, rpm)

---

## Development

```bash
npm install
npm run dev      # Web app on http://localhost:8080
```

For the Electron desktop app:

```bash
cd desktop
npm install
npm run dev
```

For the presence bridge (Bun):

```bash
cd bridge
bun run dev
```

---

## Architecture

```
mesh (one app, no iframe)
│
├── matrix-js-sdk     — Matrix protocol, E2EE, MatrixRTC memberships
├── livekit-client    — WebRTC/SFU voice & video
└── bridge/           — Server-side LiveKit → presence state (Bun + Hono)
```

See [`AGENTS.md`](AGENTS.md) for the full technical architecture and implementation rules.

---

## AGPL License & Credits

mesh is free software licensed under [AGPL-3.0](LICENSE).

It builds on the work of:
- [Cinny](https://github.com/cinnyapp/cinny) — original Matrix client UI (AGPL-3.0)
- [Fluxer](https://github.com/FluxerApp/Fluxer) — Discord-style UI patterns (AGPL-3.0)
- [Element Call](https://github.com/element-hq/element-call) — MatrixRTC reference implementation (AGPL-3.0)
- [LiveKit](https://livekit.io) — WebRTC SFU infrastructure (Apache-2.0)

Original copyright headers from upstream projects are preserved in all source files.

---

## Project Website

[hostmesh.diy](https://hostmesh.diy)
