/**
 * NativeCallControlBar — #71 redesign
 *
 * Two-pill layout matching Discord's visual hierarchy:
 *
 *   [ 🎙️▲ | 📷▲ ]   [ 🖥️  🎮  🎵  ··· ]   [ 🔴 ]   [ ⛶ ]
 *    Pill 1 (A/V)     Pill 2 (actions)    Hangup  Fullscreen
 *
 * Changes vs. old single-pill bar:
 * - Deafen removed (lives in UserArea per #38)
 * - Noise Suppression moved to Mic dropdown
 * - Stats + Stop-Watching moved to ··· overflow menu
 * - Chat button moved to NativeCallView header (see NativeCallView.tsx)
 * - Hangup is standalone outside both pills
 * - Fullscreen button far right (desktop only)
 * - Mic dropdown extended: Noise Sup toggle + Speaker device list
 */

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
  Waveform,
  CaretDown,
  ArrowsClockwise,
  MusicNote,
  Rocket,
  DotsThree,
  ArrowsOut,
  ArrowsIn,
} from '@phosphor-icons/react';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useAtom } from 'jotai';
import { useCallState } from './CallProvider';
import { settingsAtom } from '../../../state/settings';
import { ScreenShareModal } from '../../../components/voice/ScreenShareModal/ScreenShareModal';
import { SoundboardPanel } from '../../../components/soundboard';
import { showStatsAtom } from './VoiceCallLayoutStore';
import { ActivityPicker } from './ActivityPicker';
import styles from './NativeCallControlBar.module.css';

export function NativeCallControlBar() {
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;

  const {
    hangUp,
    toggleAudio,
    toggleVideo,
    flipCamera,
    isAudioEnabled,
    isVideoEnabled,
    startScreenShare,
    stopScreenShare,
    livekitRoom,
    isSoundboardOpen,
    setSoundboardOpen,
    updateScreenShareSettings,
    watchedScreenShares,
    unwatchScreenShare,
  } = useCallState();

  const { localParticipant } = useLocalParticipant();
  const isScreenShareEnabled = localParticipant.isScreenShareEnabled;
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

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // ── Device picker state ───────────────────────────────────────────────────
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);
  const [camDevices, setCamDevices] = useState<MediaDeviceInfo[]>([]);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showCamMenu, setShowCamMenu] = useState(false);
  const [showSSMenu, setShowSSMenu] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);

  const micMenuRef = useRef<HTMLDivElement>(null);
  const camMenuRef = useRef<HTMLDivElement>(null);
  const ssMenuRef = useRef<HTMLDivElement>(null);
  const soundboardMenuRef = useRef<HTMLDivElement>(null);
  const activitiesRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close any open menu when clicking outside
  useEffect(() => {
    const anyOpen = showMicMenu || showCamMenu || showSSMenu || isSoundboardOpen || showActivities || showOverflow;
    if (!anyOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (showMicMenu && micMenuRef.current && !micMenuRef.current.contains(t)) setShowMicMenu(false);
      if (showCamMenu && camMenuRef.current && !camMenuRef.current.contains(t)) setShowCamMenu(false);
      if (showSSMenu && ssMenuRef.current && !ssMenuRef.current.contains(t)) setShowSSMenu(false);
      if (isSoundboardOpen && soundboardMenuRef.current && !soundboardMenuRef.current.contains(t)) setSoundboardOpen(false);
      if (showActivities && activitiesRef.current && !activitiesRef.current.contains(t)) setShowActivities(false);
      if (showOverflow && overflowRef.current && !overflowRef.current.contains(t)) setShowOverflow(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMicMenu, showCamMenu, showSSMenu, isSoundboardOpen, showActivities, showOverflow, setSoundboardOpen]);

  // ── Device menu openers ───────────────────────────────────────────────────
  const openMicMenu = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const all = await navigator.mediaDevices.enumerateDevices();
    setMicDevices(all.filter((d) => d.kind === 'audioinput'));
    setSpeakerDevices(all.filter((d) => d.kind === 'audiooutput'));
    setShowMicMenu((v) => !v);
    setShowCamMenu(false);
    setShowSSMenu(false);
    setShowOverflow(false);
  }, []);

  const openCamMenu = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const all = await navigator.mediaDevices.enumerateDevices();
    setCamDevices(all.filter((d) => d.kind === 'videoinput'));
    setShowCamMenu((v) => !v);
    setShowMicMenu(false);
    setShowSSMenu(false);
    setShowOverflow(false);
  }, []);

  const selectMicDevice = useCallback((deviceId: string) => {
    setUserSettings({ ...userSettings, micDeviceId: deviceId });
    setShowMicMenu(false);
    if (livekitRoom) void livekitRoom.switchActiveDevice('audioinput', deviceId);
  }, [userSettings, setUserSettings, livekitRoom]);

  const selectSpeakerDevice = useCallback((deviceId: string) => {
    setUserSettings({ ...userSettings, speakerDeviceId: deviceId });
    if (livekitRoom) void livekitRoom.switchActiveDevice('audiooutput', deviceId);
  }, [userSettings, setUserSettings, livekitRoom]);

  const selectCamDevice = useCallback((deviceId: string) => {
    setUserSettings({ ...userSettings, cameraDeviceId: deviceId });
    setShowCamMenu(false);
    if (livekitRoom) void livekitRoom.switchActiveDevice('videoinput', deviceId);
  }, [userSettings, setUserSettings, livekitRoom]);

  const handleToggleNoiseSup = useCallback(() => {
    setUserSettings({ ...userSettings, noiseSuppression: !userSettings.noiseSuppression });
  }, [setUserSettings, userSettings]);

  // ── Screen share ──────────────────────────────────────────────────────────
  const handleScreenShare = () => {
    if (isScreenShareEnabled) {
      setShowSSMenu((v) => !v);
      setShowMicMenu(false);
      setShowCamMenu(false);
    } else {
      setShowQualityModal(true);
    }
  };

  const handleConfirmScreenShare = useCallback((ssRes: string, ssFps: number, ssAudio: boolean) => {
    setUserSettings({
      ...userSettings,
      ssResolution: ssRes as typeof userSettings.ssResolution,
      ssFps: ssFps as typeof userSettings.ssFps,
      ssAudio,
    });
    if (isScreenShareEnabled) {
      void updateScreenShareSettings(ssRes, ssFps, ssAudio);
    } else {
      void startScreenShare(ssRes, ssFps, ssAudio);
    }
    setShowQualityModal(false);
  }, [setUserSettings, startScreenShare, updateScreenShareSettings, isScreenShareEnabled, userSettings]);

  // ── Mic dropdown content (devices + noise sup + speakers) ─────────────────
  const MicDropdown = (
    <div className={styles.deviceMenu}>
      {/* Mic devices */}
      <div className={styles.menuSectionLabel}>MICROPHONE</div>
      {micDevices.length === 0 && (
        <div className={styles.deviceItem} style={{ color: 'var(--text-secondary)' }}>No microphones found</div>
      )}
      {micDevices.map((d) => (
        <div
          key={d.deviceId}
          className={`${styles.deviceItem}${userSettings.micDeviceId === d.deviceId ? ` ${styles.deviceItemSelected}` : ''}`}
          onClick={() => selectMicDevice(d.deviceId)}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && selectMicDevice(d.deviceId)}
        >
          {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
        </div>
      ))}

      {/* Noise suppression toggle */}
      <div className={styles.menuDivider} />
      <div
        className={`${styles.deviceItem} ${styles.menuToggleItem}`}
        onClick={handleToggleNoiseSup}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleToggleNoiseSup()}
        aria-pressed={userSettings.noiseSuppression}
      >
        <Waveform size={14} />
        <span>Noise Suppression</span>
        <span className={`${styles.togglePill} ${userSettings.noiseSuppression ? styles.togglePillOn : ''}`}>
          {userSettings.noiseSuppression ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Speaker devices */}
      {speakerDevices.length > 0 && (
        <>
          <div className={styles.menuDivider} />
          <div className={styles.menuSectionLabel}>SPEAKER</div>
          {speakerDevices.map((d) => (
            <div
              key={d.deviceId}
              className={`${styles.deviceItem}${userSettings.speakerDeviceId === d.deviceId ? ` ${styles.deviceItemSelected}` : ''}`}
              onClick={() => selectSpeakerDevice(d.deviceId)}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && selectSpeakerDevice(d.deviceId)}
            >
              {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
            </div>
          ))}
        </>
      )}
    </div>
  );

  return (
    <>
      {showQualityModal && (
        <ScreenShareModal
          onConfirm={handleConfirmScreenShare}
          onCancel={() => setShowQualityModal(false)}
          mode={isScreenShareEnabled ? 'update' : 'start'}
          audioLocked={audioLockedMidShare}
        />
      )}

      <div className={styles.bar}>
        {/* ── Pill 1: A/V controls ── */}
        <div className={styles.pill}>
          {/* Mic */}
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
              title="Microphone settings"
              aria-label="Microphone settings"
            >
              <CaretDown size={12} />
            </button>
            {showMicMenu && MicDropdown}
          </div>

          {/* Camera / Flip */}
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
                  <div className={styles.menuSectionLabel}>CAMERA</div>
                  {camDevices.length === 0 && (
                    <div className={styles.deviceItem} style={{ color: 'var(--text-secondary)' }}>No cameras found</div>
                  )}
                  {camDevices.map((d) => (
                    <div
                      key={d.deviceId}
                      className={`${styles.deviceItem}${userSettings.cameraDeviceId === d.deviceId ? ` ${styles.deviceItemSelected}` : ''}`}
                      onClick={() => selectCamDevice(d.deviceId)}
                      role="button" tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && selectCamDevice(d.deviceId)}
                    >
                      {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Pill 2: Action controls ── */}
        <div className={styles.pill}>
          {/* Screen Share */}
          <div className={styles.btnWrap} ref={ssMenuRef}>
            <button
              className={`${styles.btn} ${isScreenShareEnabled ? styles.btnActive : ''}`}
              onClick={handleScreenShare}
              onContextMenu={(e) => {
                if (isScreenShareEnabled) { e.preventDefault(); setShowSSMenu(true); }
              }}
              title={isScreenShareEnabled ? 'Screen share options' : 'Share screen'}
              aria-label={isScreenShareEnabled ? 'Screen share options' : 'Share screen'}
              aria-pressed={isScreenShareEnabled}
            >
              {isScreenShareEnabled ? <Monitor size={20} /> : <MonitorArrowUp size={20} />}
            </button>
            {showSSMenu && (
              <div className={styles.ssMenu}>
                <div className={styles.deviceItem} onClick={() => { void stopScreenShare(); setShowSSMenu(false); }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && void stopScreenShare()}>
                  Stop Sharing
                </div>
                <div className={styles.deviceItem} onClick={() => { setShowSSMenu(false); setShowQualityModal(true); }} role="button" tabIndex={0}>
                  Quality Settings
                </div>
              </div>
            )}
          </div>

          {/* Activities */}
          <div className={styles.btnWrap} ref={activitiesRef}>
            <button
              className={`${styles.btn} ${showActivities ? styles.btnActive : ''}`}
              onClick={() => { setShowActivities((v) => !v); setShowMicMenu(false); setShowCamMenu(false); setShowOverflow(false); }}
              title="Activities"
              aria-label="Open activities picker"
              aria-pressed={showActivities}
            >
              <Rocket size={20} />
            </button>
            {showActivities && <ActivityPicker onClose={() => setShowActivities(false)} />}
          </div>

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
            {isSoundboardOpen && <SoundboardPanel onClose={() => setSoundboardOpen(false)} />}
          </div>

          {/* ··· Overflow */}
          <div className={styles.btnWrap} ref={overflowRef}>
            <button
              className={`${styles.btn} ${showOverflow ? styles.btnActive : ''}`}
              onClick={() => { setShowOverflow((v) => !v); setShowMicMenu(false); setShowCamMenu(false); }}
              title="More options"
              aria-label="More options"
              aria-pressed={showOverflow}
            >
              <DotsThree size={20} weight="bold" />
            </button>
            {showOverflow && (
              <div className={styles.overflowMenu}>
                <div
                  className={`${styles.deviceItem} ${showStats ? styles.deviceItemSelected : ''}`}
                  onClick={() => { setShowStats((s) => !s); setShowOverflow(false); }}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setShowStats((s) => !s)}
                >
                  <ChartBar size={14} />
                  <span>Call Stats</span>
                </div>
                {isWatchingScreenShare && (
                  <div
                    className={styles.deviceItem}
                    onClick={() => { stopWatchingAll(); setShowOverflow(false); }}
                    role="button" tabIndex={0}
                  >
                    <EyeSlash size={14} />
                    <span>Stop Watching</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Hangup — standalone outside pills ── */}
        <button
          className={`${styles.btn} ${styles.btnHangup}`}
          onClick={hangUp}
          title="Leave call"
          aria-label="Leave call"
        >
          <PhoneDisconnect size={20} />
        </button>

        {/* ── Fullscreen — far right, desktop only ── */}
        {!isMobile && (
          <button
            className={styles.btnFullscreen}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <ArrowsIn size={18} /> : <ArrowsOut size={18} />}
          </button>
        )}
      </div>
    </>
  );
}
