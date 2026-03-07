import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { ClientWidgetApi } from 'matrix-widget-api';
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
  // After a lobby join, reload EC with join_existing for proper in-call view.
  const hasReloadedAfterLobbyRef = useRef(false);
  const postLobbyIntentRef = useRef<'join_existing' | null>(null);

  const {
    activeCallRoomId,
    viewedCallRoomId,
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
  const [micDeviceId] = useSetting(settingsAtom, 'micDeviceId');
  const [cameraDeviceId] = useSetting(settingsAtom, 'cameraDeviceId');
  const [speakerDeviceId] = useSetting(settingsAtom, 'speakerDeviceId');
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

          const room = mx.getRoom(roomIdToSet);
          const { intent: intentParam, callIntentParam } = getCallIntentParams(room);
          const effectiveIntent = intentOverride ?? intentParam;

          const widgetId = `element-call-${roomIdToSet}-${Date.now()}`;
          const newUrl = getWidgetUrl(
            mx,
            roomIdToSet,
            clientConfig.elementCallUrl ?? '',
            widgetId,
            {
              intent: effectiveIntent,
              // Voice-channel rooms and autoJoin: skip lobby (instant join).
              // Normal/DM rooms: show lobby ("Anruf beitreten") — omitting skipLobby
              // lets BC-Call show its lobby. Post-lobby reload uses join_existing.
              skipLobby: intentOverride === 'join_existing' ? true : (autoJoin || room?.isCallRoom() ? true : undefined),
              returnToLobby: 'true',
              // Always per-participant E2EE — matching Element Web/X behaviour.
              // Passing false breaks key exchange even in unencrypted rooms.
              perParticipantE2EE: 'true',
              theme: themeKind,
              callIntent: callIntentParam,
              ...(avSettings && {
                audioBitrate: String(avSettings.audioBitrate),
                videoResolution: avSettings.videoResolution,
                videoFps: String(avSettings.videoFps),
                ssResolution: avSettings.ssResolution,
                ssFps: String(avSettings.ssFps),
              }),
              echoCancellation,
              noiseSuppression,
              autoGainControl,
              ssAudio,
              micDeviceId,
              cameraDeviceId,
              speakerDeviceId,
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
            false,
            getWidgetData(mx, roomIdToSet, {}, { callIntent: callIntentParam }),
            roomIdToSet,
          );

          const smallWidget = new SmallWidget(app);
          smallWidgetRef.current = smallWidget;

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
      micDeviceId,
      cameraDeviceId,
      speakerDeviceId,
    ],
  );

  // After a lobby join, poll until the call membership has propagated,
  // then reload with join_existing + skipLobby so the in-call grid appears.
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
      <div style={{ width: 0, height: 0, overflow: 'hidden', flexShrink: 0 }}>
        <iframe
          ref={callIframeRef}
          style={{
            width: 1,
            height: 1,
            border: 'none',
            backgroundColor: 'var(--background-header-primary)',
            colorScheme: 'dark',
          }}
          title="Persistent Element Call"
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-downloads"
          allow="microphone; camera; display-capture; autoplay; clipboard-write;"
          src="about:blank"
        />
      </div>
      {children}
    </CallRefContext.Provider>
  );
}
