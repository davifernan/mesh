import React, { useMemo } from 'react';
import { type Participant, Track } from 'livekit-client';
import { VideoTrack, useTracks, type TrackReference } from '@livekit/components-react';
import { MicrophoneSlash, Monitor } from '@phosphor-icons/react';
import styles from './NativeCallParticipantTile.module.css';

const AVATAR_COLORS = ['#5865f2', '#3ba55d', '#faa61a', '#ed4245', '#9b59b6'];

function getAvatarColor(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = identity.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface NativeCallParticipantTileProps {
  participant: Participant;
}

export function NativeCallParticipantTile({ participant }: NativeCallParticipantTileProps) {
  const allTracksUnfiltered = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  // Filter to only this participant's tracks
  const allTracks = useMemo(
    () => allTracksUnfiltered.filter((t) => t.participant?.identity === participant.identity),
    [allTracksUnfiltered, participant.identity]
  );

  const cameraTrack = useMemo(
    () => allTracks.find((t) => t.source === Track.Source.Camera),
    [allTracks]
  );

  const hasScreenShare = useMemo(
    () => allTracks.some((t) => t.source === Track.Source.ScreenShare && 'publication' in t && t.publication?.isSubscribed !== false),
    [allTracks]
  );

  const camPub = participant.getTrackPublication(Track.Source.Camera);
  const dims = camPub?.dimensions;
  const fps = camPub?.track?.mediaStreamTrack.getSettings().frameRate;

  const displayName = participant.name ?? participant.identity;
  const initial = displayName.charAt(0).toUpperCase();
  const avatarColor = useMemo(() => getAvatarColor(participant.identity), [participant.identity]);

  const tileClass = [styles.tile, participant.isSpeaking ? styles.speaking : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={tileClass}>
      {participant.isCameraEnabled && cameraTrack && 'publication' in cameraTrack && cameraTrack.publication && !cameraTrack.publication.isMuted ? (
        <VideoTrack className={styles.video} trackRef={cameraTrack as TrackReference} />
      ) : (
        <div className={styles.avatar}>
          <div className={styles.initial} style={{ backgroundColor: avatarColor }}>
            {initial}
          </div>
        </div>
      )}

      {hasScreenShare && (
        <div className={styles.screenBadge}>
          <Monitor size={14} weight="bold" />
        </div>
      )}

      {dims && (
        <div className={styles.streamPill}>
          {dims.width}×{dims.height}{fps ? ` · ${Math.round(fps)}fps` : ''}
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.name}>{displayName}</span>
        {!participant.isMicrophoneEnabled && (
          <MicrophoneSlash className={styles.muteIcon} size={14} weight="bold" />
        )}
      </div>
    </div>
  );
}
