# Bettercord Voice UI Enhancement Plan
# Goal: 1:1 port of Fluxer's voice call UI to Bettercord

## Source Reference
- Fluxer voice UI:     /voicechat/fluxer/fluxer_app/src/components/voice/
- Bettercord call UI:  /voicechat/BetterCord/src/app/pages/client/call/
- Bettercord sidebar:  /voicechat/BetterCord/src/app/features/room-nav/

## Tech Decisions
- framer-motion: ADD as dependency (PiP spring-physics + IncomingCall animations)
- CSS: CSS Modules (*.module.css) — matches existing call component pattern
- Icons: @phosphor-icons/react (already in both Fluxer + Bettercord)
- Styling: CSS variables via --voice-* tokens, NOT hard-coded hex

## Parallelism Overview

```
framer-motion install ─┐
Phase 0 (Layout Fix)  ─┤
Phase 1 (CSS Tokens)  ─┤─► Batch 1 (parallel) ─────────────► Batch 2
                        │   ├─ Agent A: Phase 2 (Tile)
                        │   ├─ Agent B: Phase 3+4 (Layout+HUD)
                        │   ├─ Agent C: Phase 5+9 (ControlBar+Fixes)
                        │   └─ Agent D: Phase 7+8 (Sidebar+Incoming)
                        │
                        └─► After Agent A done: Agent E: Phase 6 (PiP)
```

---

## PRE-WORK (sequential, must complete before parallel batches)

### Pre-0: Install framer-motion
- `yarn add framer-motion` (in BetterCord/)
- React 18.2 compatible ✓

---

## PHASE 0: Layout Fix (SEQUENTIAL — must run before everything else)

**The fundamental problem:** `NativeCallView` renders as `position: fixed; inset: 0`
covering the entire app including sidebar. Sidebar MUST stay visible during calls
(like Discord/Fluxer).

### Root cause
`PersistentCallContainer.tsx` wraps NativeCallView in a fixed overlay:
```tsx
<div style={{ position: 'fixed', inset: 0, zIndex: 50, display: isCallViewOpen ? 'flex' : 'none' }}>
  <NativeCallView />
</div>
```
This overlays EVERYTHING — guild strip + channel sidebar disappear during calls.

### Fluxer's approach
```
GuildLayout (CSS Grid: 270px sidebar | 1fr main)
    └── VoiceCallView  ← fills only the 1fr main column
Guild-strip + Channel sidebar → always visible
Fullscreen = optional toggle button
```

### Files to change

**1. PersistentCallContainer.tsx** — Remove fixed overlay, pass-through only
```tsx
// AFTER (Phase 6 will add PiP here):
export function PersistentCallContainer({ children }) {
  return <>{children}</>;
  // Phase 6 adds: {activeCallRoomId && !isCallViewOpen && <PiPOverlay />}
}
```

**2. Room.tsx** — Render NativeCallView inline in the call panel (same slot as CallView)
```tsx
// In the isCallLayout section (~line 203):
// Import NativeCallView at top
// Add { callStatus } to useCallState() destructure
// Replace <CallView room={room} /> with:
{isActiveCall && callStatus !== 'idle' ? (
  <NativeCallView />
) : (
  <CallView room={room} />
)}
// NativeCallView now lives inside main content — sidebar stays visible
```

**3. NativeCallParticipantGrid.module.css** — No-scroll fix
```css
/* BEFORE: overflow: auto; align-content: start; */
/* AFTER:  overflow: hidden; */
/* Tiles adapt via CSS container queries (Phase 3) instead of scrolling */
```

**4. NativeCallView.module.css** — Replace hard-coded bg with CSS var
```css
/* .view { background: #313338; } → background: var(--background-primary) */
```

---

## PHASE 1: CSS Variable Token System (SEQUENTIAL — after Phase 0)

Files to edit:
- `NativeCallView.module.css` — add :root token definitions
- `NativeCallParticipantTile.module.css` — replace all hard-coded hex
- `NativeCallControlBar.module.css` — replace all hard-coded hex
- `NativeCallParticipantGrid.module.css` — replace all hard-coded hex
- `BCStatsPanel.module.css` — replace all hard-coded hex

New CSS variables (defined in `NativeCallView.module.css` `:root` block):
```css
:root {
  --voice-surface-0: var(--background-primary);      /* #313338 */
  --voice-surface-1: var(--background-secondary);    /* #2b2d31 */
  --voice-surface-2: var(--background-tertiary);     /* #1e1f22 */
  --voice-overlay-strong: rgba(0, 0, 0, 0.72);
  --voice-overlay:        rgba(0, 0, 0, 0.62);
  --voice-overlay-soft:   rgba(0, 0, 0, 0.46);
  --voice-overlay-subtle: rgba(0, 0, 0, 0.32);
  --voice-status-success: #23A55A;
  --voice-status-danger:  #F23F43;
  --voice-status-warning: #FCC23B;
  --voice-hud-opacity:         0;
  --voice-hud-pointer-events:  none;
  --speaking-indicator-width:  3.5px;
}
```
Reference: Fluxer `VoiceCallView.module.css` lines 75-122

---

## BATCH 1 — All 4 agents run in parallel after Phases 0 + 1

---

### AGENT A: Phase 2 — VoiceParticipantTile Upgrade
**Priority: HIGHEST visual impact**

Files:
- `src/app/pages/client/call/NativeCallParticipantTile.tsx` (87 → ~400 lines)
- `src/app/pages/client/call/NativeCallParticipantTile.module.css` (98 → ~300 lines)

Changes:

1. **Real Matrix avatars** (replace hash-based colored initial)
   - Use existing MxcAvatar / Avatar component from folds/matrix SDK
   - Fallback: colored initial circle if no avatar URL
   - **⚠️ NEW (Discord screenshot): Tile background = derived user accent color**
     - `--voice-tile-accent-color` set as inline style per tile from user's avatar color hash
     - Background: `color-mix(in srgb, var(--voice-tile-accent-color) 30%, var(--voice-surface-2))`
     - NOT solid dark grey — each participant gets a distinct colored tile (like Discord/Fluxer)

2. **Animated speaking border ring** (replace box-shadow with Fluxer's border approach)
   - `::after` pseudo-element: `border: 0px solid var(--voice-status-success)`
   - Speaking: `border-width: var(--speaking-indicator-width)` (3.5px), inset
   - Transition in: `0.2s ease-out`
   - Transition out: `0.5s delay + 0.4s ease-in`
   - Reference: Fluxer `VoiceCallView.module.css` lines 151-168

3. **Hover-revealed metadata bar** (hidden by default, `opacity: 0 → 1`)
   - Bottom gradient overlay (`var(--voice-overlay-strong)` to transparent)
   - Contains: display name (truncated 34ch) + MicrophoneSlash icon + optional deafen icon
   - Reveals on `.tile:hover` (300ms transition)

4. **Camera on/off fade transition**
   - VideoTrack: `opacity 0 → 1, 0.2s ease` on mount
   - Avatar placeholder: same fade when camera off

5. **Self-view "You" label**
   - Local participant tile: small "You" badge (top-left pill) + subtle ring tint

6. **Pin button** (top-right, hover-revealed)
   - CornersOut icon, 32×32px, `background: var(--voice-overlay-strong)`, `border-radius: 9999px`
   - onClick → sets `pinnedParticipantId` in `VoiceCallLayoutStore` (Phase 3)

7. **Screen share badge** — top-right monitor icon pill, upgraded to Fluxer style

8. **Stream quality pill** — bottom-right, `font-family: var(--font-mono)`, monospace

Reference: Fluxer `VoiceParticipantTile.tsx`, `VoiceParticipantTile.module.css`

---

### AGENT B: Phase 3 + Phase 4 — Layout Engine + HUD Auto-Hide

#### Phase 3: Layout Engine Upgrade

Files:
- `src/app/pages/client/call/NativeCallParticipantGrid.tsx` (69 → ~250 lines)
- `src/app/pages/client/call/NativeCallParticipantGrid.module.css` (36 → ~180 lines)
- NEW: `src/app/pages/client/call/VoiceCallLayoutStore.ts` (~60 lines)

Changes:

1. **CSS container queries** for responsive grid columns (replaces manual `columns` useMemo)
   - 1 col default
   - 2 cols at container ≥520px AND ≥2 tiles
   - 3 cols at container ≥860px AND ≥5 tiles
   - 4 cols at container ≥1180px AND ≥10 tiles
   - Auto-shrinking gap: 12px → 10px → 8px → 6px → 4px
   - `overflow: hidden` (Phase 0 already sets this, confirm)

2. **Focus/Spotlight layout mode** (`VoiceCallLayoutStore`)
   - Jotai atom: `layoutMode: 'grid' | 'focus'`, `pinnedParticipantId: string | null`
   - Focus mode: one large main tile (`max-height: 76dvh`) + collapsible carousel below
   - Carousel: `--carousel-row-height: 180px`, CaretUp/Down collapse toggle
   - **Auto-activates on screenshare**: when any participant starts screensharing → auto-pin screenshare tile

3. **Screen share tiles**: full-width span, 16:9, placed first in grid, `overflow: hidden`

Reference: Fluxer `VoiceGridLayout.tsx`, `VoiceCallLayoutContent.tsx`

#### Phase 4: HUD Auto-Hide System

Files:
- `src/app/pages/client/call/NativeCallView.tsx` (42 → ~120 lines)
- `src/app/pages/client/call/NativeCallView.module.css` (46 → ~180 lines)

Changes:

1. **CSS variable HUD system** on `.voiceRoot`
   ```css
   .voiceRoot { --voice-hud-opacity: 0; --voice-hud-pointer-events: none; }
   .voiceRoot.pointerActive { --voice-hud-opacity: 1; --voice-hud-pointer-events: auto; }
   ```

2. **3-second idle timer** (`useVoiceHUDIdle` hook inline)
   - Adds `pointerActive` class on `pointermove`
   - Removes after 3000ms inactivity
   - Always visible on mobile (skip timer)

3. **Header chrome** (new, auto-hiding via `--voice-hud-opacity`)
   - Channel name + back/close button
   - Connection status badge: pulse dot + "Voice Connected" / "Connecting…" / "Reconnecting"
   - ChartBar icon → toggles BCStatsPanel

4. **Gradient overlays** (header + footer)
   - Header: `linear-gradient(to bottom, var(--voice-overlay-strong), transparent)`
   - Footer: `linear-gradient(to top, var(--voice-overlay-strong), transparent)`

5. **Control bar** respects `--voice-hud-opacity` + `--voice-hud-pointer-events`

Reference: Fluxer `VoiceCallView.tsx`, `VoiceCallView.module.css` lines 785-823

---

### AGENT C: Phase 5 + Phase 9 — Control Bar Polish + Bug Fixes

#### Phase 5: Control Bar Polish

Files:
- `src/app/pages/client/call/NativeCallControlBar.tsx` (206 → ~320 lines)
- `src/app/pages/client/call/NativeCallControlBar.module.css` (70 → ~140 lines)
- `src/app/features/room-nav/RoomNavItem.tsx` — add call duration timer badge

Changes:

1. **Button standardization**: 44×44px, `border-radius: 9999px`, all use `--voice-*` tokens

2. **Caret sub-buttons** for mic + camera device switching
   - 20×20px overlay positioned top-right corner of mic/camera button
   - Opens device selection popover (enumerate `mediaDevices.enumerateDevices()`)

3. **Call duration timer** — HH:MM:SS format, `callJoinTime` from CallProvider
   - In control bar left section
   - **⚠️ NEW (Discord screenshot): ALSO in RoomNavItem sidebar** next to channel name
     - Format: `MM:SS` (compact, e.g. "0:26" as in Discord screenshot)
     - Only shown when `activeCallRoomId === room.roomId` in `RoomNavItem.tsx`

4. **Screen share context menu** (right-click) → Stop Sharing, Quality Settings

5. **Visual state audit**: all 8 buttons use `--voice-*` CSS variables (no hard-coded hex)

6. **"Stop Watching" button** variant when user is watching a screenshare stream

Reference: Fluxer `VoiceControlBar.tsx`

#### Phase 9: Bug Fixes + i18n

Files:
- `src/app/components/user-area/UserArea.tsx`
- `src/app/components/voice/ScreenShareModal/ScreenShareModal.tsx`

Fixes:

1. **UserArea deafen button** (BUG: currently `useState(false)`, disconnected from engine)
   - Wire `onClick` → `callState.toggleDeafen()`
   - Wire visual state → `callState.isDeafened`

2. **ScreenShareModal German labels** → i18next keys
   - `"Bildschirm teilen"` → `t('action.screen_share')`
   - `"Auflösung"` → `t('setting.resolution')`
   - `"Quelle"` → `t('setting.source')`
   - `"System-Audio aufnehmen"` → `t('setting.capture_system_audio')`
   - `"Abbrechen"` → `t('action.cancel')`
   - Add missing keys to `en.json` + `de.json`

---

### AGENT D: Phase 7 + Phase 8 — Sidebar + Incoming Call

#### Phase 7: Sidebar VoiceConnectionStatus Upgrade

Files:
- `src/app/features/room-nav/RoomCallNavStatus.tsx` (566 → ~700 lines)
- `src/app/features/room-nav/RoomCallNavStatus.css.ts` (210 → ~280 lines)
- NEW: `src/app/features/room-nav/SignalStrengthIcon.tsx` (~80 lines)
- NEW: `src/app/features/room-nav/SignalStrengthIcon.module.css`

Changes:

1. **SignalStrengthIcon** SVG component (4 concentric quarter-circle arcs + base dot)
   - Green (≤50ms RTT), Yellow (≤100ms), Orange (≤150ms), Red (>150ms)
   - Loading animation: sequential arc illumination every 280ms

2. **"Voice Connected" → clickable** → opens VoiceDetailsPopout
   - SVG line chart: last 30 RTT data points
   - RTT, jitter, endpoint, device info rows

3. **Speaking avatar stack**
   - Up to 4 overlapping avatars (horizontal stack)
   - Speaking avatars → green `box-shadow: 0 0 0 2px var(--voice-status-success)`
   - +N overflow badge → full list popout

4. **Media buttons** match Phase 5 visual style (circular, --voice-* tokens)

Reference: Fluxer `VoiceConnectionStatus.tsx`, `SignalStrengthIcon.tsx`

#### Phase 8: Incoming Call Card Polish

Files:
- `src/app/features/room-nav/RoomCallNavStatus.tsx` (incoming call section)

Changes:

1. **Glassmorphism card**
   - `backdrop-filter: blur(20px)`
   - `border: 1px solid rgba(255, 255, 255, 0.12)`
   - `background: color-mix(in srgb, var(--background-secondary) 85%, transparent)`

2. **Scale-in CSS animation**
   ```css
   @keyframes incomingCallIn {
     from { opacity: 0; scale: 0.985; }
     to   { opacity: 1; scale: 1; }
   }
   /* duration: 0.14s ease-out */
   ```

3. **Draggable** via `framer-motion` `motion.div` + drag handle pill at top

4. **Card layout** (Fluxer-style, `z-index: 2001`):
   - Drag handle pill
   - PhoneIncoming icon (green) + "INCOMING CALL" label (uppercase)
   - Caller avatar: 80px circle with actual Matrix MxcAvatar
   - Caller display name
   - Accept (green primary) / Reject (red) / Ignore (neutral) — 44px height

5. Keep existing ringtone + 30s auto-dismiss logic

Reference: Fluxer `IncomingCallUI.tsx`, `IncomingCallUI.module.css`

---

## BATCH 2 — After Agent A (Phase 2) completes

### AGENT E: Phase 6 — PiP Overlay (Floating Mini Window)

**Depends on: Phase 0 (layout fix in place) + Phase 2 (tile component) + framer-motion**

Files:
- NEW: `src/app/pages/client/call/PiPOverlay.tsx` (~350 lines)
- NEW: `src/app/pages/client/call/PiPOverlay.module.css` (~120 lines)
- `src/app/pages/client/call/PersistentCallContainer.tsx` — add PiP render
- `src/app/pages/client/call/CallProvider.tsx` — expose `callJoinTime`

Changes:

1. **Trigger**: when navigating away from call room while still connected
   (`activeCallRoomId !== currentRoomId && callStatus === 'connected'`)

2. **Spring-physics corner snapping** (framer-motion)
   - Default position: bottom-right corner, 16px padding
   - Default size: 320×180px (16:9), min 240px, max 720px
   - On drag release → snap to nearest corner
   - Spring: `stiffness: 520, damping: 42, mass: 0.9`
   - Scale `1.02` while dragging

3. **Resizable** via 8 resize handle buttons (4 corners + 4 edges)

4. **Content**: active speaker's VideoTrack (camera) OR avatar + speaking ring

5. **Hover overlay**:
   - Top gradient: `← #channel-name` return button + X close
   - Bottom gradient: participant name + disconnect button

6. **PiP Jotai atom**: `pipPosition`, `pipSize` persisted per session

7. **PersistentCallContainer** renders `<PiPOverlay />` when `!isCallViewOpen && callStatus === 'connected'`

Reference: Fluxer `PiPOverlay.tsx` (950 lines)

---

## EXECUTION ORDER

```
[Pre-work — sequential]
  1. yarn add framer-motion
  2. Phase 0: Layout fix
     - PersistentCallContainer.tsx: remove fixed overlay
     - Room.tsx: render NativeCallView inline
     - NativeCallParticipantGrid.module.css: overflow: hidden
     - NativeCallView.module.css: background: var(--background-primary)
  3. Phase 1: CSS variable tokens in all 5 call CSS files

[Batch 1 — parallel after pre-work completes]
  Agent A: Phase 2 (Tile upgrade)        ──────────────────────► done
  Agent B: Phase 3+4 (Layout+HUD)        ──────────────────────► done
  Agent C: Phase 5+9 (ControlBar+Fixes)  ──────────────────────► done
  Agent D: Phase 7+8 (Sidebar+Incoming)  ──────────────────────► done

[Batch 2 — after Agent A (Phase 2) completes]
  Agent E: Phase 6 (PiP Overlay)         ──────────────────────► done

[Final]
  → yarn typecheck
  → Visual review of all voice call states
```

---

## Files Modified / Created

### Modified:
- `src/app/pages/client/call/PersistentCallContainer.tsx`
- `src/app/pages/client/call/NativeCallView.tsx`
- `src/app/pages/client/call/NativeCallView.module.css`
- `src/app/pages/client/call/NativeCallParticipantTile.tsx`
- `src/app/pages/client/call/NativeCallParticipantTile.module.css`
- `src/app/pages/client/call/NativeCallParticipantGrid.tsx`
- `src/app/pages/client/call/NativeCallParticipantGrid.module.css`
- `src/app/pages/client/call/NativeCallControlBar.tsx`
- `src/app/pages/client/call/NativeCallControlBar.module.css`
- `src/app/pages/client/call/BCStatsPanel.module.css`
- `src/app/pages/client/call/CallProvider.tsx`
- `src/app/features/room/Room.tsx`
- `src/app/features/room-nav/RoomCallNavStatus.tsx`
- `src/app/features/room-nav/RoomCallNavStatus.css.ts`
- `src/app/features/room-nav/RoomNavItem.tsx`
- `src/app/components/user-area/UserArea.tsx`
- `src/app/components/voice/ScreenShareModal/ScreenShareModal.tsx`
- `package.json`

### Created:
- `src/app/pages/client/call/PiPOverlay.tsx`
- `src/app/pages/client/call/PiPOverlay.module.css`
- `src/app/pages/client/call/VoiceCallLayoutStore.ts`
- `src/app/features/room-nav/SignalStrengthIcon.tsx`
- `src/app/features/room-nav/SignalStrengthIcon.module.css`
