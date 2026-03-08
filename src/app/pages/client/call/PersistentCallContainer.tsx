import React, { type ReactNode } from 'react';
import { useCallState } from './CallProvider';
import { NativeCallView } from './NativeCallView';

interface PersistentCallContainerProps {
  children: ReactNode;
}

export function PersistentCallContainer({ children }: PersistentCallContainerProps) {
  const { activeCallRoomId, isCallViewOpen } = useCallState();

  return (
    <>
      {children}
      {activeCallRoomId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: isCallViewOpen ? 'flex' : 'none',
            flexDirection: 'column',
          }}
        >
          <NativeCallView />
        </div>
      )}
    </>
  );
}
