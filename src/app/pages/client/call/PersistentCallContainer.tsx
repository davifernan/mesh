import React, { type ReactNode } from 'react';
import { RoomContext, RoomAudioRenderer } from '@livekit/components-react';
import { useCallState } from './CallProvider';
import { PiPOverlay } from './PiPOverlay';

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
        </RoomContext.Provider>
      )}
      {showPiP && <PiPOverlay />}
    </>
  );
}
