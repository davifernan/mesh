import { ClientEvent, MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { Room } from 'matrix-js-sdk';
import { useEffect, useState } from 'react';

// Return user IDs of everyone with an active (non-empty) call.member state event.
// We deliberately do NOT filter by expiry here — expiry is EC's concern, not the
// sidebar's.  This avoids the "user disappears during membership renewal" flicker.
function getActiveSenders(room: Room): string[] {
  const senders = new Set<string>();
  // Support both legacy (msc3401) and newer (msc4143) call member state types.
  const types = [
    'org.matrix.msc3401.call.member',
    'org.matrix.msc4143.call.member',
  ];
  for (const type of types) {
    const events: MatrixEvent[] = room.currentState.getStateEvents(type) ?? [];
    for (const ev of events) {
      const sender = ev.getSender();
      if (!sender) continue;
      const content = ev.getContent();
      // Empty content = user explicitly left.  Non-empty = user is present.
      if (content && Object.keys(content).length > 0) {
        senders.add(sender);
      }
    }
  }
  return Array.from(senders);
}

export const useCallMembers = (mx: MatrixClient, roomId: string): string[] => {
  const [senders, setSenders] = useState<string[]>(() => {
    const room = mx.getRoom(roomId);
    return room ? getActiveSenders(room) : [];
  });

  useEffect(() => {
    const room = mx.getRoom(roomId);
    if (!room) {
      setSenders([]);
      return undefined;
    }

    // Re-compute whenever any call.member event arrives for this room
    const handleEvent = (ev: MatrixEvent) => {
      if (ev.getRoomId() !== roomId) return;
      if (!ev.getType().includes('call.member')) return;
      setSenders(getActiveSenders(room));
    };

    // Sync initial state
    setSenders(getActiveSenders(room));

    mx.on(ClientEvent.Event, handleEvent);
    return () => {
      mx.off(ClientEvent.Event, handleEvent);
    };
  }, [mx, roomId]);

  return senders;
};
