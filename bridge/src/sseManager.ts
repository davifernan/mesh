/**
 * SSE (Server-Sent Events) manager.
 *
 * Manages a pool of active SSE connections keyed by roomId.
 * Responsible for:
 *   - Registering / deregistering send functions per room
 *   - Broadcasting presence updates to all subscribers of a room
 *   - Sending snapshot_end sentinel after initial snapshot replay
 *   - Tracking connection stats
 */

import type { ParticipantPresence, SendFn, BridgeStats } from './types.js';

export class SSEManager {
  /** roomId → Set of active send functions */
  private readonly subscribers = new Map<string, Set<SendFn>>();

  /**
   * Bidirectional alias map: livekitRoomName ↔ matrixRoomId.
   * When broadcasting on a LiveKit room name, also broadcast to
   * subscribers listening on the Matrix room ID (and vice versa).
   */
  private readonly aliases = new Map<string, string>();

  private readonly stats: BridgeStats;

  constructor(stats: BridgeStats) {
    this.stats = stats;
  }

  /**
   * Register a bidirectional alias between a Matrix room ID and a LiveKit
   * room name. Broadcasts to either key will reach subscribers on both.
   */
  setAlias(matrixRoomId: string, livekitRoomName: string): void {
    this.aliases.set(matrixRoomId, livekitRoomName);
    this.aliases.set(livekitRoomName, matrixRoomId);
  }

  /**
   * Register a send function for a room.
   * Returns a cleanup function that removes the subscriber.
   */
  subscribe(roomId: string, send: SendFn): () => void {
    if (!this.subscribers.has(roomId)) this.subscribers.set(roomId, new Set());
    this.subscribers.get(roomId)!.add(send);
    this.stats.sseConnectionsTotal += 1;
    this.stats.sseConnectionsActive += 1;

    return () => {
      this.unsubscribe(roomId, send);
    };
  }

  /** Remove a specific send function from a room's subscriber set. */
  unsubscribe(roomId: string, send: SendFn): void {
    const set = this.subscribers.get(roomId);
    if (!set) return;
    set.delete(send);
    if (set.size === 0) this.subscribers.delete(roomId);
    this.stats.sseConnectionsActive = Math.max(0, this.stats.sseConnectionsActive - 1);
  }

  /** Broadcast a presence update to all subscribers of a room (+ aliases). */
  broadcast(
    roomId: string,
    userId: string,
    presence: ParticipantPresence,
    type: 'update' | 'left',
  ): void {
    // Destructure to avoid duplicate `type` key when spreading presence (which also has `type`)
    const { type: _presenceType, ...rest } = presence;
    const payload = JSON.stringify({ userId, type, ...rest });

    // Send to subscribers on the primary key
    const primary = this.subscribers.get(roomId);
    if (primary?.size) {
      for (const send of primary) {
        try { send(payload); } catch { /* closed */ }
      }
    }

    // Also send to subscribers on the alias key (e.g. Matrix room ID ↔ LiveKit name)
    const aliasKey = this.aliases.get(roomId);
    if (aliasKey) {
      const aliased = this.subscribers.get(aliasKey);
      if (aliased?.size) {
        for (const send of aliased) {
          try { send(payload); } catch { /* closed */ }
        }
      }
    }
  }

  /**
   * Send a snapshot_end sentinel to a single subscriber (not broadcast).
   * Called after replaying the initial snapshot to a newly connected client
   * so the client knows all snapshot events have been delivered and subsequent
   * events are live updates with seq > snapshotSeq.
   */
  sendSnapshotEnd(send: SendFn, snapshotSeq: number): void {
    try {
      send(JSON.stringify({ type: 'snapshot_end', seq: snapshotSeq }));
    } catch {
      // Already closed
    }
  }

  /**
   * Send a presence update to subscribers of a SPECIFIC key only (no alias expansion).
   * Used for snapshot replays after a new alias is created — avoids duplicating
   * events to subscribers on the primary key who already have the data.
   */
  broadcastDirect(
    roomId: string,
    userId: string,
    presence: ParticipantPresence,
    type: 'update' | 'left',
  ): void {
    const set = this.subscribers.get(roomId);
    if (!set?.size) return;
    const { type: _presenceType, ...rest } = presence;
    const payload = JSON.stringify({ userId, type, ...rest });
    for (const send of set) {
      try { send(payload); } catch { /* closed */ }
    }
  }

  /** Number of rooms with at least one active SSE subscriber. */
  get activeRooms(): number {
    return this.subscribers.size;
  }
}
