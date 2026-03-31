# mesh

> **Private. Decentral. Yours.**

mesh is a self-hosted Matrix client with a Discord-style interface, native LiveKit voice/video, end-to-end encryption, and screenshare — built to be hosted by anyone, owned by everyone.

**Host it. Own it.**

---

## How this project was built — and why

mesh is an **early, experimental project built entirely with AI assistance**. Not a single line of code was written by hand. This is stated upfront because transparency matters more than optics.

**The backstory:** I was looking for a decentralized, privacy-focused Discord alternative and came across [Fluxer](https://github.com/FluxerApp/Fluxer) — a well-built open-source Discord-like platform. But when I saw that their focus wasn't on privacy and decentralization, I decided to take matters into my own hands.

Starting from [Cinny](https://github.com/cinnyapp/cinny) (a clean Matrix client) and its Element Call integration (which has since been merged upstream into Cinny itself), I took a different direction: **native LiveKit voice/video integration** — no iframe, no Element Call dependency — combined with a **Discord-style UI** so that people switching from Discord have a familiar, lower-friction experience.

**The current state is honest:**
- The core features work — voice, video, screenshare, E2EE, messaging, spaces, channels.
- It is not fully polished. Not everything is optimized. Some rough edges remain.
- It is early, experimental software — not a finished product.

**What happens next is up to the community.** The foundation is there. From here, I'd love for others to get involved — whether that's opening issues, sending PRs, suggesting improvements, or forking it into something entirely their own. All of that would genuinely make me happy.

This project doesn't pretend to be something it isn't. It's an AI-built starting point for a privacy-first, decentralized Discord alternative — open for anyone to inspect, improve, or build upon.

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
| `BRIDGE_ALLOWED_ORIGINS` | Allowed CORS origins for presence bridge (comma-separated) | _(empty = all)_ |
| `BRIDGE_AUTH_SECRET` | Shared secret for presence bridge auth | _(empty = disabled)_ |
| `MESH_TOKEN_STORAGE_MODE` | Token storage: `encrypted-local`, `local`, or `session` | `encrypted-local` |
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

## Privacy & Security Notes

mesh aims for strong privacy, but there are inherent limitations you should be aware of:

- **E2EE scope:** End-to-end encryption protects message content and call media (audio/video frames) in encrypted rooms. Public rooms do not support E2EE — this is a Matrix protocol limitation, not a mesh choice.
- **Metadata visibility:** Call membership events (who joins/leaves a call) are Matrix state events, which [cannot currently be encrypted](https://github.com/matrix-org/matrix-spec-proposals/pull/3401). Your homeserver operator can see who participates in calls, even in encrypted rooms. This is a known open problem in the Matrix spec.
- **SFU routing:** Voice and video streams are routed through a LiveKit SFU. With E2EE enabled, the SFU forwards encrypted frames it cannot decrypt. Without E2EE (public rooms), the SFU can see media content.
- **Presence bridge:** The optional presence bridge tracks call state (mute/camera/screenshare) server-side for sidebar badges. This metadata is visible to the bridge operator.

For maximum privacy, use encrypted rooms and self-host both your Matrix homeserver and LiveKit instance.

---

## AGPL License & Credits

mesh is free software licensed under [AGPL-3.0](LICENSE).

It builds on the work of:
- [Cinny](https://github.com/cinnyapp/cinny) — original Matrix client UI (AGPL-3.0)
- [Fluxer](https://github.com/FluxerApp/Fluxer) — Discord-style UI patterns and sound effects (AGPL-3.0)
- [Element Call](https://github.com/element-hq/element-call) — MatrixRTC reference implementation (AGPL-3.0)
- [LiveKit](https://livekit.io) — WebRTC SFU infrastructure (Apache-2.0)

Original copyright headers from upstream projects are preserved in all source files.

---

## Project Website

[hostmesh.diy](https://hostmesh.diy)
