import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from '@phosphor-icons/react';
import { RoomContext, RoomAudioRenderer, useAudioPlayback } from '@livekit/components-react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallState } from './CallProvider';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { NativeCallParticipantGrid } from './NativeCallParticipantGrid';
import { NativeCallControlBar } from './NativeCallControlBar';
import { BCStatsPanel } from './BCStatsPanel';
import { showStatsAtom } from './VoiceCallLayoutStore';
import styles from './NativeCallView.module.css';

function useVoiceHUDIdle(timeoutMs = 3000) {
  const [isActive, setIsActive] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const activate = useCallback(() => {
    setIsActive(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsActive(false), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    timerRef.current = setTimeout(() => setIsActive(false), timeoutMs);
    return () => clearTimeout(timerRef.current);
  }, [timeoutMs]);

  return { isActive, activate };
}

/** Shows an "Allow Audio" overlay when browser autoplay is blocked */
function AudioUnblockButton() {
  const { canPlayAudio } = useAudioPlayback();
  if (canPlayAudio) return null;
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
    }}>
      <button
        type="button"
        style={{
          background: 'var(--brand-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: '9999px',
          padding: '12px 28px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={() => {
          // LiveKit's useAudioPlayback / startAudio is triggered by any user gesture;
          // rendering this button inside RoomContext means clicking it unblocks audio.
        }}
      >
        Allow Audio
      </button>
    </div>
  );
}

export function NativeCallView() {
  const { livekitRoom, callStatus, callError, activeCallRoomId, toggleCallView } = useCallState();
  const mx = useMatrixClient();
  const screenSize = useScreenSizeContext();
  const isMobileLike = screenSize !== ScreenSize.Desktop;
  const { isActive, activate } = useVoiceHUDIdle(3000);
  const showStats = useAtomValue(showStatsAtom);
  const setShowStats = useSetAtom(showStatsAtom);

  const roomName = activeCallRoomId ? (mx.getRoom(activeCallRoomId)?.name ?? '') : '';

  useEffect(() => {
    const wakeHud = () => activate();
    window.addEventListener('keydown', wakeHud);
    window.addEventListener('touchstart', wakeHud, { passive: true });
    return () => {
      window.removeEventListener('keydown', wakeHud);
      window.removeEventListener('touchstart', wakeHud);
    };
  }, [activate]);

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
      className={`${styles.voiceRoot}${(isActive || isMobileLike) ? ` ${styles.pointerActive}` : ''}`}
      onPointerMove={activate}
      onPointerDown={activate}
      onTouchStart={activate}
      onFocusCapture={activate}
      onKeyDownCapture={activate}
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
        {/* RoomAudioRenderer lives in PersistentCallContainer — no duplicate here */}

        {/* Autoplay unblock overlay — shown when browser blocks audio autoplay */}
        <AudioUnblockButton />

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
