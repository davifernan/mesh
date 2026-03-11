/**
 * BetterCord Presence Bridge
 *
 * Receives LiveKit webhooks and exposes real-time participant presence
 * (muted, camera, screenshare, deafened) via REST + SSE.
 *
 * This is the server-side source of truth for call state — completely
 * independent of which frontend code version each client runs.
 *
 * Endpoints:
 *   POST /webhook                          LiveKit webhook receiver
 *   GET  /presence/:roomId                 Full room snapshot (JSON)
 *   GET  /presence/:roomId/stream          SSE stream — pushes updates live
 *
 * Env vars:
 *   LIVEKIT_API_KEY     LiveKit server API key
 *   LIVEKIT_API_SECRET  LiveKit server API secret
 *   PORT                Listening port (default: 3001)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WebhookReceiver } from 'livekit-server-sdk';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ParticipantPresence = {
  isMicMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  updatedAt: number;
  // Fix A-bridge: protocol type field
  type: 'update' | 'left';
};

type TrackSource = 'UNKNOWN' | 'CAMERA' | 'MICROPHONE' | 'SCREEN_SHARE' | 'SCREEN_SHARE_AUDIO';

// ── Matrix UserId resolution ───────────────────────────────────────────────────

/**
 * Extract the bare Matrix user ID from a LiveKit participant identity.
 *
 * LiveKit identity formats used by BetterCord / matrix-js-sdk MatrixRTC:
 *   "@alice:server.com"                — legacy (no device suffix)
 *   "@alice:server.com_DEVICEID"       — MSC4143
 *   "_@alice:server.com_DEVICEID"      — MSC4143 (leading underscore variant)
 *
 * The "io.element.owned_by" participant attribute always takes priority when set.
 */
function resolveMatrixUserId(
  identity: string,
  attributes?: Record<string, string>,
): string {
  // Attribute takes priority (set by element-call-compatible clients)
  const owned = attributes?.['io.element.owned_by'];
  if (owned) return owned;

  // Strip leading underscore (MSC4143 variant)
  const id = identity.startsWith('_') ? identity.slice(1) : identity;

  // Identity must start with '@' for a valid Matrix user ID
  if (!id.startsWith('@')) return identity;

  // Find the server part: "@user:server"
  const colonIdx = id.indexOf(':');
  if (colonIdx === -1) return identity;

  // Strip "_DEVICEID" suffix — device IDs are uppercase alphanumeric, typically 10+ chars
  const afterColon = id.slice(colonIdx + 1);
  const underscoreIdx = afterColon.indexOf('_');
  if (underscoreIdx === -1) return id; // no suffix → already a bare Matrix user ID

  return id.slice(0, colonIdx + 1 + underscoreIdx);
}

// ── In-memory state ────────────────────────────────────────────────────────────

// Fix F: Two-map structure for multi-device support
// identity → { userId, presence } per room
const identityState = new Map<string, Map<string, { userId: string; presence: ParticipantPresence }>>();
// roomId → userId → latest aggregated presence (derived, for fast reads)
const roomState = new Map<string, Map<string, ParticipantPresence>>();

// SSE subscribers: roomId → Set of send functions
type SendFn = (payload: string) => void;
const sseSubscribers = new Map<string, Set<SendFn>>();

// ── Stats (observable via /health) ────────────────────────────────────────────
const stats = {
  webhooksReceived: 0,
  webhooksRejected: 0,
  webhookEventCounts: {} as Record<string, number>,
  sseConnectionsTotal: 0,
  sseConnectionsActive: 0,
};

function ensureRoom(roomId: string): Map<string, ParticipantPresence> {
  if (!roomState.has(roomId)) roomState.set(roomId, new Map());
  return roomState.get(roomId)!;
}

function ensureIdentityRoom(roomId: string): Map<string, { userId: string; presence: ParticipantPresence }> {
  if (!identityState.has(roomId)) identityState.set(roomId, new Map());
  return identityState.get(roomId)!;
}

// Fix F: recomputeUserState helper
function recomputeUserState(roomId: string, userId: string): void {
  const idRoom = identityState.get(roomId);
  const candidates: ParticipantPresence[] = [];

  if (idRoom) {
    for (const entry of idRoom.values()) {
      if (entry.userId === userId) {
        candidates.push(entry.presence);
      }
    }
  }

  if (candidates.length === 0) {
    // No identities remain → remove from roomState and broadcast 'left'
    const room = roomState.get(roomId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) roomState.delete(roomId);
    }
    broadcast(roomId, userId, {
      isMicMuted: false,
      isCameraOn: false,
      isScreenSharing: false,
      isDeafened: false,
      updatedAt: Date.now(),
      type: 'left',
    }, 'left');
  } else {
    // Pick highest updatedAt entry
    const best = candidates.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
    ensureRoom(roomId).set(userId, best);
    broadcast(roomId, userId, best, 'update');
  }
}

// Fix A-bridge: broadcast accepts type param and includes it in payload
function broadcast(roomId: string, userId: string, presence: ParticipantPresence, type: 'update' | 'left') {
  const subscribers = sseSubscribers.get(roomId);
  if (!subscribers?.size) return;
  const payload = JSON.stringify({ userId, type, ...presence });
  for (const send of subscribers) {
    try { send(payload); } catch { /* subscriber closed */ }
  }
}

function setPresence(roomId: string, identity: string, userId: string, patch: Partial<ParticipantPresence>) {
  const idRoom = ensureIdentityRoom(roomId);
  const existing = idRoom.get(identity);
  const prev: ParticipantPresence = existing?.presence ?? {
    isMicMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isDeafened: false,
    updatedAt: 0,
    type: 'update',
  };
  const next: ParticipantPresence = { ...prev, ...patch, updatedAt: Date.now(), type: 'update' };

  // Fix E: skip broadcast if nothing changed
  const changed =
    next.isMicMuted !== prev.isMicMuted ||
    next.isCameraOn !== prev.isCameraOn ||
    next.isScreenSharing !== prev.isScreenSharing ||
    next.isDeafened !== prev.isDeafened;
  if (!changed) return; // skip broadcast, state is identical

  idRoom.set(identity, { userId, presence: next });
  recomputeUserState(roomId, userId);
}

/**
 * If the participant's attributes contain an explicit `isDeafened` key,
 * sync the deafen state into the presence entry.
 * Called from track-event cases as a fallback for when
 * `participant_attributes_changed` does not fire reliably.
 * Does NOT call setPresence when the attribute is absent — a missing key
 * is not the same as "not deafened".
 */
function syncDeafenFromAttrs(
  roomId: string,
  identity: string,
  userId: string,
  attrs: Record<string, string> | undefined,
): void {
  if (!attrs || !('isDeafened' in attrs)) return;
  setPresence(roomId, identity, userId, { isDeafened: attrs.isDeafened === '1' });
}

function removePresence(roomId: string, identity: string, userId: string) {
  const room = roomState.get(roomId);
  if (!room) return;

  // Fix H2: guard for missing userId
  if (!room.has(userId)) {
    // Still clean up identity state if needed
    const idRoom = identityState.get(roomId);
    if (idRoom) {
      idRoom.delete(identity);
      if (idRoom.size === 0) identityState.delete(roomId);
    }
    return;
  }

  // Remove from identity map
  const idRoom = identityState.get(roomId);
  if (idRoom) {
    idRoom.delete(identity);
    if (idRoom.size === 0) identityState.delete(roomId);
  }

  // Recompute — will broadcast 'left' if no identities remain for userId
  recomputeUserState(roomId, userId);
}

// ── Webhook receiver ───────────────────────────────────────────────────────────

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? '';
const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

// Fix D: startup validation for missing credentials
if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error('[bridge] FATAL: LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set. Webhook signature verification will fail.');
}

// ── Hono app ───────────────────────────────────────────────────────────────────

const app = new Hono();
app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }));

// ── POST /webhook ──────────────────────────────────────────────────────────────

app.post('/webhook', async (c) => {
  const body = await c.req.text();
  const authHeader = c.req.header('Authorization') ?? '';

  let event: Awaited<ReturnType<typeof receiver.receive>>;
  try {
    event = await receiver.receive(body, authHeader);
  } catch (err) {
    stats.webhooksRejected += 1;
    console.warn(
      '[webhook] Signature verification FAILED — LiveKit credentials may be wrong.',
      'Error:', (err as Error).message,
      'Tip: check LIVEKIT_API_KEY and LIVEKIT_API_SECRET match your LiveKit dashboard.',
    );
    return c.text('Unauthorized', 401);
  }

  stats.webhooksReceived += 1;
  const eventName = event.event ?? 'unknown';
  stats.webhookEventCounts[eventName] = (stats.webhookEventCounts[eventName] ?? 0) + 1;

  const roomId = event.room?.name;
  if (!roomId) return c.text('ok');

  const p = event.participant;
  const identity = p?.identity;
  if (!identity) return c.text('ok');

  const userId = resolveMatrixUserId(identity, p?.attributes as Record<string, string> | undefined);
  const track = event.track;
  const source = track?.source as TrackSource | undefined;
  const pAttrs = p?.attributes as Record<string, string> | undefined;

  switch (event.event) {
    case 'participant_joined': {
      // Fix F: store by identity, derive initial state
      const initial: ParticipantPresence = {
        isMicMuted: false,
        isCameraOn: false,
        isScreenSharing: false,
        isDeafened: (p?.attributes as Record<string, string> | undefined)?.isDeafened === '1',
        updatedAt: Date.now(),
        type: 'update',
      };
      for (const t of (p?.tracks ?? []) as Array<{ source: TrackSource; muted?: boolean }>) {
        if (t.source === 'MICROPHONE') initial.isMicMuted = t.muted ?? false;
        if (t.source === 'CAMERA') initial.isCameraOn = !(t.muted ?? true);
        if (t.source === 'SCREEN_SHARE') initial.isScreenSharing = !(t.muted ?? true);
      }
      // Add to identityState, recompute roomState
      ensureIdentityRoom(roomId).set(identity, { userId, presence: initial });
      ensureRoom(roomId).set(userId, initial);
      // Fix A-bridge: broadcast with type: 'update'
      broadcast(roomId, userId, initial, 'update');
      console.log(`[join] ${userId} in ${roomId} (identity: ${identity})`);
      break;
    }

    case 'participant_left':
      // Fix F: pass identity for multi-device tracking
      removePresence(roomId, identity, userId);
      console.log(`[left] ${userId} in ${roomId} (identity: ${identity})`);
      break;

    case 'track_muted':
      if (source === 'MICROPHONE') setPresence(roomId, identity, userId, { isMicMuted: true });
      if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: false });
      if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: false });
      if (source === 'MICROPHONE' || source === 'CAMERA' || source === 'SCREEN_SHARE') {
        console.debug(`[muted] ${userId} source=${source} in ${roomId}`);
      }
      syncDeafenFromAttrs(roomId, identity, userId, pAttrs);
      break;

    case 'track_unmuted':
      if (source === 'MICROPHONE') setPresence(roomId, identity, userId, { isMicMuted: false });
      if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: true });
      if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: true });
      if (source === 'MICROPHONE' || source === 'CAMERA' || source === 'SCREEN_SHARE') {
        console.debug(`[unmuted] ${userId} source=${source} in ${roomId}`);
      }
      syncDeafenFromAttrs(roomId, identity, userId, pAttrs);
      break;

    case 'track_published':
      // stopMicTrackOnMute:false means LiveKit un-/republishes the mic track instead of
      // sending track_muted/track_unmuted — so we must handle MICROPHONE here too.
      if (source === 'MICROPHONE') setPresence(roomId, identity, userId, { isMicMuted: track?.muted ?? false });
      if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: !(track?.muted ?? false) });
      if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: !(track?.muted ?? false) });
      if (source === 'MICROPHONE' || source === 'CAMERA' || source === 'SCREEN_SHARE') {
        console.debug(`[published] ${userId} source=${source} muted=${track?.muted ?? false} in ${roomId}`);
      }
      syncDeafenFromAttrs(roomId, identity, userId, pAttrs);
      break;

    case 'track_unpublished':
      // Mirror of track_published: MICROPHONE unpublish = muted.
      if (source === 'MICROPHONE') setPresence(roomId, identity, userId, { isMicMuted: true });
      if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: false });
      if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: false });
      if (source === 'MICROPHONE' || source === 'CAMERA' || source === 'SCREEN_SHARE') {
        console.debug(`[unpublished] ${userId} source=${source} in ${roomId}`);
      }
      syncDeafenFromAttrs(roomId, identity, userId, pAttrs);
      break;

    case 'participant_attributes_changed': {
      const attrs = (p?.attributes ?? {}) as Record<string, string>;
      setPresence(roomId, identity, userId, { isDeafened: attrs.isDeafened === '1' });
      console.debug(`[attrs] ${userId} isDeafened=${attrs.isDeafened} in ${roomId}`);
      break;
    }

    default:
      if (event.event) {
        console.debug(`[webhook] Unhandled event type: ${event.event}`);
      }
      break;
  }

  return c.text('ok');
});

// ── GET /presence/:roomId ──────────────────────────────────────────────────────

app.get('/presence/:roomId', (c) => {
  const roomId = c.req.param('roomId');
  const room = roomState.get(roomId);
  if (!room) return c.json({});
  return c.json(Object.fromEntries(room));
});

// ── GET /presence/:roomId/stream (SSE) ────────────────────────────────────────

app.get('/presence/:roomId/stream', (c) => {
  const roomId = c.req.param('roomId');
  const encoder = new TextEncoder();

  let localSend: SendFn | undefined;
  // Fix B: declare heartbeatId in outer scope so cancel() can clear it
  let heartbeatId: ReturnType<typeof setInterval> | null = null;

  const body = new ReadableStream({
    start(controller) {
      localSend = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          // controller already closed — subscriber was already removed
        }
      };

      // Send current snapshot immediately on connect
      const room = roomState.get(roomId);
      if (room) {
        for (const [uid, presence] of room) {
          localSend(JSON.stringify({ userId: uid, type: 'update', ...presence }));
        }
      }

      // Register subscriber
      if (!sseSubscribers.has(roomId)) sseSubscribers.set(roomId, new Set());
      sseSubscribers.get(roomId)!.add(localSend);
      stats.sseConnectionsTotal += 1;
      stats.sseConnectionsActive += 1;
      console.debug(`[sse] Client connected to ${roomId} (active: ${stats.sseConnectionsActive})`);

      // Heartbeat every 25s to keep connection alive through proxies
      // Fix B: assign to outer-scope variable so cancel() can clear it
      heartbeatId = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); }
        catch { if (heartbeatId !== null) { clearInterval(heartbeatId); heartbeatId = null; } }
      }, 25_000);

      // Cleanup when client disconnects
      c.req.raw.signal.addEventListener('abort', () => {
        if (heartbeatId !== null) { clearInterval(heartbeatId); heartbeatId = null; }
        if (localSend) {
          sseSubscribers.get(roomId)?.delete(localSend);
          if (sseSubscribers.get(roomId)?.size === 0) sseSubscribers.delete(roomId);
        }
        stats.sseConnectionsActive = Math.max(0, stats.sseConnectionsActive - 1);
        console.debug(`[sse] Client disconnected from ${roomId} (active: ${stats.sseConnectionsActive})`);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      // Fix B: clear heartbeat timer on stream cancel
      if (heartbeatId !== null) { clearInterval(heartbeatId); heartbeatId = null; }
      stats.sseConnectionsActive = Math.max(0, stats.sseConnectionsActive - 1);
      if (localSend) {
        sseSubscribers.get(roomId)?.delete(localSend);
        if (sseSubscribers.get(roomId)?.size === 0) sseSubscribers.delete(roomId);
      }
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

// ── Health check ───────────────────────────────────────────────────────────────

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    rooms: roomState.size,
    sseConnectionsActive: stats.sseConnectionsActive,
    sseConnectionsTotal: stats.sseConnectionsTotal,
    webhooksReceived: stats.webhooksReceived,
    webhooksRejected: stats.webhooksRejected,
    webhookEventCounts: stats.webhookEventCounts,
  })
);

// ── Start ──────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);
console.log(`[bridge] ─────────────────────────────────────────────`);
console.log(`[bridge] BetterCord Presence Bridge starting on port ${PORT}`);
console.log(`[bridge] LiveKit API key:    ${LIVEKIT_API_KEY ? '✓ set' : '✗ MISSING — webhooks will be rejected!'}`);
console.log(`[bridge] LiveKit API secret: ${LIVEKIT_API_SECRET ? '✓ set' : '✗ MISSING — webhooks will be rejected!'}`);
console.log(`[bridge] Endpoints:`);
console.log(`[bridge]   POST /webhook              — LiveKit webhook receiver`);
console.log(`[bridge]   GET  /presence/:roomId     — full room snapshot`);
console.log(`[bridge]   GET  /presence/:roomId/stream — SSE stream`);
console.log(`[bridge]   GET  /health               — health + stats`);
console.log(`[bridge] ─────────────────────────────────────────────`);

export default { port: PORT, fetch: app.fetch, idleTimeout: 0 };

// ── Test-only exports (tree-shaken in production) ─────────────────────────────
export { app as _testApp, roomState as _testRoomState, identityState as _testIdentityState };
