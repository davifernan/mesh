import React, { useState, useCallback } from 'react';
import {
  Microphone,
  MicrophoneSlash,
  VideoCamera,
  VideoCameraSlash,
  MonitorArrowUp,
  Monitor,
  PhoneDisconnect,
  ChartBar,
  ChatCircle,
  Waveform,
  SpeakerHigh,
  SpeakerSlash,
} from '@phosphor-icons/react';
import { useLocalParticipant } from '@livekit/components-react';
import { LocalAudioTrack, Track } from 'livekit-client';
import { useAtom } from 'jotai';
import { useCallState } from './CallProvider';
import { settingsAtom } from '../../../state/settings';
import { buildSSCaptureOptions } from '../../../features/call/avPresets';
import { ScreenShareModal } from '../../../components/voice/ScreenShareModal/ScreenShareModal';
import { BCStatsPanel } from './BCStatsPanel';
import styles from './NativeCallControlBar.module.css';

export function NativeCallControlBar() {
  const {
    hangUp,
    toggleAudio,
    toggleVideo,
    isAudioEnabled,
    isVideoEnabled,
    isChatOpen,
    toggleChat,
    activeCallRoomId,
    isDeafened,
    toggleDeafen,
  } = useCallState();

  // Screen share state comes from the LiveKit RoomContext — no polling needed.
  const { localParticipant } = useLocalParticipant();
  const isScreenShareEnabled = localParticipant.isScreenShareEnabled;

  const [userSettings, setUserSettings] = useAtom(settingsAtom);

  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [noiseSupEnabled, setNoiseSupEnabled] = useState(() => userSettings.noiseSuppression ?? true);

  const handleScreenShare = () => {
    if (isScreenShareEnabled) {
      void localParticipant.setScreenShareEnabled(false);
    } else {
      setShowQualityModal(true);
    }
  };

  const handleConfirmScreenShare = useCallback(
    (ssRes: string, ssFps: number, ssAudio: boolean) => {
      const captureOpts = buildSSCaptureOptions(ssRes, ssFps, ssAudio);
      void localParticipant.setScreenShareEnabled(true, captureOpts as any, { simulcast: false });
      setShowQualityModal(false);
    },
    [localParticipant],
  );

  const handleToggleNoiseSup = useCallback(async () => {
    const next = !noiseSupEnabled;
    setNoiseSupEnabled(next);
    setUserSettings({ ...userSettings, noiseSuppression: next });
    const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
    if (pub?.track) {
      // Pass ALL audio constraints — restartTrack replaces the track entirely,
      // so omitting any constraint would reset it to browser defaults.
      await (pub.track as LocalAudioTrack).restartTrack({
        noiseSuppression: next,
        echoCancellation: userSettings.echoCancellation,
        autoGainControl: userSettings.autoGainControl,
        deviceId: userSettings.micDeviceId,
      });
    }
  }, [noiseSupEnabled, localParticipant, userSettings, setUserSettings]);

  // Derive a human-readable room display name from the Matrix room ID.
  // Matrix room IDs look like "!opaque:server" — strip the leading "!" and
  // show only the local part before the colon for brevity.
  const roomDisplayName = activeCallRoomId
    ? (activeCallRoomId.replace(/^!/, '').split(':')[0] ?? activeCallRoomId)
    : null;

  return (
    <>
      {showStats && (
        <div className={styles.statsWrapper}>
          <BCStatsPanel onClose={() => setShowStats(false)} />
        </div>
      )}
      {showQualityModal && (
        <ScreenShareModal
          onConfirm={handleConfirmScreenShare as any}
          onCancel={() => setShowQualityModal(false)}
        />
      )}
      <div className={styles.bar}>
        <div className={styles.leftSection}>
          {roomDisplayName && (
            <span className={styles.roomName} title={activeCallRoomId ?? undefined}>
              {roomDisplayName}
            </span>
          )}
        </div>

        <div className={styles.controls}>
          {/* Microphone */}
          <button
            className={`${styles.btn} ${!isAudioEnabled ? styles.btnMuted : ''}`}
            onClick={() => void toggleAudio()}
            title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            aria-pressed={!isAudioEnabled}
          >
            {isAudioEnabled ? <Microphone size={20} /> : <MicrophoneSlash size={20} />}
          </button>

          {/* Deafen */}
          <button
            className={`${styles.btn} ${isDeafened ? styles.btnMuted : ''}`}
            onClick={toggleDeafen}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
            aria-label={isDeafened ? 'Undeafen' : 'Deafen'}
            aria-pressed={isDeafened}
          >
            {isDeafened ? <SpeakerSlash size={20} /> : <SpeakerHigh size={20} />}
          </button>

          {/* Camera */}
          <button
            className={`${styles.btn} ${!isVideoEnabled ? styles.btnMuted : ''}`}
            onClick={() => void toggleVideo()}
            title={isVideoEnabled ? 'Disable camera' : 'Enable camera'}
            aria-label={isVideoEnabled ? 'Disable camera' : 'Enable camera'}
            aria-pressed={!isVideoEnabled}
          >
            {isVideoEnabled ? <VideoCamera size={20} /> : <VideoCameraSlash size={20} />}
          </button>

          {/* Screen Share */}
          <button
            className={`${styles.btn} ${isScreenShareEnabled ? styles.btnActive : ''}`}
            onClick={handleScreenShare}
            title={isScreenShareEnabled ? 'Stop screen share' : 'Share screen'}
            aria-label={isScreenShareEnabled ? 'Stop screen share' : 'Share screen'}
            aria-pressed={isScreenShareEnabled}
          >
            {isScreenShareEnabled ? <Monitor size={20} /> : <MonitorArrowUp size={20} />}
          </button>

          {/* Noise Suppression */}
          <button
            className={`${styles.btn} ${noiseSupEnabled ? styles.btnActive : styles.btnMuted}`}
            onClick={() => void handleToggleNoiseSup()}
            title={noiseSupEnabled ? 'Noise suppression on' : 'Noise suppression off'}
            aria-label={noiseSupEnabled ? 'Disable noise suppression' : 'Enable noise suppression'}
            aria-pressed={noiseSupEnabled}
          >
            <Waveform size={20} />
          </button>

          {/* Stats */}
          <button
            className={`${styles.btn} ${showStats ? styles.btnActive : ''}`}
            onClick={() => setShowStats((s) => !s)}
            title="Call stats"
            aria-label="Toggle call stats"
            aria-pressed={showStats}
          >
            <ChartBar size={20} />
          </button>

          {/* Chat */}
          <button
            className={`${styles.btn} ${isChatOpen ? styles.btnActive : ''}`}
            onClick={() => void toggleChat()}
            title={isChatOpen ? 'Hide chat' : 'Show chat'}
            aria-label={isChatOpen ? 'Hide chat' : 'Show chat'}
            aria-pressed={isChatOpen}
          >
            <ChatCircle size={20} />
          </button>

          {/* Hang up */}
          <button
            className={`${styles.btn} ${styles.btnHangup}`}
            onClick={hangUp}
            title="Leave call"
            aria-label="Leave call"
          >
            <PhoneDisconnect size={20} />
          </button>
        </div>

        <div className={styles.rightSection} />
      </div>
    </>
  );
}
