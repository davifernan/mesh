# BetterCord Voice UI — Fix Plan
# Based on post-implementation audit of enhance-bettercord-voice-ui.md

## Parallelism

```
All 5 agents run in parallel — no dependencies between them.

Agent A: Engine + CallProvider  (nativeCallEngine.ts, CallProvider.tsx)
Agent B: PiP fixes              (PiPOverlay.tsx, PiPOverlay.module.css)
Agent C: ControlBar fixes       (NativeCallControlBar.tsx, .module.css)
Agent D: Grid + View fixes      (NativeCallParticipantGrid.module.css,
                                  NativeCallView.tsx, .module.css,
                                  NativeCallParticipantTile.module.css)
Agent E: Sidebar fixes          (SignalStrengthIcon.tsx, .module.css,
                                  RoomCallNavStatus.tsx, .css.ts)
```

---

## AGENT A — Engine + CallProvider

### Files
- `src/app/features/call/nativeCallEngine.ts`
- `src/app/pages/client/call/CallProvider.tsx`

### Fix A1: Add callJoinTime to NativeCallEngine interface
In `nativeCallEngine.ts`, in the `NativeCallEngine` interface, add:
```ts
callJoinTime: Date | null;
```

In `useNativeCall()` body, add state:
```ts
const [callJoinTime, setCallJoinTime] = useState<Date | null>(null);
```

Set it when status transitions to 'connected' — in the section after `await room.connect(...)`:
```ts
// After setStatus('connected'):
setCallJoinTime(new Date());
```

Reset it in cleanup (both `hangUp` and the useEffect cleanup):
```ts
setCallJoinTime(null);
```

Return it in the return object:
```ts
callJoinTime,
```

### Fix A2: Expose callJoinTime in CallProvider context

In `CallProvider.tsx`, add to `CallContextState` interface:
```ts
callJoinTime: Date | null;
```

In the `contextValue` useMemo, add:
```ts
callJoinTime: engine.callJoinTime,
```

---

## AGENT B — PiP Overlay Fixes

### Files
- `src/app/pages/client/call/PiPOverlay.tsx`
- `src/app/pages/client/call/PiPOverlay.module.css`

### Fix B1: Active speaker priority
Current code picks `allTracks.find(...)` — the first available camera track.
Replace with logic that prioritizes the currently speaking participant.

In `PiPContent`, destructure `speakingUsers` from `useCallState()`:
```ts
const { speakingUsers, hangUp, activeCallRoomId, callStatus } = useCallState();
// (move useCallState call from PiPOverlay outer to PiPContent)
```

Find the active speaker's track:
```ts
// Pick active speaker's camera track, fallback to first available
const activeSpeakerId = speakingUsers.size > 0 ? [...speakingUsers][0] : null;

const cameraTrackRef = activeSpeakerId
  ? allTracks.find(
      (t) =>
        t.source === Track.Source.Camera &&
        isTrackReference(t) &&
        t.publication != null &&
        !t.publication.isMuted &&
        t.participant.identity.includes(activeSpeakerId)
    ) ?? allTracks.find(
      (t) =>
        t.source === Track.Source.Camera &&
        isTrackReference(t) &&
        t.publication != null &&
        !t.publication.isMuted
    )
  : allTracks.find(
      (t) =>
        t.source === Track.Source.Camera &&
        isTrackReference(t) &&
        t.publication != null &&
        !t.publication.isMuted
    );
```

### Fix B2: Speaking ring on PiP border
Add speaking ring CSS to `.container` when active speaker is speaking.
Pass `isSpeaking` as prop to PiPContent and add a data attribute:

In TSX: `data-speaking={activeSpeakerId !== null && speakingUsers.has(activeSpeakerId) ? 'true' : 'false'}`

In CSS, add to `PiPOverlay.module.css`:
```css
.container[data-speaking='true'] {
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.55),
    0 2px 8px rgba(0, 0, 0, 0.3),
    0 0 0 3px var(--voice-status-success, #23A55A);
}
```

### Fix B3: Jotai atom for corner persistence
In `PiPOverlay.tsx`, replace `useState<Corner>('bottom-right')` with a Jotai atom.

Add at top of file (outside component):
```ts
import { atom, useAtom } from 'jotai';
const pipCornerAtom = atom<Corner>('bottom-right');
```

In `PiPOverlay` component replace:
```ts
const [corner, setCorner] = useState<Corner>('bottom-right');
```
with:
```ts
const [corner, setCorner] = useAtom(pipCornerAtom);
```

### Fix B4: Resize handles (8 handles: 4 corners + 4 edges)
Add `pipSize` state and resize logic to `PiPContent`.

Add size state to `PiPOverlay`:
```ts
const [pipWidth, setPipWidth] = useState(PIP_DEFAULT_WIDTH);
```

Pass `pipWidth` and `onResize` down to PiPContent.

In `PiPContent`, implement 8 resize handles using `onPointerDown` + global `pointermove`/`pointerup`.

Handle positions (CSS classes):
- `.resizeN`, `.resizeS`, `.resizeE`, `.resizeW` (edges)
- `.resizeNE`, `.resizeNW`, `.resizeSE`, `.resizeSW` (corners)

Each handle is a `4px`-wide/tall absolute-positioned div with pointer cursor.

On `pointerdown`: capture pointer, record start size + mouse pos.
On `pointermove`: compute delta, call `onResize(newWidth)`.
On `pointerup`: release pointer.

Min width: 240px. Max width: 720px. Height auto-derived from aspect ratio.

CSS in `PiPOverlay.module.css`:
```css
.resizeHandle {
  position: absolute;
  z-index: 10;
}
/* Corners: 12×12px */
.resizeNW { top: 0; left: 0; width: 12px; height: 12px; cursor: nw-resize; }
.resizeNE { top: 0; right: 0; width: 12px; height: 12px; cursor: ne-resize; }
.resizeSW { bottom: 0; left: 0; width: 12px; height: 12px; cursor: sw-resize; }
.resizeSE { bottom: 0; right: 0; width: 12px; height: 12px; cursor: se-resize; }
/* Edges: thin strips */
.resizeN { top: 0; left: 12px; right: 12px; height: 4px; cursor: n-resize; }
.resizeS { bottom: 0; left: 12px; right: 12px; height: 4px; cursor: s-resize; }
.resizeW { left: 0; top: 12px; bottom: 12px; width: 4px; cursor: w-resize; }
.resizeE { right: 0; top: 12px; bottom: 12px; width: 4px; cursor: e-resize; }
```

---

## AGENT C — ControlBar Fixes

### Files
- `src/app/pages/client/call/NativeCallControlBar.tsx`
- `src/app/pages/client/call/NativeCallControlBar.module.css`

### Fix C1: border-radius 9999px (CSS)
In `NativeCallControlBar.module.css` line 50:
```css
/* BEFORE: border-radius: 50%; */
/* AFTER:  border-radius: 9999px; */
```

### Fix C2: Caret buttons 20×20px (CSS)
In `NativeCallControlBar.module.css` lines 84–85:
```css
/* BEFORE: width: 18px; height: 18px; */
/* AFTER:  width: 20px; height: 20px; */
```

### Fix C3: CSS token fixes (CSS)
In `NativeCallControlBar.module.css`:
```css
/* Line 25: .roomName { color: #949ba4; } */
/* AFTER:   .roomName { color: var(--text-muted); } */

/* Line 59: .btn:active { background: #232427; } */
/* AFTER:   .btn:active { background: var(--voice-surface-2); } */

/* Line 72: .btnHangup { color: #fff; } */
/* AFTER:   .btnHangup { color: white; } */

/* Line 76: .btnHangup:hover { background: #d93036; } */
/* AFTER:   .btnHangup:hover { background: color-mix(in srgb, var(--voice-status-danger) 85%, black); } */
```

### Fix C4: Screenshare menu on right-click (TSX)
In `NativeCallControlBar.tsx`, find the screenshare button render.
Currently the SS menu opens on LEFT click via `handleScreenShare`.

Change to:
- Left click: if already sharing → stop. If not sharing → open ScreenShareModal (existing behavior).
- Right click (`onContextMenu`): if already sharing → show context menu (Stop Sharing, Share Settings).

```tsx
// Add onContextMenu handler to the screen share button:
onContextMenu={(e) => {
  if (isScreenShareEnabled) {
    e.preventDefault();
    setShowSSMenu(true);
  }
}}
```

Also rename the menu item label from "Share Settings" to "Quality Settings":
```tsx
// Find: 'Share Settings'
// Replace: 'Quality Settings'
```

### Fix C5: "Stop Watching" button (TSX)
"Stop Watching" is shown when the local user is watching someone else's screenshare
(remote participant has `isScreenSharing: true` but local user is NOT sharing).

In `NativeCallControlBar.tsx`:
```tsx
// Derive isWatching from remoteParticipantStates:
const { remoteParticipantStates } = useCallState();
const isWatchingScreenShare = !isScreenShareEnabled &&
  [...remoteParticipantStates.values()].some((s) => s.isScreenSharing);
```

Add a "Stop Watching" button (shown only when `isWatchingScreenShare`):
```tsx
{isWatchingScreenShare && (
  <button
    type="button"
    className={`${styles.btn} ${styles.btnActive}`}
    onClick={stopWatchingScreenShare}
    title="Stop Watching"
  >
    <MonitorSlash size={20} />
  </button>
)}
```

Add `MonitorSlash` to Phosphor imports.

Implement `stopWatchingScreenShare`:
```ts
// In LiveKit, to unsubscribe from a specific track:
// iterate remoteParticipants, find screen share publications, call setSubscribed(false)
const stopWatchingScreenShare = useCallback(() => {
  if (!livekitRoom) return;
  for (const participant of livekitRoom.remoteParticipants.values()) {
    for (const pub of participant.trackPublications.values()) {
      if (pub.source === Track.Source.ScreenShare && pub.isSubscribed) {
        pub.setSubscribed(false);
      }
    }
  }
}, [livekitRoom]);
```

Add `livekitRoom` to the `useCallState()` destructure.
Add `MonitorSlash` import from `@phosphor-icons/react`.

### Fix C6: callJoinTime sync (TSX)
After Agent A adds `callJoinTime` to context, replace the local timer in `NativeCallControlBar`:

```ts
// REMOVE:
const [connectedAt] = useState(() => Date.now());
// REPLACE with (from context):
const { callJoinTime } = useCallState();
// Update the interval:
setDuration(callJoinTime ? Math.floor((Date.now() - callJoinTime.getTime()) / 1000) : 0);
```

---

## AGENT D — Grid + View Fixes

### Files
- `src/app/pages/client/call/NativeCallView.tsx`
- `src/app/pages/client/call/NativeCallView.module.css`
- `src/app/pages/client/call/NativeCallParticipantGrid.module.css`
- `src/app/pages/client/call/NativeCallParticipantTile.module.css`

### Fix D1: Back button in header (NativeCallView.tsx)
Import `X` from `@phosphor-icons/react`.
Destructure `toggleCallView` from `useCallState()`.

In the `.voiceHeader` JSX, add a back button BEFORE `.channelName`:
```tsx
<button
  type="button"
  className={styles.backBtn}
  onClick={toggleCallView}
  aria-label="Minimize call"
>
  <X size={18} weight="bold" />
</button>
```

Add CSS in `NativeCallView.module.css`:
```css
.backBtn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 120ms, background-color 120ms;
  flex-shrink: 0;
}
.backBtn:hover {
  color: var(--text-primary);
  background: var(--voice-overlay-subtle);
}
```

### Fix D2: Apply footer gradient to controlBarWrap (NativeCallView.module.css)
In `NativeCallView.module.css`, add `background` to `.controlBarWrap`:
```css
.controlBarWrap {
  background: var(--voice-footer-gradient);
  opacity: var(--voice-hud-opacity);
  pointer-events: var(--voice-hud-pointer-events);
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}
```

### Fix D3: Grid gap base 12px + 4px step (NativeCallParticipantGrid.module.css)
```css
/* Line 5: gap: 8px → gap: 12px */
.grid { gap: 12px; }

/* Breakpoints:
   @container voiceGrid (min-width: 520px)  → gap: 10px
   @container voiceGrid (min-width: 860px)  → gap: 8px
   @container voiceGrid (min-width: 1180px) → gap: 6px (existing)
   ADD new 4th step for 4-col (same breakpoint, add gap: 4px inside the 4-col rule):
*/
@container voiceGrid (min-width: 1180px) {
  .grid:has(.tile:nth-child(10)) {
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 4px;  /* ← was 6px */
  }
}
```

### Fix D4: Speaking ring — fix overflow clipping (NativeCallParticipantTile.module.css)
The `::after` pseudo-element border is clipped by `overflow: hidden` on `.tile`.
Replace with `outline` on `.tile` itself (outlines are NOT clipped by overflow):

Remove the `::after` speaking ring entirely.
Add speaking ring directly to `.tile`:

```css
/* REMOVE .tile::after and .tile[data-speaking='true']::after blocks */

/* ADD to .tile base: */
.tile {
  /* ... existing rules ... */
  outline: 0px solid var(--voice-status-success);
  outline-offset: -1px;  /* inset outline */
  transition: outline-width 0.4s ease-in 0.5s;
}

/* ADD speaking state on tile: */
.tile[data-speaking='true'] {
  outline-width: var(--speaking-indicator-width, 3.5px);
  transition: outline-width 0.2s ease-out 0s;
}
```

### Fix D5: Replace #fff with white token in NativeCallParticipantTile.module.css
```css
/* Line 71: .initial { color: #fff; } → color: white; */
/* Line 88: .selfBadge { color: #fff; } → color: white; */
/* Line 128: .pinButton { color: #fff; } → color: white; */
```
(white = valid CSS keyword, not a hardcoded hex value)

### Fix D6: Token fixes in NativeCallView.module.css
```css
/* .statusText { color: #949ba4; } → color: var(--text-muted); */
/* .errorText  { color: #f23f43; } → color: var(--voice-status-danger); */
/* .spinner border: 3px solid #35373c → border-color: var(--voice-surface-2) */
/* .spinner border-top-color: #5865f2 → border-top-color: var(--brand-primary) */
```

---

## AGENT E — Sidebar Fixes

### Files
- `src/app/features/room-nav/SignalStrengthIcon.tsx`
- `src/app/features/room-nav/SignalStrengthIcon.module.css`
- `src/app/features/room-nav/RoomCallNavStatus.tsx`
- `src/app/features/room-nav/RoomCallNavStatus.css.ts`

### Fix E1: Add 4th arc to SignalStrengthIcon.tsx
The current SVG has: base dot + 3 arcs (activeArcs counts 1–4 but dot is "level 1").
Add a true 4th arc (largest) and renumber:

```tsx
// activeArcs stays 0-4. Dot = level 1. Arc1 = level 2. Arc2 = level 3.
// Arc3 = level 4 (was the "largest"). ADD Arc4 = level 4 (new largest).
// Shift Arc3 to be the "medium-large" arc.

{/* Base dot — active when activeArcs >= 1 */}
<circle cx="3" cy="13" r="1.5" fill={activeArcs >= 1 ? color : 'var(--text-muted)'} />

{/* Arc 1 — smallest */}
<path d="M5.5 11 Q5.5 9 3 9 Q0.5 9 0.5 11"
  stroke={activeArcs >= 2 ? color : 'var(--text-muted)'}
  strokeWidth="1.5" strokeLinecap="round" />

{/* Arc 2 — medium */}
<path d="M8 9 Q8 5.5 3 5.5 Q-2 5.5 -2 9"
  stroke={activeArcs >= 3 ? color : 'var(--text-muted)'}
  strokeWidth="1.5" strokeLinecap="round" />

{/* Arc 3 — medium-large */}
<path d="M10.5 7 Q10.5 2 3 2 Q-4.5 2 -4.5 7"
  stroke={activeArcs >= 4 ? color : 'var(--text-muted)'}
  strokeWidth="1.5" strokeLinecap="round" />

{/* Arc 4 — largest (NEW) */}
<path d="M13 5 Q13 -2 3 -2 Q-7 -2 -7 5"
  stroke={activeArcs >= 4 ? color : 'var(--text-muted)'}
  strokeWidth="1.5" strokeLinecap="round" />
```

Update activeArcs thresholds so Arc4 only lights up at ≤50ms (keep same color logic).

### Fix E2: Sequential arc animation in SignalStrengthIcon.module.css
Replace the single `signalPulse` animation with per-arc CSS classes with staggered delays.

Each arc gets its own animation class. Apply via className when `latencyMs === null`:

In `SignalStrengthIcon.tsx`, when loading:
```tsx
className={latencyMs === null ? styles[`arcLoading${i}`] : undefined}
// on each path/circle, add the arcLoading class
```

In `SignalStrengthIcon.module.css`:
```css
/* Remove old signalPulse animation */
/* ADD: */
@keyframes arcBlink {
  0%, 100% { opacity: 0.15; }
  50%       { opacity: 1; }
}

.arcLoading0 { animation: arcBlink 1.12s ease-in-out infinite; animation-delay: 0ms; }
.arcLoading1 { animation: arcBlink 1.12s ease-in-out infinite; animation-delay: 280ms; }
.arcLoading2 { animation: arcBlink 1.12s ease-in-out infinite; animation-delay: 560ms; }
.arcLoading3 { animation: arcBlink 1.12s ease-in-out infinite; animation-delay: 840ms; }
```

Pass the index to each element and apply the matching class when loading.

### Fix E3: +N overflow badge in RoomCallNavStatus.tsx
Currently `callMembers.slice(0, 4)` clips silently. After the avatar stack, add:

```tsx
{callMembers.length > 4 && (
  <button
    type="button"
    style={css.overflowBadge}
    onClick={() => setShowMembersPopout(true)}
    aria-label={`${callMembers.length - 4} more participants`}
  >
    +{callMembers.length - 4}
  </button>
)}
```

Add `showMembersPopout` state and a simple popout listing all member names:
```tsx
{showMembersPopout && (
  <div style={css.membersPopout}>
    {callMembers.map((m) => (
      <div key={m.sender} style={css.membersPopoutItem}>
        {m.sender}
      </div>
    ))}
  </div>
)}
```

Add to `RoomCallNavStatus.css.ts`:
```ts
overflowBadge: {
  background: 'var(--background-modifier-hover)',
  border: 'none',
  borderRadius: toRem(9999),
  width: toRem(20),
  height: toRem(20),
  fontSize: toRem(10),
  fontWeight: '600',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
},
membersPopout: {
  position: 'absolute' as const,
  bottom: '100%',
  left: '0',
  background: 'var(--background-floating)',
  borderRadius: toRem(8),
  padding: toRem(8),
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  minWidth: toRem(160),
  zIndex: '100',
},
membersPopoutItem: {
  padding: `${toRem(4)} ${toRem(8)}`,
  fontSize: toRem(13),
  color: 'var(--text-primary)',
},
```

### Fix E4: Media buttons circular with --voice-* tokens (RoomCallNavStatus.css.ts)
Find `MediaButton` style object in `RoomCallNavStatus.css.ts`.
Change `borderRadius: toRem(4)` → `borderRadius: toRem(9999)` (circular).
Change background tokens from `var(--background-modifier-hover)` / `var(--background-modifier-selected)`
to use `--voice-*` tokens:
```ts
background: 'var(--voice-surface-1)',
// active state:
background: 'var(--voice-status-success-bg)',
color: 'var(--voice-status-success)',
```

### Fix E5: RTT history SVG line chart in VoiceDetailsPopout (RoomCallNavStatus.tsx)
Add a rolling RTT history buffer (last 30 readings) stored in a `useRef`.

```tsx
const rttHistoryRef = useRef<number[]>([]);
// Whenever RTT updates, append:
useEffect(() => {
  if (rttMs !== null) {
    rttHistoryRef.current = [...rttHistoryRef.current.slice(-29), rttMs];
  }
}, [rttMs]);
```

In the `VoicePopout` component, render an SVG line chart:
```tsx
function RttChart({ history }: { history: number[] }) {
  if (history.length < 2) return null;
  const W = 200, H = 40;
  const max = Math.max(...history, 1);
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--voice-status-success)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

Render inside the popout:
```tsx
<RttChart history={rttHistoryRef.current} />
```

---

## EXECUTION

Run all 5 agents in parallel. All touch distinct files — zero merge conflicts.

After all agents complete: run `yarn typecheck` to verify no new TypeScript errors.
