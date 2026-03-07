import { ClientEvent, MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { useEffect, useRef, useState } from 'react';

// Return user IDs of everyone with an active (non-empty) call.member state event.
// We deliberately do NOT filter by expiry here — expiry is EC's concern, not the
// sidebar's.  This avoids the "user disappears during membership renewal" flicker.
function getActiveSenders(room: Room): Set<string> {
  const senders = new Set<string>();
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
  return senders;
}

// Grace period before a user is removed from the list after their state goes
// empty.  EC uses delayed events for memberships — if the delay-event fires
// momentarily (network blip / renewal race), we should not flash the user away.
const REMOVAL_GRACE_MS = 12_000;

export const useCallMembers = (mx: MatrixClient, roomId: string): string[] => {
  const [senders, setSenders] = useState<string[]>(() => {
    const room = mx.getRoom(roomId);
    return room ? Array.from(getActiveSenders(room)) : [];
  });

  // Pending-removal timers: userId → timer ID
  const graceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const room = mx.getRoom(roomId);
    if (!room) {
      setSenders([]);
      graceTimers.current.forEach(clearTimeout);
      graceTimers.current.clear();
      return undefined;
    }

    // Sync initial state
    const initial = getActiveSenders(room);
    setSenders(Array.from(initial));
    let known = new Set(initial);

    const handleEvent = (ev: MatrixEvent) => {
      if (ev.getRoomId() !== roomId) return;
      if (!ev.getType().includes('call.member')) return;

      const fresh = getActiveSenders(room);

      // Users that just appeared → add immediately, cancel any pending removal
      for (const id of fresh) {
        if (!known.has(id)) {
          const t = graceTimers.current.get(id);
          if (t !== undefined) {
            clearTimeout(t);
            graceTimers.current.delete(id);
          }
        }
      }

      // Users that just disappeared → schedule delayed removal
      for (const id of known) {
        if (!fresh.has(id) && !graceTimers.current.has(id)) {
          const t = setTimeout(() => {
            graceTimers.current.delete(id);
            setSenders((prev) => prev.filter((p) => p !== id));
          }, REMOVAL_GRACE_MS);
          graceTimers.current.set(id, t);
        }
      }

      known = fresh;
      // Always show the union of fresh + still-graced users
      setSenders((prev) => {
        const graced = new Set(graceTimers.current.keys());
        const next = new Set([...fresh, ...graced]);
        // Only update state if something actually changed
        if (next.size === prev.length && prev.every((id) => next.has(id))) return prev;
        return Array.from(next);
      });
    };

    mx.on(ClientEvent.Event, handleEvent);
    return () => {
      mx.off(ClientEvent.Event, handleEvent);
      graceTimers.current.forEach(clearTimeout);
      graceTimers.current.clear();
    };
  }, [mx, roomId]);

  return senders;
};
