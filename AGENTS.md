# BetterCord — Agent Rules & Learnings

> This file documents hard-won knowledge from implementing Matrix RTC + LiveKit voice
> in BetterCord. Read it before touching ANYTHING call/voice related.

---

## Architecture Overview

```
BetterCord (one app, no iframe)
│
├── matrix-js-sdk v38+
│   ├── MatrixRTCSession        — memberships, delayed-events keepalive, E2EE key exchange
│   └── RTCEncryptionManager    — per-participant E2EE keys via Matrix room events
│
├── livekit-client ^2.13
│   ├── Room                    — WebRTC/SFU connection
│   └── E2EEManager (worker)    — frame-level encryption (fed keys by MatrixKeyProvider)
│
└── @livekit/components-react ^2
    └── React hooks for participants, tracks, speaking state
```

**No Element Call. No iframe. No matrix-widget-api for voice.**

---

## Critical Rules — NEVER Violate

### LiveKit Room Options
```
NEVER set adaptiveStream: false  → upstream default is true, disabling causes pixelation bugs
NEVER set dynacast: false        → upstream default is true, disabling wastes bandwidth
NEVER set videoCodec: "vp9"      → causes codec mismatches with some clients; keep "vp8" (upstream default)
NEVER set stopMicTrackOnMute: true → causes PublishTrackError on reconnect
```

### MatrixRTC / Memberships
```
NEVER orphan a delayed event:
  - joinRoomSession() creates a dead-man's switch delayed event (~8s timeout, renewed every ~4s)
  - Always call leaveRoomSession() on disconnect — this cancels the delayed event cleanly
  - If you restart/recreate the session without calling leave first, the old delayed event fires
    after ~8s and CLEARS the new membership → users disappear from sidebar

NEVER clear the legacy membership key (stateKey === userId with no deviceId suffix)
  - MSC4143 format keys: `_${userId}_${deviceId}` or `${userId}_${deviceId}`
  - Legacy key: stateKey === userId (no underscore+deviceId suffix)
  - The multi-device kick code ONLY touches MSC4143 format keys
```

### E2EE Worker
```
ALWAYS use inline worker: import E2EEWorker from 'livekit-client/e2ee-worker?worker&inline'
ALWAYS create a NEW E2EE worker per LiveKit Room (they get confused across rooms)
ALWAYS terminate the worker on cleanup: worker.terminate()
```

### File Size
```
MAX 650 lines per file. Split at logical boundaries if approaching limit.
```

---

## Flow: Joining a Voice Call

```
1. User clicks voice channel → setActiveCallRoomId(roomId)
2. useNativeCall(roomId) mounts in CallProvider
3. Read focus URL from room state event:
   - org.matrix.msc3401.call (state key: '') → content.foci_preferred[0].livekit_service_url
   - OR from existing member events' foci_preferred
4. rtcSession = mx.matrixRTC.getRoomSession(room)
5. rtcSession.joinRoomSession([livekitFocus], activeFocus, { manageMediaKeys: true })
   → Writes MSC4143 membership state event + delayed event (keepalive)
6. MatrixKeyProvider.setRTCSession(rtcSession)
   → Listens to MatrixRTCSessionEvent.EncryptionKeyChanged → feeds keys to LiveKit
7. getSFUConfigWithOpenID(mx, userId, deviceId, serviceUrl, roomId)
   → mx.getOpenIdToken() → POST serviceUrl/sfu/get or /get_token → LiveKit JWT
8. livekitRoom = new Room(buildLiveKitRoomOptions(avSettings, keyProvider))
9. livekitRoom.connect(sfuConfig.url, sfuConfig.jwt)
10. RoomEvent.ActiveSpeakersChanged → update speakingUsers in CallProvider context
11. UI renders via useParticipants(), useLocalParticipant() hooks

Disconnect:
1. hangUp() called
2. livekitRoom.disconnect()
3. rtcSession.leaveRoomSession()     ← MUST come after disconnect, cancels delayed event
4. e2eeWorker.terminate()
```

---

## Sidebar: Users Under Voice Channel

`useCallMembers(mx, roomId)` in `src/app/hooks/useCallMemberships.ts` reads:
- `org.matrix.msc3401.call.member` state events (MSC4143 format)
- `org.matrix.msc4143.call.member` state events

Since `MatrixRTCSession.joinRoomSession()` writes the same state events that Element Call
used to write, the sidebar display works identically. The 12s grace period on removal
prevents flicker during membership renewal.

**Do NOT bypass this hook.** It handles the grace period correctly.

---

## Bridge Presence — Architecture

Server-side source of truth für participant state (mute / camera / screenshare / deafened).
Vollständig unabhängig davon, welche Frontend-Version die einzelnen Clients laufen.

### Komponenten

| Datei | Verantwortung |
|---|---|
| `src/app/features/call/BridgePresenceContext.ts` | React-Context-Interface (`BridgePresenceContextValue`) |
| `src/app/features/call/BridgePresenceProvider.tsx` | SSE-Verbindungspool, REST-Bootstrap, ref-counted Lifecycle |
| `src/app/hooks/useBridgeRoomPresence.ts` | Thin Context-Consumer-Hook (nutzt `useSyncExternalStore`) |

### Datenfluss

```
LiveKit Webhook
  → bridge/src/index.ts (Hono, Bun)
  → GET /api/presence/:roomId/stream (SSE)
  → BridgePresenceProvider (Connection Pool)
  → useBridgeRoomPresence(roomId)
  → RoomNavItem → RoomNavUser (Mute/Camera/Stream/Deafen Badges)
```

### Verbindungsmanagement (BridgePresenceProvider)

- **Eine SSE-Verbindung pro roomId** — nicht pro Component-Instanz
- **Ref-counted**: öffnet beim ersten `subscribeSSE(roomId)`-Aufruf, schließt beim letzten cleanup
- **Presence-Cache bleibt** nach close erhalten — überlebt Virtualizer-bedingtes Unmount/Remount
- **REST Bootstrap** (`GET /api/presence/:roomId`) beim ersten Subscribe für sofortigen initialen State
- **Exponential Backoff** bei SSE-Verbindungsfehlern (1s → 2s → 4s → ... → 30s max)

### Presence-Auflösung (resolvePresence in RoomNavUser.tsx)

Priorität für Remote-User (höchste zuerst):
1. **LiveKit-Client-State** (`pState`) — nur wenn lokaler Client im selben Call ist
2. **Bridge-Presence** (`remoteBridge`) — server-seitig, funktioniert für alle Clients

Lokaler User liest immer direkt aus dem live Call-State (CallProvider context).
Wenn weder `pState` noch Bridge-Daten vorhanden sind, fallen Remote-User auf all-false zurück.

### Regeln — NICHT tun

```
NEVER useBridgeRoomPresence() aufrufen außerhalb eines Nachfahrens von <BridgePresenceProvider>
NEVER presence-Map direkt mutieren — immer neue Referenz via notifyListeners() im Provider
NEVER BridgePresenceProvider mehrfach in den Tree hängen — genau einmal, oberhalb aller RoomNavItem-Render-Punkte
NEVER subscribeSSE ohne entsprechendes cleanup — Hook erledigt das automatisch via useEffect
```

---

## SFU Token Endpoints

Two endpoints (try new first, fall back to legacy):

**New endpoint** (`POST /get_token`):
```json
{
  "room_id": "!roomId:server",
  "slot_id": "m.call#ROOM",
  "openid_token": { ... },
  "member": {
    "id": "<memberId>",
    "claimed_user_id": "@user:server",
    "claimed_device_id": "DEVICEID"
  }
}
```

**Legacy endpoint** (`POST /sfu/get`):
```json
{
  "room": "!roomId:server",
  "openid_token": { ... },
  "device_id": "DEVICEID"
}
```

Both return `{ url: "wss://lk.server", jwt: "eyJ..." }`.

---

## AV Quality Settings

All quality settings live in `src/app/state/settings.ts` (persisted) and are
combined with space/channel overrides in `src/app/state/avQuality.ts` (effectiveAVSettingsAtom).

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| audioBitrate | 32\|64\|128\|256\|510 kbps | 64 | Mic bitrate |
| echoCancellation | boolean | true | Browser constraint |
| noiseSuppression | boolean | true | Browser constraint |
| autoGainControl | boolean | true | Browser constraint |
| videoResolution | '360p'\|'480p'\|'720p'\|'1080p' | '480p' | Camera |
| videoFps | 15\|24\|30\|60\|120 | 24 | Camera |
| ssResolution | '720p'\|'1080p'\|'1440p'\|'4k'\|'source' | '720p' | Screenshare |
| ssFps | 5\|15\|30\|60\|120 | 15 | Screenshare |
| ssAudio | boolean | false | Desktop audio |
| micDeviceId | string\|undefined | undefined | Selected mic |
| cameraDeviceId | string\|undefined | undefined | Selected camera |
| speakerDeviceId | string\|undefined | undefined | Selected speaker |

Pass `effectiveAVSettingsAtom` result to `buildLiveKitRoomOptions()` in `avPresets.ts`.

---

## Screenshare Quality Flow

```
1. User clicks screen share button in NativeCallControlBar
2. ScreenShareModal opens (components/voice/ScreenShareModal/) — shows resolution/fps/audio
   + server-max caps from effectiveAVSettingsAtom
   Props: onConfirm(ssResolution, ssFps, ssAudio), onCancel()
3. User confirms → localParticipant.setScreenShareEnabled(true, captureOpts, { simulcast: false })
   captureOpts: { audio: ssAudio, video: { width, height, frameRate } }
   publishOpts: { simulcast: false }   ← screenshare must NOT simulcast
4. To stop: localParticipant.setScreenShareEnabled(false)

NOTE: Do NOT use ScreenShareQualityModal (pages/client/call/) — it lacks server-max display.
      The canonical modal is ScreenShareModal (components/voice/ScreenShareModal/).
```

---

## Speaking Indicator

```typescript
// In NativeCallParticipantTile:
// participant.isSpeaking is live from livekit-client — no polling needed
// Apply speaking class when true:
className={clsx(styles.tile, { [styles.speaking]: participant.isSpeaking })}

// CSS:
.speaking {
  outline: 2px solid #23A55A;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #23A55A33;
  transition: outline 80ms ease, box-shadow 80ms ease;
}

// In RoomNavUser (sidebar), speakingUsers comes from CallProvider context
// which is populated via RoomEvent.ActiveSpeakersChanged on the LiveKit room
```

---

## TypeScript Gotchas — LiveKit v2

### RoomEvent handler participant types
```typescript
// TrackMuted / TrackUnmuted  → participant is LocalParticipant | RemoteParticipant
//   → comparing to room.localParticipant is VALID
room.on(RoomEvent.TrackMuted, (pub, participant) => {
  if (participant === room.localParticipant) { /* local */ }
  else { updateRemote(participant); }
});

// TrackPublished / TrackUnpublished → participant is ALWAYS RemoteParticipant
//   → comparing to room.localParticipant causes TS2367 "no overlap" error
//   → SOLUTION: just call updateRemote directly, no guard needed
//   → local-side: use LocalTrackPublished / LocalTrackUnpublished instead
room.on(RoomEvent.TrackPublished, (_pub, participant) => {
  updateRemote(participant);  // always remote, no guard needed
});
room.on(RoomEvent.LocalTrackPublished, (pub) => {
  if (pub.source === Track.Source.ScreenShare) setIsScreenShareEnabled(true);
});
```

### useTracks — no participant filter in options
```typescript
// @livekit/components-react v2: useTracks(sources, options?)
// options does NOT have a 'participant' field — filter by identity afterward
const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
const myTracks = tracks.filter(t => t.participant.identity === targetIdentity);
```

### VideoTrack requires a real TrackReference, not a placeholder
```typescript
// Type guard before rendering VideoTrack:
if (!('publication' in trackRef) || trackRef.publication === undefined) return null;
// Only then: <VideoTrack trackRef={trackRef} />
```

### MatrixRTCSessionEvent.EncryptionKeyChanged — 3 arguments
```typescript
// Fires with 3 args: (key, encryptionKeyIndex, participantId)
// NOT 2 args — adding a 2-arg handler silently misses participantId
rtcSession.on(
  MatrixRTCSessionEvent.EncryptionKeyChanged,
  (key: Uint8Array, encryptionKeyIndex: number, participantId: string) => {
    keyProvider.onSetEncryptionKey(key, participantId, encryptionKeyIndex);
  }
);
```

### E2EE key import — SharedArrayBuffer
```typescript
// crypto.subtle.importKey('raw', key, ...) — key must be Uint8Array, NOT ArrayBuffer
// Wrap to avoid SharedArrayBuffer type error:
crypto.subtle.importKey('raw', new Uint8Array(encryptionKey), ...)
```

### VideoPreset FPS accessor
```typescript
// livekit-client v2: preset.encoding.maxFramerate  (NOT preset.fps — doesn't exist)
const fps = videoPreset.encoding.maxFramerate;
```

### m.sender on CallMembership
```typescript
// m.sender returns string | undefined — must filter before using as string
const senders = memberships
  .map((m) => m.sender)
  .filter((s): s is string => s !== undefined);
```

### ssResolution type uses '4k' not '2160p'
```typescript
// settings.ts type: '720p' | '1080p' | '1440p' | '4k' | 'source'
// NEVER write '2160p' — it is NOT in the union and will cause a type error
```

### settingsAtom — use useAtom when writing
```typescript
// settingsAtom is a read-write Jotai atom
const [settings, setSettings] = useAtom(settingsAtom);  // read + write
const settings = useAtomValue(settingsAtom);              // read-only
// useAtomValue then calling setSettings will fail — always use useAtom when both needed
```

### LocalAudioTrack.restartTrack — pass ALL constraints
```typescript
// restartTrack replaces the underlying MediaStreamTrack entirely.
// Any omitted constraint reverts to the BROWSER DEFAULT, not the previous value.
// When toggling one setting (e.g. noiseSuppression), still pass all others:
await (pub.track as LocalAudioTrack).restartTrack({
  noiseSuppression: next,
  echoCancellation: userSettings.echoCancellation,   // keep
  autoGainControl: userSettings.autoGainControl,     // keep
  deviceId: userSettings.micDeviceId,                // keep
});
```

---

## CSS / Styling System

BetterCord uses **two** styling patterns — never mix them within a single file:

| Pattern | When | Files |
|---------|------|-------|
| `@vanilla-extract/css` (`style()`, `recipe()`) | `*.css.ts` files | `Sidebar.css.ts`, `UserArea.css.ts` |
| CSS Modules (`*.module.css`) | Call-specific UI | `NativeCallControlBar.module.css`, etc. |

### vanilla-extract `recipe()` — adding a new variant
```typescript
// In Sidebar.css.ts:
export const SidebarItem = recipe({
  base: { /* always applied */ },
  variants: {
    active: {
      true: { /* active styles */ },
    },
    // Add new variants here — they become typed props on the component
  },
});
export type SidebarItemVariants = RecipeVariants<typeof SidebarItem>;
```

### CSS design tokens (via folds / CSS vars)
```css
--background-primary       /* main content area bg */
--background-secondary     /* sidebar channel list bg */
--background-tertiary      /* far-left guild strip bg */
--panel-control-bg         /* UserArea bg */
--text-primary             /* main text */
--text-secondary           /* dimmed text / icons */
--text-muted               /* placeholders, timestamps */
--status-online            /* #3ba55d */
--status-idle              /* #faa61a */
--status-offline           /* #747f8d */
--brand-primary            /* BetterCord accent color */
```

### Brand colors (hard-coded where tokens aren't available)
```
Speaking green:   #23A55A   (RoomNavUser speaking ring, participant tile outline)
Disconnect red:   #F23F43   (hangup button, muted mic icon)
LIVE badge:       #F23F43   (pulsing screenshare indicator)
```

---

## Jotai State Patterns

```typescript
// Read + write (most common for settings toggles):
const [settings, setSettings] = useAtom(settingsAtom);

// Read only (derived/computed atoms):
const effective = useAtomValue(effectiveAVSettingsAtom);

// Write only (rare, e.g. from outside a component):
const setSettings = useSetAtom(settingsAtom);

// atomFamily for per-key atoms (e.g. per-space state):
import { atomFamily } from 'jotai/utils';
const myAtomFamily = atomFamily((key: string) => atom(defaultValue));
```

---

## CallProvider Context Interface

Full shape of `CallContextState` (as of Phase 2 completion):

```typescript
interface CallContextState {
  activeCallRoomId: string | null;
  setActiveCallRoomId: (roomId: string | null, isVoiceRoom?: boolean) => void;
  viewedCallRoomId: string | null;
  setViewedCallRoomId: (roomId: string | null) => void;
  isCallViewOpen: boolean;
  toggleCallView: () => void;
  isChatOpen: boolean;
  toggleChat: () => void;
  hangUp: () => void;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  startScreenShare: (ssRes: string, ssFps: number, ssAudio: boolean) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenShareEnabled: boolean;
  speakingUsers: Set<string>;
  remoteParticipantStates: Map<string, {
    audioEnabled: boolean;
    videoEnabled: boolean;
    isScreenSharing: boolean;
  }>;
  livekitRoom: Room | null;
  callStatus: CallStatus;   // 'idle' | 'connecting' | 'connected' | 'error'
  callError: Error | null;
}
```

When adding new engine state (e.g. `isDeafened`, `toggleDeafen`):
1. Add to `NativeCallEngine` interface in `nativeCallEngine.ts`
2. Implement in `useNativeCall()` hook body
3. Add to `CallContextState` in `CallProvider.tsx`
4. Expose in `contextValue` useMemo in `CallProvider.tsx`
5. Consume via `useCallState()` in UI components

---

## NativeCallEngine Interface

```typescript
// src/app/features/call/nativeCallEngine.ts
export type CallStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface NativeCallEngine {
  status: CallStatus;
  livekitRoom: Room | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenShareEnabled: boolean;
  speakingUsers: Set<string>;
  remoteParticipantStates: Map<string, {
    audioEnabled: boolean;
    videoEnabled: boolean;
    isScreenSharing: boolean;
  }>;
  error: Error | null;
  hangUp: () => void;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  startScreenShare: (ssRes: string, ssFps: number, ssAudio: boolean) => Promise<void>;
  stopScreenShare: () => Promise<void>;
}
```

---

## Deafen Implementation Pattern

Deafen = mute all remote audio output without changing your own mic publish state.
LiveKit does this via `room.remoteParticipants` track muting on the receiving end:

```typescript
// In nativeCallEngine.ts:
const [isDeafened, setIsDeafened] = useState(false);

const toggleDeafen = useCallback(async () => {
  if (!livekitRoomRef.current) return;
  const next = !isDeafened;
  setIsDeafened(next);
  // Mute/unmute all remote audio publications locally
  for (const participant of livekitRoomRef.current.remoteParticipants.values()) {
    for (const pub of participant.audioTrackPublications.values()) {
      if (pub.track) {
        pub.track.mediaStreamTrack.enabled = !next;
      }
    }
  }
}, [isDeafened]);
```

---

## Remote Participant State Tracking

`remoteParticipantStates` is a `Map<userId, { audioEnabled, videoEnabled, isScreenSharing }>`.

The `userId` key is derived from LiveKit participant identity via `extractUserId(identity)`,
which strips the device suffix. Always use `extractUserId()` for Map lookups — never use
the raw LiveKit identity string directly in UI.

Events that trigger `updateRemote(participant)`:
- `RoomEvent.TrackMuted` (remote branch)
- `RoomEvent.TrackUnmuted` (remote branch)
- `RoomEvent.TrackPublished` (always remote)
- `RoomEvent.TrackUnpublished` (always remote)
- `RoomEvent.ParticipantConnected`
- `RoomEvent.ParticipantDisconnected` (with `remove=true`)

---

## Bugs Fixed (History — Don't Repeat)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Blank tiles, no audio | Deleted legacy membership key during multi-device kick | Only delete MSC4143 keys with explicit deviceId suffix |
| Users disappear after ~8s | Post-lobby widget reload orphaned delayed event | No widget restart; native impl always calls leaveRoomSession() |
| Speaking indicator never fires | Widget restart reset event handlers before EC sent initial states | Direct LiveKit events, no postMessage |
| "Cannot find own membership event" on reactions | Element Call null eventId during local echo window | N/A — we don't use Element Call anymore |
| Audio pipeline broken | Changed adaptiveStream/dynacast/videoCodec defaults | Keep upstream defaults, only override publishDefaults |
| TS2367 on TrackPublished handler | Compared RemoteParticipant to LocalParticipant | Removed guard — TrackPublished is always remote |
| E2EE keys not applied | EncryptionKeyChanged handler wired with 2 args instead of 3 | Use 3-arg handler: (key, index, participantId) |
| Track restartTrack resets echoCancellation | Passed only noiseSuppression to restartTrack | Always pass ALL audio constraints to restartTrack |

---

## File Map

```
src/app/
├── features/call/
│   ├── avPresets.ts                      — LiveKit preset mapping (resolution → VideoPreset)
│   ├── sfuToken.ts                       — OpenID → LiveKit JWT
│   ├── matrixKeyProvider.ts              — MatrixRTC keys → LiveKit E2EE
│   ├── nativeCallEngine.ts               — useNativeCall() hook (main engine)
│   ├── BridgePresenceContext.ts          — React-Context-Interface für Bridge Presence
│   └── BridgePresenceProvider.tsx        — SSE-Verbindungspool für Sidebar-Presence-Badges
│
├── pages/client/call/
│   ├── CallProvider.tsx              — Context: activeCallRoomId, speakingUsers, etc.
│   ├── PersistentCallContainer.tsx   — Mounts NativeCallView (was: iframe)
│   ├── NativeCallView.tsx            — Composites all call UI
│   ├── NativeCallParticipantGrid.tsx — Responsive grid of tiles
│   ├── NativeCallParticipantTile.tsx — Single participant tile + speaking glow
│   ├── NativeCallControlBar.tsx      — Mute/Video/Screen/NoiseSup/Stats/Chat/Hangup
│   ├── ScreenShareQualityModal.tsx   — DEPRECATED: use ScreenShareModal instead
│   └── BCStatsPanel.tsx              — RTT/Jitter/PacketLoss HUD
│
├── components/voice/
│   └── ScreenShareModal/
│       ├── ScreenShareModal.tsx      — CANONICAL pre-share quality picker
│       └── ScreenShareModal.css.ts   — vanilla-extract styles
│
├── components/user-area/
│   ├── UserArea.tsx          — Bottom-left: avatar, name, status, mute/deafen/settings
│   └── UserArea.css.ts       — vanilla-extract styles
│
├── components/sidebar/
│   ├── Sidebar.css.ts        — SidebarItem pill recipe (::before pseudo-element)
│   └── SidebarItem.tsx       — SidebarItem, SidebarAvatar, SidebarItemBadge, etc.
│
├── state/
│   ├── avQuality.ts    — effectiveAVSettingsAtom (space/channel overrides)
│   └── settings.ts     — user AV preferences (audioBitrate, videoRes, etc.)
│
├── pages/client/space/
│   └── Space.tsx             — SpaceHeader (guild name + caret dropdown trigger)
│
└── hooks/
    ├── useCallMemberships.ts      — Sidebar user list (reads Matrix state events)
    └── useBridgeRoomPresence.ts   — Context-Consumer; gibt Map<userId, CallPresenceState> zurück
```
