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

  private readonly stats: BridgeStats;

  constructor(stats: BridgeStats) {
    this.stats = stats;
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

  /** Broadcast a presence update to all subscribers of a room. */
  broadcast(
    roomId: string,
    userId: string,
    presence: ParticipantPresence,
    type: 'update' | 'left',
  ): void {
    const set = this.subscribers.get(roomId);
    if (!set?.size) return;
    // Destructure to avoid duplicate `type` key when spreading presence (which also has `type`)
    const { type: _presenceType, ...rest } = presence;
    const payload = JSON.stringify({ userId, type, ...rest });
    for (const send of set) {
      try {
        send(payload);
      } catch {
        // Subscriber already closed — will be cleaned up on abort
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

  /** Number of rooms with at least one active SSE subscriber. */
  get activeRooms(): number {
    return this.subscribers.size;
  }
}
