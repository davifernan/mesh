# mesh Microapps (Activities)

Discord-style in-call activities — widget apps that appear as extra participant tiles inside the voice call view, alongside real users.

## How it works

When a microapp is added to a room it is stored as a Matrix `im.vector.modular.widgets` state event (the standard Element widget format). Every client reads this event and renders the widget as a full-width tile in the call grid. The 🚀 **Activities** button in the call control bar opens the app picker.

```
User clicks 🚀 → picks YouTube → state event written to room
→ all clients read state → YouTube tile appears in call grid
→ host controls playback → sync commands sent as room events
→ all clients drift-compensate and seek to the same timestamp
```

## Apps

### YouTube Together (`eu.mesh.apps.youtube`)

Watch YouTube videos in sync. One person controls playback; everyone follows.

| Feature | Detail |
|---|---|
| Sync mechanism | Matrix room state (`eu.mesh.apps.youtube`) + command events (`eu.mesh.apps.youtube.cmd`) |
| Drift compensation | `timestamp + (Date.now() − issuedAt) / 1000` — accounts for event propagation delay |
| Late-joiners | Current position is stored in room state; new clients seek on load |
| Permissions | Any room member can control playback |

**Supported URL formats:**
- `https://youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://youtube.com/shorts/VIDEO_ID`
- `https://youtube.com/embed/VIDEO_ID`

### Spotify Together (`eu.mesh.apps.spotify`)

Share a Spotify track, album, or playlist in the room. Everyone sees the same embed.

> **Limitation:** True playback sync is not possible without Spotify Premium + OAuth per-user. This embeds the same URL for all members; each controls their own playback locally.

**Supported URL formats:**
- `https://open.spotify.com/track/...`
- `https://open.spotify.com/album/...`
- `https://open.spotify.com/playlist/...`
- `spotify:track:...` URI scheme
- Localized URLs (`open.spotify.com/intl-de/track/...`)

### Polls (`nordeck/matrix-poll-widget`) — optional

Create and vote on polls directly in the room. Powered by [nordeck/matrix-poll-widget](https://github.com/nordeck/matrix-poll-widget).

Requires a self-hosted Docker container. See [Server Admin Setup](#server-admin-setup).

### Whiteboard (`nordeck/matrix-neoboard-widget`) — optional

Real-time collaborative whiteboard. Powered by [nordeck/matrix-neoboard-widget](https://github.com/nordeck/matrix-neoboard-widget).

Requires a self-hosted Docker container. See [Server Admin Setup](#server-admin-setup).

---

## Server Admin Setup

YouTube and Spotify are bundled with mesh and need no extra infrastructure.

Polls and Whiteboard run as optional Docker containers. They are **off by default** — they appear in the Activities catalog only when their URLs are configured.

### 1. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```env
# Public URL where users' browsers can reach the polls container.
# Leave empty to hide Polls from the Activities catalog.
MESH_POLLS_URL=https://polls.your-domain.com

# Public URL where users' browsers can reach the whiteboard container.
# Leave empty to hide Whiteboard from the Activities catalog.
MESH_WHITEBOARD_URL=https://whiteboard.your-domain.com
```

The URLs must be publicly reachable — they are loaded directly by users' browsers, not by the mesh server.

### 2. Start the services

```bash
# Start only polls:
docker compose --profile microapps up -d polls-widget

# Start only whiteboard:
docker compose --profile microapps up -d neoboard-widget

# Start both:
docker compose --profile microapps up -d

# Then restart mesh so config-microapps.js is regenerated with the new URLs:
docker compose restart mesh
```

### 3. Reverse proxy (nginx example)

The widget containers listen on `localhost:3001` (polls) and `localhost:3003` (whiteboard). Expose them under a public domain:

```nginx
# polls
server {
    listen 443 ssl;
    server_name polls.your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        add_header Access-Control-Allow-Origin *;
    }
}

# whiteboard
server {
    listen 443 ssl;
    server_name whiteboard.your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_set_header Host $host;
        add_header Access-Control-Allow-Origin *;
    }
}
```

### How the URL reaches the browser (no rebuild required)

At container startup `docker-entrypoint.sh` generates `/app/config-microapps.js`:

```js
window.__MESH_MICROAPPS__ = {
  pollsWidgetUrl: "https://polls.your-domain.com",
  whiteboardWidgetUrl: "https://whiteboard.your-domain.com"
};
```

`index.html` loads this as a classic (synchronous) script **before** the ES module bundle, so the catalog side-effects read the correct URLs at registration time. No rebuild needed — just restart the container.

---

## Developer Setup

### Run YouTube / Spotify locally

Both apps are bundled into the Vite dev server. Just start the server:

```bash
npm run dev
# YouTube: http://localhost:5173/youtube.html
# Spotify: http://localhost:5173/spotify.html
```

### Test Polls / Whiteboard locally

Run the Docker containers locally:

```bash
docker compose --profile microapps up -d

# Polls  → http://localhost:3001
# Board  → http://localhost:3003
```

Then point `public/config-microapps.js` at them (dev only, do not commit):

```js
window.__MESH_MICROAPPS__ = {
  pollsWidgetUrl: 'http://localhost:3001',
  whiteboardWidgetUrl: 'http://localhost:3003',
};
```

Or set them in `build.config.ts` as a build-time fallback:

```ts
export default {
  base: '/',
  pollsWidgetUrl: 'http://localhost:3001',
  whiteboardWidgetUrl: 'http://localhost:3003',
};
```

---

## Architecture

```
mesh/
├── src/apps/
│   ├── index.ts                    # barrel: imports all catalog.ts files (side-effects)
│   ├── youtube/
│   │   ├── main.tsx                # Vite entry point for the YouTube widget page
│   │   ├── YoutubeApp.tsx          # YouTube iFrame API + sync UI
│   │   ├── useYoutubeSync.ts       # Matrix state/command event hook
│   │   └── catalog.ts              # registerApp() call
│   ├── spotify/
│   │   ├── main.tsx
│   │   ├── SpotifyApp.tsx          # Spotify embed + URL normalisation
│   │   └── catalog.ts
│   ├── polls/
│   │   ├── main.tsx                # Fallback page shown when Docker not running
│   │   └── catalog.ts              # conditional — only registers if pollsWidgetUrl set
│   └── whiteboard/
│       ├── main.tsx
│       └── catalog.ts
│
├── src/app/state/
│   └── microappCatalog.ts          # AppCatalogEntry type + registerApp / getAppCatalog
│
├── src/app/pages/client/call/
│   ├── ActivityPicker.tsx          # 🚀 popover: add/remove apps from the room
│   ├── ActivityPicker.module.css
│   ├── AppTile.tsx                 # widget iframe rendered as a call grid tile
│   ├── AppTile.module.css
│   └── NativeCallParticipantGrid.tsx  # renders AppTile alongside participant tiles
│
├── public/config-microapps.js      # default empty; overwritten by docker-entrypoint.sh
├── docker-entrypoint.sh            # generates config-microapps.js at container start
└── docker-compose.yml              # polls-widget + neoboard-widget under --profile microapps
```

## Widget state events

| Event type | State key | Content |
|---|---|---|
| `im.vector.modular.widgets` | app ID (e.g. `youtube`) | `{ type, url, name, id }` — standard widget format |
| `eu.mesh.apps.youtube` | `""` | `{ videoId, playing, timestamp, issuedAt }` |
| `eu.mesh.apps.youtube.cmd` | — (timeline) | `{ action: "load"|"play"|"pause"|"seek", videoId?, timestamp? }` |
| `eu.mesh.apps.spotify` | `""` | `{ url, contentType }` |
