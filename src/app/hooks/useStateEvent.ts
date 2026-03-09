import { MatrixEvent, Room } from 'matrix-js-sdk';
import { useCallback, useMemo } from 'react';
import { useStateEventCallback } from './useStateEventCallback';
import { useForceUpdate } from './useForceUpdate';
import { getStateEvent } from '../utils/room';
import { StateEvent } from '../../types/matrix/room';

export const useStateEvent = (room: Room | null | undefined, eventType: StateEvent, stateKey = '') => {
  const [updateCount, forceUpdate] = useForceUpdate();

  const onStateEvent = useCallback(
    (event: MatrixEvent) => {
      if (
        room &&
        event.getRoomId() === room.roomId &&
        event.getType() === eventType &&
        event.getStateKey() === stateKey
      ) {
        forceUpdate();
      }
    },
    [room, eventType, stateKey, forceUpdate]
  );

  useStateEventCallback(room?.client, onStateEvent);

  return useMemo(
    () => (room ? getStateEvent(room, eventType, stateKey) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, eventType, stateKey, updateCount]
  );
};
