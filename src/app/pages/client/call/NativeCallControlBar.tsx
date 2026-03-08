import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Microphone,
  MicrophoneSlash,
  VideoCamera,
  VideoCameraSlash,
  MonitorArrowUp,
  Monitor,
  EyeSlash,
  PhoneDisconnect,
  ChartBar,
  ChatCircle,
  Waveform,
  SpeakerHigh,
  SpeakerSlash,
  CaretDown,
} from '@phosphor-icons/react';
import { useLocalParticipant } from '@livekit/components-react';
import { LocalAudioTrack, Track } from 'livekit-client';
import { useAtom } from 'jotai';
import { useCallState } from './CallProvider';
import { settingsAtom } from '../../../state/settings';
import { buildSSCaptureOptions, buildSSPublishOptions } from '../../../features/call/avPresets';
import { ScreenShareModal } from '../../../components/voice/ScreenShareModal/ScreenShareModal';
import { showStatsAtom } from './VoiceCallLayoutStore';
import styles from './NativeCallControlBar.module.css';

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

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
    callStatus,
    stopScreenShare,
    remoteParticipantStates,
    livekitRoom,
    callJoinTime,
  } = useCallState();

  // Screen share state comes from the LiveKit RoomContext — no polling needed.
  const { localParticipant } = useLocalParticipant();
  const isScreenShareEnabled = localParticipant.isScreenShareEnabled;

  const isWatchingScreenShare = !isScreenShareEnabled &&
    [...remoteParticipantStates.values()].some((s) => s.isScreenSharing);

  const stopWatchingScreenShare = useCallback(() => {
    if (!livekitRoom) return;
    for (const participant of livekitRoom.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.source === Track.Source.ScreenShare && pub.isSubscribed) {
          void pub.setSubscribed(false);
        }
      }
    }
  }, [livekitRoom]);

  const [userSettings, setUserSettings] = useAtom(settingsAtom);

  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showStats, setShowStats] = useAtom(showStatsAtom);
  const [noiseSupEnabled, setNoiseSupEnabled] = useState(() => userSettings.noiseSuppression ?? true);

  // ── Call duration timer ────────────────────────────────────────────────────
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (callStatus !== 'connected') return;
    const id = setInterval(() => {
      setDuration(callJoinTime ? Math.floor((Date.now() - callJoinTime.getTime()) / 1000) : 0);
    }, 1000);
    return () => clearInterval(id);
  }, [callStatus, callJoinTime]);

  // ── Device picker state ────────────────────────────────────────────────────
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [camDevices, setCamDevices] = useState<MediaDeviceInfo[]>([]);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showCamMenu, setShowCamMenu] = useState(false);

  // ── Screen share context menu ──────────────────────────────────────────────
  const [showSSMenu, setShowSSMenu] = useState(false);

  // Close menus when clicking outside
  const micMenuRef = useRef<HTMLDivElement>(null);
  const camMenuRef = useRef<HTMLDivElement>(null);
  const ssMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMicMenu && !showCamMenu && !showSSMenu) return;
    const handler = (e: MouseEvent) => {
      if (showMicMenu && micMenuRef.current && !micMenuRef.current.contains(e.target as Node)) {
        setShowMicMenu(false);
      }
      if (showCamMenu && camMenuRef.current && !camMenuRef.current.contains(e.target as Node)) {
        setShowCamMenu(false);
      }
      if (showSSMenu && ssMenuRef.current && !ssMenuRef.current.contains(e.target as Node)) {
        setShowSSMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMicMenu, showCamMenu, showSSMenu]);

  const openMicMenu = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const devices = await navigator.mediaDevices.enumerateDevices();
    setMicDevices(devices.filter((d) => d.kind === 'audioinput'));
    setShowMicMenu((v) => !v);
    setShowCamMenu(false);
    setShowSSMenu(false);
  }, []);

  const openCamMenu = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCamDevices(devices.filter((d) => d.kind === 'videoinput'));
    setShowCamMenu((v) => !v);
    setShowMicMenu(false);
    setShowSSMenu(false);
  }, []);

  const selectMicDevice = useCallback(
    (deviceId: string) => {
      setUserSettings({ ...userSettings, micDeviceId: deviceId });
      setShowMicMenu(false);
    },
    [userSettings, setUserSettings],
  );

  const selectCamDevice = useCallback(
    (deviceId: string) => {
      setUserSettings({ ...userSettings, cameraDeviceId: deviceId });
      setShowCamMenu(false);
    },
    [userSettings, setUserSettings],
  );

  // ── Screen share handler ───────────────────────────────────────────────────
  const handleScreenShare = () => {
    if (isScreenShareEnabled) {
      setShowSSMenu((v) => !v);
      setShowMicMenu(false);
      setShowCamMenu(false);
    } else {
      setShowQualityModal(true);
    }
  };

  const handleStopSharing = useCallback(() => {
    void stopScreenShare();
    setShowSSMenu(false);
  }, [stopScreenShare]);

  const handleShareSettings = useCallback(() => {
    setShowSSMenu(false);
    setShowQualityModal(true);
  }, []);

  const handleConfirmScreenShare = useCallback(
    (ssRes: string, ssFps: number, ssAudio: boolean) => {
      const captureOpts = buildSSCaptureOptions(ssRes, ssFps, ssAudio);
      const publishOpts = buildSSPublishOptions(ssRes, ssFps);
      void localParticipant.setScreenShareEnabled(true, captureOpts as any, publishOpts);
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
  const roomDisplayName = activeCallRoomId
    ? (activeCallRoomId.replace(/^!/, '').split(':')[0] ?? activeCallRoomId)
    : null;

  return (
    <>
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
          {callStatus === 'connected' && (
            <span className={styles.durationText}>{formatDuration(duration)}</span>
          )}
        </div>

        <div className={styles.controls}>
          {/* Microphone + device caret */}
          <div className={styles.btnWrap} ref={micMenuRef}>
            <button
              className={`${styles.btn} ${!isAudioEnabled ? styles.btnMuted : ''}`}
              onClick={() => void toggleAudio()}
              title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              aria-pressed={!isAudioEnabled}
            >
              {isAudioEnabled ? <Microphone size={20} /> : <MicrophoneSlash size={20} />}
            </button>
            <button
              className={styles.caretBtn}
              onClick={openMicMenu}
              title="Switch microphone"
              aria-label="Switch microphone device"
            >
              <CaretDown size={12} />
            </button>
            {showMicMenu && (
              <div className={styles.deviceMenu}>
                {micDevices.length === 0 && (
                  <div className={styles.deviceItem} style={{ color: 'var(--text-secondary)' }}>
                    No microphones found
                  </div>
                )}
                {micDevices.map((d) => (
                  <div
                    key={d.deviceId}
                    className={styles.deviceItem}
                    onClick={() => selectMicDevice(d.deviceId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && selectMicDevice(d.deviceId)}
                    aria-pressed={userSettings.micDeviceId === d.deviceId}
                    style={userSettings.micDeviceId === d.deviceId ? { color: 'var(--brand-primary)' } : undefined}
                  >
                    {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                  </div>
                ))}
              </div>
            )}
          </div>

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

          {/* Camera + device caret */}
          <div className={styles.btnWrap} ref={camMenuRef}>
            <button
              className={`${styles.btn} ${!isVideoEnabled ? styles.btnMuted : ''}`}
              onClick={() => void toggleVideo()}
              title={isVideoEnabled ? 'Disable camera' : 'Enable camera'}
              aria-label={isVideoEnabled ? 'Disable camera' : 'Enable camera'}
              aria-pressed={!isVideoEnabled}
            >
              {isVideoEnabled ? <VideoCamera size={20} /> : <VideoCameraSlash size={20} />}
            </button>
            <button
              className={styles.caretBtn}
              onClick={openCamMenu}
              title="Switch camera"
              aria-label="Switch camera device"
            >
              <CaretDown size={12} />
            </button>
            {showCamMenu && (
              <div className={styles.deviceMenu}>
                {camDevices.length === 0 && (
                  <div className={styles.deviceItem} style={{ color: 'var(--text-secondary)' }}>
                    No cameras found
                  </div>
                )}
                {camDevices.map((d) => (
                  <div
                    key={d.deviceId}
                    className={styles.deviceItem}
                    onClick={() => selectCamDevice(d.deviceId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && selectCamDevice(d.deviceId)}
                    aria-pressed={userSettings.cameraDeviceId === d.deviceId}
                    style={userSettings.cameraDeviceId === d.deviceId ? { color: 'var(--brand-primary)' } : undefined}
                  >
                    {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Screen Share + context menu when active */}
          <div className={styles.btnWrap} ref={ssMenuRef}>
            <button
              className={`${styles.btn} ${isScreenShareEnabled ? styles.btnActive : ''}`}
              onClick={handleScreenShare}
              onContextMenu={(e) => {
                if (isScreenShareEnabled) {
                  e.preventDefault();
                  setShowSSMenu(true);
                }
              }}
              title={isScreenShareEnabled ? 'Screen share options' : 'Share screen'}
              aria-label={isScreenShareEnabled ? 'Screen share options' : 'Share screen'}
              aria-pressed={isScreenShareEnabled}
            >
              {isScreenShareEnabled ? <Monitor size={20} /> : <MonitorArrowUp size={20} />}
            </button>
            {showSSMenu && (
              <div className={styles.ssMenu}>
                <div
                  className={styles.deviceItem}
                  onClick={handleStopSharing}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleStopSharing()}
                >
                  Stop Sharing
                </div>
                <div
                  className={styles.deviceItem}
                  onClick={handleShareSettings}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleShareSettings()}
                >
                  Quality Settings
                </div>
              </div>
            )}
          </div>

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

          {/* Stop Watching screen share */}
          {isWatchingScreenShare && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnActive}`}
              onClick={stopWatchingScreenShare}
              title="Stop Watching"
              aria-label="Stop watching screen share"
            >
              <EyeSlash size={20} />
            </button>
          )}

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
