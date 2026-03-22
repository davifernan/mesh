# mesh

> **Private. Decentral. Yours.**

mesh is a self-hosted Matrix client with a Discord-style interface, native LiveKit voice/video, end-to-end encryption, and screenshare — built to be hosted by anyone, owned by everyone.

**Host it. Own it.**

---

## Features

- **Matrix protocol** — Fully decentralized and federated. No central server.
- **Native LiveKit voice & video** — No iframe, no Element Call dependency. Direct WebRTC via LiveKit SFU.
- **End-to-end encryption** — Messages and calls are E2EE by default.
- **Discord-style layout** — Spaces, channels, threads, and a familiar 3-column UI.
- **Screenshare** — With system audio, up to 4K resolution.
- **Desktop app** — Electron wrapper for Mac, Windows, and Linux.
- **PWA** — Installable as a Progressive Web App on any platform.
- **Self-hosted** — Docker-first deployment. You run your own instance.

---

## Self-Hosting

### Quick Start (Docker Compose)

```bash
git clone https://github.com/davifernan/mesh.git
cd mesh
cp .env.example .env
# Edit .env with your homeserver, LiveKit URL, etc.
docker compose up -d
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MESH_HOMESERVER` | Your Matrix homeserver URL | `matrix.org` |
| `MESH_LIVEKIT_URL` | LiveKit JWT service URL | _(empty)_ |
| `MESH_PRESENCE_URL` | Presence bridge URL | `/api/presence` |
| `MESH_VOICE_STATE_MODE` | `livekit` or `bridge` | `livekit` |
| `MESH_POLLS_URL` | Optional: polls widget URL | _(empty)_ |
| `MESH_WHITEBOARD_URL` | Optional: whiteboard widget URL | _(empty)_ |

### Docker Image

```bash
docker pull ghcr.io/davifernan/mesh:latest
docker run -p 8080:80 ghcr.io/davifernan/mesh:latest
```

### Nginx / Reverse Proxy

See [`contrib/nginx/mesh.example.conf`](contrib/nginx/mesh.example.conf) for a ready-to-use Nginx config.

For Caddy, Netlify, and hash-router setups, see [`config.json`](config.json).

---

## Configuration

Copy [`config.json`](config.json) and mount it into the container:

```json
{
  "defaultHomeserver": 0,
  "homeserverList": ["your.homeserver.org"],
  "allowCustomHomeservers": true,
  "livekitServiceUrl": "https://lk-jwt.your-domain.com",
  "presenceUrl": "https://your-domain.com/api/presence"
}
```

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
