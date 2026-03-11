import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useParticipants, useTracks, type TrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { useAtom, useSetAtom } from 'jotai';
import { voiceCallLayoutAtom, pinParticipantAtom } from './VoiceCallLayoutStore';
import { NativeCallParticipantTile } from './NativeCallParticipantTile';
import { ScreenShareTile } from './ScreenShareTile';
import { AppTile, WIDGET_PIN_PREFIX, widgetPinId } from './AppTile';
import { useCallState } from './CallProvider';
import type { RoomWidget } from '../../../hooks/useRoomWidgets';
import styles from './NativeCallParticipantGrid.module.css';

interface NativeCallParticipantGridProps {
  onPin?: (participantId: string | null) => void;
  /** Active room widgets — rendered as extra "participant" tiles. */
  widgets?: RoomWidget[];
}

const DISPLAY_COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function NativeCallParticipantGrid({ onPin, widgets }: NativeCallParticipantGridProps) {
  const allParticipants = useParticipants();
  const allFilteredParticipants = allParticipants.filter(
    (participant) =>
      participant.isLocal ||
      !!participant.getTrackPublication(Track.Source.Microphone) ||
      !!participant.getTrackPublication(Track.Source.Camera) ||
      !!participant.getTrackPublication(Track.Source.ScreenShare) ||
      !!participant.name
  );

  // Stable alphabetical sort: local participant first, then sorted by display name
  const participants = useMemo(() => {
    const sorted = [...allFilteredParticipants].sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      return DISPLAY_COLLATOR.compare(a.name ?? a.identity, b.name ?? b.identity);
    });
    return sorted;
  }, [allFilteredParticipants]);

  const { remoteParticipantStates, livekitRoom } = useCallState();
  const [layoutState, setLayoutState] = useAtom(voiceCallLayoutAtom);
  const pinParticipant = useSetAtom(pinParticipantAtom);
  const { layoutMode, pinnedParticipantId, isCarouselExpanded } = layoutState;

  // Grid layout state — columns computed via ResizeObserver
  const gridRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const wasOverflowingRef = useRef(false);
  const [gridColumns, setGridColumns] = useState(1);
  const participantCountRef = useRef(participants.length);
  // Include widget tiles in the grid count so column logic adapts correctly
  participantCountRef.current = participants.length + (widgets?.length ?? 0);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const { width } = el.getBoundingClientRect();
      const n = participantCountRef.current;
      let cols = 1;
      if (n >= 2 && width >= 520) cols = 2;
      if (n >= 5 && width >= 860) cols = 3;
      if (n >= 10 && width >= 1180) cols = 4;
      setGridColumns(cols);

      const delta = el.scrollHeight - el.clientHeight;
      const wasOver = wasOverflowingRef.current;
      const nowOver = wasOver ? delta > -6 : delta > 2;
      if (nowOver !== wasOverflowingRef.current) {
        wasOverflowingRef.current = nowOver;
        setIsOverflowing(nowOver);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Collect all active screenshare tracks
  const allSSTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const screenShareTracks = useMemo(
    () => allSSTracks.filter((t): t is TrackReference => 'publication' in t && !!t.publication),
    [allSSTracks],
  );

  const hasWidgets = !!(widgets?.length);
  const isSingleParticipantView =
    participants.length === 1 && screenShareTracks.length === 0 && !hasWidgets;

  // Auto-pin: when a remote participant starts screensharing, switch to focus mode
  useEffect(() => {
    let firstScreenSharerId: string | null = null;
    for (const [identity, state] of remoteParticipantStates) {
      if (state.isScreenSharing) {
        firstScreenSharerId = identity;
        break;
      }
    }
    if (firstScreenSharerId && layoutMode === 'grid') {
      pinParticipant(firstScreenSharerId);
    } else if (!firstScreenSharerId && pinnedParticipantId !== null) {
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
    const isWidgetPin = pinnedParticipantId.startsWith(WIDGET_PIN_PREFIX);
    const pinnedWidgetId = isWidgetPin ? pinnedParticipantId.slice(WIDGET_PIN_PREFIX.length) : null;
    const pinnedWidget = pinnedWidgetId
      ? (widgets ?? []).find((w) => w.id === pinnedWidgetId)
      : null;
    const pinnedParticipant = !isWidgetPin
      ? participants.find((p) => p.identity === pinnedParticipantId)
      : undefined;
    const otherParticipants = participants.filter((p) => p.identity !== pinnedParticipantId);
    const pinnedSSTrack = !isWidgetPin
      ? screenShareTracks.find((t) => t.participant.identity === pinnedParticipantId)
      : undefined;

    return (
      <div className={styles.focusLayout}>
        {/* Main large tile */}
        <div className={styles.focusMain}>
          {pinnedWidget ? (
            <AppTile
              widget={pinnedWidget}
              onPin={handlePin}
              isPinned
            />
          ) : pinnedSSTrack ? (
            <ScreenShareTile trackRef={pinnedSSTrack} livekitRoom={livekitRoom} />
          ) : pinnedParticipant ? (
            <NativeCallParticipantTile
              participant={pinnedParticipant}
              onPin={handlePin}
              isPinned
            />
          ) : null}
        </div>

        {/* Carousel strip of other participants */}
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
          {/* Non-pinned widgets also appear in carousel */}
          {(widgets ?? [])
            .filter((w) => widgetPinId(w.id) !== pinnedParticipantId)
            .map((w) => (
              <AppTile
                key={`widget-carousel-${w.id}`}
                widget={w}
                onPin={handlePin}
                isPinned={false}
                className={styles.tile}
              />
            ))}
        </div>

        {(otherParticipants.length > 0 || (widgets ?? []).length > 1) && (
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

  // ── TWO-PARTICIPANT SPLIT ────────────────────────────────────────────────────
  // Exactly 2 users, no screenshare, no widgets, no pinned focus → 50/50 vertical split
  const isTwoParticipantView =
    participants.length === 2 &&
    screenShareTracks.length === 0 &&
    !hasWidgets &&
    layoutMode !== 'focus';

  if (isTwoParticipantView) {
    return (
      <div className={styles.gridWrapper}>
        <div className={styles.twoSplit}>
          {participants.map((participant) => (
            <NativeCallParticipantTile
              key={participant.identity}
              participant={participant}
              onPin={handlePin}
              className={styles.twoSplitTile}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── GRID MODE ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.gridWrapper}>
      <div
        ref={gridRef}
        className={`${styles.grid}${isSingleParticipantView ? ` ${styles.gridSingle}` : ''}`}
        data-overflowing={isOverflowing ? 'true' : 'false'}
        style={{ '--voice-grid-columns': String(gridColumns) } as React.CSSProperties}
      >
        {/* App widget tiles first — full width, like screenshares */}
        {(widgets ?? []).map((w) => (
          <div key={`widget-${w.id}`} className={styles.screenTileWrap}>
            <AppTile
              widget={w}
              onPin={handlePin}
              isPinned={pinnedParticipantId === widgetPinId(w.id)}
            />
          </div>
        ))}

        {/* Screenshare tiles */}
        {screenShareTracks.map((t) => (
          <div key={`ss-${t.participant?.identity}`} className={styles.screenTileWrap}>
            <ScreenShareTile
              trackRef={t}
              livekitRoom={livekitRoom}
              onWatch={() => {
                if (t.participant?.identity) {
                  pinParticipant(t.participant.identity);
                }
              }}
            />
          </div>
        ))}

        {/* Regular participant camera tiles */}
        {participants.map((participant) =>
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
        )}
      </div>
    </div>
  );
}
