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

import type { Context, Hono } from 'hono';
import type { VoiceStateStore } from './store.js';
import type { SSEManager } from './sseManager.js';
import type { BridgeStats, SendFn } from './types.js';
import type { Reconciler } from './reconciler.js';
import { bearerAuthMiddleware, sseTicketMiddleware } from './ticketAuth.js';

/**
 * Bidirectional alias map: matrixRoomId ↔ livekitRoomName.
 * Populated by POST /presence/attributes when a client sends both IDs.
 * Used by SSE/REST lookups so subscribers using the Matrix room ID are
 * transparently routed to the correct LiveKit-keyed store entry.
 */
const roomAliasMap = new Map<string, string>();

export function registerPresenceRoutes(
  app: Hono,
  store: VoiceStateStore,
  sse: SSEManager,
  stats: BridgeStats,
  authSecret: string,
  reconciler?: Reconciler,
): void {
  /**
   * Resolve a requested roomId: if the caller used a Matrix room ID and we
   * have a known alias to the LiveKit room name, return the LiveKit name
   * (which is what the store is keyed by). Otherwise return as-is.
   */
  const getRequestedRoomId = (c: Context): string => {
    const raw = c.req.query('roomId') ?? c.req.param('roomId') ?? '';
    return roomAliasMap.get(raw) ?? raw;
  };

  const requireRoomId = (c: Context): string | Response => {
    const roomId = getRequestedRoomId(c);
    if (!roomId) {
      return c.json({ error: 'Missing roomId' }, 400);
    }
    return roomId;
  };

  const handleSnapshot = async (c: Context) => {
    const roomId = requireRoomId(c);
    if (roomId instanceof Response) return roomId;

    let snapshot = await store.getRoomSnapshot(roomId);

    // Lazy reconcile: if snapshot is empty and reconciler is available,
    // query LiveKit for ground truth before returning.
    if (snapshot.size === 0 && reconciler) {
      await reconciler.reconcileRoom(roomId);
      snapshot = await store.getRoomSnapshot(roomId);
    }

    if (snapshot.size === 0) return c.json({});
    return c.json(Object.fromEntries(snapshot));
  };

  const handleStream = async (c: Context) => {
    const roomId = requireRoomId(c);
    if (roomId instanceof Response) return roomId;

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
  };

  // ── Client-side attribute notification ──────────────────────────────────────
  // Replaces the missing participant_attributes_changed webhook on older LiveKit
  // versions (≤1.9.x). The client POSTs here after a successful setAttributes()
  // call — the bridge performs the same rekey + deafen-sync that the webhook
  // handler would do.
  const handleAttributeNotification = async (c: Context) => {
    let body: {
      roomId?: string;
      identity?: string;
      userId?: string;
      attributes?: Record<string, string>;
      matrixRoomId?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400);
    }

    const { roomId, identity, userId, attributes, matrixRoomId } = body;
    if (!roomId || !identity || !userId || !attributes) {
      return c.json({ error: 'Missing required fields: roomId, identity, userId, attributes' }, 400);
    }

    // Maintain alias mapping: matrixRoomId → livekitRoomName (and reverse)
    // so SSE/REST subscribers using the Matrix room ID get transparently
    // routed to the correct store entry, and SSE broadcasts reach both.
    const isNewAlias = matrixRoomId && matrixRoomId !== roomId && !roomAliasMap.has(matrixRoomId);
    if (matrixRoomId && matrixRoomId !== roomId) {
      if (isNewAlias) {
        console.log(`[alias] ${matrixRoomId} → ${roomId}`);
      }
      roomAliasMap.set(matrixRoomId, roomId);
      sse.setAlias(matrixRoomId, roomId);
    }

    // Rekey: if the userId is a real Matrix ID and differs from the identity,
    // re-key the store entry so SSE broadcasts use the correct key.
    if (userId !== identity && userId.startsWith('@')) {
      const rekeyResult = await store.rekeyPresence(roomId, identity, identity, userId);
      if (rekeyResult.presence) {
        sse.broadcast(roomId, userId, { ...rekeyResult.presence, type: 'update' }, 'update');
        console.log(`[rekey] ${identity} → ${userId} in ${roomId} (via client notification)`);
      }
    }

    // Sync deafen state if present in attributes
    if ('isDeafened' in attributes) {
      const result = await store.setPresence(roomId, identity, userId, {
        isDeafened: attributes.isDeafened === '1',
      });
      if (result?.changed) {
        sse.broadcast(roomId, userId, result.next, 'update');
      }
    }

    // When a new alias mapping was just created, replay the full room snapshot
    // to subscribers on the matrixRoomId ONLY. These subscribers connected before
    // the alias existed, so they missed all prior broadcasts (join, track events).
    // Uses broadcastDirect to avoid duplicating to LiveKit-key subscribers.
    // The seq-aware dedup on the client side handles any duplicates correctly.
    if (isNewAlias && matrixRoomId) {
      const snapshot = await store.getRoomSnapshot(roomId);
      for (const [uid, presence] of snapshot) {
        sse.broadcastDirect(matrixRoomId, uid, { ...presence, type: 'update' }, 'update');
      }
      if (snapshot.size > 0) {
        console.log(`[alias-replay] replayed ${snapshot.size} entries to ${matrixRoomId} subscribers`);
      }
    }

    console.debug(`[attrs] ${userId} attributes=${JSON.stringify(attributes)} in ${roomId} (via client notification)`);
    return c.json({ ok: true });
  };

  // ── Query-param routes (slash-safe) — MUST be registered BEFORE wildcard ──
  // Hono matches routes in registration order. /presence/:roomId would swallow
  // "room" or "stream" as a roomId, so the specific fixed-path routes go first.

  app.post('/presence/attributes', handleAttributeNotification);
  app.get('/presence/room', bearerAuthMiddleware(authSecret), handleSnapshot);
  app.get('/presence/stream', sseTicketMiddleware(authSecret), handleStream);

  // ── Legacy path-param routes (kept for backwards compat) ─────────────────

  app.get('/presence/:roomId/stream', sseTicketMiddleware(authSecret), handleStream);
  app.get('/presence/:roomId', bearerAuthMiddleware(authSecret), handleSnapshot);
}
