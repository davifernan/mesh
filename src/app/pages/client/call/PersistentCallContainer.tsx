import React, { type ReactNode } from 'react';
import { RoomContext, RoomAudioRenderer, useAudioPlayback } from '@livekit/components-react';
import { useCallState } from './CallProvider';
import { PiPOverlay } from './PiPOverlay';

function AudioUnblockButton() {
  const { canPlayAudio, startAudio } = useAudioPlayback();
  if (canPlayAudio) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 300,
    }}>
      <button
        type="button"
        style={{
          background: 'var(--brand-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: '9999px',
          padding: '10px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
        onClick={() => startAudio()}
      >
        Allow Audio
      </button>
    </div>
  );
}

interface PersistentCallContainerProps {
  children: ReactNode;
}

// Phase 0: Fixed overlay removed — NativeCallView is now rendered inline
// inside Room.tsx's call panel so the sidebar always stays visible.
//
// Phase 6: PiP overlay — shown when the user navigates away from the call
// room while still connected. Condition: activeCallRoomId !== null AND
// callStatus === 'connected' AND isCallViewOpen === false.
export function PersistentCallContainer({ children }: PersistentCallContainerProps) {
  const { activeCallRoomId, callStatus, isCallViewOpen, livekitRoom } = useCallState();

  const isConnected = activeCallRoomId !== null && callStatus === 'connected' && livekitRoom !== null;
  const showPiP = isConnected && !isCallViewOpen;

  return (
    <>
      {children}
      {/* RoomAudioRenderer lives here so remote audio plays regardless of which
          view is open. PiPOverlay and NativeCallView handle video only. */}
      {isConnected && (
        <RoomContext.Provider value={livekitRoom}>
          <RoomAudioRenderer />
          <AudioUnblockButton />
        </RoomContext.Provider>
      )}
      {showPiP && <PiPOverlay />}
    </>
  );
}
