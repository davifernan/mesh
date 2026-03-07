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
import {
  WidgetApiToWidgetAction,
  WidgetApiAction,
  ClientWidgetApi,
  IWidgetApiRequestData,
} from 'matrix-widget-api';
import { ClientEvent, MatrixEvent } from 'matrix-js-sdk';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { useParams } from 'react-router-dom';
import { SmallWidget } from '../../../features/call/SmallWidget';
import { useMatrixClient } from '../../../hooks/useMatrixClient';

interface MediaStatePayload {
  data?: {
    audio_enabled?: boolean;
    video_enabled?: boolean;
  };
}

const WIDGET_MEDIA_STATE_UPDATE_ACTION = 'io.element.device_mute';
const WIDGET_HANGUP_ACTION = 'im.vector.hangup';
const WIDGET_JOIN_ACTION = 'io.element.join';
const WIDGET_TILE_UPDATE = 'io.element.tile_layout';
// NOTE: set_always_on_screen is handled by SmallWidget.ts (stickyPromise support).

interface CallContextState {
  activeCallRoomId: string | null;
  setActiveCallRoomId: (roomId: string | null, isVoiceRoom?: boolean) => void;
  viewedCallRoomId: string | null;
  setViewedCallRoomId: (roomId: string | null) => void;
  hangUp: () => void;
  activeClientWidgetApi: ClientWidgetApi | null;
  activeClientWidget: SmallWidget | null;
  registerActiveClientWidgetApi: (
    roomId: string | null,
    clientWidgetApi: ClientWidgetApi | null,
    clientWidget: SmallWidget | null,
    activeClientIframeRef: HTMLIFrameElement | null
  ) => void;
  sendWidgetAction: <T extends IWidgetApiRequestData = IWidgetApiRequestData>(
    action: WidgetApiToWidgetAction | string,
    data: T
  ) => Promise<void>;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isChatOpen: boolean;
  isCallViewOpen: boolean;
  isActiveCallReady: boolean;
  resetActiveCallReady: () => void;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleChat: () => Promise<void>;
  toggleCallView: () => void;
  speakingUsers: Set<string>;
  participantStates: Map<string, { audioEnabled: boolean; videoEnabled: boolean }>;
  screensharingUsers: Set<string>;
}

const CallContext = createContext<CallContextState | undefined>(undefined);

interface CallProviderProps {
  children: ReactNode;
}

const DEFAULT_AUDIO_ENABLED = true;
const DEFAULT_VIDEO_ENABLED = false;
const DEFAULT_CHAT_OPENED = false;

// Play a short two-note ascending/descending tone (Web Audio API).
function playCallSound(ascending: boolean) {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const freqs = ascending ? [523, 659] : [659, 523]; // C5→E5 join, E5→C5 leave
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.14);
    });
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Audio blocked or not supported
  }
}

export function CallProvider({ children }: CallProviderProps) {
  const mx = useMatrixClient();
  const [activeCallRoomId, setActiveCallRoomIdState] = useState<string | null>(null);
  const [viewedCallRoomId, setViewedCallRoomIdState] = useState<string | null>(null);

  const [activeClientWidgetApi, setActiveClientWidgetApiState] = useState<ClientWidgetApi | null>(
    null
  );
  const [activeClientWidget, setActiveClientWidget] = useState<SmallWidget | null>(null);
  const [activeClientWidgetApiRoomId, setActiveClientWidgetApiRoomId] = useState<string | null>(
    null
  );
  const [activeClientWidgetIframeRef, setActiveClientWidgetIframeRef] =
    useState<HTMLIFrameElement | null>(null);

  const [isAudioEnabled, setIsAudioEnabledState] = useState<boolean>(DEFAULT_AUDIO_ENABLED);
  const [isVideoEnabled, setIsVideoEnabledState] = useState<boolean>(DEFAULT_VIDEO_ENABLED);
  const [isChatOpen, setIsChatOpenState] = useState<boolean>(DEFAULT_CHAT_OPENED);
  const [isCallViewOpen, setIsCallViewOpenState] = useState<boolean>(false);
  const [isActiveCallReady, setIsActiveCallReady] = useState<boolean>(false);
  const isActiveCallReadyRef = useRef(isActiveCallReady);
  isActiveCallReadyRef.current = isActiveCallReady;
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [participantStates, setParticipantStates] = useState<Map<string, { audioEnabled: boolean; videoEnabled: boolean }>>(new Map());
  const [screensharingUsers, setScreensharingUsers] = useState<Set<string>>(new Set());

  const { roomIdOrAlias: viewedRoomId } = useParams<{ roomIdOrAlias: string }>();

  const setActiveCallRoomId = useCallback(
    (roomId: string | null, isVoiceRoom = false) => {
      // Kick own stale memberships from other devices before joining (Discord-style: one session at a time).
      if (roomId !== null) {
        const userId = mx.getUserId();
        const deviceId = mx.getDeviceId();
        const room = mx.getRoom(roomId);

        if (userId && deviceId && room) {
          // Compute the state key prefixes that belong to THIS device — clear everything else from us.
          const ownLegacyKey = userId;
          const ownMsc4143KeyA = `_${userId}_${deviceId}`;
          const ownMsc4143KeyB = `${userId}_${deviceId}`;

          const callMemberEvents = room
            .currentState
            .getStateEvents('org.matrix.msc3401.call.member');

          const staleKeys: string[] = [];
          for (const ev of callMemberEvents) {
            if (ev.getSender() !== userId) continue;
            const sk = ev.getStateKey();
            if (sk === undefined || sk === null) continue;
            // Skip our own current-device keys and empty/already-cleared events.
            if (sk === ownLegacyKey || sk === ownMsc4143KeyA || sk === ownMsc4143KeyB) continue;
            // Non-empty content means this device is actively registered.
            const content = ev.getContent();
            if (content && Object.keys(content).length > 0) {
              staleKeys.push(sk);
            }
          }

          for (const sk of staleKeys) {
            mx.sendStateEvent(roomId, 'org.matrix.msc3401.call.member' as any, {}, sk).catch(
              () => {
                // Best-effort: ignore errors (e.g. permission denied on already-cleared keys).
              }
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

    // Snapshot current members without playing sounds (baseline on join/room switch)
    if (initializedRef.current !== activeCallRoomId) {
      knownSendersRef.current = new Set(
        MatrixRTCSession.callMembershipsForRoom(room).map((m) => m.sender)
      );
      initializedRef.current = activeCallRoomId;
    }

    const checkMemberships = () => {
      const current = MatrixRTCSession.callMembershipsForRoom(room);
      const currentSenders = new Set(current.map((m) => m.sender));
      const known = knownSendersRef.current;

      for (const sender of currentSenders) {
        if (!known.has(sender) && sender !== myUserId) playCallSound(true);
      }
      for (const sender of known) {
        if (!currentSenders.has(sender) && sender !== myUserId) playCallSound(false);
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
  }, [activeCallRoomId, mx]);

  const setViewedCallRoomId = useCallback(
    (roomId: string | null) => {
      setViewedCallRoomIdState(roomId);
    },
    [setViewedCallRoomIdState]
  );

  const setActiveClientWidgetApi = useCallback(
    (
      clientWidgetApi: ClientWidgetApi | null,
      clientWidget: SmallWidget | null,
      roomId: string | null,
      clientWidgetIframeRef: HTMLIFrameElement | null
    ) => {
      setActiveClientWidgetApiState(clientWidgetApi);
      setActiveClientWidget(clientWidget);
      setActiveClientWidgetApiRoomId(roomId);
      setActiveClientWidgetIframeRef(clientWidgetIframeRef);
    },
    []
  );

  const registerActiveClientWidgetApi = useCallback(
    (
      roomId: string | null,
      clientWidgetApi: ClientWidgetApi | null,
      clientWidget: SmallWidget | null,
      clientWidgetIframeRef: HTMLIFrameElement | null
    ) => {
      if (roomId && clientWidgetApi) {
        setActiveClientWidgetApi(clientWidgetApi, clientWidget, roomId, clientWidgetIframeRef);
      } else if (roomId === activeClientWidgetApiRoomId || roomId === null) {
        setActiveClientWidgetApi(null, null, null, null);
      }
    },
    [activeClientWidgetApiRoomId, setActiveClientWidgetApi]
  );

  const hangUp = useCallback(() => {
    if (isActiveCallReady) playCallSound(false); // descending tone: user left call
    setActiveClientWidgetApi(null, null, null, null);
    setActiveCallRoomIdState(null);
    activeClientWidgetApi?.transport.send(`${WIDGET_HANGUP_ACTION}`, {});
    setIsActiveCallReady(false);
    setIsCallViewOpenState(false);
  }, [isActiveCallReady, activeClientWidgetApi?.transport, setActiveClientWidgetApi]);

  const sendWidgetAction = useCallback(
    async <T extends IWidgetApiRequestData = IWidgetApiRequestData>(
      action: WidgetApiToWidgetAction | string,
      data: T
    ): Promise<void> => {
      if (!activeClientWidgetApi) {
        return Promise.reject(new Error('No active call clientWidgetApi'));
      }
      if (!activeClientWidgetApiRoomId || activeClientWidgetApiRoomId !== activeCallRoomId) {
        return Promise.reject(new Error('Mismatched active call clientWidgetApi'));
      }

      await activeClientWidgetApi.transport.send(action as WidgetApiAction, data);

      return Promise.resolve();
    },
    [activeClientWidgetApi, activeCallRoomId, activeClientWidgetApiRoomId]
  );

  const toggleAudio = useCallback(async () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabledState(newState);

    if (isActiveCallReady) {
      try {
        await sendWidgetAction(WIDGET_MEDIA_STATE_UPDATE_ACTION, {
          audio_enabled: newState,
          video_enabled: isVideoEnabled,
        });
      } catch (error) {
        setIsAudioEnabledState(!newState);
        throw error;
      }
    }
  }, [isAudioEnabled, isVideoEnabled, sendWidgetAction, isActiveCallReady]);

  const toggleVideo = useCallback(async () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabledState(newState);

    if (isActiveCallReady) {
      try {
        await sendWidgetAction(WIDGET_MEDIA_STATE_UPDATE_ACTION, {
          audio_enabled: isAudioEnabled,
          video_enabled: newState,
        });
      } catch (error) {
        setIsVideoEnabledState(!newState);
        throw error;
      }
    }
  }, [isVideoEnabled, isAudioEnabled, sendWidgetAction, isActiveCallReady]);

  useEffect(() => {
    if (!activeCallRoomId && !viewedCallRoomId) {
      return;
    }

    if (!activeClientWidgetApi) {
      return;
    }

    const handleHangup = (ev: CustomEvent) => {
      ev.preventDefault();
      if (isActiveCallReadyRef.current && ev.detail.widgetId === activeClientWidgetApi.widget.id) {
        activeClientWidgetApi.transport.reply(ev.detail, {});
        setActiveCallRoomIdState(null);
        setActiveClientWidgetApi(null, null, null, null);
        setIsActiveCallReady(false);
        setIsCallViewOpenState(false);
      }
    };

    const handleMediaStateUpdate = (ev: CustomEvent<MediaStatePayload>) => {
      if (!isActiveCallReadyRef.current) return;
      ev.preventDefault();

      /* eslint-disable camelcase */
      const { audio_enabled, video_enabled } = ev.detail.data ?? {};

      if (typeof audio_enabled === 'boolean') setIsAudioEnabledState(audio_enabled);
      if (typeof video_enabled === 'boolean') setIsVideoEnabledState(video_enabled);
      /* eslint-enable camelcase */
    };

    // NOTE: set_always_on_screen is intentionally NOT handled here.
    // SmallWidget.ts handles it (with stickyPromise support + single reply).
    // Having a handler here too causes a double-reply after EC joins the lobby.

    const handleOnTileLayout = (ev: CustomEvent) => {
      ev.preventDefault();

      activeClientWidgetApi.transport.reply(ev.detail, {});
    };

    const handleSpeaking = (ev: CustomEvent<{ data?: { userId?: string; speaking?: boolean } }>) => {
      ev.preventDefault();
      activeClientWidgetApi.transport.reply(ev.detail, {});
      const { userId: speakingUserId, speaking } = ev.detail.data ?? {};
      if (typeof speakingUserId === 'string' && typeof speaking === 'boolean') {
        setSpeakingUsers((prev) => {
          const next = new Set(prev);
          if (speaking) next.add(speakingUserId);
          else next.delete(speakingUserId);
          return next;
        });
      }
    };

    const handleParticipantState = (ev: CustomEvent<{ data?: { userId?: string; audioEnabled?: boolean; videoEnabled?: boolean } }>) => {
      ev.preventDefault();
      activeClientWidgetApi.transport.reply(ev.detail, {});
      const { userId: uid, audioEnabled, videoEnabled } = ev.detail.data ?? {};
      if (typeof uid === 'string' && typeof audioEnabled === 'boolean' && typeof videoEnabled === 'boolean') {
        setParticipantStates((prev) => {
          const next = new Map(prev);
          next.set(uid, { audioEnabled, videoEnabled });
          return next;
        });
      }
    };

    const handleScreenshareState = (ev: CustomEvent<{ data?: { screensharingUserIds?: string[] } }>) => {
      ev.preventDefault();
      activeClientWidgetApi.transport.reply(ev.detail, {});
      const { screensharingUserIds } = ev.detail.data ?? {};
      if (Array.isArray(screensharingUserIds)) {
        setScreensharingUsers(new Set(screensharingUserIds));
      }
    };

    const handleJoin = (ev: CustomEvent) => {
      ev.preventDefault();

      activeClientWidgetApi.transport.reply(ev.detail, {});

      // Wrap iframe access in try-catch to prevent cross-origin errors
      // when Element Call is hosted on a different domain
      try {
        const iframeDoc =
          activeClientWidgetIframeRef?.contentWindow?.document ||
          activeClientWidgetIframeRef?.contentDocument;

        if (iframeDoc) {
          const observer = new MutationObserver(() => {
            const button = iframeDoc.querySelector('[data-testid="incall_leave"]');
            if (button) {
              button.addEventListener('click', () => {
                hangUp();
              });
            }
            observer.disconnect();
          });
          observer.observe(iframeDoc, { childList: true, subtree: true });
        }
      } catch (error) {
        // Ignore cross-origin errors - they're expected when Element Call is on a different domain
      }

      playCallSound(true); // ascending tone: user joined call
      setIsActiveCallReady(true);
    };

    activeClientWidgetApi.on(`action:${WIDGET_HANGUP_ACTION}`, handleHangup);
    activeClientWidgetApi.on(`action:${WIDGET_MEDIA_STATE_UPDATE_ACTION}`, handleMediaStateUpdate);
    activeClientWidgetApi.on(`action:${WIDGET_TILE_UPDATE}`, handleOnTileLayout);
    activeClientWidgetApi.on(`action:${WIDGET_JOIN_ACTION}`, handleJoin);
    activeClientWidgetApi.on('action:io.bettercord.speaking', handleSpeaking as EventListener);
    activeClientWidgetApi.on('action:io.bettercord.participant_state', handleParticipantState as EventListener);
    activeClientWidgetApi.on('action:io.bettercord.screenshare_state', handleScreenshareState as EventListener);

    return () => {
      activeClientWidgetApi.off(`action:${WIDGET_HANGUP_ACTION}`, handleHangup);
      activeClientWidgetApi.off(`action:${WIDGET_MEDIA_STATE_UPDATE_ACTION}`, handleMediaStateUpdate);
      activeClientWidgetApi.off(`action:${WIDGET_TILE_UPDATE}`, handleOnTileLayout);
      activeClientWidgetApi.off(`action:${WIDGET_JOIN_ACTION}`, handleJoin);
      activeClientWidgetApi.off('action:io.bettercord.speaking', handleSpeaking as EventListener);
      activeClientWidgetApi.off('action:io.bettercord.participant_state', handleParticipantState as EventListener);
      activeClientWidgetApi.off('action:io.bettercord.screenshare_state', handleScreenshareState as EventListener);
    };
  }, [
    activeClientWidgetIframeRef,
    activeClientWidgetApi,
    activeCallRoomId,
    activeClientWidgetApiRoomId,
    hangUp,
    isChatOpen,
    viewedRoomId,
    viewedCallRoomId,
    setViewedCallRoomId,
    activeClientWidget?.iframe?.contentDocument,
    activeClientWidget?.iframe?.contentWindow?.document,
  ]);

  // Separate effect: sync mute state to EC whenever it changes (without re-registering listeners)
  useEffect(() => {
    if (!activeClientWidgetApi || !isActiveCallReady) return;
    void activeClientWidgetApi.transport.send(WIDGET_MEDIA_STATE_UPDATE_ACTION as WidgetApiAction, {
      audio_enabled: isAudioEnabled,
      video_enabled: isVideoEnabled,
    } as IWidgetApiRequestData).catch(() => {});
  }, [isAudioEnabled, isVideoEnabled, isActiveCallReady, activeClientWidgetApi]);

  // Clear real-time state only when call fully ends (activeCallRoomId → null)
  useEffect(() => {
    if (!activeCallRoomId) {
      setSpeakingUsers(new Set());
      setParticipantStates(new Map());
      setScreensharingUsers(new Set());
    }
  }, [activeCallRoomId]);

  const toggleChat = useCallback(async () => {
    const newState = !isChatOpen;
    setIsChatOpenState(newState);
  }, [isChatOpen]);

  const resetActiveCallReady = useCallback(() => {
    setIsActiveCallReady(false);
  }, []);

  const toggleCallView = useCallback(() => {
    setIsCallViewOpenState((prev) => !prev);
  }, []);

  const contextValue = useMemo<CallContextState>(
    () => ({
      activeCallRoomId,
      setActiveCallRoomId,
      viewedCallRoomId,
      setViewedCallRoomId,
      hangUp,
      activeClientWidgetApi,
      registerActiveClientWidgetApi,
      activeClientWidget,
      sendWidgetAction,
      isChatOpen,
      isCallViewOpen,
      isAudioEnabled,
      isVideoEnabled,
      isActiveCallReady,
      resetActiveCallReady,
      toggleAudio,
      toggleVideo,
      toggleChat,
      toggleCallView,
      speakingUsers,
      participantStates,
      screensharingUsers,
    }),
    [
      activeCallRoomId,
      setActiveCallRoomId,
      viewedCallRoomId,
      setViewedCallRoomId,
      hangUp,
      activeClientWidgetApi,
      registerActiveClientWidgetApi,
      activeClientWidget,
      sendWidgetAction,
      isChatOpen,
      isCallViewOpen,
      isAudioEnabled,
      isVideoEnabled,
      isActiveCallReady,
      resetActiveCallReady,
      toggleAudio,
      toggleVideo,
      toggleChat,
      toggleCallView,
      speakingUsers,
      participantStates,
      screensharingUsers,
    ]
  );

  return <CallContext.Provider value={contextValue}>{children}</CallContext.Provider>;
}

export function useCallState(): CallContextState {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCallState must be used within a CallProvider');
  }
  return context;
}
