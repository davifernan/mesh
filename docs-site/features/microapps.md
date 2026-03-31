# Activities (Microapps)

Discord-style in-call activities — widget apps that appear as extra tiles inside the voice call view, alongside real participants.

## How it works

When an activity is added to a room, it's stored as a Matrix `im.vector.modular.widgets` state event. Every client reads this event and renders the widget as a full-width tile in the call grid. The 🚀 **Activities** button in the call control bar opens the app picker.

```
User clicks 🚀 → picks YouTube → state event written to room
→ all clients read state → YouTube tile appears in call grid
→ host controls playback → sync commands sent as room events
→ all clients seek to the same timestamp
```

## Available Activities

### YouTube Together

Watch YouTube videos in sync. One person controls playback; everyone follows.

| Feature | Detail |
|---|---|
| Sync mechanism | Matrix room state + command events |
| Drift compensation | `timestamp + (Date.now() − issuedAt) / 1000` |
| Late-joiners | Current position stored in room state; new clients seek on load |

**Supported URLs:**
- `https://youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://youtube.com/shorts/VIDEO_ID`

### Spotify Together

Share a Spotify track, album, or playlist. Everyone sees the same embed.

> **Note:** True playback sync requires Spotify Premium + OAuth per user. This embeds the same URL for all members; each controls their own playback locally.

### Polls _(optional, requires Docker)_

Create and vote on polls directly in the room. Powered by [nordeck/matrix-poll-widget](https://github.com/nordeck/matrix-poll-widget).

### Whiteboard _(optional, requires Docker)_

Real-time collaborative whiteboard. Powered by [nordeck/matrix-neoboard-widget](https://github.com/nordeck/matrix-neoboard-widget).

## Setting up Polls & Whiteboard

YouTube and Spotify are built in — no setup needed. Polls and Whiteboard require self-hosted Docker containers.

### 1. Configure environment variables

```env
# Public URL where users' browsers reach the polls container
MESH_POLLS_URL=https://polls.your-domain.com

# Public URL where users' browsers reach the whiteboard container
MESH_WHITEBOARD_URL=https://whiteboard.your-domain.com
```

### 2. Start the containers

```bash
# Start both:
docker compose --profile microapps up -d

# Then restart mesh so URLs are picked up:
docker compose restart mesh
```

### 3. Expose via reverse proxy

```nginx
# Polls
server {
    listen 443 ssl;
    server_name polls.your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        add_header Access-Control-Allow-Origin *;
    }
}

# Whiteboard
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

::: tip No rebuild needed
At container startup, `docker-entrypoint.sh` generates `/app/config-microapps.js` with the URLs. Changing them only requires restarting the container — no rebuild.
:::
