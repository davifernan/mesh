import { MatrixClient, MatrixEvent, RoomState, RoomStateEvent } from 'matrix-js-sdk';
import { useEffect } from 'react';

export type StateEventCallback = (
  event: MatrixEvent,
  state: RoomState,
  lastStateEvent: MatrixEvent | null
) => void;

export const useStateEventCallback = (
  mx: MatrixClient | null | undefined,
  onStateEvent: StateEventCallback
) => {
  useEffect(() => {
    if (!mx) return undefined;
    mx.on(RoomStateEvent.Events, onStateEvent);
    return () => {
      mx.removeListener(RoomStateEvent.Events, onStateEvent);
    };
  }, [mx, onStateEvent]);
};
