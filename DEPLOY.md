# Self-Hosting mesh

> **Private. Decentral. Yours.**

This guide covers everything you need to self-host mesh — from the quickest setup to full production deployments.

---

## Prerequisites

- **Docker** (v20.10+) and **Docker Compose** (v2)
- A **Matrix homeserver** (your own Synapse/Dendrite/Conduit, or use `matrix.org` for free)
- For production: a **domain name** with DNS pointing to your server

---

## Option 1: Interactive Setup (Recommended)

The fastest way to get mesh running. The script asks a few questions, generates your `.env`, and starts everything:

```bash
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/setup.sh | sh
```

The script will:
1. Check that Docker is installed
2. Ask for your Matrix homeserver, LiveKit setup, and HTTPS preference
3. Download `docker-compose.yml` and generate `.env`
4. Pull images and start all services
5. Show you where mesh is running

---

## Option 2: Manual Setup

### Minimal (bring your own homeserver + LiveKit)

```bash
# 1. Create a directory and download the compose file
mkdir mesh && cd mesh
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/.env.example -o .env

# 2. Edit .env — at minimum, set:
#    MESH_HOMESERVER=your.homeserver.org
#    MESH_LIVEKIT_URL=https://your-livekit-jwt-service.com
#    LIVEKIT_API_KEY=your-real-key
#    LIVEKIT_API_SECRET=your-real-secret
#    LIVEKIT_URL=wss://your-livekit-server.com

# 3. Start
docker compose up -d
```

### Local Dev (built-in LiveKit, no account needed)

```bash
mkdir mesh && cd mesh
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/.env.example -o .env

# Download the LiveKit dev config
mkdir -p contrib/livekit
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/contrib/livekit/livekit.yaml -o contrib/livekit/livekit.yaml

# Edit .env — set MESH_HOMESERVER (or leave as matrix.org)
# Dev keys for LiveKit are pre-filled and match the config.

docker compose --profile livekit up -d
```

This starts a local LiveKit SFU server with dev credentials. The bridge webhook is pre-configured to connect automatically — no manual webhook setup needed.

> Open http://localhost:80 in your browser.

---

## HTTPS with Cloudflare Tunnel

The easiest way to get HTTPS in production. No open ports needed, no certbot, no nginx config.

### How it works

Cloudflare Tunnel creates an encrypted outbound connection from your server to Cloudflare's edge. Traffic flows: `User → Cloudflare (HTTPS) → Tunnel → mesh container (HTTP)`. Your server never exposes ports 80/443 to the internet.

### Setup

1. **Add your domain to Cloudflare** (free plan is fine): [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Create a tunnel**: Zero Trust → Networks → Tunnels → Create a tunnel
3. Choose **Cloudflared** as the connector
4. Copy the **tunnel token**
5. **Add a public hostname** in the tunnel config:
   - Domain: `your-mesh-domain.com`
   - Service: `http://mesh:80`
6. Set the token in your `.env`:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=your-token-here
   ```
7. Start with the cloudflare profile:
   ```bash
   docker compose --profile cloudflare up -d
   ```

> **Security note:** The tunnel token is tied to your Cloudflare account and domain. Treat it like a password — never commit it to git or share it publicly.

---

## Reverse Proxy (without Cloudflare)

If you prefer to manage TLS yourself, mesh includes example configs:

- **nginx**: [`contrib/nginx/mesh.example.conf`](contrib/nginx/mesh.example.conf)
- **Caddy**: [`contrib/caddy/caddyfile`](contrib/caddy/caddyfile)

Key points:
- Proxy `HTTPS → http://localhost:80` (the mesh container)
- For SSE (presence): ensure `proxy_buffering off` and long timeouts
- The bridge is only exposed on `127.0.0.1:3002` — it is not directly accessible from the internet

---

## LiveKit Webhook (Critical for Voice/Video)

The presence bridge needs to receive LiveKit webhook events to track who is muted, on camera, or sharing their screen.

### With built-in LiveKit (`--profile livekit`)

**Nothing to do.** The webhook is pre-configured in `contrib/livekit/livekit.yaml` to point to `http://bridge:3001/webhook` inside the Docker network.

### With external LiveKit (Cloud or self-hosted)

You **must** configure the webhook URL manually:

1. **LiveKit Cloud**: Go to your [LiveKit Cloud dashboard](https://cloud.livekit.io) → Project Settings → Webhooks
2. **Self-hosted LiveKit**: Edit your `livekit.yaml`:
   ```yaml
   webhook:
     api_key: your-api-key
     urls:
       - https://your-mesh-domain.com/api/presence/webhook
   ```

The URL pattern is: `https://YOUR_DOMAIN/api/presence/webhook`

The nginx inside the mesh container proxies `/api/presence/*` to the bridge automatically.

> **Without this webhook, voice/video will work but the sidebar won't show who is muted/on camera.**

---

## Activities: Polls & Whiteboard

Optional in-call activities powered by nordeck widgets.

```bash
# Start the widget containers
docker compose --profile microapps up -d

# Set the public URLs in .env:
MESH_POLLS_URL=https://polls.your-domain.com
MESH_WHITEBOARD_URL=https://whiteboard.your-domain.com

# Restart mesh to pick up the new URLs:
docker compose restart mesh
```

The widget containers listen on `localhost:3003` (polls) and `localhost:3004` (whiteboard). Expose them via your reverse proxy.

See [`docs/microapps.md`](docs/microapps.md) for details.

---

## Environment Variables Reference

### Required

| Variable | Description | Example |
|---|---|---|
| `MESH_HOMESERVER` | Matrix homeserver hostname (without `https://`) | `matrix.example.com` |

### LiveKit (required for voice/video)

| Variable | Description | Example |
|---|---|---|
| `MESH_LIVEKIT_URL` | LiveKit JWT service URL | `https://lk-jwt.example.com` |
| `LIVEKIT_API_KEY` | LiveKit API key | `APIxxxxxxx` |
| `LIVEKIT_API_SECRET` | LiveKit API secret | `secret-min-32-chars` |
| `LIVEKIT_URL` | LiveKit server URL (for bridge reconciliation) | `wss://lk.example.com` |

### Presence Bridge

| Variable | Default | Description |
|---|---|---|
| `MESH_VOICE_STATE_MODE` | `livekit` | `livekit` (client-side) or `bridge` (server-authoritative) |
| `MESH_AUTHORITATIVE_BRIDGE_MODE` | `false` | Explicit feature flag for authoritative mode |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `BRIDGE_VOICE_STATE_AUTHORITATIVE` | `false` | Bridge-side authoritative mode flag |

### Optional

| Variable | Default | Description |
|---|---|---|
| `MESH_ALLOW_CUSTOM_HOMESERVERS` | `false` | Allow login with any homeserver |
| `MESH_PRESENCE_URL` | `/api/presence` | Presence bridge URL (browser-facing) |
| `CLOUDFLARE_TUNNEL_TOKEN` | _(empty)_ | Cloudflare Tunnel token for auto-HTTPS |
| `MESH_POLLS_URL` | _(empty)_ | Public URL of polls widget |
| `MESH_WHITEBOARD_URL` | _(empty)_ | Public URL of whiteboard widget |
| `MESH_PORT` | `80` | Host port for mesh frontend |
| `LIVEKIT_PORT` | `7880` | Host port for built-in LiveKit |

---

## Docker Compose Profiles

| Profile | What it starts | When to use |
|---|---|---|
| _(none)_ | mesh + bridge + redis | You have external LiveKit + own reverse proxy |
| `livekit` | + LiveKit SFU | Local dev or self-hosted LiveKit |
| `cloudflare` | + Cloudflare Tunnel | Auto-HTTPS via Cloudflare |
| `microapps` | + Polls + Whiteboard widgets | You want in-call activities |

Combine profiles: `docker compose --profile livekit --profile cloudflare up -d`

---

## Updating

```bash
cd mesh
docker compose pull
docker compose up -d
```

Redis data is persisted in a Docker volume (`redis_data`). Updates do not lose voice state.

---

## Troubleshooting

### Services won't start

```bash
docker compose ps        # check status
docker compose logs -f   # check logs
```

### "No LiveKit focus URL found" error in the app

- Set `MESH_LIVEKIT_URL` in your `.env`
- If using `--profile livekit`: the LiveKit container may not be running yet
- Check: `docker compose --profile livekit ps`

### Bridge logs show "FATAL: LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set"

- Set `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in your `.env`
- They must match your LiveKit server's keys

### Sidebar doesn't show who is muted/on camera

- The LiveKit webhook is not configured. See [LiveKit Webhook](#livekit-webhook-critical-for-voicevideo) above.
- Check bridge logs: `docker compose logs bridge`

### Cloudflare Tunnel not connecting

- Verify your token: `docker compose --profile cloudflare logs cloudflare-tunnel`
- Make sure the tunnel's public hostname service is set to `http://mesh:80`
- The token is domain-specific — double-check it matches your Cloudflare tunnel

### Voice/video works but presence badges are wrong

- Set `MESH_VOICE_STATE_MODE=bridge` and `MESH_AUTHORITATIVE_BRIDGE_MODE=true` in `.env`
- Restart: `docker compose restart mesh bridge`

### Can't log in — "Homeserver not allowed"

- Set `MESH_ALLOW_CUSTOM_HOMESERVERS=true` in `.env`
- Restart: `docker compose restart mesh`

### Redis connection errors in bridge logs

- Redis should start automatically. Check: `docker compose ps redis`
- If Redis is down: `docker compose restart redis`

---

## Deploy with AI Agent

Copy a ready-made prompt into Claude Code, Cursor, or any AI coding assistant:

See [`contrib/deploy-agent-prompt.md`](contrib/deploy-agent-prompt.md)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  docker compose                                          │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌───────┐              │
│  │   mesh     │  │   bridge   │  │ redis │              │
│  │  (nginx +  │→ │  (Bun +    │→ │       │              │
│  │   React)   │  │   Hono)    │  │       │              │
│  │  :80       │  │  :3001     │  │ :6379 │              │
│  └────────────┘  └────────────┘  └───────┘              │
│        ↑               ↑                                 │
│  ┌─────┴──────┐  ┌─────┴──────┐                         │
│  │ Cloudflare │  │  LiveKit   │   (optional profiles)   │
│  │  Tunnel    │  │   SFU      │                         │
│  └────────────┘  │  :7880     │                         │
│                  └────────────┘                         │
└──────────────────────────────────────────────────────────┘
         ↑                ↑
    HTTPS traffic    WebRTC media
    (users)          (voice/video)
```

- **mesh** — nginx serving the React SPA. Proxies `/api/presence/*` to the bridge.
- **bridge** — Bun/Hono server receiving LiveKit webhooks, serving SSE presence streams.
- **redis** — Persistent voice state store.
- **livekit** _(optional)_ — LiveKit SFU for WebRTC voice/video.
- **cloudflare-tunnel** _(optional)_ — Encrypted tunnel for auto-HTTPS.
