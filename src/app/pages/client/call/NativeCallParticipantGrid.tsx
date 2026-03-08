import React, { useMemo, useEffect, useState } from 'react';
import { useParticipants, useTracks, VideoTrack, type TrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Monitor, CaretUp, CaretDown } from '@phosphor-icons/react';
import { useAtom, useSetAtom } from 'jotai';
import { voiceCallLayoutAtom, pinParticipantAtom } from './VoiceCallLayoutStore';
import { NativeCallParticipantTile } from './NativeCallParticipantTile';
import { useCallState } from './CallProvider';
import styles from './NativeCallParticipantGrid.module.css';

/** A dedicated tile that renders a participant's screenshare video. */
function ScreenShareTile({ trackRef }: { trackRef: TrackReference }) {
  const name = trackRef.participant?.name ?? trackRef.participant?.identity ?? 'Someone';
  return (
    <div className={styles.screenTile}>
      <VideoTrack trackRef={trackRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <div className={styles.screenTileLabel}>
        <Monitor size={13} weight="bold" style={{ flexShrink: 0 }} />
        {name}&apos;s screen
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
    <div className={styles.grid}>
      {/* Screenshare tiles first */}
      {screenShareTracks.map((t) => (
        <div key={`ss-${t.participant?.identity}`} className={styles.screenTileWrap}>
          <ScreenShareTile trackRef={t} />
        </div>
      ))}

      {/* Regular participant camera tiles */}
      {participants.map((participant) => (
        <NativeCallParticipantTile
          key={participant.identity}
          participant={participant}
          onPin={handlePin}
          className={styles.tile}
        />
      ))}
    </div>
  );
}
