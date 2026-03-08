import React from 'react';
import { RoomContext } from '@livekit/components-react';
import { useCallState } from './CallProvider';
import { NativeCallParticipantGrid } from './NativeCallParticipantGrid';
import { NativeCallControlBar } from './NativeCallControlBar';
import styles from './NativeCallView.module.css';

export function NativeCallView() {
  const { livekitRoom, callStatus, callError } = useCallState();

  if (callStatus === 'connecting') {
    return (
      <div className={styles.statusView}>
        <div className={styles.spinner} />
        <span className={styles.statusText}>Connecting to call…</span>
      </div>
    );
  }

  if (callStatus === 'error') {
    return (
      <div className={styles.statusView}>
        <span className={styles.errorText}>
          {callError?.message ?? 'Failed to connect to call'}
        </span>
      </div>
    );
  }

  if (!livekitRoom || callStatus !== 'connected') {
    return null;
  }

  return (
    <RoomContext.Provider value={livekitRoom}>
      <div className={styles.view}>
        <NativeCallParticipantGrid />
        <NativeCallControlBar />
      </div>
    </RoomContext.Provider>
  );
}
