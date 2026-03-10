import { Avatar, Badge, Box, Icon, Icons, Text } from 'folds';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { MicrophoneSlash, SpeakerSlash, VideoCamera } from '@phosphor-icons/react';
import { Track } from 'livekit-client';
import { NavButton, NavItem, NavItemContent } from '../../components/nav';
import { UserAvatar } from '../../components/user-avatar';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useCallMemberPresence } from '../../hooks/useCallMemberPresence';
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

type RoomNavUserProps = {
  room: Room;
  userId: string;
  /** Live presence from the server-side bridge (highest priority source). */
  bridgePresence?: CallPresenceState;
};

type AttachableVideoTrack = {
  attach: (element?: HTMLMediaElement) => HTMLMediaElement;
  detach: (element?: HTMLMediaElement) => HTMLMediaElement[];
};

export function RoomNavUser({ room, userId, bridgePresence }: RoomNavUserProps) {
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
  const persistedPresence = useCallMemberPresence(mx, room.roomId, userId);
  const participantSpeaking = useMemo(() => {
    if (!isActiveCall || !livekitRoom) return false;
    if (isLocalUser) return livekitRoom.localParticipant.isSpeaking;

    return Array.from(livekitRoom.remoteParticipants.values()).some(
      (participant) =>
        resolveParticipantUserId(participant, room) === userId && participant.isSpeaking
    );
  }, [isActiveCall, isLocalUser, livekitRoom, room, userId]);
  const isSpeaking = isActiveCall && (speakingUsers.has(userId) || participantSpeaking);

  // ── Presence resolution ────────────────────────────────────────────────────
  //
  // LOCAL USER  → always use live LiveKit state from useCallState().
  //   We have perfect real-time data here. Bridge data is skipped entirely:
  //   it can lag or be momentarily wrong (e.g. track_muted webhook during
  //   mic-setup) and would override the correct local state, breaking the
  //   speaking indicator and mute badge.
  //
  // REMOTE USER → priority: bridge > livekit-client state > Matrix state.
  //   bridgePresence  — server-side SSE; works for ALL client versions.
  //   pState          — livekit-client remote participant snapshot.
  //   persistedPresence — Matrix io.bettercord.call.presence state event.

  const pState = activeCallRoomId === room.roomId ? remoteParticipantStates.get(userId) : undefined;
  const hasLivePresenceState = isLocalUser ? isActiveCall : pState !== undefined;

  // Bridge is ONLY used for remote users — never for the local user.
  const remoteBridge = isLocalUser ? undefined : bridgePresence;

  const isAudioMuted = isLocalUser
    ? (isActiveCall ? !isAudioEnabled : persistedPresence.isMicMuted)
    : remoteBridge
      ? remoteBridge.isMicMuted
      : hasLivePresenceState
        ? !(pState?.audioEnabled ?? true)
        : persistedPresence.isMicMuted;

  const isCameraOn = isLocalUser
    ? (isActiveCall ? isVideoEnabled : persistedPresence.isCameraOn)
    : remoteBridge
      ? remoteBridge.isCameraOn
      : hasLivePresenceState
        ? (pState?.videoEnabled ?? false)
        : persistedPresence.isCameraOn;

  // Deafen: local user always reads from live call state (isCallDeafened).
  // Remote users: bridge carries this via participant_attributes_changed webhook.
  const isDeafened = isLocalUser
    ? (isActiveCall ? isCallDeafened : persistedPresence.isDeafened)
    : remoteBridge
      ? remoteBridge.isDeafened
      : persistedPresence.isDeafened;

  const isScreensharing = isLocalUser
    ? (isActiveCall
        ? isScreenShareEnabled || persistedPresence.isScreenSharing
        : persistedPresence.isScreenSharing)
    : remoteBridge
      ? remoteBridge.isScreenSharing
      : hasLivePresenceState
        ? (pState?.isScreenSharing ?? false) || persistedPresence.isScreenSharing
        : persistedPresence.isScreenSharing;

  const presenceState = useMemo(
    () => ({
      isScreenSharing: isScreensharing,
      isCameraOn,
      isDeafened,
      isMicMuted: isAudioMuted,
    }),
    [isScreensharing, isCameraOn, isDeafened, isAudioMuted]
  );
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
