# BetterCord

> Discord-Look. Matrix-Privatsphäre.

BetterCord ist ein selbst-hostbarer Matrix-Client mit Discord-ähnlicher UX, nativer LiveKit Voice/Video, E2EE und Screenshare.

## Features

- **Matrix-Protokoll** — Vollständig dezentralisiert und föderiert
- **Native LiveKit Voice & Video** — Kein Element Call, direkte Integration
- **End-to-End Verschlüsselung** — Für Nachrichten und Calls
- **Discord-ähnliches Layout** — 3-Spalten mit Spaces, Channels, Chat
- **Screenshare** — Mit System-Audio, bis 4K
- **Desktop App** — Electron mit nativen Features
- **Mobile-optimiert** — Responsive Design

## Self-Hosting

### Docker (empfohlen)

```bash
docker pull ghcr.io/davifernan/bettercord:latest
docker run -p 8080:80 ghcr.io/davifernan/bettercord
```

### Docker Compose

```yaml
services:
  bettercord:
    image: ghcr.io/davifernan/bettercord:latest
    ports:
      - "8080:80"
    volumes:
      - ./config.json:/app/config.json
    restart: unless-stopped
```

### Konfiguration

Kopiere `config.template.json` zu `config.json` und passe die Werte an:

```json
{
  "defaultHomeserver": 0,
  "homeserverList": ["matrix.org"]
}
```

## Development

```bash
# Dependencies installieren
npm install

# Dev-Server starten
npm run dev

# Production Build
npm run build
```

## Desktop App

```bash
cd desktop
npm install
npm run dev    # Development
npm run build  # Production
```

## Lizenz

AGPL-3.0 — Siehe [LICENSE](LICENSE)

## Credits

BetterCord basiert auf [Cinny](https://cinny.in) und nutzt Teile von [Fluxer](https://github.com/nicecord/fluxer).
Wir danken den Original-Autoren für ihre hervorragende Arbeit.
