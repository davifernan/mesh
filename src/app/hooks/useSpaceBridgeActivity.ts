import { useContext, useEffect, useMemo } from 'react';
import { ClientEvent, MatrixEvent, Room, RoomStateEvent } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import { BridgePresenceContext } from '../features/call/BridgePresenceContext';
import { spaceLiveActivityAtom, spaceVoiceActivityAtom } from '../state/voiceActivity';
import { useMatrixClient } from './useMatrixClient';

type SpaceActivityRoomIds = {
  voiceRoomIds: string[];
  liveRoomIds: string[];
};

function getSpaceChildRooms(space: Room, allRooms: Room[]): Room[] {
  return allRooms.filter((room) => {
    const ev = space.currentState.getStateEvents('m.space.child', room.roomId);
    return ev !== null && ev !== undefined;
  });
}

function uniqueRoomIds(roomIds: string[]): string[] {
  return Array.from(new Set(roomIds));
}

export function useSpaceBridgeActivity(spaceIds: string[]): void {
  const mx = useMatrixClient();
  const setVoiceActivity = useSetAtom(spaceVoiceActivityAtom);
  const setLiveActivity = useSetAtom(spaceLiveActivityAtom);
  const { subscribeSSE, subscribeToUpdates, getSnapshot } = useContext(BridgePresenceContext);
  const stableSpaceIdsKey = useMemo(() => [...spaceIds].sort().join('|'), [spaceIds]);
  const stableSpaceIds = useMemo(
    () => (stableSpaceIdsKey ? stableSpaceIdsKey.split('|') : []),
    [stableSpaceIdsKey],
  );

  useEffect(() => {
    let roomCleanups: Array<() => void> = [];
    let roomsBySpace = new Map<string, SpaceActivityRoomIds>();

    const computeRoomsBySpace = (): Map<string, SpaceActivityRoomIds> => {
      const allRooms = mx.getRooms();
      const result = new Map<string, SpaceActivityRoomIds>();

      for (const spaceId of stableSpaceIds) {
        const space = mx.getRoom(spaceId);
        if (!space) {
          result.set(spaceId, { voiceRoomIds: [], liveRoomIds: [] });
          continue;
        }

        const childRoomIds = getSpaceChildRooms(space, allRooms)
          .filter((room) => room.isCallRoom())
          .map((room) => room.roomId);
        result.set(spaceId, {
          voiceRoomIds: childRoomIds,
          liveRoomIds: space.isCallRoom()
            ? uniqueRoomIds([space.roomId, ...childRoomIds])
            : childRoomIds,
        });
      }

      return result;
    };

    const publishActivityMaps = () => {
      const voiceMap = new Map<string, boolean>();
      const liveMap = new Map<string, boolean>();

      for (const [spaceId, roomIds] of roomsBySpace) {
        const hasVoiceActivity = roomIds.voiceRoomIds.some((roomId) => getSnapshot(roomId).size > 0);
        const hasLiveActivity = roomIds.liveRoomIds.some((roomId) =>
          Array.from(getSnapshot(roomId).values()).some((presence) => presence.isScreenSharing)
        );

        voiceMap.set(spaceId, hasVoiceActivity);
        liveMap.set(spaceId, hasLiveActivity);
      }

      setVoiceActivity(voiceMap);
      setLiveActivity(liveMap);
    };

    const refreshSubscriptions = () => {
      roomCleanups.forEach((cleanup) => cleanup());
      roomCleanups = [];

      roomsBySpace = computeRoomsBySpace();
      const allRoomIds = uniqueRoomIds(
        Array.from(roomsBySpace.values()).flatMap((roomIds) => [
          ...roomIds.voiceRoomIds,
          ...roomIds.liveRoomIds,
        ])
      );

      roomCleanups = allRoomIds.flatMap((roomId) => [
        subscribeSSE(roomId),
        subscribeToUpdates(roomId, publishActivityMaps),
      ]);

      publishActivityMaps();
    };

    refreshSubscriptions();

    const handleStateEvent = (ev: MatrixEvent) => {
      if (ev.getType() === 'm.space.child') {
        refreshSubscriptions();
      }
    };

    mx.on(ClientEvent.Event, handleStateEvent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mx.on(RoomStateEvent.Events as any, handleStateEvent);

    return () => {
      roomCleanups.forEach((cleanup) => cleanup());
      mx.off(ClientEvent.Event, handleStateEvent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mx.off(RoomStateEvent.Events as any, handleStateEvent);
    };
  }, [stableSpaceIdsKey, stableSpaceIds, mx, subscribeSSE, subscribeToUpdates, getSnapshot, setVoiceActivity, setLiveActivity]);
}
