/**
 * Health check route.
 *
 *   GET /health — returns bridge status and operational stats as JSON
 *
 * Response shape:
 *   status                  "ok"
 *   rooms                   number of rooms with at least one participant
 *   sseConnectionsActive    active SSE connections
 *   sseConnectionsTotal     total SSE connections since startup
 *   webhooksReceived        total verified webhooks processed
 *   webhooksRejected        total webhooks rejected (bad signature)
 *   webhookEventCounts      per-event-type counts
 *   authoritative           store backend info
 *     backend               "memory" | "redis"
 *     redisConnected        true when Redis is reachable (only meaningful for redis backend)
 *   reconcile               reconcile subsystem info
 *     enabled               true when LIVEKIT_URL is set
 *     lastReconcileAt       ms timestamp of last successful reconcile (0 = never)
 *     startupRoomsReconciled  rooms seeded on startup
 *
 * Used by:
 *   - Docker / Kubernetes liveness probes
 *   - Ops dashboards
 *   - Manual debugging
 */

import type { Hono } from 'hono';
import type { VoiceStateStore } from './store.js';
import type { BridgeStats } from './types.js';

export function registerHealthRoute(
  app: Hono,
  store: VoiceStateStore,
  stats: BridgeStats,
): void {
  app.get('/health', async (c) => {
    const rooms = await store.roomCount();

    return c.json({
      status: 'ok',
      rooms,
      sseConnectionsActive: stats.sseConnectionsActive,
      sseConnectionsTotal: stats.sseConnectionsTotal,
      webhooksReceived: stats.webhooksReceived,
      webhooksRejected: stats.webhooksRejected,
      webhookEventCounts: stats.webhookEventCounts,
      authoritative: {
        backend: stats.storeBackend,
        redisConnected: stats.redisConnected,
      },
      reconcile: {
        enabled: stats.reconcileEnabled,
        lastReconcileAt: stats.lastReconcileAt,
        startupRoomsReconciled: stats.startupRoomsReconciled,
      },
    });
  });
}
