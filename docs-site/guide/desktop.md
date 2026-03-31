# Desktop App

mesh has a native desktop app built with Electron for macOS, Windows, and Linux.

## Download

Download the latest release from [GitHub Releases](https://github.com/davifernan/mesh/releases).

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `mesh-x.x.x-mac-arm64.dmg` |
| macOS (Intel) | `mesh-x.x.x-mac-x64.dmg` |
| Windows (x64) | `mesh-x.x.x-win-x64.exe` |
| Windows (arm64) | `mesh-x.x.x-win-arm64.exe` |

## Installation

### macOS

::: warning App not signed
mesh is not signed or notarized with an Apple Developer certificate. macOS will block it. Follow the steps below to open it anyway.
:::

1. Download the `.dmg` for your architecture (arm64 for Apple Silicon, x64 for Intel)
2. Open the `.dmg` and drag `mesh.app` to your Applications folder
3. Open Terminal and run:

```bash
xattr -cr /Applications/mesh.app
```

4. Open mesh normally from Applications or Spotlight

::: tip Why does this work?
`xattr -cr` removes the macOS quarantine attribute that's added to all downloaded files. Without a paid Apple Developer certificate, this is the only way to run unsigned apps on macOS 13+.
:::

### Windows

::: warning SmartScreen warning
Windows SmartScreen may show *"Windows protected your PC"* because the app is not yet code-signed.
:::

1. Download the `.exe` installer
2. If SmartScreen appears, click **"More info"** → **"Run anyway"**
3. Follow the installer

## Features

The desktop app adds several features on top of the web version:

- **Push-to-Talk** — Configure a hold key for PTT. Works even when the window is in the background via a global shortcut.
- **OS Keychain** — Access token is stored in the macOS Keychain or Windows DPAPI instead of localStorage.
- **System notifications** — Native OS notifications for messages and calls.
- **Badge count** — Unread count in the dock/taskbar.
- **Call popout** — Open voice calls in a separate native window.
- **Deep links** — `mesh://` URL scheme for invite links and room navigation.

## Development

```bash
# Start the web app first
npm run dev

# In a second terminal, build and launch Electron
cd desktop
npm install
npm run dev
```

The desktop app connects to `http://localhost:8080` in dev mode.
