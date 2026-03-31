# Troubleshooting

## Services won't start

```bash
docker compose ps        # check container status
docker compose logs -f   # stream all logs
```

## "No LiveKit focus URL found"

- Set `MESH_LIVEKIT_URL` in your `.env`
- If using `--profile livekit`: check the LiveKit container is running: `docker compose --profile livekit ps`

## Bridge logs show "FATAL: LIVEKIT_API_KEY must be set"

- Set `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in your `.env`
- They must match your LiveKit server's keys exactly

## Sidebar doesn't show mute/camera/screenshare badges

The LiveKit webhook is not configured. See [LiveKit Webhook](/guide/getting-started#livekit-webhook).

```bash
docker compose logs bridge  # check for webhook errors
```

## Cloudflare Tunnel not connecting

```bash
docker compose --profile cloudflare logs cloudflare-tunnel
```

- Verify the tunnel token matches your Cloudflare tunnel
- The public hostname service must be `http://mesh:80`

## Voice/video works but presence badges are wrong

Enable server-authoritative mode:

```env
MESH_VOICE_STATE_MODE=bridge
MESH_AUTHORITATIVE_BRIDGE_MODE=true
```

```bash
docker compose restart mesh bridge
```

## "Homeserver not allowed" on login

```env
MESH_ALLOW_CUSTOM_HOMESERVERS=true
```

```bash
docker compose restart mesh
```

## Redis connection errors in bridge logs

```bash
docker compose ps redis
docker compose restart redis
```

## macOS: "mesh can't be opened"

Even after going to System Settings → Privacy & Security → "Open Anyway", the app may still be blocked. Run this in Terminal:

```bash
xattr -cr /Applications/mesh.app
```

Then open the app normally. See [Desktop App](/guide/desktop#macos) for details.

## Windows: SmartScreen warning

Click **"More info"** → **"Run anyway"**. This appears because the app is not yet code-signed.
