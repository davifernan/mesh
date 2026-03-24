# Contributing to mesh

Thanks for taking the time to contribute!

All types of contributions are encouraged and valued. Please read the relevant section before contributing — it makes the process smoother for everyone.

> If you like the project but don't have time to contribute, that's fine too. You can support it by starring the repo, mentioning it to friends, or using it for your community.

---

## Development Setup

> **This is for contributors who want to run mesh from source.**
> If you just want to self-host mesh for your community, see [DEPLOY.md](DEPLOY.md) instead — that guide uses pre-built Docker images and doesn't require Node.js.

### Prerequisites

- Node.js 20+ and npm
- A Matrix account on any homeserver (e.g. `matrix.org`)
- Optional: [Bun](https://bun.sh) for running the presence bridge locally

### 1. Clone and install

```bash
git clone https://github.com/davifernan/mesh.git
cd mesh
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in at minimum:

```env
# Required for GIF picker — get a free key at developers.giphy.com
VITE_GIPHY_API_KEY=your_key_here
```

Everything else has sensible defaults for local development.

### 3. Start the web app

```bash
npm run dev
# → http://localhost:8080
```

The app connects to whichever Matrix homeserver you log in with. `matrix.org` works out of the box.

### 4. Start the presence bridge (optional)

The presence bridge tracks call state (mute/camera/deafen badges in the sidebar). You only need it if you are working on voice/call features.

```bash
cd bridge
bun install

# You also need a local LiveKit instance — start it via Docker:
cd ..
docker compose --profile livekit up -d livekit

# Then start the bridge:
cd bridge
LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=devsecret bun run dev
# → http://localhost:3001
```

Dev LiveKit credentials (`devkey` / `devsecret`) match the defaults in `.env.example` and `contrib/livekit/livekit.yaml`.

### 5. Desktop app (optional)

```bash
# In a second terminal, while npm run dev is already running:
cd desktop
npm install
npm run dev
# → opens Electron window pointing at localhost:8080
```

### Verify everything works

```bash
npm run typecheck   # TypeScript — zero errors expected
npm run lint        # ESLint
```

> **Before touching voice/call code:** read [AGENTS.md](AGENTS.md) — it documents critical rules and known pitfalls for the Matrix RTC + LiveKit layer.

---

## Bug reports

Bug reports and feature suggestions must use descriptive and concise titles and be submitted to [GitHub Issues](https://github.com/davifernan/mesh/issues). Please use the search function to make sure that you are not submitting duplicates, and that a similar report or request has not already been resolved or rejected.

## Pull requests

> ### Legal Notice
> When contributing to this project, you must agree that you have authored 100% of the content, that you have the necessary rights to the content and that the content you contribute may be provided under the project license.

**NOTE: If you want to add new features, please discuss with maintainers before coding or opening a pull request.** This is to ensure that we are on same track and following our roadmap.

**Please use clean, concise titles for your pull requests.** We use commit squashing, so the final commit in the dev branch will carry the title of the pull request. For easier sorting in changelog, start your pull request titles using one of the verbs "Add", "Change", "Remove", or "Fix" (present tense).

Example:

|Not ideal|Better|
|---|----|
|Fixed markAllAsRead in RoomTimeline|Fix read marker when paginating room timeline|

It is not always possible to phrase every change in such a manner, but it is desired.

**The smaller the set of changes in the pull request is, the quicker it can be reviewed and merged.** Splitting tasks into multiple smaller pull requests is often preferable.

Also, we use [ESLint](https://eslint.org/) for clean and stylistically consistent code syntax, so make sure your pull request follow it.

**For any query or design discussion, open a [GitHub Discussion](https://github.com/davifernan/mesh/discussions).**

## Helpful links
- [BEM methodology](http://getbem.com/introduction/)
- [Atomic design](https://bradfrost.com/blog/post/atomic-web-design/)
- [Matrix JavaScript SDK documentation](https://matrix-org.github.io/matrix-js-sdk/index.html)
