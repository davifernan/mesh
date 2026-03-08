import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from '@phosphor-icons/react';
import { RoomContext } from '@livekit/components-react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallState } from './CallProvider';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { NativeCallParticipantGrid } from './NativeCallParticipantGrid';
import { NativeCallControlBar } from './NativeCallControlBar';
import { BCStatsPanel } from './BCStatsPanel';
import { showStatsAtom } from './VoiceCallLayoutStore';
import styles from './NativeCallView.module.css';

function useVoiceHUDIdle(timeoutMs = 3000) {
  const [isActive, setIsActive] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handlePointerMove = useCallback(() => {
    setIsActive(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsActive(false), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    timerRef.current = setTimeout(() => setIsActive(false), timeoutMs);
    return () => clearTimeout(timerRef.current);
  }, [timeoutMs]);

  return { isActive, handlePointerMove };
}

export function NativeCallView() {
  const { livekitRoom, callStatus, callError, activeCallRoomId, toggleCallView } = useCallState();
  const mx = useMatrixClient();
  const { isActive, handlePointerMove } = useVoiceHUDIdle(3000);
  const showStats = useAtomValue(showStatsAtom);
  const setShowStats = useSetAtom(showStatsAtom);

  const roomName = activeCallRoomId ? (mx.getRoom(activeCallRoomId)?.name ?? '') : '';

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
    <div
      className={`${styles.voiceRoot}${isActive ? ` ${styles.pointerActive}` : ''}`}
      onPointerMove={handlePointerMove}
    >
      {/* Header chrome (auto-hiding) */}
      <div className={styles.voiceHeader}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={toggleCallView}
          aria-label="Minimize call"
        >
          <X size={18} weight="bold" />
        </button>
        <span className={styles.channelName}>{roomName}</span>
        <div className={styles.connectionStatus} data-status={callStatus}>
          <span className={styles.statusDot} />
          <span className={styles.connectionStatusText}>
            {callStatus === 'connected'
              ? 'Voice Connected'
              : callStatus === 'connecting'
              ? 'Connecting…'
              : callStatus === 'error'
              ? 'Connection Error'
              : ''}
          </span>
        </div>
      </div>

      {/* RoomContext wraps grid, stats panel, and control bar */}
      <RoomContext.Provider value={livekitRoom}>
        {/* Main content — fills all remaining space */}
        <NativeCallParticipantGrid />

        {/* Stats panel — floating top-right, NOT inside HUD opacity layer */}
        {showStats && (
          <div className={styles.statsWrap}>
            <BCStatsPanel onClose={() => setShowStats(false)} />
          </div>
        )}

        {/* Control bar — floating pill at bottom-center (auto-hiding) */}
        <div className={styles.controlBarWrap}>
          <NativeCallControlBar />
        </div>
      </RoomContext.Provider>
    </div>
  );
}
