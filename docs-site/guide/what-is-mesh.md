# What is mesh?

mesh is a **self-hosted, privacy-first Discord alternative** built on the [Matrix](https://matrix.org) protocol.

It gives you a familiar Discord-style interface — spaces, channels, voice/video calls, screenshare, reactions, threads — but with full ownership of your data and infrastructure.

## How it's built

mesh is a fork of [Cinny](https://github.com/cinnyapp/cinny) — a clean Matrix client — with a complete Discord-style redesign and native LiveKit voice/video integration replacing the Element Call dependency.

```
mesh (one app, no iframe)
│
├── matrix-js-sdk     — Matrix protocol, E2EE, MatrixRTC memberships
├── livekit-client    — WebRTC/SFU voice & video
└── bridge/           — Server-side LiveKit → presence state (Bun + Hono)
```

## What makes it different

| Feature | mesh | Discord | Element |
|---|---|---|---|
| Self-hosted | ✅ | ❌ | ✅ |
| E2EE calls | ✅ | ❌ | ✅ |
| Open source | ✅ | ❌ | ✅ |
| Discord-style UI | ✅ | ✅ | ❌ |
| No iframe for calls | ✅ | — | ❌ |
| Native LiveKit | ✅ | — | ❌ |

## Privacy model

- **E2EE scope:** Message content and call media (audio/video frames) are encrypted in private rooms. Public rooms don't support E2EE — this is a Matrix protocol limitation.
- **Metadata:** Call membership events (who joins/leaves) are Matrix state events and cannot currently be encrypted. Your homeserver operator can see participation metadata.
- **SFU routing:** Voice and video go through a LiveKit SFU. With E2EE enabled, the SFU forwards encrypted frames it cannot decrypt.

For maximum privacy: use encrypted rooms and self-host both your Matrix homeserver and LiveKit instance.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, vanilla-extract |
| Matrix | matrix-js-sdk v38 |
| Voice/Video | livekit-client v2 |
| State | Jotai |
| Presence bridge | Bun + Hono |
| Deployment | Docker + nginx |
| Desktop | Electron |
