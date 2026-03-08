import { EventType, Room } from 'matrix-js-sdk';
import React, {
  useCallback,
  MouseEventHandler,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Box, Button, config, Spinner, Text } from 'folds';
import { useCallState } from '../../pages/client/call/CallProvider';
import { useCallMembers } from '../../hooks/useCallMemberships';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { CallViewUser } from './CallViewUser';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import * as css from './CallView.css';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { useRoomName } from '../../hooks/useRoomMeta';

export function CallViewUserGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      className={css.CallViewUserGrid}
      style={{
        maxWidth: React.Children.count(children) === 4 ? '336px' : '503px',
      }}
    >
      {children}
    </Box>
  );
}

export function CallView({ room }: { room: Room }) {
  const mx = useMatrixClient();
  const [visibleCallNames, setVisibleCallNames] = useState('');

  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);
  const roomName = useRoomName(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const canJoin = permissions.event(EventType.GroupCallMemberPrefix, mx.getSafeUserId());

  const {
    activeCallRoomId,
    callStatus,
    setActiveCallRoomId,
    hangUp,
    setViewedCallRoomId,
    isCallViewOpen,
  } = useCallState();

  const isActiveCallRoom = activeCallRoomId === room.roomId;
  const callIsConnected = isActiveCallRoom && callStatus === 'connected';
  const callMembers = useCallMembers(mx, room.roomId);

  const getName = (userId: string) =>
    getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId);

  const memberDisplayNames = callMembers.map((userId) => getName(userId));

  const { navigateRoom } = useRoomNavigate();
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;

  const handleJoinVCClick: MouseEventHandler<HTMLElement> = (evt) => {
    if (!canJoin) return;

    if (isMobile) {
      evt.stopPropagation();
      setViewedCallRoomId(room.roomId);
      navigateRoom(room.roomId);
    }
    if (!callIsConnected) {
      hangUp();
      setActiveCallRoomId(room.roomId, true);
    }
  };

  // NOTE: Visibility is driven by isCallViewOpen (set in CallProvider when call starts).
  // For voice rooms isCallViewOpen=true by default; for regular rooms isCallViewOpen=false.
  const isCallViewVisible = (room.isCallRoom() || isActiveCallRoom) && isCallViewOpen;

  useEffect(() => {
    if (memberDisplayNames.length <= 2) {
      setVisibleCallNames(memberDisplayNames.join(' and '));
    } else {
      const visible = memberDisplayNames.slice(0, 2);
      const remaining = memberDisplayNames.length - 2;
      setVisibleCallNames(
        `${visible.join(', ')}, and ${remaining} other${remaining > 1 ? 's' : ''}`
      );
    }
  }, [memberDisplayNames]);

  return (
    <Box
      grow="Yes"
      direction="Column"
      style={{ display: isCallViewVisible ? 'flex' : 'none' }}
    >
      <Box
        grow="Yes"
        justifyContent="Center"
        alignItems="Center"
        direction="Column"
        gap="300"
        style={{
          // While active call is connecting/connected, the NativeCallView overlay
          // covers this area — hide the join UI to avoid duplicate content.
          display: isActiveCallRoom ? 'none' : 'flex',
        }}
      >
        <CallViewUserGrid>
          {callMembers.slice(0, 6).map((userId) => (
            <CallViewUser key={userId} room={room} userId={userId} />
          ))}
        </CallViewUserGrid>

        <Box
          direction="Column"
          alignItems="Center"
          style={{
            paddingBlock: config.space.S200,
          }}
        >
          <Text
            size="H1"
            as="h2"
            style={{
              paddingBottom: config.space.S300,
            }}
          >
            {roomName}
          </Text>
          <Text size="T200">
            {visibleCallNames !== '' ? visibleCallNames : 'No one'}{' '}
            {memberDisplayNames.length > 1 ? 'are' : 'is'} currently in voice
          </Text>
        </Box>
        <Button
          variant="Secondary"
          disabled={!canJoin || isActiveCallRoom}
          onClick={handleJoinVCClick}
        >
          {isActiveCallRoom ? (
            <Box justifyContent="Center" alignItems="Center" gap="200">
              <Spinner />
              <Text size="B500">{activeCallRoomId === room.roomId ? `Joining` : 'Join Voice'}</Text>
            </Box>
          ) : (
            <Text size="B500">{canJoin ? 'Join Voice' : 'Channel Locked'}</Text>
          )}
        </Button>
      </Box>
    </Box>
  );
}
