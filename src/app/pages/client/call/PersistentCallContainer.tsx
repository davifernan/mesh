import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
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

  const {
    activeCallRoomId,
    viewedCallRoomId,
    isActiveCallReady,
    registerActiveClientWidgetApi,
  } = useCallState();
  const mx = useMatrixClient();
  const clientConfig = useClientConfig();
  const theme = useTheme();
  const [echoCancellation] = useSetting(settingsAtom, 'echoCancellation');
  const [noiseSuppression] = useSetting(settingsAtom, 'noiseSuppression');
  const [autoGainControl] = useSetting(settingsAtom, 'autoGainControl');
  const [ssAudio] = useSetting(settingsAtom, 'ssAudio');
  const [micDeviceId] = useSetting(settingsAtom, 'micDeviceId');
  const [cameraDeviceId] = useSetting(settingsAtom, 'cameraDeviceId');
  const [speakerDeviceId] = useSetting(settingsAtom, 'speakerDeviceId');
  const effectiveAV = useAtomValue(effectiveAVSettingsAtom);

  const setupWidget = useCallback(
    (
      widgetApiRef: React.MutableRefObject<ClientWidgetApi | null>,
      smallWidgetRef: React.MutableRefObject<SmallWidget | null>,
      iframeRef: React.MutableRefObject<HTMLIFrameElement | null>,
      themeKind: ThemeKind | null,
      avSettings?: typeof effectiveAV,
    ) => {
      if (!mx?.getUserId()) return;
      if (!activeCallRoomId || isActiveCallReady) return;

      const roomIdToSet = activeCallRoomId;

      // Guard: use ref (sync) to prevent double-setup when deps change before
      // React state has propagated.
      if (smallWidgetRef.current?.roomId === roomIdToSet) return;

      const iframeElement = iframeRef.current;
      if (!iframeElement) return;

      const room = mx.getRoom(roomIdToSet);
      const { intent: intentParam, callIntentParam } = getCallIntentParams(room);

      const widgetId = `element-call-${roomIdToSet}-${Date.now()}`;
      const newUrl = getWidgetUrl(
        mx,
        roomIdToSet,
        clientConfig.elementCallUrl ?? '',
        widgetId,
        {
          intent: intentParam,
          // Voice-channel rooms: skip lobby (instant join like Discord).
          // Normal/DM rooms: omit skipLobby → BC-Call shows its lobby
          // ("Anruf beitreten"). User clicks join → BC-Call handles it directly,
          // no reload needed.
          skipLobby: room?.isCallRoom() ? true : undefined,
          returnToLobby: 'true',
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
      registerActiveClientWidgetApi(roomIdToSet, widgetApiRef.current, smallWidget, iframeElement);

      if (iframeElement.src !== newUrl.toString()) {
        iframeElement.src = newUrl.toString();
      }
    },
    [
      mx,
      activeCallRoomId,
      isActiveCallReady,
      clientConfig.elementCallUrl,
      registerActiveClientWidgetApi,
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

  useEffect(() => {
    if (activeCallRoomId) {
      setupWidget(callWidgetApiRef, callSmallWidgetRef, callIframeRef, theme.kind, effectiveAV);
    }
  }, [
    theme,
    setupWidget,
    activeCallRoomId,
    viewedCallRoomId,
    isActiveCallReady,
    effectiveAV,
  ]);

  const memoizedIframeRef = useMemo(() => callIframeRef, []);

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
