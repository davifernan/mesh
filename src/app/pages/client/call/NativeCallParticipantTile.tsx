import React, { useMemo, useRef, useState, useEffect } from 'react';
import { type Participant, LocalParticipant, Track } from 'livekit-client';
import { VideoTrack, useTracks, type TrackReference } from '@livekit/components-react';
import {
  MicrophoneSlash,
  MonitorPlay,
  CornersOut,
  SpeakerSlash,
  User,
  MusicNote,
} from '@phosphor-icons/react';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import {
  resolveParticipantDisplayName,
  resolveParticipantUserId,
} from '../../../features/call/participantIdentity';
import { useCallState } from './CallProvider';
import { getPresenceBadgeKinds, getPresenceSummary } from '../../../features/call/presenceBadges';
import { getMemberAvatarMxc } from '../../../utils/room';
import styles from './NativeCallParticipantTile.module.css';

// ── Avatar accent colors (Discord-like palette) ────────────────────────────
const AVATAR_COLORS = ['#5865f2', '#3ba55d', '#faa61a', '#ed4245', '#9b59b6'];

function getColorFromIdentity(identity: string): string {
  const hash = Array.from(identity).reduce(
    (acc, char, index) => acc + char.charCodeAt(0) * (index + 1),
    0
  );
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
  isPinned = false,
  className,
}: NativeCallParticipantTileProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const {
    activeCallRoomId,
    remoteParticipantStates,
    remoteSoundboardClips,
    speakingUsers,
    isAudioEnabled,
    isDeafened,
    isFrontCamera,
  } = useCallState();

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
  const isLocal = participant instanceof LocalParticipant;
  const room = activeCallRoomId ? mx.getRoom(activeCallRoomId) : null;
  const userId = useMemo(
    () => resolveParticipantUserId(participant, room),
    [participant, room]
  );
  const displayName = useMemo(() => resolveParticipantDisplayName(participant, room), [participant, room]);
  const isSpeaking = speakingUsers.has(userId);

  // ── Matrix avatar ─────────────────────────────────────────────────────
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

  const isCameraOn = useMemo(() => {
    if (isLocal) return participant.isCameraEnabled;
    const pState = remoteParticipantStates.get(userId);
    return pState !== undefined ? pState.videoEnabled : participant.isCameraEnabled;
  }, [isLocal, remoteParticipantStates, userId, participant.isCameraEnabled]);

  // Local: use engine's own deafen state. Remote: use LiveKit attribute fast-path (#78).
  const isParticipantDeafened = isLocal
    ? isDeafened
    : (remoteParticipantStates.get(userId)?.isDeafened ?? false);

  // Soundboard clip this participant is currently playing (from data channel, #80)
  const activeSoundboardClip = remoteSoundboardClips.get(userId) ?? null;

  const presenceState = useMemo(
    () => ({
      isScreenSharing: hasScreenShare,
      isCameraOn,
      isDeafened: isParticipantDeafened,
      isMicMuted: isMuted,
    }),
    [hasScreenShare, isCameraOn, isParticipantDeafened, isMuted]
  );
  const badgeKinds = useMemo(() => getPresenceBadgeKinds(presenceState), [presenceState]);
  const tileAriaLabel = `${displayName}${isSpeaking ? ', speaking' : ''}. ${getPresenceSummary(
    presenceState
  )}.`;

  // ── Tile accent color from identity hash ──────────────────────────────
  const tileAccentColor = useMemo(
    () => getColorFromIdentity(participant.identity),
    [participant.identity]
  );

  // ── Responsive avatar size (32% of shortest tile dimension) ──────────
  const tileRef = useRef<HTMLDivElement>(null);
  const [avatarSize, setAvatarSize] = useState(64);

  useEffect(() => {
    const el = tileRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const base = Math.min(width, height);
      // 32% of shortest dimension, min 40px, max 160px, rounded to nearest even
      const size = Math.round(Math.max(40, Math.min(base * 0.32, 160)) / 2) * 2;
      setAvatarSize(size);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Camera visible? ───────────────────────────────────────────────────
  const hasCameraVideo = useMemo(() => {
    if (!cameraTrack) return false;
    if (!('publication' in cameraTrack) || !cameraTrack.publication) return false;
    return !cameraTrack.publication.isMuted && participant.isCameraEnabled;
  }, [cameraTrack, participant.isCameraEnabled]);

  return (
    <div
      ref={tileRef}
      className={[styles.tile, className].filter(Boolean).join(' ')}
      data-speaking={isSpeaking ? 'true' : 'false'}
      data-pinned={isPinned ? 'true' : 'false'}
      style={{
        '--voice-tile-accent-color': tileAccentColor,
        '--avatar-size': `${avatarSize}px`,
      } as React.CSSProperties}
      role="group"
      aria-label={tileAriaLabel}
    >
      {/* ── Camera / Avatar ─────────────────────────────────────────── */}
      <div
        className={styles.mediaWrapper}
        style={{ opacity: hasCameraVideo ? 1 : 0, transition: 'opacity 0.2s ease' }}
      >
        {hasCameraVideo && cameraTrack && 'publication' in cameraTrack && cameraTrack.publication && (
          <VideoTrack
            className={[styles.video, isLocal && isFrontCamera ? styles.videoMirrored : ''].filter(Boolean).join(' ')}
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
            <User size={Math.round(avatarSize * 0.6)} weight="fill" />
          </div>
        )}
      </div>

      {/* ── "You" self-view pill ─────────────────────────────────────── */}
      {isLocal && <div className={styles.selfBadge}>You</div>}

      {/* ── Soundboard clip badge (#80) ───────────────────────────────── */}
      {activeSoundboardClip && (
        <div className={styles.soundboardBadge} title={`Playing: ${activeSoundboardClip}`}>
          <MusicNote size={11} weight="fill" aria-hidden="true" />
          {activeSoundboardClip}
        </div>
      )}

      {/* ── Screen share badge ───────────────────────────────────────── */}
      {badgeKinds.includes('live') && (
        <div className={styles.screenBadge}>
          <MonitorPlay size={11} weight="fill" aria-hidden="true" />
          LIVE
        </div>
      )}

      {/* ── Pin button (hover-revealed, top-right) ───────────────────── */}
      <button
        className={styles.pinButton}
        onClick={(e) => {
          e.stopPropagation();
          onPin?.(isPinned ? null : participant.identity);
        }}
        aria-label={isPinned ? 'Unpin participant' : 'Pin participant'}
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

      {/* ── Metadata bar (always visible) ── */}
      <div className={styles.metadata}>
        <div className={styles.metaChip}>
          {badgeKinds.includes('muted') && (
            <MicrophoneSlash size={12} weight="fill" className={styles.metaIconMuted} aria-hidden="true" />
          )}
          {badgeKinds.includes('deafened') && (
            <SpeakerSlash size={12} weight="fill" className={styles.metaIconDeafened} aria-hidden="true" />
          )}
          <span className={styles.metaName}>{displayName}</span>
        </div>
      </div>
    </div>
  );
}
