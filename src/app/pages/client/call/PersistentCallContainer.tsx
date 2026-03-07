import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { ClientWidgetApi } from 'matrix-widget-api';
import { Box } from 'folds';
import { useAtomValue } from 'jotai';
import { useCallState } from './CallProvider';
import {
  createVirtualWidget,
  SmallWidget,
  getWidgetData,
  getWidgetUrl,
  getCallIntentParams,
} from '../../../features/call/SmallWidget';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useClientConfig } from '../../../hooks/useClientConfig';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { ThemeKind, useTheme } from '../../../hooks/useTheme';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { effectiveAVSettingsAtom } from '../../../state/avQuality';

interface PersistentCallContainerProps {
  children: ReactNode;
}

export const CallRefContext =
  createContext<React.MutableRefObject<HTMLIFrameElement | null> | null>(null);

export function PersistentCallContainer({ children }: PersistentCallContainerProps) {
  const callIframeRef = useRef<HTMLIFrameElement | null>(null);
  const callWidgetApiRef = useRef<ClientWidgetApi | null>(null);
  const callSmallWidgetRef = useRef<SmallWidget | null>(null);
  // After a non-voice room lobby join, reload EC with join_existing for proper in-call view.
  const hasReloadedAfterLobbyRef = useRef(false);
  const postLobbyIntentRef = useRef<'join_existing' | null>(null);

  const {
    activeCallRoomId,
    viewedCallRoomId,
    isChatOpen,
    isActiveCallReady,
    registerActiveClientWidgetApi,
    activeClientWidget,
    resetActiveCallReady,
    hangUp,
  } = useCallState();
  const mx = useMatrixClient();
  const clientConfig = useClientConfig();
  const screenSize = useScreenSizeContext();
  const theme = useTheme();
  const isMobile = screenSize === ScreenSize.Mobile;
  const [callAutoJoin] = useSetting(settingsAtom, 'callAutoJoin');
  const [echoCancellation] = useSetting(settingsAtom, 'echoCancellation');
  const [noiseSuppression] = useSetting(settingsAtom, 'noiseSuppression');
  const [autoGainControl] = useSetting(settingsAtom, 'autoGainControl');
  const [ssAudio] = useSetting(settingsAtom, 'ssAudio');
  const effectiveAV = useAtomValue(effectiveAVSettingsAtom);

  /* eslint-disable no-param-reassign */

  const setupWidget = useCallback(
    (
      widgetApiRef: React.MutableRefObject<ClientWidgetApi | null>,
      smallWidgetRef: React.MutableRefObject<SmallWidget | null>,
      iframeRef: React.MutableRefObject<HTMLIFrameElement | null>,
      autoJoin: boolean,
      themeKind: ThemeKind | null,
      intentOverride?: 'join_existing',
      avSettings?: typeof effectiveAV,
    ) => {
      if (mx?.getUserId()) {
        if (activeCallRoomId && !isActiveCallReady) {
          const roomIdToSet = activeCallRoomId;

          if (
            callSmallWidgetRef.current?.roomId &&
            activeClientWidget?.roomId &&
            activeClientWidget.roomId === callSmallWidgetRef.current?.roomId
          ) {
            return;
          }

          const iframeElement = iframeRef.current;
          if (!iframeElement) {
            return;
          }

          // Determine room type to pick the correct intent and callType.
          const room = mx.getRoom(roomIdToSet);
          const { intent: intentParam, callIntentParam } = getCallIntentParams(room);
          const effectiveIntent = intentOverride ?? intentParam;
          // Only use per-participant E2EE if the room has Matrix encryption enabled.
          // Like gomuks: passing false overrides EC's own default of true for unencrypted rooms.
          const isRoomEncrypted = !!room?.currentState.getStateEvents('m.room.encryption', '');

          const widgetId = `element-call-${roomIdToSet}-${Date.now()}`;
          const newUrl = getWidgetUrl(
            mx,
            roomIdToSet,
            clientConfig.elementCallUrl ?? '',
            widgetId,
            {
              intent: effectiveIntent,
              // Skip lobby when rejoining existing session; or when autoJoin is on.
              skipLobby: intentOverride === 'join_existing' ? true : (autoJoin ? true : undefined),
              returnToLobby: 'true',
              perParticipantE2EE: isRoomEncrypted ? 'true' : 'false',
              theme: themeKind,
              callIntent: callIntentParam,
              // A/V quality constraints from space settings + user preferences
              ...(avSettings && {
                audioBitrate: String(avSettings.audioBitrate),
                videoResolution: avSettings.videoResolution,
                videoFps: String(avSettings.videoFps),
                ssResolution: avSettings.ssResolution,
                ssFps: String(avSettings.ssFps),
              }),
              // Audio processing flags from user settings
              echoCancellation,
              noiseSuppression,
              autoGainControl,
              ssAudio,
            },
          );

          const userId = mx.getUserId() ?? '';
          const app = createVirtualWidget(
            mx,
            widgetId,
            userId,
            'Element Call',
            'm.call',
            newUrl,
            // waitForIframeLoad: false — EC sends ContentLoaded when its React app is ready,
            // which triggers capabilities negotiation at the right time. With true, capabilities
            // are negotiated on iframe load (before EC is ready) and ContentLoaded gets an error
            // reply, leaving the widget channel partially broken and causing blank screen on join.
            false,
            getWidgetData(mx, roomIdToSet, {}, { callIntent: callIntentParam }),
            roomIdToSet,
          );

          const smallWidget = new SmallWidget(app);
          smallWidgetRef.current = smallWidget;

          // Start messaging BEFORE setting iframe.src — ensures the ClientWidgetApi
          // message listener is registered before the iframe navigates.
          const widgetApiInstance = smallWidget.startMessaging(iframeElement);
          widgetApiRef.current = widgetApiInstance;
          registerActiveClientWidgetApi(
            roomIdToSet,
            widgetApiRef.current,
            smallWidget,
            iframeElement,
          );

          if (!iframeElement.src || iframeElement.src !== newUrl.toString()) {
            iframeElement.src = newUrl.toString();
          }
        }
      }
    },
    [
      mx,
      activeCallRoomId,
      isActiveCallReady,
      clientConfig.elementCallUrl,
      activeClientWidget,
      registerActiveClientWidgetApi,
      callAutoJoin,
      effectiveAV,
      echoCancellation,
      noiseSuppression,
      autoGainControl,
      ssAudio,
    ],
  );

  // After any lobby join, poll until EC's call member state event has propagated to the room,
  // then reload EC with intent=join_existing + skipLobby=true so it auto-joins the existing
  // session and shows the full in-call grid. Hangs up if the session never appears.
  // This applies to all room types: DM/group rooms (start_call) and voice rooms (join_existing)
  // both hit the same timing issue where the in-call grid is not shown after the first join.
  useEffect(() => {
    if (!activeCallRoomId) {
      hasReloadedAfterLobbyRef.current = false;
      return undefined;
    }
    if (isActiveCallReady && !hasReloadedAfterLobbyRef.current) {
      const room = mx?.getRoom(activeCallRoomId);
      if (room) {
        hasReloadedAfterLobbyRef.current = true;
        const POLL_INTERVAL_MS = 200;
        const TIMEOUT_MS = 10000;
        const startTime = Date.now();
        const pollTimer = setInterval(() => {
          if (MatrixRTCSession.callMembershipsForRoom(room).length > 0) {
            clearInterval(pollTimer);
            callSmallWidgetRef.current?.stopMessaging();
            callWidgetApiRef.current = null;
            callSmallWidgetRef.current = null;
            registerActiveClientWidgetApi(activeCallRoomId, null, null, null);
            postLobbyIntentRef.current = 'join_existing';
            resetActiveCallReady();
          } else if (Date.now() - startTime >= TIMEOUT_MS) {
            clearInterval(pollTimer);
            hangUp();
          }
        }, POLL_INTERVAL_MS);
        return () => clearInterval(pollTimer);
      }
    }
    return undefined;
  }, [isActiveCallReady, activeCallRoomId, mx, registerActiveClientWidgetApi, resetActiveCallReady, hangUp]);

  useEffect(() => {
    if (activeCallRoomId) {
      const intentOverride = postLobbyIntentRef.current ?? undefined;
      postLobbyIntentRef.current = null;
      setupWidget(callWidgetApiRef, callSmallWidgetRef, callIframeRef, callAutoJoin, theme.kind, intentOverride, effectiveAV);
    }
  }, [
    theme,
    setupWidget,
    callWidgetApiRef,
    callSmallWidgetRef,
    callIframeRef,
    registerActiveClientWidgetApi,
    activeCallRoomId,
    viewedCallRoomId,
    isActiveCallReady,
    effectiveAV,
  ]);

  const memoizedIframeRef = useMemo(() => callIframeRef, [callIframeRef]);

  return (
    <CallRefContext.Provider value={memoizedIframeRef}>
      <Box grow="No">
        <Box
          direction="Column"
          style={{
            position: 'relative',
            zIndex: 0,
            display: isMobile && isChatOpen ? 'none' : 'flex',
            width: isMobile && isChatOpen ? '0%' : '100%',
            height: isMobile && isChatOpen ? '0%' : '100%',
          }}
        >
          <Box
            grow="Yes"
            style={{
              position: 'relative',
            }}
          >
            <iframe
              ref={callIframeRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                display: 'flex',
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title="Persistent Element Call"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-downloads"
              allow="microphone; camera; display-capture; autoplay; clipboard-write;"
              src="about:blank"
            />
          </Box>
        </Box>
      </Box>
      {children}
    </CallRefContext.Provider>
  );
}
