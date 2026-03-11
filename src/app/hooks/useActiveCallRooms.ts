import { useEffect, useState } from 'react';
import { ClientEvent, MatrixClient, MatrixEvent, Room, RoomStateEvent } from 'matrix-js-sdk';
import { roomHasCallActivity } from './useSpaceVoiceActivity';

/**
 * Returns all call rooms (across every space) that currently have at least one
 * active call member. Updates reactively when call.member state events change.
 */
export function useActiveCallRooms(mx: MatrixClient): Room[] {
  const [activeRooms, setActiveRooms] = useState<Room[]>(() =>
    mx.getRooms().filter((r) => r.isCallRoom() && roomHasCallActivity(r))
  );

  useEffect(() => {
    const compute = () => {
      setActiveRooms(mx.getRooms().filter((r) => r.isCallRoom() && roomHasCallActivity(r)));
    };

    compute();

    const handleEvent = (ev: MatrixEvent) => {
      if (ev.getType().includes('call.member')) {
        compute();
      }
    };

    // ClientEvent.Event → live timeline events (joins while the page is open)
    // RoomStateEvent.Events → state-section events already present on initial sync
    //   (those never fire ClientEvent.Event, so the list would be stale without this)
    mx.on(ClientEvent.Event, handleEvent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mx.on(RoomStateEvent.Events as any, handleEvent);
    return () => {
      mx.off(ClientEvent.Event, handleEvent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mx.off(RoomStateEvent.Events as any, handleEvent);
    };
  }, [mx]);

  return activeRooms;
}
