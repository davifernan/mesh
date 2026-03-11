import React from 'react';
import { Badge, Box, Text, config } from 'folds';
import { useAtomValue } from 'jotai';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { useActiveCallRooms } from '../../../hooks/useActiveCallRooms';
import { RoomNavItem } from '../../../features/room-nav';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { getSpaceRoomPath, getHomeRoomPath } from '../../pathUtils';
import { NavCategory, NavCategoryHeader } from '../../../components/nav';

export function ActiveCallsSection() {
  const mx = useMatrixClient();
  const roomToParents = useAtomValue(roomToParentsAtom);
  const selectedRoomId = useSelectedRoom();
  const activeCallRooms = useActiveCallRooms(mx);

  if (activeCallRooms.length === 0) return null;

  return (
    <NavCategory>
      <NavCategoryHeader>
        <Text size="O400" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Voice Active
        </Text>
      </NavCategoryHeader>
      {activeCallRooms.map((room) => {
        const parentIds = roomToParents.get(room.roomId);
        const parentSpaceId = parentIds ? [...parentIds][0] : undefined;
        const parentSpace = parentSpaceId ? mx.getRoom(parentSpaceId) : undefined;

        const roomAlias = getCanonicalAliasOrRoomId(mx, room.roomId);
        const linkPath = parentSpaceId
          ? getSpaceRoomPath(getCanonicalAliasOrRoomId(mx, parentSpaceId), roomAlias)
          : getHomeRoomPath(roomAlias);

        return (
          <Box key={room.roomId} direction="Column">
            {parentSpace && (
              <Box
                style={{
                  paddingLeft: config.space.S200,
                  paddingBottom: config.space.S100,
                  paddingTop: config.space.S100,
                }}
              >
                <Badge size="200" variant="Secondary" fill="Soft" radii="Pill" outlined={false}>
                  <Text as="span" size="L400" style={{ fontSize: '10px', fontWeight: 600 }}>
                    {parentSpace.name}
                  </Text>
                </Badge>
              </Box>
            )}
            <RoomNavItem
              room={room}
              selected={selectedRoomId === room.roomId}
              linkPath={linkPath}
            />
          </Box>
        );
      })}
    </NavCategory>
  );
}
