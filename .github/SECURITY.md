# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` branch (latest) | Yes |
| Older tagged releases | Best-effort |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately via GitHub Security Advisories:

**https://github.com/davifernan/mesh/security/advisories/new**

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce, or a proof-of-concept
- Affected version(s) or commit hash
- Any suggested mitigations (optional)

## Response Timeline

| Step | Target |
|------|--------|
| Acknowledgement | Within 72 hours |
| Initial assessment | Within 7 days |
| Fix / coordinated disclosure | Depends on severity |

We prefer coordinated disclosure. Please give us reasonable time to address the issue before making it public.

## Scope

**In scope:**
- mesh frontend (`src/`)
- Presence bridge (`bridge/`)
- Electron desktop app (`desktop/`)
- Docker / deployment configuration

**Out of scope:**
- Vulnerabilities in third-party dependencies — please report those upstream
- The Matrix homeserver you are running (not part of this project)
- LiveKit server — please report to [LiveKit](https://github.com/livekit/livekit/security)
- Upstream projects (Cinny, Fluxer, Element Call)
