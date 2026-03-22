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
  CaretDown,
  ArrowsClockwise,
  MusicNote,
  Rocket,
  CornersOut,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useAtom } from 'jotai';
import { useCallState } from './CallProvider';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { settingsAtom } from '../../../state/settings';
import { ScreenShareModal } from '../../../components/voice/ScreenShareModal/ScreenShareModal';
import { SoundboardPanel } from '../../../components/soundboard';
import { showStatsAtom } from './VoiceCallLayoutStore';
import { ActivityPicker } from './ActivityPicker';
import { ConnectionQualityBadge } from './ConnectionQualityBadge';
import styles from './NativeCallControlBar.module.css';

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function NativeCallControlBar() {
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;
  const mx = useMatrixClient();

  const {
    hangUp,
    toggleAudio,
    toggleVideo,
    flipCamera,
    isAudioEnabled,
    isVideoEnabled,
    isChatOpen,
    toggleChat,
    toggleCallView,
    activeCallRoomId,
    callStatus,
    isReconnecting,
    startScreenShare,
    stopScreenShare,
    toggleScreenShareAudio,
    isScreenShareAudioEnabled,
    livekitRoom,
    callJoinTime,
    isSoundboardOpen,
    setSoundboardOpen,
    updateScreenShareSettings,
    watchedScreenShares,
    unwatchScreenShare,
  } = useCallState();

  // Screen share state comes from the LiveKit RoomContext — no polling needed.
  const { localParticipant } = useLocalParticipant();
  const isScreenShareEnabled = localParticipant.isScreenShareEnabled;
  // Audio cannot be enabled mid-share if no ScreenShareAudio track exists yet.
  // The track is only published when the share starts with ssAudio=true.
  const hasScreenShareAudioTrack = !!localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
  const audioLockedMidShare = isScreenShareEnabled && !hasScreenShareAudioTrack;

  const isWatchingScreenShare = watchedScreenShares.size > 0;

  const stopWatchingAll = useCallback(() => {
    for (const identity of watchedScreenShares) {
      void unwatchScreenShare(identity);
    }
  }, [watchedScreenShares, unwatchScreenShare]);

  const [userSettings, setUserSettings] = useAtom(settingsAtom);

  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showStats, setShowStats] = useAtom(showStatsAtom);

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
  const [showActivities, setShowActivities] = useState(false);
  const activitiesRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  const micMenuRef = useRef<HTMLDivElement>(null);
  const camMenuRef = useRef<HTMLDivElement>(null);
  const ssMenuRef = useRef<HTMLDivElement>(null);
  const soundboardMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anyOpen = showMicMenu || showCamMenu || showSSMenu || isSoundboardOpen;
    if (!anyOpen) return;
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
      if (isSoundboardOpen && soundboardMenuRef.current && !soundboardMenuRef.current.contains(e.target as Node)) {
        setSoundboardOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMicMenu, showCamMenu, showSSMenu, isSoundboardOpen, setSoundboardOpen]);

  const toggleActivities = useCallback(() => {
    setShowActivities((v) => !v);
    setShowMicMenu(false);
    setShowCamMenu(false);
    setShowSSMenu(false);
  }, []);

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
      // Apply immediately to the live call — no rejoin needed
      if (livekitRoom) {
        void livekitRoom.switchActiveDevice('audioinput', deviceId);
      }
    },
    [userSettings, setUserSettings, livekitRoom],
  );

  const selectCamDevice = useCallback(
    (deviceId: string) => {
      setUserSettings({ ...userSettings, cameraDeviceId: deviceId });
      setShowCamMenu(false);
      // Apply immediately to the live call — no rejoin needed
      if (livekitRoom) {
        void livekitRoom.switchActiveDevice('videoinput', deviceId);
      }
    },
    [userSettings, setUserSettings, livekitRoom],
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
      setUserSettings({
        ...userSettings,
        ssResolution: ssRes as typeof userSettings.ssResolution,
        ssFps: ssFps as typeof userSettings.ssFps,
        ssAudio,
      });
      if (isScreenShareEnabled) {
        // Mid-share: update quality without restarting the track
        void updateScreenShareSettings(ssRes, ssFps, ssAudio);
      } else {
        // New share
        void startScreenShare(ssRes, ssFps, ssAudio);
      }
      setShowQualityModal(false);
    },
    [setUserSettings, startScreenShare, updateScreenShareSettings, isScreenShareEnabled, userSettings],
  );

  const handleToggleNoiseSup = useCallback(() => {
    const next = !userSettings.noiseSuppression;
    setUserSettings({ ...userSettings, noiseSuppression: next });
  }, [setUserSettings, userSettings]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }, []);

  const handlePopout = useCallback(() => {
    if (!window.electron || !activeCallRoomId) return;
    const encoded = encodeURIComponent(activeCallRoomId);
    // Support both browser router (/popout) and hash router (/#/popout)
    const isHashRoute = window.location.hash.length > 1;
    const popoutUrl = isHashRoute
      ? `${window.location.origin}${window.location.pathname}#/popout?room=${encoded}`
      : `${window.location.origin}/popout?room=${encoded}`;
    window.open(popoutUrl, `mesh_${activeCallRoomId}`, 'width=960,height=640');
    toggleCallView();
  }, [activeCallRoomId, toggleCallView]);

  // Derive a human-readable room display name from the Matrix room.
  const roomDisplayName = activeCallRoomId
    ? (mx.getRoom(activeCallRoomId)?.name ?? activeCallRoomId)
    : null;

  return (
    <>
      {isReconnecting && (
        <div className={styles.reconnectingBanner}>
          Verbindung wird wiederhergestellt...
        </div>
      )}
      {showQualityModal && (
        <ScreenShareModal
          onConfirm={handleConfirmScreenShare}
          onCancel={() => setShowQualityModal(false)}
          mode={isScreenShareEnabled ? 'update' : 'start'}
          audioLocked={audioLockedMidShare}
        />
      )}
      <div className={styles.bar}>
        {/* Left: room name + timer */}
        <div className={styles.leftSection}>
          {roomDisplayName && (
            <span className={styles.roomName} title={activeCallRoomId ?? undefined}>
              {roomDisplayName}
            </span>
          )}
          {callStatus === 'connected' && (
            <>
              <span className={styles.durationText}>{formatDuration(duration)}</span>
              <ConnectionQualityBadge />
            </>
          )}
        </div>

        <div className={styles.controls}>
          {/* ── Left pill: mic + cam ──────────────────────────────────── */}
          <div className={styles.pillGroup}>
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

            <div className={styles.pillDivider} />

            {isMobile ? (
              <>
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
                  className={styles.btn}
                  onClick={() => void flipCamera()}
                  title="Flip camera"
                  aria-label="Flip camera"
                >
                  <ArrowsClockwise size={20} />
                </button>
              </>
            ) : (
              /* Camera + device caret (desktop) */
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
            )}
          </div>

          {/* ── Right pill: screen share, noise, soundboard, activities, stats, chat, watch ── */}
          <div className={styles.pillGroup}>
            {!isMobile && (
              <>
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
                      {/* Issue #45: toggle system audio mid-share via stop→restart */}
                      <div
                        className={styles.deviceItem}
                        onClick={() => { void toggleScreenShareAudio(); setShowSSMenu(false); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { void toggleScreenShareAudio(); setShowSSMenu(false); }
                        }}
                        title={isScreenShareAudioEnabled ? 'Disable system audio (brief restart)' : 'Enable system audio (brief restart)'}
                      >
                        {isScreenShareAudioEnabled ? 'Disable System Audio' : 'Enable System Audio'}
                      </div>
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

                <div className={styles.pillDivider} />

                {/* Noise Suppression */}
                <button
                  className={`${styles.btn} ${userSettings.noiseSuppression ? styles.btnActive : styles.btnMuted}`}
                  onClick={handleToggleNoiseSup}
                  title={userSettings.noiseSuppression ? 'Noise suppression on' : 'Noise suppression off'}
                  aria-label={userSettings.noiseSuppression ? 'Disable noise suppression' : 'Enable noise suppression'}
                  aria-pressed={userSettings.noiseSuppression}
                >
                  <Waveform size={20} />
                </button>

                {/* Soundboard */}
                <div className={styles.btnWrap} ref={soundboardMenuRef}>
                  <button
                    className={`${styles.btn} ${isSoundboardOpen ? styles.btnActive : ''}`}
                    onClick={() => setSoundboardOpen(!isSoundboardOpen)}
                    title="Soundboard"
                    aria-label="Toggle soundboard"
                    aria-pressed={isSoundboardOpen}
                  >
                    <MusicNote size={20} />
                  </button>
                  {isSoundboardOpen && (
                    <SoundboardPanel onClose={() => setSoundboardOpen(false)} />
                  )}
                </div>

                {/* Activities */}
                <div className={styles.btnWrap} ref={activitiesRef}>
                  <button
                    className={`${styles.btn} ${showActivities ? styles.btnActive : ''}`}
                    onClick={toggleActivities}
                    title="Activities"
                    aria-label="Open activities picker"
                    aria-pressed={showActivities}
                  >
                    <Rocket size={20} />
                  </button>
                  {showActivities && (
                    <ActivityPicker onClose={() => setShowActivities(false)} />
                  )}
                </div>

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

                <div className={styles.pillDivider} />
              </>
            )}

            {isMobile && (
              /* Soundboard on mobile */
              <div className={styles.btnWrap} ref={soundboardMenuRef}>
                <button
                  className={`${styles.btn} ${isSoundboardOpen ? styles.btnActive : ''}`}
                  onClick={() => setSoundboardOpen(!isSoundboardOpen)}
                  title="Soundboard"
                  aria-label="Toggle soundboard"
                  aria-pressed={isSoundboardOpen}
                >
                  <MusicNote size={20} />
                </button>
                {isSoundboardOpen && (
                  <SoundboardPanel onClose={() => setSoundboardOpen(false)} />
                )}
              </div>
            )}

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
                onClick={stopWatchingAll}
                title="Stop Watching"
                aria-label="Stop watching screen share"
              >
                <EyeSlash size={20} />
              </button>
            )}
          </div>

          {/* ── Hang up — outside pills ───────────────────────────────── */}
          <button
            className={`${styles.btn} ${styles.btnHangupOutside}`}
            onClick={hangUp}
            title="Leave call"
            aria-label="Leave call"
          >
            <PhoneDisconnect size={20} />
          </button>

          {/* ── Popout (Electron only) ────────────────────────────────── */}
          {!isMobile && !!window.electron && (
            <button
              className={`${styles.btn}`}
              onClick={handlePopout}
              title="Open call in separate window"
              aria-label="Open call in separate window"
            >
              <ArrowSquareOut size={20} />
            </button>
          )}

          {/* ── Fullscreen ────────────────────────────────────────────── */}
          {!isMobile && (
            <button
              className={`${styles.btn} ${styles.fullscreenBtn}`}
              onClick={handleFullscreen}
              title="Toggle fullscreen"
              aria-label="Toggle fullscreen"
            >
              <CornersOut size={20} />
            </button>
          )}
        </div>

        <div className={styles.rightSection} />
      </div>
    </>
  );
}
