# BetterCord — Element Call Fork Plan

> **Ziel:** Element Call forken, UI vollständig an BetterCord anpassen,
> selbst hosten und in BetterCord einbinden.
> **Repo:** https://github.com/davifernan/BetterCord-Call (privat, später open source)
> **Basis:** https://github.com/element-hq/element-call

---

## Warum einen eigenen EC-Fork?

Aktuell läuft Element Call als iframe — wir haben nur begrenzten Einfluss aufs UI.
Mit einem eigenen Fork haben wir:

| Feature | Ohne Fork (postMessage) | Mit Fork (direkt) |
|---------|------------------------|-------------------|
| Speaking Indicator | Komplex, via postMessage | Direkt in EC einbauen |
| Verbindungsstatistiken | Via postMessage rausholen | Direkt in EC UI |
| Eigene Farben/Icons | Nicht möglich | Vollständige Kontrolle |
| BetterCord Design-System | Nicht möglich | CSS Variables aus BetterCord übernehmen |
| Eigene Controls (Mute etc.) | Teilweise via Widget API | Direkt ersetzen |
| Rauschunterdrückung Toggle | Via URL-Param | Direkt als Button |
| Qualitäts-Settings | Via URL-Param | Direkt in UI |

---

## Architektur

```
BetterCord Web-App
    ↓ iframe lädt
BetterCord-Call (eigener EC-Fork)
    hosted auf: call.deine-domain.com
    oder: lokal gebundled in public/element-call/

Kommunikation: Matrix Widget API (bleibt unverändert)
WebRTC/E2EE: LiveKit + Matrix RTC (bleibt unverändert — nicht anfassen!)
```

**Was wir anfassen:** Nur das React-Frontend von Element Call.
**Was wir NICHT anfassen:** LiveKit, WebRTC, E2EE, Matrix RTC Protokoll.

---

## Element Call Tech-Stack (was uns erwartet)

| Was | Technologie |
|-----|-------------|
| Framework | React 18 |
| Build | Vite |
| State | Jotai (gleich wie BetterCord!) |
| Styling | CSS Modules + CSS Custom Properties |
| Icons | Compound Icons (Element Design System) |
| Voice/Video | LiveKit Client SDK |
| Matrix | matrix-js-sdk + Matrix RTC |
| E2EE | Per-Participant E2EE via Matrix |

Gute Nachricht: Jotai kennen wir bereits aus BetterCord.

---

## Was wir am EC-UI ändern wollen

### Visuell (höchste Priorität)
- [ ] BetterCord CSS Custom Properties einbauen (gleiche Farben, Fonts, Spacing)
- [ ] IBM Plex Sans + IBM Plex Mono statt Element-Fonts
- [ ] Phosphor Icons statt Compound Icons
- [ ] Dark Theme als Standard (passend zu BetterCord `#313338`)
- [ ] Participant-Tiles: Fluxer-Style (abgerundete Kacheln, Name unten links)
- [ ] Control-Bar unten: Fluxer-Style (Mute, Cam, Screen, Disconnect)
- [ ] Speaking Indicator: grüner Glow-Ring direkt auf Kachel + Avatar

### Funktional
- [ ] Speaking Indicator — grüner Border wenn jemand spricht (LiveKit hat `isSpeaking` nativ!)
- [ ] Verbindungsstatistiken Panel direkt in EC (RTCPeerConnection.getStats())
- [ ] Rauschunterdrückung Toggle direkt als Button in der Control-Bar
- [ ] Qualitäts-Settings direkt in EC UI (Resolution, FPS, Bitrate)
- [ ] Screenshare Settings Modal (Fluxer-Style, wie in PLAN.md Phase 10 beschrieben)
- [ ] "Watching" Mode UI wenn man einem Stream zuschaut

### Entfernen
- [ ] Element-eigenes Branding (Logo, "Powered by Element" etc.)
- [ ] EC's eigener Header (bereits via `header=none` URL-Param versteckt)
- [ ] EC's eigene Settings-Seite (wir haben unsere eigene in BetterCord)
- [ ] EC's Lobby-Screen (bereits via `skipLobby=true` übersprungen)

---

## Speaking Indicator — warum mit Fork viel einfacher

Ohne Fork müssen wir:
```
LiveKit (in EC) → postMessage → BetterCord → State-Atom → RoomNavUser
```
Kompliziert, verzögert, fragil.

Mit Fork direkt in EC:
```typescript
// LiveKit hat isSpeaking nativ auf dem Participant-Objekt:
const { isSpeaking } = useParticipantInfo({ participant });

// Direkt als CSS-Klasse:
<div className={clsx(styles.tile, { [styles.speaking]: isSpeaking })}>
```

```css
/* EC CSS — Speaking Glow */
.speaking {
  outline: 2px solid #23a55a;
  outline-offset: 2px;
  box-shadow: 0 0 12px rgba(35, 165, 90, 0.4);
}
```

**3 Zeilen Code statt komplexer postMessage-Infrastruktur.**

---

## Deployment-Optionen

### Option A — Selbst gehostet (empfohlen)
```
BetterCord-Call Fork → bauen → deployen auf call.deine-domain.com
BetterCord config.json: { "elementCallUrl": "https://call.deine-domain.com" }
```

Vorteile:
- Unabhängig von Element's Servern
- Eigene Updates wann wir wollen
- Volle Kontrolle

### Option B — Lokal gebundled (einfacher)
```
BetterCord-Call Fork bauen → dist/ nach BetterCord/public/element-call/ kopieren
```

Vorteile:
- Kein extra Server nötig
- Alles in einem Repo

Nachteil:
- BetterCord-Repo wird größer
- Updates müssen manuell rüberkopiert werden

### Empfehlung: Option A für Production, Option B für Development

---

## Implementierungs-Reihenfolge

```
Schritt 1  →  Fork + Setup + lokaler Build             ~1 Tag
Schritt 2  →  BetterCord Design-System einbauen        ~2 Tage
Schritt 3  →  Speaking Indicator                       ~1 Tag
Schritt 4  →  Control-Bar Redesign (Fluxer-Style)      ~2 Tage
Schritt 5  →  Participant-Tiles Redesign               ~2 Tage
Schritt 6  →  Verbindungsstatistiken Panel             ~1 Tag
Schritt 7  →  Rauschunterdrückung + Qualitäts-Toggle   ~1 Tag
Schritt 8  →  Screenshare Settings Modal               ~2 Tage
Schritt 9  →  Deployment + BetterCord einbinden        ~1 Tag
────────────────────────────────────────────────────────────
Gesamt     →  ~13 Arbeitstage / ~2.5 Wochen
```

---

## Schritt 1 — Fork + Setup

```bash
# Element Call forken auf GitHub: davifernan/BetterCord-Call
git clone https://github.com/davifernan/BetterCord-Call.git
cd BetterCord-Call
npm install
npm run dev
# → http://localhost:8081
```

In BetterCord `config.json` für Development:
```json
{
  "elementCallUrl": "http://localhost:8081"
}
```

---

## Schritt 2 — BetterCord Design-System einbauen

Element Call nutzt CSS Custom Properties — genau wie wir.
Unsere `global.css` Tokens aus BetterCord in EC's CSS einbauen:

```css
/* src/styles/global.css in EC-Fork */
:root {
  /* Von BetterCord übernehmen: */
  --background-primary: #313338;
  --background-secondary: #2B2D31;
  --background-tertiary: #1E1F22;
  --text-primary: #DBDEE1;
  --brand-primary: #4641D9;
  --status-online: #23a55a;

  /* Fonts */
  --font-sans: 'IBM Plex Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}
```

---

## Schritt 3 — Speaking Indicator

```
Datei: src/components/videoTile/VideoTile.tsx (oder ähnlich in EC)
```

```typescript
import { useParticipantInfo } from '@livekit/components-react';

const { isSpeaking } = useParticipantInfo({ participant });

return (
  <div className={clsx(styles.tile, { [styles.speaking]: isSpeaking })}>
    {/* Tile Inhalt */}
  </div>
);
```

```css
/* VideoTile.module.css */
.speaking {
  outline: 2px solid #23a55a;
  outline-offset: 2px;
  box-shadow: 0 0 12px rgba(35, 165, 90, 0.35);
  transition: outline 100ms ease, box-shadow 100ms ease;
}
```

Auch in der Sidebar von BetterCord (`RoomNavUser.tsx`) — aber dort via
postMessage da EC und BetterCord getrennte Kontexte sind:
```typescript
// EC sendet isSpeaking Events an BetterCord:
window.parent.postMessage({
  type: 'io.bettercord.speaking',
  userId: localParticipant.identity,
  speaking: isSpeaking
}, parentOrigin);
```

---

## Schritt 4 — Control-Bar Redesign

Aktuell hat EC eine eigene Control-Bar. Wir ersetzen sie durch Fluxer-Style:

```
Vorher (EC default):
[🎙] [📹] [🖥] [⚙] [📞✕]

Nachher (BetterCord/Fluxer-Style):
[🎙 Mute] [🔇 Deaf] [📹 Cam] [🖥 Screen] [⚙ Settings] [📞✕ Disconnect]
```

- Buttons: 36×36px, `border-radius: var(--radius-md)`
- Disconnect: rot (`#f23f43`), immer
- Mute active: rot-transparent Hintergrund
- Phosphor Icons: `Microphone`, `MicrophoneSlash`, `VideoCamera`, `VideoCameraSlash`, `MonitorArrowUp`, `GearSix`, `PhoneDisconnect`

---

## Schritt 5 — Participant-Tiles Redesign

```
Vorher (EC default): rechteckige Kacheln, Name mittig

Nachher (BetterCord/Fluxer-Style):
┌─────────────────────┐
│                     │
│   [Avatar / Video]  │
│                     │
│ 👤 Username    🎙   │  ← Name unten links, Mic-Status unten rechts
└─────────────────────┘
  ← grüner Glow wenn spricht →
```

---

## Schritt 6 — Verbindungsstatistiken Panel

```typescript
// Direkt RTCPeerConnection.getStats() aufrufen:
const stats = await peerConnection.getStats();

// Aus den Stats extrahieren:
const audioSend = findStat(stats, 'outbound-rtp', 'audio')?.bytesSent;
const packetLoss = findStat(stats, 'remote-inbound-rtp')?.fractionLost;
const rtt = findStat(stats, 'remote-inbound-rtp')?.roundTripTime * 1000; // ms
```

Panel öffnet sich via postMessage-Command von BetterCord:
```typescript
// BetterCord → EC:
iframe.contentWindow.postMessage({
  type: 'io.bettercord.toggle_stats'
}, ecOrigin);
```

---

## Schritt 7 — Rauschunterdrückung Toggle

LiveKit hat Noise Suppression nativ:
```typescript
import { useLocalParticipant } from '@livekit/components-react';

const { localParticipant } = useLocalParticipant();

const toggleNoiseSuppression = async (enabled: boolean) => {
  await localParticipant.setMicrophoneEnabled(true, {
    noiseSuppression: enabled,
    echoCancellation: true,
    autoGainControl: true,
  });
};
```

Button direkt in der Control-Bar — kein Umweg über Settings nötig.

---

## Schritt 8 — Screenshare Settings Modal

Vor dem Screenshare-Start öffnet sich das Modal (Fluxer-Style):
```
[480p] [720p ✓] [1080p] [Quelle]
[5fps] [15fps] [30fps ✓] [60fps]
[Audio teilen: Toggle]
[Abbrechen] [Freigabe starten]
```

```typescript
// LiveKit Screenshare mit Quality-Settings:
await localParticipant.setScreenShareEnabled(true, {
  resolution: { width: 1280, height: 720 },
  frameRate: 30,
  audio: includeAudio,
});
```

---

## Schritt 9 — Deployment + BetterCord einbinden

### Self-hosted
```bash
# In BetterCord-Call:
npm run build
# → dist/ deployen auf call.deine-domain.com

# In BetterCord config.json:
{ "elementCallUrl": "https://call.deine-domain.com" }
```

### Docker (für Server-Deployment)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

```yaml
# docker-compose.yml auf dem Server:
services:
  bettercord:
    image: ghcr.io/davifernan/bettercord:latest
    ports: ["3000:80"]

  bettercord-call:
    image: ghcr.io/davifernan/bettercord-call:latest
    ports: ["3001:80"]
```

---

## Was wir NICHT anfassen (niemals!)

| Was | Warum |
|-----|-------|
| LiveKit Server-Logik | WebRTC Infrastruktur — zu komplex, nicht nötig |
| Matrix RTC (`m.call.member` Events) | Protokoll-Standard — funktioniert |
| E2EE Implementierung | Sicherheitskritisch — nicht anfassen |
| Widget API Handshake | Kommunikation mit BetterCord — funktioniert |
| `matrix-js-sdk` calls in EC | Matrix-Standard — nicht ändern |

---

## Offene Fragen

- [ ] Eigenes GitHub Repo: `davifernan/BetterCord-Call`?
- [ ] Self-hosted oder lokal gebundled?
- [ ] LiveKit Server: eigener oder Element's `livekit.element.io`?
  - Eigener LiveKit: volle Kontrolle, aber extra Server
  - Element's LiveKit: einfacher, aber Abhängigkeit von Element

---

*BetterCord-Call — Element Call Fork für BetterCord*
*Basis: element-hq/element-call | davifernan/BetterCord-Call*
