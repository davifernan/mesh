/**
 * Presence REST + SSE routes.
 *
 *   GET /presence/:roomId          — full room snapshot (JSON)
 *   GET /presence/:roomId/stream   — SSE stream, pushes updates live
 *
 * Lazy reconcile:
 *   When a snapshot is requested for a room that appears empty, and a Reconciler
 *   is configured, the route performs a lazy reconcile against LiveKit before
 *   returning the (possibly now-populated) snapshot. This prevents stale-empty
 *   responses after bridge restarts.
 *
 * The SSE stream — snapshot/stream race fix:
 *   The classic race: snapshot is taken, a webhook fires and broadcasts to
 *   subscribers, THEN the snapshot is replayed to the new client — the client
 *   misses the in-flight update.
 *
 *   Fix: subscribe-first, then replay snapshot.
 *   1. Register the subscriber BEFORE taking the snapshot.
 *   2. Replay the snapshot, tracking the highest seq seen.
 *   3. Send a `snapshot_end` sentinel with that seq.
 *   4. The client discards any live event with seq ≤ snapshotSeq (already covered
 *      by the snapshot) and applies events with seq > snapshotSeq in order.
 *
 *   This means the client may receive a duplicate for a user whose state changed
 *   between subscribe and snapshot-replay — the seq-aware dedup on the client
 *   side handles that correctly (higher seq wins).
 *
 * Other behaviours:
 *   - Heartbeat comment every 25 s to keep connections alive through proxies.
 *   - Cleans up the subscriber on client disconnect (abort signal) and on
 *     stream cancel.
 */

import type { Hono } from 'hono';
import type { VoiceStateStore } from './store.js';
import type { SSEManager } from './sseManager.js';
import type { BridgeStats, SendFn } from './types.js';
import type { Reconciler } from './reconciler.js';

export function registerPresenceRoutes(
  app: Hono,
  store: VoiceStateStore,
  sse: SSEManager,
  stats: BridgeStats,
  reconciler?: Reconciler,
): void {
  // ── GET /presence/:roomId ─────────────────────────────────────────────────

  app.get('/presence/:roomId', async (c) => {
    const roomId = c.req.param('roomId');
    let snapshot = await store.getRoomSnapshot(roomId);

    // Lazy reconcile: if snapshot is empty and reconciler is available,
    // query LiveKit for ground truth before returning.
    if (snapshot.size === 0 && reconciler) {
      await reconciler.reconcileRoom(roomId);
      snapshot = await store.getRoomSnapshot(roomId);
    }

    if (snapshot.size === 0) return c.json({});
    return c.json(Object.fromEntries(snapshot));
  });

  // ── GET /presence/:roomId/stream ──────────────────────────────────────────

  app.get('/presence/:roomId/stream', async (c) => {
    const roomId = c.req.param('roomId');
    const encoder = new TextEncoder();

    let localSend: SendFn | undefined;
    let cleanup: (() => void) | undefined;
    // Declared in outer scope so both abort handler and cancel() can clear it
    let heartbeatId: ReturnType<typeof setInterval> | null = null;

    const body = new ReadableStream({
      async start(controller) {
        localSend = (payload: string) => {
          try {
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          } catch {
            // Controller already closed — subscriber will be removed on abort
          }
        };

        // ── Subscribe FIRST (before snapshot) ──────────────────────────────
        // This closes the snapshot/stream race: any webhook that fires between
        // "snapshot taken" and "subscriber registered" would be lost. By
        // subscribing first, we may receive a duplicate for a user whose state
        // changed during snapshot replay — the client's seq-aware dedup handles
        // that correctly (higher seq wins, lower seq is discarded).
        cleanup = sse.subscribe(roomId, localSend);
        console.debug(
          `[sse] Client connected to ${roomId} (active: ${stats.sseConnectionsActive})`,
        );

        // ── Lazy reconcile ──────────────────────────────────────────────────
        // Perform after subscribing so we don't miss a webhook that fires
        // during reconcile.
        let snapshot = await store.getRoomSnapshot(roomId);
        if (snapshot.size === 0 && reconciler) {
          await reconciler.reconcileRoom(roomId);
          snapshot = await store.getRoomSnapshot(roomId);
        }

        // ── Replay snapshot ─────────────────────────────────────────────────
        // Track the highest seq in the snapshot so we can send snapshot_end.
        let snapshotSeq = 0;
        for (const [uid, presence] of snapshot) {
          const { type: _t, ...rest } = presence;
          localSend(JSON.stringify({ userId: uid, type: 'update', ...rest }));
          if ((presence.seq ?? 0) > snapshotSeq) snapshotSeq = presence.seq ?? 0;
        }

        // ── snapshot_end sentinel ───────────────────────────────────────────
        // Tells the client: "everything up to seq=snapshotSeq was from the
        // snapshot; events with seq > snapshotSeq are live updates."
        sse.sendSnapshotEnd(localSend, snapshotSeq);

        // ── Heartbeat ───────────────────────────────────────────────────────
        heartbeatId = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch {
            if (heartbeatId !== null) {
              clearInterval(heartbeatId);
              heartbeatId = null;
            }
          }
        }, 25_000);

        // ── Cleanup on client disconnect ────────────────────────────────────
        c.req.raw.signal.addEventListener('abort', () => {
          if (heartbeatId !== null) {
            clearInterval(heartbeatId);
            heartbeatId = null;
          }
          cleanup?.();
          cleanup = undefined;
          console.debug(
            `[sse] Client disconnected from ${roomId} (active: ${stats.sseConnectionsActive})`,
          );
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      },

      cancel() {
        // Stream cancelled (e.g. client navigated away before abort fired)
        if (heartbeatId !== null) {
          clearInterval(heartbeatId);
          heartbeatId = null;
        }
        cleanup?.();
        cleanup = undefined;
      },
    });

    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // disable nginx response buffering for SSE
      },
    });
  });
}
