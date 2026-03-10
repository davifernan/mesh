import { ClientEvent, MatrixClient, MatrixEvent, Room, RoomStateEvent } from 'matrix-js-sdk';
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
// empty. Kept short (200ms) to cover membership-renewal delivery races
// (delayed-event fires → new joinRoomSession() write propagates) while still
// feeling instant on explicit hang-up. 1000ms was too long: the total perceived
// delay was network-round-trip (~300ms) + grace (1000ms) ≈ 1.3s.
const REMOVAL_GRACE_MS = 200;

// ── Call Info Event ──────────────────────────────────────────────────────────
// State event written by the first joiner to record when the call started.
// Empty content = cleared (call ended).  All clients read this for the timer.
export const CALL_INFO_EVENT = 'org.bettercord.call.info';

function getCallStartedAt(room: Room): number | null {
  const ev = room.currentState.getStateEvents(CALL_INFO_EVENT, '');
  if (!ev) return null;
  const startedAt = (ev as MatrixEvent).getContent?.()?.started_at;
  return typeof startedAt === 'number' && startedAt > 0 ? startedAt : null;
}

/**
 * Returns the server-written call start timestamp (ms) for the given room,
 * or null when no call is active.  Reacts live to state event changes.
 */
export const useCallStartTime = (mx: MatrixClient, roomId: string): number | null => {
  const [startedAt, setStartedAt] = useState<number | null>(() => {
    const room = mx.getRoom(roomId);
    return room ? getCallStartedAt(room) : null;
  });

  useEffect(() => {
    const room = mx.getRoom(roomId);
    if (!room) {
      setStartedAt(null);
      return undefined;
    }

    setStartedAt(getCallStartedAt(room));

    const handleEvent = (ev: MatrixEvent) => {
      if (ev.getRoomId() !== roomId) return;
      if (ev.getType() !== CALL_INFO_EVENT) return;
      setStartedAt(getCallStartedAt(room));
    };

    mx.on(ClientEvent.Event, handleEvent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mx.on(RoomStateEvent.Events as any, handleEvent);
    return () => {
      mx.off(ClientEvent.Event, handleEvent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mx.off(RoomStateEvent.Events as any, handleEvent);
    };
  }, [mx, roomId]);

  return startedAt;
};

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

    // Same dual-listener pattern as useSpaceVoiceActivity:
    // ClientEvent.Event → timeline events (live joins while page is open)
    // RoomStateEvent.Events → catches call.member already present on initial sync
    //   (state-section events don't fire ClientEvent.Event, causing reload-only updates)
    mx.on(ClientEvent.Event, handleEvent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mx.on(RoomStateEvent.Events as any, handleEvent);
    return () => {
      mx.off(ClientEvent.Event, handleEvent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mx.off(RoomStateEvent.Events as any, handleEvent);
      graceTimers.current.forEach(clearTimeout);
      graceTimers.current.clear();
    };
  }, [mx, roomId]);

  return senders;
};
