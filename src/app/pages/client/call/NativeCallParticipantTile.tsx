import React, { useMemo } from 'react';
import { type Participant, LocalParticipant, Track } from 'livekit-client';
import { VideoTrack, useTracks, type TrackReference } from '@livekit/components-react';
import { MicrophoneSlash, MonitorPlay, CornersOut, SpeakerSlash } from '@phosphor-icons/react';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { useCallState } from './CallProvider';
import { getMemberAvatarMxc } from '../../../utils/room';
import styles from './NativeCallParticipantTile.module.css';

// ── Avatar accent colors (Discord-like palette) ────────────────────────────
const AVATAR_COLORS = ['#5865f2', '#3ba55d', '#faa61a', '#ed4245', '#9b59b6'];

function getColorFromIdentity(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = identity.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Extracts Matrix userId from a LiveKit participant identity.
 * Legacy: "@user:server_DEVICEID" → "@user:server"
 * Otherwise returns identity as-is.
 */
function extractUserId(identity: string): string {
  if (identity.startsWith('@')) {
    const lastUnderscore = identity.lastIndexOf('_');
    if (lastUnderscore > 1) return identity.slice(0, lastUnderscore);
  }
  return identity;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface NativeCallParticipantTileProps {
  participant: Participant;
  /** Called when the user clicks the pin button. Phase 3 wires this up. */
  onPin?: (participantId: string | null) => void;
  /** Whether this tile is currently pinned (used by the focus layout). */
  isPinned?: boolean;
  /** Extra CSS class forwarded from the grid layout. */
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function NativeCallParticipantTile({
  participant,
  onPin,
  isPinned: _isPinned,
  className,
}: NativeCallParticipantTileProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const { activeCallRoomId, remoteParticipantStates, isAudioEnabled, isDeafened } = useCallState();

  // ── Track resolution ──────────────────────────────────────────────────
  const allTracksUnfiltered = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const allTracks = useMemo(
    () => allTracksUnfiltered.filter((t) => t.participant?.identity === participant.identity),
    [allTracksUnfiltered, participant.identity]
  );

  const cameraTrack = useMemo(
    () => allTracks.find((t) => t.source === Track.Source.Camera),
    [allTracks]
  );

  const hasScreenShare = useMemo(
    () =>
      allTracks.some(
        (t) =>
          t.source === Track.Source.ScreenShare &&
          'publication' in t &&
          t.publication != null
      ),
    [allTracks]
  );

  // ── Stream quality info ───────────────────────────────────────────────
  const camPub = participant.getTrackPublication(Track.Source.Camera);
  const dims = camPub?.dimensions;
  const fps = camPub?.track?.mediaStreamTrack.getSettings().frameRate;

  // ── Identity / display ───────────────────────────────────────────────
  const displayName = participant.name ?? participant.identity;
  const initial = displayName.charAt(0).toUpperCase();
  const isLocal = participant instanceof LocalParticipant;
  const userId = useMemo(() => extractUserId(participant.identity), [participant.identity]);

  // ── Matrix avatar ─────────────────────────────────────────────────────
  const room = activeCallRoomId ? mx.getRoom(activeCallRoomId) : null;
  const avatarMxcUrl = useMemo(
    () => (room ? getMemberAvatarMxc(room, userId) : undefined),
    [room, userId]
  );
  const avatarHttpUrl = useMemo(
    () =>
      avatarMxcUrl
        ? mx.mxcUrlToHttp(avatarMxcUrl, 80, 80, 'crop', undefined, false, useAuthentication) ??
          undefined
        : undefined,
    [mx, avatarMxcUrl, useAuthentication]
  );

  // ── Mute state ────────────────────────────────────────────────────────
  const isMuted = useMemo(() => {
    if (isLocal) return !isAudioEnabled;
    const pState = remoteParticipantStates.get(userId);
    return pState !== undefined ? !pState.audioEnabled : !participant.isMicrophoneEnabled;
  }, [isLocal, isAudioEnabled, remoteParticipantStates, userId, participant.isMicrophoneEnabled]);

  // ── Tile accent color from identity hash ──────────────────────────────
  const tileAccentColor = useMemo(
    () => getColorFromIdentity(participant.identity),
    [participant.identity]
  );

  // ── Camera visible? ───────────────────────────────────────────────────
  const hasCameraVideo = useMemo(() => {
    if (!cameraTrack) return false;
    if (!('publication' in cameraTrack) || !cameraTrack.publication) return false;
    return !cameraTrack.publication.isMuted && participant.isCameraEnabled;
  }, [cameraTrack, participant.isCameraEnabled]);

  return (
    <div
      className={[styles.tile, className].filter(Boolean).join(' ')}
      data-speaking={participant.isSpeaking ? 'true' : 'false'}
      style={{ '--voice-tile-accent-color': tileAccentColor } as React.CSSProperties}
    >
      {/* ── Camera / Avatar ─────────────────────────────────────────── */}
      <div
        className={styles.mediaWrapper}
        style={{ opacity: hasCameraVideo ? 1 : 0, transition: 'opacity 0.2s ease' }}
      >
        {hasCameraVideo && cameraTrack && 'publication' in cameraTrack && cameraTrack.publication && (
          <VideoTrack
            className={styles.video}
            trackRef={cameraTrack as TrackReference}
          />
        )}
      </div>

      <div
        className={styles.avatar}
        style={{ opacity: hasCameraVideo ? 0 : 1, transition: 'opacity 0.2s ease' }}
      >
        {avatarHttpUrl ? (
          <img
            className={styles.avatarImg}
            src={avatarHttpUrl}
            alt={displayName}
            draggable={false}
          />
        ) : (
          <div
            className={styles.initial}
            style={{ backgroundColor: tileAccentColor }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* ── "You" self-view pill ─────────────────────────────────────── */}
      {isLocal && <div className={styles.selfBadge}>You</div>}

      {/* ── Screen share badge ───────────────────────────────────────── */}
      {hasScreenShare && (
        <div className={styles.screenBadge}>
          <MonitorPlay size={11} weight="fill" />
          LIVE
        </div>
      )}

      {/* ── Pin button (hover-revealed, top-right) ───────────────────── */}
      <button
        className={styles.pinButton}
        onClick={(e) => {
          e.stopPropagation();
          onPin?.(participant.identity);
        }}
        aria-label="Pin participant"
        type="button"
      >
        <CornersOut size={16} />
      </button>

      {/* ── Stream quality pill (bottom-right) ──────────────────────── */}
      {dims && (
        <div className={styles.streamPill}>
          {dims.width}×{dims.height}
          {fps ? ` · ${Math.round(fps)}fps` : ''}
        </div>
      )}

      {/* ── Metadata bar (hover-revealed, bottom; always shown on mobile) ── */}
      <div className={styles.metadata}>
        <span className={styles.metaName}>{displayName}</span>
        {isMuted && (
          <MicrophoneSlash className={styles.muteIcon} size={14} weight="fill" />
        )}
        {/* Deafen indicator: only meaningful for the local participant */}
        {isLocal && isDeafened && (
          <SpeakerSlash className={styles.muteIcon} size={14} weight="fill" />
        )}
      </div>
    </div>
  );
}
