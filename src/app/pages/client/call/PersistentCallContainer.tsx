import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { ClientWidgetApi, WidgetApiAction } from 'matrix-widget-api';
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
  // Timer ref for the preload auto-join delay; cleared on unmount/room change.
  const preloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    activeCallRoomId,
    viewedCallRoomId,
    isActiveCallReady,
    registerActiveClientWidgetApi,
    activeClientWidget,
  } = useCallState();
  const mx = useMatrixClient();
  const clientConfig = useClientConfig();
  const theme = useTheme();
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
          const isVoiceRoom = room?.isCallRoom() ?? false;

          const widgetId = `element-call-${roomIdToSet}-${Date.now()}`;
          const newUrl = getWidgetUrl(
            mx,
            roomIdToSet,
            clientConfig.elementCallUrl ?? '',
            widgetId,
            {
              intent: intentParam,
              // Always skip the lobby UI — for voice rooms and autoJoin we jump in immediately.
              // For normal group/DM rooms we also skip the lobby but use preload=true so
              // BC-Call waits for an explicit io.element.join from BetterCord (sent after a
              // short delay, giving MatrixRTC membership events time to arrive → no audio race).
              skipLobby: true,
              // preload=true tells BC-Call to wait for io.element.join before joining LiveKit.
              // Only needed for non-voice rooms; voice channels join immediately (no race risk).
              preload: (!isVoiceRoom && !autoJoin) ? 'true' : undefined,
              returnToLobby: 'true',
              // Always use per-participant E2EE — Element Web and Element X both always pass true.
              // Passing false breaks key exchange with other clients even in unencrypted rooms,
              // because the SFU still uses the per-participant key protocol for MatrixRTC.
              perParticipantE2EE: 'true',
              theme: themeKind,
              callIntent: callIntentParam,
              // A/V quality constraints from space settings + user preferences
              ...(avSettings && {
                audioBitrate: String(avSettings.audioBitrate),
                videoResolution: avSettings.videoResolution,
                videoFps: String(avSettings.videoFps),
                ssResolution: avSettings.ssResolution,
                ssFps: String(avSettings.ssFps),
                // ssAudio is NOT part of effectiveAV — it comes from user settings directly below
              }),
              // Audio processing flags from user settings
              echoCancellation,
              noiseSuppression,
              autoGainControl,
              ssAudio,
              // Device selections
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
      micDeviceId,
      cameraDeviceId,
      speakerDeviceId,
    ],
  );

  // Preload auto-join: after the widget API is ready, wait for MatrixRTC memberships
  // to arrive (short delay), then send io.element.join to BC-Call so it connects to
  // LiveKit only after memberships are known → eliminates the audio race condition.
  // This fires for non-voice rooms (preload=true in URL); voice rooms join immediately.
  useEffect(() => {
    if (!activeCallRoomId) {
      if (preloadTimerRef.current) {
        clearTimeout(preloadTimerRef.current);
        preloadTimerRef.current = null;
      }
      return undefined;
    }

    // Only trigger when the widget API is registered but the call isn't ready yet
    if (!callWidgetApiRef.current || isActiveCallReady) return undefined;

    const widgetApi = callWidgetApiRef.current;
    const room = mx?.getRoom(activeCallRoomId);
    const isVoiceRoom = room?.isCallRoom() ?? false;

    // Voice rooms skip preload — they already join immediately via skipLobby=true
    if (isVoiceRoom || callAutoJoin) return undefined;

    const smallWidget = callSmallWidgetRef.current;
    if (!smallWidget) return undefined;

    // sendJoin: fire after 1500ms so MatrixRTC membership sync has time to run
    const sendJoin = () => {
      preloadTimerRef.current = setTimeout(() => {
        preloadTimerRef.current = null;
        widgetApi.transport
          .send('io.element.join' as WidgetApiAction, {
            audioInput: null,
            videoInput: null,
          })
          .catch(() => {
            // Ignore: iframe may have been destroyed before join fires
          });
      }, 1500);
    };

    // SmallWidget re-emits 'ready' from its internal messaging once capabilities are done.
    // Use `once` — if ready fires before this effect runs we'll miss it, but the effect
    // dependency on callWidgetApiRef.current means it runs right after setupWidget creates
    // the SmallWidget (before React yields to the iframe), so the race window is tiny.
    smallWidget.once('ready', sendJoin);

    return () => {
      smallWidget.off('ready', sendJoin);
      if (preloadTimerRef.current) {
        clearTimeout(preloadTimerRef.current);
        preloadTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callWidgetApiRef.current, isActiveCallReady, activeCallRoomId]);

  useEffect(() => {
    if (activeCallRoomId) {
      setupWidget(callWidgetApiRef, callSmallWidgetRef, callIframeRef, callAutoJoin, theme.kind, effectiveAV);
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
      {/* The iframe lives here purely to persist across route changes.
          CallView.tsx teleports it via position:fixed onto its ghost div.
          This box must stay in the DOM but take zero layout space. */}
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
