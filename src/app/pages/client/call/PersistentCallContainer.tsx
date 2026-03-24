import React, { useEffect, useState, type ReactNode } from 'react';
import { RoomContext, RoomAudioRenderer } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { useCallState } from './CallProvider';

interface PersistentCallContainerProps {
  children: ReactNode;
}

// NativeCallView is rendered inline inside Room.tsx's call panel so the sidebar
// stays visible. The old PiP overlay remains intentionally disabled for now
// because its minimize/restore flow is broken and should not appear when the
// user closes the call view.
export function PersistentCallContainer({ children }: PersistentCallContainerProps) {
  const { activeCallRoomId, callStatus, livekitRoom } = useCallState();

  const isConnected = activeCallRoomId !== null && callStatus === 'connected' && livekitRoom !== null;

  // #63 — Track audio-blocked state at this level so the unblock button is
  // visible even when the call view is minimized / closed (PiP mode).
  // The button must be rendered outside NativeCallView for it to always work.
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    if (!livekitRoom) { setAudioBlocked(false); return; }
    setAudioBlocked(!livekitRoom.canPlaybackAudio);
    const handler = () => setAudioBlocked(!livekitRoom.canPlaybackAudio);
    livekitRoom.on(RoomEvent.AudioPlaybackStatusChanged, handler);
    return () => { livekitRoom.off(RoomEvent.AudioPlaybackStatusChanged, handler); };
  }, [livekitRoom]);

  return (
    <>
      {children}
      {/* RoomAudioRenderer lives here so remote audio plays regardless of which
          view is open. PiPOverlay and NativeCallView handle video only. */}
      {isConnected && (
        <RoomContext.Provider value={livekitRoom}>
          <RoomAudioRenderer />
        </RoomContext.Provider>
      )}
      {/* #63 — AudioUnblockButton: always visible when audio is blocked,
           even in PiP / minimized mode. Positioned fixed so it floats above UI. */}
      {isConnected && audioBlocked && (
        <button
          type="button"
          onClick={() => livekitRoom?.startAudio().catch(() => {})}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '16px',
            zIndex: 9999,
            background: '#5865f2',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          Audio freischalten
        </button>
      )}
    </>
  );
}
