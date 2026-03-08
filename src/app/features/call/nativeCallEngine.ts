/**
 * BetterCord — Native Call Engine
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
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { MatrixClient } from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { effectiveAVSettingsAtom } from '../../state/avQuality';
import { settingsAtom } from '../../state/settings';
import { buildLiveKitRoomOptions, buildSSCaptureOptions, type AVSettings } from './avPresets';
import { MatrixKeyProvider } from './matrixKeyProvider';
import { getSFUConfigWithOpenID } from './sfuToken';

// Vite inline worker — TypeScript doesn't know this import
// @ts-ignore
import E2EEWorker from 'livekit-client/e2ee-worker?worker&inline';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface NativeCallEngine {
  status: CallStatus;
  livekitRoom: Room | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenShareEnabled: boolean;
  isDeafened: boolean;
  speakingUsers: Set<string>;
  remoteParticipantStates: Map<string, { audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }>;
  error: Error | null;
  hangUp: () => void;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  startScreenShare: (ssRes: string, ssFps: number, ssAudio: boolean) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleDeafen: () => void;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Extracts Matrix userId from a LiveKit participant identity.
 * Legacy format: "@user:server_DEVICEID" → "@user:server"
 * New hashed format: return as-is (no leading '@' or no underscore after pos 1)
 */
function extractUserId(identity: string): string {
  if (identity.startsWith('@')) {
    const lastUnderscore = identity.lastIndexOf('_');
    if (lastUnderscore > 1) return identity.slice(0, lastUnderscore);
  }
  return identity;
}

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNativeCall(roomId: string | null): NativeCallEngine {
  const mx = useMatrixClient();

  // ── Atoms ──────────────────────────────────────────────────────────────────
  const effectiveAV = useAtomValue(effectiveAVSettingsAtom);
  const userSettings = useAtomValue(settingsAtom);

  // Refs so the connect() closure always sees fresh values without re-running
  const effectiveAVRef = useRef(effectiveAV);
  effectiveAVRef.current = effectiveAV;
  const userSettingsRef = useRef(userSettings);
  userSettingsRef.current = userSettings;

  // ── State ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<CallStatus>('idle');
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [remoteParticipantStates, setRemoteParticipantStates] = useState<Map<string, { audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }>>(new Map());
  const [error, setError] = useState<Error | null>(null);

  // ── Refs for imperative cleanup (survive re-renders) ──────────────────────
  const roomRef = useRef<Room | null>(null);
  const rtcSessionRef = useRef<any>(null);
  const e2eeWorkerRef = useRef<Worker | null>(null);
  const isDeafenedRef = useRef(false);

  // ── Main Effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    let aborted = false;

    async function connect() {
      setStatus('connecting');
      setError(null);

      try {
        const matrixRoom = mx.getRoom(roomId!);
        if (!matrixRoom) throw new Error(`Room not found: ${roomId}`);

        const userId = mx.getUserId() ?? '';
        const deviceId = mx.getDeviceId() ?? '';

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
          micDeviceId: userSettingsRef.current.micDeviceId,
          cameraDeviceId: userSettingsRef.current.cameraDeviceId,
          speakerDeviceId: userSettingsRef.current.speakerDeviceId,
        };

        // 1. Resolve LiveKit focus URL
        const serviceUrl = getFocusUrl(mx, roomId!);
        if (!serviceUrl) throw new Error('No LiveKit focus URL found in room state');

        // 2. E2EE setup (only for encrypted rooms)
        const isEncrypted = !!matrixRoom.currentState.getStateEvents('m.room.encryption', '');
        let e2eeWorker: Worker | null = null;
        let keyProvider: MatrixKeyProvider | null = null;
        let e2eeOptions: any;

        if (isEncrypted) {
          e2eeWorker = new E2EEWorker();
          keyProvider = new MatrixKeyProvider();
          e2eeOptions = { keyProvider, worker: e2eeWorker };
        }

        if (aborted) {
          e2eeWorker?.terminate();
          return;
        }

        // 3. Build LiveKit Room with AV + optional E2EE options
        const room = new Room(buildLiveKitRoomOptions(av, e2eeOptions));

        // 4. Join Matrix RTC session (writes membership state event + delayed keepalive)
        const rtcSession = (mx as any).matrixRTC.getRoomSession(matrixRoom);
        const livekitFocus = {
          type: 'livekit' as const,
          livekit_service_url: serviceUrl,
        };
        rtcSession.joinRoomSession([livekitFocus], livekitFocus, { manageMediaKeys: true });

        if (keyProvider) keyProvider.setRTCSession(rtcSession);

        if (aborted) {
          void room.disconnect();
          void rtcSession.leaveRoomSession?.();
          e2eeWorker?.terminate();
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
          void room.disconnect();
          void rtcSession.leaveRoomSession?.();
          e2eeWorker?.terminate();
          return;
        }

        // 6. Store refs so cleanup can always reach them
        roomRef.current = room;
        rtcSessionRef.current = rtcSession;
        e2eeWorkerRef.current = e2eeWorker;

        // 7. Attach event listeners

        // Helper to update remote participant state snapshot
        const updateRemote = (participant: { identity: string; isMicrophoneEnabled: boolean; isCameraEnabled: boolean; isScreenShareEnabled: boolean }, isDisconnecting = false) => {
          const userId = extractUserId(participant.identity);
          setRemoteParticipantStates((prev) => {
            const next = new Map(prev);
            if (isDisconnecting) {
              next.delete(userId);
            } else {
              next.set(userId, {
                audioEnabled: participant.isMicrophoneEnabled,
                videoEnabled: participant.isCameraEnabled,
                isScreenSharing: participant.isScreenShareEnabled,
              });
            }
            return next;
          });
        };

        // Snapshot initial remote participants already in the room
        for (const p of room.remoteParticipants.values()) {
          updateRemote(p);
        }

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setSpeakingUsers(new Set(speakers.map((s) => extractUserId(s.identity))));
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
        });
        room.on(RoomEvent.TrackUnpublished, (_pub, participant) => {
          updateRemote(participant);
        });
        room.on(RoomEvent.ParticipantConnected, (participant) => {
          updateRemote(participant);
        });
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          updateRemote(participant, true);
        });

        room.on(RoomEvent.LocalTrackPublished, (pub) => {
          if (pub.source === Track.Source.ScreenShare) setIsScreenShareEnabled(true);
        });

        room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
          if (pub.source === Track.Source.ScreenShare) setIsScreenShareEnabled(false);
        });

        room.on(RoomEvent.Disconnected, () => {
          if (!aborted) setStatus('idle');
        });

        // 8. Connect to the LiveKit SFU
        await room.connect(sfuConfig.url, sfuConfig.jwt, { autoSubscribe: true });

        if (aborted) {
          void room.disconnect();
          return;
        }

        // 9. Publish microphone (camera stays off by default)
        await room.localParticipant.setMicrophoneEnabled(true);

        if (!aborted) {
          setLivekitRoom(room);
          setStatus('connected');
          setIsAudioEnabled(true);
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
      void roomRef.current?.disconnect();
      roomRef.current = null;
      void rtcSessionRef.current?.leaveRoomSession?.();
      rtcSessionRef.current = null;
      e2eeWorkerRef.current?.terminate();
      e2eeWorkerRef.current = null;
      setStatus('idle');
      setLivekitRoom(null);
      setSpeakingUsers(new Set());
      setRemoteParticipantStates(new Map());
    };
  }, [roomId, mx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Control Functions ──────────────────────────────────────────────────────

  const hangUp = useCallback(() => {
    void roomRef.current?.disconnect();
    roomRef.current = null;
    void rtcSessionRef.current?.leaveRoomSession?.();
    rtcSessionRef.current = null;
    e2eeWorkerRef.current?.terminate();
    e2eeWorkerRef.current = null;
    setStatus('idle');
    setLivekitRoom(null);
    setSpeakingUsers(new Set());
    setRemoteParticipantStates(new Map());
  }, []);

  const toggleAudio = useCallback(async () => {
    if (!roomRef.current) return;
    const lp = roomRef.current.localParticipant;
    const newEnabled = !lp.isMicrophoneEnabled;
    setIsAudioEnabled(newEnabled);
    await lp.setMicrophoneEnabled(newEnabled);
  }, []);

  const toggleVideo = useCallback(async () => {
    if (!roomRef.current) return;
    const lp = roomRef.current.localParticipant;
    const newEnabled = !lp.isCameraEnabled;
    setIsVideoEnabled(newEnabled);
    await lp.setCameraEnabled(newEnabled);
  }, []);

  const startScreenShare = useCallback(
    async (ssRes: string, ssFps: number, ssAudio: boolean) => {
      if (!roomRef.current) return;
      const captureOpts = buildSSCaptureOptions(ssRes, ssFps, ssAudio);
      await roomRef.current.localParticipant.setScreenShareEnabled(true, captureOpts as any);
      setIsScreenShareEnabled(true);
    },
    [],
  );

  const stopScreenShare = useCallback(async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setScreenShareEnabled(false);
    setIsScreenShareEnabled(false);
  }, []);

  const toggleDeafen = useCallback(() => {
    if (!roomRef.current) return;
    const next = !isDeafenedRef.current;
    isDeafenedRef.current = next;
    setIsDeafened(next);
    for (const p of roomRef.current.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        if (pub.track) pub.track.mediaStreamTrack.enabled = !next;
      }
    }
  }, []);

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    status,
    livekitRoom,
    isAudioEnabled,
    isVideoEnabled,
    isScreenShareEnabled,
    isDeafened,
    speakingUsers,
    remoteParticipantStates,
    error,
    hangUp,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    toggleDeafen,
  };
}
