import { MatrixClient } from 'matrix-js-sdk';
import {
  MatrixRTCSession,
  MatrixRTCSessionEvent,
} from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { CallMembership } from 'matrix-js-sdk/lib/matrixrtc/CallMembership';
import { ClientEvent, MatrixEvent } from 'matrix-js-sdk';
import { useEffect, useState } from 'react';

export const useCallMembers = (mx: MatrixClient, roomId: string): CallMembership[] => {
  const [memberships, setMemberships] = useState<CallMembership[]>(() => {
    const room = mx.getRoom(roomId);
    return room ? MatrixRTCSession.callMembershipsForRoom(room) : [];
  });

  useEffect(() => {
    const room = mx.getRoom(roomId);
    if (!room) {
      setMemberships([]);
      return undefined;
    }

    const updateMemberships = () => {
      setMemberships(MatrixRTCSession.callMembershipsForRoom(room));
    };

    const mxr = mx.matrixRTC.getRoomSession(room);
    mxr.on(MatrixRTCSessionEvent.MembershipsChanged, updateMemberships);

    // Fallback: also react to raw Matrix state events for call members
    // in case MembershipsChanged doesn't fire (e.g. after expiry cleanup)
    const handleRawEvent = (ev: MatrixEvent) => {
      if (
        ev.getRoomId() === roomId &&
        (ev.getType() === 'org.matrix.msc3401.call.member' ||
          ev.getType().includes('call.member'))
      ) {
        updateMemberships();
      }
    };
    mx.on(ClientEvent.Event, handleRawEvent);

    return () => {
      mxr.removeListener(MatrixRTCSessionEvent.MembershipsChanged, updateMemberships);
      mx.removeListener(ClientEvent.Event, handleRawEvent);
    };
  }, [mx, roomId]);

  return memberships;
};
