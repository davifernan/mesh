# mesh Desktop

Electron-Hülle für mesh. Basiert auf `fluxer_desktop` (AGPL-3.0), angepasst für mesh/Matrix.
Lädt die mesh Web-App und ergänzt sie mit nativen OS-Features:
Benachrichtigungen, globale Shortcuts, Screenshare-Picker, Auto-Update, Badges.

---

## ⚠ Offene TODOs — vor erstem Release erledigen

### 1. Domain eintragen (KRITISCH)

In **zwei Dateien** muss `DEINE-DOMAIN.com` durch die echte mesh-Domain ersetzt werden:

**`src/common/Constants.tsx`**
```typescript
// JETZT:
export const STABLE_APP_URL = 'https://DEINE-DOMAIN.com';
export const CANARY_APP_URL = 'https://DEINE-DOMAIN.com';

// ERSETZEN MIT:
export const STABLE_APP_URL = 'https://deine-echte-domain.com';
export const CANARY_APP_URL = 'https://deine-echte-domain.com';
```

**`src/main/Updater.tsx`**
```typescript
// JETZT:
baseUrl: `https://DEINE-DOMAIN.com/dl/desktop/${BUILD_CHANNEL}/...`

// ERSETZEN MIT (Option A — eigener Update-Server):
baseUrl: `https://deine-echte-domain.com/dl/desktop/${BUILD_CHANNEL}/...`

// ERSETZEN MIT (Option B — GitHub Releases nutzen, einfacher):
// updateSource auf { type: UpdateSourceType.ElectronPublicUpdateService, repo: 'davifernan/mesh' }
```

---

### 2. Icons erstellen (KRITISCH)

Der Ordner `build_resources/icons/` muss mit mesh-Icons befüllt werden.
Aktuell sind noch Fluxer-Icons drin — electron-builder bricht sonst beim Build.

Benötigte Dateien:

| Datei | Format | Größe | Verwendet für |
|-------|--------|-------|--------------|
| `_compiled/AppIcon.icns` | ICNS | 1024×1024 | macOS App-Icon |
| `icon.ico` | ICO | 256×256 (multi-size) | Windows App-Icon |
| `icon.png` | PNG | 512×512 | Linux App-Icon |
| `badges/` | PNGs | div. | Windows Taskbar-Badge Overlays |

**Tool-Empfehlung:** https://icon.kitchen — generiert alle Formate aus einem einzigen PNG.

---

### 3. window.electron API in mesh verdrahten (nach Phase 1–8)

Die Electron-Hülle stellt via `preload/index.tsx` eine `window.electron` API bereit.
Die mesh Web-App (`src/`) muss diese API an den folgenden Stellen nutzen:

| Feature | Datei in `src/` | API-Methode | Priorität |
|---------|----------------|-------------|-----------|
| **Screenshare-Picker** | `app/components/voice/ScreenShareSettingsModal/` | `onDisplayMediaRequested()` + `getDesktopSources()` + `selectDisplayMediaSource()` | 🔴 Hoch |
| **Unread Badge** | `app/pages/client/ClientNonUIFeatures.tsx` | `setBadgeCount(count)` | 🟡 Mittel |
| **Push-to-Talk global** | `app/features/settings/voice-video/VoiceSettings.tsx` | `registerGlobalShortcut()` + `onGlobalShortcut()` | 🟡 Mittel |
| **Custom Titlebar** | `app/components/layout/GuildsLayout/` | `windowMinimize()` / `windowMaximize()` / `windowClose()` | 🟡 Mittel |
| **Deep Links** | `app/pages/client/ClientRoot.tsx` | `onDeepLink()` + `getInitialDeepLink()` | 🟡 Mittel |
| **Auto-Update Banner** | `app/components/common/UpdateBanner.tsx` (neu) | `onUpdaterEvent()` + `updaterInstall()` | 🟢 Niedrig |
| **Zoom** | `app/pages/client/ClientRoot.tsx` | `onZoomIn()` / `onZoomOut()` / `onZoomReset()` | 🟢 Niedrig |

**Wichtig:** Immer mit `window.electron?.` (optional chaining) aufrufen —
so funktioniert die App auch im Browser/PWA wenn kein Electron vorhanden ist.

**Typ-Declaration erstellen** damit TypeScript `window.electron` kennt:
```typescript
// src/types/electron.d.ts  ← neue Datei anlegen
// ElectronAPI aus desktop/src/common/Types.tsx importieren/duplizieren
interface Window {
  electron?: import('../../../desktop/src/common/Types').ElectronAPI;
}
```

#### Screenshare im Detail (komplexester Part)

```typescript
// In ScreenShareSettingsModal.tsx:
useEffect(() => {
  if (!window.electron) return; // Browser: normales getDisplayMedia(), nichts tun

  return window.electron.onDisplayMediaRequested(async (requestId, info) => {
    // 1. Verfügbare Fenster/Screens von Electron holen (mit Thumbnails)
    const sources = await window.electron!.getDesktopSources(['screen', 'window'], requestId);
    // 2. Modal öffnen und Sources als Liste anzeigen
    setAvailableSources(sources);
    setElectronRequestId(requestId);
    setModalOpen(true);
  });
}, []);

// Nach User-Auswahl im Modal:
const handleConfirm = (sourceId: string, withAudio: boolean) => {
  window.electron!.selectDisplayMediaSource(electronRequestId, sourceId, withAudio);
  // Electron gibt den Stream jetzt an Element Call weiter
};
```

---

## Konfiguration (User-seitig)

Die Desktop-App liest beim Start optional eine `settings.json` aus dem User-Daten-Verzeichnis.

### Speicherorte

| Platform | Stable | Canary |
|----------|--------|--------|
| Windows | `%APPDATA%\mesh\settings.json` | `%APPDATA%\meshcanary\settings.json` |
| macOS | `~/Library/Application Support/mesh/settings.json` | `~/Library/Application Support/meshcanary/settings.json` |
| Linux | `~/.config/mesh/settings.json` | `~/.config/meshcanary/settings.json` |

### Optionen

| Key | Type | Default | Beschreibung |
|-----|------|---------|-------------|
| `app_url` | string | `STABLE_APP_URL` | Eigene mesh-Instanz laden |

### Beispiel
```json
{
  "app_url": "https://meine-eigene-instanz.de"
}
```

---

## Entwicklung

```bash
# Terminal 1 — Web-App starten
cd ..   # ins mesh/ Root
npm run dev
# → http://localhost:8080

# Terminal 2 — Electron starten
cd desktop
npm install
npm run dev
# → öffnet Electron-Fenster mit localhost:8080
```

## Build & Release

```bash
# macOS (nur auf macOS)
npx electron-builder --mac

# Windows (auf Windows oder via GitHub Actions)
npx electron-builder --win

# Linux
npx electron-builder --linux

# Alle Plattformen automatisch via GitHub Actions:
# git tag v1.0.0 && git push --tags
# → .github/workflows/electron-release.yml übernimmt den Rest
```

## macOS Hinweis (Code-Signing)

Ohne Apple Developer Account ($99/Jahr) erscheint beim ersten Start eine Warnung.
Für private Nutzung: Systemeinstellungen → Datenschutz & Sicherheit → "Trotzdem öffnen".
Für öffentliche Distribution: `CSC_LINK` + `CSC_KEY_PASSWORD` Environment-Variablen setzen.
