/**
 * mesh — Native Call Engine
 *
 * useNativeCall(roomId) manages the full Matrix RTC + LiveKit + E2EE lifecycle
 * for a single voice/video call room.
 *
 * Flow:
 *   1. Read focus URL from org.matrix.msc3401.call room state
 *   2. Spin up E2EE worker + MatrixKeyProvider (encrypted rooms only)
 *   3. Join MatrixRTC session (writes membership + delayed keepalive event)
 *   4. Fetch LiveKit JWT via OpenID token exchange
 *   5. Connect Room, publish mic
 *   6. On cleanup: disconnect → leaveRoomSession → terminate worker
 *
 * Presence model:
 *   The bridge SSE stream (BridgePresenceProvider) is the sole source of truth
 *   for non-participant observers. No call presence state events are written by
 *   this engine. Deafen state is propagated via the LiveKit participant attribute
 *   `isDeafened` so the bridge webhook can pick it up.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent, Track, VideoQuality, LocalAudioTrack, LocalVideoTrack, type E2EEManagerOptions, type RemoteParticipant } from 'livekit-client';
import {
  getSoundboardMixer,
  getSoundboardMixerIfActive,
  destroySoundboardMixerSingleton,
  type SoundboardMixer,
} from './soundboardMixer';
import type { MatrixClient } from 'matrix-js-sdk';
import { useSetAtom, useAtomValue } from 'jotai';
import { watchedScreenSharesAtom } from '../../pages/client/call/screenShareStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useClientConfig } from '../../hooks/useClientConfig';
import { effectiveAVSettingsAtom } from '../../state/avQuality';
import { settingsAtom } from '../../state/settings';
import {
  bitrateToAudioPreset,
  buildAudioCaptureDefaults,
  buildLiveKitRoomOptions,
  buildSSCaptureOptions,
  buildSSPublishOptions,
  resolutionToHeight,
  resolutionToWidth,
  type AVSettings,
} from './avPresets';
import { MatrixKeyProvider } from './matrixKeyProvider';
import { parseSoundboardMessage, type SoundboardActivity } from './soundboardDataChannel';
import { resolveParticipantUserId } from './participantIdentity';
import { CALL_INFO_EVENT } from '../../hooks/useCallMemberships';
import { getSFUConfigWithOpenID } from './sfuToken';
import { useAudioWinsOverVideo } from './callQualityFallback';
import { playCallSound, CallSoundType, setCallSoundsVolume } from '../../utils/callSounds';

// Vite inline worker — TypeScript doesn't know this import
// @ts-ignore
import E2EEWorker from 'livekit-client/e2ee-worker?worker&inline';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type RemoteParticipantState = {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
};

export interface NativeCallEngine {
  status: CallStatus;
  isReconnecting: boolean;
  livekitRoom: Room | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenShareEnabled: boolean;
  isDeafened: boolean;
  isFrontCamera: boolean;
  speakingUsers: Set<string>;
  remoteParticipantStates: Map<string, RemoteParticipantState>;
  error: Error | null;
  callJoinTime: Date | null;
  soundboardActivity: SoundboardActivity | null;
  hangUp: () => void;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  flipCamera: () => Promise<void>;
  startScreenShare: (ssRes: string, ssFps: number, ssAudio: boolean) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleDeafen: () => Promise<void>;
  watchedScreenShares: ReadonlySet<string>;
  watchScreenShare: (identity: string) => Promise<void>;
  unwatchScreenShare: (identity: string) => Promise<void>;
  updateActiveScreenShareSettings: (ssRes: string, ssFps: number, ssAudio: boolean) => Promise<void>;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Resolves the LiveKit SFU URL from room state events.
 * Checks the call state event first, then scans member events as a fallback.
 */
function getFocusUrl(mx: MatrixClient, roomId: string): string | null {
  const room = mx.getRoom(roomId);
  if (!room) return null;

  // Primary: org.matrix.msc3401.call state event
  const callEvent = room.currentState.getStateEvents('org.matrix.msc3401.call', '');
  const fociPreferred = (callEvent as any)?.getContent()?.foci_preferred;
  if (Array.isArray(fociPreferred) && fociPreferred.length > 0) {
    return fociPreferred[0].livekit_service_url ?? null;
  }

  // Fallback: scan org.matrix.msc3401.call.member events
  const memberEvents =
    room.currentState.getStateEvents('org.matrix.msc3401.call.member') ?? [];
  for (const ev of Array.isArray(memberEvents) ? memberEvents : [memberEvents]) {
    const content = (ev as any).getContent?.() ?? {};
    const foci = content.foci_preferred ?? content['m.foci']?.preferred;
    if (Array.isArray(foci) && foci.length > 0) {
      const url = foci[0].livekit_service_url;
      if (url) return url as string;
    }
  }

  return null;
}

/**
 * Count users with an active (non-empty) call.member state event in a room.
 * Used to decide whether we are the first joiner (write start time) or last
 * leaver (clear start time).
 */
function countActiveCallMembers(mx: MatrixClient, roomId: string): number {
  const room = mx.getRoom(roomId);
  if (!room) return 0;
  const types = ['org.matrix.msc3401.call.member', 'org.matrix.msc4143.call.member'];
  const senders = new Set<string>();
  for (const type of types) {
    const events: any[] = (room.currentState.getStateEvents(type) ?? []) as any[];
    for (const ev of Array.isArray(events) ? events : [events]) {
      const sender = ev.getSender?.();
      const content = ev.getContent?.() ?? {};
      if (sender && Object.keys(content).length > 0) senders.add(sender as string);
    }
  }
  return senders.size;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNativeCall(roomId: string | null): NativeCallEngine {
  const mx = useMatrixClient();

  // ── Config ─────────────────────────────────────────────────────────────────
  const clientConfig = useClientConfig();
  const { livekitServiceUrl: configServiceUrl } = clientConfig;
  const configServiceUrlRef = useRef(configServiceUrl);
  configServiceUrlRef.current = configServiceUrl;

  // Presence bridge URL for client-side attribute notifications
  const presenceBaseUrl = clientConfig.presenceUrl?.trim() || '/api/presence';
  const presenceBaseUrlRef = useRef(presenceBaseUrl);
  presenceBaseUrlRef.current = presenceBaseUrl;

  // ── Atoms ──────────────────────────────────────────────────────────────────
  const effectiveAV = useAtomValue(effectiveAVSettingsAtom);
  const userSettings = useAtomValue(settingsAtom);

  const callSoundsEnabled = useAtomValue(settingsAtom).callSoundsEnabled ?? true;
  const callSoundsVolume = useAtomValue(settingsAtom).callSoundsVolume ?? 1.0;

  useEffect(() => {
    setCallSoundsVolume(callSoundsVolume);
  }, [callSoundsVolume]);

  const callSoundsEnabledRef = useRef(callSoundsEnabled);
  useEffect(() => { callSoundsEnabledRef.current = callSoundsEnabled; }, [callSoundsEnabled]);

  const setWatchedScreenShares = useSetAtom(watchedScreenSharesAtom);
  const watchedScreenShares = useAtomValue(watchedScreenSharesAtom);
  const watchedScreenSharesRef = useRef(watchedScreenShares);
  watchedScreenSharesRef.current = watchedScreenShares;

  const syncScreenShareAudioSubscription = useCallback(
    (participant: RemoteParticipant, shouldHearAudio: boolean) => {
      for (const pub of participant.trackPublications.values()) {
        if (pub.source === Track.Source.ScreenShareAudio) {
          pub.setSubscribed(shouldHearAudio);
        }
      }
    },
    [],
  );

  // Refs so the connect() closure always sees fresh values without re-running
  const effectiveAVRef = useRef(effectiveAV);
  effectiveAVRef.current = effectiveAV;
  const userSettingsRef = useRef(userSettings);
  userSettingsRef.current = userSettings;

  // ── State ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  // Tracks current camera facing mode for mobile flip toggle ('user' | 'environment')
  const facingModeRef = useRef<'user' | 'environment'>('user');
  // Reactive state so tiles can conditionally mirror only the front camera
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [remoteParticipantStates, setRemoteParticipantStates] = useState<Map<string, RemoteParticipantState>>(new Map());
  const [error, setError] = useState<Error | null>(null);
  const [callJoinTime, setCallJoinTime] = useState<Date | null>(null);
  // #80 — soundboard data channel: last clip played by any participant
  const [soundboardActivity, setSoundboardActivity] = useState<SoundboardActivity | null>(null);

  // ── Refs for imperative cleanup (survive re-renders) ──────────────────────
  // #58 — guard all setState calls inside async timers against post-unmount updates
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const roomRef = useRef<Room | null>(null);
  const rtcSessionRef = useRef<any>(null);
  const e2eeWorkerRef = useRef<Worker | null>(null);
  const keyProviderRef = useRef<MatrixKeyProvider | null>(null);
  const isDeafenedRef = useRef(false);
  // Tracks consecutive permission failures per attribute key.
  // Only the specific key that failed is suppressed; other keys continue to work.
  const attributePermFailuresRef = useRef(new Map<string, number>());
  const ATTRIBUTE_PERM_FAIL_LIMIT = 3;
  // True when the mic was muted automatically by deafen (so we can restore it on undeafen).
  // Stays false if the user manually muted before deafening — we don't touch their manual mute.
  const mutedByDeafenRef = useRef(false);

  const setLocalParticipantAttributesSafely = useCallback(
    async (attributes: Record<string, string>): Promise<void> => {
      const room = roomRef.current;
      if (!room) return;

      // Filter out keys that have hit the permission failure limit
      const filteredAttrs: Record<string, string> = {};
      for (const [key, value] of Object.entries(attributes)) {
        const failures = attributePermFailuresRef.current.get(key) ?? 0;
        if (failures < ATTRIBUTE_PERM_FAIL_LIMIT) {
          filteredAttrs[key] = value;
        }
      }
      if (Object.keys(filteredAttrs).length === 0) return;

      try {
        await room.localParticipant.setAttributes(filteredAttrs);
        // Reset failure counters on success
        for (const key of Object.keys(filteredAttrs)) {
          attributePermFailuresRef.current.delete(key);
        }

        // Notify the presence bridge directly — works around LiveKit ≤1.9.x
        // which does not emit participant_attributes_changed webhooks.
        // Fire-and-forget: failures are non-critical (bridge will still get
        // the data via track events or reconcile).
        const baseUrl = presenceBaseUrlRef.current;
        const identity = room.localParticipant.identity;
        const matrixUserId = mx.getUserId();
        if (identity && matrixUserId && room.name) {
          fetch(`${baseUrl}/attributes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId: room.name,
              identity,
              userId: matrixUserId,
              attributes: filteredAttrs,
              // Send the Matrix room ID so the bridge can maintain an alias
              // mapping — SSE subscribers may query by Matrix room ID instead
              // of the LiveKit room name.
              matrixRoomId: roomId,
            }),
          }).catch(() => {
            // Best-effort — bridge may be unreachable in dev
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/permission to update own metadata/i.test(message)) {
          // Increment failure count for all attempted keys
          for (const key of Object.keys(filteredAttrs)) {
            const prev = attributePermFailuresRef.current.get(key) ?? 0;
            attributePermFailuresRef.current.set(key, prev + 1);
          }
          console.warn(
            '[NativeCall] LiveKit rejected attribute update for keys:',
            Object.keys(filteredAttrs).join(', '),
            `(failures: ${[...attributePermFailuresRef.current.entries()].map(([k, v]) => `${k}=${v}`).join(', ')})`,
          );
          return;
        }

        console.warn('[NativeCall] Failed to update local participant attributes:', err);
      }
    },
    [],
  );

  // Holds the active SoundboardMixer for the current call session.
  // Created when the mic track is first obtained; torn down on cleanup/hangUp.
  const mixerRef = useRef<SoundboardMixer | null>(null);

  const prevAudioQualityRef = useRef<{
    audioBitrate: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  } | null>(null);
  const audioQualityUpdateRef = useRef<Promise<void>>(Promise.resolve());

  // ── Main Effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    let aborted = false;
    attributePermFailuresRef.current.clear();
    const SPEAK_ACTIVATE_MS = 180;
    const SPEAK_DEACTIVATE_MS = 500;
    const activateTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const deactivateTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const confirmedSpeakers = new Set<string>();
    // Maps LiveKit participant.identity → resolved Matrix userId.
    // Built once per participant connect so ActiveSpeakersChanged always uses
    // the same key as remoteParticipantStates, regardless of attribute availability.
    const identityToUserIdMap = new Map<string, string>();

    async function connect() {
      setStatus('connecting');
      setError(null);

      try {
        const matrixRoom = mx.getRoom(roomId!);
        if (!matrixRoom) throw new Error(`Room not found: ${roomId}`);

        const userId = mx.getUserId() ?? '';
        const deviceId = mx.getDeviceId() ?? '';

        // In a browser context (not Electron), stored device IDs may have come from
        // Electron which uses different internal hardware IDs than Chrome — passing
        // an Electron device ID to getUserMedia in Chrome causes "Requested device not found".
        // We detect Electron via userAgent and skip stored IDs in plain browser.
        const isElectron = /electron/i.test(navigator.userAgent);

        let validMicDeviceId = isElectron ? userSettingsRef.current.micDeviceId : undefined;
        let validCameraDeviceId = isElectron ? userSettingsRef.current.cameraDeviceId : undefined;

        // Even in Electron, validate stored IDs against the real device list to catch
        // unplugged / renamed devices.
        if (isElectron && (validMicDeviceId || validCameraDeviceId)) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const ids = new Set(devices.filter((d) => d.deviceId).map((d) => d.deviceId));
            if (validMicDeviceId && !ids.has(validMicDeviceId)) validMicDeviceId = undefined;
            if (validCameraDeviceId && !ids.has(validCameraDeviceId)) validCameraDeviceId = undefined;
          } catch {
            validMicDeviceId = undefined;
            validCameraDeviceId = undefined;
          }
        }

        // Build AV settings from latest ref values
        const av: AVSettings = {
          audioBitrate: effectiveAVRef.current.audioBitrate,
          echoCancellation: userSettingsRef.current.echoCancellation,
          noiseSuppression: userSettingsRef.current.noiseSuppression,
          autoGainControl: userSettingsRef.current.autoGainControl,
          videoResolution: effectiveAVRef.current.videoResolution,
          videoFps: effectiveAVRef.current.videoFps,
          ssResolution: effectiveAVRef.current.ssResolution,
          ssFps: effectiveAVRef.current.ssFps,
          ssAudio: userSettingsRef.current.ssAudio,
          micDeviceId: validMicDeviceId,
          cameraDeviceId: validCameraDeviceId,
          speakerDeviceId: userSettingsRef.current.speakerDeviceId,
        };

        // 1. Resolve LiveKit focus URL — room state first, then config.json fallback
        let serviceUrl = getFocusUrl(mx, roomId!);

        if (!serviceUrl) {
          if (configServiceUrlRef.current) {
            const configServiceUrl = configServiceUrlRef.current;
            serviceUrl = configServiceUrl;
            // Best-effort: write the call state event so future joins skip the fallback
            const plEvent = matrixRoom.currentState.getStateEvents('m.room.power_levels', '');
            const userPower =
              (plEvent as any)?.getContent()?.users?.[userId] ??
              (plEvent as any)?.getContent()?.users_default ??
              0;
            const stateDefault = (plEvent as any)?.getContent()?.state_default ?? 50;
            if (userPower >= stateDefault) {
              void mx.sendStateEvent(
                roomId!,
                'org.matrix.msc3401.call' as any,
                {
                  'm.intent': 'm.room',
                  'm.type': 'm.voice',
                  foci_preferred: [{ livekit_service_url: serviceUrl, type: 'livekit' }],
                },
                '',
              );
            }
          }
        }

        if (!serviceUrl) {
          throw new Error(
            'No LiveKit focus URL found. Set MESH_LIVEKIT_URL (Docker) or livekitServiceUrl in config.json.',
          );
        }

        // 2. E2EE setup (only for encrypted rooms)
        //
        // matrix-js-sdk may not have m.room.encryption in the local state cache
        // (lazy-load, stale IndexedDB, filtered sync). Check local state first,
        // then fall back to a direct server query so E2EE is never silently skipped.
        let isEncrypted = !!matrixRoom.currentState.getStateEvents('m.room.encryption', '');
        if (!isEncrypted) {
          try {
            const hsUrl = mx.getHomeserverUrl();
            const token = mx.getAccessToken();
            const encRes = await fetch(
              `${hsUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.encryption/`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (encRes.ok) {
              const data = await encRes.json();
              if (data?.algorithm) isEncrypted = true;
            }
          } catch {
            // 404 = genuinely unencrypted, network error = assume unencrypted (safe default)
          }
        }
        let e2eeWorker: Worker | null = null;
        let keyProvider: MatrixKeyProvider | null = null;
        // #61 — proper typing instead of any
        let e2eeOptions: E2EEManagerOptions | undefined;

        if (isEncrypted) {
          e2eeWorker = new E2EEWorker();
          keyProvider = new MatrixKeyProvider();
          // #62 — E2EE is set up before connect(); mid-call key rotation is handled
          // by MatrixKeyProvider via MatrixRTCSessionEvent.EncryptionKeyChanged.
          e2eeOptions = { keyProvider, worker: e2eeWorker };
        }

        if (aborted) {
          e2eeWorker?.terminate();
          return;
        }

        // 3. Build LiveKit Room with AV + optional E2EE + feature flags
        const room = new Room(buildLiveKitRoomOptions(av, e2eeOptions, clientConfig.featureFlags));

        // 4. Join Matrix RTC session (writes membership state event + delayed keepalive)
        const rtcSession = (mx as any).matrixRTC.getRoomSession(matrixRoom);
        const livekitFocus = {
          type: 'livekit' as const,
          livekit_service_url: serviceUrl,
        };
        rtcSession.joinRoomSession([livekitFocus], livekitFocus, { manageMediaKeys: true });

        // Write call start time if we are the first joiner and have sufficient power.
        // All clients (in-call or not) read this Matrix state event for the timer.
        // activeAtJoin is read BEFORE our membership event is confirmed on the server,
        // so 0 reliably means no one else was in the call.
        if (countActiveCallMembers(mx, roomId!) === 0) {
          const plEv = matrixRoom.currentState.getStateEvents('m.room.power_levels', '');
          const myPower = (plEv as any)?.getContent()?.users?.[userId] ?? (plEv as any)?.getContent()?.users_default ?? 0;
          const stateLevel = (plEv as any)?.getContent()?.state_default ?? 50;
          if (myPower >= stateLevel) {
            void mx.sendStateEvent(
              roomId!,
              CALL_INFO_EVENT as any,
              { started_at: Date.now() },
              '',
            );
          }
        }

        // Store refs IMMEDIATELY after joinRoomSession so the cleanup function
        // can always call leaveRoomSession() — even if an error is thrown below.
        // Previously these were set later (after getSFUConfigWithOpenID), meaning
        // any error between joinRoomSession and that point left an orphaned delayed
        // event that fired after ~8s and wiped the membership.
        roomRef.current = room;
        rtcSessionRef.current = rtcSession;
        e2eeWorkerRef.current = e2eeWorker;
        keyProviderRef.current = keyProvider;

        if (keyProvider) keyProvider.setRTCSession(rtcSession);

        if (aborted) {
          room.removeAllListeners();
          void room.disconnect();
          void rtcSession.leaveRoomSession?.();
          roomRef.current = null;
          rtcSessionRef.current = null;
          keyProvider?.dispose();
          keyProviderRef.current = null;
          e2eeWorker?.terminate();
          e2eeWorkerRef.current = null;
          return;
        }

        // 5. Fetch LiveKit JWT via OpenID token exchange
        const sfuConfig = await getSFUConfigWithOpenID(
          mx,
          userId,
          deviceId,
          serviceUrl,
          roomId!,
        );

        if (aborted) {
          room.removeAllListeners();
          void room.disconnect();
          void rtcSession.leaveRoomSession?.();
          roomRef.current = null;
          rtcSessionRef.current = null;
          keyProvider?.dispose();
          keyProviderRef.current = null;
          e2eeWorker?.terminate();
          e2eeWorkerRef.current = null;
          return;
        }

        // 6. Refs already stored above — nothing to do here.

        // 7. Attach event listeners

        // Helper to update remote participant state snapshot
        const updateRemote = (
          participant: {
            identity: string;
            name?: string;
            metadata?: string;
            attributes?: Record<string, string>;
            isMicrophoneEnabled: boolean;
            isCameraEnabled: boolean;
            isScreenShareEnabled: boolean;
          },
          isDisconnecting = false
        ) => {
          const resolvedUserId = resolveParticipantUserId(participant, matrixRoom);
          // Keep identity→userId mapping in sync so ActiveSpeakersChanged uses
          // consistent keys even if participant attributes aren't set by the bridge.
          if (isDisconnecting) {
            identityToUserIdMap.delete(participant.identity);
          } else {
            identityToUserIdMap.set(participant.identity, resolvedUserId);
          }
          setRemoteParticipantStates((prev) => {
            const next = new Map(prev);
            if (isDisconnecting) {
              next.delete(resolvedUserId);
            } else {
              next.set(resolvedUserId, {
                audioEnabled: participant.isMicrophoneEnabled,
                videoEnabled: participant.isCameraEnabled,
                isScreenSharing: participant.isScreenShareEnabled,
                isDeafened: participant.attributes?.isDeafened === '1',
              });
            }
            return next;
          });
        };

        // Screenshare tracks stay subscribed via autoSubscribe: true.
        // The UI gates full viewing behind a "Watch Stream" click in
        // ScreenShareTile; before the click a blurred preview is shown.
        // No subscription gating here — only deafen + mic are managed.

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          const nextSpeakers = new Set(
            speakers.map((s) =>
              // Prefer the pre-resolved userId from the identity map — ensures the
              // key always matches what remoteParticipantStates and RoomNavUser use,
              // even when LiveKit participant attributes aren't set by the bridge.
              identityToUserIdMap.get(s.identity) ?? resolveParticipantUserId(s, matrixRoom)
            )
          );
          if (room.localParticipant.isSpeaking) nextSpeakers.add(userId);

          // Users who are speaking → activate, cancel any pending deactivation
          for (const uid of nextSpeakers) {
            const dt = deactivateTimers.get(uid);
            if (dt !== undefined) { clearTimeout(dt); deactivateTimers.delete(uid); }
            if (!confirmedSpeakers.has(uid) && !activateTimers.has(uid)) {
              activateTimers.set(uid, setTimeout(() => {
                activateTimers.delete(uid);
                confirmedSpeakers.add(uid);
                if (isMountedRef.current) setSpeakingUsers(new Set(confirmedSpeakers));
              }, SPEAK_ACTIVATE_MS));
            }
          }

          // Users no longer speaking → deactivate, cancel any pending activation
          const allTracked = [...confirmedSpeakers, ...activateTimers.keys()];
          for (const uid of allTracked) {
            if (nextSpeakers.has(uid)) continue;
            const at = activateTimers.get(uid);
            if (at !== undefined) { clearTimeout(at); activateTimers.delete(uid); continue; }
            if (!deactivateTimers.has(uid)) {
              deactivateTimers.set(uid, setTimeout(() => {
                deactivateTimers.delete(uid);
                confirmedSpeakers.delete(uid);
                if (isMountedRef.current) setSpeakingUsers(new Set(confirmedSpeakers));
              }, SPEAK_DEACTIVATE_MS));
            }
          }
        });

        room.on(RoomEvent.TrackMuted, (pub, participant) => {
          if (participant === room.localParticipant) {
            if (pub.source === Track.Source.Microphone) setIsAudioEnabled(false);
            if (pub.source === Track.Source.Camera) setIsVideoEnabled(false);
            if (pub.source === Track.Source.ScreenShare) setIsScreenShareEnabled(false);
          } else {
            updateRemote(participant);
          }
        });

        room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
          if (participant === room.localParticipant) {
            if (pub.source === Track.Source.Microphone) setIsAudioEnabled(true);
            if (pub.source === Track.Source.Camera) setIsVideoEnabled(true);
            if (pub.source === Track.Source.ScreenShare) setIsScreenShareEnabled(true);
          } else {
            updateRemote(participant);
          }
        });

        // TrackPublished/Unpublished only fire for RemoteParticipants in LiveKit v2
        room.on(RoomEvent.TrackPublished, (_pub, participant) => {
          updateRemote(participant);
          // Deafen: if currently deafened, unsubscribe newly published mic tracks.
          if (_pub.source === Track.Source.Microphone && isDeafenedRef.current) {
            _pub.setSubscribed(false);
          }
          if (_pub.source === Track.Source.ScreenShareAudio) {
            _pub.setSubscribed(watchedScreenSharesRef.current.has(participant.identity));
          }
        });

        room.on(RoomEvent.TrackUnpublished, (_pub, participant) => {
          updateRemote(participant);
          // When a remote screenshare track disappears, remove them from watchedScreenShares
          // so the Watch overlay is shown again if they start sharing again later.
          if (_pub.source === Track.Source.ScreenShare) {
            setWatchedScreenShares((prev) => {
              if (!prev.has(participant.identity)) return prev;
              const next = new Set(prev);
              next.delete(participant.identity);
              return next as ReadonlySet<string>;
            });
          }
        });
        room.on(RoomEvent.ParticipantConnected, (participant) => {
          try {
          updateRemote(participant);
          playCallSound(CallSoundType.UserJoin, { enabled: callSoundsEnabledRef.current });
          // Apply deafen if active — unsubscribe audio tracks from this participant.
          if (isDeafenedRef.current) {
            for (const pub of participant.audioTrackPublications.values()) {
              if (pub.source === Track.Source.Microphone) {
                pub.setSubscribed(false);
              }
            }
          }
          syncScreenShareAudioSubscription(
            participant,
            watchedScreenSharesRef.current.has(participant.identity),
          );
          } catch (err) {
            console.error('[NativeCall] ParticipantConnected handler error:', err);
          }
        });
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          updateRemote(participant, true);
          playCallSound(CallSoundType.UserLeave, { enabled: callSoundsEnabledRef.current });
          // Immediately clear speaking state for disconnected participant
          const disconnectedUid = resolveParticipantUserId(participant, matrixRoom);
          const at = activateTimers.get(disconnectedUid);
          if (at !== undefined) { clearTimeout(at); activateTimers.delete(disconnectedUid); }
          const dt = deactivateTimers.get(disconnectedUid);
          if (dt !== undefined) { clearTimeout(dt); deactivateTimers.delete(disconnectedUid); }
          if (confirmedSpeakers.delete(disconnectedUid)) {
            setSpeakingUsers(new Set(confirmedSpeakers));
          }
          // Remove from watched set — screenshare is gone with the participant.
          setWatchedScreenShares((prev) => {
            if (!prev.has(participant.identity)) return prev;
            const next = new Set(prev);
            next.delete(participant.identity);
            return next as ReadonlySet<string>;
          });
        });

        room.on(RoomEvent.LocalTrackPublished, (pub) => {
          if (pub.source === Track.Source.ScreenShare) setIsScreenShareEnabled(true);
        });

        // #80 — soundboard data channel: receive clip metadata from other participants
        room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
          const msg = parseSoundboardMessage(payload, topic);
          if (!msg || !participant) return;
          if (msg.type === 'clip_start') {
            setSoundboardActivity({
              participantIdentity: participant.identity,
              clipName: msg.clipName,
              clipId: msg.clipId,
            });
            // Auto-clear after 5s so the indicator doesn't linger
            setTimeout(() => {
              setSoundboardActivity((prev) =>
                prev?.clipId === msg.clipId ? null : prev
              );
            }, 5_000);
          } else if (msg.type === 'clip_stop') {
            setSoundboardActivity((prev) =>
              prev?.clipId === msg.clipId ? null : prev
            );
          }
        });

        room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
          if (pub.source === Track.Source.ScreenShare) setIsScreenShareEnabled(false);
        });

        room.on(RoomEvent.ParticipantAttributesChanged, (_changedAttributes, participant) => {
          if (participant !== room.localParticipant) {
            // Re-resolve now that attributes are populated
            const resolvedId = resolveParticipantUserId(participant, matrixRoom);
            identityToUserIdMap.set(participant.identity, resolvedId);
            updateRemote(participant);
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (!aborted) setStatus('idle');
        });

        // #42 — track reconnect state so UI can show a reconnecting indicator
        room.on(RoomEvent.Reconnecting, () => {
          if (!aborted) setIsReconnecting(true);
        });

        // #43 — after reconnect, re-apply deafen state (subscriptions are reset by LiveKit)
        room.on(RoomEvent.Reconnected, () => {
          if (!aborted) {
            setIsReconnecting(false);
            if (isDeafenedRef.current) {
              for (const p of room.remoteParticipants.values()) {
                for (const pub of p.audioTrackPublications.values()) {
                  pub.setSubscribed(false);
                }
              }
            }
            for (const p of room.remoteParticipants.values()) {
              syncScreenShareAudioSubscription(p, watchedScreenSharesRef.current.has(p.identity));
            }
          }
        });

        // 8. Connect to the LiveKit SFU
        //
        // autoSubscribe: true — the SDK subscribes all tracks automatically.
        // This avoids a race condition where WebRTC delivers a track before the
        // SDK has registered the participant internally ("Tried to add a track
        // for a participant, that's not present"). Unwanted subscriptions
        // (screenshare, deafened audio) are cleaned up immediately after connect.
        await room.connect(sfuConfig.url, sfuConfig.jwt, { autoSubscribe: true });

        // 8b. Snapshot pre-existing remote participants for UI state + apply deafen.
        for (const p of room.remoteParticipants.values()) {
          updateRemote(p);
          // If deafened at join, unsubscribe their audio tracks now.
          if (isDeafenedRef.current) {
            for (const pub of p.audioTrackPublications.values()) {
              if (pub.source === Track.Source.Microphone) {
                pub.setSubscribed(false);
              }
            }
          }
          syncScreenShareAudioSubscription(p, watchedScreenSharesRef.current.has(p.identity));
        }

        // Announce Matrix user ID via LiveKit participant attributes.
        // The lk-jwt-service uses opaque identity hashes — without this,
        // neither remote participants nor the bridge can resolve who we are.
        void setLocalParticipantAttributesSafely({ claimed_user_id: userId });

        if (aborted) {
          room.removeAllListeners();
          void room.disconnect();
          void rtcSession.leaveRoomSession?.();
          roomRef.current = null;
          rtcSessionRef.current = null;
          keyProviderRef.current?.dispose();
          keyProviderRef.current = null;
          e2eeWorkerRef.current?.terminate();
          e2eeWorkerRef.current = null;
          return;
        }

        // 9. Publish microphone (camera stays off by default)
        // If the stored deviceId doesn't exist in this browser, fall back to default device.
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch (err) {
          const isNotFound = err instanceof Error && (
            err.name === 'NotFoundError' || err.message.includes('device not found')
          );
          if (isNotFound) {
            // { deviceId: undefined } doesn't override room defaults via object spread —
            // mutate audioCaptureDefaults directly so the retry uses the default mic.
            const opts = (room as any).options;
            if (opts?.audioCaptureDefaults) delete opts.audioCaptureDefaults.deviceId;
            await room.localParticipant.setMicrophoneEnabled(true);
          } else {
            throw err;
          }
        }

        // 9b. Soundboard mixer setup — DEFERRED.
        //
        // The mixer is no longer created at join time. Swapping the raw mic
        // for a Web-Audio-mixed track at connect caused silent audio when the
        // AudioContext or destination track entered an unexpected state.
        //
        // Instead, the mixer is created on-demand the first time a soundboard
        // clip is played (see getSoundboardMixer / playSoundboardClip).
        // Until then the raw mic track stays published — zero risk of silence.
        destroySoundboardMixerSingleton(); // discard any stale instance from a prior call
        mixerRef.current = null;

        if (!aborted) {
          setLivekitRoom(room);
          setStatus('connected');
          setIsAudioEnabled(true);
          setCallJoinTime(new Date());
          setIsVideoEnabled(false);
          setIsScreenShareEnabled(false);
        }
      } catch (e) {
        if (!aborted) {
          setStatus('error');
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      }
    }

    connect();

    return () => {
      aborted = true;

      // If we were in the call (rtcSession still held) and are the last member,
      // clear the server-stored call start time so the timer resets for everyone.
      if (rtcSessionRef.current !== null && roomId) {
        if (countActiveCallMembers(mx, roomId) <= 1) {
          mx.sendStateEvent(roomId, CALL_INFO_EVENT as any, {}, '').catch(() => {});
        }
      }

      // Tear down the soundboard mixer before disconnecting the room.
      destroySoundboardMixerSingleton();
      mixerRef.current = null;
      roomRef.current?.removeAllListeners();
      void roomRef.current?.disconnect();
      roomRef.current = null;
      void rtcSessionRef.current?.leaveRoomSession?.();
      rtcSessionRef.current = null;
      keyProviderRef.current?.dispose();
      keyProviderRef.current = null;
      e2eeWorkerRef.current?.terminate();
      e2eeWorkerRef.current = null;
      setStatus('idle');
      setCallJoinTime(null);
      setLivekitRoom(null);
      // Cancel all pending speaking timers
      for (const t of activateTimers.values()) clearTimeout(t);
      for (const t of deactivateTimers.values()) clearTimeout(t);
      activateTimers.clear();
      deactivateTimers.clear();
      confirmedSpeakers.clear();
      setSpeakingUsers(new Set());
      setRemoteParticipantStates(new Map());
      setWatchedScreenShares(new Set() as ReadonlySet<string>);
    };
  }, [roomId, mx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const nextAudioQuality = {
      audioBitrate: effectiveAV.audioBitrate,
      echoCancellation: userSettings.echoCancellation,
      noiseSuppression: userSettings.noiseSuppression,
      autoGainControl: userSettings.autoGainControl,
    };
    const prevAudioQuality = prevAudioQualityRef.current;
    prevAudioQualityRef.current = nextAudioQuality;

    if (!prevAudioQuality || status !== 'connected') {
      return;
    }

    const captureChanged =
      prevAudioQuality.echoCancellation !== nextAudioQuality.echoCancellation ||
      prevAudioQuality.noiseSuppression !== nextAudioQuality.noiseSuppression ||
      prevAudioQuality.autoGainControl !== nextAudioQuality.autoGainControl;
    const publishChanged = prevAudioQuality.audioBitrate !== nextAudioQuality.audioBitrate;

    if (!captureChanged && !publishChanged) {
      return;
    }

    audioQualityUpdateRef.current = audioQualityUpdateRef.current
      .catch(() => {})
      .then(async () => {
        const room = roomRef.current;
        if (!room) {
          return;
        }

        const localParticipant = room.localParticipant;
        const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPub?.track;
        if (!(micTrack instanceof LocalAudioTrack)) {
          return;
        }

        if (captureChanged) {
          await micTrack.restartTrack(
            buildAudioCaptureDefaults({
              micDeviceId: userSettingsRef.current.micDeviceId,
              echoCancellation: userSettingsRef.current.echoCancellation,
              noiseSuppression: userSettingsRef.current.noiseSuppression,
              autoGainControl: userSettingsRef.current.autoGainControl,
            }),
          );
          // restartTrack replaces the underlying MediaStreamTrack — update the mixer
          // source so the new (recaptured) mic feeds through.
          if (mixerRef.current) {
            mixerRef.current.setMicTrack(micTrack.mediaStreamTrack);
          }
        }

        if (publishChanged) {
          await localParticipant.unpublishTrack(micTrack, false);
          await localParticipant.publishTrack(micTrack, {
            ...(micPub?.options ?? {}),
            audioPreset: bitrateToAudioPreset(effectiveAVRef.current.audioBitrate),
          });
          // After republish the track object is the same instance but update the
          // mixer source reference to be safe.
          if (mixerRef.current) {
            mixerRef.current.setMicTrack(micTrack.mediaStreamTrack);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to apply live audio quality update', err);
      });
  }, [
    effectiveAV.audioBitrate,
    status,
    userSettings.autoGainControl,
    userSettings.echoCancellation,
    userSettings.noiseSuppression,
  ]);

  // ── Speaker device switching (#30) ────────────────────────────────────────
  // When the user picks a new speaker in Settings during a call, switch it live.
  useEffect(() => {
    if (status !== 'connected' || !roomRef.current) return;
    const deviceId = userSettings.speakerDeviceId;
    if (!deviceId) return;
    roomRef.current.switchActiveDevice('audiooutput', deviceId).catch((err: unknown) => {
      console.warn('[NativeCall] switchActiveDevice(audiooutput) failed:', err);
    });
  }, [userSettings.speakerDeviceId, status]);

  // ── Audio-wins-over-video quality fallback ────────────────────────────────
  // When connection quality degrades (Poor/Lost), screenshare + camera video
  // are throttled automatically. Microphone audio is never touched.
  useAudioWinsOverVideo(roomRef, livekitRoom, status);

  // ── Control Functions ──────────────────────────────────────────────────────

  const hangUp = useCallback(() => {
    playCallSound(CallSoundType.VoiceDisconnect, { enabled: callSoundsEnabledRef.current });
    // If we're the last member, clear the server-stored call start time.
    const leaveRoomId = roomRef.current ? (rtcSessionRef.current ? roomId : null) : null;
    if (leaveRoomId && countActiveCallMembers(mx, leaveRoomId) <= 1) {
      mx.sendStateEvent(leaveRoomId, CALL_INFO_EVENT as any, {}, '').catch(() => {});
    }
    // Tear down the soundboard mixer before disconnecting the room.
    destroySoundboardMixerSingleton();
    mixerRef.current = null;
    roomRef.current?.removeAllListeners();
    void roomRef.current?.disconnect();
    roomRef.current = null;
    void rtcSessionRef.current?.leaveRoomSession?.();
    rtcSessionRef.current = null;
    keyProviderRef.current?.dispose();
    keyProviderRef.current = null;
    e2eeWorkerRef.current?.terminate();
    e2eeWorkerRef.current = null;
    setStatus('idle');
    setCallJoinTime(null);
    setLivekitRoom(null);
    setSpeakingUsers(new Set());
    setRemoteParticipantStates(new Map());
    setWatchedScreenShares(new Set() as ReadonlySet<string>);
  }, [mx, roomId]);

  const toggleAudio = useCallback(async () => {
    if (!roomRef.current) return;
    const lp = roomRef.current.localParticipant;
    const newEnabled = !lp.isMicrophoneEnabled;
    setIsAudioEnabled(newEnabled);
    playCallSound(newEnabled ? CallSoundType.Unmute : CallSoundType.Mute, { enabled: callSoundsEnabledRef.current });
    // Gate the mic branch in the Web Audio graph (clips continue unaffected).
    mixerRef.current?.setMicEnabled(newEnabled);

    // #66 Option B — PTT: update speaking state directly on mic toggle instead
    // of waiting for ActiveSpeakersChanged (which has a 180ms activation delay).
    // PTT presses are explicit user intent — no debounce needed.
    if (userSettingsRef.current.voiceActivityMode === 'ptt') {
      const localUserId = mx.getUserId() ?? '';
      setSpeakingUsers((prev) => {
        const next = new Set(prev);
        if (newEnabled) next.add(localUserId);
        else next.delete(localUserId);
        return next;
      });
    }

    await lp.setMicrophoneEnabled(newEnabled);
  }, [mx]);

  const toggleVideo = useCallback(async () => {
    if (!roomRef.current) return;
    const lp = roomRef.current.localParticipant;
    const newEnabled = !lp.isCameraEnabled;
    setIsVideoEnabled(newEnabled);
    playCallSound(newEnabled ? CallSoundType.CameraOn : CallSoundType.CameraOff, { enabled: callSoundsEnabledRef.current });
    await lp.setCameraEnabled(newEnabled);
  }, []);

  /** Flip between front and rear camera on mobile devices */
  const flipCamera = useCallback(async () => {
    if (!roomRef.current) return;
    const lp = roomRef.current.localParticipant;
    if (!lp.isCameraEnabled) {
      // Camera is off — enable it with current facing mode
      await lp.setCameraEnabled(true, { facingMode: facingModeRef.current });
      setIsFrontCamera(facingModeRef.current === 'user');
      return;
    }
    // Detect current facing mode from the live track settings
    const camPub = lp.getTrackPublication(Track.Source.Camera);
    if (camPub?.track) {
      const settings = (camPub.track as LocalVideoTrack).mediaStreamTrack.getSettings();
      const currentFacing = (settings.facingMode as 'user' | 'environment') ?? facingModeRef.current;
      facingModeRef.current = currentFacing === 'environment' ? 'user' : 'environment';
    } else {
      facingModeRef.current = facingModeRef.current === 'environment' ? 'user' : 'environment';
    }
    // Restart camera track with new facing mode
    await lp.setCameraEnabled(true, { facingMode: facingModeRef.current });
    setIsFrontCamera(facingModeRef.current === 'user');
  }, []);

  /**
   * #47 — Apply screenshare capture constraints via RoomEvent.LocalTrackPublished
   * instead of a polling loop. The event fires exactly once when the local track
   * is ready; no CPU-wasting busy-wait, no silent drop if track takes > 1 second.
   */
  const enforceScreenShareConstraints = useCallback((ssRes: string, ssFps: number) => {
    const room = roomRef.current;
    if (!room) return;

    const targetWidth = ssRes === 'source' ? undefined : resolutionToWidth(ssRes);
    const targetHeight = ssRes === 'source' ? undefined : resolutionToHeight(ssRes);
    if (!targetWidth && !targetHeight && !ssFps) return;

    const exactConstraints: MediaTrackConstraints = {
      ...(targetWidth  && { width:     { exact: targetWidth } }),
      ...(targetHeight && { height:    { exact: targetHeight } }),
      ...(ssFps        && { frameRate: { exact: ssFps } }),
    };
    const fallbackConstraints: MediaTrackConstraints = {
      ...(targetWidth  && { width:     { ideal: targetWidth,  max: targetWidth } }),
      ...(targetHeight && { height:    { ideal: targetHeight, max: targetHeight } }),
      ...(ssFps        && { frameRate: { ideal: ssFps, max: ssFps } }),
    };

    async function applyToTrack(mediaTrack: MediaStreamTrack) {
      try {
        await mediaTrack.applyConstraints(exactConstraints);
      } catch {
        await mediaTrack.applyConstraints(fallbackConstraints).catch(() => {});
      }
    }

    // Fast path: track is already published (e.g. called from updateActiveScreenShareSettings)
    const existing = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    if (existing?.track?.mediaStreamTrack) {
      void applyToTrack(existing.track.mediaStreamTrack);
      return;
    }

    // Slow path: wait for LocalTrackPublished, then self-remove
    const onPublished = (pub: { source: Track.Source; track?: { mediaStreamTrack?: MediaStreamTrack } }) => {
      if (pub.source !== Track.Source.ScreenShare) return;
      room.off(RoomEvent.LocalTrackPublished, onPublished as any);
      clearTimeout(safetyTimer);
      if (pub.track?.mediaStreamTrack) void applyToTrack(pub.track.mediaStreamTrack);
    };

    room.on(RoomEvent.LocalTrackPublished, onPublished as any);

    // Safety: remove listener after 10s if share was cancelled or never published
    const safetyTimer = setTimeout(() => {
      room.off(RoomEvent.LocalTrackPublished, onPublished as any);
    }, 10_000);
  }, []);

  const startScreenShare = useCallback(
    async (ssRes: string, ssFps: number, ssAudio: boolean) => {
      if (!roomRef.current) return;
      const captureOpts = buildSSCaptureOptions(ssRes, ssFps, ssAudio);
      const publishOpts = buildSSPublishOptions(ssRes, ssFps);
      // Register the constraint enforcer BEFORE enabling screenshare so the
      // LocalTrackPublished event is never missed (no race condition).
      enforceScreenShareConstraints(ssRes, ssFps);
      await roomRef.current.localParticipant.setScreenShareEnabled(true, captureOpts, publishOpts);
      setIsScreenShareEnabled(true);
      playCallSound(CallSoundType.ScreenShareStart, { enabled: callSoundsEnabledRef.current });
    },
    [enforceScreenShareConstraints],
  );

  const stopScreenShare = useCallback(async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setScreenShareEnabled(false);
    setIsScreenShareEnabled(false);
    playCallSound(CallSoundType.ScreenShareStop, { enabled: callSoundsEnabledRef.current });
  }, []);

  const toggleDeafen = useCallback(async () => {
    if (!roomRef.current) return;
    const next = !isDeafenedRef.current;
    isDeafenedRef.current = next;
    setIsDeafened(next);
    playCallSound(next ? CallSoundType.Deaf : CallSoundType.Undeaf, { enabled: callSoundsEnabledRef.current });

    // Subscribe/unsubscribe all remote audio tracks.
    // setSubscribed(false) stops SFU-to-client audio delivery entirely —
    // better bandwidth efficiency than locally disabling the MediaStreamTrack.
    for (const p of roomRef.current.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        pub.setSubscribed(!next);
      }
    }

    // Discord-style: deafen also mutes the mic.
    // On deafen: mute mic if it's currently live, and remember we auto-muted it.
    // On undeafen: restore mic only if we were the one who muted it —
    //   if the user manually muted before deafening, leave it muted.
    const lp = roomRef.current.localParticipant;
    if (next) {
      if (lp.isMicrophoneEnabled) {
        mutedByDeafenRef.current = true;
        setIsAudioEnabled(false);
        // Also silence the mic branch in the Web Audio graph.
        mixerRef.current?.setMicEnabled(false);
        await lp.setMicrophoneEnabled(false);
      }
    } else {
      if (mutedByDeafenRef.current) {
        mutedByDeafenRef.current = false;
        setIsAudioEnabled(true);
        // Restore mic branch in the Web Audio graph.
        mixerRef.current?.setMicEnabled(true);
        await lp.setMicrophoneEnabled(true);
      }
    }

    // Propagate deafen state as a participant attribute so the presence bridge
    // receives a participant_attributes_changed webhook and can update the SSE stream.
    void setLocalParticipantAttributesSafely({ isDeafened: next ? '1' : '0' });
  }, [setLocalParticipantAttributesSafely]);

  const watchScreenShare = useCallback(
    async (identity: string) => {
      const room = roomRef.current;
      if (!room) return;
      const participant = room.remoteParticipants.get(identity);
      if (participant) {
        // Request highest quality — screenshare is single-layer (simulcast: false)
        // so this is a hint to adaptiveStream to prioritise this track.
        for (const pub of participant.trackPublications.values()) {
          if (pub.source === Track.Source.ScreenShare && 'setVideoQuality' in pub) {
            try { (pub as any).setVideoQuality(VideoQuality.HIGH); } catch { /* best-effort */ }
          }
          if (pub.source === Track.Source.ScreenShareAudio) {
            pub.setSubscribed(true);
          }
        }
      }
      // Track is already subscribed via autoSubscribe: true — just update UI state.
      let startedWatching = false;
      setWatchedScreenShares((prev) => {
        if (prev.has(identity)) return prev;
        const next = new Set(prev);
        next.add(identity);
        startedWatching = true;
        return next as ReadonlySet<string>;
      });
      if (startedWatching) {
        playCallSound(CallSoundType.ViewerJoin, { enabled: callSoundsEnabledRef.current });
      }
    },
    [setWatchedScreenShares],
  );

  const unwatchScreenShare = useCallback(
    async (identity: string) => {
      const room = roomRef.current;
      const participant = room?.remoteParticipants.get(identity);
      if (participant) {
        syncScreenShareAudioSubscription(participant, false);
      }
      // Track stays subscribed (blurred preview remains visible).
      // Only the UI watch-state changes — overlay re-appears.
      let stoppedWatching = false;
      setWatchedScreenShares((prev) => {
        if (!prev.has(identity)) return prev;
        const next = new Set(prev);
        next.delete(identity);
        stoppedWatching = true;
        return next as ReadonlySet<string>;
      });
      if (stoppedWatching) {
        playCallSound(CallSoundType.ViewerLeave, { enabled: callSoundsEnabledRef.current });
      }
    },
    [setWatchedScreenShares, syncScreenShareAudioSubscription],
  );

  const updateActiveScreenShareSettings = useCallback(
    async (ssRes: string, ssFps: number, ssAudio: boolean) => {
      const room = roomRef.current;
      if (!room) return;
      const lp = room.localParticipant;
      if (!lp.isScreenShareEnabled) return;

      const ssPub = lp.getTrackPublication(Track.Source.ScreenShare);
      const ssTrack = ssPub?.track as LocalVideoTrack | undefined;
      if (!ssTrack) return;

      // 1. Apply capture constraints on the MediaStreamTrack
      const targetWidth = ssRes === 'source' ? undefined : resolutionToWidth(ssRes);
      const targetHeight = ssRes === 'source' ? undefined : resolutionToHeight(ssRes);
      const constraints: MediaTrackConstraints = {
        ...(targetWidth  !== undefined && { width:     { ideal: targetWidth  } }),
        ...(targetHeight !== undefined && { height:    { ideal: targetHeight } }),
        ...(ssFps        > 0           && { frameRate: { ideal: ssFps, max: ssFps } }),
      };
      if (Object.keys(constraints).length > 0) {
        await ssTrack.mediaStreamTrack.applyConstraints(constraints).catch(() => {});
      }

      // 2. Update RTCRtpSender encoding params (no track restart)
      const publishOpts = buildSSPublishOptions(ssRes, ssFps);
      const encoding = publishOpts.screenShareEncoding;
      if (encoding) {
        const sender = (ssTrack as any).sender as RTCRtpSender | undefined;
        if (sender) {
          const params = sender.getParameters();
          if (params.encodings?.length) {
            params.encodings = params.encodings.map((enc) => ({
              ...enc,
              maxBitrate:   encoding.maxBitrate,
              maxFramerate: encoding.maxFramerate ?? enc.maxFramerate,
            }));
            await sender.setParameters(params).catch(() => {});
          }
        }
      }

      // 3. Toggle ScreenShareAudio mute/unmute
      const audioPub = lp.getTrackPublication(Track.Source.ScreenShareAudio);
      if (audioPub) {
        if (ssAudio) await audioPub.unmute().catch(() => {});
        else         await audioPub.mute().catch(() => {});
      }
    },
    [],
  );

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    status,
    isReconnecting,
    livekitRoom,
    isAudioEnabled,
    isVideoEnabled,
    isScreenShareEnabled,
    isDeafened,
    isFrontCamera,
    speakingUsers,
    remoteParticipantStates,
    error,
    callJoinTime,
    soundboardActivity,
    hangUp,
    toggleAudio,
    toggleVideo,
    flipCamera,
    startScreenShare,
    stopScreenShare,
    toggleDeafen,
    watchedScreenShares,
    watchScreenShare,
    unwatchScreenShare,
    updateActiveScreenShareSettings,
  };
}

/**
 * Returns the active SoundboardMixer for the current call session, or null if
 * no call is in progress or the mixer has not been initialized yet.
 *
 * Use this from UI components to trigger soundboard clip playback:
 *
 *   const mixer = getSoundboardMixerFromEngine();
 *   if (mixer) mixer.playSoundboardClip('mxc://...', 0.8, homeserverUrl);
 */
export function getSoundboardMixerFromEngine(): SoundboardMixer | null {
  // getSoundboardMixerIfActive() returns the existing singleton only if it is
  // open, or null if no call is in progress / mixer has been torn down.
  return getSoundboardMixerIfActive();
}
