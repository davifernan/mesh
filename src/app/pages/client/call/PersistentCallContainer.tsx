import React, { type ReactNode } from 'react';
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
  const { activeCallRoomId, callStatus, isCallViewOpen } = useCallState();

  // Show PiP when in a connected call but the call view is not open
  // (user has navigated away from the voice channel room).
  const showPiP = activeCallRoomId !== null && callStatus === 'connected' && !isCallViewOpen;

  return (
    <>
      {children}
      {showPiP && <PiPOverlay />}
    </>
  );
}
