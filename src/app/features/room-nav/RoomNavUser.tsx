import { Avatar, Badge, Box, Icon, Icons, Text } from 'folds';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { MicrophoneSlash, SpeakerSlash, VideoCamera } from '@phosphor-icons/react';
import { Track } from 'livekit-client';
import { NavButton, NavItem, NavItemContent } from '../../components/nav';
import { UserAvatar } from '../../components/user-avatar';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useCallState } from '../../pages/client/call/CallProvider';
import { resolveParticipantUserId } from '../call/participantIdentity';
import { getPresenceBadgeKinds, getPresenceSummary, PRESENCE_BADGE_LABEL } from '../call/presenceBadges';
import type { CallPresenceState } from '../call/callPresenceState';
import { getMxIdLocalPart } from '../../utils/matrix';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useOpenUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { useSpaceOptionally } from '../../hooks/useSpace';
import styles from './RoomNavUser.module.css';

/**
 * Source of voice state for a RoomNavUser.
 *
 * - `'local'` (default): resolve presence via the standard priority chain
 *   (pState > bridge > all-false). Backward-compatible.
 * - `'authoritative'`: the caller has already resolved the presence externally
 *   (e.g. via useVoiceStateService in authoritative bridge mode) and passes it
 *   as `resolvedPresence`. The component skips its own resolution and renders
 *   the provided state directly.
 */
export type VoiceStateSource =
  | { kind: 'local' }
  | { kind: 'authoritative'; resolvedPresence: CallPresenceState };

type RoomNavUserProps = {
  room: Room;
  userId: string;
  /** Live presence from the server-side bridge (remote fallback behind pState). */
  bridgePresence?: CallPresenceState;
  /**
   * Optional override for the voice state source.
   * When `kind === 'authoritative'`, the component skips its own presence
   * resolution and renders `resolvedPresence` directly.
   * Defaults to `{ kind: 'local' }` for full backward compatibility.
   */
  voiceStateSource?: VoiceStateSource;
};

type AttachableVideoTrack = {
  attach: (element?: HTMLMediaElement) => HTMLMediaElement;
  detach: (element?: HTMLMediaElement) => HTMLMediaElement[];
};

export type ResolvePresenceArgs = {
  isLocalUser: boolean;
  isActiveCall: boolean;
  pState?: { audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean };
  remoteBridge?: CallPresenceState;
  /** Nur relevant wenn isLocalUser && isActiveCall */
  isAudioEnabled: boolean;
  /** Nur relevant wenn isLocalUser && isActiveCall */
  isVideoEnabled: boolean;
  /** Nur relevant wenn isLocalUser */
  isCallDeafened: boolean;
  /** Nur relevant wenn isLocalUser && isActiveCall */
  isScreenShareEnabled: boolean;
};

/**
 * Berechnet den anzuzeigenden Presence-State fuer einen RoomNavUser.
 *
 * Prioritaetsreihenfolge fuer Remote-User:
 *   1. LiveKit-Client-State (pState) – nur verfuegbar wenn lokaler Client im selben Call
 *   2. Bridge-Presence (remoteBridge) – server-seitig, funktioniert fuer alle Clients
 *
 * Lokaler User liest immer direkt aus dem live Call-State wenn aktiv, sonst alles false.
 */
export function resolvePresence({
  isLocalUser,
  isActiveCall,
  pState,
  remoteBridge,
  isAudioEnabled,
  isVideoEnabled,
  isCallDeafened,
  isScreenShareEnabled,
}: ResolvePresenceArgs): CallPresenceState {
  if (isLocalUser) {
    if (!isActiveCall) {
      return { isMicMuted: false, isCameraOn: false, isDeafened: false, isScreenSharing: false };
    }
    return {
      isMicMuted: !isAudioEnabled,
      isCameraOn: isVideoEnabled,
      isDeafened: isCallDeafened,
      isScreenSharing: isScreenShareEnabled,
    };
  }

  // Remote user: pState > bridge > all-false
  const isMicMuted = pState !== undefined
    ? !pState.audioEnabled
    : remoteBridge?.isMicMuted ?? false;

  const isCameraOn = pState !== undefined
    ? pState.videoEnabled
    : remoteBridge?.isCameraOn ?? false;

  const isDeafened = remoteBridge?.isDeafened ?? false;

  const isScreenSharing = pState !== undefined
    ? pState.isScreenSharing
    : remoteBridge?.isScreenSharing ?? false;

  return { isMicMuted, isCameraOn, isDeafened, isScreenSharing };
}

export function RoomNavUser({ room, userId, bridgePresence, voiceStateSource }: RoomNavUserProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const openProfile = useOpenUserRoomProfile();
  const space = useSpaceOptionally();
  const {
    activeCallRoomId,
    setActiveCallRoomId,
    speakingUsers,
    remoteParticipantStates,
    isAudioEnabled,
    isVideoEnabled,
    isDeafened: isCallDeafened,
    isScreenShareEnabled,
    livekitRoom,
    callStatus,
  } =
    useCallState();
  const isActiveCall = activeCallRoomId === room.roomId;
  const myUserId = mx.getUserId() ?? '';
  const isLocalUser = userId === myUserId;
  const avatarMxcUrl = getMemberAvatarMxc(room, userId);
  const avatarUrl = avatarMxcUrl
    ? mx.mxcUrlToHttp(avatarMxcUrl, 32, 32, 'crop', undefined, false, useAuthentication)
    : undefined;
  const getName = getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId);
  const isSpeaking = isActiveCall && speakingUsers.has(userId);

  // ── Presence resolution ────────────────────────────────────────────────────
  //
  // When voiceStateSource.kind === 'authoritative', the caller has already
  // resolved the presence (e.g. via useVoiceStateService) and we render it
  // directly without any further resolution. This is the migration path for
  // authoritative bridge mode.
  //
  // When voiceStateSource.kind === 'local' (default), we apply the standard
  // priority chain:
  //
  //   LOCAL USER  → use the live call state directly while this room is active,
  //     otherwise all-false. Bridge data is skipped entirely: it can lag or be
  //     momentarily wrong (e.g. track_muted webhook during mic-setup) and would
  //     override the correct local state, breaking the speaking indicator and
  //     mute badge.
  //
  //   REMOTE USER → priority: pState > bridge > all-false.
  //     pState         — livekit-client remote participant snapshot while local client is in-call.
  //     bridgePresence — server-side SSE; works for all client versions.

  const pState = activeCallRoomId === room.roomId ? remoteParticipantStates.get(userId) : undefined;

  const presenceState = useMemo((): CallPresenceState => {
    // Authoritative mode: caller has pre-resolved the presence — use it directly.
    if (voiceStateSource?.kind === 'authoritative') {
      return voiceStateSource.resolvedPresence;
    }

    // Default (local) mode: pState > bridge > all-false.
    return resolvePresence({
      isLocalUser,
      isActiveCall,
      pState,
      remoteBridge: isLocalUser ? undefined : bridgePresence,
      isAudioEnabled,
      isVideoEnabled,
      isCallDeafened,
      isScreenShareEnabled,
    });
  }, [
    voiceStateSource,
    isLocalUser,
    isActiveCall,
    pState,
    bridgePresence,
    isAudioEnabled,
    isVideoEnabled,
    isCallDeafened,
    isScreenShareEnabled,
  ]);
  const { isMicMuted: isAudioMuted, isCameraOn, isDeafened, isScreenSharing: isScreensharing } = presenceState;
  const badgeKinds = useMemo(() => getPresenceBadgeKinds(presenceState), [presenceState]);

  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);

  const previewTrack = useMemo<AttachableVideoTrack | null>(() => {
    if (!isScreensharing || !livekitRoom || activeCallRoomId !== room.roomId || callStatus !== 'connected') {
      return null;
    }

    if (isLocalUser) {
      const localPub = livekitRoom.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      return (localPub?.track as AttachableVideoTrack | undefined) ?? null;
    }

    const remoteParticipant = Array.from(livekitRoom.remoteParticipants.values()).find(
      (participant) => resolveParticipantUserId(participant, room) === userId
    );
    if (!remoteParticipant) return null;

    const screenSharePub = Array.from(remoteParticipant.trackPublications.values()).find(
      (pub) => pub.source === Track.Source.ScreenShare && pub.track
    );
    return (screenSharePub?.track as AttachableVideoTrack | undefined) ?? null;
  }, [
    isScreensharing,
    livekitRoom,
    activeCallRoomId,
    room.roomId,
    room,
    callStatus,
    isLocalUser,
    userId,
  ]);

  useEffect(() => {
    const video = previewRef.current;
    if (video && showPreview && previewTrack) {
      previewTrack.attach(video);
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;

      return () => {
        previewTrack.detach(video);
      };
    }

    return undefined;
  }, [showPreview, previewTrack]);

  const handleNavUserClick: React.MouseEventHandler<HTMLButtonElement> = (evt) => {
    openProfile(room.roomId, space?.roomId, userId, evt.currentTarget.getBoundingClientRect());
  };

  const handleLiveBadgeClick: React.MouseEventHandler<HTMLButtonElement> = (evt) => {
    evt.stopPropagation();
    if (activeCallRoomId === room.roomId) {
      // Already watching this call — do nothing
      return;
    }
    setActiveCallRoomId(room.roomId, true);
  };

  const presenceSummary = getPresenceSummary(presenceState);
  const ariaLabel = `${getName}${isSpeaking ? ', speaking' : ''}. ${presenceSummary}.`;

  return (
    <NavItem variant="Background" radii="400" data-speaking={isSpeaking}>
      <NavButton onClick={handleNavUserClick} aria-label={ariaLabel}>
        <NavItemContent as="div">
          <Box direction="Column" grow="Yes" gap="200" justifyContent="Stretch" className={styles.userContent}>
            <Box
              alignItems="Center"
              gap="200"
              className={`${styles.userRow}${isSpeaking ? ` ${styles.userRowSpeaking}` : ''}`}
            >
              <Avatar
                size="200"
                className={isSpeaking ? styles.speakingAvatar : undefined}
              >
                <UserAvatar
                  userId={userId}
                  src={avatarUrl ?? undefined}
                  alt={getName}
                  renderFallback={() => <Icon size="50" src={Icons.User} filled />}
                />
              </Avatar>
              <Text
                as="span"
                size="B400"
                priority="300"
                truncate
                className={isSpeaking ? styles.speakingName : styles.userName}
              >
                {getName}
              </Text>
              {isSpeaking && <span className={styles.speakingDot} aria-hidden="true" />}
              <Box alignItems="Center" gap="100" shrink="No" className={styles.badgeRow}>
                {badgeKinds.includes('live') && (
                  <button
                    type="button"
                    className={styles.liveBadgeButton}
                    onClick={handleLiveBadgeClick}
                    aria-label={
                      activeCallRoomId === room.roomId
                        ? 'Watching live stream'
                        : 'Join call and watch live stream'
                    }
                    onMouseEnter={() => setShowPreview(true)}
                    onMouseLeave={() => setShowPreview(false)}
                  >
                    <Badge
                      size="300"
                      fill="Soft"
                      radii="Pill"
                      className={styles.liveBadge}
                    >
                      <Text
                        as="span"
                        size="L400"
                        style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em' }}
                      >
                        LIVE
                      </Text>
                    </Badge>

                    {showPreview && previewTrack && (
                      <div className={styles.livePreview}>
                        <video ref={previewRef} className={styles.livePreviewVideo}>
                          <track kind="captions" />
                        </video>
                      </div>
                    )}
                  </button>
                )}
                {badgeKinds.includes('camera') && (
                  <span className={`${styles.presenceIcon} ${styles.cameraIcon}`} title={PRESENCE_BADGE_LABEL.camera}>
                    <VideoCamera size={12} aria-hidden="true" />
                  </span>
                )}
                {badgeKinds.includes('deafened') && (
                  <span
                    className={`${styles.presenceIcon} ${styles.deafenedIcon}`}
                    title={PRESENCE_BADGE_LABEL.deafened}
                  >
                    <SpeakerSlash size={12} aria-hidden="true" />
                  </span>
                )}
                {badgeKinds.includes('muted') && (
                  <span className={`${styles.presenceIcon} ${styles.mutedIcon}`} title={PRESENCE_BADGE_LABEL.muted}>
                    <MicrophoneSlash size={12} aria-hidden="true" />
                  </span>
                )}
              </Box>
            </Box>
          </Box>
        </NavItemContent>
      </NavButton>
    </NavItem>
  );
}
