# Configuration

All configuration happens through your `.env` file. The frontend `config.json` is auto-generated at container startup from environment variables — you never edit it directly.

Start from the example:
```bash
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/.env.example -o .env
```

## Required

| Variable | Description | Example |
|---|---|---|
| `MESH_HOMESERVER` | Matrix homeserver hostname (without `https://`) | `matrix.example.com` |

## LiveKit (required for voice/video)

| Variable | Description | Example |
|---|---|---|
| `MESH_LIVEKIT_URL` | LiveKit JWT service URL | `https://lk-jwt.example.com` |
| `LIVEKIT_API_KEY` | LiveKit API key | `APIxxxxxxx` |
| `LIVEKIT_API_SECRET` | LiveKit API secret (min 32 chars) | `my-secret-key-at-least-32chars` |
| `LIVEKIT_URL` | LiveKit server WebSocket URL | `wss://lk.example.com` |

## Presence Bridge

| Variable | Default | Description |
|---|---|---|
| `MESH_VOICE_STATE_MODE` | `livekit` | `livekit` (client-side) or `bridge` (server-authoritative) |
| `MESH_AUTHORITATIVE_BRIDGE_MODE` | `false` | Enable server-authoritative presence |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |

## Security (recommended for production)

| Variable | Default | Description |
|---|---|---|
| `BRIDGE_AUTH_SECRET` | _(empty)_ | Shared secret for presence bridge auth. Generate with `openssl rand -hex 32`. Empty = no auth (dev only). |
| `BRIDGE_ALLOWED_ORIGINS` | _(empty)_ | Comma-separated CORS allow-list. Empty = all origins (dev only). Example: `https://mesh.example.com` |
| `MESH_TOKEN_STORAGE_MODE` | `encrypted-local` | Token storage: `encrypted-local` (AES, recommended), `local` (plaintext), `session` (strictest) |

## Optional

| Variable | Default | Description |
|---|---|---|
| `MESH_ALLOW_CUSTOM_HOMESERVERS` | `true` | Allow login with any homeserver |
| `MESH_PRESENCE_URL` | `/api/presence` | Presence bridge URL (browser-facing) |
| `CLOUDFLARE_TUNNEL_TOKEN` | _(empty)_ | Cloudflare Tunnel token for auto-HTTPS |
| `MESH_POLLS_URL` | _(empty)_ | Public URL of polls widget (Activities) |
| `MESH_WHITEBOARD_URL` | _(empty)_ | Public URL of whiteboard widget (Activities) |
| `MESH_PORT` | `80` | Host port for mesh frontend |
| `LIVEKIT_PORT` | `7880` | Host port for built-in LiveKit |
| `VITE_GIPHY_API_KEY` | _(empty)_ | Giphy API key for GIF picker (build-time) |

## Example `.env` for production

```env
# Matrix
MESH_HOMESERVER=matrix.example.com

# LiveKit
MESH_LIVEKIT_URL=https://livekit-jwt.example.com
LIVEKIT_API_KEY=APIfoobar
LIVEKIT_API_SECRET=my-very-long-secret-key-at-least-32-chars
LIVEKIT_URL=wss://livekit.example.com

# Security
BRIDGE_AUTH_SECRET=generated-with-openssl-rand-hex-32
BRIDGE_ALLOWED_ORIGINS=https://mesh.example.com
MESH_TOKEN_STORAGE_MODE=encrypted-local

# HTTPS
CLOUDFLARE_TUNNEL_TOKEN=your-cloudflare-tunnel-token
```
