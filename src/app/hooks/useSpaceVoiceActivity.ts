import { useEffect } from 'react';
import { ClientEvent, MatrixEvent, Room } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import { useMatrixClient } from './useMatrixClient';
import { spaceVoiceActivityAtom } from '../state/voiceActivity';

const CALL_MEMBER_TYPES = [
  'org.matrix.msc3401.call.member',
  'org.matrix.msc4143.call.member',
];

/** Returns true if the room has at least one active call member state event. */
function roomHasCallActivity(room: Room): boolean {
  for (const type of CALL_MEMBER_TYPES) {
    const events: MatrixEvent[] = room.currentState.getStateEvents(type) ?? [];
    for (const ev of events) {
      const content = ev.getContent();
      if (content && Object.keys(content).length > 0) {
        return true;
      }
    }
  }
  return false;
}

/** Returns the direct child rooms of a space (one level deep). */
function getSpaceChildRooms(space: Room, allRooms: Room[]): Room[] {
  return allRooms.filter((r) => {
    const ev = space.currentState.getStateEvents('m.space.child', r.roomId);
    return ev !== null && ev !== undefined;
  });
}

/**
 * Monitors a list of space IDs for voice call activity in their child rooms.
 * Updates `spaceVoiceActivityAtom` with a Map<spaceId, boolean>.
 *
 * Re-evaluates whenever a `call.member` event fires on the Matrix client.
 */
export function useSpaceVoiceActivity(spaceIds: string[]): void {
  const mx = useMatrixClient();
  const setActivity = useSetAtom(spaceVoiceActivityAtom);

  useEffect(() => {
    const compute = () => {
      const allRooms = mx.getRooms();
      const map = new Map<string, boolean>();

      for (const spaceId of spaceIds) {
        const space = mx.getRoom(spaceId);
        if (!space) {
          map.set(spaceId, false);
          continue;
        }
        const children = getSpaceChildRooms(space, allRooms);
        const hasActivity = children.some((r) => roomHasCallActivity(r));
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
    return () => {
      mx.off(ClientEvent.Event, handleEvent);
    };
  }, [spaceIds, mx, setActivity]);
}
