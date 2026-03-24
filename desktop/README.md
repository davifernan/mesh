# mesh Desktop

Electron wrapper for the mesh web app. Adds native OS capabilities on top of the web interface:
system notifications, global shortcuts, screen share picker, auto-update, and taskbar/dock badges.

Based on [Fluxer Desktop](https://github.com/FluxerApp/Fluxer) (AGPL-3.0), adapted for mesh/Matrix.

> **Status: Pre-release.** The desktop app is functional for development. A few items need to be
> completed before shipping distributable packages — see [Known Gaps](#known-gaps).

---

## Requirements

- Node.js 18+
- npm

---

## Development

```bash
# Terminal 1 — start the mesh web app
cd ..        # mesh/ root
npm install
npm run dev  # → http://localhost:8080

# Terminal 2 — start Electron
cd desktop
npm install
npm run dev  # → opens Electron window pointing at localhost:8080
```

---

## Build

```bash
cd desktop

# macOS (must be run on macOS)
npx electron-builder --mac

# Windows (on Windows or via GitHub Actions)
npx electron-builder --win

# Linux
npx electron-builder --linux
```

Releases for all platforms are built automatically via GitHub Actions when a tag is pushed:

```bash
git tag v0.1.0 && git push --tags
# → .github/workflows/electron-release.yml handles the rest
```

---

## User Configuration

The desktop app reads an optional `settings.json` from the platform user-data directory at startup.

### Locations

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\mesh\settings.json` |
| macOS | `~/Library/Application Support/mesh/settings.json` |
| Linux | `~/.config/mesh/settings.json` |

### Options

| Key | Type | Description |
|-----|------|-------------|
| `app_url` | string | Load a custom mesh instance instead of the built-in URL |

### Example

```json
{
  "app_url": "https://your-mesh-instance.example.com"
}
```

---

## macOS Code Signing

Without an Apple Developer account, Gatekeeper shows a warning on first launch.

- **Personal use:** System Preferences → Privacy & Security → "Open Anyway"
- **Public distribution:** Set `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables before building

---

## Packaging

Distribution package specs live in [`packaging/`](packaging/):

- [`packaging/winget/`](packaging/winget/) — Windows Package Manager
- [`packaging/homebrew/`](packaging/homebrew/) — Homebrew (macOS/Linux)
- [`packaging/aur/`](packaging/aur/) — Arch User Repository
- [`packaging/linux/`](packaging/linux/) — deb/rpm

---

## Known Gaps

These items must be completed before the first public desktop release:

**App URL** — `src/common/Constants.tsx` and `src/main/Updater.tsx` contain placeholder domain
values (`DEINE-DOMAIN.com`) that must be replaced with the actual hosted mesh URL.

**App icons** — `build_resources/icons/` currently contains placeholder icons from the upstream
Fluxer project. mesh-branded icons are needed before building distributable packages:

| File | Format | Size | Used for |
|------|--------|------|----------|
| `_compiled/AppIcon.icns` | ICNS | 1024×1024 | macOS |
| `icon.ico` | ICO | 256×256 multi-size | Windows |
| `icon.png` | PNG | 512×512 | Linux |

Tool recommendation: [icon.kitchen](https://icon.kitchen) — generates all formats from a single PNG.

**Native API wiring** — The `window.electron` API (exposed by `preload/index.tsx`) is not yet
consumed by the mesh web app for screen share picker, push-to-talk global shortcut, deep links,
and auto-update banner. The web app uses `window.electron?.` optional chaining everywhere, so it
degrades gracefully in browser/PWA mode until these are wired up.
