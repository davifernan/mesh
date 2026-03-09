import {
  Box,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
} from 'folds';
import {
  PhoneDisconnect,
  Microphone,
  MicrophoneSlash,
  VideoCamera,
  VideoCameraSlash,
  Monitor,
  SpeakerSlash,
} from '@phosphor-icons/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SignalStrengthIcon } from './SignalStrengthIcon';
import { IncomingCallCard } from './RoomCallNavStatusIncoming';
import { useCallMembers } from '../../hooks/useCallMemberships';
import { useAtomValue } from 'jotai';
import { ScreenShareModal } from '../../components/voice/ScreenShareModal/ScreenShareModal';
import { EventType } from 'matrix-js-sdk';
import { MatrixRTCSessionManagerEvents } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSessionManager';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { useCallState } from '../../pages/client/call/CallProvider';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { mxcUrlToHttp } from '../../utils/matrix';
import { announce } from '../../utils/announce';
import {
  getRoomNotificationMode,
  RoomNotificationMode,
  useRoomsNotificationPreferences,
} from '../../hooks/useRoomsNotificationPreferences';
import { settingsAtom } from '../../state/settings';
import * as css from './RoomCallNavStatus.css';

const timedOutCalls = new Set<string>();
const hungUpCalls = new Set<string>();

const RING_TIMEOUT_MS = 30_000;

// Play two short bursts (480Hz + 620Hz, classic POTS ring) then a pause.
function playRingCycle(ctx: AudioContext) {
  const now = ctx.currentTime;
  for (let burst = 0; burst < 2; burst++) {
    const start = now + burst * 0.5;
    const end = start + 0.4;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
    gain.gain.setValueAtTime(0.15, end - 0.04);
    gain.gain.linearRampToValueAtTime(0, end);
    [480, 620].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(start);
      osc.stop(end);
    });
  }
}

interface IncomingCall {
  roomId: string;
}

function RttChart({ history }: { history: number[] }) {
  if (history.length < 2) return null;
  const W = 200;
  const H = 40;
  const max = Math.max(...history, 1);
  const pts = history
    .map((v, i) => `${(i / (history.length - 1)) * W},${H - (v / max) * H}`)
    .join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block', margin: '4px 0' }}>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--voice-status-success)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type CallNavStatusProps = {
  docked?: boolean;
};

export function CallNavStatus({ docked = false }: CallNavStatusProps) {
  const mx = useMatrixClient();
  const {
    activeCallRoomId,
    callStatus,
    isAudioEnabled,
    isVideoEnabled,
    isScreenShareEnabled,
    isDeafened,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    hangUp,
    setActiveCallRoomId,
    speakingUsers,
    remoteParticipantStates,
    livekitRoom,
  } = useCallState();

  const myUserId = mx.getUserId() ?? '';
  const iMSpeaking = speakingUsers.has(myUserId);

  const [showSSModal, setShowSSModal] = useState(false);
  const [showVoicePopout, setShowVoicePopout] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const rttHistoryRef = useRef<number[]>([]);
  const { navigateRoom } = useRoomNavigate();

  useEffect(() => {
    if (!livekitRoom || callStatus !== 'connected') {
      setLatencyMs(null);
      return;
    }
    const update = () => {
      const lat = (livekitRoom as unknown as Record<string, unknown>)?.engine as Record<string, unknown> | undefined;
      const rawLat = lat?.latency;
      const ms = typeof rawLat === 'number' ? Math.round(rawLat) : null;
      setLatencyMs(ms);
      if (typeof ms === 'number') {
        rttHistoryRef.current = [...rttHistoryRef.current.slice(-29), ms];
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [livekitRoom, callStatus]);

  const [incomingCalls, setIncomingCalls] = useState<IncomingCall[]>([]);

  const dismissedRef = useRef<Set<string>>(new Set());
  const callTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const announcedCallRef = useRef<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const callRingtoneUrl = useAtomValue(settingsAtom).callRingtoneUrl ?? null;
  const useAuthentication = useMediaAuthentication();

  const stopRingtone = useCallback(() => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
      audioElRef.current = null;
    }
  }, []);

  const scheduleNextCycle = useCallback((ctx: AudioContext) => {
    playRingCycle(ctx);
    ringTimerRef.current = setTimeout(() => {
      if (audioCtxRef.current) scheduleNextCycle(audioCtxRef.current);
    }, 3000);
  }, []);

  const startRingtone = useCallback(() => {
    if (audioCtxRef.current || audioElRef.current) return;

    // Resolve custom ringtone URL (supports mxc:// and https://)
    const resolvedUrl = callRingtoneUrl
      ? callRingtoneUrl.startsWith('mxc://')
        ? mxcUrlToHttp(mx, callRingtoneUrl, useAuthentication)
        : callRingtoneUrl
      : null;

    if (resolvedUrl) {
      const audio = new Audio(resolvedUrl);
      audio.loop = true;
      audioElRef.current = audio;
      audio.play().catch(() => {
        // Playback failed — fall through to synthesized fallback
        audioElRef.current = null;
        try {
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          scheduleNextCycle(ctx);
        } catch {
          // Audio blocked or not supported
        }
      });
      return;
    }

    // Fallback: synthesized POTS ring
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      scheduleNextCycle(ctx);
    } catch {
      // Audio blocked or not supported
    }
  }, [callRingtoneUrl, mx, useAuthentication, scheduleNextCycle]);

  const notificationPreferences = useRoomsNotificationPreferences();
  const callRingScope = useAtomValue(settingsAtom).callRingScope ?? 'nonVoice';

  const hasActiveCall = Boolean(activeCallRoomId);
  const isConnected = hasActiveCall && callStatus === 'connected';

  const callMembers = useCallMembers(mx, activeCallRoomId ?? '');

  const clearCallTimeout = useCallback((roomId: string) => {
    const t = callTimeoutsRef.current.get(roomId);
    if (t) {
      clearTimeout(t);
      callTimeoutsRef.current.delete(roomId);
    }
  }, []);

  useEffect(
    () => () => {
      callTimeoutsRef.current.forEach((t) => clearTimeout(t));
      callTimeoutsRef.current.clear();
      stopRingtone();
    },
    [stopRingtone]
  );

  useEffect(() => {
    const myUserId = mx.getUserId();

    const addCall = (roomId: string, session: MatrixRTCSession) => {
      if (roomId === activeCallRoomId) return;
      if (dismissedRef.current.has(roomId)) return;
      if (timedOutCalls.has(roomId)) return;
      // Voice rooms are persistent channels — skip unless user opted into 'all'
      if (callRingScope !== 'all' && mx.getRoom(roomId)?.isCallRoom()) return;
      // For DM-only scope, skip non-DM rooms
      if (callRingScope === 'dm') {
        const dmContent = mx.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>();
        const dmRoomIds = new Set(Object.values(dmContent ?? {}).flat());
        if (!dmRoomIds.has(roomId)) return;
      }
      // Respect notification settings — muted rooms get no ring or bar
      if (getRoomNotificationMode(notificationPreferences, roomId) === RoomNotificationMode.Mute) return;
      const otherMembers = session.memberships.filter((m) => m.sender !== myUserId);
      if (otherMembers.length === 0) return;

      setIncomingCalls((prev) => {
        if (prev.some((c) => c.roomId === roomId)) return prev;
        return [...prev, { roomId }];
      });

      // Auto-dismiss after timeout so a missed call doesn't re-ring on tab switch
      if (!callTimeoutsRef.current.has(roomId)) {
        const t = setTimeout(() => {
          timedOutCalls.add(roomId);
          dismissedRef.current.add(roomId);
          callTimeoutsRef.current.delete(roomId);
          setIncomingCalls((prev) => prev.filter((c) => c.roomId !== roomId));
        }, RING_TIMEOUT_MS);
        callTimeoutsRef.current.set(roomId, t);
      }
    };

    for (const room of mx.getRooms()) {
      const memberships = MatrixRTCSession.callMembershipsForRoom(room);
      if (memberships.filter((m) => m.sender !== myUserId).length > 0) {
        const session = mx.matrixRTC.getRoomSession(room);
        addCall(room.roomId, session);
      }
    }

    const handleSessionStarted = (roomId: string, session: MatrixRTCSession) => {
      if (!hungUpCalls.has(roomId)) {
        timedOutCalls.delete(roomId);
        dismissedRef.current.delete(roomId);
      }
      clearCallTimeout(roomId);
      addCall(roomId, session);
    };

    const handleSessionEnded = (roomId: string) => {
      timedOutCalls.delete(roomId);
      hungUpCalls.delete(roomId);
      dismissedRef.current.delete(roomId);
      clearCallTimeout(roomId);
      setIncomingCalls((prev) => prev.filter((c) => c.roomId !== roomId));
    };

    mx.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionStarted, handleSessionStarted);
    mx.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionEnded, handleSessionEnded);

    return () => {
      mx.matrixRTC.removeListener(MatrixRTCSessionManagerEvents.SessionStarted, handleSessionStarted);
      mx.matrixRTC.removeListener(MatrixRTCSessionManagerEvents.SessionEnded, handleSessionEnded);
    };
  }, [mx, activeCallRoomId, clearCallTimeout, notificationPreferences, callRingScope]);

  const handleJoin = useCallback(
    (roomId: string) => {
      clearCallTimeout(roomId);
      setActiveCallRoomId(roomId, true);
      navigateRoom(roomId);
      setIncomingCalls((prev) => prev.filter((c) => c.roomId !== roomId));
    },
    [setActiveCallRoomId, navigateRoom, clearCallTimeout]
  );

  const handleReject = useCallback(
    (roomId: string) => {
      clearCallTimeout(roomId);
      timedOutCalls.add(roomId);
      hungUpCalls.add(roomId);
      dismissedRef.current.add(roomId);
      setIncomingCalls((prev) => prev.filter((c) => c.roomId !== roomId));
    },
    [clearCallTimeout]
  );

  const handleIgnore = useCallback(
    (roomId: string) => {
      clearCallTimeout(roomId);
      timedOutCalls.add(roomId);
      dismissedRef.current.add(roomId);
      setIncomingCalls((prev) => prev.filter((c) => c.roomId !== roomId));
    },
    [clearCallTimeout]
  );

  useEffect(() => {
    if (!hasActiveCall && incomingCalls.length > 0) {
      startRingtone();
      const firstRoomId = incomingCalls[0].roomId;
      if (announcedCallRef.current !== firstRoomId) {
        announcedCallRef.current = firstRoomId;
        const room = mx.getRoom(firstRoomId);
        announce(`Incoming call${room ? ` in ${room.name}` : ''}`);
      }
    } else {
      stopRingtone();
      announcedCallRef.current = null;
    }
    return stopRingtone;
  }, [hasActiveCall, incomingCalls, startRingtone, stopRingtone, mx]);

  if (!hasActiveCall && incomingCalls.length === 0) return null;

  if (!hasActiveCall) {
    return (
      <AnimatePresence>
        {incomingCalls.map((call, idx) => (
          <IncomingCallCard
            key={call.roomId}
            roomId={call.roomId}
            stackIndex={idx}
            onAccept={(roomId) => {
              handleJoin(roomId);
            }}
            onReject={(roomId) => {
              handleReject(roomId);
            }}
            onIgnore={(roomId) => {
              handleIgnore(roomId);
            }}
          />
        ))}
      </AnimatePresence>
    );
  }

  const channelName = activeCallRoomId
    ? mx.getRoom(activeCallRoomId)?.name ?? activeCallRoomId
    : '';

  // Build member data for the voice channel user list (all connected members)
  const memberListData = callMembers.map((userId) => {
    const isLocalUser = userId === myUserId;
    const user = mx.getUser(userId);
    const displayName = user?.displayName ?? userId;
    const mxcUrl = user?.avatarUrl;
    const httpUrl = mxcUrl
      ? mxcUrlToHttp(mx, mxcUrl, useAuthentication, 24, 24, 'crop')
      : null;
    const initials = displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? '')
      .join('');

    const remoteState = remoteParticipantStates.get(userId);
    const isMicMuted = isLocalUser
      ? !isAudioEnabled
      : !(remoteState?.audioEnabled ?? true);
    const isCameraOn = isLocalUser
      ? isVideoEnabled
      : (remoteState?.videoEnabled ?? false);
    const isSharing = isLocalUser
      ? isScreenShareEnabled
      : (remoteState?.isScreenSharing ?? false);
    const isUserDeafened = isLocalUser && isDeafened;
    const isSpeaking = speakingUsers.has(userId);

    return {
      userId, displayName, httpUrl, initials, isLocalUser,
      isMicMuted, isCameraOn, isSharing, isUserDeafened, isSpeaking,
    };
  });

  return (
    <Box direction="Column" shrink="No">
      {showSSModal && (
        <ScreenShareModal
          onConfirm={(res, fps, audio) => {
            setShowSSModal(false);
            startScreenShare(res, fps, audio).catch(() => {});
          }}
          onCancel={() => setShowSSModal(false)}
        />
      )}
      <div className={docked ? css.VoiceContainerDocked : css.VoiceContainer} style={{ position: 'relative' }}>
        {/* Voice details popout */}
        {showVoicePopout && (
          <div className={css.VoicePopout}>
            <div className={css.VoicePopoutTitle}>Voice Connection</div>
            {latencyMs !== null && (
              <div className={css.VoicePopoutRow}>
                <span>RTT</span>
                <span className={css.VoicePopoutValue}>{latencyMs} ms</span>
              </div>
            )}
            <RttChart history={rttHistoryRef.current} />
          </div>
        )}

        {/* Status row: signal icon + status text + disconnect */}
        <div className={css.StatusRow}>
          <div className={`${css.SignalIconWrap} ${isConnected ? css.SignalConnected : css.SignalConnecting}`}>
            {isConnected ? (
              <SignalStrengthIcon latencyMs={latencyMs} size={16} />
            ) : (
              <Spinner size="300" variant="Secondary" />
            )}
          </div>
          <button
            type="button"
            className={`${css.StatusLabel} ${isConnected ? css.StatusConnected : css.StatusConnecting}`}
            onClick={() => isConnected
              ? setShowVoicePopout((v) => !v)
              : activeCallRoomId && navigateRoom(activeCallRoomId)
            }
            aria-label={isConnected ? 'Toggle voice details' : 'Go to voice channel'}
            aria-expanded={isConnected ? showVoicePopout : undefined}
          >
            {isConnected ? 'Voice Connected' : 'Connecting...'}
          </button>
          <div className={css.Controls}>
            <TooltipProvider
              position="Top"
              offset={4}
              tooltip={<Tooltip><Text>Hang Up</Text></Tooltip>}
            >
              {(triggerRef) => (
                <button
                  type="button"
                  className={css.ControlButton}
                  ref={triggerRef}
                  aria-label="Hang up"
                  onClick={() => {
                    setShowVoicePopout(false);
                    if (activeCallRoomId) {
                      timedOutCalls.add(activeCallRoomId);
                      hungUpCalls.add(activeCallRoomId);
                      dismissedRef.current.add(activeCallRoomId);
                    }
                    hangUp();
                  }}
                >
                  <PhoneDisconnect size={20} weight="fill" />
                </button>
              )}
            </TooltipProvider>
          </div>
        </div>


        {/* Media section: mute + video + screenshare (3-column grid) */}
        <div className={css.MediaSection} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <TooltipProvider
            position="Top"
            offset={4}
            tooltip={<Tooltip><Text>{isAudioEnabled ? 'Mute' : 'Unmute'}</Text></Tooltip>}
          >
            {(triggerRef) => (
              <button
                type="button"
                className={css.MediaButton}
                data-muted={!isAudioEnabled}
                ref={triggerRef}
                aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                style={iMSpeaking && isAudioEnabled ? { color: '#23a55a', filter: 'drop-shadow(0 0 4px #23a55a)' } : undefined}
                onClick={() => {
                  toggleAudio();
                  announce(isAudioEnabled ? 'Microphone muted' : 'Microphone unmuted');
                }}
              >
                {isAudioEnabled ? (
                  <Microphone size={20} weight="fill" />
                ) : (
                  <MicrophoneSlash size={20} weight="fill" />
                )}
              </button>
            )}
          </TooltipProvider>
          <TooltipProvider
            position="Top"
            offset={4}
            tooltip={<Tooltip><Text>{isVideoEnabled ? 'Video Off' : 'Video On'}</Text></Tooltip>}
          >
            {(triggerRef) => (
              <button
                type="button"
                className={css.MediaButton}
                data-active={isVideoEnabled}
                ref={triggerRef}
                aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                onClick={() => {
                  toggleVideo();
                  announce(isVideoEnabled ? 'Camera off' : 'Camera on');
                }}
              >
                {isVideoEnabled ? (
                  <VideoCamera size={20} weight="fill" />
                ) : (
                  <VideoCameraSlash size={20} weight="fill" />
                )}
              </button>
            )}
          </TooltipProvider>
          <TooltipProvider
            position="Top"
            offset={4}
            tooltip={<Tooltip><Text>{isScreenShareEnabled ? 'Stop Sharing' : 'Share Screen'}</Text></Tooltip>}
          >
            {(triggerRef) => (
              <button
                type="button"
                className={css.MediaButton}
                data-active={isScreenShareEnabled}
                ref={triggerRef}
                aria-label={isScreenShareEnabled ? 'Stop sharing screen' : 'Share screen'}
                onClick={() => {
                  if (isScreenShareEnabled) {
                    stopScreenShare().catch(() => {});
                  } else {
                    setShowSSModal(true);
                  }
                }}
              >
                <Monitor size={20} weight="fill" />
              </button>
            )}
          </TooltipProvider>
        </div>
      </div>
    </Box>
  );
}
