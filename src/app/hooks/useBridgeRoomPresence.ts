/**
 * useBridgeRoomPresence
 *
 * Gibt eine reaktive Map<userId, CallPresenceState> zurück,
 * die vom BridgePresenceProvider via SSE aktuell gehalten wird.
 *
 * Die SSE-Verbindung wird ref-counted im Provider verwaltet:
 *   - öffnet beim ersten Subscriber für diesen roomId
 *   - schließt beim letzten Subscriber (Presence-Cache bleibt erhalten)
 *
 * Voraussetzung: Muss innerhalb von <BridgePresenceProvider> gerendert werden.
 *
 * @param roomId  Matrix room ID zum Subscriben, oder null/undefined zum Überspringen.
 */

import { useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import type { CallPresenceState } from '../features/call/callPresenceState';
import { BridgePresenceContext } from '../features/call/BridgePresenceContext';

const EMPTY_MAP: ReadonlyMap<string, CallPresenceState> = new Map();

export function useBridgeRoomPresence(
  roomId: string | null | undefined,
): ReadonlyMap<string, CallPresenceState> {
  const { subscribeSSE, subscribeToUpdates, getSnapshot } = useContext(BridgePresenceContext);

  // Öffne/schließe SSE-Verbindung (ref-counted im Provider)
  useEffect(() => {
    if (!roomId) return undefined;
    return subscribeSSE(roomId);
  }, [roomId, subscribeSSE]);

  // Lies Presence-State reaktiv via useSyncExternalStore
  // subscribe-Funktion: stabil per useCallback damit kein Endlos-Rerender
  return useSyncExternalStore(
    useCallback(
      (listener) => (roomId ? subscribeToUpdates(roomId, listener) : () => {}),
      [roomId, subscribeToUpdates],
    ),
    useCallback(
      () => (roomId ? getSnapshot(roomId) : EMPTY_MAP),
      [roomId, getSnapshot],
    ),
  );
}
