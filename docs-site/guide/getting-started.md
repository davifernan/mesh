# Self-Hosting mesh

> **Private. Decentral. Yours.**

Everything you need to run mesh on your own server.

## Prerequisites

- **Docker** (v20.10+) and **Docker Compose** (v2)
- A **Matrix homeserver** — your own [Synapse](https://github.com/element-hq/synapse), [Dendrite](https://github.com/matrix-org/dendrite), or [Conduit](https://conduit.rs/), or use `matrix.org` for free
- For production: a **domain name** with DNS pointing to your server

## Option 1: Interactive Setup (Recommended)

The fastest way to get mesh running. The script asks a few questions and handles everything:

```bash
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/setup.sh | sh
```

The script will:
1. Check that Docker is installed
2. Ask for your Matrix homeserver, LiveKit setup, and HTTPS preference
3. Download `docker-compose.yml` and generate `.env`
4. Pull images and start all services
5. Show you where mesh is running

## Option 2: Manual Setup

### Minimal setup (bring your own homeserver + LiveKit)

```bash
mkdir mesh && cd mesh
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/.env.example -o .env

# Edit .env — at minimum set:
# MESH_HOMESERVER=your.homeserver.org
# MESH_LIVEKIT_URL=https://your-livekit-jwt-service.com
# LIVEKIT_API_KEY=your-real-key
# LIVEKIT_API_SECRET=your-real-secret

docker compose up -d
```

### Local dev (built-in LiveKit, no account needed)

```bash
mkdir mesh && cd mesh
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/.env.example -o .env
mkdir -p contrib/livekit
curl -fsSL https://raw.githubusercontent.com/davifernan/mesh/main/contrib/livekit/livekit.yaml -o contrib/livekit/livekit.yaml

docker compose --profile livekit up -d
```

Open `http://localhost:80` in your browser.

## HTTPS with Cloudflare Tunnel

The easiest way to get HTTPS in production — no open ports, no certbot, no nginx config.

Cloudflare Tunnel creates an encrypted outbound connection from your server to Cloudflare's edge. Traffic flows: `User → Cloudflare (HTTPS) → Tunnel → mesh container (HTTP)`.

**Setup:**

1. Add your domain to Cloudflare (free plan works)
2. Go to **Zero Trust → Networks → Tunnels → Create a tunnel**
3. Choose **Cloudflared** as the connector
4. Copy the **tunnel token**
5. Add a public hostname: Domain = `your-domain.com`, Service = `http://mesh:80`
6. Set the token in your `.env`:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=your-token-here
   ```
7. Start:
   ```bash
   docker compose --profile cloudflare up -d
   ```

::: warning
The tunnel token is tied to your Cloudflare account. Never commit it to git.
:::

## Reverse Proxy (without Cloudflare)

mesh includes example configs:

- **nginx**: [`contrib/nginx/mesh.example.conf`](https://github.com/davifernan/mesh/blob/main/contrib/nginx/mesh.example.conf)
- **Caddy**: [`contrib/caddy/caddyfile`](https://github.com/davifernan/mesh/blob/main/contrib/caddy/caddyfile)

Key points:
- Proxy `HTTPS → http://localhost:80`
- For SSE (presence): set `proxy_buffering off` and long timeouts
- The bridge is only on `127.0.0.1:3002` — not directly internet-accessible

## LiveKit Webhook

The presence bridge needs LiveKit webhook events to track mute/camera/screenshare state in the sidebar.

### With built-in LiveKit (`--profile livekit`)

Nothing to configure — the webhook is pre-set in `contrib/livekit/livekit.yaml`.

### With external LiveKit

Configure the webhook URL in your LiveKit dashboard or `livekit.yaml`:

```yaml
webhook:
  api_key: your-api-key
  urls:
    - https://your-mesh-domain.com/api/presence/webhook
```

::: tip
Without the webhook, voice/video works but the sidebar won't show who is muted or on camera.
:::

## Docker Compose Profiles

| Profile | What it starts | When to use |
|---|---|---|
| _(none)_ | mesh + bridge + redis | External LiveKit + own reverse proxy |
| `livekit` | + LiveKit SFU | Local dev or self-hosted LiveKit |
| `cloudflare` | + Cloudflare Tunnel | Auto-HTTPS via Cloudflare |
| `microapps` | + Polls + Whiteboard | In-call Activities |

Combine profiles: `docker compose --profile livekit --profile cloudflare up -d`

## Updating

```bash
cd mesh
docker compose pull
docker compose up -d
```

Redis data is persisted in a Docker volume (`redis_data`) — updates don't lose state.
