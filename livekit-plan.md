# Vollständiger Implementierungsplan
## Kontext aus beiden Plan-Dateien
**PLAN.md Phase 5+6 — was vollständig implementiert wird:**
- Audio: audioBitrate (64/128/256/510 kbps), echoCancellation, noiseSuppression, autoGainControl
- Video: videoResolution (360p/480p/720p/1080p), videoFps (15/24/30)
- Screenshare: ssResolution (720p/1080p/1440p/4k/source), ssFps (5/15/30/60/120), ssAudio
- Speaking Indicator: grüner Glow (#23A55A) direkt via `participant.isSpeaking`
- Stats Panel: RTT, Jitter, PacketLoss, FPS, Resolution, Bitrate (RTCPeerConnection.getStats())
- Noise Suppression Toggle in Control Bar
- Screenshare Quality Modal vor jedem Share-Start
**PLAN_ELEMENT_CALL.md — was wir jetzt NATIVE machen statt postMessage:**
- Speaking Indicator: direkt `useParticipantInfo({ participant }).isSpeaking` → kein postMessage
- Control Bar: direkte LiveKit Calls statt Widget Actions
- Stats Panel: direkt in BetterCord, kein Toggle via postMessage mehr
- Participant Tiles: Fluxer-Style (Name unten-links, Mic-Status unten-rechts)
---
Dateistruktur (alle neu/geändert)
BetterCord/
├── AGENTS.md                                          ← NEU (Regeln + Learnings)
│
├── src/app/
│   ├── atoms/
│   │   └── avQualityAtom.ts                          ← NEU (~150 Zeilen)
│   │
│   ├── features/call/
│   │   ├── avPresets.ts                              ← NEU (~250 Zeilen, aus BC-Call ports)
│   │   ├── sfuToken.ts                               ← NEU (~120 Zeilen)
│   │   ├── matrixKeyProvider.ts                      ← NEU (~80 Zeilen, E2EE bridge)
│   │   ├── nativeCallEngine.ts                       ← NEU (~450 Zeilen, Hauptlogik)
│   │   ├── SmallWidget.ts                            ← LÖSCHEN
│   │   └── SmallWidgetDriver.ts                      ← LÖSCHEN
│   │
│   └── pages/client/call/
│       ├── CallProvider.tsx                          ← UMBAU (~300 Zeilen, war 588)
│       ├── PersistentCallContainer.tsx               ← UMBAU (~100 Zeilen, iframe raus)
│       ├── NativeCallView.tsx                        ← NEU (~280 Zeilen)
│       ├── NativeCallParticipantGrid.tsx             ← NEU (~200 Zeilen)
│       ├── NativeCallParticipantTile.tsx             ← NEU (~180 Zeilen)
│       ├── NativeCallControlBar.tsx                  ← NEU (~250 Zeilen)
│       ├── ScreenShareQualityModal.tsx               ← NEU (~220 Zeilen, aus BC-Call port)
│       └── BCStatsPanel.tsx                          ← NEU (~200 Zeilen, aus BC-Call port)
│
└── package.json                                      ← Update (add livekit, remove embedded)
---
Phase 1 — Cleanup & Setup (30 Min, keine Logic)
BC-Call:
cd BetterCord-Call
git checkout main          # zurück zu main
git branch -D main-clean   # main-clean war Zwischenschritt, weg damit
git reset --hard 00f88010  # reset auf upstream
git push --force-with-lease origin main
BetterCord package.json:
// HINZUFÜGEN:
"livekit-client": "^2.13.0",
"@livekit/components-react": "^2.0.0",
"@livekit/components-core": "^0.12.0"
// ENTFERNEN aus devDependencies:
"@element-hq/element-call-embedded": "0.16.3"
vite.config.ts — E2EE Worker Support:
Der E2EE Worker muss als inline worker gebundelt werden. Prüfen ob Vite worker config nötig.
---
Phase 2 — avQualityAtom.ts (Jotai State für alle Quality-Settings)
Datei: src/app/atoms/avQualityAtom.ts
// Alle Settings aus PLAN.md Phase 6 als persistierte Jotai Atoms:
// Audio
audioBitrateAtom: atomWithStorage('bc_audioBitrate', 64)  // 64|128|256|510 kbps
echoCancellationAtom: atomWithStorage('bc_echoCancellation', true)
noiseSuppressionAtom: atomWithStorage('bc_noiseSuppression', true)
autoGainControlAtom: atomWithStorage('bc_autoGainControl', true)
// Video (Kamera)
videoResolutionAtom: atomWithStorage('bc_videoResolution', '720p')  // '360p'|'480p'|'720p'|'1080p'
videoFpsAtom: atomWithStorage('bc_videoFps', 24)  // 15|24|30
// Screenshare
ssResolutionAtom: atomWithStorage('bc_ssResolution', '1080p')  // '720p'|'1080p'|'1440p'|'4k'|'source'
ssFpsAtom: atomWithStorage('bc_ssFps', 30)  // 5|15|30|60|120
ssAudioAtom: atomWithStorage('bc_ssAudio', true)
// Derived: liest alle und gibt zusammengefasstes Objekt zurück
avSettingsAtom: atom(get => ({ audioBitrate, echoCancellation, ... }))
---
Phase 3 — avPresets.ts (AV Quality Presets, aus BC-Call portiert)
Datei: src/app/features/call/avPresets.ts
Exakter Port aus BC-Call's options.ts — ohne die Defaults-Änderungen (adaptiveStream bleibt upstream):
// Presets:
export const ScreenSharePresets1080p = { h1080fps15, h1080fps30, h1080fps60, h1080fps120 }
export const ScreenSharePresets1440p = { h1440fps15, h1440fps30, h1440fps60, h1440fps120 }
export const ScreenSharePresets4K    = { h2160fps15, h2160fps30, h2160fps60, h2160fps120 }
// Mapping-Funktionen:
export function resolutionToVideoPreset(res?: string): VideoPreset
export function resolutionToSSPreset(res?: string, fps?: number): VideoPreset
export function bitrateToAudioPreset(kbps?: number): AudioPreset
export function getSimulcastLayers(res?: string): VideoPreset[]
// LiveKit Room Options (UPSTREAM DEFAULTS - adaptiveStream: true, dynacast: true IMMER!)
export function buildLiveKitRoomOptions(avSettings: AVSettings, keyProvider?: BaseKeyProvider): RoomOptions
WICHTIG: adaptiveStream: true, dynacast: true — niemals ändern. Nur publishDefaults mit den Quality-Settings überschreiben.
---
Phase 4 — sfuToken.ts (LiveKit JWT holen)
Datei: src/app/features/call/sfuToken.ts
Port aus BC-Call's openIDSFU.ts — vereinfacht, nur was wir brauchen:
export interface SFUConfig {
  url: string;        // LiveKit WebSocket URL
  jwt: string;        // JWT Token für LiveKit
  livekitAlias: string;
}
// Flow:
// 1. mx.getOpenIdToken() → IOpenIDToken
// 2. POST {serviceUrl}/sfu/get mit { matrix_server_name, openid_token, device_id, room_id }
// 3. Response: { url, jwt, livekit_alias }
export async function getSFUConfigWithOpenID(
  mx: MatrixClient,
  membershipIdentity: CallMembershipIdentityParts,
  serviceUrl: string,
  roomId: string,
): Promise<SFUConfig>
// Hilfsfunktion: Focus URL aus Room State lesen
export function getLivekitFocusFromRoom(room: Room): string | null
  // Liest: room.getLiveTimeline().getState()
  //   .getStateEvents('org.matrix.msc3401.call', '')
  //   ?.getContent()?.foci_preferred?.[0]?.livekit_service_url
---
Phase 5 — matrixKeyProvider.ts (E2EE Bridge)
Datei: src/app/features/call/matrixKeyProvider.ts
Direkter Port aus BC-Call's e2ee/matrixKeyProvider.ts — nur ~80 Zeilen:
import { BaseKeyProvider } from 'livekit-client';
import { MatrixRTCSession, MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc';
export class MatrixKeyProvider extends BaseKeyProvider {
  // Hört auf MatrixRTCSessionEvent.EncryptionKeyChanged
  // → crypto.subtle.importKey("raw", key, "HKDF", ...)
  // → this.onSetEncryptionKey(keyMaterial, participantId, keyIndex)
  setRTCSession(session: MatrixRTCSession): void
}
---
Phase 6 — nativeCallEngine.ts (Hauptlogik, max 450 Zeilen)
Datei: src/app/features/call/nativeCallEngine.ts
// React Hook — die ganze Engine
export function useNativeCall(roomId: string | null) {
  // State
  const [livekitRoom]   // LiveKit Room Instanz
  const [isConnecting]
  const [isConnected]
  const [error]
  // Effekt: wenn roomId sich ändert
  useEffect(() => {
    if (!roomId) return cleanup();
    // 1. Matrix Room holen
    const room = mx.getRoom(roomId);
    // 2. Focus URL aus Room State lesen (sfuToken.ts)
    const serviceUrl = getLivekitFocusFromRoom(room);
    // 3. MatrixRTC Session
    const session = mx.matrixRTC.getRoomSession(room);
    // 4. MatrixKeyProvider (E2EE)
    const keyProvider = new MatrixKeyProvider();
    // 5. LiveKit Room erstellen mit E2EE Worker
    const e2eeWorker = new E2EEWorker(); // import E2EEWorker from 'livekit-client/e2ee-worker?worker&inline'
    const lkRoom = new Room(buildLiveKitRoomOptions(avSettings, keyProvider));
    // 6. MatrixRTC Session joinen (schreibt Membership + Delayed Event)
    const fociPreferred = [{ type: 'livekit', livekit_service_url: serviceUrl }];
    session.joinRoomSession(fociPreferred, undefined, { manageMediaKeys: true });
    // 7. Key Provider mit Session verbinden
    keyProvider.setRTCSession(session);
    // 8. SFU Token holen
    const sfuConfig = await getSFUConfigWithOpenID(mx, membershipIdentity, serviceUrl, roomId);
    // 9. LiveKit Room verbinden
    await lkRoom.connect(sfuConfig.url, sfuConfig.jwt);
    // 10. Speaking Events → CallProvider State
    lkRoom.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    lkRoom.on(RoomEvent.ParticipantConnected, handleParticipantChange);
    lkRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantChange);
    lkRoom.on(RoomEvent.TrackSubscribed, handleTrackChange);
    setLivekitRoom(lkRoom);
    setIsConnected(true);
    // Cleanup:
    return () => {
      lkRoom.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
      lkRoom.disconnect();
      session.leaveRoomSession();
      e2eeWorker.terminate();
    };
  }, [roomId]);
  return { livekitRoom, isConnecting, isConnected, error };
}
Membership Identity (für SFU Token + E2EE):
// CallMembershipIdentityParts wird aus MatrixRTC Session nach joinRoomSession() verfügbar:
const membershipIdentity = session.memberships.find(m => m.sender === mx.getUserId())?.membershipIdentityParts
---
Phase 7 — NativeCallParticipantTile.tsx
Datei: src/app/pages/client/call/NativeCallParticipantTile.tsx
interface Props {
  participant: RemoteParticipant | LocalParticipant;
  isLocal: boolean;
}
// Inhalt:
// - VideoTrack wenn Kamera an (useParticipantTracks)
// - Avatar wenn keine Kamera
// - Speaking Glow: outline 2px solid #23A55A wenn participant.isSpeaking
// - Name Tag unten-links (IBM Plex Sans 13px, 500 weight)
// - Mic-Icon unten-rechts (PhoneSlash/Microphone Phosphor Icon)
// - Screenshare Badge wenn participant screensharet
// - CSS Module für Styles
---
Phase 8 — NativeCallParticipantGrid.tsx
Datei: src/app/pages/client/call/NativeCallParticipantGrid.tsx
// CSS Grid auto-fit:
// 1 person: 1 col, large tiles
// 2-4: 2 cols
// 5-9: 3 cols
// 10+: 4 cols
// Featured tile (screenshare pinned): groß links, andere klein rechts
---
Phase 9 — NativeCallControlBar.tsx
Datei: src/app/pages/client/call/NativeCallControlBar.tsx
// Buttons (Phosphor Icons, 36x36px, border-radius: var(--radius-md)):
// [Mic/MicSlash]  [VideoCamera/Slash]  [MonitorArrowUp]  [Funnel (NoiseSuppression)]  [ChartBar (Stats)]  [PhoneDisconnect ← rot]
// Mute: localParticipant.setMicrophoneEnabled(!isMuted)
// Video: localParticipant.setCameraEnabled(!isVideoOn)
// Screen: öffnet ScreenShareQualityModal → dann localParticipant.setScreenShareEnabled(true, opts)
// NoiseSuppression: localStorage toggle + applyConstraints({ noiseSuppression })
// Stats: showStats state toggle
// Disconnect: hangUp() → session.leaveRoomSession() + room.disconnect()
---
Phase 10 — ScreenShareQualityModal.tsx
Datei: src/app/pages/client/call/ScreenShareQualityModal.tsx
Port aus BC-Call, angepasst für direkte LiveKit Calls:
┌─ Bildschirmfreigabe ─────────────────────────┐
│  Auflösung:  [720p] [1080p ✓] [1440p] [4k] [Quelle]  │
│  Framerate:   [5] [15] [30 ✓] [60] [120]              │
│  Desktop-Audio: [●──────] Ein                         │
│  [Abbrechen]  [Teilen starten →]                      │
└───────────────────────────────────────────────┘
Beim Bestätigen:
const captureOpts = buildCaptureOptions(ssResolution, ssFps, ssAudio); // aus avPresets.ts
const publishOpts = { screenShareEncoding: resolutionToSSPreset(ssResolution, ssFps).encoding };
await localParticipant.setScreenShareEnabled(true, captureOpts, publishOpts);
---
Phase 11 — BCStatsPanel.tsx
Datei: src/app/pages/client/call/BCStatsPanel.tsx
Port aus BC-Call, angepasst für native LiveKit room:
// Polling: useInterval(2000)
// livekitRoom.engine.engineRTCPeerConnection?.getStats()
// Zeigt: RTT (ms), Jitter (ms), PacketLoss (%), FPS, Resolution, Audio Bitrate
// Farben: grün < threshold, gelb < 2×threshold, rot ≥ 2×threshold
// Position: floating HUD, bottom-right
---
Phase 12 — NativeCallView.tsx
Datei: src/app/pages/client/call/NativeCallView.tsx
// Composites alles:
export function NativeCallView({ roomId }: { roomId: string }) {
  const { livekitRoom, isConnecting, error } = useNativeCall(roomId);
  const avSettings = useAtomValue(avSettingsAtom);
  const [showStats, setShowStats] = useState(false);
  const [showSSModal, setShowSSModal] = useState(false);
  return (
    <LiveKitRoom room={livekitRoom} ...>
      <RoomAudioRenderer />          {/* LiveKit Audio Playback */}
      <NativeCallParticipantGrid />
      <NativeCallControlBar
        onScreenShare={() => setShowSSModal(true)}
        onToggleStats={() => setShowStats(s => !s)}
      />
      {showStats && <BCStatsPanel room={livekitRoom} />}
      {showSSModal && (
        <ScreenShareQualityModal
          onClose={() => setShowSSModal(false)}
          avSettings={avSettings}
        />
      )}
    </LiveKitRoom>
  );
}
---
Phase 13 — CallProvider.tsx umbau
Alle Widget-API Teile raus. Was bleibt:
// BLEIBT:
activeCallRoomId, viewedCallRoomId
setActiveCallRoomId()  // Multi-device kick Logik bleibt 1:1
hangUp()               // jetzt: session.leaveRoomSession() + room.disconnect()
speakingUsers          // jetzt: aus LiveKit RoomEvent.ActiveSpeakersChanged
participantStates      // jetzt: aus LiveKit Participant.audioEnabled/videoEnabled
screensharingUsers     // jetzt: aus LiveKit TrackPublished/Unpublished
join/leave sounds      // bleibt 1:1
isCallViewOpen, toggleCallView
isChatOpen, toggleChat
// RAUS:
activeClientWidgetApi, registerActiveClientWidgetApi
sendWidgetAction
activeClientWidget, activeClientWidgetIframeRef
isActiveCallReady, resetActiveCallReady
alle postMessage Handler (handleHangup, handleJoin, handleSpeaking, etc.)
// NEU:
livekitRoomRef         // Ref zur aktiven LiveKit Room Instanz
toggleAudio()          // → livekitRoomRef.localParticipant.setMicrophoneEnabled()
toggleVideo()          // → livekitRoomRef.localParticipant.setCameraEnabled()
---
Phase 14 — PersistentCallContainer.tsx vereinfachen
// Vorher: ~200 Zeilen iframe setup + SmallWidget + SmallWidgetDriver
// Nachher: ~60 Zeilen
export function PersistentCallContainer() {
  const { activeCallRoomId } = useCallState();
  if (!activeCallRoomId) return null;
  return (
    <div className={styles.container}>
      <NativeCallView roomId={activeCallRoomId} />
    </div>
  );
}
---
## Reihenfolge der Implementierung (damit immer buildbar bleibt)
1. `AGENTS.md` → Regeln dokumentieren
2. `package.json` → Dependencies updaten, `npm install`
3. `avQualityAtom.ts` → kein Dep auf neue Dateien
4. `avPresets.ts` → kein Dep auf neue Dateien
5. `sfuToken.ts` → kein Dep auf neue Dateien
6. `matrixKeyProvider.ts` → kein Dep auf neue Dateien
7. `nativeCallEngine.ts` → braucht 4+5+6
8. `NativeCallParticipantTile.tsx` → standalone
9. `NativeCallParticipantGrid.tsx` → braucht 8
10. `BCStatsPanel.tsx` → standalone
11. `ScreenShareQualityModal.tsx` → braucht avPresets.ts
12. `NativeCallControlBar.tsx` → braucht 11
13. `NativeCallView.tsx` → braucht 7+9+10+11+12
14. `PersistentCallContainer.tsx` umbau → braucht 13
15. `CallProvider.tsx` umbau → braucht 7
16. SmallWidget.ts + SmallWidgetDriver.ts löschen
17. Build testen, TypeScript Fehler fixen
18. BC-Call reset force push
---