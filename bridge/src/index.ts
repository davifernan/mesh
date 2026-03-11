/**
 * BetterCord Presence Bridge — entry point
 *
 * Wires together the modular components and starts the Hono/Bun HTTP server.
 *
 * Endpoints:
 *   POST /webhook                          LiveKit webhook receiver
 *   GET  /presence/:roomId                 Full room snapshot (JSON)
 *   GET  /presence/:roomId/stream          SSE stream — pushes updates live
 *   GET  /health                           Health + operational stats
 *
 * Env vars:
 *   LIVEKIT_API_KEY     LiveKit server API key (required for webhook verification)
 *   LIVEKIT_API_SECRET  LiveKit server API secret (required for webhook verification)
 *   LIVEKIT_URL         LiveKit server URL — enables reconcile when set
 *                       (e.g. https://livekit.example.com)
 *   REDIS_URL           Redis connection URL — enables Redis store when set
 *                       (e.g. redis://localhost:6379)
 *   PORT                Listening port (default: 3001)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { BridgeStats } from './types.js';
import { InMemoryVoiceStateStore } from './store.js';
import type { VoiceStateStore } from './store.js';
import { RedisVoiceStateStore } from './redisStore.js';
import { SSEManager } from './sseManager.js';
import { Reconciler } from './reconciler.js';
import { createWebhookHandler } from './webhookHandler.js';
import { registerPresenceRoutes } from './presenceRoutes.js';
import { registerHealthRoute } from './healthRoute.js';

// ── Env ───────────────────────────────────────────────────────────────────────

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? '';
const LIVEKIT_URL = process.env.LIVEKIT_URL ?? '';
const REDIS_URL = process.env.REDIS_URL ?? '';
const BRIDGE_VOICE_STATE_AUTHORITATIVE = process.env.BRIDGE_VOICE_STATE_AUTHORITATIVE === 'true';
const PORT = Number(process.env.PORT ?? 3001);

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error(
    '[bridge] FATAL: LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set. ' +
    'Webhook signature verification will fail.',
  );
}

// ── Shared state ──────────────────────────────────────────────────────────────

const stats: BridgeStats = {
  webhooksReceived: 0,
  webhooksRejected: 0,
  webhookEventCounts: {},
  sseConnectionsTotal: 0,
  sseConnectionsActive: 0,
  storeBackend: REDIS_URL ? 'redis' : 'memory',
  redisConnected: false,
  reconcileEnabled: Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET),
  lastReconcileAt: 0,
  startupRoomsReconciled: 0,
};

// ── Store selection ───────────────────────────────────────────────────────────

let store: VoiceStateStore;
let redisStore: RedisVoiceStateStore | undefined;

if (REDIS_URL) {
  redisStore = new RedisVoiceStateStore(REDIS_URL);
  store = redisStore;
  console.log(`[bridge] Store backend: Redis (${REDIS_URL.replace(/:[^:@]*@/, ':***@')})`);
} else {
  store = new InMemoryVoiceStateStore();
  stats.redisConnected = false; // not applicable
  console.log('[bridge] Store backend: in-memory');
}

if (BRIDGE_VOICE_STATE_AUTHORITATIVE && !REDIS_URL) {
  console.warn('[bridge] BRIDGE_VOICE_STATE_AUTHORITATIVE=true but REDIS_URL is not set. Continuing with in-memory store only.');
}

// ── Reconciler (optional) ─────────────────────────────────────────────────────

let reconciler: Reconciler | undefined;

if (LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
  reconciler = new Reconciler(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, store, stats);
  console.log(`[bridge] Reconciler: enabled (LiveKit URL: ${LIVEKIT_URL})`);
} else {
  console.log('[bridge] Reconciler: disabled (set LIVEKIT_URL to enable)');
}

// ── Hono app ──────────────────────────────────────────────────────────────────

const sse = new SSEManager(stats);
const app = new Hono();
app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }));

app.post('/webhook', createWebhookHandler(store, sse, stats, LIVEKIT_API_KEY, LIVEKIT_API_SECRET));
registerPresenceRoutes(app, store, sse, stats, reconciler);
registerHealthRoute(app, store, stats);

// ── Startup banner ────────────────────────────────────────────────────────────

console.log(`[bridge] ─────────────────────────────────────────────`);
console.log(`[bridge] BetterCord Presence Bridge starting on port ${PORT}`);
console.log(`[bridge] LiveKit API key:    ${LIVEKIT_API_KEY ? '✓ set' : '✗ MISSING — webhooks will be rejected!'}`);
console.log(`[bridge] LiveKit API secret: ${LIVEKIT_API_SECRET ? '✓ set' : '✗ MISSING — webhooks will be rejected!'}`);
console.log(`[bridge] LiveKit URL:        ${LIVEKIT_URL || '(not set — reconcile disabled)'}`);
console.log(`[bridge] Redis URL:          ${REDIS_URL ? '✓ set' : '(not set — using in-memory store)'}`);
console.log(`[bridge] Authoritative mode: ${BRIDGE_VOICE_STATE_AUTHORITATIVE ? 'enabled' : 'disabled'}`);
console.log(`[bridge] Endpoints:`);
console.log(`[bridge]   POST /webhook              — LiveKit webhook receiver`);
console.log(`[bridge]   GET  /presence/:roomId     — full room snapshot`);
console.log(`[bridge]   GET  /presence/:roomId/stream — SSE stream`);
console.log(`[bridge]   GET  /health               — health + stats`);
console.log(`[bridge] ─────────────────────────────────────────────`);

// ── Startup reconcile ─────────────────────────────────────────────────────────
// Run after server is ready so the port is bound before we make outbound calls.
// Errors are caught inside reconcileAll() and logged — they do not crash the bridge.

if (reconciler) {
  // Defer to next tick so the Bun server export is returned first
  setTimeout(() => {
    reconciler!.reconcileAll().then(() => {
      // Keep redisConnected in sync after reconcile (Redis store updates it on each call)
      if (redisStore) stats.redisConnected = redisStore.connected;
    });
  }, 0);
}

// ── Redis health sync ─────────────────────────────────────────────────────────
// Poll the Redis store's connection state into stats every 10 s.

if (redisStore) {
  setInterval(() => {
    if (redisStore) stats.redisConnected = redisStore.connected;
  }, 10_000);
}

// ── Bun server export ─────────────────────────────────────────────────────────

export default { port: PORT, fetch: app.fetch, idleTimeout: 0 };

// ── Test-only exports (tree-shaken in production) ─────────────────────────────
export { app as _testApp, store as _testStore };
