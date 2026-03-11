import { useEffect, useMemo } from 'react';
import { ClientEvent, MatrixEvent, Room, RoomStateEvent } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import { useMatrixClient } from './useMatrixClient';
import { spaceLiveActivityAtom } from '../state/voiceActivity';
import { roomHasCallScreenShare } from './useCallMemberPresence';
import { BETTERCORD_CALL_PRESENCE_EVENT } from '../features/call/callPresenceState';

/** Returns the direct child rooms of a space (one level deep). */
function getSpaceChildRooms(space: Room, allRooms: Room[]): Room[] {
  return allRooms.filter((r) => {
    const ev = space.currentState.getStateEvents('m.space.child', r.roomId);
    return ev !== null && ev !== undefined;
  });
}

/**
 * Monitors a list of space IDs for live stream (screenshare) activity in their child rooms.
 * Updates `spaceLiveActivityAtom` with a Map<spaceId, boolean>.
 *
 * Re-evaluates whenever a `call.member` or `io.bettercord.call.presence` event fires.
 */
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
        const hasActivity = children.some((r) => roomHasCallScreenShare(mx, r.roomId));
        map.set(spaceId, hasActivity);
      }

      setActivity(map);
    };

    compute();

    const handleEvent = (ev: MatrixEvent) => {
      if (ev.getType().includes('call.member') || ev.getType() === BETTERCORD_CALL_PRESENCE_EVENT) {
        compute();
      }
    };

    // ClientEvent.Event fires for timeline events (live screenshare changes while page is open).
    // RoomStateEvent.Events catches state-section events (screenshare already active on page load).
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
