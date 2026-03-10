import { ClientEvent, MatrixClient, MatrixEvent, RoomStateEvent } from 'matrix-js-sdk';
import { useEffect, useState } from 'react';
import {
  getCallMemberPresenceState,
  roomHasCallScreenShare,
  type CallPresenceState,
} from '../features/call/callPresenceState';

export { roomHasCallScreenShare };

export function useCallMemberPresence(
  mx: MatrixClient,
  roomId: string,
  userId: string
): CallPresenceState {
  const [presence, setPresence] = useState<CallPresenceState>(() =>
    getCallMemberPresenceState(mx, roomId, userId)
  );

  useEffect(() => {
    setPresence(getCallMemberPresenceState(mx, roomId, userId));

    const handleEvent = (event: MatrixEvent) => {
      if (event.getRoomId() !== roomId) return;
      if (
        !event.getType().includes('call.member') &&
        event.getType() !== 'io.bettercord.call.presence'
      ) {
        return;
      }

      setPresence(getCallMemberPresenceState(mx, roomId, userId));
    };

    mx.on(ClientEvent.Event, handleEvent);
    // RoomStateEvent.Events catches state-section events (already-in-progress calls
    // on page load, where the call.member / io.bettercord.call.presence event
    // arrives in the state section and never fires ClientEvent.Event).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mx.on(RoomStateEvent.Events as any, handleEvent);

    return () => {
      mx.off(ClientEvent.Event, handleEvent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mx.off(RoomStateEvent.Events as any, handleEvent);
    };
  }, [mx, roomId, userId]);

  return presence;
}
