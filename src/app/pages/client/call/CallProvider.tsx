import React, {
  createContext,
  useState,
  useContext,
  useMemo,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import { ClientEvent, MatrixEvent } from 'matrix-js-sdk';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import type { Room } from 'livekit-client';
import { useNativeCall, type CallStatus } from '../../../features/call/nativeCallEngine';
import { getSoundboardMixerFromEngine } from '../../../features/call/nativeCallEngine';
import { playCallSound, CallSoundType } from '../../../utils/callSounds';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useChannelAVOverride } from '../../../hooks/useChannelAVOverride';

interface CallContextState {
  activeCallRoomId: string | null;
  setActiveCallRoomId: (roomId: string | null, isVoiceRoom?: boolean) => void;
  viewedCallRoomId: string | null;
  setViewedCallRoomId: (roomId: string | null) => void;
  isCallViewOpen: boolean;
  toggleCallView: () => void;
  isChatOpen: boolean;
  toggleChat: () => void;
  hangUp: () => void;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  flipCamera: () => Promise<void>;
  startScreenShare: (ssRes: string, ssFps: number, ssAudio: boolean) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenShareEnabled: boolean;
  isDeafened: boolean;
  isReconnecting: boolean;
  isFrontCamera: boolean;
  toggleDeafen: () => Promise<void>;
  speakingUsers: Set<string>;
  remoteParticipantStates: Map<string, { audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }>;
  livekitRoom: Room | null;
  callStatus: CallStatus;
  callError: Error | null;
  callJoinTime: Date | null;
  // Soundboard
  playSoundboardClip: (url: string, volume?: number) => string | null;
  stopSoundboardClip: (clipId: string) => void;
  stopAllSoundboardClips: () => void;
  activeSoundboardClips: Set<string>;
  isSoundboardOpen: boolean;
  setSoundboardOpen: (open: boolean) => void;
  // ScreenShare watching
  watchedScreenShares: ReadonlySet<string>;
  watchScreenShare: (identity: string) => Promise<void>;
  unwatchScreenShare: (identity: string) => Promise<void>;
  updateScreenShareSettings: (ssRes: string, ssFps: number, ssAudio: boolean) => Promise<void>;
}

const CallContext = createContext<CallContextState | undefined>(undefined);

interface CallProviderProps {
  children: ReactNode;
}



export function CallProvider({ children }: CallProviderProps) {
  const mx = useMatrixClient();
  const [activeCallRoomId, setActiveCallRoomIdState] = useState<string | null>(null);
  const [viewedCallRoomId, setViewedCallRoomIdState] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpenState] = useState<boolean>(false);
  const [isCallViewOpen, setIsCallViewOpenState] = useState<boolean>(false);

  const engine = useNativeCall(activeCallRoomId);

  // Keep channelAVOverrideAtom in sync with the active call room's state event
  useChannelAVOverride(activeCallRoomId);

  // ── Soundboard state ────────────────────────────────────────────────────────
  const [isSoundboardOpen, setIsSoundboardOpenState] = useState(false);
  const [activeSoundboardClips, setActiveSoundboardClips] = useState<Set<string>>(new Set());

  const setSoundboardOpen = useCallback((open: boolean) => {
    setIsSoundboardOpenState(open);
  }, []);

  const playSoundboardClip = useCallback((url: string, volume?: number): string | null => {
    const mixer = getSoundboardMixerFromEngine();
    if (!mixer) return null;
    const clipId = mixer.playSoundboardClip(url, volume);
    setActiveSoundboardClips((prev) => new Set([...prev, clipId]));
    return clipId;
  }, []);

  const stopSoundboardClip = useCallback((clipId: string) => {
    const mixer = getSoundboardMixerFromEngine();
    mixer?.stopSoundboardClip(clipId);
    setActiveSoundboardClips((prev) => {
      const next = new Set(prev);
      next.delete(clipId);
      return next;
    });
  }, []);

  const stopAllSoundboardClips = useCallback(() => {
    const mixer = getSoundboardMixerFromEngine();
    mixer?.stopAllClips();
    setActiveSoundboardClips(new Set());
  }, []);

  const setActiveCallRoomId = useCallback(
    (roomId: string | null, isVoiceRoom = false) => {
      // Discord-style: one active session per user. Before joining, clear any
      // MSC4143 call memberships this user has from OTHER devices.
      //
      // We ONLY touch keys with the MSC4143 format that encodes the deviceId:
      //   `_${userId}_${otherDeviceId}`  (leading-underscore variant)
      //   `${userId}_${otherDeviceId}`   (no-underscore variant)
      //
      // The legacy key (stateKey === userId, no deviceId suffix) is NEVER touched —
      // it cannot be attributed to a specific device and belongs to the session EC
      // is about to create.
      if (roomId !== null) {
        const userId = mx.getUserId();
        const deviceId = mx.getDeviceId();
        const room = mx.getRoom(roomId);

        if (userId && deviceId && room) {
          const msc4143PrefixA = `_${userId}_`; // leading-underscore format
          const msc4143PrefixB = `${userId}_`;  // no-underscore format
          const ownKeyA = `${msc4143PrefixA}${deviceId}`;
          const ownKeyB = `${msc4143PrefixB}${deviceId}`;

          const callMemberEvents = room.currentState.getStateEvents(
            'org.matrix.msc3401.call.member'
          );

          for (const ev of callMemberEvents) {
            if (ev.getSender() !== userId) continue;
            const sk = ev.getStateKey();
            if (!sk) continue;

            // Extract the deviceId from the MSC4143 stateKey.
            // If neither prefix matches this is the legacy key — skip it.
            let otherDeviceId: string | null = null;
            if (sk.startsWith(msc4143PrefixA)) {
              otherDeviceId = sk.slice(msc4143PrefixA.length);
            } else if (sk.startsWith(msc4143PrefixB)) {
              otherDeviceId = sk.slice(msc4143PrefixB.length);
            } else {
              continue; // legacy key — never touch
            }

            // Skip our own current-device key.
            if (sk === ownKeyA || sk === ownKeyB) continue;
            // Skip if the extracted suffix is empty or matches our deviceId.
            if (!otherDeviceId || otherDeviceId === deviceId) continue;

            // Skip already-cleared (empty) events.
            const content = ev.getContent();
            if (!content || Object.keys(content).length === 0) continue;

            // Clear the stale other-device membership (best-effort).
            mx.sendStateEvent(roomId, 'org.matrix.msc3401.call.member' as any, {}, sk).catch(
              () => { /* ignore — key may already be gone or we lack permission */ }
            );
          }
        }
      }

      setActiveCallRoomIdState(roomId);
      if (roomId !== null) {
        // Voice rooms: show call by default. Regular/DM rooms: show chat by default.
        setIsCallViewOpenState(isVoiceRoom);
        setIsChatOpenState(!isVoiceRoom);
      }
    },
    [mx]
  );

  // Track RTC memberships and play join/leave sounds for every participant's client.
  const knownSendersRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeCallRoomId) {
      knownSendersRef.current = new Set();
      initializedRef.current = null;
      return undefined;
    }

    const room = mx.getRoom(activeCallRoomId);
    if (!room) return undefined;

    const myUserId = mx.getUserId() ?? '';
    const useMatrixMembershipSounds = !engine.livekitRoom || engine.status !== 'connected';

    // Snapshot current members without playing sounds (baseline on join/room switch)
    if (initializedRef.current !== activeCallRoomId) {
      knownSendersRef.current = new Set(
        MatrixRTCSession.callMembershipsForRoom(room)
          .map((m) => m.sender)
          .filter((s): s is string => s !== undefined)
      );
      initializedRef.current = activeCallRoomId;
    }

    const checkMemberships = () => {
      const current = MatrixRTCSession.callMembershipsForRoom(room);
      const currentSenders = new Set(
        current.map((m) => m.sender).filter((s): s is string => s !== undefined)
      );
      const known = knownSendersRef.current;

      if (useMatrixMembershipSounds) {
        for (const sender of currentSenders) {
          if (!known.has(sender) && sender !== myUserId) playCallSound(CallSoundType.UserJoin);
        }
        for (const sender of known) {
          if (!currentSenders.has(sender) && sender !== myUserId) playCallSound(CallSoundType.UserLeave);
        }
      }

      knownSendersRef.current = currentSenders;
    };

    const handleEvent = (ev: MatrixEvent) => {
      if (ev.getRoomId() === activeCallRoomId && ev.getType().includes('call.member')) {
        checkMemberships();
      }
    };

    mx.on(ClientEvent.Event, handleEvent);
    return () => {
      mx.off(ClientEvent.Event, handleEvent);
    };
  }, [activeCallRoomId, mx, engine.livekitRoom, engine.status]);


  const setViewedCallRoomId = useCallback(
    (roomId: string | null) => {
      setViewedCallRoomIdState(roomId);
    },
    [setViewedCallRoomIdState]
  );

  const hangUp = useCallback(() => {
    engine.hangUp();
    setActiveCallRoomIdState(null);
    setIsCallViewOpenState(false);
  }, [engine]);

  const toggleChat = useCallback(() => {
    setIsChatOpenState((prev) => !prev);
  }, []);

  const toggleCallView = useCallback(() => {
    setIsCallViewOpenState((prev) => !prev);
  }, []);

  const contextValue = useMemo<CallContextState>(() => ({
    activeCallRoomId,
    setActiveCallRoomId,
    viewedCallRoomId,
    setViewedCallRoomId,
    isCallViewOpen,
    toggleCallView,
    isChatOpen,
    toggleChat,
    hangUp,
    toggleAudio: engine.toggleAudio,
    toggleVideo: engine.toggleVideo,
    flipCamera: engine.flipCamera,
    startScreenShare: engine.startScreenShare,
    stopScreenShare: engine.stopScreenShare,
    isAudioEnabled: engine.isAudioEnabled,
    isVideoEnabled: engine.isVideoEnabled,
    isScreenShareEnabled: engine.isScreenShareEnabled,
    isDeafened: engine.isDeafened,
    isReconnecting: engine.isReconnecting,
    isFrontCamera: engine.isFrontCamera,
    toggleDeafen: engine.toggleDeafen,
    speakingUsers: engine.speakingUsers,
    remoteParticipantStates: engine.remoteParticipantStates,
    livekitRoom: engine.livekitRoom,
    callStatus: engine.status,
    callError: engine.error,
    callJoinTime: engine.callJoinTime,
    playSoundboardClip,
    stopSoundboardClip,
    stopAllSoundboardClips,
    activeSoundboardClips,
    isSoundboardOpen,
    setSoundboardOpen,
    watchedScreenShares: engine.watchedScreenShares,
    watchScreenShare: engine.watchScreenShare,
    unwatchScreenShare: engine.unwatchScreenShare,
    updateScreenShareSettings: engine.updateActiveScreenShareSettings,
  }), [
    activeCallRoomId,
    setActiveCallRoomId,
    viewedCallRoomId,
    setViewedCallRoomId,
    isCallViewOpen,
    toggleCallView,
    isChatOpen,
    toggleChat,
    hangUp,
    engine,
    playSoundboardClip,
    stopSoundboardClip,
    stopAllSoundboardClips,
    activeSoundboardClips,
    isSoundboardOpen,
    setSoundboardOpen,
  ]);

  return <CallContext.Provider value={contextValue}>{children}</CallContext.Provider>;
}

export function useCallState(): CallContextState {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCallState must be used within a CallProvider');
  }
  return context;
}

/** Returns the call context, or undefined if no CallProvider is mounted. */
export function useCallStateOptional(): CallContextState | undefined {
  return useContext(CallContext);
}
