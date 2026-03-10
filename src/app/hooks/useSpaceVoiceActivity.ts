import { useEffect, useMemo } from 'react';
import { ClientEvent, MatrixEvent, Room, RoomStateEvent } from 'matrix-js-sdk';
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

    // ClientEvent.Event fires for timeline events (live joins while page is open).
    // RoomStateEvent.Events fires for BOTH timeline AND state-section events —
    // this catches call.member that was already present when the client first synced
    // (those arrive in the state section, not the timeline, so ClientEvent.Event
    // never fires for them and the badge only appears after a page reload without this).
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
