# Deploy mesh with an AI Agent

Copy one of the prompts below into your AI coding assistant (Claude Code, Cursor, Windsurf, Codex, etc.) and let it handle the deployment for you.

Fill in the `[PLACEHOLDER]` values before pasting.

---

## Scenario A: VPS + Own Homeserver + LiveKit Cloud

Use this when you already have a Matrix homeserver and a LiveKit Cloud account.

```
You are helping me deploy mesh (a self-hosted Matrix chat client with Discord-style UI
and native LiveKit voice/video) on a Linux VPS.

My setup:
- Server: [YOUR_SERVER_IP] (running [Ubuntu 24.04 / Debian 12 / other])
- Domain: [YOUR_DOMAIN] (DNS already points to the server)
- Matrix homeserver: [YOUR_HOMESERVER_HOSTNAME] (e.g. matrix.example.com)
- LiveKit Cloud API Key: [YOUR_LK_API_KEY]
- LiveKit Cloud API Secret: [YOUR_LK_API_SECRET]
- LiveKit Cloud URL: [YOUR_LK_URL] (e.g. wss://your-app.livekit.cloud)
- LiveKit JWT Service URL: [YOUR_LK_JWT_URL] (e.g. https://your-app.livekit.cloud)

Please:
1. Install Docker and Docker Compose if not already present
2. Create a directory ~/mesh and download docker-compose.yml from:
   https://raw.githubusercontent.com/davifernan/mesh/main/docker-compose.yml
3. Create a .env file with the values I provided above
4. Start all services with: docker compose up -d
5. Set up HTTPS — either:
   a) Using Cloudflare Tunnel (I will provide a token), or
   b) Using Caddy/nginx as a reverse proxy with Let's Encrypt
6. Verify all containers are healthy with: docker compose ps
7. Confirm the app is reachable at https://[YOUR_DOMAIN]

IMPORTANT:
- Configure the LiveKit webhook URL in my LiveKit Cloud dashboard to:
  https://[YOUR_DOMAIN]/api/presence/webhook
- The LIVEKIT_API_KEY and LIVEKIT_API_SECRET are secrets — write them to .env only,
  never echo them to the terminal or commit them to git.
- REDIS_URL should be redis://redis:6379 (the built-in Redis container).
- Generate a BRIDGE_AUTH_SECRET for production: openssl rand -hex 32
  This protects the presence bridge endpoints from unauthorized access.
- Set BRIDGE_ALLOWED_ORIGINS=https://[YOUR_DOMAIN] to restrict CORS.

Ask me for any missing credentials. Do not guess or hardcode secrets.
```

---

## Scenario B: VPS + Built-in LiveKit (No LiveKit Account)

Use this for a quick self-contained deployment without a LiveKit Cloud account.

```
You are helping me deploy mesh on a Linux VPS with everything self-hosted,
including a built-in LiveKit server.

My setup:
- Server: [YOUR_SERVER_IP] (running [Ubuntu 24.04 / Debian 12 / other])
- Domain: [YOUR_DOMAIN] (DNS already points to the server)
- Matrix homeserver: [YOUR_HOMESERVER_HOSTNAME] (or "matrix.org" if I don't have one)

Please:
1. Install Docker and Docker Compose if not already present
2. Create a directory ~/mesh
3. Download these files from the mesh repo (https://github.com/davifernan/mesh):
   - docker-compose.yml
   - contrib/livekit/livekit.yaml (into ~/mesh/contrib/livekit/)
4. Create a .env file with:
   - MESH_HOMESERVER=[my homeserver]
   - LIVEKIT_API_KEY=devkey
   - LIVEKIT_API_SECRET=devsecret-changeme-32chars-min
   - REDIS_URL=redis://redis:6379
   - All other values from .env.example with sensible defaults
5. Start with built-in LiveKit:
   docker compose --profile livekit up -d
6. Set up HTTPS for my domain (Cloudflare Tunnel or Caddy/nginx)
7. Verify everything is healthy and the app works

NOTE: The built-in LiveKit uses dev keys. For production, generate real keys with:
  docker run --rm livekit/livekit-server generate-keys
Then update both .env AND contrib/livekit/livekit.yaml with the new keys.

The LiveKit webhook is pre-configured in livekit.yaml to point to the bridge
internally — no manual webhook setup needed with the built-in LiveKit.
```

---

## Scenario C: Local Development (No Server, No Domain)

Use this to run mesh locally on your machine for development or testing.

```
You are helping me run mesh locally on my machine for development.
I don't have a domain or a VPS — just Docker Desktop on [macOS / Linux / Windows].

Please:
1. Make sure Docker Desktop is running
2. Create a directory ~/mesh-dev
3. Download docker-compose.yml and contrib/livekit/livekit.yaml from the mesh repo
4. Create a .env with:
   - MESH_HOMESERVER=matrix.org
   - LIVEKIT_API_KEY=devkey
   - LIVEKIT_API_SECRET=devsecret-changeme-32chars-min
   - REDIS_URL=redis://redis:6379
5. Start with: docker compose --profile livekit up -d
6. Verify it works at http://localhost:80

No HTTPS or domain setup needed for local development.
```

---

## Scenario D: Add Cloudflare Tunnel to Existing Deployment

```
I already have mesh running via docker compose but I need to add HTTPS
via Cloudflare Tunnel.

My Cloudflare Tunnel Token: [YOUR_TUNNEL_TOKEN]
My domain: [YOUR_DOMAIN]

Please:
1. Add CLOUDFLARE_TUNNEL_TOKEN=[token] to my .env file
2. Restart with: docker compose --profile cloudflare up -d
3. Verify the tunnel is connected: docker compose logs cloudflare-tunnel

Reminder: In my Cloudflare tunnel config (dash.cloudflare.com → Zero Trust →
Tunnels), the public hostname should be:
  Domain: [YOUR_DOMAIN]
  Service: http://mesh:80
```

---

## Tips for the AI Agent

- The full deployment documentation is at: https://github.com/davifernan/mesh/blob/main/DEPLOY.md
- The `.env.example` file has inline documentation for every variable
- All secrets belong in `.env` only — never in `docker-compose.yml` or `config.json`
- `config.json` is auto-generated at container startup from env vars — don't edit it manually
- The bridge health endpoint is `GET http://localhost:3002/health`
- LiveKit webhook URL pattern: `https://DOMAIN/api/presence/webhook`
- For production security, always set:
  - `BRIDGE_AUTH_SECRET` — protects presence bridge endpoints (generate with `openssl rand -hex 32`)
  - `BRIDGE_ALLOWED_ORIGINS` — restricts CORS to your domain (e.g. `https://mesh.example.com`)
  - `MESH_TOKEN_STORAGE_MODE=encrypted-local` — encrypts access tokens in browser (default)
