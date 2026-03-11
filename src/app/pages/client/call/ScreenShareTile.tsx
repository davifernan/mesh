/**
 * ScreenShareTile — renders a participant's screenshare as a full-width call grid tile.
 * Extracted from NativeCallParticipantGrid to keep file sizes within the 650-line limit.
 */
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { VideoTrack, type TrackReference, useRoomContext } from '@livekit/components-react';
import { Track, RoomEvent, type Room } from 'livekit-client';
import { Monitor, CornersOut, ArrowSquareOut, Eye } from '@phosphor-icons/react';
import { playViewerJoinSound, playViewerLeaveSound } from '../../../utils/sounds';
import styles from './NativeCallParticipantGrid.module.css';

/** Tracks how many participants are watching a screen share track. */
export function useScreenShareViewerCount(trackRef: TrackReference): number {
  const room = useRoomContext();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const pub = trackRef.publication;
    if (!pub) return;

    const update = () => {
      if (trackRef.participant.isLocal) {
        setCount(0);
      } else {
        let n = 0;
        for (const p of room.remoteParticipants.values()) {
          for (const tp of p.trackPublications.values()) {
            if (tp.source === Track.Source.ScreenShare && tp.isSubscribed) n++;
          }
        }
        setCount(n);
      }
    };

    update();
    room.on(RoomEvent.TrackSubscribed, update);
    room.on(RoomEvent.TrackUnsubscribed, update);
    return () => {
      room.off(RoomEvent.TrackSubscribed, update);
      room.off(RoomEvent.TrackUnsubscribed, update);
    };
  }, [room, trackRef]);

  return count;
}

/** A dedicated tile that renders a participant's screenshare video. */
export function ScreenShareTile({
  trackRef,
  onWatch,
  livekitRoom,
}: {
  trackRef: TrackReference;
  onWatch?: () => void;
  livekitRoom: Room | null;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isPopoutActive, setIsPopoutActive] = useState(false);
  const [outboundQuality, setOutboundQuality] = useState<{
    width: number;
    height: number;
    fps?: number;
  } | null>(null);
  const viewerCount = useScreenShareViewerCount(trackRef);
  const prevViewerCountRef = useRef(0);

  useEffect(() => {
    if (viewerCount > prevViewerCountRef.current) {
      playViewerJoinSound();
    } else if (viewerCount < prevViewerCountRef.current) {
      playViewerLeaveSound();
    }
    prevViewerCountRef.current = viewerCount;
  }, [viewerCount]);

  const popoutWindowRef = useRef<Window | null>(null);
  const popoutVideoRef = useRef<HTMLMediaElement | null>(null);
  const name = trackRef.participant?.name ?? trackRef.participant?.identity ?? 'Someone';
  const isElectron = typeof window !== 'undefined' && !!window.electron;

  const getVideoElement = useCallback(() => {
    if (!tileRef.current) return null;
    return tileRef.current.querySelector('video') as HTMLVideoElement | null;
  }, []);

  const supportsPiP =
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    (document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled;

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === tileRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const video = getVideoElement();
    if (!video) return;
    const onEnter = () => setIsPiPActive(true);
    const onLeave = () => setIsPiPActive(false);
    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, [getVideoElement]);

  const toggleFullscreen = useCallback(async () => {
    if (!tileRef.current) return;
    if (document.fullscreenElement === tileRef.current) {
      await document.exitFullscreen();
      return;
    }
    await tileRef.current.requestFullscreen();
  }, []);

  const togglePiP = useCallback(async () => {
    const video = getVideoElement();
    if (!video || !supportsPiP) return;
    const doc = document as Document & {
      pictureInPictureElement?: Element | null;
      exitPictureInPicture?: () => Promise<void>;
    };
    try {
      if (doc.pictureInPictureElement === video && doc.exitPictureInPicture) {
        await doc.exitPictureInPicture();
        return;
      }
      const pipVideo = video as HTMLVideoElement & {
        requestPictureInPicture?: () => Promise<unknown>;
      };
      if (pipVideo.requestPictureInPicture) {
        await pipVideo.requestPictureInPicture();
      }
    } catch {
      // Browser blocked PiP or does not support it.
    }
  }, [getVideoElement, supportsPiP]);

  const closePopoutWindow = useCallback(() => {
    const track = trackRef.publication?.track as
      | { detach: (element?: HTMLMediaElement) => HTMLMediaElement[] }
      | undefined;
    if (track && popoutVideoRef.current) {
      track.detach(popoutVideoRef.current);
    }
    popoutVideoRef.current = null;
    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      popoutWindowRef.current.close();
    }
    popoutWindowRef.current = null;
    setIsPopoutActive(false);
  }, [trackRef.publication]);

  const toggleElectronPopout = useCallback(() => {
    const track = trackRef.publication?.track as
      | {
          attach: (element?: HTMLMediaElement) => HTMLMediaElement;
          detach: (element?: HTMLMediaElement) => HTMLMediaElement[];
        }
      | undefined;
    if (!track) return;
    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      closePopoutWindow();
      return;
    }
    const popoutWindow = window.open(
      '',
      `bettercord_stream_popout_${trackRef.participant?.identity ?? 'stream'}`,
      'popup=yes,width=1000,height=620,resizable=yes,scrollbars=no'
    );
    if (!popoutWindow) return;
    popoutWindow.document.title = `${name} screen`;
    popoutWindow.document.body.innerHTML = '';
    popoutWindow.document.body.style.margin = '0';
    popoutWindow.document.body.style.background = '#000';
    popoutWindow.document.body.style.display = 'flex';
    popoutWindow.document.body.style.alignItems = 'center';
    popoutWindow.document.body.style.justifyContent = 'center';
    const mediaElement = track.attach();
    mediaElement.style.width = '100%';
    mediaElement.style.height = '100%';
    mediaElement.style.objectFit = 'contain';
    popoutWindow.document.body.appendChild(mediaElement);
    popoutWindowRef.current = popoutWindow;
    popoutVideoRef.current = mediaElement;
    setIsPopoutActive(true);
    popoutWindow.addEventListener('beforeunload', () => {
      if (track && popoutVideoRef.current) {
        track.detach(popoutVideoRef.current);
      }
      popoutVideoRef.current = null;
      popoutWindowRef.current = null;
      setIsPopoutActive(false);
    });
  }, [closePopoutWindow, name, trackRef.participant?.identity, trackRef.publication]);

  useEffect(() => {
    if (!trackRef.publication?.track) {
      closePopoutWindow();
    }
  }, [closePopoutWindow, trackRef.publication?.track]);

  useEffect(
    () => () => { closePopoutWindow(); },
    [closePopoutWindow]
  );

  useEffect(() => {
    if (!trackRef.participant?.isLocal || !livekitRoom) {
      setOutboundQuality(null);
      return;
    }
    const localTrackId = trackRef.publication?.track?.mediaStreamTrack?.id;
    const updateOutboundStats = () => {
      const pc: RTCPeerConnection | undefined = (livekitRoom as any).engine?.publisher?.pc;
      if (!pc) return;
      void pc.getStats().then((report) => {
        const matchingTrackStats = new Set<string>();
        const matchingMediaSourceStats = new Set<string>();
        if (localTrackId) {
          report.forEach((stat) => {
            const s = stat as RTCStats & { kind?: string; trackIdentifier?: string };
            const statType = (s as any).type as string | undefined;
            if (statType === 'track' && s.kind === 'video' && s.trackIdentifier === localTrackId)
              matchingTrackStats.add(s.id);
            if (statType === 'media-source' && s.kind === 'video' && s.trackIdentifier === localTrackId)
              matchingMediaSourceStats.add(s.id);
          });
        }
        let bestBytes = -1;
        let bestWidth: number | null = null;
        let bestHeight: number | null = null;
        let bestFps: number | undefined;
        report.forEach((stat) => {
          const s = stat as RTCStats & {
            kind?: string; frameWidth?: number; frameHeight?: number;
            framesPerSecond?: number; trackIdentifier?: string;
            trackId?: string; mediaSourceId?: string; bytesSent?: number;
          };
          if (s.type !== 'outbound-rtp' || s.kind !== 'video') return;
          if (localTrackId) {
            const isDirectMatch = s.trackIdentifier === localTrackId;
            const isTrackStatMatch = !!s.trackId && matchingTrackStats.has(s.trackId);
            const isMediaSourceMatch = !!s.mediaSourceId && matchingMediaSourceStats.has(s.mediaSourceId);
            if (!isDirectMatch && !isTrackStatMatch && !isMediaSourceMatch) return;
          }
          if (!s.frameWidth || !s.frameHeight) return;
          const candidate = { width: s.frameWidth, height: s.frameHeight, fps: s.framesPerSecond, bytes: s.bytesSent ?? 0 };
          if (candidate.bytes >= bestBytes) {
            bestBytes = candidate.bytes;
            bestWidth = candidate.width;
            bestHeight = candidate.height;
            bestFps = candidate.fps;
          }
        });
        if (bestWidth && bestHeight) {
          setOutboundQuality({ width: bestWidth, height: bestHeight, fps: bestFps });
        }
      }).catch(() => {});
    };
    updateOutboundStats();
    const interval = window.setInterval(updateOutboundStats, 3000);
    return () => window.clearInterval(interval);
  }, [livekitRoom, trackRef.participant?.isLocal, trackRef.publication?.track?.mediaStreamTrack?.id]);

  const dims = trackRef.publication?.dimensions;
  const mediaSettings = trackRef.publication?.track?.mediaStreamTrack?.getSettings();
  const trackFps = mediaSettings?.frameRate;

  const qualityLabel = useMemo(() => {
    const width = outboundQuality?.width ?? dims?.width ?? mediaSettings?.width;
    const height = outboundQuality?.height ?? dims?.height ?? mediaSettings?.height;
    const fps = outboundQuality?.fps ?? trackFps;
    if (!width || !height) return null;
    return `${width}x${height}${fps ? ` · ${Math.round(fps)}fps` : ''}`;
  }, [dims?.height, dims?.width, mediaSettings?.height, mediaSettings?.width, outboundQuality, trackFps]);

  return (
    <div className={styles.screenTile} ref={tileRef}>
      <VideoTrack trackRef={trackRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />

      <div className={styles.screenActions}>
        <button
          type="button"
          className={styles.screenActionBtn}
          onClick={(e) => { e.stopPropagation(); void toggleFullscreen(); }}
          aria-label={isFullscreen ? 'Exit fullscreen screen share' : 'Enter fullscreen screen share'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <CornersOut size={14} weight="bold" />
        </button>

        {(supportsPiP || isElectron) && (
          <button
            type="button"
            className={styles.screenActionBtn}
            onClick={(e) => {
              e.stopPropagation();
              if (isElectron) { toggleElectronPopout(); } else { void togglePiP(); }
            }}
            aria-label={(isElectron ? isPopoutActive : isPiPActive) ? 'Close popout' : 'Open popout'}
            title={(isElectron ? isPopoutActive : isPiPActive) ? 'Close popout' : 'Open popout'}
          >
            <ArrowSquareOut size={14} weight="bold" />
          </button>
        )}
      </div>

      {qualityLabel && <div className={styles.screenQualityPill}>{qualityLabel}</div>}

      {viewerCount > 0 && (
        <div className={styles.viewerBadge}>
          <Eye size={11} weight="fill" />
          {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
        </div>
      )}

      <div className={styles.screenTileLabel}>
        <Monitor size={13} weight="bold" style={{ flexShrink: 0 }} />
        {name}&apos;s screen
        {onWatch && (
          <button
            type="button"
            className={styles.watchBtn}
            onClick={(e) => { e.stopPropagation(); onWatch(); }}
          >
            Watch Stream
          </button>
        )}
      </div>
    </div>
  );
}
