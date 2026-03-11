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
import { Room, RoomEvent, Track, LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import type { MatrixClient } from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';
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
import { resolveParticipantUserId } from './participantIdentity';
import { publishCallPresenceState } from './callPresenceState';
import { CALL_INFO_EVENT } from '../../hooks/useCallMemberships';
import { getSFUConfigWithOpenID } from './sfuToken';
import { useAudioWinsOverVideo } from './callQualityFallback';
import { playCallSound, CallSoundType, setCallSoundsVolume } from '../../utils/callSounds';

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
  isFrontCamera: boolean;
  speakingUsers: Set<string>;
  remoteParticipantStates: Map<string, { audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }>;
  error: Error | null;
  callJoinTime: Date | null;
  hangUp: () => void;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  flipCamera: () => Promise<void>;
  startScreenShare: (ssRes: string, ssFps: number, ssAudio: boolean) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleDeafen: () => Promise<void>;
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
  const { livekitServiceUrl: configServiceUrl } = useClientConfig();
  const configServiceUrlRef = useRef(configServiceUrl);
  configServiceUrlRef.current = configServiceUrl;

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
  // Tracks current camera facing mode for mobile flip toggle ('user' | 'environment')
  const facingModeRef = useRef<'user' | 'environment'>('user');
  // Reactive state so tiles can conditionally mirror only the front camera
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [remoteParticipantStates, setRemoteParticipantStates] = useState<Map<string, { audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }>>(new Map());
  const [error, setError] = useState<Error | null>(null);
  const [callJoinTime, setCallJoinTime] = useState<Date | null>(null);

  // ── Refs for imperative cleanup (survive re-renders) ──────────────────────
  const roomRef = useRef<Room | null>(null);
  const rtcSessionRef = useRef<any>(null);
  const e2eeWorkerRef = useRef<Worker | null>(null);
  const isDeafenedRef = useRef(false);
  // True when the mic was muted automatically by deafen (so we can restore it on undeafen).
  // Stays false if the user manually muted before deafening — we don't touch their manual mute.
  const mutedByDeafenRef = useRef(false);

  // Refs for publishing call presence to Matrix state (io.bettercord.call.presence)
  // These mirror the latest local AV state so the publish helper always has fresh values.
  const presenceRoomIdRef = useRef<string | null>(null);
  const presenceUserIdRef = useRef<string>('');
  const presenceDeviceIdRef = useRef<string>('');
  const presenceAudioRef = useRef(true);    // mic enabled
  const presenceVideoRef = useRef(false);   // camera enabled
  const presenceSSRef = useRef(false);      // screenshare enabled
  const presenceDeafRef = useRef(false);    // deafened

  const prevAudioQualityRef = useRef<{
    audioBitrate: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  } | null>(null);
  const audioQualityUpdateRef = useRef<Promise<void>>(Promise.resolve());

  // ── Presence publisher ─────────────────────────────────────────────────────
  // Best-effort: publish local AV state as a Matrix room state event so observers
  // outside the call can read mute/camera/screenshare/deafen badges.
  const publishPresence = useCallback((overrides?: {
    isMicMuted?: boolean;
    isCameraOn?: boolean;
    isScreenSharing?: boolean;
    isDeafened?: boolean;
  }) => {
    const roomId = presenceRoomIdRef.current;
    const userId = presenceUserIdRef.current;
    const deviceId = presenceDeviceIdRef.current;
    if (!roomId || !userId || !deviceId) return;

    const state = {
      isMicMuted: overrides?.isMicMuted ?? !presenceAudioRef.current,
      isCameraOn: overrides?.isCameraOn ?? presenceVideoRef.current,
      isScreenSharing: overrides?.isScreenSharing ?? presenceSSRef.current,
      isDeafened: overrides?.isDeafened ?? presenceDeafRef.current,
    };

    publishCallPresenceState(mx, roomId, userId, deviceId, state).catch(() => {
      // Network or permissions error — not fatal
    });
  }, [mx]);

  const clearPresence = useCallback(() => {
    const roomId = presenceRoomIdRef.current;
    const userId = presenceUserIdRef.current;
    const deviceId = presenceDeviceIdRef.current;
    presenceRoomIdRef.current = null;
    if (!roomId || !userId || !deviceId) return;
    publishCallPresenceState(mx, roomId, userId, deviceId, null).catch(() => {});
  }, [mx]);

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
            'No LiveKit focus URL found. Set BETTERCORD_LIVEKIT_URL (Docker) or livekitServiceUrl in config.json.',
          );
        }

        // 2. E2EE setup — disabled, LiveKit uses DTLS-SRTP transport encryption
        let e2eeWorker: Worker | null = null;
        let e2eeOptions: any;

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

        // Write call start time if we are the first joiner.
        // All clients (in-call or not) read this Matrix state event for the timer.
        // activeAtJoin is read BEFORE our membership event is confirmed on the server,
        // so 0 reliably means no one else was in the call.
        if (countActiveCallMembers(mx, roomId!) === 0) {
          void mx.sendStateEvent(
            roomId!,
            CALL_INFO_EVENT as any,
            { started_at: Date.now() },
            '',
          );
        }

        // Store refs IMMEDIATELY after joinRoomSession so the cleanup function
        // can always call leaveRoomSession() — even if an error is thrown below.
        // Previously these were set later (after getSFUConfigWithOpenID), meaning
        // any error between joinRoomSession and that point left an orphaned delayed
        // event that fired after ~8s and wiped the membership.
        roomRef.current = room;
        rtcSessionRef.current = rtcSession;
        e2eeWorkerRef.current = e2eeWorker;

        if (keyProvider) keyProvider.setRTCSession(rtcSession);

        if (aborted) {
          void room.disconnect();
          void rtcSession.leaveRoomSession?.();
          roomRef.current = null;
          rtcSessionRef.current = null;
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
          void room.disconnect();
          void rtcSession.leaveRoomSession?.();
          roomRef.current = null;
          rtcSessionRef.current = null;
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
          const userId = resolveParticipantUserId(participant, matrixRoom);
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
          const nextSpeakers = new Set(
            speakers.map((speaker) => resolveParticipantUserId(speaker, matrixRoom))
          );
          if (room.localParticipant.isSpeaking) {
            nextSpeakers.add(userId);
          }
          setSpeakingUsers(nextSpeakers);
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
          playCallSound(CallSoundType.UserJoin, { enabled: callSoundsEnabledRef.current });
          // If currently deafened, mute this new participant's audio tracks immediately
          if (isDeafenedRef.current) {
            for (const pub of participant.audioTrackPublications.values()) {
              if (pub.track) pub.track.mediaStreamTrack.enabled = false;
            }
          }
        });
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          updateRemote(participant, true);
          playCallSound(CallSoundType.UserLeave, { enabled: callSoundsEnabledRef.current });
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
          // Store identity refs for presence publishing
          presenceRoomIdRef.current = roomId!;
          presenceUserIdRef.current = userId;
          presenceDeviceIdRef.current = deviceId;
          presenceAudioRef.current = true;
          presenceVideoRef.current = false;
          presenceSSRef.current = false;
          presenceDeafRef.current = false;

          setLivekitRoom(room);
          setStatus('connected');
          setIsAudioEnabled(true);
          setCallJoinTime(new Date());
          setIsVideoEnabled(false);
          setIsScreenShareEnabled(false);

          // Publish initial presence (mic live, camera/SS/deafen off)
          publishCallPresenceState(mx, roomId!, userId, deviceId, {
            isMicMuted: false,
            isCameraOn: false,
            isScreenSharing: false,
            isDeafened: false,
          }).catch(() => {});
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

      // Clear persisted presence before disconnecting
      const leaveRoomId = presenceRoomIdRef.current;
      const leaveUserId = presenceUserIdRef.current;
      const leaveDeviceId = presenceDeviceIdRef.current;
      presenceRoomIdRef.current = null;
      if (leaveRoomId && leaveUserId && leaveDeviceId) {
        publishCallPresenceState(mx, leaveRoomId, leaveUserId, leaveDeviceId, null).catch(() => {});
      }

      void roomRef.current?.disconnect();
      roomRef.current = null;
      void rtcSessionRef.current?.leaveRoomSession?.();
      rtcSessionRef.current = null;
      e2eeWorkerRef.current?.terminate();
      e2eeWorkerRef.current = null;
      setStatus('idle');
      setCallJoinTime(null);
      setLivekitRoom(null);
      setSpeakingUsers(new Set());
      setRemoteParticipantStates(new Map());
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
        }

        if (publishChanged) {
          await localParticipant.unpublishTrack(micTrack, false);
          await localParticipant.publishTrack(micTrack, {
            ...(micPub?.options ?? {}),
            audioPreset: bitrateToAudioPreset(effectiveAVRef.current.audioBitrate),
          });
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

  // ── Audio-wins-over-video quality fallback ────────────────────────────────
  // When connection quality degrades (Poor/Lost), screenshare + camera video
  // are throttled automatically. Microphone audio is never touched.
  useAudioWinsOverVideo(roomRef, livekitRoom, status);

  // ── Control Functions ──────────────────────────────────────────────────────

  const hangUp = useCallback(() => {
    playCallSound(CallSoundType.VoiceDisconnect, { enabled: callSoundsEnabledRef.current });
    // Capture room id before clearPresence() nulls presenceRoomIdRef.
    const leaveRoomId = presenceRoomIdRef.current;
    // If we're the last member, clear the server-stored call start time.
    if (leaveRoomId && countActiveCallMembers(mx, leaveRoomId) <= 1) {
      mx.sendStateEvent(leaveRoomId, CALL_INFO_EVENT as any, {}, '').catch(() => {});
    }
    clearPresence();
    void roomRef.current?.disconnect();
    roomRef.current = null;
    void rtcSessionRef.current?.leaveRoomSession?.();
    rtcSessionRef.current = null;
    e2eeWorkerRef.current?.terminate();
    e2eeWorkerRef.current = null;
    setStatus('idle');
    setCallJoinTime(null);
    setLivekitRoom(null);
    setSpeakingUsers(new Set());
    setRemoteParticipantStates(new Map());
  }, [clearPresence]);

  const toggleAudio = useCallback(async () => {
    if (!roomRef.current) return;
    const lp = roomRef.current.localParticipant;
    const newEnabled = !lp.isMicrophoneEnabled;
    presenceAudioRef.current = newEnabled;
    setIsAudioEnabled(newEnabled);
    playCallSound(newEnabled ? CallSoundType.Unmute : CallSoundType.Mute, { enabled: callSoundsEnabledRef.current });
    await lp.setMicrophoneEnabled(newEnabled);
    publishPresence({ isMicMuted: !newEnabled });
  }, [publishPresence]);

  const toggleVideo = useCallback(async () => {
    if (!roomRef.current) return;
    const lp = roomRef.current.localParticipant;
    const newEnabled = !lp.isCameraEnabled;
    presenceVideoRef.current = newEnabled;
    setIsVideoEnabled(newEnabled);
    playCallSound(newEnabled ? CallSoundType.CameraOn : CallSoundType.CameraOff, { enabled: callSoundsEnabledRef.current });
    await lp.setCameraEnabled(newEnabled);
    publishPresence({ isCameraOn: newEnabled });
  }, [publishPresence]);

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

  const enforceScreenShareConstraints = useCallback(async (ssRes: string, ssFps: number) => {
    if (!roomRef.current) return;

    let mediaTrack: MediaStreamTrack | undefined;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const ssPub = roomRef.current.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const track = ssPub?.track as LocalVideoTrack | undefined;
      mediaTrack = track?.mediaStreamTrack;
      if (mediaTrack?.applyConstraints) {
        break;
      }
      await new Promise((resolve) => {
        window.setTimeout(resolve, 100);
      });
    }

    if (!mediaTrack?.applyConstraints) return;

    const targetWidth = ssRes === 'source' ? undefined : resolutionToWidth(ssRes);
    const targetHeight = ssRes === 'source' ? undefined : resolutionToHeight(ssRes);

    const exactConstraints: MediaTrackConstraints = {
      ...(targetWidth && { width: { exact: targetWidth } }),
      ...(targetHeight && { height: { exact: targetHeight } }),
      ...(ssFps ? { frameRate: { exact: ssFps } } : {}),
    };

    const fallbackConstraints: MediaTrackConstraints = {
      ...(targetWidth && { width: { ideal: targetWidth, max: targetWidth } }),
      ...(targetHeight && { height: { ideal: targetHeight, max: targetHeight } }),
      ...(ssFps ? { frameRate: { ideal: ssFps, max: ssFps } } : {}),
    };

    try {
      if (Object.keys(exactConstraints).length > 0) {
        await mediaTrack.applyConstraints(exactConstraints);
      }
    } catch {
      if (Object.keys(fallbackConstraints).length > 0) {
        await mediaTrack.applyConstraints(fallbackConstraints).catch(() => {});
      }
    }
  }, []);

  const startScreenShare = useCallback(
    async (ssRes: string, ssFps: number, ssAudio: boolean) => {
      if (!roomRef.current) return;
      const captureOpts = buildSSCaptureOptions(ssRes, ssFps, ssAudio);
      const publishOpts = buildSSPublishOptions(ssRes, ssFps);
      await roomRef.current.localParticipant.setScreenShareEnabled(true, captureOpts, publishOpts);
      await enforceScreenShareConstraints(ssRes, ssFps);
      presenceSSRef.current = true;
      setIsScreenShareEnabled(true);
      playCallSound(CallSoundType.ScreenShareStart, { enabled: callSoundsEnabledRef.current });
      publishPresence({ isScreenSharing: true });
    },
    [enforceScreenShareConstraints, publishPresence],
  );

  const stopScreenShare = useCallback(async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setScreenShareEnabled(false);
    presenceSSRef.current = false;
    setIsScreenShareEnabled(false);
    playCallSound(CallSoundType.ScreenShareStop, { enabled: callSoundsEnabledRef.current });
    publishPresence({ isScreenSharing: false });
  }, [publishPresence]);

  const toggleDeafen = useCallback(async () => {
    if (!roomRef.current) return;
    const next = !isDeafenedRef.current;
    isDeafenedRef.current = next;
    presenceDeafRef.current = next;
    setIsDeafened(next);
    playCallSound(next ? CallSoundType.Deaf : CallSoundType.Undeaf, { enabled: callSoundsEnabledRef.current });

    // Mute/unmute all remote audio output locally (deafen is client-side only in LiveKit)
    for (const p of roomRef.current.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        if (pub.track) pub.track.mediaStreamTrack.enabled = !next;
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
        presenceAudioRef.current = false;
        setIsAudioEnabled(false);
        await lp.setMicrophoneEnabled(false);
        publishPresence({ isMicMuted: true });
      }
    } else {
      if (mutedByDeafenRef.current) {
        mutedByDeafenRef.current = false;
        presenceAudioRef.current = true;
        setIsAudioEnabled(true);
        await lp.setMicrophoneEnabled(true);
        publishPresence({ isMicMuted: false });
      }
    }

    // Propagate deafen state as a participant attribute so the presence bridge
    // receives a participant_attributes_changed webhook and can update the SSE stream.
    void roomRef.current.localParticipant.setAttributes({ isDeafened: next ? '1' : '0' });
    publishPresence({ isDeafened: next });
  }, [publishPresence]);

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    status,
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
    hangUp,
    toggleAudio,
    toggleVideo,
    flipCamera,
    startScreenShare,
    stopScreenShare,
    toggleDeafen,
  };
}
