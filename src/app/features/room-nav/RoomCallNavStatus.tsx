import {
  Box,
  Chip,
  Icon,
  IconButton,
  Icons,
  Line,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
  color,
} from 'folds';
import {
  WifiHigh,
  PhoneDisconnect,
  Microphone,
  MicrophoneSlash,
  VideoCamera,
  VideoCameraSlash,
  Monitor,
  DotsThree,
  ChartBar,
  Waveform,
} from '@phosphor-icons/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

// Module-level: persists across tab switches (Direct/Home/Space each mount their own CallNavStatus).
// Stores rooms where the ring timed out so we don't re-ring on remount.
const timedOutCalls = new Set<string>();
// Rooms the user explicitly hung up or dismissed — SessionStarted won't clear these,
// so the call can't re-ring until it truly ends (SessionEnded) and restarts.
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

export function CallNavStatus() {
  const mx = useMatrixClient();
  const {
    activeCallRoomId,
    isActiveCallReady,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    hangUp,
    setActiveCallRoomId,
    sendWidgetAction,
  } = useCallState();

  const [showSSModal, setShowSSModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuWrapRef = useRef<HTMLDivElement>(null);
  const { navigateRoom } = useRoomNavigate();

  // Close more menu when clicking outside of it
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuWrapRef.current && !moreMenuWrapRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showMoreMenu]);

  const [incomingCalls, setIncomingCalls] = useState<IncomingCall[]>([]);
  const [callPage, setCallPage] = useState(0);

  const dismissedRef = useRef<Set<string>>(new Set());
  // Per-call ring timeout handles
  const callTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Track which incoming call we've already announced to avoid re-announcing on re-render
  const announcedCallRef = useRef<string | null>(null);

  // Ringtone
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
  const isConnected = hasActiveCall && isActiveCallReady;

  const clearCallTimeout = useCallback((roomId: string) => {
    const t = callTimeoutsRef.current.get(roomId);
    if (t) {
      clearTimeout(t);
      callTimeoutsRef.current.delete(roomId);
    }
  }, []);

  // Clean up all per-call timeouts on unmount
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
      // New session means a fresh call — clear timeout/dismiss state, UNLESS the user
      // explicitly hung up or dismissed this room (hungUpCalls). In that case, keep
      // suppressing the ring until SessionEnded confirms the call truly ended.
      if (!hungUpCalls.has(roomId)) {
        timedOutCalls.delete(roomId);
        dismissedRef.current.delete(roomId);
      }
      clearCallTimeout(roomId);
      addCall(roomId, session);
    };

    const handleSessionEnded = (roomId: string) => {
      // Session truly ended — clear all state including explicit hang-up, allow re-ring next time.
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

  const handleDismiss = useCallback(
    (roomId: string) => {
      clearCallTimeout(roomId);
      timedOutCalls.add(roomId);
      hungUpCalls.add(roomId);
      dismissedRef.current.add(roomId);
      setIncomingCalls((prev) => prev.filter((c) => c.roomId !== roomId));
    },
    [clearCallTimeout]
  );

  // Ring while incoming calls are waiting; announce the first call to screen readers
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

  // Clamp page index when calls list shrinks
  const safeIndex = Math.min(callPage, Math.max(0, incomingCalls.length - 1));

  if (!hasActiveCall && incomingCalls.length === 0) return null;

  // Incoming call(s) with pagination
  if (!hasActiveCall) {
    const current = incomingCalls[safeIndex];
    const room = mx.getRoom(current.roomId);
    const total = incomingCalls.length;

    return (
      <Box direction="Column" shrink="No">
        <Line variant="Surface" size="300" />
        <Box
          className={css.Actions}
          direction="Row"
          alignItems="Center"
          gap="100"
          style={{ borderLeft: `3px solid ${color.Warning.Main}` }}
        >
          {/* Prev/next pagination — only when multiple calls */}
          {total > 1 && (
            <IconButton
              fill="None"
              size="300"
              onClick={() => setCallPage((p) => Math.max(0, p - 1))}
              disabled={safeIndex === 0}
              aria-label="Previous incoming call"
            >
              <Icon src={Icons.ChevronLeft} size="50" />
            </IconButton>
          )}

          <Box className={css.RoomButtonWrap} grow="Yes">
            <TooltipProvider
              position="Top"
              offset={4}
              tooltip={
                <Tooltip>
                  <Text>Join call</Text>
                </Tooltip>
              }
            >
              {(triggerRef) => (
                <Chip
                  id="incoming-call-join"
                  size="500"
                  fill="Soft"
                  as="button"
                  aria-label={`Join call${room ? ` in ${room.name}` : ''}`}
                  onClick={() => handleJoin(current.roomId)}
                  ref={triggerRef}
                  className={css.RoomButton}
                >
                  <Icon size="300" src={Icons.Phone} style={{ color: color.Warning.Main }} />
                  <Text as="span" size="L400" style={{ color: color.Warning.Main }} truncate>
                    {room?.name ?? current.roomId}
                    {total > 1 && ` (${safeIndex + 1}/${total})`}
                  </Text>
                </Chip>
              )}
            </TooltipProvider>
          </Box>

          {total > 1 && (
            <IconButton
              fill="None"
              size="300"
              onClick={() => setCallPage((p) => Math.min(total - 1, p + 1))}
              disabled={safeIndex === total - 1}
              aria-label="Next incoming call"
            >
              <Icon src={Icons.ChevronRight} size="50" />
            </IconButton>
          )}

          <TooltipProvider
            position="Top"
            offset={4}
            tooltip={
              <Tooltip>
                <Text>Dismiss</Text>
              </Tooltip>
            }
          >
            {(triggerRef) => (
              <IconButton
                fill="None"
                size="300"
                ref={triggerRef}
                aria-label="Dismiss incoming call"
                onClick={() => {
                  handleDismiss(current.roomId);
                  setCallPage((p) => Math.max(0, p - 1));
                }}
              >
                <Icon src={Icons.Cross} />
              </IconButton>
            )}
          </TooltipProvider>
        </Box>
      </Box>
    );
  }

  // Active call — Fluxer-style voice connection panel
  return (
    <Box direction="Column" shrink="No">
      {showSSModal && (
        <ScreenShareModal
          onConfirm={(res, fps, audio) => {
            setShowSSModal(false);
            // Tell BetterCord-Call to start screenshare with the chosen quality settings.
            // BC-Call's InCallView listens for this action and calls toggleScreenSharing
            // with the provided overrides (ssResolution, ssFps, ssAudio).
            sendWidgetAction('io.bettercord.screenshare_start', {
              ssResolution: res,
              ssFps: fps,
              ssAudio: audio,
            }).catch(() => {});
          }}
          onCancel={() => setShowSSModal(false)}
        />
      )}
      <Line variant="Surface" size="300" />
      <div className={css.VoiceContainer}>
        {/* Status row: signal icon + status text + disconnect */}
        <div className={css.StatusRow}>
          <div className={`${css.SignalIconWrap} ${isConnected ? css.SignalConnected : css.SignalConnecting}`}>
            {isConnected ? (
              <WifiHigh size={16} weight="fill" />
            ) : (
              <Spinner size="300" variant="Secondary" />
            )}
          </div>
          <button
            type="button"
            className={`${css.StatusLabel} ${isConnected ? css.StatusConnected : css.StatusConnecting}`}
            onClick={() => activeCallRoomId && navigateRoom(activeCallRoomId)}
            aria-label="Go to voice channel"
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

        {/* Channel source row: room name link */}
        <div className={css.ChannelSourceRow}>
          <button
            type="button"
            className={css.ChannelSourceLink}
            onClick={() => activeCallRoomId && navigateRoom(activeCallRoomId)}
            aria-label="Go to room"
          >
            {activeCallRoomId ? mx.getRoom(activeCallRoomId)?.name ?? activeCallRoomId : ''}
          </button>
        </div>

        {/* Media section: mute + video + screenshare + more (4-column grid) */}
        <div className={css.MediaSection} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
            tooltip={<Tooltip><Text>Share Screen</Text></Tooltip>}
          >
            {(triggerRef) => (
              <button
                type="button"
                className={css.MediaButton}
                ref={triggerRef}
                aria-label="Share screen"
                onClick={() => setShowSSModal(true)}
              >
                <Monitor size={20} weight="fill" />
              </button>
            )}
          </TooltipProvider>
          {/* More menu: Stats + Noise Suppression */}
          <div className={css.MoreMenuWrap} ref={moreMenuWrapRef}>
            {showMoreMenu && (
              <div className={css.MoreMenu}>
                <button
                  type="button"
                  className={css.MoreMenuItem}
                  onClick={() => {
                    sendWidgetAction('io.bettercord.toggle_stats', {}).catch(() => {});
                    setShowMoreMenu(false);
                  }}
                >
                  <ChartBar size={14} weight="fill" />
                  Connection Stats
                </button>
                <button
                  type="button"
                  className={css.MoreMenuItem}
                  onClick={() => {
                    sendWidgetAction('io.bettercord.toggle_noise', {}).catch(() => {});
                    setShowMoreMenu(false);
                  }}
                >
                  <Waveform size={14} weight="fill" />
                  Noise Suppression
                </button>
              </div>
            )}
            <TooltipProvider
              position="Top"
              offset={4}
              tooltip={<Tooltip><Text>More</Text></Tooltip>}
            >
              {(triggerRef) => (
                <button
                  type="button"
                  className={css.MediaButton}
                  ref={triggerRef}
                  aria-label="More options"
                  onClick={() => setShowMoreMenu((v) => !v)}
                >
                  <DotsThree size={20} weight="bold" />
                </button>
              )}
            </TooltipProvider>
          </div>
        </div>
      </div>
    </Box>
  );
}
