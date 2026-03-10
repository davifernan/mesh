/**
 * useBridgeRoomPresence
 *
 * Opens an SSE connection to the BetterCord presence bridge
 * (`/api/presence/:roomId/stream`) and returns a reactive Map of
 * `userId → CallPresenceState` for every participant currently in the room.
 *
 * Design goals:
 *  - Falls back gracefully when the bridge is unavailable (returns empty Map)
 *  - Reconnects automatically after transient network failures (exponential back-off)
 *  - Only opens a connection when a roomId is provided and the component is mounted
 *  - Cleans up the SSE connection on unmount or roomId change
 */

import { useEffect, useRef, useState } from 'react';
import type { CallPresenceState } from '../features/call/callPresenceState';

// Shape of a single bridge SSE / REST message
type BridgePresencePayload = {
  userId: string;
  type: 'update' | 'left';
  isMicMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  updatedAt: number;
};

// Maximum back-off between reconnect attempts: 30 s
const MAX_BACKOFF_MS = 30_000;

/**
 * Returns a Map<userId, CallPresenceState> that is kept live via SSE.
 * The Map is updated in-place on every bridge event — React receives a new
 * Map reference on each update so components re-render correctly.
 *
 * @param roomId  Matrix room ID to subscribe to, or null/undefined to skip.
 */
export function useBridgeRoomPresence(
  roomId: string | null | undefined,
): Map<string, CallPresenceState> {
  const [presence, setPresence] = useState<Map<string, CallPresenceState>>(
    () => new Map(),
  );

  // Stable ref so the reconnect loop can read the latest backoff without
  // needing to be recreated every render.
  const backoffRef = useRef(1_000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!roomId) {
      setPresence(new Map());
      return undefined;
    }

    let destroyed = false;
    backoffRef.current = 1_000;

    function connect() {
      if (destroyed) return;

      const url = `/api/presence/${encodeURIComponent(roomId!)}/stream`;
      const es = new EventSource(url);
      esRef.current = es;

      // Accumulate the full room snapshot here; swap into React state on every event
      const snapshot = new Map<string, CallPresenceState>();

      es.onmessage = (ev: MessageEvent<string>) => {
        if (destroyed) return;
        try {
          const payload = JSON.parse(ev.data) as BridgePresencePayload;
          const { userId, isMicMuted, isCameraOn, isScreenSharing, isDeafened } = payload;

          if (payload.type === 'left') {
            snapshot.delete(userId);
          } else {
            snapshot.set(userId, { isMicMuted, isCameraOn, isScreenSharing, isDeafened });
          }

          // Give React a new Map reference so useMemo / shallow comparisons work
          setPresence(new Map(snapshot));

          // Reset back-off on successful message
          backoffRef.current = 1_000;
        } catch {
          // Malformed JSON — ignore
        }
      };

      es.onerror = () => {
        if (destroyed) return;
        es.close();
        esRef.current = null;

        // Back-off and retry
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
        retryTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      destroyed = true;
      esRef.current?.close();
      esRef.current = null;
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setPresence(new Map());
    };
  }, [roomId]);

  return presence;
}
