import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useParticipants, useTracks, VideoTrack, type TrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Monitor, CaretUp, CaretDown, CornersOut, ArrowSquareOut } from '@phosphor-icons/react';
import { useAtom, useSetAtom } from 'jotai';
import { voiceCallLayoutAtom, pinParticipantAtom } from './VoiceCallLayoutStore';
import { NativeCallParticipantTile } from './NativeCallParticipantTile';
import { useCallState } from './CallProvider';
import styles from './NativeCallParticipantGrid.module.css';

/** A dedicated tile that renders a participant's screenshare video. */
function ScreenShareTile({
  trackRef,
  onWatch,
}: {
  trackRef: TrackReference;
  onWatch?: () => void;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isPopoutActive, setIsPopoutActive] = useState(false);
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
      // Browser blocked PiP or does not support it for this track.
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
    () => () => {
      closePopoutWindow();
    },
    [closePopoutWindow]
  );

  const dims = trackRef.publication?.dimensions;
  const mediaSettings = trackRef.publication?.track?.mediaStreamTrack?.getSettings();
  const trackFps = mediaSettings?.frameRate;

  const qualityLabel = useMemo(() => {
    const width = dims?.width ?? mediaSettings?.width;
    const height = dims?.height ?? mediaSettings?.height;
    if (!width || !height) {
      return null;
    }

    return `${width}x${height}${trackFps ? ` · ${Math.round(trackFps)}fps` : ''}`;
  }, [dims?.height, dims?.width, mediaSettings?.height, mediaSettings?.width, trackFps]);

  return (
    <div className={styles.screenTile} ref={tileRef}>
      <VideoTrack trackRef={trackRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />

      <div className={styles.screenActions}>
        <button
          type="button"
          className={styles.screenActionBtn}
          onClick={(e) => {
            e.stopPropagation();
            void toggleFullscreen();
          }}
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
              if (isElectron) {
                toggleElectronPopout();
              } else {
                void togglePiP();
              }
            }}
            aria-label={(isElectron ? isPopoutActive : isPiPActive) ? 'Close popout' : 'Open popout'}
            title={(isElectron ? isPopoutActive : isPiPActive) ? 'Close popout' : 'Open popout'}
          >
            <ArrowSquareOut size={14} weight="bold" />
          </button>
        )}
      </div>

      {qualityLabel && <div className={styles.screenQualityPill}>{qualityLabel}</div>}

      <div className={styles.screenTileLabel}>
        <Monitor size={13} weight="bold" style={{ flexShrink: 0 }} />
        {name}&apos;s screen

        {onWatch && (
          <button
            type="button"
            className={styles.watchBtn}
            onClick={(e) => {
              e.stopPropagation();
              onWatch();
            }}
          >
            Watch Stream
          </button>
        )}
      </div>
    </div>
  );
}

interface NativeCallParticipantGridProps {
  onPin?: (participantId: string | null) => void;
}

export function NativeCallParticipantGrid({ onPin }: NativeCallParticipantGridProps) {
  const participants = useParticipants();
  const { remoteParticipantStates } = useCallState();
  const [layoutState, setLayoutState] = useAtom(voiceCallLayoutAtom);
  const pinParticipant = useSetAtom(pinParticipantAtom);
  const { layoutMode, pinnedParticipantId, isCarouselExpanded } = layoutState;

  // Collect all active screenshare tracks across all participants.
  const allSSTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const screenShareTracks = useMemo(
    () => allSSTracks.filter((t): t is TrackReference => 'publication' in t && !!t.publication),
    [allSSTracks],
  );
  const isSingleParticipantView = participants.length === 1 && screenShareTracks.length === 0;

  // Auto-pin on screenshare: when a participant starts screensharing, auto-pin them.
  useEffect(() => {
    // Check remoteParticipantStates for any screen-sharing participant.
    let firstScreenSharerId: string | null = null;
    for (const [identity, state] of remoteParticipantStates) {
      if (state.isScreenSharing) {
        firstScreenSharerId = identity;
        break;
      }
    }

    if (firstScreenSharerId && layoutMode === 'grid') {
      // Auto-switch to focus mode when someone starts screensharing.
      pinParticipant(firstScreenSharerId);
    } else if (!firstScreenSharerId && pinnedParticipantId !== null) {
      // If the pinned participant stopped screensharing and we're in focus mode due to screenshare,
      // only auto-unpin if there's no other screenshare.
      const anyScreenShare = screenShareTracks.length > 0;
      if (!anyScreenShare) {
        pinParticipant(null);
      }
    }
  }, [remoteParticipantStates, layoutMode, pinnedParticipantId, pinParticipant, screenShareTracks.length]);

  const handlePin = (participantId: string | null) => {
    pinParticipant(participantId);
    onPin?.(participantId);
  };

  const toggleCarousel = () => {
    setLayoutState((prev) => ({ ...prev, isCarouselExpanded: !prev.isCarouselExpanded }));
  };

  // ── FOCUS MODE ──────────────────────────────────────────────────────────────
  if (layoutMode === 'focus' && pinnedParticipantId !== null) {
    const pinnedParticipant = participants.find((p) => p.identity === pinnedParticipantId);
    const otherParticipants = participants.filter((p) => p.identity !== pinnedParticipantId);

    // Pinned screenshare track (if applicable)
    const pinnedSSTrack = screenShareTracks.find(
      (t) => t.participant.identity === pinnedParticipantId,
    );

    return (
      <div className={styles.focusLayout}>
        {/* Main large tile */}
        <div className={styles.focusMain}>
          {pinnedSSTrack ? (
            <ScreenShareTile trackRef={pinnedSSTrack} />
          ) : pinnedParticipant ? (
            <NativeCallParticipantTile
              participant={pinnedParticipant}
              onPin={handlePin}
              isPinned
            />
          ) : null}
        </div>

        {/* Carousel strip */}
        <div
          className={styles.focusCarousel}
          style={isCarouselExpanded ? { height: 'auto', flexWrap: 'wrap' } : undefined}
        >
          {otherParticipants.map((participant) => (
            <NativeCallParticipantTile
              key={participant.identity}
              participant={participant}
              onPin={handlePin}
            />
          ))}
        </div>

        {/* Toggle button for carousel expand/collapse */}
        {otherParticipants.length > 0 && (
          <button
            type="button"
            className={styles.carouselToggle}
            onClick={toggleCarousel}
            aria-label={isCarouselExpanded ? 'Collapse participants' : 'Expand participants'}
          >
            {isCarouselExpanded ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretUp size={12} weight="bold" />
            )}
            {isCarouselExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
    );
  }

  // ── GRID MODE ────────────────────────────────────────────────────────────────
  return (
    <div className={`${styles.grid}${isSingleParticipantView ? ` ${styles.gridSingle}` : ''}`}>
      {/* Screenshare tiles first */}
      {screenShareTracks.map((t) => (
        <div key={`ss-${t.participant?.identity}`} className={styles.screenTileWrap}>
          <ScreenShareTile
            trackRef={t}
            onWatch={() => {
              if (t.participant?.identity) {
                pinParticipant(t.participant.identity);
              }
            }}
          />
        </div>
      ))}

      {/* Regular participant camera tiles */}
      {participants.map((participant) => (
        isSingleParticipantView ? (
          <div key={participant.identity} className={styles.gridSingleCard}>
            <NativeCallParticipantTile
              participant={participant}
              onPin={handlePin}
              className={styles.tile}
            />
          </div>
        ) : (
          <NativeCallParticipantTile
            key={participant.identity}
            participant={participant}
            onPin={handlePin}
            className={styles.tile}
          />
        )
      ))}
    </div>
  );
}
