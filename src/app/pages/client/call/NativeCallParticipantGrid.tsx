import React, { useMemo } from 'react';
import { useParticipants, useTracks, VideoTrack, type TrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Monitor } from '@phosphor-icons/react';
import { NativeCallParticipantTile } from './NativeCallParticipantTile';
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

export function NativeCallParticipantGrid() {
  const participants = useParticipants();

  // Collect all active screenshare tracks across all participants.
  const allSSTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const screenShareTracks = useMemo(
    () => allSSTracks.filter((t): t is TrackReference => 'publication' in t && !!t.publication),
    [allSSTracks],
  );

  const hasScreenShare = screenShareTracks.length > 0;

  // Column count is based on participant (camera) tiles only.
  // Screenshare tiles span 2 cols, so they don't count as regular cells.
  const columns = useMemo(() => {
    const count = participants.length;
    if (hasScreenShare) {
      // Ensure at least 2 cols so screenshare spans 2 and camera tiles fill the rest.
      return count <= 2 ? 2 : count <= 6 ? 3 : 4;
    }
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4;
  }, [participants.length, hasScreenShare]);

  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {/* Screenshare tiles first — each spans 2 columns for prominence */}
      {screenShareTracks.map((t) => (
        <div
          key={`ss-${t.participant?.identity}`}
          style={{ gridColumn: `span ${Math.min(2, columns)}` }}
        >
          <ScreenShareTile trackRef={t} />
        </div>
      ))}

      {/* Regular participant camera tiles */}
      {participants.map((participant) => (
        <NativeCallParticipantTile key={participant.identity} participant={participant} />
      ))}
    </div>
  );
}
