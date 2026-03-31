# Changelog

All notable changes to mesh are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

---

## [0.2.0] — 2026-03-31 — Public release

First public open-source release.

### Added
- Native LiveKit voice/video calls — no Element Call iframe, no matrix-widget-api dependency
- Matrix RTC (MSC4143) membership management with delayed-event keepalive
- Per-participant E2EE for encrypted rooms via MatrixKeyProvider → LiveKit E2EEManager
- Screenshare with resolution/fps/audio picker (up to 4K source quality)
- Deafen: SFU-level subscription toggle for zero-bandwidth deafen
- Picture-in-Picture (PiP) overlay when navigating away from an active call
- Soundboard with per-clip volume, fade-out, and mic passthrough
- YouTube Together and Spotify Together microapps (Activities)
- Optional Polls and Whiteboard activities (self-hosted Docker containers)
- Presence bridge (Bun + Hono + Redis) for server-side mute/camera/screenshare/deafen state
- AV quality settings: audio bitrate, echo cancellation, noise suppression, auto gain control
- Video quality settings: resolution (360p–1080p), FPS, screenshare resolution/FPS
- Connection quality badge and RTT/Jitter/PacketLoss stats panel
- Cloudflare Tunnel profile for zero-config HTTPS
- Docker Compose multi-profile deployment (livekit, cloudflare, microapps)
- Desktop app (Electron) for macOS, Windows, and Linux
- PWA support — installable on any platform
- Encrypted token storage (AES in localStorage) and OS keychain support in Electron
- Push-to-talk (PTT) with configurable hold key and global shortcut via Electron
- Post-login E2EE setup prompt (SecuritySetupModal) for cross-signing / backup

### Changed
- Forked from [Cinny](https://github.com/cinnyapp/cinny) v4 — full Discord-style layout redesign
- Replaced Element Call iframe with native LiveKit integration
- Service worker no longer registers in development (prevents stale-cache issues)

---

## [0.1.0] — Initial private release

Internal pre-release. Not publicly tagged.

[Unreleased]: https://github.com/davifernan/mesh/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/davifernan/mesh/compare/v0.1.0...v0.2.0
