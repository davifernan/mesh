# BetterCord — Vision & Kontext für Nilo

> Diese Datei hilft Nilo und seinen Agents zu verstehen was BetterCord ist,
> wohin es geht, und was sinnvoll zu arbeiten ist.

## Was ist BetterCord?

BetterCord ist ein Matrix-Client (Fork von Cinny) mit integriertem Voice/Video via LiveKit.
Ziel: Eine moderne, sichere Messaging-App mit Discord-ähnlichem UX auf Matrix-Basis.

## Vision

**Ziel**: Der beste selbst-gehostete Discord-Ersatz.
Volle Matrix-Kompatibilität + hochwertige Voice/Video-Calls (Matrix RTC + LiveKit)
+ moderne UI die Discord-Nutzern vertraut vorkommt.

## Aktueller Status

- Matrix-Text-Messaging: stabil (Cinny-Basis)
- Voice/Video (Matrix RTC + LiveKit): in Entwicklung, komplex
- Hauptfokus: Call-Stabilität, E2EE korrekt implementieren

## Was Agents hier SOLLEN

- Bugs in der Call/Voice-Implementierung finden (crashes, Verbindungsabbrüche)
- E2EE-Korrektheit prüfen (MatrixKeyProvider → LiveKit E2EEManager)
- Memory Leaks bei Room-Cleanup
- Fehlerbehandlung bei gescheiterten WebRTC-Verbindungen
- TypeScript-Typ-Fehler die zu Runtime-Crashes führen

## Was Agents hier NICHT sollen

- Matrix-Basis-Funktionalität (Chat, Rooms) anfassen — ist von Cinny geerbt
- UI-Redesign oder visuelle Änderungen
- Abhängigkeiten upgraden ohne expliziten Auftrag (matrix-js-sdk und livekit-client
  sind pinned aus gutem Grund — AGENTS.md lesen!)

## Stack

- TypeScript / React
- matrix-js-sdk v38+ (Matrix-Protokoll)
- livekit-client ^2.13 (WebRTC/SFU)
- Vite als Build-Tool

## Wichtige Dateien

- `AGENTS.md` — PFLICHTLEKTÜRE vor Voice/Call-Änderungen
- `src/app/components/voice/` — Voice/Video-Implementierung
- `src/client/` — Matrix-Client-Integration

## Kontakt

Bei Unsicherheit: GitHub Issue mit "nilo-question" Label erstellen.
AGENTS.md ist absolutes Gesetz bei Call-Code.
