# BetterCord — Entwicklungsplan

> **Basis:** Cinny (Wally-Fork) — Matrix + E2EE + Element Call bereits integriert
> **Ziel:** Fluxer/Discord UI 1:1, mit Admin-seitigen A/V-Quality-Controls + PWA
> **Repo:** https://github.com/davifernan/BetterCord (privat)

---

## Was ist BetterCord?

Ein Matrix-Client der **aussieht wie Discord/Fluxer**, aber auf **Matrix** (E2EE, dezentral, self-hosted) basiert.

- **Frontend:** Fluxer UI — 1:1 das Discord-artige Aussehen (Squircle-Icons, Dark Theme, IBM Plex Font, etc.)
- **Backend:** Matrix-Protokoll via `matrix-js-sdk` (E2EE, Spaces, Rooms)
- **Calls:** Element Call (bereits integriert) mit eigenem Voice-UI-Layer
- **Mobile:** Vollwertige PWA (installierbar, offline-fähig, Push Notifications)
- **A/V-Qualität:** Admin setzt Maxima, User steuert innerhalb dieser Grenzen

---

## Kurzübersicht Tech-Stack

| Was | Aktuell (Cinny) | Nach Umbau (BetterCord) |
|-----|----------------|------------------------|
| Framework | React 18 | React 18 (bleibt) |
| State | Jotai | Jotai + neue Atoms für A/V |
| CSS | vanilla-extract + `folds` | vanilla-extract + **Fluxer CSS Custom Properties** |
| Icons | folds-Icons | **@phosphor-icons/react** |
| Font | Inter | **IBM Plex Sans + IBM Plex Mono** |
| Voice | Element Call iframe | Element Call iframe + **eigener Voice-UI-Layer** |
| Build | Vite + VitePWA | Vite + VitePWA (bleibt) |
| Deploy | Docker | Docker (bleibt) |

---

## Deployment-Strategie

```
Entwicklung (lokal / GitHub Codespaces)
    ↓
git push → GitHub (privates Repo: davifernan/BetterCord)
    ↓
Server: git pull && docker-compose up -d
```

### Schnellstart lokal
```bash
git clone https://github.com/davifernan/BetterCord.git
cd BetterCord
npm install
npm run dev
# → http://localhost:8080
```

### Docker auf dem Server
```bash
# Einmalig:
git clone https://github.com/davifernan/BetterCord.git
cd BetterCord

# Danach bei jedem Update:
git pull
docker-compose up -d --build
```

---

## Implementierungs-Reihenfolge

```
Phase 1  →  Projekt-Setup & Rename           ~1 Tag
Phase 2  →  Design System (CSS Tokens)       ~2 Tage
Phase 3  →  Layout-Shell (Fluxer-Look)       ~5 Tage
Phase 4  →  Message UI Redesign              ~4 Tage
Phase 5  →  Voice UI Shell                   ~5 Tage
Phase 6  →  A/V Quality Settings System      ~7 Tage
Phase 7  →  Settings-Seite Redesign          ~3 Tage
Phase 8  →  PWA Mobile                       ~3 Tage
────────────────────────────────────────────────────
Gesamt   →  ~30 Arbeitstage / 6 Wochen
```

---

## Phase 1 — Projekt-Setup & Rename

### Ziel
Cinny in BetterCord umbenennen, Dependencies für Fluxer-UI installieren.

### Aufgaben
- [ ] `package.json`: `name` → `"bettercord"`
- [ ] `public/manifest.json`: `name` → `"BetterCord"`, `short_name` → `"BetterCord"`, `theme_color` → `"#4641D9"`, `background_color` → `"#1E1F22"`
- [ ] `index.html`: `<title>BetterCord</title>`
- [ ] `config.json`: App-Name anpassen
- [ ] Dependencies installieren:
  ```bash
  npm install @phosphor-icons/react
  npm install @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
  ```
- [ ] Alte Cinny-Icons in `public/` durch BetterCord-Icons ersetzen (optional: Discord-ähnliches Icon)

---

## Phase 2 — Design System (CSS Custom Properties)

### Ziel
Fluxer's komplettes CSS-Token-System in BetterCord einbauen. Das ist die Grundlage für ALLES andere.

### Neue Datei: `src/app/styles/global.css`
Übernehmen aus `fluxer/fluxer_app/src/global.css`:

```css
:root {
  /* === LAYOUT === */
  --layout-guild-list-width: 4.5rem;    /* 72px — Space-Icon-Spalte links */
  --layout-sidebar-width: 16.875rem;    /* 270px — Channel-Liste */
  --layout-header-height: 3.5rem;       /* 56px — Channel-Header oben */
  --layout-user-area-height: 72px;      /* User-Panel unten links */
  --mobile-bottom-nav-height: 60px;

  /* === SPACING === */
  --spacing-1: 0.25rem;    /* 4px */
  --spacing-2: 0.5rem;     /* 8px */
  --spacing-3: 0.75rem;    /* 12px */
  --spacing-4: 1rem;       /* 16px */
  --spacing-5: 1.25rem;    /* 20px */
  --spacing-6: 1.5rem;     /* 24px */
  --spacing-8: 2rem;       /* 32px */
  --spacing-10: 2.5rem;    /* 40px */
  --spacing-12: 3rem;      /* 48px */

  /* === BORDER RADIUS === */
  --radius-sm: 0.25rem;    /* 4px */
  --radius-md: 0.375rem;   /* 6px */
  --radius-lg: 0.5rem;     /* 8px */
  --radius-xl: 0.75rem;    /* 12px */
  --radius-2xl: 1rem;      /* 16px */
  --radius-full: 9999px;

  /* === Z-INDEX === */
  --z-index-modal: 10000;
  --z-index-popout: 15000;
  --z-index-overlay: 40000;
  --z-index-tooltip: 45000;
  --z-index-toast: 50000;
  --z-index-contextmenu: 2147483647;

  /* === BRAND === */
  --brand-primary: #4641D9;
  --focus-primary: #00b0f4;

  /* === DARK THEME (default) === */
  --background-primary: #313338;
  --background-secondary: #2B2D31;
  --background-tertiary: #1E1F22;
  --background-floating: #111214;
  --background-modifier-hover: rgba(255,255,255,0.06);
  --background-modifier-selected: rgba(255,255,255,0.12);
  --background-modifier-accent: rgba(255,255,255,0.16);

  --text-primary: #DBDEE1;
  --text-secondary: #B5BAC1;
  --text-muted: #80848E;
  --text-link: #00AFF4;
  --text-danger: #F23F43;

  --user-area-divider-color: rgba(255,255,255,0.06);
  --panel-control-bg: #232428;

  /* === MESSAGES === */
  --message-avatar-size: 40px;
  --message-gutter: 16px;
  --chat-horizontal-padding: 16px;
  --message-line-height: 1.375rem;
  --message-mention-color: rgb(234 197 50);
  --message-mention-bg: rgb(234 197 50 / 0.1);
  --message-reply-color: rgb(59 130 246);
  --message-reply-bg: rgb(59 130 246 / 0.1);

  /* === STATUS === */
  --status-online: #23A55A;
  --status-idle: #F0B232;
  --status-dnd: #F23F43;
  --status-offline: #80848E;

  /* === FONTS === */
  --font-sans: 'IBM Plex Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}

.theme-light {
  --background-primary: #FFFFFF;
  --background-secondary: #F2F3F5;
  --background-tertiary: #E3E5E8;
  --text-primary: #060607;
  --text-secondary: #4E5058;
  --text-muted: #80848E;
  --panel-control-bg: #EBEDEF;
}

html {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.5;
}

/* Reduced motion */
html.reduced-motion * {
  animation-duration: 0.01ms !important;
  transition-duration: 0.01ms !important;
}

/* Mobile: kein text-select */
@media (max-width: 840px) {
  html { user-select: none; }
}
```

### Fonts einbinden (in `index.html`)
```html
<link rel="preconnect" href="https://fonts.bunny.net">
<!-- ODER via @fontsource npm packages: -->
```

In `src/app/styles/global.css` oben:
```css
@import '@fontsource/ibm-plex-sans/400.css';
@import '@fontsource/ibm-plex-sans/500.css';
@import '@fontsource/ibm-plex-sans/600.css';
@import '@fontsource/ibm-plex-mono/400.css';
```

### Phosphor Icons global konfigurieren
In `src/app/pages/App.tsx`:
```tsx
import { IconContext } from '@phosphor-icons/react';

// Um den Root-Provider wrappen:
<IconContext.Provider value={{ weight: 'fill', color: 'currentColor' }}>
  {/* restliche App */}
</IconContext.Provider>
```

---

## Phase 3 — Layout-Shell (Fluxer Look)

### Ziel
Das äußere App-Gerüst 1:1 wie Fluxer/Discord aufbauen. Das ist die größte Umbauarbeit.

### Vorher (Cinny): 66px Sidebar + Rest
### Nachher (BetterCord): Fluxer 3-Spalten-Layout

```
[100svh Viewport]
└── AppWrapper (overflow:hidden, background-primary)
    └── GuildsLayout  (CSS Grid: 72px | fill)
        │
        ├── GuildListScrollContainer  (72px, scrollable, kein Scrollbar)
        │   ├── DM-Button (Home-Icon, oben)
        │   ├── Separator-Pill
        │   ├── Space-Icons (48px, Kreis→Squircle on hover, Pill-Indikator)
        │   └── Add-Space Button [+]
        │
        └── ContentContainer (fill, rounded top-left corner)
            └── GuildLayout  (CSS Grid: 270px | fill)
                │
                ├── GuildNavbar  (270px)
                │   ├── GuildHeader (56px, Space-Name + Caret-Icon)
                │   ├── ChannelListContent (scrollbar: none, overflow-y: auto)
                │   │   ├── Kategorie-Header (UPPERCASE, 12px, 600 weight, muted)
                │   │   └── ChannelItems:
                │   │       ├── # Text-Channel  (16px, 500 weight)
                │   │       └── 🔊 Voice-Channel (16px, 500 weight)
                │   └── UserArea (absolut, bottom-left, 72px Höhe)
                │       ├── Avatar (32px) + Status-Dot (8px)
                │       ├── Username (14px, 500) + Tag (11px, muted)
                │       └── Controls: [Mute 32px] [Deafen 32px] [Settings 32px]
                │
                └── GuildMainContent (flex column)
                    ├── ChannelHeader (56px, Channel-Name + Aktionen)
                    ├── MessageTimeline (fill, virtualisiert)
                    ├── RoomInput (Composer)
                    └── MembersDrawer (optional, rechts, 240px)
```

### Neue/geänderte Dateien

**`src/app/components/layout/GuildsLayout/`** (neu)
- `GuildsLayout.tsx` — Äußeres CSS-Grid (72px | fill)
- `GuildsLayout.module.css` — Grid + Squircle-Animation + Pill-Indikator

**`src/app/components/layout/GuildLayout/`** (neu)
- `GuildLayout.tsx` — Inneres CSS-Grid (270px | fill)
- `GuildLayout.module.css`

**`src/app/components/layout/GuildNavbar/`** (neu)
- `GuildNavbar.tsx`
- `GuildHeader.tsx` — Space-Name + Dropdown-Caret
- `ChannelItem.tsx` — einzelner Channel-Eintrag
- `ChannelListContent.tsx` — Kategorien + Items
- `UserArea.tsx` — User-Panel unten links

**`src/app/pages/client/ClientLayout.tsx`** (stark ändern)
- Alten Cinny-Layout-Baum durch GuildsLayout ersetzen

### Guild-Icon Animation (wichtigstes visuelles Detail!)
```css
/* GuildsLayout.module.css */
.guildIcon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);          /* Kreis */
  transition: border-radius 70ms ease-out,
              background-color 70ms ease-out;
}
.guildIcon:hover,
.selected .guildIcon {
  border-radius: 30%;                          /* Squircle */
}

/* Pill-Indikator (links am Guild-Icon) */
.guildIndicator {
  position: absolute;
  left: 0;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--text-primary);
  transition: height 200ms ease, opacity 200ms ease;
  opacity: 0;
  height: 8px;
}
.hasActivity .guildIndicator {
  opacity: 1;
  height: 8px;
}
.selected .guildIndicator {
  opacity: 1;
  height: 24px;                               /* Länger wenn aktiv */
}
```

---

## Phase 4 — Message UI Redesign

### Ziel
Nachrichten sehen aus wie in Discord/Fluxer: 4-Spalten-Grid, Hover-Aktionen, Mention-Highlight.

### 4-Column Message Grid
```css
/* Nachrichten-Layout */
.message {
  display: grid;
  grid-template-columns:
    var(--chat-horizontal-padding)   /* 16px links */
    var(--message-avatar-size)       /* 40px Avatar */
    16px                             /* Gap */
    minmax(0, 1fr);                  /* Content */
  padding: 2px 0;
  position: relative;
}

/* Folgenachricht: Timestamp statt Avatar */
.messageGrouped {
  /* gleiche Spalten, Avatar-Slot zeigt timestamp on hover */
}

/* Hover-Effekt */
.message:hover {
  background: var(--background-modifier-hover);
}

/* Action-Bar (React, Antworten, Mehr) — rechts, nur on hover */
.messageActions {
  position: absolute;
  top: -16px;
  right: 16px;
  opacity: 0;
  transition: opacity 100ms;
}
.message:hover .messageActions {
  opacity: 1;
}
```

### Mention-Highlight
```css
.messageMentioned {
  background: var(--message-mention-bg);    /* gelb 10% */
}
.messageMentioned::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  background: var(--message-mention-color); /* gelb solid */
}
```

### Reply-Spine (reiner CSS-Trick)
```css
.replySpine::before {
  content: '';
  position: absolute;
  border: 2px solid var(--text-muted);
  border-right: none;
  border-bottom: none;
  border-top-left-radius: 6px;
  top: 50%;
  left: -32px;
  width: 20px;
  height: 12px;
}
```

---

## Phase 5 — Voice UI Shell

### Wichtig: Was Element Call macht vs. was WIR machen

```
Element Call (iframe) = WebRTC + Signaling + E2EE (wir fassen das NICHT an)
Unser UI-Layer = Alles was der User sieht und bedient
```

### Unser Voice-UI-Layer (neu bauen)

**`src/app/components/voice/VoiceControlBar/`**
- Mute-Button (Mikrofon an/aus)
- Deafen-Button (Ton an/aus)
- Camera-Button (Kamera an/aus)
- Screenshare-Button (→ öffnet ScreenShareSettingsModal)
- Disconnect-Button (rot, verlässt Call)

```tsx
// VoiceControlBar.tsx
interface VoiceControlBarProps {
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  onMute: () => void;
  onDeafen: () => void;
  onCamera: () => void;
  onScreenShare: () => void;   // öffnet erst Modal, dann startet Share
  onDisconnect: () => void;
}
```

**`src/app/components/voice/ScreenShareSettingsModal/`** (neu)
Öffnet sich VOR jedem Screenshare-Start:
```
┌─ Bildschirm teilen ─────────────────────────────┐
│                                                  │
│  Auflösung     [ 480p ][ 720p ][ 1080p ][ Quelle]│
│  Framerate     [  5  ][ 15  ][ 30  ][ 60 fps ]  │
│  Desktop-Audio [●────────────] Ein               │
│                                                  │
│  ℹ Max. erlaubt: 1080p / 30 fps                  │
│    (vom Space-Admin gesetzt)                     │
│                                                  │
│          [Abbrechen]  [Jetzt teilen →]           │
└──────────────────────────────────────────────────┘
```

**`src/app/components/voice/VoiceParticipantGrid/`**
- Responsive Tile-Grid (1–25 Teilnehmer)
- Jedes Tile: Avatar + Name + Status-Icons (Mute/Video)
- StreamInfoPill: zeigt aktuell laufende Resolution + FPS

### Element Call URL-Params für Quality (in `SmallWidget.ts` ergänzen)
```typescript
// src/app/features/call/SmallWidget.ts → getWidgetUrl()
// Diese Params AN Element Call übergeben:
const qualityParams = {
  videoResolution: effectiveSettings.videoResolution,   // '480p', '720p', etc.
  videoFps: String(effectiveSettings.videoFps),
  screenshareResolution: effectiveSettings.ssResolution,
  screenshareFps: String(effectiveSettings.ssFps),
  audioBitrate: String(effectiveSettings.audioBitrate),
};
// In die bestehende URL-Konstruktion einfügen
```

---

## Phase 6 — A/V Quality Settings System (Kern-Feature)

### Konzept: 3 Ebenen, höhere Ebene setzt Maximum

```
Space-Admin setzt Maxima    (z.B. max 1080p / 30fps)
    ↓
Channel-Override (optional) (z.B. dieser Channel: max 720p / 15fps)
    ↓
User wählt eigene Qualität  (aber nie über das Maximum)
```

### 6.1 User-Settings-Erweiterung

In `src/app/state/settings.ts` ergänzen:
```typescript
// Neue Felder im Settings-Interface:

// Audio
audioBitrate: 32 | 64 | 128 | 256 | 510;       // kbps, default: 64
echoCancellation: boolean;                       // default: true
noiseSuppression: boolean;                       // default: true
autoGainControl: boolean;                        // default: true
voiceActivityMode: 'vad' | 'ptt';               // default: 'vad'

// Kamera
videoResolution: '360p' | '480p' | '720p' | '1080p'; // default: '480p'
videoFps: 15 | 24 | 30;                         // default: 24

// Screenshare
ssResolution: '720p' | '1080p' | 'source';      // default: '720p'
ssFps: 5 | 15 | 30 | 60;                        // default: 15
ssAudio: boolean;                               // default: false

// Empfang
receiveVideoQuality: 'auto' | 'high' | 'medium' | 'low'; // default: 'auto'
```

### 6.2 Admin-Settings (Matrix State Events)

**Space-Defaults** → als Matrix State Event gespeichert:
```typescript
// Event Type: 'io.bettercord.space.av_settings'
// State Key: '' (leer)
interface SpaceAVSettings {
  maxAudioBitrate: 64 | 128 | 256 | 510;        // default: 64
  maxVideoResolution: '360p' | '480p' | '720p' | '1080p'; // default: '480p'
  maxVideoFps: 15 | 24 | 30;                    // default: 24
  maxSSResolution: '720p' | '1080p' | 'source'; // default: '720p'
  maxSSFps: 5 | 15 | 30 | 60;                  // default: 15
  maxSSBitrate: number;                          // kbps
  maxParticipants: number;                       // default: 25
}

// Speichern:
mx.sendStateEvent(spaceRoomId, 'io.bettercord.space.av_settings', settings, '');
// Lesen:
mx.getStateEvent(spaceRoomId, 'io.bettercord.space.av_settings', '');
```

**Channel-Override** → pro Voice-Channel:
```typescript
// Event Type: 'io.bettercord.channel.av_override'
// State Key: '' (leer)
interface ChannelAVOverride {
  maxSSResolution?: string;
  maxSSFps?: number;
  maxVideoBitrate?: number;
  maxParticipants?: number;
  displayLabel?: string;    // z.B. "Meeting-Raum (Full HD)"
}
```

### 6.3 Jotai Atoms für A/V

**Neue Datei: `src/app/state/avQuality.ts`**
```typescript
import { atom } from 'jotai';

// Geladene Server-Settings
export const spaceAVSettingsAtom = atom<SpaceAVSettings | null>(null);
export const channelAVOverrideAtom = atom<ChannelAVOverride | null>(null);

// Derived: Effektive Werte = min(user, channel ?? space)
export const effectiveAVSettingsAtom = atom((get) => {
  const user = get(settingsAtom);
  const space = get(spaceAVSettingsAtom);
  const channel = get(channelAVOverrideAtom);

  // Channel-Override hat Vorrang vor Space-Settings
  const maxSSRes = channel?.maxSSResolution ?? space?.maxSSResolution ?? 'source';
  const maxSSFps = channel?.maxSSFps ?? space?.maxSSFps ?? 60;

  return {
    ssResolution: clampResolution(user.ssResolution, maxSSRes),
    ssFps: Math.min(user.ssFps, maxSSFps),
    videoResolution: clampResolution(user.videoResolution, space?.maxVideoResolution ?? '1080p'),
    videoFps: Math.min(user.videoFps, space?.maxVideoFps ?? 30),
    audioBitrate: Math.min(user.audioBitrate, space?.maxAudioBitrate ?? 510),
    // Anzeige-Info für den User:
    serverMaxSSResolution: maxSSRes,
    serverMaxSSFps: maxSSFps,
  };
});
```

### 6.4 User Settings UI (neuer Tab)

In `src/app/features/settings/voice-video/`:

```
Einstellungen → Stimme & Video
├── Audio
│   ├── Eingabegerät          [Dropdown — alle Mikrofone]
│   ├── Ausgabegerät          [Dropdown — alle Lautsprecher]
│   ├── Mikrofon-Bitrate      [32 · 64 · 128 · 256 · 510 kbps]
│   ├── Sprachaktivierung     [○ Sprachaktivierung  ◉ Push-to-Talk]
│   ├── Echo-Unterdrückung    [Toggle]
│   ├── Rauschunterdrückung   [Toggle]
│   └── Auto-Gain             [Toggle]
├── Kamera
│   ├── Kamera-Gerät          [Dropdown]
│   ├── Auflösung             [360p · 480p · 720p · 1080p]
│   └── Framerate             [15 · 24 · 30 fps]
└── Bildschirmfreigabe
    ├── Auflösung             [720p · 1080p · Quelle]
    ├── Framerate             [5 · 15 · 30 · 60 fps]
    └── Desktop-Audio         [Toggle]
```

Hinweis unter jedem Slider wenn Server ein Limit gesetzt hat:
> ⚠ Server-Maximum: 720p / 15 fps (Channel: Chill-Zone)

### 6.5 Admin Settings UI

Nur sichtbar wenn `mx.getRoom(spaceId).currentState.maySendStateEvent('io.bettercord.space.av_settings', mx.getUserId())`:

```
Space-Einstellungen → Stimme & Video (Admin)
├── Standard-Qualität (gilt für alle Channels in diesem Space)
│   ├── Max. Audio-Bitrate      [Slider: 32–510 kbps]
│   ├── Max. Video-Auflösung    [360p · 480p · 720p · 1080p]
│   ├── Max. Video-FPS          [15 · 24 · 30]
│   ├── Max. Screenshare-Aufl.  [720p · 1080p · Quelle]
│   ├── Max. Screenshare-FPS    [5 · 15 · 30 · 60]
│   └── Max. Teilnehmer         [Slider: 2–100]
│
├── Channel-Overrides
│   ├── [Channel auswählen ▾]
│   │   ├── Max. Auflösung      [...]
│   │   ├── Max. FPS            [...]
│   │   └── Label               [Textfeld: z.B. "Meeting (HD)"]
│   └── [+ Override hinzufügen]
│
└── [Speichern]  ← mx.sendStateEvent(...)
```

---

## Phase 7 — Settings-Seite Redesign

### Ziel
Settings-Modal aussehen wie Discord/Fluxer: 2-Spalten (Nav links, Content rechts), fullscreen.

```
┌────────────────────────────────────────────────────────────────┐
│  [ESC / ←]                                                     │
│  ┌──────────────────────┬───────────────────────────────────┐  │
│  │ MEIN KONTO           │                                   │  │
│  │ Profil               │   [Aktiver Settings-Inhalt]       │  │
│  │ Datenschutz          │                                   │  │
│  │ Sicherheit           │                                   │  │
│  │                      │                                   │  │
│  │ APP-EINSTELLUNGEN    │                                   │  │
│  │ Erscheinungsbild     │                                   │  │
│  │ Benachrichtigung     │                                   │  │
│  │ Stimme & Video   ←  │                                   │  │
│  │ Barrierefreiheit     │                                   │  │
│  │                      │                                   │  │
│  │ ───────────────────  │                                   │  │
│  │ Abmelden ⚠           │                                   │  │
│  └──────────────────────┴───────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Phase 8 — PWA (Mobile-Support)

### Was bereits da ist ✓
- `vite-plugin-pwa` mit injectManifest-Strategie
- Eigener `src/sw.ts` Service Worker
- `public/manifest.json` mit Icon-Größen
- `display: 'standalone'`

### Was wir ergänzen

**`public/manifest.json` updaten:**
```json
{
  "name": "BetterCord",
  "short_name": "BetterCord",
  "description": "Discord-Look. Matrix-Privatsphäre.",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#4641D9",
  "background_color": "#1E1F22",
  "categories": ["social", "communication"]
}
```

**Mobile Layout (Breakpoint 840px):**
```css
@media (max-width: 840px) {
  /* Guild-Liste + Sidebar kollabiert */
  .guildsLayout { grid-template-columns: 1fr; }
  .guildNavbar { display: none; }  /* per Slide-In-Drawer ersetzt */

  /* Bottom Navigation Bar */
  .mobileBottomNav {
    height: 60px;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    display: flex;
    justify-content: space-around;
    background: var(--background-tertiary);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

**Bottom Navigation Tabs (Mobile):**
- 🏠 Home (Spaces + DMs)
- 🔔 Benachrichtigungen (Inbox)
- 👤 Profil (User-Settings)

**Service Worker Ergänzungen (`src/sw.ts`):**
```typescript
// Precache: App-Shell, Fonts, Icons (automatisch via injectManifest)

// Runtime Cache: Matrix Media
registerRoute(
  ({ url }) => url.pathname.startsWith('/_matrix/media/'),
  new CacheFirst({ cacheName: 'matrix-media', plugins: [
    new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 })
  ]})
);

// Badge API: Unread-Count auf App-Icon
navigator.setAppBadge?.(unreadCount);
```

**iOS PWA Meta-Tags (in `index.html`):**
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="BetterCord">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

---

## Was wir NICHT anfassen (Matrix-Kern)

| Datei | Warum unberührt |
|-------|----------------|
| `src/client/initMatrix.ts` | Matrix-SDK-Init, funktioniert perfekt |
| `src/app/features/call/SmallWidget.ts` | Element Call Bridge — nur URL-Params ergänzen |
| `src/app/features/call/SmallWidgetDriver.ts` | Widget API — komplex, nicht anfassen |
| `src/app/features/call/CallProvider.tsx` | Call-State-Context — bleibt |
| Matrix E2EE Logik | Funktioniert out-of-the-box |
| `vite.config.js` | Nur minimal (Fonts-Alias ggf.) |

---

## Offene Fragen

- [ ] **Matrix Homeserver**: Eigener Synapse/Dendrite oder matrix.org nutzen?
- [ ] **Element Call URL**: Self-hosted (`call.element.io`) oder eigene Instanz?
- [ ] **Domain**: Unter welcher Domain soll BetterCord laufen?
- [ ] **Docker Registry**: GitHub Container Registry (ghcr.io) nutzen?

---

## Schnell-Referenz: Wichtige Dateipfade

| Was | Pfad |
|-----|------|
| Haupt-CSS-Tokens | `src/app/styles/global.css` (neu) |
| App-Root | `src/app/pages/App.tsx` |
| Layout-Root | `src/app/pages/client/ClientLayout.tsx` |
| Element Call Bridge | `src/app/features/call/SmallWidget.ts` |
| Settings State | `src/app/state/settings.ts` |
| A/V Quality State | `src/app/state/avQuality.ts` (neu) |
| Matrix Client | `src/client/initMatrix.ts` |
| Service Worker | `src/sw.ts` |
| PWA Manifest | `public/manifest.json` |
| Vite Config | `vite.config.js` |

---

*BetterCord — Matrix trifft Discord-UI*
*Basis: Cinny (Wally-Fork) | davifernan/BetterCord*
