import React, { useMemo, useLayoutEffect, useState, useRef } from 'react';
import { useParticipants, type TrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { useAtom, useSetAtom } from 'jotai';
import { voiceCallLayoutAtom, pinParticipantAtom } from './VoiceCallLayoutStore';
import { NativeCallParticipantTile } from './NativeCallParticipantTile';
import { ScreenShareTile } from './ScreenShareTile';
import { AppTile, WIDGET_PIN_PREFIX, widgetPinId } from './AppTile';
import { useCallState } from './CallProvider';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import type { Room as MatrixRoom } from 'matrix-js-sdk';
import type { RoomWidget } from '../../../hooks/useRoomWidgets';
import styles from './NativeCallParticipantGrid.module.css';

interface NativeCallParticipantGridProps {
  onPin?: (participantId: string | null) => void;
  /** Active room widgets — rendered as extra "participant" tiles. */
  widgets?: RoomWidget[];
}

const DISPLAY_COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const OVERFLOW_ENTER_HYSTERESIS_PX = 2;
const OVERFLOW_EXIT_HYSTERESIS_PX = 6;
const TILE_ASPECT_RATIO = 16 / 9;

interface GridStyle extends React.CSSProperties {
  '--voice-grid-single-tile-width'?: string;
}

function resolveOverflowWithHysteresis(overflowDelta: number, wasOverflowing: boolean): boolean {
  if (wasOverflowing) {
    return overflowDelta > -OVERFLOW_EXIT_HYSTERESIS_PX;
  }

  return overflowDelta > OVERFLOW_ENTER_HYSTERESIS_PX;
}

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

  const { livekitRoom, activeCallRoomId, watchedScreenShares } = useCallState();
  const mx = useMatrixClient();
  const activeRoom: MatrixRoom | null = activeCallRoomId ? (mx.getRoom(activeCallRoomId) ?? null) : null;
  const [layoutState, setLayoutState] = useAtom(voiceCallLayoutAtom);
  const pinParticipant = useSetAtom(pinParticipantAtom);
  const { layoutMode, pinnedParticipantId, isCarouselExpanded } = layoutState;

  const screenShareTracks = useMemo(
    () => allParticipants.flatMap((participant) => {
      const publication = participant.getTrackPublication(Track.Source.ScreenShare);
      if (!publication) return [];
      return [{ participant, publication, source: Track.Source.ScreenShare } as TrackReference];
    }),
    [allParticipants],
  );

  const widgetCount = widgets?.length ?? 0;
  const hasWidgets = widgetCount > 0;
  const gridTileCount = widgetCount + screenShareTracks.length + participants.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [singleTileWidthPx, setSingleTileWidthPx] = useState<number | null>(null);
  const overflowStateRef = useRef(false);
  const gridStyle = useMemo<GridStyle | undefined>(() => {
    if (gridTileCount !== 1 || singleTileWidthPx == null) {
      return undefined;
    }
    return {
      '--voice-grid-single-tile-width': `${Math.round(singleTileWidthPx)}px`,
    };
  }, [gridTileCount, singleTileWidthPx]);

  useLayoutEffect(() => {
    if (gridTileCount <= 1) {
      overflowStateRef.current = false;
      setIsOverflowing(false);
      return;
    }

    const container = containerRef.current;
    const grid = gridRef.current;
    if (!container || !grid) return;

    const recompute = () => {
      const overflowDelta = grid.scrollHeight - container.clientHeight;
      const nextOverflow = resolveOverflowWithHysteresis(overflowDelta, overflowStateRef.current);
      overflowStateRef.current = nextOverflow;
      setIsOverflowing((prev) => (prev === nextOverflow ? prev : nextOverflow));
    };

    if (typeof ResizeObserver === 'undefined') {
      recompute();
      return;
    }

    const observer = new ResizeObserver(() => {
      recompute();
    });
    observer.observe(container);
    observer.observe(grid);
    recompute();

    return () => {
      observer.disconnect();
    };
  }, [gridTileCount]);

  useLayoutEffect(() => {
    if (gridTileCount !== 1) {
      setSingleTileWidthPx(null);
      return;
    }

    const container = containerRef.current;
    const grid = gridRef.current;
    if (!container || !grid) return;

    const recomputeSingleTileWidth = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      if (containerWidth <= 0 || containerHeight <= 0) return;

      const computed = window.getComputedStyle(grid);
      const sidePadding = Number.parseFloat(computed.getPropertyValue('--voice-grid-side-padding')) || 12;
      const verticalPadding = Number.parseFloat(computed.getPropertyValue('--voice-grid-vertical-padding')) || 14;
      const availableWidth = Math.max(0, containerWidth - sidePadding * 2);
      const availableHeight = Math.max(0, containerHeight - verticalPadding * 2);
      const nextWidth = Math.max(0, Math.min(availableWidth, availableHeight * TILE_ASPECT_RATIO));
      setSingleTileWidthPx((previousWidth) => {
        if (previousWidth != null && Math.abs(previousWidth - nextWidth) < 0.5) {
          return previousWidth;
        }
        return nextWidth;
      });
    };

    if (typeof ResizeObserver === 'undefined') {
      recomputeSingleTileWidth();
      return;
    }

    const observer = new ResizeObserver(() => {
      recomputeSingleTileWidth();
    });
    observer.observe(container);
    observer.observe(grid);
    recomputeSingleTileWidth();

    return () => {
      observer.disconnect();
    };
  }, [gridTileCount]);

  const handlePin = (participantId: string | null) => {
    pinParticipant(participantId);
    onPin?.(participantId);
  };

  const toggleCarousel = () => {
    setLayoutState((prev) => ({ ...prev, isCarouselExpanded: !prev.isCarouselExpanded }));
  };

  const pinnedScreenShareTrack =
    pinnedParticipantId !== null
      ? screenShareTracks.find((t) => t.participant.identity === pinnedParticipantId)
      : undefined;
  const shouldShowFocusMode =
    layoutMode === 'focus' &&
    pinnedParticipantId !== null &&
    (!pinnedScreenShareTrack || watchedScreenShares.has(pinnedParticipantId));

  // ── FOCUS MODE ──────────────────────────────────────────────────────────────
  if (shouldShowFocusMode && pinnedParticipantId !== null) {
    const isWidgetPin = pinnedParticipantId.startsWith(WIDGET_PIN_PREFIX);
    const pinnedWidgetId = isWidgetPin ? pinnedParticipantId.slice(WIDGET_PIN_PREFIX.length) : null;
    const pinnedWidget = pinnedWidgetId
      ? (widgets ?? []).find((w) => w.id === pinnedWidgetId)
      : null;
    const pinnedParticipant = !isWidgetPin
      ? participants.find((p) => p.identity === pinnedParticipantId)
      : undefined;
    const otherParticipants = participants.filter((p) => p.identity !== pinnedParticipantId);
    const pinnedSSTrack = !isWidgetPin ? pinnedScreenShareTrack : undefined;

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
            <ScreenShareTile
              trackRef={pinnedSSTrack}
              livekitRoom={livekitRoom}
              matrixRoom={activeRoom}
              onStopWatching={() => handlePin(null)}
            />
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
    <div
      ref={containerRef}
      className={`${styles.gridWrapper}${isOverflowing ? ` ${styles.gridWrapperOverflowing}` : ''}`}
    >
      <div
        ref={gridRef}
        className={styles.grid}
        data-overflowing={isOverflowing ? 'true' : 'false'}
        data-tile-count={String(gridTileCount)}
        style={gridStyle}
      >
        {/* In grid mode, everything is a regular tile, including screenshares. */}
        {(widgets ?? []).map((w) => (
          <div key={`widget-${w.id}`} className={styles.gridItem}>
            <AppTile
              widget={w}
              onPin={handlePin}
              isPinned={pinnedParticipantId === widgetPinId(w.id)}
            />
          </div>
        ))}

        {/* Screenshare tiles */}
        {screenShareTracks.map((t) => (
          <div key={`ss-${t.participant?.identity}`} className={styles.gridItem}>
            <ScreenShareTile
              trackRef={t}
              livekitRoom={livekitRoom}
              matrixRoom={activeRoom}
              onWatch={() => {
                if (t.participant?.identity) {
                  pinParticipant(t.participant.identity);
                }
              }}
              onStopWatching={() => {
                if (pinnedParticipantId === t.participant?.identity) {
                  pinParticipant(null);
                }
              }}
            />
          </div>
        ))}

        {/* Regular participant camera tiles */}
        {participants.map((participant) => (
          <div key={participant.identity} className={styles.gridItem}>
            <NativeCallParticipantTile
              participant={participant}
              onPin={handlePin}
              className={styles.tile}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
