import { useEffect, useMemo } from 'react';
import { ClientEvent, MatrixEvent, Room, RoomStateEvent } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import { useMatrixClient } from './useMatrixClient';
import { spaceLiveActivityAtom } from '../state/voiceActivity';
import { roomHasCallScreenShare } from './useCallMemberPresence';

function getSpaceChildRooms(space: Room, allRooms: Room[]): Room[] {
  return allRooms.filter((room) => {
    const ev = space.currentState.getStateEvents('m.space.child', room.roomId);
    return ev !== null && ev !== undefined;
  });
}

export function useSpaceLiveActivity(spaceIds: string[]): void {
  const mx = useMatrixClient();
  const setActivity = useSetAtom(spaceLiveActivityAtom);
  const stableSpaceIds = useMemo(() => [...spaceIds].sort(), [spaceIds]);
  const stableSpaceIdsKey = stableSpaceIds.join('|');

  useEffect(() => {
    const compute = () => {
      const allRooms = mx.getRooms();
      const map = new Map<string, boolean>();

      for (const spaceId of stableSpaceIds) {
        const space = mx.getRoom(spaceId);
        if (!space) {
          map.set(spaceId, false);
          continue;
        }
        const children = getSpaceChildRooms(space, allRooms);
        const hasActivity = children.some((room) => roomHasCallScreenShare(mx, room.roomId));
        map.set(spaceId, hasActivity);
      }

      setActivity(map);
    };

    compute();

    const handleEvent = (ev: MatrixEvent) => {
      if (ev.getType().includes('call.member')) {
        compute();
      }
    };

    mx.on(ClientEvent.Event, handleEvent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mx.on(RoomStateEvent.Events as any, handleEvent);
    return () => {
      mx.off(ClientEvent.Event, handleEvent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mx.off(RoomStateEvent.Events as any, handleEvent);
    };
  }, [stableSpaceIdsKey, mx, setActivity]);
}
