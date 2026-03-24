/**
 * Presence bridge authentication — shared-secret + SSE ticket pattern.
 *
 * Two layers:
 *   1. REST endpoints (GET /presence/:roomId, POST /presence/ticket):
 *      Protected by a shared secret via `Authorization: Bearer <secret>` header.
 *
 *   2. SSE endpoint (GET /presence/:roomId/stream):
 *      Protected by a single-use, short-lived ticket passed as `?ticket=xxx`.
 *      Tickets are obtained via POST /presence/ticket (which itself requires Bearer auth).
 *
 * When BRIDGE_AUTH_SECRET is empty, all auth is disabled (dev mode).
 *
 * Ticket lifecycle:
 *   - Created via POST /presence/ticket (requires Bearer auth)
 *   - TTL: 60 seconds
 *   - Single-use: consumed on first SSE connection
 *   - Scoped to a specific roomId
 *   - Automatic cleanup every 60 seconds removes expired tickets
 */

import type { Context, Next } from 'hono';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ticket {
  roomId: string;
  expiresAt: number;
}

// ── Ticket store ──────────────────────────────────────────────────────────────

const tickets = new Map<string, Ticket>();

const TICKET_TTL_MS = 60_000; // 60 seconds
const CLEANUP_INTERVAL_MS = 60_000; // run cleanup every 60 seconds

// Periodic cleanup of expired tickets
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, ticket] of tickets) {
    if (ticket.expiresAt <= now) tickets.delete(id);
  }
}, CLEANUP_INTERVAL_MS);

// Allow the process to exit cleanly even if the timer is running
if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
  cleanupTimer.unref();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a Hono middleware that checks `Authorization: Bearer <secret>`.
 * If `secret` is empty, the middleware is a no-op (dev mode).
 */
export function bearerAuthMiddleware(secret: string) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    if (!secret) return next(); // dev mode — no auth

    const authHeader = c.req.header('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token || token !== secret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return next();
  };
}

/**
 * Create a ticket for a given roomId. Returns the ticket ID.
 */
export function createTicket(roomId: string): { ticket: string; expiresIn: number } {
  const id = crypto.randomUUID();
  tickets.set(id, {
    roomId,
    expiresAt: Date.now() + TICKET_TTL_MS,
  });
  return { ticket: id, expiresIn: Math.floor(TICKET_TTL_MS / 1000) };
}

/**
 * Validate and consume a ticket. Returns true if valid, false otherwise.
 * Tickets are single-use — they are deleted after successful validation.
 */
export function validateTicket(ticketId: string, roomId: string): boolean {
  const ticket = tickets.get(ticketId);
  if (!ticket) return false;

  // Always delete — single use regardless of validity
  tickets.delete(ticketId);

  if (ticket.expiresAt <= Date.now()) return false;
  if (ticket.roomId !== roomId) return false;

  return true;
}

/**
 * SSE ticket validation middleware for Hono.
 * Reads `?ticket=xxx` from query params and validates against the roomId from
 * either `?roomId=` or the route param.
 * If `secret` is empty (dev mode), the middleware is a no-op.
 */
export function sseTicketMiddleware(secret: string) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    if (!secret) return next(); // dev mode — no auth

    const ticketId = c.req.query('ticket') ?? '';
    const roomId = c.req.query('roomId') ?? c.req.param('roomId') ?? '';

    if (!ticketId || !validateTicket(ticketId, roomId)) {
      return c.json({ error: 'Invalid or expired ticket' }, 401);
    }

    return next();
  };
}
