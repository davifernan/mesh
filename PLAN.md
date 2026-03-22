# mesh — Entwicklungsplan

> **Basis:** Cinny-Fork — Matrix + E2EE vorhanden, Voice-Layer jetzt nativ via MatrixRTC + LiveKit in mesh
> **Ziel:** Fluxer/Discord UI 1:1, mit Admin-seitigen A/V-Quality-Controls + PWA
> **Repo:** https://github.com/davifernan/mesh (privat)

---

## Was ist mesh?

Ein Matrix-Client der **aussieht wie Discord/Fluxer**, aber auf **Matrix** (E2EE, dezentral, self-hosted) basiert.

- **Frontend:** Fluxer UI — 1:1 das Discord-artige Aussehen (Squircle-Icons, Dark Theme, IBM Plex Font, etc.)
- **Backend:** Matrix-Protokoll via `matrix-js-sdk` (E2EE, Spaces, Rooms)
- **Calls:** Element Call (bereits integriert) mit eigenem Voice-UI-Layer
- **Mobile:** Vollwertige PWA (installierbar, offline-fähig, Push Notifications)
- **A/V-Qualität:** Admin setzt Maxima, User steuert innerhalb dieser Grenzen

---

## Kurzübersicht Tech-Stack

| Was | Aktuell (Cinny) | Nach Umbau (mesh) |
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
git push → GitHub (privates Repo: davifernan/mesh)
    ↓
Server: git pull && docker-compose up -d
```

### Schnellstart lokal
```bash
git clone https://github.com/davifernan/mesh.git
cd mesh
npm install
npm run dev
# → http://localhost:8080
```

### Docker auf dem Server
```bash
# Einmalig:
git clone https://github.com/davifernan/mesh.git
cd mesh

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
Phase 9  →  Electron Desktop App             ~5 Tage
Phase 10 →  Community Features               ~8 Tage
────────────────────────────────────────────────────
Gesamt   →  ~43 Arbeitstage / ~9 Wochen
```

---

## Phase 1 — Projekt-Setup & Rename

### Ziel
Cinny in mesh umbenennen, Dependencies für Fluxer-UI installieren.

### Aufgaben
- [ ] `package.json`: `name` → `"mesh"`
- [ ] `public/manifest.json`: `name` → `"mesh"`, `short_name` → `"mesh"`, `theme_color` → `"#4641D9"`, `background_color` → `"#1E1F22"`
- [ ] `index.html`: `<title>mesh</title>`
- [ ] `config.json`: App-Name anpassen
- [ ] Dependencies installieren:
  ```bash
  npm install @phosphor-icons/react
  npm install @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
  ```
- [ ] Alte Cinny-Icons in `public/` durch mesh-Icons ersetzen (optional: Discord-ähnliches Icon)

---

## Phase 2 — Design System (CSS Custom Properties)

### Ziel
Fluxer's komplettes CSS-Token-System in mesh einbauen. Das ist die Grundlage für ALLES andere.

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
### Nachher (mesh): Fluxer 3-Spalten-Layout

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
// Event Type: 'io.mesh.space.av_settings'
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
mx.sendStateEvent(spaceRoomId, 'io.mesh.space.av_settings', settings, '');
// Lesen:
mx.getStateEvent(spaceRoomId, 'io.mesh.space.av_settings', '');
```

**Channel-Override** → pro Voice-Channel:
```typescript
// Event Type: 'io.mesh.channel.av_override'
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

Nur sichtbar wenn `mx.getRoom(spaceId).currentState.maySendStateEvent('io.mesh.space.av_settings', mx.getUserId())`:

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
  "name": "mesh",
  "short_name": "mesh",
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
<meta name="apple-mobile-web-app-title" content="mesh">
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
- [ ] **Domain**: Unter welcher Domain soll mesh laufen?
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

---

## Phase 9 — Electron Desktop App

### Ziel
mesh als native Desktop-App für Windows, macOS und Linux ausliefern.
Basis: `fluxer/fluxer_desktop/` — fast 1:1 kopieren, nur umbenennen + mesh-spezifische
Anpassungen vornehmen.

### Strategie
PWA zuerst fertigstellen (Phase 1–8), dann Electron drüberziehen.
Electron lädt einfach die fertige mesh Web-App als URL — kein Umbau der App nötig.

```
mesh Web-App (dist/)
        ↓
Electron lädt: https://deine-domain.com  (Prod)
               http://localhost:8080      (Dev)
        ↓
Fertige Desktop-App für Windows / macOS / Linux
```

### Output-Formate (via electron-builder)

| Platform | Format | Architektur |
|----------|--------|-------------|
| macOS | `.dmg` + `.zip` | x64 (Intel) + arm64 (Apple Silicon) |
| Windows | `.exe` NSIS Installer | x64 + arm64 |
| Linux | `.AppImage` + `.deb` + `.rpm` | x64 + arm64 |

---

### 9.1 Ordnerstruktur

```
mesh/
├── src/                    ← Web-App (Phasen 1–8, bleibt unverändert)
├── desktop/                ← NEU: Electron-Hülle (kopiert von fluxer_desktop)
│   ├── src/
│   │   ├── main/
│   │   │   ├── index.tsx           ← Electron Entry Point
│   │   │   ├── Window.tsx          ← BrowserWindow + Screenshare Handler
│   │   │   ├── IpcHandlers.tsx     ← IPC-Bridge (angepasst)
│   │   │   ├── Autostart.tsx       ← Autostart beim OS-Login
│   │   │   ├── DeepLinks.tsx       ← mesh:// URL-Schema
│   │   │   ├── GlobalKeyHook.tsx   ← Push-to-Talk global (auch ohne Fokus)
│   │   │   ├── Menu.tsx            ← macOS Menübar
│   │   │   ├── Updater.tsx         ← Auto-Update
│   │   │   ├── Spellcheck.tsx      ← Rechtschreibprüfung
│   │   │   └── WindowsBadge.tsx    ← Windows Taskbar Unread-Badge
│   │   ├── preload/
│   │   │   └── index.tsx           ← window.electron API Bridge
│   │   └── common/
│   │       ├── Constants.tsx       ← URLs + App-Konstanten
│   │       ├── DesktopConfig.tsx   ← settings.json Verwaltung
│   │       ├── Types.tsx           ← ElectronAPI TypeScript-Typen
│   │       ├── BuildChannel.tsx    ← stable / canary
│   │       └── Logger.tsx          ← electron-log Wrapper
│   ├── build_resources/
│   │   ├── icons/
│   │   │   ├── AppIcon.icns        ← macOS Icon
│   │   │   ├── icon.ico            ← Windows Icon
│   │   │   └── icon.png            ← Linux Icon
│   │   └── entitlements.mac.plist  ← macOS Kamera/Mic Berechtigungen
│   ├── electron-builder.config.cjs ← Build-Konfiguration
│   └── package.json
```

---

### 9.2 Änderungen gegenüber fluxer_desktop

#### `desktop/src/common/Constants.tsx` — 3 Zeilen ändern
```typescript
// VORHER (Fluxer):
export const APP_PROTOCOL = 'fluxer';
export const STABLE_APP_URL = 'https://web.fluxer.app';
export const CANARY_APP_URL = 'https://web.canary.fluxer.app';

// NACHHER (mesh):
export const APP_PROTOCOL = 'mesh';
export const STABLE_APP_URL = 'https://DEINE-DOMAIN.com';   // ← deine URL eintragen
export const CANARY_APP_URL = 'https://DEINE-DOMAIN.com';   // vorerst gleich wie stable
```

#### `desktop/electron-builder.config.cjs` — Umbenennen
```javascript
// VORHER:
const productName = 'Fluxer';
const appId = 'app.fluxer';
const packageName = 'fluxer_desktop';

// NACHHER:
const productName = 'mesh';
const appId = 'com.mesh.app';
const packageName = 'mesh';

// squirrelWindows.iconUrl auf eigene Domain anpassen:
iconUrl: 'https://DEINE-DOMAIN.com/icons/icon.ico',

// macOS Info.plist Texte anpassen:
extendInfo: {
  NSMicrophoneUsageDescription: 'mesh needs microphone access for voice chat.',
  NSCameraUsageDescription: 'mesh needs camera access for video calls.',
  NSAppleEventsUsageDescription: 'mesh needs Apple Events for automation.',
},
```

#### `desktop/src/main/IpcHandlers.tsx` — 1 Funktion entfernen
```typescript
// DIESE FUNKTION LÖSCHEN — prüft ob /.well-known/fluxer existiert,
// das gibt's bei Matrix/mesh nicht:
async function assertValidFluxerInstance(instanceOrigin: string) { ... }

// Den Aufruf in 'switch-instance-url' Handler ebenfalls entfernen:
// await assertValidFluxerInstance(instanceOrigin);  ← weg
```

#### `desktop/src/main/Window.tsx` — trustedWebOrigins anpassen
```typescript
// VORHER: nur Fluxer-URLs sind trusted
const trustedWebOrigins = new Set([STABLE_APP_URL, CANARY_APP_URL].map(...));

// Das bleibt so — wird automatisch korrekt wenn Constants.tsx geändert wurde.
// Sicherheitsmechanismus bleibt erhalten: nur deine Domain darf IPC nutzen.
```

---

### 9.3 mesh Web-App: Electron API verdrahten

Die `preload/index.tsx` exposed `window.electron` — mesh muss diese API
an den richtigen Stellen nutzen. Das sind die Stellen die **nach Phase 9 implementiert
werden müssen** damit die Desktop-Features funktionieren:

#### ⚠ Screenshare-Picker (WICHTIG — ohne das kein nativer Screenshare)

In Electron kann `getDisplayMedia()` nicht direkt aus dem Renderer aufgerufen werden.
Fluxer löst das über IPC: Electron fragt welche Fenster/Screens verfügbar sind,
zeigt einen nativen Picker, und gibt die Source zurück.

**Was fehlt in mesh nach dem Kopieren:**
- Die Web-App muss auf `window.electron.onDisplayMediaRequested()` hören
- Wenn Electron den Screenshare-Request abfängt, muss mesh einen Picker zeigen
- Nach Auswahl: `window.electron.selectDisplayMediaSource(requestId, sourceId, withAudio)`

**Wo das implementiert werden muss:**
```
src/app/components/voice/ScreenShareSettingsModal/ScreenShareSettingsModal.tsx
```

```typescript
// Pseudocode — in ScreenShareSettingsModal einbauen:
useEffect(() => {
  if (!window.electron) return;  // Im Browser: normales getDisplayMedia()

  // Electron-spezifisch: auf Display-Media-Request hören
  const cleanup = window.electron.onDisplayMediaRequested(async (requestId, info) => {
    // 1. Desktop-Sources von Electron holen (Fenster + Screens mit Thumbnails)
    const sources = await window.electron.getDesktopSources(
      ['screen', 'window'],
      requestId
    );

    // 2. Unseren eigenen Picker zeigen (mit Thumbnails, Qualitätsauswahl)
    //    → das ist die ScreenShareSettingsModal UI
    setAvailableSources(sources);
    setRequestId(requestId);
    setIsOpen(true);
  });

  return cleanup;
}, []);

// Nach User-Auswahl:
const handleConfirm = (sourceId: string, withAudio: boolean) => {
  window.electron.selectDisplayMediaSource(requestId, sourceId, withAudio);
  // → Electron gibt den Stream an Element Call weiter
};
```

**Im Browser (kein Electron):** normales `getDisplayMedia()` via Element Call — bleibt unverändert.

#### Badge-Count (Unread-Notifications auf App-Icon)
```
src/app/pages/client/ClientNonUIFeatures.tsx  ← hier implementieren
```
```typescript
// Wenn sich Unread-Count ändert:
useEffect(() => {
  window.electron?.setBadgeCount(totalUnreadCount);
}, [totalUnreadCount]);
```

#### Push-to-Talk global (auch wenn App nicht im Fokus)
```
src/app/features/settings/voice-video/VoiceSettings.tsx  ← PTT-Keybind registrieren
```
```typescript
// Wenn User PTT-Taste setzt:
const setPTTKey = async (accelerator: string) => {
  if (window.electron) {
    await window.electron.registerGlobalShortcut(accelerator, 'push-to-talk');
  }
};

// Auf PTT-Event hören:
useEffect(() => {
  if (!window.electron) return;
  return window.electron.onGlobalShortcut((id) => {
    if (id === 'push-to-talk') activateMicrophone();
  });
}, []);
```

#### Auto-Update Benachrichtigung
```
src/app/components/common/UpdateBanner.tsx  ← NEU erstellen
```
```typescript
useEffect(() => {
  if (!window.electron) return;
  return window.electron.onUpdaterEvent((event) => {
    if (event.type === 'update-downloaded') {
      showToast('Update verfügbar — jetzt neu starten?', {
        action: () => window.electron.updaterInstall()
      });
    }
  });
}, []);
```

#### Zoom (Ctrl+/Ctrl-)
```
src/app/pages/client/ClientRoot.tsx  ← bereits passende Stelle
```
```typescript
useEffect(() => {
  if (!window.electron) return;
  const cleanups = [
    window.electron.onZoomIn(() => adjustZoom(+0.1)),
    window.electron.onZoomOut(() => adjustZoom(-0.1)),
    window.electron.onZoomReset(() => resetZoom()),
  ];
  return () => cleanups.forEach(fn => fn());
}, []);
```

#### Deep Links (`mesh://invite/xyz`)
```
src/app/pages/client/ClientRoot.tsx
```
```typescript
useEffect(() => {
  if (!window.electron) return;
  return window.electron.onDeepLink((url) => {
    // mesh://invite/ABC → /invite/ABC Route navigieren
    const path = url.replace('mesh://', '/');
    navigate(path);
  });
}, []);
```

---

### 9.4 TypeScript: `window.electron` Typen in mesh bekannt machen

```typescript
// src/types/electron.d.ts  ← neue Datei
// Die ElectronAPI Types aus desktop/src/common/Types.tsx importieren/duplizieren

interface Window {
  electron?: ElectronAPI;  // optional — undefined wenn im Browser
}
```

So kann überall `window.electron?.setBadgeCount(n)` safe aufgerufen werden
ohne dass der Browser-Build bricht.

---

### 9.5 Entwicklungs-Workflow mit Electron

```bash
# Terminal 1: Web-App starten
npm run dev
# → http://localhost:8080

# Terminal 2: Electron starten (lädt localhost:8080)
cd desktop
npm run dev
# → Electron-Fenster öffnet sich mit der lokalen Web-App
```

Im Electron-Dev-Modus wird `http://localhost:8080` geladen statt der Produktions-URL.

```typescript
// desktop/src/common/DesktopConfig.tsx — Dev-Mode:
export function getAppUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8080';   // lokaler Vite-Dev-Server
  }
  return STABLE_APP_URL;             // Produktions-URL
}
```

---

### 9.6 Build & Release

```bash
# Im desktop/ Ordner:

# macOS (nur auf macOS buildbar):
npm run build
npx electron-builder --mac

# Windows (auf Windows ODER via GitHub Actions):
npx electron-builder --win

# Linux:
npx electron-builder --linux

# Alle Plattformen via GitHub Actions (empfohlen):
# → .github/workflows/electron-release.yml erstellen
```

**GitHub Actions Release-Workflow:**
```yaml
# .github/workflows/electron-release.yml
name: Electron Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: desktop
      - run: npx electron-builder
        working-directory: desktop
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/upload-artifact@v4
        with:
          name: mesh-${{ matrix.os }}
          path: desktop/dist-electron/
```

Ein `git tag v1.0.0 && git push --tags` triggert automatisch den Build
für alle 3 Plattformen und legt die Installer als GitHub Release Assets ab.

---

### 9.7 macOS Code-Signing (optional, für private Nutzung nicht nötig)

Ohne Apple Developer Account ($99/Jahr) erscheint beim ersten Start:
> "mesh kann nicht geöffnet werden, weil Apple es nicht auf Schadsoftware prüfen konnte."

**Lösung für private Nutzung:** User muss einmalig in
Systemeinstellungen → Datenschutz & Sicherheit → "Trotzdem öffnen" klicken.

**Für öffentliche Distribution:** Apple Developer Account + Code-Signing-Zertifikat nötig.
electron-builder unterstützt das via `CSC_LINK` + `CSC_KEY_PASSWORD` Environment-Variablen.

---

### 9.8 Checkliste Phase 9

#### Setup (Basis — ~30 Minuten)
- [ ] `fluxer/fluxer_desktop/` nach `mesh/desktop/` kopieren
- [ ] `Constants.tsx`: `APP_PROTOCOL`, `STABLE_APP_URL`, `CANARY_APP_URL` anpassen
- [ ] `electron-builder.config.cjs`: `productName`, `appId`, `packageName` anpassen
- [ ] `IpcHandlers.tsx`: `assertValidFluxerInstance()` entfernen
- [ ] Icons erstellen: `AppIcon.icns`, `icon.ico`, `icon.png`
- [ ] `desktop/package.json`: Name auf `mesh` ändern
- [ ] Dev-Modus testen: `npm run dev` in beiden Terminals

#### mesh Web-App verdrahten (~3–4 Tage)
- [ ] `src/types/electron.d.ts` erstellen (`window.electron` Typ-Declaration)
- [ ] **Screenshare-Picker** in `ScreenShareSettingsModal.tsx` implementieren
  - [ ] `window.electron.onDisplayMediaRequested()` listener
  - [ ] `window.electron.getDesktopSources()` aufrufen (mit Thumbnails)
  - [ ] Picker-UI mit Source-Thumbnails (Fenster/Screen-Liste)
  - [ ] `window.electron.selectDisplayMediaSource()` bei Bestätigung
  - [ ] Fallback auf normales `getDisplayMedia()` wenn kein Electron
- [ ] **Badge-Count** in `ClientNonUIFeatures.tsx` implementieren
  - [ ] Unread-Count aus Matrix-State lesen
  - [ ] `window.electron.setBadgeCount(count)` aufrufen
  - [ ] macOS Dock Badge + Windows Taskbar Badge
- [ ] **Push-to-Talk global** in `VoiceSettings.tsx` implementieren
  - [ ] Keybind-Auswahl UI (Taste aufnehmen)
  - [ ] `window.electron.registerGlobalShortcut()` aufrufen
  - [ ] `window.electron.onGlobalShortcut()` → Mikrofon aktivieren/deaktivieren
- [ ] **Deep Links** in `ClientRoot.tsx` implementieren
  - [ ] `mesh://invite/CODE` → Invite-Flow
  - [ ] `mesh://room/ROOM_ID` → direkt in Room navigieren
- [ ] **Auto-Update Banner** (`UpdateBanner.tsx`) erstellen
  - [ ] `window.electron.onUpdaterEvent()` hören
  - [ ] Toast/Banner bei verfügbarem Update zeigen
  - [ ] "Jetzt installieren" → `window.electron.updaterInstall()`
- [ ] **Zoom** in `ClientRoot.tsx` verdrahten
  - [ ] `onZoomIn` / `onZoomOut` / `onZoomReset` listeners
- [ ] **Custom Titlebar** im Web-App-Layout
  - [ ] Wenn `window.electron` vorhanden: eigene Titelleiste rendern
  - [ ] Minimize / Maximize / Close Buttons verdrahten
  - [ ] macOS: Traffic Light Buttons Platz lassen (paddingLeft)
  - [ ] Windows/Linux: eigene Minimize/Maximize/Close Buttons

#### Release
- [ ] `desktop/` Ordner in GitHub Repo committen
- [ ] GitHub Actions Workflow `.github/workflows/electron-release.yml` erstellen
- [ ] Ersten Release-Tag setzen: `git tag v0.1.0 && git push --tags`
- [ ] Installer auf allen 3 Plattformen testen

---

---

## Phase 10 — Community Features

### Ziel
Discord-Features die in Cinny fehlen oder nur halb implementiert sind.
Cinny hat bereits eine solide Basis — wir bauen drauf auf statt von null.

---

### Was Cinny bereits hat ✓ (nicht neu bauen!)

| Feature | Datei | Status |
|---------|-------|--------|
| Teilnehmer-Liste unter Voice-Channel (Avatar + Name) | `src/app/features/room-nav/RoomNavItem.tsx` + `RoomNavUser.tsx` | ✓ fertig |
| Reaktiver Hook für Call-Mitglieder (`useCallMemberships`) | `src/app/hooks/useCallMemberships.ts` | ✓ fertig |
| "X in Call" Aria-Label | `RoomNavItem.tsx` L325 | ✓ fertig |
| Aktiver Call Status-Bar unten in Sidebar | `src/app/features/room-nav/RoomCallNavStatus.tsx` | ✓ fertig |
| Eingehender Call Ring + Dismiss UI | `RoomCallNavStatus.tsx` L304–401 | ✓ fertig |

**Fazit:** Avatar + Name unter Voice-Channel ist bereits da. Wir müssen nur die fehlenden Status-Icons und das LIVE-Badge drauf setzen.

---

### 10.1 Voice Channel — Status-Icons + LIVE Badge

#### Was fehlt (auf `RoomNavUser.tsx` aufbauen)

Aktuell zeigt `RoomNavUser` nur Avatar + Name. Folgendes ergänzen:

```
🔊 Gaming
   👤 davifernan                  ← bereits da ✓
   👤 anna         🎥 LIVE        ← LIVE Badge fehlt ✗
   👤 max          🔇             ← Mute-Icon fehlt ✗
```

Hover über LIVE Badge:
```
┌──────────────────────────────┐
│  anna streamt gerade         │
│  [▶ Stream ansehen]          │
└──────────────────────────────┘
```

#### Was zu ändern ist

**`src/app/features/room-nav/RoomNavUser.tsx` erweitern:**
```typescript
// CallMembership hat bereits feeds[] — daraus LIVE-Status ableiten:
const isLive = callMembership.feeds?.some(f => f.purpose === 'm.screenshare');
const isMuted = !callMembership.feeds?.some(f => f.purpose === 'm.usermedia');

// Im JSX ergänzen:
{isMuted && <Icon src={Icons.MicMute} size="200" />}
{isLive && <LiveBadge onClick={handleWatchStream} />}
```

**Neue Komponente: `LiveBadge.tsx`**
- Animiertes rotes Badge (pulsierend wie Discord)
- Hover-Tooltip: "Stream ansehen"
- Klick: Element Call öffnen als Viewer

#### Guild-Icon Badge (ganz links)
Wenn in irgendeinem Voice-Channel des Space jemand sitzt:
```
[Space Icon]
   🔊  ← kleines Badge unten rechts
```

**Neues Atom: `src/app/state/voiceActivity.ts`**
```typescript
// Derived von existierendem useCallMemberships — pro Space aggregieren
export const spaceHasVoiceActivityAtom = atomFamily((spaceId: string) =>
  atom((get) => {
    // alle Child-Rooms des Space checken ob jemand im Call sitzt
  })
);
```

**`GuildVoiceActivityBadge.tsx`** — kleines 🔊 Icon auf dem Space-Icon in der linken Spalte.

---

### 10.2 Member-Liste rechts (wer ist online)

Komplett neu — existiert in Cinny nicht.

```
ONLINE — 3
👤 davifernan    ● [Admin]
👤 anna          ●

OFFLINE — 12
👤 bob           ○
```

#### Matrix-Technisch
```typescript
const members = room.getJoinedMembers();
const presence = mx.getUser(userId)?.presence; // 'online' | 'offline' | 'unavailable'
const powerLevel = room.getMember(userId)?.powerLevel; // 100 = Admin, 50 = Mod
```

#### Neue Komponenten
```
src/app/components/MemberList/
├── MemberList.tsx           ← rechte Sidebar (240px)
├── MemberListGroup.tsx      ← "ONLINE — 3" Header
├── MemberListItem.tsx       ← Avatar + Name + Status-Dot + Rolle-Badge
└── MemberListItem.module.css
```

#### Verhalten
- Toggle Button im Channel-Header (People-Icon)
- Breite: 240px, schiebt Main-Content zusammen (kein Overlay)
- Mobile: ausgeblendet
- Presence alle 60s aktualisiert

---

### 10.3 Community Lobby + Welcome Channel

#### Lobby-Chat
Erster pinned Channel `#lobby` pro Space:
- Normal schreibbar für alle Mitglieder
- Per `m.space.child` mit `order: "00"` ganz oben gelistet
- Kein Custom-Backend nötig — normaler Matrix-Raum

#### Welcome Channel
Read-only `#welcome` Channel mit automatischen Join-Nachrichten:

```
─────── März 2026 ───────
🎉  anna hat die Community betreten
🎉  max hat die Community betreten
```

```typescript
// m.room.member join-Events als WelcomeCard rendern statt als normale Nachricht:
if (event.getType() === 'm.room.member' && event.getContent().membership === 'join') {
  return <WelcomeCard member={event.getSender()} />;
}
```

#### Space-Lobby Screen
Wenn Space-Icon geklickt aber kein Channel ausgewählt:
```
┌─────────────────────────────────────────────────────────────┐
│  [Space Banner]                                             │
│  Community Name · 👥 42 Mitglieder · 🟢 8 Online           │
│─────────────────────────────────────────────────────────────│
│  TEXT CHANNELS          VOICE CHANNELS                      │
│  # lobby                🔊 Gaming                          │
│  # general              🔊 Chill                           │
└─────────────────────────────────────────────────────────────┘
```

#### Neue Komponenten
```
src/app/components/
├── LobbyView/
│   ├── LobbyView.tsx          ← Space-Übersicht Screen
│   ├── SpaceBanner.tsx        ← Icon + Name + Stats
│   └── SpaceChannelGrid.tsx   ← Channels als Kacheln
└── WelcomeCard/
    └── WelcomeCard.tsx        ← "🎉 anna hat die Community betreten"
```

---

### 10.5 Checkliste Phase 10

#### "Im Call sein" Anzeige (Voice Connected Bar)
- [x] `RoomCallNavStatus.tsx` — grüner "Voice Connected" Bar unten in Sidebar ✓ bereits da
- [x] Roter Hang-Up Button + Mute/Video Buttons ✓ bereits da
- [x] Incoming Call Ring + Dismiss ✓ bereits da
- [ ] **Layout-Check:** sicherstellen dass der Bar nach Phase 3 (GuildsLayout Umbau) noch sichtbar ist und nicht vom neuen Layout überdeckt wird — `z-index` + `position` prüfen
- [ ] Bar ans neue Fluxer-Design anpassen (CSS, Farben, Fonts)
- [ ] **Hang-Up Button** — immer rot (`#f23f43`) wenn man im Call ist (auch im Idle-Zustand)
- [ ] **Join-Call Button** (der Button um einem Voice-Channel beizutreten) — on hover grün (`#23a55a`) werden, default neutral/transparent

#### Voice Connected Bar Redesign (nach Fluxer-Vorbild, Bild 4)
Aktueller Cinny-Bar muss komplett nach Fluxer-Design umgebaut werden:

```
┌─────────────────────────────────────────┐
│ 📶 Sprache verbunden          [📊] [📞✕] │  ← grüner Text, Sound-Icon + roter Hangup
│ General / arbeitsfreunder               │  ← Channel / Space Name klein darunter
│ 🖥 koi-alsephina                        │  ← wer noch im Call ist
│ 〰                                       │  ← Wellenform-Icon (spricht gerade)
│ ┌──────────────┐  ┌──────────────┐      │
│ │  📷 (Cam)   │  │  🖥 (Screen) │      │  ← zwei große quadratische Buttons
│ └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────┤
│ [Avatar] LuncerStinka    🎙  🔊  ⚙     │  ← User-Area: Mic + Lautsprecher + Settings
│          Online                         │
└─────────────────────────────────────────┘
```

Details:
- "Sprache verbunden" Text → grün (`#23a55a`), mit WiFi/Signal Icon davor
- Rechts oben: Sound-Waves Icon (öffnet Sound-Settings) + roter Hang-Up Button
- Channel-Name + Space-Name als kleiner muted Link darunter
- Wer noch im Call ist: kleine Avatar-Zeile mit Namen
- Zwei große quadratische Buttons: Kamera toggle + Screenshare toggle
- User-Area unten: Avatar + Name + Status + Mic + Lautsprecher + Settings Icons
- Icons: Phosphor Icons (wie Fluxer) — `Microphone`, `SpeakerHigh`, `GearSix`, `PhoneDisconnect`, `MonitorArrowUp`, `VideoCamera`

#### Verbindungsstatistiken Panel (Bild 1 + 2)
Das 📊 Icon (Sound-Waves) im Voice Connected Bar öffnet ein Popup mit Live-Stats:

```
┌─ Verbindungsstatistiken ──────── ✕ ┐
│                                    │
│  Dauer              0:58           │
│  Teilnehmer         1              │
│                                    │
│  🎙 Audio                          │
│  Senden             2 kbps         │
│  Empfangen          0 kbps         │
│  Paketverlust       0%   ← grün    │
│                                    │
│  📹 Video                          │
│  Senden             0 kbps         │
│  Empfangen          0 kbps         │
│  Paketverlust       0%   ← grün    │
│                                    │
│  🔄 Netzwerk                       │
│  Latenz (RTT)       14 ms ← grün   │
│  Jitter             0 ms           │
│                                    │
│  Statistiken werden jede Sekunde   │
│  aktualisiert                      │
└────────────────────────────────────┘
```

Farbcodierung der Werte (wie Fluxer):
- Grün: Paketverlust < 2%, Latenz < 100ms — alles gut
- Gelb: Paketverlust 2–5%, Latenz 100–200ms — Warnung
- Rot: Paketverlust > 5%, Latenz > 200ms — kritisch

Datenquelle: Element Call Widget API via `postMessage` — EC sendet regelmäßig WebRTC Stats.
Alternativ: `RTCPeerConnection.getStats()` direkt abfragen wenn EC das exposed.

- [ ] `ConnectionStatsPanel.tsx` — Popup-Panel mit Live-Stats
- [ ] 📊 Button im Voice Connected Bar öffnet/schließt das Panel (Toggle)
- [ ] Stats via `postMessage` von Element Call empfangen (jede Sekunde)
- [ ] Farbcodierung: grün/gelb/rot basierend auf Schwellenwerten
- [ ] Dauer-Timer (läuft seit Call-Beitritt)
- [ ] Teilnehmer-Count

#### Rauschunterdrückung Toggle im Voice Connected Bar
Schneller Toggle direkt im Bar — ohne in die Settings gehen zu müssen:

```
[🎙 Rauschunterdrückung: AN]  ← Button/Toggle im Bar oder Kontext-Menü
```

- [ ] Toggle-Button für Rauschunterdrückung im Voice Connected Bar
- [ ] State aus `settingsAtom.noiseSuppression` lesen/schreiben
- [ ] Visuelles Feedback: Icon ändert sich (aktiv/inaktiv)
- [ ] Wert wird an Element Call via URL-Param übergeben beim nächsten Call-Start
- [ ] Alternativ: im Kontext-Menü des Mic-Buttons (Rechtsklick auf Mic-Icon)

#### Speaking Indicator (grüner Glow wenn jemand spricht)
Nie implementiert — muss komplett neu gebaut werden.

**Das Problem:** Audio-Level sitzt im Element Call iframe, nicht in Cinny.
**Die Lösung:** Element Call sendet Speaker-Events via `postMessage` Widget API → wir hören zu und speichern wer gerade spricht.

```typescript
// In CallProvider.tsx — postMessage listener ergänzen:
window.addEventListener('message', (e) => {
  if (e.data?.type === 'io.element.call.notify_speak') {
    // { userId: string, speaking: boolean }
    setSpeakingUsers(prev => {
      const next = new Set(prev);
      e.data.speaking ? next.add(e.data.userId) : next.delete(e.data.userId);
      return next;
    });
  }
});

// Atom:
export const speakingUsersAtom = atom<Set<string>>(new Set());
```

**Wo der Glow angezeigt wird:**

1. **In der Sidebar** (`RoomNavUser.tsx`) — grüner Ring um Avatar wenn User spricht:
```css
.speakingRing {
  outline: 2px solid #23a55a;
  outline-offset: 2px;
  border-radius: 50%;
}
```

2. **Im Call selbst** (`CallViewUser.tsx`) — grüner Glow um die Kachel:
```css
.speakingTile {
  box-shadow: 0 0 0 2px #23a55a;
}
```

- [ ] `postMessage` listener in `CallProvider.tsx` für `io.element.call.notify_speak`
- [ ] `speakingUsersAtom` — Jotai Set mit aktuell sprechenden UserIds
- [ ] Speaking-Ring in `RoomNavUser.tsx` (Sidebar Avatar)
- [ ] Speaking-Glow in `CallViewUser.tsx` (Call-Kachel)
- [ ] Sanfte CSS Transition (fade in/out, nicht hart)

#### Voice Channel Sidebar (nach Fluxer-Vorbild, Bild 3)

Fluxer-Sidebar für Voice Channels sieht so aus:
```
Voice Channels          [+] [⚙] [▾]
🔊 General                   [👤+] [⚙]
```
- Kategorie-Header "Voice Channels" mit + und ⚙ Icon rechts (nur on hover sichtbar)
- Channel-Zeile: Lautsprecher-Icon + Name + hover: [👤+] [⚙] Icons rechts
- Kein überladenes UI — clean und minimal wie Fluxer

- [x] `m.call.member` State Events auslesen → `useCallMemberships.ts` ✓ bereits da
- [x] Teilnehmer-Liste unter Voice-Channel (Avatar + Name) → `RoomNavUser.tsx` ✓ bereits da
- [ ] Kategorie-Header Hover-Aktionen (+ Channel, ⚙ Settings) nach Fluxer-Style
- [ ] Voice-Channel Zeile Hover: [👤+] (Einladen) + [⚙] (Settings) Icons rechts
- [ ] Mute-Icon pro Teilnehmer in `RoomNavUser.tsx` ergänzen (`feeds` auslesen)
- [ ] LIVE Badge in `RoomNavUser.tsx` ergänzen (screenshare feed detection)
- [ ] `LiveBadge.tsx` — animiertes pulsierendes rotes Badge
- [ ] Hover-Tooltip auf LIVE Badge: "Stream ansehen"
- [ ] `GuildVoiceActivityBadge.tsx` — 🔊 auf Space-Icon wenn jemand im Voice sitzt
- [ ] `spaceHasVoiceActivityAtom` — Jotai Atom pro Space aggregiert

#### Auto-Join beim Klick auf Voice Channel (wie Discord/Fluxer)
Aktuell: Cinny zeigt erst einen "Beitreten"-Dialog mit Kamera/Mic-Auswahl → nervt.
Ziel: Klick auf Voice Channel → direkt beitreten, genau wie Discord/Fluxer.

```
Aktuell:  Klick → Modal "Möchtest du beitreten?" → Bestätigen → Call startet
Neu:      Klick → Call startet sofort (mit letzten Einstellungen)
```

Wo das geändert wird:
- `src/app/features/room-nav/RoomNavItem.tsx` — Join-Button Handler
- `src/app/features/call/CallView.tsx` — Pre-Join Screen entfernen/überspringen
- Mic/Cam-State aus `settingsAtom` nehmen (letzter Stand) statt jedes Mal fragen

- [ ] Pre-Join Modal/Screen in `CallView.tsx` entfernen
- [ ] Voice-Channel Klick → direkt `joinCall()` aufrufen
- [ ] Ersten Beitritt: Mic standardmäßig AN, Kamera standardmäßig AUS (wie Discord)
- [ ] Einstellungen werden aus `settingsAtom` geladen (letzter Stand)

#### Screenshare Modal (nach Fluxer-Vorbild, Bild 1)
Fluxer's Modal sieht so aus:
```
┌─ Bildschirmfreigabe-Einstellungen ──────── ✕ ┐
│                                               │
│  Videoqualität                                │
│  [480p] [720p ✓] [👑 1080p] [👑 1440p] [👑 4K]│
│                                               │
│  Bildrate                                     │
│  [15 FPS] [24 FPS] [30 FPS ✓] [👑 60 FPS]    │
│                                               │
│  Audio teilen                    [Toggle]     │
│  Ton des Bildschirms einbinden                │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ 👑 Schalte HD-Video mit [Name] frei     │  │
│  │ Höhere Auflösungen + 60 FPS freischalten│  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  [Abbrechen]          [Freigabe starten →]    │
└───────────────────────────────────────────────┘
```

Details:
- Qualitäts-Optionen als Toggle-Buttons (nicht Dropdown)
- Premium-Optionen (1080p+, 60fps) mit 👑 Icon + ausgegraut (für später)
- Audio-Toggle mit schönem Switch
- Upgrade-Banner für Premium-Features (für spätere Monetarisierung optional)
- Buttons: "Abbrechen" neutral + "Freigabe starten" brand-blau (`#4641D9`)
- Werte werden geclamped auf Server-Maximum (Phase 6)

- [ ] `ScreenShareSettingsModal.tsx` nach Fluxer-Design bauen (Toggle-Buttons statt Dropdowns)
- [ ] Qualitäts-Optionen: 480p / 720p / 1080p / Quelle als visuelle Buttons
- [ ] FPS-Optionen: 5 / 15 / 30 / 60 als visuelle Buttons
- [ ] Audio-Toggle Switch
- [ ] Premium-Badge (👑) auf gesperrten Optionen (visuell, keine echte Paywall)
- [ ] "Freigabe starten" Button → öffnet nativen Screen-Picker (oder Electron-Picker)

#### LIVE Stream ansehen
- [ ] Klick auf LIVE Badge → Element Call als Viewer öffnen
- [ ] "Stream ansehen" Hover-Button unter Voice-Channel wenn Stream aktiv

#### Member-Liste
- [ ] `MemberList.tsx` — rechte Sidebar (240px)
- [ ] `MemberListGroup.tsx` — ONLINE / OFFLINE Gruppen-Header
- [ ] `MemberListItem.tsx` — Avatar + Name + Status-Dot + Rolle-Badge
- [ ] Toggle Button im Channel-Header (People-Icon)
- [ ] Mobile: ausgeblendet

#### Community Lobby
- [ ] `LobbyView.tsx` — Space-Übersicht Screen (wenn kein Channel gewählt)
- [ ] `SpaceBanner.tsx` — Icon + Name + Beschreibung + Mitglieder-Count
- [ ] `SpaceChannelGrid.tsx` — alle Channels als Kacheln
- [ ] `#lobby` Raum automatisch als erster Channel anlegen (`order: "00"`)

#### Welcome Channel
- [ ] `#welcome` Raum (read-only für normale Mitglieder)
- [ ] `m.room.member` join-Events als `WelcomeCard` rendern statt als Systemnachricht
- [ ] `WelcomeCard.tsx` — Avatar + "🎉 [Name] hat die Community betreten"
- [ ] Datum-Trenner zwischen verschiedenen Tagen

---

*mesh — Matrix trifft Discord-UI*
*Basis: Cinny-Fork | davifernan/mesh*
