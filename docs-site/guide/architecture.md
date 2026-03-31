# Architecture

## Overview

```
mesh (one app, no iframe)
│
├── matrix-js-sdk v38+
│   ├── MatrixRTCSession        — memberships, delayed-events keepalive, E2EE key exchange
│   └── RTCEncryptionManager    — per-participant E2EE keys via Matrix room events
│
├── livekit-client ^2.13
│   ├── Room                    — WebRTC/SFU connection
│   └── E2EEManager (worker)    — frame-level encryption (fed keys by MatrixKeyProvider)
│
└── bridge/ (Bun + Hono)
    └── SSE presence streams    — mute/camera/screenshare/deafen badges
```

**No Element Call. No iframe. No matrix-widget-api for voice.**

## Docker deployment

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
│  └────────────┘  └────────────┘                         │
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

## Voice call flow

```
1. User clicks voice channel → setActiveCallRoomId(roomId)
2. Read LiveKit focus URL from Matrix room state event
3. rtcSession.joinRoomSession() → writes MSC4143 membership + delayed-event keepalive
4. MatrixKeyProvider sets up E2EE key exchange via Matrix room events
5. getSFUConfigWithOpenID() → Matrix OpenID token → LiveKit JWT
6. livekitRoom.connect(sfuConfig.url, sfuConfig.jwt)
7. LiveKit WebRTC connection established
8. E2EE: MatrixKeyProvider feeds keys to LiveKit E2EEManager worker

Disconnect:
1. livekitRoom.disconnect()
2. rtcSession.leaveRoomSession()  ← cancels delayed event
3. e2eeWorker.terminate()
```

## Bridge Presence

Server-side source of truth for participant state (mute/camera/screenshare/deafen). Independent of which frontend version clients run.

```
LiveKit Webhook
  → bridge/src/index.ts (Hono, Bun)
  → GET /api/presence/:roomId/stream (SSE)
  → BridgePresenceProvider (Connection Pool)
  → useBridgeRoomPresence(roomId)
  → RoomNavItem → RoomNavUser (Mute/Camera/Stream/Deafen badges)
```

## E2EE

- Matrix room events carry per-participant encryption keys (`MatrixRTCSession`)
- Keys are fed to LiveKit's `E2EEManager` which encrypts/decrypts individual media frames
- The LiveKit SFU never sees unencrypted media in E2EE-enabled rooms
- A new E2EE worker is created per LiveKit `Room` instance
