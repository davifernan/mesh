import { Avatar, Badge, Box, Icon, Icons, Text, Tooltip, TooltipProvider } from 'folds';
import React from 'react';
import { Room } from 'matrix-js-sdk';
import { MicrophoneSlash, VideoCamera } from '@phosphor-icons/react';
import { NavButton, NavItem, NavItemContent } from '../../components/nav';
import { UserAvatar } from '../../components/user-avatar';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useCallState } from '../../pages/client/call/CallProvider';
import { getMxIdLocalPart } from '../../utils/matrix';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useOpenUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { useSpaceOptionally } from '../../hooks/useSpace';
import styles from './RoomNavUser.module.css';

type RoomNavUserProps = {
  room: Room;
  userId: string;
};
export function RoomNavUser({ room, userId }: RoomNavUserProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const openProfile = useOpenUserRoomProfile();
  const space = useSpaceOptionally();
  const { activeCallRoomId, setActiveCallRoomId, speakingUsers, remoteParticipantStates } =
    useCallState();
  const isActiveCall = activeCallRoomId === room.roomId;
  const avatarMxcUrl = getMemberAvatarMxc(room, userId);
  const avatarUrl = avatarMxcUrl
    ? mx.mxcUrlToHttp(avatarMxcUrl, 32, 32, 'crop', undefined, false, useAuthentication)
    : undefined;
  const getName = getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId);
  const isSpeaking = isActiveCall && speakingUsers.has(userId);

  const pState = isActiveCall ? remoteParticipantStates.get(userId) : undefined;
  const isAudioMuted = isActiveCall && pState !== undefined && !pState.audioEnabled;
  const hasVideo = isActiveCall && pState !== undefined && pState.videoEnabled;
  const isScreensharing = isActiveCall && pState !== undefined && pState.isScreenSharing;

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

  const ariaLabel = `${getName}${isSpeaking ? ' (speaking)' : ''}`;

  return (
    <NavItem variant="Background" radii="400">
      <NavButton onClick={handleNavUserClick} aria-label={ariaLabel}>
        <NavItemContent as="div">
          <Box direction="Column" grow="Yes" gap="200" justifyContent="Stretch">
            <Box alignItems="Center" gap="200">
              <Avatar
                size="200"
                style={
                  isSpeaking
                    ? {
                        boxShadow: '0 0 0 2px #23a55a',
                        borderRadius: '50%',
                        transition: 'box-shadow 0.15s ease',
                      }
                    : { transition: 'box-shadow 0.15s ease' }
                }
              >
                <UserAvatar
                  userId={userId}
                  src={avatarUrl ?? undefined}
                  alt={getName}
                  renderFallback={() => <Icon size="50" src={Icons.User} filled />}
                />
              </Avatar>
              <Text as="span" size="B400" priority="300" truncate>
                {getName}
              </Text>
              <Box alignItems="Center" gap="100" shrink="No">
                {isScreensharing && (
                  <TooltipProvider
                    position="Top"
                    offset={4}
                    tooltip={
                      <Tooltip>
                        <Text>Watching stream</Text>
                      </Tooltip>
                    }
                  >
                    {(triggerRef) => (
                      <button
                        ref={triggerRef as React.RefCallback<HTMLButtonElement>}
                        type="button"
                        className={styles.liveBadgeButton}
                        onClick={handleLiveBadgeClick}
                        aria-label="Watch stream"
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
                      </button>
                    )}
                  </TooltipProvider>
                )}
                {isAudioMuted && (
                  <MicrophoneSlash size={12} style={{ color: '#f23f43', opacity: 0.85 }} />
                )}
                {hasVideo && (
                  <VideoCamera size={12} style={{ color: '#23a55a', opacity: 0.85 }} />
                )}
              </Box>
            </Box>
          </Box>
        </NavItemContent>
      </NavButton>
    </NavItem>
  );
}
