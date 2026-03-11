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
    console.warn('[webhook] signature verification failed:', (err as Error).message);
    return c.text('Unauthorized', 401);
  }

  const roomId = event.room?.name;
  if (!roomId) return c.text('ok');

  const p = event.participant;
  const identity = p?.identity;
  if (!identity) return c.text('ok');

  const userId = resolveMatrixUserId(identity, p?.attributes as Record<string, string> | undefined);
  const track = event.track;
  const source = track?.source as TrackSource | undefined;

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
      console.log(`[+] ${userId} (${identity}) joined ${roomId}`);
      break;
    }

    case 'participant_left':
      // Fix F: pass identity for multi-device tracking
      removePresence(roomId, identity, userId);
      console.log(`[-] ${userId} (${identity}) left ${roomId}`);
      break;

    case 'track_muted':
      if (source === 'MICROPHONE') setPresence(roomId, identity, userId, { isMicMuted: true });
      if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: false });
      if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: false });
      break;

    case 'track_unmuted':
      if (source === 'MICROPHONE') setPresence(roomId, identity, userId, { isMicMuted: false });
      if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: true });
      if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: true });
      break;

    case 'track_published':
      if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: !(track?.muted ?? false) });
      if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: !(track?.muted ?? false) });
      break;

    case 'track_unpublished':
      if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: false });
      if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: false });
      break;

    case 'participant_attributes_changed': {
      const attrs = (p?.attributes ?? {}) as Record<string, string>;
      setPresence(roomId, identity, userId, { isDeafened: attrs.isDeafened === '1' });
      break;
    }

    default:
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
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      // Fix B: clear heartbeat timer on stream cancel
      if (heartbeatId !== null) { clearInterval(heartbeatId); heartbeatId = null; }
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
  c.json({ status: 'ok', rooms: roomState.size })
);

// ── Start ──────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);
console.log(`[bridge] Presence Bridge running on port ${PORT}`);
console.log(`[bridge] LiveKit API key: ${LIVEKIT_API_KEY ? '✓ set' : '✗ MISSING'}`);

export default { port: PORT, fetch: app.fetch, idleTimeout: 0 };
